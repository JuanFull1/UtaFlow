using System.Data;
using Microsoft.Data.SqlClient;
using UtaFlow.Application.Authentication;
using UtaFlow.Domain.Authentication;

namespace UtaFlow.Infrastructure.Authentication;

public sealed class SqlUsuarioRepository(SqlConnectionFactory connections) : IUsuarioRepository
{
    private const string SelectUsuario = """
        SELECT u.IdUsuario, u.Nombre, u.Correo, u.ClaveHash, r.Codigo, u.Activo
        FROM dbo.Usuario AS u
        INNER JOIN dbo.Rol AS r ON r.IdRol = u.IdRol
        """;

    public Task<Usuario?> FindByCorreoAsync(string correo, CancellationToken cancellationToken) =>
        FindAsync(SelectUsuario + " WHERE u.Correo = @correo;",
            new SqlParameter("@correo", SqlDbType.NVarChar, 200) { Value = correo }, cancellationToken);

    public Task<Usuario?> FindByIdAsync(int id, CancellationToken cancellationToken) =>
        FindAsync(SelectUsuario + " WHERE u.IdUsuario = @id;",
            new SqlParameter("@id", SqlDbType.Int) { Value = id }, cancellationToken);

    private async Task<Usuario?> FindAsync(string query, SqlParameter parameter, CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(query, connection) { CommandTimeout = 15 };
        command.Parameters.Add(parameter);
        await using var reader = await command.ExecuteReaderAsync(CommandBehavior.SingleRow, cancellationToken);
        if (!await reader.ReadAsync(cancellationToken)) return null;

        return new Usuario
        {
            Id = reader.GetInt32(0), Nombre = reader.GetString(1), Correo = reader.GetString(2),
            ClaveHash = reader.GetString(3), Rol = reader.GetString(4), Activo = reader.GetBoolean(5)
        };
    }
}
