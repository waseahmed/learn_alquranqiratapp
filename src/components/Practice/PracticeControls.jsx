function rateMatches(a, b) {
  return a != null && Math.abs(Number(a) - Number(b)) < 0.01
}

export default function PracticeControls({
  onReplay,
  onSlowToggle,
  onStartShadow,
  onToggleRecord,
  isRecording,
  disableAudioActions,
  slowRate = null,
}) {
  return (
    <div className="practice-bar">
      <button
        type="button"
        className="btn"
        onClick={onReplay}
        disabled={disableAudioActions}
      >
        ↻ Replay
      </button>
      <button
        type="button"
        className={`btn speed-toggle ${rateMatches(slowRate, 0.8) ? 'speed-on' : ''}`}
        onClick={() => onSlowToggle(0.8)}
        disabled={disableAudioActions}
        aria-pressed={rateMatches(slowRate, 0.8)}
        title={
          rateMatches(slowRate, 0.8)
            ? '0.8× is on — click to turn off'
            : 'Play at 0.8× speed'
        }
      >
        0.8× Slow
      </button>
      <button
        type="button"
        className={`btn speed-toggle ${rateMatches(slowRate, 0.5) ? 'speed-on' : ''}`}
        onClick={() => onSlowToggle(0.5)}
        disabled={disableAudioActions}
        aria-pressed={rateMatches(slowRate, 0.5)}
        title={
          rateMatches(slowRate, 0.5)
            ? '0.5× is on — click to turn off'
            : 'Play at 0.5× speed'
        }
      >
        0.5× Slow
      </button>
      <button
        type="button"
        className="btn"
        onClick={onStartShadow}
        disabled={disableAudioActions}
      >
        🎯 Start Shadow Practice
      </button>
      <button
        type="button"
        className={`btn ${isRecording ? 'stop' : ''}`}
        onClick={onToggleRecord}
        aria-pressed={isRecording}
      >
        {isRecording ? '■ Stop Recording' : '🎙 Record Yourself'}
      </button>
    </div>
  )
}
