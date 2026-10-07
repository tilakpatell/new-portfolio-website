// The runtime's public surface: runtime() is the one runtime of the page
// visit, made the first time a world asks and kept across routes; useWorld
// puts a module on it from a page; WorldHost is the box it draws in;
// fromScene wraps a scene module written for lib/three/useScene. The
// settings panel's quality and sharpness reach the world that's up through
// window events ('tp:quality', 'tp:sharpness').
//
// Nothing here imports three.js: the backends and the loaders come in
// through browser.js on the first mount, so a page that never draws a
// world never downloads them.

import { createInput } from './input';
import { createQuality } from './quality';
import { createSaves } from './saves';
import { createAssets } from './assets';
import { createAudioBus } from './audio';
import { createRuntime } from './runtime';
import { readOverride } from './backend';
import './runtime.css';

export { useWorld } from './useWorld';
export { default as WorldHost } from './WorldHost';
export { fromScene } from './module';

const GPU_KEY = 'tp-gpu';
const browser = () => import('./browser');
const covered = () => typeof document !== 'undefined' && 'covered' in document.documentElement.dataset;

let instance = null;

export function runtime() {
  if (instance) return instance;
  const win = typeof window !== 'undefined' ? window : null;
  const store = (name) => {
    try {
      return win[name];
    } catch {
      return null;
    }
  };
  let stored = null;
  try {
    stored = win?.localStorage.getItem(GPU_KEY);
  } catch {
    /* storage unavailable */
  }
  const loaders = {
    texture: (url, opts) => browser().then((m) => m.loaders.texture(url, { renderer: instance?.gfx?.renderer ?? null, ...opts })),
    gltf: (url, opts) => browser().then((m) => m.loaders.gltf(url, { renderer: instance?.gfx?.renderer ?? null, ...opts })),
    audio: (url) => browser().then((m) => m.loaders.audio(url)),
  };
  const forget = {
    texture: (url) => browser().then((m) => m.forget.texture(url)),
    gltf: (url) => browser().then((m) => m.forget.gltf(url)),
  };
  instance = createRuntime({
    makeBackend: (kind, opts) => browser().then((m) => m.makeBackend(kind, opts)),
    input: createInput(),
    quality: createQuality({ dpr: win?.devicePixelRatio || 1 }),
    saves: createSaves({ local: store('localStorage'), session: store('sessionStorage'), win }),
    assets: createAssets({ loaders, forget }),
    audio: createAudioBus(),
    gpu: Boolean(win?.navigator?.gpu),
    override: readOverride(win?.location.search ?? '', win?.location.hash ?? '', stored),
    visible: () => !(typeof document !== 'undefined' && document.hidden) && !covered(),
  });
  if (win) {
    const wake = () => instance.invalidate();
    document.addEventListener('visibilitychange', wake);
    win.addEventListener('tp:uncover', wake);
    // (the settings panel: a quality level picked while a world is up goes
    // to it, and one that can't retune is offered a reload, 'tp:quality-
    // reload', which the panel shows and answers with 'tp:world-reload')
    win.addEventListener('tp:quality', (e) => {
      if (instance.requality(e.detail) === 'reload') win.dispatchEvent(new CustomEvent('tp:quality-reload', { detail: { level: e.detail, world: instance.current?.module?.id ?? null } }));
    });
    win.addEventListener('tp:world-reload', () => instance.reload());
    win.addEventListener('tp:sharpness', (e) => instance.sharpen(e.detail));
    if (import.meta.env.DEV) win.__RUNTIME__ = instance; // for the QA scripts
  }
  return instance;
}
