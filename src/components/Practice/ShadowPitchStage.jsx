import { useEffect, useRef } from 'react'
import { drawWaveformBars } from './shadowWaveformDraw'

const MIN_HZ = 70
const MAX_HZ = 500
const PITCH_STEPS = 120
const PAD_X = 24
const PAD_Y = 28

function resampleLinear(arr, n) {
  const len = arr.length
  if (!len) return []
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

function hzToLevel(h) {
  if (!h || h <= 0) return null
  const t = Math.max(0, Math.min(1, (h - MIN_HZ) / (MAX_HZ - MIN_HZ)))
  return t
}

function drawPitchPath(ctx, hzSeries, { width, height, padX, padY, color, lineWidth }) {
  const innerW = width - padX * 2
  const innerH = height - padY * 2
  const pitchTop = padY + 6
  const pitchH = innerH * 0.42
  const resampled = resampleLinear(hzSeries, PITCH_STEPS)
  const stepX = innerW / Math.max(1, PITCH_STEPS - 1)

  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineJoin = 'round'
  ctx.beginPath()
  let started = false
  for (let i = 0; i < resampled.length; i += 1) {
    const level = hzToLevel(resampled[i])
    const x = padX + i * stepX
    if (level == null) {
      started = false
      continue
    }
    const y = pitchTop + pitchH - level * pitchH
    if (!started) {
      ctx.moveTo(x, y)
      started = true
    } else {
      ctx.lineTo(x, y)
    }
  }
  ctx.stroke()
}

/**
 * Reciter waveform (amplitude), melody line (pitch), and synced playhead.
 */
export default function ShadowPitchStage({
  envelope = [],
  referenceHz = [],
  practiceHz = [],
  playProgress = 0,
  isPlaying = false,
  words = [],
  loading = false,
  waveReady = false,
  rangeHighlight = null,
}) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth || 720
    const height = canvas.clientHeight || 300
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    ctx.fillStyle = '#fbfdf9'
    ctx.fillRect(0, 0, width, height)

    ctx.strokeStyle = 'rgba(30, 96, 57, 0.07)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 8; i += 1) {
      const y = PAD_Y + ((height - PAD_Y * 2) / 8) * i
      ctx.beginPath()
      ctx.moveTo(PAD_X, y)
      ctx.lineTo(width - PAD_X, y)
      ctx.stroke()
    }

    if (waveReady && envelope.length) {
      drawWaveformBars(ctx, envelope, {
        x: PAD_X,
        y: PAD_Y,
        width: width - PAD_X * 2,
        height: height - PAD_Y * 2,
        playProgress,
      })

      drawPitchPath(ctx, referenceHz, {
        width,
        height,
        padX: PAD_X,
        padY: PAD_Y,
        color: 'rgba(30, 96, 57, 0.35)',
        lineWidth: 1.25,
      })
      drawPitchPath(ctx, referenceHz, {
        width,
        height,
        padX: PAD_X,
        padY: PAD_Y,
        color: 'rgba(30, 96, 57, 0.92)',
        lineWidth: 2.75,
      })

      if (practiceHz.length) {
        drawPitchPath(ctx, practiceHz, {
          width,
          height,
          padX: PAD_X,
          padY: PAD_Y,
          color: 'rgba(201, 147, 52, 0.9)',
          lineWidth: 2,
        })
      }
    } else if (!loading) {
      ctx.fillStyle = 'rgba(51, 73, 44, 0.55)'
      ctx.font = '15px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(
        'Waveform not available yet — press ▶ Hear him to listen.',
        width / 2,
        height / 2 - 8,
      )
      ctx.font = '13px system-ui, sans-serif'
      ctx.fillStyle = 'rgba(51, 73, 44, 0.4)'
      ctx.fillText(
        '(Enable CORS on the audio CDN for the full reciter waveform.)',
        width / 2,
        height / 2 + 16,
      )
      ctx.textAlign = 'left'
    }

    if (isPlaying || playProgress > 0) {
      const innerW = width - PAD_X * 2
      const playX = PAD_X + playProgress * innerW
      ctx.strokeStyle = 'rgba(201, 147, 52, 0.95)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(playX, PAD_Y)
      ctx.lineTo(playX, height - PAD_Y + 4)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(playX, PAD_Y - 2, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#c99334'
      ctx.fill()
    }

    if (rangeHighlight && waveReady) {
      const innerW = width - PAD_X * 2
      const x0 = PAD_X + rangeHighlight.startFrac * innerW
      const x1 = PAD_X + rangeHighlight.endFrac * innerW
      ctx.fillStyle = 'rgba(201, 147, 52, 0.12)'
      ctx.fillRect(x0, PAD_Y, Math.max(2, x1 - x0), height - PAD_Y * 2)
      ctx.strokeStyle = 'rgba(201, 147, 52, 0.55)'
      ctx.lineWidth = 1.5
      ctx.strokeRect(x0 + 0.5, PAD_Y + 0.5, Math.max(2, x1 - x0) - 1, height - PAD_Y * 2 - 1)
    }

    if (words.length > 1 && waveReady) {
      const innerW = width - PAD_X * 2
      const stepW = innerW / words.length
      ctx.strokeStyle = 'rgba(30, 96, 57, 0.15)'
      ctx.setLineDash([3, 4])
      for (let i = 1; i < words.length; i += 1) {
        const x = PAD_X + stepW * i
        ctx.beginPath()
        ctx.moveTo(x, PAD_Y)
        ctx.lineTo(x, height - PAD_Y)
        ctx.stroke()
      }
      ctx.setLineDash([])
    }

    ctx.fillStyle = 'rgba(30, 96, 57, 0.55)'
    ctx.font = '600 11px system-ui, sans-serif'
    ctx.fillText('Melody', PAD_X, 16)
    ctx.textAlign = 'right'
    ctx.fillText('Amplitude', width - PAD_X, height - 6)
    ctx.textAlign = 'left'
  }, [
    envelope,
    referenceHz,
    practiceHz,
    playProgress,
    isPlaying,
    words,
    loading,
    waveReady,
    rangeHighlight,
  ])

  return (
    <div className="shadow-pitch-stage">
      <canvas
        ref={canvasRef}
        className="shadow-pitch-canvas"
        aria-label="Reciter waveform and melody guide"
      />
      {loading && (
        <p className="shadow-pitch-loading">Scanning recitation audio for waveform…</p>
      )}
    </div>
  )
}