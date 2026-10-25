import LoginBranding from '../../components/auth/LoginBranding.jsx'
import { useAuth } from '../../context/AuthContext.js'
import './Login.css'

export default function Authenticated() {
  const { usuario, logout } = useAuth()

  return (
    <main className="login-page container-fluid">
      <section className="card border-0 shadow-sm p-4 p-md-5" aria-labelledby="welcome-title">
        <LoginBranding />
        <header className="login-intro">
          <h1 id="welcome-title">Bienvenido, {usuario.nombre}</h1>
          <p role="status">Has iniciado sesión correctamente en UtaFlow.</p>
        </header>
        <dl className="mt-4 mb-0">
          <dt>Nombre</dt><dd>{usuario.nombre}</dd>
          <dt>Correo electrónico</dt><dd className="text-break">{usuario.correo}</dd>
          <dt>Rol</dt><dd>{usuario.rol}</dd>
        </dl>
        <button type="button" className="login-submit btn btn-primary" onClick={logout}>Cerrar sesión</button>
      </section>
    </main>
  )
}
