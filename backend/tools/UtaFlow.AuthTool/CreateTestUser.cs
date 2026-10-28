using System.Data;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using UtaFlow.Application.Authentication;
using UtaFlow.Infrastructure.Authentication;

// Deliberately provisions only the single development account requested for this exercise.
internal static class CreateTestUser
{
    private const string Name = "Experto de Pruebas";
    private const string Email = "experto.pruebas@utaflow.local";
    private const string Role = "EXPERTO";
    private static readonly Uri Api = new("https://localhost:7003");

    internal static async Task<int> RunAsync(Func<string> readPassword)
    {
        var result = new Result();
        try
        {
            Require(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == "Development",
                "Se requiere ASPNETCORE_ENVIRONMENT=Development.");
            var expectedMachine = Environment.MachineName;
            Require(Environment.GetEnvironmentVariable("UTAFLOW_CONFIRMED_DEVELOPMENT") == $"{expectedMachine}/UtaFlow",
                "Falta la confirmacion explicita del entorno local de desarrollo.");
            var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__UtaFlow") ?? "";
            var settings = new SqlConnectionStringBuilder(connectionString);
            Require(settings.InitialCatalog == "UtaFlow" &&
                new[] { "localhost", ".", "(local)", expectedMachine }.Contains(settings.DataSource, StringComparer.OrdinalIgnoreCase),
                "Solo se admite la base UtaFlow de la instancia local confirmada.");
            var connections = new SqlConnectionFactory(connectionString, allowUntrustedCertificate: true);
            var repository = new SqlUsuarioRepository(connections);
            await using var connection = await connections.OpenAsync(CancellationToken.None);
            using (var metadata = new SqlCommand("SELECT CAST(SERVERPROPERTY('MachineName') AS nvarchar(128)), DB_NAME();", connection))
            await using (var reader = await metadata.ExecuteReaderAsync())
            {
                Require(await reader.ReadAsync() && reader.GetString(0).Equals(expectedMachine, StringComparison.OrdinalIgnoreCase) &&
                    reader.GetString(1) == "UtaFlow", "La conexion no coincide con el entorno confirmado.");
            }
            Require(await repository.FindByCorreoAsync(Email, CancellationToken.None) is null,
                "La cuenta ya existe. No se modifico ni se duplico.");
            using (var roleCheck = new SqlCommand("SELECT COUNT(*) FROM dbo.Rol WHERE Codigo = @rol;", connection))
            {
                roleCheck.Parameters.Add("@rol", SqlDbType.VarChar, 20).Value = Role;
                Require((int)(await roleCheck.ExecuteScalarAsync())! == 1, "No existe exactamente un rol EXPERTO.");
            }
            using var client = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false })
            {
                BaseAddress = Api, Timeout = TimeSpan.FromSeconds(25)
            };
            // Fail before collecting a secret or inserting if HTTPS/API are unavailable.
            using (var probe = await client.GetAsync("/api/auth/me"))
                Require(probe.StatusCode == HttpStatusCode.Unauthorized, "La API HTTPS no respondio como se esperaba.");

            Console.WriteLine($"Entorno confirmado: {expectedMachine}/UtaFlow (Development).");
            Console.WriteLine($"Se creara solamente: {Name} <{Email}>, rol {Role}, activo.");
            Console.Write("Contrasena elegida por ti (12-128 caracteres; entrada oculta): ");
            var password = readPassword();
            Console.Write("Confirmar contrasena (entrada oculta): ");
            var confirmation = readPassword();
            Require(password.Length is >= 12 and <= 128 && password == confirmation,
                "La longitud o la confirmacion no es valida. No se insertaron datos.");
            confirmation = "";
            // Same service, Identity V3 parameters and verifier used by the existing hash command and login.
            var passwords = new IdentityPasswordService();
            var hash = passwords.Hash(password);
            Require(passwords.Verify(hash, password), "El hash no es compatible. No se insertaron datos.");

            await using (var transaction = (SqlTransaction)await connection.BeginTransactionAsync(IsolationLevel.Serializable))
            {
                try
                {
                    using var duplicate = new SqlCommand("SELECT COUNT(*) FROM dbo.Usuario WITH (UPDLOCK, HOLDLOCK) WHERE Correo = @correo;", connection, transaction);
                    duplicate.Parameters.Add("@correo", SqlDbType.NVarChar, 200).Value = Email;
                    Require((int)(await duplicate.ExecuteScalarAsync())! == 0, "La cuenta ya existe. No se modifico ni se duplico.");
                    using var role = new SqlCommand("SELECT IdRol FROM dbo.Rol WITH (HOLDLOCK) WHERE Codigo = @rol;", connection, transaction);
                    role.Parameters.Add("@rol", SqlDbType.VarChar, 20).Value = Role;
                    var roleId = await role.ExecuteScalarAsync();
                    Require(roleId is byte, "El rol EXPERTO no esta disponible.");
                    using var insert = new SqlCommand("""
                        INSERT dbo.Usuario (Nombre, Correo, ClaveHash, IdRol, Activo)
                        OUTPUT INSERTED.IdUsuario
                        VALUES (@nombre, @correo, @hash, @idRol, @activo);
                        """, connection, transaction);
                    insert.Parameters.Add("@nombre", SqlDbType.NVarChar, 150).Value = Name;
                    insert.Parameters.Add("@correo", SqlDbType.NVarChar, 200).Value = Email;
                    insert.Parameters.Add("@hash", SqlDbType.NVarChar, 255).Value = hash;
                    insert.Parameters.Add("@idRol", SqlDbType.TinyInt).Value = roleId!;
                    insert.Parameters.Add("@activo", SqlDbType.Bit).Value = true;
                    result.Id = (int)(await insert.ExecuteScalarAsync())!;
                    await transaction.CommitAsync();
                    result.Created = true;
                    Save(result);
                }
                catch
                {
                    if (!result.Created) await transaction.RollbackAsync();
                    throw;
                }
            }
            hash = "";
            var stored = await repository.FindByIdAsync(result.Id, CancellationToken.None);
            Require(stored is { Activo: true } && stored.Nombre == Name && stored.Correo == Email && stored.Rol == Role,
                "La cuenta se inserto, pero no pudo confirmarse su identidad y estado.");
            Require(passwords.Verify(stored!.ClaveHash, password), "La cuenta se inserto, pero fallo la verificacion del hash almacenado.");
            result.Active = true;
            result.HashVerified = true;
            Save(result);
            Console.WriteLine("Insercion SQL y compatibilidad del hash: correctas.");

            using var login = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest { Correo = Email, Contrasena = password });
            result.LoginStatus = (int)login.StatusCode;
            Require(login.StatusCode == HttpStatusCode.OK, "La cuenta existe, pero la prueba de login no devolvio 200.");
            var response = await login.Content.ReadFromJsonAsync<LoginResponse>();
            Require(response is not null && !string.IsNullOrWhiteSpace(response.Token) && Matches(response.Usuario, result.Id),
                "El contrato o la identidad de login no coincide.");
            using var meRequest = new HttpRequestMessage(HttpMethod.Get, "/api/auth/me");
            meRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", response!.Token);
            using var me = await client.SendAsync(meRequest);
            result.MeStatus = (int)me.StatusCode;
            Require(me.StatusCode == HttpStatusCode.OK, "La cuenta existe, pero /me no acepto el JWT.");
            Require(Matches(await me.Content.ReadFromJsonAsync<UsuarioDto>(), result.Id), "La identidad de /me no coincide.");
            result.JwtValidatedByApi = true;

            string wrongPassword;
            do { wrongPassword = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)); }
            while (wrongPassword == password);
            using var wrong = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest { Correo = Email, Contrasena = wrongPassword });
            result.WrongPasswordStatus = (int)wrong.StatusCode;
            Require(wrong.StatusCode == HttpStatusCode.Unauthorized, "La cuenta existe, pero la prueba de contrasena incorrecta no devolvio 401.");
            password = "";
            wrongPassword = "";
            Console.WriteLine("Login: 200. JWT validado por la API y /me: 200. Contrasena incorrecta: 401.");
            Console.WriteLine("Cuenta de prueba preparada. No se muestran ni guardan contrasena, hash ni JWT.");
            Save(result);
            return 0;
        }
        catch (Exception exception)
        {
            result.Error = exception is ProvisioningException ? exception.Message :
                exception is SqlException sql ? $"Fallo SQL (codigo {sql.Number}); no se muestran detalles internos." :
                "No se completo la operacion. Revisar conexion, certificado HTTPS y disponibilidad de la API.";
            Save(result);
            Console.Error.WriteLine(result.Error);
            Console.Error.WriteLine(result.Created ? "La cuenta ya fue insertada. No se elimina ni modifica automaticamente." : "No se inserto ninguna cuenta.");
            return 1;
        }
    }

    private static bool Matches(UsuarioDto? user, int id) =>
        user is not null && user.Id == id && user.Nombre == Name && user.Correo == Email && user.Rol == Role;

    private static void Require(bool condition, string message)
    {
        if (!condition) throw new ProvisioningException(message);
    }

    private sealed class ProvisioningException(string message) : Exception(message);

    // This report contains only the requested public account metadata and verification outcomes.
    private static void Save(Result result) => File.WriteAllText(
        Path.Combine(AppContext.BaseDirectory, "test-user-result.json"), JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true }));

    private sealed class Result
    {
        public string Nombre { get; } = Name;
        public string Correo { get; } = Email;
        public string Rol { get; } = Role;
        public int Id { get; set; }
        public bool Created { get; set; }
        public bool Active { get; set; }
        public bool HashVerified { get; set; }
        public bool JwtValidatedByApi { get; set; }
        public int? LoginStatus { get; set; }
        public int? MeStatus { get; set; }
        public int? WrongPasswordStatus { get; set; }
        public string? Error { get; set; }
    }
}
