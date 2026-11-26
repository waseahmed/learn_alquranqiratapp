import ScoreReveal from './ScoreReveal'
import { formatDuration } from '../../services/audioCompare'

export default function ShadowClosenessCard({
  comparison,
  recitationAnalysis,
  coachName,
  scopeLabel,
}) {
  if (!comparison) return null
  const overall = recitationAnalysis?.overallScore ?? comparison.score

  return (
    <section className="guide-card shadow-closeness-card" aria-labelledby="shadow-closeness-heading">
      <header className="shadow-closeness-head">
        <h3 id="shadow-closeness-heading" className="shadow-coach-panel-title">
          Closeness score
        </h3>
        <p className="shadow-coach-panel-desc">
          vs {coachName}
          {scopeLabel ? ` · ${scopeLabel}` : ''}
        </p>
      </header>
      <div className="compare-score-row shadow-closeness-row">
        <ScoreReveal score={overall} size="sm" />
        <ClosenessMetrics comparison={comparison} components={recitationAnalysis?.components} />
      </div>
      {comparison.tips?.length ? (
        <ul className="shadow-closeness-tips">
          {comparison.tips.slice(0, 2).map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function ClosenessMetrics({ comparison, components }) {
  const ratio = comparison.durationRatio
  const lengthNote =
    ratio > 1.05
      ? `${formatDuration(Math.abs(comparison.metrics.durationDeltaSec))} longer`
      : ratio < 0.95
        ? `${formatDuration(Math.abs(comparison.metrics.durationDeltaSec))} shorter`
        : 'nearly same length'

  return (
    <div className="compare-metrics shadow-closeness-metrics">
      <div>
        <b>Shape match</b> {comparison.similarityPct}%
      </div>
      <div>
        <b>Ref</b> {comparison.metrics.referenceDuration}
      </div>
      <div>
        <b>Yours</b> {comparison.metrics.studentDuration}
      </div>
      <div>
        <b>Length</b> {lengthNote}
      </div>
      {components ? (
        <div>
          <b>Pitch</b> {components.pitch}/100 · <b>Rhythm</b> {components.rhythm}/100
        </div>
      ) : null}
    </div>
  )
}