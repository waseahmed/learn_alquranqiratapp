import { decodeAudioBlob } from './audioCompare'
import { computeF0Contour } from './recitationAnalysis'

function waitAudioEvent(el, eventName, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error('Audio load timed out'))
    }, timeoutMs)
    const done = () => {
      window.clearTimeout(timer)
      resolve()
    }
    const fail = () => {
      window.clearTimeout(timer)
      reject(new Error('Audio failed to load'))
    }
    el.addEventListener(eventName, done, { once: true })
    el.addEventListener('error', fail, { once: true })
  })
}

function concatFloat32(chunks) {
  let total = 0
  for (const c of chunks) total += c.length
  const out = new Float32Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out
}

function signalEnergy(signal) {
  let sum = 0
  for (let i = 0; i < signal.length; i += 1) sum += signal[i] * signal[i]
  return signal.length ? sum / signal.length : 0
}

export function syntheticPitchGuide(durationSec, wordCount = 3) {
  const steps = 96
  const segments = Math.max(1, wordCount)
  const hz = []
  for (let i = 0; i < steps; i += 1) {
    const t = i / Math.max(1, steps - 1)
    const seg = Math.floor(t * segments) % segments
    const base = 155 + seg * 28
    const melody = Math.sin(t * Math.PI * segments * 1.6) * 45
    const tail = Math.cos(t * 8) * 12
    hz.push(Math.max(90, base + melody + tail))
  }
  void durationSec
  return hz
}

async function getAudioDurationSec(url) {
  const audio = new Audio()
  audio.preload = 'metadata'
  audio.src = url
  await waitAudioEvent(audio, 'loadedmetadata')
  return Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 3
}

async function capturePitchViaWebAudio(url) {
  const audio = new Audio()
  audio.crossOrigin = 'anonymous'
  audio.preload = 'auto'
  audio.src = url
  await waitAudioEvent(audio, 'canplaythrough')

  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) throw new Error('Web Audio not supported')
  const ctx = new AudioCtx()
  const source = ctx.createMediaElementSource(audio)
  const processor = ctx.createScriptProcessor(8192, 1, 1)
  const chunks = []

  processor.onaudioprocess = (event) => {
    chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)))
  }

  const mute = ctx.createGain()
  mute.gain.value = 0
  source.connect(processor)
  processor.connect(mute)
  mute.connect(ctx.destination)

  try {
    await audio.play()
    await waitAudioEvent(audio, 'ended')
  } finally {
    processor.disconnect()
    source.disconnect()
    audio.pause()
    await ctx.close().catch(() => {})
  }

  const combined = concatFloat32(chunks)
  if (signalEnergy(combined) < 1e-8) {
    throw new Error('No audio signal captured (CORS may block analysis)')
  }
  return computeF0Contour(combined, ctx.sampleRate).hz
}

/**
 * Build a pitch contour for shadow practice without requiring fetch() CORS.
 */
export async function analyzeRecitationFromUrl(url, { wordCount = 3 } = {}) {
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' })
    if (res.ok) {
      const blob = await res.blob()
      const analysis = await decodeAudioBlob(blob)
      const f0 = computeF0Contour(analysis.channelData, analysis.sampleRate)
      if (f0.hz.some((h) => h > 0)) {
        return { hz: f0.hz, approximate: false, method: 'fetch' }
      }
    }
  } catch {
    /* cross-origin fetch often blocked; try playback capture */
  }

  try {
    const hz = await capturePitchViaWebAudio(url)
    if (hz.some((h) => h > 0)) {
      return { hz, approximate: false, method: 'playback' }
    }
  } catch {
    /* fall through */
  }

  const duration = await getAudioDurationSec(url)
  return {
    hz: syntheticPitchGuide(duration, wordCount),
    approximate: true,
    method: 'guide',
  }
}