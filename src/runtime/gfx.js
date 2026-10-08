// What a module sees of the renderer, the same on either backend: its
// size and sharpness (set by the runtime), compile and upload (shaders
// linked and pictures sent before the first frame), a post chain built
// from a description, and a snapshot of the last frame as a 2D overlay for
// a handover. The backends (webgl.js, webgpu.js) fill in the parts that
// differ.
//
// The size and the sharpness are the gfx's alone: both are kept here and
// set on the renderer together, the sharpness through `fit` (the most the
// graphics chip can hold at that size: lib/three/renderer's fitRatio on
// WebGL). Nothing else sets the renderer's pixel ratio, so what a world
// reads from `ratio` is what it's drawn at. A change that leaves the
// drawing buffer as it is touches nothing: writing the canvas's size
// clears what's drawn on it.
//
// makeGfx({ backend, renderer, canvas, compile, upload, post, isLost,
//   release, fit }) → { backend, renderer, canvas, size, ratio, setSize(w, h),
//   setRatio(r), compile, upload, post, snapshot(host), lost, dispose() }

export function makeGfx({ backend, renderer, canvas, compile, upload, post, isLost = () => false, release = () => {}, fit = (w, h, r) => r }) {
  const size = { w: 1, h: 1 };
  let ratio = 1;
  let disposed = false;
  let set = null; // { w, h, bw, bh }: what the renderer was last given (null: nothing yet)
  const apply = () => {
    const r = fit(size.w, size.h, ratio);
    // (the drawing buffer as three's renderer works it out)
    const bw = Math.floor(size.w * r);
    const bh = Math.floor(size.h * r);
    if (set && set.w === size.w && set.h === size.h && set.bw === bw && set.bh === bh) return;
    set = { w: size.w, h: size.h, bw, bh };
    if (renderer.setDrawingBufferSize) renderer.setDrawingBufferSize(size.w, size.h, r);
    else {
      renderer.setPixelRatio(r);
      renderer.setSize(size.w, size.h, false);
    }
  };
  return {
    backend,
    renderer,
    canvas,
    size,
    get ratio() {
      return ratio;
    },
    get lost() {
      return isLost();
    },
    setSize(w, h) {
      size.w = Math.max(1, Math.round(w));
      size.h = Math.max(1, Math.round(h));
      apply();
    },
    // (one resize, and none for the same ratio: a resize waits on the chip)
    setRatio(r) {
      if (r === ratio && renderer.getPixelRatio?.() === r) return;
      ratio = r;
      apply();
    },
    compile,
    upload,
    post,
    // the canvas as it is now, drawn onto a 2D canvas over the host (call
    // it in the same task as the frame, before the browser composites)
    snapshot(host) {
      const el = document.createElement('canvas');
      el.className = 'world-snapshot';
      el.width = canvas.width;
      el.height = canvas.height;
      try {
        el.getContext('2d')?.drawImage(canvas, 0, 0);
      } catch {
        /* nothing to copy: the overlay is clear */
      }
      host.appendChild(el);
      return {
        el,
        set(opacity) {
          el.style.opacity = String(opacity);
        },
        remove() {
          el.remove();
        },
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      renderer.dispose();
      release();
    },
  };
}
