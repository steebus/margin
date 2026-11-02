import { expect, test } from 'vitest'
import { movedTooFar } from './longPress'

test('a small wobble is still a hold, but a scroll is not', () => {
  expect(movedTooFar({ x: 0, y: 0 }, { x: 4, y: 6 })).toBe(false)
  expect(movedTooFar({ x: 0, y: 0 }, { x: 0, y: 14 })).toBe(true)
})
