import { apiAutenticada } from './authService.js'

const BASE = '/api/admin'

export const administracionService = {
  usuarios() {
    return apiAutenticada(`${BASE}/usuarios`)
  },

  auditoria() {
    return apiAutenticada(`${BASE}/auditoria`)
  },

  crear(datos) {
    return apiAutenticada(`${BASE}/usuarios`, {
      method: 'POST',
      body: datos,
    })
  },

  editar(id, datos) {
    return apiAutenticada(`${BASE}/usuarios/${id}`, {
      method: 'PUT',
      body: datos,
    })
  },

  cambiarClave(id, contrasena) {
    return apiAutenticada(
      `${BASE}/usuarios/${id}/contrasena`,
      {
        method: 'PUT',
        body: { contrasena },
      }
    )
  },

  designarPrincipal(id) {
    return apiAutenticada(
      `${BASE}/comite/principal/${id}`,
      {
        method: 'PUT',
      }
    )
  },
}