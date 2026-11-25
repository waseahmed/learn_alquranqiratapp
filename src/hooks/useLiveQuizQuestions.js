import { useCallback, useEffect, useMemo, useState } from 'react'
import { DEFAULT_LIVE_QUESTIONS, normalizeQuestion } from '../data/liveQuizQuestions'
import { fetchLiveQuizQuestions, subscribeLiveQuizQuestions } from '../services/liveQuiz'

export function useLiveQuizQuestions() {
  const [rows, setRows] = useState(DEFAULT_LIVE_QUESTIONS)
  const [groups, setGroups] = useState([
    { id: 1, name: 'General session', mode: 'poll', sort_order: 0 },
  ])
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)

  const applyPayload = useCallback((data) => {
    if (!data) return
    if (data.questions?.length) setRows(data.questions)
    if (data.groups?.length) setGroups(data.groups)
    setLoadError('')
  }, [])

  const refresh = useCallback(async () => {
    const { data, error } = await fetchLiveQuizQuestions()
    setLoading(false)
    if (error) {
      setLoadError(error.message)
      return
    }
    applyPayload(data)
  }, [applyPayload])

  useEffect(() => {
    let active = true
    fetchLiveQuizQuestions().then(({ data, error }) => {
      if (!active) return
      setLoading(false)
      if (error) setLoadError(error.message)
      else applyPayload(data)
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

  return { rows, groups, questions, allQuestions, loading, loadError, refresh }
}