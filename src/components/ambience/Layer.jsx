import { useEffect } from 'react';
import { useScene } from '../../lib/three/useScene';
import './ambience.css';

// One family's scene, in a fixed box behind the page (see Ambience.jsx).
const SCENES = {
  starwars: () => import('./scenes/starwars'),
  heisenberg: () => import('./scenes/heisenberg'),
  stark: () => import('./scenes/stark'),
  dunder: () => import('./scenes/dunder'),
  arcade: () => import('./scenes/arcade'),
  raga: () => import('./scenes/raga'),
  pirates: () => import('./scenes/pirates'),
  cybertron: () => import('./scenes/cybertron'),
  middleearth: () => import('./scenes/middleearth'),
  rickmorty: () => import('./scenes/rickmorty'),
};

export default function Layer({ family, theme }) {
  const { wrap, on } = useScene(SCENES[family], { id: `ambience-${family}`, props: { theme }, near: '0px' });
  // once it has drawn, the page's colour is <html>'s, so it shows through
  // <body> (whose own background would paint over a layer behind it), and
  // the hero's drawn skyline steps aside for it
  useEffect(() => {
    if (!on) return undefined;
    const root = document.documentElement;
    root.dataset.ambience = family;
    return () => delete root.dataset.ambience;
  }, [family, on]);
  return <div ref={wrap} className="ambience" data-family={family} data-on={on || undefined} aria-hidden="true" />;
}
