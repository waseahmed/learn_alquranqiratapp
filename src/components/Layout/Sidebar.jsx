import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { surahs } from '../../data/quranData'
import { juzList } from '../../data/juz'
import { popularSurahs } from '../../data/popularSurahs'
import {
  loadSidebarCollapsed,
  saveSidebarCollapsed,
} from '../../services/preferences'

export default function Sidebar({
  currentSurah,
  onSelectSurah,
  onSelectJuz,
  mobileOpen,
  onCloseMobile,
}) {
  const [collapsed, setCollapsed] = useState(() => ({
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
        <img
          className="logo"
          src={`${import.meta.env.BASE_URL}aqqa-logo.png`}
          alt="Al Quran Qirat Academy"
        />

        <div className="menu-title">📖 Practice Library</div>

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

        <div className="sidebar-page">
          <NavLink
            to="/how-to-imitate"
            className={({ isActive }) => `item nav-item ${isActive ? 'active' : ''}`}
            onClick={onCloseMobile}
          >
            🎓 How to Imitate a Qari
          </NavLink>
          <NavLink
            to="/common-mistakes"
            className={({ isActive }) => `item nav-item ${isActive ? 'active' : ''}`}
            onClick={onCloseMobile}
          >
            ⚠ Common Mistakes
          </NavLink>
          <NavLink
            to="/practice"
            className={({ isActive }) => `item nav-item ${isActive ? 'active' : ''}`}
            onClick={onCloseMobile}
          >
            ▶ Practice
          </NavLink>
        </div>
      </aside>
    </>
  )
}
