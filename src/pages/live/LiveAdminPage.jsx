import { useCallback, useEffect, useState } from 'react'
import { APP_NAME, APP_TAGLINE } from '../../config'
import { LIVE_QUIZ_QUESTIONS } from '../../data/liveQuizQuestions'
import { useLiveQuizDisplay } from '../../hooks/useLiveQuizDisplay'
import {
  adminListParticipants,
  adminShowOption,
  adminShowWait,
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

export default function LiveAdminPage() {
  const [pin, setPin] = useState(readStoredPin)
  const [pinUnlocked, setPinUnlocked] = useState(Boolean(readStoredPin()))
  const [pinInput, setPinInput] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [participants, setParticipants] = useState([])

  const display = useLiveQuizDisplay()

  const refreshParticipants = useCallback(async () => {
    if (!pinUnlocked || !pin) return
    const { data, error } = await adminListParticipants(pin)
    if (!error && data) setParticipants(data)
  }, [pin, pinUnlocked])

  useEffect(() => {
    if (!pinUnlocked) return undefined
    sessionStorage.setItem(PIN_STORAGE_KEY, pin)
    refreshParticipants()
    const id = window.setInterval(refreshParticipants, 8000)
    return () => window.clearInterval(id)
  }, [pinUnlocked, pin, refreshParticipants])

  useEffect(() => {
    if (display.displayPhase === 'waiting') refreshParticipants()
  }, [display.displayPhase, refreshParticipants])

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
  }

  async function showOption(questionNumber, optionNumber) {
    await runAction(() => adminShowOption(pin, questionNumber, optionNumber))
  }

  async function showWait() {
    await runAction(() => adminShowWait(pin))
  }

  const preview = display

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
            <div className="live-admin-preview" aria-live="polite">
              <span className="live-admin-preview-label">Audience sees:</span>
              {preview.displayPhase === 'waiting' && <strong>Waiting for next question</strong>}
              {preview.displayPhase === 'question' && (
                <strong>
                  {preview.question?.title} — {preview.optionLabel} ({preview.remainingSec}s)
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
                <section key={q.number} className="live-admin-question">
                  <h3 className="live-admin-question-title">{q.title}</h3>
                  <div className="live-admin-options">
                    {q.options.map((label, idx) => {
                      const optionNum = idx + 1
                      const isActive =
                        display.displayPhase !== 'waiting' &&
                        display.questionNumber === q.number &&
                        display.selectedOption === optionNum
                      return (
                        <button
                          key={optionNum}
                          type="button"
                          className={`btn ${isActive ? 'primary' : 'ghost'} live-option-btn`}
                          onClick={() => showOption(q.number, optionNum)}
                          disabled={busy || !supabaseConfigured}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>

            {actionError && (
              <p className="login-error" role="alert">
                {actionError}
              </p>
            )}

            <details className="live-participants">
              <summary>Joined participants ({participants.length})</summary>
              <ul className="live-participants-list">
                {participants.map((p) => (
                  <li key={p.id}>
                    {p.kid_name} — {p.parent_name} ({p.gender})
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