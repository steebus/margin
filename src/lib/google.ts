// Google, in the page only: sign-in for a short-lived token, the Drive Picker, and the two APIs Play Books needs. The
// token never leaves the browser and is gone when the page closes (docs/superpowers/specs/2026-11-04-play-books-design.md).

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const google: any
declare const gapi: any

const scripts = new Map<string, Promise<void>>()
/** Loads a script once. Call it early: Google's popup only opens straight from a tap, not after waiting on a load. */
export const loadScript = (src: string) => {
  if (!scripts.has(src)) {
    scripts.set(src, new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = src
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => { scripts.delete(src); reject(new Error(`Couldn't load ${src}`)) }
      document.head.append(s)
    }))
  }
  return scripts.get(src)!
}

export const GSI = 'https://accounts.google.com/gsi/client'
export const GAPI = 'https://apis.google.com/js/api.js'
export const PLAY_BOOKS_SCOPES = 'https://www.googleapis.com/auth/books https://www.googleapis.com/auth/drive.file'

/** Asks Google for a token. Must be called from a tap, with GSI already loaded. */
export function googleToken(clientId: string, scope: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope,
      callback: (r: { access_token?: string; error?: string }) => (r.access_token ? resolve(r.access_token) : reject(new Error(r.error ?? 'refused'))),
      error_callback: (e: { type?: string }) => reject(new Error(e.type ?? 'closed')),
    })
    client.requestAccessToken()
  })
}

/** The Drive Picker on the reader's "Notes from" docs, several at once. Resolves to the chosen docs' ids, or none. */
export async function pickNotesDocs(token: string, apiKey: string, clientId: string): Promise<string[]> {
  await loadScript(GAPI)
  await new Promise<void>(resolve => gapi.load('picker', () => resolve()))
  return new Promise(resolve => {
    const view = new google.picker.DocsView(google.picker.ViewId.DOCUMENTS).setQuery('Notes from').setMode(google.picker.DocsViewMode.LIST)
    new google.picker.PickerBuilder()
      .addView(view)
      .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
      .setOAuthToken(token)
      .setDeveloperKey(apiKey)
      // drive.file only covers the picked files if the Picker names the app: its project number, the client id's prefix.
      .setAppId(clientId.split('-')[0])
      .setTitle('Choose your "Notes from" docs')
      .setCallback((d: { action: string; docs?: { id: string }[] }) => {
        if (d.action === google.picker.Action.PICKED) resolve((d.docs ?? []).map(x => x.id))
        else if (d.action === google.picker.Action.CANCEL) resolve([])
      })
      .build()
      .setVisible(true)
  })
}

const get = async (url: string, token: string) => {
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const said = await res.json().then(j => j?.error?.message as string | undefined, () => undefined)
    throw new Error(`Google refused (${res.status})${said ? `: ${said.split('. ')[0]}.` : '.'}`)
  }
  return res
}

export type PlayVolume = { volumeId: string; title: string; author: string; isbn?: string; shelves: number[] }

/** Every book on the reader's Play Books shelves, each once, with the shelves it's on. */
export async function playLibrary(token: string): Promise<PlayVolume[]> {
  const base = 'https://www.googleapis.com/books/v1/mylibrary/bookshelves'
  const shelves: { id: number; volumeCount?: number }[] = (await (await get(base, token)).json()).items ?? []
  const byId = new Map<string, PlayVolume>()
  for (const shelf of shelves.filter(s => s.volumeCount)) {
    for (let start = 0; start < (shelf.volumeCount ?? 0); start += 40) {
      const page = await (await get(`${base}/${shelf.id}/volumes?maxResults=40&startIndex=${start}`, token)).json()
      for (const v of page.items ?? []) {
        const known = byId.get(v.id)
        if (known) { known.shelves.push(shelf.id); continue }
        const ids: { type: string; identifier: string }[] = v.volumeInfo?.industryIdentifiers ?? []
        byId.set(v.id, {
          volumeId: v.id,
          title: v.volumeInfo?.title ?? '',
          author: (v.volumeInfo?.authors ?? []).join(', '),
          isbn: ids.find(i => i.type === 'ISBN_13')?.identifier ?? ids.find(i => i.type === 'ISBN_10')?.identifier,
          shelves: [shelf.id],
        })
      }
      if (!page.items?.length) break
    }
  }
  return [...byId.values()]
}

/** A Google Doc as HTML. */
export const exportDoc = async (id: string, token: string) =>
  (await get(`https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=text/html`, token)).text()
