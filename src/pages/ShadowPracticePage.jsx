import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Header from '../components/Layout/Header'
import ShadowPitchStage from '../components/Practice/ShadowPitchStage'
import ShadowCoachRail from '../components/Practice/ShadowCoachRail'
import ShadowWordLoopBar from '../components/Practice/ShadowWordLoopBar'
import { surahs } from '../data/quranData'
import { qaris, getQarisForSurah } from '../data/qaris'
import { getAyahAudioUrl } from '../services/audioService'
import { analyzeRecitationFromUrl } from '../services/recitationAudioLoader'
import { compareEnvelopes, decodeAudioBlob, displayEnvelope } from '../services/audioCompare'
import { buildRecitationAnalysis, computeF0Contour } from '../services/recitationAnalysis'
import {
  activeWordIndex,
  computeWordStartFractions,
  parseAyahWords,
  sliceAudioAnalysis,
  wordTimeRange,
} from '../services/shadowPracticeUtils'
import ShadowAyahWords from '../components/Practice/ShadowAyahWords'
import { useRecorder } from '../hooks/useRecorder'
import {
  fetchAyahWordTimings,
  timingsMatchWordCount,
  wordStartFractionsFromTimings,
} from '../services/quranComWordTimings'

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
  const [activePlay, setActivePlay] = useState(null)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [refAnalysis, setRefAnalysis] = useState(null)
  const [studentAnalysis, setStudentAnalysis] = useState(null)
  const [refDuration, setRefDuration] = useState(0)
  const [qariWaveByKey, setQariWaveByKey] = useState({})
  const [loopStart, setLoopStart] = useState(0)
  const [loopEnd, setLoopEnd] = useState(0)
  const [loopPick, setLoopPick] = useState(null)
  const [loopEnabled, setLoopEnabled] = useState(false)
  const [loopPlayMode, setLoopPlayMode] = useState(null)
  const [qcomTimings, setQcomTimings] = useState(null)
  const [wordTimingNote, setWordTimingNote] = useState('')
  const hearRef = useRef(null)
  const practiceAudioRef = useRef(null)
  const rafRef = useRef(null)
  const abHandlersRef = useRef({ onRefEnd: null, onYouEnd: null })
  const loopWinRef = useRef(null)

  const currentSurah = surahs[String(surah)]
  const arabic = currentSurah?.ayahs?.[String(ayah)] || ''
  const { words, displayTokens } = useMemo(() => parseAyahWords(arabic), [arabic])
  const qari = qaris.find((q) => q.key === qariKey)
  const recorder = useRecorder()

  const selectableQaris = useMemo(
    () => qaris.filter((q) => allowedKeys.includes(q.key)),
    [allowedKeys],
  )

  useEffect(() => {
    let cancelled = false
    setQcomTimings(null)
    setWordTimingNote('')
    fetchAyahWordTimings(qariKey, surah, ayah).then((t) => {
      if (cancelled) return
      if (!t) return
      if (timingsMatchWordCount(t, words.length)) {
        setQcomTimings(t)
        setWordTimingNote('Word highlight uses Quran.com official timing for this reciter.')
      } else {
        setWordTimingNote(
          'Official timing word count differs from this text — using audio-based estimate.',
        )
      }
    })
    return () => {
      cancelled = true
    }
  }, [qariKey, surah, ayah, words.length])

  const wordStartFractions = useMemo(() => {
    if (qcomTimings && timingsMatchWordCount(qcomTimings, words.length)) {
      return wordStartFractionsFromTimings(qcomTimings)
    }
    return computeWordStartFractions({
      displayTokens,
      envelope,
      channelData: refAnalysis?.channelData,
      sampleRate: refAnalysis?.sampleRate,
      durationSec: refDuration || refAnalysis?.duration || 0,
    })
  }, [qcomTimings, words.length, displayTokens, envelope, refAnalysis, refDuration])

  const phraseScope = useMemo(() => {
    if (!words.length) return null
  const fullAyah = loopStart === 0 && loopEnd >= words.length - 1
    return { fullAyah, label: fullAyah ? 'full ayah' : `phrase · words ${loopStart + 1}–${loopEnd + 1}` }
  }, [loopStart, loopEnd, words.length])

  const rangeHighlight = useMemo(() => {
    if (!words.length) return null
    const frac = wordTimeRange(loopStart, loopEnd, words.length, 1, wordStartFractions)
    if (phraseScope?.fullAyah) return null
    return { startFrac: frac.startFrac, endFrac: frac.endFrac }
  }, [loopStart, loopEnd, words.length, phraseScope?.fullAyah, wordStartFractions])

  const comparison = useMemo(() => {
    if (!refAnalysis || !studentAnalysis) return null
    let refCmp = refAnalysis
    let studentCmp = studentAnalysis
    if (phraseScope && !phraseScope.fullAyah) {
      const frac = wordTimeRange(
        loopStart,
        loopEnd,
        words.length,
        refAnalysis.duration,
        wordStartFractions,
      )
      refCmp = sliceAudioAnalysis(refAnalysis, frac.startFrac, frac.endFrac)
      studentCmp = sliceAudioAnalysis(studentAnalysis, frac.startFrac, frac.endFrac)
    }
    if (!refCmp || !studentCmp) return null
    return compareEnvelopes(refCmp, studentCmp)
  }, [refAnalysis, studentAnalysis, phraseScope, loopStart, loopEnd, words.length, wordStartFractions])

  const recitationAnalysis = useMemo(() => {
    if (!refAnalysis?.channelData || !studentAnalysis?.channelData) return null
    let refBuf = refAnalysis
    let studentBuf = studentAnalysis
    if (phraseScope && !phraseScope.fullAyah) {
      const frac = wordTimeRange(
        loopStart,
        loopEnd,
        words.length,
        refAnalysis.duration,
        wordStartFractions,
      )
      refBuf = sliceAudioAnalysis(refAnalysis, frac.startFrac, frac.endFrac)
      studentBuf = sliceAudioAnalysis(studentAnalysis, frac.startFrac, frac.endFrac)
    }
    if (!refBuf?.channelData || !studentBuf?.channelData) return null
    return buildRecitationAnalysis(refBuf, studentBuf)
  }, [refAnalysis, studentAnalysis, phraseScope, loopStart, loopEnd, words.length, wordStartFractions])

  useEffect(() => {
    if (!words.length) return
    setLoopStart(0)
    setLoopEnd(words.length - 1)
    setLoopPick(null)
  }, [surah, ayah, words.length])

  useEffect(() => {
    let cancelled = false
    setQariWaveByKey((prev) => {
      const next = { ...prev }
      for (const key of allowedKeys) {
        if (!next[key]) next[key] = { loading: true, envelope: [], ready: false }
      }
      return next
    })

    allowedKeys.forEach((key) => {
      const url = getAyahAudioUrl(key, surah, ayah)
      analyzeRecitationFromUrl(url).then((result) => {
        if (cancelled) return
        setQariWaveByKey((prev) => ({
          ...prev,
          [key]: {
            loading: false,
            envelope: result.envelope || [],
            ready: Boolean(result.ready),
            duration: result.duration || 0,
          },
        }))
      })
    })

    return () => {
      cancelled = true
    }
  }, [allowedKeys, surah, ayah])

  const loadReference = useCallback(async () => {
    setLoadingRef(true)
    setLoadError('')
    setGuideNote('')
    setEnvelope([])
    setRefHz([])
    setPracticeHz([])
    setWaveReady(false)
    setPlayProgress(0)
    setRefAnalysis(null)
    setRefDuration(0)

    const url = getAyahAudioUrl(qariKey, surah, ayah)
    try {
      const result = await analyzeRecitationFromUrl(url)
      if (result.duration) setRefDuration(result.duration)
      if (result.ready) {
        setEnvelope(result.envelope)
        setRefHz(result.pitchHz)
        setWaveReady(true)
        if (result.channelData) {
          setRefAnalysis({
            duration: result.duration,
            sampleRate: result.sampleRate,
            channelData: result.channelData,
            envelope: result.envelope,
          })
        }
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

  const progressSource = useCallback(() => {
    if (activePlay === 'you' || activePlay === 'ab-you' || activePlay === 'loop-you') {
      return practiceAudioRef.current
    }
    return hearRef.current
  }, [activePlay])

  useEffect(() => {
    if (hearRef.current) hearRef.current.playbackRate = playbackRate
    if (practiceAudioRef.current) practiceAudioRef.current.playbackRate = playbackRate
  }, [playbackRate, qariKey, surah, ayah])

  useEffect(() => {
    const refEl = hearRef.current
    const youEl = practiceAudioRef.current
    if (!refEl) return undefined

    function enforceLoop(el) {
      const win = loopWinRef.current
      if (!win || !el || !Number.isFinite(el.duration)) return
      if (el.currentTime >= win.end - 0.05) {
        if (win.persistent || loopEnabled) {
          el.currentTime = win.start
        }
      }
    }

    function syncProgress() {
      const el = progressSource()
      if (!el) return
      const d = el.duration
      if (!Number.isFinite(d) || d <= 0) return
      enforceLoop(el)
      setPlayProgress(Math.min(1, Math.max(0, el.currentTime / d)))
    }

    function tick() {
      syncProgress()
      const el = progressSource()
      if (el && !el.paused) {
        rafRef.current = window.requestAnimationFrame(tick)
      }
    }

    const onPlay = () => {
      setIsPlaying(true)
      window.cancelAnimationFrame(rafRef.current || 0)
      rafRef.current = window.requestAnimationFrame(tick)
    }
    const onPause = () => {
      const refPlaying = refEl && !refEl.paused
      const youPlaying = youEl && !youEl.paused
      if (!refPlaying && !youPlaying) {
        setIsPlaying(false)
        window.cancelAnimationFrame(rafRef.current || 0)
      }
      syncProgress()
    }
    const onEnded = () => {
      const refPlaying = refEl && !refEl.paused && !refEl.ended
      const youPlaying = youEl && !youEl.paused && !youEl.ended
      if (refPlaying || youPlaying) return
      setIsPlaying(false)
      window.cancelAnimationFrame(rafRef.current || 0)
      setPlayProgress(1)
      window.setTimeout(() => {
        setPlayProgress(0)
        setActivePlay(null)
        setLoopPlayMode(null)
        loopWinRef.current = null
      }, 400)
    }

    refEl.addEventListener('play', onPlay)
    refEl.addEventListener('pause', onPause)
    refEl.addEventListener('ended', onEnded)
    refEl.addEventListener('timeupdate', syncProgress)
    youEl?.addEventListener('play', onPlay)
    youEl?.addEventListener('pause', onPause)
    youEl?.addEventListener('ended', onEnded)
    youEl?.addEventListener('timeupdate', syncProgress)

    return () => {
      refEl.removeEventListener('play', onPlay)
      refEl.removeEventListener('pause', onPause)
      refEl.removeEventListener('ended', onEnded)
      refEl.removeEventListener('timeupdate', syncProgress)
      youEl?.removeEventListener('play', onPlay)
      youEl?.removeEventListener('pause', onPause)
      youEl?.removeEventListener('ended', onEnded)
      youEl?.removeEventListener('timeupdate', syncProgress)
      window.cancelAnimationFrame(rafRef.current || 0)
    }
  }, [qariKey, surah, ayah, progressSource, loopEnabled])

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
        setStudentAnalysis(analysis)
        if (!waveReady) {
          setEnvelope(displayEnvelope(analysis.channelData, 512))
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

  function detachAbHandlers() {
    const ref = hearRef.current
    const you = practiceAudioRef.current
    const { onRefEnd, onYouEnd } = abHandlersRef.current
    if (ref && onRefEnd) ref.removeEventListener('ended', onRefEnd)
    if (you && onYouEnd) you.removeEventListener('ended', onYouEnd)
    abHandlersRef.current = { onRefEnd: null, onYouEnd: null }
  }

  function stopPlayback() {
    detachAbHandlers()
    hearRef.current?.pause()
    practiceAudioRef.current?.pause()
    setActivePlay(null)
    setIsPlaying(false)
    setPlayProgress(0)
    setLoopPlayMode(null)
    loopWinRef.current = null
  }

  function armLoopWindow(el, { persistent = false } = {}) {
    if (!el || !words.length) return null
    const d = el.duration
    if (!Number.isFinite(d) || d <= 0) return null
    const range = wordTimeRange(loopStart, loopEnd, words.length, d, wordStartFractions)
    const active = persistent || loopEnabled
    loopWinRef.current = active ? { ...range, persistent } : null
    if (active) el.currentTime = range.start
    return range
  }

  function handleSelectLoopWord(index) {
    if (loopPick == null) {
      setLoopPick(index)
      setLoopStart(index)
      setLoopEnd(index)
      return
    }
    const start = Math.min(loopPick, index)
    const end = Math.max(loopPick, index)
    setLoopStart(start)
    setLoopEnd(end)
    setLoopPick(null)
  }

  function ensureRefSrc(key = qariKey) {
    const el = hearRef.current
    if (!el) return
    el.src = getAyahAudioUrl(key, surah, ayah)
  }

  function ensurePracticeSrc() {
    const el = practiceAudioRef.current
    if (!el || !recorder.recordingUrl) return false
    if (el.src !== recorder.recordingUrl) el.src = recorder.recordingUrl
    return true
  }

  function handleStopCoach(key) {
    const playingThis =
      activePlay === `ref-${key}` ||
      activePlay === `ab-ref-${key}` ||
      (activePlay === 'loop-coach' && key === qariKey) ||
      (activePlay === 'both' && key === qariKey)
    if (playingThis) stopPlayback()
  }

  function handleClearRecording() {
    stopPlayback()
    recorder.clear()
    setPracticeHz([])
    setStudentAnalysis(null)
    if (practiceAudioRef.current) practiceAudioRef.current.removeAttribute('src')
  }

  async function handleHearQari(key) {
    if (!hearRef.current) return
    stopPlayback()
    ensureRefSrc(key)
    const el = hearRef.current
    el.playbackRate = playbackRate
    armLoopWindow(el, { persistent: Boolean(loopPlayMode === 'coach') })
    if (!loopWinRef.current) el.currentTime = 0
    setActivePlay(`ref-${key}`)
    try {
      await el.play()
    } catch {
      setLoadError('Could not play audio. Check your connection.')
    }
    if (key === qariKey && !waveReady && !loadingRef) {
      loadReference()
    }
  }

  async function handlePlayYours() {
    if (!ensurePracticeSrc()) return
    stopPlayback()
    const el = practiceAudioRef.current
    armLoopWindow(el, { persistent: Boolean(loopPlayMode === 'you') })
    if (!loopWinRef.current) el.currentTime = 0
    setActivePlay('you')
    try {
      await el.play()
    } catch {
      setLoadError('Could not play your recording.')
    }
  }

  async function handlePlayBoth() {
    if (!ensurePracticeSrc()) return
    stopPlayback()
    ensureRefSrc()
    const ref = hearRef.current
    const you = practiceAudioRef.current
    const win = armLoopWindow(ref, { persistent: false })
    if (win) you.currentTime = win.start
    else {
      ref.currentTime = 0
      you.currentTime = 0
    }
    setActivePlay('both')
    try {
      await Promise.all([ref.play(), you.play()])
    } catch {
      setLoadError('Could not play both tracks.')
    }
  }

  async function handleCompareAb() {
    if (!ensurePracticeSrc()) return
    stopPlayback()
    ensureRefSrc()
    const ref = hearRef.current
    const you = practiceAudioRef.current
    loopWinRef.current = null
    ref.currentTime = 0
    you.currentTime = 0
    setActivePlay(`ab-ref-${qariKey}`)

    const onRefEnd = () => {
      ref.removeEventListener('ended', onRefEnd)
      you.currentTime = 0
      setActivePlay('ab-you')
      setPlayProgress(0)
      you.play().catch(() => {})
    }
    const onYouEnd = () => {
      you.removeEventListener('ended', onYouEnd)
      setActivePlay(null)
      setPlayProgress(0)
    }
    abHandlersRef.current = { onRefEnd, onYouEnd }
    ref.addEventListener('ended', onRefEnd)
    you.addEventListener('ended', onYouEnd)
    try {
      await ref.play()
    } catch {
      setLoadError('Could not start A → B compare.')
    }
  }

  async function handleLoopCoach() {
    if (!hearRef.current) return
    stopPlayback()
    ensureRefSrc()
    const el = hearRef.current
    setLoopPlayMode('coach')
    if (el.readyState < 1) {
      await new Promise((resolve) => {
        el.addEventListener('loadedmetadata', resolve, { once: true })
      })
    }
    armLoopWindow(el, { persistent: true })
    setActivePlay('loop-coach')
    try {
      await el.play()
    } catch {
      setLoadError('Could not loop coach audio.')
    }
  }

  async function handleLoopYou() {
    if (!ensurePracticeSrc()) return
    stopPlayback()
    const el = practiceAudioRef.current
    setLoopPlayMode('you')
    armLoopWindow(el, { persistent: true })
    setActivePlay('loop-you')
    try {
      await el.play()
    } catch {
      setLoadError('Could not loop your recording.')
    }
  }

  const miniPlayProgress = useCallback(
    (key) => {
      if (
        activePlay === `ref-${key}` ||
        activePlay === `ab-ref-${key}` ||
        (activePlay === 'loop-coach' && key === qariKey) ||
        (activePlay === 'both' && key === qariKey)
      ) {
        return playProgress
      }
      return 0
    },
    [activePlay, playProgress, qariKey],
  )

  const loopDurationHint = refDuration || refAnalysis?.duration || 0

  const speakingWordIndex = useMemo(() => {
    if (!isPlaying || !activePlay || !words.length) return -1
    const highlightsAudio =
      activePlay.startsWith('ref-') ||
      activePlay.startsWith('ab-ref') ||
      activePlay === 'both' ||
      activePlay === 'loop-coach' ||
      activePlay === 'you' ||
      activePlay === 'ab-you' ||
      activePlay === 'loop-you'
    if (!highlightsAudio) return -1
    return activeWordIndex(playProgress, words.length, wordStartFractions)
  }, [isPlaying, activePlay, playProgress, words.length, wordStartFractions])

  const verseLabel = currentSurah
    ? `${currentSurah.name_en} · verse ${ayah}`
    : `Surah ${surah} · verse ${ayah}`

  return (
    <div className="shadow-practice-page practice-page">
      <audio ref={hearRef} preload="auto" className="visually-hidden" aria-hidden />
      <audio ref={practiceAudioRef} preload="auto" className="visually-hidden" aria-hidden />

      <Header title="Shadow practice" subtitle="Coaching · self-coaching · compare" />

      <header className="shadow-practice-header">
        <button type="button" className="btn ghost shadow-practice-back" onClick={() => navigate('/practice')}>
          ← Back
        </button>
        <div className="shadow-practice-header-main">
          <p className="shadow-practice-verse-meta shadow-practice-verse-meta--lead">
            {verseLabel}
            {qari?.name ? ` · Guide: ${qari.name}` : ''}
            {qari?.style ? ` · ${qari.style}` : ''}
          </p>
        </div>
        <span className="shadow-practice-beta">BETA</span>
      </header>

      <div className="shadow-coach-layout">
        <div className="shadow-coach-main">
          <section className="reader shadow-practice-reader">
            <div className="reader-head">
              <div className="reader-head-title">{currentSurah?.name_ar}</div>
              <div className="ayah-meta">{verseLabel}</div>
            </div>
            <ShadowAyahWords
              displayTokens={displayTokens}
              activeIndex={speakingWordIndex}
              className="shadow-practice-arabic-block"
            />
          </section>

          <ShadowWordLoopBar
            words={words}
            loopStart={loopStart}
            loopEnd={loopEnd}
            loopEnabled={loopEnabled}
            onLoopEnabledChange={setLoopEnabled}
            onSelectWord={handleSelectLoopWord}
            onLoopCoach={handleLoopCoach}
            onLoopYou={handleLoopYou}
            loopPlaying={loopPlayMode}
            durationSec={loopDurationHint}
            canLoopYou={Boolean(recorder.recordingUrl)}
            activeWordIndex={speakingWordIndex}
          />

          <ShadowPitchStage
            envelope={envelope}
            referenceHz={refHz}
            practiceHz={practiceHz}
            playProgress={playProgress}
            isPlaying={isPlaying}
            words={words}
            loading={loadingRef}
            waveReady={waveReady}
            rangeHighlight={rangeHighlight}
            activeWordIndex={speakingWordIndex}
            wordStartFractions={wordStartFractions}
          />

          {wordTimingNote && (
            <p className="shadow-practice-note shadow-practice-note--timing" role="status">
              {wordTimingNote}
            </p>
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

          {practiceHz.length > 0 && !recorder.isRecording && (
            <p className="shadow-practice-compare-note" role="status">
              Gold = your pitch · Green = focused coach · Use the rail to hear other qaris without changing the guide.
            </p>
          )}
        </div>

        <ShadowCoachRail
          coaches={selectableQaris}
          focusQariKey={qariKey}
          onFocusQari={handleQariChange}
          onHearQari={handleHearQari}
          onStopCoach={handleStopCoach}
          onClearRecording={handleClearRecording}
          activePlay={activePlay}
          isPlaying={isPlaying}
          isRecording={recorder.isRecording}
          hasRecording={Boolean(recorder.recordingUrl)}
          playbackRate={playbackRate}
          onPlaybackRateChange={setPlaybackRate}
          onRecordToggle={recorder.toggle}
          onPlayYours={handlePlayYours}
          onPlayBoth={handlePlayBoth}
          onCompareAb={handleCompareAb}
          onStop={stopPlayback}
          recordingError={recorder.error}
          qariPreviews={qariWaveByKey}
          miniPlayProgress={miniPlayProgress}
          comparison={comparison}
          recitationAnalysis={recitationAnalysis}
          coachName={qari?.name || 'Coach'}
          comparisonScope={phraseScope?.label}
        />
      </div>
    </div>
  )
}