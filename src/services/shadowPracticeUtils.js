import { rmsEnvelope } from './audioCompare'
import { detectSegments } from './recitationAnalysis'

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

function spokenWeight(text) {
  const letters = (text.match(/[\u0621-\u064A\u0671-\u06D3\u06EE\u06EF\u06FA-\u06FF]/gu) || []).length
  const harakat = (text.match(/[\u064B-\u0652\u0670]/gu) || []).length
  return Math.max(1, letters * 0.55 + harakat * 0.35)
}

function gapAfterWord(displayTokens) {
  const n = displayTokens.filter((t) => t.type === 'word').length
  const gapAfter = new Array(Math.max(0, n)).fill(0.05)
  let wordIdx = -1
  for (const token of displayTokens) {
    if (token.type === 'word') wordIdx = token.index
    else if (token.type === 'mark' && wordIdx >= 0) {
      gapAfter[wordIdx] = (gapAfter[wordIdx] || 0.05) + 0.14
    }
  }
  return gapAfter
}

/** Text-aware slot fractions: syllable weight + extra gap after ۛ marks. */
export function wordStartFractionsFromText(displayTokens) {
  const wordTokens = displayTokens.filter((t) => t.type === 'word')
  const n = wordTokens.length
  if (!n) return [0, 1]
  const weights = wordTokens.map((t) => spokenWeight(t.text))
  const gaps = gapAfterWord(displayTokens)
  const gapSum = gaps.slice(0, n - 1).reduce((a, b) => a + b, 0)
  const weightSum = weights.reduce((a, b) => a + b, 0)
  const total = weightSum + gapSum
  const starts = new Array(n + 1)
  let cursor = 0
  for (let i = 0; i < n; i += 1) {
    starts[i] = cursor
    cursor += weights[i] / total
    if (i < n - 1) cursor += gaps[i] / total
  }
  starts[n] = 1
  return normalizeStarts(starts)
}

function normalizeStarts(starts) {
  const out = starts.map((v, i) => {
    if (i === 0) return 0
    if (i === starts.length - 1) return 1
    return Math.max(0, Math.min(1, v))
  })
  for (let i = 1; i < out.length; i += 1) {
    out[i] = Math.max(out[i], out[i - 1] + 0.0005)
  }
  out[out.length - 1] = 1
  return out
}

function envelopeBoundaryFractions(envelope, wordCount) {
  const n = envelope?.length
  if (!n || wordCount < 1) return null
  if (wordCount === 1) return [0, 1]

  const minima = []
  for (let i = 1; i < n - 1; i += 1) {
    const v = envelope[i]
    if (v <= envelope[i - 1] && v <= envelope[i + 1]) {
      minima.push({ i, v, frac: i / (n - 1) })
    }
  }

  const starts = [0]
  for (let w = 1; w < wordCount; w += 1) {
    const center = (w / wordCount) * (n - 1)
    const window = (n - 1) / wordCount / 1.35
    const lo = center - window
    const hi = center + window
    let pick = Math.round(center)
    let pickV = Infinity
    for (const m of minima) {
      if (m.i >= lo && m.i <= hi && m.v < pickV) {
        pickV = m.v
        pick = m.i
      }
    }
    starts.push(pick / (n - 1))
  }
  starts.push(1)
  return normalizeStarts(starts)
}

function segmentsToStartFractions(segments, durationSec, wordCount) {
  if (!segments?.length || !durationSec || wordCount < 1) return null
  let segs = segments.map((s) => ({ start: s.start, end: s.end }))

  while (segs.length > wordCount) {
    let mergeAt = 0
    let minLen = Infinity
    for (let i = 0; i < segs.length - 1; i += 1) {
      const len = segs[i + 1].end - segs[i].start
      if (len < minLen) {
        minLen = len
        mergeAt = i
      }
    }
    segs[mergeAt] = { start: segs[mergeAt].start, end: segs[mergeAt + 1].end }
    segs.splice(mergeAt + 1, 1)
  }

  while (segs.length < wordCount) {
    let splitAt = 0
    let maxLen = 0
    for (let i = 0; i < segs.length; i += 1) {
      const len = segs[i].end - segs[i].start
      if (len > maxLen) {
        maxLen = len
        splitAt = i
      }
    }
    const mid = (segs[splitAt].start + segs[splitAt].end) / 2
    const left = { start: segs[splitAt].start, end: mid }
    const right = { start: mid, end: segs[splitAt].end }
    segs.splice(splitAt, 1, left, right)
  }

  if (segs.length !== wordCount) return null
  const starts = [0]
  for (let i = 0; i < wordCount - 1; i += 1) {
    starts.push(segs[i].end / durationSec)
  }
  starts.push(1)
  return normalizeStarts(starts)
}

function blendStarts(a, b, audioWeight = 0.62) {
  if (!a?.length) return b
  if (!b?.length) return a
  const len = Math.max(a.length, b.length)
  if (a.length !== b.length) return a
  const out = a.map((v, i) => v * (1 - audioWeight) + b[i] * audioWeight)
  return normalizeStarts(out)
}

/**
 * Per-word start fractions (length = wordCount + 1), from audio segments + text pauses.
 */
export function computeWordStartFractions({
  displayTokens,
  envelope,
  channelData,
  sampleRate,
  durationSec,
}) {
  const wordCount = displayTokens.filter((t) => t.type === 'word').length
  if (!wordCount) return [0, 1]

  const textStarts = wordStartFractionsFromText(displayTokens)
  let audioStarts = null

  if (channelData?.length && sampleRate && durationSec > 0) {
    const segments = detectSegments(channelData, sampleRate)
    if (segments.length >= Math.max(2, Math.floor(wordCount / 2))) {
      audioStarts = segmentsToStartFractions(segments, durationSec, wordCount)
    }
  }

  if (!audioStarts && envelope?.length) {
    audioStarts = envelopeBoundaryFractions(envelope, wordCount)
  }

  if (audioStarts) return blendStarts(textStarts, audioStarts, 0.68)
  return textStarts
}

/** Which word is active at normalized playback progress (0–1). */
export function activeWordIndex(progress, wordCount, startFractions = null) {
  if (!wordCount || !Number.isFinite(progress) || progress < 0) return -1
  const t = Math.min(0.999999, Math.max(0, progress))
  const starts =
    startFractions?.length === wordCount + 1
      ? startFractions
      : Array.from({ length: wordCount + 1 }, (_, i) => i / wordCount)
  for (let i = 0; i < wordCount; i += 1) {
    if (t >= starts[i] && t < starts[i + 1]) return i
  }
  return wordCount - 1
}

/** Word slots across ayah duration (uses startFractions when provided). */
export function wordTimeRange(wordStart, wordEnd, wordCount, durationSec, startFractions = null) {
  if (!wordCount || !Number.isFinite(durationSec) || durationSec <= 0) {
    return { start: 0, end: durationSec || 0, startFrac: 0, endFrac: 1 }
  }
  const clampStart = Math.max(0, Math.min(wordCount - 1, wordStart))
  const clampEnd = Math.max(clampStart, Math.min(wordCount - 1, wordEnd))
  const starts =
    startFractions?.length === wordCount + 1
      ? startFractions
      : Array.from({ length: wordCount + 1 }, (_, i) => i / wordCount)
  return {
    start: starts[clampStart] * durationSec,
    end: starts[clampEnd + 1] * durationSec,
    startFrac: starts[clampStart],
    endFrac: starts[clampEnd + 1],
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