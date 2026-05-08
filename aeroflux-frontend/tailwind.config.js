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
        'af-bg': '#050a14',
        'af-panel': '#0d1520',
        'af-card': '#111c2d',
        'af-muted': '#1e2d3d',
        'af-header': '#080f1a',
        'af-cyan': '#0ea5e9',
        'af-yellow': '#f59e0b',
        'af-green': '#10b981',
        'af-red': '#ef4444',
        'af-orange': '#f97316',
        'af-purple': '#a855f7',
      },
    },
  },
  plugins: [],
}
