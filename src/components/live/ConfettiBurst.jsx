import { useEffect, useRef } from 'react'

const COLORS = ['#1e6039', '#5d8f59', '#c99334', '#a8493e', '#193322', '#edf4e8']

function rand(min, max) {
  return Math.random() * (max - min) + min
}

/**
 * Lightweight canvas confetti (no extra dependencies).
 * @param {{ active: boolean; onDone?: () => void }} props
 */
export default function ConfettiBurst({ active, onDone }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!active) return undefined
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = rect.height
    const pieces = Array.from({ length: 80 }, () => ({
      x: w / 2 + rand(-40, 40),
      y: h * 0.35,
      vx: rand(-6, 6),
      vy: rand(-10, -4),
      rot: rand(0, Math.PI * 2),
      vr: rand(-0.2, 0.2),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: rand(6, 11),
    }))

    let frame = 0
    const maxFrames = 90
    let raf = 0

    function tick() {
      ctx.clearRect(0, 0, w, h)
      let alive = 0
      for (const p of pieces) {
        p.vy += 0.22
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr
        if (p.y < h + 20) alive += 1
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        ctx.restore()
      }
      frame += 1
      if (frame < maxFrames || alive > 0) {
        raf = requestAnimationFrame(tick)
      } else {
        ctx.clearRect(0, 0, w, h)
        onDone?.()
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, onDone])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      className="live-confetti-canvas"
      aria-hidden
    />
  )
}