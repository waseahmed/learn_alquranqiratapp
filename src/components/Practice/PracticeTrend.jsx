function colorFor(score) {
  if (score >= 80) return '#1e6039'
  if (score >= 50) return '#c99334'
  return '#a8493e'
}

/** Recent overall-score history for this ayah, persisted in Supabase across devices. */
export default function PracticeTrend({ attempts = [] }) {
  if (!attempts.length) return null

  const ordered = [...attempts].reverse()
  const latest = ordered[ordered.length - 1]

  return (
    <div className="practice-trend">
      <div className="practice-trend-bars" role="img" aria-label="Recent practice score trend">
        {ordered.map((a, i) => (
          <div
            key={a.id}
            className="practice-trend-bar"
            style={{
              height: `${Math.max(4, a.overall_score)}%`,
              background: colorFor(a.overall_score),
              '--stagger': `${i * 40}ms`,
            }}
            title={`${new Date(a.created_at).toLocaleDateString()} — ${a.overall_score}/100`}
          />
        ))}
      </div>
      <div className="practice-trend-caption">
        Last {ordered.length} attempt{ordered.length === 1 ? '' : 's'} for this ayah · latest {latest.overall_score}
        /100
      </div>
    </div>
  )
}
