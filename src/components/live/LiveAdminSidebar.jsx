const NAV_ITEMS = [
  { id: 'host', label: 'Host live', description: 'Run questions & preview' },
  { id: 'users', label: 'Participants', description: 'Families connected' },
  { id: 'setup', label: 'Session setup', description: 'Groups & questions' },
  { id: 'analysis', label: 'Analysis', description: 'Vote breakdown' },
]

const SECTION_TITLES = {
  host: 'Host live',
  users: 'Participants',
  setup: 'Session setup',
  analysis: 'Analysis',
}

export function liveAdminSectionTitle(section) {
  return SECTION_TITLES[section] || 'Live host'
}

export default function LiveAdminSidebar({ active, onChange, onLock, activeGroupLabel }) {
  return (
    <aside className="live-admin-sidebar">
      <div className="live-admin-sidebar-brand">
        <img
          src={`${import.meta.env.BASE_URL}aqqa-logo.png`}
          alt=""
          className="live-admin-sidebar-logo"
        />
        <div>
          <p className="live-admin-sidebar-kicker">Al Quran Qirat Academy</p>
          <p className="live-admin-sidebar-title">Live host</p>
        </div>
      </div>

      {activeGroupLabel && (
        <div className="live-admin-sidebar-group" title="Group selected for sending questions">
          <span className="live-admin-sidebar-group-label">Hosting group</span>
          <strong className="live-admin-sidebar-group-name">{activeGroupLabel}</strong>
        </div>
      )}

      <nav className="live-admin-sidebar-nav" aria-label="Admin sections">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`live-admin-sidebar-link ${active === item.id ? 'live-admin-sidebar-link--active' : ''}`}
            onClick={() => onChange(item.id)}
          >
            <span className="live-admin-sidebar-link-label">{item.label}</span>
            <span className="live-admin-sidebar-link-desc">{item.description}</span>
          </button>
        ))}
      </nav>

      <div className="live-admin-sidebar-footer">
        <button type="button" className="btn ghost live-admin-sidebar-lock" onClick={onLock}>
          Lock dashboard
        </button>
      </div>
    </aside>
  )
}