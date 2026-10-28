import AuthIcon from './AuthIcon.jsx'

function RequestPreview() {
  return (
    <div className="request-preview showcase-preview">
      <div className="request-heading d-flex align-items-center">
        <span className="rfc-number">RFC-2026<br />0002</span>
        <span className="request-title" title="Actualización del módulo de reportes">Actualización del módulo de reportes</span>
        <span className="request-status"><span className="status-dot" />Evaluación técnica<br />completada</span>
      </div>
      <div className="request-details d-flex align-items-end">
        <div><span className="detail-label">RIESGO</span><span className="detail-value">Bajo</span></div>
        <div><span className="detail-label">COMITÉ</span><span className="detail-value">Pendiente</span></div>
        <span className="tracking-pill"><AuthIcon name="trace" />Seguimiento de estados</span>
      </div>
    </div>
  )
}

function TrackingPreview() {
  return (
    <div className="tracking-preview showcase-preview d-flex align-items-center">
      <span className="tracking-symbol"><AuthIcon name="badge" /></span>
      <div className="tracking-copy">
        <h3>Seguimiento de solicitudes</h3>
        <p>Registro de estados, análisis técnico y resoluciones.</p>
      </div>
      <div className="tracking-indicators d-flex">
        <span><AuthIcon name="list" />Solicitudes</span>
        <span><AuthIcon name="layers" />Evaluaciones</span>
      </div>
    </div>
  )
}

export default function LoginShowcase() {
  return (
    <aside className="login-showcase" aria-labelledby="showcase-title">
      <div className="showcase-intro">
        <span className="platform-label"><span />Plataforma RFC de Grado Crítico</span>
        <h2 id="showcase-title">Gestión inteligente de cambios de software sin fricción ni cuellos de botella</h2>
        <p className="showcase-description">Centraliza solicitudes de cambio, evaluaciones técnicas y decisiones del comité en un proceso organizado y trazable.</p>
      </div>
      <figure className="showcase-examples">
        <figcaption>VISTA ILUSTRATIVA · DATOS DE EJEMPLO</figcaption>
        <RequestPreview />
        <TrackingPreview />
      </figure>
      <footer className="showcase-footer d-flex align-items-center">
        <span className="institution-avatar" aria-hidden="true">UF</span>
        <div className="institution-copy">
          <p>“Cada solicitud, una decisión documentada. Cada cambio, un proceso trazable.”</p>
          <span>UtaFlow — Gestión de Cambios de Software</span>
        </div>
        <div className="institution-icons d-flex" aria-hidden="true">
          <AuthIcon name="shield" /><AuthIcon name="trace" /><AuthIcon name="layers" />
        </div>
      </footer>
    </aside>
  )
}
