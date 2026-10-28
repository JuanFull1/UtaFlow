using Microsoft.Data.SqlClient;

namespace UtaFlow.Infrastructure.Authentication;

public sealed class SqlConnectionFactory
{
    private readonly string connectionString;

    public SqlConnectionFactory(string connectionString, bool allowUntrustedCertificate = false)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new InvalidOperationException("Configure ConnectionStrings__UtaFlow fuera del repositorio.");

        SqlConnectionStringBuilder settings;
        try
        {
            settings = new SqlConnectionStringBuilder(connectionString);
        }
        catch (ArgumentException)
        {
            throw new InvalidOperationException("ConnectionStrings__UtaFlow no es una cadena SQL valida.");
        }

        if (string.IsNullOrWhiteSpace(settings.DataSource) || string.IsNullOrWhiteSpace(settings.InitialCatalog))
            throw new InvalidOperationException("La conexion SQL requiere Server y Database.");
        if (settings.Encrypt == SqlConnectionEncryptOption.Optional)
            throw new InvalidOperationException("La conexion SQL requiere Encrypt=True o Strict.");
        if (settings.TrustServerCertificate && !allowUntrustedCertificate)
            throw new InvalidOperationException("TrustServerCertificate=True solo se permite en Development.");

        settings.PersistSecurityInfo = false;
        this.connectionString = settings.ConnectionString;
    }

    public async Task<SqlConnection> OpenAsync(CancellationToken cancellationToken)
    {
        var connection = new SqlConnection(connectionString);
        try
        {
            await connection.OpenAsync(cancellationToken);
            return connection;
        }
        catch
        {
            await connection.DisposeAsync();
            throw;
        }
    }
}
