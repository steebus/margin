import { expect, test } from 'vitest'
import { hatchWeights, toLuma } from './ink'

const SIZE = 80
const flat = (value: number) => new Float32Array(SIZE * SIZE).fill(value)
const coverage = (weights: Uint8ClampedArray) => weights.reduce((sum, v) => sum + v, 0) / weights.length / 255

/** Dark on the left, light on the right. */
const scene = () => {
  const tone = new Float32Array(SIZE * SIZE)
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) tone[y * SIZE + x] = x / (SIZE - 1)
  return tone
}

test('bare paper stays nearly bare, and a dark page carries real ink', () => {
  expect(coverage(hatchWeights(flat(1), SIZE, SIZE))).toBeLessThan(0.05)
  expect(coverage(hatchWeights(flat(0.05), SIZE, SIZE))).toBeGreaterThan(0.2)
})

test('the dark side of a gradient is heavier than the light side', () => {
  const weights = hatchWeights(scene(), SIZE, SIZE)
  let left = 0
  let right = 0
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE / 4; x++) {
      left += weights[y * SIZE + x]
      right += weights[y * SIZE + SIZE - 1 - x]
    }
  }
  expect(left).toBeGreaterThan(right)
})

test('the same seed always draws the same cover, and another seed differs', () => {
  const first = hatchWeights(scene(), SIZE, SIZE, { seed: 7 })
  expect(hatchWeights(scene(), SIZE, SIZE, { seed: 7 })).toEqual(first)
  expect(hatchWeights(scene(), SIZE, SIZE, { seed: 8 })).not.toEqual(first)
})

test('a negative print inks the light parts instead', () => {
  expect(coverage(hatchWeights(flat(0.95), SIZE, SIZE, { negative: true }))).toBeGreaterThan(
    coverage(hatchWeights(flat(0.95), SIZE, SIZE)),
  )
})

test('it makes real greys, not just on and off', () => {
  expect(new Set(hatchWeights(scene(), SIZE, SIZE, { seed: 3 })).size).toBeGreaterThan(20)
})

test('toLuma stretches a dull scan to the full range', () => {
  const rgba = new Uint8ClampedArray(400)
  for (let i = 0; i < 100; i++) rgba.set(i < 50 ? [100, 100, 100, 255] : [150, 150, 150, 255], i * 4)
  const luma = toLuma(rgba)
  expect(Math.min(...luma)).toBe(0)
  expect(Math.max(...luma)).toBe(1)
})

test('toLuma leaves a blank cover alone rather than dividing by nothing', () => {
  const luma = toLuma(new Uint8ClampedArray(400).fill(128))
  expect(luma.every(v => Number.isFinite(v))).toBe(true)
})
