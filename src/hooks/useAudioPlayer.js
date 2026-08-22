import { useCallback, useEffect, useRef, useState } from 'react'
import { getAyahAudioUrl } from '../services/audioService'

/**
 * Shared audio playback for Qari sequence, replay, slow, and shadow mode.
 */
export function useAudioPlayer() {
  const audioRef = useRef(null)
  const stopFlag = useRef(false)
  const [currentlyPlayingQari, setCurrentlyPlayingQari] = useState(null)
  const [isPlayingSequence, setIsPlayingSequence] = useState(false)
  const [unavailable, setUnavailable] = useState({})

  const markUnavailable = useCallback((qariKey, surah, ayah) => {
    const id = `${qariKey}:${surah}:${ayah}`
    setUnavailable((prev) => (prev[id] ? prev : { ...prev, [id]: true }))
  }, [])

  const isUnavailable = useCallback(
    (qariKey, surah, ayah) => Boolean(unavailable[`${qariKey}:${surah}:${ayah}`]),
    [unavailable],
  )

  const stop = useCallback(() => {
    stopFlag.current = true
    setIsPlayingSequence(false)
    setCurrentlyPlayingQari(null)
    const a = audioRef.current
    if (a) {
      a.pause()
      a.removeAttribute('src')
      a.load()
    }
  }, [])

  useEffect(() => () => stop(), [stop])

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.preload = 'none'
    }
    return audioRef.current
  }, [])

  const playOnce = useCallback(
    (qariKey, surah, ayah, rate = 1) =>
      new Promise((resolve) => {
        if (isUnavailable(qariKey, surah, ayah)) {
          resolve({ ok: false, reason: 'unavailable' })
          return
        }

        const audio = ensureAudio()
        const url = getAyahAudioUrl(qariKey, surah, ayah)
        stopFlag.current = false

        const cleanup = () => {
          audio.removeEventListener('ended', onEnded)
          audio.removeEventListener('error', onError)
          clearInterval(poll)
        }

        const onEnded = () => {
          cleanup()
          setCurrentlyPlayingQari(null)
          resolve({ ok: true })
        }

        const onError = () => {
          cleanup()
          markUnavailable(qariKey, surah, ayah)
          setCurrentlyPlayingQari(null)
          resolve({ ok: false, reason: 'error' })
        }

        const poll = setInterval(() => {
          if (stopFlag.current) {
            cleanup()
            audio.pause()
            setCurrentlyPlayingQari(null)
            resolve({ ok: false, reason: 'stopped' })
          }
        }, 120)

        audio.addEventListener('ended', onEnded)
        audio.addEventListener('error', onError)
        audio.src = url
        audio.playbackRate = rate
        setCurrentlyPlayingQari(qariKey)
        audio.play().catch(() => {
          cleanup()
          markUnavailable(qariKey, surah, ayah)
          setCurrentlyPlayingQari(null)
          resolve({ ok: false, reason: 'error' })
        })
      }),
    [ensureAudio, isUnavailable, markUnavailable],
  )

  const playSequence = useCallback(
    async (qariKeys, surah, ayah) => {
      stopFlag.current = false
      setIsPlayingSequence(true)
      for (const key of qariKeys) {
        if (stopFlag.current) break
        if (isUnavailable(key, surah, ayah)) continue
        const result = await playOnce(key, surah, ayah, 1)
        if (result.reason === 'stopped') break
      }
      setIsPlayingSequence(false)
      setCurrentlyPlayingQari(null)
    },
    [isUnavailable, playOnce],
  )

  const setPlayingQari = useCallback((key) => {
    setCurrentlyPlayingQari(key)
  }, [])

  return {
    currentlyPlayingQari,
    isPlayingSequence,
    isUnavailable,
    markUnavailable,
    playOnce,
    playSequence,
    setPlayingQari,
    stop,
  }
}
