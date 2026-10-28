
import SelectorTarjetas from './SelectorTarjetas.jsx'

const TIPOS_ITIL = [
  {
    valor: 'ESTANDAR',
    etiqueta: 'Estándar',
    descripcion: 'Cambio rutinario o preaprobado',
  },
  {
    valor: 'NORMAL',
    etiqueta: 'Normal',
    descripcion: 'Evaluación y aprobación completa',
  },
  {
    valor: 'EMERGENCIA',
    etiqueta: 'Emergencia',
    descripcion: 'Requiere atención prioritaria',
  },
]

const MANTENIMIENTOS = [
  {
    valor: 'CORRECTIVO',
    etiqueta: 'Correctivo',
    descripcion: 'Corrige errores',
  },
  {
    valor: 'ADAPTATIVO',
    etiqueta: 'Adaptativo',
    descripcion: 'Se adapta a nuevas condiciones',
  },
  {
    valor: 'PERFECTIVO',
    etiqueta: 'Perfectivo',
    descripcion: 'Mejora funciones existentes',
  },
  {
    valor: 'PREVENTIVO',
    etiqueta: 'Preventivo',
    descripcion: 'Previene problemas futuros',
  },
]

const IMPACTOS = [
  { valor: '1', etiqueta: 'Bajo' },
  { valor: '2', etiqueta: 'Medio' },
  { valor: '3', etiqueta: 'Alto' },
]

const AMBIENTES = [
  { valor: 'DESARROLLO', etiqueta: 'Desarrollo' },
  { valor: 'PRUEBAS', etiqueta: 'Pruebas' },
  { valor: 'PRODUCCION', etiqueta: 'Producción' },
]

const RECOMENDACIONES = [
  { valor: 'APROBAR', etiqueta: 'Recomendar aprobación' },
  { valor: 'RECHAZAR', etiqueta: 'Recomendar rechazo' },
  { valor: 'MODIFICAR', etiqueta: 'Recomendar modificación' },
]

function CampoTexto({
  titulo,
  nombre,
  valor,
  cambiar,
  filas = 3,
  maxLength,
}) {
  return (
    <label>
      {titulo}
      <textarea
        className="form-control"
        name={nombre}
        value={valor ?? ''}
        onChange={cambiar}
        rows={filas}
        maxLength={maxLength}
      />
    </label>
  )
}

export default function FormularioEvaluacion({
  analisis,
  onChange,
  onGuardar,
  onEnviar,
  ocupado,
  guardado,
  editado,
}) {
  function cambiarSeleccion(nombre, valor) {
    onChange({
      target: {
        name: nombre,
        value: valor,
        type: 'select',
      },
    })
  }

  return (
    <section className="uf-card">
      <h2>Evaluación técnica del experto</h2>

      <p className="text-muted">
        Completa el análisis técnico para que el comité
        pueda conocer los riesgos, costos y la solución
        propuesta antes de votar.
      </p>

      <form className="uf-form" onSubmit={onGuardar}>
        <div className="uf-form-section">
          <h3>1. Clasificación del cambio</h3>

          <SelectorTarjetas
            titulo="Tipo de cambio ITIL"
            opciones={TIPOS_ITIL}
            valor={analisis.codigoTipoCambio}
            onChange={(v) =>
              cambiarSeleccion('codigoTipoCambio', v)
            }
          />

          <SelectorTarjetas
            titulo="Tipo de mantenimiento"
            opciones={MANTENIMIENTOS}
            valor={analisis.tipoMantenimiento}
            onChange={(v) =>
              cambiarSeleccion('tipoMantenimiento', v)
            }
          />

          <SelectorTarjetas
            titulo="Impacto estimado"
            opciones={IMPACTOS}
            valor={analisis.idImpacto}
            onChange={(v) =>
              cambiarSeleccion('idImpacto', v)
            }
          />
        </div>

        <div className="uf-form-section">
          <h3>2. Análisis del cambio</h3>

          <CampoTexto
            titulo="Especificación técnica"
            nombre="especificacionTecnica"
            valor={analisis.especificacionTecnica}
            cambiar={onChange}
            filas={4}
          />

          <CampoTexto
            titulo="Análisis del impacto"
            nombre="analisisImpacto"
            valor={analisis.analisisImpacto}
            cambiar={onChange}
          />

          <CampoTexto
            titulo="Servicios afectados"
            nombre="serviciosAfectados"
            valor={analisis.serviciosAfectados}
            cambiar={onChange}
            maxLength={300}
          />

          <CampoTexto
            titulo="Componentes afectados"
            nombre="componentesAfectados"
            valor={analisis.componentesAfectados}
            cambiar={onChange}
            maxLength={600}
          />

          <CampoTexto
            titulo="Archivos que se prevé modificar"
            nombre="archivosPrevistos"
            valor={analisis.archivosPrevistos}
            cambiar={onChange}
          />

          <CampoTexto
            titulo="Consecuencias de no realizar el cambio"
            nombre="consecuenciaNoHacer"
            valor={analisis.consecuenciaNoHacer}
            cambiar={onChange}
            maxLength={1000}
          />
        </div>

        <div className="uf-form-section">
          <h3>3. Estimaciones y riesgos</h3>

          <div className="uf-form-grid">
            <label>
              Horas estimadas
              <input
                className="form-control"
                type="number"
                name="horasEstimadas"
                min="0"
                max="99999"
                step="0.5"
                value={analisis.horasEstimadas ?? ''}
                onChange={onChange}
              />
            </label>

            <label>
              Costo estimado (USD)
              <input
                className="form-control"
                type="number"
                name="costoEstimado"
                min="0"
                step="0.01"
                value={analisis.costoEstimado ?? ''}
                onChange={onChange}
                placeholder="Ej. 150.00"
              />
            </label>
          </div>

          <label className="uf-check">
            <input
              type="checkbox"
              name="bdAfectada"
              checked={Boolean(analisis.bdAfectada)}
              onChange={onChange}
            />
            El cambio afecta la base de datos
          </label>

          <CampoTexto
            titulo="Riesgos identificados"
            nombre="riesgos"
            valor={analisis.riesgos}
            cambiar={onChange}
          />
        </div>

        <div className="uf-form-section">
          <h3>4. Implementación prevista</h3>

          <SelectorTarjetas
            titulo="Ambiente previsto"
            opciones={AMBIENTES}
            valor={analisis.ambientePrevisto}
            onChange={(v) =>
              cambiarSeleccion('ambientePrevisto', v)
            }
          />

          <div className="uf-form-grid">
            <label>
              Rama GitFlow sugerida
              <input
                className="form-control"
                name="ramaGit"
                maxLength={150}
                value={analisis.ramaGit ?? ''}
                onChange={onChange}
                placeholder="feature/mejora-facturacion"
              />
            </label>

            <label>
              Estrategia de implementación
              <input
                className="form-control"
                name="estrategiaDespliegue"
                maxLength={300}
                value={analisis.estrategiaDespliegue ?? ''}
                onChange={onChange}
                placeholder="Por fases, gradual..."
              />
            </label>
          </div>

          <CampoTexto
            titulo="Plan de implementación"
            nombre="planRollout"
            valor={analisis.planRollout}
            cambiar={onChange}
          />

          <CampoTexto
            titulo="Plan de pruebas"
            nombre="planPruebas"
            valor={analisis.planPruebas}
            cambiar={onChange}
          />

          <CampoTexto
            titulo="Criterios de aceptación"
            nombre="criteriosAceptacion"
            valor={analisis.criteriosAceptacion}
            cambiar={onChange}
          />

          <CampoTexto
            titulo="Plan de reversión"
            nombre="planBackout"
            valor={analisis.planBackout}
            cambiar={onChange}
          />
        </div>

        <div className="uf-form-section">
          <h3>5. Recomendación para el comité</h3>

          <CampoTexto
            titulo="Sugerencia técnica"
            nombre="sugerencia"
            valor={analisis.sugerencia}
            cambiar={onChange}
          />

          <SelectorTarjetas
            titulo="Recomendación del experto *"
            opciones={RECOMENDACIONES}
            valor={analisis.recomendacion}
            onChange={(v) =>
              cambiarSeleccion('recomendacion', v)
            }
          />

          {!analisis.recomendacion && (
            <p className="text-danger small">
              Selecciona una recomendación antes de guardar.
            </p>
          )}
        </div>

        <div className="uf-form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={ocupado || !analisis.recomendacion}
          >
            {ocupado ? 'Guardando…' : 'Guardar evaluación'}
          </button>

          <button
            type="button"
            className="btn btn-outline-primary"
            disabled={
              ocupado ||
              !guardado ||
              editado
            }
            onClick={onEnviar}
          >
            Enviar al comité
          </button>
        </div>

        <p className="uf-hint">
          {editado
            ? 'Tienes cambios sin guardar. Guarda la evaluación antes de enviarla.'
            : guardado
              ? 'La evaluación está guardada y puede enviarse al comité.'
              : 'Primero guarda la evaluación técnica.'}
        </p>
      </form>
    </section>
  )
}
