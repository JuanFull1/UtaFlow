
const API = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')

async function solicitar(ruta, opciones = {}) {
  if (!API) {
    throw new Error(
      'Configura VITE_API_BASE_URL en .env.local.'
    )
  }

  let respuesta

  try {
    respuesta = await fetch(
      `${API}/api/public/solicitudes${ruta}`,
      {
        cache: 'no-store',
        ...opciones,
        headers: {
          'Content-Type': 'application/json',
          ...opciones.headers,
        },
      }
    )
  } catch {
    throw new Error(
      'No se pudo conectar con la API. Verifica el backend.'
    )
  }

  const resultado = await respuesta.json().catch(() => null)

  if (!respuesta.ok) {
    throw new Error(
      resultado?.mensaje ||
      (
        respuesta.status === 429
          ? 'Demasiados intentos. Intenta más tarde.'
          : respuesta.status === 404
            ? 'No se encontró la solicitud.'
            : 'Ocurrió un problema en el servidor.'
      )
    )
  }

  return resultado
}

export function cargarCatalogos() {
  return solicitar('/catalogos', {
    method: 'GET',
  })
}

export function crearSolicitud(datos) {
  return solicitar('', {
    method: 'POST',
    body: JSON.stringify(datos),
  })
}

export function consultarSolicitud(codigo) {
  return solicitar('/consultar', {
    method: 'POST',
    body: JSON.stringify({ codigo }),
  })
}

export function responderSolicitud(codigo, mensaje) {
  return solicitar('/responder', {
    method: 'POST',
    body: JSON.stringify({ codigo, mensaje }),
  })
}

// NUEVO: Subir archivos mediante FormData.
// No establecer Content-Type manualmente.
export async function adjuntarEvidencia(codigo, archivo) {
  if (!API) {
    throw new Error('La API no está configurada.')
  }

  const datos = new FormData()
  datos.append('codigo', codigo)
  datos.append('archivo', archivo)

  let respuesta

  try {
    respuesta = await fetch(
      `${API}/api/public/solicitudes/adjuntos`,
      {
        method: 'POST',
        body: datos,
        cache: 'no-store',
      }
    )
  } catch {
    throw new Error('No se pudo subir el archivo.')
  }

  const resultado = await respuesta.json().catch(() => null)

  if (!respuesta.ok) {
    throw new Error(
      resultado?.mensaje ||
      'No fue posible guardar el archivo.'
    )
  }

  return resultado
}
