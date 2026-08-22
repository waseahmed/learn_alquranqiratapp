import { useAuth } from '../../contexts/AuthContext'

export default function Header({ title, subtitle, onMenuToggle }) {
  const { displayName, signOut } = useAuth()

  return (
    <header className="top">
      <div className="top-left">
        {onMenuToggle && (
          <button
            type="button"
            className="btn menu-toggle"
            onClick={onMenuToggle}
            aria-label="Open navigation menu"
          >
            ☰ Menu
          </button>
        )}
        <div>
          <h1 id="page-title">{title}</h1>
          {subtitle && <div className="sub">{subtitle}</div>}
        </div>
      </div>
      <div className="user-area">
        <span className="welcome">
          Welcome, {displayName || 'Student'}
        </span>
        <button type="button" className="btn" onClick={() => signOut()}>
          Logout
        </button>
      </div>
    </header>
  )
}
