// The spoiler eval (PLAN Phase 2.2): shows what the buddy would be given at each test position, for a reader who
// has finished the book to check. Reads production with `convex run`; writes docs/eval/<slug>.md.
// Usage: node --experimental-strip-types scripts/guide-eval.mjs <readId>
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { guideCost, guideText, guideUpTo } from '../convex/lib/guide.ts'

const POSITIONS = [10, 25, 50, 75, 90]
const readId = process.argv[2]
if (!readId) throw new Error('Usage: guide-eval.mjs <readId>')

// JSON5 with single quotes, because the Windows shell strips double ones.
const out = execFileSync('npx', ['convex', 'run', 'guides:show', `{readId:'${readId}'}`], { encoding: 'utf8', shell: true })
const row = JSON.parse(out)
if (!row || row.state !== 'ready') throw new Error(`No ready guide: ${row ? row.state + ' ' + (row.error ?? '') : 'none'}`)
const { guide } = row
const slug = row.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const lines = [
  `# Spoiler eval: ${row.title}, ${row.author}`,
  '',
  `Knownness: ${guide.knownness}. ${guide.structure.length} structure marks, ${guide.themes.length} themes, ${guide.moments.length} moments, ${guide.questions.length} questions, ${guide.sources.length} sources. Cost $${guideCost({ ...row.usage }).toFixed(2)}.`,
  '',
  'For each position, the text below is everything the buddy is given about the book. Check two things:',
  '1. **Spoilers:** nothing a reader at that point hasn\'t read yet, stated or hinted.',
  '2. **Positions:** each moment sits roughly where it happens in the book.',
  '',
  ...POSITIONS.flatMap(at => [`## At ${at}%`, '', '```text', guideText(guideUpTo(guide, { finished: false, percent: at }), false), '```', '']),
  '## The full guide', '', '```json', JSON.stringify(guide, null, 2), '```', '',
]
writeFileSync(`docs/eval/${slug}.md`, lines.join('\n'))
console.log(`Wrote docs/eval/${slug}.md`)
