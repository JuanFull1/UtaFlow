import { Navigate, Route, Routes } from 'react-router'

import { useAuth } from '../context/AuthContext.js'

import ProtectedRoute from '../components/auth/ProtectedRoute.jsx'
import LoadingScreen from '../components/common/LoadingScreen.jsx'

import Login from '../pages/auth/Login.jsx'
import Authenticated from '../pages/auth/Authenticated.jsx'

import Administracion from '../pages/admin/Administracion.jsx'

import AccessDenied from '../pages/errors/AccessDenied.jsx'
import NotFound from '../pages/errors/NotFound.jsx'

import SolicitudPublica from '../pages/public/SolicitudPublica.jsx'
import SeguimientoPublico from '../pages/public/SeguimientoPublico.jsx'

import { homeForRole } from './accessPolicy.js'

// =====================================================
// LOGIN
// =====================================================

function LoginRoute() {
  const { usuario, status, expiresAt } = useAuth()

  if (usuario && status === 'verifying') {
    return <LoadingScreen />
  }

  if (usuario && expiresAt > 0) {
    return (
      <Navigate
        to={
          status === 'forbidden'
            ? '/acceso-denegado'
            : homeForRole(usuario.rol)
        }
        replace
      />
    )
  }

  return <Login />
}

// =====================================================
// REDIRECCION AL PANEL SEGUN ROL
// =====================================================

function AppHome() {
  const { usuario } = useAuth()

  return (
    <Navigate
      to={homeForRole(usuario.rol)}
      replace
    />
  )
}

// =====================================================
// TODAS LAS RUTAS
// =====================================================

export default function AppRoutes() {
  return (
    <Routes>
      {/* Página inicial */}
      <Route
        path="/"
        element={<Navigate to="/login" replace />}
      />

      {/* Acceso */}
      <Route
        path="/login"
        element={<LoginRoute />}
      />

      {/* Formularios públicos */}
      <Route
        path="/solicitud"
        element={<SolicitudPublica />}
      />

      <Route
        path="/seguimiento"
        element={<SeguimientoPublico />}
      />

      {/* Todos los usuarios internos autenticados */}
      <Route
        path="/app"
        element={<ProtectedRoute />}
      >
        <Route
          index
          element={<AppHome />}
        />

        {/* Panel del EXPERTO */}
        <Route
          element={
            <ProtectedRoute
              allowedRoles={['EXPERTO']}
            />
          }
        >
          <Route
            path="experto"
            element={<Authenticated />}
          />
        </Route>

        {/* Panel del COMITÉ */}
        <Route
          element={
            <ProtectedRoute
              allowedRoles={['COMITE']}
            />
          }
        >
          <Route
            path="comite"
            element={<Authenticated />}
          />
        </Route>

        {/* Nuevo panel del ADMIN */}
        <Route
          element={
            <ProtectedRoute
              allowedRoles={['ADMIN']}
            />
          }
        >
          <Route
            path="admin"
            element={<Administracion />}
          />
        </Route>

        <Route
          path="usuario"
          element={<AccessDenied />}
        />

        <Route
          path="*"
          element={<NotFound />}
        />
      </Route>

      <Route
        path="/acceso-denegado"
        element={<AccessDenied />}
      />

      <Route
        path="*"
        element={<NotFound />}
      />
    </Routes>
  )
}