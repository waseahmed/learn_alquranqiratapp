import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { supabase, supabaseConfigured } from '../services/supabase'

const AuthContext = createContext(null)

async function fetchProfile(userId) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, role, active')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.warn('Could not load profile:', error.message)
    return null
  }
  return data
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    if (!supabaseConfigured || !supabase) {
      setLoading(false)
      return undefined
    }

    async function init() {
      try {
        const { data } = await supabase.auth.getSession()
        const sessionUser = data.session?.user ?? null
        if (!mounted) return
        setUser(sessionUser)
        if (sessionUser) {
          const p = await fetchProfile(sessionUser.id)
          if (mounted) setProfile(p)
        } else {
          setProfile(null)
        }
      } catch (err) {
        console.warn('Auth session check failed:', err?.message || err)
        if (mounted) {
          setUser(null)
          setProfile(null)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    init()

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const sessionUser = session?.user ?? null
        setUser(sessionUser)
        if (sessionUser) {
          const p = await fetchProfile(sessionUser.id)
          setProfile(p)
        } else {
          setProfile(null)
        }
        setLoading(false)
      },
    )

    return () => {
      mounted = false
      sub?.subscription?.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email, password) => {
    if (!supabase) {
      return { error: new Error('Supabase is not configured. Check environment variables.') }
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    return { data, error }
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }, [])

  const role = profile?.role ?? null
  const displayName =
    profile?.display_name ||
    user?.user_metadata?.display_name ||
    user?.email ||
    ''

  const value = useMemo(
    () => ({
      user,
      profile,
      role,
      displayName,
      loading,
      supabaseConfigured,
      signIn,
      signOut,
    }),
    [user, profile, role, displayName, loading, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
