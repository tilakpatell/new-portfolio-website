// The two test runs stay apart: `npm test` keeps its sub-second promise and
// never picks up a contract test that spawns a pipeline, and `npm run
// test:ai` finds every tier it can run without a GPU.
import { describe, expect, it } from 'vitest';
import ai from '../../vitest.ai.config.js';
import site from '../../vite.config.js';

const AI_GLOBS = ['scripts/ai-e2e/**', '**/*.fuzz.test.js', '**/*.scenario.test.js'];

describe('the two vitest runs', () => {
  it('keep the AI tiers out of npm test', () => {
    for (const glob of AI_GLOBS) expect(site.test.exclude).toContain(glob);
  });
  it('give npm run test:ai the contract tests, the fuzz tests and the brains’ scenarios', () => {
    expect(ai.test.include).toEqual(['scripts/ai-e2e/**/*.test.mjs', 'src/**/*.fuzz.test.js', 'src/components/universe/npcs/brains/*.scenario.test.js']);
    expect(ai.test.testTimeout).toBe(15000);
    // the contract tests share temporary repositories and the dev-server port
    expect(ai.test.fileParallelism).toBe(false);
  });
});
