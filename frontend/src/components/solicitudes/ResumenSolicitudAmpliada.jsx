
function mostrar(dato) {
  if (dato === null || dato === undefined || dato === '') {
    return 'No especificado'
  }

  return String(dato)
}

function Campo({ nombre, dato }) {
  return (
    <div className="uf-analysis-row">
      <b>{nombre}</b>
      <p className="uf-pre">{mostrar(dato)}</p>
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

  return (
    <details className="uf-request-extra">
      <summary>
        Ver clasificación, componentes e impacto solicitado
      </summary>

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
          nombre="Componentes asociados"
          dato={solicitud.componentesAsociados}
        />

        <Campo
          nombre="Estado deseado"
          dato={solicitud.estadoDeseado}
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
          nombre="Usuarios o áreas afectadas"
          dato={solicitud.usuariosAfectados}
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
