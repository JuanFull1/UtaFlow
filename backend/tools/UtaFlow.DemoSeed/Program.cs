
using System.Data;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.SqlClient;

// Solo se permite ejecutar en desarrollo.
if (Environment.GetEnvironmentVariable(
        "ASPNETCORE_ENVIRONMENT") != "Development" ||
    Environment.GetEnvironmentVariable(
        "UTAFLOW_DEMO_SETUP") != "CONFIRMADO")
{
    Console.WriteLine(
        "Herramienta disponible solo para desarrollo."
    );
    return;
}

var cadena = Environment.GetEnvironmentVariable(
    "ConnectionStrings__UtaFlow"
);

if (string.IsNullOrWhiteSpace(cadena))
{
    Console.WriteLine(
        "No está configurada la conexión UtaFlow."
    );
    return;
}

var opciones = new SqlConnectionStringBuilder(cadena);

if (!string.Equals(
        opciones.InitialCatalog,
        "UtaFlow",
        StringComparison.OrdinalIgnoreCase))
{
    Console.WriteLine(
        "Solo se permite trabajar sobre la base UtaFlow."
    );
    return;
}

string[] correos =
[
    "experto1@changeflow.test",
    "experto2@changeflow.test",
    "experto3@changeflow.test",
    "comite1@changeflow.test",
    "comite2@changeflow.test",
    "comite3@changeflow.test"
];

Console.WriteLine(
    "Configuración de cuentas de demostración de UtaFlow."
);

Console.Write(
    "Introduce la contraseña para las seis cuentas: "
);

var contrasena = LeerContrasena();

if (contrasena.Length < 12 || contrasena.Length > 128)
{
    Console.WriteLine(
        "La contraseña debe tener entre 12 y 128 caracteres."
    );
    return;
}

var hasher = new PasswordHasher<object>();

await using var conexion = new SqlConnection(cadena);
await conexion.OpenAsync();

await using var transaccion =
    (SqlTransaction)await conexion.BeginTransactionAsync();

foreach (var correo in correos)
{
    // Cada usuario obtiene un hash con su propia sal.
    var hash = hasher.HashPassword(
        new object(),
        contrasena
    );

    await using var comando = new SqlCommand(
        """
        UPDATE dbo.Usuario
        SET ClaveHash = @Hash
        WHERE Correo = @Correo
          AND Activo = 1;

        SELECT @@ROWCOUNT;
        """,
        conexion,
        transaccion
    );

    comando.Parameters.Add(
        "@Hash",
        SqlDbType.NVarChar,
        255
    ).Value = hash;

    comando.Parameters.Add(
        "@Correo",
        SqlDbType.NVarChar,
        200
    ).Value = correo;

    var actualizados = Convert.ToInt32(
        await comando.ExecuteScalarAsync()
    );

    if (actualizados != 1)
    {
        throw new InvalidOperationException(
            $"No se encontró la cuenta activa: {correo}"
        );
    }

    Console.WriteLine(
        $"Configuración preparada: {correo}"
    );
}

await transaccion.CommitAsync();

Console.WriteLine();
Console.WriteLine(
    "Las seis cuentas tienen hashes de contraseña guardados."
);

static string LeerContrasena()
{
    var texto = new StringBuilder();

    while (true)
    {
        var tecla = Console.ReadKey(intercept: true);

        if (tecla.Key == ConsoleKey.Enter)
        {
            Console.WriteLine();
            break;
        }

        if (tecla.Key == ConsoleKey.Backspace)
        {
            if (texto.Length > 0)
                texto.Length--;

            continue;
        }

        if (!char.IsControl(tecla.KeyChar))
            texto.Append(tecla.KeyChar);
    }

    return texto.ToString();
}
