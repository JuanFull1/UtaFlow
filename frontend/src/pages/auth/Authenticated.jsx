
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { useAuth } from '../../context/AuthContext.js'
import { cargarCatalogos } from '../../services/solicitudesPublicasService.js'
import { solicitudesInternasService as api } from '../../services/solicitudesInternasService.js'
import { descargarAdjuntoAutenticado } from '../../services/authService.js'

import TableroEtapas from '../../components/solicitudes/TableroEtapas.jsx'
import VistaAdjuntos from '../../components/solicitudes/VistaAdjuntos.jsx'
import FormularioEvaluacion from '../../components/solicitudes/FormularioEvaluacion.jsx'
import FormularioSolicitudInterna from '../../components/solicitudes/FormularioSolicitudInterna.jsx'
import PanelLateralSolicitud from '../../components/solicitudes/PanelLateralSolicitud.jsx'
import DecisionColectiva from '../../components/solicitudes/DecisionColectiva.jsx'
import ResumenSolicitudAmpliada from '../../components/solicitudes/ResumenSolicitudAmpliada.jsx'

import './PanelSolicitudes.css'

// =====================================================
// ESTADOS INICIALES DE LA EVALUACION TECNICA
// =====================================================

const ANALISIS_INICIAL = {
  especificacionTecnica: '',
  analisisImpacto: '',
  serviciosAfectados: '',
  riesgos: '',
  horasEstimadas: '',
  bdAfectada: false,
  planRollout: '',
  planBackout: '',
  planPruebas: '',
  criteriosAceptacion: '',
  sugerencia: '',
  recomendacion: '',
  codigoTipoCambio: 'NORMAL',
  idImpacto: '',

  tipoMantenimiento: '',
  componentesAfectados: '',
  archivosPrevistos: '',
  costoEstimado: '',
  ramaGit: '',
  ambientePrevisto: '',
  estrategiaDespliegue: '',
  consecuenciaNoHacer: '',
}

// =====================================================
// ESTADOS INICIALES DE NUEVA SOLICITUD
// =====================================================

const NUEVA_INICIAL = {
  asunto: '',
  descripcion: '',
  razon: '',
  idSistema: '',
  idPrioridad: '',
  codigoTipoCambio: 'NORMAL',
  empresaArea: '',
  moduloAfectado: '',
  versionSoftware: '',
  afectacionActual: '',
  comentariosAdicionales: '',
  fechaLimite: '',
  tipoMantenimiento: '',
  componentesAfectados: '',
  componentesAsociados: '',
  estadoDeseado: '',
  consecuenciaNoHacer: '',
  idImpacto: '',
  urgencia: '',
  riesgosIniciales: '',
  usuariosAfectados: '',
  costoEstimadoSolicitado: '',
  dependenciasPrevias: '',
  archivosSugeridos: '',
  ramaSugerida: '',
}

// =====================================================
// ESTADOS INICIALES DE DECISION COLECTIVA
// =====================================================

const DECISION_INICIAL = {
  justificacion: '',
  condiciones: '',
  versionPrevista: '',
}

// Precargar los valores iniciales propuestos, sin guardar
// automáticamente la evaluación del experto.
function prepararAnalisisDesdeSolicitud(detalle) {
  const solicitud = detalle.solicitud
  const existente = detalle.analisis || {}
  const inicial = {
    ...ANALISIS_INICIAL,
    codigoTipoCambio: solicitud.tipoCambio || 'NORMAL',
    tipoMantenimiento: solicitud.tipoMantenimiento || '',
    componentesAfectados:
      solicitud.componentesAfectados?.split(';').join(', ') || '',
    archivosPrevistos: solicitud.archivosSugeridos || '',
    costoEstimado: solicitud.costoEstimadoSolicitado ?? '',
    ramaGit: solicitud.ramaSugerida || '',
    idImpacto: solicitud.idImpactoSolicitado ?? '',
    riesgos: solicitud.riesgosIniciales?.split(';').join('\n') || '',
    consecuenciaNoHacer: solicitud.consecuenciaNoHacer || '',
  }

  return Object.fromEntries(
    Object.keys(ANALISIS_INICIAL).map((clave) => [
      clave,
      existente[clave] ?? inicial[clave],
    ])
  )
}

// =====================================================
// FUNCIONES DE PRESENTACION
// =====================================================

function fecha(valor) {
  if (!valor) return '—'

  const resultado = new Date(valor)

  return Number.isNaN(resultado.getTime())
    ? String(valor)
    : resultado.toLocaleString('es-EC')
}

function valor(dato) {
  if (dato === null || dato === undefined || dato === '') {
    return '—'
  }

  return String(dato)
}

function estadoFinal(codigo) {
  return ['APROBADA', 'RECHAZADA'].includes(codigo)
}

function requiereExperto(codigo) {
  return [
    'ENVIADA',
    'PENDIENTE_EXPERTO',
  ].includes(codigo)
}

function requiereComite(codigo) {
  return codigo === 'EN_COMITE'
}

function CampoLectura({ titulo, contenido }) {
  return (
    <div className="uf-analysis-row">
      <b>{titulo}</b>
      <p className="uf-pre">{valor(contenido)}</p>
    </div>
  )
}

// =====================================================
// PANEL PRINCIPAL DE EXPERTO Y COMITE
// =====================================================

export default function Authenticated() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()

  const experto = usuario.rol === 'EXPERTO'
  const comite = usuario.rol === 'COMITE'

  // ---------------------------------------------------
  // NAVEGACION
  // ---------------------------------------------------

  const [vista, setVista] = useState('resumen')
  const [filtroLista, setFiltroLista] = useState('pendientes')

  // ---------------------------------------------------
  // SOLICITUDES Y CATALOGOS
  // ---------------------------------------------------

  const [solicitudes, setSolicitudes] = useState([])
  const [detalle, setDetalle] = useState(null)

  const [catalogos, setCatalogos] = useState({
    sistemas: [],
    prioridades: [],
  })

  // ---------------------------------------------------
  // FORMULARIOS
  // ---------------------------------------------------

  const [analisis, setAnalisis] = useState(ANALISIS_INICIAL)
  const [nueva, setNueva] = useState(NUEVA_INICIAL)
  const [archivosNuevos, setArchivosNuevos] = useState([])

  const [voto, setVoto] = useState('APROBAR')
  const [comentarioVoto, setComentarioVoto] = useState('')

  const [destino, setDestino] = useState('CLIENTE')
  const [observacion, setObservacion] = useState('')

  const [decisionDatos, setDecisionDatos] = useState(
    DECISION_INICIAL
  )

  // ---------------------------------------------------
  // CONTROL DE EDICION
  // ---------------------------------------------------

  // Identifica la solicitud cuya evaluación estamos editando.
  // No guarda borradores en el navegador ni en SQL.
  const idEdicionRef = useRef(null)

  const [analisisEditado, setAnalisisEditado] = useState(false)

  // ---------------------------------------------------
  // ESTADOS GENERALES
  // ---------------------------------------------------

  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState(false)

  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  // =====================================================
  // 1. CARGAR DATOS INICIALES
  // =====================================================

  useEffect(() => {
    let activo = true

    Promise.all([
      api.listar(),
      cargarCatalogos(),
    ])
      .then(([lista, opciones]) => {
        if (!activo) return

        setSolicitudes(lista)
        setCatalogos(opciones)
      })
      .catch((e) => {
        if (activo) {
          setError(e.message)
        }
      })
      .finally(() => {
        if (activo) {
          setCargando(false)
        }
      })

    return () => {
      activo = false
    }
  }, [])

  // =====================================================
  // 2. RECARGAR INFORMACION
  // =====================================================


  async function actualizarTodo() {
    if (ocupado) return

    setError('')
    setMensaje('')
    setOcupado(true)

    try {
      const lista = await api.listar()
      setSolicitudes(lista)

      if (detalle?.solicitud?.id) {
        const actual = await api.detalle(
          detalle.solicitud.id
        )

        setDetalle(actual)
      }

      setMensaje('Información actualizada.')
    } catch (e) {
      setError(e.message)
    } finally {
      setOcupado(false)
    }

    // Los campos del formulario NO se reinician.
  }

  // =====================================================
  // 3. ACTUALIZAR FORMULARIOS
  // =====================================================

  function actualizarAnalisis(evento) {
    const { name, value, type, checked } = evento.target

    setAnalisis((anterior) => ({
      ...anterior,
      [name]: type === 'checkbox' ? checked : value,
    }))

    setAnalisisEditado(true)
  }

  function actualizarNueva(evento) {
    const { name, value } = evento.target

    setNueva((anterior) => ({
      ...anterior,
      [name]: value,
    }))
  }

  function seleccionarArchivosNuevos(seleccionados) {
    const permitidas = ['image/png', 'image/jpeg', 'application/pdf']
    const restantes = 3 - archivosNuevos.length

    if (seleccionados.length > restantes) {
      setError('Puedes adjuntar un máximo de 3 archivos.')
      return
    }

    if (seleccionados.some((archivo) =>
      !permitidas.includes(archivo.type) ||
      archivo.size === 0 ||
      archivo.size > 5 * 1024 * 1024
    )) {
      setError('Solo se permiten imágenes PNG/JPG y PDF de hasta 5 MB.')
      return
    }

    setError('')
    setArchivosNuevos((anteriores) => [
      ...anteriores,
      ...seleccionados,
    ])
  }

  function quitarArchivoNuevo(indice) {
    setArchivosNuevos((anteriores) =>
      anteriores.filter((_, i) => i !== indice)
    )
  }

  function actualizarDecision(evento) {
    const { name, value } = evento.target

    setDecisionDatos((anterior) => ({
      ...anterior,
      [name]: value,
    }))
  }

  // =====================================================
  // 4. ABRIR SOLICITUD SIN PERDER LOS CAMPOS
  // =====================================================

  async function abrirSolicitud(id) {
    if (ocupado) return

    const esOtraSolicitud = idEdicionRef.current !== id

    const decisionSinGuardar =
      Boolean(decisionDatos.justificacion.trim()) ||
      Boolean(decisionDatos.condiciones.trim()) ||
      Boolean(decisionDatos.versionPrevista.trim())

    const hayCambiosSinGuardar =
      analisisEditado ||
      decisionSinGuardar ||
      Boolean(observacion.trim()) ||
      Boolean(comentarioVoto.trim())

    if (esOtraSolicitud && hayCambiosSinGuardar) {
      const continuar = window.confirm(
        'Tienes información sin guardar. ' +
        'Si abres otra solicitud, se descartarán esos datos. ' +
        '¿Deseas continuar?'
      )

      if (!continuar) return
    }

    setError('')
    setMensaje('')
    setOcupado(true)

    try {
      const resultado = await api.detalle(id)

      setDetalle(resultado)

      if (esOtraSolicitud) {
        idEdicionRef.current = id

        setAnalisis(prepararAnalisisDesdeSolicitud(resultado))

        setAnalisisEditado(false)
        setDecisionDatos(DECISION_INICIAL)

        setDestino(
          resultado.solicitud.origen === 'PUBLICO'
            ? 'CLIENTE'
            : 'EXPERTO'
        )

        setObservacion('')
        setVoto('APROBAR')
        setComentarioVoto('')
      }

      // Abrir nuevamente la misma solicitud conserva
      // los valores que se estaban escribiendo.
      setVista('detalle')
    } catch (e) {
      setError(e.message)
    } finally {
      setOcupado(false)
    }
  }

  // =====================================================
  // 5. EJECUTAR OPERACIONES Y ACTUALIZAR LA PANTALLA
  // =====================================================

  async function ejecutar(operacion, mensajeCorrecto) {
    if (ocupado) return false

    setOcupado(true)
    setError('')
    setMensaje('')

    try {
      const resultado = await operacion()

      // La operación principal terminó correctamente.
      // No confundir un error de actualización posterior
      // con un fallo del guardado.
      const texto = typeof mensajeCorrecto === 'function'
        ? mensajeCorrecto(resultado)
        : mensajeCorrecto

      setMensaje(texto)

      try {
        const lista = await api.listar()
        setSolicitudes(lista)

        if (detalle?.solicitud?.id) {
          const actual = await api.detalle(
            detalle.solicitud.id
          )

          setDetalle(actual)
        }
      } catch {
        setError(
          'La operación se realizó, pero no fue posible ' +
          'actualizar todos los datos en pantalla. ' +
          'Puedes utilizar el botón Actualizar.'
        )
      }

      return true
    } catch (e) {
      setError(e.message)
      return false
    } finally {
      setOcupado(false)
    }
  }

  // =====================================================
  // 6. CREAR SOLICITUD INTERNA
  // =====================================================

  async function crear(evento) {
    evento.preventDefault()
    if (ocupado) return

    setOcupado(true)
    setError('')
    setMensaje('')

    try {
      const creada = await api.crear({
        asunto: nueva.asunto.trim(),
        descripcion: nueva.descripcion.trim(),
        razon: nueva.razon.trim(),
        idSistema: Number(nueva.idSistema),
        idPrioridad: Number(nueva.idPrioridad),
        codigoTipoCambio: nueva.codigoTipoCambio,
        empresaArea: nueva.empresaArea.trim() || null,
        moduloAfectado: nueva.moduloAfectado.trim() || null,
        versionSoftware: nueva.versionSoftware.trim() || null,
        afectacionActual: nueva.afectacionActual.trim() || null,
        comentariosAdicionales: nueva.comentariosAdicionales.trim() || null,
        fechaLimite: nueva.fechaLimite || null,
        tipoMantenimiento: nueva.tipoMantenimiento,
        componentesAfectados: nueva.componentesAfectados || null,
        componentesAsociados: nueva.componentesAsociados.trim() || null,
        estadoDeseado: nueva.estadoDeseado.trim() || null,
        consecuenciaNoHacer: nueva.consecuenciaNoHacer.trim() || null,
        idImpacto: nueva.idImpacto ? Number(nueva.idImpacto) : null,
        urgencia: nueva.urgencia ? Number(nueva.urgencia) : null,
        riesgosIniciales: nueva.riesgosIniciales || null,
        usuariosAfectados: nueva.usuariosAfectados.trim() || null,
        costoEstimadoSolicitado:
          nueva.costoEstimadoSolicitado === ''
            ? null
            : Number(nueva.costoEstimadoSolicitado),
        dependenciasPrevias: nueva.dependenciasPrevias.trim() || null,
        archivosSugeridos:
          experto ? nueva.archivosSugeridos.trim() || null : null,
        ramaSugerida:
          experto ? nueva.ramaSugerida.trim() || null : null,
      })

      // No repetir este POST: la solicitud ya quedó registrada.
      const erroresArchivos = []
      for (const archivo of archivosNuevos) {
        try {
          await api.subirAdjunto(creada.id, archivo)
        } catch {
          erroresArchivos.push(archivo.name)
        }
      }

      setMensaje(
        `Solicitud ${creada.codigo} registrada correctamente. ` +
        `${archivosNuevos.length - erroresArchivos.length} evidencia(s) adjuntada(s).`
      )
      if (erroresArchivos.length) {
        setError(
          'No se pudieron subir: ' + erroresArchivos.join(', ') +
          '. La solicitud ya fue creada; puedes adjuntarlos desde el detalle.'
        )
      }

      setNueva(NUEVA_INICIAL)
      setArchivosNuevos([])

      try {
        const lista = await api.listar()
        setSolicitudes(lista)
        const resultado = await api.detalle(creada.id)
        setDetalle(resultado)
        idEdicionRef.current = creada.id
        setAnalisis(prepararAnalisisDesdeSolicitud(resultado))
        setAnalisisEditado(false)
        setDecisionDatos(DECISION_INICIAL)
        setFiltroLista('todas')
        setVista('detalle')
      } catch {
        setFiltroLista('todas')
        setVista('solicitudes')
        setError(
          'La solicitud se registró, pero no fue posible abrirla automáticamente. ' +
          'Puedes encontrarla en la bandeja.'
        )
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setOcupado(false)
    }
  }

  // =====================================================
  // 7. GUARDAR EVALUACION TECNICA
  // =====================================================

  async function guardarAnalisis(evento) {
    evento.preventDefault()

    if (!detalle?.solicitud?.id) return

    const correcto = await ejecutar(
      () => api.guardarAnalisis(
        detalle.solicitud.id,
        {
          ...analisis,

          horasEstimadas:
            analisis.horasEstimadas === '' ||
            analisis.horasEstimadas === null
              ? null
              : Number(analisis.horasEstimadas),

          costoEstimado:
            analisis.costoEstimado === '' ||
            analisis.costoEstimado === null
              ? null
              : Number(analisis.costoEstimado),

          idImpacto:
            analisis.idImpacto === '' ||
            analisis.idImpacto === null
              ? null
              : Number(analisis.idImpacto),

          tipoMantenimiento:
            analisis.tipoMantenimiento || null,

          ambientePrevisto:
            analisis.ambientePrevisto || null,
        }
      ),
      'Evaluación técnica guardada correctamente.'
    )

    if (correcto) {
      setAnalisisEditado(false)
    }
  }

  // =====================================================
  // 8. ENVIAR EVALUACION AL COMITE
  // =====================================================

  async function enviarAlComite() {
    if (!detalle?.solicitud?.id) return

    if (analisisEditado) {
      setError(
        'Guarda los cambios pendientes de la evaluación ' +
        'antes de enviarla al comité.'
      )
      return
    }

    if (
      !analisis.tipoMantenimiento ||
      !analisis.idImpacto ||
      analisis.costoEstimado === '' ||
      analisis.costoEstimado === null ||
      !analisis.ramaGit?.trim() ||
      !analisis.recomendacion
    ) {
      setError(
        'Completa mantenimiento, impacto, costo estimado, ' +
        'rama Git y recomendación antes de enviar al comité.'
      )
      return
    }

    await ejecutar(
      () => api.enviarAlComite(detalle.solicitud.id),
      'La solicitud fue enviada al comité.'
    )
  }

  // =====================================================
  // 9. VOTACION INDIVIDUAL
  // =====================================================

  async function registrarVoto(evento) {
    evento.preventDefault()

    if (!detalle?.solicitud?.id) return

    const correcto = await ejecutar(
      () => api.votar(
        detalle.solicitud.id,
        voto,
        comentarioVoto.trim() || null
      ),
      (resultado) =>
        resultado.decision
          ? `Existe mayoría provisional para: ${resultado.decision}. ` +
            'El responsable principal debe formalizarla.'
          : 'Voto registrado. El comité todavía no alcanza una mayoría.'
    )

    if (correcto) {
      setComentarioVoto('')
    }
  }

  // =====================================================
  // 10. FORMALIZAR DECISION COLECTIVA
  // =====================================================

  async function formalizarDecision(evento) {
    evento.preventDefault()

    if (!detalle?.solicitud?.id) return

    const votosActuales = detalle.votos || []

    const total = Number(
      detalle.comite?.totalIntegrantes || 0
    )

    const necesarios = Math.floor(total / 2) + 1

    const aprobar = votosActuales.filter(
      (v) => v.voto === 'APROBAR'
    ).length

    const rechazar = votosActuales.filter(
      (v) => v.voto === 'RECHAZAR'
    ).length

    const modificar = votosActuales.filter(
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

    if (!resultado) {
      setError(
        'El comité todavía no alcanza una mayoría.'
      )
      return
    }

    if (
      !decisionDatos.justificacion.trim() ||
      decisionDatos.justificacion.trim().length < 10
    ) {
      setError(
        'Escribe la justificación colectiva del comité.'
      )
      return
    }

    if (
      resultado === 'APROBADA' &&
      !decisionDatos.versionPrevista.trim()
    ) {
      setError(
        'Indica la versión en la que se incluirá el cambio.'
      )
      return
    }

    const correcto = await ejecutar(
      () => api.formalizarDecision(
        detalle.solicitud.id,
        {
          resultado,

          justificacion:
            decisionDatos.justificacion.trim(),

          condiciones:
            decisionDatos.condiciones.trim() || null,

          versionPrevista:
            decisionDatos.versionPrevista.trim() || null,
        }
      ),
      `Decisión colectiva formalizada: ${resultado}.`
    )

    if (correcto) {
      setDecisionDatos(DECISION_INICIAL)
    }
  }

  // =====================================================
  // 11. SOLICITAR INFORMACION O CORRECCIONES
  // =====================================================

  async function devolver(evento) {
    evento.preventDefault()

    if (!detalle?.solicitud?.id) return

    if (!observacion.trim()) {
      setError('Escribe la observación.')
      return
    }

    const correcto = await ejecutar(
      () => api.devolver(
        detalle.solicitud.id,
        experto ? 'CLIENTE' : destino,
        observacion.trim()
      ),
      'La solicitud de información se registró correctamente.'
    )

    if (correcto) {
      setObservacion('')
    }
  }

  // =====================================================
  // 12. DESCARGAR EVIDENCIAS
  // =====================================================

  async function descargar(archivo) {
    try {
      setError('')

      const contenido = await descargarAdjuntoAutenticado(
        `/api/solicitudes-internas/${detalle.solicitud.id}/adjuntos/${archivo.idAdjunto}`
      )

      const url = URL.createObjectURL(contenido)

      const enlace = document.createElement('a')

      enlace.href = url
      enlace.download = archivo.nombreOriginal

      document.body.appendChild(enlace)
      enlace.click()
      enlace.remove()

      window.setTimeout(
        () => URL.revokeObjectURL(url),
        5000
      )
    } catch (e) {
      setError(e.message)
    }
  }

  // Adjuntar evidencias nuevas sin recargar la página ni borrar el análisis.
  async function adjuntarEnDetalle(evento) {
    const archivos = Array.from(evento.target.files || [])
    evento.target.value = ''

    if (!detalle?.solicitud?.id || ocupado || archivos.length === 0) return
    if (archivos.length > 3) {
      setError('Selecciona un máximo de 3 archivos.')
      return
    }

    setOcupado(true)
    setError('')
    setMensaje('')
    let subidos = 0
    const errores = []

    try {
      for (const archivo of archivos) {
        try {
          await api.subirAdjunto(detalle.solicitud.id, archivo)
          subidos += 1
        } catch {
          errores.push(archivo.name)
        }
      }

      if (subidos) {
        const actualizado = await api.detalle(detalle.solicitud.id)
        setDetalle(actualizado)
        setMensaje(`${subidos} evidencia(s) agregada(s) correctamente.`)
      }
      if (errores.length) {
        setError('No se pudieron subir: ' + errores.join(', '))
      }
    } catch (e) {
      setError(
        'Las evidencias pueden estar guardadas, pero no se pudo actualizar ' +
        'su visualización. ' + e.message
      )
    } finally {
      setOcupado(false)
    }
  }

  // =====================================================
  // 13. CERRAR SESION
  // =====================================================

  function cerrarSesion() {
    logout()
    navigate('/login', { replace: true })
  }

  // =====================================================
  // 14. PERMISOS Y ESTADOS
  // =====================================================

  const solicitud = detalle?.solicitud
  const estado = solicitud?.estadoCodigo

  const puedeAnalizar =
    experto && requiereExperto(estado)

  const puedeVotar =
    comite && requiereComite(estado)

  const puedeDevolver =
    (
      experto &&
      solicitud?.origen === 'PUBLICO' &&
      requiereExperto(estado)
    ) ||
    (
      comite &&
      ['EN_COMITE', 'MODIFICACION'].includes(estado)
    )

  const pendientes = solicitudes.filter((s) =>
    experto
      ? requiereExperto(s.estadoCodigo)
      : requiereComite(s.estadoCodigo)
  ).length

  const resueltas = solicitudes.filter((s) =>
    estadoFinal(s.estadoCodigo)
  ).length

  const solicitudesFiltradas = solicitudes.filter((s) => {
    if (filtroLista === 'todas') {
      return true
    }

    if (filtroLista === 'decididas') {
      return estadoFinal(s.estadoCodigo)
    }

    if (filtroLista === 'pendientes') {
      return experto
        ? requiereExperto(s.estadoCodigo)
        : requiereComite(s.estadoCodigo)
    }

    return true
  })

  // =====================================================
  // 15. INTERFAZ DEL PANEL
  // =====================================================

  return (
    <main className="uf-panel">

      {/* ==========================================
          MENU LATERAL
      ========================================== */}

      <aside className="uf-sidebar">
        <div className="uf-logo">
          <strong>UF</strong>
          <span>UtaFlow</span>
        </div>

        <div className="uf-role">
          {experto
            ? 'GESTIÓN TÉCNICA · EXPERTO'
            : 'CONTROL DE CAMBIOS · COMITÉ'}
        </div>

        <nav aria-label="Menú de solicitudes">
          <button
            type="button"
            className={
              vista === 'resumen' ? 'activo' : ''
            }
            onClick={() => setVista('resumen')}
          >
            Tablero
          </button>

          <button
            type="button"
            className={
              ['solicitudes', 'detalle'].includes(vista)
                ? 'activo'
                : ''
            }
            onClick={() => {
              setFiltroLista('pendientes')
              setVista('solicitudes')
            }}
          >
            {experto
              ? 'Bandeja de revisión'
              : 'Bandeja del comité'}
          </button>

          <button
            type="button"
            className={
              vista === 'nueva' ? 'activo' : ''
            }
            onClick={() => setVista('nueva')}
          >
            {experto
              ? 'Nueva solicitud técnica'
              : 'Proponer un cambio'}
          </button>
        </nav>

        <div className="uf-sidebar-footer">
          <small>{usuario.nombre}</small>

          <span>
            {experto ? 'EXPERTO' : 'COMITÉ'}
          </span>

          <button
            type="button"
            onClick={cerrarSesion}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ==========================================
          CONTENIDO PRINCIPAL
      ========================================== */}

      <section className="uf-content">
        <header className="uf-topbar">
          <div>
            <span className="uf-kicker">
              {experto
                ? 'ANÁLISIS Y EVALUACIÓN DE CAMBIOS'
                : 'REVISIÓN Y DECISIONES DEL COMITÉ'}
            </span>

            <h1>
              {vista === 'resumen' && (
                experto
                  ? 'Tablero del experto'
                  : 'Tablero del comité'
              )}

              {vista === 'solicitudes' && (
                experto
                  ? 'Bandeja de evaluación'
                  : 'Bandeja de decisiones'
              )}

              {vista === 'nueva' && (
                experto
                  ? 'Nueva solicitud técnica'
                  : 'Propuesta de cambio'
              )}

              {vista === 'detalle' && (
                experto
                  ? 'Evaluación de la solicitud'
                  : 'Revisión del comité'
              )}
            </h1>
          </div>

          <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={ocupado}
            onClick={actualizarTodo}
          >
            Actualizar
          </button>
        </header>

        {/* ==========================================
            MENSAJES
        ========================================== */}

        {mensaje && (
          <div
            className="alert alert-success"
            role="status"
          >
            {mensaje}
          </div>
        )}

        {error && (
          <div
            className="alert alert-danger"
            role="alert"
          >
            {error}
          </div>
        )}

        {cargando && (
          <p>Cargando solicitudes…</p>
        )}

        {/* ==========================================
            TABLERO VISUAL
        ========================================== */}

        {!cargando && vista === 'resumen' && (
          <TableroEtapas
            solicitudes={solicitudes}
            experto={experto}
            pendientes={pendientes}
            resueltas={resueltas}
            onAbrir={abrirSolicitud}
            onNueva={() => {
              setError('')
              setMensaje('')
              setVista('nueva')
            }}
            onVerLista={() => {
              setError('')
              setMensaje('')
              setFiltroLista('pendientes')
              setVista('solicitudes')
            }}
          />
        )}

        {/* ==========================================
            BANDEJA DE SOLICITUDES
        ========================================== */}

        {!cargando && vista === 'solicitudes' && (
          <section className="uf-card">
            <h2>
              {experto
                ? 'Solicitudes para revisión técnica'
                : 'Solicitudes para decisión'}
            </h2>

            <p className="text-muted">
              {experto
                ? 'Revisa las solicitudes recibidas, registra el análisis técnico y envíalas al comité.'
                : 'Revisa las solicitudes evaluadas por un experto y registra tu voto.'}
            </p>

            <div className="d-flex flex-wrap gap-2 mb-4">
              <button
                type="button"
                className={
                  filtroLista === 'pendientes'
                    ? 'btn btn-primary'
                    : 'btn btn-outline-secondary'
                }
                onClick={() => setFiltroLista('pendientes')}
              >
                {experto ? 'Por evaluar' : 'Por decidir'}
              </button>

              <button
                type="button"
                className={
                  filtroLista === 'todas'
                    ? 'btn btn-primary'
                    : 'btn btn-outline-secondary'
                }
                onClick={() => setFiltroLista('todas')}
              >
                Todas
              </button>

              <button
                type="button"
                className={
                  filtroLista === 'decididas'
                    ? 'btn btn-primary'
                    : 'btn btn-outline-secondary'
                }
                onClick={() => setFiltroLista('decididas')}
              >
                Decididas
              </button>
            </div>

            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>Solicitud</th>
                    <th>Solicitante</th>
                    <th>Tipo ITIL</th>
                    <th>Prioridad</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>

                <tbody>
                  {solicitudesFiltradas.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.asunto}</strong>

                        <small className="d-block text-muted">
                          {s.codigo}
                        </small>
                      </td>

                      <td>{s.solicitante}</td>

                      <td>
                        {s.tipoCambio === 'EMERGENCIA' ? (
                          <span className="text-danger fw-bold">
                            EMERGENCIA
                          </span>
                        ) : (
                          s.tipoCambio || 'Normal'
                        )}
                      </td>

                      <td>{s.prioridad}</td>

                      <td>
                        <span className="uf-status">
                          {s.estado}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          disabled={ocupado}
                          onClick={() => abrirSolicitud(s.id)}
                        >
                          {experto ? 'Evaluar' : 'Revisar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {solicitudesFiltradas.length === 0 && (
                <p>
                  No existen solicitudes en esta categoría.
                </p>
              )}
            </div>
          </section>
        )}

        {/* ==========================================
            NUEVA SOLICITUD INTERNA
        ========================================== */}

        {!cargando && vista === 'nueva' && (
          <FormularioSolicitudInterna
            datos={nueva}
            catalogos={catalogos}
            usuario={usuario}
            experto={experto}
            ocupado={ocupado}
            archivos={archivosNuevos}
            onChange={actualizarNueva}
            onSeleccionarArchivos={seleccionarArchivosNuevos}
            onQuitarArchivo={quitarArchivoNuevo}
            onSubmit={crear}
          />
        )}

        {/* ==========================================
            DETALLE DE UNA SOLICITUD
        ========================================== */}

        {!cargando &&
          vista === 'detalle' &&
          solicitud && (
          <div className="uf-detail-layout">

            {/* COLUMNA PRINCIPAL */}
            <div className="uf-detail-main">

              {/* ======================================
                  INFORMACION ORIGINAL
              ====================================== */}

              <section className="uf-card">
                <button
                  type="button"
                  className="btn btn-link px-0"
                  onClick={() => setVista('solicitudes')}
                >
                  ← Volver a la bandeja
                </button>

                <div className="uf-detail-heading">
                  <div>
                    <small>{solicitud.codigo}</small>

                    <h2>{solicitud.asunto}</h2>

                    <small>
                      Origen: {solicitud.origen}
                    </small>
                  </div>

                  <span className="uf-status">
                    {solicitud.estado}
                  </span>
                </div>

                {solicitud.tipoCambio === 'EMERGENCIA' && (
                  <div
                    className="alert alert-warning"
                    role="status"
                  >
                    Cambio de emergencia: requiere revisión
                    prioritaria del experto y del comité.
                  </div>
                )}

                <div className="uf-facts">
                  <div>
                    <b>Solicitante</b>
                    <span>{solicitud.solicitante}</span>
                  </div>

                  <div>
                    <b>Sistema</b>
                    <span>{solicitud.sistema}</span>
                  </div>

                  <div>
                    <b>Prioridad</b>
                    <span>{solicitud.prioridad}</span>
                  </div>

                  <div>
                    <b>Fecha de registro</b>
                    <span>
                      {fecha(solicitud.fechaEnvio)}
                    </span>
                  </div>
                </div>

                <h3>Descripción del cambio</h3>
                <p className="uf-pre">
                  {solicitud.descripcion}
                </p>

                <h3>Justificación</h3>
                <p className="uf-pre">
                  {valor(solicitud.razon)}
                </p>

                <div className="uf-facts">
                  <div>
                    <b>Empresa o área</b>
                    <span>
                      {valor(solicitud.empresaArea)}
                    </span>
                  </div>

                  <div>
                    <b>Módulo afectado</b>
                    <span>
                      {valor(solicitud.moduloAfectado)}
                    </span>
                  </div>

                  <div>
                    <b>Versión del software</b>
                    <span>
                      {valor(solicitud.versionSoftware)}
                    </span>
                  </div>

                  <div>
                    <b>Tipo ITIL</b>
                    <span>
                      {valor(solicitud.tipoCambio)}
                    </span>
                  </div>
                </div>

                {solicitud.fechaLimite && (
                  <CampoLectura
                    titulo="Fecha deseada de atención"
                    contenido={fecha(solicitud.fechaLimite)}
                  />
                )}

                {solicitud.afectacionActual && (
                  <>
                    <h3>Afectación actual</h3>

                    <p className="uf-pre">
                      {solicitud.afectacionActual}
                    </p>
                  </>
                )}

                {solicitud.comentariosAdicionales && (
                  <>
                    <h3>Comentarios del solicitante</h3>

                    <p className="uf-pre">
                      {solicitud.comentariosAdicionales}
                    </p>
                  </>
                )}

                <ResumenSolicitudAmpliada solicitud={solicitud} />

                <VistaAdjuntos
                  archivos={detalle.adjuntos || []}
                  idSolicitud={solicitud.id}
                  onDescargar={descargar}
                />

                {Number(usuario.id) === Number(solicitud.idSolicitante) &&
                  solicitud.estadoCodigo === 'ENVIADA' && (
                  <div className="mt-3">
                    <label className="form-label fw-semibold">
                      Agregar nuevas evidencias
                    </label>
                    <input
                      type="file"
                      className="form-control"
                      accept=".png,.jpg,.jpeg,.pdf"
                      multiple
                      disabled={ocupado}
                      onChange={adjuntarEnDetalle}
                    />
                    <small className="text-muted">
                      Solo el creador puede adjuntar evidencias mientras
                      la solicitud esté enviada.
                    </small>
                  </div>
                )}
              </section>

              {/* ======================================
                  EXPERTO: EVALUACION EDITABLE
              ====================================== */}

              {experto && puedeAnalizar && (
                <FormularioEvaluacion
                  analisis={analisis}
                  onChange={actualizarAnalisis}
                  onGuardar={guardarAnalisis}
                  onEnviar={enviarAlComite}
                  ocupado={ocupado}
                  guardado={Boolean(
                    detalle.analisis?.recomendacion
                  )}
                  editado={analisisEditado}
                />
              )}

              {/* ======================================
                  EXPERTO: EVALUACION REGISTRADA
              ====================================== */}

              {experto &&
                !puedeAnalizar &&
                detalle.analisis && (
                <section className="uf-card">
                  <h2>Evaluación técnica registrada</h2>

                  <p className="text-muted">
                    El análisis está en modo de consulta
                    porque la solicitud ya no está
                    disponible para evaluación.
                  </p>

                  <CampoLectura
                    titulo="Experto responsable"
                    contenido={
                      detalle.analisis.nombreAnalista
                    }
                  />

                  <CampoLectura
                    titulo="Especificación técnica"
                    contenido={
                      detalle.analisis.especificacionTecnica
                    }
                  />

                  <CampoLectura
                    titulo="Análisis del impacto"
                    contenido={
                      detalle.analisis.analisisImpacto
                    }
                  />

                  <CampoLectura
                    titulo="Tipo de mantenimiento"
                    contenido={
                      detalle.analisis.tipoMantenimiento
                    }
                  />

                  <CampoLectura
                    titulo="Costo estimado (USD)"
                    contenido={
                      detalle.analisis.costoEstimado
                    }
                  />

                  <CampoLectura
                    titulo="Rama GitFlow"
                    contenido={
                      detalle.analisis.ramaGit
                    }
                  />

                  <CampoLectura
                    titulo="Recomendación"
                    contenido={
                      detalle.analisis.recomendacion
                    }
                  />
                </section>
              )}

              {/* ======================================
                  COMITE: REVISION DEL EXPERTO
              ====================================== */}

              {comite && (
                <section className="uf-card">
                  <h2>
                    Revisión del comité de cambios
                  </h2>

                  {!detalle.analisis ? (
                    <div className="alert alert-info">
                      Esta solicitud todavía no tiene
                      evaluación técnica. Debe pasar
                      primero por el EXPERTO.
                    </div>
                  ) : (
                    <>
                      <p className="text-muted">
                        Revisa los resultados del experto
                        antes de emitir tu voto.
                      </p>

                      <div className="uf-facts">
                        <div>
                          <b>Experto responsable</b>

                          <span>
                            {valor(
                              detalle.analisis.nombreAnalista
                            )}
                          </span>
                        </div>

                        <div>
                          <b>Recomendación</b>

                          <span>
                            {valor(
                              detalle.analisis.recomendacion
                            )}
                          </span>
                        </div>

                        <div>
                          <b>Tipo ITIL</b>

                          <span>
                            {valor(
                              detalle.analisis.codigoTipoCambio
                            )}
                          </span>
                        </div>

                        <div>
                          <b>Horas estimadas</b>

                          <span>
                            {valor(
                              detalle.analisis.horasEstimadas
                            )}
                          </span>
                        </div>
                      </div>

                      <details className="mt-4" open>
                        <summary className="fw-bold">
                          Ver evaluación técnica completa
                        </summary>

                        <div className="mt-3">
                          {[
                            [
                              'Especificación técnica',
                              'especificacionTecnica',
                            ],
                            [
                              'Análisis del impacto',
                              'analisisImpacto',
                            ],
                            [
                              'Servicios afectados',
                              'serviciosAfectados',
                            ],
                            [
                              'Tipo de mantenimiento',
                              'tipoMantenimiento',
                            ],
                            [
                              'Componentes afectados',
                              'componentesAfectados',
                            ],
                            [
                              'Archivos previstos',
                              'archivosPrevistos',
                            ],
                            [
                              'Riesgos identificados',
                              'riesgos',
                            ],
                            [
                              'Costo estimado (USD)',
                              'costoEstimado',
                            ],
                            [
                              'Rama GitFlow',
                              'ramaGit',
                            ],
                            [
                              'Ambiente previsto',
                              'ambientePrevisto',
                            ],
                            [
                              'Estrategia de implementación',
                              'estrategiaDespliegue',
                            ],
                            [
                              'Plan de implementación',
                              'planRollout',
                            ],
                            [
                              'Plan de pruebas',
                              'planPruebas',
                            ],
                            [
                              'Criterios de aceptación',
                              'criteriosAceptacion',
                            ],
                            [
                              'Plan de reversión',
                              'planBackout',
                            ],
                            [
                              'Consecuencia de no hacer el cambio',
                              'consecuenciaNoHacer',
                            ],
                            [
                              'Sugerencia del experto',
                              'sugerencia',
                            ],
                          ].map(([titulo, campo]) => (
                            <CampoLectura
                              key={campo}
                              titulo={titulo}
                              contenido={
                                detalle.analisis[campo]
                              }
                            />
                          ))}

                          <CampoLectura
                            titulo="Base de datos afectada"
                            contenido={
                              detalle.analisis.bdAfectada
                                ? 'Sí'
                                : 'No'
                            }
                          />
                        </div>
                      </details>
                    </>
                  )}
                </section>
              )}

              {/* ======================================
                  COMITE: DECISION COLECTIVA
              ====================================== */}

              {comite && (
                <DecisionColectiva
                  detalle={detalle}
                  usuario={usuario}
                  datos={decisionDatos}
                  onChange={actualizarDecision}
                  onSubmit={formalizarDecision}
                  ocupado={ocupado}
                />
              )}

              {/* ======================================
                  SOLICITAR ACLARACIONES O CORRECCIONES
              ====================================== */}

              {puedeDevolver && (
                <section className="uf-card">
                  <h2>
                    {experto
                      ? 'Solicitar información al cliente'
                      : 'Solicitar aclaraciones o correcciones'}
                  </h2>

                  <p className="text-muted">
                    {experto
                      ? 'Pregunta al solicitante por los datos que necesitas para evaluar el cambio.'
                      : 'Puedes pedir información al solicitante público o solicitar correcciones a la evaluación del experto.'}
                  </p>

                  <form
                    className="uf-form"
                    onSubmit={devolver}
                  >
                    {comite && (
                      <label>
                        Enviar observación a

                        <select
                          className="form-select"
                          value={destino}
                          onChange={(e) =>
                            setDestino(e.target.value)
                          }
                        >
                          {solicitud.origen === 'PUBLICO' && (
                            <option value="CLIENTE">
                              Solicitante
                            </option>
                          )}

                          <option value="EXPERTO">
                            Experto responsable
                          </option>
                        </select>
                      </label>
                    )}

                    <label>
                      Observación *
                      <textarea
                        className="form-control"
                        rows={4}
                        required
                        maxLength={500}
                        value={observacion}
                        onChange={(e) =>
                          setObservacion(e.target.value)
                        }
                        placeholder="Escribe qué información o corrección se necesita."
                      />
                    </label>

                    <div>
                      <button
                        type="submit"
                        className="btn btn-outline-warning"
                        disabled={ocupado}
                      >
                        Enviar observación
                      </button>
                    </div>
                  </form>
                </section>
              )}

            </div>

            {/* ======================================
                PANEL DERECHO:
                VOTACION, HISTORIAL, OBSERVACIONES
            ====================================== */}

            <PanelLateralSolicitud
              detalle={detalle}
              usuario={usuario}
              comite={comite}
              puedeVotar={puedeVotar}
              voto={voto}
              onVoto={setVoto}
              comentarioVoto={comentarioVoto}
              onComentarioVoto={setComentarioVoto}
              onRegistrarVoto={registrarVoto}
              ocupado={ocupado}
            />

          </div>
        )}

      </section>
    </main>
  )
}
