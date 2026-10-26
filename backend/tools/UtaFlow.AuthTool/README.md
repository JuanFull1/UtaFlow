# Cuenta de desarrollo para probar autenticación

`create-test-user` crea únicamente `Experto de Pruebas`, correo `experto.pruebas@utaflow.local`, activo y con rol `EXPERTO`. Reutiliza `IdentityPasswordService` y la lectura oculta de contraseña de la herramienta existente. No imprime ni guarda contraseñas, hashes o JWT.

Antes de usarlo, comprobar explícitamente que la instancia local y la base `UtaFlow` son de desarrollo. Iniciar la API con el perfil `https` y la configuración descrita en [autenticación backend](../../../docs/autenticacion-backend.md). El certificado HTTPS debe ser confiable.

Desde la raíz del repositorio, en una consola interactiva de PowerShell:

```powershell
$env:ASPNETCORE_ENVIRONMENT = 'Development'
# Establecer esta confirmación únicamente después de verificar el entorno.
$env:UTAFLOW_CONFIRMED_DEVELOPMENT = "$env:COMPUTERNAME/UtaFlow"
$env:ConnectionStrings__UtaFlow = 'Server=localhost;Database=UtaFlow;Integrated Security=True;Encrypt=True;TrustServerCertificate=True;Connect Timeout=5'
dotnet run --project backend/tools/UtaFlow.AuthTool -- create-test-user
```

La contraseña se introduce dos veces con entrada oculta y debe tener de 12 a 128 caracteres. No pasarla como argumento ni mediante variables de entorno. El comando requiere entrada interactiva y una confirmación de desarrollo que coincida con el equipo real; comprueba también servidor, base, rol y ausencia de la cuenta antes de solicitarla.

La inserción utiliza parámetros y una transacción serializable que vuelve a comprobar el correo para evitar duplicados. El ID de rol se obtiene por `Codigo = 'EXPERTO'`; no se usa un identificador fijo ni se actualizan usuarios existentes.

Después comprueba identidad y hash almacenados, login `200`, JWT aceptado por `/api/auth/me` con identidad y rol correctos, y rechazo `401` de una contraseña aleatoria distinta. HTTPS conserva la validación del certificado. Solo se emiten resultados controlados y metadatos de la cuenta. Se guarda un informe sin secretos en `test-user-result.json` junto al ejecutable, dentro de `bin/` ignorado por Git.

Si la cuenta ya existe, el comando se detiene sin sobrescribirla. Si ocurre un error después del commit SQL, el informe indica que la cuenta ya fue creada; no la elimina ni modifica automáticamente. Revisar ese resultado antes de repetir el comando.

Los comandos anteriores `hash` y `check-db` se conservan. `hash` imprime su resultado como antes; para esta actividad se usa `create-test-user`, que mantiene el hash en memoria y lo envía directamente a SQL.
