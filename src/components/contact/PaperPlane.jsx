import { useScene } from '../../lib/three/useScene';
import './plane.css';

// A paper airplane folded from the memo pad, gliding beside the contact
// page's heading (plane/scene.js). Click it to loop the loop; sending the
// memo throws it. It's decoration: without 3D the space is empty.
const load = () => import('./plane/scene');

export default function PaperPlane() {
  const { wrap, on } = useScene(load, { id: 'paper-plane' });
  return <div ref={wrap} className="paper-plane" data-on={on || undefined} aria-hidden="true" />;
}
