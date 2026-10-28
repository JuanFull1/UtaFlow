using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.IdentityModel.Tokens;
using UtaFlow.Application.Authentication;

namespace UtaFlow.Api.Authentication;

public sealed class JwtTokenIssuer(JwtSettings settings, TimeProvider timeProvider) : ITokenIssuer
{
    private readonly SigningCredentials credentials = new(settings.CreateKey(), SecurityAlgorithms.HmacSha256);

    public string Issue(UsuarioDto usuario)
    {
        var now = timeProvider.GetUtcNow().UtcDateTime;
        var token = new JwtSecurityToken(settings.Issuer, settings.Audience,
        [
            new Claim(JwtRegisteredClaimNames.Sub, usuario.Id.ToString(CultureInfo.InvariantCulture)),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
            new Claim(JwtRegisteredClaimNames.Iat, new DateTimeOffset(now).ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture), ClaimValueTypes.Integer64),
            new Claim("role", usuario.Rol)
        ], notBefore: now, expires: now.AddMinutes(settings.ExpirationMinutes), signingCredentials: credentials);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
