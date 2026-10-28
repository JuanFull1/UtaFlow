# Ajuste de escala y proporciones del login

Rama: `feature/login-frontend`. Cambio exclusivamente visual sobre el login existente; no se modificó el árbol JSX, el contenido, las validaciones, los servicios ni la autenticación.

## Problemas encontrados

- `max-width: 1184px` limitaba la tarjeta incluso en monitores grandes.
- Los campos medían 32 px por defecto y 42 px en escritorio; el logo seguía en 29 px en todos los tamaños.
- El título de bienvenida variaba entre 16 y 21 px; varias etiquetas y tarjetas permanecían en 7–12 px.
- Las media queries reducían demasiado la tipografía en tablet.
- Los pies usaban `margin-top: auto`, separándolos del contenido; se midieron 77 px libres antes del pie de seguridad en 1440 × 900 y 186 px en tablet.
- Las restricciones de ancho de las descripciones y la frase institucional impedían aprovechar el panel.

## Ajustes realizados

Archivo de aplicación modificado: `src/pages/auth/Login.css`. Documento creado: `docs/ajuste-escala-login.md`.

Se conservaron colores, textura, bordes, sombras y columnas 45/55. No se agregaron dependencias ni funcionalidades.

| Elemento | Antes, en 1440 × 900 | Después, en 1440 × 900 |
| --- | --- | --- |
| Ancho de tarjeta | 1184 px | 1382 px aproximadamente |
| Altura de tarjeta | 760 px | 780 px |
| Logo | 29 × 29 px | 42 × 42 px |
| Nombre UtaFlow | 15 px | 20 px |
| Bienvenida | 21 px | 28,8 px |
| Descripción del formulario | 13 px | 15 px |
| Campos | 42 px de alto | 54 px de alto |
| Botón principal | 42 px de alto; texto de 14 px | 54 px de alto; texto de 16 px |
| Tarjeta RFC | 102 px de alto | 138 px de alto |
| Tarjeta de seguimiento | 90 px de alto | 112 px de alto |
| Separación antes del pie de seguridad | 77 px | 32 px |

Propiedades principales:

- `max-width: 1600px` y padding exterior fluido con `clamp()`.
- `min-height: min(780px, calc(100dvh - 48px))`, sin altura fija ni altura máxima que corte contenido. El contenido puede superar esta altura mínima.
- Padding de paneles con `clamp(32px, 3vw, 56px)` y escala de espacios de 8, 16, 24 y 32 px.
- Bienvenida con `font-size: clamp(26px, 2vw, 34px)` e interlineado 1,15.
- Título derecho con `font-size: clamp(30px, 2.4vw, 44px)`, interlineado 1,12 y ancho máximo de 660 px.
- Descripción del panel derecho de 16 px e interlineado 1,5; tarjetas con texto de 10–15 px, iconos y badges ampliados.
- Campos y botón de 52–54 px, con iconos de 18–19 px y padding horizontal mayor.
- Pies con separaciones explícitas de 24–40 px; se eliminó el margen automático que desconectaba el contenido.
- Media query para laptops bajas que compacta espacios sin reducir de nuevo la tipografía a tamaños pequeños.
- En tablet y móvil la cabecera de la tarjeta RFC usa CSS Grid sobre los mismos elementos existentes para que el badge no comprima el título. El override de `display` es explícito porque Bootstrap aplica `d-flex` con `!important`.
- En móvil se conservan los paneles apilados, los mismos controles y el scroll vertical natural.

No se usaron `transform: scale()` ni `zoom`.

## Verificación

- `npm run build`: correcto, Vite 8.3.5. Se ejecutó fuera del sandbox porque Vite necesita procesos auxiliares.
- `npm run lint`: correcto, sin errores.
- Bootstrap sigue importado antes de los estilos propios. No se cambiaron imports ni dependencias.
- Capturas antes/después en Chrome headless, utilizando el navegador ya instalado, sin añadir herramientas al proyecto.
- Resoluciones verificadas: **1920 × 1080, 1600 × 900, 1440 × 900, 1366 × 768, 1280 × 800, 1024 × 768, 768 × 1024, 390 × 844** y adicionalmente **320 × 780**.
- Sin desplazamiento horizontal en las nueve resoluciones. La laptop de 1366 × 768 conserva una tarjeta de 720 px de alto. En 1024 × 768 y móviles se permite crecimiento y scroll vertical natural.
- Se compararon visualmente las capturas y se corrigió la compresión del título RFC observada en la primera revisión de tablet.
- Se comprobaron campos obligatorios, correo inválido, foco del primer error, mostrar/ocultar contraseña, envío con Enter y mensaje de integración pendiente al completar los campos.
- SSO y recuperación siguen sin ejecutar acciones; no se observaron solicitudes `/api/`, errores de consola ni entradas de almacenamiento local o de sesión.
- Una comparación SHA-256 contra el estado al inicio del ajuste confirmó que solo cambió `Login.css` entre los archivos existentes. Se preservaron todos los cambios de la entrega anterior.
- `git diff --exit-code -- backend database`: sin diferencias. No se ejecutaron operaciones SQL.
- `git diff --check`: sin errores de whitespace.

## Límites de la comparación

El mensaje recibido incluyó el prompt, pero no las dos imágenes nuevas que este menciona. Se utilizaron sus medidas y criterios explícitos junto con una comparación visual del estado anterior y el resultado. No se afirma una coincidencia exacta con esa segunda imagen ausente.

Las capturas, métricas y el comprobador quedaron en `node_modules/.cache/utaflow-scale-qa/before/` y `after/`, fuera del control de versiones. No se alteró contenido para ajustar saltos de línea; estos varían de forma natural según el ancho disponible.

## Git y resumen del cambio

Al comenzar ya estaban pendientes los archivos de la implementación anterior del login. Este ajuste conserva ese trabajo y modifica únicamente el CSS indicado, además de añadir este informe. La comparación específica del ajuste puede consultarse contra `node_modules/.cache/utaflow-scale-qa/Login.before.css`; `git diff` global incluye también la entrega previa aún sin confirmar.

No se hicieron commits ni push. La integración con API/JWT permanece pendiente, fuera de este ajuste visual.
