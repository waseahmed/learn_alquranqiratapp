export default function LiveAdminSubTabs({ tabs, active, onChange, ariaLabel }) {
  if (!tabs?.length) return null
  return (
    <nav className="live-admin-subtabs" aria-label={ariaLabel} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          className={`live-admin-subtab ${active === t.id ? 'live-admin-subtab--active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  )
}