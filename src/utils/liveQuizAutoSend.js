export function getQuestionTimerEndedAtMs(phaseStartedAt, timerSeconds) {
  if (!phaseStartedAt) return null
  const start = new Date(phaseStartedAt).getTime()
  if (!Number.isFinite(start)) return null
  const sec = Number(timerSeconds)
  if (!Number.isFinite(sec) || sec < 0) return null
  return start + sec * 1000
}

/**
 * During timed_out, countdown until admin auto-send advances (matches admin gap timer).
 */
export function getAutoSendGapCountdown({
  displayPhase,
  phaseStartedAt,
  timerSeconds,
  now,
  autoSendQuestions,
  gapSeconds,
  sessionProgress,
}) {
  if (!autoSendQuestions || displayPhase !== 'timed_out') return null

  const endedAt = getQuestionTimerEndedAtMs(phaseStartedAt, timerSeconds)
  if (endedAt == null) return null

  const gap = Math.max(3, Number(gapSeconds) || 5)
  const gapEnd = endedAt + gap * 1000
  const remainingMs = gapEnd - now
  const pending = Number(sessionProgress?.pending)
  const isLastQuestion = Number.isFinite(pending) && pending <= 0
  const seconds = remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0

  return { seconds, isLastQuestion, gapSeconds: gap }
}