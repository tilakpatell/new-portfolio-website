import { PHOTOS } from '../../data/photos';
import { useScene } from '../../lib/three/useScene';
import './peace3d.css';

// The Peace section's photo in WebGL: lamplight that flickers, a halo off
// the lit stone, the reflection shimmering, and a swell on each tanpura
// pluck (see peace/scene.js). The <img> stays underneath for a browser
// without WebGL, and until the first frame is drawn.
const load = () => import('./scene');

export default function Lamplight({ id, water }) {
  const p = PHOTOS[id];
  const { wrap, on } = useScene(load, {
    enabled: !!p,
    id: `peace-${id}`,
    props: p && { src: `/photos/${id}-${p.widths[p.widths.length - 1]}.webp`, aspect: 1 / p.ratio, water },
  });
  if (!p) return null;
  return <div ref={wrap} className="peace-gl" data-on={on || undefined} aria-hidden="true" />;
}
