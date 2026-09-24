import { supabase } from './supabase'

const SELECT_COLUMNS =
  'id, surah, ayah, qari_key, overall_score, pitch_score, pace_score, pause_score, rhythm_score, madd_score, created_at'

const MISSING_TABLE_MESSAGE =
  'Practice history is not set up yet. Run supabase/practice_attempts.sql in the Supabase SQL editor, then try again.'

function isMissingTableError(error) {
  if (!error) return false
  return error.code === '42P01' || /relation .* does not exist/i.test(error.message || '')
}

export async function savePracticeAttempt(userId, { surah, ayah, qariKey = null, overallScore, components = {} }) {
  if (!supabase || !userId) return { error: new Error('Not signed in') }

  const row = {
    user_id: userId,
    surah: Number(surah),
    ayah: Number(ayah),
    qari_key: qariKey,
    overall_score: Math.round(overallScore),
    pitch_score: components.pitch != null ? Math.round(components.pitch) : null,
    pace_score: components.pace != null ? Math.round(components.pace) : null,
    pause_score: components.pause != null ? Math.round(components.pause) : null,
    rhythm_score: components.rhythm != null ? Math.round(components.rhythm) : null,
    madd_score: components.madd != null ? Math.round(components.madd) : null,
  }

  const { data, error } = await supabase
    .from('practice_attempts')
    .insert(row)
    .select(SELECT_COLUMNS)
    .maybeSingle()

  if (error) {
    console.warn('Could not save practice attempt:', error.message)
    if (isMissingTableError(error)) {
      return { data: null, error: new Error(MISSING_TABLE_MESSAGE) }
    }
  }
  return { data, error }
}

export async function fetchPracticeTrend(userId, { surah, ayah, limit = 20 } = {}) {
  if (!supabase || !userId) return []

  let query = supabase
    .from('practice_attempts')
    .select(SELECT_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (surah != null) query = query.eq('surah', Number(surah))
  if (ayah != null) query = query.eq('ayah', Number(ayah))

  const { data, error } = await query
  if (error) {
    console.warn('Could not load practice trend:', error.message)
    return []
  }
  return data || []
}

/**
 * Full attempt history across all surahs/ayahs for "My Attempts". Unlike
 * fetchPracticeTrend, this surfaces the error instead of swallowing it, so
 * the page can tell the user their practice_attempts table isn't set up yet.
 */
export async function fetchPracticeHistory(userId, { limit = 200 } = {}) {
  if (!supabase || !userId) return { data: [], error: new Error('Not signed in') }

  const { data, error } = await supabase
    .from('practice_attempts')
    .select(SELECT_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.warn('Could not load practice history:', error.message)
    return { data: [], error: isMissingTableError(error) ? new Error(MISSING_TABLE_MESSAGE) : error }
  }
  return { data: data || [], error: null }
}
