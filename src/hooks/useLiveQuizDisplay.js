import { useEffect, useMemo, useState } from 'react'
import { LIVE_QUIZ_TIMER_SECONDS, getQuestionFromList } from '../data/liveQuizQuestions'
import { fetchLiveQuizState, subscribeLiveQuizState } from '../services/liveQuiz'
import { useLiveQuizQuestions } from './useLiveQuizQuestions'

function msRemaining(state, now) {
  if (!state || state.phase !== 'question') return 0
  const start = new Date(state.phase_started_at).getTime()
  const timerSec = state.timer_seconds ?? LIVE_QUIZ_TIMER_SECONDS
  const end = start + timerSec * 1000
  return Math.max(0, end - now)
}

/**
 * Shared display phase for parents and admin: waiting | question | timed_out
 */
export function useLiveQuizDisplay() {
  const { rows: questionRows } = useLiveQuizQuestions()
  const [state, setState] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let active = true
    fetchLiveQuizState().then(({ data, error }) => {
      if (!active) return
      if (error) setLoadError(error.message)
      else setState(data)
    })
    const unsub = subscribeLiveQuizState((row) => {
      setState(row)
    })
    return () => {
      active = false
      unsub()
    }
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [])

  const display = useMemo(() => {
    const timerSeconds = state?.timer_seconds ?? LIVE_QUIZ_TIMER_SECONDS
    const question = getQuestionFromList(questionRows, state?.question_number)
    const remainingMs = msRemaining(state, now)
    let displayPhase = 'waiting'
    if (state?.phase === 'question') {
      displayPhase = remainingMs > 0 ? 'question' : 'timed_out'
    }

    return {
      raw: state,
      displayPhase,
      questionNumber: state?.question_number ?? null,
      roundId: state?.round_id ?? null,
      activeGroupId: state?.active_group_id ?? null,
      groupIntroToken: state?.group_intro_token ?? null,
      selectedOption: state?.selected_option ?? null,
      question,
      optionLabel:
        question && state?.selected_option
          ? question.options[state.selected_option - 1]
          : null,
      remainingMs,
      remainingSec: Math.ceil(remainingMs / 1000),
      timerSeconds,
    }
  }, [state, now, questionRows])

  return { ...display, loadError, loading: state === null && !loadError }
}