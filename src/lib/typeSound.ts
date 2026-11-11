import { useSyncExternalStore } from 'react'

const KEY = 'margin.typeSound'

/** What a keystroke sounds like. Pure, so the choices are testable; `play` turns it into audio. */
export type Strike = { kind: 'key' | 'space' | 'bell'; pitch: number; gain: number }

const hash = (i: number) => {
  const x = Math.sin(i * 78.233) * 43758.5453
  return x - Math.floor(x)
}

/** The strike for this character: letters click, a space thuds, and the end of a line rings the bell. */
export function strikeFor(char: string, i: number, lineEnd: boolean): Strike {
  if (lineEnd) return { kind: 'bell', pitch: 2200, gain: 0.07 }
  const wobble = hash(i)
  if (char === ' ') return { kind: 'space', pitch: 180 + wobble * 30, gain: 0.16 }
  return { kind: 'key', pitch: 1500 + wobble * 900, gain: 0.07 + hash(i + 3) * 0.05 }
}

const listeners = new Set<() => void>()
let on: boolean | null = null

const read = () => {
  if (on === null) {
    try { on = localStorage.getItem(KEY) === 'on' } catch { on = false }
  }
  return on
}

/** Off unless the reader turned it on. Kept on this device. */
export function setTypeSound(value: boolean) {
  on = value
  try {
    if (value) localStorage.setItem(KEY, 'on')
    else localStorage.removeItem(KEY)
  } catch { /* private window: it lasts until the page closes */ }
  listeners.forEach(l => l())
}

export const useTypeSound = () =>
  useSyncExternalStore(
    l => { listeners.add(l); return () => { listeners.delete(l) } },
    read,
    () => false,
  )

let context: AudioContext | null = null

/** Plays one strike if sound is on. Never throws: a browser without audio just stays quiet. */
export function play(strike: Strike) {
  if (!read()) return
  try {
    context ??= new AudioContext()
    if (context.state === 'suspended') void context.resume()
    const t = context.currentTime
    const out = context.createGain()
    out.connect(context.destination)
    if (strike.kind === 'bell') {
      const tone = context.createOscillator()
      tone.type = 'sine'
      tone.frequency.value = strike.pitch
      tone.connect(out)
      out.gain.setValueAtTime(strike.gain, t)
      out.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
      tone.start(t)
      tone.stop(t + 0.95)
      return
    }
    const length = strike.kind === 'space' ? 0.07 : 0.03
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * length), context.sampleRate)
    const data = buffer.getChannelData(0)
    for (let n = 0; n < data.length; n++) data[n] = (Math.random() * 2 - 1) * (1 - n / data.length) ** 2
    const noise = context.createBufferSource()
    noise.buffer = buffer
    const filter = context.createBiquadFilter()
    filter.type = strike.kind === 'space' ? 'lowpass' : 'bandpass'
    filter.frequency.value = strike.pitch
    noise.connect(filter)
    filter.connect(out)
    out.gain.value = strike.gain
    noise.start(t)
  } catch { /* no audio here */ }
}
