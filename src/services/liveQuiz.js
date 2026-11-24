import { supabase } from './supabase'

export async function fetchLiveQuizState() {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured') }
  const { data, error } = await supabase
    .from('live_quiz_state')
    .select('*')
    .eq('id', 1)
    .maybeSingle()
  return { data, error }
}

export async function joinLiveQuiz({ kidName, parentName, gender }) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured') }
  const { data, error } = await supabase
    .from('live_quiz_participants')
    .insert({
      kid_name: kidName.trim(),
      parent_name: parentName.trim(),
      gender,
    })
    .select('id')
    .single()
  return { data, error }
}

export async function adminShowOption(pin, questionNumber, optionNumber) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured') }
  const { data, error } = await supabase.rpc('live_quiz_admin_show_option', {
    p_pin: pin,
    p_question: questionNumber,
    p_option: optionNumber,
  })
  return { data, error }
}

export async function adminShowWait(pin) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured') }
  const { data, error } = await supabase.rpc('live_quiz_admin_wait', { p_pin: pin })
  return { data, error }
}

export async function adminListParticipants(pin) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured') }
  const { data, error } = await supabase.rpc('live_quiz_list_participants', { p_pin: pin })
  return { data, error }
}

export function subscribeLiveQuizState(onChange) {
  if (!supabase) return () => {}

  const channel = supabase
    .channel('live-quiz-state')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'live_quiz_state' },
      (payload) => {
        const row = payload.new
        if (row?.id === 1) onChange(row)
      },
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}