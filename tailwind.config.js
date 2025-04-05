/** @type {import('tailwindcss').Config} */
import defaultTheme from 'tailwindcss/defaultTheme'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand Colors
        primary: '#032424',
        secondary: '#2EBCBC',
        
        // State Colors
        info: '#2F8CED',
        success: '#27AE60',
        warning: '#E2B93B',
        error: '#C10000',
        
        // Black Colors
        black: {
          1: '#000000',
          2: '#1D1D1D',
          3: '#282828',
        },
        
        // Grey Colors
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
    },
  },
  plugins: [],
}