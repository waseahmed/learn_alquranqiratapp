import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getQuestionFromList } from '../../data/liveQuizQuestions'
import LiveAdminAnalysisPanel from '../../components/live/LiveAdminAnalysisPanel'
import LiveAdminHeader from '../../components/live/LiveAdminHeader'
import LiveQuizConfig from '../../components/live/LiveQuizConfig'
import { LiveUsersDashboard, LiveUsersRoster } from '../../components/live/LiveUsersPanel'
import { useLiveQuizDisplay } from '../../hooks/useLiveQuizDisplay'
import { useLiveQuizQuestions } from '../../hooks/useLiveQuizQuestions'
import {
  adminListParticipants,
  adminLiveQuizStats,
  adminRemoveParticipant,
  adminShowOption,
  adminShowWait,
  subscribeLiveQuizVotes,
} from '../../services/liveQuiz'
import { supabaseConfigured } from '../../services/supabase'

const PIN_STORAGE_KEY = 'aqqa_live_admin_pin'
const SENT_QUESTIONS_KEY = 'aqqa_live_sent_questions'

function readSentQuestionSet() {
  try {
    const raw = sessionStorage.getItem(SENT_QUESTIONS_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr.map(Number) : [])
  } catch {
    return new Set()
  }
}

function persistSentQuestionSet(set) {
  try {
    sessionStorage.setItem(SENT_QUESTIONS_KEY, JSON.stringify([...set]))
  } catch {
    /* ignore */
  }
}

const TABS = [
  { id: 'host', label: 'Host' },
  { id: 'users', label: 'Live users' },
  { id: 'config', label: 'Config' },
  { id: 'analysis', label: 'Analysis' },
]

function readStoredPin() {
  try {
    return sessionStorage.getItem(PIN_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

function LiveStatsOverview({ stats, question }) {
  if (!stats) return null

  const counts = (stats.option_counts || [0, 0, 0]).map(Number)
  const totalJoined = Number(stats.total_joined) || 0
  const answered = Number(stats.answered_count) || 0
  const notAnswered = Math.max(0, totalJoined - answered)

  const optionLabels = question?.options?.length
    ? question.options
    : ['Answer 1', 'Answer 2', 'Answer 3'].slice(0, 3)

  return (
    <section className="live-stats-panel" aria-labelledby="live-stats-heading">
      <h3 id="live-stats-heading" className="live-stats-heading">
        Answer overview
        {question?.title
          ? ` — ${question.title}`
          : stats.question_number
            ? ` — Question ${stats.question_number}`
            : ''}
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
        {optionLabels.map((label, idx) => {
          const n = Number(counts[idx]) || 0
          const pct = answered > 0 ? Math.round((n / answered) * 100) : 0
          return (
            <li key={`${idx}-${label}`}>
              <span className="live-stats-option-label">
                {idx + 1}. {label}
              </span>
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
  const [now, setNow] = useState(() => Date.now())
  const location = useLocation()
  const initialTab = location.state?.tab === 'analysis' ? 'analysis' : 'host'
  const [tab, setTab] = useState(initialTab)
  const [sentQuestionNums, setSentQuestionNums] = useState(readSentQuestionSet)

  const display = useLiveQuizDisplay()
  const { rows: questionRows, questions: sendableQuestions, refresh: refreshQuestions } =
    useLiveQuizQuestions()

  const activeQuestion = useMemo(
    () => getQuestionFromList(questionRows, display.questionNumber),
    [questionRows, display.questionNumber],
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

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 5000)
    return () => window.clearInterval(id)
  }, [])

  async function removeParticipant(id) {
    if (!window.confirm('Remove this family from the live session?')) return
    setActionError('')
    const { error } = await adminRemoveParticipant(pin, id)
    if (error) {
      setActionError(error.message || 'Could not remove participant.')
      return
    }
    refreshParticipants()
    refreshStats()
  }

  function handleUnlock(e) {
    e.preventDefault()
    setPin(pinInput.trim())
    setPinUnlocked(true)
    setActionError('')
  }

  function markQuestionSent(questionNumber) {
    setSentQuestionNums((prev) => {
      const next = new Set(prev)
      next.add(questionNumber)
      persistSentQuestionSet(next)
      return next
    })
  }

  function resetSentQuestionMarks() {
    sessionStorage.removeItem(SENT_QUESTIONS_KEY)
    setSentQuestionNums(new Set())
  }

  function handleSessionFreshStart() {
    resetSentQuestionMarks()
    setStats((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        phase: 'waiting',
        question_number: null,
        round_id: null,
        answered_count: 0,
        option_counts: [0, 0, 0],
        host_option: null,
        answered_participant_ids: [],
      }
    })
    refreshStats()
    refreshParticipants()
  }

  function handleLock() {
    sessionStorage.removeItem(PIN_STORAGE_KEY)
    resetSentQuestionMarks()
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

  async function sendQuestion(questionNumber) {
    setActionError('')
    setBusy(true)
    const { error } = await adminShowOption(pin, questionNumber, 1)
    setBusy(false)
    if (error) {
      setActionError(error.message || 'Action failed.')
      if (error.message?.toLowerCase().includes('invalid admin pin')) {
        handleLock()
      }
      return
    }
    markQuestionSent(questionNumber)
    refreshParticipants()
    refreshStats()
  }

  async function showWait() {
    await runAction(() => adminShowWait(pin))
  }

  const preview = display
  const statsQuestion =
    activeQuestion || getQuestionFromList(questionRows, stats?.question_number) || null

  const answeredParticipantIds = useMemo(() => {
    const ids = stats?.answered_participant_ids
    if (!Array.isArray(ids)) return new Set()
    return new Set(ids.map(String))
  }, [stats?.answered_participant_ids])

  return (
    <div className="login-page live-page live-page--admin-wide">
      <div className="login-card live-card live-card--admin live-card--admin-tabs">
        <LiveAdminHeader />

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
            <div className="live-admin-tabs" role="tablist" aria-label="Admin sections">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className={`live-admin-tab ${tab === t.id ? 'live-admin-tab--active' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {actionError && (
              <p className="login-error" role="alert">
                {actionError}
              </p>
            )}

            {tab === 'host' && (
              <div className="live-admin-tab-panel" role="tabpanel">
                <LiveStatsOverview stats={stats} question={statsQuestion} />

                <div className="live-admin-preview" aria-live="polite">
                  <span className="live-admin-preview-label">Audience sees:</span>
                  {preview.displayPhase === 'waiting' && (
                    <strong>Waiting for next question</strong>
                  )}
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
                  {sendableQuestions.map((q) => {
                    const isLive =
                      display.displayPhase === 'question' &&
                      display.questionNumber === q.number
                    const wasSent = sentQuestionNums.has(q.number)
                    return (
                      <div
                        key={q.number}
                        className={`live-admin-question-row ${wasSent ? 'live-admin-question-row--sent' : ''}`}
                      >
                        <div className="live-admin-question-body">
                          <h3 className="live-admin-question-title">{q.title}</h3>
                          <ol className="live-admin-option-preview">
                            {q.options.map((label, idx) => (
                              <li key={idx}>
                                <span className="live-admin-option-num">{idx + 1}</span>
                                <span>{label}</span>
                              </li>
                            ))}
                          </ol>
                          <p className="live-admin-q-meta live-muted">
                            Parents see numbers 1–{q.optionCount} during the live round.
                          </p>
                        </div>
                        <div className="live-admin-send-wrap">
                          {wasSent && (
                            <span
                              className="live-admin-sent-badge"
                              title="You already sent this question this session"
                              aria-label="Already sent"
                            >
                              ✓
                            </span>
                          )}
                          <button
                            type="button"
                            className={`btn ${isLive ? 'primary' : 'ghost'} live-send-question-btn`}
                            onClick={() => sendQuestion(q.number)}
                            disabled={busy || !supabaseConfigured}
                          >
                            {isLive ? 'Live' : 'Send'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {tab === 'users' && (
              <div className="live-admin-tab-panel" role="tabpanel">
                <LiveUsersDashboard participants={participants} />
                <LiveUsersRoster
                  participants={participants}
                  now={now}
                  onRemove={removeParticipant}
                  busy={busy}
                  answeredParticipantIds={answeredParticipantIds}
                  showAnswered={
                    display.displayPhase === 'question' && Boolean(display.roundId)
                  }
                />
              </div>
            )}

            {tab === 'config' && (
              <div className="live-admin-tab-panel" role="tabpanel">
                <LiveQuizConfig
                  pin={pin}
                  rows={questionRows}
                  disabled={busy || !supabaseConfigured}
                  onSaved={() => {
                    refreshQuestions()
                    refreshStats()
                  }}
                  onCleared={handleSessionFreshStart}
                />
              </div>
            )}

            {tab === 'analysis' && (
              <div className="live-admin-tab-panel" role="tabpanel">
                <LiveAdminAnalysisPanel pin={pin} />
              </div>
            )}

            <button type="button" className="btn ghost live-lock-btn" onClick={handleLock}>
              Lock host screen
            </button>
          </>
        )}
      </div>
    </div>
  )
}