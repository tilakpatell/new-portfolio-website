// The box a world module draws in: the runtime puts its canvas first in
// it, and the page's HUD, labels and controls go over it as children,
// built from the HUD kit (./hud: its frame, Menu, prompt, objective, toast,
// bubble, list, players chip, stick and touch buttons, laid out by tested
// rules).
//
// <WorldHost world={useWorld(...)} className="earth-stage" ...>{hud}</WorldHost>
//
// `veil` (true, or { title, line }) puts the loading veil over the box while
// the world prepares (useWorld's 'preparing' and its progress), fading out
// as it begins; its title is the veil's own or the module's label (the last
// one it had, so it doesn't go blank as the veil fades, when nothing is
// being made any more). Off unless the page asks for it, and then `world`
// needs the status and progress too.

import { useState } from 'react';
import LoadingVeil from '../components/worlds/LoadingVeil';

export default function WorldHost({ world, veil = null, className = '', children, ...rest }) {
  const v = veil && typeof veil === 'object' ? veil : {};
  const title = v.title ?? world.rt?.loading?.label ?? null;
  const [named, setNamed] = useState(title);
  if (title && title !== named) setNamed(title);
  return (
    <div ref={world.host} className={`world-host ${className}`.trim()} {...rest}>
      {children}
      {veil ? <LoadingVeil shown={world.status === 'preparing'} progress={world.progress?.value ?? 0} step={world.progress?.step ?? undefined} title={title ?? named ?? undefined} line={v.line} /> : null}
    </div>
  );
}
