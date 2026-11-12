import { describe, expect, it } from 'vitest'
import { citedFrom, type Found } from './buddy'

const f = (id: string, title: string): Found => ({ id, title, author: 'A', kind: 'note', text: 'x', position: null, current: false })

describe('citedFrom', () => {
  const found = [f('a', 'The Glass Orchard'), f('b', 'Piranesi'), f('c', 'Dune'), f('d', 'Emma'), f('e', 'Ulysses')]
  it('cites the notes whose book the reply names', () => {
    expect(citedFrom('That echoes what you wrote on piranesi.', found)).toEqual(['b'])
  })
  it('cites nothing when no book is named', () => {
    expect(citedFrom('What did you make of the ending?', found)).toEqual([])
  })
  it('gives each note once and at most three', () => {
    const dup = [f('a', 'Dune'), f('a', 'Dune'), f('b', 'Emma'), f('c', 'Ulysses'), f('d', 'Piranesi')]
    expect(citedFrom('Dune, Emma, Ulysses and Piranesi', dup)).toEqual(['a', 'b', 'c'])
  })
})
