import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiCloseLine, RiGroupLine } from 'react-icons/ri';
import { NAME_MAX } from './names';
import { relayOnly } from './privacy';
import { UNIVERSE, placeName } from './where';
import { crewById } from '../crews';
import Face from '../Faces';
import './online.css';

// Multiplayer, in the bottom-left corner (of the universe map, or, once
// you're online, of every other page: `floating`): a button that says how
// many pilots are online (or offers to go online), and a card above it with
// either the way in (your callsign, and what going online means) or who's
// online, what they fly, their kills, which page they're on (with a button
// to go there too), and the buttons to ask them to be allies, accept,
// decline or end an alliance, or block them, and whether live pointers
// show on pages. What's happening (who came online or came to your page,
// alliances, who shot down whom) shows in a short feed above the button.
// useOnline.js keeps the state; what the card says about your IP address
// follows how the site was built (privacy.js).

const TONE = { join: 'join', ally: 'ally', kill: 'kill', info: 'info' };
const RELAYED = Boolean(relayOnly()); // every connection through a TURN relay

export default function Online({ online, ship = null, floating = false }) {
  const [open, setOpen] = useState(false);
  const { on, room, feed } = online;
  const count = on ? room.peers.filter((p) => !p.blocked).length + 1 : 0;
  const here = room.peers.filter((p) => !p.blocked && p.where === online.where).length;
  const asks = room.peers.filter((p) => p.ally === 'got' && !p.blocked).length;
  const label = !on ? 'Multiplayer' : room.status === 'connecting' ? 'Connecting…' : room.status === 'failed' ? 'Couldn’t connect' : `${count} ${count === 1 ? 'pilot' : 'pilots'} online${floating && here ? ` · ${here} here` : ''}`;
  const short = !on ? 'Online' : room.status === 'online' ? String(count) : room.status === 'failed' ? '!' : '…'; // (a phone's corner is tight)

  const close = () => setOpen(false);
  const onKeyDown = (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault(); // (the page's Escape leaves the universe otherwise)
    close();
  };

  return (
    <div className={floating ? 'universe-online dark-scope' : 'universe-online'} data-floating={floating || undefined} onKeyDown={onKeyDown}>
      <div className="universe-online-feed" aria-live="polite">
        {feed.map((f) => (
          <p key={f.id} className="universe-online-note" data-tone={TONE[f.tone] ?? 'info'}>
            {f.text}
          </p>
        ))}
      </div>
      {open && (on ? <Roster online={online} ship={ship} floating={floating} onClose={close} /> : <Join online={online} onClose={close} />)}
      <button type="button" className="universe-online-pill" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="universe-online-dot" data-status={on ? room.status : 'off'} aria-hidden="true" />
        <RiGroupLine className="h-4 w-4" aria-hidden="true" />
        <span className="universe-online-full">{label}</span>
        <span className="universe-online-short" aria-hidden="true">
          {short}
        </span>
        {asks > 0 && <span className="universe-online-badge">{asks}</span>}
      </button>
    </div>
  );
}

function Card({ title, onClose, children }) {
  return (
    <section className="universe-online-card" aria-label={title}>
      <div className="universe-online-head">
        <p className="eyebrow">{title}</p>
        <button type="button" className="universe-online-x" onClick={onClose} aria-label="Close">
          <RiCloseLine className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {children}
    </section>
  );
}

function Join({ online, onClose }) {
  const [name, setName] = useState(online.suggest);
  const id = useId();
  const input = useRef(null);
  useEffect(() => input.current?.focus(), []);
  const submit = (e) => {
    e.preventDefault();
    online.goOnline(name);
  };
  return (
    <Card title="Multiplayer" onClose={onClose}>
      <form onSubmit={submit}>
        <h2 className="universe-online-title">Fly with whoever else is here</h2>
        <p className="universe-online-text">
          Go online and everyone else on the site right now shows up: in their own ship out here, callsign over it, and as a live pointer on any page you’re both on. Ask someone to be allies,
          or shoot it out.
        </p>
        <label className="universe-online-label" htmlFor={id}>
          Your callsign
        </label>
        <input ref={input} id={id} className="universe-online-input" value={name} maxLength={NAME_MAX * 2} autoComplete="nickname" spellCheck={false} onChange={(e) => setName(e.target.value)} />
        <div className="universe-online-buttons">
          <button type="submit" className="btn btn-primary btn-sm">
            Go online
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Not now
          </button>
        </div>
        <p className="universe-online-fine">
          {RELAYED
            ? 'Browsers connect through a relay (WebRTC), with public Nostr relays to introduce them, so other pilots never see your IP address. Nothing is stored anywhere.'
            : 'Browsers connect straight to each other (WebRTC), with public Nostr relays to introduce them, so other pilots can see your public IP address, as in most online games (your home network’s own addresses are kept back). Nothing is stored anywhere.'}
        </p>
      </form>
    </Card>
  );
}

function Roster({ online, ship, floating, onClose }) {
  const { room } = online;
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(online.name ?? '');
  const id = useId();
  const others = room.peers;
  const rename = (e) => {
    e.preventDefault();
    setName(online.rename(name));
    setRenaming(false);
  };
  return (
    <Card title="Online" onClose={onClose}>
      {renaming ? (
        <form className="universe-online-rename" onSubmit={rename}>
          <label className="sr-only" htmlFor={id}>
            Your callsign
          </label>
          <input id={id} className="universe-online-input" value={name} maxLength={NAME_MAX * 2} autoFocus spellCheck={false} onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="btn btn-primary btn-sm">
            Save
          </button>
        </form>
      ) : (
        <div className="universe-online-me">
          <span>
            You’re <b>{online.name}</b>
            {room.self?.kills ? ` · ${room.self.kills} ${room.self.kills === 1 ? 'kill' : 'kills'}` : ''}
          </span>
          <button type="button" className="universe-online-link" onClick={() => setRenaming(true)}>
            Rename
          </button>
        </div>
      )}
      {room.status === 'failed' ? (
        <p className="universe-online-text">
          Couldn’t reach the other pilots.{' '}
          <button type="button" className="universe-online-link" onClick={online.retry}>
            Try again
          </button>
        </p>
      ) : room.status === 'connecting' ? (
        <p className="universe-online-text">Looking for other pilots…</p>
      ) : !others.length ? (
        <p className="universe-online-text">No one else is online right now. Anyone who opens the site and goes online shows up here, and on the map.</p>
      ) : (
        <ul className="universe-online-list">
          {others.map((p) => (
            <Pilot key={p.id} p={p} online={online} />
          ))}
        </ul>
      )}
      {!floating && !ship && room.status === 'online' && <p className="universe-online-fine">Pick a ship in the panel to fly with them; till then you’re watching.</p>}
      <label className="universe-online-check">
        <input type="checkbox" checked={online.pointers} onChange={(e) => online.showPointers(e.target.checked)} />
        Live pointers on pages, yours and theirs
      </label>
      <p className="universe-online-fine">{RELAYED ? 'Connected through a relay: no one sees your IP address.' : 'Connected straight to each pilot: they can see your public IP address.'}</p>
      <button type="button" className="universe-online-link universe-online-leave" onClick={online.goOffline}>
        Go offline
      </button>
    </Card>
  );
}

function Pilot({ p, online }) {
  const navigate = useNavigate();
  const crew = crewById(p.kind);
  const who = crew ? Object.keys(crew.speakers)[0] : null;
  const act = (what) => () => online.ally(p.id, what);
  const elsewhere = p.where && p.where !== online.where;
  const at = !p.where ? '' : elsewhere ? ` · on ${placeName(p.where)}` : ' · here';
  return (
    <li className="universe-online-pilot" data-ally={p.ally === 'ally' || undefined} data-blocked={p.blocked || undefined}>
      {who ? <Face who={who} className="universe-online-face" /> : <span className="universe-online-face" aria-hidden="true" />}
      <span className="universe-online-who">
        <b>{p.blocked ? 'Blocked pilot' : p.name}</b>
        <span>
          {p.blocked ? 'hidden' : crew ? crew.ship.replace(/^(The|An) /, '') : 'no ship yet'}
          {!p.blocked && at}
          {!p.blocked && p.kills ? ` · ${p.kills} ${p.kills === 1 ? 'kill' : 'kills'}` : ''}
          {p.ally === 'ally' && !p.blocked ? ' · ally' : ''}
        </span>
      </span>
      <span className="universe-online-acts">
        {p.blocked ? (
          <button type="button" className="universe-online-link" onClick={() => online.block(p.id, false)}>
            Unblock
          </button>
        ) : (
          <>
            {elsewhere && (
              <button type="button" className="universe-online-act" onClick={() => navigate(p.where === UNIVERSE ? '/universe' : p.where)} aria-label={`Go to ${placeName(p.where)}, where ${p.name} is`}>
                Go
              </button>
            )}
            {p.ally === 'none' && (
              <button type="button" className="universe-online-act" onClick={act('ask')}>
                Ally
              </button>
            )}
            {p.ally === 'sent' && (
              <button type="button" className="universe-online-act" onClick={act('end')} title="Asked: click to take it back">
                Asked…
              </button>
            )}
            {p.ally === 'got' && (
              <>
                <button type="button" className="universe-online-act" data-yes="" onClick={act('accept')}>
                  Accept
                </button>
                <button type="button" className="universe-online-act" onClick={act('decline')}>
                  No
                </button>
              </>
            )}
            {p.ally === 'ally' && (
              <button type="button" className="universe-online-act" onClick={act('end')}>
                End
              </button>
            )}
            <button type="button" className="universe-online-link" onClick={() => online.block(p.id, true)} aria-label={`Block ${p.name}`}>
              Block
            </button>
          </>
        )}
      </span>
    </li>
  );
}
