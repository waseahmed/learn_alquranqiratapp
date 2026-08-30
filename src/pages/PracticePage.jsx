import { Navigate, useOutletContext } from 'react-router-dom'
import PracticePageView from './PracticePageView.jsx'

export default function PracticePage() {
  const ctx = useOutletContext()
  if (!ctx) return <Navigate to="/practice" replace />
  return (
    <PracticePageView
      surah={ctx.surah}
      ayah={ctx.ayah}
      rangeNote={ctx.rangeNote}
      onNavigate={ctx.onNavigate}
      onMenuToggle={ctx.onMenuToggle}
    />
  )
}
