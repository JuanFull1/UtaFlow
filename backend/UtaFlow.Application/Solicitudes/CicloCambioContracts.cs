using System.ComponentModel.DataAnnotations;

namespace UtaFlow.Application.Solicitudes;

// Implementación del cambio aprobado (unidad 3.2, etapa 4).
public sealed class ImplementacionRequest
{
    [Required, StringLength(50, MinimumLength = 1)]
    public string VersionLiberada { get; set; } = "";

    [StringLength(150)]
    public string? RamaGit { get; set; }

    // Commit, Pull Request o release en GitHub.
    [StringLength(400)]
    [RegularExpression(@"^https?://\S+$", ErrorMessage = "El enlace debe empezar con http:// o https://")]
    public string? EnlaceGit { get; set; }

    [StringLength(2000)]
    public string? Notas { get; set; }
}

// Revisión técnica y auditoría de configuración (unidad 3.3).
public sealed class RevisionRequest
{
    public bool CambioRealizado { get; set; }
    public bool RevisionTecnica { get; set; }
    public bool ProcesoSeguido { get; set; }
    public bool CambioRegistrado { get; set; }
    public bool RelacionadosActualizados { get; set; }

    [StringLength(2000)]
    public string? Observaciones { get; set; }
}

// Cierre con código EXITOSO / FALLIDO / INCOMPLETO (unidad 3.2, etapa 6).
public sealed class CierreRequest
{
    [Required]
    public string Resultado { get; set; } = "";

    [StringLength(1000)]
    public string? Comentario { get; set; }
}
