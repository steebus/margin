import { expect, test } from 'vitest'
import { hatchKey } from './hatchCache'

test('each cover, size and theme gets its own entry, and the same request finds the same one', () => {
  const key = hatchKey('https://a.example/1.jpg?x=1&y=2', 225, 338, false)
  expect(hatchKey('https://a.example/1.jpg?x=1&y=2', 225, 338, false)).toBe(key)
  expect(hatchKey('https://a.example/2.jpg', 225, 338, false)).not.toBe(key)
  expect(hatchKey('https://a.example/1.jpg?x=1&y=2', 300, 450, false)).not.toBe(key)
  expect(hatchKey('https://a.example/1.jpg?x=1&y=2', 225, 338, true)).not.toBe(key)
  expect(new URL(key, 'https://site.example').searchParams.get('u')).toBe('https://a.example/1.jpg?x=1&y=2')
})
