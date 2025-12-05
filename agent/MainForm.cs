using System.Management;
using System.Net.Http.Json;
using System.ServiceProcess;
using System.Text.Json;
using System.Runtime.Versioning;
using System.Drawing;
using System.Windows.Forms;
using System.Runtime.InteropServices;
using Windows.Security.Authentication.Web.Core;
using Windows.Security.Credentials;
using Windows.UI.Notifications;
using Windows.Data.Xml.Dom;
using System.IO;
using System.Linq;

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
    private Button fixAccountButton = null!;
    
    // System Tray
    private NotifyIcon trayIcon = null!;
    private ContextMenuStrip trayMenu = null!;
    private bool _forceClose = false;
    
    // Logic Fields
    private System.Windows.Forms.Timer? complianceTimer;
    private System.Windows.Forms.Timer? enrollmentTimer;
    
    private HttpClient httpClient = new HttpClient();
    private const string DashboardUrl = "https://serc-compliance-modern.vercel.app/api/telemetry";
    private const string EnrollUrl = "https://serc-compliance-modern.vercel.app/api/enroll/poll";
    
    // Compliance check interval: 30 seconds (for testing - change to 30 * 60 * 1000 for production)
    private const int ComplianceCheckIntervalMs = 30 * 1000; // 30 seconds for testing
    
    // Enrollment file path in ProgramData (shared with Windows Service)
    private static readonly string EnrollmentFilePath = GetEnrollmentFilePath();
    
    private string enrollmentCode = "";
    private bool isEnrolled = false;
    private string userEmail = "";
    private string userName = "";
    
    // Track previous compliance state to detect changes
    private ComplianceState? previousComplianceState;
    
    // IPC client for service communication
    private ServiceIpcClient? _ipcClient;
    private bool _serviceConnected = false;
    
    /// <summary>
    /// Get the enrollment file path in ProgramData (shared location for service and tray app).
    /// </summary>
    private static string GetEnrollmentFilePath()
    {
        var programData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
        var appDataPath = Path.Combine(programData, "SERC", "ComplianceService");
        
        // Ensure directory exists
        if (!Directory.Exists(appDataPath))
        {
            Directory.CreateDirectory(appDataPath);
        }
        
        return Path.Combine(appDataPath, "enrollment.json");
    }

    public MainForm()
    {
        InitializeComponent();
        InitializeTrayIcon();
        InitializeLogic();
        InitializeServiceConnection();
    }

    private void InitializeTrayIcon()
    {
        // Load embedded icon for form and tray
        try
        {
            var assembly = System.Reflection.Assembly.GetExecutingAssembly();
            using var stream = assembly.GetManifestResourceStream("SERC_Compliance_Agent.app.ico");
            if (stream != null)
            {
                this.Icon = new Icon(stream);
            }
        }
        catch
        {
            // Icon loading failed, form will use default
        }
        
        // Create context menu for tray icon
        trayMenu = new ContextMenuStrip();
        
        var showItem = new ToolStripMenuItem("Show");
        showItem.Click += (s, e) => {
            this.Show();
            this.WindowState = FormWindowState.Normal;
            this.Activate();
        };
        
        var exitItem = new ToolStripMenuItem("Exit");
        exitItem.Click += (s, e) => {
            _forceClose = true;
            Application.Exit();
        };
        
        trayMenu.Items.Add(showItem);
        trayMenu.Items.Add(new ToolStripSeparator());
        trayMenu.Items.Add(exitItem);
        
        // Create tray icon
        trayIcon = new NotifyIcon
        {
            Text = "SERC Compliance Agent",
            ContextMenuStrip = trayMenu,
            Visible = true
        };
        
        // Use form icon for tray, fallback to Shield
        trayIcon.Icon = this.Icon ?? SystemIcons.Shield;
        
        // Double-click to show window
        trayIcon.DoubleClick += (s, e) => {
            this.Show();
            this.WindowState = FormWindowState.Normal;
            this.Activate();
        };
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        // If force close (from tray menu Exit), actually close the app
        if (_forceClose)
        {
            trayIcon?.Dispose();
            _ipcClient?.Dispose();
            base.OnFormClosing(e);
            return;
        }
        
        // Otherwise, minimize to tray instead of closing
        if (e.CloseReason == CloseReason.UserClosing)
        {
            e.Cancel = true;
            this.Hide();
            
            // Show balloon tip to inform user
            trayIcon?.ShowBalloonTip(
                2000,
                "SERC Compliance Agent",
                "The agent is still running in the background.",
                ToolTipIcon.Info);
        }
        else
        {
            trayIcon?.Dispose();
            _ipcClient?.Dispose();
            base.OnFormClosing(e);
        }
    }

    private void InitializeComponent()
    {
        // === COLOR PALETTE ===
        var bgColor = Color.FromArgb(248, 250, 252);           // Light background
        var headerBg = Color.FromArgb(15, 23, 42);             // Dark slate header
        var cardBg = Color.White;
        var accentTeal = Color.FromArgb(13, 148, 136);         // Teal accent
        var accentBlue = Color.FromArgb(59, 130, 246);         // Blue accent
        var textPrimary = Color.FromArgb(30, 41, 59);          // Dark text
        var textSecondary = Color.FromArgb(100, 116, 139);     // Muted text
        var successColor = Color.FromArgb(34, 197, 94);        // Green
        var warningColor = Color.FromArgb(245, 158, 11);       // Amber
        var errorColor = Color.FromArgb(239, 68, 68);          // Red

        // === FORM SETUP ===
        this.Text = "SERC Compliance Agent";
        this.Size = new Size(420, 520);
        this.FormBorderStyle = FormBorderStyle.FixedSingle;
        this.MaximizeBox = false;
        this.StartPosition = FormStartPosition.CenterScreen;
        this.BackColor = bgColor;
        this.Font = new Font("Segoe UI", 9F, FontStyle.Regular, GraphicsUnit.Point);

        // === HEADER PANEL ===
        headerPanel = new Panel
        {
            Dock = DockStyle.Top,
            Height = 72,
            BackColor = headerBg,
        };

        // Header content container for centering
        var headerContent = new Panel
        {
            Size = new Size(380, 50),
            Location = new Point(20, 11),
            BackColor = Color.Transparent
        };

        appTitleLabel = new Label
        {
            Text = "SERC Compliance",
            Font = new Font("Segoe UI Semibold", 15, FontStyle.Bold),
            ForeColor = Color.White,
            AutoSize = true,
            Location = new Point(0, 2)
        };

        subTitleLabel = new Label
        {
            Text = "Device Health Agent",
            Font = new Font("Segoe UI", 9, FontStyle.Regular),
            ForeColor = Color.FromArgb(148, 163, 184), // Slate 400
            AutoSize = true,
            Location = new Point(2, 28)
        };

        headerContent.Controls.Add(appTitleLabel);
        headerContent.Controls.Add(subTitleLabel);
        headerPanel.Controls.Add(headerContent);

        // === MAIN CONTAINER ===
        mainContainer = new Panel
        {
            Dock = DockStyle.Fill,
            BackColor = bgColor,
            Padding = new Padding(24, 24, 24, 16)
        };

        // === STATUS CARD ===
        statusCard = new Panel
        {
            Size = new Size(372, 320),
            Location = new Point(24, 16),
            BackColor = cardBg
        };
        
        // Add subtle border to card
        statusCard.Paint += (s, e) => {
            using var pen = new Pen(Color.FromArgb(226, 232, 240), 1);
            e.Graphics.DrawRectangle(pen, 0, 0, statusCard.Width - 1, statusCard.Height - 1);
        };

        // === STATUS HEADER ROW ===
        var statusRow = new Panel
        {
            Size = new Size(340, 40),
            Location = new Point(16, 20),
            BackColor = Color.Transparent
        };

        statusIconLabel = new Label
        {
            Text = "●",
            Font = new Font("Segoe UI", 18, FontStyle.Bold),
            Size = new Size(36, 36),
            TextAlign = ContentAlignment.MiddleCenter,
            Location = new Point(0, 0),
            ForeColor = textSecondary
        };

        statusLabel = new Label
        {
            Text = "Checking status...",
            Font = new Font("Segoe UI Semibold", 13, FontStyle.Bold),
            AutoSize = true,
            Location = new Point(40, 8),
            ForeColor = textPrimary
        };

        statusRow.Controls.Add(statusIconLabel);
        statusRow.Controls.Add(statusLabel);

        // === DIVIDER LINE ===
        var divider = new Panel
        {
            Size = new Size(340, 1),
            Location = new Point(16, 70),
            BackColor = Color.FromArgb(226, 232, 240)
        };

        // === MAIN CONTENT AREA ===
        codeLabel = new Label
        {
            Text = "",
            Font = new Font("Consolas", 36, FontStyle.Bold),
            AutoSize = false,
            TextAlign = ContentAlignment.MiddleCenter,
            Size = new Size(340, 90),
            Location = new Point(16, 85),
            ForeColor = accentTeal
        };

        infoLabel = new Label
        {
            Text = "",
            Font = new Font("Segoe UI", 10),
            AutoSize = false,
            TextAlign = ContentAlignment.TopCenter,
            Size = new Size(340, 60),
            Location = new Point(16, 180),
            ForeColor = textSecondary
        };

        // === ACTION BUTTON ===
        fixAccountButton = new Button
        {
            Text = "Connect Work Account",
            Size = new Size(220, 44),
            Location = new Point(76, 250),
            BackColor = accentBlue,
            ForeColor = Color.White,
            FlatStyle = FlatStyle.Flat,
            Font = new Font("Segoe UI Semibold", 10, FontStyle.Bold),
            Visible = false,
            Cursor = Cursors.Hand
        };
        fixAccountButton.FlatAppearance.BorderSize = 0;
        fixAccountButton.FlatAppearance.MouseOverBackColor = Color.FromArgb(37, 99, 235);
        fixAccountButton.Click += (s, e) => ConnectToWorkAccount();

        // Add controls to card
        statusCard.Controls.Add(statusRow);
        statusCard.Controls.Add(divider);
        statusCard.Controls.Add(codeLabel);
        statusCard.Controls.Add(infoLabel);
        statusCard.Controls.Add(fixAccountButton);

        // === FOOTER / DETAIL LABEL ===
        detailLabel = new Label
        {
            Text = "Initializing...",
            Font = new Font("Segoe UI", 8),
            AutoSize = false,
            TextAlign = ContentAlignment.MiddleCenter,
            Dock = DockStyle.Bottom,
            Height = 32,
            ForeColor = textSecondary,
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
        if (File.Exists(EnrollmentFilePath))
        {
            try
            {
                var savedState = JsonSerializer.Deserialize<EnrollmentState>(File.ReadAllText(EnrollmentFilePath));
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
            // Attempt to refresh user info if missing
            if (string.IsNullOrEmpty(userName))
            {
                _ = RefreshEnrollmentInfo();
            }

            ShowEnrolledState();
            StartComplianceLoop();
        }
        else
        {
            ShowEnrollmentState();
            StartEnrollmentPolling();
        }
    }

    /// <summary>
    /// Initialize connection to the SERC Compliance Service for real-time updates.
    /// </summary>
    private void InitializeServiceConnection()
    {
        _ipcClient = new ServiceIpcClient();
        
        _ipcClient.Connected += (s, e) =>
        {
            _serviceConnected = true;
            if (this.IsHandleCreated)
            {
                this.BeginInvoke((MethodInvoker)delegate
                {
                    detailLabel.Text = "Connected to Compliance Service";
                });
            }
        };

        _ipcClient.Disconnected += (s, e) =>
        {
            _serviceConnected = false;
            if (this.IsHandleCreated)
            {
                this.BeginInvoke((MethodInvoker)delegate
                {
                    detailLabel.Text = "Service disconnected - running standalone";
                });
            }
        };

        _ipcClient.MessageReceived += (s, msg) =>
        {
            HandleServiceMessage(msg);
        };

        // Start the IPC client
        _ = _ipcClient.StartAsync();
    }

    /// <summary>
    /// Handle messages received from the Windows Service.
    /// </summary>
    private void HandleServiceMessage(ServiceMessage message)
    {
        if (!this.IsHandleCreated) return;

        this.BeginInvoke((MethodInvoker)delegate
        {
            switch (message.Type)
            {
                case "compliance_update":
                    if (message.ComplianceState != null)
                    {
                        UpdateComplianceUI(message.ComplianceState);
                        detailLabel.Text = $"Last update: {message.Timestamp:HH:mm:ss} (from service)";
                    }
                    break;

                case "non_compliant":
                    if (message.ShowNotification && message.ComplianceState != null)
                    {
                        ShowComplianceNotification(message.ComplianceState, isNewNonCompliance: true, message.FailedChecks);
                    }
                    if (message.ComplianceState != null)
                    {
                        UpdateComplianceUI(message.ComplianceState);
                    }
                    break;

                case "compliant":
                    if (message.ShowNotification && message.ComplianceState != null)
                    {
                        ShowComplianceNotification(message.ComplianceState, isNewNonCompliance: false);
                    }
                    if (message.ComplianceState != null)
                    {
                        UpdateComplianceUI(message.ComplianceState);
                    }
                    break;

                case "enrollment_required":
                    if (!isEnrolled)
                    {
                        ShowEnrollmentState();
                    }
                    break;

                case "aad_required":
                    statusLabel.Text = "Action Required";
                    statusLabel.ForeColor = Color.Orange;
                    statusIconLabel.Text = "⚠";
                    statusIconLabel.ForeColor = Color.Orange;
                    codeLabel.Text = "Sign In";
                    codeLabel.Font = new Font("Segoe UI", 24, FontStyle.Bold);
                    codeLabel.ForeColor = Color.Orange;
                    infoLabel.Visible = false;
                    fixAccountButton.Visible = true;
                    break;
            }
        });
    }

    /// <summary>
    /// Notify the service of enrollment state changes.
    /// </summary>
    private async Task NotifyServiceOfEnrollment()
    {
        if (_ipcClient != null && _serviceConnected)
        {
            var aadStatus = GetAzureAdStatus();
            var state = new EnrollmentState
            {
                IsEnrolled = isEnrolled,
                UserEmail = userEmail,
                UserName = userName,
                AzureAdDeviceId = aadStatus.DeviceId,
                AzureAdJoinType = aadStatus.JoinType
            };
            await _ipcClient.SendEnrollmentUpdateAsync(state);
        }
    }
    
    /// <summary>
    /// Save Azure AD info to the enrollment file so the service can use it.
    /// The service runs as SYSTEM and cannot get Azure AD info directly.
    /// </summary>
    private async Task SaveAzureAdInfoAsync(string deviceId, string joinType)
    {
        try
        {
            // Read existing enrollment state
            EnrollmentState? state = null;
            if (File.Exists(EnrollmentFilePath))
            {
                var json = await File.ReadAllTextAsync(EnrollmentFilePath);
                state = JsonSerializer.Deserialize<EnrollmentState>(json);
            }
            
            if (state == null)
            {
                state = new EnrollmentState
                {
                    IsEnrolled = isEnrolled,
                    UserEmail = userEmail,
                    UserName = userName
                };
            }
            
            // Update Azure AD info if changed
            if (state.AzureAdDeviceId != deviceId || state.AzureAdJoinType != joinType)
            {
                state.AzureAdDeviceId = deviceId;
                state.AzureAdJoinType = joinType;
                
                var updatedJson = JsonSerializer.Serialize(state);
                await File.WriteAllTextAsync(EnrollmentFilePath, updatedJson);
                
                // Also notify service via IPC if connected
                if (_ipcClient != null && _serviceConnected)
                {
                    await _ipcClient.SendEnrollmentUpdateAsync(state);
                }
            }
        }
        catch (Exception ex)
        {
            // Don't fail the compliance check if we can't save Azure AD info
            System.Diagnostics.Debug.WriteLine($"Failed to save Azure AD info: {ex.Message}");
        }
    }

    private async Task RefreshEnrollmentInfo()
    {
        try
        {
            var pollData = new
            {
                serialNumber = GetSerialNumber(),
                hostname = Environment.MachineName,
                enrollmentCode = "REFRESH",
                osBuild = GetOsVersion()
            };

            var response = await httpClient.PostAsJsonAsync(EnrollUrl, pollData);
            if (response.IsSuccessStatusCode)
            {
                var result = await response.Content.ReadFromJsonAsync<EnrollmentResponse>();
                if (result?.status == "enrolled" && !string.IsNullOrEmpty(result.userName))
                {
                    userName = result.userName;
                    userEmail = result.userEmail ?? userEmail;
                    
                    var state = new EnrollmentState { IsEnrolled = true, UserEmail = userEmail, UserName = userName };
                    File.WriteAllText(EnrollmentFilePath, JsonSerializer.Serialize(state));
                    
                    if (this.IsHandleCreated)
                    {
                        this.Invoke((MethodInvoker)delegate {
                            ShowEnrolledState();
                        });
                    }
                }
            }
        }
        catch { }
    }

    private void ShowEnrollmentState()
    {
        enrollmentCode = GenerateEnrollmentCode();
        
        // Modern amber/warning colors
        var warningColor = Color.FromArgb(245, 158, 11);
        
        statusIconLabel.Text = "○";
        statusIconLabel.ForeColor = warningColor;
        
        statusLabel.Text = "Device Not Enrolled";
        statusLabel.ForeColor = Color.FromArgb(30, 41, 59);
        
        codeLabel.Text = enrollmentCode;
        codeLabel.ForeColor = Color.FromArgb(15, 23, 42); // Dark slate
        codeLabel.Font = new Font("Consolas", 36, FontStyle.Bold);

        infoLabel.Text = "Visit the enrollment portal and\nenter the code shown above.";
        infoLabel.ForeColor = Color.FromArgb(100, 116, 139);
    }

    private void ShowEnrolledState()
    {
        // Modern teal/success colors
        var successColor = Color.FromArgb(13, 148, 136);
        
        statusIconLabel.Text = "●";
        statusIconLabel.ForeColor = successColor;
        
        statusLabel.Text = "Device Enrolled";
        statusLabel.ForeColor = Color.FromArgb(30, 41, 59);
        
        codeLabel.Text = "Active";
        codeLabel.Font = new Font("Segoe UI Semibold", 28, FontStyle.Bold);
        codeLabel.ForeColor = successColor;
        
        infoLabel.Text = $"{userName}\n{userEmail}";
        infoLabel.ForeColor = Color.FromArgb(100, 116, 139);
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
                    File.WriteAllText(EnrollmentFilePath, JsonSerializer.Serialize(state));
                    
                    // Notify the service of enrollment
                    _ = NotifyServiceOfEnrollment();
                    
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
        // Run immediately then every 30 minutes
        _ = RunComplianceCheck();
        
        complianceTimer = new System.Windows.Forms.Timer();
        complianceTimer.Interval = ComplianceCheckIntervalMs; // 30 minutes
        complianceTimer.Tick += async (s, e) => await RunComplianceCheck();
        complianceTimer.Start();
    }

    private async Task RunComplianceCheck()
    {
        try
        {
            detailLabel.Text = $"Last check: {DateTime.Now.ToShortTimeString()} - Running...";
            
            var aadStatus = GetAzureAdStatus();

            if (this.IsHandleCreated)
            {
                this.Invoke((MethodInvoker)delegate {
                    if (string.IsNullOrEmpty(aadStatus.JoinType))
                    {
                        infoLabel.Visible = false;
                        fixAccountButton.Visible = true;
                        
                        statusLabel.Text = "Action Required";
                        statusLabel.ForeColor = Color.Orange;
                        statusIconLabel.Text = "⚠";
                        statusIconLabel.ForeColor = Color.Orange;
                        
                        codeLabel.Text = "Sign In";
                        codeLabel.Font = new Font("Segoe UI", 24, FontStyle.Bold);
                        codeLabel.ForeColor = Color.Orange;
                    }
                    else
                    {
                        fixAccountButton.Visible = false;
                        infoLabel.Visible = true;
                        if (statusLabel.Text == "Action Required")
                        {
                            ShowEnrolledState();
                        }
                    }
                });
            }

            if (string.IsNullOrEmpty(aadStatus.JoinType))
            {
                detailLabel.Text = "Waiting for Work Account connection...";
                return;
            }
            
            // Save Azure AD info for the service (which runs as SYSTEM and can't get this directly)
            await SaveAzureAdInfoAsync(aadStatus.DeviceId, aadStatus.JoinType);

            // Get current compliance checks
            var bitlockerStatus = GetBitLockerStatus();
            var tpmStatus = GetTpmStatus();
            var secureBootStatus = GetSecureBootStatus();
            var firewallStatus = GetFirewallStatus();
            var antivirusStatus = GetAntivirusStatus();

            // Create current compliance state
            var currentState = new ComplianceState
            {
                BitLocker = bitlockerStatus,
                Tpm = tpmStatus,
                SecureBoot = secureBootStatus,
                Firewall = firewallStatus,
                Antivirus = antivirusStatus
            };

            // Check for compliance changes and notify user
            CheckAndNotifyComplianceChange(currentState);

            var deviceInfo = new
            {
                hostname = Environment.MachineName,
                serialNumber = GetSerialNumber(),
                osBuild = GetOsVersion(),
                userEmail = userEmail,
                userName = userName,
                azureAdDeviceId = aadStatus.DeviceId,
                joinType = aadStatus.JoinType,
                checks = new
                {
                    bitlocker = bitlockerStatus,
                    tpm = tpmStatus,
                    secureBoot = secureBootStatus,
                    firewall = firewallStatus,
                    antivirus = antivirusStatus
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

            // Update UI based on overall compliance
            UpdateComplianceUI(currentState);
        }
        catch (Exception ex)
        {
            detailLabel.Text = $"Error: {ex.Message}";
        }
    }

    private void CheckAndNotifyComplianceChange(ComplianceState currentState)
    {
        if (previousComplianceState == null)
        {
            // First run - just store the state
            previousComplianceState = currentState;
            
            // If not compliant on first run, still notify
            if (!currentState.IsFullyCompliant)
            {
                ShowComplianceNotification(currentState, isNewNonCompliance: true);
            }
            return;
        }

        // Check if compliance status changed from compliant to non-compliant
        bool wasCompliant = previousComplianceState.IsFullyCompliant;
        bool isCompliant = currentState.IsFullyCompliant;

        if (wasCompliant && !isCompliant)
        {
            // Device became non-compliant - show notification
            ShowComplianceNotification(currentState, isNewNonCompliance: true);
        }
        else if (!wasCompliant && isCompliant)
        {
            // Device became compliant - show success notification
            ShowComplianceNotification(currentState, isNewNonCompliance: false);
        }
        else if (!isCompliant)
        {
            // Check for specific changes in non-compliant items
            var newFailures = GetNewFailures(previousComplianceState, currentState);
            if (newFailures.Count > 0)
            {
                ShowComplianceNotification(currentState, isNewNonCompliance: true, newFailures);
            }
        }

        // Update stored state
        previousComplianceState = currentState;
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

    private void ShowComplianceNotification(ComplianceState state, bool isNewNonCompliance, List<string>? specificFailures = null)
    {
        try
        {
            string title;
            string message;

            if (isNewNonCompliance)
            {
                title = "⚠️ Device Non-Compliant";
                var failures = specificFailures ?? state.GetFailedChecks();
                message = $"The following security checks failed:\n• {string.Join("\n• ", failures)}\n\nPlease resolve these issues to maintain compliance.";
            }
            else
            {
                title = "✓ Device Compliant";
                message = "All security checks passed. Your device is now compliant.";
            }

            // Show Windows Toast Notification
            ShowToastNotification(title, message, isNewNonCompliance);

            // Also update the UI if handle is created
            if (this.IsHandleCreated)
            {
                this.Invoke((MethodInvoker)delegate {
                    UpdateComplianceUI(state);
                });
            }
        }
        catch (Exception ex)
        {
            // Fallback to MessageBox if toast fails
            System.Diagnostics.Debug.WriteLine($"Toast notification failed: {ex.Message}");
        }
    }

    [SupportedOSPlatform("windows")]
    private void ShowToastNotification(string title, string message, bool isWarning)
    {
        try
        {
            // Create toast notification using Windows Runtime APIs
            var toastXml = ToastNotificationManager.GetTemplateContent(ToastTemplateType.ToastText02);
            var textElements = toastXml.GetElementsByTagName("text");
            
            textElements[0].AppendChild(toastXml.CreateTextNode(title));
            textElements[1].AppendChild(toastXml.CreateTextNode(message.Replace("\n", " ")));

            // Create the toast notification
            var toast = new ToastNotification(toastXml);
            
            // Set the notification to stay longer for warnings
            if (isWarning)
            {
                toast.ExpirationTime = DateTimeOffset.Now.AddMinutes(5);
            }

            // Show the notification
            var notifier = ToastNotificationManager.CreateToastNotifier("SERC Compliance Agent");
            notifier.Show(toast);
        }
        catch (Exception ex)
        {
            // If Windows toast fails, use a balloon tip or just log
            System.Diagnostics.Debug.WriteLine($"Windows Toast failed: {ex.Message}");
            
            // Fallback: Show a message box for critical non-compliance
            if (isWarning && this.IsHandleCreated)
            {
                this.BeginInvoke((MethodInvoker)delegate {
                    MessageBox.Show(message, title, MessageBoxButtons.OK, MessageBoxIcon.Warning);
                });
            }
        }
    }

    private void UpdateComplianceUI(ComplianceState state)
    {
        if (!this.IsHandleCreated) return;

        // Modern color palette
        var successColor = Color.FromArgb(13, 148, 136);  // Teal
        var errorColor = Color.FromArgb(239, 68, 68);     // Red
        var textPrimary = Color.FromArgb(30, 41, 59);

        this.Invoke((MethodInvoker)delegate {
            if (state.IsFullyCompliant)
            {
                statusIconLabel.Text = "●";
                statusIconLabel.ForeColor = successColor;
                statusLabel.Text = "Compliant";
                statusLabel.ForeColor = textPrimary;
                codeLabel.Text = "All Checks Passed";
                codeLabel.Font = new Font("Segoe UI Semibold", 20, FontStyle.Bold);
                codeLabel.ForeColor = successColor;
                infoLabel.Text = "Your device meets all security requirements.";
                infoLabel.ForeColor = Color.FromArgb(100, 116, 139);
            }
            else
            {
                var failedChecks = state.GetFailedChecks();
                statusIconLabel.Text = "○";
                statusIconLabel.ForeColor = errorColor;
                statusLabel.Text = "Non-Compliant";
                statusLabel.ForeColor = textPrimary;
                codeLabel.Text = $"{failedChecks.Count} Issue{(failedChecks.Count > 1 ? "s" : "")} Found";
                codeLabel.Font = new Font("Segoe UI Semibold", 20, FontStyle.Bold);
                codeLabel.ForeColor = errorColor;
                infoLabel.Text = string.Join(", ", failedChecks);
                infoLabel.ForeColor = Color.FromArgb(100, 116, 139);
            }
        });
    }

    private string GenerateEnrollmentCode()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var random = new Random();
        return new string(Enumerable.Repeat(chars, 6)
            .Select(s => s[random.Next(s.Length)]).ToArray());
    }

    // --- Helper Methods ---

    private (string DeviceId, string JoinType) GetAzureAdStatus()
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

            var process = new System.Diagnostics.Process
            {
                StartInfo = new System.Diagnostics.ProcessStartInfo
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
                    // Prefer WorkplaceDeviceId if we are workplace joined or if DeviceId is missing
                    var wpId = trimmed.Split(':')[1].Trim();
                    if (!string.IsNullOrEmpty(wpId) && (joinType == "Workplace Joined" || string.IsNullOrEmpty(deviceId)))
                    {
                        deviceId = wpId;
                    }
                }
            }

            return (deviceId, joinType);
        }
        catch
        {
            return ("", "");
        }
    }

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
            // Check if the firewall service is running first
            using var service = new ServiceController("MpsSvc");
            if (service.Status != ServiceControllerStatus.Running)
            {
                return false;
            }

            // Check if firewall is enabled for all profiles (Domain, Private, Public)
            // The EnableFirewall registry value: 1 = enabled, 0 = disabled
            string[] profileKeys = new[]
            {
                @"SYSTEM\CurrentControlSet\Services\SharedAccess\Parameters\FirewallPolicy\DomainProfile",
                @"SYSTEM\CurrentControlSet\Services\SharedAccess\Parameters\FirewallPolicy\StandardProfile",  // Private
                @"SYSTEM\CurrentControlSet\Services\SharedAccess\Parameters\FirewallPolicy\PublicProfile"
            };

            foreach (var profileKey in profileKeys)
            {
                using var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(profileKey);
                if (key != null)
                {
                    var enableFirewall = key.GetValue("EnableFirewall");
                    if (enableFirewall != null && (int)enableFirewall == 0)
                    {
                        // At least one profile has firewall disabled
                        return false;
                    }
                }
            }

            return true; // All profiles have firewall enabled
        }
        catch 
        { 
            return false; 
        }
    }

    [SupportedOSPlatform("windows")]
    bool GetAntivirusStatus()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher(@"root\SecurityCenter2", "SELECT * FROM AntiVirusProduct");
            foreach (ManagementObject av in searcher.Get())
            {
                // productState is a bitmask:
                // Bits 4-7 (hex mask 0xF0): AV signature status
                // Bits 8-11 (hex mask 0xF00): AV product status
                // Bits 12-15 (hex mask 0xF000): Security provider
                // 
                // For product status (bits 8-11):
                // 0x00 = Off
                // 0x10 = On
                // 0x01 = Snoozed
                // 0x11 = Expired
                //
                // Common productState values:
                // 266240 (0x41000) = Windows Defender active and up-to-date
                // 262144 (0x40000) = Windows Defender active, definitions may be out of date
                // 393472 (0x60100) = Third party AV, enabled
                // 393216 (0x60000) = Third party AV, enabled
                // 262160 (0x40010) = AV disabled
                
                var productState = Convert.ToUInt32(av["productState"]);
                
                // Check if AV is enabled (bit 12 should be set, bit 8 indicates on/off)
                // The second byte (bits 8-15) indicates if the product is on
                // If (productState & 0x1000) != 0, the AV is on
                // More reliable: check bits 12-15 for "on" status
                var scannerEnabled = ((productState >> 12) & 0xF) == 1 || ((productState >> 12) & 0xF) == 0;
                var realtimeEnabled = ((productState >> 8) & 0xF) == 0x0 || ((productState >> 8) & 0xF) == 0x1;
                
                // Simpler check: if the second nibble of the second byte is 0, AV is ON
                // productState & 0x1000 = scanner on flag
                // (productState >> 8) & 0x10 == 0 means real-time protection is ON
                bool isEnabled = (productState & 0x1000) != 0;
                
                if (isEnabled)
                {
                    return true;
                }
            }
        }
        catch { }
        return false;
    }

    private async void ConnectToWorkAccount()
    {
        try
        {
            // Show instructions
            MessageBox.Show(
                "The Windows Settings app will now open.\n\n" +
                "1. Click 'Connect' under 'Access work or school'\n" +
                "2. Sign in with your college email\n" +
                "3. Complete the MFA prompt if requested\n" +
                "4. Wait for the process to complete\n\n" +
                "You have 1 minute to complete the registration.",
                "Registration Instructions",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);

            // Open Settings
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = "ms-settings:workplace",
                UseShellExecute = true
            });

            fixAccountButton.Enabled = false;
            var startTime = DateTime.Now;
            bool registrationComplete = false;
            bool emailFound = false;

            while ((DateTime.Now - startTime).TotalSeconds <= 60)
            {
                var elapsed = (int)(DateTime.Now - startTime).TotalSeconds;
                detailLabel.Text = $"Waiting for connection... ({elapsed}s / 60s)";
                Application.DoEvents(); // Keep UI responsive

                // Check registration
                if (!registrationComplete)
                {
                    var status = GetAzureAdStatus();
                    if (!string.IsNullOrEmpty(status.JoinType))
                    {
                        registrationComplete = true;
                        detailLabel.Text = "Device registered! Checking for email...";
                    }
                }

                // Check for email
                if (registrationComplete && !emailFound)
                {
                    string? email = GetWorkAccountEmail();
                    if (!string.IsNullOrEmpty(email))
                    {
                        emailFound = true;
                        userEmail = email;
                        userName = email; // Use email as name initially
                        
                        // Save state
                        var state = new EnrollmentState { IsEnrolled = true, UserEmail = userEmail, UserName = userName };
                        File.WriteAllText(EnrollmentFilePath, JsonSerializer.Serialize(state));
                        
                        detailLabel.Text = $"Connected as {email}";
                        await Task.Delay(1000);
                        await RunComplianceCheck();
                        return;
                    }
                }

                await Task.Delay(1000);
            }

            if (!registrationComplete)
            {
                MessageBox.Show("Device registration timed out. Please try again.", "Timeout", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                detailLabel.Text = "Connection timed out.";
            }
            else if (!emailFound)
            {
                 MessageBox.Show("Device registered but email could not be retrieved. Please restart the application.", "Warning", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                 detailLabel.Text = "Connected, but email missing.";
                 await RunComplianceCheck(); // Try anyway
            }
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Error: {ex.Message}", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            detailLabel.Text = "Error connecting.";
        }
        finally
        {
            fixAccountButton.Enabled = true;
        }
    }

    [SupportedOSPlatform("windows")]
    private string? GetWorkAccountEmail()
    {
        try
        {
            using var joinInfoKey = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows NT\CurrentVersion\WorkplaceJoin\JoinInfo");
            if (joinInfoKey != null)
            {
                foreach (var subKeyName in joinInfoKey.GetSubKeyNames())
                {
                    using var subKey = joinInfoKey.OpenSubKey(subKeyName);
                    var email = subKey?.GetValue("UserEmail") as string;
                    if (!string.IsNullOrEmpty(email))
                    {
                        return email;
                    }
                }
            }
        }
        catch { }
        return null;
    }
}

public class EnrollmentState
{
    public bool IsEnrolled { get; set; }
    public string? UserEmail { get; set; }
    public string? UserName { get; set; }
    
    // Azure AD info - cached for the service which runs as SYSTEM and can't get this directly
    public string? AzureAdDeviceId { get; set; }
    public string? AzureAdJoinType { get; set; }
}

class EnrollmentResponse
{
    public string? status { get; set; }
    public string? userEmail { get; set; }
    public string? userName { get; set; }
}

public class ComplianceState
{
    public bool BitLocker { get; set; }
    public bool Tpm { get; set; }
    public bool SecureBoot { get; set; }
    public bool Firewall { get; set; }
    public bool Antivirus { get; set; }

    public bool IsFullyCompliant => BitLocker && Tpm && SecureBoot && Firewall && Antivirus;

    public List<string> GetFailedChecks()
    {
        var failures = new List<string>();
        if (!BitLocker) failures.Add("BitLocker");
        if (!Tpm) failures.Add("TPM");
        if (!SecureBoot) failures.Add("Secure Boot");
        if (!Firewall) failures.Add("Firewall");
        if (!Antivirus) failures.Add("Antivirus");
        return failures;
    }
}
