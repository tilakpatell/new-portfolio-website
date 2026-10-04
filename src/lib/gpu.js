// Does this device have a graphics chip worth drawing in 3D for? The games
// draw in WebGL where there is one, and in 2D canvas everywhere else (the 2D
// versions are complete games, not placeholders). WebGL that a browser runs
// in software on the CPU (SwiftShader, llvmpipe, Microsoft's basic driver)
// counts as none, because it would play worse than the 2D version.
//
// The visitor can choose: 'auto' (the default), 'on' (3D wherever WebGL
// exists at all) or 'off' (always 2D). The choice is kept between visits.

import { useEffect, useState } from 'react';

const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen|gdi generic/i;
const KEY = 'tp-3d';
const EVENT = 'tp:3d';

export const classify = (renderer = '') => ({ renderer, software: SOFTWARE.test(renderer) });

// Look once, on a throwaway canvas, then let the context go.
export function probe(doc = typeof document !== 'undefined' ? document : undefined) {
  const none = { webgl: false, webgl2: false, renderer: '', software: false, ok: false };
  if (!doc?.createElement) return none;
  try {
    const canvas = doc.createElement('canvas');
    const opts = { failIfMajorPerformanceCaveat: true, powerPreference: 'high-performance' };
    let gl = canvas.getContext('webgl2', opts);
    const webgl2 = !!gl;
    if (!gl) gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    if (!gl) return none;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String((info && gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    const { software } = classify(renderer);
    return { webgl: true, webgl2, renderer, software, ok: !software };
  } catch {
    return none;
  }
}

let cached = null;
export const gpu = () => (cached ??= probe());

export const resolve3D = (mode, info) => (mode === 'off' ? false : mode === 'on' ? info.webgl : info.ok);

export function mode3D() {
  try {
    const m = window.localStorage.getItem(KEY);
    return m === 'on' || m === 'off' ? m : 'auto';
  } catch {
    return 'auto';
  }
}

export function setMode3D(mode) {
  try {
    if (mode === 'auto') window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, mode);
  } catch {
    /* storage unavailable: it lasts for this page */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: mode }));
}

// { on, can, mode, set }: whether to draw in 3D now, whether WebGL exists at
// all, the visitor's choice, and a way to change it.
export function use3D() {
  const [mode, setMode] = useState(mode3D);
  useEffect(() => {
    const on = (e) => setMode(e.detail ?? mode3D());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  const info = gpu();
  return { on: resolve3D(mode, info), can: info.webgl, auto: info.ok, mode, set: setMode3D };
}
