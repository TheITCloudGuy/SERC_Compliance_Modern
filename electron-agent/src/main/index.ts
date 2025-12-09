import { app, BrowserWindow, ipcMain, Notification, nativeImage } from 'electron'
import { join } from 'path'
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
import * as os from 'os'

let mainWindow: BrowserWindow | null = null

// API URLs
const DASHBOARD_URL = 'https://serc-compliance-modern.vercel.app/api/telemetry'
const ENROLL_URL = 'https://serc-compliance-modern.vercel.app/api/enroll/poll'

// Compliance check interval (5 minutes - reduced from 30s to lower CPU usage)
// Each check spawns multiple PowerShell processes, so less frequent = less CPU
const COMPLIANCE_CHECK_INTERVAL = 5 * 60 * 1000

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
        if (!app.isQuitting) {
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
    console.log(`[${new Date().toLocaleTimeString()}] Running compliance check (showProgress: ${showProgress})`)
    try {
        const totalChecks = 5

        // Notify renderer that checking is starting (only if showing progress)
        if (showProgress) {
            mainWindow?.webContents.send('compliance-check-start', { total: totalChecks })
        }

        // Get serial number first (needed for API)
        const serialNumber = await getSerialNumber()

        // Run checks sequentially with progress updates
        const bitlocker = await getBitLockerStatus()
        if (showProgress) mainWindow?.webContents.send('compliance-check-progress', { current: 1, total: totalChecks, name: 'BitLocker' })

        const tpm = await getTpmStatus()
        if (showProgress) mainWindow?.webContents.send('compliance-check-progress', { current: 2, total: totalChecks, name: 'TPM' })

        const secureBoot = await getSecureBootStatus()
        if (showProgress) mainWindow?.webContents.send('compliance-check-progress', { current: 3, total: totalChecks, name: 'Secure Boot' })

        const firewall = await getFirewallStatus()
        if (showProgress) mainWindow?.webContents.send('compliance-check-progress', { current: 4, total: totalChecks, name: 'Firewall' })

        const antivirus = await getAntivirusStatus()
        if (showProgress) mainWindow?.webContents.send('compliance-check-progress', { current: 5, total: totalChecks, name: 'Antivirus' })

        const aadStatus = await getAzureAdStatus()

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

        try {
            await fetch(DASHBOARD_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(deviceInfo)
            })
        } catch (apiError) {
            console.error('API send error:', apiError)
        }

        // Update renderer with final results
        mainWindow?.webContents.send('compliance-update', {
            ...complianceState,
            isCompliant,
            azureAdStatus: aadStatus
        })

        // Update tray icon
        updateTrayIcon(isCompliant)

        return
    } catch (error) {
        console.error('Compliance check error:', error)
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
            set('isEnrolled', true)
            set('userEmail', result.userEmail || '')
            set('userName', result.userName || '')
            showNotification('SERC Compliance', 'Device enrolled successfully!')
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

// App lifecycle
app.whenReady().then(() => {
    // Initialize store
    initStore()

    // Set app user model id for windows notifications
    electronApp.setAppUserModelId('com.serc.compliance-agent')

    // Enable auto-start at Windows logon (only in production)
    if (!is.dev) {
        app.setLoginItemSettings({
            openAtLogin: true,
            openAsHidden: true, // Start minimized to tray
            args: ['--hidden'] // Pass argument to indicate hidden start
        })
    }

    // Default open or close DevTools by F12 in development
    app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
    })

    setupIpcHandlers()
    createWindow()
    createTray(mainWindow!)

    // Start compliance loop if enrolled
    if (get('isEnrolled', false)) {
        runComplianceCheck(true) // First check shows progress bar
        setInterval(() => runComplianceCheck(false), COMPLIANCE_CHECK_INTERVAL) // Background checks are silent
    }
})

app.on('before-quit', () => {
    app.isQuitting = true
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

// Extend app type
declare module 'electron' {
    interface App {
        isQuitting: boolean
    }
}
