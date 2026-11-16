/* ============================================================================
   UtaFlow - 10: Identificador de configuración (unidad 3.1)

   La unidad 3.1 pide que cada elemento tenga un número único con:
     1) identificador del proyecto
     2) identificador del elemento de configuración
     3) número del nivel de revisión
     4) código del atributo

   Formato:  <PROYECTO>-<ELEMENTO>-<NÚMERO>-R<REVISIÓN>-<TIPO>
   Ejemplo:  ECR-RUT-0012-R1-NOR
             ECR = proyecto EcuaRutas, RUT = módulo Rutas y paradas,
             0012 = número del cambio, R1 = revisión (ronda del comité),
             NOR = tipo de cambio ITIL (EST, NOR, EME).

   Este identificador NO es secreto y es el que se escribe en Git.
   El código de seguimiento RFC-AAAA-... sigue siendo privado: solo lo conoce
   quien registró la solicitud.

   Idempotente. Requiere sqlcmd con -I.
   ============================================================================ */
USE UtaFlow;
GO
SET NOCOUNT ON;
GO

IF COL_LENGTH('dbo.Sistema', 'Codigo') IS NULL
    ALTER TABLE dbo.Sistema ADD Codigo VARCHAR(6) NULL;
GO

IF COL_LENGTH('dbo.ModuloSistema', 'Codigo') IS NULL
    ALTER TABLE dbo.ModuloSistema ADD Codigo VARCHAR(6) NULL;
GO

/* Códigos cortos de los sistemas */
UPDATE s SET Codigo = v.Codigo
FROM dbo.Sistema s
JOIN (VALUES
    (N'EcuaRutas', 'ECR'), (N'UtaFlow', 'UTF'), (N'Facturacion', 'FAC'),
    (N'Reportes', 'REP'), (N'Autenticacion', 'AUT'), (N'Catalogo', 'CAT'),
    (N'Por clasificar', 'GEN')
) v (Nombre, Codigo) ON v.Nombre = s.Nombre
WHERE s.Codigo IS NULL;

/* Códigos cortos de los módulos */
UPDATE m SET Codigo = v.Codigo
FROM dbo.ModuloSistema m
JOIN dbo.Sistema s ON s.IdSistema = m.IdSistema
JOIN (VALUES
    (N'EcuaRutas', N'Autenticación y usuarios', 'AUT'),
    (N'EcuaRutas', N'Rutas y paradas', 'RUT'),
    (N'EcuaRutas', N'Mapas y ubicación', 'MAP'),
    (N'EcuaRutas', N'Reservas y pasajes', 'RES'),
    (N'EcuaRutas', N'Pagos', 'PAG'),
    (N'EcuaRutas', N'Reportes', 'REP'),
    (N'EcuaRutas', N'Administración', 'ADM'),
    (N'UtaFlow', N'Inicio de sesión', 'LOG'),
    (N'UtaFlow', N'Solicitud pública', 'SOL'),
    (N'UtaFlow', N'Seguimiento de solicitudes', 'SEG'),
    (N'UtaFlow', N'Tablero del experto', 'TAB'),
    (N'UtaFlow', N'Decisión del comité', 'DEC'),
    (N'UtaFlow', N'Administración de usuarios', 'USR')
) v (Sistema, Modulo, Codigo)
  ON v.Sistema = s.Nombre AND v.Modulo = m.Nombre
WHERE m.Codigo IS NULL;
GO

/* ---------------------------------------------------------------------------
   Vista del identificador de cada cambio
   Base = PROYECTO-ELEMENTO-NÚMERO (no cambia nunca; es lo que se busca en Git)
   --------------------------------------------------------------------------- */
CREATE OR ALTER VIEW dbo.vw_IdentificadorCambio
AS
SELECT
    s.IdSolicitud,
    b.Base,
    b.Base + '-R' + CAST(s.Ronda AS VARCHAR(3)) + '-' + LEFT(tc.Codigo, 3)
        AS Identificador
FROM dbo.SolicitudCambio s
JOIN dbo.Sistema sis ON sis.IdSistema = s.IdSistema
JOIN dbo.TipoCambio tc ON tc.IdTipoCambio = s.IdTipoCambio
LEFT JOIN dbo.ModuloSistema m
       ON m.IdSistema = s.IdSistema AND m.Nombre = s.ModuloAfectado
CROSS APPLY (
    SELECT
        COALESCE(sis.Codigo, UPPER(LEFT(sis.Nombre, 3))) + '-' +
        COALESCE(m.Codigo, 'GEN') + '-' +
        CASE WHEN s.IdSolicitud < 10000
             THEN RIGHT('0000' + CAST(s.IdSolicitud AS VARCHAR(10)), 4)
             ELSE CAST(s.IdSolicitud AS VARCHAR(10)) END AS Base
) b;
GO

/* ---------------------------------------------------------------------------
   Reporte de estado: ahora con el identificador de configuración
   --------------------------------------------------------------------------- */
CREATE OR ALTER VIEW dbo.vw_ReporteEstado
AS
SELECT
    s.IdSolicitud,
    i.Identificador,
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
JOIN dbo.vw_IdentificadorCambio i ON i.IdSolicitud = s.IdSolicitud
JOIN dbo.Estado e ON e.IdEstado = s.IdEstado
JOIN dbo.Sistema sis ON sis.IdSistema = s.IdSistema
JOIN dbo.TipoCambio tc ON tc.IdTipoCambio = s.IdTipoCambio
JOIN dbo.Prioridad p ON p.IdPrioridad = s.IdPrioridad
LEFT JOIN dbo.CicloCambio c ON c.IdSolicitud = s.IdSolicitud;
GO

SELECT TOP (10) IdSolicitud, Base, Identificador
FROM dbo.vw_IdentificadorCambio ORDER BY IdSolicitud DESC;
PRINT 'UtaFlow: identificador de configuracion aplicado.';
GO
