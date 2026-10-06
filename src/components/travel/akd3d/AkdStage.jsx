import { useMemo } from 'react';
import { PHOTOS } from '../../../data/photos';
import { useScene } from '../../../lib/three/useScene';
import './akd3d.css';
import '../../../styles/lazy/travel.css';

const load = () => import('./scene');

// How far the <img> on screen is through its CSS drift, in ms (null if it
// isn't drifting), so the first WebGL frame lands on the same zoom.
function elapsed(el) {
  const img = el?.parentElement?.querySelector('.akd-slide[data-on] img');
  const t = img?.getAnimations?.()[0]?.currentTime;
  return typeof t === 'number' ? t : null;
}

// The slideshow's photo in WebGL, laid over the <img> stack in the stage. It
// stays transparent until a frame with the photo in it is up (the <img>'s
// exact crop and zoom), then marks itself data-drawn and the <img>s step
// aside; if 3D is off, fails or is lost, they come back as they were.
export default function AkdStage({ place, day, index, scrub, rang }) {
  const photos = useMemo(() => day.map((d) => ({ id: d.id, pos: d.pos, ratio: PHOTOS[d.id]?.ratio, widths: PHOTOS[d.id]?.widths })), [day]);
  const { wrap } = useScene(load, { id: 'akd', props: { place, photos, index, scrub, rang, elapsed } });
  return <div ref={wrap} className="akd-gl" aria-hidden="true" />;
}
