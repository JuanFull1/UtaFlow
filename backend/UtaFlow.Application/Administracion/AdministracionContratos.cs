using System.ComponentModel.DataAnnotations;

namespace UtaFlow.Application.Administracion;

public sealed class CrearUsuarioAdminRequest
{
    [Required, StringLength(150, MinimumLength = 2)]
    public string Nombre { get; set; } = "";

    [Required, EmailAddress, StringLength(200)]
    public string Correo { get; set; } = "";

    [Required, StringLength(128, MinimumLength = 12)]
    public string Contrasena { get; set; } = "";

    [Required]
    public string Rol { get; set; } = "EXPERTO";
}

public sealed class EditarUsuarioAdminRequest
{
    [Required, StringLength(150, MinimumLength = 2)]
    public string Nombre { get; set; } = "";

    [Required, EmailAddress, StringLength(200)]
    public string Correo { get; set; } = "";

    [Required]
    public string Rol { get; set; } = "EXPERTO";

    public bool Activo { get; set; } = true;
}

public sealed class CambiarClaveAdminRequest
{
    [Required, StringLength(128, MinimumLength = 12)]
    public string Contrasena { get; set; } = "";
}

public sealed record UsuarioAdministradoDto(
    int Id,
    string Nombre,
    string Correo,
    string Rol,
    bool Activo,
    bool MiembroComite,
    bool EsPrincipal
);

public sealed record AuditoriaAdministracionDto(
    long Id,
    string Administrador,
    string? UsuarioObjetivo,
    string Accion,
    string Descripcion,
    DateTime Fecha
);

public sealed record ResultadoAdmin(
    bool Correcto,
    string Mensaje,
    int? Id = null
);

public interface IAdministracionUsuariosRepository
{
    Task<IReadOnlyList<UsuarioAdministradoDto>> ListarAsync(
        CancellationToken ct
    );

    Task<IReadOnlyList<AuditoriaAdministracionDto>> AuditoriaAsync(
        CancellationToken ct
    );

    Task<ResultadoAdmin> CrearAsync(
        int actorId,
        CrearUsuarioAdminRequest datos,
        string claveHash,
        CancellationToken ct
    );

    Task<ResultadoAdmin> EditarAsync(
        int actorId,
        int usuarioId,
        EditarUsuarioAdminRequest datos,
        CancellationToken ct
    );

    Task<ResultadoAdmin> CambiarClaveAsync(
        int actorId,
        int usuarioId,
        string claveHash,
        CancellationToken ct
    );

    Task<ResultadoAdmin> DesignarPrincipalAsync(
        int actorId,
        int usuarioId,
        CancellationToken ct
    );
}