import { describe, expect, it } from 'vitest'
import { offlineLine } from './offlineLine'

describe('offlineLine', () => {
  it('says nothing when online with nothing waiting', () => expect(offlineLine(true, 0)).toBeNull())
  it('says it is the last visit when offline', () => expect(offlineLine(false, 0)).toBe('Offline: showing your last visit.'))
  it('counts what waits, offline or not', () => {
    expect(offlineLine(false, 1)).toBe('Offline: showing your last visit. 1 note or place waiting to send.')
    expect(offlineLine(true, 3)).toBe('3 notes and places waiting to send.')
  })
})
