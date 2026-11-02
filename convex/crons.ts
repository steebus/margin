import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Hardcover has no webhooks, so this is how its changes reach Margin. It also retries anything stuck in the outbox.
crons.interval('sync hardcover', { minutes: 2 }, internal.hardcover.syncAll, {})

export default crons
