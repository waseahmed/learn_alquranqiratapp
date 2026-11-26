import { useEffect, useRef } from 'react'

export default function ShadowMiniWaveform({
  envelope = [],
  ready = false,
  loading = false,
  active = false,
  playProgress = 0,
  ariaLabel = 'Mini waveform',
}) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth || 160
    const height = canvas.clientHeight || 36
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    ctx.fillStyle = active ? '#f4f9f1' : '#faf8f3'
    ctx.fillRect(0, 0, width, height)
    ctx.strokeStyle = active ? 'rgba(30, 96, 57, 0.35)' : '#ebe4d4'
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1)

    const n = envelope.length
    if (!ready || !n) {
      ctx.fillStyle = 'rgba(51, 73, 44, 0.35)'
      ctx.font = '10px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(loading ? '…' : '—', width / 2, height / 2 + 3)
      ctx.textAlign = 'left'
      return
    }

    const midY = height * 0.55
    const ampH = height * 0.38
    const padX = 3
    const innerW = width - padX * 2
    const stepX = innerW / Math.max(1, n - 1)

    ctx.beginPath()
    for (let i = 0; i < n; i += 1) {
      const x = padX + i * stepX
      const y = midY - envelope[i] * ampH
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    for (let i = n - 1; i >= 0; i -= 1) {
      const x = padX + i * stepX
      ctx.lineTo(x, midY + envelope[i] * ampH * 0.7)
    }
    ctx.closePath()
    ctx.fillStyle = active ? 'rgba(30, 96, 57, 0.2)' : 'rgba(30, 96, 57, 0.12)'
    ctx.fill()
    ctx.strokeStyle = active ? 'rgba(30, 96, 57, 0.65)' : 'rgba(30, 96, 57, 0.4)'
    ctx.lineWidth = 1
    ctx.stroke()

    if (playProgress > 0.002) {
      const playX = padX + playProgress * innerW
      ctx.strokeStyle = '#c99334'
      ctx.lineWidth = 1.25
      ctx.beginPath()
      ctx.moveTo(playX, 2)
      ctx.lineTo(playX, height - 2)
      ctx.stroke()
    }
  }, [envelope, ready, loading, active, playProgress])

  return (
    <canvas
      ref={canvasRef}
      className="shadow-mini-wave"
      role="img"
      aria-label={ariaLabel}
    />
  )
}