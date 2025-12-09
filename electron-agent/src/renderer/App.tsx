import { useState, useEffect } from 'react'
import Header from './components/Header'
import EnrollmentView from './components/EnrollmentView'
import ComplianceView from './components/ComplianceView'

// Declare the electron API types
declare global {
    interface Window {
        electronAPI: {
            getEnrollmentState: () => Promise<EnrollmentState>
            generateEnrollmentCode: () => Promise<string>
            checkEnrollment: (code: string) => Promise<EnrollmentResponse | null>
            runComplianceCheck: () => Promise<void>
            onComplianceUpdate: (callback: (data: ComplianceData) => void) => void
            onComplianceCheckStart: (callback: (data: { total: number }) => void) => void
            onComplianceCheckProgress: (callback: (data: CheckProgress) => void) => void
            onComplianceCheckError: (callback: () => void) => void
            getSystemInfo: () => Promise<SystemInfo>
            showWindow: () => void
            minimizeWindow: () => void
            closeWindow: () => void
        }
    }
}

export interface EnrollmentState {
    isEnrolled: boolean
    userEmail: string
    userName: string
    enrollmentCode: string
}

export interface EnrollmentResponse {
    status: string
    userEmail?: string
    userName?: string
}

export interface ComplianceData {
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

export interface CheckProgress {
    current: number
    total: number
    name: string
}

export interface SystemInfo {
    hostname: string
    serialNumber: string
    osBuild: string
    deviceId: string
    joinType: string
}

function App() {
    const [isEnrolled, setIsEnrolled] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [enrollmentState, setEnrollmentState] = useState<EnrollmentState | null>(null)
    const [complianceData, setComplianceData] = useState<ComplianceData | null>(null)

    useEffect(() => {
        // Load initial enrollment state
        const loadState = async () => {
            try {
                const state = await window.electronAPI.getEnrollmentState()
                setEnrollmentState(state)
                setIsEnrolled(state.isEnrolled)

                if (state.isEnrolled) {
                    // Run compliance check on load
                    await window.electronAPI.runComplianceCheck()
                }
            } catch (error) {
                console.error('Failed to load enrollment state:', error)
            } finally {
                setIsLoading(false)
            }
        }

        loadState()

        // Listen for compliance updates
        window.electronAPI.onComplianceUpdate((data) => {
            setComplianceData(data)
        })
    }, [])

    // Pause CSS animations when window is hidden to save CPU
    useEffect(() => {
        const handleVisibilityChange = () => {
            const orbs = document.querySelector('.floating-orbs') as HTMLElement | null
            if (orbs) {
                orbs.style.animationPlayState = document.hidden ? 'paused' : 'running'
                // Also pause child orbs
                orbs.querySelectorAll('.orb').forEach((orb) => {
                    (orb as HTMLElement).style.animationPlayState = document.hidden ? 'paused' : 'running'
                })
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    }, [])

    const handleEnrollmentComplete = (email: string, name: string) => {
        setEnrollmentState(prev => prev ? { ...prev, isEnrolled: true, userEmail: email, userName: name } : null)
        setIsEnrolled(true)

        // Run compliance check after enrollment
        window.electronAPI.runComplianceCheck()
    }

    if (isLoading) {
        return (
            <div className="h-screen flex flex-col" style={{ background: 'var(--background)' }}>
                {/* Floating Orbs Background */}
                <div className="floating-orbs">
                    <div className="orb orb-1" />
                    <div className="orb orb-2" />
                </div>

                <Header />
                <div className="flex-1 flex items-center justify-center relative z-10">
                    <div className="animate-pulse text-white/40">Loading...</div>
                </div>
            </div>
        )
    }

    return (
        <div className="h-screen flex flex-col" style={{ background: 'var(--background)' }}>
            {/* Floating Orbs Background */}
            <div className="floating-orbs">
                <div className="orb orb-1" />
                <div className="orb orb-2" />
            </div>

            <Header />
            <main className="flex-1 p-5 overflow-hidden relative z-10">
                {isEnrolled ? (
                    <ComplianceView
                        userEmail={enrollmentState?.userEmail || ''}
                        userName={enrollmentState?.userName || ''}
                        complianceData={complianceData}
                    />
                ) : (
                    <EnrollmentView onEnrollmentComplete={handleEnrollmentComplete} />
                )}
            </main>
        </div>
    )
}

export default App
