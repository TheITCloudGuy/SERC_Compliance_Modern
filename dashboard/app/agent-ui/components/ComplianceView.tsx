'use client'

import { useState, useEffect } from 'react'
import StatusCard from './StatusCard'
import type { ComplianceData, CheckProgress } from '../page'

interface ComplianceViewProps {
    userEmail: string
    userName: string
    complianceData: ComplianceData | null
}

interface ComplianceCheck {
    name: string
    shortName: string
    key: keyof Omit<ComplianceData, 'isCompliant' | 'azureAdStatus'>
    icon: string
}

const COMPLIANCE_CHECKS: ComplianceCheck[] = [
    { name: 'BitLocker', shortName: 'Disk', key: 'bitlocker', icon: '🔒' },
    { name: 'TPM', shortName: 'TPM', key: 'tpm', icon: '🔑' },
    { name: 'Secure Boot', shortName: 'Boot', key: 'secureBoot', icon: '🛡️' },
    { name: 'Firewall', shortName: 'Fire', key: 'firewall', icon: '🧱' },
    { name: 'Antivirus', shortName: 'AV', key: 'antivirus', icon: '🛡️' }
]

export default function ComplianceView({ userEmail, userName, complianceData }: ComplianceViewProps) {
    const [lastCheck, setLastCheck] = useState<Date | null>(null)
    const [isChecking, setIsChecking] = useState(false)
    const [checkProgress, setCheckProgress] = useState<CheckProgress | null>(null)
    const [totalChecks, setTotalChecks] = useState(5)

    useEffect(() => {
        if (complianceData) {
            setLastCheck(new Date())
            setIsChecking(false)
            setCheckProgress(null)
        }
    }, [complianceData])

    // Listen for compliance check progress events
    useEffect(() => {
        const electronAPI = window.electronAPI
        if (!electronAPI) return

        electronAPI.onComplianceCheckStart((data) => {
            setIsChecking(true)
            setTotalChecks(data.total)
            setCheckProgress(null)
        })

        electronAPI.onComplianceCheckProgress((data) => {
            setCheckProgress(data)
        })

        electronAPI.onComplianceCheckError(() => {
            setIsChecking(false)
            setCheckProgress(null)
        })
    }, [])

    const handleRefresh = async () => {
        const electronAPI = window.electronAPI
        if (!electronAPI) return

        setIsChecking(true)
        setCheckProgress(null)
        try {
            await electronAPI.runComplianceCheck()
        } catch (err) {
            console.error('Compliance check error:', err)
            setIsChecking(false)
        }
    }

    // Show progress bar when checking
    if (isChecking || !complianceData) {
        const progress = checkProgress ? (checkProgress.current / totalChecks) * 100 : 0
        const currentCheckName = checkProgress?.name || 'Starting'
        const currentCount = checkProgress?.current || 0

        return (
            <StatusCard status="loading" statusText="Checking...">
                <div className="w-full text-center">
                    <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-4 text-blue-400 mx-auto border border-blue-500/30">
                        <span className="text-2xl animate-pulse">🔍</span>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Running Compliance Checks</h3>
                    <p className="text-white/50 text-sm mb-6">
                        Please wait while we verify your device security settings...
                    </p>

                    {/* Progress bar - matching dashboard enrollment styling */}
                    <div className="w-full bg-white/10 rounded-full h-2 mb-4 overflow-hidden">
                        <div
                            className="progress-bar-fill h-full rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>

                    {/* Current check info */}
                    <div className="flex items-center justify-center gap-2 text-white/60 text-sm">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                        <span>
                            {currentCount > 0
                                ? `Checking ${currentCheckName}... (${currentCount}/${totalChecks})`
                                : 'Initializing checks...'}
                        </span>
                    </div>
                </div>
            </StatusCard>
        )
    }

    const isCompliant = complianceData.isCompliant
    const failedChecks = COMPLIANCE_CHECKS.filter(check => !complianceData[check.key])
    const passedCount = COMPLIANCE_CHECKS.length - failedChecks.length

    return (
        <StatusCard
            status={isCompliant ? 'compliant' : 'error'}
            statusText={isCompliant ? 'Compliant' : 'Non-Compliant'}
            footer={lastCheck ? `Last check: ${lastCheck.toLocaleTimeString()}` : undefined}
        >
            <div className="w-full">
                {/* Main Status */}
                <div className="text-center mb-5">
                    <div className={`text-xl font-bold ${isCompliant ? 'gradient-text-green' : 'text-red-400'}`}>
                        {isCompliant ? 'All Checks Passed' : `${failedChecks.length} Issue${failedChecks.length > 1 ? 's' : ''} Found`}
                    </div>
                    <p className="text-white/50 text-sm mt-2">
                        {isCompliant
                            ? 'Your device meets all security requirements.'
                            : `Failed: ${failedChecks.map(c => c.name).join(', ')}`
                        }
                    </p>
                    <p className="text-white/30 text-xs mt-1">
                        {passedCount}/{COMPLIANCE_CHECKS.length} checks passed
                    </p>
                </div>

                {/* Compliance Checks Grid */}
                <div className="grid grid-cols-5 gap-2 mb-5">
                    {COMPLIANCE_CHECKS.map((check) => {
                        const passed = complianceData[check.key]
                        return (
                            <div
                                key={check.key}
                                className={`check-item ${passed ? 'passed' : 'failed'}`}
                                title={`${check.name}: ${passed ? 'Enabled' : 'Disabled'}`}
                            >
                                <span className="text-lg">{check.icon}</span>
                                <span className={`text-[10px] mt-1 font-medium text-center ${passed ? 'text-green-400' : 'text-red-400'}`}>
                                    {check.name}
                                </span>
                            </div>
                        )
                    })}
                </div>

                {/* User Info */}
                <div className="text-center text-sm pt-4 border-t border-white/5">
                    <p className="font-medium text-white/80">{userName || userEmail}</p>
                    {userName && userEmail && <p className="text-xs text-white/40 mt-0.5">{userEmail}</p>}
                </div>

                {/* Refresh Button */}
                <div className="mt-4 flex justify-center">
                    <button
                        onClick={handleRefresh}
                        disabled={isChecking}
                        className="btn-ghost text-xs flex items-center gap-2"
                    >
                        <span className={isChecking ? 'animate-spin' : ''}>↻</span>
                        {isChecking ? 'Checking...' : 'Refresh'}
                    </button>
                </div>
            </div>
        </StatusCard>
    )
}
