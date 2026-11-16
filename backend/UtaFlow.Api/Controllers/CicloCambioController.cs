using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using UtaFlow.Application.Solicitudes;

namespace UtaFlow.Api.Controllers;

// Etapas posteriores a la aprobación: implementación, revisión y cierre,
// más el reporte de estado de la configuración (unidades 3.2 y 3.3).
[ApiController]
[Authorize(Roles = "EXPERTO,COMITE")]
[Route("api/solicitudes-internas")]
public sealed class CicloCambioController(
    ISolicitudesInternasRepository repositorio
) : ControllerBase
{
    private int IdUsuario()
    {
        var valor = User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;

        if (!int.TryParse(valor, out var id) || id <= 0)
            throw new UnauthorizedAccessException("Identidad inválida.");

        return id;
    }

    private async Task<IActionResult> EjecutarAsync(
        Func<Task> accion,
        string mensajeOk
    )
    {
        try
        {
            await accion();
            return Ok(new { mensaje = mensajeOk });
        }
        catch (SqlException ex) when (ex.Number is >= 52001 and <= 52007)
        {
            return Conflict(new { mensaje = ex.Message });
        }
    }

    // GET /api/solicitudes-internas/reporte-estado
    [HttpGet("reporte-estado")]
    public async Task<IActionResult> ReporteEstado(CancellationToken ct)
    {
        return Ok(await repositorio.ReporteEstadoAsync(ct));
    }

    // GET /api/solicitudes-internas/{id}/ciclo
    [HttpGet("{id:int}/ciclo")]
    public async Task<IActionResult> Ciclo(int id, CancellationToken ct)
    {
        if (id <= 0) return BadRequest();

        var ciclo = await repositorio.ObtenerCicloAsync(id, ct);

        return ciclo is null ? NoContent() : Ok(ciclo);
    }

    // POST /api/solicitudes-internas/{id}/ciclo/iniciar
    [HttpPost("{id:int}/ciclo/iniciar")]
    [Authorize(Roles = "EXPERTO")]
    public Task<IActionResult> Iniciar(int id, CancellationToken ct)
    {
        if (id <= 0) return Task.FromResult<IActionResult>(BadRequest());

        return EjecutarAsync(
            () => repositorio.IniciarImplementacionAsync(id, IdUsuario(), ct),
            "Implementación iniciada."
        );
    }

    // POST /api/solicitudes-internas/{id}/ciclo/implementacion
    [HttpPost("{id:int}/ciclo/implementacion")]
    [Authorize(Roles = "EXPERTO")]
    public Task<IActionResult> Implementacion(
        int id,
        [FromBody] ImplementacionRequest datos,
        CancellationToken ct
    )
    {
        if (id <= 0) return Task.FromResult<IActionResult>(BadRequest());

        return EjecutarAsync(
            () => repositorio.RegistrarImplementacionAsync(id, IdUsuario(), datos, ct),
            "Implementación registrada. La solicitud pasa a revisión."
        );
    }

    // POST /api/solicitudes-internas/{id}/ciclo/revision
    [HttpPost("{id:int}/ciclo/revision")]
    [Authorize(Roles = "COMITE")]
    public Task<IActionResult> Revision(
        int id,
        [FromBody] RevisionRequest datos,
        CancellationToken ct
    )
    {
        if (id <= 0) return Task.FromResult<IActionResult>(BadRequest());

        return EjecutarAsync(
            () => repositorio.RegistrarRevisionAsync(id, IdUsuario(), datos, ct),
            "Revisión y auditoría registradas."
        );
    }

    // POST /api/solicitudes-internas/{id}/ciclo/cierre
    [HttpPost("{id:int}/ciclo/cierre")]
    [Authorize(Roles = "COMITE")]
    public Task<IActionResult> Cierre(
        int id,
        [FromBody] CierreRequest datos,
        CancellationToken ct
    )
    {
        if (id <= 0) return Task.FromResult<IActionResult>(BadRequest());

        if (datos.Resultado is not ("EXITOSO" or "FALLIDO" or "INCOMPLETO"))
        {
            return Task.FromResult<IActionResult>(BadRequest(new
            {
                mensaje = "Elige el resultado del cierre."
            }));
        }

        return EjecutarAsync(
            () => repositorio.CerrarCambioAsync(id, IdUsuario(), datos, ct),
            "Cambio cerrado correctamente."
        );
    }
}
