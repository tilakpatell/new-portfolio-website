import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import SEALED from '../components/dickansh/sealed.json';
import { KEPT, unseal } from '../components/dickansh/seal';
import DickanshWorld from '../components/dickansh/DickanshWorld';
import PhoneLock from '../components/dickansh/PhoneLock';
import ModelCredits from '../components/ModelCredits';
import { storage, useDocumentTitle } from '../lib/hooks';
import '../components/dickansh/dickansh.css';

// The Dickansh and Deekbeggers Universe: a world that isn't on any map or
// menu. The way in is the yellowed phone floating in the universe (its lock
// screen is components/dickansh/PhoneLock.jsx); coming straight here, the
// same phone asks. The right password opens the sealed exhibits
// (components/dickansh/seal.js), and then the world itself: a South Indian
// temple gateway whose portal leads to the Dhurandhar universe, where the
// exhibits stand on a floating island. The password is kept for the visit
// (KEPT), so a reload, or the trip from the universe's phone, doesn't ask again.

export default function Dickansh() {
  const [museum, setMuseum] = useState(null);
  const [checking, setChecking] = useState(() => Boolean(storage.get(KEPT)));
  useDocumentTitle(museum ? 'Dickansh & Deekbeggers Universe' : 'Restricted');

  // a password kept from earlier in the visit opens it again
  useEffect(() => {
    const kept = storage.get(KEPT);
    if (!kept) return undefined;
    let live = true;
    unseal(SEALED, kept).then((m) => {
      if (!live) return;
      if (m) setMuseum(m);
      setChecking(false);
    });
    return () => {
      live = false;
    };
  }, []);

  if (checking) return <div className="dk-page dk-checking" aria-busy="true" />;
  if (!museum)
    return (
      <Gate
        onOpen={(m, password) => {
          storage.set(KEPT, password);
          setMuseum(m);
        }}
      />
    );
  return (
    <div className="dk-page">
      <DickanshWorld museum={museum} />
      <Catalogue museum={museum} />
    </div>
  );
}

// straight to /dickansh without the password: the phone, and nothing else
function Gate({ onOpen }) {
  return (
    <div className="dk-page dk-gate">
      <div className="dk-kolam" aria-hidden="true" />
      <h1 className="sr-only">Locked</h1>
      <PhoneLock onOpen={onOpen} />
      <Link to="/" className="dk-back dk-gate-back">
        Back to the site
      </Link>
    </div>
  );
}

// the exhibits as a page, under the world (and all there is without 3D)
function Catalogue({ museum }) {
  return (
    <section className="dk-catalogue shell" aria-labelledby="dk-catalogue-title">
      <p className="dk-eyebrow">The catalogue</p>
      <h2 id="dk-catalogue-title" className="dk-h2">
        {museum.museum}
      </h2>
      <p className="dk-lead">{museum.motto}</p>
      <ol className="dk-cards">
        {museum.exhibits.map((ex, i) => (
          <li key={ex.id} className="dk-card">
            <p className="dk-card-no">{i === 0 ? 'Exhibit Zero' : `Exhibit ${String(i).padStart(2, '0')}`} · {ex.wing}</p>
            <h3 className="dk-card-title">{ex.title}</h3>
            <p className="dk-card-blurb">{ex.blurb}</p>
            <ul className="dk-card-items">
              {ex.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
            {ex.link && (
              <a className="dk-card-link" href={ex.link.href} target="_blank" rel="noopener noreferrer">
                {ex.link.label}
              </a>
            )}
          </li>
        ))}
      </ol>
      <div className="dk-credits">
        <p>Film stills and posters from Dhurandhar (2025, dir. Aditya Dhar, Jio Studios and B62 Studios) and Pushpa 2: The Rule (2024, dir. Sukumar, Mythri Movie Makers), via The Movie Database, are their studios’ own, shown here as a fan’s tribute.</p>
        <ModelCredits where="dickansh" line className="mt-2" />
      </div>
      <Link to="/" className="dk-back">
        Back to the site
      </Link>
    </section>
  );
}
