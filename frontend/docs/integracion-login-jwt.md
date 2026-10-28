# UtaFlow — integración del login con JWT

Verificación: 24 de octubre de 2026. Rama `feature/login-frontend`; estado inicial limpio. Sin commits ni push. Backend, SQL y CSS conservados sin modificaciones.

## Implementación

El formulario existente utiliza `fetch` mediante `authService`. Valida correo y contraseña, impide envíos duplicados, deshabilita campos y envío mientras espera, muestra errores controlados y limpia la contraseña tras cada intento enviado. No se modifica la contraseña antes de enviarla; solo se recorta el correo.

El servicio verifica el contrato de login, consulta `/api/auth/me` con Bearer y compara ID, correo, nombre y rol antes de publicar la sesión. Solo admite `EXPERTO`, `COMITE` y `ADMIN`, los códigos presentes en el script SQL y permitidos por Domain. Un rol desconocido, incluido `USUARIO_FINAL`, impide abrir la sesión. No se asignan permisos por defecto ni se implementan funcionalidades de roles.

`AuthProvider` expone la identidad al árbol React. La confirmación provisional muestra bienvenida, nombre, correo, rol y cierre de sesión. No se incorporan rutas, dashboards ni dependencias.

Se conservan paneles, textos principales, marca, tarjetas, clases, dimensiones y CSS del login. La casilla de recordar sesión permanece deshabilitada, ahora sin marcar, con ayuda que explica su indisponibilidad y la pérdida de sesión al recargar. El botón cambia de texto y se deshabilita durante el envío.

## Contrato comprobado en el código del backend

Origen HTTPS del perfil `https`: `https://localhost:7003`. El puerto HTTP `5045` redirige a HTTPS; el frontend debe dirigirse directamente a HTTPS.

`POST /api/auth/login`, `Content-Type: application/json`:

```json
{ "correo": "<correo de la cuenta elegida>", "contrasena": "<entrada del usuario>" }
```

Correo: obligatorio, formato email, máximo 200 caracteres. Contraseña: obligatoria, máximo 128 caracteres.

Respuesta `200`:

```json
{
  "token": "<JWT emitido por la API>",
  "usuario": {
    "id": 1,
    "nombre": "<nombre>",
    "correo": "<correo>",
    "rol": "EXPERTO"
  }
}
```

`GET /api/auth/me`, `Authorization: Bearer <JWT>`: devuelve directamente `{ id, nombre, correo, rol }`. No devuelve un objeto `usuario` envolvente. El backend verifica firma HS256, algoritmo, emisor, audiencia, vigencia y `sub`; consulta nuevamente SQL y comprueba actividad y rol actual. La identidad de esta respuesta es la fuente del estado React.

Respuestas relevantes: `400` validación; `401` para correo inexistente, contraseña incorrecta, usuario inactivo, hash de marcador o rol no habilitado en login, y token ausente/inválido/vencido en `/me`; `429` al superar cinco intentos por IP y minuto; `503` para errores SQL; `500` para otros errores internos. Las respuestas de autenticación utilizan `Cache-Control: no-store`.

El frontend distingue validación local, configuración ausente, fallo de red o timeout de 20 segundos, respuesta HTTP y respuesta exitosa inválida. Para `401` en login muestra «El correo o la contraseña son incorrectos», sin distinguir existencia o estado de cuenta. Para `429` pide esperar; para errores internos muestra un mensaje genérico. Nunca presenta el cuerpo de errores de la API. También maneja defensivamente `403`, aunque no es una respuesta habitual del contrato actual.

## JWT y cierre de sesión

El token vive únicamente en una variable privada del servicio. React recibe el usuario y el aviso de sesión, sin exponer el JWT en el contexto. No se usan `localStorage`, `sessionStorage` ni cookies para persistir la autenticación. No se guardan contraseñas ni se imprimen contraseñas o tokens.

El claim `exp` sirve para programar el descarte local y detectar vencimiento al volver a una pestaña. Esta lectura no verifica la firma ni autoriza el acceso: esas verificaciones corresponden a `/me`. Vigencia configurada en el backend: 15 minutos por defecto, admisible entre 1 y 60, sin tolerancia adicional. Una respuesta `401` al consultar el usuario descarta la sesión y muestra «Tu sesión ha expirado. Vuelve a iniciar sesión».

Cerrar sesión elimina token e identidad, cancela solicitudes pendientes y vuelve al login. Una respuesta tardía no puede restaurar la sesión eliminada. No hay petición a un endpoint de logout. La aplicación no invalida copias del JWT en el servidor: el backend actual no implementa revocación individual ni refresh tokens.

Recargar o cerrar la pestaña requiere autenticarse otra vez. Recordar durante 30 días no está implementado. Cada pestaña tiene su propia sesión en memoria. No se promete detectar cambios de cuenta instantáneamente: el backend los rechaza en la siguiente consulta autenticada; la pantalla provisional no hace polling.

## Ejecución local

Requisitos: Node y npm compatibles con el proyecto, .NET SDK 10, SQL Server con la base existente y una cuenta con hash válido para probar éxito.

Desde la raíz, seguir [configuración del backend](../../docs/autenticacion-backend.md), definiendo `ConnectionStrings__UtaFlow` y una clave aleatoria `Jwt__SigningKey` fuera del repositorio. El documento incluye generación en memoria compatible con Windows PowerShell. No volver a ejecutar el script de creación SQL sobre una base existente.

```powershell
dotnet run --project backend/tools/UtaFlow.AuthTool -- check-db
dotnet dev-certs https --check --trust
# Solo si falta un certificado confiable, instalarlo de forma interactiva:
dotnet dev-certs https --trust
dotnet run --project backend/UtaFlow.Api --launch-profile https
```

Para AuthTool, establecer también `ASPNETCORE_ENVIRONMENT=Development` según la documentación del backend. El perfil `https` establece Development para la API. Nunca omitir validación HTTPS ni aceptar cualquier origen CORS. Se comprobó que existe un certificado de desarrollo confiable en esta máquina.

En otra terminal, desde la raíz:

```powershell
cd frontend
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Abrir `http://localhost:5173`. `VITE_API_BASE_URL=https://localhost:7003` identifica el origen de la API, sin `/api/auth`. `.env.local` queda ignorado por Git; en esta sesión se creó con esa URL pública. `.env.example` es versionable mediante una excepción específica en `frontend/.gitignore`. Las variables `VITE_` son públicas y no deben contener secretos. Reiniciar Vite después de cambiarlas; el build incorpora su valor.

El backend configura `Cors:FrontendOrigin=http://localhost:5173`. Vite fija el puerto 5173 con `strictPort` para evitar cambiar silenciosamente de origen si está ocupado. Si se utiliza otra dirección o puerto, ajustar el origen exacto en la configuración local del backend y reiniciar ambos procesos. Abrir `127.0.0.1:5173` supone un origen distinto de `localhost:5173`.

## Preparar una única cuenta de desarrollo

La consulta realizada fue de solo lectura y devolvió: `EXPERTO`, dos cuentas y dos marcadores; `COMITE`, tres cuentas y tres marcadores; `ADMIN`, cero cuentas. Las cinco cuentas conservan `REEMPLAZAR_CON_HASH`. Ninguna se puede usar para probar un login exitoso en este estado. No se actualizaron datos ni se eligió una contraseña para el usuario.

El responsable debe comprobar primero servidor, nombre de base y que sea un entorno de desarrollo autorizado y aislado. Elegir una sola cuenta existente, confirmar su ID, correo, estado activo y rol permitido. La herramienta existente solicita una contraseña elegida por el responsable y su confirmación, con entrada oculta, de 12 a 128 caracteres:

```powershell
dotnet run --project backend/tools/UtaFlow.AuthTool -- hash
```

No pasar la contraseña como argumento ni guardarla en archivos o historial. La herramienta imprime únicamente el hash Identity V3 y no escribe en SQL. Aplicarlo fuera del repositorio mediante parámetros, en una transacción controlada sobre la cuenta elegida; por ejemplo, después de verificar el entorno:

```sql
-- @Hash, @IdUsuario y @Correo se suministran como parámetros.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
UPDATE dbo.Usuario
SET ClaveHash = @Hash
WHERE IdUsuario = @IdUsuario AND Correo = @Correo
  AND Activo = 1 AND ClaveHash = N'REEMPLAZAR_CON_HASH';
IF @@ROWCOUNT <> 1
BEGIN
    ROLLBACK TRANSACTION;
    THROW 50001, 'La operación debe afectar exactamente una cuenta de desarrollo.', 1;
END;
COMMIT TRANSACTION;
```

Este ejemplo no se ejecutó. No es una actualización masiva ni sirve para bases con datos reales sin autorización. No guardar el hash, contraseña ni JWT resultante en el repositorio, capturas o logs. Después, probar desde el navegador con la contraseña introducida manualmente.

## Verificaciones realizadas

- `npm run build`: correcto. El primer intento encontró `spawn EPERM` por el sandbox; pasó al ejecutarlo con permisos para crear procesos.
- `npm run lint`: correcto.
- `npm test`: 30 pruebas del servicio, correctas. Usan el runner integrado de Node, respuestas HTTP simuladas y JWT sintéticos exclusivamente de prueba; no prueban un acceso real ni se incorporan a producción.
- Las pruebas frontend cubren contrato, publicación posterior a `/me`, tres roles permitidos, errores HTTP/red, JSON inválido o incompleto, rol desconocido, discrepancias de identidad, token vencido, duplicados, descarte y cancelación tras logout, rechazo posterior de `/me`, expiración al recuperar pestaña y ausencia de persistencia tras recarga.
- `dotnet test backend/UtaFlow.Api.Tests -m:1 -p:UseSharedCompilation=false`: 42 correctas y una omitida por no configurar `UTAFLOW_TEST_SQL`. La suite existente usa TestServer y un repositorio en memoria para los casos autenticados. No se modificaron proyectos backend.
- API HTTPS real con SQL local: `/me` sin token → `401`; con token inválido → `401`; login con correo aleatorio inexistente → `401`; cuenta de marcador con contraseña aleatoria → `401`; entrada inválida → `400`.
- CORS real: origen permitido presente en las respuestas, preflight con Authorization → `204`, origen ajeno sin autorización CORS. HTTPS verificado con certificado confiable, sin omitir su validación.
- Chrome real con React, API y SQL: campos vacíos y email inválido no envían HTTP; envío duplicado genera una sola solicitud; el `401` se presenta correctamente; se limpia contraseña y finaliza el estado ocupado; ambos almacenamientos web permanecen vacíos. No hubo desbordamiento horizontal a 390 ni 1440 px y se conservó el panel informativo.
- `git diff --check`: correcto. CSS, componentes de marca/showcase, backend y SQL sin diferencias.

**Pendiente con cuenta real funcional:** login exitoso, `/me` con el JWT real obtenido, visualización de bienvenida/identidad/rol, expiración y logout desde esa sesión en el navegador, y contraseña incorrecta contra una cuenta cuyo hash sea válido. Los casos equivalentes pasan con respuestas simuladas o el repositorio de pruebas, pero esto no constituye una integración completamente comprobada con SQL. El rechazo de una cuenta con marcador no verifica una contraseña incorrecta contra un hash funcional.

Para repetir las verificaciones automatizadas:

```powershell
cd frontend
npm run build
npm run lint
npm test
```

## Archivos y diferencias

Modificados: `frontend/.gitignore`, `frontend/README.md`, `frontend/package.json`, `frontend/vite.config.js`, `frontend/src/App.jsx`, `frontend/src/main.jsx`, `frontend/src/pages/auth/Login.jsx`.

Creados: `frontend/.env.example`, `frontend/src/services/authService.js`, `frontend/src/context/AuthContext.js`, `frontend/src/context/AuthProvider.jsx`, `frontend/src/pages/auth/Authenticated.jsx`, `frontend/tests/authService.test.mjs` y este documento. Configuración local adicional ignorada: `frontend/.env.local`.

El diff añade integración y estado de autenticación al formulario existente, configuración pública del origen, puerto estable de Vite, confirmación provisional, pruebas y documentación. No cambia dependencias ni el lockfile. Todos los cambios se dejan sin stage, commit ni push para revisión.
