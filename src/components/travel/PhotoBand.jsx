import Photo, { photoCredit } from '../Photo';

// A full-bleed landscape that fades into the page through mist at both edges,
// with slow drifting fog. Children sit over the middle of the photo.
export default function PhotoBand({ id = 'band', children, className = '', credit = true, sizes = '100vw' }) {
  const c = credit ? photoCredit(id) : null;
  return (
    <div className={`photo-band relative isolate overflow-hidden ${className}`}>
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
