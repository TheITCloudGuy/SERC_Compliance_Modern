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

/**
 * Get the device serial number from BIOS
 */
export async function getSerialNumber(): Promise<string> {
    try {
        const result = await runPowerShell(
            '(Get-WmiObject Win32_BIOS).SerialNumber'
        )
        return result || 'Unknown'
    } catch {
        return 'Unknown'
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
        const result = await runPowerShell(`
      $output = dsregcmd /status 2>&1
      $deviceId = ''
      $joinType = ''
      
      if ($output -match 'AzureAdJoined\\s*:\\s*YES') {
        $joinType = 'Azure AD Joined'
      } elseif ($output -match 'WorkplaceJoined\\s*:\\s*YES') {
        $joinType = 'Workplace Joined'
      }
      
      if ($output -match 'DeviceId\\s*:\\s*([a-f0-9-]+)') {
        $deviceId = $matches[1]
      } elseif ($output -match 'WorkplaceDeviceId\\s*:\\s*([a-f0-9-]+)') {
        $deviceId = $matches[1]
      }
      
      Write-Output "$deviceId|$joinType"
    `)

        const [deviceId, joinType] = result.split('|')
        return { deviceId: deviceId || '', joinType: joinType || '' }
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
