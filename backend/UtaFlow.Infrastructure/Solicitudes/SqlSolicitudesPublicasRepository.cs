
using System.Data;
using Microsoft.Data.SqlClient;
using UtaFlow.Application.Solicitudes;

namespace UtaFlow.Infrastructure.Solicitudes;

public sealed class SqlSolicitudesPublicasRepository(
    string connectionString
) : ISolicitudesPublicasRepository
{
    private SqlConnection NuevaConexion()
    {
        return new SqlConnection(connectionString);
    }

    private static object Valor(string? texto)
    {
        return string.IsNullOrWhiteSpace(texto)
            ? DBNull.Value
            : texto.Trim();
    }

    public async Task<CatalogosPublicosResponse> CatalogosAsync(
        CancellationToken ct
    )
    {
        var sistemas = new List<CatalogoPublicoItem>();
        var prioridades = new List<CatalogoPublicoItem>();

        await using var conexion = NuevaConexion();
        await conexion.OpenAsync(ct);

        await using var comando = new SqlCommand(
            """
            SELECT IdSistema, Nombre
            FROM dbo.Sistema
            ORDER BY Nombre;

            SELECT IdPrioridad, Nombre
            FROM dbo.Prioridad
            ORDER BY IdPrioridad;
            """,
            conexion
        );

        await using var lector =
            await comando.ExecuteReaderAsync(ct);

        while (await lector.ReadAsync(ct))
        {
            sistemas.Add(
                new CatalogoPublicoItem(
                    lector.GetInt32(0),
                    lector.GetString(1)
                )
            );
        }

        await lector.NextResultAsync(ct);

        while (await lector.ReadAsync(ct))
        {
            prioridades.Add(
                new CatalogoPublicoItem(
                    lector.GetByte(0),
                    lector.GetString(1)
                )
            );
        }

        return new CatalogosPublicosResponse(
            sistemas,
            prioridades
        );
    }

    public async Task<string> CrearAsync(
        CrearSolicitudPublicaRequest s,
        CancellationToken ct
    )
    {
        await using var conexion = NuevaConexion();
        await conexion.OpenAsync(ct);

        // El usuario publico no necesita conocer el sistema.
        // Se utiliza la categoria interna "Por clasificar".
        int idSistemaPorClasificar;

        await using (var obtenerSistema = new SqlCommand(
            """
            SELECT TOP (1) IdSistema
            FROM dbo.Sistema
            WHERE Nombre = @Nombre;
            """,
            conexion
        ))
        {
            obtenerSistema.Parameters.Add(
                "@Nombre", SqlDbType.NVarChar, 120
            ).Value = "Por clasificar";

            var resultado = await obtenerSistema.ExecuteScalarAsync(ct);

            if (resultado is null || resultado == DBNull.Value)
            {
                throw new InvalidOperationException(
                    "Falta configurar el sistema interno 'Por clasificar'."
                );
            }

            idSistemaPorClasificar = Convert.ToInt32(resultado);
        }

        await using var comando = new SqlCommand(
            "dbo.sp_CrearSolicitud",
            conexion
        )
        {
            CommandType = CommandType.StoredProcedure
        };

        comando.Parameters.Add(
            "@Asunto", SqlDbType.NVarChar, 200
        ).Value = s.Asunto.Trim();

        comando.Parameters.Add(
            "@Descripcion", SqlDbType.NVarChar, -1
        ).Value = s.Descripcion.Trim();

        comando.Parameters.Add(
            "@IdSistema", SqlDbType.Int
        ).Value = idSistemaPorClasificar;

        comando.Parameters.Add(
            "@IdPrioridad", SqlDbType.TinyInt
        ).Value = (byte)s.IdPrioridad;

        comando.Parameters.Add(
            "@Razon", SqlDbType.NVarChar, 500
        ).Value = s.Razon.Trim();

        comando.Parameters.Add(
            "@SolicitanteNombre", SqlDbType.NVarChar, 150
        ).Value = s.Nombre.Trim();

        comando.Parameters.Add(
            "@SolicitanteCorreo", SqlDbType.NVarChar, 200
        ).Value = s.Correo.Trim();

        comando.Parameters.Add(
            "@SolicitanteTelefono", SqlDbType.NVarChar, 30
        ).Value = Valor(s.Telefono);

        comando.Parameters.Add(
            "@EmpresaArea", SqlDbType.NVarChar, 150
        ).Value = Valor(s.EmpresaArea);

        comando.Parameters.Add(
            "@ModuloAfectado", SqlDbType.NVarChar, 150
        ).Value = Valor(s.ModuloAfectado);

        comando.Parameters.Add(
            "@VersionSoftware", SqlDbType.NVarChar, 50
        ).Value = DBNull.Value;

        comando.Parameters.Add(
            "@AfectacionActual", SqlDbType.NVarChar, 1000
        ).Value = Valor(s.AfectacionActual);

        comando.Parameters.Add(
            "@ComentariosAdicionales", SqlDbType.NVarChar, 1000
        ).Value = Valor(s.ComentariosAdicionales);

        comando.Parameters.Add(
            "@FechaLimite", SqlDbType.Date
        ).Value = s.FechaLimite is null
            ? DBNull.Value
            : s.FechaLimite.Value.ToDateTime(
                TimeOnly.MinValue
            );

        await using var lector =
            await comando.ExecuteReaderAsync(ct);

        if (!await lector.ReadAsync(ct))
        {
            throw new InvalidOperationException(
                "No se recibió el código de seguimiento."
            );
        }

        return lector.GetString(
            lector.GetOrdinal("Codigo")
        );
    }

    public async Task<SeguimientoPublicoResponse?> ConsultarAsync(
        string codigo,
        CancellationToken ct
    )
    {
        await using var conexion = NuevaConexion();
        await conexion.OpenAsync(ct);

        const string sql = """
            SELECT
                s.Asunto,
                s.Descripcion,
                e.Codigo AS EstadoCodigo,
                e.Nombre AS Estado,
                sis.Nombre AS Sistema,
                p.Nombre AS Prioridad,
                s.FechaEnvio
            FROM dbo.SolicitudCambio s
            JOIN dbo.Estado e
                ON e.IdEstado = s.IdEstado
            JOIN dbo.Sistema sis
                ON sis.IdSistema = s.IdSistema
            JOIN dbo.Prioridad p
                ON p.IdPrioridad = s.IdPrioridad
            WHERE s.CodigoSeguimiento = @Codigo;

            SELECT
                m.IdMensaje,
                m.Emisor,
                m.Mensaje,
                m.Fecha
            FROM dbo.SolicitudMensaje m
            JOIN dbo.SolicitudCambio s
                ON s.IdSolicitud = m.IdSolicitud
            WHERE s.CodigoSeguimiento = @Codigo
              AND m.VisibleParaSolicitante = 1
            ORDER BY m.Fecha, m.IdMensaje;

            SELECT
                e.Nombre AS Estado,
                h.Fecha
            FROM dbo.HistorialEstado h
            JOIN dbo.Estado e
                ON e.IdEstado = h.IdEstado
            JOIN dbo.SolicitudCambio s
                ON s.IdSolicitud = h.IdSolicitud
            WHERE s.CodigoSeguimiento = @Codigo
            ORDER BY h.Fecha, h.IdHistorial;
            """;

        await using var comando =
            new SqlCommand(sql, conexion);

        comando.Parameters.Add(
            "@Codigo", SqlDbType.VarChar, 40
        ).Value = codigo;

        await using var lector =
            await comando.ExecuteReaderAsync(ct);

        if (!await lector.ReadAsync(ct))
        {
            return null;
        }

        var asunto = lector.GetString(0);
        var descripcion = lector.GetString(1);
        var estadoCodigo = lector.GetString(2);
        var estado = lector.GetString(3);
        var sistema = lector.GetString(4);
        var prioridad = lector.GetString(5);
        var fechaEnvio = lector.GetDateTime(6);

        var mensajes = new List<MensajePublicoResponse>();

        await lector.NextResultAsync(ct);

        while (await lector.ReadAsync(ct))
        {
            mensajes.Add(
                new MensajePublicoResponse(
                    lector.GetInt32(0),
                    lector.GetString(1),
                    lector.GetString(2),
                    lector.GetDateTime(3)
                )
            );
        }

        var historial = new List<HistorialPublicoResponse>();

        await lector.NextResultAsync(ct);

        while (await lector.ReadAsync(ct))
        {
            historial.Add(
                new HistorialPublicoResponse(
                    lector.GetString(0),
                    lector.GetDateTime(1)
                )
            );
        }

        return new SeguimientoPublicoResponse(
            asunto,
            descripcion,
            estadoCodigo,
            estado,
            sistema,
            prioridad,
            fechaEnvio,
            mensajes,
            historial
        );
    }

    public async Task<bool> ResponderAsync(
        string codigo,
        string mensaje,
        CancellationToken ct
    )
    {
        await using var conexion = NuevaConexion();
        await conexion.OpenAsync(ct);

        await using var transaccion =
            (SqlTransaction)await conexion.BeginTransactionAsync(ct);

        const string sqlBuscar = """
            SELECT
                s.IdSolicitud,
                s.SolicitanteNombre
            FROM dbo.SolicitudCambio s WITH (UPDLOCK, HOLDLOCK)
            JOIN dbo.Estado e
                ON e.IdEstado = s.IdEstado
            WHERE s.CodigoSeguimiento = @Codigo
              AND e.Codigo = 'PENDIENTE_CLIENTE';
            """;

        await using var buscar =
            new SqlCommand(sqlBuscar, conexion, transaccion);

        buscar.Parameters.Add(
            "@Codigo", SqlDbType.VarChar, 40
        ).Value = codigo;

        int id;
        string? nombre;

        await using (var lector =
            await buscar.ExecuteReaderAsync(ct))
        {
            if (!await lector.ReadAsync(ct))
            {
                return false;
            }

            id = lector.GetInt32(0);

            nombre = lector.IsDBNull(1)
                ? null
                : lector.GetString(1);
        }

        await using var insertar = new SqlCommand(
            """
            INSERT dbo.SolicitudMensaje
                (
                    IdSolicitud,
                    IdUsuario,
                    Emisor,
                    Mensaje,
                    VisibleParaSolicitante
                )
            VALUES
                (
                    @Id,
                    NULL,
                    'PUBLICO',
                    @Mensaje,
                    1
                );
            """,
            conexion,
            transaccion
        );

        insertar.Parameters.Add(
            "@Id", SqlDbType.Int
        ).Value = id;

        insertar.Parameters.Add(
            "@Mensaje", SqlDbType.NVarChar, 2000
        ).Value = mensaje;

        await insertar.ExecuteNonQueryAsync(ct);

        // Regresa la solicitud a revisión y registra el historial.
        await using var estado = new SqlCommand(
            "dbo.sp_CambiarEstado",
            conexion,
            transaccion
        )
        {
            CommandType = CommandType.StoredProcedure
        };

        estado.Parameters.Add(
            "@IdSolicitud", SqlDbType.Int
        ).Value = id;

        estado.Parameters.Add(
            "@Codigo", SqlDbType.VarChar, 20
        ).Value = "ENVIADA";

        estado.Parameters.Add(
            "@Actor", SqlDbType.NVarChar, 150
        ).Value = (object?)nombre ?? "Solicitante";

        estado.Parameters.Add(
            "@Comentario", SqlDbType.NVarChar, 500
        ).Value = "El solicitante respondió la petición de información.";

        await estado.ExecuteNonQueryAsync(ct);

        await transaccion.CommitAsync(ct);

        return true;
    }
}
