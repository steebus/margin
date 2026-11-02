// Writes made with no connection wait here, on the device, and go when it returns (SPEC 4). Only entries and
// progress: everything else needs a connection. Replaying is safe, because entries dedupe on their key and progress
// is simply set again.
export type Queued = { id: string; name: 'addEntry' | 'logProgress'; args: Record<string, unknown> }

export type Store = {
  all: () => Promise<Queued[]>
  put: (item: Queued) => Promise<void>
  remove: (id: string) => Promise<void>
}

const open = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open('margin', 1)
  request.onupgradeneeded = () => request.result.createObjectStore('outbox', { keyPath: 'id' })
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

const run = async <T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>) => {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const request = work(db.transaction('outbox', mode).objectStore('outbox'))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  }).finally(() => db.close())
}

export const deviceStore: Store = {
  all: () => run('readonly', s => s.getAll() as IDBRequest<Queued[]>),
  put: async item => { await run('readwrite', s => s.put(item)) },
  remove: async id => { await run('readwrite', s => s.delete(id)) },
}

/** A refusal from the server is final: sending it again would only be refused again. A lost connection isn't. */
const refused = (e: unknown) => (e as { data?: unknown })?.data !== undefined

/** Sends what's waiting, oldest first. Stops at the first lost connection, so the order holds. Returns what was refused. */
export async function replay(send: (item: Queued) => Promise<unknown>, store: Store = deviceStore) {
  const items = (await store.all()).sort((a, b) => a.id.localeCompare(b.id))
  const rejected: Queued[] = []
  for (const item of items) {
    try {
      await send(item)
    } catch (e) {
      if (!refused(e)) break
      rejected.push(item)
    }
    await store.remove(item.id)
  }
  return rejected
}

const WAIT_MS = 8000

/**
 * Sends a write, or keeps it for later. "Online" can't be trusted on a bad connection, so a write that hasn't
 * landed in a few seconds is kept too. If that one lands after all, the replay is harmless.
 */
export async function sendOrKeep<T>(
  name: Queued['name'],
  args: Record<string, unknown>,
  send: () => Promise<T>,
  { store = deviceStore, online = () => navigator.onLine, waitMs = WAIT_MS }: { store?: Store; online?: () => boolean; waitMs?: number } = {},
): Promise<{ kept: true } | { kept: false; result: T }> {
  const keep = async () => {
    await store.put({ id: `${Date.now().toString().padStart(15, '0')}-${Math.random().toString(36).slice(2)}`, name, args })
    return { kept: true as const }
  }
  if (!online()) return keep()
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<'late'>(resolve => { timer = setTimeout(() => resolve('late'), waitMs) })
  try {
    const answer = await Promise.race([send(), late])
    return answer === 'late' ? keep() : { kept: false, result: answer as T }
  } catch (e) {
    if (refused(e)) throw e
    return keep()
  } finally {
    clearTimeout(timer)
  }
}
