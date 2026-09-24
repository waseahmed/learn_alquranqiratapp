import { useEffect, useRef } from 'react'

function lerp(a, b, t) {
  return a + (b - a) * t
}

/** Green (low diff) → gold (mid) → red (high), matching the app's brand tokens. */
function heatColor(t, alpha = 1) {
  const clamped = Math.max(0, Math.min(1, t))
  let r
  let g
  let b
  if (clamped < 0.5) {
    const k = clamped / 0.5
    r = lerp(30, 201, k)
    g = lerp(96, 147, k)
    b = lerp(57, 52, k)
  } else {
    const k = (clamped - 0.5) / 0.5
    r = lerp(201, 168, k)
    g = lerp(147, 73, k)
    b = lerp(52, 62, k)
  }
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`
}

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

function drawHeatStrip(ctx, diffSeries, { x0, y0, w, h }) {
  const n = diffSeries.length
  if (!n) return
  let maxDiff = 1e-6
  for (const v of diffSeries) if (v > maxDiff) maxDiff = v
  const step = w / n
  for (let i = 0; i < n; i += 1) {
    ctx.fillStyle = heatColor(diffSeries[i] / maxDiff, 0.9)
    ctx.fillRect(x0 + i * step, y0, Math.max(1, step), h)
  }
  return maxDiff
}

function draw(canvas, now, props) {
  const {
    referenceEnvelope,
    studentEnvelope,
    regions,
    diffSeries,
    progress,
    activeTrack,
    badgesOut,
  } = props

  const dpr = window.devicePixelRatio || 1
  const width = canvas.clientWidth || 640
  const height = canvas.clientHeight || 220
  const scaledW = Math.floor(width * dpr)
  const scaledH = Math.floor(height * dpr)
  if (canvas.width !== scaledW) canvas.width = scaledW
  if (canvas.height !== scaledH) canvas.height = scaledH
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#fbfdf9'
  ctx.fillRect(0, 0, width, height)

  const padTop = 22
  const padBottom = 10
  const gap = 8
  const heatH = diffSeries.length ? 14 : 0
  const trackH = (height - padTop - padBottom - gap * (diffSeries.length ? 2 : 1) - heatH) / 2
  const refY = padTop
  const heatY = refY + trackH + gap
  const youY = heatH ? heatY + heatH + gap : refY + trackH + gap
  const n = Math.max(referenceEnvelope.length, studentEnvelope.length, 1)
  const step = width / n

  if (diffSeries.length) drawHeatStrip(ctx, diffSeries, { x0: 0, y0: heatY, w: width, h: heatH })

  const slowPulse = 0.7 + 0.3 * Math.sin(now / 420)
  badgesOut.length = 0

  let maxStrength = 1e-6
  for (const r of regions) if (r.strength > maxStrength) maxStrength = r.strength

  regions.forEach((r, rank) => {
    const x = r.start * step
    const w = Math.max(step, (r.end - r.start + 1) * step)
    const t = r.strength / maxStrength
    ctx.fillStyle = heatColor(t, 0.16 + 0.22 * slowPulse)
    ctx.fillRect(x, padTop - 6, w, height - padTop - padBottom + 6)

    const cx = x + w / 2
    const cy = padTop - 10
    badgesOut.push({ x: cx, y: cy, r: 9, region: r, rank })
  })

  ctx.fillStyle =
    activeTrack === 'ref' || activeTrack === 'ab-ref' ? 'rgba(30, 96, 57, 0.08)' : 'rgba(255,255,255,0.35)'
  ctx.fillRect(0, refY, width, trackH)
  ctx.fillStyle =
    activeTrack === 'you' || activeTrack === 'ab-you' ? 'rgba(201, 147, 52, 0.1)' : 'rgba(255,255,255,0.35)'
  ctx.fillRect(0, youY, width, trackH)

  const refProgress = activeTrack === 'ref' || activeTrack === 'ab-ref' ? progress : 0
  const youProgress = activeTrack === 'you' || activeTrack === 'ab-you' ? progress : 0

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

  // Numbered, clickable badges over each difference zone (biggest = #1).
  badgesOut.forEach((b) => {
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
    ctx.fillStyle = heatColor(b.region.strength / maxStrength, 0.95)
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.font = '700 10px Segoe UI, Tahoma, sans-serif'
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(b.rank + 1), b.x, b.y + 0.5)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
  })

  ctx.font = '600 11px Segoe UI, Tahoma, sans-serif'
  ctx.fillStyle = '#1e6039'
  ctx.fillText('Reference', 8, refY + 14)
  ctx.fillStyle = '#9a6f1f'
  ctx.fillText('Yours', 8, youY + 14)

  if (progress > 0 && progress <= 1 && activeTrack) {
    const x = progress * width
    const glow = 0.28 + Math.sin(now / 160) * 0.18

    ctx.fillStyle = `rgba(25, 51, 34, ${glow})`
    ctx.fillRect(x - 7, padTop - 12, 14, height - padTop - padBottom + 12)

    ctx.strokeStyle = '#193322'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x, padTop - 12)
    ctx.lineTo(x, height - padBottom)
    ctx.stroke()

    const knobY = activeTrack === 'you' || activeTrack === 'ab-you' ? youY + trackH / 2 : refY + trackH / 2
    ctx.beginPath()
    ctx.arc(x, knobY, 5.5 + Math.sin(now / 160) * 1.1, 0, Math.PI * 2)
    ctx.fillStyle = activeTrack === 'you' || activeTrack === 'ab-you' ? '#c99334' : '#1e6039'
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
}

/**
 * Dual-track waveform with a per-point difference heat strip, breathing
 * gold/red zone highlights, numbered zone badges (click to loop that spot),
 * and an animated playhead.
 */
export default function WaveformCompare({
  referenceEnvelope = [],
  studentEnvelope = [],
  regions = [],
  diffSeries = [],
  progress = 0,
  activeTrack = null,
  onZoneClick = null,
}) {
  const canvasRef = useRef(null)
  const badgesRef = useRef([])
  const propsRef = useRef({})

  propsRef.current = {
    referenceEnvelope,
    studentEnvelope,
    regions,
    diffSeries,
    progress,
    activeTrack,
    badgesOut: badgesRef.current,
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    let raf
    const loop = (now) => {
      draw(canvas, now, propsRef.current)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  function handleClick(event) {
    if (!onZoneClick) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const hit = badgesRef.current.find((b) => Math.hypot(b.x - x, b.y - y) <= b.r + 5)
    if (hit) onZoneClick(hit.region, hit.rank)
  }

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
      <canvas
        ref={canvasRef}
        className={`compare-wave ${regions.length && onZoneClick ? 'is-clickable' : ''}`}
        aria-label="Waveform comparison"
        onClick={handleClick}
      />
      <div className="compare-wave-legend">
        <span className="legend-ref">Reference (qari)</span>
        <span className="legend-you">Your recording</span>
        <span className="legend-playhead">Moving line = current position</span>
      </div>
      <div className="compare-wave-legend compare-wave-legend-heat">
        <span className="legend-heat legend-heat-good" title="Green: this part matches well">
          Great match
        </span>
        <span className="legend-heat legend-heat-warn" title="Gold: a little different from the reference">
          A little different
        </span>
        <span className="legend-heat legend-heat-bad" title="Red: this part is the most different — practice it!">
          Try again
        </span>
        {regions.length && onZoneClick ? <span className="legend-tap">👆 Tap a number to hear it!</span> : null}
      </div>
    </div>
  )
}
