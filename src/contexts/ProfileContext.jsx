import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useAuth } from './AuthContext'
import { DEFAULT_SELECTED_QARIS } from '../data/qaris'
import {
  DEFAULT_THEME,
  DEFAULT_SIDEBAR,
  applyTheme,
  fetchPreferences,
  fetchBookmarks,
  savePreferences,
  updateProfileBasics,
  uploadAvatar,
  addBookmark,
  removeBookmark,
  removeBookmarkByTarget,
} from '../services/profileService'

const ProfileContext = createContext(null)

export function ProfileProvider({ children }) {
  const { user, profile, refreshProfile } = useAuth()
  const [preferences, setPreferences] = useState(null)
  const [bookmarks, setBookmarks] = useState([])
  const [loadingPrefs, setLoadingPrefs] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const loadAll = useCallback(async () => {
    if (!user?.id) {
      setPreferences(null)
      setBookmarks([])
      applyTheme(DEFAULT_THEME)
      return
    }
    setLoadingPrefs(true)
    const [prefs, marks] = await Promise.all([
      fetchPreferences(user.id),
      fetchBookmarks(user.id),
    ])
    setPreferences(
      prefs || {
        user_id: user.id,
        qari_order: [...DEFAULT_SELECTED_QARIS],
        theme: { ...DEFAULT_THEME },
        sidebar: { ...DEFAULT_SIDEBAR },
      },
    )
    setBookmarks(marks)
    applyTheme(prefs?.theme || DEFAULT_THEME)
    setLoadingPrefs(false)
  }, [user?.id])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const qariOrder = preferences?.qari_order || DEFAULT_SELECTED_QARIS
  const theme = preferences?.theme || DEFAULT_THEME
  const sidebar = preferences?.sidebar || DEFAULT_SIDEBAR

  const persistPrefs = useCallback(
    async (patch) => {
      if (!user?.id) return { error: new Error('Not signed in') }
      setSaving(true)
      setMessage('')
      const payload = {
        qari_order: patch.qari_order ?? qariOrder,
        theme: patch.theme ?? theme,
        sidebar: patch.sidebar ?? sidebar,
      }
      const { data, error } = await savePreferences(user.id, payload)
      setSaving(false)
      if (error) {
        setMessage(error.message)
        return { error }
      }
      setPreferences(data)
      if (patch.theme) applyTheme(data.theme)
      setMessage('Saved')
      return { data }
    },
    [user?.id, qariOrder, theme, sidebar],
  )

  const setQariOrder = useCallback(
    (order) => persistPrefs({ qari_order: order }),
    [persistPrefs],
  )

  const setTheme = useCallback(
    (nextTheme) => persistPrefs({ theme: nextTheme }),
    [persistPrefs],
  )

  const setSidebar = useCallback(
    (nextSidebar) => persistPrefs({ sidebar: nextSidebar }),
    [persistPrefs],
  )

  const saveDisplayName = useCallback(
    async (displayName) => {
      if (!user?.id) return { error: new Error('Not signed in') }
      if ((profile?.role || 'student') === 'student') {
        const error = new Error('Students cannot change their display name.')
        setMessage(error.message)
        return { error }
      }
      setSaving(true)
      const { data, error } = await updateProfileBasics(user.id, {
        display_name: displayName.trim(),
      })
      setSaving(false)
      if (error) {
        setMessage(error.message)
        return { error }
      }
      await refreshProfile?.()
      setMessage('Profile updated')
      return { data }
    },
    [user?.id, profile?.role, refreshProfile],
  )

  const saveAvatar = useCallback(
    async (file) => {
      if (!user?.id) return { error: new Error('Not signed in') }
      setSaving(true)
      const { data, error } = await uploadAvatar(user.id, file)
      setSaving(false)
      if (error) {
        setMessage(error.message)
        return { error }
      }
      await refreshProfile?.()
      setMessage('Photo updated')
      return { data }
    },
    [user?.id, refreshProfile],
  )

  const toggleAyahBookmark = useCallback(
    async (surah, ayah) => {
      if (!user?.id) return
      const existing = bookmarks.find(
        (b) => b.kind === 'ayah' && b.surah === Number(surah) && b.ayah === Number(ayah),
      )
      if (existing) {
        await removeBookmark(user.id, existing.id)
        setBookmarks((prev) => prev.filter((b) => b.id !== existing.id))
        return
      }
      const { data, error } = await addBookmark(user.id, {
        kind: 'ayah',
        surah,
        ayah,
      })
      if (!error && data) setBookmarks((prev) => [data, ...prev])
    },
    [user?.id, bookmarks],
  )

  const toggleSurahBookmark = useCallback(
    async (surah) => {
      if (!user?.id) return
      const existing = bookmarks.find(
        (b) => b.kind === 'surah' && b.surah === Number(surah),
      )
      if (existing) {
        await removeBookmark(user.id, existing.id)
        setBookmarks((prev) => prev.filter((b) => b.id !== existing.id))
        return
      }
      const { data, error } = await addBookmark(user.id, {
        kind: 'surah',
        surah,
      })
      if (!error && data) setBookmarks((prev) => [data, ...prev])
    },
    [user?.id, bookmarks],
  )

  const deleteBookmark = useCallback(
    async (bookmarkId) => {
      if (!user?.id) return
      await removeBookmark(user.id, bookmarkId)
      setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId))
    },
    [user?.id],
  )

  const isAyahBookmarked = useCallback(
    (surah, ayah) =>
      bookmarks.some(
        (b) => b.kind === 'ayah' && b.surah === Number(surah) && b.ayah === Number(ayah),
      ),
    [bookmarks],
  )

  const isSurahBookmarked = useCallback(
    (surah) => bookmarks.some((b) => b.kind === 'surah' && b.surah === Number(surah)),
    [bookmarks],
  )

  const value = useMemo(
    () => ({
      preferences,
      qariOrder,
      theme,
      sidebar,
      bookmarks,
      loadingPrefs,
      saving,
      message,
      setMessage,
      setQariOrder,
      setTheme,
      setSidebar,
      saveDisplayName,
      saveAvatar,
      toggleAyahBookmark,
      toggleSurahBookmark,
      deleteBookmark,
      isAyahBookmarked,
      isSurahBookmarked,
      reload: loadAll,
      removeBookmarkByTarget,
    }),
    [
      preferences,
      qariOrder,
      theme,
      sidebar,
      bookmarks,
      loadingPrefs,
      saving,
      message,
      setQariOrder,
      setTheme,
      setSidebar,
      saveDisplayName,
      saveAvatar,
      toggleAyahBookmark,
      toggleSurahBookmark,
      deleteBookmark,
      isAyahBookmarked,
      isSurahBookmarked,
      loadAll,
    ],
  )

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  )
}

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider')
  return ctx
}
