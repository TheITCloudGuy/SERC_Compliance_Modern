$EnrollUrl = "https://serc-compliance-modern.vercel.app/api/enroll/poll"
$TelemetryUrl = "https://serc-compliance-modern.vercel.app/api/telemetry"

Write-Host "Testing connection to API..." -ForegroundColor Cyan

# 1. Test Enrollment Endpoint
Write-Host "`n1. Testing Enrollment Endpoint ($EnrollUrl)..."
$enrollPayload = @{
    serialNumber = "TEST-SERIAL-001"
    hostname = "TEST-HOST"
    enrollmentCode = "TESTCODE"
    osBuild = "10.0.22621"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $EnrollUrl -Method Post -Body $enrollPayload -ContentType "application/json" -ErrorAction Stop
    Write-Host "SUCCESS: Enrollment endpoint responded." -ForegroundColor Green
    Write-Host "Response:"
    $response | Format-List
}
catch {
    Write-Host "FAILED: Enrollment endpoint request failed." -ForegroundColor Red
    Write-Host $_.Exception.Message
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Server Response: $($reader.ReadToEnd())"
    }
}

# 2. Test Telemetry Endpoint
Write-Host "`n2. Testing Telemetry Endpoint ($TelemetryUrl)..."
$telemetryPayload = @{
    hostname = "TEST-HOST"
    serialNumber = "TEST-SERIAL-001"
    osBuild = "10.0.22621"
    userEmail = "test@example.com"
    userName = "Test User"
    azureAdDeviceId = "test-device-id"
    joinType = "Azure AD Joined"
    checks = @{
        bitlocker = $true
        tpm = $true
        secureBoot = $true
        firewall = $true
        antivirus = $true
    }
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $TelemetryUrl -Method Post -Body $telemetryPayload -ContentType "application/json" -ErrorAction Stop
    Write-Host "SUCCESS: Telemetry endpoint responded." -ForegroundColor Green
    Write-Host "Response:"
    $response | Format-List
}
catch {
    Write-Host "FAILED: Telemetry endpoint request failed." -ForegroundColor Red
    Write-Host $_.Exception.Message
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Server Response: $($reader.ReadToEnd())"
    }
}
