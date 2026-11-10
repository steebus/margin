import { expect, test } from 'vitest'
import { clearOutbox, keepThenSend, replay, sendOrKeep, type Queued, type Store } from './outbox'

const memory = (items: Queued[] = []): Store & { items: Queued[] } => ({
  items,
  async all() { return [...this.items] },
  async put(item) { this.items.push(item) },
  async remove(id) { this.items = this.items.filter(i => i.id !== id) },
})
const item = (id: string): Queued => ({ id, name: 'addEntry', args: { text: id } })
const refusal = Object.assign(new Error('no'), { data: 'That book is not on your shelves' })

test('what waited goes oldest first, and leaves once sent', async () => {
  const store = memory([item('2'), item('1')])
  const sent: string[] = []
  expect(await replay(async q => { sent.push(q.id) }, store)).toEqual([])
  expect(sent).toEqual(['1', '2'])
  expect(store.items).toEqual([])
})

test('a lost connection stops the replay and keeps the rest, in order', async () => {
  const store = memory([item('1'), item('2'), item('3')])
  await replay(async q => { if (q.id === '2') throw new Error('offline') }, store)
  expect(store.items.map(i => i.id)).toEqual(['2', '3'])
})

test('a refusal is reported and not tried for ever', async () => {
  const store = memory([item('1'), item('2')])
  const rejected = await replay(async q => { if (q.id === '1') throw refusal }, store)
  expect(rejected.map(i => i.id)).toEqual(['1'])
  expect(store.items).toEqual([])
})

const never = () => new Promise<string>(() => {})

test('online, a write just goes', async () => {
  const store = memory()
  expect(await sendOrKeep('addEntry', {}, async () => 'ok', { store, online: () => true })).toEqual({ kept: false, result: 'ok' })
  expect(store.items).toEqual([])
})

test('offline, it is kept without trying', async () => {
  const store = memory()
  expect(await sendOrKeep('addEntry', { text: 'a' }, never, { store, online: () => false })).toEqual({ kept: true })
  expect(store.items[0]).toMatchObject({ name: 'addEntry', args: { text: 'a' } })
})

test('a connection that claims to work but never answers still keeps the words', async () => {
  const store = memory()
  expect(await sendOrKeep('addEntry', {}, never, { store, online: () => true, waitMs: 5 })).toEqual({ kept: true })
  expect(store.items).toHaveLength(1)
})

test('a slow write that lands after being kept leaves no copy behind', async () => {
  const store = memory()
  let land!: () => void
  const slow = new Promise<void>(r => { land = r })
  expect(await sendOrKeep('logProgress', {}, () => slow, { store, online: () => true, waitMs: 5 })).toEqual({ kept: true })
  expect(store.items).toHaveLength(1)
  land()
  await new Promise(r => setTimeout(r, 0))
  expect(store.items).toEqual([])
})

test('a replay while the slow original is still out does not send it a second time', async () => {
  const store = memory()
  let land!: () => void
  const slow = new Promise<void>(r => { land = r })
  await sendOrKeep('logProgress', {}, () => slow, { store, online: () => true, waitMs: 5 })
  const sent: string[] = []
  await replay(async q => { sent.push(q.id) }, store)
  expect(sent).toEqual([])
  land()
  await new Promise(r => setTimeout(r, 0))
  expect(store.items).toEqual([])
})

test('a slow write that then fails stays kept for the replay', async () => {
  const store = memory()
  let fail!: () => void
  const slow = new Promise<void>((_, rej) => { fail = () => rej(new Error('network')) })
  await sendOrKeep('logProgress', {}, () => slow, { store, online: () => true, waitMs: 5 })
  fail()
  await new Promise(r => setTimeout(r, 0))
  expect(store.items).toHaveLength(1)
  const sent: string[] = []
  await replay(async q => { sent.push(q.id) }, store)
  expect(sent).toHaveLength(1)
})

test('a lost connection keeps it, but a refusal is the reader\'s to hear about', async () => {
  const store = memory()
  expect(await sendOrKeep('addEntry', {}, async () => { throw new Error('network') }, { store, online: () => true })).toEqual({ kept: true })
  await expect(sendOrKeep('addEntry', {}, async () => { throw refusal }, { store, online: () => true })).rejects.toBe(refusal)
  expect(store.items).toHaveLength(1)
})

test('a write that is not waited for is kept until it lands, and dropped when refused', async () => {
  const store = memory()
  let land!: () => void
  const sending = keepThenSend('addEntry', { text: 'a' }, () => new Promise<void>(r => { land = r }), store)
  await new Promise(r => setTimeout(r, 0))
  expect(store.items).toHaveLength(1)
  land()
  await sending
  expect(store.items).toEqual([])
  await expect(keepThenSend('addEntry', {}, async () => { throw refusal }, store)).rejects.toBe(refusal)
  expect(store.items).toEqual([])
  await keepThenSend('addEntry', {}, async () => { throw new Error('network') }, store)
  expect(store.items).toHaveLength(1)
})

test('a refused replay tells the caller why, with the item', async () => {
  const store = memory([{ id: '1', name: 'addEntry', args: { text: 'kept words' } }])
  const refusal = Object.assign(new Error('Server Error'), { data: 'That book is gone.' })
  const heard: [string, unknown][] = []
  await replay(async () => { throw refusal }, store, (item, e) => heard.push([item.id, (e as { data: unknown }).data]))
  expect(heard).toEqual([['1', 'That book is gone.']])
})

test('a write still being sent is not sent a second time by a replay', async () => {
  const store = memory()
  let release: () => void = () => {}
  const sent: string[] = []
  const first = keepThenSend('logProgress', { pages: 10 }, () => new Promise<void>(resolve => { release = resolve }), store)
  await new Promise(r => setTimeout(r, 0))
  expect(store.items).toHaveLength(1)
  await replay(async q => { sent.push(q.id) }, store)
  expect(sent).toEqual([])
  release()
  await first
  expect(store.items).toEqual([])
})

test('two replays at once send each waiting write once', async () => {
  const store = memory([item('1'), item('2')])
  const sent: string[] = []
  const send = async (q: Queued) => { await new Promise(r => setTimeout(r, 1)); sent.push(q.id) }
  await Promise.all([replay(send, store), replay(send, store)])
  expect(sent).toEqual(['1', '2'])
})

test('forgetting the device empties the outbox', async () => {
  const store = memory([item('1'), item('2')])
  await clearOutbox(store)
  expect(store.items).toEqual([])
})
