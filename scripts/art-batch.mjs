// Generates cover art in bulk at the batch price. Run from the repo root, with node --experimental-strip-types:
//   subjects [--limit N]   choose what to draw for every book without art (cheap, resumes)
//   submit [--limit N]     send one batch job for books that have a subject and no image yet
//   status                 check the job
//   fetch                  download finished images
//   ingest                 frame them and upload them to Convex
// Working files live in .impeccable/art-run, which is gitignored. Never prints the key.
import { execFileSync } from 'node:child_process'
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { createInterface } from 'node:readline'
import sharp from 'sharp'
import { frameArt } from '../convex/lib/artFrame.ts'
import { IMAGE_MODEL, imagePrompt, parseSubject, subjectPrompt, TEXT_MODEL } from '../convex/lib/artPrompt.ts'

const RUN = '.impeccable/art-run'
const RAW = `${RUN}/raw`
mkdirSync(RAW, { recursive: true })
const API = 'https://generativelanguage.googleapis.com'
const env = Object.fromEntries(readFileSync('.env', 'utf8').split(/\r?\n/).map(l => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)).filter(Boolean).map(([, k, v]) => [k, v.replace(/^['"]|['"]$/g, '')]))
const key = env.GEMINI_API_KEY
if (!key) throw new Error('GEMINI_API_KEY is not in .env')

const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined }
const limit = Number(arg('--limit') ?? Infinity)
const load = (name, fallback) => (existsSync(`${RUN}/${name}`) ? JSON.parse(readFileSync(`${RUN}/${name}`, 'utf8')) : fallback)
const save = (name, value) => writeFileSync(`${RUN}/${name}`, JSON.stringify(value, null, 1))
const convex = (fn, args = {}) => JSON.parse(execFileSync(process.execPath, ['node_modules/convex/bin/main.js', 'run', fn, JSON.stringify(args)], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }))
const headers = { 'x-goog-api-key': key }

async function subjects() {
  const books = convex('art:needingArt')
  const chosen = load('subjects.json', {})
  const todo = books.filter(b => !chosen[b.workId]).slice(0, limit)
  console.log(`${books.length} need art; choosing ${todo.length}`)
  let done = 0
  let failed = 0
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (todo.length) {
      const book = todo.shift()
      const avoid = Object.values(chosen).slice(-30).map(c => c.scene)
      try {
        const res = await fetch(`${API}/v1beta/models/${TEXT_MODEL}:generateContent`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: subjectPrompt(book, { avoid }) }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.9 } }),
        })
        if (res.status === 429) { todo.push(book); await new Promise(r => setTimeout(r, 15000)); continue }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        chosen[book.workId] = { title: book.title, scene: parseSubject(json.candidates?.[0]?.content?.parts?.[0]?.text ?? '') }
        if (++done % 25 === 0) { save('subjects.json', chosen); console.log(`${done} chosen`) }
      } catch (e) {
        failed++
        console.log(`FAIL ${book.title}: ${String(e.message).slice(0, 120)}`)
      }
    }
  }))
  save('subjects.json', chosen)
  console.log(`done: ${done} chosen, ${failed} failed, ${Object.keys(chosen).length} in total`)
}

async function uploadFile(path, mime, name) {
  const size = statSync(path).size
  const start = await fetch(`${API}/upload/v1beta/files`, {
    method: 'POST',
    headers: { ...headers, 'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start', 'X-Goog-Upload-Header-Content-Length': String(size), 'X-Goog-Upload-Header-Content-Type': mime, 'Content-Type': 'application/json' },
    body: JSON.stringify({ file: { display_name: name } }),
  })
  const url = start.headers.get('x-goog-upload-url')
  if (!url) throw new Error(`Upload would not start: ${start.status} ${(await start.text()).slice(0, 200)}`)
  const done = await fetch(url, { method: 'POST', headers: { 'Content-Length': String(size), 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' }, body: readFileSync(path) })
  const json = await done.json()
  if (!json.file) throw new Error(`Upload failed: ${JSON.stringify(json).slice(0, 200)}`)
  return json.file
}

async function submit() {
  const chosen = load('subjects.json', {})
  const jobs = load('jobs.json', [])
  const sent = new Set(jobs.flatMap(j => j.workIds))
  const have = new Set(readdirSync(RAW).map(f => f.replace(/\.jpg$|\.png$/, '')))
  const ids = Object.keys(chosen).filter(id => !sent.has(id) && !have.has(id)).slice(0, limit)
  if (!ids.length) return console.log('Nothing to send')
  const reference = readFileSync('public/art/style-reference.png').toString('base64')
  const file = `${RUN}/job-${Date.now()}.jsonl`
  writeFileSync(file, ids.map(id => JSON.stringify({
    key: id,
    request: {
      contents: [{ parts: [{ text: imagePrompt(chosen[id].scene) }, { inline_data: { mime_type: 'image/png', data: reference } }] }],
      generation_config: { responseModalities: ['IMAGE'], image_config: { aspect_ratio: '1:1', image_size: '1K' } },
    },
  })).join('\n') + '\n')
  console.log(`Uploading ${ids.length} requests, ${(statSync(file).size / 1048576).toFixed(0)} MB`)
  const uploaded = await uploadFile(file, 'application/jsonl', 'margin-art')
  const res = await fetch(`${API}/v1beta/models/${IMAGE_MODEL}:batchGenerateContent`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ batch: { display_name: `margin-art-${ids.length}`, input_config: { file_name: uploaded.name } } }),
  })
  const json = await res.json()
  if (!res.ok || !json.name) throw new Error(`The job was refused: ${JSON.stringify(json).slice(0, 400)}`)
  jobs.push({ name: json.name, count: ids.length, workIds: ids, at: new Date().toISOString() })
  save('jobs.json', jobs)
  console.log(`Submitted ${json.name} for ${ids.length} books, about $${(ids.length * 0.0168).toFixed(2)}`)
}

const describe = job => ({
  state: job.state ?? job.metadata?.state,
  stats: job.batchStats ?? job.metadata?.batchStats,
  file: job.dest?.fileName ?? job.response?.responsesFile ?? job.metadata?.output?.responsesFile,
  error: job.error?.message,
})

async function status() {
  for (const job of load('jobs.json', [])) {
    const res = await fetch(`${API}/v1beta/${job.name}`, { headers })
    const d = describe(await res.json())
    console.log(job.name, job.count, d.state, JSON.stringify(d.stats ?? {}), d.file ?? '', d.error ?? '')
  }
}

async function fetchResults() {
  const chosen = load('subjects.json', {})
  for (const job of load('jobs.json', [])) {
    if (job.fetched) continue
    const d = describe(await (await fetch(`${API}/v1beta/${job.name}`, { headers })).json())
    if (!d.state?.endsWith('_SUCCEEDED') || !d.file) { console.log(`${job.name}: ${d.state}, not ready`); continue }
    const local = `${RUN}/${job.name.replace(/\W/g, '_')}.jsonl`
    const res = await fetch(`${API}/download/v1beta/${d.file}:download?alt=media`, { headers })
    if (!res.ok) throw new Error(`Download failed: ${res.status}`)
    await pipeline(Readable.fromWeb(res.body), createWriteStream(local))
    let good = 0
    const failures = []
    for await (const line of createInterface({ input: createReadStream(local), crlfDelay: Infinity })) {
      if (!line.trim()) continue
      const row = JSON.parse(line)
      const parts = row.response?.candidates?.[0]?.content?.parts ?? []
      const image = parts.find(p => p.inlineData?.data || p.inline_data?.data)
      const data = image?.inlineData?.data ?? image?.inline_data?.data
      if (!data) {
        failures.push({ workId: row.key, title: chosen[row.key]?.title, why: row.error?.message ?? row.response?.candidates?.[0]?.finishReason ?? 'no image' })
        continue
      }
      writeFileSync(`${RAW}/${row.key}.jpg`, Buffer.from(data, 'base64'))
      good++
    }
    console.log(`${job.name}: ${good} images, ${failures.length} failed`)
    if (failures.length) save(`failures-${job.name.replace(/\W/g, '_')}.json`, failures)
    job.fetched = true
    save('jobs.json', load('jobs.json', []).map(j => (j.name === job.name ? job : j)))
  }
}

async function ingest() {
  const chosen = load('subjects.json', {})
  const done = new Set(load('ingested.json', []))
  const files = readdirSync(RAW).map(f => f.replace(/\.jpg$/, '')).filter(id => !done.has(id)).slice(0, limit)
  console.log(`Ingesting ${files.length}`)
  const blank = []
  // Small groups: the items go on a command line, and Windows caps that at 32 KB.
  for (let i = 0; i < files.length; i += 10) {
    const group = files.slice(i, i + 10)
    const urls = convex('art:uploadUrls', { count: group.length * 2 })
    const items = []
    let u = 0
    for (const id of group) {
      try {
        const { small, large } = await frameArt(sharp, readFileSync(`${RAW}/${id}.jpg`))
        const put = async (body, url) => {
          const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'image/webp' }, body })
          if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
          return (await res.json()).storageId
        }
        const scene = chosen[id].scene
        items.push({ workId: id, small: await put(small, urls[u++]), large: await put(large, urls[u++]), model: IMAGE_MODEL, scene, prompt: imagePrompt(scene) })
      } catch (e) {
        blank.push({ id, title: chosen[id]?.title, why: e.message })
        console.log(`SKIP ${chosen[id]?.title}: ${e.message}`)
      }
    }
    if (items.length) convex('art:saveMany', { items })
    for (const item of items) done.add(item.workId)
    save('ingested.json', [...done])
    console.log(`${Math.min(i + group.length, files.length)} of ${files.length}`)
  }
  if (blank.length) save('skipped.json', blank)
  console.log(`Done: ${done.size} stored, ${blank.length} skipped`)
}

const steps = { subjects, submit, status, fetch: fetchResults, ingest }
const step = steps[process.argv[2]]
if (!step) throw new Error(`Say one of: ${Object.keys(steps).join(', ')}`)
await step()
