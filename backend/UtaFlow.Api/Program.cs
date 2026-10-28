using UtaFlow.Api;

await using var app = ApiBootstrap.Build(args);
await app.RunAsync();
