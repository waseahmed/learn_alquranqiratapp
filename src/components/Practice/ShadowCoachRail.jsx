import ShadowMiniWaveform from './ShadowMiniWaveform'
import ShadowClosenessCard from './ShadowClosenessCard'

export default function ShadowCoachRail({
  coaches,
  focusQariKey,
  onFocusQari,
  onHearQari,
  activePlay,
  isPlaying,
  isRecording,
  hasRecording,
  playbackRate,
  onPlaybackRateChange,
  onRecordToggle,
  onPlayYours,
  onPlayBoth,
  onCompareAb,
  onStop,
  recordingError,
  qariPreviews = {},
  miniPlayProgress,
  comparison,
  recitationAnalysis,
  coachName,
  comparisonScope,
}) {
  const statusLabel = (() => {
    if (isRecording) return 'Recording your take…'
    if (!isPlaying || !activePlay) return 'Ready'
    if (activePlay === 'you' || activePlay === 'ab-you') return 'Playing your recording'
    if (activePlay === 'both') return 'Playing coach + you'
    if (activePlay?.startsWith('ab')) return 'A → B compare'
    const key = activePlay.replace(/^ref-?/, '')
    const coach = coaches.find((c) => c.key === key)
    return coach ? `Playing ${coach.name}` : 'Playing coach'
  })()

  return (
    <aside className="shadow-coach-rail" aria-label="Coaching controls">
      <div className="shadow-coach-status" role="status">
        <span className="shadow-coach-status-dot" data-live={isPlaying || isRecording} />
        {statusLabel}
      </div>

      <section className="shadow-coach-panel" aria-labelledby="shadow-coach-heading">
        <header className="shadow-coach-panel-head">
          <h2 id="shadow-coach-heading" className="shadow-coach-panel-title">
            Coaching
          </h2>
          <p className="shadow-coach-panel-desc">
            Reference reciters from your practice session. Focus one to load their waveform guide.
          </p>
        </header>

        <ul className="shadow-coach-list">
          {coaches.map((q) => {
            const focused = focusQariKey === q.key
            const playing =
              activePlay === `ref-${q.key}` ||
              activePlay === `ab-ref-${q.key}` ||
              (activePlay === 'both' && focused)
            return (
              <li
                key={q.key}
                className={`shadow-coach-row shadow-coach-row--with-wave ${
                  focused ? 'shadow-coach-row--focus' : ''
                } ${playing ? 'shadow-coach-row--playing' : ''}`}
              >
                <button
                  type="button"
                  className="shadow-coach-row-main"
                  onClick={() => onFocusQari(q.key)}
                  aria-pressed={focused}
                >
                  <span className="shadow-coach-row-name">{q.name}</span>
                  <span className="shadow-coach-row-style">{q.style}</span>
                  {focused && <span className="shadow-coach-row-badge">Waveform</span>}
                </button>
                <ShadowMiniWaveform
                  envelope={qariPreviews[q.key]?.envelope}
                  ready={Boolean(qariPreviews[q.key]?.ready)}
                  loading={Boolean(qariPreviews[q.key]?.loading)}
                  active={focused}
                  playProgress={miniPlayProgress?.(q.key) ?? 0}
                  ariaLabel={`${q.name} waveform`}
                />
                <div className="shadow-coach-row-actions">
                  <button
                    type="button"
                    className={`btn shadow-coach-btn ${playing ? 'primary' : ''}`}
                    onClick={() => onHearQari(q.key)}
                  >
                    ▶ Hear
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="shadow-coach-panel shadow-coach-panel--self" aria-labelledby="shadow-self-heading">
        <header className="shadow-coach-panel-head">
          <h2 id="shadow-self-heading" className="shadow-coach-panel-title">
            Self coaching
          </h2>
          <p className="shadow-coach-panel-desc">
            Record, then compare your melody to the focused coach.
          </p>
        </header>

        <SelfRecordingToolbar
          isRecording={isRecording}
          hasRecording={hasRecording}
          onRecordToggle={onRecordToggle}
          onPlayYours={onPlayYours}
          onPlayBoth={onPlayBoth}
          onCompareAb={onCompareAb}
          onStop={onStop}
          activePlay={activePlay}
          isPlaying={isPlaying}
        />

        <PlaybackRateGroup value={playbackRate} onChange={onPlaybackRateChange} />

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

      <section className="guide-card shadow-coach-workflow" aria-labelledby="shadow-workflow-heading">
        <h3 id="shadow-workflow-heading" className="shadow-coach-workflow-title">
          Suggested flow
        </h3>
        <ol className="shadow-coach-steps">
          <li>Focus a coach to load their waveform.</li>
          <li>Hear them and shadow the green melody line.</li>
          <li>Record your take.</li>
          <li>Narrow a phrase and loop coach / you until it feels natural.</li>
          <li>Check your closeness score after recording.</li>
        </ol>
      </section>
    </aside>
  )
}

function SelfRecordingToolbar({
  isRecording,
  hasRecording,
  onRecordToggle,
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
        className={`btn ${activePlay === 'you' ? 'speed-on' : ''}`}
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