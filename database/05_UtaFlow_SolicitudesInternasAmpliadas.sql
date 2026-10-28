
USE UtaFlow;
GO

IF COL_LENGTH('dbo.SolicitudCambio', 'TipoMantenimiento') IS NULL
    ALTER TABLE dbo.SolicitudCambio
    ADD TipoMantenimiento VARCHAR(20) NULL;
GO

IF COL_LENGTH('dbo.SolicitudCambio', 'ComponentesAfectados') IS NULL
    ALTER TABLE dbo.SolicitudCambio
    ADD ComponentesAfectados NVARCHAR(600) NULL;
GO

IF COL_LENGTH('dbo.SolicitudCambio', 'ComponentesAsociados') IS NULL
    ALTER TABLE dbo.SolicitudCambio
    ADD ComponentesAsociados NVARCHAR(600) NULL;
GO

IF COL_LENGTH('dbo.SolicitudCambio', 'EstadoDeseado') IS NULL
    ALTER TABLE dbo.SolicitudCambio
    ADD EstadoDeseado NVARCHAR(2000) NULL;
GO

IF COL_LENGTH('dbo.SolicitudCambio', 'ConsecuenciaNoHacer') IS NULL
    ALTER TABLE dbo.SolicitudCambio
    ADD ConsecuenciaNoHacer NVARCHAR(1000) NULL;
GO

IF COL_LENGTH('dbo.SolicitudCambio', 'Urgencia') IS NULL
    ALTER TABLE dbo.SolicitudCambio
    ADD Urgencia TINYINT NULL;
GO

IF COL_LENGTH('dbo.SolicitudCambio', 'RiesgosIniciales') IS NULL
    ALTER TABLE dbo.SolicitudCambio
    ADD RiesgosIniciales NVARCHAR(1000) NULL;
GO

IF COL_LENGTH('dbo.SolicitudCambio', 'UsuariosAfectados') IS NULL
    ALTER TABLE dbo.SolicitudCambio
    ADD UsuariosAfectados NVARCHAR(300) NULL;
GO

IF COL_LENGTH('dbo.SolicitudCambio', 'CostoEstimadoSolicitado') IS NULL
    ALTER TABLE dbo.SolicitudCambio
    ADD CostoEstimadoSolicitado DECIMAL(12,2) NULL;
GO

IF COL_LENGTH('dbo.SolicitudCambio', 'DependenciasPrevias') IS NULL
    ALTER TABLE dbo.SolicitudCambio
    ADD DependenciasPrevias NVARCHAR(1000) NULL;
GO

IF COL_LENGTH('dbo.SolicitudCambio', 'ArchivosSugeridos') IS NULL
    ALTER TABLE dbo.SolicitudCambio
    ADD ArchivosSugeridos NVARCHAR(1000) NULL;
GO

IF COL_LENGTH('dbo.SolicitudCambio', 'RamaSugerida') IS NULL
    ALTER TABLE dbo.SolicitudCambio
    ADD RamaSugerida NVARCHAR(150) NULL;
GO

SELECT
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'dbo'
  AND TABLE_NAME = 'SolicitudCambio'
ORDER BY ORDINAL_POSITION;
GO
