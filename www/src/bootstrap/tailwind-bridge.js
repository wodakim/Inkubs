window.tailwind = window.tailwind || {};
window.tailwind.config = {
    theme: {
        extend: {
            colors: {
                abyssal: '#04060c',
                emerald: '#10b981',
                cyan: '#3b82f6',
                alert: '#ef4444',
                glass: 'rgba(2, 6, 23, 0.6)',
                slime: {
                    200: '#a7f3d0',
                    300: '#6ee7b7',
                    400: '#34d399',
                    DEFAULT: '#10b981',
                    600: '#059669',
                },
                plasma: {
                    300: '#93c5fd',
                    400: '#60a5fa',
                    DEFAULT: '#3b82f6',
                },
            },
            fontFamily: {
                display: ['Fredoka', 'Nunito', 'sans-serif'],
                body: ['Outfit', 'Nunito', 'sans-serif'],
                nunito: ['Nunito', 'sans-serif'],
                mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
            },
            borderRadius: {
                'xl': '24px',
                '2xl': '28px',
                '3xl': '32px',
            },
        },
    },
};
