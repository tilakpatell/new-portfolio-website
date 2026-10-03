import { ART } from '../data/art';

// One of the ink-and-wash paintings from scripts/paint.mjs. Purely decorative.
export default function Art({ name, className = '', style, priority = false }) {
  const a = ART[name];
  if (!a) return null;
  return (
    <img
      src={`/art/${name}.webp`}
      width={a.width}
      height={a.height}
      alt=""
      aria-hidden="true"
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={`art ${className}`}
      style={style}
    />
  );
}
