import { useEffect, useMemo, useState } from 'react'
import { fetchLivePresentSnapshot } from '../../services/liveQuiz'
import { formatResponseMs } from '../../utils/liveQuizTiming'

const MEDALS = ['🥇', '🥈', '🥉']
const ORDINAL = ['1st', '2nd', '3rd']

function roleSuffix(role) {
  return role === 'father' ? ' · Father' : ' · Mother'
}

export default function LivePresentPage() {
  const [snapshot, setSnapshot] = useState(null)
  const [error, setError] = useState('')
  const [revealKey, setRevealKey] = useState(0)

  useEffect(() => {
    let active = true
    async function load() {
      const { data, error: err } = await fetchLivePresentSnapshot()
      if (!active) return
      if (err) setError(err.message)
      else setSnapshot(data)
    }
    load()
    const id = window.setInterval(load, 1500)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [])

  const podium = snapshot?.last_podium
  const title = podium?.question_title || snapshot?.remaining_context?.title
  const roundId = podium?.round_id
  const ranking = podium?.ranking?.length ? podium.ranking : podium?.places || []
  const topThree = (podium?.places || []).slice(0, 3)
  const leaderboard = snapshot?.leaderboard || []
  const isCompetition = podium?.group_mode === 'competition'

  useEffect(() => {
    if (roundId) setRevealKey((k) => k + 1)
  }, [roundId])

  const listHeading = useMemo(() => {
    if (!title) return 'Answer order'
    return isCompetition ? `Correct answers — fastest first` : `Answers — in order received`
  }, [title, isCompetition])

  return (
    <div className="live-present">
      <header className="live-present-header">
        <img
          src={`${import.meta.env.BASE_URL}logo.png`}
          alt=""
          className="live-present-logo"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
        <h1 className="live-present-title">Live results</h1>
        <p className="live-present-sub">Drag this window to your projector or second screen</p>
      </header>

      {error && (
        <p className="live-present-error" role="alert">
          {error}
        </p>
      )}

      <div className="live-present-stage">
        {title ? (
          <h2 className="live-present-question" key={`q-${roundId || title}`}>
            {title}
          </h2>
        ) : (
          <p className="live-present-empty live-present-empty--hero">
            Waiting for the host to send a question…
          </p>
        )}

        <section className="live-present-round" aria-labelledby="round-order-heading">
          <h3 id="round-order-heading" className="live-present-section-title">
            {listHeading}
          </h3>
          {ranking.length === 0 ? (
            <p className="live-present-empty">No answers yet for this round.</p>
          ) : (
            <ol className="live-present-ranking-list">
              {ranking.map((entry, idx) => (
                <li
                  key={entry.participant_id || `${entry.kid_name}-${idx}`}
                  className={`live-present-ranking-row ${entry.rank <= 3 ? `live-present-ranking-row--${entry.rank || idx + 1}` : ''}`}
                >
                  <span className="live-present-rank">{entry.rank ?? idx + 1}</span>
                  <span className="live-present-name">
                    {entry.kid_name}
                    <span className="live-present-role">{roleSuffix(entry.parent_role)}</span>
                  </span>
                  <span className="live-present-ms">{formatResponseMs(entry.response_ms)}</span>
                  {entry.points_awarded > 0 && (
                    <span className="live-present-pts">+{entry.points_awarded}</span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        {topThree.length > 0 && (
          <section
            key={revealKey}
            className="live-present-spotlight"
            aria-labelledby="spotlight-heading"
          >
            <h3 id="spotlight-heading" className="live-present-section-title">
              Top 3
            </h3>
            <ol className="live-present-spotlight-list">
              {topThree.map((entry) => (
                <li
                  key={entry.participant_id || entry.place}
                  className={`live-present-spotlight-card live-present-spotlight-card--${entry.place} live-present-spotlight-card--animate`}
                  style={{ animationDelay: `${(entry.place - 1) * 180}ms` }}
                >
                  <span className="live-present-medal" aria-hidden>
                    {MEDALS[entry.place - 1] || entry.place}
                  </span>
                  <div className="live-present-spotlight-body">
                    <span className="live-present-spotlight-label">{ORDINAL[entry.place - 1] || `${entry.place}th`}</span>
                    <strong className="live-present-spotlight-name">{entry.kid_name}</strong>
                    <span className="live-present-role">{roleSuffix(entry.parent_role)}</span>
                    <span className="live-present-ms live-present-ms--spot">
                      {formatResponseMs(entry.response_ms)}
                    </span>
                  </div>
                  {entry.points_awarded > 0 && (
                    <span className="live-present-pts live-present-pts--spot">
                      +{entry.points_awarded} pts
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="live-present-board live-present-board--compact" aria-labelledby="board-heading">
          <h3 id="board-heading" className="live-present-section-title">
            Overall competition score
          </h3>
          {leaderboard.length === 0 ? (
            <p className="live-present-empty">Scores appear after competition questions.</p>
          ) : (
            <ol className="live-present-board-list">
              {leaderboard.slice(0, 8).map((row, idx) => (
                <li key={`${row.kid_name}-${idx}`} className="live-present-board-row">
                  <span className="live-present-rank">{idx + 1}</span>
                  <span className="live-present-name">
                    {row.kid_name}
                    <span className="live-present-role">{roleSuffix(row.parent_role)}</span>
                  </span>
                  <span className="live-present-score">{row.points}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}