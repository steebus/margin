import { expect, test } from 'vitest'
import { resolveTheme } from './theme'

test('a saved choice beats the system setting', () => {
  expect(resolveTheme('light', true)).toBe('light')
  expect(resolveTheme('dark', false)).toBe('dark')
})

test('with nothing valid saved, the system setting decides', () => {
  expect(resolveTheme(null, true)).toBe('dark')
  expect(resolveTheme(null, false)).toBe('light')
  expect(resolveTheme('rubbish', true)).toBe('dark')
})
