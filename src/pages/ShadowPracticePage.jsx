import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Header from '../components/Layout/Header'
import ShadowPitchStage from '../components/Practice/ShadowPitchStage'
import { surahs } from '../data/quranData'
import { qaris, getQarisForSurah } from '../data/qaris'
import { getAyahAudioUrl } from '../services/audioService'
import { analyzeRecitationFromUrl, syntheticPitchGuide } from '../services/recitationAudioLoader'
import { decodeAudioBlob } from '../services/audioCompare'
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
  const [refHz, setRefHz] = useState([])
  const [practiceHz, setPracticeHz] = useState([])
  const [loadError, setLoadError] = useState('')
  const [guideNote, setGuideNote] = useState('')
  const [loadingRef, setLoadingRef] = useState(true)
  const hearRef = useRef(null)

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
    setRefHz([])
    setPracticeHz([])

    const url = getAyahAudioUrl(qariKey, surah, ayah)
    try {
      const result = await analyzeRecitationFromUrl(url, { wordCount: words.length || 3 })
      setRefHz(result.hz)
      if (result.approximate) {
        setGuideNote(
          'Showing a rhythm guide for this ayah (exact reciter waveform is blocked by cross-origin rules). Hearing and recording still work.',
        )
      }
    } catch (err) {
      setLoadError(err.message || 'Could not build shadow guide from this reciter.')
      setRefHz(syntheticPitchGuide(3, words.length || 3))
      setGuideNote('Using a simple rhythm guide. Tap Hear him to listen to the reciter.')
    } finally {
      setLoadingRef(false)
    }
  }, [qariKey, surah, ayah, words.length])

  useEffect(() => {
    loadReference()
  }, [loadReference])

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
      } catch {
        if (!cancelled) setLoadError('Could not analyze your recording.')
      }
    }
    analyzePractice()
    return () => {
      cancelled = true
    }
  }, [recorder.recordingUrl])

  function handleQariChange(nextKey) {
    setQariKey(nextKey)
    const next = new URLSearchParams(searchParams)
    next.set('qari', nextKey)
    setSearchParams(next, { replace: true })
  }

  function handleHearHim() {
    if (!hearRef.current) return
    const url = getAyahAudioUrl(qariKey, surah, ayah)
    if (hearRef.current.src !== url) hearRef.current.src = url
    hearRef.current.playbackRate = 1
    hearRef.current.currentTime = 0
    hearRef.current.play().catch(() => {})
  }

  const verseLabel = currentSurah
    ? `${currentSurah.name_en} · verse ${ayah}`
    : `Surah ${surah} · verse ${ayah}`

  return (
    <div className="shadow-practice-page practice-page">
      <audio ref={hearRef} preload="metadata" className="visually-hidden" aria-hidden />

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
        referenceHz={refHz}
        practiceHz={practiceHz}
        words={words}
        loading={loadingRef}
      />

      {words.length > 0 && (
        <div className="shadow-practice-phonetic" aria-hidden>
          {words.map((w, i) => (
            <span key={`${w}-${i}`} className="shadow-practice-syl">
              {w}
            </span>
          ))}
        </div>
      )}

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
          Hear the reciter, then press Record and imitate the melody and rhythm of this ayah.
        </p>
        <div className="shadow-practice-actions">
          <button
            type="button"
            className="btn primary shadow-practice-record"
            onClick={recorder.toggle}
            disabled={false}
            aria-pressed={recorder.isRecording}
          >
            <span className="shadow-practice-record-icon" aria-hidden />
            {recorder.isRecording ? 'Stop' : 'Record'}
          </button>
          <button
            type="button"
            className="btn shadow-practice-hear"
            onClick={handleHearHim}
          >
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
            Your pitch trace is shown in gold over the reciter&apos;s green path.
          </p>
        )}
      </footer>
    </div>
  )
}