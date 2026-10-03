import { profile } from '../data/profile';

// The hero portrait: rounded frame (radius follows the theme) with targeting-computer
// brackets drawn edge to edge of an overlay that stands --hud outside the photo.
export default function Portrait({ className = '' }) {
  const p = profile.photo;
  return (
    <figure className={`portrait relative ${className}`}>
      <div className="relative overflow-hidden rounded-photo border border-line-strong bg-surface" style={{ aspectRatio: `${p.width} / ${p.height}` }}>
        <picture>
          <source type="image/webp" srcSet={`${p.webpSmall} 480w, ${p.webp} 780w`} sizes="(min-width: 1024px) 380px, (min-width: 640px) 340px, 80vw" />
          <img
            src={p.jpg}
            width={p.width}
            height={p.height}
            alt={p.alt}
            // React 18 only passes the attribute through in lowercase.
            // eslint-disable-next-line react/no-unknown-property
            fetchpriority="high"
            decoding="async"
            className="h-full w-full object-cover"
          />
        </picture>
      </div>
      <svg className="portrait-hud" viewBox="0 0 100 125" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 12V0h12M88 0h12v12M100 113v12H88M12 125H0v-12" />
      </svg>
    </figure>
  );
}
