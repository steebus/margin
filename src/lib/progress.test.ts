import { expect, test } from 'vitest'
import { formatClock, fromDateInput, toDateInput, unitFor, unitsFor } from './progress'

const book = { pages: 300, audioSeconds: null, format: 'print', progressUnit: null } as const

test('a book only offers units it has a length for', () => {
  expect(unitsFor(book)).toEqual(['page', 'percent'])
  expect(unitsFor({ pages: null, audioSeconds: 3600 })).toEqual(['time', 'percent'])
  expect(unitsFor({ pages: null, audioSeconds: null })).toEqual(['percent'])
})

test('the choice sticks while it works, and the format decides otherwise', () => {
  expect(unitFor(book)).toBe('page')
  expect(unitFor({ ...book, progressUnit: 'percent' })).toBe('percent')
  expect(unitFor({ ...book, progressUnit: 'time' })).toBe('page')
  expect(unitFor({ ...book, format: 'audio', audioSeconds: 3600 })).toBe('time')
  expect(unitFor({ ...book, format: 'audio' })).toBe('percent')
})

test('time reads as hours and minutes', () => {
  expect(formatClock(45_000)).toBe('12h 30m')
  expect(formatClock(1800)).toBe('30m')
})

test('date inputs round-trip as whole days', () => {
  expect(toDateInput(fromDateInput('2024-03-09'))).toBe('2024-03-09')
  expect(toDateInput(null)).toBe('')
  expect(fromDateInput('')).toBeUndefined()
})
