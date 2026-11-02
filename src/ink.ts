// The fallback for books with no generated art: a pen-and-ink cross-hatch drawing of the real cover.
// It returns how heavily ink lands on each pixel, in real shades of grey.
export type InkOptions = {
  /** The same seed always gives the same drawing, so a cover never changes between visits. */
  seed?: number
  /** Inks the light parts instead, for the night theme, so the cover still reads as a positive. */
  negative?: boolean
  /** Processed pixels per screen pixel, so a pen stroke is the same width on any size of cover. */
  unit?: number
}

const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}

function random(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Two box-blur passes, which is close enough to a Gaussian and much cheaper. */
function blur(src: Float32Array, w: number, h: number, radius: number) {
  const r = Math.max(1, Math.round(radius))
  let from = src
  for (let pass = 0; pass < 2; pass++) {
    const across = new Float32Array(from.length)
    for (let y = 0; y < h; y++) {
      let sum = 0
      for (let x = -r; x <= r; x++) sum += from[y * w + Math.min(w - 1, Math.max(0, x))]
      for (let x = 0; x < w; x++) {
        across[y * w + x] = sum / (2 * r + 1)
        sum += from[y * w + Math.min(w - 1, x + r + 1)] - from[y * w + Math.max(0, x - r)]
      }
    }
    const down = new Float32Array(from.length)
    for (let x = 0; x < w; x++) {
      let sum = 0
      for (let y = -r; y <= r; y++) sum += across[Math.min(h - 1, Math.max(0, y)) * w + x]
      for (let y = 0; y < h; y++) {
        down[y * w + x] = sum / (2 * r + 1)
        sum += across[Math.min(h - 1, y + r + 1) * w + x] - across[Math.max(0, y - r) * w + x]
      }
    }
    from = down
  }
  return from
}

/** Smooth random texture with features about `radius` pixels across, spread over 0 to 1. */
function field(w: number, h: number, seed: number, radius: number) {
  const next = random(seed)
  const raw = new Float32Array(w * h)
  for (let i = 0; i < raw.length; i++) raw[i] = next()
  const soft = blur(raw, w, h, radius)
  let mean = 0
  for (const v of soft) mean += v
  mean /= soft.length
  let variance = 0
  for (const v of soft) variance += (v - mean) ** 2
  const spread = Math.sqrt(variance / soft.length) * 4 || 1
  return soft.map(v => clamp((v - mean) / spread + 0.5))
}

/** Lines only: the "colour dodge" trick artists' tools use to pull a sketch out of a photo. */
function sketchLines(tone: Float32Array, w: number, h: number, radius: number) {
  const inverted = blur(tone.map(v => 1 - v), w, h, radius)
  const lines = new Float32Array(tone.length)
  for (let i = 0; i < tone.length; i++) {
    const dodge = Math.min(1, tone[i] / Math.max(1 - inverted[i], 0.02))
    lines[i] = clamp((1 - dodge) * 1.7) ** 0.8
  }
  return lines
}

/** Luminance from 0 to 1, stretched so dull scans still reach real black and white. */
export function toLuma(rgba: Uint8ClampedArray): Float32Array {
  const luma = new Float32Array(rgba.length / 4)
  for (let i = 0; i < luma.length; i++) {
    luma[i] = (0.2126 * rgba[i * 4] + 0.7152 * rgba[i * 4 + 1] + 0.0722 * rgba[i * 4 + 2]) / 255
  }
  const sorted = Float32Array.from(luma).sort()
  const low = sorted[Math.floor(sorted.length * 0.02)]
  const high = sorted[Math.floor(sorted.length * 0.98)]
  if (high - low > 0.02) {
    for (let i = 0; i < luma.length; i++) luma[i] = clamp((luma[i] - low) / (high - low))
  }
  return luma
}

/** Ink weight for each pixel, from 0 for bare paper to 255 for solid ink. Layers of wobbling lines cross as tone darkens. */
export function hatchWeights(luma: Float32Array, w: number, h: number, options: InkOptions = {}) {
  const { seed = 1, negative = false, unit = 1 } = options
  const tone = negative ? luma.map(v => 1 - v) : luma
  const soft = blur(tone, w, h, 0.8 * unit)
  const outline = sketchLines(tone, w, h, 2 * unit)
  const period = 3.4 * unit
  const ink = new Float32Array(tone.length)
  const layers = [
    { angle: 0.8, from: 0.22 },
    { angle: -0.8, from: 0.46 },
    { angle: 0.15, from: 0.66 },
    { angle: 1.4, from: 0.82 },
  ]
  layers.forEach((layer, l) => {
    const c = Math.cos(layer.angle)
    const s = Math.sin(layer.angle)
    const wobble = field(w, h, seed + l * 11, 7 * unit)
    const pressure = field(w, h, seed + l * 23, 3 * unit)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        const dark = 1 - soft[i]
        const active = smooth(layer.from - 0.05, layer.from + 0.05, dark)
        if (!active) continue
        const u = (x * c + y * s) / period + wobble[i] * 1.3
        const band = Math.abs(u - Math.floor(u) - 0.5) * 2
        const width = 0.2 + 0.24 * dark
        const line = 1 - smooth(width, width + 0.22, band)
        ink[i] = Math.max(ink[i], line * active * (0.5 + 0.7 * pressure[i]))
      }
    }
  })
  const out = new Uint8ClampedArray(w * h)
  for (let i = 0; i < out.length; i++) out[i] = Math.round(clamp(Math.max(ink[i], outline[i] * 0.9)) * 255)
  return out
}
