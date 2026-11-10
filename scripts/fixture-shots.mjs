// Looks at every screen of fixture mode (docs/IMPROVEMENT-LOOP.md E1/E2) and saves what it sees.
//   npm run fixtures                      (in one terminal: Margin on the made-up library, port 5173)
//   node scripts/fixture-shots.mjs       (in another)
// Options: --base http://localhost:5173  --out fixture-shots  --only desk,book  --fixture empty|slow  --scale 2
// For each screen, at phone and desktop widths, in both themes: a full-page PNG, anything wider than the screen
// (measured by rects, since .app clips and scrollWidth can't say), and any error the page raised. Exits 1 if a
// page raised an error. Needs Playwright, which isn't a dependency of Margin: cloud sessions have it installed.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : fallback
}
const base = arg('base', 'http://localhost:5173')
const out = arg('out', 'fixture-shots')
const only = arg('only', '').split(',').filter(Boolean)
const fixture = arg('fixture', 'library')
const scale = Number(arg('scale', '1'))

// Wherever Playwright is: a global install is found by require, not by import.
let chromium
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'))
} catch {
  console.error('Playwright is not installed here. Open the screens by hand at', base)
  process.exit(2)
}

// Real addresses from the made-up library, so every kind of page is visited.
const data = JSON.parse(readFileSync(new URL('../src/fixtures/data.json', import.meta.url), 'utf8')).library
const books = data['library:myBooks'][0].value
const entries = data['library:allEntries'][0].value
const topics = data['topics:list'][0].value
const reading = books.find(b => b.status === 'reading')
const finished = books.find(b => b.status === 'read' && b.rating)
const longest = [...books].sort((a, b) => b.title.length - a.title.length)[0]
const authorSlug = name => name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const screens = fixture === 'library' ? {
  desk: '/',
  shelves: '/shelves',
  'shelves-table': '/shelves?view=table',
  'shelf-tbr': '/shelves/tbr',
  'shelf-read': '/shelves/read',
  pile: '/pile',
  notes: '/notes',
  drawer: '/drawer',
  explore: '/explore',
  topics: '/topics',
  topic: `/topics/${topics[0].slug}`,
  book: `/books/${reading.slug}`,
  'book-long-title': `/books/${longest.slug}`,
  'book-finished': `/books/${finished.slug}`,
  'book-entries': `/books/${reading.slug}/entries`,
  'book-buddy': `/books/${reading.slug}/buddy`,
  'book-edit': `/books/${reading.slug}/edit`,
  'book-review': `/books/${finished.slug}/review`,
  'book-read': `/books/${finished.slug}/reads/1`,
  entry: `/books/${entries[0].slug}/entries/${encodeURIComponent(entries[0].id)}`,
  author: `/authors/${authorSlug(reading.author)}`,
  person: '/people/marguerite',
  stats: '/stats',
  capture: '/capture',
  'capture-add': '/capture/add',
  review: '/review',
  settings: '/settings',
  'settings-integrations': '/settings?tab=integrations',
  'not-found': '/no-such-page',
} : { desk: '/', shelves: '/shelves', notes: '/notes', explore: '/explore', pile: '/pile', stats: '/stats', drawer: '/drawer', capture: '/capture' }

const sizes = { phone: { width: 412, height: 915 }, desktop: { width: 1280, height: 800 } }
const themes = ['light', 'dark']

mkdirSync(out, { recursive: true })
const browser = await chromium.launch()
const report = []

for (const [size, viewport] of Object.entries(sizes)) {
  for (const theme of themes) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: scale, hasTouch: size === 'phone', isMobile: size === 'phone' })
    await context.addInitScript(([theme, fixture]) => {
      localStorage.setItem('margin.theme', theme)
      sessionStorage.setItem('margin.fixture', fixture)
      // The weekly drawer toast would cover the Desk in every shot. `--only desk` with a fresh profile still shows it.
      localStorage.setItem('margin.drawerToastAt', String(Date.now()))
    }, [theme, fixture])
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', e => errors.push(String(e.message).slice(0, 300)))
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)) })

    for (const [name, path] of Object.entries(screens)) {
      if (only.length && !only.includes(name)) continue
      errors.length = 0
      await page.goto(base + path, { waitUntil: 'load' })
      await page.waitForTimeout(fixture === 'slow' ? 800 : 1200)
      // Offscreen cells only load as frames are drawn, so the page is really scrolled, then brought back.
      const tall = await page.evaluate(() => document.documentElement.scrollHeight)
      for (let y = 0; y < Math.min(tall, 12000); y += viewport.height) {
        await page.mouse.wheel(0, viewport.height)
        await page.waitForTimeout(120)
      }
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.waitForTimeout(250)

      const wide = await page.evaluate(() => {
        const limit = document.documentElement.clientWidth
        const scrolls = el => {
          for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
            const o = getComputedStyle(p).overflowX
            if (o === 'auto' || o === 'scroll' || o === 'hidden') return true
          }
          return false
        }
        const found = []
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect()
          if (!r.width || !r.height || (r.right <= limit + 1 && r.left >= -1)) continue
          if (getComputedStyle(el).position === 'fixed' || scrolls(el)) continue
          found.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''} [${Math.round(r.left)}..${Math.round(r.right)} of ${limit}] "${(el.textContent ?? '').trim().slice(0, 40)}"`)
        }
        // The outermost offenders say it all: their children are wide for the same reason.
        return found.slice(0, 6)
      })
      const file = `${name}.${size}.${theme}.png`
      await page.screenshot({ path: `${out}/${file}`, fullPage: true })
      report.push({ screen: name, path, size, theme, file, tall, wide, errors: [...new Set(errors)] })
    }
    await context.close()
  }
}
await browser.close()

writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2))
const bad = report.filter(r => r.wide.length || r.errors.length)
console.log(`${report.length} shots in ${out}/. ${bad.length ? `${bad.length} need a look:` : 'Nothing wider than its screen, and no errors.'}`)
for (const r of bad) {
  console.log(`\n${r.screen} (${r.size}, ${r.theme}) ${r.path}`)
  for (const w of r.wide) console.log('  wide:  ', w)
  for (const e of r.errors) console.log('  error: ', e)
}
process.exit(report.some(r => r.errors.length) ? 1 : 0)
