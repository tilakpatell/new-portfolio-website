import MiniMap from './MiniMap';

// The map. For now the flat one; the 3D scene (scene.js + planets.js through
// useScene, with this MiniMap as its fallback) is the next step, see
// docs/superpowers/plans/2026-10-04-universe-map.md, Task 5. Until it lands
// `handle.current.live` stays false, so Enter navigates straight away.
export default function UniverseMap({ selected, onSelect }) {
  return (
    <div className="universe-map">
      <MiniMap selected={selected} onSelect={onSelect} />
    </div>
  );
}
