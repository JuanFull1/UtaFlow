import { useMemo, useState } from 'react'
import './TablaIssues.css'

const CERRADOS = ['CERRADA', 'RECHAZADA']

// Color de cada etiqueta según su categoría y valor.
const COLOR_PRIORIDAD = {
  baja: 'verde',
  media: 'amarillo',
  alta: 'naranja',
  critica: 'rojo',
  crítica: 'rojo',
}

const COLOR_TIPO = {
  ESTANDAR: 'gris',
  NORMAL: 'azul',
  EMERGENCIA: 'rojo',
}

const COLOR_ESTADO = {
  EN_COMITE: 'azul',
  ENVIADA: 'azul',
  MODIFICACION: 'amarillo',
  PENDIENTE_CLIENTE: 'amarillo',
  PENDIENTE_EXPERTO: 'amarillo',
  APROBADA: 'verde',
  EN_IMPLEMENTACION: 'morado',
  EN_REVISION: 'morado',
  CERRADA: 'gris',
  RECHAZADA: 'rojo',
}

function etiquetas(s) {
  const lista = [
    {
      clave: 'estado',
      valor: s.estado,
      color: COLOR_ESTADO[s.estadoCodigo] || 'gris',
    },
    {
      clave: 'tipo',
      valor: s.tipoCambio,
      color: COLOR_TIPO[s.tipoCambio] || 'gris',
    },
    {
      clave: 'prioridad',
      valor: s.prioridad,
      color:
        COLOR_PRIORIDAD[String(s.prioridad || '').toLowerCase()] ||
        'gris',
    },
    { clave: 'sistema', valor: s.sistema, color: 'turquesa' },
  ]

  if (s.modulo) {
    lista.push({ clave: 'modulo', valor: s.modulo, color: 'rosa' })
  }

  return lista.filter((e) => e.valor)
}

const fecha = (valor) =>
  valor ? new Date(valor).toLocaleDateString('es-EC') : ''

// Vista de cambios al estilo de GitHub Issues:
// abiertos / cerrados, etiquetas de colores y filtros.
export default function TablaIssues({ solicitudes = [], onAbrir }) {
  const [abiertas, setAbiertas] = useState(true)
  const [texto, setTexto] = useState('')
  const [filtro, setFiltro] = useState(null) // { clave, valor }

  const esCerrada = (s) => CERRADOS.includes(s.estadoCodigo)

  const abiertos = solicitudes.filter((s) => !esCerrada(s)).length
  const cerrados = solicitudes.length - abiertos

  const visibles = useMemo(() => {
    const t = texto.trim().toLowerCase()

    return solicitudes
      .filter((s) => (abiertas ? !esCerrada(s) : esCerrada(s)))
      .filter(
        (s) =>
          !filtro ||
          etiquetas(s).some(
            (e) => e.clave === filtro.clave && e.valor === filtro.valor
          )
      )
      .filter(
        (s) =>
          !t ||
          [s.identificador, s.codigo, s.asunto, s.solicitante, s.sistema, s.modulo]
            .some((v) => String(v || '').toLowerCase().includes(t))
      )
  }, [solicitudes, abiertas, texto, filtro])

  return (
    <section className="uf-card uf-issues">
      <h2>Cambios</h2>

      <p className="text-muted">
        Cada solicitud es un cambio con su número y sus etiquetas, como
        una issue de GitHub. Haz clic en una etiqueta para filtrar.
      </p>

      <div className="uf-issues-barra">
        <input
          className="form-control"
          type="search"
          placeholder="Buscar por código, título, solicitante, sistema o módulo"
          aria-label="Buscar cambios"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />

        {filtro && (
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setFiltro(null)}
          >
            Quitar filtro: {filtro.valor} ✕
          </button>
        )}
      </div>

      <div className="uf-issues-caja">
        <div className="uf-issues-tabs">
          <button
            type="button"
            className={abiertas ? 'activo' : ''}
            onClick={() => setAbiertas(true)}
          >
            ● {abiertos} abiertos
          </button>

          <button
            type="button"
            className={!abiertas ? 'activo' : ''}
            onClick={() => setAbiertas(false)}
          >
            ✓ {cerrados} cerrados
          </button>
        </div>

        <ul className="uf-issues-lista">
          {visibles.map((s) => (
            <li key={s.id}>
              <span
                className={
                  'uf-issue-icono ' +
                  (s.estadoCodigo === 'RECHAZADA'
                    ? 'rechazada'
                    : esCerrada(s)
                      ? 'cerrada'
                      : 'abierta')
                }
                aria-hidden="true"
              >
                {esCerrada(s) ? '✓' : '●'}
              </span>

              <div className="uf-issue-cuerpo">
                <div className="uf-issue-titulo">
                  <button
                    type="button"
                    className="uf-issue-enlace"
                    onClick={() => onAbrir(s.id)}
                  >
                    {s.asunto}
                  </button>

                  {etiquetas(s).map((e) => (
                    <button
                      key={e.clave}
                      type="button"
                      className={`uf-etiqueta ${e.color}`}
                      title={`Filtrar por ${e.clave}: ${e.valor}`}
                      onClick={() =>
                        setFiltro({ clave: e.clave, valor: e.valor })
                      }
                    >
                      {e.valor}
                    </button>
                  ))}
                </div>

                <small>
                  {s.identificador || s.codigo} · abierto el {fecha(s.fechaEnvio)} por{' '}
                  {s.solicitante || 'Solicitante'}
                </small>
              </div>
            </li>
          ))}

          {!visibles.length && (
            <li className="uf-issues-vacio">
              No hay cambios {abiertas ? 'abiertos' : 'cerrados'} con
              esos filtros.
            </li>
          )}
        </ul>
      </div>
    </section>
  )
}
