
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
  empresaArea: '',
  moduloAfectado: '',
  asunto: '',
  descripcion: '',
  razon: '',
  idPrioridad: '',
  afectacionActual: '',
  comentariosAdicionales: '',
  fechaLimite: '',
}

const MAX_ARCHIVOS = 3
const MAX_BYTES = 5 * 1024 * 1024

const EXTENSIONES = ['jpg', 'jpeg', 'png', 'pdf']

export default function SolicitudPublica() {
  const [datos, setDatos] = useState(INICIAL)

  const [catalogos, setCatalogos] = useState({
    sistemas: [],
    prioridades: [],
  })

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
        if (activo) setCatalogos(resultado)
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

    setError('')
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

    setError('')
    setAdvertencia('')
    setEnviando(true)

    try {
      const respuesta = await crearSolicitud({
        nombre: datos.nombre.trim(),
        correo: datos.correo.trim(),

        telefono: datos.telefono.trim() || null,
        empresaArea: datos.empresaArea.trim() || null,
        moduloAfectado:
          datos.moduloAfectado.trim() || null,

        asunto: datos.asunto.trim(),
        descripcion: datos.descripcion.trim(),
        razon: datos.razon.trim(),

        idPrioridad: Number(datos.idPrioridad),

        afectacionActual:
          datos.afectacionActual.trim() || null,

        comentariosAdicionales:
          datos.comentariosAdicionales.trim() || null,

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

            <form
              className="public-card public-form"
              onSubmit={enviar}
            >
              <h2>1. Datos del solicitante</h2>

              <div className="public-grid">
                <label>
                  Nombre completo *
                  <input
                    className="form-control"
                    name="nombre"
                    value={datos.nombre}
                    onChange={cambiar}
                    required
                    maxLength={150}
                  />
                </label>

                <label>
                  Correo electrónico *
                  <input
                    className="form-control"
                    type="email"
                    name="correo"
                    value={datos.correo}
                    onChange={cambiar}
                    required
                    maxLength={200}
                  />
                </label>

                <label>
                  Teléfono (opcional)
                  <input
                    className="form-control"
                    type="tel"
                    name="telefono"
                    value={datos.telefono}
                    onChange={cambiar}
                    maxLength={30}
                  />
                </label>

                <label>
                  Empresa o área (opcional)
                  <input
                    className="form-control"
                    name="empresaArea"
                    value={datos.empresaArea}
                    onChange={cambiar}
                    maxLength={150}
                  />
                </label>
              </div>

              <h2>2. Información del cambio</h2>

              <div className="public-grid">

                <label>
                  Módulo afectado (opcional)
                  <input
                    className="form-control"
                    name="moduloAfectado"
                    value={datos.moduloAfectado}
                    onChange={cambiar}
                    maxLength={150}
                    placeholder="Ej. Registro de facturas"
                  />
                </label>

                <label>
                  Urgencia percibida *
                  <select
                    className="form-select"
                    name="idPrioridad"
                    value={datos.idPrioridad}
                    onChange={cambiar}
                    required
                  >
                    <option value="">
                      Selecciona la urgencia
                    </option>

                    {catalogos.prioridades.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="public-full">
                  Título de la solicitud *
                  <input
                    className="form-control"
                    name="asunto"
                    value={datos.asunto}
                    onChange={cambiar}
                    required
                    maxLength={200}
                    placeholder="Ej. Agregar búsqueda de facturas"
                  />
                </label>

                <label className="public-full">
                  Describe el problema o necesidad *
                  <textarea
                    className="form-control"
                    name="descripcion"
                    rows={4}
                    value={datos.descripcion}
                    onChange={cambiar}
                    required
                    minLength={10}
                    maxLength={4000}
                  />
                </label>

                <label className="public-full">
                  Justificación del cambio *
                  <textarea
                    className="form-control"
                    name="razon"
                    rows={3}
                    value={datos.razon}
                    onChange={cambiar}
                    required
                    maxLength={500}
                  />
                </label>

                <label className="public-full">
                  ¿Cómo te afecta actualmente?
                  <textarea
                    className="form-control"
                    name="afectacionActual"
                    rows={2}
                    value={datos.afectacionActual}
                    onChange={cambiar}
                    maxLength={1000}
                  />
                </label>

                <label className="public-full">
                  Comentarios adicionales
                  <textarea
                    className="form-control"
                    name="comentariosAdicionales"
                    rows={2}
                    value={datos.comentariosAdicionales}
                    onChange={cambiar}
                    maxLength={1000}
                  />
                </label>

                <label>
                  Fecha deseada (opcional)
                  <input
                    className="form-control"
                    type="date"
                    name="fechaLimite"
                    value={datos.fechaLimite}
                    onChange={cambiar}
                  />
                </label>
              </div>

              <h2>3. Evidencias adicionales (opcional)</h2>

              <div className="public-evidence">
                <p>
                  Adjunta capturas del error, pantallas
                  del sistema o documentos de apoyo.
                </p>

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

              <p className="public-helper">
                Los campos marcados con * son obligatorios.
                El experto realizará posteriormente
                la evaluación técnica.
              </p>

              {error && (
                <div
                  className="alert alert-danger"
                  role="alert"
                >
                  {error}
                </div>
              )}

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
            </form>
          </>
        )}
      </div>
    </main>
  )
}
