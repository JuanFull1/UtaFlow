
export default function DecisionColectiva({
  detalle,
  usuario,
  datos,
  onChange,
  onSubmit,
  ocupado,
}) {
  const comite = detalle.comite
  const decisionRegistrada = detalle.decisionComite
  const votos = detalle.votos || []

  const esPrincipal =
    comite?.idPrincipal === usuario.id

  const total = Number(
    comite?.totalIntegrantes || 0
  )

  const necesarios = Math.floor(total / 2) + 1

  const aprobar = votos.filter(
    (v) => v.voto === 'APROBAR'
  ).length

  const rechazar = votos.filter(
    (v) => v.voto === 'RECHAZAR'
  ).length

  const modificar = votos.filter(
    (v) => v.voto === 'MODIFICAR'
  ).length

  const resultado =
    total > 0 && aprobar >= necesarios
      ? 'APROBADA'
      : total > 0 && rechazar >= necesarios
        ? 'RECHAZADA'
        : total > 0 && modificar >= necesarios
          ? 'MODIFICACION'
          : ''

  const participantes = votos
    .map((v) => v.integrante)
    .join(', ')

  const fechaActual = new Date().toLocaleDateString('es-EC')

  // =====================================================
  // DECISION COLECTIVA YA FORMALIZADA
  // =====================================================

  if (decisionRegistrada) {
    return (
      <section className="uf-card">
        <h2>Decisión final del comité</h2>

        <div className="alert alert-success">
          Decisión colectiva formalizada:
          <strong>
            {' '}{decisionRegistrada.resultado}
          </strong>
        </div>

        <div className="uf-form-grid">
          <div>
            <b>Fecha de decisión</b>
            <p>
              {new Date(
                decisionRegistrada.fechaDecision
              ).toLocaleString('es-EC')}
            </p>
          </div>

          <div>
            <b>Formalizada por</b>
            <p>
              {decisionRegistrada.formalizadoPor}
            </p>
          </div>

          <div>
            <b>Versión prevista</b>
            <p>
              {decisionRegistrada.versionPrevista || '—'}
            </p>
          </div>

          <div>
            <b>Integrantes participantes</b>
            <p>
              {decisionRegistrada.revisadoPor}
            </p>
          </div>
        </div>

        <h3>Resultado de la votación</h3>

        <div className="uf-vote-counts">
          <div>
            <strong>
              {decisionRegistrada.votosAprobar}
            </strong>
            <small>Aprobar</small>
          </div>

          <div>
            <strong>
              {decisionRegistrada.votosRechazar}
            </strong>
            <small>Rechazar</small>
          </div>

          <div>
            <strong>
              {decisionRegistrada.votosModificar}
            </strong>
            <small>Modificar</small>
          </div>
        </div>

        <h3>Justificación general del comité</h3>

        <p className="uf-pre">
          {decisionRegistrada.justificacion}
        </p>

        <h3>Condiciones u observaciones</h3>

        <p className="uf-pre">
          {decisionRegistrada.condiciones ||
            'Sin condiciones adicionales.'}
        </p>

        <p className="uf-hint">
          Este documento representa la decisión
          colectiva del comité, formalizada por
          su responsable principal.
        </p>
      </section>
    )
  }

  // =====================================================
  // DECISION PENDIENTE DE MAYORIA
  // =====================================================

  return (
    <section className="uf-card">
      <h2>Decisión del comité</h2>

      <p className="text-muted">
        Este apartado documenta el acuerdo colectivo.
        Los votos individuales se muestran
        en el panel lateral.
      </p>

      {!resultado && (
        <div className="alert alert-info">
          Todavía no existe una mayoría suficiente.
          Se requieren {necesarios} votos coincidentes
          de {total} integrantes activos.
        </div>
      )}

      {/* LA MAYORIA YA EXISTE, PERO NO ES EL PRINCIPAL */}

      {resultado && !esPrincipal && (
        <div className="alert alert-info">
          El comité ha alcanzado una mayoría para:
          <strong> {resultado}</strong>.

          <p className="mb-0 mt-2">
            La formalización de esta decisión
            corresponde a{' '}
            <strong>
              {comite?.nombrePrincipal ||
                'el responsable principal'}
            </strong>.
          </p>
        </div>
      )}

      {/* FORMULARIO SOLO PARA EL RESPONSABLE PRINCIPAL */}

      {esPrincipal && resultado && (
        <form
          className="uf-form"
          onSubmit={onSubmit}
        >
          <h3>Registrar la decisión colectiva</h3>

          <p className="text-muted">
            Como responsable principal, registra
            el resultado acordado por el comité.
            No se trata de un voto adicional.
          </p>

          <div className="uf-form-grid">
            <label>
              Decisión colectiva *

              <select
                className="form-select"
                value={resultado}
                disabled
              >
                <option value={resultado}>
                  {resultado}
                </option>
              </select>
            </label>

            <label>
              Fecha de decisión *

              <input
                className="form-control"
                value={fechaActual}
                readOnly
              />
            </label>

            <label>
              Revisado por (integrantes que votaron) *

              <textarea
                className="form-control"
                rows={3}
                readOnly
                value={participantes}
              />
            </label>

            <label>
              Versión en la que se incluirá el cambio
              {resultado === 'APROBADA' ? ' *' : ''}

              <input
                className="form-control"
                name="versionPrevista"
                value={datos.versionPrevista}
                onChange={onChange}
                maxLength={50}
                required={resultado === 'APROBADA'}
                placeholder="Ej. 2.0.0"
              />

              <small className="text-muted">
                Obligatoria si el comité aprueba el cambio.
              </small>
            </label>
          </div>

          <div className="uf-form-grid">
            <label>
              Justificación general del comité *

              <textarea
                className="form-control"
                name="justificacion"
                rows={5}
                minLength={10}
                maxLength={2000}
                value={datos.justificacion}
                onChange={onChange}
                required
                placeholder="Explica los motivos que respaldan la decisión colectiva."
              />
            </label>

            <label>
              Condiciones u observaciones

              <textarea
                className="form-control"
                name="condiciones"
                rows={5}
                maxLength={2000}
                value={datos.condiciones}
                onChange={onChange}
                placeholder="Indica las condiciones, restricciones o aclaraciones del comité."
              />
            </label>
          </div>

          <div className="uf-form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={ocupado}
            >
              {ocupado
                ? 'Registrando decisión…'
                : 'Formalizar decisión del comité'}
            </button>
          </div>
        </form>
      )}

      <p className="uf-hint mt-3">
        Política actual: mayoría absoluta.
        La decisión final se registra únicamente
        cuando se alcanza la mayoría y el responsable
        principal completa la justificación colectiva.
      </p>
    </section>
  )
}
