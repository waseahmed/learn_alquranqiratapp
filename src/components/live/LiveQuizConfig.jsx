import { useEffect, useMemo, useState } from 'react'
import {
  adminClearLiveQuizAnswers,
  adminSaveLiveQuizSessionConfig,
} from '../../services/liveQuiz'

const ACTIVE_GROUP_KEY = 'aqqa_live_active_group_id'

function nextQuestionNumber(questions) {
  const max = questions.reduce((m, q) => Math.max(m, q.question_number || 0), 0)
  return Math.min(99, max + 1)
}

export default function LiveQuizConfig({
  pin,
  groups: groupsProp,
  rows,
  onSaved,
  onCleared,
  disabled,
  activeGroupId,
  onActiveGroupChange,
}) {
  const [groupDraft, setGroupDraft] = useState([])
  const [questionDraft, setQuestionDraft] = useState([])
  const [filterGroupId, setFilterGroupId] = useState(activeGroupId ?? null)
  const [saveError, setSaveError] = useState('')
  const [saveBusy, setSaveBusy] = useState(false)
  const [clearBusy, setClearBusy] = useState(false)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)

  useEffect(() => {
    if (!groupsProp?.length) return
    setGroupDraft(
      groupsProp.map((g) => ({
        id: g.id,
        name: g.name || '',
        mode: g.mode === 'competition' ? 'competition' : 'poll',
        sort_order: g.sort_order ?? 0,
      })),
    )
  }, [groupsProp])

  useEffect(() => {
    if (!rows?.length) return
    setQuestionDraft(
      rows.map((q) => ({
        question_number: q.question_number,
        group_id: q.group_id ?? groupsProp?.[0]?.id ?? 1,
        title: q.title || '',
        option_1_text: q.option_1_text || '',
        option_2_text: q.option_2_text || '',
        option_3_text: q.option_3_text || '',
        correct_option: q.correct_option ?? '',
      })),
    )
  }, [rows, groupsProp])

  useEffect(() => {
    if (activeGroupId != null) setFilterGroupId(activeGroupId)
  }, [activeGroupId])

  const groupModeById = useMemo(() => {
    const map = new Map()
    groupDraft.forEach((g) => map.set(g.id, g.mode))
    return map
  }, [groupDraft])

  const filteredQuestions = useMemo(
    () =>
      filterGroupId == null
        ? questionDraft
        : questionDraft.filter((q) => Number(q.group_id) === Number(filterGroupId)),
    [questionDraft, filterGroupId],
  )

  function updateGroup(id, field, value) {
    setGroupDraft((prev) => prev.map((g) => (g.id === id ? { ...g, [field]: value } : g)))
  }

  function addGroup() {
    const tempId = -Date.now()
    setGroupDraft((prev) => [
      ...prev,
      {
        id: tempId,
        name: `Group ${prev.length + 1}`,
        mode: 'poll',
        sort_order: prev.length,
      },
    ])
    setFilterGroupId(tempId)
    onActiveGroupChange?.(tempId)
  }

  function updateQuestion(num, field, value) {
    setQuestionDraft((prev) =>
      prev.map((q) => (q.question_number === num ? { ...q, [field]: value } : q)),
    )
  }

  function addQuestion() {
    const gid = filterGroupId ?? groupDraft[0]?.id ?? 1
    if (!gid || gid < 1) {
      setSaveError('Save your new group first (Save groups & questions), then add questions.')
      return
    }
    const num = nextQuestionNumber(questionDraft)
    setQuestionDraft((prev) => [
      ...prev,
      {
        question_number: num,
        group_id: gid,
        title: '',
        option_1_text: '',
        option_2_text: '',
        option_3_text: '',
        correct_option: '',
      },
    ])
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaveError('')
    setSaveBusy(true)
    const groupsPayload = groupDraft.map((g, idx) => ({
      id: g.id > 0 ? g.id : null,
      name: g.name.trim() || `Group ${idx + 1}`,
      mode: g.mode === 'competition' ? 'competition' : 'poll',
      sort_order: idx,
    }))
    const badGroup = questionDraft.find((q) => !q.group_id || q.group_id < 1)
    if (badGroup) {
      setSaveBusy(false)
      setSaveError('Save once after adding a new group, then add questions to it.')
      return
    }

    const questionsPayload = questionDraft.map((q) => {
      const mode = groupModeById.get(q.group_id)
      const correct =
        mode === 'competition' && q.correct_option !== '' && q.correct_option != null
          ? Number(q.correct_option)
          : null
      return {
        question_number: q.question_number,
        group_id: q.group_id > 0 ? q.group_id : groupsPayload[0]?.id,
        title: q.title.trim(),
        option_1_text: q.option_1_text.trim() || null,
        option_2_text: q.option_2_text.trim() || null,
        option_3_text: q.option_3_text.trim() || null,
        correct_option: correct,
      }
    })
    const { data, error } = await adminSaveLiveQuizSessionConfig(
      pin,
      groupsPayload,
      questionsPayload,
    )
    setSaveBusy(false)
    if (error) {
      setSaveError(error.message || 'Could not save session setup.')
      return
    }
    onSaved?.(data)
  }

  async function confirmClearAnswers() {
    setSaveError('')
    setClearBusy(true)
    const { error } = await adminClearLiveQuizAnswers(pin)
    setClearBusy(false)
    setClearConfirmOpen(false)
    if (error) {
      setSaveError(error.message || 'Could not clear answers.')
      return
    }
    onCleared?.()
  }

  function handleGroupFilterChange(id) {
    const parsed = id === '' ? null : Number(id)
    setFilterGroupId(parsed)
    onActiveGroupChange?.(parsed)
    try {
      if (parsed != null) sessionStorage.setItem(ACTIVE_GROUP_KEY, String(parsed))
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="live-config" aria-labelledby="live-config-heading">
      <h3 id="live-config-heading" className="live-stats-heading">
        Session config
      </h3>
      <p className="live-muted live-config-hint">
        Create <strong>question groups</strong> as poll (opinions) or <strong>competition</strong>{' '}
        (mark the correct answer). Add questions under each group; host runs the active group from
        the Host tab.
      </p>

      <fieldset className="live-config-groups">
        <legend className="live-config-legend">Question groups</legend>
        {groupDraft.map((g) => (
          <div key={g.id} className="live-config-group-row">
            <input
              type="text"
              aria-label="Group name"
              value={g.name}
              onChange={(e) => updateGroup(g.id, 'name', e.target.value)}
              disabled={disabled || saveBusy}
            />
            <select
              aria-label="Group mode"
              value={g.mode}
              onChange={(e) => updateGroup(g.id, 'mode', e.target.value)}
              disabled={disabled || saveBusy}
            >
              <option value="poll">Poll (opinions)</option>
              <option value="competition">Competition (correct answer)</option>
            </select>
          </div>
        ))}
        <button
          type="button"
          className="btn ghost live-config-add-group"
          onClick={addGroup}
          disabled={disabled || saveBusy}
        >
          + Add group
        </button>
      </fieldset>

      <label className="live-config-filter-label" htmlFor="live-config-active-group">
        Active group for hosting
      </label>
      <select
        id="live-config-active-group"
        className="live-config-group-select"
        value={filterGroupId ?? ''}
        onChange={(e) => handleGroupFilterChange(e.target.value)}
        disabled={disabled || saveBusy}
      >
        {groupDraft.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name} ({g.mode === 'competition' ? 'Competition' : 'Poll'})
          </option>
        ))}
      </select>

      <button
        type="button"
        className="btn ghost live-config-clear"
        onClick={() => setClearConfirmOpen(true)}
        disabled={disabled || clearBusy}
        aria-expanded={clearConfirmOpen}
        aria-controls="live-config-clear-confirm"
      >
        {clearBusy ? 'Clearing…' : 'Clear all parent answers & start fresh'}
      </button>

      {clearConfirmOpen && (
        <div
          id="live-config-clear-confirm"
          className="live-config-clear-confirm"
          role="alertdialog"
          aria-labelledby="live-config-clear-title"
          aria-describedby="live-config-clear-desc"
        >
          <p id="live-config-clear-title" className="live-config-clear-title">
            Clear everything and start fresh?
          </p>
          <p id="live-config-clear-desc" className="live-muted live-config-clear-desc">
            This deletes all parent answers, resets competition scores, removes every ✓ above Send,
            and turns off Live on all questions. Families stay joined.
          </p>
          <div className="live-config-clear-actions">
            <button
              type="button"
              className="btn ghost"
              onClick={() => setClearConfirmOpen(false)}
              disabled={clearBusy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={confirmClearAnswers}
              disabled={disabled || clearBusy}
            >
              {clearBusy ? 'Clearing…' : 'Yes, clear everything'}
            </button>
          </div>
        </div>
      )}

      <form className="live-config-form" onSubmit={handleSave}>
        <div className="live-config-questions-toolbar">
          <h4 className="live-config-questions-title">
            Questions
            {filterGroupId != null && (
              <span className="live-muted">
                {' '}
                — {groupDraft.find((g) => g.id === filterGroupId)?.name}
              </span>
            )}
          </h4>
          <button
            type="button"
            className="btn ghost"
            onClick={addQuestion}
            disabled={disabled || saveBusy || groupDraft.length === 0}
          >
            + Add question
          </button>
        </div>

        {filteredQuestions.map((q) => {
          const mode = groupModeById.get(q.group_id)
          return (
            <fieldset key={q.question_number} className="live-config-q">
              <legend className="live-config-legend">
                Q{q.question_number}
                {mode === 'competition' ? ' · Competition' : ' · Poll'}
              </legend>
              <label htmlFor={`q${q.question_number}-group`}>Group</label>
              <select
                id={`q${q.question_number}-group`}
                value={q.group_id}
                onChange={(e) =>
                  updateQuestion(q.question_number, 'group_id', Number(e.target.value))
                }
                disabled={disabled || saveBusy}
              >
                {groupDraft.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <label htmlFor={`q${q.question_number}-title`}>Question text</label>
              <input
                id={`q${q.question_number}-title`}
                type="text"
                value={q.title}
                onChange={(e) => updateQuestion(q.question_number, 'title', e.target.value)}
                disabled={disabled || saveBusy}
              />
              <label htmlFor={`q${q.question_number}-o1`}>Answer 1</label>
              <input
                id={`q${q.question_number}-o1`}
                type="text"
                value={q.option_1_text}
                onChange={(e) => updateQuestion(q.question_number, 'option_1_text', e.target.value)}
                disabled={disabled || saveBusy}
              />
              <label htmlFor={`q${q.question_number}-o2`}>Answer 2 (optional)</label>
              <input
                id={`q${q.question_number}-o2`}
                type="text"
                value={q.option_2_text}
                onChange={(e) => updateQuestion(q.question_number, 'option_2_text', e.target.value)}
                disabled={disabled || saveBusy}
              />
              <label htmlFor={`q${q.question_number}-o3`}>Answer 3 (optional)</label>
              <input
                id={`q${q.question_number}-o3`}
                type="text"
                value={q.option_3_text}
                onChange={(e) => updateQuestion(q.question_number, 'option_3_text', e.target.value)}
                disabled={disabled || saveBusy}
              />
              {mode === 'competition' && (
                <>
                  <label htmlFor={`q${q.question_number}-correct`}>Correct answer</label>
                  <select
                    id={`q${q.question_number}-correct`}
                    value={q.correct_option}
                    onChange={(e) =>
                      updateQuestion(q.question_number, 'correct_option', e.target.value)
                    }
                    disabled={disabled || saveBusy}
                  >
                    <option value="">Select…</option>
                    <option value="1">1 — {q.option_1_text || 'Answer 1'}</option>
                    {(q.option_2_text || q.option_3_text) && (
                      <option value="2">2 — {q.option_2_text || 'Answer 2'}</option>
                    )}
                    {q.option_3_text && (
                      <option value="3">3 — {q.option_3_text}</option>
                    )}
                  </select>
                </>
              )}
            </fieldset>
          )
        })}

        {saveError && (
          <p className="login-error" role="alert">
            {saveError}
          </p>
        )}

        <button type="submit" className="btn primary" disabled={disabled || saveBusy}>
          {saveBusy ? 'Saving…' : 'Save groups & questions'}
        </button>
      </form>
    </section>
  )
}