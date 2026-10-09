import { describe, expect, it } from 'vitest';
import { ask, inputs } from '../desktop/ask.mjs';
import { command, parseIssue, pipeline, request } from './runner.mjs';

describe('a motion issue, read', () => {
  it('takes the prompt and the defaults: three seconds, seed 42, cfg 5, the 1B, beside sword.heavy.a', () => {
    expect(parseIssue({ number: 3, title: 'Overhead Strike', body: 'prompt: a two-handed overhead sword strike, stepping forward' })).toEqual({
      number: 3,
      name: 'overhead-strike',
      prompt: 'a two-handed overhead sword strike, stepping forward',
      seconds: 3,
      seed: 42,
      cfg: 5,
      lite: false,
      with: 'sword.heavy.a',
    });
  });

  it('reads every field, several to a line, and an issue form’s sections', () => {
    const job = parseIssue({ number: 1, title: 'motion: lunge', body: 'prompt: a lunge, colours: none\nseconds: 2.5 s  seed: 9  cfg: 7\nmodel: Lite  with: sword.a' });
    expect(job).toMatchObject({ name: 'lunge', prompt: 'a lunge, colours: none', seconds: 2.5, seed: 9, cfg: 7, lite: true, with: 'sword.a' });
    const form = parseIssue({ number: 2, title: 'parry', body: '### Prompt\n\na high parry\n\n### Seconds\n\n_No response_\n\n### More\n\nseed: 3' });
    expect(form).toMatchObject({ name: 'parry', prompt: 'a high parry', seconds: 3, seed: 3 });
  });

  it('says what is wrong: no prompt, a length out of range, a model it doesn’t know, a long prompt', () => {
    expect(parseIssue({ number: 1, title: 'x', body: '' }).error).toMatch(/prompt: say what the body does/);
    expect(parseIssue({ number: 1, title: 'x', body: 'prompt: a jump\nseconds: 30' }).error).toMatch(/seconds: "30" isn't a number from 1 to 10/);
    expect(parseIssue({ number: 1, title: 'x', body: 'prompt: a jump\nmodel: huge' }).error).toMatch(/model: "huge"/);
    expect(parseIssue({ number: 1, title: 'x', body: `prompt: ${'word '.repeat(61)}` }).error).toMatch(/61 words/);
    expect(parseIssue({ number: 1, title: '!!!', body: 'prompt: a jump' })).toBeNull();
  });
});

describe('asking for one', () => {
  it('writes the issue the runner reads back the same', () => {
    const { title, body } = request({ name: 'Overhead strike', prompt: 'a two-handed overhead sword strike', seconds: '4', options: 'model: lite  with: sword.b' });
    expect(title).toBe('overhead-strike');
    expect(body).toBe('prompt: a two-handed overhead sword strike\nseconds: 4\nmodel: lite\nwith: sword.b');
    expect(parseIssue({ number: 1, title, body })).toMatchObject({ prompt: 'a two-handed overhead sword strike', seconds: 4, lite: true, with: 'sword.b' });
  });

  it('refuses a request the runner would fail', () => {
    expect(() => request({ name: 'x' })).toThrow(/prompt/);
    expect(() => request({ prompt: 'a jump' })).toThrow(/name/);
  });

  it('through ask.mjs, as a cloud session asks (a dry run opens nothing)', async () => {
    expect(inputs('motion', ['overhead-strike', '--prompt', 'a strike', '--seconds', '3', '--dry-run'])).toEqual({ name: 'overhead-strike', prompt: 'a strike', seconds: '3', dryRun: true });
    const r = await ask('motion', ['overhead-strike', '--prompt', 'a two-handed overhead sword strike, stepping forward', '--note', 'the combat spike', '--dry-run']);
    expect(r).toEqual({ title: 'overhead-strike', body: 'prompt: a two-handed overhead sword strike, stepping forward\n\nthe combat spike' });
  });
});

describe('the model, run', () => {
  const job = parseIssue({ number: 1, title: 'strike', body: "prompt: a strike, the sword's arc high\nseconds: 2  seed: 5\nmodel: lite" });

  it('runs generate.py in WSL in the hymotion env, the paths as WSL sees them and the prompt quoted', () => {
    const cmd = command(job, 'C:\\jobs\\strike.bvh', { engine: undefined });
    expect(cmd.slice(0, 5)).toEqual(['wsl.exe', '-d', 'Ubuntu-24.04', '-e', 'bash']);
    expect(cmd.at(-1)).toMatch(/^source ~\/miniforge3\/bin\/activate hymotion && cd ~\/HY-Motion-1\.0 && python '.*scripts\/motion\/generate\.py' /);
    expect(cmd.at(-1)).toContain(`'a strike, the sword'\\''s arc high' '/mnt/c/jobs/strike.bvh' --seconds 2 --seed 5 --cfg 5 --repo ~/HY-Motion-1.0 --lite`);
  });

  it('runs the contract tests’ fake with node', () => {
    const cmd = command(job, 'o.bvh', { engine: 'fake' });
    expect(cmd[0]).toBe(process.execPath);
    expect(cmd[1]).toMatch(/ai-e2e[\\/]fakes[\\/]motion\.mjs$/);
    expect(cmd.slice(2)).toEqual(["a strike, the sword's arc high", 'o.bvh', '--seconds', '2', '--seed', '5']);
  });

  it('waits for 26 GB of the GPU, as HY-Motion asks', () => {
    expect(pipeline).toMatchObject({ name: 'motion', label: 'motion', vram: 26000 });
  });
});
