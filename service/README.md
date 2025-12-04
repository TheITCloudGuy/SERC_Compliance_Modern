# SERC Compliance Service - Installation Guide

This document explains how to install and configure the SERC Compliance Service as a Windows Service that runs in the background.

## Architecture Overview

The SERC Compliance solution now uses a **Hybrid Architecture**:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Windows System                               │
│                                                                      │
│  ┌──────────────────────────────────┐   ┌────────────────────────┐  │
│  │    SERC Compliance Service       │   │    SERC Tray App       │  │
│  │    (Windows Service)             │   │    (User Interface)    │  │
│  │                                  │   │                        │  │
│  │  ✓ Runs at system startup       │   │  ✓ Shows system tray   │  │
│  │  ✓ 30-min compliance checks     │←─→│    icon                │  │
│  │  ✓ Sends telemetry to dashboard │ IPC│  ✓ Displays status     │  │
│  │  ✓ Runs as SYSTEM user          │   │  ✓ Toast notifications │  │
│  └──────────────────────────────────┘   │  ✓ User enrollment     │  │
│                       │                 └────────────────────────┘  │
│                       ▼                                              │
│            ┌─────────────────────┐                                   │
│            │  Dashboard API      │                                   │
│            │  (Cloud)            │                                   │
│            └─────────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### Components

1. **SERC.ComplianceService (Windows Service)**
   - Runs in the background as a Windows Service
   - Starts automatically when Windows boots
   - Performs compliance checks every 30 minutes
   - Sends device telemetry to the cloud dashboard
   - Communicates with the Tray App via Named Pipes (IPC)

2. **SERC Tray App (agent.exe)**
   - System tray application for user interaction
   - Displays compliance status
   - Shows Windows toast notifications
   - Handles device enrollment
   - Runs in user session (interactive)

## Building the Service

### Prerequisites
- .NET 9.0 SDK
- Windows 10/11 x64
- Administrator privileges (for installation)

### Build Steps

```powershell
# Navigate to the repository root
cd c:\Users\LAB-MAIN\Documents\GitHub\SERC_Compliance_Modern

# Build in Debug mode
dotnet build service/SERC.ComplianceService.csproj

# Build in Release mode (single-file, self-contained)
dotnet publish service/SERC.ComplianceService.csproj -c Release -o service/publish
```

## Installing the Service

### Using PowerShell Script (Recommended)

1. Open **PowerShell as Administrator**

2. Navigate to the service directory:
   ```powershell
   cd c:\Users\LAB-MAIN\Documents\GitHub\SERC_Compliance_Modern\service
   ```

3. Install the service:
   ```powershell
   .\Install-Service.ps1 -Install -ServicePath ".\publish\SERC.ComplianceService.exe"
   ```

4. Start the service:
   ```powershell
   .\Install-Service.ps1 -Start
   ```

### Using SC Command (Manual)

```powershell
# Create the service
sc.exe create "SERC.ComplianceService" binPath="C:\path\to\SERC.ComplianceService.exe" DisplayName="SERC Compliance Service" start=auto

# Configure failure recovery
sc.exe failure "SERC.ComplianceService" reset=86400 actions=restart/60000/restart/60000/restart/60000

# Start the service
sc.exe start "SERC.ComplianceService"
```

## Managing the Service

### PowerShell Commands

```powershell
# Check service status
Get-Service -Name "SERC.ComplianceService"

# Start service
Start-Service -Name "SERC.ComplianceService"

# Stop service
Stop-Service -Name "SERC.ComplianceService"

# Restart service
Restart-Service -Name "SERC.ComplianceService"
```

### Viewing Logs

The service logs to the Windows Event Log:

```powershell
# View recent service events
Get-EventLog -LogName Application -Source "SERC Compliance Service" -Newest 50
```

Or use Event Viewer:
1. Open Event Viewer (`eventvwr.msc`)
2. Navigate to: Windows Logs → Application
3. Filter by Source: "SERC Compliance Service"

## Uninstalling the Service

```powershell
# Using the install script
.\Install-Service.ps1 -Uninstall

# Or manually
sc.exe stop "SERC.ComplianceService"
sc.exe delete "SERC.ComplianceService"
```

## Configuration Files

| File | Location | Purpose |
|------|----------|---------|
| `enrollment.json` | `%ProgramData%\SERC\ComplianceService\` | Stores device enrollment state |

## Compliance Checks Performed

The service checks the following security settings:

| Check | Description | Method |
|-------|-------------|--------|
| **BitLocker** | Drive encryption enabled on C: | WMI: `Win32_EncryptableVolume` |
| **TPM** | Trusted Platform Module active | WMI: `Win32_Tpm` |
| **Secure Boot** | UEFI Secure Boot enabled | Registry check |
| **Firewall** | Windows Firewall enabled (all profiles) | Registry + Service status |
| **Antivirus** | Windows Defender or AV active | WMI: `MSFT_MpComputerStatus` |

## Troubleshooting

### Service Won't Start

1. Check Event Viewer for error messages
2. Verify the executable path is correct
3. Ensure .NET 9 runtime is installed (if not using self-contained build)

### Compliance Checks Not Running

1. Verify enrollment state exists in `%ProgramData%\SERC\ComplianceService\enrollment.json`
2. Check if device is Azure AD joined: `dsregcmd /status`
3. Review service logs in Event Viewer

### IPC Communication Issues

1. Ensure both service and tray app are running
2. Check Windows Defender Firewall isn't blocking named pipes
3. Run tray app as the same user (not elevated)

## Development Notes

### Adding New Compliance Checks

1. Add check method to `ComplianceChecker.cs`
2. Add property to `ComplianceState` class in `Models.cs`
3. Update `RunComplianceCheckAsync` in `ComplianceWorker.cs`
4. Update `GetFailedChecks()` and `IsFullyCompliant` in `ComplianceState`

### Testing Locally

For development, you can run the service as a console app:

```powershell
# Run without installing as service
dotnet run --project service/SERC.ComplianceService.csproj
```

The service will detect it's not running as a Windows Service and run in console mode.
