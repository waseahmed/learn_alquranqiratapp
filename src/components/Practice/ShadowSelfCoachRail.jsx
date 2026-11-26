import ShadowClosenessCard from './ShadowClosenessCard'

export default function ShadowSelfCoachRail({
  activePlay,
  isPlaying,
  isRecording,
  hasRecording,
  playbackRate,
  onPlaybackRateChange,
  onRecordToggle,
  onClearRecording,
  onSaveRecording,
  canSave = false,
  onPlayYours,
  onPlayBoth,
  onCompareAb,
  onStop,
  recordingError,
  comparison,
  recitationAnalysis,
  coachName,
  comparisonScope,
  savedRecordings = [],
  activeSavedId,
  onPlaySaved,
  onDeleteSaved,
  saveStatus,
}) {
  const statusLabel = (() => {
    if (isRecording) return 'Recording your take…'
    if (!isPlaying || !activePlay) return 'Ready'
    if (activePlay === 'you' || activePlay === 'ab-you' || activePlay === 'loop-you') {
      return 'Playing your recording'
    }
    if (activePlay?.startsWith('saved-')) return 'Playing a saved take'
    if (activePlay === 'both') return 'Playing coach + you'
    if (activePlay?.startsWith('ab')) return 'A → B compare'
    return 'Playing'
  })()

  return (
    <aside className="shadow-coach-rail shadow-self-rail" aria-label="Your practice">
      <div className="shadow-coach-status" role="status">
        <span className="shadow-coach-status-dot" data-live={isPlaying || isRecording} />
        {statusLabel}
      </div>

      <section className="shadow-coach-panel shadow-coach-panel--self" aria-labelledby="shadow-self-heading">
        <header className="shadow-coach-panel-head">
          <h2 id="shadow-self-heading" className="shadow-coach-panel-title">
            Self coaching
          </h2>
          <p className="shadow-coach-panel-desc">Record, compare, and replay your last takes for this ayah.</p>
        </header>

        <SelfRecordingToolbar
          isRecording={isRecording}
          hasRecording={hasRecording}
          onRecordToggle={onRecordToggle}
          onClearRecording={onClearRecording}
          onSaveRecording={onSaveRecording}
          canSave={canSave}
          onPlayYours={onPlayYours}
          onPlayBoth={onPlayBoth}
          onCompareAb={onCompareAb}
          onStop={onStop}
          activePlay={activePlay}
          isPlaying={isPlaying}
        />

        <PlaybackRateGroup value={playbackRate} onChange={onPlaybackRateChange} />

        {saveStatus ? (
          <p className="shadow-saved-status" role="status">
            {saveStatus}
          </p>
        ) : null}

        <SavedRecordingsList
          entries={savedRecordings}
          activeSavedId={activeSavedId}
          activePlay={activePlay}
          onPlaySaved={onPlaySaved}
          onDeleteSaved={onDeleteSaved}
        />

        {hasRecording && comparison ? (
          <ShadowClosenessCard
            comparison={comparison}
            recitationAnalysis={recitationAnalysis}
            coachName={coachName}
            scopeLabel={comparisonScope}
          />
        ) : null}

        {recordingError && (
          <p className="shadow-practice-error" role="alert">
            {recordingError}
          </p>
        )}
      </section>

      <section className="guide-card shadow-coach-workflow" aria-labelledby="shadow-self-flow-heading">
        <h3 id="shadow-self-flow-heading" className="shadow-coach-workflow-title">
          Your flow
        </h3>
        <ol className="shadow-coach-steps">
          <li>Record, then tap Save (up to 3 per ayah).</li>
          <li>Compare with A → B or Both.</li>
          <li>Replay older takes from Saved below.</li>
        </ol>
      </section>
    </aside>
  )
}

function SavedRecordingsList({ entries, activeSavedId, activePlay, onPlaySaved, onDeleteSaved }) {
  return (
    <div className="shadow-saved-list-wrap">
      <h3 className="shadow-saved-list-title">Saved recordings</h3>
      <p className="shadow-saved-list-hint">Latest 3 for this ayah — a 4th save replaces the oldest.</p>
      {entries.length === 0 ? (
        <p className="shadow-saved-empty">No saved takes yet.</p>
      ) : (
        <ul className="shadow-saved-list">
          {[...entries].reverse().map((entry, reverseIdx) => {
            const slot = entries.length - reverseIdx
            const playing = activePlay === `saved-${entry.id}`
            return (
              <li
                key={entry.id}
                className={`shadow-saved-item ${activeSavedId === entry.id ? 'shadow-saved-item--active' : ''}`}
              >
                <div className="shadow-saved-item-main">
                  <span className="shadow-saved-slot">#{slot}</span>
                  <span className="shadow-saved-date">{entry.savedAtLabel}</span>
                  {entry.coachName ? (
                    <span className="shadow-saved-coach">Coach: {entry.coachName}</span>
                  ) : null}
                </div>
                <div className="shadow-saved-item-actions">
                  <button
                    type="button"
                    className={`btn shadow-coach-btn ${playing ? 'primary' : ''}`}
                    onClick={() => onPlaySaved(entry)}
                  >
                    ▶
                  </button>
                  <button
                    type="button"
                    className="btn ghost shadow-saved-delete"
                    onClick={() => onDeleteSaved(entry)}
                    aria-label="Delete saved recording"
                  >
                    ×
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function SelfRecordingToolbar({
  isRecording,
  hasRecording,
  onRecordToggle,
  onClearRecording,
  onSaveRecording,
  canSave,
  onPlayYours,
  onPlayBoth,
  onCompareAb,
  onStop,
  activePlay,
  isPlaying,
}) {
  return (
    <div className="shadow-coach-self-actions" role="toolbar" aria-label="Your recording">
      <button
        type="button"
        className={`btn primary shadow-coach-record ${isRecording ? 'stop' : ''}`}
        onClick={onRecordToggle}
        aria-pressed={isRecording}
      >
        {isRecording ? '■ Stop recording' : '🎙 Record'}
      </button>
      <button
        type="button"
        className="btn ghost shadow-coach-clear"
        onClick={onClearRecording}
        disabled={!hasRecording || isRecording}
        title="Discard your recording and score for this take"
      >
        Clear recording
      </button>
      <button
        type="button"
        className="btn save shadow-coach-save"
        onClick={onSaveRecording}
        disabled={!canSave}
        title="Save this take to your ayah library (max 3)"
      >
        Save take
      </button>
      <button
        type="button"
        className={`btn ${activePlay === 'you' || activePlay === 'loop-you' ? 'speed-on' : ''}`}
        onClick={onPlayYours}
        disabled={!hasRecording}
      >
        ▶ Yours
      </button>
      <button
        type="button"
        className={`btn ${activePlay === 'both' ? 'speed-on' : ''}`}
        onClick={onPlayBoth}
        disabled={!hasRecording}
      >
        Both
      </button>
      <button
        type="button"
        className={`btn ${activePlay?.startsWith('ab') ? 'speed-on' : ''}`}
        onClick={onCompareAb}
        disabled={!hasRecording}
      >
        A → B
      </button>
      <button type="button" className="btn stop" onClick={onStop} disabled={!isPlaying && !isRecording}>
        ■ Stop
      </button>
    </div>
  )
}

function PlaybackRateGroup({ value, onChange }) {
  const options = [
    { rate: 0.75, label: '0.75×' },
    { rate: 1, label: '1×' },
    { rate: 0.5, label: '0.5×' },
  ]
  return (
    <div className="shadow-coach-speed" role="group" aria-label="Playback speed">
      <span className="shadow-coach-speed-label">Speed</span>
      {options.map((opt) => (
        <button
          key={opt.rate}
          type="button"
          className={`btn ghost shadow-coach-speed-btn ${Math.abs(value - opt.rate) < 0.01 ? 'speed-on' : ''}`}
          onClick={() => onChange(opt.rate)}
          aria-pressed={Math.abs(value - opt.rate) < 0.01}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}