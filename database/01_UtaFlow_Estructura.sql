/* =====================================================================
   UtaFlow - Control de cambios (version corta para la APE)  | SQL Server
   Alcance: solicitud -> analisis del experto -> decision del comite.

   - Usuario final: NO inicia sesion (nombre y correo).
   - Experto y Comite: SI inician sesion. Los tres pueden solicitar cambios.
   - El experto agrega analisis y sugerencia; ambos van al comite, que
     aprueba, rechaza o pide modificacion.
   ===================================================================== */
IF DB_ID(N'UtaFlow') IS NULL CREATE DATABASE UtaFlow;
GO
USE UtaFlow;
GO

/* ---------- Catalogos ---------- */
CREATE TABLE dbo.Rol (
    IdRol  TINYINT IDENTITY(1,1) PRIMARY KEY,
    Codigo VARCHAR(20) NOT NULL UNIQUE,
    Nombre NVARCHAR(60) NOT NULL
);
CREATE TABLE dbo.TipoCambio (            -- ITIL
    IdTipoCambio TINYINT IDENTITY(1,1) PRIMARY KEY,
    Codigo VARCHAR(20) NOT NULL UNIQUE,
    Nombre NVARCHAR(60) NOT NULL
);
CREATE TABLE dbo.Prioridad (
    IdPrioridad TINYINT IDENTITY(1,1) PRIMARY KEY,
    Nombre NVARCHAR(30) NOT NULL UNIQUE
);
CREATE TABLE dbo.NivelImpacto (
    IdNivel TINYINT IDENTITY(1,1) PRIMARY KEY,
    Nombre NVARCHAR(30) NOT NULL UNIQUE
);
CREATE TABLE dbo.Estado (
    IdEstado TINYINT IDENTITY(1,1) PRIMARY KEY,
    Codigo VARCHAR(20) NOT NULL UNIQUE,
    Nombre NVARCHAR(60) NOT NULL,
    Orden  TINYINT NOT NULL
);
CREATE TABLE dbo.Sistema (
    IdSistema INT IDENTITY(1,1) PRIMARY KEY,
    Nombre NVARCHAR(120) NOT NULL UNIQUE
);
GO

/* ---------- Usuarios (experto y comite con sesion) ---------- */
CREATE TABLE dbo.Usuario (
    IdUsuario INT IDENTITY(1,1) PRIMARY KEY,
    Nombre    NVARCHAR(150) NOT NULL,
    Correo    NVARCHAR(200) NOT NULL UNIQUE,
    ClaveHash NVARCHAR(255) NOT NULL,
    IdRol     TINYINT NOT NULL REFERENCES dbo.Rol(IdRol),
    Activo    BIT NOT NULL DEFAULT 1
);
CREATE TABLE dbo.ComiteMiembro (
    IdUsuario INT PRIMARY KEY REFERENCES dbo.Usuario(IdUsuario),
    Activo    BIT NOT NULL DEFAULT 1
);
GO

/* ---------- Solicitud de cambio ---------- */
CREATE TABLE dbo.SolicitudCambio (
    IdSolicitud   INT IDENTITY(1,1) PRIMARY KEY,
    Codigo AS ('RFC-' + RIGHT('0000' + CAST(IdSolicitud AS VARCHAR(10)), 4)) PERSISTED,

    -- formulario simple (quien solicita)
    Asunto        NVARCHAR(200) NOT NULL,
    Descripcion   NVARCHAR(MAX) NOT NULL,
    Razon         NVARCHAR(500) NULL,
    IdSistema     INT NOT NULL REFERENCES dbo.Sistema(IdSistema),
    IdPrioridad   TINYINT NOT NULL REFERENCES dbo.Prioridad(IdPrioridad),
    FechaLimite   DATE NULL,

    -- solicitante: sin sesion (nombre/correo) o con sesion (usuario)
    IdSolicitante     INT NULL REFERENCES dbo.Usuario(IdUsuario),
    SolicitanteNombre NVARCHAR(150) NULL,
    SolicitanteCorreo NVARCHAR(200) NULL,
    Origen VARCHAR(10) NOT NULL DEFAULT 'PUBLICO'
           CHECK (Origen IN ('PUBLICO','EXPERTO','COMITE')),
    IdSolicitudOrigen INT NULL REFERENCES dbo.SolicitudCambio(IdSolicitud),  -- solicitud derivada

    -- clasificacion (la define el experto)
    IdTipoCambio TINYINT NOT NULL REFERENCES dbo.TipoCambio(IdTipoCambio),
    IdImpacto    TINYINT NULL REFERENCES dbo.NivelImpacto(IdNivel),

    -- flujo
    IdEstado     TINYINT NOT NULL REFERENCES dbo.Estado(IdEstado),
    Ronda        TINYINT NOT NULL DEFAULT 1,
    FechaEnvio   DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    FechaDecision DATETIME2(0) NULL,

    CONSTRAINT CK_Solicitante CHECK (
        IdSolicitante IS NOT NULL OR (SolicitanteNombre IS NOT NULL AND SolicitanteCorreo IS NOT NULL))
);

CREATE TABLE dbo.AnalisisTecnico (       -- formulario del experto (1:1)
    IdSolicitud   INT PRIMARY KEY REFERENCES dbo.SolicitudCambio(IdSolicitud),
    IdAnalista    INT NOT NULL REFERENCES dbo.Usuario(IdUsuario),
    FechaAnalisis DATE NOT NULL DEFAULT CAST(SYSDATETIME() AS DATE),
    EspecificacionTecnica NVARCHAR(MAX) NULL,
    AnalisisImpacto NVARCHAR(MAX) NULL,
    ServiciosAfectados NVARCHAR(300) NULL,
    BdAfectada    BIT NOT NULL DEFAULT 0,
    HorasEstimadas DECIMAL(6,1) NULL CHECK (HorasEstimadas >= 0),
    PlanRollout   NVARCHAR(MAX) NULL,
    PlanBackout   NVARCHAR(MAX) NULL,
    Sugerencia    NVARCHAR(MAX) NULL,
    Recomendacion VARCHAR(10) NULL CHECK (Recomendacion IN ('APROBAR','RECHAZAR','MODIFICAR'))
);

/* ---------- Comite ---------- */
CREATE TABLE dbo.VotoComite (
    IdVoto      INT IDENTITY(1,1) PRIMARY KEY,
    IdSolicitud INT NOT NULL REFERENCES dbo.SolicitudCambio(IdSolicitud),
    Ronda       TINYINT NOT NULL,
    IdUsuario   INT NOT NULL REFERENCES dbo.ComiteMiembro(IdUsuario),
    Voto        VARCHAR(10) NOT NULL CHECK (Voto IN ('APROBAR','RECHAZAR','MODIFICAR')),
    Comentario  NVARCHAR(500) NULL,
    Fecha       DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_Voto UNIQUE (IdSolicitud, Ronda, IdUsuario)
);

CREATE TABLE dbo.HistorialEstado (       -- linea de tiempo
    IdHistorial INT IDENTITY(1,1) PRIMARY KEY,
    IdSolicitud INT NOT NULL REFERENCES dbo.SolicitudCambio(IdSolicitud),
    IdEstado    TINYINT NOT NULL REFERENCES dbo.Estado(IdEstado),
    IdUsuario   INT NULL REFERENCES dbo.Usuario(IdUsuario),
    Actor       NVARCHAR(150) NULL,
    Comentario  NVARCHAR(500) NULL,
    Fecha       DATETIME2(0) NOT NULL DEFAULT SYSDATETIME()
);
GO

/* ---------- Datos iniciales ---------- */
INSERT dbo.Rol (Codigo, Nombre) VALUES
 ('EXPERTO', N'Experto'), ('COMITE', N'Comite de cambios'), ('ADMIN', N'Administrador');

INSERT dbo.TipoCambio (Codigo, Nombre) VALUES
 ('ESTANDAR', N'Estandar'), ('NORMAL', N'Normal'), ('EMERGENCIA', N'Emergencia');

INSERT dbo.Prioridad (Nombre) VALUES (N'Baja'), (N'Media'), (N'Alta'), (N'Critica');
INSERT dbo.NivelImpacto (Nombre) VALUES (N'Bajo'), (N'Medio'), (N'Alto');

INSERT dbo.Estado (Codigo, Nombre, Orden) VALUES
 ('ENVIADA',      N'Solicitud enviada',       1),
 ('EN_COMITE',    N'En revision por comite',  2),
 ('MODIFICACION', N'Modificacion solicitada', 3),
 ('APROBADA',     N'Aprobada',                4),
 ('RECHAZADA',    N'Rechazada',               5);

INSERT dbo.Sistema (Nombre) VALUES (N'Facturacion'), (N'Reportes'), (N'Autenticacion'), (N'Catalogo');

INSERT dbo.Usuario (Nombre, Correo, ClaveHash, IdRol)
SELECT v.n, v.c, N'REEMPLAZAR_CON_HASH', r.IdRol
FROM (VALUES
 (N'Bruno Carrasco', N'experto1@changeflow.test', 'EXPERTO'),
 (N'Sofia Quiroga',  N'experto2@changeflow.test', 'EXPERTO'),
 (N'Pablo Acuna',    N'comite1@changeflow.test',  'COMITE'),
 (N'Lucia Mendez',   N'comite2@changeflow.test',  'COMITE'),
 (N'Esteban Vargas', N'comite3@changeflow.test',  'COMITE')
) v(n, c, rol) JOIN dbo.Rol r ON r.Codigo = v.rol;

INSERT dbo.ComiteMiembro (IdUsuario)
SELECT u.IdUsuario FROM dbo.Usuario u JOIN dbo.Rol r ON r.IdRol = u.IdRol WHERE r.Codigo = 'COMITE';
GO

/* ---------- Procedimientos ---------- */

-- Cambio de estado + linea de tiempo (uso interno)
CREATE OR ALTER PROCEDURE dbo.sp_CambiarEstado
    @IdSolicitud INT, @Codigo VARCHAR(20), @IdUsuario INT = NULL,
    @Actor NVARCHAR(150) = NULL, @Comentario NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @IdEstado TINYINT = (SELECT IdEstado FROM dbo.Estado WHERE Codigo = @Codigo);
    IF @IdEstado IS NULL THROW 50001, 'Estado inexistente.', 1;

    UPDATE dbo.SolicitudCambio
    SET IdEstado = @IdEstado,
        Ronda = CASE WHEN @Codigo = 'ENVIADA' THEN Ronda + 1 ELSE Ronda END,
        FechaDecision = CASE WHEN @Codigo IN ('APROBADA','RECHAZADA') THEN SYSDATETIME() ELSE FechaDecision END
    WHERE IdSolicitud = @IdSolicitud;

    INSERT dbo.HistorialEstado (IdSolicitud, IdEstado, IdUsuario, Actor, Comentario)
    VALUES (@IdSolicitud, @IdEstado, @IdUsuario, @Actor, @Comentario);
END
GO

-- 1) Registrar solicitud. Sin @IdSolicitante = usuario final (sin sesion).
--    Con sesion, el origen es el rol: experto o comite.
CREATE OR ALTER PROCEDURE dbo.sp_CrearSolicitud
    @Asunto NVARCHAR(200), @Descripcion NVARCHAR(MAX), @IdSistema INT, @IdPrioridad TINYINT,
    @Razon NVARCHAR(500) = NULL, @FechaLimite DATE = NULL,
    @IdSolicitante INT = NULL, @SolicitanteNombre NVARCHAR(150) = NULL, @SolicitanteCorreo NVARCHAR(200) = NULL,
    @CodigoTipoCambio VARCHAR(20) = 'NORMAL', @IdSolicitudOrigen INT = NULL
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRAN;
    DECLARE @Origen VARCHAR(10) = 'PUBLICO', @Id INT,
            @IdTipo TINYINT = (SELECT IdTipoCambio FROM dbo.TipoCambio WHERE Codigo = @CodigoTipoCambio),
            @IdEstado TINYINT = (SELECT IdEstado FROM dbo.Estado WHERE Codigo = 'ENVIADA');
    IF @IdTipo IS NULL THROW 50002, 'Tipo de cambio invalido.', 1;

    IF @IdSolicitante IS NOT NULL
    BEGIN
        SELECT @Origen = CASE r.Codigo WHEN 'COMITE' THEN 'COMITE' ELSE 'EXPERTO' END
        FROM dbo.Usuario u JOIN dbo.Rol r ON r.IdRol = u.IdRol
        WHERE u.IdUsuario = @IdSolicitante AND u.Activo = 1;
        IF @@ROWCOUNT = 0 THROW 50003, 'Usuario inexistente o inactivo.', 1;
    END
    IF @IdSolicitudOrigen IS NOT NULL AND @Origen = 'PUBLICO'
        THROW 50004, 'Solo experto o comite (con sesion) pueden crear una solicitud derivada.', 1;

    INSERT dbo.SolicitudCambio
        (Asunto, Descripcion, Razon, IdSistema, IdPrioridad, FechaLimite, IdSolicitante,
         SolicitanteNombre, SolicitanteCorreo, Origen, IdSolicitudOrigen, IdTipoCambio, IdEstado)
    VALUES
        (@Asunto, @Descripcion, @Razon, @IdSistema, @IdPrioridad, @FechaLimite, @IdSolicitante,
         @SolicitanteNombre, @SolicitanteCorreo, @Origen, @IdSolicitudOrigen, @IdTipo, @IdEstado);
    SET @Id = SCOPE_IDENTITY();

    INSERT dbo.HistorialEstado (IdSolicitud, IdEstado, IdUsuario, Actor)
    VALUES (@Id, @IdEstado, @IdSolicitante, CASE WHEN @IdSolicitante IS NULL THEN @SolicitanteNombre END);
    COMMIT;
    SELECT IdSolicitud, Codigo FROM dbo.SolicitudCambio WHERE IdSolicitud = @Id;
END
GO

-- 2) Formulario del experto: analisis + sugerencia (requiere sesion de experto/comite)
CREATE OR ALTER PROCEDURE dbo.sp_GuardarAnalisis
    @IdSolicitud INT, @IdAnalista INT,
    @EspecificacionTecnica NVARCHAR(MAX) = NULL, @AnalisisImpacto NVARCHAR(MAX) = NULL,
    @ServiciosAfectados NVARCHAR(300) = NULL, @BdAfectada BIT = 0, @HorasEstimadas DECIMAL(6,1) = NULL,
    @PlanRollout NVARCHAR(MAX) = NULL, @PlanBackout NVARCHAR(MAX) = NULL,
    @Sugerencia NVARCHAR(MAX) = NULL, @Recomendacion VARCHAR(10) = NULL,
    @CodigoTipoCambio VARCHAR(20) = NULL, @IdImpacto TINYINT = NULL
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRAN;
    IF NOT EXISTS (SELECT 1 FROM dbo.Usuario u JOIN dbo.Rol r ON r.IdRol = u.IdRol
                   WHERE u.IdUsuario = @IdAnalista AND u.Activo = 1 AND r.Codigo IN ('EXPERTO','COMITE','ADMIN'))
        THROW 50005, 'El analisis requiere sesion de experto.', 1;

    IF EXISTS (SELECT 1 FROM dbo.AnalisisTecnico WHERE IdSolicitud = @IdSolicitud)
        UPDATE dbo.AnalisisTecnico SET
            IdAnalista = @IdAnalista, FechaAnalisis = CAST(SYSDATETIME() AS DATE),
            EspecificacionTecnica = @EspecificacionTecnica, AnalisisImpacto = @AnalisisImpacto,
            ServiciosAfectados = @ServiciosAfectados, BdAfectada = @BdAfectada, HorasEstimadas = @HorasEstimadas,
            PlanRollout = @PlanRollout, PlanBackout = @PlanBackout,
            Sugerencia = @Sugerencia, Recomendacion = @Recomendacion
        WHERE IdSolicitud = @IdSolicitud;
    ELSE
        INSERT dbo.AnalisisTecnico
            (IdSolicitud, IdAnalista, EspecificacionTecnica, AnalisisImpacto, ServiciosAfectados, BdAfectada,
             HorasEstimadas, PlanRollout, PlanBackout, Sugerencia, Recomendacion)
        VALUES
            (@IdSolicitud, @IdAnalista, @EspecificacionTecnica, @AnalisisImpacto, @ServiciosAfectados, @BdAfectada,
             @HorasEstimadas, @PlanRollout, @PlanBackout, @Sugerencia, @Recomendacion);

    UPDATE dbo.SolicitudCambio SET
        IdImpacto = COALESCE(@IdImpacto, IdImpacto),
        IdTipoCambio = COALESCE((SELECT IdTipoCambio FROM dbo.TipoCambio WHERE Codigo = @CodigoTipoCambio), IdTipoCambio)
    WHERE IdSolicitud = @IdSolicitud;
    COMMIT;
END
GO

-- 3) Enviar al comite: solicitud + analisis del experto
CREATE OR ALTER PROCEDURE dbo.sp_EnviarAComite
    @IdSolicitud INT, @IdUsuario INT
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM dbo.SolicitudCambio s JOIN dbo.Estado e ON e.IdEstado = s.IdEstado
                   WHERE s.IdSolicitud = @IdSolicitud AND e.Codigo = 'ENVIADA')
        THROW 50006, 'La solicitud no esta en estado Enviada.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.AnalisisTecnico WHERE IdSolicitud = @IdSolicitud AND Recomendacion IS NOT NULL)
        THROW 50007, 'El experto debe registrar su analisis y recomendacion antes de enviar al comite.', 1;
    EXEC dbo.sp_CambiarEstado @IdSolicitud, 'EN_COMITE', @IdUsuario;
END
GO

-- 4) Voto del comite: decide por mayoria de los integrantes activos
CREATE OR ALTER PROCEDURE dbo.sp_RegistrarVoto
    @IdSolicitud INT, @IdUsuario INT, @Voto VARCHAR(10), @Comentario NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRAN;
    DECLARE @Ronda TINYINT;
    SELECT @Ronda = s.Ronda FROM dbo.SolicitudCambio s JOIN dbo.Estado e ON e.IdEstado = s.IdEstado
    WHERE s.IdSolicitud = @IdSolicitud AND e.Codigo = 'EN_COMITE';
    IF @Ronda IS NULL THROW 50008, 'La solicitud no esta en revision por el comite.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.ComiteMiembro WHERE IdUsuario = @IdUsuario AND Activo = 1)
        THROW 50009, 'Solo integrantes activos del comite pueden votar.', 1;

    MERGE dbo.VotoComite AS t
    USING (SELECT @IdSolicitud AS IdSolicitud, @Ronda AS Ronda, @IdUsuario AS IdUsuario) AS o
       ON t.IdSolicitud = o.IdSolicitud AND t.Ronda = o.Ronda AND t.IdUsuario = o.IdUsuario
    WHEN MATCHED THEN UPDATE SET Voto = @Voto, Comentario = @Comentario, Fecha = SYSDATETIME()
    WHEN NOT MATCHED THEN INSERT (IdSolicitud, Ronda, IdUsuario, Voto, Comentario)
                          VALUES (@IdSolicitud, @Ronda, @IdUsuario, @Voto, @Comentario);

    DECLARE @Total INT = (SELECT COUNT(*) FROM dbo.ComiteMiembro WHERE Activo = 1),
            @A INT, @R INT, @M INT, @Resultado VARCHAR(20) = NULL;
    SELECT @A = ISNULL(SUM(CASE WHEN Voto = 'APROBAR'   THEN 1 END), 0),
           @R = ISNULL(SUM(CASE WHEN Voto = 'RECHAZAR'  THEN 1 END), 0),
           @M = ISNULL(SUM(CASE WHEN Voto = 'MODIFICAR' THEN 1 END), 0)
    FROM dbo.VotoComite WHERE IdSolicitud = @IdSolicitud AND Ronda = @Ronda;

    IF @A * 2 > @Total SET @Resultado = 'APROBADA';
    ELSE IF @R * 2 > @Total SET @Resultado = 'RECHAZADA';
    ELSE IF @M * 2 > @Total OR @A + @R + @M = @Total SET @Resultado = 'MODIFICACION';

    IF @Resultado IS NOT NULL
        EXEC dbo.sp_CambiarEstado @IdSolicitud, @Resultado, @IdUsuario, NULL, @Comentario;
    COMMIT;
    SELECT @Resultado AS Decision, @A AS Aprobar, @R AS Rechazar, @M AS Modificar, @Total AS Integrantes;
END
GO

/* ---------- Vistas (panel y reportes) ---------- */
CREATE OR ALTER VIEW dbo.vw_Solicitudes AS
SELECT s.IdSolicitud, s.Codigo, s.Asunto, e.Nombre AS Estado, p.Nombre AS Prioridad,
       tc.Nombre AS TipoCambio, i.Nombre AS Impacto, sis.Nombre AS Sistema, s.Origen,
       COALESCE(u.Nombre, s.SolicitanteNombre) AS Solicitante, s.FechaEnvio, s.FechaDecision
FROM dbo.SolicitudCambio s
JOIN dbo.Estado e ON e.IdEstado = s.IdEstado
JOIN dbo.Prioridad p ON p.IdPrioridad = s.IdPrioridad
JOIN dbo.TipoCambio tc ON tc.IdTipoCambio = s.IdTipoCambio
JOIN dbo.Sistema sis ON sis.IdSistema = s.IdSistema
LEFT JOIN dbo.NivelImpacto i ON i.IdNivel = s.IdImpacto
LEFT JOIN dbo.Usuario u ON u.IdUsuario = s.IdSolicitante;
GO

CREATE OR ALTER VIEW dbo.vw_SolicitudParaComite AS      -- solicitud + analisis del experto
SELECT s.IdSolicitud, s.Codigo, s.Asunto, s.Descripcion, s.Razon, s.Origen,
       COALESCE(u.Nombre, s.SolicitanteNombre) AS Solicitante,
       ex.Nombre AS Experto, a.AnalisisImpacto, a.HorasEstimadas, a.PlanRollout, a.PlanBackout,
       a.Sugerencia, a.Recomendacion,
       (SELECT COUNT(*) FROM dbo.VotoComite v WHERE v.IdSolicitud = s.IdSolicitud AND v.Ronda = s.Ronda) AS VotosEmitidos
FROM dbo.SolicitudCambio s
JOIN dbo.Estado e ON e.IdEstado = s.IdEstado AND e.Codigo = 'EN_COMITE'
LEFT JOIN dbo.AnalisisTecnico a ON a.IdSolicitud = s.IdSolicitud
LEFT JOIN dbo.Usuario ex ON ex.IdUsuario = a.IdAnalista
LEFT JOIN dbo.Usuario u ON u.IdUsuario = s.IdSolicitante;
GO

CREATE OR ALTER VIEW dbo.vw_LineaTiempo AS
SELECT h.IdSolicitud, h.Fecha, e.Nombre AS Estado, COALESCE(u.Nombre, h.Actor) AS Actor, h.Comentario
FROM dbo.HistorialEstado h
JOIN dbo.Estado e ON e.IdEstado = h.IdEstado
LEFT JOIN dbo.Usuario u ON u.IdUsuario = h.IdUsuario;
GO

CREATE OR ALTER VIEW dbo.vw_CambiosPorTipo AS           -- ej. cuantos de emergencia
SELECT t.Nombre AS TipoCambio, COUNT(s.IdSolicitud) AS Total
FROM dbo.TipoCambio t LEFT JOIN dbo.SolicitudCambio s ON s.IdTipoCambio = t.IdTipoCambio
GROUP BY t.Nombre;
GO

CREATE OR ALTER VIEW dbo.vw_CambiosPorEstado AS
SELECT e.Nombre AS Estado, e.Orden, COUNT(s.IdSolicitud) AS Total
FROM dbo.Estado e LEFT JOIN dbo.SolicitudCambio s ON s.IdEstado = e.IdEstado
GROUP BY e.Nombre, e.Orden;
GO

CREATE OR ALTER VIEW dbo.vw_CambiosPorPrioridad AS
SELECT p.Nombre AS Prioridad, COUNT(s.IdSolicitud) AS Total
FROM dbo.Prioridad p LEFT JOIN dbo.SolicitudCambio s ON s.IdPrioridad = p.IdPrioridad
GROUP BY p.Nombre;
GO

CREATE OR ALTER VIEW dbo.vw_CambiosPorOrigen AS         -- publico / experto / comite
SELECT Origen, COUNT(*) AS Total FROM dbo.SolicitudCambio GROUP BY Origen;
GO

PRINT 'UtaFlow (version APE) creada correctamente.';