import LoginIllustration from './LoginIllustration.jsx'

export default function LoginShowcase() {
  return (
    <aside className="login-showcase" aria-labelledby="showcase-title">
      <div className="showcase-intro">
        <span className="showcase-accent" aria-hidden="true" />
        <h2 id="showcase-title">Gestión inteligente de cambios de <span>software</span></h2>
        <p className="showcase-description">Centraliza solicitudes, evaluaciones y decisiones del comité en un proceso organizado y trazable.</p>
      </div>
      <LoginIllustration />
      <footer className="showcase-footer">
        <span className="showcase-accent" aria-hidden="true" />
        <p>UtaFlow</p>
        <span>De la solicitud al cambio, sin fricción.</span>
      </footer>
    </aside>
  )
}
