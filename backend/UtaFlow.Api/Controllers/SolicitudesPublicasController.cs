using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Data.SqlClient;
using UtaFlow.Application.Solicitudes;

namespace UtaFlow.Api.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/public/solicitudes")]
[EnableRateLimiting("solicitudesPublicas")]
public sealed class SolicitudesPublicasController(
    ISolicitudesPublicasRepository repositorio
) : ControllerBase
{
    private static readonly Regex PatronCodigo = new(
        @"^RFC-[0-9]{4}-[0-9A-F]{24}$",
        RegexOptions.Compiled |
        RegexOptions.CultureInvariant
    );

    // GET /api/public/solicitudes/catalogos
    [HttpGet("catalogos")]
    public async Task<IActionResult> Catalogos(
        CancellationToken ct
    )
    {
        var resultado = await repositorio.CatalogosAsync(ct);

        return Ok(resultado);
    }

    // POST /api/public/solicitudes
    [HttpPost]
    public async Task<IActionResult> Crear(
        [FromBody] CrearSolicitudPublicaRequest datos,
        CancellationToken ct
    )
    {
        if (
            string.IsNullOrWhiteSpace(datos.Nombre) ||
            string.IsNullOrWhiteSpace(datos.Correo) ||
            string.IsNullOrWhiteSpace(datos.Asunto) ||
            string.IsNullOrWhiteSpace(datos.Descripcion) ||
            datos.Descripcion.Trim().Length < 10 ||
            string.IsNullOrWhiteSpace(datos.Razon)
        )
        {
            return BadRequest(new
            {
                mensaje = "Completa los campos obligatorios."
            });
        }

        if (
            datos.FechaLimite is { } fecha &&
            fecha < DateOnly.FromDateTime(DateTime.Today)
        )
        {
            return BadRequest(new
            {
                mensaje = "La fecha deseada no puede ser anterior a hoy."
            });
        }

        try
        {
            var codigo = await repositorio.CrearAsync(datos, ct);

            Response.Headers.CacheControl = "no-store";

            return Ok(new
            {
                codigo
            });
        }
        catch (SqlException e) when (e.Number == 547)
        {
            return BadRequest(new
            {
                mensaje = "La prioridad seleccionada no existe."
            });
        }
        catch (InvalidOperationException ex) when (
            ex.Message == "Falta configurar el sistema interno 'Por clasificar'."
        )
        {
            return StatusCode(503, new
            {
                mensaje = "El sistema no está configurado para recibir solicitudes públicas."
            });
        }
    }

    // POST /api/public/solicitudes/consultar
    [HttpPost("consultar")]
    public async Task<IActionResult> Consultar(
        [FromBody] ConsultarSolicitudPublicaRequest datos,
        CancellationToken ct
    )
    {
        Response.Headers.CacheControl = "no-store";

        var codigo = datos.Codigo.Trim().ToUpperInvariant();

        if (!PatronCodigo.IsMatch(codigo))
        {
            return NotFound(new
            {
                mensaje = "Solicitud no encontrada."
            });
        }

        var solicitud = await repositorio.ConsultarAsync(
            codigo,
            ct
        );

        if (solicitud is null)
        {
            return NotFound(new
            {
                mensaje = "Solicitud no encontrada."
            });
        }

        return Ok(solicitud);
    }

    // POST /api/public/solicitudes/responder
    [HttpPost("responder")]
    public async Task<IActionResult> Responder(
        [FromBody] ResponderSolicitudPublicaRequest datos,
        CancellationToken ct
    )
    {
        Response.Headers.CacheControl = "no-store";

        var codigo = datos.Codigo.Trim().ToUpperInvariant();

        if (!PatronCodigo.IsMatch(codigo))
        {
            return NotFound(new
            {
                mensaje = "Solicitud no encontrada o no admite respuesta."
            });
        }

        if (
            string.IsNullOrWhiteSpace(datos.Mensaje) ||
            datos.Mensaje.Trim().Length < 2
        )
        {
            return BadRequest(new
            {
                mensaje = "Escribe una respuesta de al menos 2 caracteres."
            });
        }

        var correcto = await repositorio.ResponderAsync(
            codigo,
            datos.Mensaje.Trim(),
            ct
        );

        if (!correcto)
        {
            return Conflict(new
            {
                mensaje = "La solicitud no espera una respuesta del solicitante."
            });
        }

        return Ok(new
        {
            mensaje = "Respuesta recibida."
        });
    }
}
