const SIDEBAR_KEY = 'aqqaSidebarCollapsed'
const QARIS_KEY = 'aqqaSelectedQaris'
const LAST_POS_KEY = 'aqqaLastPosition'

export function loadSelectedQaris(fallback) {
  try {
    const raw = localStorage.getItem(QARIS_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

export function saveSelectedQaris(keys) {
  localStorage.setItem(QARIS_KEY, JSON.stringify([...keys]))
}

export function loadSidebarCollapsed() {
  try {
    return JSON.parse(localStorage.getItem(SIDEBAR_KEY) || '{}')
  } catch {
    return {}
  }
}

export function saveSidebarCollapsed(map) {
  localStorage.setItem(SIDEBAR_KEY, JSON.stringify(map))
}

export function loadLastPosition() {
  try {
    const raw = localStorage.getItem(LAST_POS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.surah && parsed?.ayah) return parsed
    return null
  } catch {
    return null
  }
}

export function saveLastPosition(surah, ayah) {
  localStorage.setItem(LAST_POS_KEY, JSON.stringify({ surah, ayah }))
}
