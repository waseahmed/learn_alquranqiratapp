function colorClassFor(score) {
  if (score >= 80) return 'segment-good'
  if (score >= 50) return 'segment-warn'
  return 'segment-bad'
}

/** Word-by-word timeline strip + duration ratio table, color-coded by per-segment match. */
export default function SegmentTimeline({ table }) {
  const rows = table?.rows || []

  return (
    <div className="segment-timeline">
      <div className="segment-strip" role="img" aria-label="Word-by-word match timeline">
        {rows.map((r) => (
          <div
            key={r.index}
            className={`segment-block ${colorClassFor(r.matchScore)}`}
            style={{ flexGrow: Math.max(r.refDuration, 0.05), '--stagger': `${r.index * 70}ms` }}
            title={`Segment ${r.index + 1}: ${r.matchScore}% match (ratio ${r.ratio.toFixed(2)}×)`}
          >
            {r.index + 1}
          </div>
        ))}
      </div>

      {table?.countMismatch ? (
        <p className="segment-note">
          Detected {table.refCount} reference segment(s) vs {table.studentCount} in your recording — showing the
          first {rows.length} matched by order.
        </p>
      ) : null}

      {rows.length ? (
        <table className="segment-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Reference</th>
              <th>Yours</th>
              <th>Ratio</th>
              <th>Flag</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.index}>
                <td>{r.index + 1}</td>
                <td>{r.refDuration.toFixed(2)}s</td>
                <td>{r.studentDuration.toFixed(2)}s</td>
                <td>{r.ratio.toFixed(2)}×</td>
                <td>{r.cutShortMadd ? 'Possible cut-short madd' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="segment-note">Not enough detected words/segments to build a per-segment table.</p>
      )}
    </div>
  )
}
