import { describe, expect, it } from 'vitest';
import { render } from './status.mjs';

const base = { repo: 'o/r', runners: [], gpu: null, pipelines: {} };

describe('the status, read out', () => {
  it('says how the last AI health night went, and when', () => {
    const at = new Date(Date.now() - 3 * 3600000).toISOString();
    const text = render({ ...base, aiHealth: { conclusion: 'failure', createdAt: at, url: 'https://x/runs/9' } });
    expect(text).toMatch(/AI health, last night: failure \(3 h ago\) https:\/\/x\/runs\/9/);
  });
  it('says so when the nightly has not run yet', () => {
    expect(render({ ...base, aiHealth: null })).toMatch(/AI health: no night yet \(\.github\/workflows\/ai-health\.yml\)/);
  });
});
