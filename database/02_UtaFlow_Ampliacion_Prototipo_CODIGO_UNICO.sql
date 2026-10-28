/* ============================================================================
   UtaFlow | APE-03 | Ampliacion del prototipo: SOLO CODIGO de seguimiento

   REQUISITO: haber ejecutado una vez database/01_UtaFlow_Estructura.sql.
   Compatible con SQL Server. No elimina tablas ni datos existentes.
   Puede ejecutarse de nuevo: comprueba columnas, tablas, indices y estados.

   PUBLICO: un solo codigo aleatorio, p.ej.
       RFC-2026-A83F72B19C04D6E52F8A7B30
   No se genera ni se solicita token adicional.
   El codigo original calculado (RFC-0001, etc.) queda solo como referencia
   interna: la API y el frontend deben mostrar exclusivamente CodigoSeguimiento.

   IMPORTANTE: este codigo es una credencial de acceso a la solicitud.
   Guardarlo en privado, limitar consultas/intentos desde la API y no revelar
   informacion de otras solicitudes. Nunca usar el ID o codigo secuencial
   para autorizar una consulta publica.

   Este script agrega estructura y adapta sp_CrearSolicitud. La API aun debe
   implementar consulta, mensajes y adjuntos con permisos y validaciones.
   ============================================================================ */
IF DB_ID(N'UtaFlow') IS NULL
    THROW 51000, 'Primero ejecute 01_UtaFlow_Estructura.sql para crear UtaFlow.', 1;
GO
USE UtaFlow;
GO

/* 1. Campos utiles para el formulario publico */
IF COL_LENGTH('dbo.SolicitudCambio', 'EmpresaArea') IS NULL
    ALTER TABLE dbo.SolicitudCambio ADD EmpresaArea NVARCHAR(150) NULL;
GO
IF COL_LENGTH('dbo.SolicitudCambio', 'ModuloAfectado') IS NULL
    ALTER TABLE dbo.SolicitudCambio ADD ModuloAfectado NVARCHAR(150) NULL;
GO
IF COL_LENGTH('dbo.SolicitudCambio', 'VersionSoftware') IS NULL
    ALTER TABLE dbo.SolicitudCambio ADD VersionSoftware NVARCHAR(50) NULL;
GO
IF COL_LENGTH('dbo.SolicitudCambio', 'SolicitanteTelefono') IS NULL
    ALTER TABLE dbo.SolicitudCambio ADD SolicitanteTelefono NVARCHAR(30) NULL;
GO
IF COL_LENGTH('dbo.SolicitudCambio', 'AfectacionActual') IS NULL
    ALTER TABLE dbo.SolicitudCambio ADD AfectacionActual NVARCHAR(1000) NULL;
GO
IF COL_LENGTH('dbo.SolicitudCambio', 'ComentariosAdicionales') IS NULL
    ALTER TABLE dbo.SolicitudCambio ADD ComentariosAdicionales NVARCHAR(1000) NULL;
GO

/* 2. Codigo de seguimiento UNICO Y ALEATORIO en la propia solicitud.
      12 bytes aleatorios = 96 bits; no deriva del IdSolicitud. */
IF COL_LENGTH('dbo.SolicitudCambio', 'CodigoSeguimiento') IS NULL
    ALTER TABLE dbo.SolicitudCambio ADD CodigoSeguimiento VARCHAR(40) NULL;
GO

/* Dar un codigo a las solicitudes ya existentes, si las hay */
UPDATE dbo.SolicitudCambio
SET CodigoSeguimiento = 'RFC-' + CONVERT(VARCHAR(4), YEAR(FechaEnvio)) + '-'
                      + CONVERT(VARCHAR(24), CRYPT_GEN_RANDOM(12), 2)
WHERE CodigoSeguimiento IS NULL;
GO

/* Para futuras solicitudes, el procedimiento asigna siempre un codigo */
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.SolicitudCambio')
      AND name = 'CodigoSeguimiento' AND is_nullable = 1
)
    ALTER TABLE dbo.SolicitudCambio ALTER COLUMN CodigoSeguimiento VARCHAR(40) NOT NULL;
GO
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.SolicitudCambio')
      AND name = 'UX_SolicitudCambio_CodigoSeguimiento'
)
    CREATE UNIQUE INDEX UX_SolicitudCambio_CodigoSeguimiento
      ON dbo.SolicitudCambio(CodigoSeguimiento);
GO

/* 3. Campos de la evaluacion tecnica */
IF COL_LENGTH('dbo.AnalisisTecnico', 'Riesgos') IS NULL
    ALTER TABLE dbo.AnalisisTecnico ADD Riesgos NVARCHAR(MAX) NULL;
GO
IF COL_LENGTH('dbo.AnalisisTecnico', 'PlanPruebas') IS NULL
    ALTER TABLE dbo.AnalisisTecnico ADD PlanPruebas NVARCHAR(MAX) NULL;
GO
IF COL_LENGTH('dbo.AnalisisTecnico', 'CriteriosAceptacion') IS NULL
    ALTER TABLE dbo.AnalisisTecnico ADD CriteriosAceptacion NVARCHAR(MAX) NULL;
GO

/* 4. Estados para pedir correcciones */
IF NOT EXISTS (SELECT 1 FROM dbo.Estado WHERE Codigo = 'PENDIENTE_CLIENTE')
    INSERT dbo.Estado (Codigo, Nombre, Orden)
    VALUES ('PENDIENTE_CLIENTE', N'Esperando informacion del solicitante', 6);
GO
IF NOT EXISTS (SELECT 1 FROM dbo.Estado WHERE Codigo = 'PENDIENTE_EXPERTO')
    INSERT dbo.Estado (Codigo, Nombre, Orden)
    VALUES ('PENDIENTE_EXPERTO', N'Esperando correccion del experto', 7);
GO

/* 5. Mensajes entre solicitante y equipo (sin tokens) */
IF OBJECT_ID('dbo.SolicitudMensaje', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SolicitudMensaje (
        IdMensaje INT IDENTITY(1,1) NOT NULL,
        IdSolicitud INT NOT NULL,
        IdUsuario INT NULL,
        Emisor VARCHAR(10) NOT NULL,
        Mensaje NVARCHAR(2000) NOT NULL,
        VisibleParaSolicitante BIT NOT NULL
            CONSTRAINT DF_SolicitudMensaje_Visible DEFAULT (1),
        Fecha DATETIME2(0) NOT NULL
            CONSTRAINT DF_SolicitudMensaje_Fecha DEFAULT SYSDATETIME(),
        CONSTRAINT PK_SolicitudMensaje PRIMARY KEY (IdMensaje),
        CONSTRAINT FK_SolicitudMensaje_Solicitud
            FOREIGN KEY (IdSolicitud) REFERENCES dbo.SolicitudCambio(IdSolicitud),
        CONSTRAINT FK_SolicitudMensaje_Usuario
            FOREIGN KEY (IdUsuario) REFERENCES dbo.Usuario(IdUsuario),
        CONSTRAINT CK_SolicitudMensaje_Emisor
            CHECK (Emisor IN ('PUBLICO', 'EXPERTO', 'COMITE'))
    );
END;
GO
IF COL_LENGTH('dbo.SolicitudMensaje', 'VisibleParaSolicitante') IS NULL
    ALTER TABLE dbo.SolicitudMensaje ADD VisibleParaSolicitante BIT NOT NULL
        CONSTRAINT DF_SolicitudMensaje_Visible DEFAULT (1) WITH VALUES;
GO
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.SolicitudMensaje')
      AND name = 'IX_SolicitudMensaje_Solicitud_Fecha'
)
    CREATE INDEX IX_SolicitudMensaje_Solicitud_Fecha
      ON dbo.SolicitudMensaje(IdSolicitud, Fecha, IdMensaje);
GO

/* 6. Metadatos de archivos adjuntos; no guardar archivos en carpeta publica */
IF OBJECT_ID('dbo.SolicitudAdjunto', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SolicitudAdjunto (
        IdAdjunto INT IDENTITY(1,1) NOT NULL,
        IdSolicitud INT NOT NULL,
        NombreOriginal NVARCHAR(255) NOT NULL,
        RutaInterna NVARCHAR(500) NOT NULL,
        TipoMime NVARCHAR(100) NOT NULL,
        TamanoBytes BIGINT NOT NULL,
        FechaCarga DATETIME2(0) NOT NULL
            CONSTRAINT DF_SolicitudAdjunto_Fecha DEFAULT SYSDATETIME(),
        CONSTRAINT PK_SolicitudAdjunto PRIMARY KEY (IdAdjunto),
        CONSTRAINT FK_SolicitudAdjunto_Solicitud
            FOREIGN KEY (IdSolicitud) REFERENCES dbo.SolicitudCambio(IdSolicitud),
        CONSTRAINT CK_SolicitudAdjunto_Tamano CHECK (TamanoBytes > 0)
    );
END;
GO
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.SolicitudAdjunto')
      AND name = 'IX_SolicitudAdjunto_Solicitud'
)
    CREATE INDEX IX_SolicitudAdjunto_Solicitud
      ON dbo.SolicitudAdjunto(IdSolicitud);
GO

/* 7. Conservar los parametros originales y agregar campos opcionales.
      Se devuelve el UNICO codigo que vera el cliente como columna 'Codigo'. */
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
    @ComentariosAdicionales NVARCHAR(1000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Origen VARCHAR(10) = 'PUBLICO',
            @Id INT,
            @IdTipo TINYINT = (SELECT IdTipoCambio
                               FROM dbo.TipoCambio WHERE Codigo = @CodigoTipoCambio),
            @IdEstado TINYINT = (SELECT IdEstado
                                 FROM dbo.Estado WHERE Codigo = 'ENVIADA'),
            @CodigoNuevo VARCHAR(40);

    IF @IdTipo IS NULL
        THROW 50002, 'Tipo de cambio invalido.', 1;

    IF @IdSolicitante IS NOT NULL
    BEGIN
        SELECT @Origen = CASE r.Codigo WHEN 'COMITE' THEN 'COMITE' ELSE 'EXPERTO' END
        FROM dbo.Usuario u
        JOIN dbo.Rol r ON r.IdRol = u.IdRol
        WHERE u.IdUsuario = @IdSolicitante AND u.Activo = 1;

        IF @@ROWCOUNT = 0
            THROW 50003, 'Usuario inexistente o inactivo.', 1;
    END;

    IF @IdSolicitudOrigen IS NOT NULL AND @Origen = 'PUBLICO'
        THROW 50004, 'Solo experto o comite pueden crear solicitud derivada.', 1;

    /* No usar RFC-0001: codigo aleatorio de 96 bits. */
    SET @CodigoNuevo = 'RFC-' + CONVERT(VARCHAR(4), YEAR(SYSDATETIME())) + '-'
                       + CONVERT(VARCHAR(24), CRYPT_GEN_RANDOM(12), 2);

    BEGIN TRAN;
    INSERT dbo.SolicitudCambio
        (Asunto, Descripcion, Razon, IdSistema, IdPrioridad, FechaLimite,
         IdSolicitante, SolicitanteNombre, SolicitanteCorreo,
         Origen, IdSolicitudOrigen, IdTipoCambio, IdEstado,
         EmpresaArea, ModuloAfectado, VersionSoftware, SolicitanteTelefono,
         AfectacionActual, ComentariosAdicionales, CodigoSeguimiento)
    VALUES
        (@Asunto, @Descripcion, @Razon, @IdSistema, @IdPrioridad, @FechaLimite,
         @IdSolicitante, @SolicitanteNombre, @SolicitanteCorreo,
         @Origen, @IdSolicitudOrigen, @IdTipo, @IdEstado,
         @EmpresaArea, @ModuloAfectado, @VersionSoftware, @SolicitanteTelefono,
         @AfectacionActual, @ComentariosAdicionales, @CodigoNuevo);

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

/* 8. Comprobaciones: 10 nuevas columnas, 7 estados, 2 nuevas tablas.
      Total esperado: 14 tablas (12 originales + 2 nuevas). */
SELECT t.name AS Tabla, c.name AS Campo
FROM sys.columns c
JOIN sys.tables t ON t.object_id = c.object_id
WHERE (t.name = 'SolicitudCambio' AND c.name IN
       ('EmpresaArea','ModuloAfectado','VersionSoftware',
        'SolicitanteTelefono','AfectacionActual','ComentariosAdicionales',
        'CodigoSeguimiento'))
   OR (t.name = 'AnalisisTecnico' AND c.name IN
       ('Riesgos','PlanPruebas','CriteriosAceptacion'))
ORDER BY t.name, c.name;

SELECT Codigo, Nombre FROM dbo.Estado ORDER BY Orden;

SELECT name AS TablaNueva FROM sys.tables
WHERE name IN ('SolicitudMensaje', 'SolicitudAdjunto')
ORDER BY name;
GO
PRINT 'UtaFlow ampliada. Verificar: 10 columnas, 7 estados, 2 tablas nuevas.';
GO
