using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using UtaFlow.Application.Authentication;

namespace UtaFlow.Api.Controllers;

[ApiController]
[Route("api/auth")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AuthController(AuthService auth) : ControllerBase
{
    internal const string CurrentUserKey = "UtaFlow.AuthenticatedUser";

    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    [RequestSizeLimit(4096)]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        var response = await auth.LoginAsync(request, cancellationToken);
        if (response is not null) return Ok(response);

        Response.Headers.WWWAuthenticate = JwtBearerDefaults.AuthenticationScheme;
        return Unauthorized(new ProblemDetails
        {
            Status = StatusCodes.Status401Unauthorized,
            Title = "Correo o contrasena incorrectos."
        });
    }

    [HttpGet("me")]
    [Authorize]
    public ActionResult<UsuarioDto> Me() => Ok((UsuarioDto)HttpContext.Items[CurrentUserKey]!);
}
