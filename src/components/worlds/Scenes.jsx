import Gif from '../Gif';
import { GIFS } from '../../data/gifs';
import '../../styles/lazy/worlds.css';

// A few scenes from the studio's own GIPHY channel, embedded with credit.
export default function Scenes({ names }) {
  const shown = names.filter((n) => GIFS[n]);
  if (!shown.length) return null;
  // on a wide screen, as many to a row as leaves no row half empty
  const n = shown.length;
  const cols = n <= 5 ? n : n % 4 === 0 ? 4 : n % 3 === 0 ? 3 : 4;
  return (
    <ul className="world-scenes" style={{ '--cols': cols }}>
      {shown.map((n) => (
        <li key={n}>
          <Gif name={n} size="medium" />
          <p className="mt-1.5 text-sm text-body">{GIFS[n].title}</p>
        </li>
      ))}
    </ul>
  );
}
