import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../../context/AuthContext.js'
import { supportedRoles } from '../../routes/accessPolicy.js'
import LoadingScreen from '../common/LoadingScreen.jsx'

export default function ProtectedRoute({ allowedRoles = supportedRoles }) {
  const { usuario, status, expiresAt } = useAuth()
  if (status === 'verifying') return <LoadingScreen />
  if (!usuario || expiresAt <= 0) return <Navigate to="/login" replace />
  if (status === 'forbidden' || !allowedRoles.includes(usuario.rol)) {
    return <Navigate to="/acceso-denegado" replace />
  }
  return <Outlet />
}
