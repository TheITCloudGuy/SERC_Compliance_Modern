# SERC Compliance Suite - Self-Extracting Installer Script
# This script provides an alternative to MSI for quick deployment
# Run as Administrator

param(
    [switch]$Uninstall,
    [string]$InstallPath = "$env:ProgramFiles\SERC"
)

$ErrorActionPreference = "Stop"

# Configuration
$ServiceName = "SERC.ComplianceService"
$ServiceDisplayName = "SERC Compliance Service"
$ServiceDescription = "Monitors device security compliance and reports to SERC dashboard"
$TrayAppName = "SERC Compliance Agent"

# Paths
$ServiceFolder = Join-Path $InstallPath "ComplianceService"
$TrayAppFolder = Join-Path $InstallPath "TrayApp"
$DataFolder = "$env:ProgramData\SERC\ComplianceService"

# Source paths (relative to script location)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SourceServiceExe = Join-Path $ScriptDir "service\publish\SERC.ComplianceService.exe"
$SourceTrayAppExe = Join-Path $ScriptDir "agent\publish\SERC_Compliance_Agent.exe"

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Install-SERCComplianceSuite {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║          SERC Compliance Suite Installer                   ║" -ForegroundColor Cyan
    Write-Host "║                  Version 1.0.0                             ║" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""

    if (-not (Test-Administrator)) {
        Write-Host "ERROR: This installer must be run as Administrator" -ForegroundColor Red
        Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
        exit 1
    }

    # Verify source files exist
    if (-not (Test-Path $SourceServiceExe)) {
        Write-Host "ERROR: Service executable not found at: $SourceServiceExe" -ForegroundColor Red
        Write-Host "Please run Build-Installer.ps1 -BuildOnly first" -ForegroundColor Yellow
        exit 1
    }

    if (-not (Test-Path $SourceTrayAppExe)) {
        Write-Host "ERROR: Tray app executable not found at: $SourceTrayAppExe" -ForegroundColor Red
        Write-Host "Please run Build-Installer.ps1 -BuildOnly first" -ForegroundColor Yellow
        exit 1
    }

    Write-Host "Installation Configuration:" -ForegroundColor White
    Write-Host "  Install Path:  $InstallPath" -ForegroundColor Gray
    Write-Host "  Service Path:  $ServiceFolder" -ForegroundColor Gray
    Write-Host "  Tray App Path: $TrayAppFolder" -ForegroundColor Gray
    Write-Host "  Data Path:     $DataFolder" -ForegroundColor Gray
    Write-Host ""

    # Step 1: Stop existing service if running
    Write-Host "[1/6] Checking for existing installation..." -ForegroundColor Cyan
    $existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($existingService) {
        Write-Host "  Stopping existing service..." -ForegroundColor Yellow
        Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        sc.exe delete $ServiceName | Out-Null
        Start-Sleep -Seconds 2
    }

    # Stop any running tray app
    Get-Process -Name "SERC_Compliance_Agent" -ErrorAction SilentlyContinue | Stop-Process -Force

    Write-Host "  Done" -ForegroundColor Green

    # Step 2: Create directories
    Write-Host "[2/6] Creating installation directories..." -ForegroundColor Cyan
    New-Item -Path $ServiceFolder -ItemType Directory -Force | Out-Null
    New-Item -Path $TrayAppFolder -ItemType Directory -Force | Out-Null
    New-Item -Path $DataFolder -ItemType Directory -Force | Out-Null
    Write-Host "  Done" -ForegroundColor Green

    # Step 3: Copy files
    Write-Host "[3/6] Copying application files..." -ForegroundColor Cyan
    
    # Copy service files
    Copy-Item -Path $SourceServiceExe -Destination $ServiceFolder -Force
    $servicePdb = $SourceServiceExe -replace "\.exe$", ".pdb"
    if (Test-Path $servicePdb) {
        Copy-Item -Path $servicePdb -Destination $ServiceFolder -Force
    }
    
    # Copy tray app files
    Copy-Item -Path $SourceTrayAppExe -Destination $TrayAppFolder -Force
    $trayPdb = $SourceTrayAppExe -replace "\.exe$", ".pdb"
    if (Test-Path $trayPdb) {
        Copy-Item -Path $trayPdb -Destination $TrayAppFolder -Force
    }
    
    Write-Host "  Done" -ForegroundColor Green

    # Step 4: Install service
    Write-Host "[4/6] Installing Windows Service..." -ForegroundColor Cyan
    
    $serviceExePath = Join-Path $ServiceFolder "SERC.ComplianceService.exe"
    
    New-Service -Name $ServiceName `
                -BinaryPathName "`"$serviceExePath`"" `
                -DisplayName $ServiceDisplayName `
                -Description $ServiceDescription `
                -StartupType Automatic | Out-Null

    # Configure service recovery
    sc.exe failure $ServiceName reset=86400 actions=restart/60000/restart/60000/restart/60000 | Out-Null
    
    Write-Host "  Done" -ForegroundColor Green

    # Step 5: Create shortcuts
    Write-Host "[5/6] Creating shortcuts..." -ForegroundColor Cyan
    
    $trayAppExePath = Join-Path $TrayAppFolder "SERC_Compliance_Agent.exe"
    $WshShell = New-Object -ComObject WScript.Shell
    
    # Start Menu shortcut
    $startMenuPath = "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\SERC Compliance"
    New-Item -Path $startMenuPath -ItemType Directory -Force | Out-Null
    $shortcut = $WshShell.CreateShortcut("$startMenuPath\$TrayAppName.lnk")
    $shortcut.TargetPath = $trayAppExePath
    $shortcut.WorkingDirectory = $TrayAppFolder
    $shortcut.Description = "SERC Device Compliance Monitor"
    $shortcut.Save()
    
    # Startup shortcut (for all users)
    $startupPath = "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\Startup"
    $shortcut = $WshShell.CreateShortcut("$startupPath\$TrayAppName.lnk")
    $shortcut.TargetPath = $trayAppExePath
    $shortcut.WorkingDirectory = $TrayAppFolder
    $shortcut.Description = "SERC Device Compliance Monitor"
    $shortcut.Save()
    
    Write-Host "  Done" -ForegroundColor Green

    # Step 6: Start service and tray app
    Write-Host "[6/6] Starting services..." -ForegroundColor Cyan
    
    Start-Service -Name $ServiceName
    
    # Start tray app for current user
    Start-Process -FilePath $trayAppExePath -WorkingDirectory $TrayAppFolder
    
    Write-Host "  Done" -ForegroundColor Green

    # Installation complete
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║            Installation Completed Successfully!            ║" -ForegroundColor Green
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "The SERC Compliance Suite has been installed:" -ForegroundColor White
    Write-Host "  • Windows Service: Running (auto-starts with Windows)" -ForegroundColor Gray
    Write-Host "  • Tray Application: Running (auto-starts for all users)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "To verify the service is running:" -ForegroundColor White
    Write-Host "  Get-Service -Name '$ServiceName'" -ForegroundColor Cyan
    Write-Host ""
}

function Uninstall-SERCComplianceSuite {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Yellow
    Write-Host "║          SERC Compliance Suite Uninstaller                 ║" -ForegroundColor Yellow
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Yellow
    Write-Host ""

    if (-not (Test-Administrator)) {
        Write-Host "ERROR: This uninstaller must be run as Administrator" -ForegroundColor Red
        exit 1
    }

    # Stop and remove service
    Write-Host "[1/4] Stopping and removing Windows Service..." -ForegroundColor Cyan
    $existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($existingService) {
        Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
        sc.exe delete $ServiceName | Out-Null
        Start-Sleep -Seconds 2
    }
    Write-Host "  Done" -ForegroundColor Green

    # Stop tray app
    Write-Host "[2/4] Stopping Tray Application..." -ForegroundColor Cyan
    Get-Process -Name "SERC_Compliance_Agent" -ErrorAction SilentlyContinue | Stop-Process -Force
    Write-Host "  Done" -ForegroundColor Green

    # Remove shortcuts
    Write-Host "[3/4] Removing shortcuts..." -ForegroundColor Cyan
    Remove-Item -Path "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\SERC Compliance" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\Startup\$TrayAppName.lnk" -Force -ErrorAction SilentlyContinue
    Write-Host "  Done" -ForegroundColor Green

    # Remove installation directory
    Write-Host "[4/4] Removing installation files..." -ForegroundColor Cyan
    if (Test-Path $InstallPath) {
        Remove-Item -Path $InstallPath -Recurse -Force
    }
    Write-Host "  Done" -ForegroundColor Green

    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║            Uninstallation Completed Successfully!          ║" -ForegroundColor Green
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "Note: Application data in $DataFolder was preserved." -ForegroundColor Yellow
    Write-Host "Remove it manually if you want to delete all data." -ForegroundColor Yellow
    Write-Host ""
}

# Main execution
if ($Uninstall) {
    Uninstall-SERCComplianceSuite
}
else {
    Install-SERCComplianceSuite
}
