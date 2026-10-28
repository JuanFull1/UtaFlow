
import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../../context/AuthContext.js'
import { supportedRoles } from '../../routes/accessPolicy.js'
import LoadingScreen from '../common/LoadingScreen.jsx'

export default function ProtectedRoute({
  allowedRoles = supportedRoles,
}) {
  const { usuario, status, expiresAt } = useAuth()

  // Mostrar carga solo cuando todavía no conocemos al usuario.
  // Si ya existe una sesión, no desmontar sus formularios
  // durante la verificación en segundo plano.
  if (status === 'verifying' && !usuario) {
    return <LoadingScreen />
  }

  if (!usuario || expiresAt <= 0) {
    return <Navigate to="/login" replace />
  }

  if (
    status === 'forbidden' ||
    !allowedRoles.includes(usuario.rol)
  ) {
    return <Navigate to="/acceso-denegado" replace />
  }

  return <Outlet />
}
