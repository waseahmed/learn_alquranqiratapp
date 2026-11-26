import { useEffect, useRef } from 'react'

const MIN_HZ = 70
const MAX_HZ = 500
const STEPS = 96
const LEVELS = 8

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

function quantizeSteps(hzSeries) {
  return hzSeries.map((h) => {
    if (!h || h <= 0) return null
    const t = Math.max(0, Math.min(1, (h - MIN_HZ) / (MAX_HZ - MIN_HZ)))
    return Math.round(t * (LEVELS - 1)) / (LEVELS - 1)
  })
}

function drawSteppedContour(ctx, levels, { width, height, color, lineWidth = 3 }) {
  if (!levels.length) return
  const padX = 28
  const padY = 22
  const innerW = width - padX * 2
  const innerH = height - padY * 2
  const stepW = innerW / Math.max(1, levels.length - 1)

  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineJoin = 'round'
  ctx.beginPath()

  let started = false
  let lastX = padX
  let lastY = null

  for (let i = 0; i < levels.length; i += 1) {
    const level = levels[i]
    const x = padX + i * stepW
    if (level == null) {
      started = false
      lastY = null
      continue
    }
    const y = padY + innerH - level * innerH
    if (!started) {
      ctx.moveTo(x, y)
      started = true
      lastX = x
      lastY = y
    } else {
      ctx.lineTo(x, lastY)
      ctx.lineTo(x, y)
      lastX = x
      lastY = y
    }
  }
  ctx.stroke()
}

function drawSmoothContour(ctx, levels, { width, height, color, lineWidth = 1.25 }) {
  if (!levels.length) return
  const padX = 28
  const padY = 22
  const innerW = width - padX * 2
  const innerH = height - padY * 2
  const stepW = innerW / Math.max(1, levels.length - 1)

  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  let started = false
  for (let i = 0; i < levels.length; i += 1) {
    const level = levels[i]
    if (level == null) {
      started = false
      continue
    }
    const x = padX + i * stepW
    const y = padY + innerH - level * innerH
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
 * Dark-theme stepped pitch path (reference) with optional student overlay.
 */
export default function ShadowPitchStage({
  referenceHz = [],
  practiceHz = [],
  words = [],
  loading = false,
}) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth || 720
    const height = canvas.clientHeight || 280
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    ctx.fillStyle = '#fbfdf9'
    ctx.fillRect(0, 0, width, height)

    ctx.strokeStyle = 'rgba(30, 96, 57, 0.08)'
    ctx.lineWidth = 1
    for (let row = 0; row <= LEVELS; row += 1) {
      const y = 22 + ((height - 44) / LEVELS) * row
      ctx.beginPath()
      ctx.moveTo(28, y)
      ctx.lineTo(width - 28, y)
      ctx.stroke()
    }

    const refLevels = quantizeSteps(resampleLinear(referenceHz, STEPS))
    const practiceLevels =
      practiceHz.length > 0 ? quantizeSteps(resampleLinear(practiceHz, STEPS)) : []

    drawSmoothContour(ctx, refLevels, {
      width,
      height,
      color: 'rgba(30, 96, 57, 0.25)',
      lineWidth: 1.5,
    })
    drawSteppedContour(ctx, refLevels, {
      width,
      height,
      color: 'rgba(30, 96, 57, 0.9)',
      lineWidth: 3.5,
    })

    if (practiceLevels.length) {
      drawSmoothContour(ctx, practiceLevels, {
        width,
        height,
        color: 'rgba(201, 147, 52, 0.85)',
        lineWidth: 2,
      })
    }

    ctx.fillStyle = 'rgba(30, 96, 57, 0.65)'
    ctx.font = '600 11px system-ui, sans-serif'
    ctx.fillText('home', 32, height - 8)
    ctx.textAlign = 'right'
    ctx.fillText('Reciter', width - 32, height - 8)
    ctx.textAlign = 'left'

    if (words.length > 1) {
      const padX = 28
      const innerW = width - padX * 2
      const stepW = innerW / words.length
      ctx.fillStyle = 'rgba(51, 73, 44, 0.45)'
      ctx.font = '11px system-ui'
      words.forEach((w, i) => {
        const cx = padX + stepW * i + stepW / 2
        ctx.textAlign = 'center'
        ctx.fillText(w, cx, 14)
      })
    }
  }, [referenceHz, practiceHz, words, loading])

  return (
    <div className="shadow-pitch-stage">
      <canvas
        ref={canvasRef}
        className="shadow-pitch-canvas"
        aria-label="Pitch contour for shadow practice"
      />
      {loading && <p className="shadow-pitch-loading">Building waveform from reciter…</p>}
    </div>
  )
}