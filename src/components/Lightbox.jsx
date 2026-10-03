import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { RiArrowLeftLine, RiArrowRightLine, RiCloseLine } from 'react-icons/ri';
import Photo from './Photo';

// A photo, large. Arrow keys step through the set, Escape closes, and focus
// returns to whatever opened it.
export default function Lightbox({ items, index, onIndex, onClose }) {
  const close = useRef(null);
  const item = items[index];

  useEffect(() => {
    const prev = document.activeElement;
    close.current?.focus();
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = overflow;
      if (prev instanceof HTMLElement) prev.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') onIndex((index + 1) % items.length);
      else if (e.key === 'ArrowLeft') onIndex((index - 1 + items.length) % items.length);
      else if (e.key === 'Tab') {
        // keep focus inside the dialog
        const f = [...document.querySelectorAll('.lightbox button')];
        const i = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length]?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, items.length, onClose, onIndex]);

  return createPortal(
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={item.caption} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <figure className="lightbox-figure">
        <Photo id={item.id} sizes="100vw" className="lightbox-img" priority />
        <figcaption className="lightbox-caption">
          <span className="font-semibold">{item.title}</span>
          {item.caption && <span className="text-white/80"> · {item.caption}</span>}
        </figcaption>
      </figure>
      <button ref={close} type="button" className="lightbox-btn lightbox-close" onClick={onClose} aria-label="Close">
        <RiCloseLine className="h-6 w-6" aria-hidden="true" />
      </button>
      {items.length > 1 && (
        <>
          <button type="button" className="lightbox-btn lightbox-prev" onClick={() => onIndex((index - 1 + items.length) % items.length)} aria-label="Previous photo">
            <RiArrowLeftLine className="h-6 w-6" aria-hidden="true" />
          </button>
          <button type="button" className="lightbox-btn lightbox-next" onClick={() => onIndex((index + 1) % items.length)} aria-label="Next photo">
            <RiArrowRightLine className="h-6 w-6" aria-hidden="true" />
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}
