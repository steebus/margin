import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { searchHardcover } from './hardcover'

beforeEach(() => { vi.stubEnv('HARDCOVER_API_KEY', 'test-key') })
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

for (const status of [401, 403]) {
  test(`a ${status} from Hardcover says the token was refused and what to do`, async () => {
    const fetchMock = vi.fn(async () => new Response('', { status }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(searchHardcover('piranesi')).rejects.toMatchObject({ data: expect.stringContaining('token has been refused') })
    await expect(searchHardcover('piranesi')).rejects.toMatchObject({ data: expect.stringContaining('HARDCOVER_API_KEY') })
    expect(fetchMock).toHaveBeenCalledTimes(2) // once per call: a refused token is not retried inside gql
  })
}

test('other failures keep the plain status message', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })))
  await expect(searchHardcover('x')).rejects.toMatchObject({ data: 'Hardcover answered 404.' })
})
