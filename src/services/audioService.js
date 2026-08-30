import { AUDIO_BASE_URL } from '../config'

export function pad3(n) {
  return String(n).padStart(3, '0')
}

/**
 * Build ayah audio URL from AUDIO_BASE_URL (local or remote).
 * Example local:  /audio/recitations/mishary/001/001001.mp3
 * Example remote: https://audio.alquranqiratacademy.com/recitations/mishary/001/001001.mp3
 */
export function getAyahAudioUrl(qariKey, surahNumber, ayahNumber) {
  const surah = pad3(surahNumber)
  const ayah = pad3(ayahNumber)
  return `${AUDIO_BASE_URL}/${qariKey}/${surah}/${surah}${ayah}.mp3`
}

/**
 * Probe whether an MP3 is reachable without fully downloading it.
 */
export function probeAudioUrl(url) {
  return new Promise((resolve) => {
    const audio = new Audio()
    audio.preload = 'metadata'
    let settled = false

    const finish = (ok) => {
      if (settled) return
      settled = true
      audio.removeAttribute('src')
      audio.load()
      resolve(ok)
    }

    audio.addEventListener('loadedmetadata', () => finish(true), { once: true })
    audio.addEventListener('canplaythrough', () => finish(true), { once: true })
    audio.addEventListener('error', () => finish(false), { once: true })
    setTimeout(() => finish(false), 8000)
    audio.src = url
  })
}
