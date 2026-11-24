import { formatIdleSince } from '../../utils/formatIdle'

export function LiveUsersDashboard({ participants }) {
  const fathers = participants.filter((p) => p.parent_role === 'father').length
  const mothers = participants.filter((p) => p.parent_role === 'mother').length
  const total = participants.length

  return (
    <section className="live-users-dashboard" aria-labelledby="live-users-dash-title">
      <p className="live-users-dash-kicker">Live participants</p>
      <h3 id="live-users-dash-title" className="live-users-dash-title">
        Let&apos;s Get Connected!
      </h3>
      <div className="live-users-stats-grid">
        <div className="live-users-stat-card">
          <span className="live-users-stat-icon" aria-hidden>
            👨
          </span>
          <span className="live-users-stat-num">{fathers}</span>
          <span className="live-users-stat-label">Fathers</span>
        </div>
        <div className="live-users-stat-card">
          <span className="live-users-stat-icon" aria-hidden>
            👩
          </span>
          <span className="live-users-stat-num">{mothers}</span>
          <span className="live-users-stat-label">Mothers</span>
        </div>
        <div className="live-users-stat-card">
          <span className="live-users-stat-icon" aria-hidden>
            👨‍👩‍👧
          </span>
          <span className="live-users-stat-num">{total}</span>
          <span className="live-users-stat-label">Total joined</span>
        </div>
      </div>
      <p className="live-muted live-users-wait-msg">Waiting for everyone to join…</p>
    </section>
  )
}

export function LiveUsersRoster({ participants, now, onRemove, busy }) {
  return (
    <section className="live-roster" aria-labelledby="live-roster-heading">
      <h3 id="live-roster-heading" className="live-stats-heading">
        Connected families
      </h3>
      <p className="live-muted live-roster-hint">
        Parents stay connected if they revisit the link until you remove them here.
      </p>
      {participants.length === 0 ? (
        <p className="live-muted">No one has joined yet.</p>
      ) : (
        <ul className="live-roster-list">
          {participants.map((p) => {
            const idle = formatIdleSince(p.last_seen_at, now)
            return (
              <li
                key={p.id}
                className={`live-roster-row ${idle.warn ? 'live-roster-row--warn' : ''}`}
              >
                <div className="live-roster-info">
                  <strong>{p.kid_name}</strong>
                  <span className="live-muted">
                    {p.parent_role === 'father' ? 'Father' : 'Mother'} · joined{' '}
                    {new Date(p.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span
                    className={`live-roster-status ${idle.idle ? 'live-roster-status--idle' : 'live-roster-status--active'}`}
                  >
                    {idle.label}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn ghost live-roster-remove"
                  onClick={() => onRemove(p.id)}
                  disabled={busy}
                >
                  Remove
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}