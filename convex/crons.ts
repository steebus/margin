import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Hardcover has no webhooks, so this is how its changes reach Margin. It also retries anything stuck in the outbox.
crons.interval('sync hardcover', { minutes: 2 }, internal.hardcover.syncAll, {})
// Date changes on Hardcover's read records can't be spotted that way, so the whole library is compared hourly.
crons.interval('reconcile hardcover', { hours: 1 }, internal.hardcover.reconcile, {})

export default crons
