import {
  CLEAR_EASY_PRESET,
  MELODIC_PRESET,
} from '../../data/qaris'

export default function QariSelector({
  availableQaris,
  selectedQaris,
  onToggle,
  onSelectPreset,
  onSelectAll,
}) {
  return (
    <div className="selector">
      <div className="selector-top">
        <b>Choose Qaris to Practice</b>
        <div className="preset-btns">
          <button type="button" className="btn" onClick={() => onSelectPreset(CLEAR_EASY_PRESET)}>
            Clear &amp; Easy
          </button>
          <button type="button" className="btn" onClick={() => onSelectPreset(MELODIC_PRESET)}>
            Melodic
          </button>
          <button type="button" className="btn" onClick={onSelectAll}>
            All
          </button>
        </div>
      </div>
      <div className="checks">
        {availableQaris.map((q) => {
          const on = selectedQaris.has(q.key)
          return (
            <button
              key={q.key}
              type="button"
              className={`check ${on ? 'on' : ''}`}
              aria-pressed={on}
              onClick={() => onToggle(q.key)}
            >
              {q.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
