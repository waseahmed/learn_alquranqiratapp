import { useEffect, useRef, useState } from 'react'

const CONFETTI_COLORS = ['#1e6039', '#c99334', '#5d8f59', '#a8493e', '#fdf6e3']
const CONFETTI_COUNT = 22
const COUNT_UP_MS = 800

function reactionFor(score) {
  if (score >= 90) return { emoji: '🎉', label: 'Excellent!' }
  if (score >= 75) return { emoji: '🙌', label: 'Great job' }
  if (score >= 55) return { emoji: '💪', label: 'Good progress' }
  return { emoji: '🔄', label: 'Keep practicing' }
}

function colorFor(score) {
  if (score >= 80) return 'var(--green)'
  if (score >= 50) return 'var(--gold)'
  return 'var(--red)'
}

/** Animated 0→score count-up with a reaction line, plus a one-time confetti burst for high scores. */
export default function ScoreReveal({ score, size = 'lg' }) {
  const target = Math.round(Math.max(0, Math.min(100, score ?? 0)))
  const [display, setDisplay] = useState(0)
  const [confettiBurst, setConfettiBurst] = useState(0)
  const playedForRef = useRef(null)

  useEffect(() => {
    let raf
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / COUNT_UP_MS)
      const eased = 1 - (1 - t) ** 3
      setDisplay(Math.round(target * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    if (target >= 85 && playedForRef.current !== target) {
      playedForRef.current = target
      setConfettiBurst((n) => n + 1)
    }

    return () => cancelAnimationFrame(raf)
  }, [target])

  const reaction = reactionFor(target)

  return (
    <div className={`score-reveal score-reveal-${size}`}>
      <div className="score-reveal-number" style={{ color: colorFor(target) }}>
        {display}
        <span>/100</span>
      </div>
      <div className="score-reveal-reaction" aria-live="polite">
        <span className="score-reveal-emoji">{reaction.emoji}</span> {reaction.label}
      </div>
      {confettiBurst > 0 ? (
        <div className="score-confetti" key={confettiBurst} aria-hidden="true">
          {Array.from({ length: CONFETTI_COUNT }, (_, i) => (
            <span
              key={i}
              className="confetti-piece"
              style={{
                left: `${Math.round((i / CONFETTI_COUNT) * 100 + Math.random() * 8)}%`,
                background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                animationDelay: `${Math.random() * 0.25}s`,
                '--confetti-rotate': `${Math.round(Math.random() * 360)}deg`,
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
