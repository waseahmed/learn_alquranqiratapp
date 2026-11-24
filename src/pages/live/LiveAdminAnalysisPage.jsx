import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { APP_NAME, APP_TAGLINE } from '../../config'
import { LIVE_QUIZ_QUESTIONS } from '../../data/liveQuizQuestions'
import { adminLiveQuizDetailedAnalysis } from '../../services/liveQuiz'
import { supabaseConfigured } from '../../services/supabase'

const PIN_STORAGE_KEY = 'aqqa_live_admin_pin'

function optionLabel(questionNumber, optionNumber) {
  const q = LIVE_QUIZ_QUESTIONS.find((item) => item.number === questionNumber)
  if (!q || !optionNumber) return `Option ${optionNumber}`
  return q.options[optionNumber - 1] ?? `Option ${optionNumber}`
}

function roleLabel(role) {
  return role === 'father' ? 'Father' : 'Mother'
}

export default function LiveAdminAnalysisPage() {
  const [pin] = useState(() => {
    try {
      return sessionStorage.getItem(PIN_STORAGE_KEY) || ''
    } catch {
      return ''
    }
  })
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!pin) {
      setLoading(false)
      return
    }
    const { data: payload, error: err } = await adminLiveQuizDetailedAnalysis(pin)
    setLoading(false)
    if (err) {
      setError(err.message || 'Could not load analysis.')
      return
    }
    setData(payload)
    setError('')
  }, [pin])

  useEffect(() => {
    refresh()
    const id = window.setInterval(refresh, 5000)
    return () => window.clearInterval(id)
  }, [refresh])

  const questions = data?.questions ?? []

  return (
    <div className="login-page live-page">
      <div className="login-card live-card live-card--analysis">
        <img
          src={`${import.meta.env.BASE_URL}aqqa-logo.png`}
          alt="Al Quran Qirat Academy"
          className="login-logo"
        />
        <h1 className="login-brand">{APP_NAME}</h1>
        <p className="login-tagline">{APP_TAGLINE}</p>
        <h2 className="login-portal">Live session — Full analysis</h2>

        {!pin && (
          <p className="login-error" role="alert">
            Open the <Link to="/live/admin">admin controls</Link> and enter the host PIN first.
          </p>
        )}

        {!supabaseConfigured && (
          <p className="login-error" role="alert">
            Live session is not configured on this server yet.
          </p>
        )}

        {loading && pin && <p className="live-muted">Loading analysis…</p>}
        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}

        {data && (
          <div className="live-analysis-summary">
            <p>
              <strong>{Number(data.total_participants) || 0}</strong> families joined ·{' '}
              <strong>{Number(data.total_votes) || 0}</strong> total answers recorded
            </p>
          </div>
        )}

        {questions.map((block) => {
          const qNum = block.question_number
          const qMeta = LIVE_QUIZ_QUESTIONS.find((q) => q.number === qNum)
          const title = qMeta?.title ?? `Question ${qNum}`
          const counts = block.option_counts || [0, 0, 0]
          const responses = block.responses || []

          return (
            <section key={qNum} className="live-analysis-question">
              <h3 className="live-analysis-q-title">{title}</h3>
              <p className="live-muted">
                {Number(block.total_answers) || 0} answers across all rounds
              </p>
              <ul className="live-stats-votes live-analysis-votes">
                {(qMeta?.options ?? ['Option 1', 'Option 2', 'Option 3']).map((label, idx) => {
                  const n = Number(counts[idx]) || 0
                  const total = Number(block.total_answers) || 0
                  const pct = total > 0 ? Math.round((n / total) * 100) : 0
                  return (
                    <li key={label}>
                      <span className="live-stats-option-label">{label}</span>
                      <span className="live-stats-option-count">
                        {n} ({pct}%)
                      </span>
                      <div className="live-stats-bar-wrap">
                        <div className="live-stats-bar" style={{ width: total > 0 ? `${pct}%` : 0 }} />
                      </div>
                    </li>
                  )
                })}
              </ul>

              {responses.length > 0 ? (
                <table className="live-analysis-table">
                  <thead>
                    <tr>
                      <th>Child</th>
                      <th>Parent</th>
                      <th>Answer</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {responses.map((row) => (
                      <tr key={`${row.round_id}-${row.participant_id}`}>
                        <td>{row.kid_name}</td>
                        <td>{roleLabel(row.parent_role)}</td>
                        <td>{optionLabel(qNum, row.option_number)}</td>
                        <td>
                          {row.answered_at
                            ? new Date(row.answered_at).toLocaleString()
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="live-muted">No answers yet for this question.</p>
              )}
            </section>
          )
        })}

        <div className="live-admin-nav">
          <Link to="/live/admin" className="btn ghost">
            ← Back to host controls
          </Link>
        </div>
      </div>
    </div>
  )
}