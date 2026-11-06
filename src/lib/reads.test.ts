import { expect, test } from 'vitest'
import { duringRead } from './reads'

test('each read keeps the notes written in it, and the gap after it', () => {
  const readings = [{ startedAt: 10, finishedAt: 20 }, { startedAt: 40, finishedAt: 50 }]
  const notes = [5, 15, 30, 45, 60].map(createdAt => ({ createdAt }))
  expect(duringRead(notes, readings, 0).map(n => n.createdAt)).toEqual([15, 30])
  expect(duringRead(notes, readings, 1).map(n => n.createdAt)).toEqual([45, 60])
  expect(duringRead(notes, [{ finishedAt: 20 }], 0)).toHaveLength(5)
})
