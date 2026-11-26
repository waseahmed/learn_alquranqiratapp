import { NavLink, useNavigate } from 'react-router-dom'

const LINKS = [
  { to: '/practice', label: 'Practice' },
  { to: '/compare-audio', label: 'Compare audio' },
  { to: '/my-attempts', label: 'My attempts' },
  { to: '/how-to-imitate', label: 'How to imitate' },
  { to: '/common-mistakes', label: 'Common mistakes' },
]

export default function ShadowPracticeNav() {
  const navigate = useNavigate()

  return (
    <nav className="shadow-practice-nav" aria-label="App sections">
      <button
        type="button"
        className="shadow-practice-nav-brand"
        onClick={() => navigate('/practice')}
        aria-label="Go to practice home"
      >
        <img
          className="shadow-practice-nav-logo"
          src={`${import.meta.env.BASE_URL}aqqa-logo.png`}
          alt=""
        />
        <span className="shadow-practice-nav-brand-text">
          <strong>AQQA Learn</strong>
          <span>Navigation</span>
        </span>
      </button>
      <div className="shadow-practice-nav-links">
        {LINKS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-item shadow-practice-nav-link${isActive ? ' active' : ''}`}
            end={to === '/practice'}
          >
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}