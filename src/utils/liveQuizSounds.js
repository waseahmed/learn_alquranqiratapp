let audioCtx = null

function getCtx() {
  if (typeof window === 'undefined') return null
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  if (!audioCtx) audioCtx = new Ctx()
  return audioCtx
}

/** Call after a user tap so mobile browsers allow playback. */
export function unlockLiveQuizAudio() {
  const ctx = getCtx()
  if (ctx?.state === 'suspended') {
    ctx.resume().catch(() => {})
  }
}

function masterGain(ctx, start, peak, duration) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, start)
  g.gain.linearRampToValueAtTime(peak, start + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  g.connect(ctx.destination)
  return g
}

/** Short drum knock (tabla-style). */
function drumHit(start, volume = 0.55) {
  const ctx = getCtx()
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const out = masterGain(ctx, start, volume, 0.22)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(210, start)
  osc.frequency.exponentialRampToValueAtTime(72, start + 0.11)
  gain.gain.setValueAtTime(1, start)
  osc.connect(gain)
  gain.connect(out)
  osc.start(start)
  osc.stop(start + 0.28)
}

/** Hijaz-style note — warm, oud-like (triangle + gentle filter). */
function hijazNote(freq, start, duration, volume = 0.38) {
  const ctx = getCtx()
  if (!ctx) return
  const osc = ctx.createOscillator()
  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  const out = masterGain(ctx, start, volume, duration + 0.08)
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(freq, start)
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(2400, start)
  filter.Q.value = 0.7
  gain.gain.setValueAtTime(0.95, start)
  gain.gain.exponentialRampToValueAtTime(0.08, start + duration)
  osc.connect(filter)
  filter.connect(gain)
  gain.connect(out)
  osc.start(start)
  osc.stop(start + duration + 0.1)
}

// Hijaz on D: D · Eb · F# · G · A (classic “Arabic” colour)
const HIJAZ = [293.66, 311.13, 369.99, 392.0, 440.0, 466.16, 554.37]

/** New question — attention call: drum + ascending Hijaz phrase */
export function playQuestionPopSound() {
  const ctx = getCtx()
  if (!ctx) return
  unlockLiveQuizAudio()
  const t = ctx.currentTime

  drumHit(t, 0.62)
  drumHit(t + 0.14, 0.48)

  hijazNote(HIJAZ[0], t + 0.08, 0.2, 0.42)
  hijazNote(HIJAZ[1], t + 0.22, 0.22, 0.4)
  hijazNote(HIJAZ[2], t + 0.38, 0.26, 0.44)
  hijazNote(HIJAZ[4], t + 0.56, 0.34, 0.48)
}

/** Answer locked in — cheerful Hijaz run + stronger drums */
export function playAnswerSound() {
  const ctx = getCtx()
  if (!ctx) return
  unlockLiveQuizAudio()
  const t = ctx.currentTime

  drumHit(t, 0.58)
  hijazNote(HIJAZ[3], t + 0.06, 0.14, 0.4)
  hijazNote(HIJAZ[4], t + 0.18, 0.16, 0.45)
  hijazNote(HIJAZ[6], t + 0.32, 0.22, 0.5)
  drumHit(t + 0.36, 0.65)
  hijazNote(HIJAZ[4], t + 0.42, 0.4, 0.52)
}