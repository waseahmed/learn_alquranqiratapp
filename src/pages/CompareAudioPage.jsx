import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import Header from '../components/Layout/Header'
import WaveformCompare from '../components/Practice/WaveformCompare'
import { getAyahAudioUrl } from '../services/audioService'
import {
  compareEnvelopes,
  decodeAudioBlob,
  formatDuration,
} from '../services/audioCompare'
import { getQarisForSurah } from '../data/qaris'
import { useProfile } from '../contexts/ProfileContext'

const ACCEPT = 'audio/*,.mp3,.wav,.m4a,.ogg,.webm'

function SlotCard({
  title,
  hint,
  fileName,
  url,
  onFile,
  onClear,
  audioRef,
  active,
  trackKey,
}) {
  return (
    <div className={`compare-slot ${active ? 'is-active' : ''}`}>
      <div className="compare-slot-head">
        <b>{title}</b>
        {active ? <span className="compare-live-tag">Playing</span> : null}
        {fileName ? <span className="compare-file-name">{fileName}</span> : null}
      </div>
      <p className="compare-slot-hint">{hint}</p>
      <div className="compare-slot-actions">
        <label className="btn primary compare-upload">
          {fileName ? 'Replace file' : 'Upload audio'}
          <input
            type="file"
            accept={ACCEPT}
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onFile(file)
              e.target.value = ''
            }}
          />
        </label>
        {url ? (
          <button type="button" className="btn" onClick={onClear}>
            Clear
          </button>
        ) : null}
      </div>
      {url ? (
        <audio
          ref={audioRef}
          controls
          src={url}
          preload="metadata"
          className="compare-slot-audio"
          data-track={trackKey}
        />
      ) : null}
    </div>
  )
}

export default function CompareAudioPage() {
  const { onMenuToggle, surah, ayah } = useOutletContext()
  const { qariOrder } = useProfile()

  const [refFile, setRefFile] = useState(null)
  const [studentFile, setStudentFile] = useState(null)
  const [refUrl, setRefUrl] = useState(null)
  const [studentUrl, setStudentUrl] = useState(null)
  const [refAnalysis, setRefAnalysis] = useState(null)
  const [studentAnalysis, setStudentAnalysis] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(0)
  const [activeTrack, setActiveTrack] = useState(null)

  const refAudioRef = useRef(null)
  const studentAudioRef = useRef(null)
  const objectUrlsRef = useRef([])
  const abPhaseRef = useRef(null)
  const rafRef = useRef(0)

  const availableQaris = useMemo(() => getQarisForSurah(surah || 1), [surah])
  const primaryQari =
    availableQaris.find((q) => qariOrder?.includes(q.key)) || availableQaris[0]

  const comparison = useMemo(() => {
    if (!refAnalysis || !studentAnalysis) return null
    return compareEnvelopes(refAnalysis, studentAnalysis)
  }, [refAnalysis, studentAnalysis])

  useEffect(
    () => () => {
      objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u))
      objectUrlsRef.current = []
      cancelAnimationFrame(rafRef.current)
    },
    [],
  )

  useEffect(() => {
    let id = 0
    const tick = () => {
      const ref = refAudioRef.current
      const you = studentAudioRef.current
      let el = null
      let track = null

      if (ref && !ref.paused && !ref.ended) {
        el = ref
        track = abPhaseRef.current === 'ab' ? 'ab-ref' : 'ref'
      } else if (you && !you.paused && !you.ended) {
        el = you
        track = abPhaseRef.current === 'ab' ? 'ab-you' : 'you'
      }

      if (el && el.duration) {
        setActiveTrack(track)
        setProgress(el.currentTime / el.duration)
      } else {
        setActiveTrack((prev) => (prev ? null : prev))
        setProgress((p) => (p ? 0 : p))
        if (!el) abPhaseRef.current = null
      }

      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [refUrl, studentUrl])

  function trackUrl(url) {
    objectUrlsRef.current.push(url)
    return url
  }

  async function loadSlot(file, which) {
    setError(null)
    setBusy(true)
    try {
      const url = trackUrl(URL.createObjectURL(file))
      const analysis = await decodeAudioBlob(file)
      if (which === 'ref') {
        if (refUrl) URL.revokeObjectURL(refUrl)
        setRefFile(file)
        setRefUrl(url)
        setRefAnalysis(analysis)
      } else {
        if (studentUrl) URL.revokeObjectURL(studentUrl)
        setStudentFile(file)
        setStudentUrl(url)
        setStudentAnalysis(analysis)
      }
    } catch {
      setError('Could not read that audio file. Try MP3, WAV, M4A, or WebM.')
    } finally {
      setBusy(false)
    }
  }

  function clearSlot(which) {
    if (which === 'ref') {
      if (refUrl) URL.revokeObjectURL(refUrl)
      setRefFile(null)
      setRefUrl(null)
      setRefAnalysis(null)
    } else {
      if (studentUrl) URL.revokeObjectURL(studentUrl)
      setStudentFile(null)
      setStudentUrl(null)
      setStudentAnalysis(null)
    }
    setProgress(0)
    setActiveTrack(null)
    abPhaseRef.current = null
  }

  async function loadCurrentQari() {
    if (!primaryQari) {
      setError('No qari available for this surah.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      const url = getAyahAudioUrl(primaryQari.key, surah, ayah)
      const res = await fetch(url)
      if (!res.ok) throw new Error('fetch failed')
      const blob = await res.blob()
      const file = new File([blob], `${primaryQari.key}-${surah}-${ayah}.mp3`, {
        type: blob.type || 'audio/mpeg',
      })
      await loadSlot(file, 'ref')
    } catch {
      setError(
        'Could not load the current qari ayah. Check your audio connection, then try uploading a file instead.',
      )
      setBusy(false)
    }
  }

  function pauseBoth() {
    abPhaseRef.current = null
    setActiveTrack(null)
    setProgress(0)
    refAudioRef.current?.pause()
    studentAudioRef.current?.pause()
  }

  function playOnly(which) {
    pauseBoth()
    abPhaseRef.current = which
    const el = which === 'ref' ? refAudioRef.current : studentAudioRef.current
    if (!el) return
    el.currentTime = 0
    setActiveTrack(which)
    el.play().catch(() => {})
  }

  function playAbLoop() {
    if (!refAudioRef.current || !studentAudioRef.current) return
    pauseBoth()
    abPhaseRef.current = 'ab'
    const ref = refAudioRef.current
    const you = studentAudioRef.current
    ref.currentTime = 0
    you.currentTime = 0
    setActiveTrack('ab-ref')

    const onRefEnd = () => {
      ref.removeEventListener('ended', onRefEnd)
      you.currentTime = 0
      setActiveTrack('ab-you')
      setProgress(0)
      you.play().catch(() => {})
    }
    const onYouEnd = () => {
      you.removeEventListener('ended', onYouEnd)
      abPhaseRef.current = null
      setActiveTrack(null)
      setProgress(0)
    }
    ref.addEventListener('ended', onRefEnd)
    you.addEventListener('ended', onYouEnd)
    ref.play().catch(() => {})
  }

  return (
    <section className="guide compare-page">
      <Header
        title="Compare Audio"
        subtitle="Hear the difference and improve"
        onMenuToggle={onMenuToggle}
      />

      <p className="guide-intro">
        Upload a <b>reference</b> (qari) and <b>your recording</b>. We show
        waveform shape, timing, and where the two diverge so you can practice
        those spots. This helps rhythm and energy — always check tajweed with a
        teacher too.
      </p>

      <div className="compare-toolbar">
        <button
          type="button"
          className="btn"
          onClick={loadCurrentQari}
          disabled={busy || !primaryQari}
          title="Use the current Practice ayah for your primary qari"
        >
          Use current ayah ({surah}:{ayah}
          {primaryQari ? ` · ${primaryQari.name}` : ''})
        </button>
        <Link to="/practice" className="btn">
          Back to Practice
        </Link>
      </div>

      {error ? (
        <p className="compare-error" role="alert">
          {error}
        </p>
      ) : null}
      {busy ? <p className="compare-status">Analysing audio…</p> : null}

      <div className="compare-slots">
        <SlotCard
          title="1. Reference (Qari)"
          hint="Upload the model recitation, or load the current Practice ayah."
          fileName={refFile?.name}
          url={refUrl}
          onFile={(f) => loadSlot(f, 'ref')}
          onClear={() => clearSlot('ref')}
          audioRef={refAudioRef}
          active={activeTrack === 'ref' || activeTrack === 'ab-ref'}
          trackKey="ref"
        />
        <SlotCard
          title="2. Your recording"
          hint="Upload what you recorded on Practice (or any student take)."
          fileName={studentFile?.name}
          url={studentUrl}
          onFile={(f) => loadSlot(f, 'student')}
          onClear={() => clearSlot('student')}
          audioRef={studentAudioRef}
          active={activeTrack === 'you' || activeTrack === 'ab-you'}
          trackKey="you"
        />
      </div>

      {refUrl && studentUrl ? (
        <div className="compare-playbar">
          <button
            type="button"
            className={`btn primary ${activeTrack === 'ref' ? 'speed-on' : ''}`}
            onClick={() => playOnly('ref')}
          >
            ▶ Play reference
          </button>
          <button
            type="button"
            className={`btn ${activeTrack === 'you' ? 'speed-on' : ''}`}
            onClick={() => playOnly('you')}
          >
            ▶ Play yours
          </button>
          <button
            type="button"
            className={`btn ${activeTrack?.startsWith('ab') ? 'speed-on' : ''}`}
            onClick={playAbLoop}
          >
            A → B compare
          </button>
          <button type="button" className="btn stop" onClick={pauseBoth}>
            ■ Stop
          </button>
        </div>
      ) : null}

      {comparison ? (
        <>
          <div className="guide-card compare-score-card">
            <div className="rule">Match overview</div>
            <div className="compare-score-row">
              <div className="compare-score-big" aria-label="Similarity score">
                {comparison.score}
                <span>/100</span>
              </div>
              <div className="compare-metrics">
                <div>
                  <b>Shape match</b> {comparison.similarityPct}%
                </div>
                <div>
                  <b>Reference</b> {comparison.metrics.referenceDuration}
                </div>
                <div>
                  <b>Yours</b> {comparison.metrics.studentDuration}
                </div>
                <div>
                  <b>Length</b>{' '}
                  {comparison.durationRatio > 1.05
                    ? `${formatDuration(Math.abs(comparison.metrics.durationDeltaSec))} longer`
                    : comparison.durationRatio < 0.95
                      ? `${formatDuration(Math.abs(comparison.metrics.durationDeltaSec))} shorter`
                      : 'nearly same length'}
                </div>
              </div>
            </div>
          </div>

          <div className="guide-card">
            <div className="rule">Waveform difference</div>
            <p className="guide-intro" style={{ marginBottom: 10 }}>
              Gold highlight = places where your loudness / timing shape left the
              reference most. Use A → B and focus on those zones.
            </p>
            <WaveformCompare
              referenceEnvelope={refAnalysis.envelope}
              studentEnvelope={studentAnalysis.envelope}
              regions={comparison.regions}
              progress={progress}
              activeTrack={activeTrack}
            />
          </div>

          <div className="guide-card">
            <div className="rule">How to improve</div>
            <ul className="compare-tips">
              {comparison.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <div className="guide-card">
          <div className="rule">Getting started</div>
          <p>
            Add both audio files above. Tip: on Practice, record yourself, download
            or keep the file, then come here with the qari MP3 and your take.
          </p>
        </div>
      )}
    </section>
  )
}
