import { ReactNode } from 'react'

interface StatusCardProps {
    status: 'compliant' | 'warning' | 'error' | 'loading'
    statusText: string
    children: ReactNode
    footer?: string
}

export default function StatusCard({ status, statusText, children, footer }: StatusCardProps) {
    const glowClass = {
        compliant: 'glass-card-glow-green',
        warning: 'glass-card-glow-orange',
        error: 'glass-card-glow-red',
        loading: ''
    }

    const badgeClass = {
        compliant: 'status-badge-green',
        warning: 'status-badge-orange',
        error: 'status-badge-red',
        loading: 'status-badge-blue'
    }

    const statusIcon = {
        compliant: '✓',
        warning: '⚠',
        error: '✗',
        loading: '○'
    }

    return (
        <div className={`glass-card p-5 h-full animate-fade-in-up ${glowClass[status]}`}>
            {/* Status Badge - Centered */}
            <div className="flex items-center justify-center mb-4">
                <div className={`status-badge ${badgeClass[status]}`}>
                    <span>{statusIcon[status]}</span>
                    <span>{statusText}</span>
                </div>
            </div>

            {/* Divider */}
            <div className="divider mb-5" />

            {/* Content */}
            <div className="min-h-[180px] flex flex-col items-center justify-center">
                {children}
            </div>

            {/* Footer */}
            {footer && (
                <>
                    <div className="divider mt-5 mb-4" />
                    <p className="text-white/30 text-xs text-center">{footer}</p>
                </>
            )}
        </div>
    )
}
