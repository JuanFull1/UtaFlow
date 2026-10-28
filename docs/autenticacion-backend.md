# Primera entrega: autenticación backend

Implementada en `feature/autenticacion-login`. El frontend, el esquema SQL, los datos y los procedimientos almacenados permanecen sin cambios. No se realizaron commits ni push.

## Comportamiento y separación de capas

- **Domain:** `Usuario` y regla de acceso para cuentas activas con rol `EXPERTO`, `COMITE` o `ADMIN`.
- **Application:** contratos del repositorio, contraseñas y emisor de tokens; DTO y `AuthService`.
- **Infrastructure:** conexiones SQL cifradas, consultas parametrizadas a `dbo.Usuario`/`dbo.Rol` y hashes Identity V3 (PBKDF2-HMAC-SHA512, 220 000 iteraciones, sal aleatoria).
- **Api:** controlador, emisión y validación JWT, CORS, limitación de intentos y errores HTTP.

No se incorporó Entity Framework. Cada consulta abre y dispone una conexión; SqlClient administra el pool. Las consultas tienen un timeout de 15 segundos y reciben el token de cancelación HTTP. No se ejecutan migraciones ni escrituras automáticas.

La API rechaza al iniciar una configuración JWT, SQL o CORS incompleta o insegura. La conectividad real se verifica mediante `check-db` o las pruebas SQL; no se abre la base durante el arranque.

## Endpoints

### `POST /api/auth/login`

Entrada JSON: `correo` y `contrasena`. El correo admite hasta 200 caracteres y la contraseña hasta 128. No se recorta ni transforma la contraseña.

Respuesta `200`:

```json
{
  "token": "<JWT emitido en tiempo de ejecución>",
  "usuario": {
    "id": 1,
    "nombre": "<nombre de la cuenta existente>",
    "correo": "<correo de la cuenta existente>",
    "rol": "EXPERTO"
  }
}
```

El ejemplo describe el contrato, no crea una cuenta. La respuesta nunca contiene `ClaveHash`. Cuenta inexistente, contraseña incorrecta, cuenta inactiva, rol no habilitado y hash de marcador devuelven el mismo `401` y mensaje genérico. Se realiza una verificación de hash también para cuentas inexistentes. Formato inválido devuelve `400`.

Límite de cinco solicitudes por IP en una ventana fija de un minuto, sin cola; el exceso devuelve `429` y `Retry-After`. Cuenta todos los intentos, incluso exitosos. La IP proviene de la conexión, no de encabezados enviados por el cliente. El límite es local a cada instancia y se reinicia con el proceso; un despliegue con proxy o varias réplicas necesita configurar proxies confiables y límites compartidos antes de publicarse.

### `GET /api/auth/me`

Requiere `Authorization: Bearer <token>`. Devuelve directamente `{ id, nombre, correo, rol }` del usuario actual.

Valida firma HS256, algoritmo, emisor, audiencia, vencimiento y fecha inicial, sin tolerancia adicional al vencimiento. Obtiene el ID exclusivamente del claim `sub`. Vuelve a consultar SQL para rechazar cuentas eliminadas, inactivas o cuyo rol haya cambiado. Los parámetros de URL no definen la identidad.

Token ausente, inválido o vencido devuelve `401`. Los fallos de SQL devuelven `503` genérico; los demás errores de servidor devuelven `500` genérico. Las respuestas de autenticación indican `Cache-Control: no-store`.

## Configuración local

Requiere SDK .NET 10, SQL Server con la base UtaFlow existente y acceso de lectura a `dbo.Usuario` y `dbo.Rol`. No vuelva a ejecutar `database/01_UtaFlow_Estructura.sql` sobre una base ya creada: contiene creación de tablas e inserciones iniciales.

El backend lee variables de entorno y, en Development, `backend/UtaFlow.Api/appsettings.Development.json`, que ya está ignorado por Git. No guarde secretos en archivos versionados ni en el historial de comandos.

| Variable | Uso |
| --- | --- |
| `ConnectionStrings__UtaFlow` | Obligatoria: servidor, base, autenticación y cifrado SQL. |
| `Jwt__SigningKey` | Obligatoria: al menos 32 bytes aleatorios codificados en Base64. |
| `Jwt__Issuer` | Emisor; valor predeterminado `UtaFlow.Api`. |
| `Jwt__Audience` | Audiencia; valor predeterminado `UtaFlow.Frontend`. |
| `Jwt__ExpirationMinutes` | Entre 1 y 60; predeterminado 15. |
| `Cors__FrontendOrigin` | Origen exacto, sin barra final ni ruta; predeterminado `http://localhost:5173`. HTTPS obligatorio fuera de Development. |
| `ASPNETCORE_ENVIRONMENT` | `Development` para desarrollo local; lo configura el perfil de lanzamiento. |
| `UTAFLOW_TEST_SQL` | Opcional: conexión usada únicamente por la prueba SQL de solo lectura. |

Ejemplo PowerShell desde la raíz, con autenticación integrada de Windows y certificado SQL local autofirmado:

```powershell
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:ConnectionStrings__UtaFlow = 'Server=localhost;Database=UtaFlow;Integrated Security=True;Encrypt=True;TrustServerCertificate=True;Connect Timeout=5'

# Clave efímera: se genera en memoria y no se imprime ni se guarda.
$jwtBytes = New-Object byte[] 32
$jwtRandom = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$jwtRandom.GetBytes($jwtBytes)
$env:Jwt__SigningKey = [Convert]::ToBase64String($jwtBytes)
$jwtRandom.Dispose()
[Array]::Clear($jwtBytes, 0, $jwtBytes.Length)

dotnet run --project backend/tools/UtaFlow.AuthTool -- check-db
dotnet run --project backend/UtaFlow.Api --launch-profile https
```

La API escucha en `https://localhost:7003`; el perfil también publica HTTP en `http://localhost:5045`, que se redirige a HTTPS. Si el certificado HTTPS de desarrollo no está preparado, ejecutar localmente `dotnet dev-certs https --trust` y aceptar la instalación del certificado cuando el sistema lo solicite.

En producción use un certificado SQL confiable, `Encrypt=True` o `Strict` y `TrustServerCertificate=False`. La API rechaza desactivar cifrado y solo admite omitir validación del certificado SQL en Development. Configure también un certificado HTTPS y el origen HTTPS real del frontend. Mantenga la clave JWT estable en un gestor de secretos; generar otra clave invalida todos los tokens anteriores. Para autenticación SQL, suministre usuario y contraseña mediante configuración secreta local o el gestor de secretos del despliegue, nunca en el repositorio.

El frontend todavía no se integra ni se modifica. Su arranque existente es `cd frontend`, `npm install`, `npm run dev`. Cuando se integre, el origen de Vite deberá coincidir exactamente con `Cors__FrontendOrigin`.

## Asignación de hashes de desarrollo

Ejecutar en una terminal interactiva:

```powershell
dotnet run --project backend/tools/UtaFlow.AuthTool -- hash
```

Solicita una contraseña elegida por el responsable y su confirmación, con entrada oculta, entre 12 y 128 caracteres. No acepta contraseñas como argumentos ni entrada redirigida. Solo imprime el hash versionado; no conecta a SQL ni crea o actualiza usuarios.

El responsable debe aplicar ese hash a una cuenta existente mediante una actualización parametrizada de `ClaveHash`, comprobando que afecte exactamente a la cuenta prevista. Forma del comando, con ambos parámetros suministrados fuera del repositorio:

```sql
UPDATE dbo.Usuario SET ClaveHash = @Hash WHERE Correo = @Correo;
```

No guardar contraseñas, hashes de cuentas reales ni tokens en scripts, capturas, archivos HTTP o commits. No se aceptan texto plano, marcadores `REEMPLAZAR_CON_HASH` ni hashes de otros formatos. La verificación admite Identity V3; esta entrega no actualiza automáticamente hashes antiguos cuando Identity recomienda recalcularlos.

## Sesión y siguiente etapa

El backend devuelve un JWT de corta duración. La integración futura mantendrá el token en memoria, sin `localStorage`. Recargar o cerrar la pestaña requerirá iniciar sesión nuevamente; esta entrega no incluye refresh token ni restauración persistente.

El cierre de sesión del cliente consiste en descartar el token. No existe endpoint de logout ni revocación individual: una copia del token sigue vigente hasta su vencimiento, salvo que la cuenta sea desactivada, eliminada, cambie de rol o se rote la clave. La prueba de descarte verifica el acceso sin token; no equivale a una interfaz de cierre de sesión implementada.

No se implementaron formularios, rutas React, bienvenida, registro, recuperación ni dashboards. Se requiere revisar esta entrega antes de continuar con el frontend.

## Propuesta de migración futura para USUARIO_FINAL

No aplicada. El catálogo `Rol` ya admite el código, por lo que la migración mínima sería una inserción idempotente de `USUARIO_FINAL` en un script separado, conservando `EXPERTO`, `COMITE` y `ADMIN`. No necesita cambiar columnas ni crear cuentas.

Antes de habilitar el rol, se debe aprobar cómo pasar del solicitante público sin sesión a una cuenta autenticada, definir permisos y actualizar la regla de acceso de Domain. **Dependencia pendiente:** `sp_CrearSolicitud` actualmente asigna origen `EXPERTO` a todo solicitante autenticado cuyo rol no sea `COMITE`; `SolicitudCambio.Origen` solo admite `PUBLICO`, `EXPERTO` y `COMITE`. Añadir el catálogo y permitir login sin resolver esa dependencia clasificaría incorrectamente a usuarios finales. La migración completa del flujo deberá decidir el origen compatible y sus permisos en otra entrega. Ningún procedimiento ni restricción se cambió aquí.

## Pruebas y resultados de esta entrega

Ejecutadas el 23 de octubre de 2026:

- Compilación de Infrastructure/AuthTool y de la API: correctas, sin errores ni advertencias tras actualizar la dependencia criptográfica.
- Pruebas automáticas: 42 correctas; una prueba SQL se omite por diseño cuando no se define `UTAFLOW_TEST_SQL`.
- La prueba SQL se ejecutó después por separado contra la base local: una correcta. Usa el repositorio real y la canalización HTTP; verifica consultas parametrizadas, una cadena de inyección y login de correo inexistente con respuesta `401`. No escribe datos.
- `AuthTool check-db`: conexión y consulta `Usuario`/`Rol` correctas. Requirió salir del sandbox para usar la identidad de Windows.
- La consulta de catálogo local confirmó `EXPERTO` (dos cuentas), `COMITE` (tres cuentas), `ADMIN` (cero cuentas). Las cinco cuentas conservan el marcador de hash.
- Auditoría NuGet de API y dependencias transitivas: sin vulnerabilidades conocidas reportadas por las fuentes consultadas.
- Frontend: sin modificaciones y sin compilación en esta etapa.

La suite HTTP usa `TestServer`, la misma configuración de API y un repositorio de usuarios en memoria, con contraseñas y claves generadas durante cada prueba. Verifica los tres roles, `/me`, exclusión de hashes, errores homogéneos de credenciales, usuario inactivo, hashes inválidos, JWT sin firma o algoritmo incorrecto, firma/fechas/emisor/audiencia/identidad inválidos, cambios de cuenta, CORS, validación de entrada, límite de intentos y descarte del token. Otras pruebas rechazan configuraciones inseguras. No se han presentado estas cuentas de prueba como usuarios reales de SQL Server.

Comandos para repetir las comprobaciones desde la raíz:

```powershell
dotnet build backend/UtaFlow.sln -m:1 -p:UseSharedCompilation=false
dotnet test backend/UtaFlow.Api.Tests -m:1 -p:UseSharedCompilation=false

# Opcional, contra una base existente; solo lectura.
$env:UTAFLOW_TEST_SQL = $env:ConnectionStrings__UtaFlow
dotnet test backend/UtaFlow.Api.Tests --filter 'Category=SqlServer'
Remove-Item Env:UTAFLOW_TEST_SQL

dotnet list backend/UtaFlow.Api package --vulnerable --include-transitive
```

Se usaron `-m:1` y `UseSharedCompilation=false` porque el sandbox impide la comunicación con el servidor de compilación compartido. Las pruebas no requieren abrir puertos TCP ni modificar certificados.

**Pendiente:** login exitoso, contraseña incorrecta y cuenta inactiva con cuentas reales de SQL. Estos casos pasaron con el repositorio en memoria; la base real todavía requiere hashes válidos elegidos por el responsable. Tampoco se probaron navegador, React ni despliegue productivo.

## Archivos y paquetes

Modificados: `backend/UtaFlow.Api/Program.cs`, `UtaFlow.Api.csproj`, `UtaFlow.Api.http`, `appsettings.json`, `backend/UtaFlow.Infrastructure/UtaFlow.Infrastructure.csproj`, `backend/UtaFlow.sln` y `README.md`.

Creados:

- `backend/UtaFlow.Domain/Authentication/Usuario.cs`.
- `backend/UtaFlow.Application/Authentication/`: `AuthContracts.cs`, `AuthService.cs`, `IPasswordService.cs`, `IUsuarioRepository.cs`.
- `backend/UtaFlow.Infrastructure/Authentication/`: `SqlConnectionFactory.cs`, `SqlUsuarioRepository.cs`, `IdentityPasswordService.cs`.
- `backend/UtaFlow.Api/ApiBootstrap.cs`, `Controllers/AuthController.cs`, `Authentication/JwtSettings.cs`, `JwtTokenIssuer.cs`, `ApiExceptionHandler.cs`.
- `backend/tools/UtaFlow.AuthTool/`: proyecto y `Program.cs`.
- `backend/UtaFlow.Api.Tests/`: proyecto, `AuthEndpointTests.cs`, `SecurityConfigurationTests.cs`, `SqlServerIntegrationTests.cs`.
- Este documento.

Referencias NuGet añadidas:

| Proyecto | Paquete | Versión |
| --- | --- | --- |
| Infrastructure | Microsoft.Data.SqlClient | 6.1.7 |
| Infrastructure | System.Security.Cryptography.Pkcs | 10.0.13 |
| Api | Microsoft.AspNetCore.Authentication.JwtBearer | 10.0.13 |
| Api.Tests | Microsoft.AspNetCore.TestHost | 10.0.12 |
| Api.Tests | Microsoft.NET.Test.Sdk | 17.14.1 |
| Api.Tests | xunit | 2.9.3 |
| Api.Tests | xunit.runner.visualstudio | 3.1.4 |

Infrastructure también referencia el framework compartido `Microsoft.AspNetCore.App` para usar `PasswordHasher` de Identity; no incorpora entidades ni tablas de Identity. La referencia explícita a Pkcs sustituye la dependencia transitiva 9.0.11 que la restauración señaló como vulnerable.

La validación JWT y el limitador se basan en la documentación oficial de [autenticación JWT de ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/configure-jwt-bearer-authentication?view=aspnetcore-10.0) y [limitación de solicitudes](https://learn.microsoft.com/en-us/aspnet/core/performance/rate-limit?view=aspnetcore-10.0).
