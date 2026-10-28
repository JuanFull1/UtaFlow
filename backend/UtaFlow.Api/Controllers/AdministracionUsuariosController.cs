
using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using UtaFlow.Application.Administracion;
using UtaFlow.Application.Authentication;

namespace UtaFlow.Api.Controllers;

[ApiController]
[Authorize(Roles = "ADMIN")]
[Route("api/admin")]
[ResponseCache(
    NoStore = true,
    Location = ResponseCacheLocation.None
)]
public sealed class AdministracionUsuariosController(
    IAdministracionUsuariosRepository usuarios,
    IPasswordService claves
) : ControllerBase
{
    // =========================================================
    // OBTENER IDENTIDAD DEL ADMINISTRADOR
    // =========================================================

    private int? Identidad()
    {
        var valor = User.FindFirst(
            JwtRegisteredClaimNames.Sub
        )?.Value;

        return int.TryParse(valor, out var id) && id > 0
            ? id
            : null;
    }

    // =========================================================
    // VALIDAR ROL DEL USUARIO
    // =========================================================

    private static bool RolValido(string rol)
    {
        return rol is "ADMIN" or "EXPERTO" or "COMITE";
    }

    // =========================================================
    // VALIDAR CONTRASEÑA
    // =========================================================

    private static bool ClaveValida(string clave)
    {
        return clave.Length is >= 12 and <= 128
            && clave.Any(char.IsLetter)
            && clave.Any(char.IsDigit)
            && !clave.Any(char.IsControl);
    }

    // =========================================================
    // RESPUESTA DE OPERACIONES ADMINISTRATIVAS
    // =========================================================

    private static IActionResult Responder(
        ResultadoAdmin resultado,
        ControllerBase controlador
    )
    {
        return resultado.Correcto
            ? controlador.Ok(resultado)
            : controlador.Conflict(new
            {
                mensaje = resultado.Mensaje
            });
    }

    // =========================================================
    // 1. LISTAR TODOS LOS USUARIOS
    //
    // GET /api/admin/usuarios
    // =========================================================

    [HttpGet("usuarios")]
    public async Task<IActionResult> Usuarios(
        CancellationToken ct
    )
    {
        var resultado = await usuarios.ListarAsync(ct);

        return Ok(resultado);
    }

    // =========================================================
    // 2. CONSULTAR AUDITORIA
    //
    // GET /api/admin/auditoria
    // =========================================================

    [HttpGet("auditoria")]
    public async Task<IActionResult> Auditoria(
        CancellationToken ct
    )
    {
        var resultado = await usuarios.AuditoriaAsync(ct);

        return Ok(resultado);
    }

    // =========================================================
    // 3. CREAR NUEVO USUARIO
    //
    // POST /api/admin/usuarios
    // =========================================================

    [HttpPost("usuarios")]
    public async Task<IActionResult> Crear(
        [FromBody] CrearUsuarioAdminRequest datos,
        CancellationToken ct
    )
    {
        var actor = Identidad();

        if (actor is null)
        {
            return Unauthorized();
        }

        datos.Nombre = datos.Nombre.Trim();

        datos.Correo = datos.Correo
            .Trim()
            .ToLowerInvariant();

        if (!RolValido(datos.Rol) ||
            !ClaveValida(datos.Contrasena))
        {
            return BadRequest(new
            {
                mensaje =
                    "Rol inválido o contraseña insuficiente. " +
                    "Usa entre 12 y 128 caracteres, " +
                    "incluyendo letras y números."
            });
        }

        // Generar hash seguro, nunca almacenar texto plano.
        var hash = claves.Hash(datos.Contrasena);

        try
        {
            var resultado = await usuarios.CrearAsync(
                actor.Value,
                datos,
                hash,
                ct
            );

            return Responder(resultado, this);
        }
        catch (SqlException e) when (
            e.Number is 2601 or 2627
        )
        {
            return Conflict(new
            {
                mensaje = "Este correo ya está registrado."
            });
        }
    }

    // =========================================================
    // 4. EDITAR INFORMACION Y ROL DEL USUARIO
    //
    // PUT /api/admin/usuarios/{id}
    // =========================================================

    [HttpPut("usuarios/{id:int}")]
    public async Task<IActionResult> Editar(
        int id,
        [FromBody] EditarUsuarioAdminRequest datos,
        CancellationToken ct
    )
    {
        var actor = Identidad();

        if (actor is null)
        {
            return Unauthorized();
        }

        if (id <= 0 || !RolValido(datos.Rol))
        {
            return BadRequest(new
            {
                mensaje = "Usuario o rol inválido."
            });
        }

        datos.Nombre = datos.Nombre.Trim();

        datos.Correo = datos.Correo
            .Trim()
            .ToLowerInvariant();

        try
        {
            var resultado = await usuarios.EditarAsync(
                actor.Value,
                id,
                datos,
                ct
            );

            return Responder(resultado, this);
        }
        catch (SqlException e) when (
            e.Number is 2601 or 2627
        )
        {
            return Conflict(new
            {
                mensaje = "Este correo ya está registrado."
            });
        }
    }

    // =========================================================
    // 5. RESTABLECER CONTRASEÑA DE USUARIO
    //
    // PUT /api/admin/usuarios/{id}/contrasena
    // =========================================================

    [HttpPut("usuarios/{id:int}/contrasena")]
    public async Task<IActionResult> CambiarClave(
        int id,
        [FromBody] CambiarClaveAdminRequest datos,
        CancellationToken ct
    )
    {
        var actor = Identidad();

        if (actor is null)
        {
            return Unauthorized();
        }

        if (id <= 0 || !ClaveValida(datos.Contrasena))
        {
            return BadRequest(new
            {
                mensaje =
                    "La contraseña debe tener entre " +
                    "12 y 128 caracteres, incluyendo " +
                    "letras y números."
            });
        }

        var resultado = await usuarios.CambiarClaveAsync(
            actor.Value,
            id,
            claves.Hash(datos.Contrasena),
            ct
        );

        return Responder(resultado, this);
    }

    // =========================================================
    // 6. DESIGNAR RESPONSABLE PRINCIPAL DEL COMITE
    //
    // PUT /api/admin/comite/principal/{id}
    // =========================================================

    [HttpPut("comite/principal/{id:int}")]
    public async Task<IActionResult> Principal(
        int id,
        CancellationToken ct
    )
    {
        var actor = Identidad();

        if (actor is null)
        {
            return Unauthorized();
        }

        if (id <= 0)
        {
            return BadRequest(new
            {
                mensaje = "Identificador de usuario inválido."
            });
        }

        var resultado =
            await usuarios.DesignarPrincipalAsync(
                actor.Value,
                id,
                ct
            );

        return Responder(resultado, this);
    }
}
