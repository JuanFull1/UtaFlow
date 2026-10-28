USE UtaFlow;
GO

-- Sistema interno exclusivo para solicitudes públicas cuyos
-- solicitantes desconocen la aplicación exacta que necesita el cambio.
-- Idempotente: no crea duplicados y conserva los sistemas existentes.
IF NOT EXISTS (
    SELECT 1
    FROM dbo.Sistema
    WHERE Nombre = N'Por clasificar'
)
BEGIN
    INSERT INTO dbo.Sistema (Nombre)
    VALUES (N'Por clasificar');
END;
GO

SELECT IdSistema, Nombre
FROM dbo.Sistema
WHERE Nombre = N'Por clasificar';
GO
