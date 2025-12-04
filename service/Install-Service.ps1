# SERC Compliance Service Installer
# This script installs the SERC Compliance Service as a Windows Service
# Run as Administrator

param(
    [switch]$Install,
    [switch]$Uninstall,
    [switch]$Start,
    [switch]$Stop,
    [string]$ServicePath = ""
)

$ServiceName = "SERC.ComplianceService"
$DisplayName = "SERC Compliance Service"
$Description = "Monitors device security compliance and reports to SERC dashboard"

# Check for admin rights
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Administrator)) {
    Write-Host "ERROR: This script must be run as Administrator" -ForegroundColor Red
    exit 1
}

# Get service executable path
function Get-ServiceExecutablePath {
    if ($ServicePath) {
        return $ServicePath
    }
    
    # Default path in Program Files
    $defaultPath = "${env:ProgramFiles}\SERC\ComplianceService\SERC.ComplianceService.exe"
    if (Test-Path $defaultPath) {
        return $defaultPath
    }
    
    # Development path
    $devPath = Join-Path $PSScriptRoot "publish\SERC.ComplianceService.exe"
    if (Test-Path $devPath) {
        return $devPath
    }
    
    return $null
}

function Install-SERCService {
    Write-Host "Installing SERC Compliance Service..." -ForegroundColor Cyan
    
    $exePath = Get-ServiceExecutablePath
    if (-not $exePath -or -not (Test-Path $exePath)) {
        Write-Host "ERROR: Service executable not found. Please specify path with -ServicePath" -ForegroundColor Red
        Write-Host "Expected path: $exePath" -ForegroundColor Yellow
        exit 1
    }
    
    # Check if service already exists
    $existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($existingService) {
        Write-Host "Service already exists. Stopping and removing..." -ForegroundColor Yellow
        Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
        sc.exe delete $ServiceName | Out-Null
        Start-Sleep -Seconds 2
    }
    
    # Create the service
    Write-Host "Creating service from: $exePath" -ForegroundColor Gray
    
    $params = @{
        Name = $ServiceName
        BinaryPathName = "`"$exePath`""
        DisplayName = $DisplayName
        Description = $Description
        StartupType = "Automatic"
    }
    
    New-Service @params | Out-Null
    
    # Set service to restart on failure
    sc.exe failure $ServiceName reset=86400 actions=restart/60000/restart/60000/restart/60000 | Out-Null
    
    # Create data directory
    $dataPath = "${env:ProgramData}\SERC\ComplianceService"
    if (-not (Test-Path $dataPath)) {
        New-Item -Path $dataPath -ItemType Directory -Force | Out-Null
        Write-Host "Created data directory: $dataPath" -ForegroundColor Gray
    }
    
    Write-Host "Service installed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "To start the service, run:" -ForegroundColor White
    Write-Host "  Start-Service -Name '$ServiceName'" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Or run this script with -Start:" -ForegroundColor White
    Write-Host "  .\Install-Service.ps1 -Start" -ForegroundColor Cyan
}

function Uninstall-SERCService {
    Write-Host "Uninstalling SERC Compliance Service..." -ForegroundColor Cyan
    
    $existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if (-not $existingService) {
        Write-Host "Service is not installed." -ForegroundColor Yellow
        return
    }
    
    # Stop the service if running
    if ($existingService.Status -eq 'Running') {
        Write-Host "Stopping service..." -ForegroundColor Gray
        Stop-Service -Name $ServiceName -Force
    }
    
    # Delete the service
    sc.exe delete $ServiceName | Out-Null
    
    Write-Host "Service uninstalled successfully!" -ForegroundColor Green
}

function Start-SERCService {
    Write-Host "Starting SERC Compliance Service..." -ForegroundColor Cyan
    
    $existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if (-not $existingService) {
        Write-Host "Service is not installed. Run with -Install first." -ForegroundColor Red
        exit 1
    }
    
    Start-Service -Name $ServiceName
    
    $service = Get-Service -Name $ServiceName
    if ($service.Status -eq 'Running') {
        Write-Host "Service started successfully!" -ForegroundColor Green
    } else {
        Write-Host "Failed to start service. Status: $($service.Status)" -ForegroundColor Red
    }
}

function Stop-SERCService {
    Write-Host "Stopping SERC Compliance Service..." -ForegroundColor Cyan
    
    $existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if (-not $existingService) {
        Write-Host "Service is not installed." -ForegroundColor Yellow
        return
    }
    
    Stop-Service -Name $ServiceName -Force
    Write-Host "Service stopped." -ForegroundColor Green
}

# Main execution
if ($Install) {
    Install-SERCService
}
elseif ($Uninstall) {
    Uninstall-SERCService
}
elseif ($Start) {
    Start-SERCService
}
elseif ($Stop) {
    Stop-SERCService
}
else {
    Write-Host "SERC Compliance Service Installer" -ForegroundColor Cyan
    Write-Host "=================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor White
    Write-Host "  .\Install-Service.ps1 -Install [-ServicePath <path>]" -ForegroundColor Gray
    Write-Host "  .\Install-Service.ps1 -Uninstall" -ForegroundColor Gray
    Write-Host "  .\Install-Service.ps1 -Start" -ForegroundColor Gray
    Write-Host "  .\Install-Service.ps1 -Stop" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor White
    Write-Host "  Install with default path:" -ForegroundColor Gray
    Write-Host "    .\Install-Service.ps1 -Install" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Install with custom path:" -ForegroundColor Gray
    Write-Host "    .\Install-Service.ps1 -Install -ServicePath 'C:\MyApp\service.exe'" -ForegroundColor Cyan
}
