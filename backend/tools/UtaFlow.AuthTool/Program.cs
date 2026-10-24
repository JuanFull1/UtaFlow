using System.Text;
using Microsoft.Data.SqlClient;
using UtaFlow.Infrastructure.Authentication;

if (args is ["check-db"])
{
    try
    {
        var connections = new SqlConnectionFactory(
            Environment.GetEnvironmentVariable("ConnectionStrings__UtaFlow") ?? "",
            Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == "Development");
        // An impossible identity tests connectivity, column names and JOIN without changing data.
        _ = await new SqlUsuarioRepository(connections).FindByIdAsync(0, CancellationToken.None);
        Console.WriteLine("Conexion y consulta Usuario/Rol correctas. No se modificaron datos.");
        return 0;
    }
    catch (Exception ex) when (ex is SqlException or InvalidOperationException)
    {
        Console.Error.WriteLine(ex is SqlException sql
            ? $"No fue posible consultar SQL Server (codigo {sql.Number}). Revise servidor, acceso y certificado."
            : ex.Message);
        return 1;
    }
}

if (args is not ["hash"] || Console.IsInputRedirected)
{
    Console.Error.WriteLine("Uso: UtaFlow.AuthTool hash | check-db. El hash requiere una consola interactiva.");
    return 1;
}

Console.Write("Contrasena (12-128 caracteres, entrada oculta): ");
var password = ReadPassword();
Console.Write("Confirmar contrasena: ");
var confirmation = ReadPassword();
if (password.Length is < 12 or > 128 || password != confirmation)
{
    Console.Error.WriteLine("La longitud o la confirmacion no es valida.");
    return 1;
}
Console.WriteLine(new IdentityPasswordService().Hash(password));
return 0;

static string ReadPassword()
{
    var buffer = new StringBuilder();
    while (true)
    {
        var key = Console.ReadKey(intercept: true);
        if (key.Key == ConsoleKey.Enter) { Console.WriteLine(); return buffer.ToString(); }
        if (key.Key == ConsoleKey.Backspace && buffer.Length > 0) buffer.Length--;
        else if (!char.IsControl(key.KeyChar) && buffer.Length < 129) buffer.Append(key.KeyChar);
    }
}
