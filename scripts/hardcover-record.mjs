// Records real, read-only Hardcover replies into fixtures/hardcover/, scrubbed of anything Steve wrote or that
// identifies his account, so the sync tests rest on Hardcover's real shapes (IMPROVEMENT-LOOP E5).
// Run: node --env-file=.env scripts/hardcover-record.mjs
// It sends queries only: anything that looks like a mutation is refused before it leaves.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const key = process.env.HARDCOVER_API_KEY
if (!key) throw new Error('HARDCOVER_API_KEY is missing: run with --env-file=.env')
const url = process.env.HARDCOVER_API_URL || 'https://api.hardcover.app/v1/graphql'

// The queries Margin really sends, read from its source so the recording can't drift from them.
const lib = readFileSync(new URL('../convex/lib/hardcover.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const constant = name => {
  const match = lib.match(new RegExp(`export const ${name} = (['\`])([\\s\\S]*?)\\1`))
  if (!match) throw new Error(`${name} not found in convex/lib/hardcover.ts`)
  return match[2]
}
const LIBRARY_QUERY = constant('LIBRARY_QUERY')
const SEARCH_QUERY = constant('SEARCH_QUERY')
const LISTS_QUERY = constant('LISTS_QUERY')
const JOURNAL_FIELDS = constant('JOURNAL_FIELDS')
const USER_BOOK_FIELDS = LIBRARY_QUERY.slice(LIBRARY_QUERY.indexOf('id status_id'), LIBRARY_QUERY.lastIndexOf('} }'))

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
async function gql(query, variables = {}) {
  if (/\bmutation\b/i.test(query)) throw new Error('Refusing to send a mutation.')
  await sleep(4500) // Margin's own pace
  const res = await fetch(url, {
    method: 'POST',
    headers: { authorization: /^bearer /i.test(key) ? key : `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json()
  if (!res.ok || json.errors) throw new Error(`Hardcover answered ${res.status}: ${JSON.stringify(json.errors ?? json).slice(0, 300)}`)
  return json
}

// Scrubbing. Catalog facts (titles, authors, editions, tags, covers) are public and stay. Ids of Steve's own
// records are renumbered consistently, so links between replies still hold. What he wrote is replaced.
const fakeIds = new Map()
const fake = (kind, id) => {
  if (id == null) return id
  const k = `${kind}:${id}`
  if (!fakeIds.has(k)) fakeIds.set(k, 1000 + fakeIds.size)
  return fakeIds.get(k)
}
const words = text => (typeof text === 'string' && text ? `Scrubbed text, ${text.length} characters long in the original.` : text)

function scrubUserBook(ub) {
  return {
    ...ub,
    id: fake('user_book', ub.id),
    review_raw: words(ub.review_raw),
    recommended_by: ub.recommended_by ? 'A friend' : ub.recommended_by,
    user_book_reads: ub.user_book_reads?.map(r => ({ ...r, id: fake('read', r.id) })),
  }
}
const scrubJournal = j => ({
  ...j,
  id: fake('journal', j.id),
  user_id: j.user_id === undefined ? undefined : fake('user', j.user_id),
  entry: j.event === 'quote' || j.event === 'note' ? words(j.entry) : j.entry,
  metadata: j.metadata && scrubMetadata(j.metadata),
})
// Journal metadata differs by event; list events carry the username and list.
function scrubMetadata(m) {
  const out = { ...m }
  if ('user_book_read_id' in m) out.user_book_read_id = fake('read', m.user_book_read_id)
  if ('list_id' in m) out.list_id = fake('list', m.list_id)
  if ('list_name' in m) out.list_name = 'A list'
  if ('username' in m) out.username = 'reader'
  return out
}
const scrubList = (l, i) => ({ ...l, id: fake('list', l.id), name: `List ${i + 1}`, slug: `list-${i + 1}` })

// Pick a varied handful: every status, an audiobook, an ebook, a review, a recommendation, a re-read.
function sample(books) {
  const picks = new Set()
  const take = test => { const b = books.find(b => !picks.has(b) && test(b)); if (b) picks.add(b) }
  for (const s of [1, 2, 3, 4, 5]) take(b => b.status_id === s)
  take(b => b.edition?.reading_format_id === 2)
  take(b => b.edition?.reading_format_id === 4)
  take(b => b.review_raw)
  take(b => b.recommended_by)
  take(b => (b.user_book_reads?.length ?? 0) > 1)
  take(b => !b.edition)
  take(b => b.rating && b.rating % 1)
  return [...picks]
}

const out = new URL('../fixtures/hardcover/', import.meta.url)
mkdirSync(out, { recursive: true })
const save = (name, query, variables, data) => {
  writeFileSync(new URL(`${name}.json`, out), JSON.stringify({ query, variables, data }, null, 2) + '\n')
  console.log(`saved ${name}.json`)
}

const meQuery = '{ me { id } }'
const me = (await gql(meQuery)).data
const userId = me.me[0].id
save('me', meQuery, {}, { me: [{ id: fake('user', userId) }] })

// The whole library, paged as Margin pages it, then a sample kept.
const all = []
for (let offset = 0; ; offset += 100) {
  const page = (await gql(LIBRARY_QUERY, { limit: 100, offset })).data.me[0].user_books
  all.push(...page)
  if (page.length < 100) break
}
const books = sample(all)
console.log(`library: ${all.length} books, kept ${books.length}`)
save('library', LIBRARY_QUERY, { limit: 100, offset: 0 }, { me: [{ user_books: books.map(scrubUserBook) }] })

// Journals: the quotes and notes Margin imports, a tagged one if any (H10), and one of every other event (H15).
const journalQuery = `query($u: Int!, $o: Int!) { reading_journals(where: {user_id: {_eq: $u}, event: {_in: ["quote", "note"]}}, limit: 100, offset: $o, order_by: {id: asc}) { ${JOURNAL_FIELDS} } }`
const notes = (await gql(journalQuery, { u: userId, o: 0 })).data.reading_journals
const keptNotes = [
  ...notes.filter(j => j.event === 'quote').slice(0, 2),
  ...notes.filter(j => j.event === 'note').slice(0, 2),
  ...notes.filter(j => j.taggings?.length).slice(0, 2),
].filter((j, i, list) => list.indexOf(j) === i)
save('journals', journalQuery, { u: fake('user', userId), o: 0 }, { reading_journals: keptNotes.map(scrubJournal) })

const eventsQuery = `query($u: Int!) { reading_journals(where: {user_id: {_eq: $u}}, limit: 500, order_by: {id: desc}) { ${JOURNAL_FIELDS} } }`
const recent = (await gql(eventsQuery, { u: userId })).data.reading_journals
const byEvent = [...new Map(recent.map(j => [j.event, j])).values()]
console.log(`journal events seen: ${byEvent.map(j => j.event).join(', ')}`)
save('journal-events', eventsQuery, { u: fake('user', userId) }, { reading_journals: byEvent.map(scrubJournal) })

// The two-minute sync, over the last 30 days so it has something in it.
const syncQuery = `query($since: timestamptz!, $sinceLocal: timestamp!, $u: Int!) {
  me { user_books(where: {updated_at: {_gt: $since}}, limit: 100, order_by: {updated_at: asc}) { ${USER_BOOK_FIELDS} } }
  reading_journals(where: {user_id: {_eq: $u}, updated_at: {_gt: $sinceLocal}}, limit: 100, order_by: {updated_at: asc}) { ${JOURNAL_FIELDS} }
}`
const since = new Date(Date.now() - 30 * 864e5).toISOString()
const sync = (await gql(syncQuery, { since, sinceLocal: since, u: userId })).data
save('sync', syncQuery, { since, sinceLocal: since, u: fake('user', userId) }, {
  me: [{ user_books: sync.me[0].user_books.slice(0, 3).map(scrubUserBook) }],
  reading_journals: sync.reading_journals.slice(0, 5).map(scrubJournal),
})

const lists = (await gql(LISTS_QUERY)).data.me[0].lists
save('lists', LISTS_QUERY, {}, { me: [{ lists: lists.slice(0, 3).map((l, i) => scrubList({ ...l, list_books: l.list_books.slice(0, 5) }, i)) }] })

const search = (await gql(SEARCH_QUERY, { q: 'piranesi' })).data
save('search', SEARCH_QUERY, { q: 'piranesi' }, search)

// The lookups the outbox makes before it writes.
const reading = all.find(b => b.status_id === 2) ?? all[0]
const lengthQuery = 'query($id: Int!) { me { user_books(where: {id: {_eq: $id}}) { edition { pages audio_seconds } book { pages audio_seconds } user_book_reads(order_by: {id: desc}, limit: 1) { id finished_at } } } }'
const length = (await gql(lengthQuery, { id: reading.id })).data
save('read-length', lengthQuery, { id: fake('user_book', reading.id) }, {
  me: [{ user_books: length.me[0].user_books.map(ub => ({ ...ub, user_book_reads: ub.user_book_reads.map(r => ({ ...r, id: fake('read', r.id) })) })) }],
})
const byBookQuery = 'query($b: Int!) { me { user_books(where: {book_id: {_eq: $b}}, limit: 1) { id } } }'
const byBook = (await gql(byBookQuery, { b: reading.book.id })).data
save('user-book-by-book', byBookQuery, { b: reading.book.id }, { me: [{ user_books: byBook.me[0].user_books.map(ub => ({ id: fake('user_book', ub.id) })) }] })
