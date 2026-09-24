import { pearson } from './audioCompare'

const TWO_PI = Math.PI * 2

const PITCH_MIN_HZ = 70
const PITCH_MAX_HZ = 500
const PITCH_TARGET_SR = 11025
const PITCH_FRAME_MS = 40
const PITCH_HOP_MS = 20
const VOICING_THRESHOLD = 0.35

const SEGMENT_FRAME_MS = 20
const SEGMENT_MIN_SILENCE_MS = 150
const SEGMENT_MIN_DURATION_MS = 90
const SEGMENT_SILENCE_RATIO = 0.12

const MADD_CUT_SHORT_RATIO = 0.7

const GHUNNAH_LOW_HZ = 150
const GHUNNAH_LOW_HI_HZ = 1200
const GHUNNAH_HIGH_HI_HZ = 4000
const GHUNNAH_DELTA_FLAG = 0.3

function clamp01(x) {
  return Math.max(0, Math.min(1, x))
}

function clampScore(x) {
  if (!Number.isFinite(x)) return 0
  return Math.round(Math.max(0, Math.min(100, x)))
}

function average(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
}

function resampleLinear(arr, n) {
  const len = arr.length
  if (!len) return new Array(n).fill(0)
  if (len === 1) return new Array(n).fill(arr[0])
  const out = new Array(n)
  for (let i = 0; i < n; i += 1) {
    const t = (i / (n - 1)) * (len - 1)
    const lo = Math.floor(t)
    const hi = Math.min(len - 1, lo + 1)
    const frac = t - lo
    out[i] = arr[lo] * (1 - frac) + arr[hi] * frac
  }
  return out
}

function decimate(channelData, factor) {
  if (factor <= 1) return channelData
  const outLen = Math.floor(channelData.length / factor)
  const out = new Float32Array(outLen)
  for (let i = 0; i < outLen; i += 1) {
    out[i] = channelData[i * factor]
  }
  return out
}

/**
 * Per-frame F0 (pitch) contour via normalized autocorrelation.
 * The signal is decimated toward ~11kHz first since vocal pitch is well under
 * its Nyquist and this keeps the autocorrelation search cheap.
 */
export function computeF0Contour(channelData, sampleRate) {
  const factor = Math.max(1, Math.round(sampleRate / PITCH_TARGET_SR))
  const signal = decimate(channelData, factor)
  const sr = sampleRate / factor

  const frameSize = Math.max(64, Math.round((PITCH_FRAME_MS / 1000) * sr))
  const hopSize = Math.max(32, Math.round((PITCH_HOP_MS / 1000) * sr))
  const minLag = Math.max(1, Math.floor(sr / PITCH_MAX_HZ))
  const maxLag = Math.min(frameSize - 1, Math.ceil(sr / PITCH_MIN_HZ))

  const times = []
  const hz = []

  if (signal.length < frameSize || minLag >= maxLag) {
    return { times, hz, sampleRate: sr }
  }

  for (let start = 0; start + frameSize <= signal.length; start += hopSize) {
    let r0 = 0
    for (let i = 0; i < frameSize; i += 1) {
      const v = signal[start + i]
      r0 += v * v
    }

    let bestLag = -1
    let bestCorr = 0
    if (r0 > 1e-6) {
      for (let lag = minLag; lag <= maxLag; lag += 1) {
        let corr = 0
        for (let i = 0; i < frameSize - lag; i += 1) {
          corr += signal[start + i] * signal[start + i + lag]
        }
        if (corr > bestCorr) {
          bestCorr = corr
          bestLag = lag
        }
      }
    }

    const normalized = r0 > 1e-6 ? bestCorr / r0 : 0
    times.push((start + frameSize / 2) / sr)
    hz.push(bestLag > 0 && normalized >= VOICING_THRESHOLD ? sr / bestLag : 0)
  }

  return { times, hz, sampleRate: sr }
}

/**
 * Aligns two F0 contours to a common number of time steps and correlates the
 * frames where both recordings are voiced.
 */
export function pitchSimilarityScore(refF0, studentF0, steps = 100) {
  const refResampled = resampleLinear(refF0.hz, steps)
  const studentResampled = resampleLinear(studentF0.hz, steps)

  const refVoiced = []
  const studentVoiced = []
  for (let i = 0; i < steps; i += 1) {
    if (refResampled[i] > 0 && studentResampled[i] > 0) {
      refVoiced.push(refResampled[i])
      studentVoiced.push(studentResampled[i])
    }
  }

  if (refVoiced.length < 8) {
    return { score: 0, voicedOverlap: refVoiced.length, insufficientData: true }
  }

  const corr = pearson(refVoiced, studentVoiced)
  return {
    score: clampScore(((corr + 1) / 2) * 100),
    voicedOverlap: refVoiced.length,
    insufficientData: false,
  }
}

/**
 * Silence-thresholded segment (word/phrase) detection on the RMS envelope.
 * Returns {start, end} spans in seconds.
 */
export function detectSegments(channelData, sampleRate) {
  const frameSize = Math.max(32, Math.round((SEGMENT_FRAME_MS / 1000) * sampleRate))
  const frames = []
  for (let start = 0; start < channelData.length; start += frameSize) {
    const end = Math.min(channelData.length, start + frameSize)
    let sum = 0
    for (let i = start; i < end; i += 1) {
      const v = channelData[i]
      sum += v * v
    }
    frames.push(Math.sqrt(sum / Math.max(1, end - start)))
  }

  let peak = 1e-8
  for (const v of frames) if (v > peak) peak = v
  const threshold = peak * SEGMENT_SILENCE_RATIO
  const frameSec = frameSize / sampleRate

  const minSilenceFrames = Math.max(1, Math.round(SEGMENT_MIN_SILENCE_MS / 1000 / frameSec))
  const minDurationFrames = Math.max(1, Math.round(SEGMENT_MIN_DURATION_MS / 1000 / frameSec))

  const voiced = frames.map((v) => v > threshold)

  // Bridge silences shorter than the minimum waqf length so a short dip
  // inside a word doesn't split it into two segments.
  let i = 0
  while (i < voiced.length) {
    if (!voiced[i]) {
      let j = i
      while (j < voiced.length && !voiced[j]) j += 1
      if (j - i < minSilenceFrames && i > 0 && j < voiced.length) {
        for (let k = i; k < j; k += 1) voiced[k] = true
      }
      i = j
    } else {
      i += 1
    }
  }

  const segments = []
  i = 0
  while (i < voiced.length) {
    if (voiced[i]) {
      let j = i
      while (j < voiced.length && voiced[j]) j += 1
      if (j - i >= minDurationFrames) {
        segments.push({ start: i * frameSec, end: j * frameSec })
      }
      i = j
    } else {
      i += 1
    }
  }

  return segments
}

/** Gaps between consecutive segments — candidate waqf/pause spans. */
export function silencesFromSegments(segments) {
  const silences = []
  for (let i = 0; i < segments.length - 1; i += 1) {
    const start = segments[i].end
    const end = segments[i + 1].start
    if (end > start) silences.push({ start, end, duration: end - start })
  }
  return silences
}

function coefficientOfVariation(values) {
  const n = values.length
  if (n < 2) return 0
  const mean = average(values)
  if (mean <= 1e-6) return 0
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n
  return Math.sqrt(variance) / mean
}

/**
 * Compares how consistent the practice pacing is against the reference's own
 * pacing consistency (not just "lower variance is better" — a reference with
 * naturally long madd words can have high variance too).
 */
export function paceConsistencyScore(refSegments, studentSegments) {
  const covRef = coefficientOfVariation(refSegments.map((s) => s.end - s.start))
  const covStudent = coefficientOfVariation(studentSegments.map((s) => s.end - s.start))
  const tolerance = Math.max(0.15, covRef)
  const score = clampScore((1 - clamp01(Math.abs(covStudent - covRef) / tolerance)) * 100)
  return { score, covRef, covStudent }
}

/** Compares pause/waqf count and average duration between recordings. */
export function pauseAccuracyScore(refSilences, studentSilences) {
  const countRef = refSilences.length
  const countStudent = studentSilences.length
  const avgRef = average(refSilences.map((s) => s.duration))
  const avgStudent = average(studentSilences.map((s) => s.duration))

  const countScore =
    countRef === 0 && countStudent === 0
      ? 1
      : 1 - clamp01(Math.abs(countStudent - countRef) / Math.max(countRef, 1))
  const durationScore =
    avgRef === 0 ? (avgStudent === 0 ? 1 : 0) : 1 - clamp01(Math.abs(avgStudent - avgRef) / Math.max(avgRef, 0.05))

  return {
    score: clampScore(((countScore + durationScore) / 2) * 100),
    countRef,
    countStudent,
    avgRef,
    avgStudent,
  }
}

/**
 * Aligns reference/practice segments by index (simple heuristic — silence
 * detection should keep word order intact) and computes a duration ratio per
 * segment, flagging likely cut-short madd (elongation).
 */
export function segmentDurationTable(refSegments, studentSegments) {
  const n = Math.min(refSegments.length, studentSegments.length)
  const rows = []
  for (let i = 0; i < n; i += 1) {
    const ref = refSegments[i]
    const student = studentSegments[i]
    const refDuration = ref.end - ref.start
    const studentDuration = student.end - student.start
    const ratio = refDuration > 0 ? studentDuration / refDuration : 1
    rows.push({
      index: i,
      refStart: ref.start,
      refEnd: ref.end,
      refDuration,
      studentStart: student.start,
      studentEnd: student.end,
      studentDuration,
      ratio,
      cutShortMadd: ratio < MADD_CUT_SHORT_RATIO,
      matchScore: clampScore((1 - clamp01(Math.abs(ratio - 1))) * 100),
    })
  }
  return {
    rows,
    countMismatch: refSegments.length !== studentSegments.length,
    refCount: refSegments.length,
    studentCount: studentSegments.length,
  }
}

export function maddLengthScore(table) {
  if (!table.rows.length) return 0
  return clampScore(average(table.rows.map((r) => r.matchScore)))
}

/** Dynamic time warping between two numeric sequences (e.g. RMS envelopes). */
export function dtwDistance(a, b) {
  const n = a.length
  const m = b.length
  if (!n || !m) return { distance: 0, normalized: 0, pathLength: 0 }

  const width = m + 1
  const cost = new Float64Array((n + 1) * width).fill(Infinity)
  cost[0] = 0

  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const d = Math.abs(a[i - 1] - b[j - 1])
      const diag = cost[(i - 1) * width + (j - 1)]
      const up = cost[(i - 1) * width + j]
      const left = cost[i * width + (j - 1)]
      cost[i * width + j] = d + Math.min(diag, up, left)
    }
  }

  let i = n
  let j = m
  let pathLength = 0
  while (i > 0 || j > 0) {
    pathLength += 1
    if (i === 0) {
      j -= 1
    } else if (j === 0) {
      i -= 1
    } else {
      const diag = cost[(i - 1) * width + (j - 1)]
      const up = cost[(i - 1) * width + j]
      const left = cost[i * width + (j - 1)]
      if (diag <= up && diag <= left) {
        i -= 1
        j -= 1
      } else if (up <= left) {
        i -= 1
      } else {
        j -= 1
      }
    }
  }

  const distance = cost[n * width + m]
  return { distance, normalized: pathLength ? distance / pathLength : 0, pathLength }
}

/** Rhythm/length score: DTW between the two RMS envelopes, normalized to 0-100. */
export function dtwRhythmScore(refEnvelope, studentEnvelope) {
  const { normalized } = dtwDistance(refEnvelope, studentEnvelope)
  return { score: clampScore((1 - clamp01(normalized)) * 100), normalized }
}

function fftInPlace(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      const tr = re[i]
      re[i] = re[j]
      re[j] = tr
      const ti = im[i]
      im[i] = im[j]
      im[j] = ti
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const ang = -TWO_PI / len
    const wRe = Math.cos(ang)
    const wIm = Math.sin(ang)
    const half = len / 2
    for (let i = 0; i < n; i += len) {
      let curRe = 1
      let curIm = 0
      for (let k = 0; k < half; k += 1) {
        const uRe = re[i + k]
        const uIm = im[i + k]
        const vRe = re[i + k + half] * curRe - im[i + k + half] * curIm
        const vIm = re[i + k + half] * curIm + im[i + k + half] * curRe
        re[i + k] = uRe + vRe
        im[i + k] = uIm + vIm
        re[i + k + half] = uRe - vRe
        im[i + k + half] = uIm - vIm
        const nextRe = curRe * wRe - curIm * wIm
        const nextIm = curRe * wIm + curIm * wRe
        curRe = nextRe
        curIm = nextIm
      }
    }
  }
}

function hannWindow(size) {
  const w = new Float64Array(size)
  for (let i = 0; i < size; i += 1) {
    w[i] = 0.5 - 0.5 * Math.cos((TWO_PI * i) / (size - 1))
  }
  return w
}

/**
 * Short-time FFT spectrogram, log-magnitude per bin. `targetFrames` bounds
 * the number of columns (and therefore compute) regardless of clip length.
 */
export function computeSpectrogram(channelData, sampleRate, { fftSize = 1024, targetFrames = 220 } = {}) {
  const n = channelData.length
  if (n < fftSize) {
    return { frames: [], freqBinHz: sampleRate / fftSize, frameDuration: 0, fftSize, sampleRate }
  }

  const hop = Math.max(1, Math.floor((n - fftSize) / Math.max(1, targetFrames)))
  const window = hannWindow(fftSize)
  const numBins = fftSize / 2
  const frames = []

  for (let start = 0; start + fftSize <= n; start += hop) {
    const re = new Float64Array(fftSize)
    const im = new Float64Array(fftSize)
    for (let i = 0; i < fftSize; i += 1) {
      re[i] = channelData[start + i] * window[i]
    }
    fftInPlace(re, im)

    const magnitudes = new Float32Array(numBins)
    for (let k = 0; k < numBins; k += 1) {
      magnitudes[k] = Math.log10(Math.sqrt(re[k] * re[k] + im[k] * im[k]) + 1e-6)
    }
    frames.push(magnitudes)
  }

  return { frames, freqBinHz: sampleRate / fftSize, frameDuration: hop / sampleRate, fftSize, sampleRate }
}

function bandEnergy(magnitudes, freqBinHz, loHz, hiHz) {
  const loBin = Math.max(0, Math.floor(loHz / freqBinHz))
  const hiBin = Math.min(magnitudes.length - 1, Math.ceil(hiHz / freqBinHz))
  let sum = 0
  let count = 0
  for (let k = loBin; k <= hiBin; k += 1) {
    sum += 10 ** magnitudes[k]
    count += 1
  }
  return count ? sum / count : 0
}

/**
 * Experimental heuristic only: approximates nasal (ghunnah) resonance as the
 * ratio of low/mid-band spectral energy to upper-band energy. This is a
 * signal-processing proxy, not a tajweed judgment.
 */
export function ghunnahHeuristic(refSpectrogram, studentSpectrogram) {
  const ratioSeries = ({ frames, freqBinHz }) =>
    frames.map((mag) => {
      const low = bandEnergy(mag, freqBinHz, GHUNNAH_LOW_HZ, GHUNNAH_LOW_HI_HZ)
      const high = bandEnergy(mag, freqBinHz, GHUNNAH_LOW_HI_HZ, GHUNNAH_HIGH_HI_HZ)
      return high > 1e-9 ? low / high : 0
    })

  const refAvg = average(ratioSeries(refSpectrogram))
  const studentAvg = average(ratioSeries(studentSpectrogram))
  const deltaPct = refAvg > 0 ? ((studentAvg - refAvg) / refAvg) * 100 : 0

  return {
    refAvg,
    studentAvg,
    deltaPct,
    flagged: Math.abs(deltaPct) / 100 > GHUNNAH_DELTA_FLAG,
    note: 'Experimental heuristic based on spectral energy balance — not a tajweed judgment.',
  }
}

/**
 * Runs the full extended analysis on top of the existing envelope pipeline.
 * `refBuffer`/`studentBuffer` are the objects returned by decodeAudioBlob
 * (must include channelData).
 */
export function buildRecitationAnalysis(refBuffer, studentBuffer) {
  const refChannel = refBuffer.channelData
  const studentChannel = studentBuffer.channelData

  const refF0 = computeF0Contour(refChannel, refBuffer.sampleRate)
  const studentF0 = computeF0Contour(studentChannel, studentBuffer.sampleRate)
  const pitch = pitchSimilarityScore(refF0, studentF0)

  const refSegments = detectSegments(refChannel, refBuffer.sampleRate)
  const studentSegments = detectSegments(studentChannel, studentBuffer.sampleRate)
  const refSilences = silencesFromSegments(refSegments)
  const studentSilences = silencesFromSegments(studentSegments)

  const pace = paceConsistencyScore(refSegments, studentSegments)
  const pause = pauseAccuracyScore(refSilences, studentSilences)

  const durationTable = segmentDurationTable(refSegments, studentSegments)
  const maddScore = maddLengthScore(durationTable)

  const rhythm = dtwRhythmScore(refBuffer.envelope, studentBuffer.envelope)

  const refSpectrogram = computeSpectrogram(refChannel, refBuffer.sampleRate)
  const studentSpectrogram = computeSpectrogram(studentChannel, studentBuffer.sampleRate)
  const ghunnah = ghunnahHeuristic(refSpectrogram, studentSpectrogram)

  const pauseCountDiff = pause.countStudent - pause.countRef
  const pausePlacementNote =
    Math.abs(pauseCountDiff) >= 2
      ? `${Math.abs(pauseCountDiff)} ${pauseCountDiff > 0 ? 'more' : 'fewer'} pause(s) than the reference — check for an added or missed waqf.`
      : 'Pause count is close to the reference.'

  const components = {
    pitch: pitch.score,
    pace: pace.score,
    pause: pause.score,
    madd: maddScore,
    rhythm: rhythm.score,
  }
  const overallScore = clampScore(average(Object.values(components)))

  return {
    overallScore,
    components,
    pitch: { ...pitch, referenceContour: refF0, practiceContour: studentF0 },
    pace,
    pause: { ...pause, pausePlacementNote },
    durationTable,
    rhythm,
    spectrograms: { reference: refSpectrogram, practice: studentSpectrogram },
    ghunnah,
    segments: { reference: refSegments, practice: studentSegments },
  }
}
