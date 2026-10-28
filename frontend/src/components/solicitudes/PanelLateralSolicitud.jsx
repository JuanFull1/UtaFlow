
export default function PanelLateralSolicitud({
  detalle,
  usuario,
  comite,
  puedeVotar,
  voto,
  onVoto,
  comentarioVoto,
  onComentarioVoto,
  onRegistrarVoto,
  ocupado,
}) {
  const votos = detalle.votos || []
  const historial = detalle.historial || []
  const mensajes = detalle.mensajes || []

  const cantidades = {
    APROBAR: votos.filter((v) => v.voto === 'APROBAR').length,
    RECHAZAR: votos.filter((v) => v.voto === 'RECHAZAR').length,
    MODIFICAR: votos.filter((v) => v.voto === 'MODIFICAR').length,
  }

  const total = Number(detalle.comite?.totalIntegrantes || 0)
  const necesarios = Math.floor(total / 2) + 1

  const resultado =
    total > 0 && cantidades.APROBAR >= necesarios
      ? 'Aprobada por mayoría'
      : total > 0 && cantidades.RECHAZAR >= necesarios
        ? 'Rechazada por mayoría'
        : total > 0 && cantidades.MODIFICAR >= necesarios
          ? 'Modificación por mayoría'
          : 'Pendiente de mayoría'

  function fecha(valor) {
    if (!valor) return '—'

    const dato = new Date(valor)

    return Number.isNaN(dato.getTime())
      ? String(valor)
      : dato.toLocaleString('es-EC')
  }

  const yaVoto = votos.some(
    (registro) => registro.idUsuario === usuario.id
  )

  return (
    <aside className="uf-detail-aside">

      {comite && (
        <section className="uf-card">
          <h2>Votación del comité</h2>

          <div className="uf-vote-counts">
            <div>
              <strong>{cantidades.APROBAR}</strong>
              <small>Aprobar</small>
            </div>

            <div>
              <strong>{cantidades.RECHAZAR}</strong>
              <small>Rechazar</small>
            </div>

            <div>
              <strong>{cantidades.MODIFICAR}</strong>
              <small>Modificar</small>
            </div>
          </div>

          <p className="uf-vote-result">
            <b>{resultado}</b>
          </p>

          <p className="uf-hint">
            Mayoría requerida: {necesarios} de {total} integrantes.
          </p>

          <h3>Votos individuales</h3>

          {votos.length === 0 ? (
            <p className="text-muted small">
              Todavía no se registraron votos.
            </p>
          ) : (
            <div className="uf-vote-list">
              {votos.map((registro) => (
                <div key={registro.idVoto}>
                  <strong>{registro.integrante}</strong>
                  <span>{registro.voto}</span>

                  {registro.comentario && (
                    <p className="uf-pre">
                      {registro.comentario}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {puedeVotar && detalle.analisis && (
            <form
              className="uf-form mt-3"
              onSubmit={onRegistrarVoto}
            >
              <h3>
                {yaVoto ? 'Actualizar mi voto' : 'Registrar mi voto'}
              </h3>

              <label>
                Mi voto
                <select
                  className="form-select"
                  value={voto}
                  onChange={(e) => onVoto(e.target.value)}
                >
                  <option value="APROBAR">Aprobar</option>
                  <option value="RECHAZAR">Rechazar</option>
                  <option value="MODIFICAR">Solicitar modificación</option>
                </select>
              </label>

              <label>
                Justificación individual
                <textarea
                  className="form-control"
                  rows={3}
                  maxLength={500}
                  value={comentarioVoto}
                  onChange={(e) =>
                    onComentarioVoto(e.target.value)
                  }
                />
              </label>

              <button
                className="btn btn-primary"
                type="submit"
                disabled={ocupado}
              >
                Guardar mi voto
              </button>
            </form>
          )}
        </section>
      )}

      <section className="uf-card">
        <h2>Línea de tiempo</h2>

        <ol className="uf-timeline">
          {historial.map((h, indice) => (
            <li key={`${h.fecha}-${indice}`}>
              <b>{h.estado}</b>

              <small>
                {fecha(h.fecha)}
              </small>

              <small>
                Por: {h.actor || 'Sistema'}
              </small>

              {h.comentario && (
                <p className="uf-pre">{h.comentario}</p>
              )}
            </li>
          ))}
        </ol>

        {historial.length === 0 && (
          <p>No existen movimientos registrados.</p>
        )}
      </section>

      <section className="uf-card">
        <h2>Observaciones y respuestas</h2>

        {mensajes.map((m) => (
          <article key={m.idMensaje} className="uf-message">
            <b>{m.emisor}</b>
            <p className="uf-pre">{m.mensaje}</p>
            <small>{fecha(m.fecha)}</small>
          </article>
        ))}

        {mensajes.length === 0 && (
          <p className="text-muted small">
            Todavía no existen observaciones.
          </p>
        )}
      </section>
    </aside>
  )
}
