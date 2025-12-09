import { exec } from 'child_process'
import { promisify } from 'util'
import * as os from 'os'

const execAsync = promisify(exec)

/**
 * Execute a PowerShell command and return the output
 */
async function runPowerShell(command: string): Promise<string> {
    try {
        const { stdout } = await execAsync(
            `powershell -NoProfile -NonInteractive -Command "${command.replace(/"/g, '\\"')}"`,
            { timeout: 10000 }
        )
        return stdout.trim()
    } catch (error) {
        console.error('PowerShell error:', error)
        return ''
    }
}

// List of invalid/placeholder serial numbers that should be rejected
const INVALID_SERIALS = [
    'default string',
    'to be filled by o.e.m.',
    'to be filled by o.e.m',
    'system serial number',
    'not specified',
    'none',
    'n/a',
    'na',
    '0',
    '123456789',
    'xxxxxxxxxx',
    'default',
    'oem',
    'chassis serial number',
    ''
]

/**
 * Check if a serial number is valid (not a placeholder)
 */
function isValidSerial(serial: string): boolean {
    if (!serial) return false
    const normalized = serial.toLowerCase().trim()
    return !INVALID_SERIALS.includes(normalized) && normalized.length > 3
}

/**
 * Get the device serial number from BIOS, with fallbacks for invalid serials.
 * Falls back to motherboard UUID or MAC address if BIOS serial is a placeholder.
 */
export async function getSerialNumber(): Promise<string> {
    try {
        // Try BIOS serial first
        const biosSerial = await runPowerShell(
            '(Get-WmiObject Win32_BIOS).SerialNumber'
        )

        if (isValidSerial(biosSerial)) {
            return biosSerial.trim()
        }

        console.log(`Invalid BIOS serial detected: "${biosSerial}", trying fallbacks...`)

        // Fallback 1: Try motherboard/baseboard UUID
        const motherboardUuid = await runPowerShell(
            '(Get-WmiObject Win32_ComputerSystemProduct).UUID'
        )

        if (motherboardUuid && motherboardUuid !== 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF' && motherboardUuid.length > 10) {
            console.log(`Using motherboard UUID as device ID: ${motherboardUuid}`)
            return `MB-${motherboardUuid.trim()}`
        }

        // Fallback 2: Try to get first physical network adapter MAC address
        const macAddress = await runPowerShell(
            `(Get-WmiObject Win32_NetworkAdapter | Where-Object { $_.PhysicalAdapter -eq $true -and $_.MACAddress } | Select-Object -First 1).MACAddress -replace ':',''`
        )

        if (macAddress && macAddress.length >= 12) {
            console.log(`Using MAC address as device ID: ${macAddress}`)
            return `MAC-${macAddress.trim()}`
        }

        // Fallback 3: Generate a persistent machine GUID from system info
        const machineGuid = await runPowerShell(
            `(Get-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Cryptography' -Name 'MachineGuid').MachineGuid`
        )

        if (machineGuid && machineGuid.length > 10) {
            console.log(`Using Windows MachineGuid as device ID: ${machineGuid}`)
            return `WIN-${machineGuid.trim()}`
        }

        // Last resort: hostname + a hash (not ideal but better than "Unknown")
        const hostname = os.hostname()
        console.warn(`Could not find unique hardware ID, using hostname: ${hostname}`)
        return `HOST-${hostname}`

    } catch (error) {
        console.error('Error getting serial number:', error)
        return `HOST-${os.hostname()}`
    }
}

/**
 * Get the OS version
 */
export function getOsVersion(): string {
    return os.release()
}

/**
 * Check BitLocker encryption status on C: drive
 */
export async function getBitLockerStatus(): Promise<boolean> {
    try {
        const result = await runPowerShell(
            `(Get-WmiObject -Namespace 'root\\cimv2\\Security\\MicrosoftVolumeEncryption' -Class Win32_EncryptableVolume -Filter "DriveLetter='C:'").ProtectionStatus`
        )
        return result === '1'
    } catch {
        return false
    }
}

/**
 * Check TPM status
 */
export async function getTpmStatus(): Promise<boolean> {
    try {
        const result = await runPowerShell(
            `$tpm = Get-WmiObject -Namespace 'root\\cimv2\\Security\\MicrosoftTpm' -Class Win32_Tpm; if ($tpm) { $tpm.IsEnabled_InitialValue -and $tpm.IsActivated_InitialValue } else { $false }`
        )
        return result.toLowerCase() === 'true'
    } catch {
        return false
    }
}

/**
 * Check Secure Boot status via registry
 */
export async function getSecureBootStatus(): Promise<boolean> {
    try {
        const result = await runPowerShell(
            `(Get-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\SecureBoot\\State' -Name 'UEFISecureBootEnabled' -ErrorAction SilentlyContinue).UEFISecureBootEnabled`
        )
        return result === '1'
    } catch {
        return false
    }
}

/**
 * Check Windows Firewall status for all profiles
 */
export async function getFirewallStatus(): Promise<boolean> {
    try {
        // Use Get-NetFirewallProfile which works more reliably
        const result = await runPowerShell(
            `$profiles = Get-NetFirewallProfile -ErrorAction SilentlyContinue; if ($profiles) { ($profiles | Where-Object { $_.Enabled -eq $true }).Count -eq 3 } else { $false }`
        )
        return result.toLowerCase() === 'true'
    } catch {
        return false
    }
}

/**
 * Check Antivirus status via Security Center
 */
export async function getAntivirusStatus(): Promise<boolean> {
    try {
        // Check for any enabled AV product in Security Center
        const result = await runPowerShell(
            `$av = Get-CimInstance -Namespace 'root/SecurityCenter2' -ClassName AntiVirusProduct -ErrorAction SilentlyContinue; if ($av) { $enabled = $av | Where-Object { ($_.productState -band 0x1000) -ne 0 }; if ($enabled) { 'True' } else { 'False' } } else { 'False' }`
        )
        return result.toLowerCase() === 'true'
    } catch {
        return false
    }
}

/**
 * Get Azure AD join status using dsregcmd
 */
export async function getAzureAdStatus(): Promise<{ deviceId: string; joinType: string }> {
    try {
        // Use simpler pattern matching to avoid regex escape issues through shell layers
        const result = await runPowerShell(`
      $lines = dsregcmd /status 2>&1
      $deviceId = ''
      $joinType = ''
      
      foreach ($line in $lines) {
        $trimmed = $line.ToString().Trim()
        if ($trimmed -like 'AzureAdJoined*:*YES') {
          $joinType = 'Azure AD Joined'
        }
        if ($trimmed -like 'WorkplaceJoined*:*YES') {
          $joinType = 'Workplace Joined'
        }
        if ($trimmed -like 'DeviceId*:*' -and $joinType -eq 'Azure AD Joined') {
          $deviceId = ($trimmed -split ':')[1].Trim()
        }
        if ($trimmed -like 'WorkplaceDeviceId*:*') {
          $deviceId = ($trimmed -split ':')[1].Trim()
        }
      }
      
      Write-Output ([string]::Join('|', @($deviceId, $joinType)))
    `)

        const parts = result.split('|')
        return { deviceId: parts[0] || '', joinType: parts[1] || '' }
    } catch {
        return { deviceId: '', joinType: '' }
    }
}

/**
 * Get work account email from registry
 */
export async function getWorkAccountEmail(): Promise<string | null> {
    try {
        const result = await runPowerShell(`
      $joinInfo = Get-ChildItem -Path 'HKCU:\\Software\\Microsoft\\Windows NT\\CurrentVersion\\WorkplaceJoin\\JoinInfo' -ErrorAction SilentlyContinue
      if ($joinInfo) {
        foreach ($key in $joinInfo) {
          $email = (Get-ItemProperty -Path $key.PSPath -Name 'UserEmail' -ErrorAction SilentlyContinue).UserEmail
          if ($email) { Write-Output $email; exit }
        }
      }
    `)
        return result || null
    } catch {
        return null
    }
}
