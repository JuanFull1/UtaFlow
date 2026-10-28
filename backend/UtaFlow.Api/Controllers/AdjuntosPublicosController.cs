
using System.Data;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Data.SqlClient;

namespace UtaFlow.Api.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/public/solicitudes")]
[EnableRateLimiting("solicitudesPublicas")]
public sealed class AdjuntosPublicosController(
    IConfiguration configuracion,
    IWebHostEnvironment entorno
) : ControllerBase
{
    private const long MaxBytes = 5 * 1024 * 1024;
    private const int MaxArchivos = 3;

    private static readonly Regex PatronCodigo = new(
        @"^RFC-[0-9]{4}-[0-9A-F]{24}$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant
    );

    [HttpPost("adjuntos")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    [RequestFormLimits(
        MultipartBodyLengthLimit = 6 * 1024 * 1024
    )]
    public async Task<IActionResult> Subir(
        [FromForm] string? codigo,
        [FromForm] IFormFile? archivo,
        CancellationToken ct
    )
    {
        Response.Headers.CacheControl = "no-store";

        var codigoNormalizado =
            codigo?.Trim().ToUpperInvariant() ?? "";

        if (!PatronCodigo.IsMatch(codigoNormalizado))
        {
            return NotFound(new
            {
                mensaje = "Solicitud no encontrada."
            });
        }

        if (archivo is null ||
            archivo.Length == 0 ||
            archivo.Length > MaxBytes)
        {
            return BadRequest(new
            {
                mensaje =
                    "Selecciona un archivo válido de máximo 5 MB."
            });
        }

        var nombreOriginal = Path.GetFileName(
            archivo.FileName.Replace('\\', '/')
        );

        if (string.IsNullOrWhiteSpace(nombreOriginal) ||
            nombreOriginal.Length > 255)
        {
            return BadRequest(new
            {
                mensaje = "El nombre del archivo no es válido."
            });
        }

        var extension = Path.GetExtension(
            nombreOriginal
        ).ToLowerInvariant();

        if (extension is not (
            ".jpg" or ".jpeg" or ".png" or ".pdf"
        ))
        {
            return BadRequest(new
            {
                mensaje = "Solo se permiten JPG, PNG y PDF."
            });
        }

        // Leer el contenido para validar su formato real.
        using var memoria = new MemoryStream();
        await archivo.CopyToAsync(memoria, ct);
        var bytes = memoria.ToArray();

        var esJpg =
            bytes.Length >= 3 &&
            bytes[0] == 0xFF &&
            bytes[1] == 0xD8 &&
            bytes[2] == 0xFF;

        var esPng =
            bytes.Length >= 8 &&
            bytes[0] == 137 &&
            bytes[1] == 80 &&
            bytes[2] == 78 &&
            bytes[3] == 71 &&
            bytes[4] == 13 &&
            bytes[5] == 10 &&
            bytes[6] == 26 &&
            bytes[7] == 10;

        var esPdf =
            bytes.Length >= 5 &&
            bytes[0] == 37 &&
            bytes[1] == 80 &&
            bytes[2] == 68 &&
            bytes[3] == 70 &&
            bytes[4] == 45;

        var tipoMime = extension switch
        {
            ".jpg" or ".jpeg" when esJpg => "image/jpeg",
            ".png" when esPng => "image/png",
            ".pdf" when esPdf => "application/pdf",
            _ => null
        };

        if (tipoMime is null)
        {
            return BadRequest(new
            {
                mensaje =
                    "El contenido no corresponde al formato del archivo."
            });
        }

        var cadena = configuracion.GetConnectionString(
            "UtaFlow"
        ) ?? throw new InvalidOperationException(
            "No existe la conexión UtaFlow."
        );

        await using var conexion = new SqlConnection(cadena);
        await conexion.OpenAsync(ct);

        await using var transaccion =
            (SqlTransaction)await conexion.BeginTransactionAsync(ct);

        // El código es la credencial del cliente.
        // Solo permitimos adjuntar a solicitudes públicas
        // que todavía estén en revisión o esperando datos.
        const string sqlBuscar = """
            SELECT
                s.IdSolicitud,
                (
                    SELECT COUNT(*)
                    FROM dbo.SolicitudAdjunto a
                    WHERE a.IdSolicitud = s.IdSolicitud
                ) AS Cantidad
            FROM dbo.SolicitudCambio s WITH (UPDLOCK, HOLDLOCK)
            INNER JOIN dbo.Estado e
                ON e.IdEstado = s.IdEstado
            WHERE s.CodigoSeguimiento = @Codigo
              AND s.Origen = 'PUBLICO'
              AND e.Codigo IN (
                  'ENVIADA',
                  'PENDIENTE_CLIENTE'
              );
            """;

        await using var buscar = new SqlCommand(
            sqlBuscar,
            conexion,
            transaccion
        );

        buscar.Parameters.Add(
            "@Codigo", SqlDbType.VarChar, 40
        ).Value = codigoNormalizado;

        int idSolicitud;
        int cantidad;

        await using (var lector =
            await buscar.ExecuteReaderAsync(ct))
        {
            if (!await lector.ReadAsync(ct))
            {
                await lector.DisposeAsync();
                await transaccion.RollbackAsync(ct);

                return NotFound(new
                {
                    mensaje =
                        "Solicitud no encontrada o ya cerrada."
                });
            }

            idSolicitud = lector.GetInt32(0);
            cantidad = lector.GetInt32(1);
        }

        if (cantidad >= MaxArchivos)
        {
            await transaccion.RollbackAsync(ct);

            return BadRequest(new
            {
                mensaje =
                    "La solicitud ya tiene tres archivos adjuntos."
            });
        }

        // Guardar fuera de wwwroot.
        var carpeta = Path.Combine(
            entorno.ContentRootPath,
            "uploads_privados",
            "solicitudes"
        );

        Directory.CreateDirectory(carpeta);

        var nombreInterno =
            Guid.NewGuid().ToString("N") + extension;

        var rutaCompleta = Path.Combine(
            carpeta,
            nombreInterno
        );

        var archivoGuardado = false;

        try
        {
            await System.IO.File.WriteAllBytesAsync(
                rutaCompleta,
                bytes,
                ct
            );

            const string sqlInsertar = """
                INSERT INTO dbo.SolicitudAdjunto
                    (
                        IdSolicitud,
                        NombreOriginal,
                        RutaInterna,
                        TipoMime,
                        TamanoBytes
                    )
                OUTPUT INSERTED.IdAdjunto
                VALUES
                    (
                        @IdSolicitud,
                        @NombreOriginal,
                        @RutaInterna,
                        @TipoMime,
                        @TamanoBytes
                    );
                """;

            await using var insertar = new SqlCommand(
                sqlInsertar,
                conexion,
                transaccion
            );

            insertar.Parameters.Add(
                "@IdSolicitud", SqlDbType.Int
            ).Value = idSolicitud;

            insertar.Parameters.Add(
                "@NombreOriginal", SqlDbType.NVarChar, 255
            ).Value = nombreOriginal;

            insertar.Parameters.Add(
                "@RutaInterna", SqlDbType.NVarChar, 500
            ).Value = nombreInterno;

            insertar.Parameters.Add(
                "@TipoMime", SqlDbType.NVarChar, 100
            ).Value = tipoMime;

            insertar.Parameters.Add(
                "@TamanoBytes", SqlDbType.BigInt
            ).Value = archivo.Length;

            var idAdjunto = Convert.ToInt32(
                await insertar.ExecuteScalarAsync(ct)
            );

            await transaccion.CommitAsync(ct);
            archivoGuardado = true;

            return Ok(new
            {
                idAdjunto,
                nombre = nombreOriginal,
                tamanoBytes = archivo.Length,
                mensaje = "Archivo adjuntado correctamente."
            });
        }
        finally
        {
            if (!archivoGuardado &&
                System.IO.File.Exists(rutaCompleta))
            {
                System.IO.File.Delete(rutaCompleta);
            }
        }
    }
}
