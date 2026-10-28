namespace UtaFlow.Domain.Authentication;

public sealed class Usuario
{
    public required int Id { get; init; }
    public required string Nombre { get; init; }
    public required string Correo { get; init; }
    public required string ClaveHash { get; init; }
    public required string Rol { get; init; }
    public required bool Activo { get; init; }

    public bool PuedeIniciarSesion => Activo && Rol is "EXPERTO" or "COMITE" or "ADMIN";
}
