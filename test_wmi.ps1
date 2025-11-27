
Write-Host "Testing BitLocker WMI..."
try {
    $bitlocker = Get-CimInstance -Namespace "root\cimv2\Security\MicrosoftVolumeEncryption" -ClassName Win32_EncryptableVolume -Filter "DriveLetter = 'C:'" -ErrorAction Stop
    Write-Host "BitLocker Status: $($bitlocker.ProtectionStatus)"
} catch {
    Write-Host "BitLocker WMI Error: $_"
}

Write-Host "`nTesting TPM WMI..."
try {
    $tpm = Get-CimInstance -Namespace "root\cimv2\Security\MicrosoftTpm" -ClassName Win32_Tpm -ErrorAction Stop
    Write-Host "TPM Enabled: $($tpm.IsEnabled_InitialValue)"
    Write-Host "TPM Activated: $($tpm.IsActivated_InitialValue)"
} catch {
    Write-Host "TPM WMI Error: $_"
}
