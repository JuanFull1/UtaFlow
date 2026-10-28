# Entrega de la interfaz de login

Rama: `feature/login-frontend`. Alcance: una pantalla React con validaciones locales, sin integración de autenticación y sin modificaciones de backend o SQL.

## Implementación

Se reemplazó la pantalla de ejemplo de Vite por la composición de la referencia: tarjeta central con columnas 45/55, formulario blanco, panel azul marino con textura de puntos, tarjetas ilustrativas y pies alineados abajo. Bootstrap aporta la estructura y las utilidades; CSS propio controla proporciones, colores, tipografía, espaciados y estados. La marca y los iconos son SVG reales; la imagen de referencia no se usa como fondo ni como interfaz.

Los campos empiezan vacíos. Se validan correo obligatorio, formato de correo, contraseña obligatoria y longitudes compatibles con el contrato del backend. Los errores se asocian a sus campos; enviar datos inválidos enfoca el primer campo con error. El ojo muestra y oculta la contraseña y anuncia su estado mediante atributos accesibles.

Enviar valores válidos muestra que la conexión con el servidor corresponde a la siguiente etapa. No se simula éxito, no se hacen solicitudes a la API ni se guardan datos en almacenamiento del navegador.

SSO y recuperación de contraseña tienen `aria-disabled`, descripción accesible y tooltip «Próximamente». No navegan ni ejecutan autenticación. Recordar sesión aparece marcado y deshabilitado con una descripción de su disponibilidad futura.

## Diferencias intencionales respecto a la imagen

- Las certificaciones se sustituyeron por «Acceso protegido», «Autenticación JWT» y «Control de roles», características del backend existente cuya integración visual está pendiente.
- La descripción no promete automatización ni despliegues que todavía no existen.
- Las tarjetas están identificadas como ilustrativas, con datos de ejemplo y sin métricas de disponibilidad ni resultados empresariales.
- El testimonio y las estrellas se sustituyeron por la frase institucional e iconos de seguridad, trazabilidad y organización.
- Se utilizó Arial/Helvetica, al no existir un archivo o identificación de la fuente original. No se garantiza coincidencia de píxeles con la tipografía de una imagen rasterizada.
- En móvil los paneles se apilan, los campos y botón aumentan a 44 px de alto y el panel informativo continúa debajo del formulario.

## Verificación

- `npm run build`: correcto. Vite requirió ejecutarse fuera del sandbox porque sus procesos auxiliares estaban bloqueados con `EPERM`.
- `npm run lint`: correcto, sin errores.
- Bootstrap 5.3.8 importado antes de los estilos propios en `src/main.jsx`.
- Comparación visual directa mediante Chrome headless y capturas en 917 × 637 (proporción de la imagen adjunta), 915 × 717, 1440 × 900, 768 × 1024, 390 × 844 y 320 × 780.
- No se detectó desplazamiento horizontal en las seis resoluciones.
- Comprobadas en navegador las validaciones, enfoque del primer error, mostrar/ocultar contraseña, envío mediante Enter y mensaje informativo al completar los campos.
- Comprobado que SSO y recuperación no realizan acciones, que no se emiten solicitudes `/api/`, que no se crean entradas en `localStorage`/`sessionStorage` y que no hay errores de consola o excepciones JavaScript.
- La pantalla funcionó con Vite sin levantar la API.
- `git diff --exit-code -- backend database`: correcto, sin cambios en esos directorios. No se ejecutaron operaciones contra SQL Server.

Las capturas y el comprobador de navegador se generaron como artefactos locales en `node_modules/.cache/utaflow-qa/`, ignorados por Git. No se añadió una dependencia de automatización ni un navegador al proyecto; se utilizó Chrome ya instalado.

## Archivos

Creados:

- `src/components/auth/AuthIcon.jsx`: iconos SVG reutilizables.
- `src/components/auth/LoginBranding.jsx`: marca de UtaFlow.
- `src/components/auth/LoginShowcase.jsx`: panel informativo y ejemplos.
- `src/pages/auth/Login.jsx`: formulario, estado local y validaciones.
- `src/pages/auth/Login.css`: diseño y adaptación responsive.
- `docs/login-frontend.md`: este informe.

Modificados: `src/App.jsx`, `src/index.css`, `src/main.jsx`, `index.html`, `public/favicon.svg`, `package.json`, `package-lock.json` y `README.md`.

Eliminado: `src/App.css`, que solo contenía los estilos de la plantilla Vite reemplazada. Se conservaron los recursos de ejemplo que ya no se importan para evitar eliminaciones innecesarias.

Dependencia directa agregada: `bootstrap` 5.3.8. npm también resolvió su dependencia peer `@popperjs/core` 2.11.8; la pantalla importa únicamente el CSS de Bootstrap, sin necesitar su JavaScript.

## Ejecución y pendientes

Desde `frontend`:

```powershell
npm install
npm run dev
```

Abrir la URL local indicada por Vite. Para compilar y revisar código: `npm run build` y `npm run lint`.

Pendientes para una entrega posterior: conectar la API, gestionar JWT y sesión, proteger rutas, implementar cierre de sesión y mostrar una bienvenida autenticada. SSO, recuperación y persistencia requieren sus propios servicios antes de habilitarse.

Cambios limitados al directorio `frontend`, pendientes de revisión. No se hicieron commits ni push.
