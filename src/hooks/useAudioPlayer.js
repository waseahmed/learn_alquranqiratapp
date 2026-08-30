import { useCallback, useEffect, useRef, useState } from 'react'
import { getAyahAudioUrl } from '../services/audioService'

function srcMatches(audio, url) {
  if (!audio) return false
  if (audio.getAttribute('src') === url) return true
  if (!audio.src) return false
  try {
    return audio.src === new URL(url, window.location.href).href
  } catch {
    return audio.src.endsWith(url) || audio.src.includes(url)
  }
}

function waitEvent(el, eventName, { timeoutMs = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (fn) => (arg) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      el.removeEventListener(eventName, onEvent)
      el.removeEventListener('error', onError)
      fn(arg)
    }
    const onEvent = finish(resolve)
    const onError = finish(() => reject(new Error('audio error')))
    const timer = setTimeout(
      finish(() => reject(new Error('audio timeout'))),
      timeoutMs,
    )
    el.addEventListener(eventName, onEvent)
    el.addEventListener('error', onError)
  })
}

/**
 * Plays through the visible Qari card <audio> so the progress bar updates
 * on every loop. Falls back to a hidden Audio() if a card is not mounted.
 */
export function useAudioPlayer() {
  const fallbackRef = useRef(null)
  const nodesRef = useRef({})
  const stopFlag = useRef(false)
  const sessionRef = useRef(0)
  const [currentlyPlayingQari, setCurrentlyPlayingQari] = useState(null)
  const [playbackRate, setPlaybackRate] = useState(null)
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

  const pauseAll = useCallback(() => {
    Object.values(nodesRef.current).forEach((node) => {
      try {
        node.pause()
      } catch {
        /* ignore */
      }
    })
    if (fallbackRef.current) fallbackRef.current.pause()
  }, [])

  const stop = useCallback(() => {
    sessionRef.current += 1
    stopFlag.current = true
    setIsPlayingSequence(false)
    setCurrentlyPlayingQari(null)
    setPlaybackRate(null)
    pauseAll()
  }, [pauseAll])

  useEffect(() => () => stop(), [stop])

  const registerAudio = useCallback((qariKey, node) => {
    if (node) nodesRef.current[qariKey] = node
    else delete nodesRef.current[qariKey]
  }, [])

  const getNode = useCallback((qariKey) => {
    if (nodesRef.current[qariKey]) return nodesRef.current[qariKey]
    if (!fallbackRef.current) {
      const audio = new Audio()
      audio.preload = 'auto'
      fallbackRef.current = audio
    }
    return fallbackRef.current
  }, [])

  const playOnce = useCallback(
    async (
      qariKey,
      surah,
      ayah,
      rate = 1,
      { persistPlaying = false, continueSequence = false } = {},
    ) => {
      if (!continueSequence) stopFlag.current = false

      if (isUnavailable(qariKey, surah, ayah)) {
        return { ok: false, reason: 'unavailable' }
      }
      if (stopFlag.current) {
        return { ok: false, reason: 'stopped' }
      }

      const session = sessionRef.current
      const audio = getNode(qariKey)
      const url = getAyahAudioUrl(qariKey, surah, ayah)
      const isStale = () => session !== sessionRef.current || stopFlag.current

      pauseAll()

      try {
        if (!srcMatches(audio, url)) {
          audio.src = url
        }
        if (audio.readyState < 2) {
          const ready = waitEvent(audio, 'canplay')
          if (audio.readyState < 1) audio.load()
          await ready
        }

        if (isStale()) return { ok: false, reason: 'stopped' }

        if (audio.ended || audio.currentTime > 0.01) {
          const seeked = waitEvent(audio, 'seeked', { timeoutMs: 1500 }).catch(() => null)
          try {
            audio.currentTime = 0
          } catch {
            /* ignore */
          }
          await seeked
        }

        if (isStale()) return { ok: false, reason: 'stopped' }

        audio.playbackRate = rate
        setCurrentlyPlayingQari(qariKey)
        setPlaybackRate(rate)

        try {
          await audio.play()
        } catch (err) {
          if (err?.name === 'AbortError' || isStale()) {
            return { ok: false, reason: 'stopped' }
          }
          markUnavailable(qariKey, surah, ayah)
          if (!persistPlaying) {
            setCurrentlyPlayingQari(null)
            setPlaybackRate(null)
          }
          return { ok: false, reason: 'error' }
        }

        if (isStale()) {
          audio.pause()
          return { ok: false, reason: 'stopped' }
        }

        const result = await new Promise((resolve) => {
          let settled = false
          const finish = (value) => {
            if (settled) return
            settled = true
            audio.removeEventListener('ended', onEnded)
            audio.removeEventListener('error', onError)
            clearInterval(poll)
            resolve(value)
          }
          const onEnded = () => finish({ ok: true })
          const onError = () => {
            markUnavailable(qariKey, surah, ayah)
            finish({ ok: false, reason: 'error' })
          }
          const poll = setInterval(() => {
            if (isStale()) {
              audio.pause()
              finish({ ok: false, reason: 'stopped' })
            }
          }, 120)
          audio.addEventListener('ended', onEnded)
          audio.addEventListener('error', onError)
          if (audio.ended) finish({ ok: true })
        })

        if (!persistPlaying && result.reason !== 'stopped') {
          setCurrentlyPlayingQari(null)
          setPlaybackRate(null)
        }
        return result
      } catch {
        if (isStale()) return { ok: false, reason: 'stopped' }
        markUnavailable(qariKey, surah, ayah)
        if (!persistPlaying) {
          setCurrentlyPlayingQari(null)
          setPlaybackRate(null)
        }
        return { ok: false, reason: 'error' }
      }
    },
    [getNode, isUnavailable, markUnavailable, pauseAll],
  )

  const playRepeats = useCallback(
    async (qariKey, surah, ayah, rate = 1, times = 1, { continueSequence = false } = {}) => {
      if (!continueSequence) stopFlag.current = false
      const count = Math.max(1, Number(times) || 1)
      for (let i = 0; i < count; i += 1) {
        if (stopFlag.current) return { ok: false, reason: 'stopped' }
        const result = await playOnce(qariKey, surah, ayah, rate, {
          persistPlaying: i < count - 1,
          continueSequence: true,
        })
        if (!result.ok) return result
        if (i < count - 1 && !stopFlag.current) {
          await new Promise((r) => setTimeout(r, 180))
        }
      }
      return { ok: true }
    },
    [playOnce],
  )

  const playSequence = useCallback(
    async (qariKeys, surah, ayah, repeatsByKey = {}, rate = 1) => {
      stopFlag.current = false
      setIsPlayingSequence(true)
      for (const key of qariKeys) {
        if (stopFlag.current) break
        if (isUnavailable(key, surah, ayah)) continue
        const times = Math.max(1, Number(repeatsByKey[key]) || 1)
        const result = await playRepeats(key, surah, ayah, rate, times, {
          continueSequence: true,
        })
        if (result.reason === 'stopped') break
      }
      setIsPlayingSequence(false)
      setCurrentlyPlayingQari(null)
      setPlaybackRate(null)
    },
    [isUnavailable, playRepeats],
  )

  return {
    currentlyPlayingQari,
    playbackRate,
    isPlayingSequence,
    isUnavailable,
    markUnavailable,
    playOnce,
    playRepeats,
    playSequence,
    registerAudio,
    stop,
  }
}
