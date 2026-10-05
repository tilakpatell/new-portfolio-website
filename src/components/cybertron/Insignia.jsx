import AutobotMark from '../AutobotMark';
import DecepticonMark from '../DecepticonMark';
import '../../styles/lazy/cybertron.css';

// The faction insignia, cut into slats so it can transform: the slats slide
// out in alternate directions, the face changes, and they slide back in.
const SLATS = 9;

export default function Insignia({ side, phase = 'idle', className = '' }) {
  const Mark = side === 'autobot' ? AutobotMark : DecepticonMark;
  return (
    <svg viewBox="0 0 100 100" className={`tf-insignia ${className}`} data-side={side} data-phase={phase} aria-hidden="true">
      <defs>
        {Array.from({ length: SLATS }, (_, i) => (
          <clipPath key={i} id={`tf-slat-${i}`}>
            <rect x="-30" y={(i * 100) / SLATS - 0.2} width="160" height={100 / SLATS + 0.4} />
          </clipPath>
        ))}
      </defs>
      {Array.from({ length: SLATS }, (_, i) => (
        <g key={i} clipPath={`url(#tf-slat-${i})`}>
          <g className="tf-slat" style={{ '--i': i, '--dir': i % 2 ? 1 : -1 }}>
            <Mark />
          </g>
        </g>
      ))}
    </svg>
  );
}
