const MAX_POINTS = 240

function rmsEnvelope(channelData, points = MAX_POINTS) {
  const len = channelData.length
  if (!len) return []
  const block = Math.max(1, Math.floor(len / points))
  const envelope = []
  for (let i = 0; i < points; i += 1) {
    const start = i * block
    const end = Math.min(len, start + block)
    let sum = 0
    for (let j = start; j < end; j += 1) {
      const v = channelData[j]
      sum += v * v
    }
    envelope.push(Math.sqrt(sum / Math.max(1, end - start)))
  }
  const peak = Math.max(...envelope, 1e-8)
  return envelope.map((v) => v / peak)
}

function pearson(a, b) {
  const n = Math.min(a.length, b.length)
  if (n < 4) return 0
  let sumA = 0
  let sumB = 0
  for (let i = 0; i < n; i += 1) {
    sumA += a[i]
    sumB += b[i]
  }
  const meanA = sumA / n
  const meanB = sumB / n
  let num = 0
  let denA = 0
  let denB = 0
  for (let i = 0; i < n; i += 1) {
    const da = a[i] - meanA
    const db = b[i] - meanB
    num += da * db
    denA += da * da
    denB += db * db
  }
  const den = Math.sqrt(denA * denB)
  if (!den) return 0
  return Math.max(-1, Math.min(1, num / den))
}

function findDifferenceRegions(ref, student, threshold = 0.22) {
  const n = Math.min(ref.length, student.length)
  const regions = []
  let start = null
  for (let i = 0; i < n; i += 1) {
    const diff = Math.abs(ref[i] - student[i])
    if (diff >= threshold) {
      if (start == null) start = i
    } else if (start != null) {
      regions.push({ start, end: i - 1, strength: averageDiff(ref, student, start, i - 1) })
      start = null
    }
  }
  if (start != null) {
    regions.push({ start, end: n - 1, strength: averageDiff(ref, student, start, n - 1) })
  }
  return regions
    .filter((r) => r.end - r.start >= 2)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 6)
}

function averageDiff(a, b, start, end) {
  let sum = 0
  let count = 0
  for (let i = start; i <= end; i += 1) {
    sum += Math.abs(a[i] - b[i])
    count += 1
  }
  return count ? sum / count : 0
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '—'
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(1)
  return m > 0 ? `${m}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : `${s}s`
}

function buildTips({ durationRatio, similarity, regions }) {
  const tips = []
  if (durationRatio > 1.18) {
    tips.push('Your recording is longer than the reference — try shorter pauses or a slightly quicker flow.')
  } else if (durationRatio < 0.85) {
    tips.push('Your recording is shorter than the reference — stretch madd letters and keep pauses where the qari stops.')
  } else {
    tips.push('Overall length is close to the reference. Good pacing foundation.')
  }

  if (similarity >= 0.75) {
    tips.push('Energy shape matches well — focus on fine pitch and tajweed details next.')
  } else if (similarity >= 0.45) {
    tips.push('Rhythm is partly matching. Replay highlighted sections and shadow phrase-by-phrase.')
  } else {
    tips.push('Rhythm shape differs a lot. Break the ayah into short phrases and imitate one at a time.')
  }

  if (regions.length) {
    tips.push(
      `Highlighted zones mark where loudness/timing diverged most. Loop those spots: Qari → You → Qari.`,
    )
  } else {
    tips.push('No major loudness gaps found. Listen carefully for pitch rises and soft endings.')
  }

  return tips
}

/**
 * Decode a File/Blob into PCM + duration using Web Audio API.
 */
export async function decodeAudioBlob(blob) {
  const arrayBuffer = await blob.arrayBuffer()
  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  try {
    const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0))
    const channel = buffer.getChannelData(0)
    return {
      duration: buffer.duration,
      sampleRate: buffer.sampleRate,
      envelope: rmsEnvelope(channel),
    }
  } finally {
    await ctx.close().catch(() => {})
  }
}

/**
 * Compare reference vs student audio analyses.
 */
export function compareEnvelopes(refAnalysis, studentAnalysis) {
  const ref = refAnalysis.envelope
  const student = studentAnalysis.envelope
  const similarity = (pearson(ref, student) + 1) / 2
  const durationRatio = studentAnalysis.duration / Math.max(0.01, refAnalysis.duration)
  const regions = findDifferenceRegions(ref, student)
  const score = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        similarity * 70 + (1 - Math.min(1, Math.abs(durationRatio - 1) * 2)) * 30,
      ),
    ),
  )

  return {
    similarity,
    similarityPct: Math.round(similarity * 100),
    durationRatio,
    score,
    regions,
    tips: buildTips({ durationRatio, similarity, regions }),
    metrics: {
      referenceDuration: formatDuration(refAnalysis.duration),
      studentDuration: formatDuration(studentAnalysis.duration),
      durationDeltaSec: studentAnalysis.duration - refAnalysis.duration,
    },
  }
}

export { formatDuration }
