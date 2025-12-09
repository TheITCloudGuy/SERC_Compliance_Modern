/** @type {import('tailwindcss').Config} */
export default {
    content: ['./src/renderer/**/*.{js,ts,jsx,tsx,html}'],
    theme: {
        extend: {
            colors: {
                slate: {
                    850: '#1e293b',
                    950: '#0f172a'
                }
            },
            fontFamily: {
                sans: ['Segoe UI', 'system-ui', 'sans-serif']
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-up': 'slideUp 0.4s ease-out',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite'
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' }
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' }
                }
            }
        }
    },
    plugins: []
}
