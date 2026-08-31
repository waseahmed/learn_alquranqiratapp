/**
 * Audio base URL (no trailing slash).
 *
 * Set via env files / CI (no trailing slash):
 *   .env.development → /audio/recitations          (npm run dev)
 *   .env.production  → https://audio.../recitations (npm run build / Pages)
 *   VITE_AUDIO_BASE_URL override anytime
 *
 * Fallbacks if unset:
 *   DEV  → /audio/recitations
 *   PROD → https://audio.alquranqiratacademy.com/recitations
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
