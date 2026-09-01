import { useNavigate } from 'react-router-dom'
import UserMenu from './UserMenu'

export default function Header({ title, subtitle, onMenuToggle }) {
  const navigate = useNavigate()

  return (
    <header className="top">
      <div className="top-bar">
        <div className="top-bar-left">
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
        </div>

        <button
          type="button"
          className="header-logo-btn"
          onClick={() => navigate('/practice')}
          aria-label="Go to home"
        >
          <img
            className="header-logo"
            src={`${import.meta.env.BASE_URL}aqqa-logo.png`}
            alt=""
          />
        </button>

        <div className="top-bar-right">
          <UserMenu />
        </div>

        <div className="top-heading">
          <h1 id="page-title">{title}</h1>
          {subtitle && <div className="sub">{subtitle}</div>}
        </div>
      </div>
    </header>
  )
}
