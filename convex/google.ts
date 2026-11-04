import { getAuthUserId } from '@convex-dev/auth/server'
import { query } from './_generated/server'

/** What the page needs to ask Google for Books and Drive access: both are public by nature in a browser. */
export const clientConfig = query({
  args: {},
  handler: async ctx => {
    if (!await getAuthUserId(ctx)) return null
    return { clientId: process.env.AUTH_GOOGLE_ID ?? null, apiKey: process.env.GOOGLE_API_KEY ?? null }
  },
})
