import { useEffect, useRef, useState } from 'react'
import { coverPath } from '../../lib/art'
import { spineTitle } from '../../lib/pile'
import { hatchKey, readHatch, storeHatch } from '../../lib/hatchCache'
import { hatchWeights, toLuma } from '../../lib/ink'
import { Circle, Strike } from './Marks'
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

/** A stable number from an address, so a cover's pen strokes never change between visits. */
const seedOf = (text: string) => [...text].reduce((sum, c) => (sum * 31 + c.charCodeAt(0)) >>> 0, 7)

type Props = { coverUrl: string; onDone: (result: 'painted' | 'failed') => void }

// ponytail: draws on the main thread, but only the first time; the result is kept on the device (lib/hatchCache).
// Move it to a worker if a big import ever janks.
function HatchedCover({ coverUrl, onDone }: Props) {
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
      const key = hatchKey(coverUrl, w, h, dark)
      void readHatch(key).then(saved => {
        if (cancelled) return
        if (saved) {
          canvas.width = w
          canvas.height = h
          canvas.getContext('2d')!.drawImage(saved, 0, 0)
          saved.close()
          done.current('painted')
          return
        }
        draw(key)
      })
      const draw = (key: string) => loadCover(coverPath(coverUrl)).then(img => {
        if (cancelled) return
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!
        // Crop to fill, the same as object-fit: cover.
        const fit = Math.max(w / img.width, h / img.height)
        ctx.drawImage(img, (w - img.width * fit) / 2, (h - img.height * fit) / 2, img.width * fit, img.height * fit)
        const pixels = ctx.getImageData(0, 0, w, h)
        const weights = hatchWeights(toLuma(pixels.data), w, h, { seed: seedOf(coverUrl), negative: dark, unit })
        const ink = dark ? [230, 227, 218] : [18, 18, 18]
        for (let i = 0; i < weights.length; i++) {
          pixels.data.set(ink, i * 4)
          pixels.data[i * 4 + 3] = weights[i]
        }
        ctx.putImageData(pixels, 0, 0)
        storeHatch(key, canvas)
        done.current('painted')
      }, () => { if (!cancelled) done.current('failed') })
    }, { rootMargin: '300px' })
    observer.observe(canvas)
    return () => { cancelled = true; observer.disconnect() }
  }, [coverUrl, dark])

  return <canvas ref={ref} className="thumb-art" aria-hidden="true" />
}

/**
 * A book's picture, best source first: generated art, then a cross-hatch of the real cover,
 * then the printed title. Each one covers for the next while it loads or if it fails.
 */
type ThumbBook = { title: string; coverUrl: string | null; art?: { small: string; large: string } | null; status: string }

export function Thumb({ book, marks = true }: { book: ThumbBook; marks?: boolean }) {
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
          {book.coverUrl && state !== 'failed' && <HatchedCover coverUrl={book.coverUrl} onDone={setState} />}
        </>
      )}
      {/* Every cover carries its title, without the subtitle. The title stamp already is one. */}
      {(art || state === 'painted') && <span className="thumb-title" aria-hidden="true"><span>{spineTitle(book.title)}</span></span>}
      {marks && book.status === 'reading' && <Circle />}
      {marks && book.status === 'dnf' && <Strike />}
    </span>
  )
}
