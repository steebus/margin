// Turns a generated drawing into the two files the app stores. Shared by the bulk script and regeneration.
import type SharpType from 'sharp'

type Sharp = typeof SharpType
export type Box = { x: number; y: number; w: number; h: number }

const BLUR = 7
const DENSE = Math.round(255 * 0.78)
export const SIZES = [256, 512] as const

/** Where ink is dense, in a blurred greyscale image, so stray strokes don't count. Null if the page is blank. */
export function inkBox(pixels: Uint8Array | Buffer, width: number, region: Box): Box | null {
  let left = Infinity
  let right = -1
  let top = Infinity
  let bottom = -1
  for (let y = region.y; y < region.y + region.h; y++) {
    for (let x = region.x; x < region.x + region.w; x++) {
      if (pixels[y * width + x] < DENSE) {
        if (x < left) left = x
        if (x > right) right = x
        if (y < top) top = y
        if (y > bottom) bottom = y
      }
    }
  }
  return right < 0 ? null : { x: left, y: top, w: right - left + 1, h: bottom - top + 1 }
}

/**
 * How to seat a drawing on a 2:3 page. It zooms up to 122% of the page width, but never so far that the top half of
 * the ink is wider than the page, so only the bottom and lower sides bleed. A tree keeps its whole canopy.
 */
export function frameGeometry(box: Box, upper: Box, size: number) {
  const scale = Math.min((size * 1.22) / box.w, (size * 1.12) / box.h, (size * 0.94) / upper.w)
  const width = Math.max(1, Math.round(box.w * scale))
  const height = Math.max(1, Math.round(box.h * scale))
  const centre = (upper.x - box.x + upper.w / 2) * scale
  const left = width > size ? Math.max(0, Math.min(width - size, Math.round(centre - size / 2))) : 0
  return {
    width,
    height,
    left,
    cropWidth: Math.min(size, width),
    cropHeight: Math.max(1, height - Math.round(height * 0.05)),
    page: Math.round(size * 1.5),
  }
}

/** Greyscale, cleaned to paper white and ink black, framed, and encoded in both sizes. Throws on a blank page. */
export async function frameArt(sharp: Sharp, source: Buffer) {
  const { data, info } = await sharp(source).greyscale().blur(BLUR).raw().toBuffer({ resolveWithObject: true })
  const box = inkBox(data, info.width, { x: 0, y: 0, w: info.width, h: info.height })
  if (!box) throw new Error('The drawing came back blank')
  const upper = inkBox(data, info.width, { ...box, h: Math.max(1, Math.round(box.h / 2)) }) ?? box

  // -level 10%,85%: stretches 10% grey to black and 85% grey to white.
  const gain = 1 / 0.75
  const cleaned = await sharp(source)
    .greyscale()
    .linear(gain, -0.1 * 255 * gain)
    .extract({ left: box.x, top: box.y, width: box.w, height: box.h })
    .toBuffer()

  const out: Record<number, Buffer> = {}
  for (const size of SIZES) {
    const g = frameGeometry(box, upper, size)
    const resized = await sharp(cleaned).resize(g.width, g.height, { fit: 'fill' }).toBuffer()
    const cut = await sharp(resized).extract({ left: g.left, top: 0, width: g.cropWidth, height: g.cropHeight }).toBuffer()
    const side = size - g.cropWidth
    out[size] = await sharp(cut)
      .extend({
        top: Math.max(0, g.page - g.cropHeight),
        left: Math.floor(side / 2),
        right: Math.ceil(side / 2),
        bottom: 0,
        background: '#ffffff',
      })
      .webp({ quality: 60 })
      .toBuffer()
  }
  return { small: out[256], large: out[512] }
}
