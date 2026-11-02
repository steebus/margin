import { fromOcr, shrinkPhoto, type Read } from './photo'

/**
 * Reads the photo on this device. No model, and the photo goes nowhere. The first use downloads about 10 MB of
 * language data, which the browser then keeps. Loaded only when needed, so nobody pays for it otherwise.
 */
async function readOnDevice(file: File): Promise<Read> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng')
  try {
    const { data } = await worker.recognize(`data:image/jpeg;base64,${await shrinkPhoto(file)}`)
    return fromOcr(data.text)
  } finally {
    void worker.terminate()
  }
}

/**
 * Reads a photographed page. Gemini first, because it copes better with shadows and curved pages and works out the
 * structure. It refuses some published text outright, and needs credit and a connection, so the device takes over then.
 */
export async function readPage(file: File, transcribe: (args: { image: string }) => Promise<Read & { refused?: boolean }>): Promise<Read> {
  let failure: unknown = null
  try {
    const read = await transcribe({ image: await shrinkPhoto(file) })
    if (read.paragraphs.length) return read
    if (!read.refused) return read
  } catch (e) {
    failure = e
  }
  try {
    return await readOnDevice(file)
  } catch (e) {
    throw failure ?? e
  }
}
