import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScene } from '../../lib/three/useScene';
import { projectById } from '../../data/projects';
import { ROUTE_THEMES, THEMES } from '../../theme/themes';
import './cartridges.css';

// The projects as a hand of game cartridges in 3D, beside the page's
// heading (cartridges/scene.js). Pointing at one names it underneath; a
// click opens it. Without 3D the column stays empty and the list below is
// the way in, as it always is for a keyboard.
const IDS = ['gameboy-emulator', 'swaminarayan-translator', 'devspace', 'awesome-copilot', 'gpu-checkpoint-restart', 'smart-summarizer', 'unix-shell'];
const load = () => import('./cartridges/scene');

export default function Cartridges() {
  const navigate = useNavigate();
  const [hover, setHover] = useState(null);
  const projects = useMemo(
    () =>
      IDS.map(projectById)
        .filter(Boolean)
        .map((p) => ({ id: p.id, title: p.title, kind: p.kind, stack: p.stack, color: THEMES[ROUTE_THEMES[`/projects/${p.id}`]]?.swatch ?? '#555555' })),
    [],
  );
  const { wrap, on } = useScene(load, {
    id: 'cartridges',
    props: { projects, onOpen: (p) => navigate(`/projects/${p.id}`), onHover: setHover },
  });
  return (
    <figure className="cartridges" data-on={on || undefined} aria-hidden="true">
      <div ref={wrap} className="cartridges-stage" />
      <figcaption className="cartridges-caption mono">{hover ? `${hover.title} · ${hover.kind}` : 'Pick a cartridge'}</figcaption>
    </figure>
  );
}
