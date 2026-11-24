import { useCallback, useEffect, useMemo, useState } from 'react'
import { DEFAULT_LIVE_QUESTIONS, normalizeQuestion } from '../data/liveQuizQuestions'
import { fetchLiveQuizQuestions, subscribeLiveQuizQuestions } from '../services/liveQuiz'

export function useLiveQuizQuestions() {
  const [rows, setRows] = useState(DEFAULT_LIVE_QUESTIONS)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const { data, error } = await fetchLiveQuizQuestions()
    setLoading(false)
    if (error) {
      setLoadError(error.message)
      return
    }
    if (Array.isArray(data) && data.length > 0) {
      setRows(data)
      setLoadError('')
    }
  }, [])

  useEffect(() => {
    let active = true
    fetchLiveQuizQuestions().then(({ data, error }) => {
      if (!active) return
      setLoading(false)
      if (error) setLoadError(error.message)
      else if (Array.isArray(data) && data.length > 0) setRows(data)
    })
    const unsub = subscribeLiveQuizQuestions(() => {
      if (active) refresh()
    })
    return () => {
      active = false
      unsub()
    }
  }, [refresh])

  const questions = useMemo(
    () => rows.map(normalizeQuestion).filter((q) => q.optionCount > 0),
    [rows],
  )

  const allQuestions = useMemo(() => rows.map(normalizeQuestion), [rows])

  return { rows, questions, allQuestions, loading, loadError, refresh }
}