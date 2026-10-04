import { useScene } from '../../lib/three/useScene';
import './motif3d/motif3d.css';

// Each role's diagram as a small 3D model, laid over its SVG. The SVG stays
// underneath until the model has drawn, and comes back if 3D is off or fails.
const SCENES = {
  capacity: () => import('./motif3d/capacity'),
  roadmap: () => import('./motif3d/roadmap'),
  stream: () => import('./motif3d/stream'),
  spectrum: () => import('./motif3d/spectrum'),
  heatmap: () => import('./motif3d/heatmap'),
  graph: () => import('./motif3d/graph'),
};

export default function Motif3D({ name }) {
  const load = SCENES[name];
  const { wrap, on } = useScene(load, { enabled: !!load, id: `motif-${name}` });
  if (!load) return null;
  return (
    <div ref={wrap} className="motif-3d" data-on={on || undefined} aria-hidden="true" />
  );
}
