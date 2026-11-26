import { useNavigate } from 'react-router-dom'
import UserMenu from './UserMenu'

export default function Header({ title, subtitle, onMenuToggle, menuCollapsed, logoPosition = 'center' }) {
  const navigate = useNavigate()
  const logoLeft = logoPosition === 'left'

  const homeLogo = (
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
  )

  return (
    <header className="top">
      <div className={`top-bar${logoLeft ? ' top-bar--logo-left' : ''}`}>
        <div className="top-bar-left">
          {logoLeft ? homeLogo : null}
          {onMenuToggle && (
            <button
              type="button"
              className={`btn menu-toggle${menuCollapsed ? ' menu-toggle--show-desktop' : ''}`}
              onClick={onMenuToggle}
              aria-label={menuCollapsed ? 'Show navigation menu' : 'Open navigation menu'}
            >
              ☰ Menu
            </button>
          )}
        </div>

        {!logoLeft ? homeLogo : null}

        <div className="top-heading">
          <h1 id="page-title">{title}</h1>
          {subtitle && <div className="sub">{subtitle}</div>}
        </div>

        <div className="top-bar-right">
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
