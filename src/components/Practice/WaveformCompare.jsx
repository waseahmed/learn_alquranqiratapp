import { useEffect, useRef } from 'react'

function drawTrack(ctx, envelope, { x0, y0, w, h, fillPlayed, fillRest, progress }) {
  if (!envelope.length) return
  const mid = y0 + h / 2
  const n = envelope.length
  const step = w / n
  const playIdx = Math.floor(Math.max(0, Math.min(1, progress)) * n)

  ctx.beginPath()
  for (let i = 0; i < n; i += 1) {
    const x = x0 + i * step + step / 2
    const amp = envelope[i] * (h / 2 - 4)
    if (i === 0) ctx.moveTo(x, mid - amp)
    else ctx.lineTo(x, mid - amp)
  }
  for (let i = n - 1; i >= 0; i -= 1) {
    const x = x0 + i * step + step / 2
    const amp = envelope[i] * (h / 2 - 4)
    ctx.lineTo(x, mid + amp)
  }
  ctx.closePath()
  ctx.fillStyle = fillRest
  ctx.fill()

  if (playIdx > 0) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(x0, y0, playIdx * step, h)
    ctx.clip()
    ctx.beginPath()
    for (let i = 0; i < n; i += 1) {
      const x = x0 + i * step + step / 2
      const amp = envelope[i] * (h / 2 - 4)
      if (i === 0) ctx.moveTo(x, mid - amp)
      else ctx.lineTo(x, mid - amp)
    }
    for (let i = n - 1; i >= 0; i -= 1) {
      const x = x0 + i * step + step / 2
      const amp = envelope[i] * (h / 2 - 4)
      ctx.lineTo(x, mid + amp)
    }
    ctx.closePath()
    ctx.fillStyle = fillPlayed
    ctx.fill()
    ctx.restore()
  }
}

/**
 * Dual-track waveform with animated playhead and played-region fill.
 */
export default function WaveformCompare({
  referenceEnvelope = [],
  studentEnvelope = [],
  regions = [],
  progress = 0,
  activeTrack = null,
}) {
  const canvasRef = useRef(null)
  const pulseRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth || 640
    const height = canvas.clientHeight || 220
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#fbfdf9'
    ctx.fillRect(0, 0, width, height)

    const pad = 10
    const gap = 10
    const trackH = (height - pad * 2 - gap) / 2
    const refY = pad
    const youY = pad + trackH + gap
    const n = Math.max(referenceEnvelope.length, studentEnvelope.length, 1)
    const step = width / n

    regions.forEach((r) => {
      const x = r.start * step
      const w = Math.max(step, (r.end - r.start + 1) * step)
      ctx.fillStyle = 'rgba(201, 147, 52, 0.16)'
      ctx.fillRect(x, pad, w, height - pad * 2)
    })

    ctx.fillStyle = activeTrack === 'ref' || activeTrack === 'ab-ref'
      ? 'rgba(30, 96, 57, 0.08)'
      : 'rgba(255,255,255,0.35)'
    ctx.fillRect(0, refY, width, trackH)
    ctx.fillStyle = activeTrack === 'you' || activeTrack === 'ab-you'
      ? 'rgba(201, 147, 52, 0.1)'
      : 'rgba(255,255,255,0.35)'
    ctx.fillRect(0, youY, width, trackH)

    const refProgress =
      activeTrack === 'ref' || activeTrack === 'ab-ref' ? progress : 0
    const youProgress =
      activeTrack === 'you' || activeTrack === 'ab-you' ? progress : 0

    drawTrack(ctx, referenceEnvelope, {
      x0: 0,
      y0: refY,
      w: width,
      h: trackH,
      fillRest: 'rgba(30, 96, 57, 0.22)',
      fillPlayed: 'rgba(30, 96, 57, 0.75)',
      progress: refProgress,
    })
    drawTrack(ctx, studentEnvelope, {
      x0: 0,
      y0: youY,
      w: width,
      h: trackH,
      fillRest: 'rgba(201, 147, 52, 0.22)',
      fillPlayed: 'rgba(201, 147, 52, 0.8)',
      progress: youProgress,
    })

    ctx.font = '600 11px Segoe UI, Tahoma, sans-serif'
    ctx.fillStyle = '#1e6039'
    ctx.fillText('Reference', 8, refY + 14)
    ctx.fillStyle = '#9a6f1f'
    ctx.fillText('Yours', 8, youY + 14)

    if (progress > 0 && progress <= 1 && activeTrack) {
      const x = progress * width
      pulseRef.current += 0.12
      const glow = 0.28 + Math.sin(pulseRef.current) * 0.18

      ctx.fillStyle = `rgba(25, 51, 34, ${glow})`
      ctx.fillRect(x - 7, pad, 14, height - pad * 2)

      ctx.strokeStyle = '#193322'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x, pad)
      ctx.lineTo(x, height - pad)
      ctx.stroke()

      const knobY =
        activeTrack === 'you' || activeTrack === 'ab-you'
          ? youY + trackH / 2
          : refY + trackH / 2
      ctx.beginPath()
      ctx.arc(x, knobY, 5.5 + Math.sin(pulseRef.current) * 1.1, 0, Math.PI * 2)
      ctx.fillStyle =
        activeTrack === 'you' || activeTrack === 'ab-you' ? '#c99334' : '#1e6039'
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
  }, [referenceEnvelope, studentEnvelope, regions, progress, activeTrack])

  const nowLabel =
    activeTrack === 'ref' || activeTrack === 'ab-ref'
      ? 'Now playing: Reference'
      : activeTrack === 'you' || activeTrack === 'ab-you'
        ? 'Now playing: Yours'
        : null

  return (
    <div className={`compare-wave-wrap ${activeTrack ? 'is-playing' : ''}`}>
      {nowLabel ? (
        <div className="compare-now-badge" aria-live="polite">
          <span className="compare-now-dot" />
          {nowLabel}
        </div>
      ) : null}
      <canvas ref={canvasRef} className="compare-wave" aria-label="Waveform comparison" />
      <div className="compare-wave-legend">
        <span className="legend-ref">Reference (qari)</span>
        <span className="legend-you">Your recording</span>
        <span className="legend-diff">Difference zone</span>
        <span className="legend-playhead">Moving line = current position</span>
      </div>
    </div>
  )
}
