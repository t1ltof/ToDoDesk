/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#1a1d23',
          elevated: '#22262e',
          border: '#2d3340'
        },
        accent: {
          DEFAULT: '#3b82f6',
          muted: '#1e3a5f'
        }
      }
    }
  },
  plugins: []
}