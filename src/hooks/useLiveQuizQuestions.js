import { useCallback, useEffect, useMemo, useState } from 'react'
import { DEFAULT_LIVE_QUESTIONS, normalizeQuestion } from '../data/liveQuizQuestions'
import { fetchLiveQuizQuestions, subscribeLiveQuizQuestions } from '../services/liveQuiz'

export function useLiveQuizQuestions() {
  const [rows, setRows] = useState(DEFAULT_LIVE_QUESTIONS)
  const [groups, setGroups] = useState([
    {
      id: 1,
      name: 'General session',
      mode: 'poll',
      sort_order: 0,
      show_questions_on_parents: true,
      show_group_intro_flash: true,
      auto_send_questions: false,
      auto_send_gap_seconds: 5,
      send_option_text: true,
    },
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

  const groupById = useMemo(() => new Map(groups.map((g) => [Number(g.id), g])), [groups])

  const questions = useMemo(
    () =>
      rows
        .map((r) => normalizeQuestion(r, groupById.get(Number(r.group_id))))
        .filter((q) => q.optionCount > 0),
    [rows, groupById],
  )

  const allQuestions = useMemo(
    () => rows.map((r) => normalizeQuestion(r, groupById.get(Number(r.group_id)))),
    [rows, groupById],
  )

  return { rows, groups, questions, allQuestions, loading, loadError, refresh }
}