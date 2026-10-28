import assert from 'node:assert/strict'
import { test } from 'node:test'
import { homeForRole, supportedRoles } from '../src/routes/accessPolicy.js'

test('el destino respeta los roles actuales sin permisos implícitos de experto', () => {
  assert.equal(homeForRole('EXPERTO'), '/app/experto')
  assert.equal(homeForRole('COMITE'), '/app')
  assert.equal(homeForRole('ADMIN'), '/app')
  for (const rol of ['USUARIO_FINAL', 'SUPERADMIN', 'experto', '', undefined]) {
    assert.equal(homeForRole(rol), '/acceso-denegado')
    assert.equal(supportedRoles.includes(rol), false)
  }
})
