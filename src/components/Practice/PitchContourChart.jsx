import { useEffect, useRef } from 'react'

function clamp01(x) {
  return Math.max(0, Math.min(1, x))
}

function drawLine(ctx, values, { width, height, minHz, maxHz, color }) {
  const n = values.length
  if (!n) return
  ctx.beginPath()
  let started = false
  for (let i = 0; i < n; i += 1) {
    const v = values[i]
    const x = (i / Math.max(1, n - 1)) * width
    if (!v || v <= 0) {
      started = false
      continue
    }
    const t = clamp01((v - minHz) / (maxHz - minHz))
    const y = height - t * height
    if (!started) {
      ctx.moveTo(x, y)
      started = true
    } else {
      ctx.lineTo(x, y)
    }
  }
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.stroke()
}

/** Overlaid reference vs. practice F0 (pitch) contour line chart. */
export default function PitchContourChart({ referenceHz = [], practiceHz = [], minHz = 70, maxHz = 500 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth || 640
    const height = canvas.clientHeight || 160
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#fbfdf9'
    ctx.fillRect(0, 0, width, height)

    drawLine(ctx, referenceHz, { width, height, minHz, maxHz, color: 'rgba(30, 96, 57, 0.85)' })
    drawLine(ctx, practiceHz, { width, height, minHz, maxHz, color: 'rgba(201, 147, 52, 0.9)' })
  }, [referenceHz, practiceHz, minHz, maxHz])

  return (
    <div className="pitch-chart-wrap">
      <div className="reveal-wipe">
        <canvas ref={canvasRef} className="pitch-chart" aria-label="Pitch contour comparison" />
      </div>
      <div className="pitch-chart-legend">
        <span className="legend-ref">Reference pitch</span>
        <span className="legend-you">Your pitch</span>
      </div>
    </div>
  )
}
