import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import { useAuth } from '../../context/AuthContext.js'
import { administracionService as api } from '../../services/administracionService.js'

import './Administracion.css'

const ROLES = [
  {
    valor: 'EXPERTO',
    texto: 'Experto técnico',
  },
  {
    valor: 'COMITE',
    texto: 'Integrante del comité',
  },
  {
    valor: 'ADMIN',
    texto: 'Administrador',
  },
]

const VACIO = {
  nombre: '',
  correo: '',
  rol: 'EXPERTO',
  contrasena: '',
  confirmar: '',
  activo: true,
}

function fecha(valor) {
  if (!valor) return '—'

  const f = new Date(valor)

  return Number.isNaN(f.getTime())
    ? String(valor)
    : f.toLocaleString('es-EC')
}

export default function Administracion() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()

  // =====================================================
  // ESTADOS
  // =====================================================

  const [usuarios, setUsuarios] = useState([])
  const [auditoria, setAuditoria] = useState([])

  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState(false)

  const [seccion, setSeccion] = useState('usuarios')

  const [busqueda, setBusqueda] = useState('')
  const [rolFiltro, setRolFiltro] = useState('TODOS')

  const [usuarioEditado, setUsuarioEditado] = useState(null)
  const [form, setForm] = useState(VACIO)

  const [claveId, setClaveId] = useState(null)
  const [claveNueva, setClaveNueva] = useState('')
  const [claveConfirmacion, setClaveConfirmacion] = useState('')

  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  // =====================================================
  // 1. CARGAR DATOS
  // =====================================================

  useEffect(() => {
    let activo = true

    Promise.all([
      api.usuarios(),
      api.auditoria(),
    ])
      .then(([lista, movimientos]) => {
        if (!activo) return

        setUsuarios(lista)
        setAuditoria(movimientos)
      })
      .catch((e) => {
        if (activo) setError(e.message)
      })
      .finally(() => {
        if (activo) setCargando(false)
      })

    return () => {
      activo = false
    }
  }, [])

  async function refrescar() {
    const [lista, movimientos] = await Promise.all([
      api.usuarios(),
      api.auditoria(),
    ])

    setUsuarios(lista)
    setAuditoria(movimientos)
  }

  // =====================================================
  // 2. EJECUTAR OPERACIONES
  // =====================================================

  async function ejecutar(tarea, correcto) {
    if (ocupado) return false

    setOcupado(true)
    setMensaje('')
    setError('')

    try {
      await tarea()

      setMensaje(correcto)

      try {
        await refrescar()
      } catch {
        setError(
          'Operación realizada, pero la tabla no se pudo ' +
          'actualizar. Pulsa Actualizar.'
        )
      }

      return true
    } catch (e) {
      setError(
        e.status === 409
          ? 'La operación no está permitida. ' +
            'Verifica que no sea el último ADMIN y que ' +
            'hayas designado otro principal antes de ' +
            'cambiar ese integrante.'
          : e.message
      )

      return false
    } finally {
      setOcupado(false)
    }
  }

  // =====================================================
  // 3. FORMULARIOS
  // =====================================================

  function cambiar(evento) {
    const { name, type, checked, value } = evento.target

    setForm((anterior) => ({
      ...anterior,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  function nuevo() {
    setForm(VACIO)
    setUsuarioEditado(null)
    setClaveId(null)

    setError('')
    setMensaje('')

    setSeccion('formulario')
  }

  function editar(u) {
    setForm({
      nombre: u.nombre,
      correo: u.correo,
      rol: u.rol,
      activo: u.activo,
      contrasena: '',
      confirmar: '',
    })

    setUsuarioEditado(u.id)
    setClaveId(null)

    setError('')
    setMensaje('')

    setSeccion('formulario')
  }

  // =====================================================
  // 4. CREAR O EDITAR USUARIO
  // =====================================================

  async function guardar(evento) {
    evento.preventDefault()

    const nombre = form.nombre.trim()
    const correo = form.correo.trim().toLowerCase()

    if (nombre.length < 2 || !correo.includes('@')) {
      setError('Completa correctamente nombre y correo.')
      return
    }

    if (
      !usuarioEditado &&
      (
        form.contrasena.length < 12 ||
        !/[a-záéíóúñ]/i.test(form.contrasena) ||
        !/\d/.test(form.contrasena) ||
        form.contrasena !== form.confirmar
      )
    ) {
      setError(
        'La contraseña necesita 12 caracteres, letras y ' +
        'números, y ambas entradas deben coincidir.'
      )
      return
    }

    const datos = {
      nombre,
      correo,
      rol: form.rol,
    }

    const correcto = await ejecutar(
      () => usuarioEditado
        ? api.editar(usuarioEditado, {
            ...datos,
            activo: form.activo,
          })
        : api.crear({
            ...datos,
            contrasena: form.contrasena,
          }),

      usuarioEditado
        ? 'Usuario actualizado.'
        : 'Usuario creado.'
    )

    if (correcto) {
      setForm(VACIO)
      setUsuarioEditado(null)
      setSeccion('usuarios')
    }
  }

  // =====================================================
  // 5. RESTABLECER CONTRASEÑA
  // =====================================================

  async function cambiarClave(evento) {
    evento.preventDefault()

    if (
      claveNueva.length < 12 ||
      !/[a-záéíóúñ]/i.test(claveNueva) ||
      !/\d/.test(claveNueva) ||
      claveNueva !== claveConfirmacion
    ) {
      setError(
        'La contraseña requiere 12 caracteres, letras, ' +
        'números y confirmación idéntica.'
      )
      return
    }

    const correcto = await ejecutar(
      () => api.cambiarClave(claveId, claveNueva),
      'Contraseña restablecida.'
    )

    if (correcto) {
      setClaveNueva('')
      setClaveConfirmacion('')
      setClaveId(null)
    }
  }

  // =====================================================
  // 6. PRINCIPAL DEL COMITE
  // =====================================================

  async function designar(u) {
    if (
      !window.confirm(
        `¿Designar a ${u.nombre} como responsable principal del comité?`
      )
    ) {
      return
    }

    await ejecutar(
      () => api.designarPrincipal(u.id),
      'Responsable principal actualizado.'
    )
  }

  // =====================================================
  // 7. FILTROS Y ESTADISTICAS
  // =====================================================

  const filtrados = usuarios.filter((u) => {
    const coincide = `${u.nombre} ${u.correo}`
      .toLowerCase()
      .includes(busqueda.toLowerCase().trim())

    return coincide &&
      (rolFiltro === 'TODOS' || u.rol === rolFiltro)
  })

  const totalActivos = usuarios.filter(
    (u) => u.activo
  ).length

  const admins = usuarios.filter(
    (u) => u.rol === 'ADMIN' && u.activo
  ).length

  const expertos = usuarios.filter(
    (u) => u.rol === 'EXPERTO' && u.activo
  ).length

  const integrantes = usuarios.filter(
    (u) =>
      u.rol === 'COMITE' &&
      u.activo &&
      u.miembroComite
  ).length

  const principal = usuarios.find(
    (u) => u.esPrincipal && u.activo && u.miembroComite
  )

  function cerrar() {
    logout()
    navigate('/login', { replace: true })
  }

  // =====================================================
  // 8. PANEL PRINCIPAL
  // =====================================================

  return (
    <main className="uf-admin-layout">

      {/* ==========================================
          MENU LATERAL
      ========================================== */}

      <aside className="uf-admin-aside">

        <div className="uf-admin-brand">
          <span>UF</span>
          UtaFlow
        </div>

        <p className="uf-admin-role">
          PANEL DE ADMINISTRACIÓN
        </p>

        <nav aria-label="Menú administración">
          <button
            type="button"
            className={
              seccion === 'usuarios'
                ? 'seleccionado'
                : ''
            }
            onClick={() => setSeccion('usuarios')}
          >
            Usuarios y roles
          </button>

          <button
            type="button"
            className={
              seccion === 'formulario'
                ? 'seleccionado'
                : ''
            }
            onClick={nuevo}
          >
            Crear usuario
          </button>

          <button
            type="button"
            className={
              seccion === 'auditoria'
                ? 'seleccionado'
                : ''
            }
            onClick={() => setSeccion('auditoria')}
          >
            Auditoría
          </button>
        </nav>

        <div className="uf-admin-profile">
          <strong>{usuario.nombre}</strong>

          <small>{usuario.correo}</small>

          <span>ADMIN</span>

          <button
            type="button"
            onClick={cerrar}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ==========================================
          CONTENIDO PRINCIPAL
      ========================================== */}

      <section className="uf-admin-main">

        <header className="uf-admin-topbar">
          <div>
            <small>
              GESTIÓN DE ACCESOS · UTAFLOW
            </small>

            <h1>
              {seccion === 'usuarios'
                ? 'Administración de usuarios'
                : seccion === 'auditoria'
                  ? 'Historial administrativo'
                  : usuarioEditado
                    ? 'Editar usuario'
                    : 'Registrar usuario'}
            </h1>
          </div>

          <button
            className="btn btn-outline-primary"
            type="button"
            disabled={ocupado}
            onClick={() =>
              ejecutar(
                refrescar,
                'Información actualizada.'
              )
            }
          >
            Actualizar
          </button>
        </header>

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

        {cargando ? (
          <p>Cargando usuarios…</p>
        ) : (
          <>
            {/* ==================================
                DIRECTORIO DE USUARIOS
            ================================== */}

            {seccion === 'usuarios' && (
              <>
                <div className="uf-admin-stats">
                  <div>
                    <small>Usuarios activos</small>
                    <strong>{totalActivos}</strong>
                  </div>

                  <div>
                    <small>Administradores</small>
                    <strong>{admins}</strong>
                  </div>

                  <div>
                    <small>Expertos</small>
                    <strong>{expertos}</strong>
                  </div>

                  <div>
                    <small>Miembros del comité</small>
                    <strong>{integrantes}</strong>
                  </div>
                </div>

                <section className="uf-admin-card">
                  <div className="uf-admin-card-header">
                    <div>
                      <h2>Directorio de usuarios</h2>

                      <p>
                        Designación principal:{' '}
                        <b>
                          {principal?.nombre || 'Sin asignar'}
                        </b>
                      </p>
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={nuevo}
                    >
                      + Nuevo usuario
                    </button>
                  </div>

                  <div className="uf-admin-filters">
                    <input
                      className="form-control"
                      aria-label="Buscar usuario"
                      placeholder="Buscar por nombre o correo"
                      value={busqueda}
                      onChange={(e) =>
                        setBusqueda(e.target.value)
                      }
                    />

                    <select
                      className="form-select"
                      aria-label="Filtrar por rol"
                      value={rolFiltro}
                      onChange={(e) =>
                        setRolFiltro(e.target.value)
                      }
                    >
                      <option value="TODOS">
                        Todos los roles
                      </option>

                      {ROLES.map((r) => (
                        <option
                          key={r.valor}
                          value={r.valor}
                        >
                          {r.texto}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="table-responsive">
                    <table className="table align-middle">
                      <thead>
                        <tr>
                          <th>Usuario</th>
                          <th>Rol</th>
                          <th>Estado</th>
                          <th>Comité</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>

                      <tbody>
                        {filtrados.map((u) => (
                          <tr key={u.id}>
                            <td>
                              <b>{u.nombre}</b>

                              <small className="uf-admin-muted">
                                {u.correo}
                              </small>
                            </td>

                            <td>
                              <span className="uf-admin-pill">
                                {u.rol}
                              </span>
                            </td>

                            <td>
                              {u.activo
                                ? 'Activo'
                                : 'Inactivo'}
                            </td>

                            <td>
                              {u.esPrincipal
                                ? <b>Principal</b>
                                : u.miembroComite
                                  ? 'Integrante'
                                  : '—'}
                            </td>

                            <td>
                              <div className="uf-admin-actions">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => editar(u)}
                                >
                                  Editar
                                </button>

                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-secondary"
                                  onClick={() => {
                                    setClaveId(u.id)
                                    setClaveNueva('')
                                    setClaveConfirmacion('')
                                    setError('')
                                  }}
                                >
                                  Contraseña
                                </button>

                                {u.rol === 'COMITE' &&
                                  u.activo &&
                                  u.miembroComite &&
                                  !u.esPrincipal && (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-success"
                                    disabled={ocupado}
                                    onClick={() => designar(u)}
                                  >
                                    Hacer principal
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {filtrados.length === 0 && (
                      <p className="p-3">
                        No se encontraron usuarios.
                      </p>
                    )}
                  </div>
                </section>

                {/* RESTABLECER CONTRASEÑA */}
                {claveId !== null && (
                  <section className="uf-admin-card">
                    <h2>Restablecer contraseña</h2>

                    <p>
                      Usuario:{' '}
                      <b>
                        {usuarios.find(
                          (u) => u.id === claveId
                        )?.nombre}
                      </b>
                      . No se mostrará ni guardará la
                      contraseña en texto plano.
                    </p>

                    <form
                      className="uf-admin-password"
                      onSubmit={cambiarClave}
                    >
                      <input
                        type="password"
                        autoComplete="new-password"
                        className="form-control"
                        value={claveNueva}
                        minLength={12}
                        maxLength={128}
                        required
                        onChange={(e) =>
                          setClaveNueva(e.target.value)
                        }
                        placeholder="Nueva contraseña"
                      />

                      <input
                        type="password"
                        autoComplete="new-password"
                        className="form-control"
                        value={claveConfirmacion}
                        minLength={12}
                        maxLength={128}
                        required
                        onChange={(e) =>
                          setClaveConfirmacion(e.target.value)
                        }
                        placeholder="Confirmar contraseña"
                      />

                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={ocupado}
                      >
                        Guardar contraseña
                      </button>

                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => {
                          setClaveId(null)
                          setClaveNueva('')
                          setClaveConfirmacion('')
                        }}
                      >
                        Cancelar
                      </button>
                    </form>
                  </section>
                )}
              </>
            )}

            {/* ==================================
                CREAR / EDITAR USUARIO
            ================================== */}

            {seccion === 'formulario' && (
              <section className="uf-admin-card uf-admin-form-card">

                <h2>
                  {usuarioEditado
                    ? 'Modificar cuenta existente'
                    : 'Crear cuenta nueva'}
                </h2>

                <p>
                  Solo el administrador puede registrar
                  o modificar usuarios internos.
                  Los solicitantes públicos no requieren cuenta.
                </p>

                <form onSubmit={guardar}>

                  <div className="uf-admin-form-grid">

                    <label>
                      Nombre completo *

                      <input
                        className="form-control"
                        name="nombre"
                        value={form.nombre}
                        onChange={cambiar}
                        minLength={2}
                        maxLength={150}
                        required
                      />
                    </label>

                    <label>
                      Correo electrónico *

                      <input
                        className="form-control"
                        type="email"
                        name="correo"
                        value={form.correo}
                        onChange={cambiar}
                        maxLength={200}
                        required
                      />
                    </label>

                    <label>
                      Rol del usuario *

                      <select
                        className="form-select"
                        name="rol"
                        value={form.rol}
                        onChange={cambiar}
                        required
                      >
                        {ROLES.map((r) => (
                          <option
                            key={r.valor}
                            value={r.valor}
                          >
                            {r.texto}
                          </option>
                        ))}
                      </select>
                    </label>

                    {!usuarioEditado && (
                      <label>
                        Contraseña inicial *

                        <input
                          className="form-control"
                          type="password"
                          name="contrasena"
                          autoComplete="new-password"
                          minLength={12}
                          maxLength={128}
                          required
                          value={form.contrasena}
                          onChange={cambiar}
                        />

                        <small>
                          12 a 128 caracteres,
                          con letras y números.
                        </small>
                      </label>
                    )}

                    {!usuarioEditado && (
                      <label>
                        Confirmar contraseña *

                        <input
                          className="form-control"
                          type="password"
                          name="confirmar"
                          autoComplete="new-password"
                          minLength={12}
                          maxLength={128}
                          required
                          value={form.confirmar}
                          onChange={cambiar}
                        />
                      </label>
                    )}
                  </div>

                  {usuarioEditado !== null && (
                    <label className="uf-admin-check">
                      <input
                        type="checkbox"
                        name="activo"
                        checked={form.activo}
                        onChange={cambiar}
                      />

                      Cuenta activa
                    </label>
                  )}

                  {usuarioEditado !== null &&
                    usuarios.some(
                      (u) =>
                        u.id === usuarioEditado &&
                        u.esPrincipal
                    ) && (
                    <p className="alert alert-info">
                      Para quitar el rol COMITÉ o
                      desactivar al principal,
                      primero designa a otro responsable
                      desde el directorio.
                    </p>
                  )}

                  <div className="uf-admin-form-actions">
                    <button
                      className="btn btn-primary"
                      type="submit"
                      disabled={ocupado}
                    >
                      {ocupado
                        ? 'Guardando…'
                        : usuarioEditado
                          ? 'Guardar cambios'
                          : 'Crear usuario'}
                    </button>

                    <button
                      className="btn btn-outline-secondary"
                      type="button"
                      onClick={() =>
                        setSeccion('usuarios')
                      }
                    >
                      Volver al directorio
                    </button>
                  </div>
                </form>
              </section>
            )}

            {/* ==================================
                AUDITORIA
            ================================== */}

            {seccion === 'auditoria' && (
              <section className="uf-admin-card">
                <h2>Últimas acciones administrativas</h2>

                <p>
                  Registro de altas, ediciones,
                  cambios de contraseña y designaciones
                  del responsable principal.
                </p>

                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Administrador</th>
                        <th>Usuario afectado</th>
                        <th>Acción</th>
                        <th>Descripción</th>
                      </tr>
                    </thead>

                    <tbody>
                      {auditoria.map((a) => (
                        <tr key={a.id}>
                          <td>{fecha(a.fecha)}</td>

                          <td>{a.administrador}</td>

                          <td>
                            {a.usuarioObjetivo || '—'}
                          </td>

                          <td>
                            {a.accion.replaceAll('_', ' ')}
                          </td>

                          <td>{a.descripcion}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {auditoria.length === 0 && (
                    <p>
                      Aún no hay cambios registrados.
                    </p>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </section>
    </main>
  )
}