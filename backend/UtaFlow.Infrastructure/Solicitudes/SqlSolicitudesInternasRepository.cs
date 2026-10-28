
using System.Data;
using Microsoft.Data.SqlClient;
using UtaFlow.Application.Solicitudes;

namespace UtaFlow.Infrastructure.Solicitudes;

public sealed partial class SqlSolicitudesInternasRepository(
    string cadenaConexion
) : ISolicitudesInternasRepository
{
    private SqlConnection Conexion() => new(cadenaConexion);

    private static void Parametro(
        SqlCommand comando,
        string nombre,
        SqlDbType tipo,
        object? valor,
        int longitud = 0
    )
    {
        var parametro = longitud == 0
            ? comando.Parameters.Add(nombre, tipo)
            : comando.Parameters.Add(nombre, tipo, longitud);

        parametro.Value = valor ?? DBNull.Value;
    }

    private static async Task<List<Dictionary<string, object?>>> FilasAsync(
        SqlDataReader lector,
        CancellationToken ct
    )
    {
        var filas = new List<Dictionary<string, object?>>();

        while (await lector.ReadAsync(ct))
        {
            var fila = new Dictionary<string, object?>();

            for (var i = 0; i < lector.FieldCount; i++)
            {
                fila[lector.GetName(i)] = lector.IsDBNull(i)
                    ? null
                    : lector.GetValue(i);
            }

            filas.Add(fila);
        }

        return filas;
    }

    private static async Task<(string Estado, string Origen)?> EstadoAsync(
        SqlConnection conexion,
        SqlTransaction transaccion,
        int idSolicitud,
        CancellationToken ct
    )
    {
        await using var comando = new SqlCommand(
            """
            SELECT e.Codigo, s.Origen
            FROM dbo.SolicitudCambio s WITH (UPDLOCK, HOLDLOCK)
            INNER JOIN dbo.Estado e
                ON e.IdEstado = s.IdEstado
            WHERE s.IdSolicitud = @Id;
            """,
            conexion,
            transaccion
        );

        Parametro(comando, "@Id", SqlDbType.Int, idSolicitud);

        await using var lector = await comando.ExecuteReaderAsync(ct);

        if (!await lector.ReadAsync(ct))
            return null;

        return (lector.GetString(0), lector.GetString(1));
    }

    // =========================================================
    // 1. LISTAR SOLICITUDES
    // =========================================================

    public async Task<IReadOnlyList<Dictionary<string, object?>>> ListarAsync(
        CancellationToken ct
    )
    {
        await using var conexion = Conexion();
        await conexion.OpenAsync(ct);

        await using var comando = new SqlCommand(
            """
            SELECT
                s.IdSolicitud AS id,
                s.CodigoSeguimiento AS codigo,
                s.Asunto AS asunto,
                COALESCE(u.Nombre, s.SolicitanteNombre) AS solicitante,
                s.Origen AS origen,
                e.Codigo AS estadoCodigo,
                e.Nombre AS estado,
                sis.Nombre AS sistema,
                p.Nombre AS prioridad,
                tc.Codigo AS tipoCambio,
                CAST(
                    CASE WHEN EXISTS (
                        SELECT 1
                        FROM dbo.AnalisisTecnico a
                        WHERE a.IdSolicitud = s.IdSolicitud
                    ) THEN 1 ELSE 0 END
                    AS BIT
                ) AS tieneAnalisis,
                s.FechaEnvio AS fechaEnvio
            FROM dbo.SolicitudCambio s
            INNER JOIN dbo.Estado e
                ON e.IdEstado = s.IdEstado
            INNER JOIN dbo.Prioridad p
                ON p.IdPrioridad = s.IdPrioridad
            INNER JOIN dbo.Sistema sis
                ON sis.IdSistema = s.IdSistema
            INNER JOIN dbo.TipoCambio tc
                ON tc.IdTipoCambio = s.IdTipoCambio
            LEFT JOIN dbo.Usuario u
                ON u.IdUsuario = s.IdSolicitante
            ORDER BY
                s.FechaEnvio DESC,
                s.IdSolicitud DESC;
            """,
            conexion
        );

        await using var lector = await comando.ExecuteReaderAsync(ct);

        return await FilasAsync(lector, ct);
    }

    // =========================================================
    // 2. DETALLE, EVALUACION, HISTORIAL Y DECISION
    // =========================================================

    public async Task<object?> DetalleAsync(
        int idSolicitud,
        CancellationToken ct
    )
    {
        await using var conexion = Conexion();
        await conexion.OpenAsync(ct);

        await using var comando = new SqlCommand(
            """
            -- 1. DATOS DE LA SOLICITUD
            SELECT
                s.IdSolicitud AS id,
                s.CodigoSeguimiento AS codigo,
                s.Asunto AS asunto,
                s.Descripcion AS descripcion,
                s.Razon AS razon,
                COALESCE(u.Nombre, s.SolicitanteNombre) AS solicitante,
                s.Origen AS origen,
                sis.Nombre AS sistema,
                p.Nombre AS prioridad,
                e.Codigo AS estadoCodigo,
                e.Nombre AS estado,
                tc.Codigo AS tipoCambio,
                s.EmpresaArea AS empresaArea,
                s.ModuloAfectado AS moduloAfectado,
                s.VersionSoftware AS versionSoftware,
                s.AfectacionActual AS afectacionActual,
                s.ComentariosAdicionales AS comentariosAdicionales,
                s.FechaLimite AS fechaLimite,
                s.FechaEnvio AS fechaEnvio,
                s.FechaDecision AS fechaDecision,
                s.Ronda AS ronda,
                s.IdSolicitante AS idSolicitante,
                s.TipoMantenimiento AS tipoMantenimiento,
                s.ComponentesAfectados AS componentesAfectados,
                s.ComponentesAsociados AS componentesAsociados,
                s.EstadoDeseado AS estadoDeseado,
                s.ConsecuenciaNoHacer AS consecuenciaNoHacer,
                s.IdImpacto AS idImpactoSolicitado,
                s.Urgencia AS urgencia,
                s.RiesgosIniciales AS riesgosIniciales,
                s.UsuariosAfectados AS usuariosAfectados,
                s.CostoEstimadoSolicitado AS costoEstimadoSolicitado,
                s.DependenciasPrevias AS dependenciasPrevias,
                s.ArchivosSugeridos AS archivosSugeridos,
                s.RamaSugerida AS ramaSugerida
            FROM dbo.SolicitudCambio s
            INNER JOIN dbo.Estado e
                ON e.IdEstado = s.IdEstado
            INNER JOIN dbo.Sistema sis
                ON sis.IdSistema = s.IdSistema
            INNER JOIN dbo.Prioridad p
                ON p.IdPrioridad = s.IdPrioridad
            INNER JOIN dbo.TipoCambio tc
                ON tc.IdTipoCambio = s.IdTipoCambio
            LEFT JOIN dbo.Usuario u
                ON u.IdUsuario = s.IdSolicitante
            WHERE s.IdSolicitud = @Id;

            -- 2. EVALUACION TECNICA
            SELECT
                a.IdAnalista AS idAnalista,
                analista.Nombre AS nombreAnalista,
                a.FechaAnalisis AS fechaAnalisis,
                a.EspecificacionTecnica AS especificacionTecnica,
                a.AnalisisImpacto AS analisisImpacto,
                a.ServiciosAfectados AS serviciosAfectados,
                a.BdAfectada AS bdAfectada,
                a.HorasEstimadas AS horasEstimadas,
                a.PlanRollout AS planRollout,
                a.PlanBackout AS planBackout,
                a.Sugerencia AS sugerencia,
                a.Recomendacion AS recomendacion,
                a.Riesgos AS riesgos,
                a.PlanPruebas AS planPruebas,
                a.CriteriosAceptacion AS criteriosAceptacion,
                a.TipoMantenimiento AS tipoMantenimiento,
                a.ComponentesAfectados AS componentesAfectados,
                a.ArchivosPrevistos AS archivosPrevistos,
                a.CostoEstimado AS costoEstimado,
                a.RamaGit AS ramaGit,
                a.AmbientePrevisto AS ambientePrevisto,
                a.EstrategiaDespliegue AS estrategiaDespliegue,
                a.ConsecuenciaNoHacer AS consecuenciaNoHacer,
                tc.Codigo AS codigoTipoCambio,
                s.IdImpacto AS idImpacto
            FROM dbo.AnalisisTecnico a
            INNER JOIN dbo.SolicitudCambio s
                ON s.IdSolicitud = a.IdSolicitud
            INNER JOIN dbo.TipoCambio tc
                ON tc.IdTipoCambio = s.IdTipoCambio
            INNER JOIN dbo.Usuario analista
                ON analista.IdUsuario = a.IdAnalista
            WHERE a.IdSolicitud = @Id;

            -- 3. LINEA DE TIEMPO
            SELECT
                e.Nombre AS estado,
                e.Codigo AS estadoCodigo,
                h.Fecha AS fecha,
                COALESCE(
                    u.Nombre,
                    NULLIF(h.Actor, N''),
                    N'Sistema'
                ) AS actor,
                h.Comentario AS comentario
            FROM dbo.HistorialEstado h
            INNER JOIN dbo.Estado e
                ON e.IdEstado = h.IdEstado
            LEFT JOIN dbo.Usuario u
                ON u.IdUsuario = h.IdUsuario
            WHERE h.IdSolicitud = @Id
            ORDER BY h.Fecha, h.IdHistorial;

            -- 4. MENSAJES Y OBSERVACIONES
            SELECT
                m.IdMensaje AS idMensaje,
                m.Emisor AS emisor,
                m.Mensaje AS mensaje,
                m.Fecha AS fecha
            FROM dbo.SolicitudMensaje m
            WHERE m.IdSolicitud = @Id
            ORDER BY m.Fecha, m.IdMensaje;

            -- 5. EVIDENCIAS
            SELECT
                a.IdAdjunto AS idAdjunto,
                a.NombreOriginal AS nombreOriginal,
                a.TipoMime AS tipoMime,
                a.TamanoBytes AS tamanoBytes
            FROM dbo.SolicitudAdjunto a
            WHERE a.IdSolicitud = @Id
            ORDER BY a.IdAdjunto;

            -- 6. VOTOS DE LA RONDA ACTUAL
            SELECT
                v.IdVoto AS idVoto,
                v.IdUsuario AS idUsuario,
                u.Nombre AS integrante,
                v.Voto AS voto,
                v.Comentario AS comentario,
                v.Fecha AS fecha
            FROM dbo.VotoComite v
            INNER JOIN dbo.Usuario u
                ON u.IdUsuario = v.IdUsuario
            INNER JOIN dbo.SolicitudCambio s
                ON s.IdSolicitud = v.IdSolicitud
            WHERE v.IdSolicitud = @Id
              AND v.Ronda = s.Ronda
            ORDER BY v.Fecha, v.IdVoto;

            -- 7. RESPONSABLE PRINCIPAL Y TOTAL DE INTEGRANTES
            SELECT TOP 1
                cm.IdUsuario AS idPrincipal,
                u.Nombre AS nombrePrincipal,
                (
                    SELECT COUNT(*)
                    FROM dbo.ComiteMiembro c
                    INNER JOIN dbo.Usuario us
                        ON us.IdUsuario = c.IdUsuario
                    WHERE c.Activo = 1
                      AND us.Activo = 1
                ) AS totalIntegrantes
            FROM dbo.ComiteMiembro cm
            INNER JOIN dbo.Usuario u
                ON u.IdUsuario = cm.IdUsuario
            WHERE cm.EsPrincipal = 1
              AND cm.Activo = 1
              AND u.Activo = 1;

            -- 8. DECISION COLECTIVA FORMALIZADA
            SELECT TOP 1
                dc.IdDecision AS idDecision,
                dc.Resultado AS resultado,
                dc.FechaDecision AS fechaDecision,
                dc.RevisadoPor AS revisadoPor,
                dc.Justificacion AS justificacion,
                dc.Condiciones AS condiciones,
                dc.VersionPrevista AS versionPrevista,
                dc.VotosAprobar AS votosAprobar,
                dc.VotosRechazar AS votosRechazar,
                dc.VotosModificar AS votosModificar,
                dc.TotalIntegrantes AS totalIntegrantes,
                u.Nombre AS formalizadoPor
            FROM dbo.DecisionComite dc
            INNER JOIN dbo.Usuario u
                ON u.IdUsuario = dc.IdPrincipal
            WHERE dc.IdSolicitud = @Id
            ORDER BY dc.Ronda DESC;
            """,
            conexion
        );

        Parametro(comando, "@Id", SqlDbType.Int, idSolicitud);

        await using var lector = await comando.ExecuteReaderAsync(ct);

        var solicitudes = await FilasAsync(lector, ct);

        if (solicitudes.Count == 0)
            return null;

        await lector.NextResultAsync(ct);
        var analisis = await FilasAsync(lector, ct);

        await lector.NextResultAsync(ct);
        var historial = await FilasAsync(lector, ct);

        await lector.NextResultAsync(ct);
        var mensajes = await FilasAsync(lector, ct);

        await lector.NextResultAsync(ct);
        var adjuntos = await FilasAsync(lector, ct);

        await lector.NextResultAsync(ct);
        var votos = await FilasAsync(lector, ct);

        await lector.NextResultAsync(ct);
        var principales = await FilasAsync(lector, ct);

        await lector.NextResultAsync(ct);
        var decisiones = await FilasAsync(lector, ct);

        return new
        {
            solicitud = solicitudes[0],
            analisis = analisis.FirstOrDefault(),
            historial,
            mensajes,
            adjuntos,
            votos,
            comite = principales.FirstOrDefault(),
            decisionComite = decisiones.FirstOrDefault()
        };
    }

    // =========================================================
    // 3. CREAR SOLICITUD INTERNA
    // =========================================================

    public async Task<SolicitudInternaCreada> CrearAsync(
        NuevaSolicitudInternaRequest datos,
        int idUsuario,
        CancellationToken ct
    )
    {
        await using var conexion = Conexion();
        await conexion.OpenAsync(ct);

        // Una sola transacción conserva el registro original
        // y los nuevos campos unidos a la misma solicitud.
        await using var transaccion =
            (SqlTransaction)await conexion.BeginTransactionAsync(ct);

        int idCreado;

        await using (var comando = new SqlCommand(
            "dbo.sp_CrearSolicitud", conexion, transaccion
        )
        {
            CommandType = CommandType.StoredProcedure
        })
        {
            Parametro(comando, "@Asunto",
                SqlDbType.NVarChar, datos.Asunto.Trim(), 200);
            Parametro(comando, "@Descripcion",
                SqlDbType.NVarChar, datos.Descripcion.Trim(), -1);
            Parametro(comando, "@Razon",
                SqlDbType.NVarChar, datos.Razon.Trim(), 500);
            Parametro(comando, "@IdSistema",
                SqlDbType.Int, datos.IdSistema);
            Parametro(comando, "@IdPrioridad",
                SqlDbType.TinyInt, (byte)datos.IdPrioridad);
            Parametro(comando, "@IdSolicitante",
                SqlDbType.Int, idUsuario);
            Parametro(comando, "@CodigoTipoCambio",
                SqlDbType.VarChar, datos.CodigoTipoCambio, 20);
            Parametro(comando, "@FechaLimite",
                SqlDbType.Date,
                datos.FechaLimite.HasValue
                    ? datos.FechaLimite.Value.ToDateTime(TimeOnly.MinValue)
                    : null);

            await using var lector =
                await comando.ExecuteReaderAsync(ct);

            if (!await lector.ReadAsync(ct))
                throw new InvalidOperationException(
                    "No se recibió el ID de la solicitud creada."
                );

            idCreado = lector.GetInt32(
                lector.GetOrdinal("IdSolicitud")
            );
        }

        await using (var completar = new SqlCommand(
            """
            UPDATE dbo.SolicitudCambio
            SET EmpresaArea = @EmpresaArea,
                ModuloAfectado = @ModuloAfectado,
                VersionSoftware = @VersionSoftware,
                AfectacionActual = @AfectacionActual,
                ComentariosAdicionales = @Comentarios,
                TipoMantenimiento = @Mantenimiento,
                ComponentesAfectados = @Componentes,
                ComponentesAsociados = @Asociados,
                EstadoDeseado = @EstadoDeseado,
                ConsecuenciaNoHacer = @Consecuencia,
                IdImpacto = @Impacto,
                Urgencia = @Urgencia,
                RiesgosIniciales = @Riesgos,
                UsuariosAfectados = @Usuarios,
                CostoEstimadoSolicitado = @Costo,
                DependenciasPrevias = @Dependencias,
                ArchivosSugeridos = @Archivos,
                RamaSugerida = @Rama
            WHERE IdSolicitud = @Id AND IdSolicitante = @Usuario;
            """, conexion, transaccion
        ))
        {
            Parametro(completar, "@Id", SqlDbType.Int, idCreado);
            Parametro(completar, "@Usuario", SqlDbType.Int, idUsuario);
            Parametro(completar, "@EmpresaArea",
                SqlDbType.NVarChar, datos.EmpresaArea, 150);
            Parametro(completar, "@ModuloAfectado",
                SqlDbType.NVarChar, datos.ModuloAfectado, 150);
            Parametro(completar, "@VersionSoftware",
                SqlDbType.NVarChar, datos.VersionSoftware, 50);
            Parametro(completar, "@AfectacionActual",
                SqlDbType.NVarChar, datos.AfectacionActual, 1000);
            Parametro(completar, "@Comentarios",
                SqlDbType.NVarChar, datos.ComentariosAdicionales, 1000);
            Parametro(completar, "@Mantenimiento",
                SqlDbType.VarChar, datos.TipoMantenimiento, 20);
            Parametro(completar, "@Componentes",
                SqlDbType.NVarChar, datos.ComponentesAfectados, 600);
            Parametro(completar, "@Asociados",
                SqlDbType.NVarChar, datos.ComponentesAsociados, 600);
            Parametro(completar, "@EstadoDeseado",
                SqlDbType.NVarChar, datos.EstadoDeseado, 2000);
            Parametro(completar, "@Consecuencia",
                SqlDbType.NVarChar, datos.ConsecuenciaNoHacer, 1000);
            Parametro(completar, "@Impacto",
                SqlDbType.TinyInt,
                datos.IdImpacto.HasValue ? (byte)datos.IdImpacto.Value : null);
            Parametro(completar, "@Urgencia",
                SqlDbType.TinyInt,
                datos.Urgencia.HasValue ? (byte)datos.Urgencia.Value : null);
            Parametro(completar, "@Riesgos",
                SqlDbType.NVarChar, datos.RiesgosIniciales, 1000);
            Parametro(completar, "@Usuarios",
                SqlDbType.NVarChar, datos.UsuariosAfectados, 300);
            Parametro(completar, "@Costo",
                SqlDbType.Decimal, datos.CostoEstimadoSolicitado);
            completar.Parameters["@Costo"].Precision = 12;
            completar.Parameters["@Costo"].Scale = 2;
            Parametro(completar, "@Dependencias",
                SqlDbType.NVarChar, datos.DependenciasPrevias, 1000);
            Parametro(completar, "@Archivos",
                SqlDbType.NVarChar, datos.ArchivosSugeridos, 1000);
            Parametro(completar, "@Rama",
                SqlDbType.NVarChar, datos.RamaSugerida, 150);

            if (await completar.ExecuteNonQueryAsync(ct) != 1)
                throw new InvalidOperationException(
                    "No fue posible completar la solicitud interna."
                );
        }

        await using var consulta = new SqlCommand(
            "SELECT CodigoSeguimiento FROM dbo.SolicitudCambio WHERE IdSolicitud = @Id;",
            conexion, transaccion
        );
        Parametro(consulta, "@Id", SqlDbType.Int, idCreado);

        var codigo = (string?)await consulta.ExecuteScalarAsync(ct);
        if (string.IsNullOrWhiteSpace(codigo))
            throw new InvalidOperationException(
                "No se obtuvo el código de seguimiento de la solicitud."
            );

        await transaccion.CommitAsync(ct);
        return new SolicitudInternaCreada(idCreado, codigo);
    }

    // =========================================================
    // 4. GUARDAR EVALUACION DEL EXPERTO
    // =========================================================

    public async Task<bool> GuardarAnalisisAsync(
        int idSolicitud,
        int idUsuario,
        EvaluacionInternaRequest datos,
        CancellationToken ct
    )
    {
        await using var conexion = Conexion();
        await conexion.OpenAsync(ct);

        await using var transaccion =
            (SqlTransaction)await conexion.BeginTransactionAsync(ct);

        var actual = await EstadoAsync(
            conexion, transaccion, idSolicitud, ct
        );

        if (actual is null ||
            actual.Value.Estado is not (
                "ENVIADA" or "PENDIENTE_EXPERTO"
            ))
        {
            await transaccion.RollbackAsync(ct);
            return false;
        }

        // Procedimiento original de evaluación.
        await using (var comando = new SqlCommand(
            "dbo.sp_GuardarAnalisis",
            conexion,
            transaccion
        )
        {
            CommandType = CommandType.StoredProcedure
        })
        {
            Parametro(comando, "@IdSolicitud",
                SqlDbType.Int, idSolicitud);

            Parametro(comando, "@IdAnalista",
                SqlDbType.Int, idUsuario);

            Parametro(comando, "@EspecificacionTecnica",
                SqlDbType.NVarChar,
                datos.EspecificacionTecnica, -1);

            Parametro(comando, "@AnalisisImpacto",
                SqlDbType.NVarChar,
                datos.AnalisisImpacto, -1);

            Parametro(comando, "@ServiciosAfectados",
                SqlDbType.NVarChar,
                datos.ServiciosAfectados, 300);

            Parametro(comando, "@BdAfectada",
                SqlDbType.Bit, datos.BdAfectada);

            Parametro(comando, "@HorasEstimadas",
                SqlDbType.Decimal, datos.HorasEstimadas);

            comando.Parameters["@HorasEstimadas"].Precision = 6;
            comando.Parameters["@HorasEstimadas"].Scale = 1;

            Parametro(comando, "@PlanRollout",
                SqlDbType.NVarChar, datos.PlanRollout, -1);

            Parametro(comando, "@PlanBackout",
                SqlDbType.NVarChar, datos.PlanBackout, -1);

            Parametro(comando, "@Sugerencia",
                SqlDbType.NVarChar, datos.Sugerencia, -1);

            Parametro(comando, "@Recomendacion",
                SqlDbType.VarChar, datos.Recomendacion, 10);

            Parametro(comando, "@CodigoTipoCambio",
                SqlDbType.VarChar, datos.CodigoTipoCambio, 20);

            Parametro(comando, "@IdImpacto",
                SqlDbType.TinyInt,
                datos.IdImpacto.HasValue
                    ? (byte)datos.IdImpacto.Value
                    : null);

            await comando.ExecuteNonQueryAsync(ct);
        }

        // Campos adicionales del formulario técnico.
        await using (var comando = new SqlCommand(
            """
            UPDATE dbo.AnalisisTecnico
            SET
                Riesgos = @Riesgos,
                PlanPruebas = @PlanPruebas,
                CriteriosAceptacion = @Criterios,
                TipoMantenimiento = @TipoMantenimiento,
                ComponentesAfectados = @ComponentesAfectados,
                ArchivosPrevistos = @ArchivosPrevistos,
                CostoEstimado = @CostoEstimado,
                RamaGit = @RamaGit,
                AmbientePrevisto = @AmbientePrevisto,
                EstrategiaDespliegue = @EstrategiaDespliegue,
                ConsecuenciaNoHacer = @ConsecuenciaNoHacer
            WHERE IdSolicitud = @Id;
            """,
            conexion,
            transaccion
        ))
        {
            Parametro(comando, "@Id",
                SqlDbType.Int, idSolicitud);

            Parametro(comando, "@Riesgos",
                SqlDbType.NVarChar, datos.Riesgos, -1);

            Parametro(comando, "@PlanPruebas",
                SqlDbType.NVarChar, datos.PlanPruebas, -1);

            Parametro(comando, "@Criterios",
                SqlDbType.NVarChar, datos.CriteriosAceptacion, -1);

            Parametro(comando, "@TipoMantenimiento",
                SqlDbType.VarChar, datos.TipoMantenimiento, 20);

            Parametro(comando, "@ComponentesAfectados",
                SqlDbType.NVarChar,
                datos.ComponentesAfectados, 600);

            Parametro(comando, "@ArchivosPrevistos",
                SqlDbType.NVarChar, datos.ArchivosPrevistos, -1);

            Parametro(comando, "@CostoEstimado",
                SqlDbType.Decimal, datos.CostoEstimado);

            comando.Parameters["@CostoEstimado"].Precision = 12;
            comando.Parameters["@CostoEstimado"].Scale = 2;

            Parametro(comando, "@RamaGit",
                SqlDbType.NVarChar, datos.RamaGit, 150);

            Parametro(comando, "@AmbientePrevisto",
                SqlDbType.NVarChar, datos.AmbientePrevisto, 30);

            Parametro(comando, "@EstrategiaDespliegue",
                SqlDbType.NVarChar,
                datos.EstrategiaDespliegue, 300);

            Parametro(comando, "@ConsecuenciaNoHacer",
                SqlDbType.NVarChar,
                datos.ConsecuenciaNoHacer, 1000);

            await comando.ExecuteNonQueryAsync(ct);
        }

        await transaccion.CommitAsync(ct);
        return true;
    }

    // =========================================================
    // 5. ENVIAR SOLICITUD AL COMITE
    // =========================================================

    public async Task<bool> EnviarAlComiteAsync(
        int idSolicitud,
        int idUsuario,
        CancellationToken ct
    )
    {
        await using var conexion = Conexion();
        await conexion.OpenAsync(ct);

        await using var transaccion =
            (SqlTransaction)await conexion.BeginTransactionAsync(ct);

        var actual = await EstadoAsync(
            conexion, transaccion, idSolicitud, ct
        );

        if (actual is null ||
            actual.Value.Estado is not (
                "ENVIADA" or "PENDIENTE_EXPERTO"
            ))
        {
            await transaccion.RollbackAsync(ct);
            return false;
        }

        // Punto 14: impedir evaluaciones incompletas.
        await using (var verificar = new SqlCommand(
            """
            SELECT CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM dbo.AnalisisTecnico a
                    INNER JOIN dbo.SolicitudCambio s
                        ON s.IdSolicitud = a.IdSolicitud
                    WHERE a.IdSolicitud = @Id
                      AND a.Recomendacion IS NOT NULL
                      AND NULLIF(
                          LTRIM(RTRIM(a.TipoMantenimiento)), ''
                      ) IS NOT NULL
                      AND a.CostoEstimado IS NOT NULL
                      AND s.IdImpacto IS NOT NULL
                      AND NULLIF(
                          LTRIM(RTRIM(a.RamaGit)), ''
                      ) IS NOT NULL
                )
                THEN 1 ELSE 0
            END;
            """,
            conexion,
            transaccion
        ))
        {
            Parametro(verificar, "@Id",
                SqlDbType.Int, idSolicitud);

            var completo = Convert.ToInt32(
                await verificar.ExecuteScalarAsync(ct)
            ) == 1;

            if (!completo)
            {
                await transaccion.RollbackAsync(ct);
                return false;
            }
        }

        // Si la solicitud vuelve desde el comité,
        // se crea una nueva ronda de revisión.
        if (actual.Value.Estado == "PENDIENTE_EXPERTO")
        {
            await using var cambio = new SqlCommand(
                "dbo.sp_CambiarEstado",
                conexion,
                transaccion
            )
            {
                CommandType = CommandType.StoredProcedure
            };

            Parametro(cambio, "@IdSolicitud",
                SqlDbType.Int, idSolicitud);

            Parametro(cambio, "@Codigo",
                SqlDbType.VarChar, "ENVIADA", 20);

            Parametro(cambio, "@IdUsuario",
                SqlDbType.Int, idUsuario);

            Parametro(cambio, "@Comentario",
                SqlDbType.NVarChar,
                "El experto corrigió la evaluación técnica.", 500);

            await cambio.ExecuteNonQueryAsync(ct);
        }

        await using (var enviar = new SqlCommand(
            "dbo.sp_EnviarAComite",
            conexion,
            transaccion
        )
        {
            CommandType = CommandType.StoredProcedure
        })
        {
            Parametro(enviar, "@IdSolicitud",
                SqlDbType.Int, idSolicitud);

            Parametro(enviar, "@IdUsuario",
                SqlDbType.Int, idUsuario);

            await enviar.ExecuteNonQueryAsync(ct);
        }

        await transaccion.CommitAsync(ct);
        return true;
    }

    // =========================================================
    // 6. REGISTRAR VOTO INDIVIDUAL DEL COMITE
    // =========================================================

    public async Task<object> VotarAsync(
        int idSolicitud,
        int idUsuario,
        VotoInternoRequest datos,
        CancellationToken ct
    )
    {
        await using var conexion = Conexion();
        await conexion.OpenAsync(ct);

        await using var comando = new SqlCommand(
            "dbo.sp_RegistrarVoto",
            conexion
        )
        {
            CommandType = CommandType.StoredProcedure
        };

        Parametro(comando, "@IdSolicitud",
            SqlDbType.Int, idSolicitud);

        Parametro(comando, "@IdUsuario",
            SqlDbType.Int, idUsuario);

        Parametro(comando, "@Voto",
            SqlDbType.VarChar, datos.Voto, 10);

        Parametro(comando, "@Comentario",
            SqlDbType.NVarChar, datos.Comentario, 500);

        await using var lector = await comando.ExecuteReaderAsync(ct);

        if (!await lector.ReadAsync(ct))
        {
            throw new InvalidOperationException(
                "No se obtuvo el resultado del voto."
            );
        }

        return new
        {
            decision = lector.IsDBNull(0)
                ? null
                : lector.GetString(0),
            aprobar = lector.GetInt32(1),
            rechazar = lector.GetInt32(2),
            modificar = lector.GetInt32(3),
            integrantes = lector.GetInt32(4)
        };
    }

    // =========================================================
    // 7. DEVOLVER SOLICITUD PARA CORRECCIONES
    // =========================================================

    public async Task<bool> DevolverAsync(
        int idSolicitud,
        int idUsuario,
        string rol,
        DevolucionInternaRequest datos,
        CancellationToken ct
    )
    {
        await using var conexion = Conexion();
        await conexion.OpenAsync(ct);

        await using var transaccion =
            (SqlTransaction)await conexion.BeginTransactionAsync(ct);

        var actual = await EstadoAsync(
            conexion, transaccion, idSolicitud, ct
        );

        if (actual is null)
        {
            await transaccion.RollbackAsync(ct);
            return false;
        }

        var destino = datos.Destino.ToUpperInvariant();

        var permitido =
            (
                rol == "EXPERTO" &&
                destino == "CLIENTE" &&
                actual.Value.Origen == "PUBLICO" &&
                actual.Value.Estado is (
                    "ENVIADA" or "PENDIENTE_EXPERTO"
                )
            ) ||
            (
                rol == "COMITE" &&
                actual.Value.Estado is (
                    "EN_COMITE" or "MODIFICACION"
                ) &&
                (
                    destino == "EXPERTO" ||
                    (
                        destino == "CLIENTE" &&
                        actual.Value.Origen == "PUBLICO"
                    )
                )
            );

        if (!permitido)
        {
            await transaccion.RollbackAsync(ct);
            return false;
        }

        var estadoNuevo = destino == "CLIENTE"
            ? "PENDIENTE_CLIENTE"
            : "PENDIENTE_EXPERTO";

        await using (var mensaje = new SqlCommand(
            """
            INSERT INTO dbo.SolicitudMensaje
            (
                IdSolicitud,
                IdUsuario,
                Emisor,
                Mensaje,
                VisibleParaSolicitante
            )
            VALUES
            (
                @Id,
                @Usuario,
                @Rol,
                @Mensaje,
                @Visible
            );
            """,
            conexion,
            transaccion
        ))
        {
            Parametro(mensaje, "@Id",
                SqlDbType.Int, idSolicitud);

            Parametro(mensaje, "@Usuario",
                SqlDbType.Int, idUsuario);

            Parametro(mensaje, "@Rol",
                SqlDbType.VarChar, rol, 10);

            Parametro(mensaje, "@Mensaje",
                SqlDbType.NVarChar,
                datos.Mensaje.Trim(), 2000);

            Parametro(mensaje, "@Visible",
                SqlDbType.Bit, destino == "CLIENTE");

            await mensaje.ExecuteNonQueryAsync(ct);
        }

        await using (var cambio = new SqlCommand(
            "dbo.sp_CambiarEstado",
            conexion,
            transaccion
        )
        {
            CommandType = CommandType.StoredProcedure
        })
        {
            Parametro(cambio, "@IdSolicitud",
                SqlDbType.Int, idSolicitud);

            Parametro(cambio, "@Codigo",
                SqlDbType.VarChar, estadoNuevo, 20);

            Parametro(cambio, "@IdUsuario",
                SqlDbType.Int, idUsuario);

            Parametro(cambio, "@Comentario",
                SqlDbType.NVarChar,
                $"Se solicitó información a: {destino}.", 500);

            await cambio.ExecuteNonQueryAsync(ct);
        }

        await transaccion.CommitAsync(ct);
        return true;
    }

    // =========================================================
    // 8. OBTENER EVIDENCIA ADJUNTA
    // =========================================================

    public async Task<(string Ruta, string Nombre, string Tipo)?>
        ObtenerAdjuntoAsync(
            int idSolicitud,
            int idAdjunto,
            CancellationToken ct
        )
    {
        await using var conexion = Conexion();
        await conexion.OpenAsync(ct);

        await using var comando = new SqlCommand(
            """
            SELECT
                RutaInterna,
                NombreOriginal,
                TipoMime
            FROM dbo.SolicitudAdjunto
            WHERE IdSolicitud = @Solicitud
              AND IdAdjunto = @Adjunto;
            """,
            conexion
        );

        Parametro(comando, "@Solicitud",
            SqlDbType.Int, idSolicitud);

        Parametro(comando, "@Adjunto",
            SqlDbType.Int, idAdjunto);

        await using var lector = await comando.ExecuteReaderAsync(ct);

        if (!await lector.ReadAsync(ct))
            return null;

        return (
            lector.GetString(0),
            lector.GetString(1),
            lector.GetString(2)
        );
    }
}
