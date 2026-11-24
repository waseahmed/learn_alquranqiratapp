import { useEffect, useState } from 'react'
import { APP_NAME, APP_TAGLINE } from '../../config'
import { useLiveQuizDisplay } from '../../hooks/useLiveQuizDisplay'
import { joinLiveQuiz } from '../../services/liveQuiz'
import { supabaseConfigured } from '../../services/supabase'

const STORAGE_KEY = 'aqqa_live_participant'

function readStoredParticipant() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function LiveScreen({ participant }) {
  const {
    displayPhase,
    question,
    optionLabel,
    remainingSec,
    timerSeconds,
    loadError,
    loading,
  } = useLiveQuizDisplay()

  if (loading) {
    return <p className="live-muted">Connecting to the session…</p>
  }

  if (loadError) {
    return (
      <p className="login-error" role="alert">
        {loadError}
      </p>
    )
  }

  return (
  <div className="live-screen">
      <p className="live-welcome">
        Welcome, <strong>{participant.kidName}</strong> (with {participant.parentName})
      </p>

      {displayPhase === 'waiting' && (
        <div className="live-panel live-panel--wait">
          <h2 className="live-panel-title">Please wait</h2>
          <p className="live-muted">The host will show the next question soon.</p>
        </div>
      )}

      {displayPhase === 'question' && question && (
        <div className="live-panel live-panel--active">
          <p className="live-question-label">{question.title}</p>
          <div
            className="live-option-reveal"
            role="status"
            aria-live="polite"
          >
            {optionLabel ?? `Option ${question.number}`}
          </div>
          <div className="live-timer" aria-label={`${remainingSec} seconds remaining`}>
            <div
              className="live-timer-bar"
              style={{
                width: `${(remainingSec / timerSeconds) * 100}%`,
              }}
            />
          </div>
          <p className="live-timer-text">{remainingSec}s</p>
        </div>
      )}

      {displayPhase === 'timed_out' && (
        <div className="live-panel live-panel--timeout">
          <h2 className="live-panel-title">Timed out</h2>
          <p className="live-muted">Wait for the host to continue.</p>
        </div>
      )}
    </div>
  )
}

export default function LiveParentPage() {
  const [participant, setParticipant] = useState(() => readStoredParticipant())
  const [kidName, setKidName] = useState('')
  const [parentName, setParentName] = useState('')
  const [gender, setGender] = useState('male')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (participant) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(participant))
    }
  }, [participant])

  async function handleJoin(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { data, error: joinError } = await joinLiveQuiz({
      kidName,
      parentName,
      gender,
    })
    setSubmitting(false)
    if (joinError) {
      setError(joinError.message || 'Could not join. Try again.')
      return
    }
    setParticipant({
      id: data.id,
      kidName: kidName.trim(),
      parentName: parentName.trim(),
      gender,
    })
  }

  function handleLeave() {
    sessionStorage.removeItem(STORAGE_KEY)
    setParticipant(null)
    setKidName('')
    setParentName('')
  }

  return (
    <div className="login-page live-page">
      <div className="login-card live-card live-card--wide">
        <img
          src={`${import.meta.env.BASE_URL}aqqa-logo.png`}
          alt="Al Quran Qirat Academy"
          className="login-logo"
        />
        <h1 className="login-brand">{APP_NAME}</h1>
        <p className="login-tagline">{APP_TAGLINE}</p>
        <h2 className="login-portal">Live session — Parents</h2>

        {!supabaseConfigured && (
          <p className="login-error" role="alert">
            Live session is not configured on this server yet.
          </p>
        )}

        {!participant ? (
          <form className="login-form live-join-form" onSubmit={handleJoin}>
            <label htmlFor="kid-name">Child&apos;s name</label>
            <input
              id="kid-name"
              name="kidName"
              type="text"
              required
              autoComplete="name"
              value={kidName}
              onChange={(e) => setKidName(e.target.value)}
              disabled={!supabaseConfigured || submitting}
            />

            <label htmlFor="parent-name">Parent&apos;s name</label>
            <input
              id="parent-name"
              name="parentName"
              type="text"
              required
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              disabled={!supabaseConfigured || submitting}
            />

            <span className="live-label-block">Child&apos;s gender</span>
            <div className="live-gender-row" role="radiogroup" aria-label="Gender">
              <label className="live-gender-option">
                <input
                  type="radio"
                  name="gender"
                  value="male"
                  checked={gender === 'male'}
                  onChange={() => setGender('male')}
                  disabled={!supabaseConfigured || submitting}
                />
                Male
              </label>
              <label className="live-gender-option">
                <input
                  type="radio"
                  name="gender"
                  value="female"
                  checked={gender === 'female'}
                  onChange={() => setGender('female')}
                  disabled={!supabaseConfigured || submitting}
                />
                Female
              </label>
            </div>

            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="btn primary"
              disabled={!supabaseConfigured || submitting}
            >
              {submitting ? 'Joining…' : 'Join live session'}
            </button>
          </form>
        ) : (
          <>
            <LiveScreen participant={participant} />
            <button type="button" className="btn ghost live-leave-btn" onClick={handleLeave}>
              Leave session
            </button>
          </>
        )}
      </div>
    </div>
  )
}