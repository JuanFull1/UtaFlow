# UtaFlow — commit 3: rutas, sesiones y navegación por roles

Verificado el 24 de octubre de 2026 en `feature/login-frontend`. El commit anterior es `e2c18d0` (`feat(auth): integra login frontend con API JWT`), con árbol inicialmente limpio. No se hicieron commits, push ni PR.

## Auditoría y alcance

Se revisaron componentes, servicio, contexto, contrato del backend, perfiles y configuración de desarrollo, esquema SQL y dependencias. El commit 2 contiene el flujo real `login → /me → sesión`, JWT privado en memoria y logout local. No había React Router. Se reutilizan `authService`, `AuthContext`, `AuthProvider`, el login y la confirmación `Authenticated` existentes.

El contrato permanece igual: `POST /api/auth/login` recibe `{ correo, contrasena }` y devuelve `{ token, usuario: { id, nombre, correo, rol } }`; `GET /api/auth/me` requiere Bearer y devuelve directamente `{ id, nombre, correo, rol }`. La firma y vigencia se validan en ASP.NET Core, que vuelve a consultar actividad y rol del usuario en SQL.

El servicio anterior borraba la sesión ante un `403` en `/me`. Se corrigió para distinguir autorización insuficiente de identidad inválida. También se separó una identidad con rol desconocido de la autorización de rutas: si login y `/me` la confirman, recibe acceso limitado, sin permisos privados. Un rol vacío o una identidad incompleta continúa siendo una respuesta inválida.

El esquema define `EXPERTO`, `COMITE` y `ADMIN`. `USUARIO_FINAL` aún no está habilitado por el backend revisado. La pertenencia al comité se controla también con `dbo.ComiteMiembro.Activo`; `/me` no incluye esa información. Tener rol COMITE no se interpreta como prueba de pertenencia activa.

## Dependencias

Se agregó únicamente la dependencia directa `react-router@8.5.0`, fijada en `package.json` y lockfile. El registro npm informó esta versión como estable; requiere Node >=22.22.0 y React/React DOM >=19.2.7. El entorno comprobado tiene Node 24.14.0 y React/React DOM 19.3.1. La instalación agregó dos dependencias transitivas del router y reportó cero vulnerabilidades.

Se utiliza el [modo declarativo oficial de React Router](https://reactrouter.com/start/declarative/routing), con `BrowserRouter`, rutas anidadas, `Outlet` y redirecciones con reemplazo del historial. `react-router-dom` no era necesario; no se agregaron bibliotecas HTTP ni nuevas bibliotecas de pruebas.

## Rutas y matriz de permisos

| Ruta | Sin sesión | EXPERTO | COMITE | ADMIN | Rol desconocido o USUARIO_FINAL |
| --- | --- | --- | --- | --- | --- |
| `/` | Redirige a `/login` | Termina en `/app/experto` | Termina en `/app` | Termina en `/app` | Termina en acceso denegado |
| `/login` | Formulario existente | Redirige a `/app/experto` | Redirige a `/app` | Redirige a `/app` | Redirige a acceso denegado |
| `/app` | Redirige a `/login` | Redirige a `/app/experto` | Bienvenida general | Bienvenida general | Acceso denegado |
| `/app/experto` | Redirige a `/login` | Bienvenida provisional | Acceso denegado | Acceso denegado | Acceso denegado |
| `/app/usuario` | Redirige a `/login` | Acceso denegado | Acceso denegado | Acceso denegado | Acceso denegado |
| `/app/comite` | Redirige a `/login` | Acceso denegado | Acceso denegado | Acceso denegado | Acceso denegado |
| `/acceso-denegado` | Información pública | Información pública | Información pública | Información pública | Información pública |
| `*` | Página no encontrada | Página no encontrada | Página no encontrada | Página no encontrada | Página no encontrada |

Las direcciones `/app/usuario` y `/app/comite` se reservan con una lista vacía de roles permitidos. No habilitan módulos ni funcionalidades. Las rutas desconocidas bajo `/app/*` pasan primero por la protección del área privada; las desconocidas fuera de ella muestran la página informativa pública.

Un estado global `forbidden` impide cualquier ruta privada hasta verificar exitosamente `/me`. Acceso denegado ofrece «Verificar acceso» para una identidad conocida en ese estado y permite cerrar sesión. Ante una restricción de ruta ordinaria, ofrece volver al inicio autorizado. Un rol desconocido dispone solo del cierre de sesión: no obtiene un enlace circular ni permisos implícitos.

Las páginas públicas de error no muestran nombre, correo ni rol. Las pantallas privadas reutilizan la bienvenida, nombre, correo, rol y logout existentes, con un aviso sobre funciones futuras. No hay dashboards, menús que simulen módulos, solicitudes, evaluaciones ni funciones de comité.

## Sesión y autorización

El contexto existente expone identidad, aviso, vencimiento y estado: `anonymous`, `verifying`, `authenticated` o `forbidden`. El token permanece en una variable privada del servicio y nunca se expone en el contexto, URL, logs o almacenamiento web. Las credenciales solo se mantienen transitoriamente en el formulario y la petición; se conserva su limpieza tras el envío.

`ProtectedRoute` muestra una pantalla de verificación antes de permitir contenido privado, redirige a `/login` sin sesión y comprueba explícitamente los roles permitidos. No obtiene el rol de parámetros URL, campos editables ni del JWT decodificado. El usuario se publica después de comparar identidad completa entre login y `/me`.

Al recuperar el foco o hacer visible la pestaña, se comprueba el vencimiento y se revalida `/me` si hay identidad. Las verificaciones concurrentes comparten una solicitud. El contenido privado se retira mientras se verifica. El vencimiento también se comprueba antes de pintar una navegación mediante el efecto de layout del proveedor y con el temporizador existente.

- `401` en una revalidación: descarta token e identidad, cancela solicitudes, redirige al login y muestra el aviso de expiración.
- `403`: mantiene token e identidad, establece estado `forbidden` y conduce a acceso denegado. No se presenta como expiración. Una verificación posterior exitosa permite regresar al destino del rol.
- Red, timeout o `503`: conserva la sesión y presenta un mensaje controlado; no restaura permisos si el estado anterior ya era `forbidden`.
- Identidad inconsistente o respuesta inválida: descarta la sesión; el rol nuevo no adquiere permisos mediante una respuesta incompatible con la sesión previa.
- JWT vencido: descarta la sesión local y evita nuevas consultas con ese token.

Logout borra estado y JWT, cancela solicitudes y reemplaza la ubicación actual por `/login`. Las respuestas tardías no pueden recuperar la sesión y las rutas protegidas impiden volver a mostrar identidad usando Atrás. El logout es local: una copia del JWT puede seguir vigente hasta expirar porque no hay revocación individual implementada.

Recargar o cerrar la pestaña pierde la sesión, incluso al recargar una URL privada. No se implementan refresh tokens, cookies de restauración ni persistencia. `VITE_API_BASE_URL` sigue siendo `https://localhost:7003` en la configuración local; CORS y puerto de Vite siguen en `http://localhost:5173`. No se modificaron variables de entorno.

Esta protección controla navegación y experiencia de usuario. **Las operaciones deben seguir protegidas y autorizadas en ASP.NET Core**; el router no sustituye `[Authorize]`, firma JWT, actividad del usuario o permisos de servidor.

## Pruebas y resultados

`npm run build`: correcto. `npm run lint`: correcto. `npm ls --depth=0`: dependencias satisfechas, incluido React Router. La hoja CSS compilada conserva el mismo nombre y tamaño que antes del cambio (`index-DxqlVfWG.css`, 243,47 kB).

`npm test`: 57 pruebas correctas, cero fallos y cero omisiones. Incluye las pruebas anteriores del servicio, ocho pruebas nuevas de estado/revalidación, una prueba de política de destinos y 17 escenarios de navegador dentro de su prueba contenedora.

Los escenarios de Chrome cubren los dos accesos privados sin sesión, navegación tras `/me`, ausencia de contenido privado mientras se verifica, rutas reservadas, redirección desde `/login`, distinción y recuperación de `403`, error temporal de red, `401`, logout y Atrás, recarga, expiración al recuperar pestaña, COMITE y ADMIN sin permisos de experto, roles desconocidos y USUARIO_FINAL sin rutas privadas, token rechazado por `/me`, página inexistente, ausencia de errores de consola y login sin desbordamiento a 390 y 1440 píxeles.

Las respuestas autenticadas, identidades y JWT sintéticos existen únicamente en los archivos de pruebas. La aplicación de producción sigue enviando solicitudes a la API configurada. Las pruebas de navegador crean un Vite y un perfil de Chromium temporales, los cierran al terminar y eliminan el perfil de su directorio comprobado bajo `node_modules/.cache`. No necesitan modificar SQL, ejecutar el backend ni desactivar certificados.

Para ejecutar:

```powershell
cd frontend
npm ci
npm run build
npm run lint
npm test
npm run dev
```

El runner sigue siendo el integrado de Node del commit 2. La prueba de navegador detecta Chrome o Edge en las rutas habituales de Windows. Para otra ubicación o plataforma, definir `UTAFLOW_TEST_BROWSER` con la ruta del ejecutable Chromium. Si no hay navegador disponible, ese caso se omite explícitamente; no se presenta como aprobado. En este entorno se ejecutó con Chrome real, sin omisiones. El sandbox requirió permiso para crear procesos y abrir el servidor de prueba local.

`dotnet test backend/UtaFlow.Api.Tests -m:1 -p:UseSharedCompilation=false`: 42 correctas, cero fallos y una prueba SQL omitida por no definir `UTAFLOW_TEST_SQL`. No se modificaron proyectos backend ni datos.

## Limitaciones

No se proporcionaron credenciales de una cuenta real funcional para verificar los nuevos recorridos autenticados contra SQL Server. La verificación autenticada de roles, navegación, logout y errores de esta entrega usa respuestas controladas exclusivamente dentro de las pruebas; no equivale a un login real contra SQL. La preparación segura de una cuenta sigue documentada en [la integración del commit 2](integracion-login-jwt.md).

No existe permiso verificable de pertenencia activa al comité en `/me`; se mantiene cerrada su ruta exclusiva. USUARIO_FINAL no se habilita hasta que exista soporte real. No se implementan módulos ni revocación o renovación de tokens.

Para un despliegue con `BrowserRouter`, el host del frontend debe servir `index.html` al solicitar rutas de la SPA como `/login` o `/app/experto`. Vite ya permite esos accesos en desarrollo; no se modificó infraestructura ni hosting en esta etapa.

## Archivos y estado de Git

Creados:

- `frontend/src/components/auth/ProtectedRoute.jsx`.
- `frontend/src/components/common/LoadingScreen.jsx`.
- `frontend/src/pages/errors/AccessDenied.jsx` y `NotFound.jsx`.
- `frontend/src/routes/AppRoutes.jsx` y `accessPolicy.js`.
- `frontend/tests/accessPolicy.test.mjs` y `routes.browser.test.mjs`.
- `frontend/docs/rutas-sesiones-roles.md`.

Modificados:

- `frontend/package.json` y `package-lock.json`: dependencia del router.
- `frontend/src/main.jsx` y `App.jsx`: router y tabla de rutas.
- `frontend/src/context/AuthProvider.jsx`: estados existentes, verificación al recuperar pestaña y redirección tras descarte.
- `frontend/src/services/authService.js`: estado explícito, concurrencia de revalidaciones y distinción `401`/`403`/red.
- `frontend/src/pages/auth/Authenticated.jsx`: aviso provisional y logout con navegación.
- `frontend/tests/authService.test.mjs`: casos de sesión y aislamiento de mocks dentro de su suite.
- `frontend/README.md`: enlace a este informe y navegación actual.

`git diff --check` pasó. `Login.jsx`, CSS, logo, showcase, backend y scripts SQL permanecen sin diferencias. El diff se limita a navegación, sesión, pantallas provisionales, pruebas y documentación. Los cambios quedan sin stage, commit, push ni PR, sobre la misma rama para revisión.
