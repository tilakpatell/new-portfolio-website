import MyWorlds from '../components/worlds/MyWorlds';
import InstalledPacks from '../components/worlds/InstalledPacks';
import PageTitle from '../components/PageTitle';
import { useDocumentTitle } from '../lib/hooks';

// /worlds: the visitor's worlds, kept on this device. Two lists: the worlds
// they've played (My worlds), then the packs they've installed. Plain: no
// 3D and no runtime, only the store the worlds keep their rows in.
export default function Worlds() {
  useDocumentTitle('Worlds');
  return (
    <div className="relative">
      <header className="shell relative z-10 pb-8 pt-[calc(var(--nav-h)+40px)] md:pt-[calc(var(--nav-h)+72px)]">
        <p className="eyebrow">Saved on this device</p>
        <PageTitle className="display mt-6 text-[clamp(2.8rem,1.6rem+5vw,5.6rem)]">Worlds</PageTitle>
        <p className="lead mt-4 max-w-[60ch]">Every world you’ve made, kept in your browser: pick one up where you left it, give it a name, or take it with you as a file.</p>
      </header>
      <div className="shell relative z-10 pb-28">
        <MyWorlds />
        <InstalledPacks />
      </div>
    </div>
  );
}
