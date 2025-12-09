import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Enrollment
    getEnrollmentState: () => ipcRenderer.invoke('get-enrollment-state'),
    generateEnrollmentCode: () => ipcRenderer.invoke('generate-enrollment-code'),
    checkEnrollment: (code: string) => ipcRenderer.invoke('check-enrollment', code),

    // Compliance
    runComplianceCheck: () => ipcRenderer.invoke('run-compliance-check'),
    onComplianceUpdate: (callback: (data: ComplianceData) => void) => {
        ipcRenderer.on('compliance-update', (_, data) => callback(data))
    },
    onComplianceCheckStart: (callback: (data: { total: number }) => void) => {
        ipcRenderer.on('compliance-check-start', (_, data) => callback(data))
    },
    onComplianceCheckProgress: (callback: (data: CheckProgress) => void) => {
        ipcRenderer.on('compliance-check-progress', (_, data) => callback(data))
    },
    onComplianceCheckError: (callback: () => void) => {
        ipcRenderer.on('compliance-check-error', () => callback())
    },

    // System info
    getSystemInfo: () => ipcRenderer.invoke('get-system-info'),

    // Window control
    showWindow: () => ipcRenderer.send('show-window'),
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    closeWindow: () => ipcRenderer.send('close-window')
})

// Type definitions
interface ComplianceData {
    bitlocker: boolean
    tpm: boolean
    secureBoot: boolean
    firewall: boolean
    antivirus: boolean
    isCompliant: boolean
    azureAdStatus: {
        deviceId: string
        joinType: string
    }
}

interface CheckProgress {
    current: number
    total: number
    name: string
}
