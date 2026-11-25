import { useEffect, useMemo, useState } from 'react'
import { fetchLivePresentSnapshot } from '../../services/liveQuiz'
import { formatResponseMs } from '../../utils/liveQuizTiming'

const MEDALS = ['🥇', '🥈', '🥉']
const ORDINAL = ['1st', '2nd', '3rd']
const LOGO_CANDIDATES = ['aqqa-logo.png', 'logo.png']

function roleSuffix(role) {
  return role === 'father' ? ' · Father' : ' · Mother'
}

function buildPodiumSlots(places, liveAnswers, isCompetition, useLive) {
  const slots = { 1: null, 2: null, 3: null }
  let source = places.filter((e) => (e.place ?? 0) <= 3)

  if (!source.length && useLive && liveAnswers.length) {
    const ordered = isCompetition
      ? liveAnswers.filter((a) => a.is_correct)
      : [...liveAnswers]
    source = ordered.slice(0, 3).map((entry, idx) => ({
      place: idx + 1,
      kid_name: entry.kid_name,
      parent_role: entry.parent_role,
      response_ms: entry.response_ms,
      points_awarded: 0,
      participant_id: entry.participant_id,
    }))
  }

  for (const entry of source) {
    const place = entry.place
    if (place >= 1 && place <= 3) slots[place] = entry
  }
  return slots
}

function PresentLogo() {
  const [src, setSrc] = useState(`${import.meta.env.BASE_URL}${LOGO_CANDIDATES[0]}`)

  return (
    <img
      src={src}
      alt="Al Quran Qirat Academy"
      className="live-present-brand-logo"
      onError={() => {
        setSrc((prev) => {
          const idx = LOGO_CANDIDATES.findIndex((name) => prev.endsWith(name))
          const next = LOGO_CANDIDATES[idx + 1]
          return next ? `${import.meta.env.BASE_URL}${next}` : ''
        })
      }}
    />
  )
}

function PodiumNode({ place, entry, animate }) {
  const empty = !entry
  return (
    <div
      className={`live-present-podium-node live-present-podium-node--${place} ${
        animate ? 'live-present-podium-node--animate' : ''
      } ${empty ? 'live-present-podium-node--empty' : ''}`}
      style={animate ? { animationDelay: `${place * 120}ms` } : undefined}
    >
      <span className="live-present-podium-medal" aria-hidden>
        {empty ? '○' : MEDALS[place - 1]}
      </span>
      <span className="live-present-podium-rank">{ORDINAL[place - 1]}</span>
      {empty ? (
        <span className="live-present-podium-name live-present-podium-name--wait">Waiting…</span>
      ) : (
        <>
          <strong className="live-present-podium-name">{entry.kid_name}</strong>
          <span className="live-present-podium-meta">
            {roleSuffix(entry.parent_role)}
            {entry.response_ms != null && (
              <> · {formatResponseMs(entry.response_ms)}</>
            )}
          </span>
          {entry.points_awarded > 0 && (
            <span className="live-present-podium-pts">+{entry.points_awarded}</span>
          )}
        </>
      )}
    </div>
  )
}

export default function LivePresentPage() {
  const [snapshot, setSnapshot] = useState(null)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [revealKey, setRevealKey] = useState(0)

  useEffect(() => {
    let active = true
    async function load() {
      const { data, error: err } = await fetchLivePresentSnapshot()
      if (!active) return
      if (err) setError(err.message)
      else setSnapshot(data)
    }
    load()
    const id = window.setInterval(load, 1200)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [])

  const podium = snapshot?.last_podium
  const ctx = snapshot?.remaining_context
  const title = podium?.question_title || ctx?.title
  const roundId = snapshot?.round_id || podium?.round_id
  const phase = snapshot?.phase ?? 'waiting'
  const isLiveQuestion = phase === 'question' && Boolean(roundId)
  const isCompetition = (podium?.group_mode || ctx?.group_mode) === 'competition'

  const liveAnswers = snapshot?.live_answers || []
  const ranking = podium?.ranking?.length ? podium.ranking : podium?.places || []
  const feed =
    isLiveQuestion && liveAnswers.length
      ? liveAnswers
      : ranking.length
        ? ranking
        : liveAnswers

  const topPlaces = podium?.places || []
  const podiumSlots = useMemo(
    () => buildPodiumSlots(topPlaces, liveAnswers, isCompetition, isLiveQuestion),
    [topPlaces, liveAnswers, isCompetition, isLiveQuestion],
  )

  const leaderboard = snapshot?.leaderboard || []

  useEffect(() => {
    if (roundId) setRevealKey((k) => k + 1)
  }, [roundId])

  const remainingSec = useMemo(() => {
    if (!isLiveQuestion || !snapshot?.phase_started_at) {
      return Number(snapshot?.remaining_seconds) || 0
    }
    const start = new Date(snapshot.phase_started_at).getTime()
    const timerSec = snapshot.timer_seconds ?? 10
    const end = start + timerSec * 1000
    return Math.max(0, Math.ceil((end - now) / 1000))
  }, [isLiveQuestion, snapshot, now])

  const answerCount = Number(snapshot?.answer_count) || feed.length

  const feedTitle = isCompetition ? 'Fastest correct answers' : 'Answers as they arrive'

  return (
    <div className="live-present live-present--theatre">
      <header className="live-present-topbar">
        <div className="live-present-brand">
          <PresentLogo />
          <div>
            <p className="live-present-brand-title">Live results</p>
            <p className="live-present-brand-sub">Al Quran Qirat Academy</p>
          </div>
        </div>

        <div className="live-present-topbar-pills" aria-live="polite">
          {isLiveQuestion ? (
            <>
              <span className="live-present-pill live-present-pill--live">On air</span>
              <span className="live-present-pill live-present-pill--timer">{remainingSec}s</span>
              <span className="live-present-pill live-present-pill--count">
                {answerCount} {answerCount === 1 ? 'answer' : 'answers'}
              </span>
            </>
          ) : (
            <span className="live-present-pill live-present-pill--idle">
              {title ? 'Round complete' : 'Stand by'}
            </span>
          )}
        </div>
      </header>

      {error && (
        <p className="live-present-error" role="alert">
          {error}
        </p>
      )}

      <div className="live-present-question-bar">
        {title ? (
          <h1 className="live-present-question-text">{title}</h1>
        ) : (
          <p className="live-present-empty live-present-empty--hero">
            Waiting for the host to send a question…
          </p>
        )}
      </div>

      <div className="live-present-columns">
        <aside className="live-present-col live-present-col--feed" aria-labelledby="feed-heading">
          <h2 id="feed-heading" className="live-present-panel-title">
            {feedTitle}
          </h2>
          {feed.length === 0 ? (
            <p className="live-present-empty">No answers yet.</p>
          ) : (
            <ol className="live-present-feed-list">
              {feed.map((entry, idx) => (
                <li
                  key={entry.participant_id || `${entry.kid_name}-${idx}`}
                  className={`live-present-feed-row ${
                    entry.rank <= 3 || idx < 3 ? `live-present-feed-row--${entry.rank ?? idx + 1}` : ''
                  }`}
                >
                  <span className="live-present-feed-rank">{entry.rank ?? idx + 1}</span>
                  <div className="live-present-feed-body">
                    <strong>{entry.kid_name}</strong>
                    <span className="live-present-feed-meta">
                      {roleSuffix(entry.parent_role)}
                      {entry.is_correct === false && isCompetition && (
                        <span className="live-present-feed-wrong"> · incorrect</span>
                      )}
                    </span>
                  </div>
                  <span className="live-present-feed-ms">
                    {formatResponseMs(entry.response_ms)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </aside>

        <section
          key={revealKey}
          className="live-present-col live-present-col--podium"
          aria-labelledby="podium-heading"
        >
          <h2 id="podium-heading" className="live-present-panel-title live-present-panel-title--center">
            Podium
          </h2>
          <div className="live-present-podium-tree">
            <PodiumNode place={1} entry={podiumSlots[1]} animate />
            <div className="live-present-podium-connect" aria-hidden />
            <div className="live-present-podium-branches">
              <PodiumNode place={2} entry={podiumSlots[2]} animate />
              <PodiumNode place={3} entry={podiumSlots[3]} animate />
            </div>
          </div>
        </section>

        <aside className="live-present-col live-present-col--scores" aria-labelledby="scores-heading">
          <h2 id="scores-heading" className="live-present-panel-title">
            Competition score
          </h2>
          {leaderboard.length === 0 ? (
            <p className="live-present-empty">Scores build across competition rounds.</p>
          ) : (
            <ol className="live-present-score-list">
              {leaderboard.slice(0, 10).map((row, idx) => (
                <li key={`${row.kid_name}-${idx}`} className="live-present-score-row">
                  <span className="live-present-score-rank">{idx + 1}</span>
                  <div className="live-present-score-body">
                    <strong>{row.kid_name}</strong>
                    <span className="live-present-score-meta">{roleSuffix(row.parent_role)}</span>
                  </div>
                  <span className="live-present-score-points">{row.points}</span>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </div>
  )
}