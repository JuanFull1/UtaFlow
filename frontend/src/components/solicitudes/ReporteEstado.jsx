import { useEffect, useMemo, useState } from 'react'
import { solicitudesInternasService as api } from '../../services/solicitudesInternasService.js'

const COLUMNAS = [
  ['identificador', 'Identificador'],
  ['asunto', '¿Qué cambio?'],
  ['sistema', 'Sistema'],
  ['modulo', 'Módulo'],
  ['estado', 'Estado'],
  ['ultimoActor', '¿Quién?'],
  ['ultimoMovimiento', '¿Cuándo?'],
  ['componentesAfectados', '¿Qué más se afecta?'],
  ['versionLiberada', 'Versión'],
  ['enlaceGit', 'GitHub'],
  ['resultadoCierre', 'Cierre'],
]

// El servidor puede devolver las claves con mayúscula inicial.
const normalizar = (fila) =>
  Object.fromEntries(
    Object.entries(fila).map(([k, v]) => [
      k[0].toLowerCase() + k.slice(1),
      v,
    ])
  )

const texto = (clave, valor) => {
  if (valor === null || valor === undefined || valor === '') return ''
  if (clave === 'ultimoMovimiento') {
    return new Date(valor).toLocaleString('es-EC')
  }
  return String(valor).split(';').join(', ')
}

// Evita que Excel interprete una celda como fórmula.
const celdaCsv = (valor) => {
  let t = String(valor ?? '')
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`
  return `"${t.replaceAll('"', '""')}"`
}

// Unidad 3.3: ¿qué ocurrió?, ¿quién lo hizo?, ¿cuándo?, ¿qué más se afecta?
export default function ReporteEstado() {
  const [filas, setFilas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [estado, setEstado] = useState('')

  useEffect(() => {
    let activo = true

    api
      .reporteEstado()
      .then((datos) => {
        if (activo) setFilas((datos || []).map(normalizar))
      })
      .catch((e) => {
        if (activo) setError(e.message)
      })
      .finally(() => {
        if (activo) setCargando(false)
      })

    return () => {
      activo = false
    }
  }, [])

  const estados = useMemo(
    () => [...new Set(filas.map((f) => f.estado))].sort(),
    [filas]
  )

  const visibles = filas.filter((f) => !estado || f.estado === estado)

  function descargar() {
    const encabezado = COLUMNAS.map(([, t]) => celdaCsv(t)).join(',')
    const cuerpo = visibles.map((f) =>
      COLUMNAS.map(([c]) => celdaCsv(texto(c, f[c]))).join(',')
    )
    const blob = new Blob(
      ['﻿' + [encabezado, ...cuerpo].join('\r\n')],
      { type: 'text/csv;charset=utf-8' }
    )
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = 'reporte-estado-utaflow.csv'
    enlace.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="uf-card">
      <h2>Reporte de estado de la configuración</h2>

      <p className="text-muted">
        Qué cambió, quién lo hizo, cuándo ocurrió y qué más se afecta, con
        la versión liberada y su enlace en GitHub.
      </p>

      <div className="uf-form-actions">
        <select
          className="form-select"
          aria-label="Filtrar por estado"
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {estados.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="btn btn-outline-primary"
          disabled={!visibles.length}
          onClick={descargar}
        >
          Descargar CSV
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {cargando && <p>Cargando reporte…</p>}

      {!cargando && !error && (
        <div className="table-responsive">
          <table className="table table-sm">
            <thead>
              <tr>
                {COLUMNAS.map(([c, t]) => (
                  <th key={c}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => (
                <tr key={f.idSolicitud}>
                  {COLUMNAS.map(([c]) => (
                    <td key={c}>
                      {c === 'enlaceGit' &&
                      /^https?:\/\//i.test(f[c] || '') ? (
                        <a
                          href={f[c]}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Ver
                        </a>
                      ) : (
                        texto(c, f[c])
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {!visibles.length && (
                <tr>
                  <td colSpan={COLUMNAS.length}>No hay registros.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
