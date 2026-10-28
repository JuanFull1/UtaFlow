
import { useMemo, useState } from 'react'
import './TableroEtapas.css'

const ETAPAS = [
  {
    id: 'registradas',
    titulo: 'Registradas',
    descripcion: 'Esperan revisión del experto',
    coincide: (s) =>
      s.estadoCodigo === 'ENVIADA' && !s.tieneAnalisis,
  },
  {
    id: 'analisis',
    titulo: 'En análisis',
    descripcion: 'Con evaluación técnica guardada',
    coincide: (s) =>
      s.estadoCodigo === 'ENVIADA' && s.tieneAnalisis,
  },
  {
    id: 'comite',
    titulo: 'En comité',
    descripcion: 'Esperan una decisión',
    coincide: (s) => s.estadoCodigo === 'EN_COMITE',
  },
  {
    id: 'devueltas',
    titulo: 'Devueltas',
    descripcion: 'Esperan información o correcciones',
    coincide: (s) =>
      [
        'MODIFICACION',
        'PENDIENTE_CLIENTE',
        'PENDIENTE_EXPERTO',
      ].includes(s.estadoCodigo),
  },
  {
    id: 'decididas',
    titulo: 'Decididas',
    descripcion: 'Aprobadas y rechazadas',
    coincide: (s) =>
      ['APROBADA', 'RECHAZADA'].includes(s.estadoCodigo),
  },
]

function necesitaAccion(solicitud, experto) {
  if (experto) {
    return [
      'ENVIADA',
      'PENDIENTE_EXPERTO',
    ].includes(solicitud.estadoCodigo)
  }

  return solicitud.estadoCodigo === 'EN_COMITE'
}

function ordenar(a, b) {
  const urgencia = (s) =>
    s.tipoCambio === 'EMERGENCIA' ? 1 : 0

  return (
    urgencia(b) - urgencia(a) ||
    new Date(b.fechaEnvio) - new Date(a.fechaEnvio)
  )
}

export default function TableroEtapas({
  solicitudes = [],
  experto = false,
  pendientes = 0,
  resueltas = 0,
  onAbrir,
  onNueva,
  onVerLista,
}) {
  const [soloMiAccion, setSoloMiAccion] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()

    return solicitudes
      .filter((s) =>
        !soloMiAccion || necesitaAccion(s, experto)
      )
      .filter((s) => {
        if (!texto) return true

        return [
          s.codigo,
          s.asunto,
          s.solicitante,
          s.sistema,
          s.prioridad,
        ].some((valor) =>
          String(valor || '')
            .toLowerCase()
            .includes(texto)
        )
      })
      .sort(ordenar)
  }, [solicitudes, soloMiAccion, busqueda, experto])

  return (
    <div className="uf-board">
      <section className="uf-board-summary">
        <div>
          <span>Total de solicitudes</span>
          <strong>{solicitudes.length}</strong>
        </div>

        <div>
          <span>Requieren acción de mi rol</span>
          <strong>{pendientes}</strong>
        </div>

        <div>
          <span>Aprobadas o rechazadas</span>
          <strong>{resueltas}</strong>
        </div>
      </section>

      <section className="uf-board-toolbar">
        <div className="uf-board-toolbar-heading">
          <h2>Tablero de solicitudes</h2>
          <p>
            {experto
              ? 'Revisa, analiza y envía los cambios al comité.'
              : 'Consulta las evaluaciones y decide sobre los cambios.'}
          </p>
        </div>

        <div className="uf-board-actions">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={onVerLista}
          >
            Ver lista
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={onNueva}
          >
            + Nueva solicitud
          </button>
        </div>
      </section>

      <section
        className="uf-board-filters"
        aria-label="Filtros del tablero"
      >
        <label className="uf-board-filter-check">
          <input
            type="checkbox"
            checked={soloMiAccion}
            onChange={(e) =>
              setSoloMiAccion(e.target.checked)
            }
          />
          Solo las que requieren mi acción
        </label>

        <input
          type="search"
          className="form-control"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por código, título o solicitante..."
          aria-label="Buscar solicitudes"
        />
      </section>

      <div className="uf-board-scroll">
        <div className="uf-board-columns">
          {ETAPAS.map((etapa) => {
            const elementos = visibles.filter(etapa.coincide)

            return (
              <section
                key={etapa.id}
                className={`uf-board-column uf-stage-${etapa.id}`}
                aria-label={etapa.titulo}
              >
                <header className="uf-board-column-header">
                  <div>
                    <h3>{etapa.titulo}</h3>
                    <p>{etapa.descripcion}</p>
                  </div>
                  <span>{elementos.length}</span>
                </header>

                <div className="uf-board-items">
                  {elementos.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      className="uf-board-item"
                      onClick={() => onAbrir(s.id)}
                    >
                      <span className="uf-board-item-head">
                        <strong>{s.codigo}</strong>
                        <small>{s.origen}</small>
                      </span>

                      <span className="uf-board-item-title">
                        {s.asunto}
                      </span>

                      {s.tipoCambio === 'EMERGENCIA' && (
                        <span className="uf-board-emergency">
                          Cambio de emergencia
                        </span>
                      )}

                      <span className="uf-board-item-meta">
                        {s.prioridad || 'Sin prioridad'}
                      </span>

                      <span className="uf-board-item-person">
                        {s.solicitante || 'Solicitante'}
                      </span>

                      <span className="uf-board-item-status">
                        {s.estado}
                      </span>
                    </button>
                  ))}

                  {elementos.length === 0 && (
                    <p className="uf-board-empty">
                      No hay solicitudes en esta etapa.
                    </p>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </div>

      <p className="uf-board-footnote">
        Selecciona una tarjeta para abrir su información,
        evaluación, evidencias e historial.
      </p>
    </div>
  )
}
