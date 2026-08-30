import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import Header from '../components/Layout/Header'
import { useAuth } from '../contexts/AuthContext'
import { useProfile } from '../contexts/ProfileContext'
import { qaris } from '../data/qaris'
import { surahs } from '../data/quranData'
import { DEFAULT_THEME } from '../services/profileService'

export default function ProfilePage() {
  const { onMenuToggle, onNavigate } = useOutletContext()
  const { displayName, avatarUrl, role, user } = useAuth()
  const {
    qariOrder,
    theme,
    sidebar,
    bookmarks,
    saving,
    message,
    setQariOrder,
    setTheme,
    setSidebar,
    saveDisplayName,
    saveAvatar,
    deleteBookmark,
  } = useProfile()

  const [nameDraft, setNameDraft] = useState(displayName || '')
  const [themeDraft, setThemeDraft] = useState({ ...DEFAULT_THEME, ...theme })

  useEffect(() => {
    setNameDraft(displayName || '')
  }, [displayName])

  useEffect(() => {
    setThemeDraft({ ...DEFAULT_THEME, ...theme })
  }, [theme])

  const selectedSet = useMemo(() => new Set(qariOrder), [qariOrder])

  const orderedSelected = useMemo(
    () => qariOrder.map((key) => qaris.find((q) => q.key === key)).filter(Boolean),
    [qariOrder],
  )

  function toggleQari(key) {
    if (selectedSet.has(key)) {
      setQariOrder(qariOrder.filter((k) => k !== key))
      return
    }
    setQariOrder([...qariOrder, key])
  }

  function moveQari(key, direction) {
    const idx = qariOrder.indexOf(key)
    if (idx < 0) return
    const next = [...qariOrder]
    const swap = idx + direction
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    setQariOrder(next)
  }

  async function handleSaveName(e) {
    e.preventDefault()
    await saveDisplayName(nameDraft)
  }

  async function handleAvatar(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      window.alert('Please choose an image under 2 MB.')
      return
    }
    await saveAvatar(file)
  }

  function handleThemeSave(e) {
    e.preventDefault()
    setTheme(themeDraft)
  }

  return (
    <section className="guide profile-page">
      <Header title="My Profile" subtitle="Student preferences" onMenuToggle={onMenuToggle} />

      {message && <p className="profile-message" role="status">{message}</p>}

      <div className="profile-hero">
        <div className="avatar-wrap">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="avatar-img" />
          ) : (
            <div className="avatar-fallback" aria-hidden="true">
              {(displayName || 'S').slice(0, 1).toUpperCase()}
            </div>
          )}
          <label className="btn avatar-upload">
            Upload photo
            <input type="file" accept="image/*" hidden onChange={handleAvatar} />
          </label>
        </div>
        <div>
          <p className="profile-meta">
            <b>{displayName || 'Student'}</b>
            <br />
            {user?.email}
            <br />
            Role: {role || 'student'}
          </p>
          {(role || 'student') === 'student' ? (
            <p className="profile-name-locked">
              Display name is set by your academy and cannot be changed.
            </p>
          ) : (
            <form className="profile-form-inline" onSubmit={handleSaveName}>
              <label htmlFor="displayName">Display name</label>
              <input
                id="displayName"
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={80}
              />
              <button type="submit" className="btn primary" disabled={saving}>
                Save name
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="guide-card">
        <div className="rule">1. Qaris to practice (and order)</div>
        <p className="guide-intro">
          Select qaris and use ↑ ↓ to set playback order. This list is saved to your
          account.
        </p>
        <div className="checks">
          {qaris.map((q) => (
            <button
              key={q.key}
              type="button"
              className={`check ${selectedSet.has(q.key) ? 'on' : ''}`}
              aria-pressed={selectedSet.has(q.key)}
              onClick={() => toggleQari(q.key)}
            >
              {q.name}
            </button>
          ))}
        </div>
        <ol className="qari-order-list">
          {orderedSelected.map((q, index) => (
            <li key={q.key}>
              <span>
                {index + 1}. {q.name}
              </span>
              <span className="qari-order-actions">
                <button
                  type="button"
                  className="btn"
                  aria-label={`Move ${q.name} up`}
                  disabled={index === 0 || saving}
                  onClick={() => moveQari(q.key, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn"
                  aria-label={`Move ${q.name} down`}
                  disabled={index === orderedSelected.length - 1 || saving}
                  onClick={() => moveQari(q.key, 1)}
                >
                  ↓
                </button>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="guide-card">
        <div className="rule">2. Library menu</div>
        <p className="guide-intro">Choose which sections appear in the left menu.</p>
        <div className="nav-pref-list">
          <label className="nav-pref">
            <input
              type="checkbox"
              checked={sidebar?.showPopular !== false}
              onChange={(e) =>
                setSidebar({ ...(sidebar || {}), showPopular: e.target.checked })
              }
            />
            Show Popular Surahs
          </label>
          <label className="nav-pref">
            <input
              type="checkbox"
              checked={sidebar?.showFullQuran !== false}
              onChange={(e) =>
                setSidebar({ ...(sidebar || {}), showFullQuran: e.target.checked })
              }
            />
            Show Full Quran
          </label>
          <label className="nav-pref">
            <input
              type="checkbox"
              checked={sidebar?.showJuz !== false}
              onChange={(e) =>
                setSidebar({ ...(sidebar || {}), showJuz: e.target.checked })
              }
            />
            Show Juz shortcuts
          </label>
          <label className="nav-pref">
            <input
              type="checkbox"
              checked={sidebar?.showAyahSection !== false}
              onChange={(e) =>
                setSidebar({ ...(sidebar || {}), showAyahSection: e.target.checked })
              }
            />
            Show ayah text on Practice
          </label>
          <label className="nav-pref">
            <input
              type="checkbox"
              checked={sidebar?.showAyahIndex !== false}
              onChange={(e) =>
                setSidebar({ ...(sidebar || {}), showAyahIndex: e.target.checked })
              }
            />
            Show ayah index on Practice
          </label>
        </div>
      </div>

      <div className="guide-card">
        <div className="rule">3. Customize colors</div>
        <form className="theme-form" onSubmit={handleThemeSave}>
          <label>
            Accent green
            <input
              type="color"
              value={themeDraft.green}
              onChange={(e) => setThemeDraft((t) => ({ ...t, green: e.target.value }))}
            />
          </label>
          <label>
            Gold accent
            <input
              type="color"
              value={themeDraft.gold}
              onChange={(e) => setThemeDraft((t) => ({ ...t, gold: e.target.value }))}
            />
          </label>
          <label>
            Background
            <input
              type="color"
              value={themeDraft.background}
              onChange={(e) =>
                setThemeDraft((t) => ({ ...t, background: e.target.value }))
              }
            />
          </label>
          <label>
            Text
            <input
              type="color"
              value={themeDraft.ink}
              onChange={(e) => setThemeDraft((t) => ({ ...t, ink: e.target.value }))}
            />
          </label>
          <div className="theme-actions">
            <button type="submit" className="btn primary" disabled={saving}>
              Save colors
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setThemeDraft({ ...DEFAULT_THEME })
                setTheme({ ...DEFAULT_THEME })
              }}
            >
              Reset academy theme
            </button>
          </div>
        </form>
      </div>

      <div className="guide-card">
        <div className="rule">4. Bookmarks</div>
        {bookmarks.length === 0 ? (
          <p className="guide-intro">
            No bookmarks yet. On Practice, use ★ Ayah or ★ Surah.
          </p>
        ) : (
          <ul className="bookmark-list">
            {bookmarks.map((b) => {
              const surah = surahs[String(b.surah)]
              const label =
                b.kind === 'surah'
                  ? `Surah ${b.surah} · ${surah?.name_en || ''}`
                  : `${surah?.name_en || `Surah ${b.surah}`} · ${b.surah}:${b.ayah}`
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    className="bookmark-link"
                    onClick={() => onNavigate(b.surah, b.ayah || 1)}
                  >
                    ★ {label}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => deleteBookmark(b.id)}
                  >
                    Remove
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <Link to="/practice" className="btn primary">
        Back to Practice
      </Link>
    </section>
  )
}
