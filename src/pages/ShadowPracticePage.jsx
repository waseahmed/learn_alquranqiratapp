import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ShadowPitchStage from '../components/Practice/ShadowPitchStage'
import { surahs } from '../data/quranData'
import { qaris, getQarisForSurah } from '../data/qaris'
import { getAyahAudioUrl } from '../services/audioService'
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
    setRefHz([])
    setPracticeHz([])

    const url = getAyahAudioUrl(qariKey, surah, ayah)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error('Could not load reciter audio.')
      const blob = await res.blob()
      const analysis = await decodeAudioBlob(blob)
      const f0 = computeF0Contour(analysis.channelData, analysis.sampleRate)
      setRefHz(f0.hz)
    } catch (err) {
      setLoadError(err.message || 'Could not build shadow guide from this reciter.')
    } finally {
      setLoadingRef(false)
    }
  }, [qariKey, surah, ayah])

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
    <div className="shadow-practice-page">
      <audio ref={hearRef} preload="metadata" className="visually-hidden" aria-hidden />

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

      <div className="shadow-practice-arabic-wrap" dir="rtl" lang="ar">
        <p className="shadow-practice-arabic">{arabic}</p>
        <div className="shadow-practice-word-dots" aria-hidden>
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
            className="btn shadow-practice-record"
            onClick={recorder.toggle}
            disabled={loadingRef}
            aria-pressed={recorder.isRecording}
          >
            <span className="shadow-practice-record-icon" aria-hidden />
            {recorder.isRecording ? 'Stop' : 'Record'}
          </button>
          <button
            type="button"
            className="btn shadow-practice-hear"
            onClick={handleHearHim}
            disabled={loadingRef}
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
            Your pitch trace is shown in light blue over the reciter&apos;s gold path.
          </p>
        )}
      </footer>
    </div>
  )
}