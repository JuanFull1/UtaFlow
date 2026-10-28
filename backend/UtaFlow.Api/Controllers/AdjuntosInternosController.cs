
using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UtaFlow.Application.Solicitudes;

namespace UtaFlow.Api.Controllers;

[ApiController]
[Authorize(Roles = "EXPERTO,COMITE")]
[Route("api/solicitudes-internas")]
public sealed class AdjuntosInternosController(
    ISolicitudesInternasRepository repositorio,
    IWebHostEnvironment entorno
) : ControllerBase
{
    private const long MaximoBytes = 5 * 1024 * 1024;

    [HttpPost("{id:int}/adjuntos")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(6_291_456)]
    public async Task<IActionResult> Subir(
        int id,
        [FromForm] IFormFile archivo,
        CancellationToken ct
    )
    {
        if (id <= 0)
            return BadRequest(new { mensaje = "Solicitud inválida." });

        var sub = User.FindFirst(
            JwtRegisteredClaimNames.Sub
        )?.Value;

        if (!int.TryParse(sub, out var idUsuario) ||
            idUsuario <= 0)
        {
            return Unauthorized();
        }

        if (archivo is null ||
            archivo.Length == 0 ||
            archivo.Length > MaximoBytes)
        {
            return BadRequest(new
            {
                mensaje = "Selecciona un archivo válido de hasta 5 MB."
            });
        }

        var nombreOriginal = Path.GetFileName(archivo.FileName);

        if (string.IsNullOrWhiteSpace(nombreOriginal))
            return BadRequest(new { mensaje = "Nombre inválido." });

        if (nombreOriginal.Length > 255)
        {
            return BadRequest(new
            {
                mensaje = "El nombre del archivo es demasiado largo."
            });
        }

        var extension = Path.GetExtension(nombreOriginal)
            .ToLowerInvariant();

        var tipoMime = extension switch
        {
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".pdf" => "application/pdf",
            _ => null
        };

        if (tipoMime is null)
        {
            return BadRequest(new
            {
                mensaje = "Solo se aceptan PNG, JPG, JPEG y PDF."
            });
        }

        // Comprobar la firma real del archivo.
        var cabecera = new byte[8];
        int leidos;

        await using (var entrada = archivo.OpenReadStream())
        {
            leidos = await entrada.ReadAtLeastAsync(
                cabecera,
                cabecera.Length,
                throwOnEndOfStream: false,
                cancellationToken: ct
            );
        }

        bool esPng =
            leidos >= 8 &&
            cabecera.AsSpan().SequenceEqual(
                new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }
            );

        bool esJpeg =
            leidos >= 3 &&
            cabecera[0] == 0xFF &&
            cabecera[1] == 0xD8 &&
            cabecera[2] == 0xFF;

        bool esPdf =
            leidos >= 5 &&
            cabecera[0] == 0x25 &&
            cabecera[1] == 0x50 &&
            cabecera[2] == 0x44 &&
            cabecera[3] == 0x46 &&
            cabecera[4] == 0x2D;

        bool firmaValida = extension switch
        {
            ".png" => esPng,
            ".jpg" or ".jpeg" => esJpeg,
            ".pdf" => esPdf,
            _ => false
        };

        if (!firmaValida)
        {
            return BadRequest(new
            {
                mensaje = "El contenido no corresponde al tipo de archivo."
            });
        }

        var carpeta = Path.Combine(
            entorno.ContentRootPath,
            "uploads_privados",
            "solicitudes"
        );

        Directory.CreateDirectory(carpeta);

        var nombreInterno =
            Guid.NewGuid().ToString("N") + extension;

        var rutaFisica = Path.Combine(carpeta, nombreInterno);

        await using (var destino = new FileStream(
            rutaFisica,
            FileMode.CreateNew,
            FileAccess.Write,
            FileShare.None
        ))
        {
            await archivo.CopyToAsync(destino, ct);
        }

        try
        {
            var idAdjunto =
                await repositorio.GuardarAdjuntoInternoAsync(
                    id,
                    idUsuario,
                    nombreOriginal,
                    nombreInterno,
                    tipoMime,
                    archivo.Length,
                    ct
                );

            if (!idAdjunto.HasValue)
            {
                System.IO.File.Delete(rutaFisica);

                return Conflict(new
                {
                    mensaje =
                        "No puedes agregar evidencias a esta solicitud " +
                        "o su estado ya cambió."
                });
            }

            return Ok(new
            {
                idAdjunto = idAdjunto.Value,
                nombreOriginal,
                tipoMime,
                tamanoBytes = archivo.Length
            });
        }
        catch
        {
            // Si falla SQL Server, no dejar archivos huérfanos.
            if (System.IO.File.Exists(rutaFisica))
            {
                System.IO.File.Delete(rutaFisica);
            }

            throw;
        }
    }
}
