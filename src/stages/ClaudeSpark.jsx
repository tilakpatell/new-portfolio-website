// Claude's mark, drawn in code (its colour and spin are in index.css). In a
// file of its own so the pages that show it don't bring the whole Claude
// stage and its styles with them: the stage loads lazily, the mark doesn't.
export function ClaudeSpark({ spinning = false, className = '' }) {
  const rays = [0, 33, 68, 101, 138, 172, 205, 241, 276, 309, 342];
  return (
    <svg viewBox="0 0 48 48" className={`claude-spark ${spinning ? 'is-spinning' : ''} ${className}`} aria-hidden="true">
      {rays.map((deg, i) => (
        <rect key={deg} x="22.3" y={i % 3 === 0 ? 3 : i % 3 === 1 ? 6 : 4.5} width="3.4" height={i % 3 === 0 ? 21 : i % 3 === 1 ? 18 : 19.5} rx="1.7" transform={`rotate(${deg} 24 24)`} />
      ))}
    </svg>
  );
}
