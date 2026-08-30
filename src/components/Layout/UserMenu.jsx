import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function UserMenu() {
  const { displayName, avatarUrl, user, role, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    function onPointer(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const initial = (displayName || user?.email || 'S').slice(0, 1).toUpperCase()

  return (
    <div className="user-menu" ref={wrapRef}>
      <button
        type="button"
        className="user-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="header-avatar" />
        ) : (
          <span className="header-avatar-fallback" aria-hidden="true">
            {initial}
          </span>
        )}
        <span className="user-menu-name">{displayName || 'Student'}</span>
        <span className="user-menu-chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div className="user-menu-panel" role="menu">
          <div className="user-menu-identity">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="user-menu-avatar-lg" />
            ) : (
              <span className="user-menu-avatar-lg fallback">{initial}</span>
            )}
            <div>
              <div className="user-menu-display">{displayName || 'Student'}</div>
              <div className="user-menu-email">{user?.email}</div>
              {role && <div className="user-menu-role">{role}</div>}
            </div>
          </div>
          <button
            type="button"
            role="menuitem"
            className="user-menu-item"
            onClick={() => {
              setOpen(false)
              navigate('/profile')
            }}
          >
            My profile
          </button>
          <button
            type="button"
            role="menuitem"
            className="user-menu-item"
            onClick={() => {
              setOpen(false)
              signOut()
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
