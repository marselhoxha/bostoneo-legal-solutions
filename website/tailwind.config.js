/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#e8f4ff',
          100: '#d5ebff',
          200: '#b3d9ff',
          300: '#85c4ff',
          400: '#38b6ff', // Logo light blue
          500: '#1e88e5',
          600: '#1e56b6', // Logo mid blue  
          700: '#004aad', // Logo dark blue
          800: '#003d8f',
          900: '#002d6b',
          950: '#001a3f',
        },
        surface: {
          50: '#fafbfe',
          100: '#f1f3f9',
          200: '#e4e7f0',
          300: '#cdd1de',
          400: '#9da4b8',
          500: '#6b7394',
          600: '#4a5068',
          700: '#363b50',
          800: '#252839',
          900: '#181b28',
          950: '#0d0f18',
        },
        success: '#0ab39c',
        warning: '#f7b84b',
        danger: '#f06548',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-mesh': 'radial-gradient(ellipse at 20% 50%, rgba(30,86,182,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(56,182,255,0.1) 0%, transparent 50%), radial-gradient(ellipse at 50% 80%, rgba(0,74,173,0.08) 0%, transparent 50%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.6s ease-out forwards',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(24px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
      },
    },
  },
  plugins: [],
}
