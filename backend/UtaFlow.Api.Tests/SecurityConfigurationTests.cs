using System.Security.Cryptography;
using Microsoft.Extensions.Configuration;
using UtaFlow.Api.Authentication;
using UtaFlow.Infrastructure.Authentication;
using Xunit;

namespace UtaFlow.Api.Tests;

public sealed class SecurityConfigurationTests
{
    [Theory]
    [InlineData("")]
    [InlineData("not-base64")]
    public void Missing_Or_Invalid_Jwt_Key_Is_Rejected(string key)
    {
        Assert.Throws<InvalidOperationException>(() => new JwtSettings
        {
            SigningKey = key, Issuer = "Tests", Audience = "Tests"
        }.CreateKey());
    }

    [Fact]
    public void Short_Jwt_Key_Is_Rejected()
    {
        Assert.Throws<InvalidOperationException>(() => new JwtSettings
        {
            SigningKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(16)), Issuer = "Tests", Audience = "Tests"
        }.CreateKey());
    }

    [Theory]
    [InlineData("")]
    [InlineData("Server=localhost;Database=UtaFlow;Encrypt=False")]
    [InlineData("Server=localhost;Database=UtaFlow;Encrypt=True;TrustServerCertificate=True")]
    [InlineData("Server=localhost;Encrypt=True")]
    public void Missing_Or_Insecure_Sql_Configuration_Is_Rejected(string connectionString)
    {
        Assert.Throws<InvalidOperationException>(() => new SqlConnectionFactory(connectionString));
    }

    [Theory]
    [InlineData("*")]
    [InlineData("https://*.example.invalid")]
    [InlineData("https://frontend.example.invalid/path")]
    [InlineData("https://frontend.example.invalid/")]
    [InlineData("https://frontend.example.invalid?unexpected=1")]
    public void Cors_Requires_An_Exact_Origin(string origin)
    {
        Assert.Throws<InvalidOperationException>(() => ApiBootstrap.Build([], builder =>
            builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:SigningKey"] = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)),
                ["Jwt:Issuer"] = "Tests", ["Jwt:Audience"] = "Tests",
                ["ConnectionStrings:UtaFlow"] = "Server=localhost;Database=UtaFlow;Integrated Security=True;Encrypt=True",
                ["Cors:FrontendOrigin"] = origin
            })));
    }
}
