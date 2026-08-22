import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Header from '../components/Layout/Header'
import QariSelector from '../components/Qari/QariSelector'
import QariCard from '../components/Qari/QariCard'
import ShadowMode from '../components/Practice/ShadowMode'
import RecordingPanel from '../components/Practice/RecordingPanel'
import PracticeControls from '../components/Practice/PracticeControls'
import { surahs } from '../data/quranData'
import {
  DEFAULT_SELECTED_QARIS,
  getQarisForSurah,
} from '../data/qaris'
import { useAudioPlayer } from '../hooks/useAudioPlayer'
import { useRecorder } from '../hooks/useRecorder'
import {
  saveLastPosition,
  saveSelectedQaris,
  loadSelectedQaris,
} from '../services/preferences'

function computeRange(ayah, versesCount) {
  const rangeStart = Math.floor((ayah - 1) / 5) * 5 + 1
  const rangeEnd = Math.min(rangeStart + 4, versesCount)
  return { rangeStart, rangeEnd }
}

export default function PracticePageView({
  surah,
  ayah,
  rangeNote,
  onNavigate,
  onMenuToggle,
}) {
  const currentSurah = surahs[String(surah)]
  const versesCount = currentSurah.verses_count
  const { rangeStart, rangeEnd } = computeRange(ayah, versesCount)
  const arabic = currentSurah.ayahs[String(ayah)]

  const availableQaris = useMemo(() => getQarisForSurah(surah), [surah])
  const availableKeys = useMemo(
    () => new Set(availableQaris.map((q) => q.key)),
    [availableQaris],
  )

  const [selectedQaris, setSelectedQaris] = useState(() => {
    const saved = loadSelectedQaris(DEFAULT_SELECTED_QARIS)
    return new Set(saved)
  })

  const {
    currentlyPlayingQari,
    isPlayingSequence,
    isUnavailable,
    markUnavailable,
    playOnce,
    playSequence,
    setPlayingQari,
    stop: stopAudio,
  } = useAudioPlayer()

  const recorder = useRecorder()
  const [shadowActive, setShadowActive] = useState(false)
  const [shadowLabel, setShadowLabel] = useState('Ready')
  const shadowStopRef = useRef(false)

  useEffect(() => {
    saveLastPosition(surah, ayah)
  }, [surah, ayah])

  useEffect(() => {
    setSelectedQaris((prev) => {
      const next = new Set([...prev].filter((k) => availableKeys.has(k)))
      if (next.size === 0 && availableQaris[0]) {
        next.add(availableQaris[0].key)
      }
      return next
    })
  }, [availableKeys, availableQaris])

  useEffect(() => {
    saveSelectedQaris(selectedQaris)
  }, [selectedQaris])

  const selectedList = useMemo(
    () => availableQaris.filter((q) => selectedQaris.has(q.key)),
    [availableQaris, selectedQaris],
  )

  const primaryQariKey = selectedList[0]?.key || availableQaris[0]?.key

  const stopEverything = useCallback(() => {
    shadowStopRef.current = true
    setShadowActive(false)
    setShadowLabel('Ready')
    stopAudio()
  }, [stopAudio])

  useEffect(() => {
    stopEverything()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surah, ayah])

  function toggleQari(key) {
    setSelectedQaris((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function selectPreset(keys) {
    setSelectedQaris(new Set(keys.filter((k) => availableKeys.has(k))))
  }

  function selectAll() {
    setSelectedQaris(new Set(availableQaris.map((q) => q.key)))
  }

  async function handlePlaySelected() {
    if (isPlayingSequence || shadowActive) {
      stopEverything()
      return
    }
    const keys = availableQaris
      .filter((q) => selectedQaris.has(q.key))
      .map((q) => q.key)
    await playSequence(keys, surah, ayah)
  }

  async function handleReplay(key = primaryQariKey) {
    if (!key || isUnavailable(key, surah, ayah)) return
    stopEverything()
    await playOnce(key, surah, ayah, 1)
  }

  async function handleSlow(key = primaryQariKey) {
    if (!key || isUnavailable(key, surah, ayah)) return
    stopEverything()
    await playOnce(key, surah, ayah, 0.8)
  }

  async function runShadow(key) {
    if (!key || isUnavailable(key, surah, ayah)) return
    stopEverything()
    shadowStopRef.current = false
    setShadowActive(true)
    setShadowLabel('Listen')

    while (!shadowStopRef.current) {
      setShadowLabel('Listen')
      const result = await playOnce(key, surah, ayah, 1)
      if (shadowStopRef.current || result.reason === 'stopped' || !result.ok) break

      for (let i = 3; i >= 1; i -= 1) {
        if (shadowStopRef.current) break
        setShadowLabel(`Your Turn\n${i}`)
        await new Promise((r) => setTimeout(r, 1000))
      }
      if (shadowStopRef.current) break
      setShadowLabel('Listen again')
    }

    setShadowActive(false)
    setShadowLabel('Ready')
  }

  function prevAyah() {
    if (ayah > 1) onNavigate(surah, ayah - 1)
    else if (surah > 1) {
      const prev = surahs[String(surah - 1)]
      onNavigate(surah - 1, prev.verses_count)
    }
  }

  function nextAyah() {
    if (ayah < versesCount) onNavigate(surah, ayah + 1)
    else if (surah < 114) onNavigate(surah + 1, 1)
  }

  function prevRange() {
    const start = Math.max(1, rangeStart - 5)
    onNavigate(surah, start)
  }

  function nextRange() {
    if (rangeEnd >= versesCount) return
    onNavigate(surah, rangeStart + 5)
  }

  const playBtnStop = isPlayingSequence || shadowActive
  const playBtnLabel = playBtnStop ? '■ Stop' : '▶ Play Selected Qaris'

  return (
    <div className="practice-page">
      <Header
        title={`Surah ${currentSurah.name_en}`}
        subtitle={`Ayah ${ayah}`}
        onMenuToggle={onMenuToggle}
      />

      <div className="top-actions-row">
        <button type="button" className="btn" onClick={prevAyah}>
          ‹ Previous
        </button>
        <button
          type="button"
          className={`btn ${playBtnStop ? 'stop' : 'primary'}`}
          onClick={handlePlaySelected}
        >
          {playBtnLabel}
        </button>
        <button type="button" className="btn primary" onClick={nextAyah}>
          Next ›
        </button>
      </div>

      <section className="reader">
        <div className="reader-head">
          <div>
            {currentSurah.name_en} · {surah}:{ayah}
          </div>
          <div className="ayah-meta">
            {rangeNote || `${currentSurah.name_ar} · ${versesCount} āyāt`}
          </div>
        </div>
        <div className="arabic" dir="rtl" lang="ar">
          {arabic}
        </div>

        <PracticeControls
          onReplay={() => handleReplay()}
          onSlow={() => handleSlow()}
          onStartShadow={() => runShadow(primaryQariKey)}
          onToggleRecord={recorder.toggle}
          isRecording={recorder.isRecording}
          disableAudioActions={
            !primaryQariKey || isUnavailable(primaryQariKey, surah, ayah)
          }
        />

        <ShadowMode
          active={shadowActive}
          countLabel={shadowLabel}
          onStop={stopEverything}
        />

        <RecordingPanel
          recordingUrl={recorder.recordingUrl}
          error={recorder.error}
        />
      </section>

      <div className="qari-toolbar">
        <h2>Listen &amp; Imitate Different Qaris</h2>
      </div>

      <QariSelector
        availableQaris={availableQaris}
        selectedQaris={selectedQaris}
        onToggle={toggleQari}
        onSelectPreset={selectPreset}
        onSelectAll={selectAll}
      />

      <div className="cards">
        {selectedList.map((q) => (
          <QariCard
            key={`${q.key}-${surah}-${ayah}`}
            qari={q}
            surah={surah}
            ayah={ayah}
            isPlaying={currentlyPlayingQari === q.key}
            unavailable={isUnavailable(q.key, surah, ayah)}
            onReplay={handleReplay}
            onSlow={handleSlow}
            onShadow={runShadow}
            onAudioError={(key) => markUnavailable(key, surah, ayah)}
            onNativePlay={(key) => setPlayingQari(key)}
          />
        ))}
      </div>

      <div className="range-nav">
        <div>
          <b>
            Ayahs {rangeStart}–{rangeEnd}
          </b>
          <div className="ayah-tabs">
            {Array.from({ length: rangeEnd - rangeStart + 1 }, (_, i) => {
              const n = rangeStart + i
              return (
                <button
                  key={n}
                  type="button"
                  className={`ayah-tab ${n === ayah ? 'active' : ''}`}
                  onClick={() => onNavigate(surah, n)}
                >
                  {n}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <button type="button" className="btn" onClick={prevRange}>
            ‹ Previous 5
          </button>{' '}
          <button type="button" className="btn" onClick={nextRange}>
            Next 5 ›
          </button>
        </div>
      </div>

      <div className="footer">
        Listen → Shadow → Recite → Record → Compare → Improve
      </div>
    </div>
  )
}
