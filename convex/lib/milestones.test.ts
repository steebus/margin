import { expect, test } from 'vitest'
import type { Guide } from './guide'
import { crossed, milestonesFor } from './milestones'

const guide = (questions: Guide['questions'], knownness: Guide['knownness'] = 'well'): Guide =>
  ({ knownness, structure: [], themes: [], moments: [], questions, sources: [] })
const q = (percent: number, text = `At ${percent}`) => ({ percent, register: 'noticing' as const, text })

test('without a guide it can trust, the buddy uses the plain checkpoints', () => {
  expect(milestonesFor(null).map(m => m.percent)).toEqual([10, 25, 50, 75, 90])
  expect(milestonesFor(guide([q(20)], 'barely')).map(m => m.key)).toEqual(['g:10', 'g:25', 'g:50', 'g:75', 'g:90'])
  expect(milestonesFor(guide([])).map(m => m.key)[0]).toBe('g:10')
})

test("a guide's questions become milestones, in order and spaced out", () => {
  const ms = milestonesFor(guide([q(40), q(0), q(12), q(15), q(100), q(21), q(80)]))
  expect(ms.map(m => m.percent)).toEqual([12, 21, 40, 80])
  expect(ms[0]).toEqual({ key: 'q:2', percent: 12, text: 'At 12' })
})

test('a move leaves one note, for the furthest milestone it crosses', () => {
  const ms = milestonesFor(null)
  expect(crossed(ms, 0, 9)).toBeNull()
  expect(crossed(ms, 9, 10)?.key).toBe('g:10')
  expect(crossed(ms, 10, 24)).toBeNull()
  expect(crossed(ms, 5, 60)?.key).toBe('g:50')
  expect(crossed(ms, 60, 40)).toBeNull()
  expect(crossed(ms, 80, 100)).toBeNull()
})
