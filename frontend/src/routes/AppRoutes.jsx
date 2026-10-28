import { Navigate, Route, Routes } from 'react-router'
import { useAuth } from '../context/AuthContext.js'
import ProtectedRoute from '../components/auth/ProtectedRoute.jsx'
import LoadingScreen from '../components/common/LoadingScreen.jsx'
import Login from '../pages/auth/Login.jsx'
import Authenticated from '../pages/auth/Authenticated.jsx'
import AccessDenied from '../pages/errors/AccessDenied.jsx'
import NotFound from '../pages/errors/NotFound.jsx'
import { homeForRole } from './accessPolicy.js'

function LoginRoute() {
  const { usuario, status, expiresAt } = useAuth()
  if (usuario && status === 'verifying') return <LoadingScreen />
  if (usuario && expiresAt > 0) {
    return <Navigate to={status === 'forbidden' ? '/acceso-denegado' : homeForRole(usuario.rol)} replace />
  }
  return <Login />
}

function AppHome() {
  const { usuario } = useAuth()
  return usuario.rol === 'EXPERTO' ? <Navigate to="/app/experto" replace /> : <Authenticated />
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/app" element={<ProtectedRoute />}>
        <Route index element={<AppHome />} />
        <Route element={<ProtectedRoute allowedRoles={['EXPERTO']} />}>
          <Route path="experto" element={<Authenticated />} />
        </Route>
        {/* These sections remain disabled until the backend exposes their permissions. */}
        <Route element={<ProtectedRoute allowedRoles={[]} />}>
          <Route path="usuario" element={<AccessDenied />} />
          <Route path="comite" element={<AccessDenied />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="/acceso-denegado" element={<AccessDenied />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
