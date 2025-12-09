'use client'

import { useState, useEffect } from 'react'
import StatusCard from './StatusCard'

interface EnrollmentViewProps {
    onEnrollmentComplete: (email: string, name: string) => void
}

export default function EnrollmentView({ onEnrollmentComplete }: EnrollmentViewProps) {
    const [enrollmentCode, setEnrollmentCode] = useState<string>('')
    const [isPolling, setIsPolling] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const electronAPI = window.electronAPI
        if (!electronAPI) return

        // Generate enrollment code on mount
        const generateCode = async () => {
            try {
                const code = await electronAPI.generateEnrollmentCode()
                setEnrollmentCode(code)
                setIsPolling(true)
            } catch (err) {
                setError('Failed to generate enrolment code')
            }
        }

        generateCode()
    }, [])

    useEffect(() => {
        const electronAPI = window.electronAPI
        if (!electronAPI || !isPolling || !enrollmentCode) return

        // Poll for enrollment status every 5 seconds
        const pollInterval = setInterval(async () => {
            try {
                const result = await electronAPI.checkEnrollment(enrollmentCode)
                if (result?.status === 'enrolled') {
                    setIsPolling(false)
                    onEnrollmentComplete(result.userEmail || '', result.userName || '')
                }
            } catch (err) {
                console.error('Polling error:', err)
            }
        }, 5000)

        return () => clearInterval(pollInterval)
    }, [isPolling, enrollmentCode, onEnrollmentComplete])

    if (error) {
        return (
            <StatusCard status="error" statusText="Error">
                <p className="text-red-400">{error}</p>
            </StatusCard>
        )
    }

    return (
        <StatusCard
            status="warning"
            statusText="Device Not Enrolled"
            footer={isPolling ? "Waiting for enrolment..." : undefined}
        >
            <div className="text-center w-full">
                {/* Icon */}
                <div className="mb-4">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10">
                        <span className="text-2xl">🔗</span>
                    </div>
                </div>

                {/* Enrollment Code Display */}
                <div className="enrolment-code text-3xl font-bold mb-5 tracking-widest">
                    {enrollmentCode || '------'}
                </div>

                {/* Instructions */}
                <div className="space-y-2 max-w-[280px] mx-auto">
                    <p className="text-white/60 text-sm">
                        Visit the enrolment portal and enter the code above.
                    </p>
                    <p className="text-white/40 text-xs">
                        The device will be linked to your account automatically.
                    </p>
                </div>

                {/* Polling indicator - glowing blue circle */}
                {isPolling && (
                    <div className="mt-6 flex items-center justify-center">
                        <div className="glow-circle-container">
                            <div className="glow-circle" />
                        </div>
                    </div>
                )}
            </div>
        </StatusCard>
    )
}
