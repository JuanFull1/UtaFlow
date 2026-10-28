
using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Threading.RateLimiting;

using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.Tokens;

using UtaFlow.Api.Authentication;
using UtaFlow.Api.Controllers;
using UtaFlow.Application.Authentication;
using UtaFlow.Application.Administracion;
using UtaFlow.Application.Solicitudes;
using UtaFlow.Infrastructure.Authentication;
using UtaFlow.Infrastructure.Administracion;
using UtaFlow.Infrastructure.Solicitudes;

namespace UtaFlow.Api;

public static class ApiBootstrap
{
    public static WebApplication Build(
        string[] args,
        Action<WebApplicationBuilder>? configure = null
    )
    {
        var builder = WebApplication.CreateBuilder(args);

        configure?.Invoke(builder);

        var jwt = builder.Configuration
            .GetSection("Jwt")
            .Get<JwtSettings>()
            ?? new JwtSettings();

        var key = jwt.CreateKey();

        var cadenaConexion = builder.Configuration
            .GetConnectionString("UtaFlow") ?? "";

        var connections = new SqlConnectionFactory(
            cadenaConexion,
            builder.Environment.IsDevelopment()
        );

        var origin = builder.Configuration[
            "Cors:FrontendOrigin"
        ];

        if (
            !Uri.TryCreate(
                origin,
                UriKind.Absolute,
                out var originUri
            ) ||
            originUri.Scheme is not ("http" or "https") ||
            originUri.Authority.Contains('*') ||
            origin != originUri.GetLeftPart(
                UriPartial.Authority
            ) ||
            (
                !builder.Environment.IsDevelopment() &&
                originUri.Scheme != "https"
            )
        )
        {
            throw new InvalidOperationException(
                "Cors:FrontendOrigin requiere un origen " +
                "exacto sin ruta; HTTPS fuera de Development."
            );
        }

        // =====================================================
        // 1. SERVICIOS BASE
        // =====================================================

        builder.Services.AddSingleton(jwt);
        builder.Services.AddSingleton(connections);
        builder.Services.AddSingleton(TimeProvider.System);

        // =====================================================
        // 2. AUTENTICACION EXISTENTE
        // =====================================================

        builder.Services.AddSingleton<
            IPasswordService,
            IdentityPasswordService
        >();

        builder.Services.AddSingleton<
            ITokenIssuer,
            JwtTokenIssuer
        >();

        builder.Services.TryAddScoped<
            IUsuarioRepository,
            SqlUsuarioRepository
        >();

        builder.Services.AddScoped<AuthService>();

        // =====================================================
        // 3. ADMINISTRACION DE USUARIOS
        // =====================================================

        builder.Services.AddScoped<
            IAdministracionUsuariosRepository,
            SqlAdministracionUsuariosRepository
        >();

        // =====================================================
        // 4. SOLICITUDES PUBLICAS
        // =====================================================

        builder.Services.AddScoped<
            ISolicitudesPublicasRepository
        >(_ => new SqlSolicitudesPublicasRepository(
            cadenaConexion
        ));

        // =====================================================
        // 5. SOLICITUDES INTERNAS
        // =====================================================

        builder.Services.AddScoped<
            ISolicitudesInternasRepository
        >(_ => new SqlSolicitudesInternasRepository(
            cadenaConexion
        ));

        // =====================================================
        // 6. CONTROLADORES Y ERRORES
        // =====================================================

        builder.Services
            .AddControllers()
            .AddApplicationPart(
                typeof(AuthController).Assembly
            );

        builder.Services.AddOpenApi();
        builder.Services.AddProblemDetails();

        builder.Services.AddExceptionHandler<
            ApiExceptionHandler
        >();

        // =====================================================
        // 7. CORS
        // =====================================================

        builder.Services.AddCors(options =>
            options.AddDefaultPolicy(policy =>
                policy
                    .WithOrigins(origin!)
                    .WithMethods(
                        "GET",
                        "POST",
                        "PUT"
                    )
                    .WithHeaders(
                        "Content-Type",
                        "Authorization"
                    )
            )
        );

        // =====================================================
        // 8. AUTENTICACION JWT
        // =====================================================

        builder.Services
            .AddAuthentication(
                JwtBearerDefaults.AuthenticationScheme
            )
            .AddJwtBearer(options =>
            {
                options.MapInboundClaims = false;
                options.IncludeErrorDetails = false;

                options.TokenValidationParameters =
                    new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidIssuer = jwt.Issuer,

                        ValidateAudience = true,
                        ValidAudience = jwt.Audience,

                        ValidateIssuerSigningKey = true,
                        IssuerSigningKey = key,

                        ValidateLifetime = true,
                        RequireExpirationTime = true,
                        RequireSignedTokens = true,

                        ValidAlgorithms =
                        [
                            SecurityAlgorithms.HmacSha256
                        ],

                        ClockSkew = TimeSpan.Zero,

                        NameClaimType =
                            JwtRegisteredClaimNames.Sub,

                        RoleClaimType = "role"
                    };

                options.Events = new JwtBearerEvents
                {
                    OnTokenValidated = async context =>
                    {
                        var subject = context.Principal?
                            .FindFirst(
                                JwtRegisteredClaimNames.Sub
                            )?.Value;

                        if (
                            !int.TryParse(
                                subject,
                                NumberStyles.None,
                                CultureInfo.InvariantCulture,
                                out var id
                            ) ||
                            id <= 0
                        )
                        {
                            context.Fail(
                                "Identidad invalida."
                            );

                            return;
                        }

                        var authService = context.HttpContext
                            .RequestServices
                            .GetRequiredService<AuthService>();

                        var user =
                            await authService.GetUsuarioAsync(
                                id,
                                context.HttpContext.RequestAborted
                            );

                        if (
                            user is null ||
                            user.Rol != context.Principal?
                                .FindFirst("role")?.Value
                        )
                        {
                            context.Fail(
                                "Sesion invalida."
                            );
                        }
                        else
                        {
                            context.HttpContext.Items[
                                AuthController.CurrentUserKey
                            ] = user;
                        }
                    }
                };
            });

        // =====================================================
        // 9. AUTORIZACION
        // =====================================================

        builder.Services.AddAuthorization();

        // =====================================================
        // 10. LIMITES DE PETICIONES
        // =====================================================

        builder.Services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode =
                StatusCodes.Status429TooManyRequests;

            options.AddPolicy(
                "login",
                context =>
                    RateLimitPartition.GetFixedWindowLimiter(
                        context.Connection.RemoteIpAddress?
                            .ToString() ?? "unknown",

                        _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = 5,
                            Window = TimeSpan.FromMinutes(1),
                            QueueLimit = 0,
                            AutoReplenishment = true
                        }
                    )
            );

            options.AddPolicy(
                "solicitudesPublicas",
                context =>
                    RateLimitPartition.GetFixedWindowLimiter(
                        context.Connection.RemoteIpAddress?
                            .ToString() ?? "unknown",

                        _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = 15,
                            Window = TimeSpan.FromMinutes(1),
                            QueueLimit = 0,
                            AutoReplenishment = true
                        }
                    )
            );

            options.OnRejected = async (
                context,
                cancellationToken
            ) =>
            {
                if (
                    context.Lease.TryGetMetadata(
                        MetadataName.RetryAfter,
                        out var retryAfter
                    )
                )
                {
                    context.HttpContext.Response.Headers
                        .RetryAfter =
                        Math.Ceiling(
                            retryAfter.TotalSeconds
                        ).ToString(
                            CultureInfo.InvariantCulture
                        );
                }

                context.HttpContext.Response.Headers
                    .CacheControl = "no-store";

                await context.HttpContext.Response
                    .WriteAsJsonAsync(
                        new ProblemDetails
                        {
                            Status = 429,
                            Title =
                                "Demasiados intentos. " +
                                "Intente nuevamente mas tarde."
                        },
                        cancellationToken
                    );
            };
        });

        // =====================================================
        // 11. CONSTRUIR APLICACION
        // =====================================================

        var app = builder.Build();

        app.UseExceptionHandler();

        if (!app.Environment.IsDevelopment())
        {
            app.UseHsts();
        }

        app.UseHttpsRedirection();
        app.UseRouting();
        app.UseCors();
        app.UseRateLimiter();
        app.UseAuthentication();
        app.UseAuthorization();

        if (app.Environment.IsDevelopment())
        {
            app.MapOpenApi();
        }

        app.MapControllers();

        return app;
    }
}
