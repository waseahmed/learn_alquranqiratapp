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

function tone(freq, start, duration, volume = 0.12) {
  const ctx = getCtx()
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, start)
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(volume, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration + 0.05)
}

export function playQuestionPopSound() {
  const ctx = getCtx()
  if (!ctx) return
  unlockLiveQuizAudio()
  const t = ctx.currentTime
  tone(523.25, t, 0.18, 0.1)
  tone(659.25, t + 0.1, 0.22, 0.1)
}

export function playAnswerSound() {
  const ctx = getCtx()
  if (!ctx) return
  unlockLiveQuizAudio()
  const t = ctx.currentTime
  tone(440, t, 0.12, 0.09)
  tone(554.37, t + 0.08, 0.16, 0.11)
  tone(659.25, t + 0.16, 0.2, 0.1)
}