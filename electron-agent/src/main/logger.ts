import { app } from 'electron'
import { join } from 'path'
import { appendFileSync, existsSync, mkdirSync, statSync, renameSync } from 'fs'

const MAX_LOG_SIZE = 5 * 1024 * 1024 // 5MB max log file size
const MAX_LOG_FILES = 3 // Keep 3 rotated log files

let logPath: string = ''
let isInitialized = false

/**
 * Initialize the logger - must be called after app is ready
 */
export function initLogger(): void {
    const userDataPath = app.getPath('userData')
    const logsDir = join(userDataPath, 'logs')

    // Ensure logs directory exists
    if (!existsSync(logsDir)) {
        mkdirSync(logsDir, { recursive: true })
    }

    logPath = join(logsDir, 'agent.log')
    isInitialized = true

    // Log startup
    log('info', '='.repeat(60))
    log('info', `SERC Compliance Agent Started - v${app.getVersion()}`)
    log('info', `Log file: ${logPath}`)
    log('info', `User Data Path: ${userDataPath}`)
    log('info', '='.repeat(60))
}

/**
 * Get the log file path
 */
export function getLogPath(): string {
    return logPath
}

/**
 * Rotate log file if it's too large
 */
function rotateLogIfNeeded(): void {
    if (!existsSync(logPath)) return

    try {
        const stats = statSync(logPath)
        if (stats.size > MAX_LOG_SIZE) {
            // Rotate existing log files
            for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
                const oldPath = `${logPath}.${i}`
                const newPath = `${logPath}.${i + 1}`
                if (existsSync(oldPath)) {
                    if (i === MAX_LOG_FILES - 1) {
                        // Delete oldest file (would be overwritten anyway)
                    } else {
                        renameSync(oldPath, newPath)
                    }
                }
            }
            // Move current log to .1
            renameSync(logPath, `${logPath}.1`)
        }
    } catch (error) {
        // Ignore rotation errors
    }
}

/**
 * Log a message to the log file
 */
export function log(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: unknown): void {
    const timestamp = new Date().toISOString()
    const levelStr = level.toUpperCase().padEnd(5)

    let logLine = `[${timestamp}] [${levelStr}] ${message}`

    if (data !== undefined) {
        try {
            if (typeof data === 'object') {
                logLine += ` | ${JSON.stringify(data)}`
            } else {
                logLine += ` | ${data}`
            }
        } catch {
            logLine += ` | [Unserializable data]`
        }
    }

    // Also log to console for dev mode
    const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
    consoleMethod(logLine)

    // Write to file if initialized
    if (isInitialized && logPath) {
        try {
            rotateLogIfNeeded()
            appendFileSync(logPath, logLine + '\n', 'utf-8')
        } catch (error) {
            console.error('Failed to write to log file:', error)
        }
    }
}

/**
 * Convenience methods
 */
export const logger = {
    info: (message: string, data?: unknown) => log('info', message, data),
    warn: (message: string, data?: unknown) => log('warn', message, data),
    error: (message: string, data?: unknown) => log('error', message, data),
    debug: (message: string, data?: unknown) => log('debug', message, data)
}
