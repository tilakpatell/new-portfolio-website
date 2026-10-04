import { PHOTOS } from '../data/photos';

// A photo from public/photos/ (made by scripts/photos.mjs) with its responsive
// sizes, intrinsic dimensions (so nothing shifts while it loads) and alt text.
export default function Photo({ id, sizes = '100vw', className = '', priority = false, eager = false, alt, style }) {
  const p = PHOTOS[id];
  if (!p) return null;
  const largest = p.widths[p.widths.length - 1];
  const srcSet = p.widths.map((w) => `/photos/${id}-${w}.webp ${w}w`).join(', ');
  const extra = priority ? { fetchpriority: 'high' } : {};
  // React writes these attributes in the order they are listed here, and the
  // browser can start the download the moment it sees sizes, srcset or src. So
  // loading goes first: otherwise, when React builds the page twice (it does
  // whenever the globe's code arrives mid-render), every photo on the page is
  // fetched at once, however far down it is.
  return (
    <img
      loading={priority || eager ? 'eager' : 'lazy'}
      decoding="async"
      {...extra}
      sizes={sizes}
      srcSet={srcSet}
      src={`/photos/${id}-${p.widths[Math.min(1, p.widths.length - 1)]}.webp`}
      width={largest}
      height={Math.round(largest * p.ratio)}
      alt={alt ?? p.alt}
      className={className}
      style={style}
    />
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const photoCredit = (id) => PHOTOS[id]?.credit ?? null;
