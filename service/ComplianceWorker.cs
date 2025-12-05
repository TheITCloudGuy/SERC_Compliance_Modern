using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Net.Http.Json;
using System.Text.Json;

namespace SERC.ComplianceService;

/// <summary>
/// Background worker that runs compliance checks periodically and reports to the dashboard.
/// </summary>
public class ComplianceWorker : BackgroundService
{
    private readonly ILogger<ComplianceWorker> _logger;
    private readonly ComplianceChecker _complianceChecker;
    private readonly IpcServer _ipcServer;
    private readonly HttpClient _httpClient;
    
    private const string DashboardUrl = "https://serc-compliance-modern.vercel.app/api/telemetry";
    private const string EnrollUrl = "https://serc-compliance-modern.vercel.app/api/enroll/poll";
    
    // Check interval - toggle between testing and production
    // TESTING: 30 seconds
    private static readonly TimeSpan CheckInterval = TimeSpan.FromSeconds(30);
    
    // PRODUCTION: 15 minutes
    // private static readonly TimeSpan CheckInterval = TimeSpan.FromMinutes(15);
    
    private EnrollmentState? _enrollmentState;
    private ComplianceState? _previousComplianceState;
    private readonly string _enrollmentFilePath;

    public ComplianceWorker(
        ILogger<ComplianceWorker> logger,
        ComplianceChecker complianceChecker,
        IpcServer ipcServer,
        IHttpClientFactory httpClientFactory)
    {
        _logger = logger;
        _complianceChecker = complianceChecker;
        _ipcServer = ipcServer;
        _httpClient = httpClientFactory.CreateClient();
        
        // Store enrollment file in ProgramData for service access
        var programData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
        var appDataPath = Path.Combine(programData, "SERC", "ComplianceService");
        Directory.CreateDirectory(appDataPath);
        _enrollmentFilePath = Path.Combine(appDataPath, "enrollment.json");
        
        // Subscribe to enrollment updates from the tray app via IPC
        _ipcServer.EnrollmentUpdated += OnEnrollmentUpdated;
    }
    
    /// <summary>
    /// Handle enrollment updates received from the tray app via IPC.
    /// </summary>
    private void OnEnrollmentUpdated(object? sender, EnrollmentState state)
    {
        _logger.LogInformation("Received enrollment update via IPC: Enrolled={enrolled}, User={user}", 
            state.IsEnrolled, state.UserEmail);
        UpdateEnrollmentState(state);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("SERC Compliance Service starting at: {time}", DateTimeOffset.Now);
        _logger.LogInformation("Check interval set to: {interval}", CheckInterval);
        
        // Start the IPC server for communication with tray app
        _ = Task.Run(() => _ipcServer.StartAsync(stoppingToken), stoppingToken);
        
        // Load enrollment state
        LoadEnrollmentState();
        
        // Initial compliance check
        _logger.LogInformation("Running initial compliance check...");
        await RunComplianceCheckAsync(stoppingToken);
        
        // Periodic compliance checks
        _logger.LogInformation("Starting periodic check loop. Next check in {interval}", CheckInterval);
        using var timer = new PeriodicTimer(CheckInterval);
        
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                _logger.LogInformation("Waiting for next check interval ({interval})...", CheckInterval);
                await timer.WaitForNextTickAsync(stoppingToken);
                _logger.LogInformation("Timer tick - running scheduled compliance check");
                await RunComplianceCheckAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                // Expected when stopping
                _logger.LogInformation("Service cancellation requested");
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during compliance check");
            }
        }
        
        _logger.LogInformation("SERC Compliance Service stopping at: {time}", DateTimeOffset.Now);
    }

    private void LoadEnrollmentState()
    {
        try
        {
            if (File.Exists(_enrollmentFilePath))
            {
                var json = File.ReadAllText(_enrollmentFilePath);
                _enrollmentState = JsonSerializer.Deserialize<EnrollmentState>(json);
                _logger.LogInformation("Loaded enrollment state: Enrolled={enrolled}", _enrollmentState?.IsEnrolled ?? false);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load enrollment state");
        }
    }

    private void SaveEnrollmentState()
    {
        try
        {
            var json = JsonSerializer.Serialize(_enrollmentState);
            File.WriteAllText(_enrollmentFilePath, json);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save enrollment state");
        }
    }

    private async Task RunComplianceCheckAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Running compliance check at: {time}", DateTimeOffset.Now);
        
        try
        {
            // Reload enrollment state from file in case it was updated by the tray app
            // (The tray app also notifies via IPC, but this catches file-only updates)
            LoadEnrollmentState();
            
            // Check if enrolled
            if (_enrollmentState == null || !_enrollmentState.IsEnrolled)
            {
                _logger.LogInformation("Device not enrolled (checked file: {path}), skipping telemetry", _enrollmentFilePath);
                await NotifyTrayAppAsync(new ServiceMessage
                {
                    Type = "enrollment_required",
                    Timestamp = DateTime.UtcNow
                });
                return;
            }

            // Get Azure AD status - prefer cached values from agent since service runs as SYSTEM
            string azureAdDeviceId;
            string azureAdJoinType;
            
            if (!string.IsNullOrEmpty(_enrollmentState.AzureAdDeviceId) && 
                !string.IsNullOrEmpty(_enrollmentState.AzureAdJoinType))
            {
                // Use cached Azure AD info from the agent
                azureAdDeviceId = _enrollmentState.AzureAdDeviceId;
                azureAdJoinType = _enrollmentState.AzureAdJoinType;
                _logger.LogInformation("Using cached Azure AD info: {joinType}, DeviceId: {deviceId}", 
                    azureAdJoinType, azureAdDeviceId);
            }
            else
            {
                // Try direct check as fallback (may not work when running as SYSTEM)
                var aadStatus = _complianceChecker.GetAzureAdStatus();
                azureAdDeviceId = aadStatus.DeviceId;
                azureAdJoinType = aadStatus.JoinType;
                
                if (string.IsNullOrEmpty(azureAdJoinType))
                {
                    _logger.LogWarning("Device not joined to Azure AD (no cached info available). " +
                        "The agent needs to run at least once to cache Azure AD info.");
                    await NotifyTrayAppAsync(new ServiceMessage
                    {
                        Type = "aad_required",
                        Message = "Work account connection required",
                        Timestamp = DateTime.UtcNow
                    });
                    return;
                }
            }

            // Run all compliance checks
            var currentState = new ComplianceState
            {
                BitLocker = _complianceChecker.GetBitLockerStatus(),
                Tpm = _complianceChecker.GetTpmStatus(),
                SecureBoot = _complianceChecker.GetSecureBootStatus(),
                Firewall = _complianceChecker.GetFirewallStatus(),
                Antivirus = _complianceChecker.GetAntivirusStatus()
            };

            _logger.LogInformation(
                "Compliance check results - BitLocker: {bl}, TPM: {tpm}, SecureBoot: {sb}, Firewall: {fw}, Antivirus: {av}",
                currentState.BitLocker, currentState.Tpm, currentState.SecureBoot, 
                currentState.Firewall, currentState.Antivirus);

            // Check for compliance state changes
            await CheckAndNotifyComplianceChangeAsync(currentState);

            // Prepare telemetry data
            var deviceInfo = new
            {
                hostname = Environment.MachineName,
                serialNumber = _complianceChecker.GetSerialNumber(),
                osBuild = Environment.OSVersion.Version.ToString(),
                userEmail = _enrollmentState.UserEmail,
                userName = _enrollmentState.UserName,
                azureAdDeviceId = azureAdDeviceId,
                joinType = azureAdJoinType,
                checks = new
                {
                    bitlocker = currentState.BitLocker,
                    tpm = currentState.Tpm,
                    secureBoot = currentState.SecureBoot,
                    firewall = currentState.Firewall,
                    antivirus = currentState.Antivirus
                }
            };

            // Send telemetry to dashboard
            var response = await _httpClient.PostAsJsonAsync(DashboardUrl, deviceInfo, stoppingToken);
            
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Telemetry sent successfully");
            }
            else
            {
                _logger.LogWarning("Failed to send telemetry: {status}", response.StatusCode);
            }

            // Notify tray app of current state
            await NotifyTrayAppAsync(new ServiceMessage
            {
                Type = "compliance_update",
                ComplianceState = currentState,
                IsCompliant = currentState.IsFullyCompliant,
                Timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Compliance check failed");
        }
    }

    private async Task CheckAndNotifyComplianceChangeAsync(ComplianceState currentState)
    {
        if (_previousComplianceState == null)
        {
            _previousComplianceState = currentState;
            
            if (!currentState.IsFullyCompliant)
            {
                await NotifyComplianceChangeAsync(currentState, isNewNonCompliance: true);
            }
            return;
        }

        bool wasCompliant = _previousComplianceState.IsFullyCompliant;
        bool isCompliant = currentState.IsFullyCompliant;

        if (wasCompliant && !isCompliant)
        {
            await NotifyComplianceChangeAsync(currentState, isNewNonCompliance: true);
        }
        else if (!wasCompliant && isCompliant)
        {
            await NotifyComplianceChangeAsync(currentState, isNewNonCompliance: false);
        }
        else if (!isCompliant)
        {
            var newFailures = GetNewFailures(_previousComplianceState, currentState);
            if (newFailures.Count > 0)
            {
                await NotifyComplianceChangeAsync(currentState, isNewNonCompliance: true, newFailures);
            }
        }

        _previousComplianceState = currentState;
    }

    private List<string> GetNewFailures(ComplianceState previous, ComplianceState current)
    {
        var failures = new List<string>();
        
        if (previous.BitLocker && !current.BitLocker) failures.Add("BitLocker");
        if (previous.Tpm && !current.Tpm) failures.Add("TPM");
        if (previous.SecureBoot && !current.SecureBoot) failures.Add("Secure Boot");
        if (previous.Firewall && !current.Firewall) failures.Add("Firewall");
        if (previous.Antivirus && !current.Antivirus) failures.Add("Antivirus");
        
        return failures;
    }

    private async Task NotifyComplianceChangeAsync(ComplianceState state, bool isNewNonCompliance, List<string>? specificFailures = null)
    {
        var message = new ServiceMessage
        {
            Type = isNewNonCompliance ? "non_compliant" : "compliant",
            ComplianceState = state,
            IsCompliant = !isNewNonCompliance,
            FailedChecks = specificFailures ?? state.GetFailedChecks(),
            ShowNotification = true,
            Timestamp = DateTime.UtcNow
        };

        await NotifyTrayAppAsync(message);
    }

    private async Task NotifyTrayAppAsync(ServiceMessage message)
    {
        try
        {
            await _ipcServer.SendMessageAsync(message);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to notify tray app");
        }
    }

    /// <summary>
    /// Called by IPC server when tray app sends enrollment update
    /// </summary>
    public void UpdateEnrollmentState(EnrollmentState state)
    {
        _enrollmentState = state;
        SaveEnrollmentState();
        _logger.LogInformation("Enrollment state updated: Enrolled={enrolled}, User={user}", 
            state.IsEnrolled, state.UserEmail);
    }
}
