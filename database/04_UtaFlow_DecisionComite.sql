
USE UtaFlow;
GO

-- 1. Identificar al responsable principal.
IF COL_LENGTH('dbo.ComiteMiembro', 'EsPrincipal') IS NULL
BEGIN
    ALTER TABLE dbo.ComiteMiembro
    ADD EsPrincipal BIT NOT NULL
        CONSTRAINT DF_ComiteMiembro_EsPrincipal DEFAULT (0);
END;
GO

-- Mantener un solo responsable principal activo.
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.ComiteMiembro')
      AND name = 'UX_ComiteMiembro_Principal'
)
BEGIN
    CREATE UNIQUE INDEX UX_ComiteMiembro_Principal
    ON dbo.ComiteMiembro (EsPrincipal)
    WHERE EsPrincipal = 1 AND Activo = 1;
END;
GO

-- Designación inicial: primera cuenta del comité.
-- Solo se realiza si todavía no hay un principal activo.
IF NOT EXISTS (
    SELECT 1
    FROM dbo.ComiteMiembro
    WHERE EsPrincipal = 1 AND Activo = 1
)
BEGIN
    UPDATE cm
    SET EsPrincipal = 1
    FROM dbo.ComiteMiembro cm
    INNER JOIN dbo.Usuario u
        ON u.IdUsuario = cm.IdUsuario
    WHERE u.Correo = 'comite1@changeflow.test'
      AND cm.Activo = 1;
END;
GO

-- 2. Registro de la decisión colectiva.
IF OBJECT_ID('dbo.DecisionComite', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.DecisionComite
    (
        IdDecision INT IDENTITY(1,1) PRIMARY KEY,

        IdSolicitud INT NOT NULL
            REFERENCES dbo.SolicitudCambio(IdSolicitud),

        Ronda TINYINT NOT NULL,

        IdPrincipal INT NOT NULL
            REFERENCES dbo.ComiteMiembro(IdUsuario),

        Resultado VARCHAR(20) NOT NULL
            CHECK (Resultado IN (
                'APROBADA',
                'RECHAZADA',
                'MODIFICACION'
            )),

        FechaDecision DATETIME2(0) NOT NULL
            DEFAULT SYSDATETIME(),

        RevisadoPor NVARCHAR(1000) NOT NULL,

        Justificacion NVARCHAR(2000) NOT NULL,

        Condiciones NVARCHAR(2000) NULL,

        VersionPrevista NVARCHAR(50) NULL,

        VotosAprobar INT NOT NULL,
        VotosRechazar INT NOT NULL,
        VotosModificar INT NOT NULL,
        TotalIntegrantes INT NOT NULL,

        CONSTRAINT UQ_DecisionComite_Ronda
            UNIQUE (IdSolicitud, Ronda),

        CONSTRAINT CK_DecisionComite_Version
            CHECK (
                Resultado <> 'APROBADA'
                OR NULLIF(LTRIM(RTRIM(VersionPrevista)), '') IS NOT NULL
            )
    );
END;
GO

-- 3. Registrar votos, sin cerrar automáticamente la solicitud.
CREATE OR ALTER PROCEDURE dbo.sp_RegistrarVoto
    @IdSolicitud INT,
    @IdUsuario INT,
    @Voto VARCHAR(10),
    @Comentario NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Voto NOT IN ('APROBAR', 'RECHAZAR', 'MODIFICAR')
        THROW 51010, 'El voto no es valido.', 1;

    BEGIN TRANSACTION;

    DECLARE
        @Ronda TINYINT,
        @Total INT,
        @A INT,
        @R INT,
        @M INT,
        @Resultado VARCHAR(20) = NULL;

    SELECT @Ronda = s.Ronda
    FROM dbo.SolicitudCambio s WITH (UPDLOCK, HOLDLOCK)
    INNER JOIN dbo.Estado e ON e.IdEstado = s.IdEstado
    WHERE s.IdSolicitud = @IdSolicitud
      AND e.Codigo = 'EN_COMITE';

    IF @Ronda IS NULL
        THROW 50008, 'La solicitud no esta en revision.', 1;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.ComiteMiembro cm
        INNER JOIN dbo.Usuario u
            ON u.IdUsuario = cm.IdUsuario
        INNER JOIN dbo.Rol r
            ON r.IdRol = u.IdRol
        WHERE cm.IdUsuario = @IdUsuario
          AND cm.Activo = 1
          AND u.Activo = 1
          AND r.Codigo = 'COMITE'
    )
        THROW 50009, 'No es integrante activo del comite.', 1;

    -- Se conserva la posibilidad de corregir el voto
    -- mientras la decisión no haya sido formalizada.
    UPDATE dbo.VotoComite
    SET Voto = @Voto,
        Comentario = @Comentario,
        Fecha = SYSDATETIME()
    WHERE IdSolicitud = @IdSolicitud
      AND Ronda = @Ronda
      AND IdUsuario = @IdUsuario;

    IF @@ROWCOUNT = 0
    BEGIN
        INSERT INTO dbo.VotoComite
            (IdSolicitud, Ronda, IdUsuario, Voto, Comentario)
        VALUES
            (@IdSolicitud, @Ronda, @IdUsuario, @Voto, @Comentario);
    END;

    SELECT @Total = COUNT(*)
    FROM dbo.ComiteMiembro cm
    INNER JOIN dbo.Usuario u ON u.IdUsuario = cm.IdUsuario
    WHERE cm.Activo = 1 AND u.Activo = 1;

    SELECT
        @A = COUNT(CASE WHEN Voto = 'APROBAR' THEN 1 END),
        @R = COUNT(CASE WHEN Voto = 'RECHAZAR' THEN 1 END),
        @M = COUNT(CASE WHEN Voto = 'MODIFICAR' THEN 1 END)
    FROM dbo.VotoComite
    WHERE IdSolicitud = @IdSolicitud AND Ronda = @Ronda;

    -- Mayoría absoluta. El resultado es provisional.
    IF @A * 2 > @Total
        SET @Resultado = 'APROBADA';
    ELSE IF @R * 2 > @Total
        SET @Resultado = 'RECHAZADA';
    ELSE IF @M * 2 > @Total
        SET @Resultado = 'MODIFICACION';

    COMMIT TRANSACTION;

    SELECT
        @Resultado AS Decision,
        @A AS Aprobar,
        @R AS Rechazar,
        @M AS Modificar,
        @Total AS Integrantes;
END;
GO

-- 4. Formalización por el responsable principal.
CREATE OR ALTER PROCEDURE dbo.sp_RegistrarDecisionComite
    @IdSolicitud INT,
    @IdPrincipal INT,
    @Resultado VARCHAR(20),
    @Justificacion NVARCHAR(2000),
    @Condiciones NVARCHAR(2000) = NULL,
    @VersionPrevista NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Resultado NOT IN (
        'APROBADA',
        'RECHAZADA',
        'MODIFICACION'
    )
        THROW 51020, 'Resultado no valido.', 1;

    IF NULLIF(LTRIM(RTRIM(@Justificacion)), '') IS NULL
        THROW 51021, 'La justificacion es obligatoria.', 1;

    IF @Resultado = 'APROBADA'
       AND NULLIF(LTRIM(RTRIM(@VersionPrevista)), '') IS NULL
        THROW 51022, 'Indique la version prevista.', 1;

    SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
    BEGIN TRANSACTION;

    DECLARE
        @Ronda TINYINT,
        @Total INT,
        @A INT,
        @R INT,
        @M INT,
        @RevisadoPor NVARCHAR(1000);

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.ComiteMiembro cm
        INNER JOIN dbo.Usuario u ON u.IdUsuario = cm.IdUsuario
        INNER JOIN dbo.Rol r ON r.IdRol = u.IdRol
        WHERE cm.IdUsuario = @IdPrincipal
          AND cm.EsPrincipal = 1
          AND cm.Activo = 1
          AND u.Activo = 1
          AND r.Codigo = 'COMITE'
    )
        THROW 51023, 'No es el responsable principal.', 1;

    SELECT @Ronda = s.Ronda
    FROM dbo.SolicitudCambio s WITH (UPDLOCK, HOLDLOCK)
    INNER JOIN dbo.Estado e ON e.IdEstado = s.IdEstado
    WHERE s.IdSolicitud = @IdSolicitud
      AND e.Codigo = 'EN_COMITE';

    IF @Ronda IS NULL
        THROW 51024, 'La solicitud no esta en comite.', 1;

    IF EXISTS (
        SELECT 1
        FROM dbo.DecisionComite
        WHERE IdSolicitud = @IdSolicitud
          AND Ronda = @Ronda
    )
        THROW 51025, 'La decision ya fue registrada.', 1;

    SELECT @Total = COUNT(*)
    FROM dbo.ComiteMiembro cm
    INNER JOIN dbo.Usuario u ON u.IdUsuario = cm.IdUsuario
    WHERE cm.Activo = 1 AND u.Activo = 1;

    SELECT
        @A = COUNT(CASE WHEN v.Voto = 'APROBAR' THEN 1 END),
        @R = COUNT(CASE WHEN v.Voto = 'RECHAZAR' THEN 1 END),
        @M = COUNT(CASE WHEN v.Voto = 'MODIFICAR' THEN 1 END)
    FROM dbo.VotoComite v
    INNER JOIN dbo.ComiteMiembro cm
        ON cm.IdUsuario = v.IdUsuario
    INNER JOIN dbo.Usuario u
        ON u.IdUsuario = v.IdUsuario
    WHERE v.IdSolicitud = @IdSolicitud
      AND v.Ronda = @Ronda
      AND cm.Activo = 1 AND u.Activo = 1;

    IF NOT (
        (@Resultado = 'APROBADA' AND @A * 2 > @Total)
        OR (@Resultado = 'RECHAZADA' AND @R * 2 > @Total)
        OR (@Resultado = 'MODIFICACION' AND @M * 2 > @Total)
    )
        THROW 51026, 'No existe mayoria para ese resultado.', 1;

    SELECT @RevisadoPor =
        STRING_AGG(CONVERT(NVARCHAR(MAX), u.Nombre), N', ')
    FROM dbo.VotoComite v
    INNER JOIN dbo.ComiteMiembro cm
        ON cm.IdUsuario = v.IdUsuario
    INNER JOIN dbo.Usuario u
        ON u.IdUsuario = v.IdUsuario
    WHERE v.IdSolicitud = @IdSolicitud
      AND v.Ronda = @Ronda
      AND cm.Activo = 1 AND u.Activo = 1;

    INSERT INTO dbo.DecisionComite
    (
        IdSolicitud,
        Ronda,
        IdPrincipal,
        Resultado,
        RevisadoPor,
        Justificacion,
        Condiciones,
        VersionPrevista,
        VotosAprobar,
        VotosRechazar,
        VotosModificar,
        TotalIntegrantes
    )
    VALUES
    (
        @IdSolicitud,
        @Ronda,
        @IdPrincipal,
        @Resultado,
        @RevisadoPor,
        @Justificacion,
        @Condiciones,
        @VersionPrevista,
        @A,
        @R,
        @M,
        @Total
    );

    DECLARE @ComentarioHistorial NVARCHAR(500);

    SET @ComentarioHistorial =
        CONCAT(
            N'Decision colectiva: ', @Resultado,
            N'. Votos: aprobar=', @A,
            N', rechazar=', @R,
            N', modificar=', @M,
            N'. Formalizada por el responsable principal.'
        );

    EXEC dbo.sp_CambiarEstado
        @IdSolicitud = @IdSolicitud,
        @Codigo = @Resultado,
        @IdUsuario = @IdPrincipal,
        @Comentario = @ComentarioHistorial;

    COMMIT TRANSACTION;

    SELECT
        @Resultado AS Resultado,
        @RevisadoPor AS RevisadoPor,
        @A AS Aprobar,
        @R AS Rechazar,
        @M AS Modificar,
        @Total AS Integrantes;
END;
GO

-- 5. Verificar el principal.
SELECT
    u.Nombre,
    u.Correo,
    cm.Activo,
    cm.EsPrincipal
FROM dbo.ComiteMiembro cm
INNER JOIN dbo.Usuario u
    ON u.IdUsuario = cm.IdUsuario;
GO
