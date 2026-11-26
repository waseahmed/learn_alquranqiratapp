import { rmsEnvelope } from './audioCompare'

/** Which word is active at normalized playback progress (0–1), equal slots per word. */
export function activeWordIndex(progress, wordCount) {
  if (!wordCount || !Number.isFinite(progress) || progress < 0) return -1
  const t = Math.min(0.999999, Math.max(0, progress))
  return Math.min(wordCount - 1, Math.floor(t * wordCount))
}

/** Equal word slots across ayah duration (coaching heuristic). */
export function wordTimeRange(wordStart, wordEnd, wordCount, durationSec) {
  if (!wordCount || !Number.isFinite(durationSec) || durationSec <= 0) {
    return { start: 0, end: durationSec || 0, startFrac: 0, endFrac: 1 }
  }
  const clampStart = Math.max(0, Math.min(wordCount - 1, wordStart))
  const clampEnd = Math.max(clampStart, Math.min(wordCount - 1, wordEnd))
  const slot = durationSec / wordCount
  return {
    start: clampStart * slot,
    end: (clampEnd + 1) * slot,
    startFrac: clampStart / wordCount,
    endFrac: (clampEnd + 1) / wordCount,
  }
}

export function envelopeSliceForRange(envelope, startFrac, endFrac) {
  if (!envelope?.length) return []
  const n = envelope.length
  const i0 = Math.floor(startFrac * n)
  const i1 = Math.max(i0 + 1, Math.ceil(endFrac * n))
  return envelope.slice(i0, Math.min(n, i1))
}

/** Slice decoded audio for phrase-level comparison. */
export function sliceAudioAnalysis(analysis, startFrac, endFrac) {
  if (!analysis?.channelData?.length) return null
  const ch = analysis.channelData
  const i0 = Math.floor(Math.max(0, Math.min(1, startFrac)) * ch.length)
  const i1 = Math.max(
    i0 + 1,
    Math.ceil(Math.max(0, Math.min(1, endFrac)) * ch.length),
  )
  const slice = ch.subarray(i0, i1)
  const duration =
    analysis.duration * Math.max(0.01, Math.min(1, endFrac - startFrac))
  return {
    duration,
    sampleRate: analysis.sampleRate,
    channelData: slice,
    envelope: rmsEnvelope(slice),
  }
}