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

/** True unless group explicitly saved “numbers only” (send_option_text false). */
export function parentShowsOptionText(row, group = null) {
  const raw = row?.send_option_text ?? group?.send_option_text
  if (raw === false || raw === 'false') return false
  return true
}

/** Default on for parents whenever we do not have an explicit numbers-only flag. */
export function parentShouldShowOptionText(row, group = null) {
  const raw = row?.send_option_text ?? group?.send_option_text
  if (raw === undefined || raw === null) return true
  return raw !== false && raw !== 'false'
}

function readOptionStrings(row) {
  const options = []
  const o1 = row?.option_1_text ?? row?.option1_text
  const o2 = row?.option_2_text ?? row?.option2_text
  const o3 = row?.option_3_text ?? row?.option3_text
  if (typeof o1 === 'string' && o1.trim()) options.push(o1.trim())
  if (typeof o2 === 'string' && o2.trim()) options.push(o2.trim())
  if (typeof o3 === 'string' && o3.trim()) options.push(o3.trim())
  return options
}

export function buildParentOptionLabels(options, optionCount, numbersOnly = false) {
  const count = Math.max(optionCount ?? 0, options.length, 1)
  return Array.from({ length: count }, (_, i) => {
    const text = options[i]
    if (text && !numbersOnly) return `${i + 1}. ${text}`
    return String(i + 1)
  })
}

export function normalizeQuestion(row, group = null) {
  if (!row) return null
  const options = readOptionStrings(row)
  const declaredCount = Number(row.option_count) || 0
  const effectiveCount = Math.max(declaredCount, options.length)
  const numbersOnly = !parentShouldShowOptionText(row, group)
  const sendOptionText = !numbersOnly
  const sendLabels = buildParentOptionLabels(options, effectiveCount, numbersOnly)
  return {
    number: row.question_number,
    title: row.title || `Question ${row.question_number}`,
    options,
    optionCount: effectiveCount,
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