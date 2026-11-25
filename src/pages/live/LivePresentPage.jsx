import { useEffect, useState } from 'react'
import { fetchLivePresentSnapshot } from '../../services/liveQuiz'

const MEDALS = ['🥇', '🥈', '🥉']

export default function LivePresentPage() {
  const [snapshot, setSnapshot] = useState(null)
  const [error, setError] = useState('')

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

  const podium = snapshot?.last_podium?.places || []
  const leaderboard = snapshot?.leaderboard || []
  const title = snapshot?.last_podium?.question_title || snapshot?.remaining_context?.title

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
        <h1 className="live-present-title">Live leaderboard</h1>
        <p className="live-present-sub">Drag this window to your projector or second screen</p>
      </header>

      {error && (
        <p className="live-present-error" role="alert">
          {error}
        </p>
      )}

      <div className="live-present-grid">
        <section className="live-present-podium" aria-labelledby="podium-heading">
          <h2 id="podium-heading" className="live-present-section-title">
            {title ? `Fastest correct — ${title}` : 'Round winners'}
          </h2>
          {podium.length === 0 ? (
            <p className="live-present-empty">Waiting for a competition round to finish…</p>
          ) : (
            <ol className="live-present-podium-list">
              {podium.map((entry, idx) => (
                <li
                  key={entry.participant_id || idx}
                  className={`live-present-podium-item live-present-podium-item--${entry.place || idx + 1}`}
                >
                  <span className="live-present-medal" aria-hidden>
                    {MEDALS[(entry.place || idx + 1) - 1] || entry.place}
                  </span>
                  <motionName entry={entry} />
                  <span className="live-present-pts">+{entry.points_awarded} pts</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="live-present-board" aria-labelledby="board-heading">
          <h2 id="board-heading" className="live-present-section-title">
            Overall score
          </h2>
          {leaderboard.length === 0 ? (
            <p className="live-present-empty">Scores appear after competition questions.</p>
          ) : (
            <ol className="live-present-board-list">
              {leaderboard.slice(0, 12).map((row, idx) => (
                <li key={`${row.kid_name}-${idx}`} className="live-present-board-row">
                  <span className="live-present-rank">{idx + 1}</span>
                  <span className="live-present-name">
                    {row.kid_name}
                    <span className="live-present-role">
                      {row.parent_role === 'father' ? ' · Father' : ' · Mother'}
                    </span>
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

function motionName({ entry }) {
  return (
    <span className="live-present-name-block">
      <strong>{entry.kid_name}</strong>
    </span>
  )
}