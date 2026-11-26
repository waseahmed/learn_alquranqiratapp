import { useEffect, useRef } from 'react'
import { drawWaveformBars } from './shadowWaveformDraw'

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

    const padX = 3
    const innerW = width - padX * 2
    drawWaveformBars(ctx, envelope, {
      x: padX,
      y: 2,
      width: innerW,
      height: height - 4,
      midRatio: 0.5,
      playProgress,
      palette: active
        ? {
            base: 'rgba(30, 96, 57, 0.5)',
            played: 'rgba(30, 96, 57, 0.95)',
            inactive: 'rgba(30, 96, 57, 0.22)',
          }
        : undefined,
    })

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