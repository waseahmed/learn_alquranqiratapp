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
import { useProfile } from '../contexts/ProfileContext'
import {
  saveLastPosition,
  saveSelectedQaris,
  loadSelectedQaris,
} from '../services/preferences'

export default function PracticePageView({
  surah,
  ayah,
  rangeNote,
  onNavigate,
  onMenuToggle,
}) {
  const {
    qariOrder,
    setQariOrder,
    sidebar,
    setSidebar,
    toggleAyahBookmark,
    toggleSurahBookmark,
    isAyahBookmarked,
    isSurahBookmarked,
  } = useProfile()

  const currentSurah = surahs[String(surah)]
  const versesCount = currentSurah.verses_count
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
  const [hydratedFromProfile, setHydratedFromProfile] = useState(false)
  const [loopCounts, setLoopCounts] = useState({})
  /** Selected slow speed: null = normal 1×; 0.8 or 0.5 when toggled on */
  const [slowRate, setSlowRate] = useState(null)

  const {
    currentlyPlayingQari,
    playbackRate,
    isPlayingSequence,
    isUnavailable,
    markUnavailable,
    playOnce,
    playRepeats,
    playSequence,
    registerAudio,
    stop: stopAudio,
  } = useAudioPlayer()

  const recorder = useRecorder()
  const [shadowActive, setShadowActive] = useState(false)
  const [shadowLabel, setShadowLabel] = useState('Ready')
  const shadowStopRef = useRef(false)
  const autoAdvanceRef = useRef(false)

  useEffect(() => {
    saveLastPosition(surah, ayah)
  }, [surah, ayah])

  useEffect(() => {
    if (hydratedFromProfile) return
    if (!qariOrder?.length) return
    setSelectedQaris(new Set(qariOrder))
    setHydratedFromProfile(true)
  }, [qariOrder, hydratedFromProfile])

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

  useEffect(() => {
    const active = document.querySelector('.ayah-index-grid .ayah-tab.active')
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [surah, ayah])

  const selectedList = useMemo(() => {
    const byKey = new Map(availableQaris.map((q) => [q.key, q]))
    const ordered = []
    for (const key of qariOrder) {
      if (selectedQaris.has(key) && byKey.has(key)) ordered.push(byKey.get(key))
    }
    for (const q of availableQaris) {
      if (selectedQaris.has(q.key) && !ordered.some((x) => x.key === q.key)) {
        ordered.push(q)
      }
    }
    return ordered
  }, [availableQaris, selectedQaris, qariOrder])

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

  function persistOrder(nextSet) {
    const kept = qariOrder.filter((k) => nextSet.has(k))
    const added = [...nextSet].filter((k) => !kept.includes(k))
    setQariOrder([...kept, ...added])
  }

  function toggleQari(key) {
    setSelectedQaris((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      persistOrder(next)
      return next
    })
  }

  function selectPreset(keys) {
    const next = new Set(keys.filter((k) => availableKeys.has(k)))
    setSelectedQaris(next)
    setQariOrder([...next])
  }

  function selectAll() {
    const next = new Set(availableQaris.map((q) => q.key))
    setSelectedQaris(next)
    const ordered = [
      ...qariOrder.filter((k) => next.has(k)),
      ...[...next].filter((k) => !qariOrder.includes(k)),
    ]
    setQariOrder(ordered)
  }

  const playRate = slowRate || 1
  const autoAdvanceAyah = sidebar?.autoAdvanceAyah === true

  useEffect(() => {
    autoAdvanceRef.current = autoAdvanceAyah
  }, [autoAdvanceAyah])

  function hasNextAyah() {
    return ayah < versesCount || surah < 114
  }

  function maybeAutoAdvance(result) {
    if (!autoAdvanceRef.current || !result?.ok || !hasNextAyah()) return
    nextAyah()
  }

  async function handlePlaySelected() {
    if (isPlayingSequence || shadowActive) {
      stopEverything()
      return
    }
    const result = await playSequence(
      selectedList.map((q) => q.key),
      surah,
      ayah,
      { ...loopCounts },
      playRate,
    )
    maybeAutoAdvance(result)
  }

  async function handleReplay(key = primaryQariKey) {
    if (!key || isUnavailable(key, surah, ayah)) return
    stopEverything()
    const result = await playRepeats(key, surah, ayah, playRate, loopCounts[key] || 1)
    maybeAutoAdvance(result)
  }

  async function handlePlayToggle(key) {
    if (!key || isUnavailable(key, surah, ayah)) return
    if (currentlyPlayingQari === key) {
      stopEverything()
      return
    }
    stopEverything()
    const result = await playRepeats(key, surah, ayah, playRate, loopCounts[key] || 1)
    maybeAutoAdvance(result)
  }

  async function handleSlowToggle(key = primaryQariKey, rate = 0.8) {
    if (!key || isUnavailable(key, surah, ayah)) return
    if (slowRate != null && Math.abs(slowRate - rate) < 0.01) {
      setSlowRate(null)
      stopEverything()
      return
    }
    setSlowRate(rate)
    stopEverything()
    const result = await playRepeats(key, surah, ayah, rate, loopCounts[key] || 1)
    maybeAutoAdvance(result)
  }

  async function runShadow(key) {
    if (!key || isUnavailable(key, surah, ayah)) return
    stopEverything()
    shadowStopRef.current = false
    setShadowActive(true)
    setShadowLabel('Listen')

    while (!shadowStopRef.current) {
      setShadowLabel('Listen')
      // playOnce clears the stop flag from stopEverything() so Listen can start
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

  const playBtnStop = isPlayingSequence || shadowActive
  const ayahStarred = isAyahBookmarked(surah, ayah)
  const surahStarred = isSurahBookmarked(surah)
  const showAyahSection = sidebar?.showAyahSection !== false
  const showAyahIndex = sidebar?.showAyahIndex !== false

  function toggleAyahSection() {
    setSidebar({ ...(sidebar || {}), showAyahSection: !showAyahSection })
  }

  function toggleAyahIndex() {
    setSidebar({ ...(sidebar || {}), showAyahIndex: !showAyahIndex })
  }

  function toggleAutoAdvanceAyah() {
    setSidebar({ ...(sidebar || {}), autoAdvanceAyah: !autoAdvanceAyah })
  }

  return (
    <div className="practice-page">
      <Header
        title="Listen & Imitate Different Qaris"
        subtitle="Qirat practice"
        onMenuToggle={onMenuToggle}
      />

      <div className="practice-control-bar" role="toolbar" aria-label="Practice controls">
        <div className="control-group control-group-nav" aria-label="Surah and ayah">
          <div className="surah-context">
            <span className="surah-context-num">Surah {surah}</span>
            <span className="surah-context-name">{currentSurah.name_en}</span>
          </div>
          <span className="control-group-divider" aria-hidden="true" />
          <button type="button" className="btn" onClick={prevAyah} title="Go to previous ayah">
            ‹ Prev
          </button>
          <span className="ayah-position" aria-live="polite">
            Ayah {ayah}
          </span>
          <button type="button" className="btn" onClick={nextAyah} title="Go to next ayah">
            Next ›
          </button>
          <label
            className="auto-advance-pref"
            title="After playback finishes, go to the next ayah automatically"
          >
            <input
              type="checkbox"
              checked={autoAdvanceAyah}
              onChange={toggleAutoAdvanceAyah}
            />
            Next ayah
          </label>
        </div>

        <div className="control-group control-group-secondary" aria-label="Favourites and display">
          <button
            type="button"
            className={`btn ${ayahStarred ? 'primary' : ''}`}
            aria-pressed={ayahStarred}
            onClick={() => toggleAyahBookmark(surah, ayah)}
            title="Favourite this ayah"
          >
            {ayahStarred ? '★ Fav ayah' : '☆ Fav ayah'}
          </button>
          <button
            type="button"
            className={`btn ${surahStarred ? 'primary' : ''}`}
            aria-pressed={surahStarred}
            onClick={() => toggleSurahBookmark(surah)}
            title="Favourite this surah"
          >
            {surahStarred ? '★ Fav surah' : '☆ Fav surah'}
          </button>
          <button
            type="button"
            className="btn"
            aria-pressed={!showAyahSection}
            onClick={toggleAyahSection}
            title={showAyahSection ? 'Hide Arabic ayah text' : 'Show Arabic ayah text'}
          >
            {showAyahSection ? 'Hide text' : 'Show text'}
          </button>
          <button
            type="button"
            className="btn"
            aria-pressed={!showAyahIndex}
            onClick={toggleAyahIndex}
            title={showAyahIndex ? 'Hide ayah index' : 'Show ayah index'}
          >
            {showAyahIndex ? 'Hide index' : 'Show index'}
          </button>
        </div>
      </div>

      {showAyahSection && (
        <section className="reader">
          <div className="reader-head">
            <div className="reader-head-title">{currentSurah.name_ar}</div>
            <div className="ayah-meta">
              {rangeNote || `${versesCount} āyāt · ${surah}:${ayah}`}
            </div>
          </div>
          <div className="arabic" dir="rtl" lang="ar">
            {arabic}
          </div>

          <PracticeControls
            onReplay={() => handleReplay()}
            onSlowToggle={(rate) => handleSlowToggle(primaryQariKey, rate)}
            onStartShadow={() => runShadow(primaryQariKey)}
            onToggleRecord={recorder.toggle}
            isRecording={recorder.isRecording}
            slowRate={slowRate}
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
      )}

      {showAyahIndex && (
        <div className="ayah-index" aria-label={`Ayah index for ${currentSurah.name_en}`}>
          <div className="ayah-index-head">
            <b>Ayah index</b>
            <span>
              Surah {surah} · {currentSurah.name_en} · {versesCount} āyāt · now {surah}:{ayah}
            </span>
          </div>
          <div className="ayah-index-grid">
            {Array.from({ length: versesCount }, (_, i) => {
              const n = i + 1
              return (
                <button
                  key={n}
                  type="button"
                  className={`ayah-tab ${n === ayah ? 'active' : ''}`}
                  onClick={() => onNavigate(surah, n)}
                  aria-current={n === ayah ? 'true' : undefined}
                >
                  {n}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <QariSelector
        availableQaris={availableQaris}
        selectedQaris={selectedQaris}
        onToggle={toggleQari}
        onSelectPreset={selectPreset}
        onSelectAll={selectAll}
        onPlayAll={handlePlaySelected}
        isPlayingAll={playBtnStop}
      />

      <div className="cards">
        {selectedList.map((q) => (
          <QariCard
            key={`${q.key}-${surah}-${ayah}`}
            qari={q}
            surah={surah}
            ayah={ayah}
            isPlaying={currentlyPlayingQari === q.key}
            playbackRate={currentlyPlayingQari === q.key ? playbackRate : null}
            slowRate={slowRate}
            unavailable={isUnavailable(q.key, surah, ayah)}
            loopCount={loopCounts[q.key] || 1}
            onLoopChange={(key, next) =>
              setLoopCounts((prev) => ({ ...prev, [key]: next }))
            }
            onReplay={handleReplay}
            onPlayToggle={handlePlayToggle}
            onSlowToggle={handleSlowToggle}
            onShadow={runShadow}
            onAudioError={(key) => markUnavailable(key, surah, ayah)}
            registerAudio={registerAudio}
          />
        ))}
      </div>

      <div className="footer">
        Listen → Shadow → Recite → Record → Compare → Improve
      </div>
    </div>
  )
}
