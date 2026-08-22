export default function PracticeControls({
  onReplay,
  onSlow,
  onStartShadow,
  onToggleRecord,
  isRecording,
  disableAudioActions,
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
        className="btn"
        onClick={onSlow}
        disabled={disableAudioActions}
      >
        0.8× Slow
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
