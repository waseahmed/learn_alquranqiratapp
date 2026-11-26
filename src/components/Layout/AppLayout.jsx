import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import { juzList } from '../../data/juz'
import {
  loadLastPosition,
  loadMainMenuCollapsed,
  saveMainMenuCollapsed,
} from '../../services/preferences'

export default function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const saved = loadLastPosition()
  const [surah, setSurah] = useState(saved?.surah || 1)
  const [ayah, setAyah] = useState(saved?.ayah || 1)
  const [rangeNote, setRangeNote] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [menuCollapsed, setMenuCollapsed] = useState(() => loadMainMenuCollapsed())

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    saveMainMenuCollapsed(menuCollapsed)
  }, [menuCollapsed])

  function isMobileMenu() {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches
  }

  function handleMenuToggle() {
    if (isMobileMenu()) {
      setMobileOpen(true)
      return
    }
    setMenuCollapsed((c) => !c)
  }

  function onCloseMobile() {
    setMobileOpen(false)
  }

  function navigateTo(nextSurah, nextAyah, note = '') {
    setSurah(Number(nextSurah))
    setAyah(Number(nextAyah))
    setRangeNote(note)
    if (location.pathname !== '/practice') {
      navigate('/practice')
    }
  }

  function selectJuz(juzNumber) {
    const j = juzList.find((x) => x.juz === Number(juzNumber))
    if (!j) return
    navigateTo(j.start_surah, j.start_ayah, `Juz ${juzNumber} starts here`)
  }

  return (
    <div className={`app${menuCollapsed ? ' app--menu-collapsed' : ''}`}>
      <Sidebar
        currentSurah={surah}
        currentAyah={ayah}
        onSelectSurah={(n, a = 1) => navigateTo(n, a)}
        onSelectJuz={selectJuz}
        mobileOpen={mobileOpen}
        onCloseMobile={onCloseMobile}
        menuCollapsed={menuCollapsed}
        onCollapseMainMenu={() => setMenuCollapsed(true)}
      />
      <main className="main">
        <Outlet
          context={{
            surah,
            ayah,
            rangeNote,
            onNavigate: navigateTo,
            menuCollapsed,
            onMenuToggle: handleMenuToggle,
          }}
        />
      </main>
    </div>
  )
}
