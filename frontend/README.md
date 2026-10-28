# UtaFlow — Frontend

Interfaz de inicio de sesión en React + Vite, Bootstrap 5 y CSS personalizado, construida a partir de la imagen de referencia.

Desde esta carpeta:

```powershell
npm install
npm run dev
```

Abre la dirección local que muestre Vite, normalmente `http://localhost:5173`.

```powershell
npm run build
npm run lint
```

El formulario utiliza la API JWT existente. Antes de ejecutar Vite, copia `.env.example` a `.env.local`; configura `VITE_API_BASE_URL=https://localhost:7003` y reinicia Vite si cambia. El backend debe permitir el origen exacto `http://localhost:5173`. Vite utiliza ese puerto sin cambiar automáticamente a otro.

La sesión se mantiene en memoria y se pierde al recargar o cerrar la pestaña. No hay refresh tokens ni opción de recordar sesión durante 30 días. El acceso solo se confirma después de validar la identidad en `/api/auth/me`.

La navegación utiliza React Router: `/login` es público; `/app/experto` admite solo EXPERTO; COMITE y ADMIN reciben la bienvenida provisional de `/app`. Las secciones de usuario final y comité permanecen deshabilitadas. Consulta el [informe de rutas, sesiones y permisos](docs/rutas-sesiones-roles.md) para la matriz completa y las pruebas de navegación.

Consulta [integración JWT, ejecución y pruebas](docs/integracion-login-jwt.md) para configurar la API, preparar una cuenta de desarrollo y conocer las verificaciones pendientes. Las pruebas del servicio se ejecutan con `npm test` y usan respuestas HTTP simuladas, sin modificar SQL Server.

Consulta el [informe de implementación y verificación](docs/login-frontend.md) para ver archivos, dependencias, diferencias respecto a la referencia y comprobaciones realizadas.
