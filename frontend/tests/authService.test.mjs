import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, mock, test } from 'node:test'

const source = await readFile(new URL('../src/services/authService.js', import.meta.url), 'utf8')
// Vite supplies import.meta.env in the browser; only substitute its public URL in this test module.
async function loadService(baseUrl = 'https://api.example.invalid') {
  const testSource = source.replace('import.meta.env?.VITE_API_BASE_URL', JSON.stringify(baseUrl))
  return (await import(`data:text/javascript;base64,${Buffer.from(`${testSource}\n// ${randomUUID()}`).toString('base64')}`)).authService
}
const service = await loadService()
const credentials = { correo: ' prueba@example.invalid ', contrasena: ` ${randomUUID()} ` }
const usuario = { id: 1, nombre: 'Cuenta de prueba', correo: 'prueba@example.invalid', rol: 'EXPERTO' }
let fetchMock

// Synthetic JWTs exist exclusively in these HTTP doubles; /me is also mocked.
function jwt(exp = Math.floor(Date.now() / 1000) + 900) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'HS256' })}.${encode({ exp })}.${Buffer.from(randomUUID()).toString('base64url')}`
}
function respond(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
function queue(...responses) {
  fetchMock.mock.mockImplementation(async () => {
    assert.ok(responses.length, 'Solicitud HTTP inesperada')
    const response = responses.shift()
    if (response instanceof Error) throw response
    return response
  })
}
function loginResponses(user = usuario, accessToken = jwt()) {
  queue(respond({ token: accessToken, usuario: user }), respond(user))
  return accessToken
}

describe('authService', () => {
beforeEach(() => {
  service.logout()
  fetchMock = mock.method(globalThis, 'fetch', async () => { throw new Error('Sin respuesta de prueba') })
})
afterEach(() => {
  service.logout()
  mock.restoreAll()
})

test('solo publica la identidad después de /me; envía el contrato y Bearer sin transformar la contraseña', async () => {
  const accessToken = jwt()
  let resolveMe
  fetchMock.mock.mockImplementation(async (url) => {
    if (url.endsWith('/login')) return respond({ token: accessToken, usuario })
    return new Promise((resolve) => { resolveMe = resolve })
  })
  const pending = service.login(credentials)
  while (!resolveMe) await new Promise((resolve) => setImmediate(resolve))
  assert.equal(service.getSnapshot().usuario, null)
  resolveMe(respond(usuario))
  assert.deepEqual(await pending, usuario)
  assert.deepEqual(service.getSnapshot().usuario, usuario)
  assert.equal('token' in service.getSnapshot(), false)
  const [loginCall, meCall] = fetchMock.mock.calls
  assert.equal(loginCall.arguments[0], 'https://api.example.invalid/api/auth/login')
  assert.deepEqual(JSON.parse(loginCall.arguments[1].body), { correo: credentials.correo.trim(), contrasena: credentials.contrasena })
  assert.equal(loginCall.arguments[1].method, 'POST')
  assert.equal(meCall.arguments[1].headers.Authorization, `Bearer ${accessToken}`)
  assert.equal(meCall.arguments[1].method, 'GET')
  assert.equal(meCall.arguments[1].cache, 'no-store')
  assert.equal(meCall.arguments[1].credentials, 'omit')
})

for (const rol of ['EXPERTO', 'COMITE', 'ADMIN']) {
  test(`acepta el rol ${rol} obtenido de /me`, async () => {
    loginResponses({ ...usuario, rol })
    assert.equal((await service.login(credentials)).rol, rol)
  })
}

for (const [status, fragment] of [[400, 'Revisa'], [401, 'incorrectos'], [403, 'autorizar'], [429, 'demasiados intentos'], [500, 'Ocurrió un problema'], [503, 'Ocurrió un problema']]) {
  test(`HTTP ${status}: mensaje controlado sin filtrar el cuerpo del servidor`, async () => {
    queue(respond({ title: 'SQL: detalle interno sensible' }, status))
    await assert.rejects(service.login(credentials), (error) => error.status === status && error.message.includes(fragment) && !error.message.includes('SQL'))
    assert.equal(service.getSnapshot().usuario, null)
    assert.equal(fetchMock.mock.callCount(), 1)
  })
}

test('distingue un fallo de red de un error HTTP', async () => {
  queue(new TypeError('Failed to fetch'))
  await assert.rejects(service.login(credentials), { code: 'NETWORK', status: 0 })
})

for (const result of [null, {}, { token: 'inválido', usuario }, { token: jwt() }, { token: jwt(), usuario: { ...usuario, rol: '' } }]) {
  test(`rechaza una respuesta de login insuficiente (${JSON.stringify(result?.usuario?.rol ?? typeof result?.token)})`, async () => {
    queue(respond(result))
    await assert.rejects(service.login(credentials), { code: 'INVALID_RESPONSE' })
    assert.equal(service.getSnapshot().usuario, null)
  })
}

test('rechaza JSON malformado en una respuesta HTTP exitosa', async () => {
  queue(new Response('<html>Error</html>', { status: 200 }))
  await assert.rejects(service.login(credentials), { code: 'INVALID_RESPONSE' })
})

for (const change of [{ id: 2 }, { correo: 'otra@example.invalid' }, { rol: 'ADMIN' }, { nombre: 'Otra identidad' }]) {
  test(`rechaza discrepancias entre login y /me: ${Object.keys(change)[0]}`, async () => {
    queue(respond({ token: jwt(), usuario }), respond({ ...usuario, ...change }))
    await assert.rejects(service.login(credentials), { code: 'IDENTITY_MISMATCH' })
    assert.equal(service.getSnapshot().usuario, null)
  })
}

test('rechaza /me con 401 antes de autenticar', async () => {
  queue(respond({ token: jwt(), usuario }), respond({}, 401))
  await assert.rejects(service.login(credentials), { status: 401 })
  assert.equal(service.getSnapshot().usuario, null)
})

test('rechaza JWT vencido antes de consultar /me', async () => {
  queue(respond({ token: jwt(Math.floor(Date.now() / 1000) - 1), usuario }))
  await assert.rejects(service.login(credentials), { code: 'EXPIRED' })
  assert.equal(fetchMock.mock.callCount(), 1)
})

test('comparte la solicitud pendiente ante envíos duplicados', async () => {
  loginResponses()
  const first = service.login(credentials)
  const second = service.login(credentials)
  assert.equal(first, second)
  await first
  assert.equal(fetchMock.mock.callCount(), 2)
})

test('logout descarta token e identidad sin llamar un endpoint de logout', async () => {
  loginResponses()
  await service.login(credentials)
  service.logout()
  assert.equal(service.getSnapshot().usuario, null)
  await assert.rejects(service.getCurrentUser(), { code: 'EXPIRED' })
  assert.equal(fetchMock.mock.callCount(), 2)
})

test('un 401 posterior en /me limpia la sesión y comunica su expiración', async () => {
  loginResponses()
  await service.login(credentials)
  queue(respond({}, 401))
  await assert.rejects(service.getCurrentUser(), { status: 401 })
  assert.equal(service.getSnapshot().usuario, null)
  assert.match(service.getSnapshot().notice, /ha expirado/)
})

test('al recuperar una pestaña vencida descarta la sesión sin enviar el JWT', async () => {
  const now = Date.now()
  loginResponses(usuario, jwt(Math.floor(now / 1000) + 60))
  await service.login(credentials)
  mock.method(Date, 'now', () => now + 61000)
  service.checkExpiration()
  assert.equal(service.getSnapshot().usuario, null)
  assert.match(service.getSnapshot().notice, /ha expirado/)
  assert.equal(fetchMock.mock.callCount(), 2)
})

test('logout cancela un login pendiente y una respuesta tardía no restaura la sesión', async () => {
  let resolveMe
  fetchMock.mock.mockImplementation(async (url) => url.endsWith('/login')
    ? respond({ token: jwt(), usuario })
    : new Promise((resolve) => { resolveMe = resolve }))
  const pending = service.login(credentials)
  while (!resolveMe) await new Promise((resolve) => setImmediate(resolve))
  service.logout()
  assert.equal(fetchMock.mock.calls[1].arguments[1].signal.aborted, true)
  resolveMe(respond(usuario))
  await assert.rejects(pending, { code: 'CANCELLED' })
  assert.equal(service.getSnapshot().usuario, null)
})

test('una nueva instancia de la aplicación no restaura la sesión', async () => {
  loginResponses()
  await service.login(credentials)
  const reloaded = await loadService()
  assert.equal(reloaded.getSnapshot().usuario, null)
})

test('falta de VITE_API_BASE_URL produce un error de configuración', async () => {
  const unconfigured = await loadService('')
  await assert.rejects(unconfigured.login(credentials), { code: 'CONFIGURATION' })
  assert.equal(fetchMock.mock.callCount(), 0)
})

test('publica estado de verificación hasta que /me confirme el acceso', async () => {
  loginResponses()
  const pending = service.login(credentials)
  assert.equal(service.getSnapshot().status, 'verifying')
  assert.equal(service.getSnapshot().usuario, null)
  await pending
  assert.equal(service.getSnapshot().status, 'authenticated')
  assert.ok(service.getSnapshot().expiresAt > Date.now())
})

test('403 en /me conserva la identidad y el token, pero bloquea las rutas privadas', async () => {
  const accessToken = loginResponses()
  await service.login(credentials)
  queue(respond({}, 403))
  await assert.rejects(service.getCurrentUser(), { status: 403 })
  assert.deepEqual(service.getSnapshot().usuario, usuario)
  assert.equal(service.getSnapshot().status, 'forbidden')
  assert.doesNotMatch(service.getSnapshot().notice, /expirado/)
  queue(respond(usuario))
  await service.getCurrentUser()
  assert.equal(fetchMock.mock.calls.at(-1).arguments[1].headers.Authorization, `Bearer ${accessToken}`)
  assert.equal(service.getSnapshot().status, 'authenticated')
})

for (const failure of [new TypeError('offline'), respond({}, 503)]) {
  test(`una interrupción temporal conserva la sesión (${failure instanceof Error ? 'red' : '503'})`, async () => {
    loginResponses()
    await service.login(credentials)
    queue(failure)
    await assert.rejects(service.getCurrentUser())
    assert.deepEqual(service.getSnapshot().usuario, usuario)
    assert.equal(service.getSnapshot().status, 'authenticated')
    assert.ok(service.getSnapshot().notice)
  })
}

test('un fallo de red no restaura permisos después de un 403', async () => {
  loginResponses()
  await service.login(credentials)
  queue(respond({}, 403))
  await assert.rejects(service.getCurrentUser())
  queue(new TypeError('offline'))
  await assert.rejects(service.getCurrentUser())
  assert.equal(service.getSnapshot().status, 'forbidden')
})

test('dos verificaciones concurrentes comparten una sola petición a /me', async () => {
  loginResponses()
  await service.login(credentials)
  queue(respond(usuario))
  const first = service.getCurrentUser()
  assert.equal(service.getSnapshot().status, 'verifying')
  assert.equal(first, service.getCurrentUser())
  await first
  assert.equal(fetchMock.mock.callCount(), 3)
})

test('logout durante una reverificación impide restaurar la sesión', async () => {
  loginResponses()
  await service.login(credentials)
  let resolveMe
  fetchMock.mock.mockImplementation(() => new Promise((resolve) => { resolveMe = resolve }))
  const pending = service.getCurrentUser()
  service.logout()
  resolveMe(respond(usuario))
  await assert.rejects(pending, { code: 'CANCELLED' })
  assert.equal(service.getSnapshot().status, 'anonymous')
  assert.equal(service.getSnapshot().expiresAt, 0)
})

test('un rol desconocido solo se conserva tras verificar la identidad completa con /me', async () => {
  const limitedUser = { ...usuario, rol: 'ROL_DESCONOCIDO' }
  loginResponses(limitedUser)
  assert.deepEqual(await service.login(credentials), limitedUser)
  assert.equal(fetchMock.mock.callCount(), 2)
})
})
