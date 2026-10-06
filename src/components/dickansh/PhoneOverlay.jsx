import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import PhoneLock from './PhoneLock';
import { KEPT } from './seal';
import { storage } from '../../lib/hooks';

// The universe's phone, picked up (universe/phone.js): its lock screen over
// everything, a dialog (so the ship's keys and the page's Escape leave it
// alone). The right password is kept for the visit, so the page it opens
// (pages/Dickansh.jsx) doesn't ask again, and then onUnlock() takes you
// there. Escape, the close button or a press outside the phone puts it down.
export default function PhoneOverlay({ onClose, onUnlock }) {
  useEffect(() => {
    const back = document.activeElement;
    return () => {
      if (back instanceof HTMLElement && document.contains(back)) back.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <div
      className="ph-overlay dark-scope"
      role="dialog"
      aria-modal="true"
      aria-label="A locked phone"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <PhoneLock
        onClose={onClose}
        onOpen={(museum, password) => {
          storage.set(KEPT, password);
          onUnlock();
        }}
      />
    </div>,
    document.body,
  );
}
