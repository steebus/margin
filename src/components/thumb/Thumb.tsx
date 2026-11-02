import { useEffect, useRef, useState } from 'react'
import { hatchWeights, toLuma } from '../../lib/ink'
import { Circle, Strike } from './Marks'
import type { Book } from '../../sample/sample'
import { useTheme } from '../../lib/theme'

// Each cover is fetched once per session and shared, across resizes and every screen.
// A failure isn't kept, so the next time the cell appears it tries again.
const covers = new Map<string, Promise<HTMLImageElement>>()

function loadCover(url: string) {
  let cover = covers.get(url)
  if (!cover) {
    cover = new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = () => {
        covers.delete(url)
        reject(new Error(`Cover failed to load: ${url}`))
      }
      img.src = url
    })
    covers.set(url, cover)
  }
  return cover
}

type Props = { coverId: number; onDone: (result: 'painted' | 'failed') => void }

// ponytail: processes on the main thread as cells near the screen. It only runs until a book's
// generated art lands, so this is fine; move it to a worker if a big import ever janks.
function HatchedCover({ coverId, onDone }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const dark = useTheme() === 'dark'
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    const canvas = ref.current!
    let cancelled = false
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      // Drawn larger than the screen and scaled down, which softens the pen into real greys.
      const unit = Math.max(window.devicePixelRatio || 1, 2.5)
      const w = Math.max(1, Math.round(canvas.clientWidth * unit))
      const h = Math.max(1, Math.round(canvas.clientHeight * unit))
      loadCover(`https://covers.openlibrary.org/b/id/${coverId}-L.jpg`).then(img => {
        if (cancelled) return
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!
        // Crop to fill, the same as object-fit: cover.
        const fit = Math.max(w / img.width, h / img.height)
        ctx.drawImage(img, (w - img.width * fit) / 2, (h - img.height * fit) / 2, img.width * fit, img.height * fit)
        const pixels = ctx.getImageData(0, 0, w, h)
        const weights = hatchWeights(toLuma(pixels.data), w, h, { seed: coverId, negative: dark, unit })
        const ink = dark ? [230, 227, 218] : [18, 18, 18]
        for (let i = 0; i < weights.length; i++) {
          pixels.data.set(ink, i * 4)
          pixels.data[i * 4 + 3] = weights[i]
        }
        ctx.putImageData(pixels, 0, 0)
        done.current('painted')
      }, () => { if (!cancelled) done.current('failed') })
    }, { rootMargin: '300px' })
    observer.observe(canvas)
    return () => { cancelled = true; observer.disconnect() }
  }, [coverId, dark])

  return <canvas ref={ref} className="thumb-art" aria-hidden="true" />
}

/**
 * A book's picture, best source first: generated art, then a cross-hatch of the real cover,
 * then the printed title. Each one covers for the next while it loads or if it fails.
 */
export function Thumb({ book, marks = true }: { book: Book; marks?: boolean }) {
  const [artFailed, setArtFailed] = useState(false)
  const [state, setState] = useState<'waiting' | 'painted' | 'failed'>('waiting')
  const art = !artFailed && book.art

  return (
    <span className="thumb" data-art={art ? '' : undefined}>
      {art ? (
        <img
          className="thumb-generated"
          src={art.large}
          srcSet={`${art.small} 256w, ${art.large} 512w`}
          sizes="(min-width: 900px) 240px, 34vw"
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setArtFailed(true)}
        />
      ) : (
        <>
          {state !== 'painted' && <span className="thumb-stamp" aria-hidden="true">{book.title}</span>}
          {book.coverId && state !== 'failed' && <HatchedCover coverId={book.coverId} onDone={setState} />}
        </>
      )}
      {marks && book.status === 'reading' && <Circle />}
      {marks && book.status === 'dnf' && <Strike />}
    </span>
  )
}
