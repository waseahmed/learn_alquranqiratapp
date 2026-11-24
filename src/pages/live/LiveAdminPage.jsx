import { useCallback, useEffect, useMemo, useState } from 'react'
import { APP_NAME, APP_TAGLINE } from '../../config'
import { LIVE_QUIZ_QUESTIONS } from '../../data/liveQuizQuestions'
import { useLiveQuizDisplay } from '../../hooks/useLiveQuizDisplay'
import {
  adminListParticipants,
  adminLiveQuizStats,
  adminShowOption,
  adminShowWait,
  subscribeLiveQuizVotes,
} from '../../services/liveQuiz'
import { supabaseConfigured } from '../../services/supabase'

const PIN_STORAGE_KEY = 'aqqa_live_admin_pin'

function readStoredPin() {
  try {
    return sessionStorage.getItem(PIN_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

function LiveStatsOverview({ stats, question }) {
  if (!stats) return null

  const counts = stats.option_counts || [0, 0, 0]
  const totalJoined = Number(stats.total_joined) || 0
  const answered = Number(stats.answered_count) || 0
  const notAnswered = Math.max(0, totalJoined - answered)

  const options = question?.options ?? ['Option 1', 'Option 2', 'Option 3']
  return (
    <section className="live-stats-panel" aria-labelledby="live-stats-heading">
      <h3 id="live-stats-heading" className="live-stats-heading">
        Answer overview
        {stats.question_number ? ` — Question ${stats.question_number}` : ''}
      </h3>
      <ul className="live-stats-summary">
        <li>
          <span className="live-stats-k">Joined</span>
          <span className="live-stats-v">{totalJoined}</span>
        </li>
        <li>
          <span className="live-stats-k">Answered</span>
          <span className="live-stats-v">{answered}</span>
        </li>
        <li>
          <span className="live-stats-k">No answer yet</span>
          <span className="live-stats-v">{notAnswered}</span>
        </li>
      </ul>
      <ul className="live-stats-votes">
        {options.map((label, idx) => {
          const n = Number(counts[idx]) || 0
          const pct = answered > 0 ? Math.round((n / answered) * 100) : 0
          return (
            <li key={label}>
              <span className="live-stats-option-label">{label}</span>
              <span className="live-stats-option-count">
                {n} vote{n === 1 ? '' : 's'}
                {answered > 0 ? ` · ${pct}%` : ''}
              </span>
              <div className="live-stats-bar-wrap">
                <div
                  className="live-stats-bar"
                  style={{ width: answered > 0 ? `${pct}%` : '0%' }}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default function LiveAdminPage() {
  const [pin, setPin] = useState(readStoredPin)
  const [pinUnlocked, setPinUnlocked] = useState(Boolean(readStoredPin()))
  const [pinInput, setPinInput] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [participants, setParticipants] = useState([])
  const [stats, setStats] = useState(null)

  const display = useLiveQuizDisplay()

  const activeQuestion = useMemo(
    () => LIVE_QUIZ_QUESTIONS.find((q) => q.number === display.questionNumber) ?? null,
    [display.questionNumber],
  )

  const refreshStats = useCallback(async () => {
    if (!pinUnlocked || !pin) return
    const { data, error } = await adminLiveQuizStats(pin)
    if (!error && data) setStats(data)
  }, [pin, pinUnlocked])

  const refreshParticipants = useCallback(async () => {
    if (!pinUnlocked || !pin) return
    const { data, error } = await adminListParticipants(pin)
    if (!error && data) setParticipants(data)
  }, [pin, pinUnlocked])

  useEffect(() => {
    if (!pinUnlocked) return undefined
    sessionStorage.setItem(PIN_STORAGE_KEY, pin)
    refreshParticipants()
    refreshStats()
    const id = window.setInterval(() => {
      refreshParticipants()
      refreshStats()
    }, 3000)
    const unsubVotes = subscribeLiveQuizVotes(refreshStats)
    return () => {
      window.clearInterval(id)
      unsubVotes()
    }
  }, [pinUnlocked, pin, refreshParticipants, refreshStats])

  useEffect(() => {
    refreshStats()
  }, [display.roundId, display.displayPhase, refreshStats])

  function handleUnlock(e) {
    e.preventDefault()
    setPin(pinInput.trim())
    setPinUnlocked(true)
    setActionError('')
  }

  function handleLock() {
    sessionStorage.removeItem(PIN_STORAGE_KEY)
    setPinUnlocked(false)
    setPin('')
    setPinInput('')
    setParticipants([])
    setStats(null)
  }

  async function runAction(fn) {
    setActionError('')
    setBusy(true)
    const { error } = await fn()
    setBusy(false)
    if (error) {
      setActionError(error.message || 'Action failed.')
      if (error.message?.toLowerCase().includes('invalid admin pin')) {
        handleLock()
      }
      return
    }
    refreshParticipants()
    refreshStats()
  }

  async function showOption(questionNumber, optionNumber) {
    await runAction(() => adminShowOption(pin, questionNumber, optionNumber))
  }

  async function showWait() {
    await runAction(() => adminShowWait(pin))
  }

  const preview = display
  const statsQuestion =
    activeQuestion ||
    LIVE_QUIZ_QUESTIONS.find((q) => q.number === stats?.question_number) ||
    null

  return (
    <div className="login-page live-page">
      <div className="login-card live-card live-card--admin">
        <img
          src={`${import.meta.env.BASE_URL}aqqa-logo.png`}
          alt="Al Quran Qirat Academy"
          className="login-logo"
        />
        <h1 className="login-brand">{APP_NAME}</h1>
        <p className="login-tagline">{APP_TAGLINE}</p>
        <h2 className="login-portal">Live session — Admin</h2>

        {!supabaseConfigured && (
          <p className="login-error" role="alert">
            Live session is not configured on this server yet.
          </p>
        )}

        {!pinUnlocked ? (
          <form className="login-form" onSubmit={handleUnlock}>
            <label htmlFor="admin-pin">Host PIN</label>
            <input
              id="admin-pin"
              name="adminPin"
              type="password"
              autoComplete="off"
              required
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              disabled={!supabaseConfigured}
            />
            <p className="live-muted live-pin-hint">
              Default after setup: <code>aqqa-live</code> — change in Supabase (
              <code>live_quiz_secrets</code>).
            </p>
            <button type="submit" className="btn primary" disabled={!supabaseConfigured}>
              Open host controls
            </button>
          </form>
        ) : (
          <>
            <LiveStatsOverview stats={stats} question={statsQuestion} />

            <div className="live-admin-preview" aria-live="polite">
              <span className="live-admin-preview-label">Audience sees:</span>
              {preview.displayPhase === 'waiting' && <strong>Waiting for next question</strong>}
              {preview.displayPhase === 'question' && activeQuestion && (
                <strong>
                  {activeQuestion.title} — all options ({preview.remainingSec}s)
                </strong>
              )}
              {preview.displayPhase === 'timed_out' && <strong>Timed out</strong>}
            </div>

            <button
              type="button"
              className="btn primary live-wait-btn"
              onClick={showWait}
              disabled={busy || !supabaseConfigured}
            >
              Show “wait for next one” to everyone
            </button>

            <div className="live-admin-questions">
              {LIVE_QUIZ_QUESTIONS.map((q) => (
                <div key={q.number} className="live-admin-question-row">
                  <h3 className="live-admin-question-title">{q.title}</h3>
                  <div className="live-admin-options-inline">
                    <span className="live-send-label">Send:</span>
                    {q.options.map((label, idx) => {
                      const optionNum = idx + 1
                      const isLive =
                        display.questionNumber === q.number &&
                        display.displayPhase !== 'waiting'
                      return (
                        <button
                          key={optionNum}
                          type="button"
                          className={`btn ${isLive ? 'primary' : 'ghost'} live-option-btn-inline`}
                          onClick={() => showOption(q.number, optionNum)}
                          disabled={busy || !supabaseConfigured}
                          title={`Open ${q.title} — parents see all choices including ${label}`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {actionError && (
              <p className="login-error" role="alert">
                {actionError}
              </p>
            )}

            <details className="live-participants">
              <summary>Joined ({participants.length})</summary>
              <ul className="live-participants-list">
                {participants.map((p) => (
                  <li key={p.id}>
                    {p.kid_name} — {p.parent_role === 'father' ? 'Father' : 'Mother'}
                  </li>
                ))}
              </ul>
            </details>

            <button type="button" className="btn ghost" onClick={handleLock}>
              Lock host screen
            </button>
          </>
        )}
      </div>
    </div>
  )
}