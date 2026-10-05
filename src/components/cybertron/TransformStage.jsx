import { useScene } from '../../lib/three/useScene';

// The transformation's stage. In WebGL (./transform3d.js) the vehicle is
// built from parts that fly apart as the robot stands up through a ring of
// energon, and the figure turns under your hand; without WebGL, the drawn
// figure it's given (the SVG Optimus or Megatron) stays.
const load = () => import('./transform3d');

export default function TransformStage({ side, mode, matrix = false, firing = false, children }) {
  const { wrap, meant } = useScene(load, { id: `cy-transform-${side}`, props: { side, mode, matrix, firing } });
  return (
    <div ref={wrap} className="cy-stage-3d" role="img" aria-label={side === 'autobot' ? `Optimus Prime, as ${mode === 'alt' ? 'a cab-over truck' : 'a robot'}. Drag to turn him.` : `Megatron, as ${mode === 'alt' ? 'a Cybertronian jet' : 'a robot'}. Drag to turn him.`}>
      {!meant && children}
    </div>
  );
}
