using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace UtaFlow.Api.Authentication;

public sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        var status = exception is SqlException ? StatusCodes.Status503ServiceUnavailable : StatusCodes.Status500InternalServerError;
        logger.LogError("Solicitud {TraceId} fallo: {ExceptionType}; codigo SQL {SqlCode}.",
            context.TraceIdentifier, exception.GetType().Name, (exception as SqlException)?.Number);
        context.Response.StatusCode = status;
        context.Response.Headers.CacheControl = "no-store";
        await context.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = status,
            Title = status == 503 ? "Servicio de autenticacion temporalmente no disponible." : "No fue posible procesar la solicitud."
        }, cancellationToken);
        return true;
    }
}
