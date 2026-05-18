/** @type {import('tailwindcss').Config} */
import defaultTheme from 'tailwindcss/defaultTheme'

// Shieldlytics design system — mapped per UI_DESIGN-DIANA.md §4.1
// Foundation tokens live in src/index.css. This file mirrors them as Tailwind
// utility classes so `bg-teal-600`, `text-gray-900`, `font-mono`, etc. resolve
// to brand-correct values.

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand — Shieldlytics teal
        teal: {
          50:  '#E6FAFA',
          100: '#C7F2F2',
          200: '#8FE4E4',
          300: '#4FD3D3',
          400: '#14B8B8',
          500: '#14B8B8',
          600: '#009999', // primary
          700: '#007A7A', // hover / text on white
          800: '#005656', // press
          900: '#003838',
          950: '#001F1F',
        },

        // Neutrals — cool gray, faint teal undertone
        gray: {
          0:   '#FFFFFF',
          25:  '#FAFBFB',
          50:  '#F5F7F7',
          100: '#EDEFEF',
          200: '#E1E5E5',
          300: '#CBD1D1',
          400: '#9BA5A5',
          500: '#6B7676',
          600: '#4C5757',
          700: '#344040',
          800: '#1F2929',
          900: '#111818',
          950: '#080C0C',
        },

        // Status (measured, not loud)
        success: { DEFAULT: '#0E8F5E', bg: '#E6F5EE', fg: '#075A3B' },
        warning: { DEFAULT: '#C77A0A', bg: '#FDF3E2', fg: '#7A4A06' },
        danger:  { DEFAULT: '#C0352B', bg: '#FBEAE8', fg: '#7A211A' },
        info:    { DEFAULT: '#2260B8', bg: '#E8EFFA', fg: '#163F7A' },

        // Legacy aliases — keep `primary` / `secondary` resolving to the new brand
        // so existing `bg-primary` usages migrate automatically. Remove once swept.
        primary: '#009999',
        secondary: '#007A7A',
        white: '#FFFFFF',
      },

      fontFamily: {
        sans: ['Montserrat', 'ui-sans-serif', 'system-ui', ...defaultTheme.fontFamily.sans],
        display: ['Montserrat', 'ui-sans-serif', 'system-ui'],
        mono: ['"Commit Mono"', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },

      fontSize: {
        // Spec scale — match --fs-* tokens
        'xs':   ['12px', { lineHeight: '1.5' }],
        'sm':   ['13px', { lineHeight: '1.5' }],
        'base': ['14px', { lineHeight: '1.5' }],
        'md':   ['15px', { lineHeight: '1.5' }],
        'lg':   ['17px', { lineHeight: '1.5' }],
        'xl':   ['20px', { lineHeight: '1.3' }],
        '2xl':  ['24px', { lineHeight: '1.3' }],
        '3xl':  ['30px', { lineHeight: '1.3' }],
        '4xl':  ['38px', { lineHeight: '1.15' }],
        '5xl':  ['48px', { lineHeight: '1.15' }],
        '6xl':  ['64px', { lineHeight: '1.15' }],

        // Legacy aliases — map old body-*/h* names to spec scale during migration.
        'body-lg':   ['17px', '1.5'],
        'body-md':   ['15px', '1.5'],
        'body-base': ['14px', '1.5'],
        'body-sm':   ['13px', '1.5'],
        'h1':        ['38px', '1.15'],
        'h2':        ['30px', '1.3'],
        'h3':        ['24px', '1.3'],
        'h4':        ['20px', '1.3'],
        'h5':        ['17px', '1.3'],
        'h6':        ['15px', '1.3'],
      },

      boxShadow: {
        focus: '0 0 0 3px rgba(20,184,184,0.28)',
        'focus-danger': '0 0 0 3px rgba(192,53,43,0.22)',
        inset: 'inset 0 1px 2px rgba(8,20,20,0.04)',
      },

      borderRadius: {
        pill: '999px',
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
