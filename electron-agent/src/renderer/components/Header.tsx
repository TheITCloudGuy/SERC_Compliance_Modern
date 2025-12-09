export default function Header() {
    const handleMinimize = () => {
        window.electronAPI.minimizeWindow()
    }

    const handleClose = () => {
        window.electronAPI.closeWindow()
    }

    return (
        <header
            className="relative z-10 px-4 py-3 border-b border-white/5"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
            <div className="flex items-center justify-between">
                {/* Title */}
                <div className="flex flex-col">
                    <h1 className="gradient-text text-base font-bold tracking-tight">
                        SERC Compliance
                    </h1>
                    <p className="text-white/40 text-xs">
                        Device Health Agent
                    </p>
                </div>

                {/* Window Controls */}
                <div
                    className="flex items-center gap-1"
                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                >
                    {/* Minimize Button */}
                    <button
                        onClick={handleMinimize}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors group"
                        title="Minimize"
                    >
                        <svg
                            className="w-4 h-4 text-white/50 group-hover:text-white/80"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                    </button>

                    {/* Close Button */}
                    <button
                        onClick={handleClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/20 transition-colors group"
                        title="Close to tray"
                    >
                        <svg
                            className="w-4 h-4 text-white/50 group-hover:text-red-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
        </header>
    )
}
