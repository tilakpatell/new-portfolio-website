import { PHOTOS } from '../data/photos';

// A photo from public/photos/ (made by scripts/photos.mjs) with its responsive
// sizes, intrinsic dimensions (so nothing shifts while it loads) and alt text.
export default function Photo({ id, sizes = '100vw', className = '', priority = false, alt, style }) {
  const p = PHOTOS[id];
  if (!p) return null;
  const largest = p.widths[p.widths.length - 1];
  const srcSet = p.widths.map((w) => `/photos/${id}-${w}.webp ${w}w`).join(', ');
  const extra = priority ? { fetchpriority: 'high' } : {};
  return (
    <img
      src={`/photos/${id}-${p.widths[Math.min(1, p.widths.length - 1)]}.webp`}
      srcSet={srcSet}
      sizes={sizes}
      width={largest}
      height={Math.round(largest * p.ratio)}
      alt={alt ?? p.alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={className}
      style={style}
      {...extra}
    />
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const photoCredit = (id) => PHOTOS[id]?.credit ?? null;
