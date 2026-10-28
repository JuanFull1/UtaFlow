using UtaFlow.Domain.Authentication;

namespace UtaFlow.Application.Authentication;

public interface IUsuarioRepository
{
    Task<Usuario?> FindByCorreoAsync(string correo, CancellationToken cancellationToken);
    Task<Usuario?> FindByIdAsync(int id, CancellationToken cancellationToken);
}
