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

// Ask for a context on a canvas: WebGL 2 first, then WebGL 1.
const context = (canvas, opts) => {
  const gl = canvas.getContext('webgl2', opts);
  if (gl) return { gl, webgl2: true };
  return { gl: canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts), webgl2: false };
};

// Look once, on a throwaway canvas, then let the context go. The first ask
// refuses anything with a major performance caveat; when hardware
// acceleration is off that refusal is all a browser gives, so a second,
// relaxed ask on a fresh canvas finds the software WebGL behind it.
export function probe(doc = typeof document !== 'undefined' ? document : undefined) {
  const none = { webgl: false, webgl2: false, renderer: '', software: false, caveat: false, ok: false };
  if (!doc?.createElement) return none;
  try {
    let caveat = false;
    let { gl, webgl2 } = context(doc.createElement('canvas'), { failIfMajorPerformanceCaveat: true, powerPreference: 'high-performance' });
    if (!gl) {
      ({ gl, webgl2 } = context(doc.createElement('canvas'), {}));
      caveat = !!gl;
    }
    if (!gl) return none;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String((info && gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    const software = caveat || classify(renderer).software;
    return { webgl: true, webgl2, renderer, software, caveat, ok: !software };
  } catch {
    return none;
  }
}

// Why a game that only draws in WebGL can't start here: 'ok', 'software'
// (WebGL without the graphics chip, which is what switching hardware
// acceleration off leaves) or 'none' (no WebGL at all).
export const gpuStatus = (info) => (info.ok ? 'ok' : info.webgl ? 'software' : 'none');

let cached = null;
export const gpu = () => (cached ??= probe());

// Look again (after the visitor has changed a setting and come back), and
// tell anything listening.
export function reprobe() {
  cached = probe();
  window.dispatchEvent(new CustomEvent(EVENT, { detail: mode3D() }));
  return cached;
}

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
  const [, setLooked] = useState(0); // bumped by reprobe(), which may leave the mode as it was
  useEffect(() => {
    const on = (e) => {
      setMode(e.detail ?? mode3D());
      setLooked((n) => n + 1);
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  const info = gpu();
  return { on: resolve3D(mode, info), can: info.webgl, auto: info.ok, mode, set: setMode3D, info, status: gpuStatus(info) };
}
