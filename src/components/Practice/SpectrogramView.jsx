import { useEffect, useRef } from 'react'

const STOPS = [
  { t: 0, rgb: [13, 31, 20] },
  { t: 0.45, rgb: [30, 96, 57] },
  { t: 0.75, rgb: [201, 147, 52] },
  { t: 1, rgb: [253, 246, 227] },
]

function colorFor(t) {
  const clamped = Math.max(0, Math.min(1, t))
  let a = STOPS[0]
  let b = STOPS[STOPS.length - 1]
  for (let i = 0; i < STOPS.length - 1; i += 1) {
    if (clamped >= STOPS[i].t && clamped <= STOPS[i + 1].t) {
      a = STOPS[i]
      b = STOPS[i + 1]
      break
    }
  }
  const span = b.t - a.t || 1
  const localT = (clamped - a.t) / span
  const r = Math.round(a.rgb[0] + (b.rgb[0] - a.rgb[0]) * localT)
  const g = Math.round(a.rgb[1] + (b.rgb[1] - a.rgb[1]) * localT)
  const bch = Math.round(a.rgb[2] + (b.rgb[2] - a.rgb[2]) * localT)
  return `rgb(${r}, ${g}, ${bch})`
}

/** Short-time-FFT spectrogram rendered to canvas (log-magnitude heat map). */
export default function SpectrogramView({ spectrogram, label, maxHzDisplay = 5000 }) {
  const canvasRef = useRef(null)
  const { frames = [], freqBinHz = 1 } = spectrogram || {}

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth || 320
    const height = canvas.clientHeight || 140
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#fbfdf9'
    ctx.fillRect(0, 0, width, height)

    if (!frames.length) return

    const maxBin = Math.min(frames[0].length - 1, Math.ceil(maxHzDisplay / freqBinHz))
    let min = Infinity
    let max = -Infinity
    for (const frame of frames) {
      for (let k = 0; k <= maxBin; k += 1) {
        const v = frame[k]
        if (v < min) min = v
        if (v > max) max = v
      }
    }
    const range = max - min || 1

    const colStep = width / frames.length
    const rowStep = height / (maxBin + 1)

    frames.forEach((frame, col) => {
      for (let k = 0; k <= maxBin; k += 1) {
        const t = (frame[k] - min) / range
        ctx.fillStyle = colorFor(t)
        const y = height - (k + 1) * rowStep
        ctx.fillRect(col * colStep, y, Math.max(1, colStep), rowStep + 0.5)
      }
    })
  }, [frames, freqBinHz, maxHzDisplay])

  return (
    <div className="spectrogram-wrap">
      {label ? <div className="spectrogram-label">{label}</div> : null}
      <div className="reveal-wipe">
        <canvas ref={canvasRef} className="spectrogram-canvas" aria-label={label || 'Spectrogram'} />
      </div>
    </div>
  )
}
