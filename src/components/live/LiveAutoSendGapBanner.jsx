export default function LiveAutoSendGapBanner({
  countdown,
  variant = 'inline',
  className = '',
  transitionSplash = false,
}) {
  if (!countdown) return null

  const { seconds, isLastQuestion } = countdown
  const loading = seconds <= 0

  const label = isLastQuestion ? 'Results in' : 'Next question in'
  const loadingLabel = isLastQuestion ? 'Showing results…' : 'Loading…'

  if (transitionSplash) {
    return (
      <div
        className={`live-auto-gap live-auto-gap--transition live-auto-gap--${variant} ${className}`.trim()}
        role="status"
        aria-live="polite"
      >
        <div className="live-auto-gap-pulse" aria-hidden>
          <span className="live-auto-gap-pulse-ring" />
          <span className="live-auto-gap-orbit live-auto-gap-orbit--1">?</span>
          <span className="live-auto-gap-orbit live-auto-gap-orbit--2">⚡</span>
          <span className="live-auto-gap-orbit live-auto-gap-orbit--3">✦</span>
          <span className="live-auto-gap-pulse-core" key={loading ? 'load' : seconds}>
            {loading ? (
              <span className="live-auto-gap-core-dots">
                <span />
                <span />
                <span />
              </span>
            ) : (
              seconds
            )}
          </span>
        </div>
        <p className="live-auto-gap-label live-auto-gap-label--transition">{label}</p>
        {loading ? <p className="live-auto-gap-sublabel">{loadingLabel}</p> : null}
      </div>
    )
  }

  const legacyLabel = isLastQuestion
    ? loading
      ? 'Loading results…'
      : 'Loading results in'
    : 'Loading next question in'

  return (
    <div
      className={`live-auto-gap live-auto-gap--${variant} ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <p className="live-auto-gap-label">{legacyLabel}</p>
      {!loading && (
        <p className="live-auto-gap-num" key={seconds}>
          {seconds}
        </p>
      )}
    </div>
  )
}