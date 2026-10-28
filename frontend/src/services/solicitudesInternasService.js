
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

  formalizarDecision(id, datos) {
    return apiAutenticada(`${BASE}/${id}/decision-final`, {
      method: 'POST',
      body: datos,
    })
  },
}
