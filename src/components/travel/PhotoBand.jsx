import { useEffect, useRef, useState } from 'react';
import Photo, { photoCredit } from '../Photo';

// A full-bleed landscape that fades into the page through mist at both edges,
// with slow drifting fog. Children sit over the middle of the photo.
export default function PhotoBand({ id = 'band', children, className = '', credit = true, sizes = '100vw' }) {
  const c = credit ? photoCredit(id) : null;
  // the fog only drifts while the band is on screen
  const box = useRef(null);
  const [live, setLive] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setLive(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={box} className={`photo-band relative isolate overflow-hidden ${className}`} data-live={live || undefined}>
      <Photo id={id} sizes={sizes} className="absolute inset-0 -z-20 h-full w-full object-cover" />
      <div className="band-mist -z-10" aria-hidden="true" />
      <div className="fog fog-a -z-10" aria-hidden="true" />
      <div className="fog fog-b -z-10" aria-hidden="true" />
      {children}
      {c && (
        <p className="photo-credit">
          Photo:{' '}
          <a href={c.source} target="_blank" rel="noopener noreferrer">
            {c.author}
          </a>
          {c.license ? `, ${c.license}` : ''}
        </p>
      )}
    </div>
  );
}
