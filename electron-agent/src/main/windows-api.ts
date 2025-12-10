import { exec } from 'child_process'
import { promisify } from 'util'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'

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
 * Get Azure AD join status using dsregcmd with file-based caching.
 * This approach avoids all PowerShell escaping issues by using a script file.
 */
export async function getAzureAdStatus(): Promise<{ deviceId: string; joinType: string }> {
    try {
        // Use AppData/Roaming/serc-compliance-agent for cache
        const cacheDir = path.join(os.homedir(), 'AppData', 'Roaming', 'serc-compliance-agent')
        const cacheFile = path.join(cacheDir, 'azure-ad-status.json')
        const scriptFile = path.join(cacheDir, 'get-aad-status.ps1')

        // Ensure cache directory exists
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true })
        }

        // Create the PowerShell script that will write to the cache file
        const psScript = `
$output = dsregcmd /status 2>&1 | Out-String
$deviceId = ''
$joinType = ''

if ($output -like '*AzureAdJoined : YES*') {
    $joinType = 'Azure AD Joined'
    # Extract DeviceId for Azure AD Joined
    $lines = $output -split [Environment]::NewLine
    foreach ($line in $lines) {
        if ($line.Trim().StartsWith('DeviceId :')) {
            $deviceId = $line.Trim().Substring(10).Trim()
            break
        }
    }
} elseif ($output -like '*WorkplaceJoined : YES*') {
    $joinType = 'Workplace Joined'
    # Extract WorkplaceDeviceId
    $lines = $output -split [Environment]::NewLine
    foreach ($line in $lines) {
        if ($line.Trim().StartsWith('WorkplaceDeviceId :')) {
            $deviceId = $line.Trim().Substring(19).Trim()
            break
        }
    }
}

@{ deviceId = $deviceId; joinType = $joinType } | ConvertTo-Json | Set-Content -Path '${cacheFile.replace(/\\/g, '\\\\')}' -NoNewline
`

        // Write the script file
        fs.writeFileSync(scriptFile, psScript, 'utf-8')

        // Execute the script
        await execAsync(
            `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptFile}"`,
            { timeout: 15000 }
        )

        // Read the cached result
        if (fs.existsSync(cacheFile)) {
            let content = fs.readFileSync(cacheFile, 'utf-8')
            // Strip BOM if present (PowerShell sometimes adds it)
            if (content.charCodeAt(0) === 0xFEFF) {
                content = content.slice(1)
            }
            const data = JSON.parse(content)
            return {
                deviceId: data.deviceId || '',
                joinType: data.joinType || ''
            }
        }

        return { deviceId: '', joinType: '' }
    } catch (error) {
        console.error('Azure AD status error:', error)
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
