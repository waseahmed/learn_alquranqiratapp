import { useCallback, useEffect, useRef, useState } from 'react'
import { getAyahAudioUrl } from '../../services/audioService'

const MAX_LOOPS = 5

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatRate(rate) {
  if (rate == null) return '1×'
  const rounded = Math.round(Number(rate) * 100) / 100
  return `${rounded}×`
}

function rateMatches(a, b) {
  return Math.abs(Number(a) - Number(b)) < 0.01
}

export default function QariCard({
  qari,
  surah,
  ayah,
  isPlaying,
  playbackRate = null,
  slowRate = null,
  unavailable,
  loopCount = 1,
  onLoopChange,
  onReplay,
  onPlayToggle,
  onSlowToggle,
  onShadow,
  onAudioError,
  registerAudio,
}) {
  const audioRef = useRef(null)
  const src = getAyahAudioUrl(qari.key, surah, ayah)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [paused, setPaused] = useState(true)

  const bindAudio = useCallback(
    (node) => {
      audioRef.current = node
      registerAudio?.(qari.key, node)
    },
    [qari.key, registerAudio],
  )

  useEffect(() => {
    const el = audioRef.current
    if (!el) return undefined

    const sync = () => {
      setCurrent(el.currentTime || 0)
      setDuration(Number.isFinite(el.duration) ? el.duration : 0)
      setPaused(el.paused)
    }

    el.addEventListener('timeupdate', sync)
    el.addEventListener('durationchange', sync)
    el.addEventListener('loadedmetadata', sync)
    el.addEventListener('seeked', sync)
    el.addEventListener('play', sync)
    el.addEventListener('pause', sync)
    el.addEventListener('ended', sync)
    sync()

    return () => {
      el.removeEventListener('timeupdate', sync)
      el.removeEventListener('durationchange', sync)
      el.removeEventListener('loadedmetadata', sync)
      el.removeEventListener('seeked', sync)
      el.removeEventListener('play', sync)
      el.removeEventListener('pause', sync)
      el.removeEventListener('ended', sync)
    }
  }, [src, unavailable])

  useEffect(() => {
    const el = audioRef.current
    if (!el || paused) return undefined
    let raf
    const tick = () => {
      setCurrent(el.currentTime || 0)
      setDuration(Number.isFinite(el.duration) ? el.duration : 0)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [paused, src])

  function bumpLoop() {
    const next = loopCount >= MAX_LOOPS ? 1 : loopCount + 1
    onLoopChange?.(qari.key, next)
  }

  function togglePlay() {
    if (unavailable) return
    onPlayToggle?.(qari.key)
  }

  function seek(event) {
    const el = audioRef.current
    if (!el || !duration) return
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    el.currentTime = ratio * duration
    setCurrent(el.currentTime)
  }

  const pct = duration > 0 ? Math.min(100, (current / duration) * 100) : 0
  const badgeRate = isPlaying ? playbackRate ?? slowRate ?? 1 : null

  return (
    <article className={`card ${isPlaying ? 'playing' : ''}`}>
      <div className="card-head">
        <div className="card-head-row">
          <div className="qname">{qari.name}</div>
          {isPlaying && (
            <span className="playing-badge" aria-live="polite">
              Playing · {formatRate(badgeRate)}
            </span>
          )}
        </div>
        <div className="qstyle">{qari.style}</div>
      </div>
      <div className="card-body">
        <audio
          ref={bindAudio}
          preload="auto"
          src={unavailable ? undefined : src}
          onError={() => onAudioError(qari.key)}
        />
        {unavailable ? (
          <div className="audio-error" role="status">
            Audio unavailable for this ayah
          </div>
        ) : (
          <>
            <div className={`qari-player ${isPlaying || !paused ? 'on' : ''}`}>
              <button
                type="button"
                className="qari-player-toggle"
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? '❚❚' : '▶'}
              </button>
              <button
                type="button"
                className="qari-player-track"
                onClick={seek}
                aria-label="Seek"
              >
                <span className="qari-player-fill" style={{ width: `${pct}%` }} />
              </button>
              <span className="qari-player-time">
                {formatTime(current)} / {formatTime(duration)}
              </span>
            </div>
            <div className="card-actions">
              <button
                type="button"
                className="btn"
                onClick={() => onReplay(qari.key)}
              >
                ↻ Replay
              </button>
              <button
                type="button"
                className={`btn speed-toggle ${rateMatches(slowRate, 0.8) ? 'speed-on' : ''}`}
                onClick={() => onSlowToggle(qari.key, 0.8)}
                aria-pressed={rateMatches(slowRate, 0.8)}
                title={
                  rateMatches(slowRate, 0.8)
                    ? '0.8× is on — click to turn off'
                    : 'Play at 0.8× speed'
                }
              >
                0.8×
              </button>
              <button
                type="button"
                className={`btn speed-toggle ${rateMatches(slowRate, 0.5) ? 'speed-on' : ''}`}
                onClick={() => onSlowToggle(qari.key, 0.5)}
                aria-pressed={rateMatches(slowRate, 0.5)}
                title={
                  rateMatches(slowRate, 0.5)
                    ? '0.5× is on — click to turn off'
                    : 'Play at 0.5× speed'
                }
              >
                0.5×
              </button>
              <button type="button" className="btn" onClick={() => onShadow(qari.key)}>
                🎯 Shadow
              </button>
              <button
                type="button"
                className={`btn loop-btn ${loopCount > 1 ? 'on' : ''}`}
                onClick={bumpLoop}
                title="Click to increase how many times this qari plays. Cycles 1–5."
                aria-label={`Play ${loopCount} time${loopCount === 1 ? '' : 's'}. Click to increase.`}
              >
                🔁 ×{loopCount}
              </button>
            </div>
          </>
        )}
      </div>
    </article>
  )
}
