import { useEffect, useState } from 'react'
import ConfettiBurst from '../../components/live/ConfettiBurst'
import { useLiveQuizDisplay } from '../../hooks/useLiveQuizDisplay'
import { useParticipantHeartbeat } from '../../hooks/useParticipantHeartbeat'
import { joinLiveQuiz, submitLiveQuizVote } from '../../services/liveQuiz'
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

function roleLabel(role) {
  return role === 'father' ? 'Father' : 'Mother'
}

function LiveScreen({ participant, onAnswerConfetti }) {
  const {
    displayPhase,
    question,
    roundId,
    remainingSec,
    timerSeconds,
    loadError,
    loading,
  } = useLiveQuizDisplay()

  const [votedOption, setVotedOption] = useState(null)
  const [voteError, setVoteError] = useState('')
  const [voteBusy, setVoteBusy] = useState(false)
  const [revealAnim, setRevealAnim] = useState(false)

  useParticipantHeartbeat(participant.id)

  useEffect(() => {
    setVotedOption(null)
    setVoteError('')
  }, [roundId])

  useEffect(() => {
    if (!roundId || displayPhase !== 'question') return undefined
    setRevealAnim(true)
    const t = window.setTimeout(() => setRevealAnim(false), 700)
    return () => window.clearTimeout(t)
  }, [roundId, displayPhase])

  async function handleVote(optionNumber) {
    if (displayPhase !== 'question' || voteBusy || votedOption) return
    setVoteError('')
    setVoteBusy(true)
    const { error } = await submitLiveQuizVote(participant.id, optionNumber)
    setVoteBusy(false)
    if (error) {
      setVoteError(error.message || 'Could not save your answer.')
      return
    }
    setVotedOption(optionNumber)
    onAnswerConfetti()
  }

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

  const votedLabel =
    votedOption && question ? question.options[votedOption - 1] : null

  return (
    <div className={`live-screen ${revealAnim ? 'live-screen--reveal' : ''}`}>
      <p className="live-welcome">
        <strong>{participant.kidName}</strong> ({roleLabel(participant.parentRole)})
      </p>

      {displayPhase === 'waiting' && (
        <div className="live-panel live-panel--wait">
          <h2 className="live-panel-title">Please wait</h2>
          <p className="live-muted">The host will show the next question soon.</p>
        </div>
      )}

      {displayPhase === 'question' && question && (
        <div key={roundId} className="live-panel live-panel--active live-panel--pop-in">
          <p className="live-question-label">{question.title}</p>
          <p className="live-muted live-pick-hint">Tap your answer</p>
          <div className="live-parent-options" role="group" aria-label="Answer choices">
            {question.options.map((label, idx) => {
              const optionNum = idx + 1
              const isSelected = votedOption === optionNum
              return (
                <button
                  key={optionNum}
                  type="button"
                  className={`btn live-parent-option live-option-stagger ${isSelected ? 'primary' : 'ghost'}`}
                  style={{ animationDelay: `${idx * 80}ms` }}
                  onClick={() => handleVote(optionNum)}
                  disabled={voteBusy || Boolean(votedOption)}
                >
                  {label}
                </button>
              )
            })}
          </div>
          {votedLabel && (
            <p className="live-vote-confirm" role="status">
              Your answer: <strong>{votedLabel}</strong>
            </p>
          )}
          {voteError && (
            <p className="login-error" role="alert">
              {voteError}
            </p>
          )}
          <div className="live-timer" aria-label={`${remainingSec} seconds remaining`}>
            <div
              className="live-timer-bar"
              style={{ width: `${(remainingSec / timerSeconds) * 100}%` }}
            />
          </div>
          <p className="live-timer-text">{remainingSec}s</p>
        </div>
      )}

      {displayPhase === 'timed_out' && (
        <div className="live-panel live-panel--timeout">
          <h2 className="live-panel-title">Timed out</h2>
          {votedLabel ? (
            <p className="live-muted">
              You answered: <strong>{votedLabel}</strong>
            </p>
          ) : (
            <p className="live-muted">No answer was sent in time.</p>
          )}
          <p className="live-muted">Wait for the host to continue.</p>
        </div>
      )}
    </div>
  )
}

export default function LiveParentPage() {
  const [participant, setParticipant] = useState(() => readStoredParticipant())
  const [kidName, setKidName] = useState('')
  const [parentRole, setParentRole] = useState('mother')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confetti, setConfetti] = useState(false)

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
      parentRole,
    })
    setSubmitting(false)
    if (joinError) {
      setError(joinError.message || 'Could not join. Try again.')
      return
    }
    setParticipant({
      id: data.id,
      kidName: kidName.trim(),
      parentRole,
    })
    setConfetti(true)
  }

  function handleLeave() {
    sessionStorage.removeItem(STORAGE_KEY)
    setParticipant(null)
    setKidName('')
  }

  function triggerAnswerConfetti() {
    setConfetti(false)
    window.requestAnimationFrame(() => setConfetti(true))
  }

  return (
    <div className="login-page live-page">
      <div className="login-card live-card live-card--wide live-card--parent-minimal">
        <ConfettiBurst active={confetti} onDone={() => setConfetti(false)} />
        <img
          src={`${import.meta.env.BASE_URL}aqqa-logo.png`}
          alt="Al Quran Qirat Academy"
          className="login-logo live-logo-only"
        />

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

            <span className="live-label-block">Joining as</span>
            <div className="live-gender-row" role="radiogroup" aria-label="Mother or father">
              <label className="live-gender-option">
                <input
                  type="radio"
                  name="parentRole"
                  value="mother"
                  checked={parentRole === 'mother'}
                  onChange={() => setParentRole('mother')}
                  disabled={!supabaseConfigured || submitting}
                />
                Mother
              </label>
              <label className="live-gender-option">
                <input
                  type="radio"
                  name="parentRole"
                  value="father"
                  checked={parentRole === 'father'}
                  onChange={() => setParentRole('father')}
                  disabled={!supabaseConfigured || submitting}
                />
                Father
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
            <LiveScreen
              participant={participant}
              onAnswerConfetti={triggerAnswerConfetti}
            />
            <button type="button" className="btn ghost live-leave-btn" onClick={handleLeave}>
              Leave session
            </button>
          </>
        )}
      </div>
    </div>
  )
}