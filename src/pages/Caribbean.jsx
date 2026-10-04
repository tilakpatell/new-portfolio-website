import { useState } from 'react';
import { Link } from 'react-router-dom';
import Compass from '../components/caribbean/Compass';
import DeadMansTide from '../components/caribbean/tide/DeadMansTide';
import WorldSwitcher from '../components/worlds/WorldSwitcher';
import { useDocumentTitle } from '../lib/hooks';
import '../components/caribbean/caribbean.css';

const ART = (name) => `${import.meta.env.BASE_URL}games/caribbean/art/${name}.webp`;

// the game's five chapters, each with the model that stars in it
const VOYAGE = [
  { art: 'navy', name: 'A sail on the horizon', line: 'A navy patrol has your scent. Lay her alongside and give them a broadside before they give you one.' },
  { art: 'chest', name: 'Dead men’s gold', line: 'Four chests adrift among the islands, and two of the king’s ships between you and them.' },
  { art: 'fort', name: 'The fort', line: 'Its mortars drop where you are going, not where you are. Don’t be there.' },
  { art: 'ghost', name: 'The cursed ship', line: 'She goes under, and comes up again beside you. Watch for the water boiling.' },
  { art: 'kraken', name: 'The kraken', line: 'Arms first: keep way on and they come down on empty sea. Then the head, and every gun you have.' },
];

// the code, and what each article comes to in practice
const CODE = [
  ['Every man has a vote in affairs of moment.', 'The captain has two.'],
  ['Any man who falls behind is left behind.', 'Unless he’s holding the map.'],
  ['The right of parley shall not be refused.', 'It may be postponed until after the broadside.'],
  ['No prey, no pay.', 'Rum is not pay. Rum is rum.'],
  ['Take what you can.', 'Give nothing back.'],
];

// The Caribbean: Pirates of the Caribbean. Sail Dead man's tide in 3D, follow
// the compass that doesn't point north, and read the code (the guidelines).
export default function Caribbean() {
  useDocumentTitle('The Caribbean');
  const [loose, setLoose] = useState(() => new Set());
  const bend = (i) =>
    setLoose((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  return (
    <div className="relative cb-page">
      <section className="shell relative z-10 grid items-center gap-10 pb-14 pt-[calc(var(--nav-h)+36px)] md:pb-20 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-16" aria-labelledby="cb-title">
        <div>
          <p className="eyebrow">Pirates of the Caribbean</p>
          <h1 id="cb-title" className="display cb-display mt-6 text-[clamp(3rem,1.6rem+6vw,6.6rem)]">
            The Caribbean
          </h1>
          <p className="lead mt-6 max-w-[46ch]">A black ship, a sea full of the king’s navy, and something very large asleep under it. Take what you can. Give nothing back.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#tide" className="btn btn-primary">
              Set sail
            </a>
            <Link to="/" className="btn btn-ghost cb-home">
              Back to the site
            </Link>
          </div>
          <WorldSwitcher className="mt-10" />
        </div>
        <Compass />
      </section>

      <section id="tide" className="shell relative z-10 scroll-mt-24 py-14 md:py-20" aria-labelledby="tide-title">
        <p className="eyebrow">In 3D · WebGL</p>
        <h2 id="tide-title" className="title cb-title mt-3">
          Dead man’s tide
        </h2>
        <p className="lead mt-4 max-w-[64ch]">
          Sail her yourself. Set the sails, put the helm over, and bring a broadside to bear: her guns point off her sides, so the fight is all in where you put the ship. Five chapters, a refit from the shipwright after each, and the kraken at the end of it.
        </p>
        <div className="mt-8">
          <DeadMansTide />
        </div>
      </section>

      <section id="cb-voyage" className="shell relative z-10 scroll-mt-24 py-14 md:py-20" aria-labelledby="voyage-title">
        <h2 id="voyage-title" className="title cb-title">
          The voyage
        </h2>
        <p className="lead mt-4 max-w-[58ch]">Five chapters, in the order they try to kill you. The ships, the fort and the beast were modelled for this page.</p>
        <ol className="cb-voyage mt-10">
          {VOYAGE.map((c, i) => (
            <li key={c.name} className="cb-leg">
              <img src={ART(c.art)} alt="" width="720" height="720" loading="lazy" decoding="async" />
              <div>
                <span className="cb-leg-n">{['I', 'II', 'III', 'IV', 'V'][i]}</span>
                <h3>{c.name}</h3>
                <p>{c.line}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="cb-code" className="shell relative z-10 scroll-mt-24 py-14 md:py-20" aria-labelledby="code-title">
        <div className="cb-code">
          <div>
            <h2 id="code-title" className="title cb-title">
              The code
            </h2>
            <p className="lead mt-4 max-w-[40ch]">Set down by the brethren, and binding on all of them. Press an article to see how binding.</p>
          </div>
          <ol className="cb-articles">
            {CODE.map(([rule, guideline], i) => (
              <li key={rule}>
                <button type="button" className="cb-article" aria-pressed={loose.has(i)} onClick={() => bend(i)}>
                  <span className="cb-article-n">{i + 1}</span>
                  <span className="cb-article-rule">{rule}</span>
                  <span className="cb-article-guide">{guideline}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
        <p className="cb-credits mt-14">
          The ships, the kraken, the fort and the islands were generated for this site with Meshy and compressed for the web; the sky is “Evening Road 01” from Poly Haven (CC0); the lettering is Pirata One and IM Fell English (SIL Open Font License). The sea, the smoke and the sound are code. Not affiliated with Disney.
        </p>
      </section>
    </div>
  );
}
