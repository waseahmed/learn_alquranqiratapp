/** Edit labels here to match your live session content. */
export const LIVE_QUIZ_TIMER_SECONDS = 10

export const LIVE_QUIZ_QUESTIONS = [
  {
    number: 1,
    title: 'Question 1',
    options: ['Option 1', 'Option 2', 'Option 3'],
  },
  {
    number: 2,
    title: 'Question 2',
    options: ['Option 1', 'Option 2', 'Option 3'],
  },
  {
    number: 3,
    title: 'Question 3',
    options: ['Option 1', 'Option 2', 'Option 3'],
  },
  {
    number: 4,
    title: 'Question 4',
    options: ['Option 1', 'Option 2', 'Option 3'],
  },
  {
    number: 5,
    title: 'Question 5',
    options: ['Option 1', 'Option 2', 'Option 3'],
  },
]

export function getQuestion(number) {
  return LIVE_QUIZ_QUESTIONS.find((q) => q.number === number) ?? null
}