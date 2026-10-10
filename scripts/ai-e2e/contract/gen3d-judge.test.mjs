// Tier 1: the judge's loop. A miss is made again once with the next seed;
// a second miss ships with its verdict, as the README says; --no-judge
// asks nothing; a Qwen that never answers leaves the model unjudged, not
// failed. The judge is the fake, answering from a script, or a llama-server
// stand-in that hangs.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIXTURES, sandbox } from './repo.mjs';

const REF = join(FIXTURES, 'x-wing-ref.png');
const ARGS = ['xw', '--image', REF, '--what', 'an X-wing starfighter', '--faces', '4000', '--seed', '1'];
const seeds = (box) => box.fakes('engine').map((c) => c.argv[c.argv.indexOf('--seed') + 1]);
const result = (box) => JSON.parse(readFileSync(join(box.cache, 'xw', 'result.json'), 'utf8'));

describe('the judge’s loop (subprocesses, up to 10 s)', () => {
  it('makes a miss again with the next seed and ships the second when it passes', async () => {
    const box = sandbox({ judge: 'judge-reseed.json' });
    const r = await box.make(ARGS);
    expect(r.status, r.err).toBe(0);
    expect(seeds(box)).toEqual(['1', '2']);
    expect(box.judged()).toHaveLength(2);
    expect(result(box)).toMatchObject({ seed: 2, verdict: { score: 9, ok: true } });
    expect(readFileSync(join(box.cache, 'xw', 'make.log'), 'utf8')).toMatch(/not good enough: once more with seed 2/);
  });

  it('tries once more only, then ships with the verdict for the pull request to show', async () => {
    const box = sandbox({ judge: 'judge-never.json' });
    expect((await box.make(ARGS)).status).toBe(0);
    expect(seeds(box)).toEqual(['1', '2']);
    expect(box.judged()).toHaveLength(2);
    expect(result(box)).toMatchObject({ seed: 2, verdict: { score: 4, ok: false, problems: ['the wings are fused'], fix: 'a side view' } });
  });

  it('asks the judge nothing with --no-judge', async () => {
    const box = sandbox({ judge: 'judge-never.json' });
    expect((await box.make([...ARGS, '--no-judge'])).status).toBe(0);
    expect(box.judged()).toEqual([]);
    expect(seeds(box)).toEqual(['1']);
    expect(result(box).verdict).toBeUndefined();
  });

  it('ships the model unjudged when Qwen3-VL never answers (its verdict is only a note)', async () => {
    // a llama-server that says it's up and then never replies, as one sharing the GPU with a voices batch did
    const server = createServer((req, res) => (req.url === '/health' ? res.end('{"status":"ok"}') : undefined));
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const local = mkdtempSync(join(tmpdir(), 'ai-e2e-llamacpp-'));
    for (const d of ['bin', 'models']) mkdirSync(join(local, 'llamacpp', d), { recursive: true });
    for (const f of ['bin/llama-server.exe', 'models/Qwen3-VL-8B-Instruct-Q8_0.gguf', 'models/mmproj-F16.gguf']) writeFileSync(join(local, 'llamacpp', f), '');
    try {
      const box = sandbox();
      const r = await box.make(ARGS, { GEN3D_JUDGE: 'qwen', LOCALAPPDATA: local, VLM_PORT: String(server.address().port), VLM_TIMEOUT_MS: '300' });
      expect(r.status, r.err).toBe(0);
      expect(seeds(box)).toEqual(['1']);
      expect(result(box)).toMatchObject({ seed: 1, cuts: { hq: {}, mid: {}, lo: {} } });
      expect(result(box).verdict).toBeUndefined();
      expect(readFileSync(join(box.cache, 'xw', 'make.log'), 'utf8')).toMatch(/no verdict: Qwen3-VL failed/);
    } finally {
      server.closeAllConnections();
      server.close();
    }
  });
});
