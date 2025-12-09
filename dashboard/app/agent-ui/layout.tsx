import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'SERC Compliance Agent',
    description: 'Device Health Agent UI',
}

export default function AgentUILayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                {/* Prevent zooming in Electron */}
                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
            </head>
            <body style={{ margin: 0, padding: 0, overflow: 'hidden' }}>
                {children}
            </body>
        </html>
    )
}
