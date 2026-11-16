import { useEffect, useState } from 'react'
import { solicitudesInternasService as api } from '../../services/solicitudesInternasService.js'

const PREGUNTAS = [
  ['cambioRealizado', '¿Se hizo el cambio pedido y no se agregó nada más?'],
  ['revisionTecnica', '¿Se hizo una revisión técnica del cambio?'],
  ['procesoSeguido', '¿Se siguió el proceso y los estándares del equipo?'],
  ['cambioRegistrado', '¿Quedaron registrados la fecha, el autor y la versión?'],
  ['relacionadosActualizados', '¿Se actualizaron los elementos y documentos relacionados?'],
]

const ETIQUETAS_AUDITORIA = {
  AudCambioRealizado: PREGUNTAS[0][1],
  AudRevisionTecnica: PREGUNTAS[1][1],
  AudProcesoSeguido: PREGUNTAS[2][1],
  AudCambioRegistrado: PREGUNTAS[3][1],
  AudRelacionadosActualizados: PREGUNTAS[4][1],
}

const fecha = (valor) =>
  valor ? new Date(valor).toLocaleString('es-EC') : '—'

const IMPL_INICIAL = {
  versionLiberada: '',
  ramaGit: '',
  enlaceGit: '',
  notas: '',
}

const REV_INICIAL = {
  cambioRealizado: false,
  revisionTecnica: false,
  procesoSeguido: false,
  cambioRegistrado: false,
  relacionadosActualizados: false,
  observaciones: '',
}

const CIERRE_INICIAL = { resultado: '', comentario: '' }

// Etapas 4 a 6 del ciclo ITIL: implementación, revisión y cierre.
export default function CicloCambio({
  solicitud,
  versionPrevista,
  experto,
  comite,
  ocupado,
  ejecutar,
}) {
  const estado = solicitud.estadoCodigo
  const id = solicitud.id

  const [ciclo, setCiclo] = useState(null)
  const [impl, setImpl] = useState({
    ...IMPL_INICIAL,
    versionLiberada: versionPrevista || '',
  })
  const [rev, setRev] = useState(REV_INICIAL)
  const [cierre, setCierre] = useState(CIERRE_INICIAL)
  const [github, setGithub] = useState(null)
  const [consultando, setConsultando] = useState(false)

  useEffect(() => {
    let activo = true

    api
      .ciclo(id)
      .then((datos) => {
        if (activo) setCiclo(datos || null)
      })
      .catch(() => {
        if (activo) setCiclo(null)
      })

    return () => {
      activo = false
    }
  }, [id, estado])

  const enCiclo = [
    'APROBADA',
    'EN_IMPLEMENTACION',
    'EN_REVISION',
    'CERRADA',
  ].includes(estado)

  async function consultarGitHub() {
    setConsultando(true)

    try {
      setGithub(await api.actividadGitHub(id))
    } catch {
      setGithub({
        actividad: [],
        aviso: 'No se pudo consultar GitHub.',
      })
    } finally {
      setConsultando(false)
    }
  }

  if (!enCiclo) {
    return null
  }

  const cambiar = (setter) => (e) => {
    const { name, value, type, checked } = e.target
    setter((anterior) => ({
      ...anterior,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const revisado = Boolean(ciclo?.FechaRevision ?? ciclo?.fechaRevision)
  const v = (clave) => ciclo?.[clave] ?? ciclo?.[clave[0].toLowerCase() + clave.slice(1)]

  return (
    <section className="uf-card uf-ciclo">
      <h2>Implementación, revisión y cierre</h2>

      <ol className="uf-ciclo-pasos">
        <li className={estado === 'APROBADA' ? 'actual' : 'hecho'}>
          Aprobada
        </li>
        <li
          className={
            estado === 'EN_IMPLEMENTACION'
              ? 'actual'
              : estado === 'APROBADA'
                ? ''
                : 'hecho'
          }
        >
          Implementación
        </li>
        <li
          className={
            estado === 'EN_REVISION'
              ? 'actual'
              : estado === 'CERRADA'
                ? 'hecho'
                : ''
          }
        >
          Revisión
        </li>
        <li className={estado === 'CERRADA' ? 'hecho' : ''}>Cierre</li>
      </ol>

      {/* ---------- 1. Iniciar */}
      {estado === 'APROBADA' && (
        <>
          <p className="text-muted">
            El comité aprobó este cambio. El experto lo implementa y
            registra la versión que se libera.
          </p>

          {experto ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={ocupado}
              onClick={() =>
                ejecutar(
                  () => api.iniciarImplementacion(id),
                  'Implementación iniciada.'
                )
              }
            >
              Iniciar implementación
            </button>
          ) : (
            <p className="uf-hint">
              Esperando que el experto inicie la implementación.
            </p>
          )}
        </>
      )}

      {/* ---------- 2. Registrar implementación */}
      {estado === 'EN_IMPLEMENTACION' &&
        (experto ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()

              ejecutar(
                () =>
                  api.registrarImplementacion(id, {
                    versionLiberada: impl.versionLiberada.trim(),
                    ramaGit: impl.ramaGit.trim() || null,
                    enlaceGit: impl.enlaceGit.trim() || null,
                    notas: impl.notas.trim() || null,
                  }),
                'Implementación registrada. La solicitud pasa a revisión.'
              )
            }}
          >
            <p className="text-muted">
              Cuando termines, registra qué versión se liberó y enlaza el
              trabajo en GitHub.
            </p>

            <div className="uf-form-grid">
              <label>
                Versión liberada *
                <input
                  className="form-control"
                  name="versionLiberada"
                  maxLength={50}
                  required
                  value={impl.versionLiberada}
                  onChange={cambiar(setImpl)}
                  placeholder="Ej. 1.2.0"
                />
              </label>

              <label>
                Rama de Git
                <input
                  className="form-control"
                  name="ramaGit"
                  maxLength={150}
                  value={impl.ramaGit}
                  onChange={cambiar(setImpl)}
                  placeholder="Ej. feature/horarios-rutas"
                />
              </label>
            </div>

            <label>
              Enlace en GitHub (commit, Pull Request o release)
              <input
                className="form-control"
                type="url"
                name="enlaceGit"
                maxLength={400}
                value={impl.enlaceGit}
                onChange={cambiar(setImpl)}
                placeholder="https://github.com/usuario/proyecto/pull/12"
              />
            </label>

            <label>
              Notas de la implementación
              <textarea
                className="form-control"
                name="notas"
                rows={3}
                maxLength={2000}
                value={impl.notas}
                onChange={cambiar(setImpl)}
              />
            </label>

            <div className="uf-form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={ocupado || !impl.versionLiberada.trim()}
              >
                Terminar implementación
              </button>
            </div>
          </form>
        ) : (
          <p className="uf-hint">
            El experto está implementando el cambio.
          </p>
        ))}

      {/* ---------- 3. Revisión y 4. Cierre */}
      {estado === 'EN_REVISION' && (
        <>
          <ResumenImplementacion v={v} />

          {comite ? (
            <>
              <form
                className="uf-ciclo-bloque"
                onSubmit={(e) => {
                  e.preventDefault()

                  ejecutar(
                    () =>
                      api.registrarRevision(id, {
                        ...rev,
                        observaciones: rev.observaciones.trim() || null,
                      }),
                    'Revisión y auditoría registradas.'
                  )
                }}
              >
                <h3>Revisión y auditoría</h3>

                <p className="text-muted small">
                  Marca lo que se cumplió. Lo que dejes sin marcar queda
                  como incumplido en el reporte.
                </p>

                <div className="uf-checkbox-grid">
                  {PREGUNTAS.map(([clave, texto]) => (
                    <label key={clave} className="uf-option-check">
                      <input
                        type="checkbox"
                        name={clave}
                        checked={rev[clave]}
                        onChange={cambiar(setRev)}
                      />
                      <span>{texto}</span>
                    </label>
                  ))}
                </div>

                <label>
                  Observaciones
                  <textarea
                    className="form-control"
                    name="observaciones"
                    rows={2}
                    maxLength={2000}
                    value={rev.observaciones}
                    onChange={cambiar(setRev)}
                  />
                </label>

                <div className="uf-form-actions">
                  <button
                    type="submit"
                    className="btn btn-outline-primary"
                    disabled={ocupado}
                  >
                    {revisado ? 'Actualizar revisión' : 'Guardar revisión'}
                  </button>
                </div>
              </form>

              <form
                className="uf-ciclo-bloque"
                onSubmit={(e) => {
                  e.preventDefault()

                  ejecutar(
                    () =>
                      api.cerrarCambio(id, {
                        resultado: cierre.resultado,
                        comentario: cierre.comentario.trim() || null,
                      }),
                    'Cambio cerrado correctamente.'
                  )
                }}
              >
                <h3>Cierre del cambio</h3>

                {!revisado && (
                  <p className="uf-hint">
                    Guarda primero la revisión para poder cerrar.
                  </p>
                )}

                <div className="uf-checkbox-grid">
                  {[
                    ['EXITOSO', 'Exitoso'],
                    ['FALLIDO', 'Fallido'],
                    ['INCOMPLETO', 'Incompleto'],
                  ].map(([valor, texto]) => (
                    <label key={valor} className="uf-option-check">
                      <input
                        type="radio"
                        name="resultado"
                        value={valor}
                        checked={cierre.resultado === valor}
                        onChange={cambiar(setCierre)}
                      />
                      <span>{texto}</span>
                    </label>
                  ))}
                </div>

                <label>
                  Comentario
                  {cierre.resultado &&
                    cierre.resultado !== 'EXITOSO' &&
                    ' * (obligatorio si no fue exitoso)'}
                  <textarea
                    className="form-control"
                    name="comentario"
                    rows={2}
                    maxLength={1000}
                    value={cierre.comentario}
                    onChange={cambiar(setCierre)}
                  />
                </label>

                <div className="uf-form-actions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={
                      ocupado ||
                      !revisado ||
                      !cierre.resultado ||
                      (cierre.resultado !== 'EXITOSO' &&
                        !cierre.comentario.trim())
                    }
                  >
                    Cerrar cambio
                  </button>
                </div>
              </form>
            </>
          ) : (
            <p className="uf-hint">
              Esperando la revisión y el cierre por parte del comité.
            </p>
          )}
        </>
      )}

      {/* ---------- Actividad en GitHub */}
      <div className="uf-ciclo-bloque">
        <h3>Actividad en GitHub</h3>

        <p className="text-muted small">
          Escribe el identificador{' '}
          <code>{solicitud.identificadorBase}</code> en el título del Pull
          Request o en el mensaje del commit, y aparecerá aquí. (No uses el
          código de seguimiento del cliente: es privado.)
        </p>

        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          disabled={consultando}
          onClick={consultarGitHub}
        >
          {consultando ? 'Consultando…' : 'Buscar en GitHub'}
        </button>

        {github?.aviso && (
          <p className="uf-hint">{github.aviso}</p>
        )}

        {github && !github.aviso && !github.actividad?.length && (
          <p className="uf-hint">
            Todavía no hay Pull Requests ni commits con este código en{' '}
            {github.repositorio}.
          </p>
        )}

        {github?.actividad?.length > 0 && (
          <ul className="uf-ciclo-auditoria">
            {github.actividad.map((a) => (
              <li key={a.url}>
                <b>{a.tipo}</b>
                {a.estado ? ` (${a.estado})` : ''} ·{' '}
                <a href={a.url} target="_blank" rel="noopener noreferrer">
                  {a.titulo}
                </a>
                {a.autor ? ` · ${a.autor}` : ''}

                {estado === 'EN_IMPLEMENTACION' && experto && (
                  <button
                    type="button"
                    className="btn btn-link btn-sm"
                    onClick={() =>
                      setImpl((anterior) => ({
                        ...anterior,
                        enlaceGit: a.url,
                      }))
                    }
                  >
                    Usar como enlace
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ---------- Cerrada: resumen de solo lectura */}
      {estado === 'CERRADA' && (
        <>
          <ResumenImplementacion v={v} />

          <h3>Revisión y auditoría</h3>
          <ul className="uf-ciclo-auditoria">
            {Object.entries(ETIQUETAS_AUDITORIA).map(([clave, texto]) => (
              <li key={clave}>
                <b>{v(clave) ? 'Sí' : 'No'}</b> · {texto}
              </li>
            ))}
          </ul>
          {v('ObservacionesRevision') && (
            <p className="uf-pre">{v('ObservacionesRevision')}</p>
          )}

          <h3>Cierre</h3>
          <p>
            <b>{v('ResultadoCierre')}</b> · {fecha(v('FechaCierre'))} · por{' '}
            {v('CerradoPor') || '—'}
          </p>
          {v('ComentarioCierre') && (
            <p className="uf-pre">{v('ComentarioCierre')}</p>
          )}
        </>
      )}
    </section>
  )
}

function ResumenImplementacion({ v }) {
  if (!v('VersionLiberada')) return null

  const enlace = v('EnlaceGit')

  return (
    <div className="uf-ciclo-bloque">
      <h3>Implementación</h3>
      <p>
        Versión liberada: <b>{v('VersionLiberada')}</b>
        {v('RamaGit') && <> · rama <code>{v('RamaGit')}</code></>}
      </p>
      <p>
        Por {v('Implementador') || '—'} · {fecha(v('FechaImplementacion'))}
      </p>
      {enlace && /^https?:\/\//i.test(enlace) && (
        <p>
          <a href={enlace} target="_blank" rel="noopener noreferrer">
            Ver en GitHub
          </a>
        </p>
      )}
      {v('NotasImplementacion') && (
        <p className="uf-pre">{v('NotasImplementacion')}</p>
      )}
    </div>
  )
}
