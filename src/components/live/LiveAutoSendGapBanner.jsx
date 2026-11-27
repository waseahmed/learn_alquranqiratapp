import LiveQuizGetReady from './LiveQuizGetReady'

export default function LiveAutoSendGapBanner({
  countdown,
  variant = 'inline',
  className = '',
  roundSeed = null,
  /** Full quiz splash + countdown (auto-advance between questions) */
  transitionSplash = false,
}) {
  if (!countdown) return null

  const { seconds, isLastQuestion } = countdown
  const loading = seconds <= 0

  const readyVariant =
    variant === 'present' ? 'present' : variant === 'parent' ? 'parent' : 'compact'

  if (transitionSplash) {
    const label = isLastQuestion ? 'Group results in' : 'Next question in'
    return (
      <div
        className={`live-auto-gap live-auto-gap--transition live-auto-gap--${variant} ${className}`.trim()}
        role="status"
        aria-live="polite"
      >
        <LiveQuizGetReady variant={readyVariant} seed={roundSeed || 'next'} />
        {!loading && seconds > 0 ? (
          <>
            <p className="live-auto-gap-label live-auto-gap-label--transition">{label}</p>
            <p className="live-auto-gap-num live-auto-gap-num--transition" key={seconds}>
              {seconds}
            </p>
          </>
        ) : loading ? (
          <p className="live-auto-gap-label live-auto-gap-label--transition">
            {isLastQuestion ? 'Revealing group results…' : 'Here comes the next question…'}
          </p>
        ) : null}
      </div>
    )
  }

  if (loading && !isLastQuestion) {
    return (
      <div
        className={`live-auto-gap live-auto-gap--loading live-auto-gap--${variant} ${className}`.trim()}
      >
        <LiveQuizGetReady variant={readyVariant} seed={roundSeed || 'next'} />
      </div>
    )
  }

  const label = isLastQuestion
    ? loading
      ? 'Loading group results…'
      : 'Loading group results in'
    : 'Loading next question in'

  return (
    <div
      className={`live-auto-gap live-auto-gap--${variant} ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <p className="live-auto-gap-label">{label}</p>
      {!loading && (
        <p className="live-auto-gap-num" key={seconds}>
          {seconds}
        </p>
      )}
    </div>
  )
}