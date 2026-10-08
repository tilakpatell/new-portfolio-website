import { useCallback, useEffect, useRef, useState } from 'react';
import { FIT, frameUnits, panBy, zoomAt } from './mapView';
import { createGesture } from './gesture';

// The galaxy map's view (mapView.js) and the hands on it (gesture.js): the
// wheel or a trackpad zooms about the pointer, a drag pans, two fingers
// pinch, and the page's buttons and keys zoom about the middle.
const STEP = 1.5; // (a button's or a key's zoom)
const LINE = { 0: 1, 1: 16, 2: 120 }; // (a wheel's delta in px, lines or pages: Firefox's wheel is in lines)

export function useMapView(boxRef) {
  const [view, setView] = useState(FIT);
  const gesture = useRef(null);
  gesture.current ??= createGesture();
  const rect = () => boxRef.current?.getBoundingClientRect() ?? { left: 0, top: 0, width: 1, height: 1 };

  const zoom = useCallback((f, u = 0.5, w = 0.5) => setView((v) => zoomAt(v, f, u, w)), []);
  const zoomIn = useCallback(() => zoom(STEP), [zoom]);
  const zoomOut = useCallback(() => zoom(1 / STEP), [zoom]);
  const fit = useCallback(() => setView(FIT), []);
  const frame = useCallback((points) => setView(frameUnits(points)), []);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const dy = e.deltaY * (LINE[e.deltaMode] ?? 1);
      if (!Number.isFinite(dy)) return; // (zoomAt would pass a NaN through into the view)
      const r = el.getBoundingClientRect();
      const f = Math.exp(-Math.max(-60, Math.min(60, dy)) * 0.0068); // (a trackpad's small steps a little; a wheel's notch, about STEP)
      setView((v) => zoomAt(v, f, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [boxRef]);

  const apply = (m) => {
    if (!m) return;
    if (m.pan) setView((v) => panBy(v, m.pan[0], m.pan[1]));
    else setView((v) => zoomAt(v, m.zoom, m.u, m.w));
  };
  const handlers = {
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      gesture.current.down(e.pointerId, e.clientX, e.clientY, rect());
    },
    onPointerMove: (e) => {
      const was = gesture.current.dragging;
      apply(gesture.current.move(e.pointerId, e.clientX, e.clientY, rect()));
      if (!was && gesture.current.dragging) e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    onPointerUp: (e) => gesture.current.up(e.pointerId),
    onPointerCancel: (e) => gesture.current.cancel(e.pointerId),
    // (a drag that ends over a system doesn't pick it)
    onClickCapture: (e) => {
      if (!gesture.current.takeClick()) return;
      e.preventDefault();
      e.stopPropagation();
    },
  };

  return { view, setView, zoom, zoomIn, zoomOut, fit, frame, handlers };
}
