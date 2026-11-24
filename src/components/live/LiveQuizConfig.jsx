import { useEffect, useState } from 'react'
import { DEFAULT_LIVE_QUESTIONS } from '../../data/liveQuizQuestions'
import { adminClearLiveQuizAnswers, adminSaveLiveQuizQuestions } from '../../services/liveQuiz'

function emptyDraft() {
  return DEFAULT_LIVE_QUESTIONS.map((q) => ({
    question_number: q.question_number,
    title: q.title,
    option_1_text: q.option_1_text || '',
    option_2_text: q.option_2_text || '',
    option_3_text: q.option_3_text || '',
  }))
}

export default function LiveQuizConfig({ pin, rows, onSaved, onCleared, disabled }) {
  const [draft, setDraft] = useState(emptyDraft)
  const [saveError, setSaveError] = useState('')
  const [saveBusy, setSaveBusy] = useState(false)
  const [clearBusy, setClearBusy] = useState(false)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)

  useEffect(() => {
    if (!rows?.length) return
    setDraft(
      rows.map((q) => ({
        question_number: q.question_number,
        title: q.title || '',
        option_1_text: q.option_1_text || '',
        option_2_text: q.option_2_text || '',
        option_3_text: q.option_3_text || '',
      })),
    )
  }, [rows])

  function updateQuestion(num, field, value) {
    setDraft((prev) =>
      prev.map((q) => (q.question_number === num ? { ...q, [field]: value } : q)),
    )
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaveError('')
    setSaveBusy(true)
    const payload = draft.map((q) => ({
      question_number: q.question_number,
      title: q.title.trim(),
      option_1_text: q.option_1_text.trim() || null,
      option_2_text: q.option_2_text.trim() || null,
      option_3_text: q.option_3_text.trim() || null,
    }))
    const { error } = await adminSaveLiveQuizQuestions(pin, payload)
    setSaveBusy(false)
    if (error) {
      setSaveError(error.message || 'Could not save questions.')
      return
    }
    onSaved?.()
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

  return (
    <section className="live-config" aria-labelledby="live-config-heading">
      <h3 id="live-config-heading" className="live-stats-heading">
        Session config
      </h3>
      <p className="live-muted live-config-hint">
        Parents and the Send row show <strong>1</strong>, <strong>2</strong>, <strong>3</strong>{' '}
        during the live round. Overviews show the full question and answer text below.
      </p>

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
            This deletes all parent answers, resets vote counts, removes every ✓ above Send, and
            turns off Live on all questions. Families stay joined — you can send questions again
            from the Host tab.
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
        {draft.map((q) => (
          <fieldset key={q.question_number} className="live-config-q">
            <legend className="live-config-legend">Question {q.question_number}</legend>
            <label htmlFor={`q${q.question_number}-title`}>Question text</label>
            <input
              id={`q${q.question_number}-title`}
              type="text"
              value={q.title}
              onChange={(e) => updateQuestion(q.question_number, 'title', e.target.value)}
              disabled={disabled || saveBusy}
            />
            <label htmlFor={`q${q.question_number}-o1`}>Answer 1 (required if any options)</label>
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
          </fieldset>
        ))}

        {saveError && (
          <p className="login-error" role="alert">
            {saveError}
          </p>
        )}

        <button type="submit" className="btn primary" disabled={disabled || saveBusy}>
          {saveBusy ? 'Saving…' : 'Save question setup'}
        </button>
      </form>
    </section>
  )
}