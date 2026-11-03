import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { internalMutation, internalQuery, mutation, query } from './_generated/server'
import { dueNudge, type Nudge } from './lib/nudge'

/** The key a device needs to subscribe. Public by design; the private half stays in Convex. */
export const publicKey = query({ args: {}, handler: async () => process.env.VAPID_PUBLIC_KEY ?? null })

export const isSubscribed = query({
  args: { endpoint: v.string() },
  handler: async (ctx, { endpoint }) => {
    const userId = await getAuthUserId(ctx)
    const sub = await ctx.db.query('pushSubscriptions').withIndex('by_endpoint', q => q.eq('endpoint', endpoint)).first()
    return !!userId && sub?.userId === userId
  },
})

export const subscribe = mutation({
  args: { endpoint: v.string(), p256dh: v.string(), auth: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new ConvexError('Sign in to get nudges')
    if (!args.endpoint.startsWith('https://')) throw new ConvexError('That device address is not one a browser gives')
    const known = await ctx.db.query('pushSubscriptions').withIndex('by_endpoint', q => q.eq('endpoint', args.endpoint)).first()
    if (known) await ctx.db.patch(known._id, { ...args, userId })
    else await ctx.db.insert('pushSubscriptions', { ...args, userId, createdAt: Date.now() })
  },
})

export const unsubscribe = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, { endpoint }) => {
    const userId = await getAuthUserId(ctx)
    const sub = await ctx.db.query('pushSubscriptions').withIndex('by_endpoint', q => q.eq('endpoint', endpoint)).first()
    if (sub && sub.userId === userId) await ctx.db.delete(sub._id)
  },
})

/** Who is due a nudge right now, and where to send it. */
export const due = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, { now }) => {
    const subs = await ctx.db.query('pushSubscriptions').collect()
    const out: { userId: Id<'users'>; nudge: Nudge; subs: { id: Id<'pushSubscriptions'>; endpoint: string; p256dh: string; auth: string }[] }[] = []
    for (const userId of new Set(subs.map(s => s.userId))) {
      const mine = subs.filter(s => s.userId === userId)
      const sent = mine.map(s => s.lastSentAt ?? 0)
      const reads = await ctx.db.query('reads').withIndex('by_user_status', q => q.eq('userId', userId).eq('status', 'reading')).collect()
      const reading = await Promise.all(reads.map(async r => {
        const work = await ctx.db.get(r.workId)
        const last = await ctx.db.query('progressLog').withIndex('by_read', q => q.eq('readId', r._id)).order('desc').first()
        return { title: work?.title ?? 'A book', slug: work?.slug ?? '', lastProgressAt: last?.at ?? r.startedAt ?? r.addedAt ?? r._creationTime }
      }))
      const waiting = (await Promise.all(reads.map(async r => {
        const work = await ctx.db.get(r.workId)
        const notes = await ctx.db.query('buddyQueue').withIndex('by_read', q => q.eq('readId', r._id)).collect()
        return notes.filter(n => n.state === 'pending').map(n => ({ title: work?.title ?? 'A book', slug: work?.slug ?? '', createdAt: n.createdAt }))
      }))).flat()
      const nudge = dueNudge({ reading, waiting, lastPushAt: Math.max(...sent) || null, now })
      if (nudge) out.push({ userId, nudge, subs: mine.map(s => ({ id: s._id, endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth })) })
    }
    return out
  },
})

export const sent = internalMutation({
  args: { ids: v.array(v.id('pushSubscriptions')), at: v.number() },
  handler: async (ctx, { ids, at }) => { for (const id of ids) await ctx.db.patch(id, { lastSentAt: at }) },
})

/** A device that has unsubscribed or gone away. The push service says so with a 404 or 410. */
export const gone = internalMutation({
  args: { id: v.id('pushSubscriptions') },
  handler: async (ctx, { id }) => { if (await ctx.db.get(id)) await ctx.db.delete(id) },
})
