using System.ComponentModel.DataAnnotations;

namespace UtaFlow.Application.Solicitudes;

public sealed class CrearSolicitudPublicaRequest
{
    [Required, StringLength(150)]
    public string Nombre { get; set; } = "";

    [Required, EmailAddress, StringLength(200)]
    public string Correo { get; set; } = "";

    [StringLength(30)]
    public string? Telefono { get; set; }

    [StringLength(150)]
    public string? EmpresaArea { get; set; }

    // IdSistema se resuelve internamente en el repositorio.

    [StringLength(150)]
    public string? ModuloAfectado { get; set; }

    // La version del software la identifica posteriormente el experto.

    [Required, StringLength(200)]
    public string Asunto { get; set; } = "";

    [Required, StringLength(4000, MinimumLength = 10)]
    public string Descripcion { get; set; } = "";

    [Required, StringLength(500)]
    public string Razon { get; set; } = "";

    [Range(1, 255)]
    public int IdPrioridad { get; set; }

    [StringLength(1000)]
    public string? AfectacionActual { get; set; }

    [StringLength(1000)]
    public string? ComentariosAdicionales { get; set; }

    public DateOnly? FechaLimite { get; set; }
}

public sealed class ConsultarSolicitudPublicaRequest
{
    [Required, StringLength(40)]
    public string Codigo { get; set; } = "";
}

public sealed class ResponderSolicitudPublicaRequest
{
    [Required, StringLength(40)]
    public string Codigo { get; set; } = "";

    [Required, StringLength(2000, MinimumLength = 2)]
    public string Mensaje { get; set; } = "";
}

public record CatalogoPublicoItem(
    int Id,
    string Nombre
);

public record CatalogosPublicosResponse(
    IReadOnlyList<CatalogoPublicoItem> Sistemas,
    IReadOnlyList<CatalogoPublicoItem> Prioridades
);

public record MensajePublicoResponse(
    int IdMensaje,
    string Emisor,
    string Mensaje,
    DateTime Fecha
);

public record HistorialPublicoResponse(
    string Estado,
    DateTime Fecha
);

public record SeguimientoPublicoResponse(
    string Asunto,
    string Descripcion,
    string EstadoCodigo,
    string Estado,
    string Sistema,
    string Prioridad,
    DateTime FechaEnvio,
    IReadOnlyList<MensajePublicoResponse> Mensajes,
    IReadOnlyList<HistorialPublicoResponse> Historial
);

public interface ISolicitudesPublicasRepository
{
    Task<CatalogosPublicosResponse> CatalogosAsync(
        CancellationToken ct
    );

    Task<string> CrearAsync(
        CrearSolicitudPublicaRequest solicitud,
        CancellationToken ct
    );

    Task<SeguimientoPublicoResponse?> ConsultarAsync(
        string codigo,
        CancellationToken ct
    );

    Task<bool> ResponderAsync(
        string codigo,
        string mensaje,
        CancellationToken ct
    );
}
