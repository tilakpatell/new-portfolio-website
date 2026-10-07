// Tier 3, every model draws (scripts/ai-e2e/README.md): headless Chromium
// and a dev server, so apart from `npm run test:ai`; `npm run
// test:ai:render` runs it, on a pull request that touches a model and
// every night.
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['scripts/ai-e2e/render/**/*.render.test.mjs'],
    exclude: [...configDefaults.exclude, '.claude/**', '.agents/**', 'lab/**'],
    // a browser launched for each model, through a dev server
    testTimeout: 120000,
    hookTimeout: 120000,
    fileParallelism: false,
    passWithNoTests: true,
  },
})
