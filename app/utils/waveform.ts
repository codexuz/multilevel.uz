// Peak extraction for the Telegram-style voice player.
//
// Decoding needs the raw bytes, which means a cross-origin fetch of the audio
// file. When storage does not send CORS headers that fetch fails, so callers
// fall back to a deterministic pseudo-waveform derived from the URL: it looks
// like a voice message and stays stable across renders.

export const WAVE_BARS = 48

/** Lowest bar height, so silence still shows a baseline tick. */
const MIN_PEAK = 0.08

function normalize(peaks: number[]): number[] {
  const max = Math.max(...peaks, 0.0001)
  return peaks.map(p => Math.max(MIN_PEAK, p / max))
}

/** Bucket the loudest sample of each slice — cheap and visually close to Telegram. */
export function peaksFromBuffer(buffer: AudioBuffer, bars = WAVE_BARS): number[] {
  const channel = buffer.getChannelData(0)
  const size = Math.floor(channel.length / bars) || 1
  const peaks: number[] = []

  for (let i = 0; i < bars; i++) {
    let peak = 0
    const start = i * size
    const end = Math.min(start + size, channel.length)
    for (let j = start; j < end; j++) {
      const value = Math.abs(channel[j]!)
      if (value > peak) peak = value
    }
    peaks.push(peak)
  }
  return normalize(peaks)
}

/** xorshift32 keyed by the string, so the same URL always draws the same bars. */
export function fallbackPeaks(seed: string, bars = WAVE_BARS): number[] {
  let state = 2166136261
  for (let i = 0; i < seed.length; i++) {
    state ^= seed.charCodeAt(i)
    state = Math.imul(state, 16777619)
  }

  const peaks: number[] = []
  for (let i = 0; i < bars; i++) {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    const unit = ((state >>> 0) % 1000) / 1000
    // Bias toward the middle so it reads as speech rather than noise.
    peaks.push(0.25 + unit * 0.75)
  }
  return normalize(peaks)
}

/** Fetch + decode a clip into bar heights. Throws when the fetch or decode fails. */
export async function peaksFromUrl(url: string, bars = WAVE_BARS): Promise<number[]> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch audio (${response.status})`)
  const bytes = await response.arrayBuffer()

  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new Ctx()
  try {
    return peaksFromBuffer(await ctx.decodeAudioData(bytes), bars)
  } finally {
    await ctx.close().catch(() => {})
  }
}
