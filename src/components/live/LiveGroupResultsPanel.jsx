import LiveParentPodium from './LiveParentPodium'

export default function LiveGroupResultsPanel({
  groupName,
  questionsTotal,
  places,
  myParticipantId,
  variant = 'parent',
  autoQuiz = false,
}) {
  const total = questionsTotal ?? '?'

  return (
    <div
      className={`live-group-results live-group-results--${variant} ${
        autoQuiz ? 'live-group-results--auto' : ''
      }`}
    >
      <header className="live-group-results-header">
        <span className="live-group-results-badge">Results</span>
        <h2 className="live-group-results-title">{groupName}</h2>
        <p className="live-group-results-meta">
          {total} {Number(total) === 1 ? 'question' : 'questions'}
          {autoQuiz ? ' · auto quiz' : ''}
        </p>
      </header>
      <div className="live-group-results-podium">
        <LiveParentPodium places={places} myParticipantId={myParticipantId} />
      </div>
      {variant === 'parent' ? (
        <p className="live-group-results-footer">Great job — wait for the host.</p>
      ) : null}
    </div>
  )
}