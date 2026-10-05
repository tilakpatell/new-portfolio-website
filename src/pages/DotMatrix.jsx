import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import DotMatrixWorld from '../components/dotmatrix/DotMatrixWorld';
import { cartInfo, useFound } from '../components/dotmatrix/found';
import { CARTRIDGES } from '../components/dotmatrix/rules';
import { PALETTES, PALETTE_ORDER } from '../components/dotmatrix/dither';
import WorldSwitcher from '../components/worlds/WorldSwitcher';
import { projectById } from '../data/projects';
import { useDocumentTitle } from '../lib/hooks';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// The dithering, on its own: a ramp from dark to light, in the four shades,
// with the 4 × 4 pattern deciding which pixels go up a shade.
function Ramp({ palette, dither }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    const g = c?.getContext('2d');
    if (!g) return;
    const { width: w, height: h } = c;
    const shades = PALETTES[palette].shades;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = x / (w - 1);
        const b = dither ? (BAYER[(x % 4) + (y % 4) * 4] + 0.5) / 16 : 0.5;
        g.fillStyle = shades[Math.max(0, Math.min(3, Math.floor(v * 3 + b)))];
        g.fillRect(x, y, 1, 1);
      }
    }
  }, [palette, dither]);
  return <canvas ref={ref} width={128} height={20} className="dm-ramp" aria-label={`A ramp from dark to light in the ${PALETTES[palette].name} palette, ${dither ? 'dithered' : 'without dithering'}`} role="img" />;
}

export default function DotMatrix() {
  useDocumentTitle('Dot Matrix');
  const found = useFound();
  const [palette, setPalette] = useState('dmg');
  const [dither, setDither] = useState(true);
  const emulator = projectById('gameboy-emulator');

  return (
    <div className="dm-page relative">
      <DotMatrixWorld />

      <section className="shell relative z-10 grid gap-6 pb-4 pt-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <p className="eyebrow">Dot Matrix · Gaming</p>
          <p className="lead mt-4 max-w-[64ch]">
            Games got me into code. This island is drawn the way a Game Boy drew things: four shades of green and a lot of patience. Eight cartridges are hidden on it, each one something I’ve built, and the giant Game Boy in the square plays for real.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link to="/projects/gameboy-emulator" className="btn btn-primary">
            The Game Boy emulator
          </Link>
          <Link to="/" className="btn btn-ghost">
            Back to the site
          </Link>
        </div>
      </section>
      <section className="shell relative z-10 pb-2">
        <WorldSwitcher />
      </section>

      <section className="shell relative z-10 py-12 md:py-16" aria-labelledby="dm-carts-title">
        <h2 id="dm-carts-title" className="title">
          The cartridges
        </h2>
        <p className="lead mt-4 max-w-[58ch]">
          {found.length === CARTRIDGES.length ? 'You found them all.' : `${found.length} of ${CARTRIDGES.length} found so far.`} Every one is a project page, found or not.
        </p>
        <ul className="dm-shelf mt-8">
          <li className="dm-shelf-console">
            <p className="dm-shelf-tag">The console</p>
            <Link to="/projects/gameboy-emulator" className="dm-shelf-name">
              {emulator?.title}
            </Link>
            <p className="dm-shelf-text">{emulator?.summary}</p>
          </li>
          {CARTRIDGES.map((c, i) => {
            const info = cartInfo(c.id);
            const got = found.includes(c.id);
            return (
              <li key={c.id} data-got={got || undefined}>
                <p className="dm-shelf-tag">
                  {String(i + 1).padStart(2, '0')} · {got ? 'Found' : c.where}
                </p>
                <Link to={info.link} className="dm-shelf-name">
                  {info.title}
                </Link>
                <p className="dm-shelf-text">{info.text}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="shell relative z-10 py-12 md:py-16" aria-labelledby="dm-how-title">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
          <div>
            <h2 id="dm-how-title" className="title">
              How it’s drawn
            </h2>
            <p className="lead mt-4 max-w-[54ch]">The island is a real 3D scene, lit and shadowed, drawn a few hundred pixels across. A last pass turns each pixel’s brightness into one of four shades.</p>
            <p className="mt-4 max-w-[60ch] leading-relaxed text-body">
              Between two shades, a 4 × 4 Bayer matrix decides which pixels step up: half-way gives a checkerboard, a quarter gives every fourth pixel. Edges where something stands in front of something further off come from the depth buffer and are drawn in the darkest shade, the way the sprites were outlined. The giant Game Boy’s screen is already in four shades, so it skips the pattern.
            </p>
          </div>
          <div className="dm-how card">
            <Ramp palette={palette} dither={dither} />
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <div className="seg" role="group" aria-label="Palette">
                {PALETTE_ORDER.map((id) => (
                  <button key={id} type="button" aria-pressed={palette === id} onClick={() => setPalette(id)}>
                    {PALETTES[id].name}
                  </button>
                ))}
              </div>
              <button type="button" className="btn btn-ghost btn-sm" aria-pressed={dither} onClick={() => setDither((d) => !d)}>
                {dither ? 'Dithering on' : 'Dithering off'}
              </button>
            </div>
            <div className="mt-5 flex items-center gap-5">
              <ol className="dm-bayer" aria-label="The 4 by 4 Bayer matrix">
                {BAYER.map((n, i) => (
                  <li key={i} style={{ '--k': n * 5 }}>
                    {n}
                  </li>
                ))}
              </ol>
              <ul className="dm-swatches" aria-label={`The ${PALETTES[palette].name} palette`}>
                {PALETTES[palette].shades.map((s) => (
                  <li key={s} style={{ background: s }}>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="shell relative z-10 pb-24 md:pb-28">
        <p className="text-xs leading-relaxed text-muted">The island, its people and its tune are made in code for this site, so nothing is downloaded. The lettering is Press Start 2P (SIL Open Font License). Game Boy is a trademark of Nintendo; this page isn’t affiliated with Nintendo.</p>
      </section>
    </div>
  );
}
