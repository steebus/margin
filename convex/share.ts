import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { action, type ActionCtx } from './_generated/server'
import { askGemini } from './lib/gemini'
import { instagramCaption, mentionsPrompt, parseMentions, sameBook, titlesFrom, type Mention } from './lib/shareRead'
import { pace, searchHardcover, type Found } from './hardcover'

const CONFIDENT = 0.6

export type Candidate = { named: string; book: Found; onShelves: boolean; ticked: boolean }

/** Checks each named book against search, so a mention that matches nothing isn't offered as if it were a book. */
async function candidates(ctx: ActionCtx, mentions: Mention[]) {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw new ConvexError('Sign in to add books')
  const mine = await ctx.runQuery(internal.books.shelved, { userId })
  const found: Candidate[] = []
  const missed: string[] = []
  for (const [i, mention] of mentions.entries()) {
    if (i) await pace()
    const [top] = await searchHardcover(mention.author ? `${mention.title} ${mention.author}` : mention.title)
    if (!top) { missed.push(mention.title); continue }
    if (found.some(c => c.book.hardcoverId === top.hardcoverId)) continue
    const onShelves = mine.includes(top.hardcoverId)
    found.push({ named: mention.title, book: top, onShelves, ticked: !onShelves && mention.confidence >= CONFIDENT && sameBook(mention.title, top.title) })
  }
  return { found, missed }
}

/** Reads a public Instagram post's caption. Asks openly, as Margin: a post that won't say simply has nothing to read. */
export const readPost = action({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    if (!await getAuthUserId(ctx)) throw new ConvexError('Sign in to read a post')
    if (!/^[\w-]+$/.test(code)) throw new ConvexError("That isn't an Instagram post")
    let caption: string | null = null
    let account: string | null = null
    try {
      const res = await fetch(`https://www.instagram.com/p/${code}/embed/captioned/`, { headers: { 'user-agent': 'margin/1.0' } })
      if (res.ok) ({ caption, account } = instagramCaption(await res.text()))
    } catch (e) {
      console.error('The post would not open:', e instanceof Error ? e.message : e)
    }
    if (!caption) return { account, found: [] as Candidate[], missed: [] as string[], hadWords: false }
    const mentions = parseMentions(await askGemini([{ text: mentionsPrompt(caption) }], 'Reading the post'))
    return { account, ...await candidates(ctx, mentions), hadWords: true }
  },
})

/** Finds the books named in some words: selected on a page, or read from a screenshot. */
export const readWords = action({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    if (!await getAuthUserId(ctx)) throw new ConvexError('Sign in to read this')
    const mentions = parseMentions(await askGemini([{ text: mentionsPrompt(text) }], 'Reading those words'))
    return candidates(ctx, mentions)
  },
})

/** Looks up titles the reader typed, one per line. Needs no model, so it always works. */
export const findTitles = action({
  args: { text: v.string() },
  handler: async (ctx, { text }) => candidates(ctx, titlesFrom(text).map(title => ({ title, author: null, confidence: 1 }))),
})
