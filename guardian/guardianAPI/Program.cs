
using AppSettings;
using Handlers;
using Microsoft.AspNetCore.Authentication.Negotiate;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Repositories;
using Serilog;

var env = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");

var builder = WebApplication.CreateBuilder(args);

var configuration = builder.Configuration
    .SetBasePath(Directory.GetCurrentDirectory())
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
    // .AddJsonFile($"appsettings.{env}.json", optional: true, reloadOnChange: true)
    // .AddEnvironmentVariables()
    .Build();

var envSettings = configuration.GetSection(EnvironmentSettings.SectionName).Get<EnvironmentSettings>();
var smtpConfig = configuration.GetSection(SmtpSettings.SectionName).Get<SmtpSettings>();

var DbConnSetting = configuration.GetConnectionString("DefaultConnection");

// builder.Services.AddDbContext<WeatherDbContext>(options =>
//     options.UseSqlServer(DbConnSetting));

//repo DI
builder.Services.AddTransient<RolesRepository>();
builder.Services.AddTransient<MilestoneRepository>();
builder.Services.AddTransient<UserRepository>();
builder.Services.AddTransient<RequestRepository>();
builder.Services.AddTransient<NoticeRepository>();
builder.Services.AddTransient<WorkflowRepository>();

builder.Services.AddMemoryCache();
builder.Services.AddResponseCompression(options => {
    options.EnableForHttps = true;
});


builder.Services.AddAuthorization();
// options => {
//     options.FallbackPolicy = options.DefaultPolicy;
// });

builder.Services.AddAuthentication().AddCookie(IdentityConstants.ApplicationScheme);

// builder.Services.AddAuthentication(NegotiateDefaults.AuthenticationScheme)
//     .AddNegotiate().AddCookie("cookie");

// builder.Services.AddIdentityCore

// Add services to the container.
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var logger = new LoggerConfiguration()
    .ReadFrom.Configuration(configuration: configuration)
    .CreateLogger();

builder.Logging.ClearProviders();
builder.Logging.AddSerilog(logger);

builder.Services.Configure<FormOptions>(options =>
{
    options.ValueCountLimit = 200;
    options.ValueLengthLimit = int.MaxValue;
    options.MultipartBodyLengthLimit = int.MaxValue;
    options.MultipartHeadersLengthLimit = int.MaxValue;
});

builder.Services.Configure<IISServerOptions>(options =>
{
    options.AllowSynchronousIO = true;
    options.MaxRequestBodySize = int.MaxValue;
});

builder.Services.Configure<KestrelServerOptions>(Options => {
    Options.Limits.MaxRequestBodySize = int.MaxValue;
});

builder.Services.AddHttpContextAccessor();

builder.Services.AddAntiforgery(options =>
{
    // options.Cookie.Name = "X-CSRF-TOKEN";
    // options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    // options.Cookie.SameSite = SameSiteMode.Strict;
    // options.Cookie.HttpOnly = true;
    options.Cookie.Expiration = TimeSpan.Zero;
});

var app = builder.Build();

// actually shouldnt do this, and just not listen on http
// app.UseHttpsRedirection();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// app.UseHttpsRedirection();

if(!app.Environment.IsDevelopment()) {
    app.UseDefaultFiles(new DefaultFilesOptions
    {
        DefaultFileNames = ["index.html"]
    });
}

app.MapGet("/api/hello", () => "Hello World!");

app.Logger.LogInformation("Registering Api handlers");

app.MapGroup("/api")
    .MapTestApi()
    .MapAdminApi()
    .MapAttachmentApi()
    .MapDashboardApi()
    .MapFormApi()
    .MapMilestoneApi()
    .MapNoticeApi()
    .MapRequestApi()
    .MapRolesApi()
    .MapTemplatesApi()
    .MapWorkflowApi()
    .MapUsersApi();

app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();
app.UseAntiforgery();

app.UseEndpoints(_ => {});

app.Use((ctx, next) => {
    if(ctx.Request.Path.StartsWithSegments("/api")) {
        ctx.Response.StatusCode = 404;
        return Task.CompletedTask;
    }
    return next();
});

if(app.Environment.IsDevelopment()) {
    app.UseSwagger();
    app.UseSwaggerUI();

    app.UseSpa(config => {
        // config.Options.SourcePath = "ClientApp";
        config.UseProxyToSpaDevelopmentServer("http://localhost:5173"); //vite url
    });
}

if(!app.Environment.IsDevelopment()) {
    // app.UseSpa(config => {
    //     config.Options.SourcePath = "ClientApp";
    //     config.Options.DefaultPage = "/index.html";
    // });
    app.MapFallbackToFile("index.html");
}

app.Logger.LogInformation("Starting server");
app.Logger.LogInformation("ASPNETCORE_ENVIRONMENT={env}", env ?? "please set environment variable to 'Development', 'Staging', or 'Production'");
app.Logger.LogInformation("EmailHost={currentHost}", envSettings?.EmailHost);
app.Logger.LogInformation("SMTP settings host: {host}, port: {port}, bypass: {bypass}, usessl: {usessl}, useCreds: {useCreds}",
   smtpConfig?.Host,
   smtpConfig?.Port,
   smtpConfig?.Bypass,
   smtpConfig?.UseSsl,
   smtpConfig?.UseCredentials);

app.Run();

