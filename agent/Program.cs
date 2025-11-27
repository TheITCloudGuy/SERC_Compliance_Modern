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
var enrollUrl = "http://localhost:3000/api/enroll/poll";

Console.WriteLine("Starting SERC Compliance Agent (Modern)...");

// 1. Enrollment Check
string enrollmentCode = "";
bool isEnrolled = false;
string userEmail = "";
string userName = "";

// Try to load existing enrollment
if (File.Exists("enrollment.json"))
{
    try
    {
        var savedState = JsonSerializer.Deserialize<EnrollmentState>(File.ReadAllText("enrollment.json"));
        if (savedState != null && savedState.IsEnrolled)
        {
            isEnrolled = true;
            userEmail = savedState.UserEmail;
            userName = savedState.UserName;
            Console.WriteLine($"Device already enrolled to: {userName} ({userEmail})");
        }
    }
    catch { }
}

if (!isEnrolled)
{
    // Generate a new code if we don't have one
    enrollmentCode = GenerateEnrollmentCode();
    Console.WriteLine("\n============================================");
    Console.WriteLine("DEVICE NOT ENROLLED");
    Console.WriteLine($"Please go to: http://localhost:3000/user/enroll");
    Console.WriteLine($"And enter code: {enrollmentCode}");
    Console.WriteLine("============================================\n");

    // Poll for enrollment
    while (!isEnrolled)
    {
        try
        {
            Console.Write(".");
            var pollData = new
            {
                serialNumber = GetSerialNumber(),
                hostname = Environment.MachineName,
                enrollmentCode = enrollmentCode,
                osBuild = GetOsVersion()
            };

            var response = await httpClient.PostAsJsonAsync(enrollUrl, pollData);
            if (response.IsSuccessStatusCode)
            {
                var result = await response.Content.ReadFromJsonAsync<EnrollmentResponse>();
                if (result?.status == "enrolled")
                {
                    isEnrolled = true;
                    userEmail = result.userEmail;
                    userName = result.userName;
                    
                    // Save state
                    var state = new EnrollmentState { IsEnrolled = true, UserEmail = userEmail, UserName = userName };
                    File.WriteAllText("enrollment.json", JsonSerializer.Serialize(state));
                    
                    Console.WriteLine($"\nSuccessfully enrolled to {userName}!");
                }
            }
        }
        catch (Exception ex)
        {
            // Console.WriteLine($"Poll error: {ex.Message}");
        }
        
        if (!isEnrolled) await Task.Delay(5000);
    }
}

// 2. Main Compliance Loop
while (true)
{
    try
    {
        Console.WriteLine($"[{DateTime.Now}] Running compliance checks...");

        var deviceInfo = new
        {
            hostname = Environment.MachineName,
            serialNumber = GetSerialNumber(),
            osBuild = GetOsVersion(),
            userEmail = userEmail,
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

string GenerateEnrollmentCode()
{
    const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var random = new Random();
    return new string(Enumerable.Repeat(chars, 6)
        .Select(s => s[random.Next(s.Length)]).ToArray());
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
    catch (Exception ex)
    {
        Console.WriteLine($"BitLocker Check Error: {ex.Message}");
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
    catch (Exception ex)
    {
        Console.WriteLine($"TPM Check Error: {ex.Message}");
    }
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

// --- Helper Classes ---
class EnrollmentState
{
    public bool IsEnrolled { get; set; }
    public string UserEmail { get; set; }
    public string UserName { get; set; }
}

class EnrollmentResponse
{
    public string status { get; set; }
    public string userEmail { get; set; }
    public string userName { get; set; }
}
