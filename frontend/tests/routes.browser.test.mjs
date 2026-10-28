import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { createServer } from 'vite'

const browser = process.env.UTAFLOW_TEST_BROWSER || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)
const root = fileURLToPath(new URL('..', import.meta.url))
const pause = (ms) => new Promise((resolvePause) => setTimeout(resolvePause, ms))

test('rutas y sesiones en navegador, con API simulada exclusivamente en la prueba', {
  skip: !browser && 'Configura UTAFLOW_TEST_BROWSER con un navegador Chromium para ejecutar esta prueba.',
  timeout: 90000,
}, async (t) => {
  const server = await createServer({ root, logLevel: 'silent', server: { host: '127.0.0.1', port: 0, strictPort: false } })
  const cacheRoot = resolve(root, 'node_modules/.cache')
  await mkdir(cacheRoot, { recursive: true })
  const profile = await mkdtemp(join(cacheRoot, 'utaflow-routing-'))
  let child
  let ws
  let command
  try {
    await server.listen()
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`
    child = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' })
    let launchError
    child.on('error', (error) => { launchError = error })
    let port
    for (let attempt = 0; attempt < 100; attempt++) {
      if (launchError) throw launchError
      try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break } catch { await pause(100) }
    }
    assert.ok(port, 'El navegador no publicó su puerto de depuración')
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    ws = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl)
    await new Promise((resolveOpen, reject) => {
      ws.addEventListener('open', resolveOpen, { once: true })
      ws.addEventListener('error', reject, { once: true })
    })
    let id = 0
    const pending = new Map()
    const consoleErrors = []
    ws.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data)
      if (message.method === 'Runtime.exceptionThrown') consoleErrors.push(message.params.exceptionDetails.text)
      if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
        consoleErrors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(' '))
      }
      if (!message.id) return
      const callback = pending.get(message.id)
      if (!callback) return
      pending.delete(message.id)
      message.error ? callback.reject(new Error(message.error.message)) : callback.resolve(message.result)
    })
    command = (method, params = {}) => new Promise((resolveCommand, reject) => {
      const key = ++id
      pending.set(key, { resolve: resolveCommand, reject })
      ws.send(JSON.stringify({ id: key, method, params }))
    })
    async function evaluate(expression) {
      const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
      return result.result.value
    }
    async function until(expression) {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (await evaluate(expression)) return
        await pause(75)
      }
      throw new Error(`La condición no se cumplió: ${expression}`)
    }
    async function navigate(path, reload = false) {
      if (reload) {
        await command('Page.navigate', { url: origin + path })
        await until('Boolean(window.__authTest && document.querySelector("h1"))')
      } else {
        await evaluate(`history.pushState(null,'',${JSON.stringify(path)});dispatchEvent(new PopStateEvent('popstate'))`)
      }
    }
    async function login(rol = 'EXPERTO', extra = {}) {
      await navigate('/login', true)
      await until('Boolean(document.querySelector("form"))')
      await evaluate(`Object.assign(window.__authTest,${JSON.stringify({ rol, ...extra })});
        (()=>{const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
        for(const [id,value] of [['correo','prueba@example.invalid'],['contrasena',crypto.randomUUID()]]){
          const el=document.getElementById(id);set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));
        }})();document.querySelector('form').requestSubmit()`)
    }
    await command('Page.enable')
    await command('Runtime.enable')
    // The production application is unchanged. Only this isolated browser replaces API responses.
    await command('Page.addScriptToEvaluateOnNewDocument', { source: `
      window.__authTest={rol:'EXPERTO',meStatus:200,meDelay:0,offline:false,calls:[]};
      const originalFetch=window.fetch;
      window.fetch=async(url,options)=>{
        if(!String(url).includes('/api/auth/'))return originalFetch(url,options);
        const test=window.__authTest;test.calls.push(String(url).split('/').pop());
        if(test.offline)throw new TypeError('Fallo de red exclusivo de la prueba');
        const user={id:1,nombre:'Cuenta de prueba',correo:'prueba@example.invalid',rol:test.rol};
        const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
        if(String(url).endsWith('/login')){
          const encode=value=>btoa(JSON.stringify(value)).replace(/=/g,'').replace(/\\+/g,'-').replace(/\\//g,'_');
          const token=encode({alg:'HS256'})+'.'+encode({exp:Math.floor(Date.now()/1000)+900})+'.'+btoa(crypto.randomUUID()).replace(/=/g,'');
          return json({token,usuario:user});
        }
        if(test.meDelay)await new Promise(resolve=>setTimeout(resolve,test.meDelay));
        return json(test.meStatus===200?user:{},test.meStatus);
      };
    ` })

    await t.test('sin sesión, /app y /app/experto redirigen a /login', async () => {
      for (const path of ['/app', '/app/experto']) {
        await navigate(path, true)
        await until('location.pathname==="/login" && Boolean(document.querySelector("form"))')
        assert.equal(await evaluate('Boolean(document.querySelector("#welcome-title"))'), false)
      }
    })
    await t.test('EXPERTO entra tras /me; no se muestra contenido privado durante la verificación', async () => {
      await login('EXPERTO', { meDelay: 500 })
      await until('window.__authTest.calls.includes("me")')
      assert.equal(await evaluate('Boolean(document.querySelector("#welcome-title"))'), false)
      assert.equal(await evaluate('document.querySelector("button[type=submit]").disabled'), true)
      await until('location.pathname==="/app/experto" && Boolean(document.querySelector("#welcome-title"))')
      assert.deepEqual(await evaluate('window.__authTest.calls'), ['login', 'me'])
    })
    await t.test('EXPERTO no accede a las secciones reservadas', async () => {
      for (const path of ['/app/comite', '/app/usuario']) {
        await navigate(path)
        await until('location.pathname==="/acceso-denegado" && Boolean(document.querySelector("#denied-title"))')
      }
    })
    await t.test('un usuario autenticado que abre /login vuelve a su ruta', async () => {
      await navigate('/login')
      await until('location.pathname==="/app/experto" && Boolean(document.querySelector("#welcome-title"))')
    })
    await t.test('403 preserva la sesión, muestra acceso denegado y permite verificar de nuevo', async () => {
      await evaluate('window.__authTest.meDelay=200;window.__authTest.meStatus=403;dispatchEvent(new Event("focus"))')
      await until('Boolean(document.querySelector("main[aria-busy=true]"))')
      assert.equal(await evaluate('Boolean(document.querySelector("#welcome-title"))'), false)
      await until('location.pathname==="/acceso-denegado" && Boolean(document.querySelector("#denied-title"))')
      assert.equal(await evaluate('document.body.textContent.includes("ha expirado")'), false)
      await evaluate('window.__authTest.meStatus=200;document.querySelector("button.btn-primary").click()')
      await until('location.pathname==="/app/experto" && Boolean(document.querySelector("#welcome-title"))')
    })
    await t.test('un error temporal de red conserva la sesión', async () => {
      await evaluate('window.__authTest.offline=true;dispatchEvent(new Event("focus"))')
      await until('Boolean(document.querySelector("#welcome-title")) && document.body.textContent.includes("No fue posible conectar")')
      assert.equal(await evaluate('location.pathname'), '/app/experto')
      await evaluate('window.__authTest.offline=false')
    })
    await t.test('401 al verificar limpia la sesión y redirige al login', async () => {
      await evaluate('window.__authTest.meStatus=401;dispatchEvent(new Event("focus"))')
      await until('location.pathname==="/login" && Boolean(document.querySelector("form"))')
      assert.equal(await evaluate('document.body.textContent.includes("ha expirado")'), true)
    })
    await t.test('logout y Atrás no permiten volver a mostrar identidad privada', async () => {
      await login()
      await until('Boolean(document.querySelector("#welcome-title"))')
      await navigate('/app/comite')
      await until('location.pathname==="/acceso-denegado"')
      await evaluate('Array.from(document.querySelectorAll("button")).find(el=>el.textContent==="Cerrar sesión").click()')
      await until('location.pathname==="/login" && Boolean(document.querySelector("form"))')
      await evaluate('new Promise(resolve=>{addEventListener("popstate",()=>requestAnimationFrame(()=>resolve()),{once:true});history.back()})')
      await until('location.pathname==="/login" && Boolean(document.querySelector("form"))')
      assert.equal(await evaluate('Boolean(document.querySelector("#welcome-title"))'), false)
    })
    await t.test('recargar una ruta privada descarta la sesión en memoria', async () => {
      await login()
      await until('Boolean(document.querySelector("#welcome-title"))')
      await navigate('/app/experto', true)
      await until('location.pathname==="/login" && Boolean(document.querySelector("form"))')
      assert.equal(await evaluate('localStorage.length+sessionStorage.length'), 0)
    })
    await t.test('la expiración al recuperar la pestaña impide reutilizar el token', async () => {
      await login()
      await until('Boolean(document.querySelector("#welcome-title"))')
      await evaluate('window.__realNow=Date.now;Date.now=()=>window.__realNow()+1000000;dispatchEvent(new Event("focus"))')
      await until('location.pathname==="/login" && Boolean(document.querySelector("form"))')
      assert.equal(await evaluate('document.body.textContent.includes("ha expirado")'), true)
      assert.equal(await evaluate('window.__authTest.calls.length'), 2)
    })
    for (const rol of ['COMITE', 'ADMIN']) {
      await t.test(`${rol} recibe bienvenida general y no obtiene acceso de experto`, async () => {
        await login(rol)
        await until('location.pathname==="/app" && Boolean(document.querySelector("#welcome-title"))')
        await navigate('/app/experto')
        await until('location.pathname==="/acceso-denegado"')
        if (rol === 'COMITE') {
          await navigate('/app/comite')
          await until('location.pathname==="/acceso-denegado"')
        }
      })
    }
    for (const rol of ['ROL_DESCONOCIDO', 'USUARIO_FINAL']) {
      await t.test(`${rol} validado por /me queda sin rutas privadas`, async () => {
        await login(rol)
        await until('location.pathname==="/acceso-denegado" && Boolean(document.querySelector("#denied-title"))')
        await navigate('/app')
        await until('location.pathname==="/acceso-denegado"')
        assert.equal(await evaluate('Boolean(document.querySelector("#welcome-title"))'), false)
      })
    }
    await t.test('un token rechazado por /me durante login no abre una sesión', async () => {
      await login('EXPERTO', { meStatus: 401 })
      await until('document.querySelector(".login-notice")?.textContent.includes("ha expirado")')
      assert.equal(await evaluate('location.pathname'), '/login')
      await navigate('/app')
      await until('location.pathname==="/login" && Boolean(document.querySelector("form"))')
    })
    await t.test('una ruta inexistente es informativa y no expone la identidad', async () => {
      await navigate('/no-existe', true)
      await until('Boolean(document.querySelector("#not-found-title"))')
      assert.equal(await evaluate('document.body.textContent.includes("Cuenta de prueba")'), false)
    })
    await t.test('login valida campos y permite mostrar y ocultar la contraseña sin alterarla', async () => {
      await navigate('/login', true)
      await until('Boolean(document.querySelector("form"))')
      await evaluate('document.querySelector("form").requestSubmit()')
      await until('Boolean(document.querySelector("#correo-error"))')
      assert.equal(await evaluate('document.activeElement.id'), 'correo')
      assert.equal(await evaluate('document.querySelector("#contrasena").getAttribute("aria-invalid")'), 'true')
      await evaluate(`(()=>{const el=document.querySelector('#contrasena');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'Ejemplo exclusivo de prueba');
        el.dispatchEvent(new Event('input',{bubbles:true}));})()`)
      await evaluate('document.querySelector(".password-toggle").click()')
      await until('document.querySelector("#contrasena").type==="text"')
      assert.equal(await evaluate('document.querySelector("#contrasena").value'), 'Ejemplo exclusivo de prueba')
      assert.equal(await evaluate('document.querySelector(".password-toggle").getAttribute("aria-pressed")'), 'true')
      await command('Page.bringToFront')
      await evaluate('document.querySelector(".password-toggle").focus()')
      assert.equal(await evaluate('document.activeElement.classList.contains("password-toggle")'), true)
      await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', windowsVirtualKeyCode: 13 })
      await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
      await until('document.querySelector("#contrasena").type==="password"')
      assert.equal(await evaluate('document.querySelector("#contrasena").value'), 'Ejemplo exclusivo de prueba')
      assert.equal(await evaluate('window.__authTest.calls.length'), 0)
      assert.equal(await evaluate('document.querySelector("#remember-session").disabled'), true)
      assert.equal(await evaluate('document.querySelector(".forgot-password").getAttribute("aria-disabled")'), 'true')
    })
    await t.test('login indica carga y bloquea envíos duplicados hasta confirmar /me', async () => {
      await login('EXPERTO', { meDelay: 700 })
      await until('Boolean(document.querySelector(".login-submit:disabled .spinner-border"))')
      assert.equal(await evaluate('document.querySelector("#correo").disabled && document.querySelector("#contrasena").disabled'), true)
      await evaluate('document.querySelector("form").requestSubmit()')
      await until('Boolean(document.querySelector("#welcome-title"))')
      assert.equal(await evaluate('window.__authTest.calls.length'), 2)
    })
    await t.test('login se adapta desde 320 hasta 1920 píxeles sin desbordar ni ocultar controles', async () => {
      await navigate('/login', true)
      await until('Boolean(document.querySelector("form"))')
      for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1024, 768], [1366, 768], [1440, 900], [1920, 1080]]) {
        await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
        assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'), true)
        assert.equal(await evaluate('getComputedStyle(document.querySelector(".login-showcase")).display!=="none"'), width > 760)
        assert.equal(await evaluate(`['#correo','#contrasena','.login-submit','.forgot-password'].every(selector=>{
          const rect=document.querySelector(selector).getBoundingClientRect();
          return rect.width>0 && rect.left>=0 && rect.right<=innerWidth && rect.bottom<=document.documentElement.scrollHeight;
        })`), true)
        if (width > 760) {
          const ratio = await evaluate('document.querySelector(".login-panel").getBoundingClientRect().width/document.querySelector(".login-card").clientWidth')
          assert.ok(Math.abs(ratio - .42) < .01)
        }
        if (width === 390 || width === 1440) {
          const screenshot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
          await writeFile(join(cacheRoot, `login-${width}.png`), Buffer.from(screenshot.data, 'base64'))
        }
      }
    })
    assert.deepEqual(consoleErrors, [], 'La aplicación no debe producir errores de consola')
  } finally {
    if (ws?.readyState === WebSocket.OPEN) {
      await command('Browser.close').catch(() => {})
      ws.close()
    }
    if (child && child.exitCode === null) {
      await Promise.race([new Promise((resolveExit) => child.once('exit', resolveExit)), pause(2000)])
      if (child.exitCode === null) child.kill()
    }
    await server.close()
    // Delete only this test's checked profile beneath the ignored cache directory.
    assert.ok(profile.startsWith(cacheRoot + sep))
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
  }
})
