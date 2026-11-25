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

export async function fetchLiveQuizParticipant(participantId) {
  if (!supabase || !participantId) {
    return { data: null, error: new Error('Missing participant') }
  }
  const { data, error } = await supabase.rpc('live_quiz_get_participant', {
    p_participant_id: participantId,
  })
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

export async function adminRemoveAllParticipants(pin) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured') }
  const { data, error } = await supabase.rpc('live_quiz_admin_remove_all_participants', {
    p_pin: pin,
  })
  return { data, error }
}

export async function adminLiveQuizDetailedAnalysis(pin) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured') }
  const { data, error } = await supabase.rpc('live_quiz_admin_detailed_analysis', {
    p_pin: pin,
  })
  return { data, error }
}

function parseQuestionsPayload(data) {
  if (data && typeof data === 'object' && Array.isArray(data.questions)) {
    return {
      groups: Array.isArray(data.groups) ? data.groups : [],
      questions: data.questions,
    }
  }
  if (Array.isArray(data)) {
    return {
      groups: [{ id: 1, name: 'General session', mode: 'poll', sort_order: 0 }],
      questions: data,
    }
  }
  return {
    groups: [{ id: 1, name: 'General session', mode: 'poll', sort_order: 0 }],
    questions: DEFAULT_LIVE_QUESTIONS,
  }
}

export async function fetchLiveQuizQuestions() {
  if (!supabase) {
    return {
      data: parseQuestionsPayload(DEFAULT_LIVE_QUESTIONS),
      error: null,
    }
  }
  const { data, error } = await supabase.rpc('live_quiz_get_questions')
  return { data: parseQuestionsPayload(data), error }
}

export async function verifyAdminPin(pin) {
  if (!supabase) return { data: false, error: new Error('Supabase is not configured') }
  const { data, error } = await supabase.rpc('live_quiz_verify_pin', { p_pin: pin })
  return { data: Boolean(data), error }
}

export async function adminSaveLiveQuizQuestions(pin, questions) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured') }
  const { data, error } = await supabase.rpc('live_quiz_admin_save_questions', {
    p_pin: pin,
    p_questions: questions,
  })
  return { data: parseQuestionsPayload(data), error }
}

export async function adminSaveLiveQuizSessionConfig(pin, groups, questions) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured') }
  const { data, error } = await supabase.rpc('live_quiz_admin_save_session_config', {
    p_pin: pin,
    p_groups: groups,
    p_questions: questions,
  })
  return { data: parseQuestionsPayload(data), error }
}

export async function adminSetActiveGroup(pin, groupId) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured') }
  const { data, error } = await supabase.rpc('live_quiz_admin_set_active_group', {
    p_pin: pin,
    p_group_id: groupId,
  })
  return { data, error }
}

export async function fetchLivePresentSnapshot() {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured') }
  const { data, error } = await supabase.rpc('live_quiz_present_snapshot')
  return { data, error }
}

export async function adminClearLiveQuizAnswers(pin) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured') }
  const { error } = await supabase.rpc('live_quiz_admin_clear_answers', { p_pin: pin })
  return { data: null, error }
}

export async function adminClearGroupAnswers(pin, groupId) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured') }
  const { error } = await supabase.rpc('live_quiz_admin_clear_group_answers', {
    p_pin: pin,
    p_group_id: groupId,
  })
  return { data: null, error }
}

export async function adminDeleteLiveQuizGroup(pin, groupId) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured') }
  const { error } = await supabase.rpc('live_quiz_admin_delete_group', {
    p_pin: pin,
    p_group_id: groupId,
  })
  return { data: null, error }
}

export async function adminDeleteLiveQuizQuestion(pin, questionNumber) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured') }
  const { error } = await supabase.rpc('live_quiz_admin_delete_question', {
    p_pin: pin,
    p_question_number: questionNumber,
  })
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