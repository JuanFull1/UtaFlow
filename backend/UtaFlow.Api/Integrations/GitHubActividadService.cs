using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace UtaFlow.Api.Integrations;

public sealed record ActividadGitHub(
    string Tipo,
    string Titulo,
    string Url,
    string? Estado,
    DateTimeOffset? Fecha,
    string? Autor
);

public sealed record ResultadoGitHub(
    string Repositorio,
    IReadOnlyList<ActividadGitHub> Actividad,
    string? Aviso
);

// Busca en GitHub los Pull Requests y commits que mencionan el identificador
// de un cambio (por ejemplo ECR-RUT-0012). Solo lee información pública.
public sealed class GitHubActividadService
{
    // Identificador base PROYECTO-ELEMENTO-NÚMERO, por ejemplo ECR-RUT-0012.
    private static readonly Regex CodigoValido =
        new(@"^[A-Z0-9]{2,6}-[A-Z0-9]{2,6}-\d{4,10}$", RegexOptions.Compiled);

    private static readonly Regex RepoValido =
        new(@"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", RegexOptions.Compiled);

    private readonly HttpClient http;
    private readonly string repositorio;

    public GitHubActividadService(HttpClient http, IConfiguration configuracion)
    {
        this.http = http;

        var configurado = configuracion["GitHub:Repositorio"];

        repositorio = !string.IsNullOrWhiteSpace(configurado) &&
                      RepoValido.IsMatch(configurado)
            ? configurado
            : "JuanFull1/UtaFlow";

        http.BaseAddress = new Uri("https://api.github.com/");
        http.Timeout = TimeSpan.FromSeconds(8);
        http.DefaultRequestHeaders.UserAgent.Add(
            new ProductInfoHeaderValue("UtaFlow", "1.0"));
        http.DefaultRequestHeaders.Accept.Add(
            new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));

        // El token es opcional: solo aumenta el límite de consultas.
        var token = configuracion["GitHub:Token"];

        if (!string.IsNullOrWhiteSpace(token))
        {
            http.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", token);
        }
    }

    public async Task<ResultadoGitHub> BuscarAsync(
        string codigo,
        CancellationToken ct
    )
    {
        if (!CodigoValido.IsMatch(codigo))
        {
            return new ResultadoGitHub(
                repositorio, [], "El identificador del cambio no es válido.");
        }

        var actividad = new List<ActividadGitHub>();
        string? aviso = null;

        try
        {
            var consultaPr = Uri.EscapeDataString(
                $"\"{codigo}\" repo:{repositorio} is:pr");

            using (var respuesta = await http.GetAsync(
                $"search/issues?q={consultaPr}&per_page=10", ct))
            {
                if (respuesta.IsSuccessStatusCode)
                {
                    using var doc = await JsonDocument.ParseAsync(
                        await respuesta.Content.ReadAsStreamAsync(ct),
                        cancellationToken: ct);

                    foreach (var item in doc.RootElement
                        .GetProperty("items").EnumerateArray())
                    {
                        var fusionado = item.TryGetProperty("pull_request", out var pr) &&
                            pr.TryGetProperty("merged_at", out var m) &&
                            m.ValueKind == JsonValueKind.String;

                        actividad.Add(new ActividadGitHub(
                            "Pull Request",
                            Texto(item, "title") ?? "(sin título)",
                            Texto(item, "html_url") ?? "",
                            fusionado ? "fusionado" : Texto(item, "state"),
                            Fecha(item, "created_at"),
                            item.TryGetProperty("user", out var u)
                                ? Texto(u, "login") : null));
                    }
                }
                else
                {
                    aviso = "GitHub no respondió (puede ser el límite de consultas). Intenta de nuevo en un minuto.";
                }
            }

            var consultaCommit = Uri.EscapeDataString(
                $"\"{codigo}\" repo:{repositorio}");

            using (var respuesta = await http.GetAsync(
                $"search/commits?q={consultaCommit}&per_page=10", ct))
            {
                if (respuesta.IsSuccessStatusCode)
                {
                    using var doc = await JsonDocument.ParseAsync(
                        await respuesta.Content.ReadAsStreamAsync(ct),
                        cancellationToken: ct);

                    foreach (var item in doc.RootElement
                        .GetProperty("items").EnumerateArray())
                    {
                        var commit = item.GetProperty("commit");
                        var mensaje = Texto(commit, "message") ?? "";
                        var primeraLinea = mensaje.Split('\n')[0];

                        DateTimeOffset? fecha = null;
                        string? autor = null;

                        if (commit.TryGetProperty("author", out var a))
                        {
                            fecha = Fecha(a, "date");
                            autor = Texto(a, "name");
                        }

                        actividad.Add(new ActividadGitHub(
                            "Commit",
                            primeraLinea,
                            Texto(item, "html_url") ?? "",
                            null,
                            fecha,
                            autor));
                    }
                }
                else
                {
                    aviso ??= "GitHub no respondió (puede ser el límite de consultas). Intenta de nuevo en un minuto.";
                }
            }
        }
        catch (Exception ex) when (
            ex is HttpRequestException or TaskCanceledException
                or JsonException or KeyNotFoundException)
        {
            if (ct.IsCancellationRequested) throw;

            aviso = "No se pudo consultar GitHub. Revisa tu conexión a internet.";
        }

        // Solo enlaces del propio GitHub.
        var segura = actividad
            .Where(a => a.Url.StartsWith(
                "https://github.com/", StringComparison.Ordinal))
            .OrderByDescending(a => a.Fecha)
            .ToList();

        return new ResultadoGitHub(repositorio, segura, aviso);
    }

    private static string? Texto(JsonElement e, string nombre) =>
        e.TryGetProperty(nombre, out var v) && v.ValueKind == JsonValueKind.String
            ? v.GetString()
            : null;

    private static DateTimeOffset? Fecha(JsonElement e, string nombre) =>
        Texto(e, nombre) is { } t &&
        DateTimeOffset.TryParse(t, out var f)
            ? f
            : null;
}
