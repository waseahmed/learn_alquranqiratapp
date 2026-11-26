/** Classic vertical-bar waveform (reads like real audio, not a smoothed blob). */
export function drawWaveformBars(
  ctx,
  envelope,
  { x, y, width, height, midRatio = 0.55, playProgress = 0, palette },
) {
  const n = envelope?.length
  if (!n) return
  const midY = y + height * midRatio
  const ampH = height * 0.44
  const barStep = width / n
  const lineW = Math.max(1, barStep * 0.78)
  const playX = x + playProgress * width
  const base = palette?.base || 'rgba(30, 96, 57, 0.42)'
  const played = palette?.played || 'rgba(30, 96, 57, 0.88)'
  const inactive = palette?.inactive || 'rgba(30, 96, 57, 0.28)'

  ctx.lineCap = 'round'
  for (let i = 0; i < n; i += 1) {
    const cx = x + i * barStep + barStep / 2
    const amp = envelope[i] * ampH
    const isPlayed = playProgress > 0.002 && cx <= playX + barStep * 0.5
    ctx.strokeStyle = playProgress > 0.002 ? (isPlayed ? played : inactive) : base
    ctx.lineWidth = lineW
    ctx.beginPath()
    ctx.moveTo(cx, midY - amp)
    ctx.lineTo(cx, midY + amp)
    ctx.stroke()
  }
}