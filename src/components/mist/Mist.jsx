import { useScene } from '../../lib/three/useScene';
import { PHOTOS } from '../../data/photos';
import './mist.css';

// Where the water meets the far shore in each photo that has mist over it:
// the shoreline's height from the top of the photo, as a share of its height,
// at the photo's left and right edges (Moraine Lake's shore runs downhill to
// the right). A photo not listed keeps its CSS fog.
const SHORE = {
  hero: [0.504, 0.671],
  band: [0.563, 0.563],
};

const load = () => import('./scene');

// Low cloud drifting over the lake in a full-bleed photo, in WebGL. The CSS
// fog layers beside it are the fallback: they fade out once this has drawn,
// and stay if 3D is off or fails. `clear` (0 to 1) thins the mist behind a
// headline on the left.
export default function Mist({ photo, clear = 0 }) {
  const shore = SHORE[photo];
  const ratio = PHOTOS[photo]?.ratio;
  const ok = !!shore && !!ratio;
  const { wrap, on } = useScene(load, { enabled: ok, id: `mist-${photo}`, props: { shore, ratio, clear } });
  if (!ok) return null;
  return <div ref={wrap} className="mist-3d" data-on={on || undefined} aria-hidden="true" />;
}
