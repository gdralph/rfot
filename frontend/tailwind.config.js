/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // DXC Brand Colors
        dxc: {
          // Primary Brand Color
          'bright-purple': '#5F249F',
          
          // Accent Colors (in priority order)
          'bright-teal': '#00968F',
          'blue': '#00A3E1',
          'dark-teal': '#006975',
          'green': '#6CC24A',
          'orange': '#ED9B33',
          'gold': '#FFCD00',
          'dark-purple': '#330072',
          'yellow': '#F9F048',
          
          // Neutral Colors
          'light-gray': '#D9D9D6',
          'medium-gray': '#969696',
          'dark-gray': '#63666A',
        }
      },
      fontFamily: {
        'sans': ['Arial', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        'arial': ['Arial', 'sans-serif'],
      },
      fontSize: {
        // DXC Typography Scale (adjusted for web)
        'dxc-title': ['3rem', { lineHeight: '1.2', fontWeight: '700' }], // ~44-60pt
        'dxc-section': ['2.25rem', { lineHeight: '1.2', fontWeight: '700' }], // ~54pt
        'dxc-slide': ['1.5rem', { lineHeight: '1.3', fontWeight: '700' }], // ~36pt
        'dxc-subtitle': ['1.25rem', { lineHeight: '1.4', fontWeight: '700' }], // ~24-28pt
        'dxc-body': ['1rem', { lineHeight: '1.5', fontWeight: '400' }], // ~20pt
        'dxc-callout': ['0.875rem', { lineHeight: '1.4', fontWeight: '700' }], // ~16pt
        'dxc-footnote': ['0.625rem', { lineHeight: '1.3', fontWeight: '400' }], // ~9pt
      },
      spacing: {
        'dxc-xs': '0.5rem',
        'dxc-sm': '1rem',
        'dxc-md': '1.5rem',
        'dxc-lg': '2rem',
        'dxc-xl': '3rem',
        'dxc-2xl': '4rem',
      },
      borderRadius: {
        'dxc': '8px',
        'dxc-lg': '12px',
      },
    },
  },
  plugins: [],
}