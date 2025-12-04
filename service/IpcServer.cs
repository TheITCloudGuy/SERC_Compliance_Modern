using System.IO.Pipes;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace SERC.ComplianceService;

/// <summary>
/// Named pipe server for IPC between Windows Service and Tray Application.
/// </summary>
public class IpcServer
{
    private readonly ILogger<IpcServer> _logger;
    private readonly List<NamedPipeServerStream> _connectedClients = new();
    private readonly object _clientsLock = new();
    
    public const string PipeName = "SERC_Compliance_IPC";

    public event EventHandler<EnrollmentState>? EnrollmentUpdated;

    public IpcServer(ILogger<IpcServer> logger)
    {
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("IPC Server starting on pipe: {pipe}", PipeName);

        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                var pipeServer = new NamedPipeServerStream(
                    PipeName,
                    PipeDirection.InOut,
                    NamedPipeServerStream.MaxAllowedServerInstances,
                    PipeTransmissionMode.Message,
                    PipeOptions.Asynchronous);

                await pipeServer.WaitForConnectionAsync(cancellationToken);
                
                lock (_clientsLock)
                {
                    _connectedClients.Add(pipeServer);
                }

                _logger.LogInformation("Tray app connected to IPC server");

                // Handle incoming messages from this client
                _ = Task.Run(() => HandleClientAsync(pipeServer, cancellationToken), cancellationToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error accepting IPC connection");
                await Task.Delay(1000, cancellationToken);
            }
        }
    }

    private async Task HandleClientAsync(NamedPipeServerStream pipeServer, CancellationToken cancellationToken)
    {
        try
        {
            using var reader = new StreamReader(pipeServer);
            
            while (pipeServer.IsConnected && !cancellationToken.IsCancellationRequested)
            {
                var line = await reader.ReadLineAsync(cancellationToken);
                if (line == null) break;

                try
                {
                    var message = JsonSerializer.Deserialize<TrayMessage>(line);
                    if (message != null)
                    {
                        await HandleTrayMessageAsync(message);
                    }
                }
                catch (JsonException ex)
                {
                    _logger.LogWarning(ex, "Invalid JSON from tray app");
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error handling IPC client");
        }
        finally
        {
            lock (_clientsLock)
            {
                _connectedClients.Remove(pipeServer);
            }
            pipeServer.Dispose();
            _logger.LogInformation("Tray app disconnected from IPC server");
        }
    }

    private Task HandleTrayMessageAsync(TrayMessage message)
    {
        _logger.LogInformation("Received message from tray app: {type}", message.Type);

        switch (message.Type)
        {
            case "enrollment_update":
                if (message.EnrollmentState != null)
                {
                    EnrollmentUpdated?.Invoke(this, message.EnrollmentState);
                }
                break;

            case "request_status":
                // Trigger immediate compliance check
                _logger.LogInformation("Tray app requested status update");
                break;
        }

        return Task.CompletedTask;
    }

    public async Task SendMessageAsync(ServiceMessage message)
    {
        var json = JsonSerializer.Serialize(message) + "\n";
        var bytes = System.Text.Encoding.UTF8.GetBytes(json);

        List<NamedPipeServerStream> clientsCopy;
        lock (_clientsLock)
        {
            clientsCopy = _connectedClients.ToList();
        }

        foreach (var client in clientsCopy)
        {
            try
            {
                if (client.IsConnected)
                {
                    await client.WriteAsync(bytes);
                    await client.FlushAsync();
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send message to client");
            }
        }
    }
}

/// <summary>
/// Message sent from service to tray app.
/// </summary>
public class ServiceMessage
{
    public string Type { get; set; } = "";
    public string? Message { get; set; }
    public ComplianceState? ComplianceState { get; set; }
    public bool IsCompliant { get; set; }
    public List<string>? FailedChecks { get; set; }
    public bool ShowNotification { get; set; }
    public DateTime Timestamp { get; set; }
}

/// <summary>
/// Message sent from tray app to service.
/// </summary>
public class TrayMessage
{
    public string Type { get; set; } = "";
    public EnrollmentState? EnrollmentState { get; set; }
}
