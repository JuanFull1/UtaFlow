
import {
  apiAutenticada,
  subirAdjuntoInterno,
} from './authService.js'

const BASE = '/api/solicitudes-internas'

export const solicitudesInternasService = {
  listar() {
    return apiAutenticada(BASE)
  },

  detalle(id) {
    return apiAutenticada(`${BASE}/${id}`)
  },

  crear(datos) {
    return apiAutenticada(BASE, {
      method: 'POST',
      body: datos,
    })
  },

  subirAdjunto(id, archivo) {
    return subirAdjuntoInterno(id, archivo)
  },

  guardarAnalisis(id, datos) {
    return apiAutenticada(`${BASE}/${id}/analisis`, {
      method: 'POST',
      body: datos,
    })
  },

  enviarAlComite(id) {
    return apiAutenticada(`${BASE}/${id}/enviar-comite`, {
      method: 'POST',
      body: {},
    })
  },

  votar(id, voto, comentario) {
    return apiAutenticada(`${BASE}/${id}/voto`, {
      method: 'POST',
      body: { voto, comentario },
    })
  },

  devolver(id, destino, mensaje) {
    return apiAutenticada(`${BASE}/${id}/devolver`, {
      method: 'POST',
      body: { destino, mensaje },
    })
  },

  ciclo(id) {
    return apiAutenticada(`${BASE}/${id}/ciclo`)
  },

  actividadGitHub(id) {
    return apiAutenticada(`${BASE}/${id}/github`)
  },

  iniciarImplementacion(id) {
    return apiAutenticada(`${BASE}/${id}/ciclo/iniciar`, {
      method: 'POST',
      body: {},
    })
  },

  registrarImplementacion(id, datos) {
    return apiAutenticada(`${BASE}/${id}/ciclo/implementacion`, {
      method: 'POST',
      body: datos,
    })
  },

  registrarRevision(id, datos) {
    return apiAutenticada(`${BASE}/${id}/ciclo/revision`, {
      method: 'POST',
      body: datos,
    })
  },

  cerrarCambio(id, datos) {
    return apiAutenticada(`${BASE}/${id}/ciclo/cierre`, {
      method: 'POST',
      body: datos,
    })
  },

  reporteEstado() {
    return apiAutenticada(`${BASE}/reporte-estado`)
  },

  formalizarDecision(id, datos) {
    return apiAutenticada(`${BASE}/${id}/decision-final`, {
      method: 'POST',
      body: datos,
    })
  },
}
