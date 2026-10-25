import { useEffect, useSyncExternalStore } from 'react'
import { AuthContext } from './AuthContext.js'
import { authService } from '../services/authService.js'

export default function AuthProvider({ children }) {
  const session = useSyncExternalStore(authService.subscribe, authService.getSnapshot)

  useEffect(() => {
    // Timers may be suspended while a tab is in the background.
    window.addEventListener('focus', authService.checkExpiration)
    document.addEventListener('visibilitychange', authService.checkExpiration)
    return () => {
      window.removeEventListener('focus', authService.checkExpiration)
      document.removeEventListener('visibilitychange', authService.checkExpiration)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ ...session, login: authService.login, logout: authService.logout }}>
      {children}
    </AuthContext.Provider>
  )
}
