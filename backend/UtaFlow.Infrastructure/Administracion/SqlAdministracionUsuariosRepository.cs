using System.Data;
using Microsoft.Data.SqlClient;
using UtaFlow.Application.Administracion;
using UtaFlow.Infrastructure.Authentication;

namespace UtaFlow.Infrastructure.Administracion;

public sealed class SqlAdministracionUsuariosRepository(
    SqlConnectionFactory conexiones
) : IAdministracionUsuariosRepository
{
    private static SqlParameter P(
        SqlCommand comando,
        string nombre,
        SqlDbType tipo,
        object? dato,
        int longitud = 0
    )
    {
        var parametro = longitud == 0
            ? comando.Parameters.Add(nombre, tipo)
            : comando.Parameters.Add(nombre, tipo, longitud);

        parametro.Value = dato ?? DBNull.Value;
        return parametro;
    }

    // =========================================================
    // 1. LISTAR USUARIOS Y SUS RESPONSABILIDADES
    // =========================================================

    public async Task<IReadOnlyList<UsuarioAdministradoDto>> ListarAsync(
        CancellationToken ct
    )
    {
        await using var conexion =
            await conexiones.OpenAsync(ct);

        await using var comando = new SqlCommand(
            """
            SELECT
                u.IdUsuario,
                u.Nombre,
                u.Correo,
                r.Codigo,
                u.Activo,
                CAST(ISNULL(cm.Activo, 0) AS BIT),
                CAST(ISNULL(cm.EsPrincipal, 0) AS BIT)
            FROM dbo.Usuario u
            INNER JOIN dbo.Rol r
                ON r.IdRol = u.IdRol
            LEFT JOIN dbo.ComiteMiembro cm
                ON cm.IdUsuario = u.IdUsuario
            ORDER BY u.IdUsuario DESC;
            """,
            conexion
        );

        var resultado = new List<UsuarioAdministradoDto>();

        await using var lector =
            await comando.ExecuteReaderAsync(ct);

        while (await lector.ReadAsync(ct))
        {
            resultado.Add(new UsuarioAdministradoDto(
                lector.GetInt32(0),
                lector.GetString(1),
                lector.GetString(2),
                lector.GetString(3),
                lector.GetBoolean(4),
                lector.GetBoolean(5),
                lector.GetBoolean(6)
            ));
        }

        return resultado;
    }

    // =========================================================
    // 2. AUDITORIA ADMINISTRATIVA
    // =========================================================

    public async Task<IReadOnlyList<AuditoriaAdministracionDto>>
        AuditoriaAsync(CancellationToken ct)
    {
        await using var conexion =
            await conexiones.OpenAsync(ct);

        await using var comando = new SqlCommand(
            """
            SELECT TOP (100)
                a.IdAuditoria,
                ad.Nombre,
                objetivo.Nombre,
                a.Accion,
                a.Descripcion,
                a.Fecha
            FROM dbo.AuditoriaAdministracion a
            INNER JOIN dbo.Usuario ad
                ON ad.IdUsuario = a.IdAdministrador
            LEFT JOIN dbo.Usuario objetivo
                ON objetivo.IdUsuario = a.IdUsuarioObjetivo
            ORDER BY
                a.Fecha DESC,
                a.IdAuditoria DESC;
            """,
            conexion
        );

        var resultado = new List<AuditoriaAdministracionDto>();

        await using var lector =
            await comando.ExecuteReaderAsync(ct);

        while (await lector.ReadAsync(ct))
        {
            resultado.Add(new AuditoriaAdministracionDto(
                lector.GetInt64(0),
                lector.GetString(1),
                lector.IsDBNull(2)
                    ? null
                    : lector.GetString(2),
                lector.GetString(3),
                lector.GetString(4),
                DateTime.SpecifyKind(
                    lector.GetDateTime(5),
                    DateTimeKind.Utc
                )
            ));
        }

        return resultado;
    }

    // =========================================================
    // 3. BLOQUEO PARA CAMBIOS ADMINISTRATIVOS
    // =========================================================

    private static async Task BloquearAdministracionAsync(
        SqlConnection conexion,
        SqlTransaction tx,
        CancellationToken ct
    )
    {
        await using var comando = new SqlCommand(
            """
            DECLARE @resultado INT;

            EXEC @resultado = sys.sp_getapplock
                @Resource = N'UtaFlow.AdministracionUsuarios',
                @LockMode = 'Exclusive',
                @LockOwner = 'Transaction',
                @LockTimeout = 10000;

            SELECT @resultado;
            """,
            conexion,
            tx
        );

        var resultado = Convert.ToInt32(
            await comando.ExecuteScalarAsync(ct)
        );

        if (resultado < 0)
        {
            throw new InvalidOperationException(
                "La administración está ocupada. Inténtalo de nuevo."
            );
        }
    }

    // =========================================================
    // 4. VALIDAR ADMINISTRADOR ACTIVO
    // =========================================================

    private static async Task<bool> EsAdministradorActivoAsync(
        SqlConnection conexion,
        SqlTransaction tx,
        int id,
        CancellationToken ct
    )
    {
        await using var comando = new SqlCommand(
            """
            SELECT COUNT(*)
            FROM dbo.Usuario u WITH (UPDLOCK, HOLDLOCK)
            INNER JOIN dbo.Rol r
                ON r.IdRol = u.IdRol
            WHERE u.IdUsuario = @Id
              AND u.Activo = 1
              AND r.Codigo = 'ADMIN';
            """,
            conexion,
            tx
        );

        P(comando, "@Id", SqlDbType.Int, id);

        return Convert.ToInt32(
            await comando.ExecuteScalarAsync(ct)
        ) == 1;
    }

    private static async Task<byte?> IdRolAsync(
        SqlConnection conexion,
        SqlTransaction tx,
        string rol,
        CancellationToken ct
    )
    {
        await using var comando = new SqlCommand(
            """
            SELECT IdRol
            FROM dbo.Rol
            WHERE Codigo = @Rol;
            """,
            conexion,
            tx
        );

        P(comando, "@Rol", SqlDbType.VarChar, rol, 20);

        var valor = await comando.ExecuteScalarAsync(ct);

        return valor is byte id ? id : null;
    }

    // =========================================================
    // 5. REGISTRAR CAMBIOS EN AUDITORIA
    // =========================================================

    private static async Task AuditarAsync(
        SqlConnection conexion,
        SqlTransaction tx,
        int actor,
        int objetivo,
        string accion,
        string descripcion,
        CancellationToken ct
    )
    {
        await using var comando = new SqlCommand(
            """
            INSERT dbo.AuditoriaAdministracion
            (
                IdAdministrador,
                IdUsuarioObjetivo,
                Accion,
                Descripcion
            )
            VALUES
            (
                @Actor,
                @Objetivo,
                @Accion,
                @Descripcion
            );
            """,
            conexion,
            tx
        );

        P(comando, "@Actor", SqlDbType.Int, actor);
        P(comando, "@Objetivo", SqlDbType.Int, objetivo);

        P(comando, "@Accion",
            SqlDbType.VarChar, accion, 40);

        P(comando, "@Descripcion",
            SqlDbType.NVarChar, descripcion, 1000);

        await comando.ExecuteNonQueryAsync(ct);
    }

    // =========================================================
    // 6. CREAR USUARIO
    // =========================================================

    public async Task<ResultadoAdmin> CrearAsync(
        int actorId,
        CrearUsuarioAdminRequest datos,
        string claveHash,
        CancellationToken ct
    )
    {
        await using var conexion =
            await conexiones.OpenAsync(ct);

        await using var tx = (SqlTransaction)
            await conexion.BeginTransactionAsync(
                IsolationLevel.Serializable,
                ct
            );

        await BloquearAdministracionAsync(conexion, tx, ct);

        if (!await EsAdministradorActivoAsync(
            conexion, tx, actorId, ct
        ))
        {
            return new ResultadoAdmin(
                false,
                "No tienes una sesión de administrador activa."
            );
        }

        var rolId = await IdRolAsync(
            conexion, tx, datos.Rol, ct
        );

        if (rolId is null)
        {
            return new ResultadoAdmin(
                false,
                "Rol no disponible."
            );
        }

        await using var comando = new SqlCommand(
            """
            INSERT dbo.Usuario
            (
                Nombre,
                Correo,
                ClaveHash,
                IdRol,
                Activo
            )
            OUTPUT INSERTED.IdUsuario
            VALUES
            (
                @Nombre,
                @Correo,
                @Hash,
                @Rol,
                1
            );
            """,
            conexion,
            tx
        );

        P(comando, "@Nombre",
            SqlDbType.NVarChar, datos.Nombre, 150);

        P(comando, "@Correo",
            SqlDbType.NVarChar, datos.Correo, 200);

        P(comando, "@Hash",
            SqlDbType.NVarChar, claveHash, 255);

        P(comando, "@Rol",
            SqlDbType.TinyInt, rolId.Value);

        var id = Convert.ToInt32(
            await comando.ExecuteScalarAsync(ct)
        );

        // Al crear un COMITE, se registra también
        // su pertenencia al comité.
        if (datos.Rol == "COMITE")
        {
            await using var miembro = new SqlCommand(
                """
                INSERT dbo.ComiteMiembro
                (
                    IdUsuario,
                    Activo,
                    EsPrincipal
                )
                VALUES (@Id, 1, 0);
                """,
                conexion,
                tx
            );

            P(miembro, "@Id", SqlDbType.Int, id);

            await miembro.ExecuteNonQueryAsync(ct);
        }

        await AuditarAsync(
            conexion,
            tx,
            actorId,
            id,
            "CREAR_USUARIO",
            $"Creó la cuenta {datos.Correo} con rol {datos.Rol}.",
            ct
        );

        await tx.CommitAsync(ct);

        return new ResultadoAdmin(
            true,
            "Usuario creado correctamente.",
            id
        );
    }

    // =========================================================
    // 7. EDITAR USUARIO
    // =========================================================

    public async Task<ResultadoAdmin> EditarAsync(
        int actorId,
        int usuarioId,
        EditarUsuarioAdminRequest datos,
        CancellationToken ct
    )
    {
        await using var conexion =
            await conexiones.OpenAsync(ct);

        await using var tx = (SqlTransaction)
            await conexion.BeginTransactionAsync(
                IsolationLevel.Serializable,
                ct
            );

        await BloquearAdministracionAsync(conexion, tx, ct);

        if (!await EsAdministradorActivoAsync(
            conexion, tx, actorId, ct
        ))
        {
            return new ResultadoAdmin(
                false,
                "No tienes una sesión de administrador activa."
            );
        }

        var rolId = await IdRolAsync(
            conexion, tx, datos.Rol, ct
        );

        if (rolId is null)
        {
            return new ResultadoAdmin(
                false,
                "Rol no disponible."
            );
        }

        string rolAnterior;
        bool activoAnterior;
        bool principalAnterior;

        await using (var buscar = new SqlCommand(
            """
            SELECT
                r.Codigo,
                u.Activo,
                CAST(ISNULL(cm.EsPrincipal, 0) AS BIT)
            FROM dbo.Usuario u WITH (UPDLOCK, HOLDLOCK)
            INNER JOIN dbo.Rol r
                ON r.IdRol = u.IdRol
            LEFT JOIN dbo.ComiteMiembro cm
                ON cm.IdUsuario = u.IdUsuario
            WHERE u.IdUsuario = @Id;
            """,
            conexion,
            tx
        ))
        {
            P(buscar, "@Id", SqlDbType.Int, usuarioId);

            await using var lector =
                await buscar.ExecuteReaderAsync(ct);

            if (!await lector.ReadAsync(ct))
            {
                return new ResultadoAdmin(
                    false,
                    "Usuario no encontrado."
                );
            }

            rolAnterior = lector.GetString(0);
            activoAnterior = lector.GetBoolean(1);
            principalAnterior = lector.GetBoolean(2);
        }

        // Impedir que un ADMIN quite su propio acceso.
        if (actorId == usuarioId &&
            (datos.Rol != "ADMIN" || !datos.Activo))
        {
            return new ResultadoAdmin(
                false,
                "No puedes retirar tu propio acceso de administrador."
            );
        }

        // El responsable principal debe sustituirse primero.
        if (principalAnterior &&
            (datos.Rol != "COMITE" || !datos.Activo))
        {
            return new ResultadoAdmin(
                false,
                "Primero designa a otro responsable principal del comité."
            );
        }

        // Impedir que desaparezca el último administrador.
        if (rolAnterior == "ADMIN" &&
            activoAnterior &&
            (datos.Rol != "ADMIN" || !datos.Activo))
        {
            await using var contar = new SqlCommand(
                """
                SELECT COUNT(*)
                FROM dbo.Usuario u WITH (UPDLOCK, HOLDLOCK)
                INNER JOIN dbo.Rol r
                    ON r.IdRol = u.IdRol
                WHERE u.Activo = 1
                  AND r.Codigo = 'ADMIN';
                """,
                conexion,
                tx
            );

            var total = Convert.ToInt32(
                await contar.ExecuteScalarAsync(ct)
            );

            if (total <= 1)
            {
                return new ResultadoAdmin(
                    false,
                    "Debe permanecer al menos un administrador activo."
                );
            }
        }

        await using (var modificar = new SqlCommand(
            """
            UPDATE dbo.Usuario
            SET
                Nombre = @Nombre,
                Correo = @Correo,
                IdRol = @Rol,
                Activo = @Activo
            WHERE IdUsuario = @Id;
            """,
            conexion,
            tx
        ))
        {
            P(modificar, "@Id",
                SqlDbType.Int, usuarioId);

            P(modificar, "@Nombre",
                SqlDbType.NVarChar, datos.Nombre, 150);

            P(modificar, "@Correo",
                SqlDbType.NVarChar, datos.Correo, 200);

            P(modificar, "@Rol",
                SqlDbType.TinyInt, rolId.Value);

            P(modificar, "@Activo",
                SqlDbType.Bit, datos.Activo);

            await modificar.ExecuteNonQueryAsync(ct);
        }

        // Sincronizar la pertenencia al comité.
        if (datos.Rol == "COMITE" && datos.Activo)
        {
            await using var miembro = new SqlCommand(
                """
                IF EXISTS (
                    SELECT 1 FROM dbo.ComiteMiembro
                    WHERE IdUsuario = @Id
                )
                    UPDATE dbo.ComiteMiembro
                    SET Activo = 1
                    WHERE IdUsuario = @Id;
                ELSE
                    INSERT dbo.ComiteMiembro
                    (
                        IdUsuario,
                        Activo,
                        EsPrincipal
                    )
                    VALUES (@Id, 1, 0);
                """,
                conexion,
                tx
            );

            P(miembro, "@Id", SqlDbType.Int, usuarioId);

            await miembro.ExecuteNonQueryAsync(ct);
        }
        else
        {
            await using var miembro = new SqlCommand(
                """
                UPDATE dbo.ComiteMiembro
                SET
                    Activo = 0,
                    EsPrincipal = 0
                WHERE IdUsuario = @Id;
                """,
                conexion,
                tx
            );

            P(miembro, "@Id", SqlDbType.Int, usuarioId);

            await miembro.ExecuteNonQueryAsync(ct);
        }

        await AuditarAsync(
            conexion,
            tx,
            actorId,
            usuarioId,
            "EDITAR_USUARIO",
            $"Actualizó los datos, rol {rolAnterior}→{datos.Rol}, " +
            $"activo {activoAnterior}→{datos.Activo}.",
            ct
        );

        await tx.CommitAsync(ct);

        return new ResultadoAdmin(
            true,
            "Usuario actualizado correctamente.",
            usuarioId
        );
    }

    // =========================================================
    // 8. RESTABLECER CONTRASEÑA
    // =========================================================

    public async Task<ResultadoAdmin> CambiarClaveAsync(
        int actorId,
        int usuarioId,
        string claveHash,
        CancellationToken ct
    )
    {
        await using var conexion =
            await conexiones.OpenAsync(ct);

        await using var tx = (SqlTransaction)
            await conexion.BeginTransactionAsync(
                IsolationLevel.Serializable,
                ct
            );

        await BloquearAdministracionAsync(conexion, tx, ct);

        if (!await EsAdministradorActivoAsync(
            conexion, tx, actorId, ct
        ))
        {
            return new ResultadoAdmin(
                false,
                "No tienes una sesión de administrador activa."
            );
        }

        await using var modificar = new SqlCommand(
            """
            UPDATE dbo.Usuario
            SET ClaveHash = @Hash
            WHERE IdUsuario = @Id;
            """,
            conexion,
            tx
        );

        P(modificar, "@Id",
            SqlDbType.Int, usuarioId);

        P(modificar, "@Hash",
            SqlDbType.NVarChar, claveHash, 255);

        if (await modificar.ExecuteNonQueryAsync(ct) != 1)
        {
            return new ResultadoAdmin(
                false,
                "Usuario no encontrado."
            );
        }

        await AuditarAsync(
            conexion,
            tx,
            actorId,
            usuarioId,
            "CAMBIAR_CLAVE",
            "Restableció la contraseña. El valor no se registra.",
            ct
        );

        await tx.CommitAsync(ct);

        return new ResultadoAdmin(
            true,
            "Contraseña actualizada.",
            usuarioId
        );
    }

    // =========================================================
    // 9. DESIGNAR PRINCIPAL DEL COMITE
    // =========================================================

    public async Task<ResultadoAdmin> DesignarPrincipalAsync(
        int actorId,
        int usuarioId,
        CancellationToken ct
    )
    {
        await using var conexion =
            await conexiones.OpenAsync(ct);

        await using var tx = (SqlTransaction)
            await conexion.BeginTransactionAsync(
                IsolationLevel.Serializable,
                ct
            );

        await BloquearAdministracionAsync(conexion, tx, ct);

        if (!await EsAdministradorActivoAsync(
            conexion, tx, actorId, ct
        ))
        {
            return new ResultadoAdmin(
                false,
                "No tienes una sesión de administrador activa."
            );
        }

        await using (var comprobar = new SqlCommand(
            """
            SELECT COUNT(*)
            FROM dbo.Usuario u WITH (UPDLOCK, HOLDLOCK)
            INNER JOIN dbo.Rol r
                ON r.IdRol = u.IdRol
            INNER JOIN dbo.ComiteMiembro cm
                ON cm.IdUsuario = u.IdUsuario
            WHERE u.IdUsuario = @Id
              AND r.Codigo = 'COMITE'
              AND u.Activo = 1
              AND cm.Activo = 1;
            """,
            conexion,
            tx
        ))
        {
            P(comprobar, "@Id",
                SqlDbType.Int, usuarioId);

            var total = Convert.ToInt32(
                await comprobar.ExecuteScalarAsync(ct)
            );

            if (total != 1)
            {
                return new ResultadoAdmin(
                    false,
                    "El principal debe ser un integrante activo del comité."
                );
            }
        }

        // Retirar la designación anterior.
        await using (var desmarcar = new SqlCommand(
            """
            UPDATE dbo.ComiteMiembro
            SET EsPrincipal = 0
            WHERE EsPrincipal = 1;
            """,
            conexion,
            tx
        ))
        {
            await desmarcar.ExecuteNonQueryAsync(ct);
        }

        // Asignar el nuevo principal.
        await using (var asignar = new SqlCommand(
            """
            UPDATE dbo.ComiteMiembro
            SET EsPrincipal = 1
            WHERE IdUsuario = @Id
              AND Activo = 1;
            """,
            conexion,
            tx
        ))
        {
            P(asignar, "@Id",
                SqlDbType.Int, usuarioId);

            if (await asignar.ExecuteNonQueryAsync(ct) != 1)
            {
                throw new InvalidOperationException(
                    "No se pudo asignar al responsable principal."
                );
            }
        }

        await AuditarAsync(
            conexion,
            tx,
            actorId,
            usuarioId,
            "PRINCIPAL_COMITE",
            "Designó al responsable principal del comité de cambios.",
            ct
        );

        await tx.CommitAsync(ct);

        return new ResultadoAdmin(
            true,
            "Responsable principal del comité actualizado.",
            usuarioId
        );
    }
}