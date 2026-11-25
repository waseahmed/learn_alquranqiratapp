export function formatResponseMs(ms) {
  const n = Number(ms)
  if (!Number.isFinite(n) || n < 0) return '—'
  if (n < 1000) return `${n} ms`
  return `${(n / 1000).toFixed(2)} s`
}