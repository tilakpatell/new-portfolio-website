import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { check } from './budget.mjs';
import { command, wslPath } from './generate.mjs';
import { caption, layout } from './judge.mjs';

describe('judging sheets', () => {
  it('lay the views of each model out in a row', () => {
    const { width, height, cells } = layout(2, ['three', 'front'], 100, 50);
    expect([width, height]).toEqual([200, 100]);
    expect(cells[1]).toEqual([{ row: 1, view: 'three', left: 0, top: 50 }, { row: 1, view: 'front', left: 100, top: 50 }]);
  });
  it('caption a model with its name, triangles and size', () => {
    expect(caption('C:/x/x-wing.glb', { tris: 15987 }, 409872)).toBe('x-wing.glb  15,987 tris  400 KB');
  });
});

describe('engines', () => {
  it('see Windows paths the way WSL does', () => {
    expect(wslPath('C:\\Users\\tilak\\a b\\c.png')).toBe('/mnt/c/Users/tilak/a b/c.png');
    expect(wslPath('/home/tilak/x.glb')).toBe('/home/tilak/x.glb');
  });
  it('run the reference TRELLIS.2 in WSL with the paths translated', () => {
    const cmd = command('trellis2', 'C:\\in\\drone.png', 'C:\\out\\drone.glb', { seed: 7 });
    expect(cmd.slice(0, 5)).toEqual(['wsl.exe', '-d', 'Ubuntu-24.04', '-e', 'bash']);
    expect(cmd.at(-1)).toContain("'/mnt/c/in/drone.png' '/mnt/c/out/drone.glb' --seed 7");
  });
  it('refuse an engine it does not know', () => {
    expect(() => command('meshy', 'a.png', 'b.glb')).toThrow(/no engine meshy/);
  });
});

describe('the web budget', () => {
  it('passes a model within its triangle budget and under 1 MB', () => {
    expect(check({ tris: 16000, after: 15900, bytes: 400 * 1024 })).toEqual([]);
  });
  it('refuses one over budget, naming each problem', () => {
    const problems = check({ tris: 16000, after: 24000, bytes: 4200 * 1024 });
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/24000 triangles, over the budget of 16000/);
    expect(problems[1]).toMatch(/4200 KB, over 4096 KB/);
  });
});

describe('concept pictures', () => {
  it('ask for one object on white, the way the 3D model wants it', async () => {
    const { prompt } = await import('./picture.mjs');
    expect(prompt('an X-wing')).toMatch(/^an X-wing, .*white background.*no text/);
  });
});

describe('following a picture closely', () => {
  it('runs trellis.cpp with the Pixal3D weights and the camera it was taken with', () => {
    const cmd = command('trelliscpp', 'a.png', 'b.glb', { faithful: true, fov: 52 });
    if (!cmd) return; // trellis.cpp isn't installed here
    expect(cmd.join(' ')).toContain('--model pixal3d --fov 52');
    expect(command('trelliscpp', 'a.png', 'b.glb').join(' ')).not.toContain('pixal3d');
  });
});

describe('preparing a picture of your own', () => {
  it('frames the subject in a square with room around it', async () => {
    const { frame } = await import('./prepare.mjs');
    expect(frame(840, 400, 0.08)).toEqual([1000, 80, 300]);
    expect(frame(100, 100, 0)).toEqual([100, 0, 0]);
  });
});

describe('the picture models', () => {
  it('give FLUX its two text encoders and Z-Image its one', async () => {
    const { SDCPP, command, ready } = await import('./picture.mjs');
    if (!ready('zimage')) return; // stable-diffusion.cpp isn't set up here
    const z = command('a drone', 'o.png', { model: 'zimage' }).join(' ');
    expect(z).toContain(`--llm ${SDCPP.zimage.llm}`);
    expect(z).toContain('--steps 8');
    if (!ready('flux')) return;
    const f = command('a drone', 'o.png', { model: 'flux' }).join(' ');
    expect(f).toContain('--clip_l');
    expect(f).toContain('--t5xxl');
    expect(f).toContain('--steps 4');
  });
});

describe('baking in Blender', () => {
  it('runs a Windows Blender directly', async () => {
    const { command } = await import('./bake.mjs');
    const cmd = command('C:/m/raw.glb', 'C:/m/low.glb', { faces: 20000, tex: 1024, where: { kind: 'windows', exe: 'C:/b/blender.exe' } });
    expect(cmd[0]).toBe('C:/b/blender.exe');
    expect(cmd.slice(1, 3)).toEqual(['--background', '--python']);
    expect(cmd.slice(-6)).toEqual(['C:/m/raw.glb', 'C:/m/low.glb', '--faces', '20000', '--tex', '1024']);
  });
  it('runs a Linux Blender in WSL with the paths translated and its missing X libraries found', async () => {
    const { command } = await import('./bake.mjs');
    const cmd = command('C:/m/raw.glb', 'C:/m/low.glb', { where: { kind: 'wsl', exe: '/home/me/blender/blender-4.5.9-linux-x64/blender' } });
    expect(cmd.slice(0, 4)).toEqual(['wsl.exe', '-d', 'Ubuntu-24.04', '-e']);
    const run = cmd.at(-1);
    // (bake.py's own path, as WSL sees it: /mnt/c/… where the repo is on a
    // Windows drive, as it is when this runs for real; as it is anywhere else)
    const script = wslPath(fileURLToPath(new URL('./bake.py', import.meta.url)));
    expect(run).toContain(`'/home/me/blender/blender-4.5.9-linux-x64/blender' '--background' '--python' '${script}'`);
    expect(run).toContain("'/mnt/c/m/raw.glb' '/mnt/c/m/low.glb' '--faces' '24000' '--tex' '2048'");
    expect(run).toMatch(/^export LD_LIBRARY_PATH=~\/miniforge3\/envs\/x11libs\/lib/);
  });
  it('has no command without a Blender', async () => {
    const { command } = await import('./bake.mjs');
    expect(command('a.glb', 'b.glb', { where: null })).toBeNull();
  });
});

describe('the runner, jobs from GitHub issues', () => {
  it('reads a prompt job from an issue: the title names it, the body says what', async () => {
    const { parseIssue, makeArgs } = await import('./runner.mjs');
    const job = parseIssue({ number: 7, title: 'gen3d: TIE Fighter', body: 'what: a TIE fighter\nprompt: a TIE fighter, grey, twin solar panels\nfaces: 16000\nbake: no' });
    expect(job).toMatchObject({ number: 7, name: 'tie-fighter', what: 'a TIE fighter', prompt: 'a TIE fighter, grey, twin solar panels', faces: 16000, noBake: true, faithful: false });
    expect(makeArgs(job)).toEqual(['tie-fighter', '--prompt', 'a TIE fighter, grey, twin solar panels', '--what', 'a TIE fighter', '--faces', '16000', '--no-bake']);
  });
  it('takes an attached picture as the image, followed closely unless told not to', async () => {
    const { parseIssue, makeArgs } = await import('./runner.mjs');
    const job = parseIssue({ number: 8, title: 'Red Five', body: 'what: Red Five\n\n![photo](https://github.com/user-attachments/assets/abc.png)\nfov: 49' });
    expect(job).toMatchObject({ name: 'red-five', image: 'https://github.com/user-attachments/assets/abc.png', prompt: undefined, faithful: true, fov: 49 });
    expect(makeArgs(job, 'C:/c/from-issue.png')).toEqual(['red-five', '--image', 'C:/c/from-issue.png', '--what', 'Red Five', '--fov', '49', '--faithful']);
    expect(parseIssue({ number: 9, title: 'Red Five', body: 'image: https://x.test/a.png\nfaithful: no' })).toMatchObject({ image: 'https://x.test/a.png', faithful: false });
  });
  it('makes the title the prompt when the body says nothing, and no job from an empty title', async () => {
    const { parseIssue } = await import('./runner.mjs');
    expect(parseIssue({ number: 1, title: 'an AT-AT walker', body: '' })).toMatchObject({ name: 'an-at-at-walker', what: 'an AT-AT walker', prompt: 'an AT-AT walker' });
    expect(parseIssue({ number: 2, title: 'gen3d:', body: 'prompt: x' })).toBeNull();
  });
});

describe('the runner, reading what people and sessions actually write', () => {
  it('reads two fields on one line, and an image field holding a bare link', async () => {
    const { parseIssue, makeArgs } = await import('./runner.mjs');
    const body = 'what: Grand Regent Thragg, full body, A-pose\nimage: https://static.wikia.nocookie.net/amazon-invincible/images/b/be/Thragg.png/revision/latest\nfaces: 30000  tex: 2048\n\nMeshy got his skin wrong twice.';
    const job = parseIssue({ number: 441, title: 'thragg', body });
    expect(job).toMatchObject({ name: 'thragg', faces: 30000, tex: 2048, faithful: true, image: 'https://static.wikia.nocookie.net/amazon-invincible/images/b/be/Thragg.png/revision/latest' });
    expect(job.error).toBeUndefined();
    expect(makeArgs(job, 'C:/c/from-issue.png')).toEqual(['thragg', '--image', 'C:/c/from-issue.png', '--what', 'Grand Regent Thragg, full body, A-pose', '--faces', '30000', '--tex', '2048', '--faithful']);
  });
  it('reads an issue form, and says what is wrong with a bad field', async () => {
    const { parseIssue } = await import('./runner.mjs');
    const form = '### what\n\na mossy boulder\n\n### image\n\n![rock](https://github.com/user-attachments/assets/r.png)\n\n### faces\n\n4k\n\n### more\n\nengine: meshy';
    const job = parseIssue({ number: 5, title: 'galaxy-mossrock', body: form });
    expect(job).toMatchObject({ what: 'a mossy boulder', image: 'https://github.com/user-attachments/assets/r.png', faces: 4000 });
    expect(job.error).toMatch(/engine: "meshy"/);
    expect(parseIssue({ number: 6, title: 'x', body: 'what: x\nfaces: lots' }).error).toMatch(/faces: "lots"/);
  });
  it('turns a form into an issue, refusing one with nothing to make', async () => {
    const { request } = await import('./runner.mjs');
    expect(request({ name: 'Cecil Stedman', what: 'Cecil', image: 'https://x.test/c.png', faces: '30000', options: 'tex: 2048  seed: 7' })).toEqual({ title: 'cecil-stedman', body: 'what: Cecil\nimage: https://x.test/c.png\nfaces: 30000\ntex: 2048\nseed: 7' });
    expect(request({ name: 'crest', what: 'the Razor Crest', image: 'https://x.test/f.png, https://x.test/l.png' }).body).toBe('what: the Razor Crest\nfront: https://x.test/f.png\nleft: https://x.test/l.png');
    expect(() => request({ name: 'x' })).toThrow(/at least one of what, prompt or image/);
    expect(() => request({ what: 'x' })).toThrow(/name/);
    expect(() => request({ name: 'x', what: 'x', faces: 'many' })).toThrow(/faces/);
  });
});

describe('the three cuts of a smaller model', () => {
  it('scale with the faces asked for, the texture no bigger than asked', async () => {
    const { cutsFor, TIERS } = await import('./budget.mjs');
    expect(cutsFor()).toEqual(TIERS);
    const rock = cutsFor(4000, 1024);
    expect([rock.hq.faces, rock.mid.faces, rock.lo.faces]).toEqual([4000, 2000, 667]);
    expect([rock.hq.tex, rock.mid.tex, rock.lo.tex]).toEqual([1024, 1024, 1024]);
    expect(cutsFor(30000, 2048).hq).toMatchObject({ faces: 30000, tex: 2048, suffix: '.hq' });
  });
});

describe('a step made again only when its inputs change', () => {
  it('reuses the last output for the same key', async () => {
    const { once, digest } = await import('./steps.mjs');
    const { mkdtempSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const file = join(mkdtempSync(join(tmpdir(), 'once-')), 'raw.glb');
    let runs = 0;
    const make = async () => {
      runs++;
      writeFileSync(file, 'x');
      return { seconds: 1 };
    };
    expect((await once(file, digest('a', 1), make)).reused).toBe(false);
    expect((await once(file, digest('a', 1), make)).reused).toBe(true);
    expect((await once(file, digest('a', 2), make)).reused).toBe(false);
    expect((await once(file, digest('a', 2), make, { fresh: true })).reused).toBe(false);
    expect(runs).toBe(3);
    expect(digest(Buffer.from('ab'), 'c')).not.toBe(digest('a', 'bc'));
  });
});

// an engine's script as WSL is handed it, wherever this checkout is (on a
// Windows drive, /mnt/c/…; on Linux, CI's or a cloud box's, its own path)
const engine = (file) => wslPath(fileURLToPath(new URL(`./engines/${file}`, import.meta.url)));

describe('several sides of one thing', () => {
  it('runs Hunyuan3D multi-view in WSL with every side given', async () => {
    const { command } = await import('./generate.mjs');
    const cmd = command('hunyuan', { front: 'C:/p/f.png', back: 'C:/p/b.png' }, 'C:/p/out.glb', { seed: 7, paint21: false });
    expect(cmd.slice(0, 3)).toEqual(['wsl.exe', '-d', 'Ubuntu-24.04']);
    expect(cmd.at(-1)).toContain(`activate hy3d && cd ~/Hunyuan3D-2 && python '${engine('hunyuan.py')}'`);
    expect(cmd.at(-1)).toContain("'/mnt/c/p/out.glb' --front '/mnt/c/p/f.png' --back '/mnt/c/p/b.png' --seed 7 --steps 50 --faces 300000");
  });
  it('paints the multi-view shape with 2.1 PBR paint from the front when that env is here', async () => {
    const { command } = await import('./generate.mjs');
    const run = command('hunyuan', { front: 'C:/p/f.png', left: 'C:/p/l.png' }, 'C:/p/out.glb', { paint21: true }).at(-1);
    expect(run).toContain(`'/mnt/c/p/out.glb.white.glb' --front '/mnt/c/p/f.png' --left '/mnt/c/p/l.png' --seed 42 --steps 50 --faces 300000 --white && source ~/miniforge3/bin/activate hy3d21 && cd ~/Hunyuan3D-2.1 && python '${engine('hunyuan_paint21.py')}'`);
    expect(run).toContain("hunyuan_paint21.py' '/mnt/c/p/out.glb.white.glb' '/mnt/c/p/f.png' '/mnt/c/p/out.glb'");
  });
  it('gives TRELLIS.2 the front of several sides', async () => {
    const { command } = await import('./generate.mjs');
    const cmd = command('trellis2', { front: 'C:/p/f.png', left: 'C:/p/l.png' }, 'C:/p/out.glb', {});
    expect(cmd.at(-1)).toContain("'/mnt/c/p/f.png'");
    expect(cmd.at(-1)).not.toContain('l.png');
  });
  it('reads an issue with pictures for each side, in order or by name', async () => {
    const { parseIssue, makeArgs } = await import('./runner.mjs');
    const job = parseIssue({ number: 3, title: 'Razor Crest', body: 'what: the Razor Crest\n![f](https://x.test/1.png)\n![l](https://x.test/2.png)\n![b](https://x.test/3.png)' });
    expect(job.views).toEqual({ front: 'https://x.test/1.png', left: 'https://x.test/2.png', back: 'https://x.test/3.png' });
    expect(job.image).toBe('https://x.test/1.png');
    expect(makeArgs(job, 'C:/c/f.png', { front: 'C:/c/f.png', left: 'C:/c/l.png', back: 'C:/c/b.png' })).toEqual(['razor-crest', '--image', 'C:/c/f.png', '--left', 'C:/c/l.png', '--back', 'C:/c/b.png', '--what', 'the Razor Crest']);
    const named = parseIssue({ number: 4, title: 'Razor Crest', body: 'front: https://x.test/a.png\nback: https://x.test/c.png\n![x](https://x.test/zzz.png)' });
    expect(named.views).toEqual({ front: 'https://x.test/a.png', back: 'https://x.test/c.png' });
    expect(parseIssue({ number: 5, title: 'One', body: '![x](https://x.test/one.png)' }).views).toBeUndefined();
  });
});

describe("the model's eyes", () => {
  it('finds the JSON in an answer wrapped in prose or a fence', async () => {
    const { parseJson } = await import('./vlm.mjs');
    expect(parseJson('Sure. ```json\n{"score": 7, "problems": ["the wings are too short"]}\n```')).toEqual({ score: 7, problems: ['the wings are too short'] });
    expect(() => parseJson('no idea')).toThrow(/no JSON/);
  });
});
