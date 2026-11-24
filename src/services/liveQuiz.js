import { DEFAULT_LIVE_QUESTIONS } from '../data/liveQuizQuestions'
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

export async function joinLiveQuiz({ kidName, parentRole }) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured') }
  const { data, error } = await supabase
    .from('live_quiz_participants')
    .insert({
      kid_name: kidName.trim(),
      parent_role: parentRole,
    })
    .select('id')
    .single()
  return { data, error }
}

export async function submitLiveQuizVote(participantId, optionNumber) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured') }
  const { data, error } = await supabase.rpc('live_quiz_submit_vote', {
    p_participant_id: participantId,
    p_option: optionNumber,
  })
  return { data, error }
}

export async function adminLiveQuizStats(pin) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured') }
  const { data, error } = await supabase.rpc('live_quiz_admin_stats', { p_pin: pin })
  return { data, error }
}

/** Opens a question for parent voting; hostOption marks which send button was used. */
export async function adminShowOption(pin, questionNumber, hostOption = 1) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured') }
  const { data, error } = await supabase.rpc('live_quiz_admin_show_option', {
    p_pin: pin,
    p_question: questionNumber,
    p_option: hostOption,
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

export async function sendLiveQuizHeartbeat(participantId) {
  if (!supabase || !participantId) return { data: null, error: null }
  const { data, error } = await supabase.rpc('live_quiz_heartbeat', {
    p_participant_id: participantId,
  })
  return { data, error }
}

export async function adminRemoveParticipant(pin, participantId) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured') }
  const { error } = await supabase.rpc('live_quiz_admin_remove_participant', {
    p_pin: pin,
    p_participant_id: participantId,
  })
  return { data: null, error }
}

export async function adminLiveQuizDetailedAnalysis(pin) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured') }
  const { data, error } = await supabase.rpc('live_quiz_admin_detailed_analysis', {
    p_pin: pin,
  })
  return { data, error }
}

export async function fetchLiveQuizQuestions() {
  if (!supabase) return { data: DEFAULT_LIVE_QUESTIONS, error: null }
  const { data, error } = await supabase.rpc('live_quiz_get_questions')
  return { data, error }
}

export async function adminSaveLiveQuizQuestions(pin, questions) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured') }
  const { data, error } = await supabase.rpc('live_quiz_admin_save_questions', {
    p_pin: pin,
    p_questions: questions,
  })
  return { data, error }
}

export async function adminClearLiveQuizAnswers(pin) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured') }
  const { error } = await supabase.rpc('live_quiz_admin_clear_answers', { p_pin: pin })
  return { data: null, error }
}

function liveQuizChannelKey(table) {
  return `live-quiz-${table}:${crypto.randomUUID()}`
}

export function subscribeLiveQuizQuestions(onChange) {
  if (!supabase) return () => {}

  const channel = supabase
    .channel(liveQuizChannelKey('questions'))
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'live_quiz_questions' },
      () => onChange(),
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

export function subscribeLiveQuizState(onChange) {
  if (!supabase) return () => {}

  const channel = supabase
    .channel(liveQuizChannelKey('state'))
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

export function subscribeLiveQuizVotes(onInsert) {
  if (!supabase) return () => {}

  const channel = supabase
    .channel(liveQuizChannelKey('votes'))
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'live_quiz_votes' },
      () => onInsert(),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'live_quiz_votes' },
      () => onInsert(),
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}