import { useEffect, useMemo, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { surahs } from '../../data/quranData'
import { juzList } from '../../data/juz'
import { popularSurahs } from '../../data/popularSurahs'
import { useProfile } from '../../contexts/ProfileContext'
import {
  loadSidebarCollapsed,
  saveSidebarCollapsed,
} from '../../services/preferences'

function bookmarkLabel(b) {
  const surah = surahs[String(b.surah)]
  if (b.kind === 'surah') return `${b.surah}. ${surah?.name_en || 'Surah'}`
  return `${surah?.name_en || b.surah} ${b.surah}:${b.ayah}`
}

export default function Sidebar({
  currentSurah,
  currentAyah,
  onSelectSurah,
  onSelectJuz,
  mobileOpen,
  onCloseMobile,
}) {
  const navigate = useNavigate()
  const { bookmarks, sidebar } = useProfile()
  const [collapsed, setCollapsed] = useState(() => ({
    fav: false,
    popular: false,
    juz: true,
    surah: true,
    ...loadSidebarCollapsed(),
  }))
  const [search, setSearch] = useState('')

  useEffect(() => {
    saveSidebarCollapsed(collapsed)
  }, [collapsed])

  function toggle(section) {
    setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const surahList = useMemo(() => Object.values(surahs), [])
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return surahList
    return surahList.filter(
      (s) =>
        s.name_en.toLowerCase().includes(q) ||
        s.name_ar.includes(search.trim()) ||
        String(s.number) === q,
    )
  }, [search, surahList])

  function handleSurah(n, ayah = 1) {
    onSelectSurah(n, ayah)
    onCloseMobile?.()
  }

  function handleJuz(juzNumber) {
    onSelectJuz(juzNumber)
    onCloseMobile?.()
  }

  const showPopular = sidebar?.showPopular !== false
  const showFullQuran = sidebar?.showFullQuran !== false
  const showJuz = sidebar?.showJuz !== false

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close menu"
          onClick={onCloseMobile}
        />
      )}
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <button
          type="button"
          className="brand"
          onClick={() => {
            onCloseMobile?.()
            navigate('/practice')
          }}
          aria-label="Go to home"
        >
          <img
            className="logo"
            src={`${import.meta.env.BASE_URL}aqqa-logo.png`}
            alt=""
          />
          <div className="brand-text">
            <strong>AQQA Learn</strong>
            <span>Qirat Practice</span>
          </div>
        </button>

        <div className="menu-title">Practice</div>

        <button
          type="button"
          className="menu-btn"
          onClick={() => toggle('fav')}
          aria-expanded={!collapsed.fav}
        >
          <span>★ My Favourites</span>
          <span aria-hidden="true">{collapsed.fav ? '›' : '⌄'}</span>
        </button>
        {!collapsed.fav && (
          <div className="menu-body">
            {bookmarks.length === 0 ? (
              <p className="sidebar-empty">Star an ayah or surah while practicing.</p>
            ) : (
              bookmarks.map((b) => {
                const active =
                  currentSurah === b.surah &&
                  (b.kind === 'surah' || currentAyah === b.ayah)
                return (
                  <button
                    key={b.id}
                    type="button"
                    className={`item ${active ? 'active' : ''}`}
                    onClick={() => handleSurah(b.surah, b.ayah || 1)}
                  >
                    {bookmarkLabel(b)}
                  </button>
                )
              })
            )}
          </div>
        )}

        {showPopular && (
          <>
            <button
              type="button"
              className="menu-btn"
              onClick={() => toggle('popular')}
              aria-expanded={!collapsed.popular}
            >
              <span>⭐ Popular Surahs</span>
              <span aria-hidden="true">{collapsed.popular ? '›' : '⌄'}</span>
            </button>
            {!collapsed.popular && (
              <div className="menu-body">
                {popularSurahs.map((s) => (
                  <button
                    key={s.number}
                    type="button"
                    className={`item ${currentSurah === s.number ? 'active' : ''}`}
                    onClick={() => handleSurah(s.number)}
                  >
                    {s.number}. {s.label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {showJuz && (
          <>
            <button
              type="button"
              className="menu-btn"
              onClick={() => toggle('juz')}
              aria-expanded={!collapsed.juz}
            >
              <span>📚 Juz Shortcuts</span>
              <span aria-hidden="true">{collapsed.juz ? '›' : '⌄'}</span>
            </button>
            {!collapsed.juz && (
              <div className="menu-body">
                <div className="mini-grid">
                  {juzList.map((j) => (
                    <button
                      key={j.juz}
                      type="button"
                      className="item"
                      title={`Juz ${j.juz}`}
                      onClick={() => handleJuz(j.juz)}
                    >
                      {j.juz}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {showFullQuran && (
          <>
            <button
              type="button"
              className="menu-btn"
              onClick={() => toggle('surah')}
              aria-expanded={!collapsed.surah}
            >
              <span>☰ Full Quran</span>
              <span aria-hidden="true">{collapsed.surah ? '›' : '⌄'}</span>
            </button>
            {!collapsed.surah && (
              <div className="menu-body">
                <label className="sr-only" htmlFor="surahSearch">
                  Search Surah
                </label>
                <input
                  id="surahSearch"
                  className="search"
                  placeholder="Search Surah..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="surah-list">
                  {filtered.map((s) => (
                    <button
                      key={s.number}
                      type="button"
                      className={`item ${currentSurah === s.number ? 'active' : ''}`}
                      onClick={() => handleSurah(s.number)}
                    >
                      {s.number}. {s.name_en}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="sidebar-page">
          <NavLink
            to="/practice"
            className={({ isActive }) => `item nav-item ${isActive ? 'active' : ''}`}
            onClick={onCloseMobile}
          >
            Practice
          </NavLink>
          <NavLink
            to="/how-to-imitate"
            className={({ isActive }) => `item nav-item ${isActive ? 'active' : ''}`}
            onClick={onCloseMobile}
          >
            How to imitate
          </NavLink>
          <NavLink
            to="/common-mistakes"
            className={({ isActive }) => `item nav-item ${isActive ? 'active' : ''}`}
            onClick={onCloseMobile}
          >
            Common mistakes
          </NavLink>
        </div>
      </aside>
    </>
  )
}
