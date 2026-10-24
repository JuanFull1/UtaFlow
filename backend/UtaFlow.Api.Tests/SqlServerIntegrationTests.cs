using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using UtaFlow.Application.Authentication;
using UtaFlow.Infrastructure.Authentication;
using Xunit;

namespace UtaFlow.Api.Tests;

// Opt-in, read-only: never creates accounts or changes passwords.
public sealed class SqlServerIntegrationTests
{
    [SqlServerFact]
    [Trait("Category", "SqlServer")]
    public async Task Parameterized_Queries_And_Unknown_Login_Against_Real_Database()
    {
        var connectionString = Environment.GetEnvironmentVariable("UTAFLOW_TEST_SQL")!;
        var repository = new SqlUsuarioRepository(new SqlConnectionFactory(connectionString, allowUntrustedCertificate: true));
        Assert.Null(await repository.FindByIdAsync(0, CancellationToken.None));
        Assert.Null(await repository.FindByCorreoAsync("' OR 1=1 --", CancellationToken.None));
        var unknownCorreo = $"{Guid.NewGuid():N}@example.invalid";
        Assert.Null(await repository.FindByCorreoAsync(unknownCorreo, CancellationToken.None));

        await using var app = ApiBootstrap.Build(["--environment", "Development"], builder =>
        {
            builder.Logging.ClearProviders();
            builder.WebHost.UseTestServer();
            builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:UtaFlow"] = connectionString,
                ["Jwt:Issuer"] = "UtaFlow.SqlTests", ["Jwt:Audience"] = "UtaFlow.SqlTests.Client",
                ["Jwt:SigningKey"] = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)),
                ["Cors:FrontendOrigin"] = "https://frontend.example.invalid"
            });
        });
        await app.StartAsync();
        using var client = app.GetTestClient();
        client.BaseAddress = new Uri("https://localhost");
        var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest
        {
            Correo = unknownCorreo, Contrasena = Convert.ToBase64String(RandomNumberGenerator.GetBytes(24))
        });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.DoesNotContain("ClaveHash", await response.Content.ReadAsStringAsync());
    }
}

public sealed class SqlServerFactAttribute : FactAttribute
{
    public SqlServerFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("UTAFLOW_TEST_SQL")))
            Skip = "Configure UTAFLOW_TEST_SQL para ejecutar la integracion SQL de solo lectura.";
    }
}
