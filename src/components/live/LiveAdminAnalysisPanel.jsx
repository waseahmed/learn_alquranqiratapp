import { useCallback, useEffect, useState } from 'react'
import {
  getFullOptionLabel,
  getQuestionFromList,
} from '../../data/liveQuizQuestions'
import { useLiveQuizQuestions } from '../../hooks/useLiveQuizQuestions'
import { adminLiveQuizDetailedAnalysis } from '../../services/liveQuiz'

function roleLabel(role) {
  return role === 'father' ? 'Father' : 'Mother'
}

export default function LiveAdminAnalysisPanel({ pin }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(Boolean(pin))
  const { rows: questionRows } = useLiveQuizQuestions()

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
    setLoading(Boolean(pin))
    refresh()
    if (!pin) return undefined
    const id = window.setInterval(refresh, 5000)
    return () => window.clearInterval(id)
  }, [pin, refresh])

  const questions = data?.questions ?? []

  if (!pin) {
    return (
      <p className="login-error" role="alert">
        Enter the host PIN on this page to load analysis.
      </p>
    )
  }

  return (
    <div className="live-analysis-panel">
      {loading && <p className="live-muted">Loading analysis…</p>}
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
        const qMeta = getQuestionFromList(questionRows, qNum)
        const title = qMeta?.title ?? `Question ${qNum}`
        const counts = block.option_counts || [0, 0, 0]
        const responses = block.responses || []
        const optionLabels = qMeta?.options?.length
          ? qMeta.options
          : ['Answer 1', 'Answer 2', 'Answer 3'].slice(0, counts.length)

        return (
          <section key={qNum} className="live-analysis-question">
            <h3 className="live-analysis-q-title">{title}</h3>
            <p className="live-muted">
              {Number(block.total_answers) || 0} answers across all rounds
            </p>
            <ul className="live-stats-votes live-analysis-votes">
              {optionLabels.map((label, idx) => {
                const n = Number(counts[idx]) || 0
                const total = Number(block.total_answers) || 0
                const pct = total > 0 ? Math.round((n / total) * 100) : 0
                return (
                  <li key={label}>
                    <span className="live-stats-option-label">
                      {idx + 1}. {label}
                    </span>
                    <span className="live-stats-option-count">
                      {n} ({pct}%)
                    </span>
                    <div className="live-stats-bar-wrap">
                      <div
                        className="live-stats-bar"
                        style={{ width: total > 0 ? `${pct}%` : 0 }}
                      />
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
                      <td>
                        {row.option_number}. {getFullOptionLabel(qMeta, row.option_number)}
                      </td>
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
    </div>
  )
}