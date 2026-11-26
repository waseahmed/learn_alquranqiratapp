import { rmsEnvelope } from './audioCompare'

/** Arabic letters (spoken syllables); excludes pause-only Quranic marks. */
const HAS_ARABIC_LETTER =
  /[\u0621-\u064A\u0671-\u06D3\u06EE\u06EF\u06FA-\u06FF\u0750-\u077F\u08A0-\u08FF]/u

/** Token with no letters — typically ۛ وقف marks, sajdah, rub el hizb, etc. */
const MARKS_ONLY =
  /^[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u06DF-\u06E9\u06EA-\u06ED\u200C-\u200F\u0640]*$/u

export function isSpokenWordToken(token) {
  if (!token) return false
  if (HAS_ARABIC_LETTER.test(token)) return true
  if (MARKS_ONLY.test(token)) return false
  return true
}

/**
 * Split ayah into spoken words (for timing/highlight) vs display tokens (words + pause marks).
 */
export function parseAyahWords(arabic) {
  if (!arabic) return { words: [], displayTokens: [] }
  const raw = arabic.trim().split(/\s+/).filter(Boolean)
  const words = []
  const displayTokens = []
  let index = 0
  for (const text of raw) {
    if (isSpokenWordToken(text)) {
      words.push(text)
      displayTokens.push({ type: 'word', text, index })
      index += 1
    } else {
      displayTokens.push({ type: 'mark', text })
    }
  }
  return { words, displayTokens }
}

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