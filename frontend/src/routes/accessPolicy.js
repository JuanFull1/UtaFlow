export const supportedRoles = Object.freeze(['EXPERTO', 'COMITE', 'ADMIN'])

// Unknown or future roles receive no private route permissions.
export function homeForRole(rol) {
  if (rol === 'EXPERTO') return '/app/experto'
  if (rol === 'COMITE' || rol === 'ADMIN') return '/app'
  return '/acceso-denegado'
}
