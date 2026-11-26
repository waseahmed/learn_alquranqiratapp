export default function ShadowWordLoopBar({
  words,
  loopStart,
  loopEnd,
  loopEnabled,
  onLoopEnabledChange,
  onSelectWord,
  onLoopCoach,
  onLoopYou,
  loopPlaying,
  durationSec,
  canLoopYou = false,
  activeWordIndex = -1,
}) {
  const rangeLabel =
    words.length && loopStart <= loopEnd
      ? `Words ${loopStart + 1}–${loopEnd + 1} of ${words.length}`
      : 'Select a phrase'

  return (
    <section className="shadow-word-loop" aria-labelledby="shadow-loop-heading">
      <header className="shadow-word-loop-head">
        <h3 id="shadow-loop-heading" className="shadow-word-loop-title">
          Phrase loop
        </h3>
        <label className="shadow-word-loop-toggle">
          <input
            type="checkbox"
            checked={loopEnabled}
            onChange={(e) => onLoopEnabledChange(e.target.checked)}
          />
          Loop while playing
        </label>
      </header>
      <p className="shadow-word-loop-hint">
        Tap the first word, then the last word to set your phrase. Timing is split evenly across words
        {Number.isFinite(durationSec) && durationSec > 0
          ? ` (~${durationSec.toFixed(1)}s total).`
          : '.'}
      </p>
      <div className="shadow-word-loop-chips" dir="rtl" lang="ar" role="group" aria-label="Word range">
        {words.map((w, i) => {
          const inRange = i >= loopStart && i <= loopEnd
          const isEdge = i === loopStart || i === loopEnd
          const speaking = i === activeWordIndex
          return (
            <button
              key={`${w}-${i}`}
              type="button"
              className={`shadow-word-loop-chip ${inRange ? 'shadow-word-loop-chip--in' : ''} ${
                isEdge ? 'shadow-word-loop-chip--edge' : ''
              } ${speaking ? 'shadow-word-loop-chip--speaking' : ''}`}
              onClick={() => onSelectWord(i)}
              aria-pressed={inRange}
              aria-current={speaking ? 'true' : undefined}
            >
              {w}
            </button>
          )
        })}
      </div>
      <p className="shadow-word-loop-meta">{rangeLabel}</p>
      <div className="shadow-word-loop-actions">
        <button
          type="button"
          className={`btn ${loopPlaying === 'coach' ? 'primary' : ''}`}
          onClick={onLoopCoach}
          disabled={!words.length}
        >
          ↻ Loop coach
        </button>
        <button
          type="button"
          className={`btn ${loopPlaying === 'you' ? 'speed-on' : ''}`}
          onClick={onLoopYou}
          disabled={!words.length || !canLoopYou}
        >
          ↻ Loop you
        </button>
      </div>
    </section>
  )
}