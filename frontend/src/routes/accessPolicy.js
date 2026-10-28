// Roles internos con sesión.
// Los usuarios finales siguen utilizando /solicitud
// sin necesidad de tener una cuenta.

export const supportedRoles = Object.freeze([
  'EXPERTO',
  'COMITE',
  'ADMIN',
])

export function homeForRole(rol) {
  switch (rol) {
    case 'EXPERTO':
      return '/app/experto'

    case 'COMITE':
      return '/app/comite'

    case 'ADMIN':
      return '/app/admin'

    default:
      return '/acceso-denegado'
  }
}