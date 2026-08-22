export default function ShadowMode({ active, countLabel, onStop }) {
  if (!active) return null

  return (
    <div className="shadow-box show" role="status" aria-live="polite">
      <div>
        <b>Shadow Practice</b> — listen, then copy during the pause.
      </div>
      <div className="shadow-count">{countLabel}</div>
      <button type="button" className="btn" onClick={onStop}>
        Stop Shadow Practice
      </button>
    </div>
  )
}
