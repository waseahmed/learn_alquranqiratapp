import ShadowMiniWaveform from './ShadowMiniWaveform'

export default function ShadowCoachRail({
  coaches,
  focusQariKey,
  onFocusQari,
  onHearQari,
  onStopCoach,
  activePlay,
  isPlaying,
  qariPreviews = {},
  miniPlayProgress,
}) {
  return (
    <aside className="shadow-coach-rail shadow-qari-rail" aria-label="Coaching controls">
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
              (activePlay === 'loop-coach' && focused) ||
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
                    aria-label={`Hear ${q.name}`}
                  >
                    ▶ Hear
                  </button>
                  <button
                    type="button"
                    className="btn shadow-coach-btn stop"
                    onClick={() => onStopCoach(q.key)}
                    disabled={!playing || !isPlaying}
                    aria-label={`Stop ${q.name}`}
                  >
                    ■
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="guide-card shadow-coach-workflow" aria-labelledby="shadow-workflow-heading">
        <h3 id="shadow-workflow-heading" className="shadow-coach-workflow-title">
          Coaching flow
        </h3>
        <ol className="shadow-coach-steps">
          <li>Focus a coach to load their waveform.</li>
          <li>Hear them and shadow the green melody line.</li>
          <li>Record on the left and compare your takes.</li>
        </ol>
      </section>
    </aside>
  )
}