const IDLE_WARN_SEC = 120

export function formatIdleSince(lastSeenAt, now = Date.now()) {
  if (!lastSeenAt) return { label: 'Unknown', idle: true, warn: true }
  const ts = new Date(lastSeenAt).getTime()
  const sec = Math.max(0, Math.floor((now - ts) / 1000))
  if (sec < 45) return { label: 'Active now', idle: false, warn: false }
  if (sec < 60) return { label: 'Idle ~1 min', idle: true, warn: false }
  if (sec < 3600) {
    const m = Math.floor(sec / 60)
    return {
      label: `Idle ${m} min`,
      idle: true,
      warn: sec >= IDLE_WARN_SEC,
    }
  }
  const h = Math.floor(sec / 3600)
  return { label: `Idle ${h}h+`, idle: true, warn: true }
}