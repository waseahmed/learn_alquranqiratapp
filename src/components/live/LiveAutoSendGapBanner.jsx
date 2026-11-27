import LiveQuizGetReady from './LiveQuizGetReady'

export default function LiveAutoSendGapBanner({
  countdown,
  variant = 'inline',
  className = '',
  roundSeed = null,
}) {
  if (!countdown) return null

  const { seconds, isLastQuestion } = countdown
  const loading = seconds <= 0

  if (loading && !isLastQuestion) {
    return (
      <div
        className={`live-auto-gap live-auto-gap--loading live-auto-gap--${variant} ${className}`.trim()}
      >
        <LiveQuizGetReady
          variant={variant === 'present' ? 'present' : 'compact'}
          seed={roundSeed || 'next'}
        />
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