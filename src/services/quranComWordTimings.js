import { quranComRecitationIdForQari } from '../data/quranComReciters'

const API = 'https://api.quran.com/api/v4'
const chapterCache = new Map()

function cacheKey(recitationId, surah) {
  return `${recitationId}:${surah}`
}

async function fetchChapterTimestamps(recitationId, surah) {
  const key = cacheKey(recitationId, surah)
  if (chapterCache.has(key)) return chapterCache.get(key)

  const url = `${API}/chapter_recitations/${recitationId}/${surah}?segments=true`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Quran.com timings unavailable (${res.status})`)
  const json = await res.json()
  const timestamps = json?.audio_file?.timestamps || []
  chapterCache.set(key, timestamps)
  try {
    sessionStorage.setItem(`qcom-ts:${key}`, JSON.stringify(timestamps))
  } catch {
    /* quota */
  }
  return timestamps
}

function loadChapterFromSession(recitationId, surah) {
  try {
    const raw = sessionStorage.getItem(`qcom-ts:${cacheKey(recitationId, surah)}`)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * @returns {Promise<{
 *   source: 'quran.com',
 *   verseFromMs: number,
 *   verseToMs: number,
 *   durationMs: number,
 *   words: { position: number, startMs: number, endMs: number }[],
 * } | null>}
 */
export async function fetchAyahWordTimings(qariKey, surah, ayah) {
  const recitationId = quranComRecitationIdForQari(qariKey)
  if (!recitationId) return null

  let timestamps = loadChapterFromSession(recitationId, surah)
  if (!timestamps) {
    try {
      timestamps = await fetchChapterTimestamps(recitationId, surah)
    } catch {
      return null
    }
  }

  const verseKey = `${surah}:${ayah}`
  const verse = timestamps.find((t) => t.verse_key === verseKey)
  if (!verse?.segments?.length) return null

  const verseFrom = verse.timestamp_from ?? 0
  const verseTo = verse.timestamp_to ?? verseFrom
  const durationMs = Math.max(1, verseTo - verseFrom)

  const words = []
  for (const seg of verse.segments) {
    const [position, startMs, endMs] = seg
    if (startMs == null || endMs == null) continue
    words.push({
      position,
      startMs: Math.max(0, startMs - verseFrom),
      endMs: Math.max(0, endMs - verseFrom),
    })
  }
  words.sort((a, b) => a.position - b.position)

  if (!words.length) return null

  return {
    source: 'quran.com',
    verseFromMs: verseFrom,
    verseToMs: verseTo,
    durationMs,
    words,
  }
}

export function wordStartFractionsFromTimings(timings) {
  const { words, durationMs } = timings
  const n = words.length
  const starts = new Array(n + 1).fill(0)
  for (let i = 0; i < n; i += 1) {
    starts[i] = words[i].startMs / durationMs
  }
  starts[n] = 1
  let prev = 0
  for (let i = 0; i <= n; i += 1) {
    starts[i] = Math.max(starts[i], prev)
    prev = Math.max(prev, starts[i] + 0.0001)
  }
  starts[n] = 1
  return starts
}

export function activeWordIndexFromTimings(currentTimeSec, timings, durationSec) {
  if (!timings?.words?.length) return -1
  const ms = Math.max(0, currentTimeSec * 1000)
  const { words, durationMs } = timings
  for (let i = 0; i < words.length; i += 1) {
    if (ms < words[i].endMs) return i
  }
  if (ms >= durationMs * 0.98) return words.length - 1
  return words.length - 1
}

/** Map Quran.com word count to app spoken-word count when close. */
export function timingsMatchWordCount(timings, spokenWordCount) {
  if (!timings?.words?.length || !spokenWordCount) return false
  const d = Math.abs(timings.words.length - spokenWordCount)
  return d <= 1
}