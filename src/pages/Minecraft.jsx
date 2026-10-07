import { Suspense, lazy } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import WorldSwitcher from '../components/worlds/WorldSwitcher';
import { use3D } from '../lib/gpu';
import { useDocumentTitle } from '../lib/hooks';

const Minecraft = lazy(() => import('../components/minecraft/Minecraft'));

// Minecraft at the giant crafting table on Dot Matrix island: a fan tribute,
// an endless blocky world made from a seed, built in the browser
// (../components/minecraft/). Reached from the island, the command palette,
// or this address.
export default function MinecraftPage() {
  useDocumentTitle('Minecraft, a fan tribute');
  const navigate = useNavigate();
  const three = use3D();
  const back = () => navigate('/dot-matrix');
  return (
    <div className="relative">
      <div className="pt-[var(--nav-h)]">
        {three.on ? (
          <Suspense fallback={<div style={{ height: 'calc(100svh - var(--nav-h, 64px))', background: '#78a7ff' }} aria-hidden="true" />}>
            <Minecraft mode="page" onExit={back} />
          </Suspense>
        ) : (
          <section className="shell py-16">
            <h1 className="title">Minecraft</h1>
            <p className="lead mt-4 max-w-[60ch]">An endless world of blocks to walk, made in 3D, which is {three.can ? 'switched off' : 'not available'} here.</p>
            {three.can && (
              <button type="button" className="btn btn-primary mt-6" onClick={() => three.set('auto')}>
                Turn 3D on
              </button>
            )}
          </section>
        )}
      </div>
      <section className="shell relative z-10 py-10 md:py-14" aria-label="About the game">
        <p className="eyebrow">Dot Matrix · Gaming</p>
        <p className="lead mt-3 max-w-[62ch]">
          The giant crafting table on Dot Matrix island opens a Minecraft world: endless, made from a seed, with its hills, forests, deserts, snow and seas. Walk it, sprint, jump and swim by the game’s own numbers. Digging, building, the night, caves and mobs arrive a piece at a time.
        </p>
        <p className="mt-4 max-w-[62ch] text-sm text-muted">
          A fan-made tribute, built for this site from scratch in Three.js. The textures are the game’s own, used with Mojang’s permission. Minecraft is Mojang’s and Microsoft’s. Not an official Minecraft product; not approved by or associated with Mojang or Microsoft.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/dot-matrix" className="btn btn-primary">
            Back to Dot Matrix island
          </Link>
          <Link to="/" className="btn btn-ghost">
            Back to the site
          </Link>
        </div>
        <WorldSwitcher className="mt-8" />
      </section>
    </div>
  );
}
