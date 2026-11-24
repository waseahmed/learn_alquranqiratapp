import { Link, Navigate } from 'react-router-dom'
import { APP_NAME, APP_TAGLINE } from '../../config'
import LiveAdminAnalysisPanel from '../../components/live/LiveAdminAnalysisPanel'
import { supabaseConfigured } from '../../services/supabase'

const PIN_STORAGE_KEY = 'aqqa_live_admin_pin'

export default function LiveAdminAnalysisPage() {
  const pin = (() => {
    try {
      return sessionStorage.getItem(PIN_STORAGE_KEY) || ''
    } catch {
      return ''
    }
  })()

  if (pin) {
    return <Navigate to="/live/admin" replace state={{ tab: 'analysis' }} />
  }

  return (
    <div className="login-page live-page live-page--admin-wide">
      <div className="login-card live-card live-card--admin live-card--analysis">
        <img
          src={`${import.meta.env.BASE_URL}aqqa-logo.png`}
          alt="Al Quran Qirat Academy"
          className="login-logo"
        />
        <h1 className="login-brand">{APP_NAME}</h1>
        <p className="login-tagline">{APP_TAGLINE}</p>
        <h2 className="login-portal">Live session — Analysis</h2>

        {!supabaseConfigured && (
          <p className="login-error" role="alert">
            Live session is not configured on this server yet.
          </p>
        )}

        <p className="live-muted">
          Open <Link to="/live/admin">admin controls</Link> and enter the host PIN to view analysis
          in the Analysis tab.
        </p>
      </div>
    </div>
  )
}