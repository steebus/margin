'use node'

import webpush from 'web-push'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'

/** Once a day: anyone due a nudge gets one, on each device that said yes. */
export const daily = internalAction({
  args: {},
  handler: async ctx => {
    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, SITE_URL } = process.env
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !SITE_URL) return console.error('Nudges need VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and SITE_URL')
    webpush.setVapidDetails(SITE_URL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
    const now = Date.now()
    for (const { nudge, subs } of await ctx.runQuery(internal.push.due, { now })) {
      const delivered = []
      for (const sub of subs) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(nudge), { TTL: 12 * 60 * 60 })
          delivered.push(sub.id)
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) await ctx.runMutation(internal.push.gone, { id: sub.id })
          else console.error('A nudge failed:', status ?? (e instanceof Error ? e.message : e))
        }
      }
      if (delivered.length) await ctx.runMutation(internal.push.sent, { ids: delivered, at: now })
    }
  },
})
