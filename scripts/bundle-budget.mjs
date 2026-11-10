// Fails if the main chunk in dist/ has grown more than the budget allows. Run after `npm run build`:
//   node --experimental-strip-types scripts/bundle-budget.mjs
// The budget is bundle-budget.json; raise it on purpose, in the commit that grows the bundle.
import { readFileSync, readdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { checkBudget } from '../src/lib/bundleBudget.ts'

const dir = 'dist/assets'
const files = readdirSync(dir).filter((f) => /^index-.*\.js$/.test(f))
if (files.length !== 1) {
  console.error(`Expected one dist/assets/index-*.js, found ${files.length}. Run npm run build first.`)
  process.exit(2)
}
const code = readFileSync(`${dir}/${files[0]}`)
const budget = JSON.parse(readFileSync('bundle-budget.json', 'utf8'))
const { ok, lines } = checkBudget(budget, { bytes: code.length, gzipBytes: gzipSync(code, { level: 9 }).length })
console.log(lines.join('\n'))
process.exit(ok ? 0 : 1)
