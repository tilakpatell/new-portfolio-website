// What a module sees of the renderer, the same on either backend: its
// size and sharpness (set by the runtime), compile and upload (shaders
// linked and pictures sent before the first frame), a post chain built
// from a description, and a snapshot of the last frame as a 2D overlay for
// a handover. The backends (webgl.js, webgpu.js) fill in the parts that
// differ.
//
// makeGfx({ backend, renderer, canvas, compile, upload, post, isLost,
//   release }) → { backend, renderer, canvas, size, ratio, setSize(w, h),
//   setRatio(r), compile, upload, post, snapshot(host), lost, dispose() }

export function makeGfx({ backend, renderer, canvas, compile, upload, post, isLost = () => false, release = () => {} }) {
  const size = { w: 1, h: 1 };
  let ratio = 1;
  let disposed = false;
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
      renderer.setSize(size.w, size.h, false);
    },
    // (one resize, and none for the same ratio: a resize waits on the chip)
    setRatio(r) {
      if (r === ratio && renderer.getPixelRatio?.() === r) return;
      ratio = r;
      if (renderer.setDrawingBufferSize) renderer.setDrawingBufferSize(size.w, size.h, r);
      else {
        renderer.setPixelRatio(r);
        renderer.setSize(size.w, size.h, false);
      }
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
