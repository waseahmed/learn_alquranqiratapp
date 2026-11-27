import { useEffect, useMemo, useRef, useState } from 'react'
import { paletteToCssVars, pickPaletteForRound } from '../../data/liveQuizPalettes'
import ConfettiBurst from '../../components/live/ConfettiBurst'
import { getFullOptionLabel } from '../../data/liveQuizQuestions'
import { useLiveQuizDisplay } from '../../hooks/useLiveQuizDisplay'
import { useLiveQuizQuestions } from '../../hooks/useLiveQuizQuestions'
import LiveAutoSendGapBanner from '../../components/live/LiveAutoSendGapBanner'
import LiveGroupIntroFlash from '../../components/live/LiveGroupIntroFlash'
import LiveParentPodium from '../../components/live/LiveParentPodium'
import { getAutoSendGapCountdown } from '../../utils/liveQuizAutoSend'
import LiveGroupResultsPanel from '../../components/live/LiveGroupResultsPanel'
import { useParticipantHeartbeat } from '../../hooks/useParticipantHeartbeat'
import {
  fetchLiveQuizParticipant,
  fetchLiveQuizPublicRoundResults,
  joinLiveQuiz,
  submitLiveQuizVote,
} from '../../services/liveQuiz'
import { formatResponseMs } from '../../utils/liveQuizTiming'
import { supabaseConfigured } from '../../services/supabase'
import {
  playAnswerSound,
  playCountdownTickSound,
  playQuestionPopSound,
  unlockLiveQuizAudio,
} from '../../utils/liveQuizSounds'

const STORAGE_KEY = 'aqqa_live_participant'
const INTRO_DISMISS_KEY = 'aqqa_live_intro_dismissed'

function readStoredParticipantId() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.id ?? null
  } catch {
    return null
  }
}

function persistParticipant(participant) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(participant))
}

function roleLabel(role) {
  return role === 'father' ? 'Father' : 'Mother'
}

function LiveScreen({ participant, groups, onAnswerConfetti, onSessionEnded }) {
  const {
    displayPhase,
    question,
    roundId,
    activeGroupId,
    groupIntroToken,
    sessionProgress,
    groupFinale,
    remainingSec,
    timerSeconds,
    phaseStartedAt,
    now,
    loadError,
    loading,
  } = useLiveQuizDisplay()

  const [votedOption, setVotedOption] = useState(null)
  const [voteError, setVoteError] = useState('')
  const [voteBusy, setVoteBusy] = useState(false)
  const [revealAnim, setRevealAnim] = useState(false)
  const [roundResults, setRoundResults] = useState(null)
  const [showIntroFlash, setShowIntroFlash] = useState(false)
  const [introGroupName, setIntroGroupName] = useState('')
  const lastTickSecRef = useRef(null)
  const lastGapTickRef = useRef(null)
  const [finaleReveal, setFinaleReveal] = useState(false)

  const roundTheme = useMemo(
    () => paletteToCssVars(pickPaletteForRound(participant.id, roundId)),
    [participant.id, roundId],
  )

  useParticipantHeartbeat(participant.id, onSessionEnded)

  const activeGroup = useMemo(
    () => groups?.find((g) => Number(g.id) === Number(activeGroupId)) ?? null,
    [groups, activeGroupId],
  )

  const autoSendCountdown = useMemo(
    () =>
      getAutoSendGapCountdown({
        displayPhase,
        phaseStartedAt,
        timerSeconds,
        now,
        autoSendQuestions: Boolean(activeGroup?.auto_send_questions),
        gapSeconds: activeGroup?.auto_send_gap_seconds,
        sessionProgress,
      }),
    [displayPhase, phaseStartedAt, timerSeconds, now, activeGroup, sessionProgress],
  )

  const autoSendEnabled = Boolean(activeGroup?.auto_send_questions)

  const parentsAnswerOnDevice = useMemo(() => {
    if (question?.showQuestionsOnParents === false) return false
    if (activeGroup?.show_questions_on_parents === false) return false
    return true
  }, [question, activeGroup])

  function dismissIntro() {
    if (groupIntroToken) {
      try {
        sessionStorage.setItem(INTRO_DISMISS_KEY, groupIntroToken)
      } catch {
        /* ignore */
      }
    }
    setShowIntroFlash(false)
  }

  useEffect(() => {
    if (displayPhase !== 'waiting' || !groupIntroToken || !activeGroupId) {
      setShowIntroFlash(false)
      return
    }
    const group = groups?.find((g) => Number(g.id) === Number(activeGroupId))
    if (!group || group.show_group_intro_flash === false) {
      setShowIntroFlash(false)
      return
    }
    try {
      if (sessionStorage.getItem(INTRO_DISMISS_KEY) === groupIntroToken) {
        setShowIntroFlash(false)
        return
      }
    } catch {
      /* ignore */
    }
    setIntroGroupName(group.name || 'Session')
    setShowIntroFlash(true)
  }, [displayPhase, groupIntroToken, activeGroupId, groups])

  useEffect(() => {
    setVotedOption(null)
    setVoteError('')
    setRoundResults(null)
    lastTickSecRef.current = null
    lastGapTickRef.current = null
  }, [roundId])

  useEffect(() => {
    if (displayPhase !== 'timed_out' || !roundId) return undefined
    let active = true
    async function loadResults() {
      const { data, error } = await fetchLiveQuizPublicRoundResults()
      if (!active || error || !data?.show_results) return
      const podium = data.last_podium
      if (podium?.round_id && podium.round_id !== roundId) return
      setRoundResults(podium)
    }
    loadResults()
    const id = window.setInterval(loadResults, 1200)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [displayPhase, roundId])

  useEffect(() => {
    if (!roundId || displayPhase !== 'question') return undefined
    playQuestionPopSound()
    setRevealAnim(true)
    const t = window.setTimeout(() => setRevealAnim(false), 700)
    return () => window.clearTimeout(t)
  }, [roundId, displayPhase])

  useEffect(() => {
    if (displayPhase !== 'question') return
    if (remainingSec > 4 || remainingSec < 1) return
    if (lastTickSecRef.current === remainingSec) return
    lastTickSecRef.current = remainingSec
    playCountdownTickSound(remainingSec)
  }, [displayPhase, remainingSec])

  useEffect(() => {
    if (displayPhase !== 'timed_out' || !autoSendCountdown?.seconds) return
    const sec = autoSendCountdown.seconds
    if (sec > 5 || sec < 1) return
    if (lastGapTickRef.current === sec) return
    lastGapTickRef.current = sec
    playCountdownTickSound(sec)
  }, [displayPhase, autoSendCountdown?.seconds])

  useEffect(() => {
    if (!groupFinale?.finalized || !groupFinale?.group_name) {
      setFinaleReveal(false)
      return undefined
    }
    setFinaleReveal(true)
    playQuestionPopSound()
    const t = window.setTimeout(() => setFinaleReveal(false), 800)
    return () => window.clearTimeout(t)
  }, [groupFinale?.finalized, groupFinale?.finalized_at, groupFinale?.group_name])

  async function handleVote(optionNumber) {
    if (displayPhase !== 'question' || voteBusy || votedOption) return
    unlockLiveQuizAudio()
    setVoteError('')
    setVoteBusy(true)
    const { error } = await submitLiveQuizVote(participant.id, optionNumber)
    setVoteBusy(false)
    if (error) {
      setVoteError(error.message || 'Could not save your answer.')
      return
    }
    setVotedOption(optionNumber)
    playAnswerSound()
    onAnswerConfetti()
  }

  const votedLabel =
    votedOption && question ? getFullOptionLabel(question, votedOption) : null

  const myRankEntry = useMemo(() => {
    if (!roundResults?.ranking?.length) return null
    return roundResults.ranking.find((row) => row.participant_id === participant.id) ?? null
  }, [roundResults, participant.id])

  const resultsList = roundResults?.ranking?.length
    ? roundResults.ranking
    : roundResults?.places || []

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

  const topPlaces = roundResults?.places?.length
    ? roundResults.places
    : (roundResults?.ranking || []).filter((r) => (r.rank ?? 99) <= 3)

  return (
    <div className={`live-screen ${revealAnim ? 'live-screen--reveal' : ''}`}>
      {showIntroFlash && (
        <LiveGroupIntroFlash groupName={introGroupName} onDismiss={dismissIntro} />
      )}
      <p className="live-welcome">
        <strong>{participant.kidName}</strong> ({roleLabel(participant.parentRole)})
      </p>

      {sessionProgress?.total > 0 && displayPhase !== 'waiting' && (
        <div className="live-session-progress" role="status">
          <p className="live-session-progress-label">
            Question {sessionProgress.completed} of {sessionProgress.total}
            {sessionProgress.pending > 0 ? ` · ${sessionProgress.pending} left` : ' · last question'}
          </p>
          <div className="live-session-progress-track" aria-hidden>
            <div
              className="live-session-progress-fill"
              style={{
                width: `${(Number(sessionProgress.completed) / Number(sessionProgress.total)) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {displayPhase === 'waiting' && groupFinale?.group_name && groupFinale?.finalized && (
        <div
          key={groupFinale.finalized_at || 'group-finale'}
          className={`live-panel live-panel--group-results-wrap live-panel--pop-in ${
            autoSendEnabled ? 'live-panel--group-results-wrap--auto' : ''
          } ${finaleReveal ? 'live-screen--reveal' : ''}`}
        >
          <LiveGroupResultsPanel
            groupName={groupFinale.group_name}
            places={groupFinale.places || groupFinale.ranking || []}
            myParticipantId={participant.id}
            variant="parent"
            autoQuiz={autoSendEnabled}
          />
        </div>
      )}

      {displayPhase === 'waiting' && !(groupFinale?.group_name && groupFinale?.finalized) && (
        <div className="live-panel live-panel--wait">
          <h2 className="live-panel-title">Please wait</h2>
          {sessionProgress?.total > 0 ? (
            <p className="live-muted">
              {sessionProgress.completed} of {sessionProgress.total} questions done
              {sessionProgress.pending > 0 ? ` · ${sessionProgress.pending} to go` : ''}
            </p>
          ) : (
            <p className="live-muted">The host will show the next question soon.</p>
          )}
        </div>
      )}

      {displayPhase === 'question' && !question && (
        <div className="live-panel live-panel--wait">
          <h2 className="live-panel-title">Please wait</h2>
          <p className="live-muted">The host is preparing the next question…</p>
        </div>
      )}

      {displayPhase === 'question' && question && !parentsAnswerOnDevice && (
        <div className="live-panel live-panel--watch">
          <h2 className="live-panel-title">Watch the big screen</h2>
          <p className="live-muted">
            This round is presentation-only. Questions are shown on the main display — please watch
            there.
          </p>
          <p className="live-watch-q live-question-label">{question.title}</p>
        </div>
      )}

      {displayPhase === 'question' && question && parentsAnswerOnDevice && (
        <div
          key={roundId}
          className="live-panel live-panel--active live-panel--pop-in live-panel--themed"
          style={roundTheme}
        >
          <p className="live-question-label live-question-label--themed">{question.title}</p>
          <p className="live-muted live-pick-hint">Tap your answer</p>
          <div className="live-parent-options" role="group" aria-label="Answer choices">
            {Array.from({ length: question.optionCount }, (_, idx) => {
              const optionNum = idx + 1
              const optionText = question.options[idx]
              const numbersOnly =
                activeGroup?.send_option_text === false || question.sendOptionText === false
              const showText = Boolean(optionText) && !numbersOnly
              const isSelected = votedOption === optionNum
              return (
                <button
                  key={optionNum}
                  type="button"
                  className={`btn live-parent-option live-option-stagger live-parent-option--themed ${showText ? 'live-parent-option--with-text' : 'live-send-num'} ${isSelected ? 'live-parent-option--picked' : ''}`}
                  style={{ animationDelay: `${idx * 80}ms` }}
                  onClick={() => handleVote(optionNum)}
                  disabled={voteBusy || Boolean(votedOption)}
                  aria-label={`Answer ${optionNum}: ${getFullOptionLabel(question, optionNum)}`}
                >
                  <span className="live-parent-option-num" aria-hidden>
                    {optionNum}
                  </span>
                  {showText ? (
                    <span className="live-parent-option-label">{optionText}</span>
                  ) : null}
                </button>
              )
            })}
          </div>
          {votedLabel && (
            <p className="live-vote-confirm" role="status">
              Your answer ({votedOption}): <strong>{votedLabel}</strong>
            </p>
          )}
          {voteError && (
            <p className="login-error" role="alert">
              {voteError}
            </p>
          )}
          <div className="live-timer" aria-label={`${remainingSec} seconds remaining`}>
            <div
              className="live-timer-bar live-timer-bar--themed"
              style={{ width: `${(remainingSec / timerSeconds) * 100}%` }}
            />
          </div>
          <p className="live-timer-text live-timer-text--themed">{remainingSec}s</p>
        </div>
      )}

      {displayPhase === 'timed_out' && autoSendCountdown && (
        <div className="live-panel live-panel--auto-transition">
          <LiveAutoSendGapBanner
            countdown={autoSendCountdown}
            variant="parent"
            transitionSplash
          />
        </div>
      )}

      {displayPhase === 'timed_out' && !autoSendCountdown && (
        <div className="live-panel live-panel--timeout live-panel--results">
          <h2 className="live-panel-title">Time&apos;s up</h2>
          {roundResults?.question_title && (
            <p className="live-results-q">{roundResults.question_title}</p>
          )}
          {votedLabel ? (
            <p className="live-muted">
              You answered: <strong>{votedLabel}</strong>
            </p>
          ) : (
            <p className="live-muted">No answer was sent in time.</p>
          )}
          {myRankEntry && (
            <p className="live-results-you" role="status">
              Your place: <strong>#{myRankEntry.rank}</strong>
              {myRankEntry.is_correct !== false && (
                <> · {formatResponseMs(myRankEntry.response_ms)}</>
              )}
              {myRankEntry.points_awarded > 0 && (
                <> · +{myRankEntry.points_awarded} pts</>
              )}
            </p>
          )}
          {topPlaces.length > 0 ? (
            <LiveParentPodium places={topPlaces} myParticipantId={participant.id} />
          ) : resultsList.length > 0 ? (
            <p className="live-muted">Loading top 3…</p>
          ) : (
            <p className="live-muted">Loading results…</p>
          )}
          {resultsList.length > 3 && (
            <ol className="live-results-list live-results-list--rest" aria-label="Other answers">
              {resultsList.slice(3).map((row, idx) => (
                <li
                  key={row.participant_id || idx}
                  className={
                    row.participant_id === participant.id
                      ? 'live-results-row live-results-row--you'
                      : 'live-results-row'
                  }
                >
                  <span className="live-results-rank">{row.rank ?? idx + 4}</span>
                  <span className="live-results-name">{row.kid_name}</span>
                  <span className="live-results-ms">{formatResponseMs(row.response_ms)}</span>
                </li>
              ))}
            </ol>
          )}
          <p className="live-muted">Wait for the host to continue.</p>
        </div>
      )}
    </div>
  )
}

export default function LiveParentPage() {
  const { groups } = useLiveQuizQuestions()
  const [participant, setParticipant] = useState(null)
  const [kidName, setKidName] = useState('')
  const [parentRole, setParentRole] = useState('mother')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confetti, setConfetti] = useState(false)
  const [restoring, setRestoring] = useState(true)

  useEffect(() => {
    let active = true
    async function restore() {
      const id = readStoredParticipantId()
      if (!id) {
        if (active) setRestoring(false)
        return
      }
      const { data, error: restoreError } = await fetchLiveQuizParticipant(id)
      if (!active) return
      if (restoreError || !data) {
        localStorage.removeItem(STORAGE_KEY)
        setRestoring(false)
        return
      }
      const restored = {
        id: data.id,
        kidName: data.kid_name,
        parentRole: data.parent_role,
      }
      setParticipant(restored)
      persistParticipant(restored)
      setRestoring(false)
    }
    restore()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (participant) persistParticipant(participant)
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
    unlockLiveQuizAudio()
    setConfetti(true)
  }

  function handleLeave() {
    localStorage.removeItem(STORAGE_KEY)
    setParticipant(null)
    setKidName('')
  }

  function triggerAnswerConfetti() {
    setConfetti(false)
    window.requestAnimationFrame(() => setConfetti(true))
  }

  return (
    <div className="login-page live-page live-page--parent">
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

        {restoring && <p className="live-muted">Restoring your session…</p>}

        {!restoring && !participant ? (
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
        ) : !restoring && participant ? (
          <>
            <LiveScreen
              participant={participant}
              groups={groups}
              onAnswerConfetti={triggerAnswerConfetti}
              onSessionEnded={handleLeave}
            />
            <button type="button" className="btn ghost live-leave-btn" onClick={handleLeave}>
              Leave session
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}