using System.Management;
using System.Net.Http.Json;
using System.ServiceProcess;
using System.Text.Json;
using System.Runtime.Versioning;
using System.Drawing;
using System.Windows.Forms;

namespace Agent;

public class MainForm : Form
{
    // UI Controls
    private Panel headerPanel = null!;
    private Label appTitleLabel = null!;
    private Label subTitleLabel = null!;
    
    private Panel mainContainer = null!;
    private Panel statusCard = null!;
    private Label statusIconLabel = null!;
    private Label statusLabel = null!;
    
    private Label codeLabel = null!;
    private Label infoLabel = null!;
    private Label detailLabel = null!;
    
    // Logic Fields
    private System.Windows.Forms.Timer? complianceTimer;
    private System.Windows.Forms.Timer? enrollmentTimer;
    
    private HttpClient httpClient = new HttpClient();
    private const string DashboardUrl = "http://localhost:3000/api/telemetry";
    private const string EnrollUrl = "http://localhost:3000/api/enroll/poll";
    
    private string enrollmentCode = "";
    private bool isEnrolled = false;
    private string userEmail = "";
    private string userName = "";

    public MainForm()
    {
        InitializeComponent();
        InitializeLogic();
    }

    private void InitializeComponent()
    {
        // Form Setup
        this.Text = "SERC Compliance Agent";
        this.Size = new Size(450, 500);
        this.FormBorderStyle = FormBorderStyle.FixedSingle;
        this.MaximizeBox = false;
        this.StartPosition = FormStartPosition.CenterScreen;
        this.BackColor = Color.FromArgb(240, 242, 245); // Modern light gray
        this.Font = new Font("Segoe UI", 9F, FontStyle.Regular, GraphicsUnit.Point);

        // Header
        headerPanel = new Panel
        {
            Dock = DockStyle.Top,
            Height = 80,
            BackColor = Color.FromArgb(33, 37, 41), // Dark header
            Padding = new Padding(20)
        };

        appTitleLabel = new Label
        {
            Text = "SERC Compliance",
            Font = new Font("Segoe UI", 16, FontStyle.Bold),
            ForeColor = Color.White,
            AutoSize = true,
            Location = new Point(20, 15)
        };

        subTitleLabel = new Label
        {
            Text = "Device Health Agent",
            Font = new Font("Segoe UI", 10, FontStyle.Regular),
            ForeColor = Color.FromArgb(173, 181, 189),
            AutoSize = true,
            Location = new Point(22, 45)
        };

        headerPanel.Controls.Add(appTitleLabel);
        headerPanel.Controls.Add(subTitleLabel);

        // Main Container
        mainContainer = new Panel
        {
            Dock = DockStyle.Fill,
            Padding = new Padding(30)
        };

        // Status Card (Panel)
        statusCard = new Panel
        {
            Size = new Size(375, 250),
            Location = new Point(30, 30),
            BackColor = Color.White,
        };
        
        // Status Icon
        statusIconLabel = new Label
        {
            Text = "●", 
            Font = new Font("Segoe UI", 20),
            AutoSize = true,
            Location = new Point(20, 20),
            ForeColor = Color.Gray
        };

        statusLabel = new Label
        {
            Text = "Checking status...",
            Font = new Font("Segoe UI", 14, FontStyle.Bold),
            AutoSize = true,
            Location = new Point(70, 22),
            ForeColor = Color.FromArgb(33, 37, 41)
        };

        codeLabel = new Label
        {
            Text = "",
            Font = new Font("Consolas", 32, FontStyle.Bold),
            AutoSize = false,
            TextAlign = ContentAlignment.MiddleCenter,
            Size = new Size(335, 80),
            Location = new Point(20, 70),
            ForeColor = Color.FromArgb(0, 120, 212)
        };

        infoLabel = new Label
        {
            Text = "",
            Font = new Font("Segoe UI", 10),
            AutoSize = false,
            TextAlign = ContentAlignment.TopCenter,
            Size = new Size(335, 80),
            Location = new Point(20, 160),
            ForeColor = Color.FromArgb(108, 117, 125)
        };

        statusCard.Controls.Add(statusIconLabel);
        statusCard.Controls.Add(statusLabel);
        statusCard.Controls.Add(codeLabel);
        statusCard.Controls.Add(infoLabel);

        // Detail Label (Footer)
        detailLabel = new Label
        {
            Text = "Initializing...",
            Font = new Font("Segoe UI", 8),
            AutoSize = false,
            TextAlign = ContentAlignment.MiddleCenter,
            Dock = DockStyle.Bottom,
            Height = 40,
            ForeColor = Color.Gray,
            BackColor = Color.Transparent
        };

        mainContainer.Controls.Add(statusCard);
        mainContainer.Controls.Add(detailLabel);

        this.Controls.Add(mainContainer);
        this.Controls.Add(headerPanel);
    }

    private void InitializeLogic()
    {
        // Load existing enrollment
        if (File.Exists("enrollment.json"))
        {
            try
            {
                var savedState = JsonSerializer.Deserialize<EnrollmentState>(File.ReadAllText("enrollment.json"));
                if (savedState != null && savedState.IsEnrolled)
                {
                    isEnrolled = true;
                    userEmail = savedState.UserEmail ?? "";
                    userName = savedState.UserName ?? "";
                }
            }
            catch { }
        }

        if (isEnrolled)
        {
            ShowEnrolledState();
            StartComplianceLoop();
        }
        else
        {
            ShowEnrollmentState();
            StartEnrollmentPolling();
        }
    }

    private void ShowEnrollmentState()
    {
        enrollmentCode = GenerateEnrollmentCode();
        
        statusIconLabel.Text = "⚠"; // Warning sign
        statusIconLabel.ForeColor = Color.FromArgb(220, 53, 69); // Red
        
        statusLabel.Text = "Device Not Enrolled";
        statusLabel.ForeColor = Color.FromArgb(220, 53, 69);
        
        codeLabel.Text = enrollmentCode;
        codeLabel.ForeColor = Color.FromArgb(33, 37, 41); // Dark text for code
        codeLabel.Font = new Font("Consolas", 32, FontStyle.Bold);

        infoLabel.Text = "Please go to http://localhost:3000/user/enroll\nand enter the code above.";
    }

    private void ShowEnrolledState()
    {
        statusIconLabel.Text = "✓"; // Checkmark
        statusIconLabel.ForeColor = Color.FromArgb(25, 135, 84); // Green
        
        statusLabel.Text = "Device Enrolled";
        statusLabel.ForeColor = Color.FromArgb(25, 135, 84);
        
        codeLabel.Text = "Active";
        codeLabel.Font = new Font("Segoe UI", 24, FontStyle.Bold);
        codeLabel.ForeColor = Color.FromArgb(25, 135, 84);
        
        infoLabel.Text = $"Assigned to: {userName}\n({userEmail})";
    }

    private void StartEnrollmentPolling()
    {
        enrollmentTimer = new System.Windows.Forms.Timer();
        enrollmentTimer.Interval = 5000; // 5 seconds
        enrollmentTimer.Tick += async (s, e) => await CheckEnrollment();
        enrollmentTimer.Start();
    }

    private async Task CheckEnrollment()
    {
        try
        {
            var pollData = new
            {
                serialNumber = GetSerialNumber(),
                hostname = Environment.MachineName,
                enrollmentCode = enrollmentCode,
                osBuild = GetOsVersion()
            };

            var response = await httpClient.PostAsJsonAsync(EnrollUrl, pollData);
            if (response.IsSuccessStatusCode)
            {
                var result = await response.Content.ReadFromJsonAsync<EnrollmentResponse>();
                if (result?.status == "enrolled")
                {
                    isEnrolled = true;
                    userEmail = result.userEmail ?? "";
                    userName = result.userName ?? "";
                    
                    // Save state
                    var state = new EnrollmentState { IsEnrolled = true, UserEmail = userEmail, UserName = userName };
                    File.WriteAllText("enrollment.json", JsonSerializer.Serialize(state));
                    
                    enrollmentTimer?.Stop();
                    ShowEnrolledState();
                    StartComplianceLoop();
                }
            }
        }
        catch (Exception ex)
        {
            detailLabel.Text = $"Enrollment poll error: {ex.Message}";
        }
    }

    private void StartComplianceLoop()
    {
        // Run immediately then every 60s
        _ = RunComplianceCheck();
        
        complianceTimer = new System.Windows.Forms.Timer();
        complianceTimer.Interval = 60000; // 60 seconds
        complianceTimer.Tick += async (s, e) => await RunComplianceCheck();
        complianceTimer.Start();
    }

    private async Task RunComplianceCheck()
    {
        try
        {
            detailLabel.Text = $"Last check: {DateTime.Now.ToShortTimeString()} - Running...";
            
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

            var response = await httpClient.PostAsJsonAsync(DashboardUrl, deviceInfo);
            if (response.IsSuccessStatusCode)
            {
                detailLabel.Text = $"Last check: {DateTime.Now.ToShortTimeString()} - Sent successfully";
            }
            else
            {
                detailLabel.Text = $"Last check: {DateTime.Now.ToShortTimeString()} - Failed ({response.StatusCode})";
            }
        }
        catch (Exception ex)
        {
            detailLabel.Text = $"Error: {ex.Message}";
        }
    }

    private string GenerateEnrollmentCode()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var random = new Random();
        return new string(Enumerable.Repeat(chars, 6)
            .Select(s => s[random.Next(s.Length)]).ToArray());
    }

    // --- Helper Methods ---

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
        return Environment.OSVersion.Version.ToString();
    }

    [SupportedOSPlatform("windows")]
    bool GetBitLockerStatus()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher(@"root\cimv2\Security\MicrosoftVolumeEncryption",
                "SELECT ProtectionStatus FROM Win32_EncryptableVolume WHERE DriveLetter = 'C:'");
            
            foreach (ManagementObject volume in searcher.Get())
            {
                var status = Convert.ToInt32(volume["ProtectionStatus"]);
                if (status == 1) return true;
            }
        }
        catch { }
        return false;
    }

    [SupportedOSPlatform("windows")]
    bool GetTpmStatus()
    {
        try
        {
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
                return true;
            }
        }
        catch { }
        return false;
    }
}

class EnrollmentState
{
    public bool IsEnrolled { get; set; }
    public string? UserEmail { get; set; }
    public string? UserName { get; set; }
}

class EnrollmentResponse
{
    public string? status { get; set; }
    public string? userEmail { get; set; }
    public string? userName { get; set; }
}
