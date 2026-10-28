using System.ComponentModel.DataAnnotations;

namespace UtaFlow.Application.Solicitudes;

public sealed class NuevaSolicitudInternaRequest
{
    [Required, StringLength(200)]
    public string Asunto { get; set; } = "";

    [Required, StringLength(4000, MinimumLength = 10)]
    public string Descripcion { get; set; } = "";

    [Required, StringLength(500)]
    public string Razon { get; set; } = "";

    [Range(1, int.MaxValue)]
    public int IdSistema { get; set; }

    [Range(1, 255)]
    public int IdPrioridad { get; set; }

    [Required]
    public string CodigoTipoCambio { get; set; } = "NORMAL";

    [StringLength(150)]
    public string? EmpresaArea { get; set; }

    [StringLength(150)]
    public string? ModuloAfectado { get; set; }

    [StringLength(50)]
    public string? VersionSoftware { get; set; }

    [StringLength(1000)]
    public string? AfectacionActual { get; set; }

    [StringLength(1000)]
    public string? ComentariosAdicionales { get; set; }

    public DateOnly? FechaLimite { get; set; }

    [StringLength(20)]
    public string? TipoMantenimiento { get; set; }

    [StringLength(600)]
    public string? ComponentesAfectados { get; set; }

    [StringLength(600)]
    public string? ComponentesAsociados { get; set; }

    [StringLength(2000)]
    public string? EstadoDeseado { get; set; }

    [StringLength(1000)]
    public string? ConsecuenciaNoHacer { get; set; }

    [Range(1, 3)]
    public int? IdImpacto { get; set; }

    [Range(1, 3)]
    public int? Urgencia { get; set; }

    [StringLength(1000)]
    public string? RiesgosIniciales { get; set; }

    [StringLength(300)]
    public string? UsuariosAfectados { get; set; }

    [Range(typeof(decimal), "0", "9999999999.99")]
    public decimal? CostoEstimadoSolicitado { get; set; }

    [StringLength(1000)]
    public string? DependenciasPrevias { get; set; }

    [StringLength(1000)]
    public string? ArchivosSugeridos { get; set; }

    [StringLength(150)]
    public string? RamaSugerida { get; set; }
}

public sealed record SolicitudInternaCreada(int Id, string Codigo);

public sealed class EvaluacionInternaRequest
{
    public string? EspecificacionTecnica { get; set; }
    public string? AnalisisImpacto { get; set; }

    [StringLength(300)]
    public string? ServiciosAfectados { get; set; }

    public string? Riesgos { get; set; }

    [Range(0, 99999)]
    public decimal? HorasEstimadas { get; set; }

    public bool BdAfectada { get; set; }
    public string? PlanRollout { get; set; }
    public string? PlanBackout { get; set; }
    public string? PlanPruebas { get; set; }
    public string? CriteriosAceptacion { get; set; }
    public string? Sugerencia { get; set; }

    [Required]
    public string Recomendacion { get; set; } = "";

    public string CodigoTipoCambio { get; set; } = "NORMAL";
    public int? IdImpacto { get; set; }

    [StringLength(20)]
    public string? TipoMantenimiento { get; set; }

    [StringLength(600)]
    public string? ComponentesAfectados { get; set; }

    public string? ArchivosPrevistos { get; set; }

    [Range(typeof(decimal), "0", "9999999999.99")]
    public decimal? CostoEstimado { get; set; }

    [StringLength(150)]
    public string? RamaGit { get; set; }

    [StringLength(30)]
    public string? AmbientePrevisto { get; set; }

    [StringLength(300)]
    public string? EstrategiaDespliegue { get; set; }

    [StringLength(1000)]
    public string? ConsecuenciaNoHacer { get; set; }
}

public sealed class VotoInternoRequest
{
    [Required]
    public string Voto { get; set; } = "";

    [StringLength(500)]
    public string? Comentario { get; set; }
}

public sealed class DevolucionInternaRequest
{
    [Required]
    public string Destino { get; set; } = "";

    [Required, StringLength(500, MinimumLength = 2)]
    public string Mensaje { get; set; } = "";
}

public sealed class DecisionComiteRequest
{
    [Required]
    public string Resultado { get; set; } = "";

    [Required, StringLength(2000, MinimumLength = 10)]
    public string Justificacion { get; set; } = "";

    [StringLength(2000)]
    public string? Condiciones { get; set; }

    [StringLength(50)]
    public string? VersionPrevista { get; set; }
}

public interface ISolicitudesInternasRepository
{
    Task<IReadOnlyList<Dictionary<string, object?>>> ListarAsync(CancellationToken ct);
    Task<object?> DetalleAsync(int idSolicitud, CancellationToken ct);
    Task<SolicitudInternaCreada> CrearAsync(
        NuevaSolicitudInternaRequest datos,
        int idUsuario,
        CancellationToken ct
    );
    Task<bool> GuardarAnalisisAsync(
        int idSolicitud, int idUsuario,
        EvaluacionInternaRequest datos, CancellationToken ct
    );
    Task<bool> EnviarAlComiteAsync(
        int idSolicitud, int idUsuario, CancellationToken ct
    );
    Task<object> VotarAsync(
        int idSolicitud, int idUsuario,
        VotoInternoRequest datos, CancellationToken ct
    );
    Task<bool> DevolverAsync(
        int idSolicitud, int idUsuario, string rol,
        DevolucionInternaRequest datos, CancellationToken ct
    );
    Task<object> FormalizarDecisionAsync(
        int idSolicitud, int idUsuario,
        DecisionComiteRequest datos, CancellationToken ct
    );
    Task<int?> GuardarAdjuntoInternoAsync(
        int idSolicitud, int idUsuario, string nombreOriginal,
        string nombreInterno, string tipoMime, long tamanoBytes,
        CancellationToken ct
    );
    Task<(string Ruta, string Nombre, string Tipo)?> ObtenerAdjuntoAsync(
        int idSolicitud, int idAdjunto, CancellationToken ct
    );
}
