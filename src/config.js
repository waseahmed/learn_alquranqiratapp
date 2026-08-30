/**
 * Audio base URL (no trailing slash).
 *
 * Local / Vite dev (default when VITE_AUDIO_BASE_URL is unset in DEV):
 *   /audio/recitations
 *   → served from project folder ./audio/recitations/...
 *
 * Production / remote:
 *   https://audio.alquranqiratacademy.com/recitations
 *
 * Override anytime with VITE_AUDIO_BASE_URL in .env
 */
const DEFAULT_REMOTE_AUDIO =
  'https://audio.alquranqiratacademy.com/recitations'
const DEFAULT_LOCAL_AUDIO = '/audio/recitations'

function resolveAudioBaseUrl() {
  const fromEnv = import.meta.env.VITE_AUDIO_BASE_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (import.meta.env.DEV) return DEFAULT_LOCAL_AUDIO
  return DEFAULT_REMOTE_AUDIO
}

export const AUDIO_BASE_URL = resolveAudioBaseUrl()

export const APP_NAME = 'Al Quran Qirat Academy'
export const APP_TAGLINE = 'For Excellence'
export const PORTAL_NAME = 'Qirat Learning Portal'
