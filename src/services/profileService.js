import { DEFAULT_SELECTED_QARIS } from '../data/qaris'
import { supabase } from './supabase'

export const DEFAULT_THEME = {
  green: '#1e6039',
  gold: '#c99334',
  background: '#f8faf5',
  ink: '#193322',
}

export const DEFAULT_SIDEBAR = {
  showPopular: true,
  showFullQuran: true,
  showJuz: true,
  showAyahSection: true,
  showAyahIndex: true,
  autoAdvanceAyah: false,
}

function lighten(hex, amount = 0.88) {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = Number.parseInt(full, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const mix = (c) => Math.round(c + (255 - c) * amount)
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}

export function applyTheme(theme) {
  const t = { ...DEFAULT_THEME, ...(theme || {}) }
  const root = document.documentElement
  root.style.setProperty('--green', t.green)
  root.style.setProperty('--gold', t.gold)
  root.style.setProperty('--bg', t.background)
  root.style.setProperty('--ink', t.ink)
  root.style.setProperty('--soft', lighten(t.green, 0.9))
  document.body.style.background = `
    radial-gradient(ellipse at top, ${lighten(t.green, 0.92)} 0%, transparent 55%),
    linear-gradient(180deg, ${t.background} 0%, ${t.background} 100%)
  `
  document.body.style.color = t.ink
}

export async function fetchPreferences(userId) {
  if (!supabase || !userId) return null

  let { data, error } = await supabase
    .from('user_preferences')
    .select('user_id, qari_order, theme, sidebar')
    .eq('user_id', userId)
    .maybeSingle()

  if (error && /sidebar/i.test(error.message || '')) {
    const fallback = await supabase
      .from('user_preferences')
      .select('user_id, qari_order, theme')
      .eq('user_id', userId)
      .maybeSingle()
    data = fallback.data
    error = fallback.error
  }

  if (error) {
    console.warn('Could not load preferences:', error.message)
    return null
  }

  if (!data) {
    const { data: created, error: insertError } = await supabase
      .from('user_preferences')
      .insert({ user_id: userId })
      .select('user_id, qari_order, theme, sidebar')
      .maybeSingle()
    if (insertError) {
      console.warn('Could not create preferences:', insertError.message)
      return {
        user_id: userId,
        qari_order: [...DEFAULT_SELECTED_QARIS],
        theme: { ...DEFAULT_THEME },
        sidebar: { ...DEFAULT_SIDEBAR },
      }
    }
    return normalizePrefs(created)
  }

  return normalizePrefs(data)
}

function normalizePrefs(data) {
  return {
    ...data,
    qari_order: data?.qari_order?.length ? data.qari_order : [...DEFAULT_SELECTED_QARIS],
    theme: { ...DEFAULT_THEME, ...(data?.theme || {}) },
    sidebar: { ...DEFAULT_SIDEBAR, ...(data?.sidebar || {}) },
  }
}

export async function savePreferences(userId, patch) {
  if (!supabase || !userId) return { error: new Error('Not signed in') }
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' })
    .select('user_id, qari_order, theme, sidebar')
    .maybeSingle()

  if (error && /sidebar/i.test(error.message || '')) {
    const { sidebar, ...rest } = patch
    const retry = await supabase
      .from('user_preferences')
      .upsert({ user_id: userId, ...rest }, { onConflict: 'user_id' })
      .select('user_id, qari_order, theme')
      .maybeSingle()
    return {
      data: retry.data ? normalizePrefs({ ...retry.data, sidebar }) : null,
      error: retry.error,
    }
  }

  return { data: data ? normalizePrefs(data) : null, error }
}

export async function updateProfileBasics(userId, { display_name, avatar_url }) {
  if (!supabase || !userId) return { error: new Error('Not signed in') }
  const updates = {}
  if (display_name !== undefined) updates.display_name = display_name
  if (avatar_url !== undefined) updates.avatar_url = avatar_url

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('id, display_name, role, active, avatar_url')
    .maybeSingle()

  return { data, error }
}

export async function uploadAvatar(userId, file) {
  if (!supabase || !userId) return { error: new Error('Not signed in') }
  if (!file) return { error: new Error('No file selected') }

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${userId}/avatar.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' })

  if (uploadError) {
    const raw = uploadError.message || ''
    if (/NoSuchBucket|Bucket not found/i.test(raw) || uploadError.statusCode === '404') {
      return {
        error: new Error(
          'Photo storage is not set up yet. Run supabase/avatars_bucket.sql in the Supabase SQL editor, then try again.',
        ),
      }
    }
    return { error: uploadError }
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  const publicUrl = `${data.publicUrl}?t=${Date.now()}`
  return updateProfileBasics(userId, { avatar_url: publicUrl })
}

export async function fetchBookmarks(userId) {
  if (!supabase || !userId) return []
  const { data, error } = await supabase
    .from('bookmarks')
    .select('id, kind, surah, ayah, note, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('Could not load bookmarks:', error.message)
    return []
  }
  return data || []
}

export async function addBookmark(userId, { kind, surah, ayah = null, note = null }) {
  if (!supabase || !userId) return { error: new Error('Not signed in') }

  // Avoid duplicate inserts (partial unique indexes; upsert onConflict is awkward with NULL ayah)
  let existingQuery = supabase
    .from('bookmarks')
    .select('id, kind, surah, ayah, note, created_at')
    .eq('user_id', userId)
    .eq('kind', kind)
    .eq('surah', Number(surah))

  if (kind === 'ayah') existingQuery = existingQuery.eq('ayah', Number(ayah))
  else existingQuery = existingQuery.is('ayah', null)

  const { data: existing } = await existingQuery.maybeSingle()
  if (existing) return { data: existing, error: null }

  const row = {
    user_id: userId,
    kind,
    surah: Number(surah),
    ayah: kind === 'ayah' ? Number(ayah) : null,
    note,
  }
  const { data, error } = await supabase
    .from('bookmarks')
    .insert(row)
    .select('id, kind, surah, ayah, note, created_at')
    .maybeSingle()
  return { data, error }
}

export async function removeBookmark(userId, bookmarkId) {
  if (!supabase || !userId) return { error: new Error('Not signed in') }
  const { error } = await supabase
    .from('bookmarks')
    .delete()
    .eq('id', bookmarkId)
    .eq('user_id', userId)
  return { error }
}

export async function removeBookmarkByTarget(userId, { kind, surah, ayah = null }) {
  if (!supabase || !userId) return { error: new Error('Not signed in') }
  let query = supabase
    .from('bookmarks')
    .delete()
    .eq('user_id', userId)
    .eq('kind', kind)
    .eq('surah', Number(surah))

  if (kind === 'ayah') query = query.eq('ayah', Number(ayah))
  else query = query.is('ayah', null)

  const { error } = await query
  return { error }
}
