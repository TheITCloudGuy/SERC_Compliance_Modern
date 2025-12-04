using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.EventLog;

namespace SERC.ComplianceService;

public class Program
{
    public static void Main(string[] args)
    {
        var builder = Host.CreateApplicationBuilder(args);
        
        // Configure Windows Service
        builder.Services.AddWindowsService(options =>
        {
            options.ServiceName = "SERC Compliance Service";
        });

        // Configure logging
        builder.Logging.AddEventLog(settings =>
        {
            settings.SourceName = "SERC Compliance Service";
            settings.LogName = "Application";
        });

        // Add our worker service
        builder.Services.AddHostedService<ComplianceWorker>();
        
        // Add shared services
        builder.Services.AddSingleton<ComplianceChecker>();
        builder.Services.AddSingleton<IpcServer>();
        builder.Services.AddHttpClient();

        var host = builder.Build();
        host.Run();
    }
}
