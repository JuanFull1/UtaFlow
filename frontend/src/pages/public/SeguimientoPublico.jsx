
import { useState } from 'react'
import { Link, useLocation } from 'react-router'

import {
  consultarSolicitud,
  responderSolicitud,
} from '../../services/solicitudesPublicasService.js'

import './Publico.css'

export default function SeguimientoPublico() {
  const location = useLocation()

  const [codigo, setCodigo] = useState(
    location.state?.codigo || ''
  )

  const [solicitud, setSolicitud] = useState(null)
  const [respuesta, setRespuesta] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const [cargando, setCargando] = useState(false)
  const [enviando, setEnviando] = useState(false)

  async function consultar(evento) {
    evento?.preventDefault()

    if (cargando) return

    setError('')
    setAviso('')
    setSolicitud(null)
    setCargando(true)

    try {
      const resultado = await consultarSolicitud(
        codigo.trim().toUpperCase()
      )

      setSolicitud(resultado)
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  async function responder(evento) {
    evento.preventDefault()

    if (enviando) return

    setError('')
    setAviso('')
    setEnviando(true)

    try {
      await responderSolicitud(
        codigo.trim().toUpperCase(),
        respuesta.trim()
      )

      setRespuesta('')

      setAviso(
        'Tu respuesta se envió correctamente al experto.'
      )

      const actualizada = await consultarSolicitud(
        codigo.trim().toUpperCase()
      )

      setSolicitud(actualizada)
    } catch (e) {
      setError(e.message)
    } finally {
      setEnviando(false)
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
            <Link to="/solicitud">
              Nueva solicitud
            </Link>

            <Link to="/login">
              Iniciar sesión
            </Link>
          </nav>
        </header>

        <div className="public-heading">
          <span className="public-eyebrow">
            SEGUIMIENTO DE CAMBIOS
          </span>

          <h1>Consulta tu solicitud</h1>

          <p>
            Ingresa el código único que recibiste al
            registrar tu solicitud.
          </p>
        </div>

        <form
          className="public-card public-search"
          onSubmit={consultar}
        >
          <label htmlFor="codigo-seguimiento">
            Código de seguimiento
          </label>

          <div className="public-search-row">
            <input
              id="codigo-seguimiento"
              className="form-control"
              required
              maxLength={40}
              autoComplete="off"
              spellCheck={false}
              placeholder="RFC-2026-..."
              value={codigo}
              onChange={(e) => {
                setCodigo(e.target.value)
                setSolicitud(null)
                setAviso('')
              }}
            />

            <button
              className="btn btn-primary"
              type="submit"
              disabled={cargando}
            >
              {cargando
                ? 'Consultando…'
                : 'Consultar'}
            </button>
          </div>
        </form>

        {error && (
          <div
            role="alert"
            className="alert alert-danger public-message"
          >
            {error}
          </div>
        )}

        {aviso && (
          <div
            role="status"
            className="alert alert-success public-message"
          >
            {aviso}
          </div>
        )}

        {solicitud && (
          <section className="public-card public-detail">
            <div className="public-detail-title">
              <div>
                <span className="public-eyebrow">
                  SOLICITUD EN SEGUIMIENTO
                </span>

                <h2>{solicitud.asunto}</h2>
              </div>

              <span className="public-status">
                {solicitud.estado}
              </span>
            </div>

            <dl className="public-meta">
              <div>
                <dt>Sistema</dt>
                <dd>{solicitud.sistema}</dd>
              </div>

              <div>
                <dt>Prioridad</dt>
                <dd>{solicitud.prioridad}</dd>
              </div>

              <div>
                <dt>Fecha de envío</dt>
                <dd>
                  {new Date(
                    solicitud.fechaEnvio
                  ).toLocaleString('es-EC')}
                </dd>
              </div>
            </dl>

            <h3>Descripción</h3>

            <p className="public-preserve">
              {solicitud.descripcion}
            </p>

            <h3>Historial del estado</h3>

            {solicitud.historial.length ? (
              <ol className="public-timeline">
                {solicitud.historial.map((h, i) => (
                  <li key={`${h.fecha}-${i}`}>
                    <strong>{h.estado}</strong>
                    {' · '}
                    {new Date(h.fecha).toLocaleString('es-EC')}
                  </li>
                ))}
              </ol>
            ) : (
              <p>No hay movimientos todavía.</p>
            )}

            <h3>Observaciones y respuestas</h3>

            {solicitud.mensajes.length ? (
              <div className="public-messages">
                {solicitud.mensajes.map((m) => (
                  <article key={m.idMensaje}>
                    <strong>
                      {m.emisor === 'PUBLICO'
                        ? 'Solicitante'
                        : m.emisor}
                    </strong>

                    <p className="public-preserve">
                      {m.mensaje}
                    </p>

                    <small>
                      {new Date(
                        m.fecha
                      ).toLocaleString('es-EC')}
                    </small>
                  </article>
                ))}
              </div>
            ) : (
              <p>No hay observaciones pendientes.</p>
            )}

            {solicitud.estadoCodigo ===
              'PENDIENTE_CLIENTE' && (
              <form
                className="public-response"
                onSubmit={responder}
              >
                <h3>Responder al experto</h3>

                <p>
                  La solicitud necesita información
                  adicional para continuar su revisión.
                </p>

                <label htmlFor="respuesta">
                  Tu respuesta *
                </label>

                <textarea
                  id="respuesta"
                  className="form-control"
                  rows={4}
                  required
                  minLength={2}
                  maxLength={2000}
                  value={respuesta}
                  onChange={(e) =>
                    setRespuesta(e.target.value)
                  }
                />

                <button
                  className="btn btn-primary"
                  disabled={
                    enviando ||
                    respuesta.trim().length < 2
                  }
                  type="submit"
                >
                  {enviando
                    ? 'Enviando…'
                    : 'Enviar respuesta'}
                </button>
              </form>
            )}
          </section>
        )}
      </div>
    </main>
  )
}
