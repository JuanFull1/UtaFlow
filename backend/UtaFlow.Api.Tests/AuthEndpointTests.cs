using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using UtaFlow.Api.Authentication;
using UtaFlow.Application.Authentication;
using UtaFlow.Domain.Authentication;
using UtaFlow.Infrastructure.Authentication;
using Xunit;

namespace UtaFlow.Api.Tests;

public sealed class AuthEndpointTests
{
    [Theory]
    [InlineData("EXPERTO")]
    [InlineData("COMITE")]
    [InlineData("ADMIN")]
    public async Task Login_And_Me_Return_Current_User_Without_Hash(string rol)
    {
        await using var host = await AuthHost.StartAsync(rol);
        var response = await host.LoginAsync();
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(response.Headers.CacheControl?.NoStore);
        var raw = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("claveHash", raw, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(host.Repository.Current!.ClaveHash, raw);
        var login = (await response.Content.ReadFromJsonAsync<LoginResponse>())!;
        Assert.Equal(rol, login.Usuario.Rol);
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(login.Token);
        Assert.Equal(host.Settings.Issuer, jwt.Issuer);
        Assert.Contains(host.Settings.Audience, jwt.Audiences);
        Assert.InRange(jwt.ValidTo - jwt.ValidFrom, TimeSpan.FromMinutes(14), TimeSpan.FromMinutes(16));

        host.Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", login.Token);
        var me = await host.Client.GetAsync("/api/auth/me?id=9999&rol=ADMIN");
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
        Assert.Equal(login.Usuario, await me.Content.ReadFromJsonAsync<UsuarioDto>());
    }

    [Fact]
    public async Task Wrong_Password_Unknown_Email_And_Inactive_User_Have_Identical_401()
    {
        await using var host = await AuthHost.StartAsync();
        var wrong = await host.LoginAsync(password: Guid.NewGuid().ToString("N"));
        var missing = await host.LoginAsync(correo: $"{Guid.NewGuid():N}@example.invalid");
        host.Repository.Current = host.Repository.UserWith(activo: false);
        var inactive = await host.LoginAsync();
        foreach (var response in new[] { wrong, missing, inactive })
        {
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            Assert.Contains(response.Headers.WwwAuthenticate, header => header.Scheme == "Bearer");
        }
        Assert.Equal(await wrong.Content.ReadAsStringAsync(), await missing.Content.ReadAsStringAsync());
        Assert.Equal(await wrong.Content.ReadAsStringAsync(), await inactive.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData("REEMPLAZAR_CON_HASH")]
    [InlineData("AQ==")]
    [InlineData("not-a-hash")]
    public async Task Placeholder_Or_Malformed_Hash_Is_Rejected(string hash)
    {
        await using var host = await AuthHost.StartAsync();
        host.Repository.Current = host.Repository.UserWith(hash: hash);
        Assert.Equal(HttpStatusCode.Unauthorized, (await host.LoginAsync()).StatusCode);
    }

    [Fact]
    public async Task Unsupported_Role_Cannot_Login()
    {
        await using var host = await AuthHost.StartAsync("USUARIO_FINAL");
        Assert.Equal(HttpStatusCode.Unauthorized, (await host.LoginAsync()).StatusCode);
    }

    [Theory]
    [InlineData("missing")]
    [InlineData("malformed")]
    [InlineData("signature")]
    [InlineData("expired")]
    [InlineData("future")]
    [InlineData("issuer")]
    [InlineData("audience")]
    [InlineData("subject")]
    [InlineData("role")]
    [InlineData("unsigned")]
    [InlineData("algorithm")]
    public async Task Me_Rejects_Invalid_Tokens(string scenario)
    {
        await using var host = await AuthHost.StartAsync();
        if (scenario != "missing")
            host.Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
                scenario == "malformed" ? "invalid.token" : host.CreateToken(scenario));

        Assert.Equal(HttpStatusCode.Unauthorized, (await host.Client.GetAsync("/api/auth/me")).StatusCode);
        if (scenario is not ("role" or "subject")) Assert.Equal(0, host.Repository.IdLookups);
    }

    [Theory]
    [InlineData("inactive")]
    [InlineData("deleted")]
    [InlineData("role")]
    public async Task Me_Rechecks_Account_After_Token_Was_Issued(string change)
    {
        await using var host = await AuthHost.StartAsync();
        var login = (await (await host.LoginAsync()).Content.ReadFromJsonAsync<LoginResponse>())!;
        host.Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", login.Token);
        host.Repository.Current = change switch
        {
            "inactive" => host.Repository.UserWith(activo: false),
            "deleted" => null,
            _ => host.Repository.UserWith(rol: "ADMIN")
        };
        Assert.Equal(HttpStatusCode.Unauthorized, (await host.Client.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task Sixth_Login_Attempt_Returns_429_With_RetryAfter()
    {
        await using var host = await AuthHost.StartAsync();
        for (var attempt = 0; attempt < 5; attempt++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await host.LoginAsync(password: "invalid")).StatusCode);
        var limited = await host.LoginAsync();
        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);
        Assert.NotNull(limited.Headers.RetryAfter);
        Assert.Equal(5, host.Repository.CorreoLookups);
    }

    [Theory]
    [InlineData("https://frontend.example.invalid", true)]
    [InlineData("https://untrusted.example.invalid", false)]
    public async Task Cors_Allows_Only_Configured_Origin(string origin, bool allowed)
    {
        await using var host = await AuthHost.StartAsync();
        using var request = new HttpRequestMessage(HttpMethod.Options, "/api/auth/login");
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", "content-type");
        var response = await host.Client.SendAsync(request);
        Assert.Equal(allowed, response.Headers.Contains("Access-Control-Allow-Origin"));
        if (allowed) Assert.Equal(origin, Assert.Single(response.Headers.GetValues("Access-Control-Allow-Origin")));
    }

    [Theory]
    [InlineData("", "something")]
    [InlineData("invalid-email", "something")]
    [InlineData("user@example.invalid", "")]
    public async Task Invalid_Request_Returns_400_Without_Querying_Sql(string correo, string password)
    {
        await using var host = await AuthHost.StartAsync();
        Assert.Equal(HttpStatusCode.BadRequest, (await host.LoginAsync(correo, password)).StatusCode);
        Assert.Equal(0, host.Repository.CorreoLookups);
    }

    [Fact]
    public void PasswordHasher_Uses_Random_Salt_And_Rejects_Wrong_Password()
    {
        var passwords = new IdentityPasswordService();
        var password = Convert.ToBase64String(RandomNumberGenerator.GetBytes(24));
        var hash = passwords.Hash(password);
        Assert.True(hash.Length <= 255);
        Assert.NotEqual(hash, passwords.Hash(password));
        Assert.True(passwords.Verify(hash, password));
        Assert.False(passwords.Verify(hash, Guid.NewGuid().ToString("N")));
    }

    [Fact]
    public async Task Discarding_Token_Removes_Client_Access()
    {
        await using var host = await AuthHost.StartAsync();
        var login = (await (await host.LoginAsync()).Content.ReadFromJsonAsync<LoginResponse>())!;
        host.Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", login.Token);
        Assert.Equal(HttpStatusCode.OK, (await host.Client.GetAsync("/api/auth/me")).StatusCode);
        host.Client.DefaultRequestHeaders.Authorization = null;
        Assert.Equal(HttpStatusCode.Unauthorized, (await host.Client.GetAsync("/api/auth/me")).StatusCode);
    }
}

internal sealed class AuthHost(WebApplication app, HttpClient client, MemoryUsuarioRepository repository,
    string password, JwtSettings settings) : IAsyncDisposable
{
    private readonly string loginPassword = password;
    public HttpClient Client { get; } = client;
    public MemoryUsuarioRepository Repository { get; } = repository;
    public JwtSettings Settings { get; } = settings;

    public Task<HttpResponseMessage> LoginAsync(string? correo = null, string? password = null) =>
        Client.PostAsJsonAsync("/api/auth/login", new LoginRequest
        {
            Correo = correo ?? Repository.Correo, Contrasena = password ?? loginPassword
        });

    public static async Task<AuthHost> StartAsync(string rol = "EXPERTO")
    {
        var passwords = new IdentityPasswordService();
        var password = Convert.ToBase64String(RandomNumberGenerator.GetBytes(24));
        var repository = new MemoryUsuarioRepository(passwords.Hash(password), rol);
        var settings = new JwtSettings
        {
            Issuer = "UtaFlow.Tests", Audience = "UtaFlow.Tests.Client",
            SigningKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64))
        };
        var app = ApiBootstrap.Build([], builder =>
        {
            builder.Logging.ClearProviders();
            builder.WebHost.UseTestServer();
            builder.Services.AddExceptionHandler<RethrowTestExceptionHandler>();
            builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:UtaFlow"] = "Server=localhost;Database=UtaFlow;Integrated Security=True;Encrypt=True",
                ["Jwt:Issuer"] = settings.Issuer, ["Jwt:Audience"] = settings.Audience,
                ["Jwt:SigningKey"] = settings.SigningKey, ["Jwt:ExpirationMinutes"] = "15",
                ["Cors:FrontendOrigin"] = "https://frontend.example.invalid",
                ["Logging:LogLevel:Default"] = "None"
            });
            builder.Services.AddSingleton<IUsuarioRepository>(repository);
        });
        await app.StartAsync();
        var client = app.GetTestClient();
        client.BaseAddress = new Uri("https://localhost");
        return new AuthHost(app, client, repository, password, settings);
    }

    public string CreateToken(string scenario)
    {
        var now = DateTime.UtcNow;
        var key = scenario == "signature" ? new SymmetricSecurityKey(RandomNumberGenerator.GetBytes(64)) : Settings.CreateKey();
        var jwt = new JwtSecurityToken(
            scenario == "issuer" ? "wrong-issuer" : Settings.Issuer,
            scenario == "audience" ? "wrong-audience" : Settings.Audience,
            [new Claim("sub", scenario == "subject" ? "invalid" : "1"),
             new Claim("role", scenario == "role" ? "ADMIN" : "EXPERTO")],
            notBefore: scenario == "expired" ? now.AddHours(-1) : scenario == "future" ? now.AddMinutes(5) : now.AddSeconds(-1),
            expires: scenario == "expired" ? now.AddMinutes(-1) : now.AddMinutes(15),
            signingCredentials: scenario == "unsigned" ? null : new SigningCredentials(key,
                scenario == "algorithm" ? SecurityAlgorithms.HmacSha384 : SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(jwt);
    }

    public async ValueTask DisposeAsync()
    {
        Client.Dispose();
        await app.DisposeAsync();
    }
}

internal sealed class RethrowTestExceptionHandler : IExceptionHandler
{
    public ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        System.Runtime.ExceptionServices.ExceptionDispatchInfo.Capture(exception).Throw();
        return ValueTask.FromResult(false);
    }
}

internal sealed class MemoryUsuarioRepository : IUsuarioRepository
{
    public Usuario? Current { get; set; }
    public string Correo { get; } = $"{Guid.NewGuid():N}@example.invalid";
    public int CorreoLookups { get; private set; }
    public int IdLookups { get; private set; }

    public MemoryUsuarioRepository(string hash, string rol)
    {
        Current = new Usuario { Id = 1, Nombre = "Prueba automatizada", Correo = Correo, ClaveHash = hash, Rol = rol, Activo = true };
    }

    public Usuario UserWith(bool? activo = null, string? hash = null, string? rol = null) => new()
    {
        Id = Current!.Id, Nombre = Current.Nombre, Correo = Current.Correo,
        ClaveHash = hash ?? Current.ClaveHash, Rol = rol ?? Current.Rol, Activo = activo ?? Current.Activo
    };

    public Task<Usuario?> FindByCorreoAsync(string correo, CancellationToken cancellationToken)
    {
        CorreoLookups++;
        return Task.FromResult(Current?.Correo == correo ? Current : null);
    }

    public Task<Usuario?> FindByIdAsync(int id, CancellationToken cancellationToken)
    {
        IdLookups++;
        return Task.FromResult(Current?.Id == id ? Current : null);
    }
}
