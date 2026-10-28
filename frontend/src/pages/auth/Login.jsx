import { useRef, useState } from 'react'
import AuthIcon from '../../components/auth/AuthIcon.jsx'
import LoginBranding from '../../components/auth/LoginBranding.jsx'
import LoginShowcase from '../../components/auth/LoginShowcase.jsx'
import { useAuth } from '../../context/AuthContext.js'
import { AuthError } from '../../services/authService.js'
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

export default function Login() {
  const { login, notice: sessionNotice } = useAuth()
  const [values, setValues] = useState({ correo: '', contrasena: '' })
  const [errors, setErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const correoRef = useRef(null)
  const passwordRef = useRef(null)

  function updateField(event) {
    const { name, value } = event.target
    setValues((previous) => ({ ...previous, [name]: value }))
    setErrors((previous) => ({ ...previous, [name]: undefined }))
    setNotice('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submittingRef.current) return
    const nextErrors = validate(values)
    setErrors(nextErrors)
    setNotice('')
    if (nextErrors.correo) correoRef.current.focus()
    else if (nextErrors.contrasena) passwordRef.current.focus()
    else {
      submittingRef.current = true
      setIsSubmitting(true)
      try {
        await login(values)
      } catch (error) {
        if (error.code !== 'CANCELLED') {
          setNotice(error instanceof AuthError ? error.message : 'Ocurrió un problema al iniciar sesión. Inténtalo nuevamente.')
        }
      } finally {
        setValues((previous) => ({ ...previous, contrasena: '' }))
        setShowPassword(false)
        submittingRef.current = false
        setIsSubmitting(false)
      }
    }
  }

  return (
    <main className="login-page container-fluid">
      <div className="login-card row g-0">
        <section className="login-panel" aria-labelledby="login-title">
          <LoginBranding />
          <header className="login-intro">
            <h1 id="login-title">Bienvenido</h1>
            <p>Inicia sesión para continuar</p>
          </header>
          <div className="login-controls">
            <form onSubmit={handleSubmit} noValidate aria-label="Inicio de sesión" aria-busy={isSubmitting}>
              <div className="login-field">
                <label htmlFor="correo" className="form-label">Correo</label>
                <div className={`input-shell ${errors.correo ? 'has-error' : ''}`}>
                  <svg className="auth-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></svg>
                  <input ref={correoRef} id="correo" name="correo" type="email" className="form-control"
                    placeholder="usuario@empresa.com" autoComplete="username" autoCapitalize="none" spellCheck={false}
                    value={values.correo} onChange={updateField} required maxLength={200} disabled={isSubmitting}
                    aria-invalid={Boolean(errors.correo)} aria-describedby={errors.correo ? 'correo-error' : undefined} />
                </div>
                {errors.correo && <p id="correo-error" className="field-error" role="alert">{errors.correo}</p>}
              </div>
              <div className="login-field password-field">
                <div className="password-label d-flex align-items-center justify-content-between">
                  <label htmlFor="contrasena" className="form-label">Contraseña</label>
                </div>
                <div className={`input-shell ${errors.contrasena ? 'has-error' : ''}`}>
                  <AuthIcon name="lock" />
                  <input ref={passwordRef} id="contrasena" name="contrasena" type={showPassword ? 'text' : 'password'}
                    className="form-control" placeholder="••••••••••••" autoComplete="current-password"
                    value={values.contrasena} onChange={updateField} required maxLength={128} disabled={isSubmitting}
                    aria-invalid={Boolean(errors.contrasena)} aria-describedby={errors.contrasena ? 'contrasena-error' : undefined} />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword((previous) => !previous)}
                    disabled={isSubmitting} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPassword} aria-controls="contrasena">
                    <AuthIcon name={showPassword ? 'eyeOff' : 'eye'} />
                  </button>
                </div>
                {errors.contrasena && <p id="contrasena-error" className="field-error" role="alert">{errors.contrasena}</p>}
              </div>
              <div className="remember-session form-check" title="No disponible. La sesión permanece en memoria y se pierde al recargar la página.">
                <input id="remember-session" className="form-check-input" type="checkbox" checked={false} disabled aria-describedby="remember-help" />
                <label className="form-check-label" htmlFor="remember-session">Recordarme</label>
                <span id="remember-help" className="visually-hidden">Opción no disponible. La sesión permanece en memoria hasta su vencimiento. Al recargar, debes volver a iniciar sesión.</span>
              </div>
              <button type="submit" className="login-submit btn btn-primary d-flex align-items-center justify-content-center" disabled={isSubmitting}>
                {isSubmitting && <span className="spinner-border spinner-border-sm" aria-hidden="true" />}
                {isSubmitting ? 'Iniciando sesión…' : 'Iniciar sesión'}<AuthIcon name="arrow" />
              </button>
              <div className="recovery-option">
                <button type="button" className="forgot-password" aria-disabled="true"
                  aria-describedby="recovery-help">¿Olvidaste tu contraseña?</button>
                <span id="recovery-help">Recuperación no disponible. Contacta al administrador.</span>
              </div>
              <div className="login-notice" role="status" aria-live="polite" aria-atomic="true">
                {(notice || sessionNotice) && <p>{notice || sessionNotice}</p>}
              </div>
            </form>
          </div>
        </section>
        <LoginShowcase />
      </div>
    </main>
  )
}
