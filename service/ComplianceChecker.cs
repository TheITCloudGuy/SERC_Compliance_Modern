using System.Diagnostics;
using System.Management;
using System.Runtime.Versioning;
using System.ServiceProcess;
using Microsoft.Extensions.Logging;
using Microsoft.Win32;

namespace SERC.ComplianceService;

/// <summary>
/// Performs Windows security compliance checks using WMI and Registry.
/// </summary>
[SupportedOSPlatform("windows")]
public class ComplianceChecker
{
    private readonly ILogger<ComplianceChecker> _logger;

    public ComplianceChecker(ILogger<ComplianceChecker> logger)
    {
        _logger = logger;
    }

    public (string DeviceId, string JoinType) GetAzureAdStatus()
    {
        try
        {
            // Handle x86/x64 process architecture correctly
            string dsregPath = Environment.Is64BitProcess
                ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "dsregcmd.exe")
                : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "sysnative", "dsregcmd.exe");

            if (!File.Exists(dsregPath))
            {
                dsregPath = "dsregcmd"; // Fallback
            }

            var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = dsregPath,
                    Arguments = "/status",
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                }
            };
            process.Start();
            string output = process.StandardOutput.ReadToEnd();
            process.WaitForExit();

            string deviceId = "";
            string joinType = "";

            if (output.Contains("AzureAdJoined : YES"))
            {
                joinType = "Azure AD Joined";
            }
            else if (output.Contains("WorkplaceJoined : YES"))
            {
                joinType = "Workplace Joined";
            }

            var lines = output.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
            foreach (var line in lines)
            {
                var trimmed = line.Trim();
                if (trimmed.StartsWith("DeviceId :"))
                {
                    deviceId = trimmed.Split(':')[1].Trim();
                }
                else if (trimmed.StartsWith("WorkplaceDeviceId :"))
                {
                    var wpId = trimmed.Split(':')[1].Trim();
                    if (!string.IsNullOrEmpty(wpId) && (joinType == "Workplace Joined" || string.IsNullOrEmpty(deviceId)))
                    {
                        deviceId = wpId;
                    }
                }
            }

            return (deviceId, joinType);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get Azure AD status");
            return ("", "");
        }
    }

    public string GetSerialNumber()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT SerialNumber FROM Win32_BIOS");
            foreach (ManagementObject obj in searcher.Get())
            {
                return obj["SerialNumber"]?.ToString()?.Trim() ?? "Unknown";
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get serial number");
        }
        return "Unknown";
    }

    public bool GetBitLockerStatus()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher(
                @"root\cimv2\Security\MicrosoftVolumeEncryption",
                "SELECT ProtectionStatus FROM Win32_EncryptableVolume WHERE DriveLetter = 'C:'");

            foreach (ManagementObject volume in searcher.Get())
            {
                var status = Convert.ToInt32(volume["ProtectionStatus"]);
                if (status == 1) return true;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get BitLocker status");
        }
        return false;
    }

    public bool GetTpmStatus()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher(
                @"root\cimv2\Security\MicrosoftTpm",
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
            _logger.LogError(ex, "Failed to get TPM status");
        }
        return false;
    }

    public bool GetSecureBootStatus()
    {
        try
        {
            using var key = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Control\SecureBoot\State");
            if (key != null)
            {
                var state = (int?)key.GetValue("UEFISecureBootEnabled");
                return state == 1;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get Secure Boot status");
        }
        return false;
    }

    public bool GetFirewallStatus()
    {
        try
        {
            // Check if the firewall service is running first
            using var service = new ServiceController("MpsSvc");
            if (service.Status != ServiceControllerStatus.Running)
            {
                return false;
            }

            // Check if firewall is enabled for all profiles (Domain, Private, Public)
            string[] profileKeys = new[]
            {
                @"SYSTEM\CurrentControlSet\Services\SharedAccess\Parameters\FirewallPolicy\DomainProfile",
                @"SYSTEM\CurrentControlSet\Services\SharedAccess\Parameters\FirewallPolicy\StandardProfile",
                @"SYSTEM\CurrentControlSet\Services\SharedAccess\Parameters\FirewallPolicy\PublicProfile"
            };

            foreach (var profileKey in profileKeys)
            {
                using var key = Registry.LocalMachine.OpenSubKey(profileKey);
                if (key != null)
                {
                    var enableFirewall = key.GetValue("EnableFirewall");
                    if (enableFirewall != null && Convert.ToInt32(enableFirewall) != 1)
                    {
                        return false;
                    }
                }
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get Firewall status");
            return false;
        }
    }

    public bool GetAntivirusStatus()
    {
        try
        {
            // Check Windows Defender status
            using var searcher = new ManagementObjectSearcher(
                @"root\Microsoft\Windows\Defender",
                "SELECT * FROM MSFT_MpComputerStatus");

            foreach (ManagementObject defender in searcher.Get())
            {
                var realTimeProtection = defender["RealTimeProtectionEnabled"];
                if (realTimeProtection != null && Convert.ToBoolean(realTimeProtection))
                {
                    return true;
                }
            }
        }
        catch
        {
            // Defender WMI may not be available, try Security Center
        }

        try
        {
            // Fallback: Check Security Center for any AV product
            using var searcher = new ManagementObjectSearcher(
                @"root\SecurityCenter2",
                "SELECT * FROM AntiVirusProduct");

            foreach (ManagementObject av in searcher.Get())
            {
                var productState = Convert.ToInt32(av["productState"]);
                // Bit 4-7 represent the scanner enabled status
                // 0x10 = scanner enabled
                if ((productState & 0x1000) != 0)
                {
                    return true;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get Antivirus status");
        }

        return false;
    }
}
