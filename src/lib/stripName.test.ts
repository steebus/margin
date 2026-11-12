import { describe, expect, it } from 'vitest'
import { stripName } from './stripName'

describe('stripName', () => {
  const book = { title: 'Piranesi', author: 'Susanna Clarke', format: 'paper', percent: 40 }
  it('names title, author and percent', () => {
    expect(stripName(book)).toBe('Piranesi by Susanna Clarke, 40%')
  })
  it('holds "Audiobook" when the card prints it in the author\'s place', () => {
    expect(stripName({ ...book, format: 'audio' })).toContain('Audiobook')
  })
  it('copes with no author', () => {
    expect(stripName({ ...book, author: '' })).toBe('Piranesi, 40%')
  })
})
