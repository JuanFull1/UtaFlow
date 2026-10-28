import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../context/AuthContext.js'
import { homeForRole } from '../../routes/accessPolicy.js'
import LoadingScreen from '../../components/common/LoadingScreen.jsx'

export default function AccessDenied() {
  const { usuario, status, notice, logout, verifySession } = useAuth()
  const navigate = useNavigate()
  const home = homeForRole(usuario?.rol)

  async function retry() {
    try {
      await verifySession()
      navigate(home, { replace: true })
    } catch {
      // The service publishes a safe message and handles 401 separately from 403.
    }
  }

  if (status === 'verifying') return <LoadingScreen />
  return (
    <main className="login-page container-fluid">
      <section className="card border-0 shadow-sm p-4 p-md-5" aria-labelledby="denied-title">
        <h1 id="denied-title">Acceso denegado</h1>
        <p>Esta sección no está habilitada para tu cuenta.</p>
        {notice && <p role="status">{notice}</p>}
        {(!usuario || home !== '/acceso-denegado') && (usuario && status === 'forbidden'
          ? <button className="btn btn-primary" type="button" onClick={retry}>Verificar acceso</button>
          : <Link to={usuario ? home : '/login'} replace className="btn btn-primary">
              {usuario ? 'Volver al inicio' : 'Ir al inicio de sesión'}
            </Link>)}
        {usuario && <button type="button" className="btn btn-outline-secondary mt-3" onClick={() => {
          logout()
          navigate('/login', { replace: true })
        }}>Cerrar sesión</button>}
      </section>
    </main>
  )
}
