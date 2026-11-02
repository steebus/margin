import { expect, test } from 'vitest'
import { allowedRedirect } from './redirects'

const SITE = 'https://margin.example'

test('the site itself is allowed, however the address is written', () => {
  expect(allowedRedirect('/settings', SITE)).toBe('https://margin.example/settings')
  expect(allowedRedirect('https://margin.example/settings', SITE)).toBe('https://margin.example/settings')
  expect(allowedRedirect('?code=1', SITE)).toBe('https://margin.example/?code=1')
})

test('this machine is allowed while developing', () => {
  expect(allowedRedirect('http://localhost:5199/settings', SITE)).toBe('http://localhost:5199/settings')
  expect(allowedRedirect('http://127.0.0.1:5199/', SITE)).toBe('http://127.0.0.1:5199/')
})

test('anywhere else is refused, including lookalikes and tricks', () => {
  for (const bad of [
    'https://evil.example/',
    'https://margin.example.evil.example/',
    'https://margin.example@evil.example/',
    '//evil.example/',
    'https://localhost.evil.example/',
    'https://localhost/',
    'javascript:alert(1)',
  ]) {
    expect(() => allowedRedirect(bad, SITE), bad).toThrow()
  }
})
