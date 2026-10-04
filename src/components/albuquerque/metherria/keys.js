// Input for the lab: window keys while a station is up, press-and-hold
// buttons that survive a drifting finger, and a short buzz on phones.
import { useEffect, useRef } from 'react';
import { capturePointer } from '../../../lib/pointer';

export const buzz = (ms) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* no vibration */
  }
};
export const typing = (t) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

// Window keys while a station is up (and the lab is on screen).
export function useKeys(active, down, up) {
  const h = useRef({ down, up });
  h.current = { down, up };
  useEffect(() => {
    if (!active) return undefined;
    const onDown = (e) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (h.current.down?.(e.key, e) === true) e.preventDefault();
    };
    const onUp = (e) => {
      if (h.current.up?.(e.key, e) === true) e.preventDefault();
    };
    const onBlur = () => h.current.up?.('blur');
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [active]);
}

// Press-and-hold on a button, by pointer, that survives a drifting finger.
export const holdProps = (set) => ({
  onPointerDown: (e) => {
    e.preventDefault();
    capturePointer(e);
    set(true);
  },
  onPointerUp: () => set(false),
  onPointerCancel: () => set(false),
  onLostPointerCapture: () => set(false),
  onContextMenu: (e) => e.preventDefault(),
  onKeyDown: (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      e.stopPropagation();
      set(true);
    }
  },
  onKeyUp: (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      set(false);
    }
  },
});

