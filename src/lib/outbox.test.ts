import { expect, test } from 'vitest'
import { replay, sendOrKeep, type Queued, type Store } from './outbox'

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

test('a lost connection keeps it, but a refusal is the reader\'s to hear about', async () => {
  const store = memory()
  expect(await sendOrKeep('addEntry', {}, async () => { throw new Error('network') }, { store, online: () => true })).toEqual({ kept: true })
  await expect(sendOrKeep('addEntry', {}, async () => { throw refusal }, { store, online: () => true })).rejects.toBe(refusal)
  expect(store.items).toHaveLength(1)
})
