import Photo from '../Photo';
import { useOnceVisible } from '../ui';

// A wide photograph for each role, in the same misty treatment as the travel
// page: data-centre racks for AWS, F-35s for RTX, headphones for Bose, laser
// optics for Pendar, the FDA's White Oak campus for Empowerreg and SRC's own counter-
// mortar radar. It settles into place the first time it is seen.
export default function RoleBanner({ role, className = '' }) {
  const ref = useOnceVisible('seen');
  return (
    <figure ref={ref} className={`role-banner ${className}`}>
      <Photo id={`exp-${role}`} sizes="(min-width: 1280px) 1180px, 100vw" className="role-banner-img" />
      <span className="role-banner-shade" aria-hidden="true" />
      {role === 'bose' && (
        <figcaption className="role-banner-chip">
          <button type="button" className="role-banner-play" onClick={() => import('../../lib/clips').then((c) => c.playClip('vader'))} aria-label="Play: No, I am your father">
            <span className="eq" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            Now playing: “No, I am your father.”
          </button>
        </figcaption>
      )}
    </figure>
  );
}
