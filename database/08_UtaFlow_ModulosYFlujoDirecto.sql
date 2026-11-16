/* ============================================================================
   UtaFlow | Ajustes de formularios y flujo

   1) Catalogo de modulos por sistema (para listar los modulos existentes).
   2) Toda solicitud llega DIRECTO al comite (estado EN_COMITE).
      El analisis del experto pasa a ser un apoyo opcional.
   3) El estado deseado tambien se registra desde el formulario publico.

   REQUISITO: haber ejecutado los scripts 01 a 07.
   Se puede ejecutar de nuevo: comprueba tablas, datos y procedimientos.
   No elimina datos ni columnas existentes.
   ============================================================================ */
USE UtaFlow;
GO
SET XACT_ABORT ON;
GO

/* ---------------------------------------------------------------------------
   1. Catalogo de modulos por sistema
   --------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.ModuloSistema', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ModuloSistema
    (
        IdModulo  INT IDENTITY(1,1) PRIMARY KEY,
        IdSistema INT NOT NULL
            REFERENCES dbo.Sistema(IdSistema),
        Nombre    NVARCHAR(120) NOT NULL,
        Activo    BIT NOT NULL
            CONSTRAINT DF_ModuloSistema_Activo DEFAULT (1),
        CONSTRAINT UQ_ModuloSistema UNIQUE (IdSistema, Nombre)
    );
END;
GO

/* Sistemas que usaran el control de cambios. */
IF NOT EXISTS (SELECT 1 FROM dbo.Sistema WHERE Nombre = N'EcuaRutas')
    INSERT dbo.Sistema (Nombre) VALUES (N'EcuaRutas');

IF NOT EXISTS (SELECT 1 FROM dbo.Sistema WHERE Nombre = N'UtaFlow')
    INSERT dbo.Sistema (Nombre) VALUES (N'UtaFlow');
GO

/* Modulos de ejemplo. EDITAR segun los modulos reales de cada proyecto:
   para agregar uno nuevo basta un INSERT con el IdSistema y el nombre. */
INSERT dbo.ModuloSistema (IdSistema, Nombre)
SELECT s.IdSistema, m.Nombre
FROM dbo.Sistema s
JOIN (VALUES
    (N'EcuaRutas', N'Autenticación y usuarios'),
    (N'EcuaRutas', N'Rutas y paradas'),
    (N'EcuaRutas', N'Mapas y ubicación'),
    (N'EcuaRutas', N'Reservas y pasajes'),
    (N'EcuaRutas', N'Pagos'),
    (N'EcuaRutas', N'Reportes'),
    (N'EcuaRutas', N'Administración'),
    (N'UtaFlow',   N'Inicio de sesión'),
    (N'UtaFlow',   N'Solicitud pública'),
    (N'UtaFlow',   N'Seguimiento de solicitudes'),
    (N'UtaFlow',   N'Tablero del experto'),
    (N'UtaFlow',   N'Decisión del comité'),
    (N'UtaFlow',   N'Administración de usuarios')
) AS m(Sistema, Nombre) ON m.Sistema = s.Nombre
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.ModuloSistema x
    WHERE x.IdSistema = s.IdSistema AND x.Nombre = m.Nombre
);
GO

/* ---------------------------------------------------------------------------
   2. Cambio de estado.
      La ronda aumenta cuando una solicitud VUELVE al comite despues de que
      el comite ya voto o decidio en la ronda actual, para no reutilizar votos.
   --------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_CambiarEstado
    @IdSolicitud INT,
    @Codigo VARCHAR(20),
    @IdUsuario INT = NULL,
    @Actor NVARCHAR(150) = NULL,
    @Comentario NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IdEstado TINYINT =
        (SELECT IdEstado FROM dbo.Estado WHERE Codigo = @Codigo);

    IF @IdEstado IS NULL
        THROW 50001, 'Estado inexistente.', 1;

    DECLARE @NuevaRonda BIT = 0;

    IF @Codigo = 'EN_COMITE'
       AND (
            EXISTS (
                SELECT 1
                FROM dbo.VotoComite v
                JOIN dbo.SolicitudCambio s
                  ON s.IdSolicitud = v.IdSolicitud
                 AND s.Ronda = v.Ronda
                WHERE v.IdSolicitud = @IdSolicitud
            )
            OR EXISTS (
                SELECT 1
                FROM dbo.DecisionComite d
                JOIN dbo.SolicitudCambio s
                  ON s.IdSolicitud = d.IdSolicitud
                 AND s.Ronda = d.Ronda
                WHERE d.IdSolicitud = @IdSolicitud
            )
       )
        SET @NuevaRonda = 1;

    UPDATE dbo.SolicitudCambio
    SET IdEstado = @IdEstado,
        Ronda = CASE WHEN @NuevaRonda = 1 THEN Ronda + 1 ELSE Ronda END,
        FechaDecision = CASE
            WHEN @Codigo IN ('APROBADA', 'RECHAZADA')
                THEN SYSDATETIME()
            ELSE FechaDecision
        END
    WHERE IdSolicitud = @IdSolicitud;

    INSERT dbo.HistorialEstado
        (IdSolicitud, IdEstado, IdUsuario, Actor, Comentario)
    VALUES
        (@IdSolicitud, @IdEstado, @IdUsuario, @Actor, @Comentario);
END;
GO

/* ---------------------------------------------------------------------------
   3. Crear solicitud: nace directamente EN_COMITE y acepta EstadoDeseado.
   --------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_CrearSolicitud
    @Asunto NVARCHAR(200), @Descripcion NVARCHAR(MAX),
    @IdSistema INT, @IdPrioridad TINYINT,
    @Razon NVARCHAR(500) = NULL, @FechaLimite DATE = NULL,
    @IdSolicitante INT = NULL,
    @SolicitanteNombre NVARCHAR(150) = NULL,
    @SolicitanteCorreo NVARCHAR(200) = NULL,
    @CodigoTipoCambio VARCHAR(20) = 'NORMAL',
    @IdSolicitudOrigen INT = NULL,
    @EmpresaArea NVARCHAR(150) = NULL,
    @ModuloAfectado NVARCHAR(150) = NULL,
    @VersionSoftware NVARCHAR(50) = NULL,
    @SolicitanteTelefono NVARCHAR(30) = NULL,
    @AfectacionActual NVARCHAR(1000) = NULL,
    @ComentariosAdicionales NVARCHAR(1000) = NULL,
    @EstadoDeseado NVARCHAR(2000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Origen VARCHAR(10) = 'PUBLICO',
            @Id INT,
            @IdTipo TINYINT = (SELECT IdTipoCambio
                               FROM dbo.TipoCambio
                               WHERE Codigo = @CodigoTipoCambio),
            @IdEstado TINYINT = (SELECT IdEstado
                                 FROM dbo.Estado
                                 WHERE Codigo = 'EN_COMITE'),
            @CodigoNuevo VARCHAR(40);

    IF @IdTipo IS NULL
        THROW 50002, 'Tipo de cambio invalido.', 1;

    IF @IdSolicitante IS NOT NULL
    BEGIN
        SELECT @Origen = CASE r.Codigo
                             WHEN 'COMITE' THEN 'COMITE'
                             ELSE 'EXPERTO'
                         END
        FROM dbo.Usuario u
        JOIN dbo.Rol r ON r.IdRol = u.IdRol
        WHERE u.IdUsuario = @IdSolicitante AND u.Activo = 1;

        IF @@ROWCOUNT = 0
            THROW 50003, 'Usuario inexistente o inactivo.', 1;
    END;

    IF @IdSolicitudOrigen IS NOT NULL AND @Origen = 'PUBLICO'
        THROW 50004, 'Solo experto o comite pueden crear solicitud derivada.', 1;

    /* Codigo aleatorio de 96 bits (no se usa RFC-0001). */
    SET @CodigoNuevo = 'RFC-' + CONVERT(VARCHAR(4), YEAR(SYSDATETIME())) + '-'
                       + CONVERT(VARCHAR(24), CRYPT_GEN_RANDOM(12), 2);

    BEGIN TRAN;
    INSERT dbo.SolicitudCambio
        (Asunto, Descripcion, Razon, IdSistema, IdPrioridad, FechaLimite,
         IdSolicitante, SolicitanteNombre, SolicitanteCorreo,
         Origen, IdSolicitudOrigen, IdTipoCambio, IdEstado,
         EmpresaArea, ModuloAfectado, VersionSoftware, SolicitanteTelefono,
         AfectacionActual, ComentariosAdicionales, EstadoDeseado,
         CodigoSeguimiento)
    VALUES
        (@Asunto, @Descripcion, @Razon, @IdSistema, @IdPrioridad, @FechaLimite,
         @IdSolicitante, @SolicitanteNombre, @SolicitanteCorreo,
         @Origen, @IdSolicitudOrigen, @IdTipo, @IdEstado,
         @EmpresaArea, @ModuloAfectado, @VersionSoftware, @SolicitanteTelefono,
         @AfectacionActual, @ComentariosAdicionales, @EstadoDeseado,
         @CodigoNuevo);

    SET @Id = CONVERT(INT, SCOPE_IDENTITY());

    INSERT dbo.HistorialEstado (IdSolicitud, IdEstado, IdUsuario, Actor)
    VALUES (@Id, @IdEstado, @IdSolicitante,
            CASE WHEN @IdSolicitante IS NULL THEN @SolicitanteNombre END);
    COMMIT;

    SELECT IdSolicitud, CodigoSeguimiento AS Codigo
    FROM dbo.SolicitudCambio
    WHERE IdSolicitud = @Id;
END;
GO

/* ---------------------------------------------------------------------------
   4. Comprobaciones
   --------------------------------------------------------------------------- */
SELECT s.Nombre AS Sistema, COUNT(m.IdModulo) AS Modulos
FROM dbo.Sistema s
LEFT JOIN dbo.ModuloSistema m ON m.IdSistema = s.IdSistema AND m.Activo = 1
GROUP BY s.Nombre
ORDER BY s.Nombre;
GO
PRINT 'UtaFlow: modulos por sistema y flujo directo al comite aplicados.';
GO
