import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import Header from '../components/Layout/Header'
import { useAuth } from '../contexts/AuthContext'
import { fetchPracticeHistory } from '../services/practiceAttempts'
import { surahs } from '../data/quranData'
import { qaris } from '../data/qaris'

const QARI_NAMES = Object.fromEntries(qaris.map((q) => [q.key, q.name]))

function scoreClass(score) {
  if (score >= 80) return 'attempts-score-good'
  if (score >= 50) return 'attempts-score-warn'
  return 'attempts-score-bad'
}

function formatWhen(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
}

export default function MyAttemptsPage() {
  const { onMenuToggle, onNavigate } = useOutletContext()
  const { user } = useAuth()
  const [attempts, setAttempts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    if (!user?.id) {
      setAttempts([])
      setLoading(false)
      return
    }
    setLoading(true)
    fetchPracticeHistory(user.id, { limit: 200 }).then(({ data, error: fetchError }) => {
      setAttempts(data)
      setError(fetchError)
      setLoading(false)
    })
  }, [user?.id])

  const stats = useMemo(() => {
    if (!attempts.length) return null
    const scores = attempts.map((a) => a.overall_score)
    return {
      count: attempts.length,
      best: Math.max(...scores),
      avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    }
  }, [attempts])

  return (
    <section className="guide attempts-page">
      <Header title="My Attempts" subtitle="Your Compare Audio practice history" onMenuToggle={onMenuToggle} />

      {!user?.id ? (
        <div className="guide-card">
          <p>Sign in to see your saved practice attempts.</p>
        </div>
      ) : loading ? (
        <p className="compare-status">Loading your attempts…</p>
      ) : error ? (
        <div className="guide-card">
          <p className="compare-error" role="alert">
            {error.message}
          </p>
        </div>
      ) : !attempts.length ? (
        <div className="guide-card">
          <div className="rule">No attempts yet</div>
          <p className="guide-intro">
            Run a comparison on the <Link to="/compare-audio">Compare Audio</Link> page and your score will
            show up here.
          </p>
        </div>
      ) : (
        <>
          <div className="guide-card attempts-stats-card">
            <div className="attempts-stat">
              <div className="attempts-stat-num">{stats.count}</div>
              <div className="attempts-stat-label">Attempts</div>
            </div>
            <div className="attempts-stat">
              <div className="attempts-stat-num">{stats.avg}</div>
              <div className="attempts-stat-label">Average score</div>
            </div>
            <div className="attempts-stat">
              <div className="attempts-stat-num">{stats.best}</div>
              <div className="attempts-stat-label">Best score</div>
            </div>
          </div>

          <ul className="attempts-list">
            {attempts.map((a) => {
              const surahInfo = surahs[String(a.surah)]
              const expanded = expandedId === a.id
              return (
                <li key={a.id} className="attempts-row">
                  <button
                    type="button"
                    className="attempts-row-main"
                    onClick={() => setExpandedId(expanded ? null : a.id)}
                    aria-expanded={expanded}
                  >
                    <span className={`attempts-score-pill ${scoreClass(a.overall_score)}`}>{a.overall_score}</span>
                    <span className="attempts-row-info">
                      <b>
                        {surahInfo?.name_en || `Surah ${a.surah}`} {a.surah}:{a.ayah}
                      </b>
                      <span className="attempts-row-meta">
                        {formatWhen(a.created_at)}
                        {a.qari_key ? ` · ${QARI_NAMES[a.qari_key] || a.qari_key}` : ''}
                      </span>
                    </span>
                    <span className="attempts-row-chevron" aria-hidden="true">
                      {expanded ? '⌄' : '›'}
                    </span>
                  </button>
                  <div className="attempts-row-actions">
                    <button type="button" className="btn" onClick={() => onNavigate(a.surah, a.ayah)}>
                      Practice this ayah
                    </button>
                  </div>
                  {expanded ? (
                    <div className="attempts-breakdown">
                      <span>Pitch {a.pitch_score ?? '—'}</span>
                      <span>Pace {a.pace_score ?? '—'}</span>
                      <span>Pause {a.pause_score ?? '—'}</span>
                      <span>Madd length {a.madd_score ?? '—'}</span>
                      <span>Rhythm {a.rhythm_score ?? '—'}</span>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
