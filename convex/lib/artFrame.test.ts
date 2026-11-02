import sharp from 'sharp'
import { expect, test } from 'vitest'
import { frameArt, frameGeometry, inkBox } from './artFrame'
import { imagePrompt, parseSubject, subjectPrompt } from './artPrompt'

const svg = (body: string) => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="#fff"/>${body}</svg>`)).jpeg().toBuffer()
/** How much ink each band of a finished image has. */
const inkIn = async (file: Buffer, band: { top: number; left: number; width: number; height: number }) => {
  const { data } = await sharp(file).extract(band).greyscale().raw().toBuffer({ resolveWithObject: true })
  return data.filter(v => v < 128).length
}

test('inkBox finds dense ink and reports a blank page', () => {
  const width = 10
  const pixels = new Uint8Array(100).fill(255)
  pixels[3 * width + 4] = 0
  pixels[6 * width + 7] = 0
  expect(inkBox(pixels, width, { x: 0, y: 0, w: 10, h: 10 })).toEqual({ x: 4, y: 3, w: 4, h: 4 })
  expect(inkBox(new Uint8Array(100).fill(255), width, { x: 0, y: 0, w: 10, h: 10 })).toBeNull()
})

test('a subject wide at the top keeps it whole; one wide at the bottom bleeds off the sides', () => {
  const tree = frameGeometry({ x: 0, y: 0, w: 800, h: 800 }, { x: 0, y: 0, w: 800, h: 400 }, 512)
  expect((800 * tree.width) / 800).toBeLessThanOrEqual(512)
  const waves = frameGeometry({ x: 0, y: 0, w: 800, h: 500 }, { x: 300, y: 0, w: 200, h: 250 }, 512)
  expect(waves.width).toBe(Math.round(512 * 1.22))
  expect(waves.cropWidth).toBe(512)
})

test('the page is always 2:3 and the bottom is always cut', () => {
  for (const box of [{ x: 0, y: 0, w: 100, h: 900 }, { x: 0, y: 0, w: 900, h: 100 }, { x: 10, y: 10, w: 500, h: 500 }]) {
    const g = frameGeometry(box, box, 256)
    expect(g.page).toBe(384)
    expect(g.cropHeight).toBeLessThan(g.height)
    expect(g.cropWidth).toBeLessThanOrEqual(256)
    expect(g.left + g.cropWidth).toBeLessThanOrEqual(g.width)
  }
})

test('frameArt makes two 2:3 webp files, with ink at the foot and bare paper on top', async () => {
  const source = await svg('<rect x="200" y="500" width="620" height="420" fill="#000"/>')
  const { small, large } = await frameArt(sharp, source)
  expect(await sharp(small).metadata()).toMatchObject({ format: 'webp', width: 256, height: 384 })
  expect(await sharp(large).metadata()).toMatchObject({ format: 'webp', width: 512, height: 768 })
  expect(await inkIn(large, { top: 0, left: 0, width: 512, height: 150 })).toBe(0)
  expect(await inkIn(large, { top: 740, left: 200, width: 112, height: 28 })).toBeGreaterThan(1000)
})

test('frameArt cleans near-white paper to white and refuses a blank page', async () => {
  const source = await svg('<rect width="1024" height="1024" fill="#eeeeee"/><circle cx="512" cy="600" r="300" fill="#000"/>')
  const { large } = await frameArt(sharp, source)
  const { data } = await sharp(large).extract({ top: 0, left: 0, width: 50, height: 50 }).greyscale().raw().toBuffer({ resolveWithObject: true })
  expect(Math.min(...data)).toBeGreaterThan(245)
  await expect(frameArt(sharp, await svg(''))).rejects.toThrow('blank')
})

test('frameArt copes with a drawing that fills the whole square', async () => {
  const { small } = await frameArt(sharp, await svg('<rect width="1024" height="1024" fill="#000"/>'))
  expect(await sharp(small).metadata()).toMatchObject({ width: 256, height: 384 })
})

test('the subject prompt carries the spoiler rule, what to avoid, and the reader\'s direction', () => {
  const book = { title: 'A Book', authors: ['An Author'], subjects: ['Fiction'] }
  const prompt = subjectPrompt(book, { hint: 'a lamp at night', avoid: ['A chair.'] })
  expect(prompt).toContain('Never a later event')
  expect(prompt).toContain('- A chair.')
  expect(prompt).toContain('a lamp at night')
  expect(subjectPrompt(book)).not.toContain('direction')
})

test('parseSubject reads the reply and refuses anything unusable', () => {
  expect(parseSubject('```json\n{"subject": " A lone lighthouse. "}\n```')).toBe('A lone lighthouse.')
  expect(() => parseSubject('no json here')).toThrow()
  expect(() => parseSubject('{"subject": ""}')).toThrow()
  expect(() => parseSubject('{"other": "x"}')).toThrow()
})

test('the image prompt asks for what the design needs', () => {
  const prompt = imagePrompt('A chair.')
  for (const words of ['Subject: A chair.', 'top quarter', 'no frame', 'No text']) expect(prompt).toContain(words)
})
