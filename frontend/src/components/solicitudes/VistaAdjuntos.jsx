
import { useEffect, useState } from 'react'
import { descargarAdjuntoAutenticado } from '../../services/authService.js'
import './VistaAdjuntos.css'

function Adjunto({
  archivo,
  idSolicitud,
  onDescargar,
}) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [ampliado, setAmpliado] = useState(false)

  const esImagen =
    archivo.tipoMime === 'image/png' ||
    archivo.tipoMime === 'image/jpeg'

  useEffect(() => {
    if (!esImagen) return

    let activo = true
    let objeto = null

    descargarAdjuntoAutenticado(
      `/api/solicitudes-internas/${idSolicitud}/adjuntos/${archivo.idAdjunto}`
    )
      .then((blob) => {
        if (!activo) return

        objeto = URL.createObjectURL(blob)
        setUrl(objeto)
      })
      .catch((e) => {
        if (activo) setError(e.message)
      })

    return () => {
      activo = false

      if (objeto) {
        URL.revokeObjectURL(objeto)
      }
    }
  }, [
    esImagen,
    idSolicitud,
    archivo.idAdjunto,
  ])

  return (
    <article className="uf-evidence-card">
      {esImagen && url ? (
        <button
          type="button"
          className="uf-evidence-preview"
          onClick={() => setAmpliado(true)}
          aria-label={`Ampliar ${archivo.nombreOriginal}`}
        >
          <img
            src={url}
            alt={`Captura adjunta: ${archivo.nombreOriginal}`}
            loading="lazy"
          />
        </button>
      ) : (
        <div className="uf-evidence-placeholder">
          {esImagen ? 'Cargando imagen…' : 'Documento PDF'}
        </div>
      )}

      <div className="uf-evidence-info">
        <strong>{archivo.nombreOriginal}</strong>

        {error && (
          <small role="alert">{error}</small>
        )}

        <button
          type="button"
          className="btn btn-sm btn-outline-primary"
          onClick={() => onDescargar(archivo)}
        >
          Descargar archivo
        </button>
      </div>

      {ampliado && url && (
        <div
          className="uf-evidence-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Vista ampliada de la evidencia"
        >
          <div className="uf-evidence-modal-content">
            <button
              type="button"
              className="btn btn-light"
              onClick={() => setAmpliado(false)}
            >
              Cerrar imagen ×
            </button>

            <img
              src={url}
              alt={archivo.nombreOriginal}
            />
          </div>
        </div>
      )}
    </article>
  )
}

export default function VistaAdjuntos({
  archivos = [],
  idSolicitud,
  onDescargar,
}) {
  return (
    <section className="uf-evidence-section">
      <h3>Evidencias adjuntas</h3>

      {archivos.length === 0 ? (
        <p>No se adjuntaron capturas ni documentos.</p>
      ) : (
        <div className="uf-evidence-grid">
          {archivos.map((archivo) => (
            <Adjunto
              key={archivo.idAdjunto}
              archivo={archivo}
              idSolicitud={idSolicitud}
              onDescargar={onDescargar}
            />
          ))}
        </div>
      )}
    </section>
  )
}
