const TWO_PI = Math.PI * 2

const AXES = [
  { key: 'pitch', label: 'Pitch' },
  { key: 'pace', label: 'Pace' },
  { key: 'pause', label: 'Pauses' },
  { key: 'madd', label: 'Madd length' },
  { key: 'rhythm', label: 'Rhythm' },
]

function clamp01(x) {
  return Math.max(0, Math.min(1, x))
}

function pointOnAxis(index, total, radius, cx, cy) {
  const angle = -Math.PI / 2 + (index / total) * TWO_PI
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) }
}

function toPolygonPoints(points) {
  return points.map((p) => `${p.x},${p.y}`).join(' ')
}

/** Radar/spider chart of the five composite component scores (0-100 each). */
export default function ScoreRadarChart({ scores = {} }) {
  const cx = 110
  const cy = 106
  const maxR = 76
  const total = AXES.length

  const ringPoints = (frac) => AXES.map((_, i) => pointOnAxis(i, total, maxR * frac, cx, cy))
  const dataPoints = AXES.map((axis, i) =>
    pointOnAxis(i, total, maxR * clamp01((scores[axis.key] ?? 0) / 100), cx, cy),
  )

  return (
    <svg viewBox="0 0 220 230" className="radar-chart" role="img" aria-label="Component score radar chart">
      {[0.25, 0.5, 0.75, 1].map((frac) => (
        <polygon key={frac} points={toPolygonPoints(ringPoints(frac))} className="radar-ring" />
      ))}
      {AXES.map((axis, i) => {
        const p = pointOnAxis(i, total, maxR, cx, cy)
        return <line key={axis.key} x1={cx} y1={cy} x2={p.x} y2={p.y} className="radar-axis" />
      })}
      <g className="radar-data" style={{ transformOrigin: `${cx}px ${cy}px` }}>
        <polygon points={toPolygonPoints(dataPoints)} className="radar-shape" />
        {dataPoints.map((p, i) => (
          <circle key={AXES[i].key} cx={p.x} cy={p.y} r={3} className="radar-dot" />
        ))}
      </g>
      {AXES.map((axis, i) => {
        const p = pointOnAxis(i, total, maxR + 26, cx, cy)
        return (
          <text key={axis.key} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" className="radar-label">
            {axis.label}
          </text>
        )
      })}
    </svg>
  )
}
