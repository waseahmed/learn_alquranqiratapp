import { formatResponseMs } from '../../utils/liveQuizTiming'

const MEDALS = ['🥇', '🥈', '🥉']
const PLACE_LABEL = ['1st place', '2nd place', '3rd place']

function roleSuffix(role) {
  return role === 'father' ? 'Father' : 'Mother'
}

function PodiumCard({ place, entry, highlightYou }) {
  const empty = !entry
  return (
    <div
      className={`live-parent-podium-card live-parent-podium-card--${place} ${
        highlightYou ? 'live-parent-podium-card--you' : ''
      } ${empty ? 'live-parent-podium-card--empty' : ''}`}
      style={{ animationDelay: `${place * 100}ms` }}
    >
      <span className="live-parent-podium-medal" aria-hidden>
        {empty ? '—' : MEDALS[place - 1]}
      </span>
      <span className="live-parent-podium-place">{PLACE_LABEL[place - 1]}</span>
      {empty ? (
        <span className="live-parent-podium-name live-parent-podium-name--empty">—</span>
      ) : (
        <>
          <strong className="live-parent-podium-name">{entry.kid_name}</strong>
          <span className="live-parent-podium-meta">
            {roleSuffix(entry.parent_role)}
            {entry.response_ms != null && <> · {formatResponseMs(entry.response_ms)}</>}
          </span>
          {entry.points_awarded > 0 && (
            <span className="live-parent-podium-pts">+{entry.points_awarded} pts</span>
          )}
        </>
      )}
    </div>
  )
}

export default function LiveParentPodium({ places, myParticipantId }) {
  const slots = { 1: null, 2: null, 3: null }
  for (const entry of places || []) {
    const p = entry.place ?? entry.rank
    if (p >= 1 && p <= 3) slots[p] = entry
  }
  if (!slots[1] && !slots[2] && !slots[3]) {
    const ranked = [...(places || [])].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
    ranked.slice(0, 3).forEach((entry, idx) => {
      slots[idx + 1] = { ...entry, place: idx + 1 }
    })
  }

  return (
    <div className="live-parent-podium" aria-label="Top three">
      <h3 className="live-parent-podium-heading">Top 3</h3>
      <div className="live-parent-podium-stage">
        <PodiumCard
          place={2}
          entry={slots[2]}
          highlightYou={slots[2]?.participant_id === myParticipantId}
        />
        <PodiumCard
          place={1}
          entry={slots[1]}
          highlightYou={slots[1]?.participant_id === myParticipantId}
        />
        <PodiumCard
          place={3}
          entry={slots[3]}
          highlightYou={slots[3]?.participant_id === myParticipantId}
        />
      </div>
    </div>
  )
}