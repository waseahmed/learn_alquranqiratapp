import { useEffect, useMemo, useState } from 'react'
import {
  adminClearGroupAnswers,
  adminDeleteLiveQuizGroup,
  adminDeleteLiveQuizQuestion,
  adminSaveLiveQuizSessionConfig,
} from '../../services/liveQuiz'
import LiveSlideDrawer from './LiveSlideDrawer'

const ACTIVE_GROUP_KEY = 'aqqa_live_active_group_id'

function nextQuestionNumber(questions) {
  const max = questions.reduce((m, q) => Math.max(m, q.question_number || 0), 0)
  return Math.min(99, max + 1)
}

function emptyQuestion(groupId) {
  return {
    question_number: null,
    group_id: groupId,
    title: '',
    option_1_text: '',
    option_2_text: '',
    option_3_text: '',
    correct_option: '',
  }
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
  view = 'groups',
}) {
  const [groupDraft, setGroupDraft] = useState([])
  const [questionDraft, setQuestionDraft] = useState([])
  const [filterGroupId, setFilterGroupId] = useState(activeGroupId ?? null)
  const [saveError, setSaveError] = useState('')
  const [saveBusy, setSaveBusy] = useState(false)
  const [clearBusy, setClearBusy] = useState(false)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [resetGroupId, setResetGroupId] = useState(activeGroupId ?? null)

  const [groupDrawer, setGroupDrawer] = useState({ open: false, mode: 'add', draft: null })
  const [questionDrawer, setQuestionDrawer] = useState({ open: false, mode: 'add', draft: null })

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
    if (activeGroupId != null && activeGroupId > 0) {
      setFilterGroupId(activeGroupId)
      setResetGroupId(activeGroupId)
    }
  }, [activeGroupId])

  const savedGroups = useMemo(() => groupDraft.filter((g) => g.id > 0), [groupDraft])

  const questionCountByGroup = useMemo(() => {
    const m = new Map()
    questionDraft.forEach((q) => {
      const id = q.group_id
      m.set(id, (m.get(id) || 0) + 1)
    })
    return m
  }, [questionDraft])

  const filteredQuestions = useMemo(() => {
    if (!filterGroupId) return []
    return questionDraft.filter((q) => Number(q.group_id) === Number(filterGroupId))
  }, [questionDraft, filterGroupId])

  const filterGroup = savedGroups.find((g) => Number(g.id) === Number(filterGroupId))
  const resetGroup = savedGroups.find((g) => Number(g.id) === Number(resetGroupId))

  async function persistSession(groupsToSave, questionsToSave) {
    const groupsPayload = groupsToSave.map((g, idx) => ({
      id: g.id > 0 ? g.id : null,
      name: g.name.trim() || `Group ${idx + 1}`,
      mode: g.mode === 'competition' ? 'competition' : 'poll',
      sort_order: idx,
    }))

    const modeMap = new Map(groupsToSave.map((g) => [g.id, g.mode]))

    const questionsPayload = questionsToSave
      .filter((q) => q.group_id > 0)
      .map((q) => {
        const mode = modeMap.get(q.group_id)
        const correct =
          mode === 'competition' && q.correct_option !== '' && q.correct_option != null
            ? Number(q.correct_option)
            : null
        return {
          question_number: q.question_number,
          group_id: q.group_id,
          title: q.title.trim(),
          option_1_text: q.option_1_text.trim() || null,
          option_2_text: q.option_2_text.trim() || null,
          option_3_text: q.option_3_text.trim() || null,
          correct_option: correct,
        }
      })

    const { data, error } = await adminSaveLiveQuizSessionConfig(pin, groupsPayload, questionsPayload)
    if (error) throw error
    onSaved?.(data)
    return data
  }

  async function saveGroupFromDrawer() {
    const d = groupDrawer.draft
    if (!d?.name?.trim()) {
      setSaveError('Enter a group name.')
      return
    }
    setSaveError('')
    setSaveBusy(true)
    try {
      let nextGroups = [...groupDraft]
      if (groupDrawer.mode === 'add') {
        const tempId = -Date.now()
        nextGroups = [
          ...nextGroups,
          { id: tempId, name: d.name.trim(), mode: d.mode, sort_order: nextGroups.length },
        ]
      } else {
        nextGroups = nextGroups.map((g) =>
          g.id === d.id ? { ...g, name: d.name.trim(), mode: d.mode } : g,
        )
      }
      setGroupDraft(nextGroups)
      await persistSession(nextGroups, questionDraft)
      setGroupDrawer({ open: false, mode: 'add', draft: null })
    } catch (err) {
      setSaveError(err.message || 'Could not save group.')
    } finally {
      setSaveBusy(false)
    }
  }

  async function saveQuestionFromDrawer() {
    const d = questionDrawer.draft
    if (!d?.title?.trim()) {
      setSaveError('Enter the question text.')
      return
    }
    if (!d.option_1_text?.trim()) {
      setSaveError('Answer 1 is required.')
      return
    }
    const gid = filterGroupId
    if (!gid || gid < 1) {
      setSaveError('Select a saved group first.')
      return
    }
    const mode = filterGroup?.mode
    if (mode === 'competition' && !d.correct_option) {
      setSaveError('Select the correct answer for competition groups.')
      return
    }

    setSaveError('')
    setSaveBusy(true)
    try {
      let nextQuestions = [...questionDraft]
      if (questionDrawer.mode === 'add') {
        const num = nextQuestionNumber(nextQuestions)
        nextQuestions.push({
          ...d,
          question_number: num,
          group_id: gid,
        })
      } else {
        nextQuestions = nextQuestions.map((q) =>
          q.question_number === d.question_number ? { ...d, group_id: gid } : q,
        )
      }
      setQuestionDraft(nextQuestions)
      await persistSession(groupDraft, nextQuestions)
      setQuestionDrawer({ open: false, mode: 'add', draft: null })
    } catch (err) {
      setSaveError(err.message || 'Could not save question.')
    } finally {
      setSaveBusy(false)
    }
  }

  async function deleteGroup(groupId) {
    const count = questionCountByGroup.get(groupId) || 0
    const g = groupDraft.find((x) => x.id === groupId)
    const msg =
      count > 0
        ? `Delete “${g?.name}” and its ${count} question(s)? This cannot be undone.`
        : `Delete group “${g?.name}”?`
    if (!window.confirm(msg)) return

    setSaveError('')
    setSaveBusy(true)
    try {
      const { error } = await adminDeleteLiveQuizGroup(pin, groupId)
      if (error) throw error
      const nextGroups = groupDraft.filter((g) => g.id !== groupId)
      const nextQuestions = questionDraft.filter((q) => q.group_id !== groupId)
      setGroupDraft(nextGroups)
      setQuestionDraft(nextQuestions)
      onSaved?.()
      if (filterGroupId === groupId) {
        const nextId = nextGroups[0]?.id > 0 ? nextGroups[0].id : null
        handleGroupFilterChange(nextId)
      }
    } catch (err) {
      setSaveError(err.message || 'Could not delete group.')
    } finally {
      setSaveBusy(false)
    }
  }

  async function deleteQuestion(questionNumber) {
    if (!window.confirm(`Delete question Q${questionNumber}?`)) return
    setSaveError('')
    setSaveBusy(true)
    try {
      const { error } = await adminDeleteLiveQuizQuestion(pin, questionNumber)
      if (error) throw error
      setQuestionDraft((prev) => prev.filter((q) => q.question_number !== questionNumber))
      onSaved?.()
    } catch (err) {
      setSaveError(err.message || 'Could not delete question.')
    } finally {
      setSaveBusy(false)
    }
  }

  async function confirmClearGroup() {
    if (!resetGroupId || resetGroupId < 1) {
      setSaveError('Select a group to reset.')
      return
    }
    setSaveError('')
    setClearBusy(true)
    const { error } = await adminClearGroupAnswers(pin, resetGroupId)
    setClearBusy(false)
    setClearConfirmOpen(false)
    if (error) {
      setSaveError(error.message || 'Could not reset group.')
      return
    }
    onCleared?.()
  }

  function handleGroupFilterChange(id) {
    const parsed = id == null ? null : Number(id)
    setFilterGroupId(parsed)
    onActiveGroupChange?.(parsed)
    try {
      if (parsed != null) sessionStorage.setItem(ACTIVE_GROUP_KEY, String(parsed))
    } catch {
      /* ignore */
    }
  }

  function openAddGroup() {
    setGroupDrawer({
      open: true,
      mode: 'add',
      draft: { id: null, name: '', mode: 'poll' },
    })
  }

  function openEditGroup(g) {
    setGroupDrawer({
      open: true,
      mode: 'edit',
      draft: { id: g.id, name: g.name, mode: g.mode },
    })
  }

  function openAddQuestion() {
    if (!filterGroupId || filterGroupId < 1) {
      setSaveError('Select a saved group before adding questions.')
      return
    }
    setQuestionDrawer({ open: true, mode: 'add', draft: emptyQuestion(filterGroupId) })
  }

  function openEditQuestion(q) {
    setQuestionDrawer({
      open: true,
      mode: 'edit',
      draft: { ...q },
    })
  }

  const groupDrawerFooter = (
    <>
      <button type="button" className="btn ghost" onClick={() => setGroupDrawer({ open: false, mode: 'add', draft: null })} disabled={saveBusy}>
        Cancel
      </button>
      <button type="button" className="btn primary" onClick={saveGroupFromDrawer} disabled={disabled || saveBusy}>
        {saveBusy ? 'Saving…' : 'Save group'}
      </button>
    </>
  )

  const questionDrawerFooter = (
    <>
      <button
        type="button"
        className="btn ghost"
        onClick={() => setQuestionDrawer({ open: false, mode: 'add', draft: null })}
        disabled={saveBusy}
      >
        Cancel
      </button>
      <button type="button" className="btn primary" onClick={saveQuestionFromDrawer} disabled={disabled || saveBusy}>
        {saveBusy ? 'Saving…' : 'Save question'}
      </button>
    </>
  )

  return (
    <section className="live-config live-config--panel">
      {saveError && (
        <p className="login-error live-config-error" role="alert">
          {saveError}
        </p>
      )}

      {view === 'groups' && (
        <>
          <header className="live-config-toolbar">
            <div>
              <h3 className="live-panel-head-title">Question groups</h3>
              <p className="live-panel-head-desc">Manage poll and competition sessions.</p>
            </div>
            <button type="button" className="btn primary" onClick={openAddGroup} disabled={disabled || saveBusy}>
              + Add group
            </button>
          </header>

          <label className="live-config-filter-label" htmlFor="live-config-hosting-group">
            Default group when hosting
          </label>
          <select
            id="live-config-hosting-group"
            className="live-config-group-select"
            value={filterGroupId && filterGroupId > 0 ? filterGroupId : ''}
            onChange={(e) => handleGroupFilterChange(Number(e.target.value))}
            disabled={disabled || saveBusy || savedGroups.length === 0}
          >
            {savedGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>

          {savedGroups.length === 0 ? (
            <p className="live-muted live-admin-empty">No groups yet. Add your first group.</p>
          ) : (
            <ul className="live-group-grid">
              {savedGroups.map((g) => (
                <li key={g.id} className="live-group-card">
                  <span className={`live-group-card-badge live-group-card-badge--${g.mode}`}>
                    {g.mode === 'competition' ? 'Competition' : 'Poll'}
                  </span>
                  <h4 className="live-group-card-name">{g.name}</h4>
                  <p className="live-group-card-meta">
                    {questionCountByGroup.get(g.id) || 0} question
                    {(questionCountByGroup.get(g.id) || 0) === 1 ? '' : 's'}
                  </p>
                  <div className="live-group-card-actions">
                    <button type="button" className="btn ghost" onClick={() => openEditGroup(g)} disabled={disabled || saveBusy}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn ghost live-btn-danger-outline"
                      onClick={() => deleteGroup(g.id)}
                      disabled={disabled || saveBusy}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {view === 'questions' && (
        <>
          <header className="live-config-toolbar">
            <div>
              <h3 className="live-panel-head-title">Questions</h3>
              <p className="live-panel-head-desc">Add and edit questions for one group at a time.</p>
            </div>
            <button
              type="button"
              className="btn primary"
              onClick={openAddQuestion}
              disabled={disabled || saveBusy || !filterGroupId || filterGroupId < 1}
            >
              + Add question
            </button>
          </header>

          <label className="live-config-filter-label" htmlFor="live-config-q-group">
            Question group
          </label>
          <select
            id="live-config-q-group"
            className="live-config-group-select"
            value={filterGroupId && filterGroupId > 0 ? filterGroupId : ''}
            onChange={(e) => handleGroupFilterChange(Number(e.target.value))}
            disabled={disabled || saveBusy || savedGroups.length === 0}
          >
            <option value="">Select a group…</option>
            {savedGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.mode === 'competition' ? 'Competition' : 'Poll'})
              </option>
            ))}
          </select>

          {!filterGroupId || filterGroupId < 1 ? (
            <p className="live-muted live-admin-empty">Choose a saved group to view or add questions.</p>
          ) : filteredQuestions.length === 0 ? (
            <p className="live-muted live-admin-empty">
              No questions in <strong>{filterGroup?.name}</strong> yet.
            </p>
          ) : (
            <ul className="live-question-list">
              {filteredQuestions.map((q) => (
                <li key={q.question_number} className="live-question-card">
                  <div className="live-question-card-main">
                    <span className="live-question-card-id">Q{q.question_number}</span>
                    <p className="live-question-card-title">{q.title || '(Untitled)'}</p>
                    <ul className="live-question-card-opts">
                      {[q.option_1_text, q.option_2_text, q.option_3_text]
                        .filter(Boolean)
                        .map((text, idx) => (
                          <li key={idx}>
                            {idx + 1}. {text}
                          </li>
                        ))}
                    </ul>
                  </div>
                  <div className="live-group-card-actions">
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => openEditQuestion(q)}
                      disabled={disabled || saveBusy}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn ghost live-btn-danger-outline"
                      onClick={() => deleteQuestion(q.question_number)}
                      disabled={disabled || saveBusy}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {view === 'reset' && (
        <>
          <header className="live-panel-head">
            <h3 className="live-panel-head-title">Reset answers for a group</h3>
            <p className="live-panel-head-desc">
              Clears parent answers for every question in the selected group. For competition
              groups, overall competition scores and the presentation podium are reset too. Families
              stay joined; parent phones show “Please wait” again (they are not removed from the
              roster).
            </p>
          </header>

          <label className="live-config-filter-label" htmlFor="live-reset-group">
            Select group to reset <span className="live-required">*</span>
          </label>
          <select
            id="live-reset-group"
            className="live-config-group-select"
            value={resetGroupId && resetGroupId > 0 ? resetGroupId : ''}
            onChange={(e) => setResetGroupId(Number(e.target.value))}
            disabled={disabled || clearBusy}
          >
            <option value="">Choose a group…</option>
            {savedGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} · {questionCountByGroup.get(g.id) || 0} questions
              </option>
            ))}
          </select>

          {resetGroup && (
            <div className="live-reset-scope-card">
              <p className="live-reset-scope-note">
                Resets votes for <strong>{resetGroup.name}</strong> only ({resetGroup.mode}).
                Other groups keep their answers. If a live question from this group is on screen,
                parents return to wait. Competition points on the leaderboard are not reduced
                automatically.
              </p>
            </div>
          )}

          {!clearConfirmOpen ? (
            <button
              type="button"
              className="btn primary live-btn-danger"
              onClick={() => {
                if (!resetGroupId || resetGroupId < 1) {
                  setSaveError('Select a group before resetting.')
                  return
                }
                setClearConfirmOpen(true)
              }}
              disabled={disabled || clearBusy || !resetGroupId}
            >
              Reset this group&apos;s answers…
            </button>
          ) : (
            <div className="live-config-clear-confirm" role="alertdialog">
              <p className="live-config-clear-title">Reset “{resetGroup?.name}”?</p>
              <p className="live-muted live-config-clear-desc">
                Parent answers for all questions in this group will be deleted.
              </p>
              <div className="live-config-clear-actions">
                <button type="button" className="btn ghost" onClick={() => setClearConfirmOpen(false)} disabled={clearBusy}>
                  Cancel
                </button>
                <button type="button" className="btn primary live-btn-danger" onClick={confirmClearGroup} disabled={clearBusy}>
                  {clearBusy ? 'Resetting…' : 'Yes, reset this group'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <LiveSlideDrawer
        open={groupDrawer.open}
        title={groupDrawer.mode === 'add' ? 'Add question group' : 'Edit question group'}
        onClose={() => setGroupDrawer({ open: false, mode: 'add', draft: null })}
        footer={groupDrawerFooter}
      >
        {groupDrawer.draft && (
          <div className="live-drawer-form">
            <label htmlFor="drawer-group-name">Group name</label>
            <input
              id="drawer-group-name"
              type="text"
              value={groupDrawer.draft.name}
              onChange={(e) =>
                setGroupDrawer((prev) => ({
                  ...prev,
                  draft: { ...prev.draft, name: e.target.value },
                }))
              }
              disabled={disabled || saveBusy}
            />
            <label htmlFor="drawer-group-mode">Type</label>
            <select
              id="drawer-group-mode"
              value={groupDrawer.draft.mode}
              onChange={(e) =>
                setGroupDrawer((prev) => ({
                  ...prev,
                  draft: { ...prev.draft, mode: e.target.value },
                }))
              }
              disabled={disabled || saveBusy}
            >
              <option value="poll">Poll — collect opinions</option>
              <option value="competition">Competition — correct answer &amp; speed</option>
            </select>
          </div>
        )}
      </LiveSlideDrawer>

      <LiveSlideDrawer
        open={questionDrawer.open}
        title={questionDrawer.mode === 'add' ? 'Add question' : `Edit Q${questionDrawer.draft?.question_number}`}
        onClose={() => setQuestionDrawer({ open: false, mode: 'add', draft: null })}
        footer={questionDrawerFooter}
      >
        {questionDrawer.draft && filterGroup && (
          <div className="live-drawer-form">
            <p className="live-drawer-context">
              Group: <strong>{filterGroup.name}</strong> ({filterGroup.mode})
            </p>
            <label htmlFor="drawer-q-title">Question</label>
            <input
              id="drawer-q-title"
              type="text"
              value={questionDrawer.draft.title}
              onChange={(e) =>
                setQuestionDrawer((prev) => ({
                  ...prev,
                  draft: { ...prev.draft, title: e.target.value },
                }))
              }
              disabled={disabled || saveBusy}
            />
            <label htmlFor="drawer-q-o1">Answer 1</label>
            <input
              id="drawer-q-o1"
              type="text"
              value={questionDrawer.draft.option_1_text}
              onChange={(e) =>
                setQuestionDrawer((prev) => ({
                  ...prev,
                  draft: { ...prev.draft, option_1_text: e.target.value },
                }))
              }
              disabled={disabled || saveBusy}
            />
            <label htmlFor="drawer-q-o2">Answer 2 (optional)</label>
            <input
              id="drawer-q-o2"
              type="text"
              value={questionDrawer.draft.option_2_text}
              onChange={(e) =>
                setQuestionDrawer((prev) => ({
                  ...prev,
                  draft: { ...prev.draft, option_2_text: e.target.value },
                }))
              }
              disabled={disabled || saveBusy}
            />
            <label htmlFor="drawer-q-o3">Answer 3 (optional)</label>
            <input
              id="drawer-q-o3"
              type="text"
              value={questionDrawer.draft.option_3_text}
              onChange={(e) =>
                setQuestionDrawer((prev) => ({
                  ...prev,
                  draft: { ...prev.draft, option_3_text: e.target.value },
                }))
              }
              disabled={disabled || saveBusy}
            />
            {filterGroup.mode === 'competition' && (
              <>
                <label htmlFor="drawer-q-correct">Correct answer</label>
                <select
                  id="drawer-q-correct"
                  value={questionDrawer.draft.correct_option}
                  onChange={(e) =>
                    setQuestionDrawer((prev) => ({
                      ...prev,
                      draft: { ...prev.draft, correct_option: e.target.value },
                    }))
                  }
                  disabled={disabled || saveBusy}
                >
                  <option value="">Select…</option>
                  <option value="1">1 — {questionDrawer.draft.option_1_text || 'Answer 1'}</option>
                  {(questionDrawer.draft.option_2_text || questionDrawer.draft.option_3_text) && (
                    <option value="2">2 — {questionDrawer.draft.option_2_text || 'Answer 2'}</option>
                  )}
                  {questionDrawer.draft.option_3_text && (
                    <option value="3">3 — {questionDrawer.draft.option_3_text}</option>
                  )}
                </select>
              </>
            )}
          </div>
        )}
      </LiveSlideDrawer>
    </section>
  )
}