import { useMemo } from 'react'

const MESSAGES = [
  'Get ready!',
  'Think fast!',
  'Quiz incoming!',
  'Sharpen your mind!',
  'Next round!',
]

function pickMessage(seed) {
  if (seed == null || seed === '') return MESSAGES[0]
  let h = 0
  const s = String(seed)
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return MESSAGES[Math.abs(h) % MESSAGES.length]
}

export default function LiveQuizGetReady({
  variant = 'card',
  seed = null,
  hint = null,
  className = '',
}) {
  const title = useMemo(() => pickMessage(seed), [seed])

  return (
    <div
      className={`live-get-ready live-get-ready--${variant} ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <div className="live-get-ready-orbit" aria-hidden>
        <span className="live-get-ready-icon live-get-ready-icon--1">?</span>
        <span className="live-get-ready-icon live-get-ready-icon--2">⚡</span>
        <span className="live-get-ready-icon live-get-ready-icon--3">✦</span>
        <span className="live-get-ready-icon live-get-ready-icon--4">🎯</span>
        <span className="live-get-ready-core">Q</span>
      </div>
      <p className="live-get-ready-title">{title}</p>
      <p className="live-get-ready-sub">Tap quickly when the choices appear</p>
      {hint ? <p className="live-get-ready-hint">{hint}</p> : null}
      <div className="live-get-ready-dots" aria-hidden>
        <span />
        <span />
        <span />
      </div>
    </div>
  )
}