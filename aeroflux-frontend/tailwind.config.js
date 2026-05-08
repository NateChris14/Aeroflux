/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        'af-bg':     '#020810',
        'af-panel':  '#060e1a',
        'af-card':   '#091422',
        'af-muted':  '#0e1e30',
        'af-header': '#040b16',
        'af-cyan':   '#0ea5e9',
        'af-yellow': '#f59e0b',
        'af-green':  '#10b981',
        'af-red':    '#ef4444',
        'af-orange': '#f97316',
        'af-purple': '#a855f7',
      },
    },
  },
  plugins: [],
}
