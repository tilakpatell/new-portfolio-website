import { Link } from 'react-router-dom';
import EarthWorld from '../components/earth/EarthWorld';
import { HOME_V, STAMPS, kmBetween } from '../components/earth/rules';
import { stampDate, useStamps } from '../components/earth/stamps';
import Photo from '../components/Photo';
import ModelCredits from '../components/ModelCredits';
import WorldSwitcher from '../components/worlds/WorldSwitcher';
import { HOME_CITY } from '../data/places';
import { useDocumentTitle } from '../lib/hooks';

const fmt = new Intl.NumberFormat('en-US');

// Earth: the Travel planet's world. The globe from orbit, the dive down onto
// it, and the flight to every place I've been; then the passport, how the
// globe is made, and the way to the travel page, which has the photos and
// the stories.
export default function Earth() {
  useDocumentTitle('Earth');
  const stamps = useStamps();
  const count = Object.keys(stamps).length;

  return (
    <div className="earth-page relative">
      <EarthWorld />

      <section className="shell relative z-10 grid gap-6 pb-4 pt-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <p className="eyebrow">Earth · Travel</p>
          <p className="lead mt-4 max-w-[64ch]">
            Every trip starts from {HOME_CITY}. Come down out of orbit onto the globe as it is right now, and fly a little plane to every place I’ve been: a stamp in your passport at each, and a postcard.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link to="/travel" className="btn btn-primary">
            The travel page
          </Link>
          <Link to="/" className="btn btn-ghost">
            Back to the site
          </Link>
        </div>
      </section>
      <section className="shell relative z-10 pb-2">
        <WorldSwitcher />
      </section>

      <section className="shell relative z-10 py-12 md:py-16" aria-labelledby="earth-passport-title">
        <h2 id="earth-passport-title" className="title">
          The passport
        </h2>
        <p className="lead mt-4 max-w-[58ch]">{count === STAMPS.length ? 'Every stamp. You’ve been everywhere I have.' : `${count} of ${STAMPS.length} stamped so far.`} Each postcard opens on the travel page.</p>
        <ul className="earth-shelf mt-8">
          {STAMPS.map((st) => (
            <li key={st.id} data-got={stamps[st.id] ? '' : undefined}>
              <Link to={`/travel?place=${st.id}`}>
                <span className="earth-shelf-photo">
                  <Photo id={st.id} sizes="(min-width: 1024px) 260px, (min-width: 640px) 33vw, 50vw" className="h-full w-full object-cover" />
                  {stamps[st.id] && (
                    <span className="earth-shelf-stamp" aria-label={`Stamped ${stampDate(stamps[st.id])}`}>
                      {stampDate(stamps[st.id])}
                    </span>
                  )}
                </span>
                <span className="earth-shelf-name">{st.name}</span>
                <span className="earth-shelf-km">
                  {fmt.format(Math.round(kmBetween(HOME_V, st.v) / 10) * 10)} km from {HOME_CITY}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="shell relative z-10 py-12 md:py-16" aria-labelledby="earth-how-title">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <h2 id="earth-how-title" className="title">
              The globe
            </h2>
            <p className="lead mt-4 max-w-[54ch]">The sun is where it really is as you read this, so the night side is the real night side, lit by its cities.</p>
          </div>
          <ul className="earth-facts">
            <li>
              <b>The day side</b> is NASA’s Blue Marble for July, with the shape of the sea floor, 8,192 pixels round on a big screen. The land’s height tilts the sunlight, so mountains cast their own shade at dawn and dusk.
            </li>
            <li>
              <b>The night side</b> is NASA’s Black Marble, the lights of 2016. The sea catches the sun where it is open water, and the clouds cast shadows a little off to one side of themselves.
            </li>
            <li>
              <b>The air</b> is worked out for every pixel of sky: how much of it you are looking through, and how much sunlight is on it. That makes it a thin blue rim from orbit and a sky from down low, orange at dusk.
            </li>
            <li>
              <b>The flying</b> follows great circles, the way real routes do, so the way to Europe heads north-east first. The autopilot takes the same course.
            </li>
          </ul>
        </div>
      </section>

      <section className="shell relative z-10 pb-24 md:pb-28">
        <p className="text-xs leading-relaxed text-muted">
          The maps are NASA Earth Observatory’s Blue Marble Next Generation, Black Marble 2016, cloud and GEBCO images (public domain), reduced for the web by <code>scripts/build-earth.mjs</code>.
        </p>
        <ModelCredits where="earth" line className="mt-2 text-xs leading-relaxed text-muted" />
      </section>
    </div>
  );
}
