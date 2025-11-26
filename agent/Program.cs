using Azure.Identity;
using Microsoft.Graph;
using Microsoft.Graph.Models;
using System.Management;
using System.Net.Http.Json;
using System.Net.NetworkInformation;
using System.Runtime.Versioning;
using System.ServiceProcess;
using System.Text.Json;

if (!OperatingSystem.IsWindows())
{
    Console.WriteLine("This agent requires Windows.");
    return;
}

var httpClient = new HttpClient();
var dashboardUrl = "http://localhost:3000/api/telemetry";

// Configuration Constants
const string TenantId = "54efe58d-72b7-45af-9a01-30ee5f377a71";
const string ClientId = "78177e92-40a8-446f-9f84-f2f801407034";
const string AllowedGroupId = "db92ee1b-c04f-4e35-9c7c-33ca78ec6d65";

Console.WriteLine("Starting SERC Compliance Agent (Modern)...");

// 1. Authentication & User Info
Console.WriteLine("Authenticating...");
var credential = new InteractiveBrowserCredential(new InteractiveBrowserCredentialOptions
{
    TenantId = TenantId,
    ClientId = ClientId,
    RedirectUri = new Uri("http://localhost"),
    TokenCachePersistenceOptions = new TokenCachePersistenceOptions { Name = "SERC_Compliance_Modern" }
});

var graphClient = new GraphServiceClient(credential, new[] { "User.Read", "GroupMember.Read.All" });

User? me = null;
try
{
    me = await graphClient.Me.GetAsync();
    Console.WriteLine($"Signed in as: {me?.DisplayName} ({me?.UserPrincipalName})");
}
catch (Exception ex)
{
    Console.WriteLine($"Authentication failed: {ex.Message}");
    // In a real app, we might want to loop/retry or exit.
    // For now, we'll continue but user info will be missing.
}

// 2. Check Group Membership
bool isAllowed = false;
if (me != null)
{
    try
    {
        var groups = await graphClient.Me.CheckMemberGroups.PostAsync(new Microsoft.Graph.Me.CheckMemberGroups.CheckMemberGroupsPostRequestBody
        {
            GroupIds = new List<string> { AllowedGroupId }
        });
        
        isAllowed = groups?.Value?.Contains(AllowedGroupId) ?? false;
        Console.WriteLine($"Group Membership Check: {(isAllowed ? "Allowed" : "Denied")}");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Group check failed: {ex.Message}");
    }
}

// 3. Main Compliance Loop
while (true)
{
    try
    {
        Console.WriteLine($"[{DateTime.Now}] Running compliance checks...");

        var deviceInfo = new
        {
            hostname = Environment.MachineName,
            serialNumber = GetSerialNumber(), // We'll implement this
            osBuild = GetOsVersion(),
            userEmail = me?.UserPrincipalName,
            isUserAllowed = isAllowed,
            checks = new
            {
                bitlocker = GetBitLockerStatus(),
                tpm = GetTpmStatus(),
                secureBoot = GetSecureBootStatus(),
                firewall = GetFirewallStatus(),
                antivirus = GetAntivirusStatus()
            }
        };

        // Report to Dashboard
        Console.WriteLine($"Sending telemetry for {deviceInfo.hostname}...");
        // Console.WriteLine(JsonSerializer.Serialize(deviceInfo, new JsonSerializerOptions { WriteIndented = true }));

        var response = await httpClient.PostAsJsonAsync(dashboardUrl, deviceInfo);
        if (response.IsSuccessStatusCode)
        {
            Console.WriteLine("   Success: Telemetry sent.");
        }
        else
        {
            Console.WriteLine($"   Error sending telemetry: {response.StatusCode}");
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"   Error in main loop: {ex.Message}");
    }

    Console.WriteLine("Waiting 60 seconds...");
    await Task.Delay(60000);
}

// --- Helper Methods (Ported from SERC_Compliance_Kit) ---

[SupportedOSPlatform("windows")]
string GetSerialNumber()
{
    try
    {
        using var searcher = new ManagementObjectSearcher("SELECT SerialNumber FROM Win32_BIOS");
        foreach (ManagementObject obj in searcher.Get())
        {
            return obj["SerialNumber"]?.ToString()?.Trim() ?? "Unknown";
        }
    }
    catch { }
    return "Unknown";
}

[SupportedOSPlatform("windows")]
string GetOsVersion()
{
    // Simple version for now, can be enhanced
    return Environment.OSVersion.Version.ToString();
}

[SupportedOSPlatform("windows")]
bool GetBitLockerStatus()
{
    try
    {
        // Try WMI first (works on Pro/Enterprise)
        using var searcher = new ManagementObjectSearcher(@"root\cimv2\Security\MicrosoftVolumeEncryption",
            "SELECT ProtectionStatus FROM Win32_EncryptableVolume WHERE DriveLetter = 'C:'");
        
        foreach (ManagementObject volume in searcher.Get())
        {
            var status = Convert.ToInt32(volume["ProtectionStatus"]);
            if (status == 1) return true; // 1 = On
        }
    }
    catch 
    {
        // Fallback or Home edition handling could go here (manage-bde parsing), 
        // but for modern agent we prefer WMI. 
    }
    return false;
}

[SupportedOSPlatform("windows")]
bool GetTpmStatus()
{
    try
    {
        // Check if TPM is enabled and activated
        using var searcher = new ManagementObjectSearcher(@"root\cimv2\Security\MicrosoftTpm",
            "SELECT IsEnabled_InitialValue, IsActivated_InitialValue FROM Win32_Tpm");
        foreach (ManagementObject tpm in searcher.Get())
        {
            var enabled = Convert.ToBoolean(tpm["IsEnabled_InitialValue"]);
            var activated = Convert.ToBoolean(tpm["IsActivated_InitialValue"]);
            return enabled && activated;
        }
    }
    catch { }
    return false;
}

[SupportedOSPlatform("windows")]
bool GetSecureBootStatus()
{
    // Secure Boot is hard to get via WMI directly without high privileges or specific namespace.
    // The old app used PowerShell `Confirm-SecureBootUEFI`.
    // We can try reading the registry key: HKLM\System\CurrentControlSet\Control\SecureBoot\State
    try
    {
        using var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Control\SecureBoot\State");
        if (key != null)
        {
            var state = (int?)key.GetValue("UEFISecureBootEnabled");
            return state == 1;
        }
    }
    catch { }
    return false;
}

[SupportedOSPlatform("windows")]
bool GetFirewallStatus()
{
    try
    {
        // Check MpsSvc service
        using var service = new ServiceController("MpsSvc");
        return service.Status == ServiceControllerStatus.Running;
    }
    catch { return false; }
}

[SupportedOSPlatform("windows")]
bool GetAntivirusStatus()
{
    try
    {
        using var searcher = new ManagementObjectSearcher(@"root\SecurityCenter2", "SELECT * FROM AntiVirusProduct");
        foreach (ManagementObject av in searcher.Get())
        {
            // 3rd party AVs register here. Defender also registers here.
            // If we find ANY registered product, we assume some protection is present.
            // We can check 'productState' for more details (enabled/updated).
            var state = Convert.ToInt32(av["productState"]);
            // Simple check: if it exists, return true. 
            // A more robust check would parse the state hex.
            return true;
        }
    }
    catch { }
    return false;
}
