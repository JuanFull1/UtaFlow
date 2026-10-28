import { Link } from 'react-router'

export default function NotFound() {
  return (
    <main className="login-page container-fluid">
      <section className="card border-0 shadow-sm p-4 p-md-5" aria-labelledby="not-found-title">
        <h1 id="not-found-title">Página no encontrada</h1>
        <p>La dirección solicitada no existe.</p>
        <Link to="/" replace className="btn btn-primary">Volver al inicio</Link>
      </section>
    </main>
  )
}
