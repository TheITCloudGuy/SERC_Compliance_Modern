import { Tray, Menu, app, nativeImage, BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

let tray: Tray | null = null
let mainWindow: BrowserWindow | null = null

export function createTray(window: BrowserWindow): Tray {
    mainWindow = window

    // Get correct resources path for both dev and production
    const iconPath = is.dev
        ? join(process.cwd(), 'resources', 'icon.ico')
        : join(process.resourcesPath, 'resources', 'icon.ico')

    let icon: Electron.NativeImage

    try {
        icon = nativeImage.createFromPath(iconPath)
        if (icon.isEmpty()) {
            icon = createDefaultIcon()
        }
    } catch {
        icon = createDefaultIcon()
    }

    tray = new Tray(icon)

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show',
            click: () => {
                mainWindow?.show()
                mainWindow?.focus()
            }
        },
        { type: 'separator' },
        {
            label: 'Exit',
            click: () => {
                app.isQuitting = true
                app.quit()
            }
        }
    ])

    tray.setToolTip('SERC Compliance Agent')
    tray.setContextMenu(contextMenu)

    // Double-click to show window
    tray.on('double-click', () => {
        mainWindow?.show()
        mainWindow?.focus()
    })

    return tray
}

export function updateTrayIcon(isCompliant: boolean): void {
    if (!tray) return

    // Update tooltip based on compliance status
    tray.setToolTip(
        isCompliant
            ? 'SERC Compliance Agent - Compliant'
            : 'SERC Compliance Agent - Non-Compliant'
    )
}

function createDefaultIcon(): Electron.NativeImage {
    // Create a simple 16x16 shield-like icon programmatically
    const size = 16
    const canvas = Buffer.alloc(size * size * 4)

    // Create a blue shield-like shape
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const i = (y * size + x) * 4

            // Create shield shape
            const centerX = size / 2
            const topWidth = size * 0.8
            const bottomY = size * 0.85

            // Calculate if pixel is inside shield
            const relY = y / size
            const currentWidth = topWidth * (1 - relY * 0.3)
            const isInShield =
                y >= 2 &&
                y < bottomY &&
                Math.abs(x - centerX) < currentWidth / 2

            if (isInShield) {
                // Blue color for shield
                canvas[i] = 59      // R
                canvas[i + 1] = 130 // G
                canvas[i + 2] = 246 // B
                canvas[i + 3] = 255 // A
            } else {
                // Transparent
                canvas[i] = 0
                canvas[i + 1] = 0
                canvas[i + 2] = 0
                canvas[i + 3] = 0
            }
        }
    }

    return nativeImage.createFromBuffer(canvas, { width: size, height: size })
}

export function destroyTray(): void {
    tray?.destroy()
    tray = null
}
