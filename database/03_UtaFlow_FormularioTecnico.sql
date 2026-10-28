
USE UtaFlow;
GO

-- Clasificación del mantenimiento:
-- CORRECTIVO, ADAPTATIVO, PERFECTIVO, PREVENTIVO
IF COL_LENGTH('dbo.AnalisisTecnico', 'TipoMantenimiento') IS NULL
    ALTER TABLE dbo.AnalisisTecnico
    ADD TipoMantenimiento VARCHAR(20) NULL;
GO

-- Componentes o elementos de configuración afectados
IF COL_LENGTH('dbo.AnalisisTecnico', 'ComponentesAfectados') IS NULL
    ALTER TABLE dbo.AnalisisTecnico
    ADD ComponentesAfectados NVARCHAR(600) NULL;
GO

-- Archivos previstos que se modificarán en el proyecto
IF COL_LENGTH('dbo.AnalisisTecnico', 'ArchivosPrevistos') IS NULL
    ALTER TABLE dbo.AnalisisTecnico
    ADD ArchivosPrevistos NVARCHAR(MAX) NULL;
GO

-- Costo estimado del cambio
IF COL_LENGTH('dbo.AnalisisTecnico', 'CostoEstimado') IS NULL
    ALTER TABLE dbo.AnalisisTecnico
    ADD CostoEstimado DECIMAL(12,2) NULL;
GO

-- Rama GitFlow propuesta
IF COL_LENGTH('dbo.AnalisisTecnico', 'RamaGit') IS NULL
    ALTER TABLE dbo.AnalisisTecnico
    ADD RamaGit NVARCHAR(150) NULL;
GO

-- Ambiente previsto: desarrollo, pruebas o producción
IF COL_LENGTH('dbo.AnalisisTecnico', 'AmbientePrevisto') IS NULL
    ALTER TABLE dbo.AnalisisTecnico
    ADD AmbientePrevisto NVARCHAR(30) NULL;
GO

-- Estrategia prevista de implementación
IF COL_LENGTH('dbo.AnalisisTecnico', 'EstrategiaDespliegue') IS NULL
    ALTER TABLE dbo.AnalisisTecnico
    ADD EstrategiaDespliegue NVARCHAR(300) NULL;
GO

-- Qué sucedería si no se realiza el cambio
IF COL_LENGTH('dbo.AnalisisTecnico', 'ConsecuenciaNoHacer') IS NULL
    ALTER TABLE dbo.AnalisisTecnico
    ADD ConsecuenciaNoHacer NVARCHAR(1000) NULL;
GO

-- Comprobar columnas
SELECT
    c.name AS Campo,
    t.name AS TipoDato,
    c.max_length AS LongitudBytes
FROM sys.columns c
INNER JOIN sys.types t
    ON t.user_type_id = c.user_type_id
WHERE c.object_id =
    OBJECT_ID('dbo.AnalisisTecnico')
ORDER BY c.column_id;
GO
