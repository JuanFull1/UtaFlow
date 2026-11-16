/* ============================================================================
   UtaFlow - 09: Ciclo completo del cambio (unidades 3.2 y 3.3)

   Completa el flujo ITIL después de la aprobación del comité:
     Implementación -> Revisión post-implementación (auditoría) -> Cierre

   - Nuevos estados: EN_IMPLEMENTACION, EN_REVISION, CERRADA
   - Tabla dbo.CicloCambio: implementación (versión liberada y enlace a GitHub),
     auditoría de configuración (6 preguntas de la unidad 3.3) y cierre
     (EXITOSO / FALLIDO / INCOMPLETO).
   - Procedimientos para cada paso y una vista para el reporte de estado.

   Idempotente: se puede ejecutar más de una vez.
   Requiere SET QUOTED_IDENTIFIER ON (usar sqlcmd con -I).
   ============================================================================ */
USE UtaFlow;
GO
SET NOCOUNT ON;
GO

/* ---------------------------------------------------------------------------
   1. Estados nuevos
   --------------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM dbo.Estado WHERE Codigo = 'EN_IMPLEMENTACION')
    INSERT dbo.Estado (Codigo, Nombre, Orden)
    VALUES ('EN_IMPLEMENTACION', N'En implementacion', 6);

IF NOT EXISTS (SELECT 1 FROM dbo.Estado WHERE Codigo = 'EN_REVISION')
    INSERT dbo.Estado (Codigo, Nombre, Orden)
    VALUES ('EN_REVISION', N'En revision post-implementacion', 7);

IF NOT EXISTS (SELECT 1 FROM dbo.Estado WHERE Codigo = 'CERRADA')
    INSERT dbo.Estado (Codigo, Nombre, Orden)
    VALUES ('CERRADA', N'Cerrada', 8);
GO

/* ---------------------------------------------------------------------------
   2. Tabla del ciclo (1:1 con la solicitud)
   --------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.CicloCambio', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CicloCambio
    (
        IdSolicitud INT NOT NULL PRIMARY KEY
            REFERENCES dbo.SolicitudCambio(IdSolicitud),

        -- Implementación (quién aplicó el cambio y qué versión salió)
        IdImplementador INT NULL REFERENCES dbo.Usuario(IdUsuario),
        FechaInicio DATETIME2(0) NULL,
        FechaImplementacion DATETIME2(0) NULL,
        VersionLiberada NVARCHAR(50) NULL,
        RamaGit NVARCHAR(150) NULL,
        EnlaceGit NVARCHAR(400) NULL,       -- commit, Pull Request o release en GitHub
        NotasImplementacion NVARCHAR(2000) NULL,

        -- Revisión técnica y auditoría de configuración (unidad 3.3)
        IdRevisor INT NULL REFERENCES dbo.Usuario(IdUsuario),
        FechaRevision DATETIME2(0) NULL,
        AudCambioRealizado BIT NULL,        -- se hizo lo pedido y nada más
        AudRevisionTecnica BIT NULL,        -- hubo revisión técnica
        AudProcesoSeguido BIT NULL,         -- se siguió el proceso y los estándares
        AudCambioRegistrado BIT NULL,       -- fecha, autor y versión quedaron registrados
        AudRelacionadosActualizados BIT NULL, -- se actualizaron los elementos relacionados
        ObservacionesRevision NVARCHAR(2000) NULL,

        -- Cierre
        ResultadoCierre VARCHAR(12) NULL
            CONSTRAINT CK_CicloCambio_Resultado
            CHECK (ResultadoCierre IN ('EXITOSO', 'FALLIDO', 'INCOMPLETO')),
        FechaCierre DATETIME2(0) NULL,
        IdCierre INT NULL REFERENCES dbo.Usuario(IdUsuario),
        ComentarioCierre NVARCHAR(1000) NULL
    );
END;
GO

/* ---------------------------------------------------------------------------
   3. Iniciar implementación (solo desde APROBADA)
   --------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_IniciarImplementacion
    @IdSolicitud INT,
    @IdUsuario INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.SolicitudCambio s
        JOIN dbo.Estado e ON e.IdEstado = s.IdEstado
        WHERE s.IdSolicitud = @IdSolicitud AND e.Codigo = 'APROBADA'
    )
        THROW 52001, 'Solo se puede implementar una solicitud aprobada.', 1;

    DECLARE @Actor NVARCHAR(150) =
        (SELECT Nombre FROM dbo.Usuario WHERE IdUsuario = @IdUsuario);

    BEGIN TRAN;

    IF NOT EXISTS (SELECT 1 FROM dbo.CicloCambio WHERE IdSolicitud = @IdSolicitud)
        INSERT dbo.CicloCambio (IdSolicitud) VALUES (@IdSolicitud);

    UPDATE dbo.CicloCambio
    SET IdImplementador = @IdUsuario,
        FechaInicio = SYSDATETIME()
    WHERE IdSolicitud = @IdSolicitud;

    EXEC dbo.sp_CambiarEstado
        @IdSolicitud = @IdSolicitud,
        @Codigo = 'EN_IMPLEMENTACION',
        @IdUsuario = @IdUsuario,
        @Actor = @Actor,
        @Comentario = N'Inicio de la implementacion.';

    COMMIT;
END;
GO

/* ---------------------------------------------------------------------------
   4. Registrar implementación terminada (pasa a revisión)
   --------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_RegistrarImplementacion
    @IdSolicitud INT,
    @IdUsuario INT,
    @VersionLiberada NVARCHAR(50),
    @RamaGit NVARCHAR(150) = NULL,
    @EnlaceGit NVARCHAR(400) = NULL,
    @Notas NVARCHAR(2000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.SolicitudCambio s
        JOIN dbo.Estado e ON e.IdEstado = s.IdEstado
        WHERE s.IdSolicitud = @IdSolicitud AND e.Codigo = 'EN_IMPLEMENTACION'
    )
        THROW 52002, 'La solicitud no esta en implementacion.', 1;

    IF NULLIF(LTRIM(RTRIM(@VersionLiberada)), N'') IS NULL
        THROW 52003, 'Indica la version liberada.', 1;

    DECLARE @Actor NVARCHAR(150) =
        (SELECT Nombre FROM dbo.Usuario WHERE IdUsuario = @IdUsuario);

    BEGIN TRAN;

    UPDATE dbo.CicloCambio
    SET IdImplementador = @IdUsuario,
        FechaImplementacion = SYSDATETIME(),
        VersionLiberada = LTRIM(RTRIM(@VersionLiberada)),
        RamaGit = NULLIF(LTRIM(RTRIM(@RamaGit)), N''),
        EnlaceGit = NULLIF(LTRIM(RTRIM(@EnlaceGit)), N''),
        NotasImplementacion = NULLIF(LTRIM(RTRIM(@Notas)), N'')
    WHERE IdSolicitud = @IdSolicitud;

    EXEC dbo.sp_CambiarEstado
        @IdSolicitud = @IdSolicitud,
        @Codigo = 'EN_REVISION',
        @IdUsuario = @IdUsuario,
        @Actor = @Actor,
        @Comentario = N'Implementacion terminada. Version liberada registrada.';

    COMMIT;
END;
GO

/* ---------------------------------------------------------------------------
   5. Registrar revisión técnica y auditoría de configuración
   --------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_RegistrarRevision
    @IdSolicitud INT,
    @IdUsuario INT,
    @CambioRealizado BIT,
    @RevisionTecnica BIT,
    @ProcesoSeguido BIT,
    @CambioRegistrado BIT,
    @RelacionadosActualizados BIT,
    @Observaciones NVARCHAR(2000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.SolicitudCambio s
        JOIN dbo.Estado e ON e.IdEstado = s.IdEstado
        WHERE s.IdSolicitud = @IdSolicitud AND e.Codigo = 'EN_REVISION'
    )
        THROW 52004, 'La solicitud no esta en revision.', 1;

    UPDATE dbo.CicloCambio
    SET IdRevisor = @IdUsuario,
        FechaRevision = SYSDATETIME(),
        AudCambioRealizado = @CambioRealizado,
        AudRevisionTecnica = @RevisionTecnica,
        AudProcesoSeguido = @ProcesoSeguido,
        AudCambioRegistrado = @CambioRegistrado,
        AudRelacionadosActualizados = @RelacionadosActualizados,
        ObservacionesRevision = NULLIF(LTRIM(RTRIM(@Observaciones)), N'')
    WHERE IdSolicitud = @IdSolicitud;
END;
GO

/* ---------------------------------------------------------------------------
   6. Cerrar el cambio con su código de cierre
   --------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_CerrarCambio
    @IdSolicitud INT,
    @IdUsuario INT,
    @Resultado VARCHAR(12),
    @Comentario NVARCHAR(1000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.SolicitudCambio s
        JOIN dbo.Estado e ON e.IdEstado = s.IdEstado
        WHERE s.IdSolicitud = @IdSolicitud AND e.Codigo = 'EN_REVISION'
    )
        THROW 52004, 'La solicitud no esta en revision.', 1;

    IF @Resultado NOT IN ('EXITOSO', 'FALLIDO', 'INCOMPLETO')
        THROW 52005, 'Resultado de cierre invalido.', 1;

    IF NOT EXISTS (
        SELECT 1 FROM dbo.CicloCambio
        WHERE IdSolicitud = @IdSolicitud AND FechaRevision IS NOT NULL
    )
        THROW 52006, 'Registra primero la revision y auditoria.', 1;

    IF @Resultado <> 'EXITOSO'
       AND NULLIF(LTRIM(RTRIM(@Comentario)), N'') IS NULL
        THROW 52007, 'Explica por que el cambio no fue exitoso.', 1;

    DECLARE @Actor NVARCHAR(150) =
        (SELECT Nombre FROM dbo.Usuario WHERE IdUsuario = @IdUsuario);

    BEGIN TRAN;

    UPDATE dbo.CicloCambio
    SET ResultadoCierre = @Resultado,
        FechaCierre = SYSDATETIME(),
        IdCierre = @IdUsuario,
        ComentarioCierre = NULLIF(LTRIM(RTRIM(@Comentario)), N'')
    WHERE IdSolicitud = @IdSolicitud;

    DECLARE @Texto NVARCHAR(500) = N'Cambio cerrado: ' + @Resultado + N'.';

    EXEC dbo.sp_CambiarEstado
        @IdSolicitud = @IdSolicitud,
        @Codigo = 'CERRADA',
        @IdUsuario = @IdUsuario,
        @Actor = @Actor,
        @Comentario = @Texto;

    COMMIT;
END;
GO

/* ---------------------------------------------------------------------------
   7. Reporte de estado (unidad 3.3): ¿qué ocurrió, quién, cuándo, qué se afecta?
   --------------------------------------------------------------------------- */
CREATE OR ALTER VIEW dbo.vw_ReporteEstado
AS
SELECT
    s.IdSolicitud,
    s.Codigo,
    s.Asunto,
    sis.Nombre AS Sistema,
    s.ModuloAfectado AS Modulo,
    tc.Nombre AS TipoCambio,
    p.Nombre AS Prioridad,
    e.Codigo AS EstadoCodigo,
    e.Nombre AS Estado,
    s.FechaEnvio,
    (SELECT MAX(h.Fecha) FROM dbo.HistorialEstado h
      WHERE h.IdSolicitud = s.IdSolicitud) AS UltimoMovimiento,
    (SELECT TOP (1) COALESCE(h.Actor, N'Solicitante')
       FROM dbo.HistorialEstado h
      WHERE h.IdSolicitud = s.IdSolicitud
      ORDER BY h.Fecha DESC, h.IdHistorial DESC) AS UltimoActor,
    s.ComponentesAfectados,
    c.VersionLiberada,
    c.RamaGit,
    c.EnlaceGit,
    c.FechaImplementacion,
    c.ResultadoCierre,
    c.FechaCierre
FROM dbo.SolicitudCambio s
JOIN dbo.Estado e ON e.IdEstado = s.IdEstado
JOIN dbo.Sistema sis ON sis.IdSistema = s.IdSistema
JOIN dbo.TipoCambio tc ON tc.IdTipoCambio = s.IdTipoCambio
JOIN dbo.Prioridad p ON p.IdPrioridad = s.IdPrioridad
LEFT JOIN dbo.CicloCambio c ON c.IdSolicitud = s.IdSolicitud;
GO

SELECT Codigo, Nombre, Orden FROM dbo.Estado ORDER BY Orden;
PRINT 'UtaFlow: ciclo de implementacion, auditoria y cierre aplicado.';
GO
