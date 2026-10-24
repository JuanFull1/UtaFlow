using System.ComponentModel.DataAnnotations;
using UtaFlow.Domain.Authentication;

namespace UtaFlow.Application.Authentication;

public sealed class LoginRequest
{
    [Required, EmailAddress, StringLength(200)]
    public string Correo { get; init; } = "";

    [Required, StringLength(128)]
    public string Contrasena { get; init; } = "";
}

public sealed record UsuarioDto(int Id, string Nombre, string Correo, string Rol)
{
    public static UsuarioDto From(Usuario usuario) => new(usuario.Id, usuario.Nombre, usuario.Correo, usuario.Rol);
}

public sealed record LoginResponse(string Token, UsuarioDto Usuario);

public interface ITokenIssuer
{
    string Issue(UsuarioDto usuario);
}
