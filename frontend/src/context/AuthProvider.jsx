import { useEffect, useLayoutEffect, useSyncExternalStore } from 'react'
import { AuthContext } from './AuthContext.js'
import { useLocation, useNavigate } from 'react-router'
import { authService } from '../services/authService.js'

export default function AuthProvider({ children }) {
  const session = useSyncExternalStore(authService.subscribe, authService.getSnapshot)
  const location = useLocation()
  const navigate = useNavigate()

  useLayoutEffect(() => {
    authService.checkExpiration()
  }, [location.key])

  useEffect(() => {
    if (session.status === 'anonymous' && session.notice) navigate('/login', { replace: true })
  }, [session.status, session.notice, navigate])

  useEffect(() => {
    // Timers may be suspended while a tab is in the background.
    function revalidate() {
      authService.checkExpiration()
      if (document.visibilityState === 'visible' && authService.getSnapshot().usuario) {
        void authService.getCurrentUser().catch(() => {})
      }
    }
    window.addEventListener('focus', revalidate)
    document.addEventListener('visibilitychange', revalidate)
    return () => {
      window.removeEventListener('focus', revalidate)
      document.removeEventListener('visibilitychange', revalidate)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ ...session, login: authService.login, logout: authService.logout, verifySession: authService.getCurrentUser }}>
      {children}
    </AuthContext.Provider>
  )
}
