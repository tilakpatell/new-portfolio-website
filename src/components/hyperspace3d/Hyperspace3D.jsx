import { useEffect, useRef } from 'react';

// The 3D jump's canvas, over everything. `scene` is the scene module, already
// loaded (see load.js). A fresh canvas each time it starts: a WebGL context
// that has been let go can't be had again from the same element.
export default function Hyperspace3D({ scene, entry, onPeak, onDone, onFail }) {
  const cbs = useRef({ onPeak, onDone, onFail });
  cbs.current = { onPeak, onDone, onFail };

  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.className = 'hyperspace-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    const uncover = () => delete document.documentElement.dataset.intro;
    let jump = null;
    try {
      jump = scene.run(canvas, {
        entry,
        uncover,
        onPeak: () => cbs.current.onPeak?.(),
        onDone: () => cbs.current.onDone?.(),
        onFail: () => cbs.current.onFail?.(),
      });
    } catch (err) {
      if (import.meta.env.DEV) console.error('[hyperspace] 3D failed', err);
      canvas.remove();
      // after this render, so the parent can swap in the 2D version
      queueMicrotask(() => cbs.current.onFail?.());
      return undefined;
    }
    return () => {
      jump.stop();
      canvas.remove();
      if (entry) uncover();
    };
  }, [scene, entry]);

  return null;
}
