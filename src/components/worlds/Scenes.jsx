import Gif from '../Gif';
import { GIFS } from '../../data/gifs';

// A few scenes from the studio's own GIPHY channel, embedded with credit.
export default function Scenes({ names }) {
  const shown = names.filter((n) => GIFS[n]);
  if (!shown.length) return null;
  return (
    <ul className="world-scenes">
      {shown.map((n) => (
        <li key={n}>
          <Gif name={n} size="medium" />
          <p className="mt-1.5 text-sm text-body">{GIFS[n].title}</p>
        </li>
      ))}
    </ul>
  );
}
