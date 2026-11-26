import { decodeAudioBlob, rmsEnvelope } from './audioCompare'
import { computeF0Contour } from './recitationAnalysis'

const WAVE_POINTS = 320

function waitAudioEvent(el, eventName, timeoutMs = 25000) {
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

function analysisFromPcm(channelData, sampleRate, duration) {
  const envelope = rmsEnvelope(channelData, WAVE_POINTS)
  const f0 = computeF0Contour(channelData, sampleRate)
  return {
    envelope,
    pitchHz: f0.hz,
    duration: duration || channelData.length / Math.max(1, sampleRate),
    ready: envelope.some((v) => v > 0.02),
    channelData,
    sampleRate,
  }
}

export async function getAudioDurationSec(url) {
  const audio = new Audio()
  audio.preload = 'metadata'
  audio.src = url
  await waitAudioEvent(audio, 'loadedmetadata')
  return Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0
}

async function capturePcmViaWebAudio(url) {
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
    throw new Error('No audio signal captured')
  }
  return { channelData: combined, sampleRate: ctx.sampleRate, duration: audio.duration }
}

/**
 * Real reciter waveform + pitch from URL (fetch or muted Web Audio capture).
 */
export async function analyzeRecitationFromUrl(url) {
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' })
    if (res.ok) {
      const blob = await res.blob()
      const analysis = await decodeAudioBlob(blob)
      const payload = analysisFromPcm(
        analysis.channelData,
        analysis.sampleRate,
        analysis.duration,
      )
      if (payload.ready) {
        return { ...payload, method: 'fetch' }
      }
    }
  } catch {
    /* try capture */
  }

  try {
    const { channelData, sampleRate, duration } = await capturePcmViaWebAudio(url)
    const payload = analysisFromPcm(channelData, sampleRate, duration)
    if (payload.ready) {
      return { ...payload, method: 'capture' }
    }
  } catch {
    /* no waveform without CORS / Web Audio */
  }

  const duration = (await getAudioDurationSec(url)) || 0
  return {
    envelope: [],
    pitchHz: [],
    duration,
    ready: false,
    method: 'none',
  }
}