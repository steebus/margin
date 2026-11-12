import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Hardcover has no webhooks, so this is how its changes reach Margin. It also retries anything stuck in the outbox.
crons.interval('sync hardcover', { minutes: 2 }, internal.hardcover.syncAll, {})
// Date changes on Hardcover's read records can't be spotted that way, so the whole library is compared once a day, at
// 3:30am in Brisbane. Hourly was most of Margin's database reads (Steve, 2026-11-12): dates edited there are rare.
crons.daily('reconcile hardcover', { hourUTC: 17, minuteUTC: 30 }, internal.hardcover.reconcile, {})

// Nudges go out once a day at 6pm in Brisbane (UTC+10, no daylight saving), so never in quiet hours (SPEC 3.3).
// ponytail: one reader, one fixed time; store each device's time zone if anyone else ever uses Margin.
crons.daily('nudges', { hourUTC: 8, minuteUTC: 0 }, internal.pushNode.daily, {})

// Kobo's notes, 5am in Brisbane. Read-only, about a second per linked book.
crons.daily('pull kobo', { hourUTC: 19, minuteUTC: 0 }, internal.kobo.pullAll, {})

export default crons
