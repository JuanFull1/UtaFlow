/*
   UtaFlow - Preparación del módulo de administración
   No elimina ni sustituye usuarios, roles, votos ni decisiones.
   Ejecutar en la base REAL de UtaFlow; revisar el nombre del USE.
*/
USE UtaFlow;
GO
SET XACT_ABORT ON;
GO

IF OBJECT_ID(N'dbo.Rol', N'U') IS NULL
    THROW 52000, 'No existe dbo.Rol. Verifique la base de datos seleccionada.', 1;
GO

-- El rol ADMIN ya puede existir en las instalaciones actuales.
IF NOT EXISTS (SELECT 1 FROM dbo.Rol WHERE Codigo = 'ADMIN')
BEGIN
    INSERT INTO dbo.Rol (Codigo, Nombre)
    VALUES ('ADMIN', N'Administrador');
END;
GO

IF OBJECT_ID(N'dbo.Usuario', N'U') IS NULL
    THROW 52001, 'No existe dbo.Usuario. Verifique la base de datos seleccionada.', 1;
GO

IF OBJECT_ID(N'dbo.ComiteMiembro', N'U') IS NULL
    THROW 52002, 'No existe dbo.ComiteMiembro. Verifique la base de datos seleccionada.', 1;
GO

-- Si ya ejecutó la ampliación para la decisión colectiva, esta columna existe.
IF COL_LENGTH('dbo.ComiteMiembro', 'EsPrincipal') IS NULL
BEGIN
    ALTER TABLE dbo.ComiteMiembro
    ADD EsPrincipal BIT NOT NULL
        CONSTRAINT DF_ComiteMiembro_EsPrincipal DEFAULT (0);
END;
GO

-- Registrar acciones administrativas sin sobrescribir decisiones del comité.
IF OBJECT_ID(N'dbo.AuditoriaAdministracion', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AuditoriaAdministracion
    (
        IdAuditoria BIGINT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_AuditoriaAdministracion PRIMARY KEY,
        IdAdministrador INT NOT NULL
            CONSTRAINT FK_AuditoriaAdmin_Administrador
            REFERENCES dbo.Usuario(IdUsuario),
        IdUsuarioObjetivo INT NULL
            CONSTRAINT FK_AuditoriaAdmin_UsuarioObjetivo
            REFERENCES dbo.Usuario(IdUsuario),
        Accion VARCHAR(40) NOT NULL,
        Descripcion NVARCHAR(1000) NOT NULL,
        Fecha DATETIME2(0) NOT NULL
            CONSTRAINT DF_AuditoriaAdministracion_Fecha
            DEFAULT SYSUTCDATETIME()
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_AuditoriaAdministracion_Fecha'
      AND object_id = OBJECT_ID(N'dbo.AuditoriaAdministracion')
)
BEGIN
    CREATE INDEX IX_AuditoriaAdministracion_Fecha
    ON dbo.AuditoriaAdministracion (Fecha DESC, IdAuditoria DESC);
END;
GO

-- Solo un integrante activo puede ser el principal del comité.
-- Si hay datos inconsistentes, se detiene en vez de borrar designaciones.
IF (
    SELECT COUNT(*) FROM dbo.ComiteMiembro
    WHERE Activo = 1 AND EsPrincipal = 1
) > 1
    THROW 52003, 'Hay más de un comité principal activo. Corrija antes de crear el índice.', 1;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_ComiteMiembro_PrincipalActivo'
      AND object_id = OBJECT_ID(N'dbo.ComiteMiembro')
)
BEGIN
    CREATE UNIQUE INDEX UX_ComiteMiembro_PrincipalActivo
    ON dbo.ComiteMiembro (EsPrincipal)
    WHERE EsPrincipal = 1 AND Activo = 1;
END;
GO

-- Verificación sin modificar usuarios ni credenciales.
SELECT IdRol, Codigo, Nombre
FROM dbo.Rol
WHERE Codigo IN ('ADMIN', 'EXPERTO', 'COMITE')
ORDER BY Codigo;

SELECT u.IdUsuario, u.Nombre, u.Correo, r.Codigo AS Rol,
       u.Activo,
       CAST(ISNULL(cm.Activo, 0) AS BIT) AS MiembroActivo,
       CAST(ISNULL(cm.EsPrincipal, 0) AS BIT) AS EsPrincipal
FROM dbo.Usuario u
JOIN dbo.Rol r ON r.IdRol = u.IdRol
LEFT JOIN dbo.ComiteMiembro cm ON cm.IdUsuario = u.IdUsuario
ORDER BY r.Codigo, u.Nombre;
GO
