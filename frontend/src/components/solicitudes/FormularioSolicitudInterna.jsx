

import { useEffect,   useRef} from 'react'
import SelectorTarjetas from './SelectorTarjetas.jsx'


const TIPOS_ITIL = [
  {
    valor: 'ESTANDAR',
    etiqueta: 'Estándar',
    descripcion: 'Cambio rutinario de bajo riesgo',
  },
  {
    valor: 'NORMAL',
    etiqueta: 'Normal',
    descripcion: 'Requiere revisión del comité',
  },
  {
    valor: 'EMERGENCIA',
    etiqueta: 'Emergencia',
    descripcion: 'Atención y evaluación prioritaria',
  },
]

const MANTENIMIENTOS = [
  {
    valor: 'CORRECTIVO',
    etiqueta: 'Correctivo',
    descripcion: 'Corrige errores o fallas',
  },
  {
    valor: 'ADAPTATIVO',
    etiqueta: 'Adaptativo',
    descripcion: 'Se adapta a cambios del entorno',
  },
  {
    valor: 'PERFECTIVO',
    etiqueta: 'Perfectivo',
    descripcion: 'Mejora o agrega funcionalidades',
  },
  {
    valor: 'PREVENTIVO',
    etiqueta: 'Preventivo',
    descripcion: 'Previene problemas futuros',
  },
]

const NIVELES = [
  { valor: '1', etiqueta: 'Bajo' },
  { valor: '2', etiqueta: 'Medio' },
  { valor: '3', etiqueta: 'Alto' },
]

const COMPONENTES = [
  'Frontend / interfaz web',
  'API / backend',
  'Base de datos SQL Server',
  'Autenticación JWT y roles',
  'Gestión de usuarios',
  'Reportes y documentos',
  'Integraciones externas',
  'Despliegue y configuración',
  'Pruebas automatizadas',
  'Documentación',
]

const RIESGOS = [
  'Modifica datos o estructura de la base de datos',
  'Afecta funciones esenciales del sistema',
  'Puede interrumpir el servicio',
  'Afecta la autenticación o los permisos',
  'Es difícil revertir el cambio',
]

function Campo({ titulo, nombre, valor, onChange, filas = 3, maxLength }) {
  return (
    <label>
      {titulo}
      <textarea
        className="form-control"
        name={nombre}
        rows={filas}
        maxLength={maxLength}
        value={valor ?? ''}
        onChange={onChange}
      />
    </label>
  )
}


function ArchivoSeleccionado({ archivo, onQuitar }) {
  const imagenRef = useRef(null)

  const esImagen = [
    'image/png',
    'image/jpeg',
  ].includes(archivo.type)

  useEffect(() => {
    if (!esImagen || !imagenRef.current) {
      return
    }

    const imagen = imagenRef.current
    const url = URL.createObjectURL(archivo)

    imagen.src = url

    return () => {
      imagen.removeAttribute('src')
      URL.revokeObjectURL(url)
    }
  }, [archivo, esImagen])

  return (
    <div className="uf-file-selected">
      {esImagen ? (
        <img
          ref={imagenRef}
          alt={`Vista previa de ${archivo.name}`}
        />
      ) : (
        <span className="uf-file-symbol">
          PDF
        </span>
      )}

      <div>
        <strong>{archivo.name}</strong>

        <small>
          {(archivo.size / 1024).toFixed(0)} KB
        </small>
      </div>

      <button
        className="btn btn-sm btn-outline-danger"
        type="button"
        onClick={onQuitar}
      >
        Quitar
      </button>
    </div>
  )
}


export default function FormularioSolicitudInterna({
  datos,
  catalogos,
  usuario,
  experto,
  ocupado,
  archivos = [],
  onChange,
  onSeleccionarArchivos,
  onQuitarArchivo,
  onSubmit,
}) {
  function seleccionar(nombre, valor) {
    onChange({
      target: { name: nombre, value: valor },
    })
  }

  function cambiarLista(nombre, opcion, checked) {
    const actuales = String(datos[nombre] || '')
      .split(';')
      .filter(Boolean)

    const nuevos = checked
      ? [...new Set([...actuales, opcion])]
      : actuales.filter((elemento) => elemento !== opcion)

    seleccionar(nombre, nuevos.join(';'))
  }

  const componentesActuales = String(
    datos.componentesAfectados || ''
  ).split(';')

  const riesgosActuales = String(
    datos.riesgosIniciales || ''
  ).split(';')

  return (
    <section className="uf-card uf-internal-form">
      <h2>
        {experto
          ? 'Nueva solicitud técnica'
          : 'Nueva propuesta de cambio'}
      </h2>

      <p className="text-muted">
        {experto
          ? 'Registra una solicitud técnica con su clasificación, componentes, impacto y evidencias. Después podrás completar la evaluación.'
          : 'Describe la propuesta, los sistemas afectados y los posibles riesgos. El experto realizará la evaluación técnica antes de enviarla al comité.'}
      </p>

      <form className="uf-form" onSubmit={onSubmit}>

        {/* 1. IDENTIFICACIÓN */}
        <div className="uf-form-section">
          <h3>1. Identificación</h3>

          <div className="uf-facts">
            <div>
              <b>Número</b>
              <span>Se asignará al registrar</span>
            </div>

            <div>
              <b>Solicitante</b>
              <span>{usuario?.nombre || 'Usuario actual'}</span>
            </div>

            <div>
              <b>Fecha de solicitud</b>
              <span>{new Date().toLocaleDateString('es-EC')}</span>
            </div>

            <div>
              <b>Analizador</b>
              <span>
                {experto
                  ? 'Por registrar en la evaluación'
                  : 'Pendiente de asignación'}
              </span>
            </div>
          </div>

          <label>
            Título de la solicitud *
            <input
              className="form-control"
              name="asunto"
              maxLength={200}
              required
              value={datos.asunto}
              onChange={onChange}
              placeholder="Ej. Mejorar la autenticación del sistema"
            />
          </label>

          <div className="uf-form-grid">
            <label>
              Sistema o proyecto *
              <select
                className="form-select"
                name="idSistema"
                required
                value={datos.idSistema}
                onChange={onChange}
              >
                <option value="">Seleccionar sistema</option>

                {catalogos.sistemas.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Módulo afectado
              <input
                className="form-control"
                name="moduloAfectado"
                maxLength={150}
                value={datos.moduloAfectado}
                onChange={onChange}
                placeholder="Ej. Inicio de sesión"
              />
            </label>

            <label>
              Empresa o área
              <input
                className="form-control"
                name="empresaArea"
                maxLength={150}
                value={datos.empresaArea}
                onChange={onChange}
                placeholder="Ej. Departamento de tecnología"
              />
            </label>

            <label>
              Versión actual
              <input
                className="form-control"
                name="versionSoftware"
                maxLength={50}
                value={datos.versionSoftware}
                onChange={onChange}
                placeholder="Ej. 1.0.0"
              />
            </label>
          </div>
        </div>

        {/* 2. CLASIFICACIÓN */}
        <div className="uf-form-section">
          <h3>2. Clasificación del cambio</h3>

          <SelectorTarjetas
            titulo="Tipo de mantenimiento *"
            opciones={MANTENIMIENTOS}
            valor={datos.tipoMantenimiento}
            onChange={(v) =>
              seleccionar('tipoMantenimiento', v)
            }
          />

          {!datos.tipoMantenimiento && (
            <small className="text-danger">
              Selecciona el tipo de mantenimiento.
            </small>
          )}

          <SelectorTarjetas
            titulo="Tipo de cambio ITIL *"
            opciones={TIPOS_ITIL}
            valor={datos.codigoTipoCambio}
            onChange={(v) =>
              seleccionar('codigoTipoCambio', v)
            }
          />

          <h3>Componentes afectados</h3>

          <p className="text-muted small">
            Selecciona los elementos que podrían modificarse.
          </p>

          <div className="uf-checkbox-grid">
            {COMPONENTES.map((componente) => (
              <label key={componente} className="uf-option-check">
                <input
                  type="checkbox"
                  checked={componentesActuales.includes(componente)}
                  onChange={(e) =>
                    cambiarLista(
                      'componentesAfectados',
                      componente,
                      e.target.checked
                    )
                  }
                />

                <span>{componente}</span>
              </label>
            ))}
          </div>

          <Campo
            titulo="Componentes asociados"
            nombre="componentesAsociados"
            valor={datos.componentesAsociados}
            onChange={onChange}
            maxLength={600}
            filas={2}
          />
        </div>

        {/* 3. DESCRIPCIÓN */}
        <div className="uf-form-section">
          <h3>3. Descripción y justificación</h3>

          <label>
            Descripción del cambio *
            <textarea
              className="form-control"
              name="descripcion"
              required
              minLength={10}
              maxLength={4000}
              rows={5}
              value={datos.descripcion}
              onChange={onChange}
              placeholder="Describe el problema, la necesidad y el cambio solicitado."
            />
          </label>

          <Campo
            titulo="Situación o afectación actual"
            nombre="afectacionActual"
            valor={datos.afectacionActual}
            onChange={onChange}
            maxLength={1000}
          />

          <Campo
            titulo="Estado deseado después del cambio"
            nombre="estadoDeseado"
            valor={datos.estadoDeseado}
            onChange={onChange}
            maxLength={2000}
          />

          <label>
            Justificación *
            <textarea
              className="form-control"
              name="razon"
              required
              maxLength={500}
              rows={3}
              value={datos.razon}
              onChange={onChange}
              placeholder="Explica por qué se necesita este cambio."
            />
          </label>

          <Campo
            titulo="Consecuencia de no realizar el cambio"
            nombre="consecuenciaNoHacer"
            valor={datos.consecuenciaNoHacer}
            onChange={onChange}
            maxLength={1000}
          />
        </div>

        {/* 4. IMPACTO Y RIESGO */}
        <div className="uf-form-section">
          <h3>4. Impacto, urgencia y riesgo</h3>

          <SelectorTarjetas
            titulo="Impacto estimado"
            opciones={NIVELES}
            valor={datos.idImpacto}
            onChange={(v) => seleccionar('idImpacto', v)}
          />

          <SelectorTarjetas
            titulo="Urgencia estimada"
            opciones={NIVELES}
            valor={datos.urgencia}
            onChange={(v) => seleccionar('urgencia', v)}
          />

          <label>
            Prioridad de la solicitud *
            <select
              className="form-select"
              name="idPrioridad"
              required
              value={datos.idPrioridad}
              onChange={onChange}
            >
              <option value="">Selecciona la prioridad</option>

              {catalogos.prioridades.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>

          <h3>Cuestionario de riesgos iniciales</h3>

          <div className="uf-checkbox-grid">
            {RIESGOS.map((riesgo) => (
              <label key={riesgo} className="uf-option-check">
                <input
                  type="checkbox"
                  checked={riesgosActuales.includes(riesgo)}
                  onChange={(e) =>
                    cambiarLista(
                      'riesgosIniciales',
                      riesgo,
                      e.target.checked
                    )
                  }
                />
                <span>{riesgo}</span>
              </label>
            ))}
          </div>

          <div className="uf-form-grid">
            <label>
              Usuarios o áreas afectadas
              <input
                className="form-control"
                name="usuariosAfectados"
                maxLength={300}
                value={datos.usuariosAfectados}
                onChange={onChange}
                placeholder="Ej. Administradores, operadores"
              />
            </label>

            <label>
              Costo preliminar (USD)
              <input
                className="form-control"
                type="number"
                name="costoEstimadoSolicitado"
                min="0"
                max="9999999999.99"
                step="0.01"
                value={datos.costoEstimadoSolicitado}
                onChange={onChange}
                placeholder="0.00"
              />
            </label>
          </div>
        </div>

        {/* 5. PLANIFICACIÓN INICIAL */}
        <div className="uf-form-section">
          <h3>5. Planificación inicial</h3>

          <Campo
            titulo="Requisitos previos y dependencias"
            nombre="dependenciasPrevias"
            valor={datos.dependenciasPrevias}
            onChange={onChange}
            maxLength={1000}
          />

          {experto && (
            <>
              <label>
                Rama GitFlow sugerida
                <input
                  className="form-control"
                  name="ramaSugerida"
                  maxLength={150}
                  value={datos.ramaSugerida}
                  onChange={onChange}
                  placeholder="feature/actualizar-autenticacion"
                />
              </label>

              <Campo
                titulo="Archivos previstos (una ruta por línea)"
                nombre="archivosSugeridos"
                valor={datos.archivosSugeridos}
                onChange={onChange}
                maxLength={1000}
                filas={4}
              />
            </>
          )}

          <div className="uf-form-grid">
            <label>
              Fecha límite deseada
              <input
                className="form-control"
                type="date"
                name="fechaLimite"
                value={datos.fechaLimite}
                onChange={onChange}
              />
            </label>
          </div>

          <Campo
            titulo="Comentarios adicionales"
            nombre="comentariosAdicionales"
            valor={datos.comentariosAdicionales}
            onChange={onChange}
            maxLength={1000}
            filas={2}
          />
        </div>

        {/* 6. EVIDENCIAS */}
        <div className="uf-form-section">
          <h3>6. Evidencias de la solicitud</h3>

          <p className="text-muted small">
            Puedes adjuntar hasta 3 capturas PNG/JPG o
            documentos PDF, de máximo 5 MB cada uno.
          </p>

          <label>
            Seleccionar imágenes o documentos
            <input
              type="file"
              className="form-control"
              accept=".png,.jpg,.jpeg,.pdf"
              multiple
              onChange={(e) => {
                onSeleccionarArchivos(
                  Array.from(e.target.files || [])
                )
                e.target.value = ''
              }}
            />
          </label>

          <div className="uf-files-grid">
            {archivos.map((archivo, indice) => (
              <ArchivoSeleccionado
                key={`${archivo.name}-${indice}`}
                archivo={archivo}
                onQuitar={() => onQuitarArchivo(indice)}
              />
            ))}
          </div>

          {archivos.length === 0 && (
            <small className="text-muted">
              No se han seleccionado evidencias.
            </small>
          )}
        </div>

        <div className="uf-form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={
              ocupado ||
              !datos.tipoMantenimiento ||
              !catalogos.sistemas.length ||
              !catalogos.prioridades.length
            }
          >
            {ocupado
              ? 'Registrando solicitud…'
              : experto
                ? 'Registrar y continuar con evaluación'
                : 'Registrar propuesta de cambio'}
          </button>
        </div>

        <p className="uf-hint">
          Las evidencias se subirán cuando la solicitud
          haya sido registrada correctamente.
          El resultado final dependerá de la evaluación
          técnica y de la decisión del comité.
        </p>
      </form>
    </section>
  )
}
