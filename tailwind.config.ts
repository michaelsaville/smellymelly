import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          cream: '#FFF8F0',
          warm: '#F5E6D3',
          peach: '#FBBF8B',
          terra: '#C67D4A',
          brown: '#8B5E3C',
          dark: '#4A3728',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          warm: '#FFFAF5',
          muted: '#F9F3ED',
        },
      },
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
