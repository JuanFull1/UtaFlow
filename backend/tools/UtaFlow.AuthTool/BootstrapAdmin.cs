using System.Data;
using System.Net.Mail;
using Microsoft.Data.SqlClient;
using UtaFlow.Infrastructure.Authentication;

internal static class BootstrapAdmin
{
    internal static async Task<int> RunAsync(
        Func<string> leerClave
    )
    {
        try
        {
            if (
                Environment.GetEnvironmentVariable(
                    "ASPNETCORE_ENVIRONMENT"
                ) != "Development"
            )
            {
                throw new InvalidOperationException(
                    "Se requiere el entorno Development."
                );
            }

            var equipo = Environment.MachineName;

            if (
                Environment.GetEnvironmentVariable(
                    "UTAFLOW_CONFIRMED_DEVELOPMENT"
                ) != $"{equipo}/UtaFlow"
            )
            {
                throw new InvalidOperationException(
                    "Falta confirmar expresamente el entorno local."
                );
            }

            var cadena =
                Environment.GetEnvironmentVariable(
                    "ConnectionStrings__UtaFlow"
                ) ?? "";

            var configuracion =
                new SqlConnectionStringBuilder(cadena);

            var servidor = configuracion.DataSource
                .Trim()
                .ToLowerInvariant();

            bool local =
                servidor is "." or "(local)" or "localhost" ||
                servidor.StartsWith("localhost,") ||
                servidor.StartsWith("localhost\\") ||
                servidor.StartsWith(".\\") ||
                servidor.StartsWith("(localdb)\\") ||
                servidor == equipo.ToLowerInvariant() ||
                servidor.StartsWith(
                    equipo.ToLowerInvariant() + "\\"
                );

            if (
                !local ||
                !configuracion.InitialCatalog.Equals(
                    "UtaFlow",
                    StringComparison.OrdinalIgnoreCase
                )
            )
            {
                throw new InvalidOperationException(
                    "Solo se permite una base local UtaFlow confirmada."
                );
            }

            var fabrica = new SqlConnectionFactory(
                cadena,
                allowUntrustedCertificate: true
            );

            await using var conexion =
                await fabrica.OpenAsync(CancellationToken.None);

            // No permitir repetir el bootstrap.
            await using var comprobar = new SqlCommand(
                """
                SELECT COUNT(*)
                FROM dbo.Usuario u
                INNER JOIN dbo.Rol r
                    ON r.IdRol = u.IdRol
                WHERE r.Codigo = 'ADMIN';
                """,
                conexion
            );

            if (
                Convert.ToInt32(
                    await comprobar.ExecuteScalarAsync()
                ) != 0
            )
            {
                throw new InvalidOperationException(
                    "Ya existe una cuenta ADMIN. " +
                    "Utiliza el panel o recupera la cuenta existente."
                );
            }

            Console.Write("Nombre del primer administrador: ");
            var nombre = (Console.ReadLine() ?? "").Trim();

            Console.Write("Correo del primer administrador: ");
            var correo = (Console.ReadLine() ?? "")
                .Trim()
                .ToLowerInvariant();

            if (
                nombre.Length is < 2 or > 150 ||
                correo.Length is < 3 or > 200 ||
                !MailAddress.TryCreate(
                    correo,
                    out var direccion
                ) ||
                !direccion.Address.Equals(
                    correo,
                    StringComparison.OrdinalIgnoreCase
                )
            )
            {
                throw new InvalidOperationException(
                    "El nombre o correo no son válidos."
                );
            }

            Console.Write(
                "Contraseña (12-128 caracteres; letras y números): "
            );

            var clave = leerClave();

            Console.Write("Confirmar contraseña: ");
            var confirmacion = leerClave();

            if (
                clave.Length is < 12 or > 128 ||
                !clave.Any(char.IsLetter) ||
                !clave.Any(char.IsDigit) ||
                clave.Any(char.IsControl) ||
                clave != confirmacion
            )
            {
                throw new InvalidOperationException(
                    "Contraseña o confirmación no válida."
                );
            }

            confirmacion = "";

            // Mismo mecanismo seguro utilizado por login.
            var servicio = new IdentityPasswordService();

            var hash = servicio.Hash(clave);

            if (!servicio.Verify(hash, clave))
            {
                throw new InvalidOperationException(
                    "No se pudo verificar el hash."
                );
            }

            clave = "";

            await using var tx = (SqlTransaction)
                await conexion.BeginTransactionAsync(
                    IsolationLevel.Serializable
                );

            // Evitar la creación simultánea de administradores.
            await using (var bloqueo = new SqlCommand(
                """
                DECLARE @r INT;

                EXEC @r = sys.sp_getapplock
                    @Resource = N'UtaFlow.AdministracionUsuarios',
                    @LockMode = 'Exclusive',
                    @LockOwner = 'Transaction',
                    @LockTimeout = 10000;

                SELECT @r;
                """,
                conexion,
                tx
            ))
            {
                if (
                    Convert.ToInt32(
                        await bloqueo.ExecuteScalarAsync()
                    ) < 0
                )
                {
                    throw new InvalidOperationException(
                        "La administración está ocupada."
                    );
                }
            }

            await using (var verificar = new SqlCommand(
                """
                SELECT COUNT(*)
                FROM dbo.Usuario u WITH (UPDLOCK, HOLDLOCK)
                INNER JOIN dbo.Rol r
                    ON r.IdRol = u.IdRol
                WHERE r.Codigo = 'ADMIN';
                """,
                conexion,
                tx
            ))
            {
                if (
                    Convert.ToInt32(
                        await verificar.ExecuteScalarAsync()
                    ) != 0
                )
                {
                    throw new InvalidOperationException(
                        "Otro administrador ya fue creado."
                    );
                }
            }

            await using var crear = new SqlCommand(
                """
                INSERT dbo.Usuario
                (
                    Nombre,
                    Correo,
                    ClaveHash,
                    IdRol,
                    Activo
                )
                SELECT
                    @Nombre,
                    @Correo,
                    @Hash,
                    IdRol,
                    1
                FROM dbo.Rol
                WHERE Codigo = 'ADMIN';
                """,
                conexion,
                tx
            );

            crear.Parameters.Add(
                "@Nombre",
                SqlDbType.NVarChar,
                150
            ).Value = nombre;

            crear.Parameters.Add(
                "@Correo",
                SqlDbType.NVarChar,
                200
            ).Value = correo;

            crear.Parameters.Add(
                "@Hash",
                SqlDbType.NVarChar,
                255
            ).Value = hash;

            if (await crear.ExecuteNonQueryAsync() != 1)
            {
                throw new InvalidOperationException(
                    "No existe el rol ADMIN. Ejecuta el SQL de preparación."
                );
            }

            await tx.CommitAsync();

            hash = "";

            Console.WriteLine(
                "Primer administrador creado correctamente."
            );

            Console.WriteLine(
                "Inicia sesión con el correo y contraseña elegidos."
            );

            return 0;
        }
        catch (Exception e) when (
            e is SqlException or
            InvalidOperationException or
            ArgumentException
        )
        {
            Console.Error.WriteLine(
                e is SqlException sql
                    ? $"Error de SQL Server (código {sql.Number})."
                    : e.Message
            );

            return 1;
        }
    }
}