import PortalSwirl from './PortalSwirl';

// The hero's portal: the show's green swirl, as solid as it is on screen
// (you never see through one, only where you come out). It swirls open when
// the page arrives, and each shot of the portal gun (`firing`, a counter)
// snaps it shut and opens it again somewhere else.
export default function PortalHero({ firing, className }) {
  return (
    <div className={`rm-portal ${className ?? ''}`}>
      <PortalSwirl shot={firing} size={[0.28, 0.38]} className="rm-portal-fill" />
    </div>
  );
}
