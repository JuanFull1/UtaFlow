using Microsoft.IdentityModel.Tokens;

namespace UtaFlow.Api.Authentication;

public sealed class JwtSettings
{
    public string Issuer { get; init; } = "";
    public string Audience { get; init; } = "";
    public string SigningKey { get; init; } = "";
    public int ExpirationMinutes { get; init; } = 15;

    public SymmetricSecurityKey CreateKey()
    {
        byte[] bytes;
        try { bytes = Convert.FromBase64String(SigningKey); }
        catch (FormatException) { throw new InvalidOperationException("Jwt__SigningKey debe ser Base64 valido."); }
        if (bytes.Length < 32)
            throw new InvalidOperationException("Configure Jwt__SigningKey con al menos 32 bytes aleatorios en Base64, fuera del repositorio.");
        if (string.IsNullOrWhiteSpace(Issuer) || string.IsNullOrWhiteSpace(Audience) || ExpirationMinutes is < 1 or > 60)
            throw new InvalidOperationException("Configure Jwt:Issuer, Jwt:Audience y Jwt:ExpirationMinutes (1-60).");
        return new SymmetricSecurityKey(bytes);
    }
}
