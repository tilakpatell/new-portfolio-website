/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Archivo Variable"', 'Archivo', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        card: 'var(--r-card)',
        panel: 'var(--r-panel)',
        btn: 'var(--r-btn)',
        chip: 'var(--r-chip)',
        photo: 'var(--r-photo)',
      },
    },
  },
  plugins: [],
};
