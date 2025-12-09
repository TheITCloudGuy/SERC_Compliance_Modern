import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater'
import { app, BrowserWindow } from 'electron'
import { logger } from './logger'

// Configure auto-updater
export function initAutoUpdater(mainWindow: BrowserWindow): void {
    // Disable auto download - we'll control when to download
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true

    // Use the logger for auto-updater logs
    autoUpdater.logger = {
        info: (message: string) => logger.info(`[AutoUpdater] ${message}`),
        warn: (message: string) => logger.warn(`[AutoUpdater] ${message}`),
        error: (message: string) => logger.error(`[AutoUpdater] ${message}`),
        debug: (message: string) => logger.debug(`[AutoUpdater] ${message}`)
    }

    // Event handlers
    autoUpdater.on('checking-for-update', () => {
        logger.info('[AutoUpdater] Checking for updates...')
        mainWindow?.webContents.send('update-status', { status: 'checking' })
    })

    autoUpdater.on('update-available', (info: UpdateInfo) => {
        logger.info('[AutoUpdater] Update available', info)
        mainWindow?.webContents.send('update-status', {
            status: 'available',
            version: info.version,
            releaseDate: info.releaseDate
        })
    })

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
        logger.info('[AutoUpdater] No updates available', info)
        mainWindow?.webContents.send('update-status', { status: 'up-to-date' })
    })

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
        logger.info('[AutoUpdater] Download progress', {
            percent: progress.percent,
            transferred: progress.transferred,
            total: progress.total
        })
        mainWindow?.webContents.send('update-status', {
            status: 'downloading',
            percent: Math.round(progress.percent),
            transferred: progress.transferred,
            total: progress.total
        })
    })

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
        logger.info('[AutoUpdater] Update downloaded, will install on quit', info)
        mainWindow?.webContents.send('update-status', {
            status: 'downloaded',
            version: info.version
        })

        // Notify renderer that update is ready
        // The update will install automatically when the app quits
    })

    autoUpdater.on('error', (error: Error) => {
        logger.error('[AutoUpdater] Error', error)
        mainWindow?.webContents.send('update-status', {
            status: 'error',
            message: error.message
        })
    })
}

// Check for updates (call on app start and periodically)
export async function checkForUpdates(): Promise<void> {
    try {
        logger.info('[AutoUpdater] Initiating update check')
        await autoUpdater.checkForUpdates()
    } catch (error) {
        logger.error('[AutoUpdater] Failed to check for updates', error)
    }
}

// Force install update now (will quit and restart app)
export function installUpdateNow(): void {
    logger.info('[AutoUpdater] Installing update and restarting...')
    autoUpdater.quitAndInstall(false, true)
}

// Get current app version
export function getCurrentVersion(): string {
    return app.getVersion()
}
