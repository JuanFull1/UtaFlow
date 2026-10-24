import { useRef, useState } from 'react'
import AuthIcon from '../../components/auth/AuthIcon.jsx'
import LoginBranding from '../../components/auth/LoginBranding.jsx'
import LoginShowcase from '../../components/auth/LoginShowcase.jsx'
import './Login.css'

function validate(values) {
  const errors = {}
  if (!values.correo.trim()) errors.correo = 'Ingresa tu correo corporativo.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.correo.trim())) errors.correo = 'Ingresa un correo electrónico válido.'
  else if (values.correo.trim().length > 200) errors.correo = 'El correo no debe superar los 200 caracteres.'
  if (!values.contrasena) errors.contrasena = 'Ingresa tu contraseña.'
  else if (values.contrasena.length > 128) errors.contrasena = 'La contraseña no debe superar los 128 caracteres.'
  return errors
}

function SecurityFooter() {
  return (
    <footer className="security-footer">
      <ul className="security-tags list-unstyled d-flex flex-wrap">
        <li><AuthIcon name="shield" />Acceso protegido</li>
        <li><AuthIcon name="badge" />Autenticación JWT</li>
        <li><AuthIcon name="lock" />Control de roles</li>
      </ul>
      <p>Acceso mediante autenticación segura y permisos según el rol del usuario.</p>
    </footer>
  )
}

export default function Login() {
  const [values, setValues] = useState({ correo: '', contrasena: '' })
  const [errors, setErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [notice, setNotice] = useState('')
  const correoRef = useRef(null)
  const passwordRef = useRef(null)

  function updateField(event) {
    const { name, value } = event.target
    setValues((previous) => ({ ...previous, [name]: value }))
    setErrors((previous) => ({ ...previous, [name]: undefined }))
    setNotice('')
  }

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validate(values)
    setErrors(nextErrors)
    setNotice('')
    if (nextErrors.correo) correoRef.current.focus()
    else if (nextErrors.contrasena) passwordRef.current.focus()
    else setNotice('La conexión con el servidor se implementará en la siguiente etapa. Aún no se ha iniciado ninguna sesión.')
  }

  return (
    <main className="login-page container-fluid">
      <div className="login-card row g-0">
        <section className="login-panel" aria-labelledby="login-title">
          <LoginBranding />
          <header className="login-intro">
            <h1 id="login-title">Bienvenido de nuevo</h1>
            <p>Ingresa con tus credenciales corporativas SSO o correo institucional.</p>
          </header>
          <div className="login-controls">
            <button type="button" className="sso-button btn d-flex align-items-center" aria-disabled="true"
              title="SSO empresarial: próximamente" aria-describedby="sso-help">
              <AuthIcon name="sso" /><span>Continuar con SSO Empresarial</span><span className="sso-protocol">SAML / OIDC</span>
            </button>
            <span id="sso-help" className="visually-hidden">Próximamente. El acceso SSO empresarial aún no está disponible.</span>
            <div className="email-divider d-flex align-items-center"><span />O INGRESA CON TU CORREO<span /></div>
            <form onSubmit={handleSubmit} noValidate aria-label="Inicio de sesión">
              <div className="login-field">
                <label htmlFor="correo" className="form-label">Correo corporativo</label>
                <div className={`input-shell ${errors.correo ? 'has-error' : ''}`}>
                  <AuthIcon name="at" />
                  <input ref={correoRef} id="correo" name="correo" type="email" className="form-control"
                    placeholder="usuario@empresa.com" autoComplete="username" autoCapitalize="none" spellCheck={false}
                    value={values.correo} onChange={updateField} required maxLength={200}
                    aria-invalid={Boolean(errors.correo)} aria-describedby={errors.correo ? 'correo-error' : undefined} />
                </div>
                {errors.correo && <p id="correo-error" className="field-error" role="alert">{errors.correo}</p>}
              </div>
              <div className="login-field password-field">
                <div className="password-label d-flex align-items-center justify-content-between">
                  <label htmlFor="contrasena" className="form-label">Contraseña</label>
                  <button type="button" className="forgot-password" aria-disabled="true"
                    title="Recuperación de contraseña: próximamente" aria-describedby="recovery-help">¿Olvidaste tu contraseña?</button>
                  <span id="recovery-help" className="visually-hidden">Próximamente. La recuperación de contraseña aún no está disponible.</span>
                </div>
                <div className={`input-shell ${errors.contrasena ? 'has-error' : ''}`}>
                  <AuthIcon name="lock" />
                  <input ref={passwordRef} id="contrasena" name="contrasena" type={showPassword ? 'text' : 'password'}
                    className="form-control" placeholder="••••••••••••" autoComplete="current-password"
                    value={values.contrasena} onChange={updateField} required maxLength={128}
                    aria-invalid={Boolean(errors.contrasena)} aria-describedby={errors.contrasena ? 'contrasena-error' : undefined} />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword((previous) => !previous)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPassword} aria-controls="contrasena">
                    <AuthIcon name={showPassword ? 'eyeOff' : 'eye'} />
                  </button>
                </div>
                {errors.contrasena && <p id="contrasena-error" className="field-error" role="alert">{errors.contrasena}</p>}
              </div>
              <div className="remember-session form-check" title="Próximamente, al integrar el servicio de autenticación">
                <input id="remember-session" className="form-check-input" type="checkbox" checked disabled aria-describedby="remember-help" />
                <label className="form-check-label" htmlFor="remember-session">Recordar esta sesión durante 30 días</label>
                <span id="remember-help" className="visually-hidden">Opción deshabilitada. Estará disponible cuando se integre el servicio de autenticación.</span>
              </div>
              <button type="submit" className="login-submit btn btn-primary d-flex align-items-center justify-content-center">
                Iniciar Sesión en UtaFlow<AuthIcon name="arrow" />
              </button>
              <div className="login-notice" role="status" aria-live="polite" aria-atomic="true">
                {notice && <p>{notice}</p>}
              </div>
            </form>
          </div>
          <SecurityFooter />
        </section>
        <LoginShowcase />
      </div>
    </main>
  )
}
