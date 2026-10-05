import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { configDefaults } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  base: '/',
  // the skills and the other branches' worktrees under .claude, and the
  // scratch checkouts under lab/, bring their own tests
  test: { exclude: [...configDefaults.exclude, '.claude/**', 'lab/**'] },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // React and the router change rarely, so they cache apart from the
            // app. react-dom/server (one world renders SVG markup with it)
            // stays out, so it only loads with that world.
            { name: 'vendor', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|cookie|set-cookie-parser)[\\/](?!.*server)/ },
          ],
        },
      },
    },
  },
})
