import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { APP_NAME, APP_TAGLINE, PORTAL_NAME } from '../config'

export default function LoginPage() {
  const { user, loading, signIn, supabaseConfigured } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resetHint, setResetHint] = useState(false)

  if (!loading && user) {
    return <Navigate to="/practice" replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setResetHint(false)
    setSubmitting(true)
    const { error: signError } = await signIn(email, password)
    setSubmitting(false)
    if (signError) {
      setError(signError.message || 'Sign in failed. Please check your email and password.')
      return
    }
    navigate('/practice', { replace: true })
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <img
          src={`${import.meta.env.BASE_URL}aqqa-logo.png`}
          alt="Al Quran Qirat Academy"
          className="login-logo"
        />
        <h1 className="login-brand">{APP_NAME}</h1>
        <p className="login-tagline">{APP_TAGLINE}</p>
        <h2 className="login-portal">{PORTAL_NAME}</h2>
        <p className="login-motto">Listen • Imitate • Practice • Improve</p>

        {!supabaseConfigured && (
          <p className="login-error" role="alert">
            Supabase is not configured. Add VITE_SUPABASE_URL and
            VITE_SUPABASE_PUBLISHABLE_KEY to your environment.
          </p>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!supabaseConfigured || submitting}
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={!supabaseConfigured || submitting}
          />

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn primary login-submit"
            disabled={!supabaseConfigured || submitting}
          >
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <button
          type="button"
          className="login-forgot"
          onClick={() => setResetHint(true)}
        >
          Forgot Password?
        </button>
        {resetHint && (
          <p className="login-hint">
            Ask your academy teacher or administrator to reset your account
            password in Supabase.
          </p>
        )}
      </div>
    </div>
  )
}
