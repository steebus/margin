// Finished cross-hatches are kept on the device, so a cover is only ever fetched and drawn once.
// Raise the version when the drawing itself changes. Anything going wrong here just means drawing it again.
const CACHE = 'hatched-v1'

/** One entry per cover, size and theme. Exported for its test. */
export const hatchKey = (coverUrl: string, width: number, height: number, dark: boolean) =>
  `/__hatched?u=${encodeURIComponent(coverUrl)}&s=${width}x${height}&t=${dark ? 'd' : 'l'}`

export async function readHatch(key: string): Promise<ImageBitmap | null> {
  try {
    const hit = await (await caches.open(CACHE)).match(key)
    return hit ? await createImageBitmap(await hit.blob()) : null
  } catch {
    return null
  }
}

export function storeHatch(key: string, canvas: HTMLCanvasElement) {
  try {
    canvas.toBlob(blob => {
      if (!blob) return
      void caches.open(CACHE)
        .then(cache => cache.put(key, new Response(blob, { headers: { 'content-type': blob.type } })))
        .catch(() => {})
    }, 'image/webp', 0.85)
  } catch { /* not available here: it's drawn again next time */ }
}
