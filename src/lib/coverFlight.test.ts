import { afterEach, describe, expect, it, vi } from 'vitest'
import { COVER_FLIGHT, flyCover } from './coverFlight'

/** Just enough of an element: a style that remembers properties, and a cover to find. */
const cellWith = (cover: boolean) => {
  const props = new Map<string, string>()
  const thumb = {
    style: {
      setProperty: (k: string, v: string) => void props.set(k, v),
      removeProperty: (k: string) => void props.delete(k),
    },
  }
  return { props, tapped: { querySelector: () => (cover ? thumb : null) } as unknown as Element }
}

describe('flyCover', () => {
  afterEach(() => vi.useRealTimers())

  it("names the tapped book's cover and takes the name off again", () => {
    vi.useFakeTimers()
    const { props, tapped } = cellWith(true)
    flyCover(tapped, 500)
    expect(props.get('view-transition-name')).toBe(COVER_FLIGHT)
    vi.advanceTimersByTime(500)
    expect(props.has('view-transition-name')).toBe(false)
  })

  it('does nothing for a book without a cover element', () => {
    expect(() => flyCover(cellWith(false).tapped)).not.toThrow()
  })
})
