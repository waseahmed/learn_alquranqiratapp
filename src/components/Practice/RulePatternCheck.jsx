/** Ghunnah + pause-placement signals. Clearly experimental — never a tajweed ruling. */
export default function RulePatternCheck({ ghunnah, pausePlacementNote }) {
  if (!ghunnah) return null

  return (
    <div className="rule-pattern-check">
      <div className="rule-pattern-badge">Experimental heuristic — not a tajweed judgment</div>
      <ul className="rule-pattern-list">
        <li>
          <b>Ghunnah / nasal resonance (approx.):</b>{' '}
          {ghunnah.deltaPct >= 0 ? '+' : ''}
          {ghunnah.deltaPct.toFixed(0)}% low/mid-band spectral energy vs. the reference.{' '}
          {ghunnah.flagged
            ? 'Noticeably different balance — listen for nasalization on ghunnah letters.'
            : 'Close to the reference.'}
        </li>
        <li>
          <b>Pause placement:</b> {pausePlacementNote}
        </li>
      </ul>
    </div>
  )
}
