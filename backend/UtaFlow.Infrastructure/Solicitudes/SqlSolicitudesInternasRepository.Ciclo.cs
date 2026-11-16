using System.Data;
using Microsoft.Data.SqlClient;
using UtaFlow.Application.Solicitudes;

namespace UtaFlow.Infrastructure.Solicitudes;

public sealed partial class SqlSolicitudesInternasRepository
{
    // =========================================================
    // CICLO POSTERIOR A LA APROBACION
    // Implementacion -> Revision (auditoria) -> Cierre
    // =========================================================

    public async Task<Dictionary<string, object?>?> ObtenerCicloAsync(
        int idSolicitud,
        CancellationToken ct
    )
    {
        await using var conexion = Conexion();
        await conexion.OpenAsync(ct);

        await using var comando = new SqlCommand(
            """
            SELECT
                c.IdSolicitud,
                c.FechaInicio,
                impl.Nombre AS Implementador,
                c.FechaImplementacion,
                c.VersionLiberada,
                c.RamaGit,
                c.EnlaceGit,
                c.NotasImplementacion,
                rev.Nombre AS Revisor,
                c.FechaRevision,
                c.AudCambioRealizado,
                c.AudRevisionTecnica,
                c.AudProcesoSeguido,
                c.AudCambioRegistrado,
                c.AudRelacionadosActualizados,
                c.ObservacionesRevision,
                c.ResultadoCierre,
                c.FechaCierre,
                cie.Nombre AS CerradoPor,
                c.ComentarioCierre
            FROM dbo.CicloCambio c
            LEFT JOIN dbo.Usuario impl ON impl.IdUsuario = c.IdImplementador
            LEFT JOIN dbo.Usuario rev ON rev.IdUsuario = c.IdRevisor
            LEFT JOIN dbo.Usuario cie ON cie.IdUsuario = c.IdCierre
            WHERE c.IdSolicitud = @Id;
            """,
            conexion
        );

        Parametro(comando, "@Id", SqlDbType.Int, idSolicitud);

        await using var lector = await comando.ExecuteReaderAsync(ct);
        var filas = await FilasAsync(lector, ct);

        return filas.Count == 0 ? null : filas[0];
    }

    public async Task IniciarImplementacionAsync(
        int idSolicitud,
        int idUsuario,
        CancellationToken ct
    )
    {
        await using var conexion = Conexion();
        await conexion.OpenAsync(ct);

        await using var comando = new SqlCommand(
            "dbo.sp_IniciarImplementacion",
            conexion
        )
        {
            CommandType = CommandType.StoredProcedure
        };

        Parametro(comando, "@IdSolicitud", SqlDbType.Int, idSolicitud);
        Parametro(comando, "@IdUsuario", SqlDbType.Int, idUsuario);

        await comando.ExecuteNonQueryAsync(ct);
    }

    public async Task RegistrarImplementacionAsync(
        int idSolicitud,
        int idUsuario,
        ImplementacionRequest datos,
        CancellationToken ct
    )
    {
        await using var conexion = Conexion();
        await conexion.OpenAsync(ct);

        await using var comando = new SqlCommand(
            "dbo.sp_RegistrarImplementacion",
            conexion
        )
        {
            CommandType = CommandType.StoredProcedure
        };

        Parametro(comando, "@IdSolicitud", SqlDbType.Int, idSolicitud);
        Parametro(comando, "@IdUsuario", SqlDbType.Int, idUsuario);
        Parametro(comando, "@VersionLiberada", SqlDbType.NVarChar, datos.VersionLiberada.Trim(), 50);
        Parametro(comando, "@RamaGit", SqlDbType.NVarChar, datos.RamaGit?.Trim(), 150);
        Parametro(comando, "@EnlaceGit", SqlDbType.NVarChar, datos.EnlaceGit?.Trim(), 400);
        Parametro(comando, "@Notas", SqlDbType.NVarChar, datos.Notas?.Trim(), 2000);

        await comando.ExecuteNonQueryAsync(ct);
    }

    public async Task RegistrarRevisionAsync(
        int idSolicitud,
        int idUsuario,
        RevisionRequest datos,
        CancellationToken ct
    )
    {
        await using var conexion = Conexion();
        await conexion.OpenAsync(ct);

        await using var comando = new SqlCommand(
            "dbo.sp_RegistrarRevision",
            conexion
        )
        {
            CommandType = CommandType.StoredProcedure
        };

        Parametro(comando, "@IdSolicitud", SqlDbType.Int, idSolicitud);
        Parametro(comando, "@IdUsuario", SqlDbType.Int, idUsuario);
        Parametro(comando, "@CambioRealizado", SqlDbType.Bit, datos.CambioRealizado);
        Parametro(comando, "@RevisionTecnica", SqlDbType.Bit, datos.RevisionTecnica);
        Parametro(comando, "@ProcesoSeguido", SqlDbType.Bit, datos.ProcesoSeguido);
        Parametro(comando, "@CambioRegistrado", SqlDbType.Bit, datos.CambioRegistrado);
        Parametro(comando, "@RelacionadosActualizados", SqlDbType.Bit, datos.RelacionadosActualizados);
        Parametro(comando, "@Observaciones", SqlDbType.NVarChar, datos.Observaciones?.Trim(), 2000);

        await comando.ExecuteNonQueryAsync(ct);
    }

    public async Task CerrarCambioAsync(
        int idSolicitud,
        int idUsuario,
        CierreRequest datos,
        CancellationToken ct
    )
    {
        await using var conexion = Conexion();
        await conexion.OpenAsync(ct);

        await using var comando = new SqlCommand(
            "dbo.sp_CerrarCambio",
            conexion
        )
        {
            CommandType = CommandType.StoredProcedure
        };

        Parametro(comando, "@IdSolicitud", SqlDbType.Int, idSolicitud);
        Parametro(comando, "@IdUsuario", SqlDbType.Int, idUsuario);
        Parametro(comando, "@Resultado", SqlDbType.VarChar, datos.Resultado, 12);
        Parametro(comando, "@Comentario", SqlDbType.NVarChar, datos.Comentario?.Trim(), 1000);

        await comando.ExecuteNonQueryAsync(ct);
    }

    public async Task<IReadOnlyList<Dictionary<string, object?>>> ReporteEstadoAsync(
        CancellationToken ct
    )
    {
        await using var conexion = Conexion();
        await conexion.OpenAsync(ct);

        await using var comando = new SqlCommand(
            "SELECT * FROM dbo.vw_ReporteEstado ORDER BY IdSolicitud DESC;",
            conexion
        );

        await using var lector = await comando.ExecuteReaderAsync(ct);

        return await FilasAsync(lector, ct);
    }
}
