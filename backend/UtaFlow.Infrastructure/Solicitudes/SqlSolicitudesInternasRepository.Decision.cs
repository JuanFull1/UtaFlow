
using System.Data;
using Microsoft.Data.SqlClient;
using UtaFlow.Application.Solicitudes;

namespace UtaFlow.Infrastructure.Solicitudes;

public sealed partial class SqlSolicitudesInternasRepository
{
    // =========================================================
    // 9. FORMALIZAR DECISION COLECTIVA DEL COMITE
    // =========================================================

    public async Task<object> FormalizarDecisionAsync(
        int idSolicitud,
        int idUsuario,
        DecisionComiteRequest datos,
        CancellationToken ct
    )
    {
        await using var conexion = Conexion();

        await conexion.OpenAsync(ct);

        await using var comando = new SqlCommand(
            "dbo.sp_RegistrarDecisionComite",
            conexion
        )
        {
            CommandType = CommandType.StoredProcedure
        };

        Parametro(
            comando,
            "@IdSolicitud",
            SqlDbType.Int,
            idSolicitud
        );

        Parametro(
            comando,
            "@IdPrincipal",
            SqlDbType.Int,
            idUsuario
        );

        Parametro(
            comando,
            "@Resultado",
            SqlDbType.VarChar,
            datos.Resultado,
            20
        );

        Parametro(
            comando,
            "@Justificacion",
            SqlDbType.NVarChar,
            datos.Justificacion.Trim(),
            2000
        );

        Parametro(
            comando,
            "@Condiciones",
            SqlDbType.NVarChar,
            datos.Condiciones?.Trim(),
            2000
        );

        Parametro(
            comando,
            "@VersionPrevista",
            SqlDbType.NVarChar,
            datos.VersionPrevista?.Trim(),
            50
        );

        await using var lector =
            await comando.ExecuteReaderAsync(ct);

        if (!await lector.ReadAsync(ct))
        {
            throw new InvalidOperationException(
                "No se recibió el resultado de la decisión del comité."
            );
        }

        return new
        {
            resultado = lector.GetString(0),
            revisadoPor = lector.GetString(1),
            aprobar = lector.GetInt32(2),
            rechazar = lector.GetInt32(3),
            modificar = lector.GetInt32(4),
            integrantes = lector.GetInt32(5)
        };
    }
}
