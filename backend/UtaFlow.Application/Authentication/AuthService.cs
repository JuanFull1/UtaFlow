namespace UtaFlow.Application.Authentication;

public sealed class AuthService(IUsuarioRepository usuarios, IPasswordService passwords, ITokenIssuer tokens)
{
    public async Task<LoginResponse?> LoginAsync(LoginRequest request, CancellationToken cancellationToken)
    {
        var usuario = await usuarios.FindByCorreoAsync(request.Correo.Trim(), cancellationToken);
        // Always verify, including inactive and nonexistent accounts.
        var validPassword = passwords.Verify(usuario?.ClaveHash, request.Contrasena);
        if (!validPassword || usuario is null || !usuario.PuedeIniciarSesion) return null;

        var dto = UsuarioDto.From(usuario);
        return new LoginResponse(tokens.Issue(dto), dto);
    }

    public async Task<UsuarioDto?> GetUsuarioAsync(int id, CancellationToken cancellationToken)
    {
        var usuario = await usuarios.FindByIdAsync(id, cancellationToken);
        return usuario is { PuedeIniciarSesion: true } ? UsuarioDto.From(usuario) : null;
    }
}
