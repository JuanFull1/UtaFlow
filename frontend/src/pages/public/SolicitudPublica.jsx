
import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import {
  cargarCatalogos,
  crearSolicitud,
  adjuntarEvidencia,
} from '../../services/solicitudesPublicasService.js'

import './Publico.css'

const INICIAL = {
  nombre: '',
  correo: '',
  telefono: '',
  cooperativa: '',
  idModulo: '',
  asunto: '',
  descripcion: '',
  razon: '',
  idPrioridad: '',
  afectacionActual: '',
  estadoDeseado: '',
  fechaLimite: '',
}

const PASOS = [
  'Tus datos',
  'El cambio',
  'Evidencias',
  'Revisar y enviar',
]

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const MAX_ARCHIVOS = 3
const MAX_BYTES = 5 * 1024 * 1024

const EXTENSIONES = ['jpg', 'jpeg', 'png', 'pdf']

// Campo con etiqueta, ayuda y mensaje de error junto a él.
function Campo({ id, etiqueta, ayuda, error, completo, children }) {
  return (
    <div className={completo ? 'public-full' : undefined}>
      <label htmlFor={`campo-${id}`} className="public-label">
        {etiqueta}
      </label>

      {children}

      {ayuda && !error && (
        <small className="public-hint">{ayuda}</small>
      )}

      {error && (
        <small className="public-error" role="alert">
          {error}
        </small>
      )}
    </div>
  )
}

export default function SolicitudPublica() {
  const [datos, setDatos] = useState(INICIAL)

  const [catalogos, setCatalogos] = useState({
    sistemas: [],
    prioridades: [],
    modulos: [],
  })

  const [paso, setPaso] = useState(0)
  const [errores, setErrores] = useState({})

  const [archivos, setArchivos] = useState([])
  const [error, setError] = useState('')
  const [advertencia, setAdvertencia] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    let activo = true

    cargarCatalogos()
      .then((resultado) => {
        if (activo) {
          setCatalogos({
            sistemas: resultado.sistemas || [],
            prioridades: resultado.prioridades || [],
            modulos: resultado.modulos || [],
          })
        }
      })
      .catch((e) => {
        if (activo) setError(e.message)
      })

    return () => {
      activo = false
    }
  }, [])

  function cambiar(evento) {
    const { name, value } = evento.target

    setDatos((anterior) => ({
      ...anterior,
      [name]: value,
    }))

    setErrores((anterior) => {
      if (!anterior[name]) return anterior

      const copia = { ...anterior }
      delete copia[name]
      return copia
    })

    setError('')
  }

  // Validación por paso, con un mensaje junto a cada campo.
  function validar(numero) {
    const e = {}

    if (numero === 0) {
      if (!datos.nombre.trim()) {
        e.nombre = 'Escribe tu nombre completo.'
      }

      if (!datos.correo.trim()) {
        e.correo = 'Escribe tu correo para poder responderte.'
      } else if (!CORREO.test(datos.correo.trim())) {
        e.correo = 'Revisa el correo: parece incompleto.'
      }
    }

    if (numero === 1) {
      if (!datos.asunto.trim()) {
        e.asunto = 'Ponle un título corto a tu solicitud.'
      }

      if (!datos.idPrioridad) {
        e.idPrioridad = 'Indica qué tan urgente es.'
      }

      if (datos.descripcion.trim().length < 10) {
        e.descripcion =
          'Cuéntanos qué necesitas (mínimo 10 caracteres).'
      }

      if (!datos.razon.trim()) {
        e.razon = 'Explica por qué necesitas este cambio.'
      }
    }

    return e
  }

  function irAlPrimerError(e) {
    const primero = Object.keys(e)[0]

    if (!primero) return

    window.setTimeout(() => {
      document.getElementById(`campo-${primero}`)?.focus()
    }, 0)
  }

  function siguiente() {
    const e = validar(paso)

    setErrores(e)

    if (Object.keys(e).length > 0) {
      irAlPrimerError(e)
      return
    }

    setPaso((actual) => Math.min(actual + 1, PASOS.length - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function anterior() {
    setErrores({})
    setPaso((actual) => Math.max(actual - 1, 0))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function seleccionarArchivos(evento) {
    const seleccionados = Array.from(
      evento.target.files || []
    )

    setError('')

    if (seleccionados.length > MAX_ARCHIVOS) {
      setError('Puedes adjuntar un máximo de 3 archivos.')
      setArchivos([])
      evento.target.value = ''
      return
    }

    for (const archivo of seleccionados) {
      const extension = archivo.name
        .split('.')
        .pop()
        .toLowerCase()

      if (!EXTENSIONES.includes(extension)) {
        setError(
          'Solo se permiten archivos JPG, PNG y PDF.'
        )

        setArchivos([])
        evento.target.value = ''
        return
      }

      if (
        archivo.size === 0 ||
        archivo.size > MAX_BYTES
      ) {
        setError(
          `El archivo "${archivo.name}" debe pesar menos de 5 MB.`
        )

        setArchivos([])
        evento.target.value = ''
        return
      }
    }

    setArchivos(seleccionados)
  }

  async function enviar(evento) {
    evento.preventDefault()

    if (enviando) return

    // Enter en los pasos intermedios solo avanza.
    if (paso < PASOS.length - 1) {
      siguiente()
      return
    }

    const pendientes = { ...validar(0), ...validar(1) }

    if (Object.keys(pendientes).length > 0) {
      setErrores(pendientes)
      setPaso(validar(0).nombre || validar(0).correo ? 0 : 1)
      irAlPrimerError(pendientes)
      return
    }

    setError('')
    setAdvertencia('')
    setEnviando(true)

    try {
      const respuesta = await crearSolicitud({
        nombre: datos.nombre.trim(),
        correo: datos.correo.trim(),

        telefono: datos.telefono.trim() || null,
        empresaArea: datos.cooperativa.trim() || null,
        idModulo: datos.idModulo
          ? Number(datos.idModulo)
          : null,

        asunto: datos.asunto.trim(),
        descripcion: datos.descripcion.trim(),
        razon: datos.razon.trim(),

        idPrioridad: Number(datos.idPrioridad),

        afectacionActual:
          datos.afectacionActual.trim() || null,

        estadoDeseado:
          datos.estadoDeseado.trim() || null,

        fechaLimite: datos.fechaLimite || null,
      })

      const codigoNuevo = respuesta.codigo

      // La solicitud ya está registrada.
      // El código se conserva aunque falle un adjunto.
      setCodigo(codigoNuevo)

      const fallidos = []

      for (const archivo of archivos) {
        try {
          await adjuntarEvidencia(codigoNuevo, archivo)
        } catch {
          fallidos.push(archivo.name)
        }
      }

      if (fallidos.length > 0) {
        setAdvertencia(
          'La solicitud se registró, pero no se pudieron ' +
          'subir estos archivos: ' +
          fallidos.join(', ')
        )
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }

  const sistemasConModulos = catalogos.sistemas.filter((sis) =>
    catalogos.modulos.some((m) => m.idSistema === sis.id)
  )

  const moduloElegido = catalogos.modulos.find(
    (m) => String(m.id) === String(datos.idModulo)
  )?.nombre

  const prioridadElegida = catalogos.prioridades.find(
    (p) => String(p.id) === String(datos.idPrioridad)
  )?.nombre

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo)
      setCopiado(true)
    } catch {
      setCopiado(false)
    }
  }

  return (
    <main className="utaflow-publico">
      <div className="public-container">

        <header className="public-header">
          <Link to="/login" className="public-brand">
            UF <span>UtaFlow</span>
          </Link>

          <nav aria-label="Navegación pública">
            <Link to="/seguimiento">
              Consultar solicitud
            </Link>

            <Link to="/login">
              Iniciar sesión
            </Link>
          </nav>
        </header>

        {codigo ? (
          <section
            className="public-card public-success"
            aria-live="polite"
          >
            <span className="public-eyebrow">
              SOLICITUD ENVIADA
            </span>

            <h1>
              ¡Tu solicitud se registró correctamente!
            </h1>

            <p>
              Guarda este código para consultar tu
              solicitud sin iniciar sesión.
            </p>

            <div className="public-code-box">
              <span>Tu código de seguimiento</span>

              <strong>{codigo}</strong>

              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={copiar}
              >
                {copiado ? 'Copiado' : 'Copiar código'}
              </button>
            </div>

            {enviando && (
              <p role="status">
                Guardando las evidencias adjuntas…
              </p>
            )}

            {!enviando && advertencia && (
              <div
                className="alert alert-warning"
                role="alert"
              >
                {advertencia}
              </div>
            )}

            {!enviando && (
              <>
                <ol className="public-next">
                  <li>
                    Tu solicitud ya llegó al comité de cambios.
                  </li>
                  <li>
                    Un experto puede agregar su análisis técnico
                    para apoyar la decisión.
                  </li>
                  <li>
                    Con tu código puedes ver el avance. Si
                    necesitan más información, te lo
                    indicarán ahí.
                  </li>
                </ol>

                <p className="public-helper">
                  El código es privado. No lo compartas
                  con otras personas.
                </p>

                <div className="public-actions">
                  <Link
                    className="btn btn-primary"
                    to="/seguimiento"
                    state={{ codigo }}
                  >
                    Consultar mi solicitud
                  </Link>

                  <Link
                    className="btn btn-outline-secondary"
                    to="/login"
                  >
                    Volver al inicio
                  </Link>
                </div>
              </>
            )}
          </section>
        ) : (
          <>
            <div className="public-heading">
              <span className="public-eyebrow">
                SOLICITUD PÚBLICA
              </span>

              <h1>
                Registra tu solicitud de cambio
              </h1>

              <p>
                No necesitas iniciar sesión.
                Completa la información y adjunta
                evidencias si las tienes.
              </p>
            </div>

            <ol className="public-steps" aria-label="Progreso">
              {PASOS.map((nombre, i) => (
                <li
                  key={nombre}
                  className={
                    i === paso
                      ? 'actual'
                      : i < paso
                        ? 'hecho'
                        : ''
                  }
                  aria-current={i === paso ? 'step' : undefined}
                >
                  <span>{i < paso ? '✓' : i + 1}</span>
                  {nombre}
                </li>
              ))}
            </ol>

            <form
              className="public-card public-form"
              onSubmit={enviar}
              noValidate
            >
              {paso === 0 && (
                <>
                  <h2>Cuéntanos quién eres</h2>
                  <p className="public-hint">
                    Usaremos estos datos solo para responderte
                    sobre tu solicitud.
                  </p>

                  <div className="public-grid">
                    <Campo
                      id="nombre"
                      etiqueta="Nombre completo *"
                      error={errores.nombre}
                    >
                      <input
                        id="campo-nombre"
                        className="form-control"
                        name="nombre"
                        value={datos.nombre}
                        onChange={cambiar}
                        maxLength={150}
                        autoComplete="name"
                        aria-invalid={!!errores.nombre}
                      />
                    </Campo>

                    <Campo
                      id="correo"
                      etiqueta="Correo electrónico *"
                      error={errores.correo}
                    >
                      <input
                        id="campo-correo"
                        className="form-control"
                        type="email"
                        name="correo"
                        value={datos.correo}
                        onChange={cambiar}
                        maxLength={200}
                        autoComplete="email"
                        aria-invalid={!!errores.correo}
                      />
                    </Campo>

                    <Campo
                      id="telefono"
                      etiqueta="Teléfono (opcional)"
                    >
                      <input
                        id="campo-telefono"
                        className="form-control"
                        type="tel"
                        name="telefono"
                        value={datos.telefono}
                        onChange={cambiar}
                        maxLength={30}
                        autoComplete="tel"
                      />
                    </Campo>

                    <Campo
                      id="cooperativa"
                      etiqueta="Cooperativa (opcional)"
                      ayuda="Ej. Cooperativa de transporte"
                    >
                      <input
                        id="campo-cooperativa"
                        className="form-control"
                        name="cooperativa"
                        value={datos.cooperativa}
                        onChange={cambiar}
                        maxLength={150}
                      />
                    </Campo>
                  </div>
                </>
              )}

              {paso === 1 && (
                <>
                  <h2>¿Qué necesitas que cambie?</h2>
                  <p className="public-hint">
                    Escríbelo con tus palabras, sin términos
                    técnicos. El experto se encarga de la parte
                    técnica.
                  </p>

                  <div className="public-grid">
                    <Campo
                      id="asunto"
                      etiqueta="Título de la solicitud *"
                      ayuda="Ej. Mostrar el horario de cada ruta"
                      error={errores.asunto}
                      completo
                    >
                      <input
                        id="campo-asunto"
                        className="form-control"
                        name="asunto"
                        value={datos.asunto}
                        onChange={cambiar}
                        maxLength={200}
                        aria-invalid={!!errores.asunto}
                      />
                    </Campo>

                    <Campo
                      id="idModulo"
                      etiqueta="¿En qué parte del sistema? (opcional)"
                      ayuda="Si no estás seguro, déjalo así."
                    >
                      <select
                        id="campo-idModulo"
                        className="form-select"
                        name="idModulo"
                        value={datos.idModulo}
                        onChange={cambiar}
                      >
                        <option value="">No lo sé</option>

                        {sistemasConModulos.map((sistema) => (
                          <optgroup
                            key={sistema.id}
                            label={sistema.nombre}
                          >
                            {catalogos.modulos
                              .filter(
                                (m) => m.idSistema === sistema.id
                              )
                              .map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.nombre}
                                </option>
                              ))}
                          </optgroup>
                        ))}
                      </select>
                    </Campo>

                    <Campo
                      id="idPrioridad"
                      etiqueta="¿Qué tan urgente es? *"
                      error={errores.idPrioridad}
                    >
                      <select
                        id="campo-idPrioridad"
                        className="form-select"
                        name="idPrioridad"
                        value={datos.idPrioridad}
                        onChange={cambiar}
                        aria-invalid={!!errores.idPrioridad}
                      >
                        <option value="">Selecciona</option>

                        {catalogos.prioridades.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>
                    </Campo>

                    <Campo
                      id="descripcion"
                      etiqueta="¿Qué problema o necesidad tienes? *"
                      error={errores.descripcion}
                      completo
                    >
                      <textarea
                        id="campo-descripcion"
                        className="form-control"
                        name="descripcion"
                        rows={4}
                        value={datos.descripcion}
                        onChange={cambiar}
                        maxLength={4000}
                        aria-invalid={!!errores.descripcion}
                      />
                    </Campo>

                    <Campo
                      id="razon"
                      etiqueta="¿Por qué es importante? *"
                      error={errores.razon}
                      completo
                    >
                      <textarea
                        id="campo-razon"
                        className="form-control"
                        name="razon"
                        rows={3}
                        value={datos.razon}
                        onChange={cambiar}
                        maxLength={500}
                        aria-invalid={!!errores.razon}
                      />
                    </Campo>

                    <Campo
                      id="afectacionActual"
                      etiqueta="¿Cómo te afecta hoy? (opcional)"
                      completo
                    >
                      <textarea
                        id="campo-afectacionActual"
                        className="form-control"
                        name="afectacionActual"
                        rows={2}
                        value={datos.afectacionActual}
                        onChange={cambiar}
                        maxLength={1000}
                      />
                    </Campo>

                    <Campo
                      id="estadoDeseado"
                      etiqueta="¿Cómo esperas que quede después del cambio? (opcional)"
                      completo
                    >
                      <textarea
                        id="campo-estadoDeseado"
                        className="form-control"
                        name="estadoDeseado"
                        rows={2}
                        value={datos.estadoDeseado}
                        onChange={cambiar}
                        maxLength={2000}
                      />
                    </Campo>

                    <Campo
                      id="fechaLimite"
                      etiqueta="¿Para qué fecha lo necesitas? (opcional)"
                    >
                      <input
                        id="campo-fechaLimite"
                        className="form-control"
                        type="date"
                        name="fechaLimite"
                        value={datos.fechaLimite}
                        onChange={cambiar}
                      />
                    </Campo>
                  </div>
                </>
              )}

              {paso === 2 && (
                <>
                  <h2>¿Tienes evidencias? (opcional)</h2>
                  <p className="public-hint">
                    Una captura del error o un documento ayuda
                    mucho a entender tu solicitud.
                  </p>

                  <div className="public-evidence">
                    <label htmlFor="archivos-solicitud">
                      Seleccionar archivos
                    </label>

                    <input
                      id="archivos-solicitud"
                      type="file"
                      className="form-control"
                      accept=".jpg,.jpeg,.png,.pdf"
                      multiple
                      disabled={enviando}
                      onChange={seleccionarArchivos}
                    />

                    <small>
                      JPG, PNG o PDF. Máximo 3 archivos
                      de 5 MB cada uno.
                    </small>

                    {archivos.length > 0 && (
                      <ul className="public-file-list">
                        {archivos.map((archivo, indice) => (
                          <li key={`${archivo.name}-${indice}`}>
                            {archivo.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}

              {paso === 3 && (
                <>
                  <h2>Revisa y envía</h2>
                  <p className="public-hint">
                    Confirma que todo esté bien. Puedes volver
                    atrás para corregir algo.
                  </p>

                  <dl className="public-review">
                    <div>
                      <dt>Nombre</dt>
                      <dd>{datos.nombre}</dd>
                    </div>
                    <div>
                      <dt>Correo</dt>
                      <dd>{datos.correo}</dd>
                    </div>
                    {datos.cooperativa && (
                      <div>
                        <dt>Cooperativa</dt>
                        <dd>{datos.cooperativa}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Título</dt>
                      <dd>{datos.asunto}</dd>
                    </div>
                    <div>
                      <dt>Parte del sistema</dt>
                      <dd>{moduloElegido || 'No indicado'}</dd>
                    </div>
                    <div>
                      <dt>Urgencia</dt>
                      <dd>{prioridadElegida || '—'}</dd>
                    </div>
                    <div className="public-full">
                      <dt>Qué necesitas</dt>
                      <dd>{datos.descripcion}</dd>
                    </div>
                    <div className="public-full">
                      <dt>Por qué es importante</dt>
                      <dd>{datos.razon}</dd>
                    </div>
                    {datos.estadoDeseado && (
                      <div className="public-full">
                        <dt>Cómo esperas que quede</dt>
                        <dd>{datos.estadoDeseado}</dd>
                      </div>
                    )}
                    <div className="public-full">
                      <dt>Evidencias</dt>
                      <dd>
                        {archivos.length
                          ? archivos.map((a) => a.name).join(', ')
                          : 'Sin archivos'}
                      </dd>
                    </div>
                  </dl>

                  <p className="public-helper">
                    Tu solicitud llegará al comité de cambios.
                    Un experto puede agregar su análisis técnico
                    para ayudar a decidir.
                  </p>
                </>
              )}

              {error && (
                <div
                  className="alert alert-danger"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <div className="public-nav">
                {paso > 0 && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={anterior}
                    disabled={enviando}
                  >
                    ← Atrás
                  </button>
                )}

                {paso < PASOS.length - 1 ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={siguiente}
                  >
                    Siguiente →
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="btn btn-primary public-submit"
                    disabled={
                      enviando ||
                      !catalogos.prioridades.length
                    }
                  >
                    {enviando
                      ? 'Registrando solicitud…'
                      : 'Enviar solicitud'}
                  </button>
                )}
              </div>
            </form>
          </>
        )}
      </div>
    </main>
  )
}
