import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Header from '../components/Layout/Header'
import ShadowPitchStage from '../components/Practice/ShadowPitchStage'
import { surahs } from '../data/quranData'
import { qaris, getQarisForSurah } from '../data/qaris'
import { getAyahAudioUrl } from '../services/audioService'
import { analyzeRecitationFromUrl } from '../services/recitationAudioLoader'
import { decodeAudioBlob, rmsEnvelope } from '../services/audioCompare'
import { computeF0Contour } from '../services/recitationAnalysis'
import { useRecorder } from '../hooks/useRecorder'

function wordsFromAyah(arabic) {
  if (!arabic) return []
  return arabic.trim().split(/\s+/).filter(Boolean)
}

export default function ShadowPracticePage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const surah = Math.min(114, Math.max(1, Number(searchParams.get('surah')) || 1))
  const ayah = Math.max(1, Number(searchParams.get('ayah')) || 1)
  const initialQari = searchParams.get('qari') || 'mishary'
  const qariKeysParam = searchParams.get('qaris') || ''
  const allowedKeys = useMemo(() => {
    const fromList = qariKeysParam
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
    if (fromList.length) return fromList
    return getQarisForSurah(surah).map((q) => q.key)
  }, [qariKeysParam, surah])

  const [qariKey, setQariKey] = useState(
    allowedKeys.includes(initialQari) ? initialQari : allowedKeys[0] || initialQari,
  )
  const [envelope, setEnvelope] = useState([])
  const [refHz, setRefHz] = useState([])
  const [practiceHz, setPracticeHz] = useState([])
  const [waveReady, setWaveReady] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [guideNote, setGuideNote] = useState('')
  const [loadingRef, setLoadingRef] = useState(true)
  const [playProgress, setPlayProgress] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const hearRef = useRef(null)
  const rafRef = useRef(null)

  const currentSurah = surahs[String(surah)]
  const arabic = currentSurah?.ayahs?.[String(ayah)] || ''
  const words = useMemo(() => wordsFromAyah(arabic), [arabic])
  const qari = qaris.find((q) => q.key === qariKey)
  const recorder = useRecorder()

  const selectableQaris = useMemo(
    () => qaris.filter((q) => allowedKeys.includes(q.key)),
    [allowedKeys],
  )

  const loadReference = useCallback(async () => {
    setLoadingRef(true)
    setLoadError('')
    setGuideNote('')
    setEnvelope([])
    setRefHz([])
    setPracticeHz([])
    setWaveReady(false)
    setPlayProgress(0)

    const url = getAyahAudioUrl(qariKey, surah, ayah)
    try {
      const result = await analyzeRecitationFromUrl(url)
      if (result.ready) {
        setEnvelope(result.envelope)
        setRefHz(result.pitchHz)
        setWaveReady(true)
        if (result.method === 'capture') {
          setGuideNote('Waveform built from this reciter’s audio (silent scan). Press Hear him to follow along.')
        }
      } else {
        setGuideNote(
          'Playback works, but the visual guide needs CORS on the audio server. You can still hear and record.',
        )
      }
    } catch (err) {
      setLoadError(err.message || 'Could not analyze this recitation.')
    } finally {
      setLoadingRef(false)
    }
  }, [qariKey, surah, ayah])

  useEffect(() => {
    loadReference()
  }, [loadReference])

  useEffect(() => {
    const el = hearRef.current
    if (!el) return undefined

    function syncProgress() {
      const d = el.duration
      if (!Number.isFinite(d) || d <= 0) return
      setPlayProgress(Math.min(1, Math.max(0, el.currentTime / d)))
    }

    function tick() {
      syncProgress()
      if (!el.paused) {
        rafRef.current = window.requestAnimationFrame(tick)
      }
    }

    const onPlay = () => {
      setIsPlaying(true)
      window.cancelAnimationFrame(rafRef.current || 0)
      rafRef.current = window.requestAnimationFrame(tick)
    }
    const onPause = () => {
      setIsPlaying(false)
      window.cancelAnimationFrame(rafRef.current || 0)
      syncProgress()
    }
    const onEnded = () => {
      setIsPlaying(false)
      window.cancelAnimationFrame(rafRef.current || 0)
      setPlayProgress(1)
      window.setTimeout(() => setPlayProgress(0), 400)
    }

    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('ended', onEnded)
    el.addEventListener('timeupdate', syncProgress)

    return () => {
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('ended', onEnded)
      el.removeEventListener('timeupdate', syncProgress)
      window.cancelAnimationFrame(rafRef.current || 0)
    }
  }, [qariKey, surah, ayah])

  useEffect(() => {
    if (!recorder.recordingUrl) return undefined
    let cancelled = false

    async function analyzePractice() {
      try {
        const res = await fetch(recorder.recordingUrl)
        const blob = await res.blob()
        const analysis = await decodeAudioBlob(blob)
        if (cancelled) return
        const f0 = computeF0Contour(analysis.channelData, analysis.sampleRate)
        setPracticeHz(f0.hz)
        if (!waveReady) {
          setEnvelope(rmsEnvelope(analysis.channelData, 320))
        }
      } catch {
        if (!cancelled) setLoadError('Could not analyze your recording.')
      }
    }
    analyzePractice()
    return () => {
      cancelled = true
    }
  }, [recorder.recordingUrl, waveReady])

  function handleQariChange(nextKey) {
    setQariKey(nextKey)
    const next = new URLSearchParams(searchParams)
    next.set('qari', nextKey)
    setSearchParams(next, { replace: true })
  }

  async function handleHearHim() {
    if (!hearRef.current) return
    const url = getAyahAudioUrl(qariKey, surah, ayah)
    const el = hearRef.current
    if (el.src !== url && !el.src.endsWith(url.split('/').slice(-3).join('/'))) {
      el.src = url
    }
    el.playbackRate = 1
    el.currentTime = 0
    setPlayProgress(0)
    try {
      await el.play()
    } catch {
      setLoadError('Could not play audio. Check your connection.')
    }
    if (!waveReady && !loadingRef) {
      loadReference()
    }
  }

  const verseLabel = currentSurah
    ? `${currentSurah.name_en} · verse ${ayah}`
    : `Surah ${surah} · verse ${ayah}`

  return (
    <div className="shadow-practice-page practice-page">
      <audio ref={hearRef} preload="auto" className="visually-hidden" aria-hidden />

      <Header title="Shadow practice" subtitle="Listen · imitate · record" />

      <header className="shadow-practice-header">
        <button type="button" className="btn ghost shadow-practice-back" onClick={() => navigate('/practice')}>
          ← Back
        </button>
        <div className="shadow-practice-header-main">
          <label className="shadow-practice-qari-label" htmlFor="shadow-qari">
            Qari
          </label>
          <select
            id="shadow-qari"
            className="shadow-practice-qari-select"
            value={qariKey}
            onChange={(e) => handleQariChange(e.target.value)}
          >
            {selectableQaris.map((q) => (
              <option key={q.key} value={q.key}>
                {q.name}
              </option>
            ))}
          </select>
          <p className="shadow-practice-verse-meta">
            {verseLabel}
            {qari?.style ? ` · ${qari.style}` : ''}
          </p>
        </div>
        <span className="shadow-practice-beta">BETA</span>
      </header>

      <section className="reader shadow-practice-reader">
        <div className="reader-head">
          <div className="reader-head-title">{currentSurah?.name_ar}</div>
          <div className="ayah-meta">{verseLabel}</div>
        </div>
        <div className="arabic shadow-practice-arabic-block" dir="rtl" lang="ar">
          {arabic}
        </div>
      </section>

      <div className="shadow-practice-arabic-wrap" dir="rtl" lang="ar">
        <div className="shadow-practice-word-dots">
          {words.map((w) => (
            <span key={w} className="shadow-practice-word-dot">
              <span className="shadow-practice-dot" />
              <span className="shadow-practice-word-chip">{w}</span>
            </span>
          ))}
        </div>
      </div>

      <ShadowPitchStage
        envelope={envelope}
        referenceHz={refHz}
        practiceHz={practiceHz}
        playProgress={playProgress}
        isPlaying={isPlaying}
        words={words}
        loading={loadingRef}
        waveReady={waveReady}
      />

      {guideNote && (
        <p className="shadow-practice-note" role="status">
          {guideNote}
        </p>
      )}

      {loadError && (
        <p className="shadow-practice-error" role="alert">
          {loadError}
        </p>
      )}

      <footer className="shadow-practice-footer">
        <p className="shadow-practice-hint">
          <span className="shadow-practice-hint-dot" aria-hidden />
          Hear the reciter and watch the playhead move. Then record and match the green melody line.
        </p>
        <div className="shadow-practice-actions">
          <button
            type="button"
            className="btn primary shadow-practice-record"
            onClick={recorder.toggle}
            aria-pressed={recorder.isRecording}
          >
            <span className="shadow-practice-record-icon" aria-hidden />
            {recorder.isRecording ? 'Stop' : 'Record'}
          </button>
          <button type="button" className="btn shadow-practice-hear" onClick={handleHearHim}>
            ▶ Hear him
          </button>
        </div>
        {recorder.error && (
          <p className="shadow-practice-error" role="alert">
            {recorder.error}
          </p>
        )}
        {practiceHz.length > 0 && !recorder.isRecording && (
          <p className="shadow-practice-compare-note" role="status">
            Your recording is shown in gold over the reciter&apos;s green melody line.
          </p>
        )}
      </footer>
    </div>
  )
}