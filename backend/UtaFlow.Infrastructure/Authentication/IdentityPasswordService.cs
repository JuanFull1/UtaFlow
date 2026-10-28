using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using UtaFlow.Application.Authentication;

namespace UtaFlow.Infrastructure.Authentication;

public sealed class IdentityPasswordService : IPasswordService
{
    private readonly PasswordHasher<object> hasher = new(Options.Create(new PasswordHasherOptions
    {
        CompatibilityMode = PasswordHasherCompatibilityMode.IdentityV3,
        IterationCount = 220_000
    }));
    private readonly object context = new();
    private readonly string dummyHash;

    public IdentityPasswordService()
    {
        // Equal-cost verification for absent users and seed placeholders; no usable dummy account.
        dummyHash = hasher.HashPassword(context, Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)));
    }

    public string Hash(string password) => hasher.HashPassword(context, password);

    public bool Verify(string? hash, string password)
    {
        if (string.IsNullOrEmpty(hash) || hash.Length > 255)
            return VerifyDummy(password);

        // Only accept Identity V3 hashes (PBKDF2, salted and versioned).
        byte[] decoded;
        try { decoded = Convert.FromBase64String(hash); }
        catch (FormatException) { return VerifyDummy(password); }
        if (decoded.Length < 13 || decoded[0] != 1) return VerifyDummy(password);

        try
        {
            var result = hasher.VerifyHashedPassword(context, hash, password);
            return result is PasswordVerificationResult.Success or PasswordVerificationResult.SuccessRehashNeeded;
        }
        catch (ArgumentException) { return VerifyDummy(password); }
        catch (FormatException) { return VerifyDummy(password); }
    }

    private bool VerifyDummy(string password)
    {
        _ = hasher.VerifyHashedPassword(context, dummyHash, password);
        return false;
    }
}
