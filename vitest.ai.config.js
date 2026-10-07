// The second test run, for the AI and the models (scripts/ai-e2e/README.md):
// the pipelines with fake engines, the assets as shipped, the brains
// scripted and fuzzed, the agent's guards. Apart from `npm test` so that
// one stays fast; `npm run test:ai` runs this.
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['scripts/ai-e2e/**/*.test.mjs', 'src/**/*.fuzz.test.js', 'src/components/universe/npcs/brains/*.scenario.test.js'],
    // tier 3 needs a browser: `npm run test:ai:render` runs it on its own
    exclude: [...configDefaults.exclude, '.claude/**', '.agents/**', 'lab/**', 'scripts/ai-e2e/render/**'],
    // a contract test runs a pipeline in subprocesses: seconds, not milliseconds
    testTimeout: 15000,
    // they share temporary repositories and ports, so one file at a time
    fileParallelism: false,
    passWithNoTests: true,
  },
})
