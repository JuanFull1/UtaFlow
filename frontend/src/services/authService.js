const apiBaseUrl = (import.meta.env?.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')
const expiredMessage = 'Tu sesión ha expirado. Vuelve a iniciar sesión.'
const invalidResponse = 'No fue posible validar la sesión del servidor. Inténtalo nuevamente.'
let token = null
let expiresAt = 0
let expirationTimer
let pendingLogin = null
let pendingVerification = null
let generation = 0
let controller = new AbortController()
let snapshot = Object.freeze({ usuario: null, notice: '', status: 'anonymous', expiresAt: 0 })
const listeners = new Set()

export class AuthError extends Error {
  constructor(message, code, status = 0) {
    super(message)
    this.name = 'AuthError'
    this.code = code
    this.status = status
  }
}

function publish(usuario, notice = '', status = usuario ? 'authenticated' : 'anonymous') {
  snapshot = Object.freeze({ usuario: usuario ? Object.freeze({ ...usuario }) : null, notice, status, expiresAt })
  listeners.forEach((listener) => listener())
}

function clearSession(notice = '') {
  generation += 1
  controller.abort()
  controller = new AbortController()
  clearTimeout(expirationTimer)
  token = null
  expiresAt = 0
  pendingLogin = null
  pendingVerification = null
  publish(null, notice)
}

function checkExpiration() {
  if (token && Date.now() >= expiresAt) clearSession(expiredMessage)
}

function validateUsuario(usuario) {
  if (!usuario || !Number.isSafeInteger(usuario.id) || usuario.id <= 0 ||
    typeof usuario.nombre !== 'string' || !usuario.nombre.trim() ||
    typeof usuario.correo !== 'string' || !usuario.correo.trim() ||
    typeof usuario.rol !== 'string' || !usuario.rol.trim()) {
    throw new AuthError(invalidResponse, 'INVALID_RESPONSE')
  }
  return { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol }
}

function expirationFromJwt(value) {
  try {
    const parts = value.split('.')
    if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) throw new Error()
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (!Number.isSafeInteger(payload.exp) || payload.exp <= 0) throw new Error()
    return payload.exp * 1000
  } catch {
    throw new AuthError(invalidResponse, 'INVALID_RESPONSE')
  }
}

async function request(path, { accessToken, body, signal }) {
  if (!apiBaseUrl) {
    throw new AuthError('Configura VITE_API_BASE_URL para conectar con el servidor.', 'CONFIGURATION')
  }
  let response
  try {
    response = await fetch(`${apiBaseUrl}/api/auth/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : { Authorization: `Bearer ${accessToken}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
    })
  } catch {
    if (signal.aborted) throw new AuthError('Solicitud cancelada.', 'CANCELLED')
    throw new AuthError('No fue posible conectar con el servidor. Verifica tu conexión e inténtalo nuevamente.', 'NETWORK')
  }
  if (!response.ok) {
    const messages = {
      400: 'Revisa el correo y la contraseña e inténtalo nuevamente.',
      401: path === 'login' ? 'El correo o la contraseña son incorrectos.' : expiredMessage,
      403: 'No fue posible autorizar el acceso. Contacta al administrador.',
      429: 'Se realizaron demasiados intentos. Inténtalo nuevamente más tarde.',
    }
    // Never render server bodies: they may contain internal details.
    throw new AuthError(messages[response.status] ?? 'Ocurrió un problema al iniciar sesión. Inténtalo nuevamente.', 'HTTP', response.status)
  }
  try {
    return await response.json()
  } catch {
    if (signal.aborted) throw new AuthError('Solicitud cancelada.', 'CANCELLED')
    throw new AuthError(invalidResponse, 'INVALID_RESPONSE')
  }
}

async function authenticate(correo, contrasena, currentGeneration, signal) {
  const result = await request('login', { body: { correo: correo.trim(), contrasena }, signal })
  const loginUsuario = validateUsuario(result?.usuario)
  if (typeof result?.token !== 'string' || !result.token) throw new AuthError(invalidResponse, 'INVALID_RESPONSE')
  const expiration = expirationFromJwt(result.token)
  if (Date.now() >= expiration) throw new AuthError(expiredMessage, 'EXPIRED')
  const usuario = validateUsuario(await request('me', { accessToken: result.token, signal }))
  if (['id', 'correo', 'rol', 'nombre'].some((key) => usuario[key] !== loginUsuario[key])) {
    throw new AuthError(invalidResponse, 'IDENTITY_MISMATCH')
  }
  if (currentGeneration !== generation || signal.aborted) throw new AuthError('Solicitud cancelada.', 'CANCELLED')
  if (Date.now() >= expiration) throw new AuthError(expiredMessage, 'EXPIRED')
  token = result.token
  expiresAt = expiration
  expirationTimer = setTimeout(checkExpiration, Math.min(expiration - Date.now(), 2147483647))
  publish(usuario)
  return usuario
}

function login({ correo, contrasena }) {
  if (pendingLogin) return pendingLogin
  clearSession()
  const currentGeneration = generation
  publish(null, '', 'verifying')
  pendingLogin = authenticate(correo, contrasena, currentGeneration, controller.signal)
    .finally(() => {
      if (currentGeneration === generation) {
        pendingLogin = null
        if (!token) publish(null)
      }
    })
  return pendingLogin
}

async function verifyCurrentUser(previous, currentGeneration) {
  try {
    const usuario = validateUsuario(await request('me', { accessToken: token, signal: controller.signal }))
    if (generation !== currentGeneration) throw new AuthError('Solicitud cancelada.', 'CANCELLED')
    if (['id', 'correo', 'rol', 'nombre'].some((key) => usuario[key] !== previous.usuario[key])) {
      throw new AuthError(invalidResponse, 'IDENTITY_MISMATCH')
    }
    checkExpiration()
    if (!token) throw new AuthError(expiredMessage, 'EXPIRED')
    publish(usuario)
    return usuario
  } catch (error) {
    if (generation === currentGeneration) {
      if (error.status === 401 || error.code === 'INVALID_RESPONSE' || error.code === 'IDENTITY_MISMATCH') {
        clearSession(error.status === 401 ? expiredMessage : error.message)
      } else {
        // A forbidden response or a temporary outage does not invalidate the identity.
        const status = error.status === 403 || previous.status === 'forbidden' ? 'forbidden' : 'authenticated'
        publish(previous.usuario, error.message, status)
      }
    }
    throw error
  }
}

function getCurrentUser() {
  checkExpiration()
  if (!token) return Promise.reject(new AuthError(expiredMessage, 'EXPIRED'))
  if (pendingVerification) return pendingVerification
  const currentGeneration = generation
  const previous = snapshot
  publish(previous.usuario, '', 'verifying')
  pendingVerification = verifyCurrentUser(previous, currentGeneration).finally(() => {
    if (generation === currentGeneration) pendingVerification = null
  })
  return pendingVerification
}

export const authService = {
  login,
  getCurrentUser,
  logout: () => clearSession(),
  checkExpiration,
  getSnapshot: () => snapshot,
  subscribe: (listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}
