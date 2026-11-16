
const vacio = (dato) =>
  dato === null || dato === undefined || dato === ''

// Solo se dibuja si tiene información: así no aparecen filas
// de "No especificado" que no aportan nada.
function Campo({ nombre, dato }) {
  if (vacio(dato)) return null

  return (
    <div className="uf-analysis-row">
      <b>{nombre}</b>
      <p className="uf-pre">{String(dato)}</p>
    </div>
  )
}

export default function ResumenSolicitudAmpliada({ solicitud }) {
  const impacto = {
    1: 'Bajo',
    2: 'Medio',
    3: 'Alto',
  }

  const riesgos = solicitud.riesgosIniciales
    ? solicitud.riesgosIniciales.split(';').join('\n• ')
    : ''

  const hayDatos = [
    solicitud.tipoMantenimiento,
    solicitud.componentesAfectados,
    solicitud.consecuenciaNoHacer,
    impacto[solicitud.idImpactoSolicitado],
    impacto[solicitud.urgencia],
    riesgos,
    solicitud.costoEstimadoSolicitado,
    solicitud.dependenciasPrevias,
    solicitud.ramaSugerida,
    solicitud.archivosSugeridos,
  ].some((dato) => !vacio(dato))

  // Las solicitudes públicas no traen datos técnicos.
  if (!hayDatos) return null

  return (
    <details className="uf-request-extra">
      <summary>Ver datos técnicos de la solicitud</summary>

      <div className="uf-form-grid mt-3">
        <Campo
          nombre="Tipo de mantenimiento"
          dato={solicitud.tipoMantenimiento}
        />

        <Campo
          nombre="Componentes afectados"
          dato={solicitud.componentesAfectados?.split(';').join(', ')}
        />

        <Campo
          nombre="Consecuencia de no realizar el cambio"
          dato={solicitud.consecuenciaNoHacer}
        />

        <Campo
          nombre="Impacto solicitado"
          dato={impacto[solicitud.idImpactoSolicitado]}
        />

        <Campo
          nombre="Urgencia solicitada"
          dato={impacto[solicitud.urgencia]}
        />

        <Campo
          nombre="Riesgos iniciales"
          dato={riesgos ? `• ${riesgos}` : ''}
        />

        <Campo
          nombre="Costo preliminar (USD)"
          dato={solicitud.costoEstimadoSolicitado}
        />

        <Campo
          nombre="Dependencias"
          dato={solicitud.dependenciasPrevias}
        />

        <Campo
          nombre="Rama Git sugerida"
          dato={solicitud.ramaSugerida}
        />

        <Campo
          nombre="Archivos sugeridos"
          dato={solicitud.archivosSugeridos}
        />
      </div>
    </details>
  )
}
