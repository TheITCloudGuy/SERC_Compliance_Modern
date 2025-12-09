import { app, BrowserWindow, ipcMain, Notification, nativeImage } from 'electron'
import { join } from 'path'
import { exec } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { createTray, updateTrayIcon } from './tray'
import {
    getSerialNumber,
    getOsVersion,
    getBitLockerStatus,
    getTpmStatus,
    getSecureBootStatus,
    getFirewallStatus,
    getAntivirusStatus,
    getAzureAdStatus
} from './windows-api'
import { initStore, get, set } from './store'
import { initLogger, logger, getLogPath } from './logger'
import * as os from 'os'

// Track if app is quitting (used to differentiate close vs minimize to tray)
let isQuitting = false

let mainWindow: BrowserWindow | null = null

// API URLs
const DASHBOARD_URL = 'https://compliance.serc.ac.uk/api/telemetry'
const ENROLL_URL = 'https://compliance.serc.ac.uk/api/enroll/poll'

// Compliance check interval (5 minutes - reduced from 30s to lower CPU usage)
// Each check spawns multiple PowerShell processes, so less frequent = less CPU
const COMPLIANCE_CHECK_INTERVAL = 5 * 60 * 1000

// Track the compliance check interval timer
let complianceIntervalId: ReturnType<typeof setInterval> | null = null

function createWindow(): void {
    // Load icon for taskbar and window
    // In dev mode, use process.cwd(); in production, use process.resourcesPath
    const iconPath = is.dev
        ? join(process.cwd(), 'resources', 'icon.ico')
        : join(process.resourcesPath, 'resources', 'icon.ico')

    let icon: Electron.NativeImage | undefined
    try {
        icon = nativeImage.createFromPath(iconPath)
        if (icon.isEmpty()) icon = undefined
    } catch {
        icon = undefined
    }

    mainWindow = new BrowserWindow({
        width: 480,
        height: 520,
        show: false,
        autoHideMenuBar: true,
        resizable: false,
        frame: false,
        transparent: false,
        titleBarStyle: 'hidden',
        icon: icon,
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false,
            contextIsolation: true,
            nodeIntegration: false,
            backgroundThrottling: false // Keep compliance checks running when minimized to tray
        }
    })

    // Show window on ready (unless started with --hidden flag for auto-start)
    mainWindow.on('ready-to-show', () => {
        const startHidden = process.argv.includes('--hidden')
        if (!startHidden) {
            mainWindow?.show()
        }
    })

    // Minimize to tray instead of closing
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault()
            mainWindow?.hide()
        }
    })

    // Load the renderer
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
}

// Generate enrollment code (same as .NET agent)
function generateEnrollmentCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
}

// Check enrollment with API
async function checkEnrollment(code: string): Promise<{ status: string; userEmail?: string; userName?: string } | null> {
    try {
        const serialNumber = await getSerialNumber()
        const osBuild = getOsVersion()
        const hostname = os.hostname()

        const response = await fetch(ENROLL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                serialNumber,
                hostname,
                enrollmentCode: code,
                osBuild
            })
        })

        if (response.ok) {
            return await response.json()
        }
    } catch (error) {
        console.error('Enrollment check error:', error)
    }
    return null
}

// Run compliance check and send to API
// showProgress: only show progress bar on first open, not background checks
async function runComplianceCheck(showProgress: boolean = true): Promise<void> {
    logger.info(`Running compliance check (showProgress: ${showProgress})`)
    try {
        const totalChecks = 5

        // Notify renderer that checking is starting (only if showing progress)
        if (showProgress) {
            mainWindow?.webContents.send('compliance-check-start', { total: totalChecks })
        }

        // Get serial number first (needed for API)
        const serialNumber = await getSerialNumber()
        logger.debug('Serial number retrieved', { serialNumber })

        // Run checks sequentially with progress updates
        const bitlocker = await getBitLockerStatus()
        logger.debug('BitLocker status', { bitlocker })
        if (showProgress) mainWindow?.webContents.send('compliance-check-progress', { current: 1, total: totalChecks, name: 'BitLocker' })

        const tpm = await getTpmStatus()
        logger.debug('TPM status', { tpm })
        if (showProgress) mainWindow?.webContents.send('compliance-check-progress', { current: 2, total: totalChecks, name: 'TPM' })

        const secureBoot = await getSecureBootStatus()
        logger.debug('Secure Boot status', { secureBoot })
        if (showProgress) mainWindow?.webContents.send('compliance-check-progress', { current: 3, total: totalChecks, name: 'Secure Boot' })

        const firewall = await getFirewallStatus()
        logger.debug('Firewall status', { firewall })
        if (showProgress) mainWindow?.webContents.send('compliance-check-progress', { current: 4, total: totalChecks, name: 'Firewall' })

        const antivirus = await getAntivirusStatus()
        logger.debug('Antivirus status', { antivirus })
        if (showProgress) mainWindow?.webContents.send('compliance-check-progress', { current: 5, total: totalChecks, name: 'Antivirus' })

        const aadStatus = await getAzureAdStatus()
        logger.debug('Azure AD Status', aadStatus)

        const hostname = os.hostname()
        const osBuild = getOsVersion()
        const userEmail = get('userEmail', '')
        const userName = get('userName', '')

        const complianceState = { bitlocker, tpm, secureBoot, firewall, antivirus }
        const isCompliant = bitlocker && tpm && secureBoot && firewall && antivirus

        // Send to dashboard API
        const deviceInfo = {
            hostname,
            serialNumber,
            osBuild,
            userEmail,
            userName,
            azureAdDeviceId: aadStatus.deviceId,
            joinType: aadStatus.joinType,
            checks: complianceState
        }
        logger.info('Sending telemetry to API', deviceInfo)

        try {
            const response = await fetch(DASHBOARD_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(deviceInfo)
            })
            logger.info('API response', { status: response.status, ok: response.ok })
        } catch (apiError) {
            logger.error('API send error', apiError)
        }

        // Update renderer with final results
        mainWindow?.webContents.send('compliance-update', {
            ...complianceState,
            isCompliant,
            azureAdStatus: aadStatus
        })

        // Update tray icon
        updateTrayIcon(isCompliant)

        logger.info('Compliance check completed', { isCompliant })
        return
    } catch (error) {
        logger.error('Compliance check error', error)
        // Notify renderer of error so it can reset state
        mainWindow?.webContents.send('compliance-check-error')
    }
}

// Show Windows notification
function showNotification(title: string, body: string): void {
    if (Notification.isSupported()) {
        new Notification({ title, body }).show()
    }
}

// IPC Handlers
function setupIpcHandlers(): void {
    ipcMain.handle('get-enrollment-state', () => {
        return {
            isEnrolled: get('isEnrolled', false),
            userEmail: get('userEmail', ''),
            userName: get('userName', ''),
            enrollmentCode: get('enrollmentCode', '')
        }
    })

    ipcMain.handle('generate-enrollment-code', () => {
        const code = generateEnrollmentCode()
        set('enrollmentCode', code)
        return code
    })

    ipcMain.handle('check-enrollment', async (_, code: string) => {
        const result = await checkEnrollment(code)
        if (result?.status === 'enrolled') {
            logger.info('Device enrolled successfully', { userEmail: result.userEmail, userName: result.userName })
            set('isEnrolled', true)
            set('userEmail', result.userEmail || '')
            set('userName', result.userName || '')
            showNotification('SERC Compliance', 'Device enrolled successfully!')

            // Start the compliance loop now that we're enrolled
            startComplianceLoop()
        }
        return result
    })

    ipcMain.handle('run-compliance-check', async () => {
        await runComplianceCheck()
    })

    ipcMain.handle('get-system-info', async () => {
        const [serialNumber, aadStatus] = await Promise.all([
            getSerialNumber(),
            getAzureAdStatus()
        ])
        return {
            hostname: os.hostname(),
            serialNumber,
            osBuild: getOsVersion(),
            ...aadStatus
        }
    })

    ipcMain.handle('get-log-path', () => {
        return getLogPath()
    })

    ipcMain.on('show-window', () => {
        mainWindow?.show()
        mainWindow?.focus()
    })

    ipcMain.on('minimize-window', () => {
        mainWindow?.minimize()
    })

    ipcMain.on('close-window', () => {
        mainWindow?.hide()
    })
}

// Start the compliance check loop
// This function can be called when enrollment completes to start the loop
function startComplianceLoop(): void {
    if (complianceIntervalId) {
        logger.warn('Compliance loop already running, not starting new one')
        return
    }

    logger.info('Starting compliance check loop', { intervalMs: COMPLIANCE_CHECK_INTERVAL })

    // Run first check immediately (with progress bar)
    runComplianceCheck(true).catch(err => {
        logger.error('Initial compliance check failed', err)
    })

    // Set up interval for background checks
    // Wrap in try-catch to prevent errors from killing the interval
    complianceIntervalId = setInterval(async () => {
        logger.info('Interval triggered - starting background compliance check')
        try {
            await runComplianceCheck(false)
        } catch (err) {
            logger.error('Background compliance check threw an error', err)
        }
    }, COMPLIANCE_CHECK_INTERVAL)

    logger.info('Compliance loop started successfully', { intervalId: String(complianceIntervalId) })
}

// App lifecycle
app.whenReady().then(() => {
    // Initialize logger first so we can log everything
    initLogger()
    logger.info('App ready event fired')

    // Initialize store
    initStore()
    logger.info('Store initialized')

    // Set app user model id for windows notifications
    electronApp.setAppUserModelId('com.serc.compliance-agent')

    // Enable auto-start at Windows logon (only in production)
    // Note: app.setLoginItemSettings with openAsHidden doesn't work reliably on Windows
    // Instead, we write directly to the Windows registry
    if (!is.dev && process.platform === 'win32') {
        const exePath = process.execPath
        // Use PowerShell to add registry entry for startup
        const regCommand = `powershell -NoProfile -NonInteractive -Command "Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'SERC Compliance Agent' -Value '\\"${exePath.replace(/\\/g, '\\\\')}\\\" --hidden'"`
        exec(regCommand, (error) => {
            if (error) {
                logger.error('Failed to set auto-start registry', error)
            } else {
                logger.info('Auto-start registry entry created')
            }
        })
    }

    // Default open or close DevTools by F12 in development
    app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
    })

    setupIpcHandlers()
    logger.info('IPC handlers set up')

    createWindow()
    logger.info('Main window created')

    createTray(mainWindow!)
    logger.info('System tray created')

    // Start compliance loop if enrolled
    const isEnrolled = get('isEnrolled', false)
    logger.info('Enrollment status checked', { isEnrolled })

    if (isEnrolled) {
        startComplianceLoop()
    } else {
        logger.info('Device not enrolled - compliance loop not started')
    }
})

app.on('before-quit', () => {
    logger.info('App before-quit event - setting isQuitting=true')
    isQuitting = true
})

app.on('window-all-closed', () => {
    logger.info('All windows closed')
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})
