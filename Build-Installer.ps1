# SERC Compliance Suite - Build and Package Script
# This script builds both projects and creates the MSI installer

param(
    [switch]$Clean,
    [switch]$BuildOnly,
    [switch]$PackageOnly,
    [string]$Configuration = "Release"
)

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AgentDir = Join-Path $RootDir "agent"
$ServiceDir = Join-Path $RootDir "service"
$InstallerDir = Join-Path $RootDir "installer"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  SERC Compliance Suite Build Script" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Clean if requested
if ($Clean) {
    Write-Host "Cleaning previous builds..." -ForegroundColor Yellow
    
    $foldersToClean = @(
        (Join-Path $AgentDir "bin"),
        (Join-Path $AgentDir "obj"),
        (Join-Path $AgentDir "publish"),
        (Join-Path $ServiceDir "bin"),
        (Join-Path $ServiceDir "obj"),
        (Join-Path $ServiceDir "publish"),
        (Join-Path $InstallerDir "bin"),
        (Join-Path $InstallerDir "obj")
    )
    
    foreach ($folder in $foldersToClean) {
        if (Test-Path $folder) {
            Remove-Item -Path $folder -Recurse -Force
            Write-Host "  Removed: $folder" -ForegroundColor Gray
        }
    }
    Write-Host "Clean completed!" -ForegroundColor Green
    Write-Host ""
}

if (-not $PackageOnly) {
    # Step 1: Build and Publish Agent (Tray App)
    Write-Host "Step 1: Building SERC Compliance Agent (Tray App)..." -ForegroundColor Cyan
    Write-Host "-----------------------------------------------" -ForegroundColor Gray

    $agentPublishPath = Join-Path $AgentDir "publish"
    
    dotnet publish "$AgentDir\agent.csproj" `
        -c $Configuration `
        -r win-x64 `
        --self-contained true `
        -p:PublishSingleFile=true `
        -p:IncludeNativeLibrariesForSelfExtract=true `
        -p:EnableCompressionInSingleFile=true `
        -o $agentPublishPath

    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Agent build failed!" -ForegroundColor Red
        exit 1
    }

    Write-Host "Agent built successfully!" -ForegroundColor Green
    Write-Host "  Output: $agentPublishPath" -ForegroundColor Gray
    Write-Host ""

    # Step 2: Build and Publish Service
    Write-Host "Step 2: Building SERC Compliance Service..." -ForegroundColor Cyan
    Write-Host "-----------------------------------------------" -ForegroundColor Gray

    $servicePublishPath = Join-Path $ServiceDir "publish"

    dotnet publish "$ServiceDir\SERC.ComplianceService.csproj" `
        -c $Configuration `
        -o $servicePublishPath

    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Service build failed!" -ForegroundColor Red
        exit 1
    }

    Write-Host "Service built successfully!" -ForegroundColor Green
    Write-Host "  Output: $servicePublishPath" -ForegroundColor Gray
    Write-Host ""
}

if (-not $BuildOnly) {
    # Step 3: Build MSI Installer
    Write-Host "Step 3: Building MSI Installer..." -ForegroundColor Cyan
    Write-Host "-----------------------------------------------" -ForegroundColor Gray

    # Check if WiX is installed
    $wixInstalled = $null
    try {
        $wixInstalled = dotnet tool list -g | Select-String "wix"
    } catch { }

    if (-not $wixInstalled) {
        Write-Host "Installing WiX Toolset..." -ForegroundColor Yellow
        dotnet tool install --global wix
    }

    # Build the installer
    Push-Location $InstallerDir
    try {
        dotnet build SERC.Installer.wixproj -c $Configuration
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: Installer build failed!" -ForegroundColor Red
            exit 1
        }
    }
    finally {
        Pop-Location
    }

    $msiPath = Join-Path $InstallerDir "bin\$Configuration\en-US\SERC.Installer.msi"
    
    if (Test-Path $msiPath) {
        Write-Host "Installer built successfully!" -ForegroundColor Green
        Write-Host "  Output: $msiPath" -ForegroundColor Gray
        
        # Copy to root for easy access
        $outputMsi = Join-Path $RootDir "SERC_Compliance_Suite_1.0.0.msi"
        Copy-Item $msiPath $outputMsi -Force
        Write-Host "  Copied to: $outputMsi" -ForegroundColor Gray
    }
    else {
        Write-Host "WARNING: MSI file not found at expected location" -ForegroundColor Yellow
        Write-Host "  Expected: $msiPath" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Summary
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Build Complete!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Artifacts:" -ForegroundColor White

$agentExe = Join-Path $AgentDir "publish\SERC_Compliance_Agent.exe"
$serviceExe = Join-Path $ServiceDir "publish\SERC.ComplianceService.exe"
$msiFile = Join-Path $RootDir "SERC_Compliance_Suite_1.0.0.msi"

if (Test-Path $agentExe) {
    $size = [math]::Round((Get-Item $agentExe).Length / 1MB, 2)
    Write-Host "  [✓] Agent:    $agentExe ($size MB)" -ForegroundColor Gray
}

if (Test-Path $serviceExe) {
    $size = [math]::Round((Get-Item $serviceExe).Length / 1MB, 2)
    Write-Host "  [✓] Service:  $serviceExe ($size MB)" -ForegroundColor Gray
}

if (Test-Path $msiFile) {
    $size = [math]::Round((Get-Item $msiFile).Length / 1MB, 2)
    Write-Host "  [✓] Installer: $msiFile ($size MB)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "To install, run the MSI as Administrator or use:" -ForegroundColor White
Write-Host "  msiexec /i `"$msiFile`" /qb" -ForegroundColor Cyan
Write-Host ""
