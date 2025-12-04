using System.IO.Pipes;
using System.Text.Json;

namespace Agent;

/// <summary>
/// IPC Client for communicating with the SERC Compliance Service.
/// Uses named pipes for bidirectional communication.
/// </summary>
public class ServiceIpcClient : IDisposable
{
    private NamedPipeClientStream? _pipeClient;
    private StreamReader? _reader;
    private StreamWriter? _writer;
    private CancellationTokenSource? _cts;
    private Task? _readTask;
    private bool _isConnected;
    private bool _disposed;

    public const string PipeName = "SERC_Compliance_IPC";

    public event EventHandler<ServiceMessage>? MessageReceived;
    public event EventHandler? Connected;
    public event EventHandler? Disconnected;

    public bool IsConnected => _isConnected;

    /// <summary>
    /// Starts the IPC client and attempts to connect to the service.
    /// </summary>
    public async Task StartAsync()
    {
        _cts = new CancellationTokenSource();
        
        // Start connection loop in background
        _ = Task.Run(() => ConnectionLoopAsync(_cts.Token));
    }

    private async Task ConnectionLoopAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                if (!_isConnected)
                {
                    await ConnectAsync(cancellationToken);
                }

                // Read messages from service
                if (_reader != null && _isConnected)
                {
                    var line = await _reader.ReadLineAsync(cancellationToken);
                    if (line != null)
                    {
                        try
                        {
                            var message = JsonSerializer.Deserialize<ServiceMessage>(line);
                            if (message != null)
                            {
                                MessageReceived?.Invoke(this, message);
                            }
                        }
                        catch (JsonException)
                        {
                            // Invalid JSON, ignore
                        }
                    }
                    else
                    {
                        // Pipe closed
                        await DisconnectAsync();
                    }
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (IOException)
            {
                // Pipe broken, try to reconnect
                await DisconnectAsync();
                await Task.Delay(5000, cancellationToken);
            }
            catch (Exception)
            {
                await DisconnectAsync();
                await Task.Delay(5000, cancellationToken);
            }
        }
    }

    private async Task ConnectAsync(CancellationToken cancellationToken)
    {
        try
        {
            _pipeClient = new NamedPipeClientStream(
                ".",
                PipeName,
                PipeDirection.InOut,
                PipeOptions.Asynchronous);

            // Try to connect with timeout
            await _pipeClient.ConnectAsync(5000, cancellationToken);

            _reader = new StreamReader(_pipeClient);
            _writer = new StreamWriter(_pipeClient) { AutoFlush = true };
            _isConnected = true;

            Connected?.Invoke(this, EventArgs.Empty);
        }
        catch (TimeoutException)
        {
            // Service not available, will retry
            _pipeClient?.Dispose();
            _pipeClient = null;
        }
        catch (IOException)
        {
            // Connection failed
            _pipeClient?.Dispose();
            _pipeClient = null;
        }
    }

    private Task DisconnectAsync()
    {
        if (_isConnected)
        {
            _isConnected = false;
            SafeDispose(_reader);
            SafeDispose(_writer);
            SafeDispose(_pipeClient);
            _reader = null;
            _writer = null;
            _pipeClient = null;

            Disconnected?.Invoke(this, EventArgs.Empty);
        }
        return Task.CompletedTask;
    }

    /// <summary>
    /// Safely dispose an IDisposable object, catching any ObjectDisposedException.
    /// </summary>
    private static void SafeDispose(IDisposable? disposable)
    {
        if (disposable == null) return;
        
        try
        {
            disposable.Dispose();
        }
        catch (ObjectDisposedException)
        {
            // Already disposed, ignore
        }
        catch (IOException)
        {
            // Pipe broken, ignore
        }
    }

    /// <summary>
    /// Sends an enrollment update to the service.
    /// </summary>
    public async Task SendEnrollmentUpdateAsync(EnrollmentState state)
    {
        var message = new TrayMessage
        {
            Type = "enrollment_update",
            EnrollmentState = state
        };
        await SendMessageAsync(message);
    }

    /// <summary>
    /// Requests current status from the service.
    /// </summary>
    public async Task RequestStatusAsync()
    {
        var message = new TrayMessage
        {
            Type = "request_status"
        };
        await SendMessageAsync(message);
    }

    private async Task SendMessageAsync(TrayMessage message)
    {
        if (!_isConnected || _writer == null)
        {
            return;
        }

        try
        {
            var json = JsonSerializer.Serialize(message);
            await _writer.WriteLineAsync(json);
        }
        catch (IOException)
        {
            await DisconnectAsync();
        }
    }

    public void Stop()
    {
        _cts?.Cancel();
        _cts?.Dispose();
        _cts = null;
    }

    public void Dispose()
    {
        if (!_disposed)
        {
            Stop();
            SafeDispose(_reader);
            SafeDispose(_writer);
            SafeDispose(_pipeClient);
            _disposed = true;
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
