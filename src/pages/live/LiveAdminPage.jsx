import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getQuestionFromList } from '../../data/liveQuizQuestions'
import LiveAdminAnalysisPanel from '../../components/live/LiveAdminAnalysisPanel'
import LiveAdminSidebar, { liveAdminSectionTitle } from '../../components/live/LiveAdminSidebar'
import LiveAdminSubTabs from '../../components/live/LiveAdminSubTabs'
import LiveQuizConfig from '../../components/live/LiveQuizConfig'
import { LiveUsersDashboard, LiveUsersRoster } from '../../components/live/LiveUsersPanel'
import { useLiveQuizDisplay } from '../../hooks/useLiveQuizDisplay'
import { useLiveQuizQuestions } from '../../hooks/useLiveQuizQuestions'
import {
  adminListParticipants,
  adminLiveQuizStats,
  adminRemoveParticipant,
  adminSetActiveGroup,
  adminShowOption,
  adminShowWait,
  subscribeLiveQuizVotes,
  verifyAdminPin,
} from '../../services/liveQuiz'
import { supabaseConfigured } from '../../services/supabase'

const PIN_STORAGE_KEY = 'aqqa_live_admin_pin'
const ACTIVE_GROUP_KEY = 'aqqa_live_active_group_id'
const SENT_QUESTIONS_KEY = 'aqqa_live_sent_questions'
const SUPPRESS_SEND_TICKS_KEY = 'aqqa_live_suppress_send_ticks'

function readSuppressSendTicks() {
  try {
    return sessionStorage.getItem(SUPPRESS_SEND_TICKS_KEY) === '1'
  } catch {
    return false
  }
}

function readSentQuestionSet() {
  if (readSuppressSendTicks()) return new Set()
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

const HOST_SUBTABS = [
  { id: 'overview', label: 'Live overview' },
  { id: 'questions', label: 'Send questions' },
]

const USERS_SUBTABS = [
  { id: 'dashboard', label: 'Summary' },
  { id: 'roster', label: 'Family list' },
]

const SETUP_SUBTABS = [
  { id: 'groups', label: 'Question groups' },
  { id: 'questions', label: 'Questions' },
  { id: 'reset', label: 'Reset session' },
]

function resolveInitialSection(location) {
  const tab = location.state?.tab
  if (tab === 'analysis') return 'analysis'
  if (tab === 'config') return 'setup'
  return 'host'
}

function defaultSubTab(section) {
  if (section === 'users') return 'dashboard'
  if (section === 'setup') return 'groups'
  if (section === 'host') return 'overview'
  return ''
}

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

function readActiveGroupId() {
  try {
    const raw = sessionStorage.getItem(ACTIVE_GROUP_KEY)
    return raw ? Number(raw) : null
  } catch {
    return null
  }
}

export default function LiveAdminPage() {
  const [pin, setPin] = useState(readStoredPin)
  const [pinUnlocked, setPinUnlocked] = useState(false)
  const [pinChecking, setPinChecking] = useState(true)
  const [pinInput, setPinInput] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [participants, setParticipants] = useState([])
  const [stats, setStats] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const location = useLocation()
  const [section, setSection] = useState(() => resolveInitialSection(location))
  const [subTab, setSubTab] = useState(() => defaultSubTab(resolveInitialSection(location)))
  const [suppressSendTicks, setSuppressSendTicks] = useState(readSuppressSendTicks)
  const [sentQuestionNums, setSentQuestionNums] = useState(readSentQuestionSet)
  const [sendRowsRevision, setSendRowsRevision] = useState(0)
  const lastFreshRoundRef = useRef(null)

  const [activeGroupId, setActiveGroupId] = useState(readActiveGroupId)

  const display = useLiveQuizDisplay()
  const {
    rows: questionRows,
    groups,
    questions: allSendableQuestions,
    refresh: refreshQuestions,
  } = useLiveQuizQuestions()

  const sendableQuestions = useMemo(() => {
    if (activeGroupId == null) return allSendableQuestions
    return allSendableQuestions.filter((q) => Number(q.groupId) === Number(activeGroupId))
  }, [allSendableQuestions, activeGroupId])

  useEffect(() => {
    if (groups.length && activeGroupId == null) {
      setActiveGroupId(groups[0].id)
    }
  }, [groups, activeGroupId])

  useEffect(() => {
    let active = true
    async function checkStoredPin() {
      const stored = readStoredPin()
      if (!stored) {
        if (active) setPinChecking(false)
        return
      }
      const { data, error } = await verifyAdminPin(stored)
      if (!active) return
      setPinChecking(false)
      if (!error && data) {
        setPin(stored)
        setPinUnlocked(true)
      } else {
        sessionStorage.removeItem(PIN_STORAGE_KEY)
        setPin('')
      }
    }
    checkStoredPin()
    return () => {
      active = false
    }
  }, [])

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

  /** When server is reset (new round, no answers), hide all ✓ above Send. */
  useEffect(() => {
    if (!stats?.round_id) return
    const waiting =
      stats.phase === 'waiting' && (stats.question_number == null || stats.question_number === null)
    const noAnswers = Number(stats.answered_count) === 0
    if (!waiting || !noAnswers) return
    if (lastFreshRoundRef.current === stats.round_id) return
    lastFreshRoundRef.current = stats.round_id
    sessionStorage.setItem(SUPPRESS_SEND_TICKS_KEY, '1')
    sessionStorage.removeItem(SENT_QUESTIONS_KEY)
    setSuppressSendTicks(true)
    setSentQuestionNums(new Set())
    setSendRowsRevision((v) => v + 1)
  }, [
    stats?.round_id,
    stats?.phase,
    stats?.question_number,
    stats?.answered_count,
  ])

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

  async function handleUnlock(e) {
    e.preventDefault()
    setActionError('')
    const candidate = pinInput.trim()
    if (!candidate) {
      setActionError('Enter the host PIN.')
      return
    }
    setPinChecking(true)
    const { data, error } = await verifyAdminPin(candidate)
    setPinChecking(false)
    if (error || !data) {
      setActionError('Invalid host PIN. Access denied.')
      setPinUnlocked(false)
      sessionStorage.removeItem(PIN_STORAGE_KEY)
      return
    }
    setPin(candidate)
    setPinUnlocked(true)
    sessionStorage.setItem(PIN_STORAGE_KEY, candidate)
  }

  async function handleActiveGroupChange(groupId) {
    setActiveGroupId(groupId)
    if (groupId != null) {
      try {
        sessionStorage.setItem(ACTIVE_GROUP_KEY, String(groupId))
      } catch {
        /* ignore */
      }
      if (pinUnlocked && pin && groupId > 0) {
        await adminSetActiveGroup(pin, groupId)
      }
    }
  }

  function openPresentationWindow() {
    const base = import.meta.env.BASE_URL || '/'
    const url = `${window.location.origin}${base}#/live/admin/present`
    window.open(url, 'aqqa-live-present', 'noopener,noreferrer,width=1280,height=800')
  }

  function markQuestionSent(questionNumber) {
    try {
      sessionStorage.removeItem(SUPPRESS_SEND_TICKS_KEY)
    } catch {
      /* ignore */
    }
    setSuppressSendTicks(false)
    setSentQuestionNums((prev) => {
      const next = new Set(prev)
      next.add(questionNumber)
      persistSentQuestionSet(next)
      return next
    })
  }

  function resetSentQuestionMarks() {
    try {
      sessionStorage.setItem(SUPPRESS_SEND_TICKS_KEY, '1')
      sessionStorage.removeItem(SENT_QUESTIONS_KEY)
    } catch {
      /* ignore */
    }
    setSuppressSendTicks(true)
    setSentQuestionNums(new Set())
    setSendRowsRevision((v) => v + 1)
  }

  function handleSessionFreshStart() {
    resetSentQuestionMarks()
    lastFreshRoundRef.current = null
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

  const activeGroup = useMemo(
    () => groups.find((g) => Number(g.id) === Number(activeGroupId)),
    [groups, activeGroupId],
  )

  const activeGroupName = activeGroup?.name || 'No group selected'
  const activeGroupLabel = activeGroup
    ? `${activeGroup.name} · ${activeGroup.mode === 'competition' ? 'Competition' : 'Poll'}`
    : null

  function handleSectionChange(next) {
    setSection(next)
    setSubTab(defaultSubTab(next))
  }

  const sectionSubTabs =
    section === 'host'
      ? HOST_SUBTABS
      : section === 'users'
        ? USERS_SUBTABS
        : section === 'setup'
          ? SETUP_SUBTABS
          : []

  const questionSendList = (
    <div className="live-admin-questions" key={`send-rows-${sendRowsRevision}`}>
      {sendableQuestions.length === 0 ? (
        <p className="live-muted live-admin-empty">
          No questions in this group yet. Add them under Session setup → Questions.
        </p>
      ) : (
        sendableQuestions.map((q) => {
          const isLive =
            display.displayPhase === 'question' && display.questionNumber === q.number
          const wasSent = !suppressSendTicks && sentQuestionNums.has(q.number)
          return (
            <div
              key={q.number}
              className={`live-admin-question-row ${wasSent ? 'live-admin-question-row--sent' : ''}`}
            >
              <div className="live-admin-question-body">
                <p className="live-admin-question-badge">
                  Q{q.number}
                  {q.isCompetition ? ' · Competition' : ' · Poll'}
                </p>
                <h3 className="live-admin-question-title">{q.title}</h3>
                <ol className="live-admin-option-preview">
                  {q.options.map((label, idx) => (
                    <li key={idx}>
                      <span className="live-admin-option-num">{idx + 1}</span>
                      <span>{label}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="live-admin-send-wrap">
                {wasSent && (
                  <span className="live-admin-sent-badge" aria-label="Already sent">
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
        })
      )}
    </div>
  )

  return (
    <div className="live-admin-shell">
      {!supabaseConfigured && (
        <p className="live-admin-banner-error" role="alert">
          Live session is not configured on this server yet.
        </p>
      )}

      {pinChecking && (
        <div className="live-admin-login-wrap">
          <p className="live-muted" role="status">
            Checking host PIN…
          </p>
        </div>
      )}

      {!pinChecking && !pinUnlocked ? (
        <div className="live-admin-login-wrap">
          <div className="live-admin-login-card">
            <img
              src={`${import.meta.env.BASE_URL}aqqa-logo.png`}
              alt=""
              className="live-admin-login-logo"
            />
            <h1 className="live-admin-login-title">Live host dashboard</h1>
            <p className="live-muted live-admin-login-sub">
              Al Quran Qirat Academy — secure access for session hosts only.
            </p>
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
              {actionError && (
                <p className="login-error" role="alert">
                  {actionError}
                </p>
              )}
              <button
                type="submit"
                className="btn primary live-admin-login-btn"
                disabled={!supabaseConfigured || pinChecking}
              >
                Sign in to dashboard
              </button>
            </form>
          </div>
        </div>
      ) : !pinChecking ? (
        <div className="live-admin-layout">
          <LiveAdminSidebar
            active={section}
            onChange={handleSectionChange}
            onLock={handleLock}
            activeGroupLabel={activeGroupLabel}
          />

          <main className="live-admin-main">
            <header className="live-admin-topbar">
              <div className="live-admin-topbar-text">
                <h1 className="live-admin-page-title">{liveAdminSectionTitle(section)}</h1>
                {section === 'host' && activeGroupLabel && (
                  <p className="live-admin-page-sub">
                    Sending questions from <strong>{activeGroupName}</strong>
                  </p>
                )}
              </div>
              <div className="live-admin-topbar-actions">
                <label className="live-sr-only" htmlFor="live-host-active-group">
                  Hosting group
                </label>
                <select
                  id="live-host-active-group"
                  className="live-admin-topbar-select"
                  value={activeGroupId ?? ''}
                  onChange={(e) => handleActiveGroupChange(Number(e.target.value))}
                  disabled={busy || groups.length === 0}
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn primary live-present-open"
                  onClick={openPresentationWindow}
                >
                  Presentation screen
                </button>
              </div>
            </header>

            <LiveAdminSubTabs
              tabs={sectionSubTabs}
              active={subTab}
              onChange={setSubTab}
              ariaLabel={`${liveAdminSectionTitle(section)} sections`}
            />

            {actionError && (
              <p className="login-error live-admin-inline-error" role="alert">
                {actionError}
              </p>
            )}

            <div className="live-admin-content">
              {section === 'host' && subTab === 'overview' && (
                <div className="live-admin-pane" role="tabpanel">
                  <LiveStatsOverview stats={stats} question={statsQuestion} />
                  <div className="live-admin-preview live-admin-preview--card" aria-live="polite">
                    <span className="live-admin-preview-label">Parents currently see</span>
                    <p className="live-admin-preview-value">
                      {preview.displayPhase === 'waiting' && 'Waiting for the next question'}
                      {preview.displayPhase === 'question' &&
                        activeQuestion &&
                        `${activeQuestion.title} — tap 1–${activeQuestion.optionCount} (${preview.remainingSec}s)`}
                      {preview.displayPhase === 'timed_out' && 'Timed out — waiting for host'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn primary live-wait-btn"
                    onClick={showWait}
                    disabled={busy || !supabaseConfigured}
                  >
                    End round — show “wait for next” to everyone
                  </button>
                  <p className="live-muted live-present-hint">
                    For competition groups, scores are calculated when you end the round. Use
                    Presentation screen for the leaderboard.
                  </p>
                </div>
              )}

              {section === 'host' && subTab === 'questions' && (
                <div className="live-admin-pane" role="tabpanel">
                  {questionSendList}
                </div>
              )}

              {section === 'users' && subTab === 'dashboard' && (
                <div className="live-admin-pane" role="tabpanel">
                  <LiveUsersDashboard participants={participants} />
                </div>
              )}

              {section === 'users' && subTab === 'roster' && (
                <div className="live-admin-pane" role="tabpanel">
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

              {section === 'setup' && (
                <div className="live-admin-pane" role="tabpanel">
                  <LiveQuizConfig
                    pin={pin}
                    groups={groups}
                    rows={questionRows}
                    view={subTab}
                    activeGroupName={activeGroupName}
                    activeGroupId={activeGroupId}
                    onActiveGroupChange={handleActiveGroupChange}
                    disabled={busy || !supabaseConfigured}
                    onSaved={() => {
                      refreshQuestions()
                      refreshStats()
                    }}
                    onCleared={handleSessionFreshStart}
                  />
                </div>
              )}

              {section === 'analysis' && (
                <div className="live-admin-pane" role="tabpanel">
                  <LiveAdminAnalysisPanel pin={pin} />
                </div>
              )}
            </div>
          </main>
        </div>
      ) : null}
    </div>
  )
}