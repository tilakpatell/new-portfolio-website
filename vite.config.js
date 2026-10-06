import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { configDefaults } from 'vitest/config'
import iconsApart from './scripts/icons-apart.mjs'
import prerender from './scripts/prerender.mjs'

export default defineConfig({
  // each react-icons icon a module of its own, so the entry chunk carries
  // only the icons the nav and footer draw (scripts/icons-apart.mjs)
  // and after a build, a page of its own for each route, for links shared
  // and search (scripts/prerender.mjs)
  plugins: [iconsApart(), react(), prerender()],
  // (the icons' modules import react-icons' own GenIcon: bundled up front in dev)
  optimizeDeps: { include: ['react-icons/lib'] },
  base: '/',
  // the skills and the other branches' worktrees under .claude bring their own tests
  test: { exclude: [...configDefaults.exclude, '.claude/**'] },
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
