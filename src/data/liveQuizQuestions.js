/** Default labels when Supabase questions are not loaded yet. */
export const LIVE_QUIZ_TIMER_SECONDS = 10

export const DEFAULT_LIVE_QUESTIONS = [
  {
    question_number: 1,
    title: 'Question 1',
    option_1_text: 'Option 1',
    option_2_text: 'Option 2',
    option_3_text: 'Option 3',
    option_count: 3,
  },
  {
    question_number: 2,
    title: 'Question 2',
    option_1_text: 'Option 1',
    option_2_text: 'Option 2',
    option_3_text: 'Option 3',
    option_count: 3,
  },
  {
    question_number: 3,
    title: 'Question 3',
    option_1_text: 'Option 1',
    option_2_text: 'Option 2',
    option_3_text: 'Option 3',
    option_count: 3,
  },
  {
    question_number: 4,
    title: 'Question 4',
    option_1_text: 'Option 1',
    option_2_text: 'Option 2',
    option_3_text: 'Option 3',
    option_count: 3,
  },
  {
    question_number: 5,
    title: 'Question 5',
    option_1_text: 'Option 1',
    option_2_text: 'Option 2',
    option_3_text: 'Option 3',
    option_count: 3,
  },
]

function parentShowsOptionText(row, group) {
  const raw = row?.send_option_text ?? group?.send_option_text
  if (raw === false || raw === 'false') return false
  return true
}

export function normalizeQuestion(row, group = null) {
  if (!row) return null
  const options = []
  if (row.option_1_text?.trim()) options.push(row.option_1_text.trim())
  if (row.option_2_text?.trim()) options.push(row.option_2_text.trim())
  if (row.option_3_text?.trim()) options.push(row.option_3_text.trim())
  const optionCount = row.option_count ?? options.length
  const sendOptionText = parentShowsOptionText(row, group)
  const sendLabels = Array.from({ length: optionCount }, (_, i) => {
    const text = options[i]
    if (sendOptionText && text) return `${i + 1}. ${text}`
    return String(i + 1)
  })
  return {
    number: row.question_number,
    title: row.title || `Question ${row.question_number}`,
    options,
    optionCount,
    groupId: row.group_id ?? null,
    groupMode: row.group_mode === 'competition' ? 'competition' : 'poll',
    isCompetition: row.group_mode === 'competition',
    correctOption: row.correct_option ?? null,
    showQuestionsOnParents: row.show_questions_on_parents !== false,
    sendOptionText,
    /** Shown on parent + admin send buttons during live session */
    sendLabels,
  }
}

export function getQuestionFromList(list, number, groupLookup = null) {
  const row = list?.find((q) => q.question_number === number)
  if (!row) return null
  const group =
    typeof groupLookup === 'function'
      ? groupLookup(row.group_id)
      : groupLookup?.get?.(Number(row.group_id)) ?? null
  return normalizeQuestion(row, group)
}

export function getFullOptionLabel(question, optionNumber) {
  if (!question || !optionNumber) return ''
  return question.options[optionNumber - 1] ?? `Option ${optionNumber}`
}

/** @deprecated use getQuestionFromList with DB list */
export function getQuestion(number) {
  return getQuestionFromList(DEFAULT_LIVE_QUESTIONS, number)
}

export const LIVE_QUIZ_QUESTIONS = DEFAULT_LIVE_QUESTIONS.map(normalizeQuestion)