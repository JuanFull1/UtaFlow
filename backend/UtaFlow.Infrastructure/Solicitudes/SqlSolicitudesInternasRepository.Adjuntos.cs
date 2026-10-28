
using System.Data;
using Microsoft.Data.SqlClient;

namespace UtaFlow.Infrastructure.Solicitudes;

public sealed partial class SqlSolicitudesInternasRepository
{
    public async Task<int?> GuardarAdjuntoInternoAsync(
        int idSolicitud,
        int idUsuario,
        string nombreOriginal,
        string nombreInterno,
        string tipoMime,
        long tamanoBytes,
        CancellationToken ct
    )
    {
        await using var conexion = Conexion();
        await conexion.OpenAsync(ct);

        await using var comando = new SqlCommand(
            """
            INSERT INTO dbo.SolicitudAdjunto
            (
                IdSolicitud,
                NombreOriginal,
                RutaInterna,
                TipoMime,
                TamanoBytes
            )
            OUTPUT INSERTED.IdAdjunto
            SELECT
                s.IdSolicitud,
                @Nombre,
                @Ruta,
                @Mime,
                @Tamano
            FROM dbo.SolicitudCambio s
            INNER JOIN dbo.Estado e
                ON e.IdEstado = s.IdEstado
            WHERE s.IdSolicitud = @Solicitud
              AND s.IdSolicitante = @Usuario
              AND s.Origen IN ('EXPERTO', 'COMITE')
              AND e.Codigo = 'ENVIADA';
            """,
            conexion
        );

        Parametro(comando, "@Solicitud",
            SqlDbType.Int, idSolicitud);

        Parametro(comando, "@Usuario",
            SqlDbType.Int, idUsuario);

        Parametro(comando, "@Nombre",
            SqlDbType.NVarChar, nombreOriginal, 255);

        Parametro(comando, "@Ruta",
            SqlDbType.NVarChar, nombreInterno, 255);

        Parametro(comando, "@Mime",
            SqlDbType.VarChar, tipoMime, 100);

        Parametro(comando, "@Tamano",
            SqlDbType.Int, checked((int)tamanoBytes));

        var resultado = await comando.ExecuteScalarAsync(ct);

        return resultado is null || resultado == DBNull.Value
            ? null
            : Convert.ToInt32(resultado);
    }
}
