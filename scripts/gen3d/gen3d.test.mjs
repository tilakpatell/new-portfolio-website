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
    const problems = check({ tris: 16000, after: 24000, bytes: 1300 * 1024 });
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/24000 triangles, over the budget of 16000/);
    expect(problems[1]).toMatch(/1300 KB, over 1024 KB/);
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
