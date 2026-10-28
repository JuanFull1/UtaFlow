
using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using UtaFlow.Application.Solicitudes;

namespace UtaFlow.Api.Controllers;

[ApiController]
[Authorize(Roles = "EXPERTO,COMITE")]
[Route("api/solicitudes-internas")]
public sealed class SolicitudesInternasController(
    ISolicitudesInternasRepository repositorio,
    IWebHostEnvironment entorno
) : ControllerBase
{
    private int IdUsuario()
    {
        var valor = User.FindFirst(
            JwtRegisteredClaimNames.Sub
        )?.Value;

        if (!int.TryParse(valor, out var id) || id <= 0)
        {
            throw new UnauthorizedAccessException(
                "Identidad inválida."
            );
        }

        return id;
    }

    private string Rol()
    {
        return User.FindFirst("role")?.Value ?? "";
    }

    // =========================================================
    // 1. LISTAR SOLICITUDES
    // GET /api/solicitudes-internas
    // =========================================================

    [HttpGet]
    public async Task<IActionResult> Listar(
        CancellationToken ct
    )
    {
        var solicitudes = await repositorio.ListarAsync(ct);

        return Ok(solicitudes);
    }

    // =========================================================
    // 2. OBTENER DETALLE COMPLETO
    // GET /api/solicitudes-internas/{id}
    // =========================================================

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Detalle(
        int id,
        CancellationToken ct
    )
    {
        if (id <= 0)
            return BadRequest();

        var detalle = await repositorio.DetalleAsync(id, ct);

        return detalle is null
            ? NotFound()
            : Ok(detalle);
    }

    // =========================================================
    // 3. CREAR SOLICITUD INTERNA
    // EXPERTO Y COMITE
    // POST /api/solicitudes-internas
    // =========================================================

    [HttpPost]
    public async Task<IActionResult> Crear(
        [FromBody] NuevaSolicitudInternaRequest datos,
        CancellationToken ct
    )
    {
        if (
            string.IsNullOrWhiteSpace(datos.Asunto) ||
            string.IsNullOrWhiteSpace(datos.Descripcion) ||
            datos.Descripcion.Trim().Length < 10 ||
            string.IsNullOrWhiteSpace(datos.Razon)
        )
        {
            return BadRequest(new
            {
                mensaje = "Completa los datos obligatorios."
            });
        }

        if (datos.CodigoTipoCambio is not (
            "NORMAL" or "ESTANDAR" or "EMERGENCIA"
        ))
        {
            return BadRequest(new
            {
                mensaje = "Selecciona un tipo de cambio ITIL válido."
            });
        }

        if (
            datos.IdSistema <= 0 ||
            datos.IdPrioridad <= 0 ||
            datos.IdPrioridad > 255
        )
        {
            return BadRequest(new
            {
                mensaje = "Selecciona un sistema y una prioridad válidos."
            });
        }

        if (datos.TipoMantenimiento is not (
            "CORRECTIVO" or "ADAPTATIVO" or
            "PERFECTIVO" or "PREVENTIVO"
        ))
        {
            return BadRequest(new
            {
                mensaje = "Selecciona un tipo de mantenimiento válido."
            });
        }

        try
        {
            var creada = await repositorio.CrearAsync(
                datos,
                IdUsuario(),
                ct
            );

            return Ok(creada);
        }
        catch (SqlException ex) when (ex.Number == 547)
        {
            return BadRequest(new
            {
                mensaje = "El sistema o la prioridad no existen."
            });
        }
        catch (SqlException ex) when (
            ex.Number is 50002 or 50003 or 50004
        )
        {
            return BadRequest(new
            {
                mensaje = "No se pudo validar la solicitud interna."
            });
        }
    }

    // =========================================================
    // 4. EVALUACION TECNICA DEL EXPERTO
    // POST /api/solicitudes-internas/{id}/analisis
    // =========================================================

    [HttpPost("{id:int}/analisis")]
    [Authorize(Roles = "EXPERTO")]
    public async Task<IActionResult> GuardarAnalisis(
        int id,
        [FromBody] EvaluacionInternaRequest datos,
        CancellationToken ct
    )
    {
        if (id <= 0)
            return BadRequest();

        if (datos.Recomendacion is not (
            "APROBAR" or "RECHAZAR" or "MODIFICAR"
        ))
        {
            return BadRequest(new
            {
                mensaje = "Selecciona una recomendación válida."
            });
        }

        if (datos.CodigoTipoCambio is not (
            "NORMAL" or "ESTANDAR" or "EMERGENCIA"
        ))
        {
            return BadRequest(new
            {
                mensaje = "Tipo de cambio ITIL inválido."
            });
        }

        if (
            !string.IsNullOrWhiteSpace(datos.TipoMantenimiento) &&
            datos.TipoMantenimiento is not (
                "CORRECTIVO" or
                "ADAPTATIVO" or
                "PERFECTIVO" or
                "PREVENTIVO"
            )
        )
        {
            return BadRequest(new
            {
                mensaje = "Tipo de mantenimiento no válido."
            });
        }

        if (
            !string.IsNullOrWhiteSpace(datos.AmbientePrevisto) &&
            datos.AmbientePrevisto is not (
                "DESARROLLO" or
                "PRUEBAS" or
                "PRODUCCION"
            )
        )
        {
            return BadRequest(new
            {
                mensaje = "Ambiente previsto no válido."
            });
        }

        if (
            datos.HorasEstimadas is < 0 or > 99999 ||
            datos.CostoEstimado is < 0 or > 9999999999.99m ||
            datos.IdImpacto is < 1 or > 3 ||
            datos.ServiciosAfectados?.Length > 300 ||
            datos.ComponentesAfectados?.Length > 600 ||
            datos.RamaGit?.Length > 150
        )
        {
            return BadRequest(new
            {
                mensaje = "Revisa los valores de la evaluación técnica."
            });
        }

        var guardado = await repositorio.GuardarAnalisisAsync(
            id,
            IdUsuario(),
            datos,
            ct
        );

        if (!guardado)
        {
            return Conflict(new
            {
                mensaje = "La solicitud no admite evaluación técnica en su estado actual."
            });
        }

        return Ok(new
        {
            mensaje = "Evaluación técnica guardada correctamente."
        });
    }

    // =========================================================
    // 5. ENVIAR AL COMITE
    // SOLO EXPERTO
    // POST /api/solicitudes-internas/{id}/enviar-comite
    // =========================================================

    [HttpPost("{id:int}/enviar-comite")]
    [Authorize(Roles = "EXPERTO")]
    public async Task<IActionResult> EnviarAlComite(
        int id,
        CancellationToken ct
    )
    {
        if (id <= 0)
            return BadRequest();

        try
        {
            var enviado = await repositorio.EnviarAlComiteAsync(
                id,
                IdUsuario(),
                ct
            );

            if (!enviado)
            {
                return Conflict(new
                {
                    mensaje =
                        "La solicitud no puede enviarse. Completa y guarda " +
                        "la recomendación, tipo de mantenimiento, impacto, " +
                        "costo estimado y rama Git antes de continuar."
                });
            }

            return Ok(new
            {
                mensaje = "Solicitud enviada al comité correctamente."
            });
        }
        catch (SqlException ex) when (
            ex.Number is 50006 or 50007
        )
        {
            return Conflict(new
            {
                mensaje =
                    "La solicitud no está lista para el comité. " +
                    "Guarda primero la evaluación técnica."
            });
        }
    }

    // =========================================================
    // 6. VOTO INDIVIDUAL DEL COMITE
    // POST /api/solicitudes-internas/{id}/voto
    // =========================================================

    [HttpPost("{id:int}/voto")]
    [Authorize(Roles = "COMITE")]
    public async Task<IActionResult> Votar(
        int id,
        [FromBody] VotoInternoRequest datos,
        CancellationToken ct
    )
    {
        if (id <= 0)
            return BadRequest();

        if (datos.Voto is not (
            "APROBAR" or "RECHAZAR" or "MODIFICAR"
        ))
        {
            return BadRequest(new
            {
                mensaje = "Selecciona un voto válido."
            });
        }

        try
        {
            var resultado = await repositorio.VotarAsync(
                id,
                IdUsuario(),
                datos,
                ct
            );

            return Ok(resultado);
        }
        catch (SqlException ex) when (
            ex.Number is 50008 or 50009 or 51010
        )
        {
            return Conflict(new
            {
                mensaje =
                    "No puedes votar en esta solicitud o " +
                    "no perteneces al comité activo."
            });
        }
    }

    // =========================================================
    // 7. FORMALIZAR LA DECISION COLECTIVA
    // SOLO RESPONSABLE PRINCIPAL DEL COMITE
    // POST /api/solicitudes-internas/{id}/decision-final
    // =========================================================

    [HttpPost("{id:int}/decision-final")]
    [Authorize(Roles = "COMITE")]
    public async Task<IActionResult> RegistrarDecisionFinal(
        int id,
        [FromBody] DecisionComiteRequest datos,
        CancellationToken ct
    )
    {
        if (id <= 0)
            return BadRequest();

        if (datos.Resultado is not (
            "APROBADA" or "RECHAZADA" or "MODIFICACION"
        ))
        {
            return BadRequest(new
            {
                mensaje = "Selecciona un resultado válido."
            });
        }

        if (
            string.IsNullOrWhiteSpace(datos.Justificacion) ||
            datos.Justificacion.Trim().Length < 10
        )
        {
            return BadRequest(new
            {
                mensaje =
                    "La justificación colectiva debe tener " +
                    "al menos 10 caracteres."
            });
        }

        if (
            datos.Resultado == "APROBADA" &&
            string.IsNullOrWhiteSpace(datos.VersionPrevista)
        )
        {
            return BadRequest(new
            {
                mensaje =
                    "Indica la versión en la que se incluirá el cambio."
            });
        }

        try
        {
            var resultado =
                await repositorio.FormalizarDecisionAsync(
                    id,
                    IdUsuario(),
                    datos,
                    ct
                );

            return Ok(resultado);
        }
        catch (SqlException ex) when (
            ex.Number >= 51020 && ex.Number <= 51026
        )
        {
            var mensaje = ex.Number switch
            {
                51020 => "El resultado de la decisión no es válido.",
                51021 => "La justificación colectiva es obligatoria.",
                51022 => "Debes indicar la versión prevista.",
                51023 => "Solo el responsable principal puede formalizar la decisión.",
                51024 => "La solicitud ya no está en revisión del comité.",
                51025 => "La decisión de esta ronda ya fue registrada.",
                51026 => "El comité todavía no alcanza la mayoría necesaria.",
                _ => "No se pudo registrar la decisión del comité."
            };

            return Conflict(new { mensaje });
        }
    }

    // =========================================================
    // 8. SOLICITAR INFORMACION O CORRECCIONES
    // POST /api/solicitudes-internas/{id}/devolver
    // =========================================================

    [HttpPost("{id:int}/devolver")]
    public async Task<IActionResult> Devolver(
        int id,
        [FromBody] DevolucionInternaRequest datos,
        CancellationToken ct
    )
    {
        if (id <= 0)
            return BadRequest();

        if (
            datos.Destino is not ("CLIENTE" or "EXPERTO") ||
            string.IsNullOrWhiteSpace(datos.Mensaje)
        )
        {
            return BadRequest(new
            {
                mensaje =
                    "Completa el destinatario y la observación."
            });
        }

        var realizado = await repositorio.DevolverAsync(
            id,
            IdUsuario(),
            Rol(),
            datos,
            ct
        );

        if (!realizado)
        {
            return Conflict(new
            {
                mensaje =
                    "La solicitud no puede devolverse " +
                    "al destinatario seleccionado."
            });
        }

        return Ok(new
        {
            mensaje = "Observación enviada correctamente."
        });
    }

    // =========================================================
    // 9. DESCARGAR EVIDENCIA AUTENTICADA
    // GET /api/solicitudes-internas/{id}/adjuntos/{idAdjunto}
    // =========================================================

    [HttpGet("{id:int}/adjuntos/{idAdjunto:int}")]
    public async Task<IActionResult> DescargarAdjunto(
        int id,
        int idAdjunto,
        CancellationToken ct
    )
    {
        if (id <= 0 || idAdjunto <= 0)
            return BadRequest();

        var adjunto = await repositorio.ObtenerAdjuntoAsync(
            id,
            idAdjunto,
            ct
        );

        if (adjunto is null)
            return NotFound();

        var (nombreInterno, nombreOriginal, tipo) = adjunto.Value;

        // La BD debe almacenar únicamente el nombre interno,
        // no rutas elegidas por el usuario.
        if (
            string.IsNullOrWhiteSpace(nombreInterno) ||
            Path.GetFileName(nombreInterno) != nombreInterno
        )
        {
            return NotFound();
        }

        var ruta = Path.Combine(
            entorno.ContentRootPath,
            "uploads_privados",
            "solicitudes",
            nombreInterno
        );

        if (!System.IO.File.Exists(ruta))
            return NotFound();

        Response.Headers.CacheControl = "no-store";

        return PhysicalFile(
            ruta,
            tipo,
            nombreOriginal
        );
    }
}
