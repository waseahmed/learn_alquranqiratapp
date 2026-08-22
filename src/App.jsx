import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { AuthLoader } from './components/Auth/AuthLoader'
import AppLayout from './components/Layout/AppLayout'
import LoginPage from './pages/LoginPage'
import PracticePage from './pages/PracticePage'
import HowToImitatePage from './pages/HowToImitatePage'
import CommonMistakesPage from './pages/CommonMistakesPage'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <AuthLoader />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <AuthLoader />
  if (user) return <Navigate to="/practice" replace />
  return children
}

export default function App() {
  const { loading } = useAuth()

  if (loading) {
    return <AuthLoader />
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/practice" replace />} />
        <Route path="practice" element={<PracticePage />} />
        <Route path="how-to-imitate" element={<HowToImitatePage />} />
        <Route path="common-mistakes" element={<CommonMistakesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
