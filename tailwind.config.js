/** @type {import('tailwindcss').Config} */
import defaultTheme from 'tailwindcss/defaultTheme'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Brand Colors (hardcoded for backward compat)
        primary: '#032424',
        secondary: '#2EBCBC',

        // State Colors (hardcoded for backward compat)
        info: '#2F8CED',
        success: '#27AE60',
        warning: '#E2B93B',
        error: '#C10000',

        // Semantic tokens via CSS custom properties (for new components)
        'primary-light': 'var(--color-primary-light)',
        'secondary-light': 'var(--color-secondary-light)',
        'info-light': 'var(--color-info-light)',
        'success-light': 'var(--color-success-light)',
        'warning-light': 'var(--color-warning-light)',
        'error-light': 'var(--color-error-light)',
        surface: {
          base: 'var(--color-surface-base)',
          card: 'var(--color-surface-card)',
          hover: 'var(--color-surface-hover)',
          sidebar: 'var(--color-surface-sidebar)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          placeholder: 'var(--color-text-placeholder)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
          light: 'var(--color-border-light)',
        },

        // Legacy Colors (backward compat)
        black: {
          1: '#000000',
          2: '#1D1D1D',
          3: '#282828',
        },
        gray: {
          1: '#333333',
          2: '#4F4F4F',
          3: '#828282',
          4: '#BDBDBD',
          5: '#E0E0E0',
        },
        white: '#FFFFFF'
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
        display: ['Montserrat', ...defaultTheme.fontFamily.sans],
      },
      fontSize: {
        // Body Text Sizes
        'body-lg': ['20px', '28px'],
        'body-md': ['18px', '25.2px'],
        'body-base': ['16px', '22.4px'],
        'body-sm': ['14px', '19.6px'],
        
        // Heading Sizes
        'h1': ['56px', '61.6px'],
        'h2': ['48px', '52.8px'],
        'h3': ['40px', '44px'],
        'h4': ['32px', '35.2px'],
        'h5': ['24px', '26.4px'],
        'h6': ['20px', '22px'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}