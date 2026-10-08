// Aboard the Death Star as a world module on the runtime: both battle
// stations walked room by room, at /deathstar/inside. It runs the game
// (rules/game.js) at 30 steps a second from the runtime’s keys, the pad
// and what the page sends (the mouse’s moves and buttons, the touch
// stick and buttons), turning the walk keys by the camera’s yaw into a
// direction in the station; draws it through the scene (scene/index.js,
// loaded only when a world is made, so Node can read this file) on the
// frame’s renderer, through bloom on a high tier; keeps the save
// (rules/save.js) through the runtime’s saves; and tells the page what
// to show through rt.events: 'ui' (mode, the game’s choices, objective,
// prompt, talk, map, settings, saved stories), 'hud' (hp, heat, gun,
// alert, section, room, where you are) and 'achievement'. Inside.jsx’s
// header has the events’ full shapes.
//
//   KEYS                     the world’s controls, by action, as KeyboardEvent codes (the page sends
//                            the mouse’s buttons as press('fire' | 'aim', down))
//   create(rt, props) → world
//     props: { station, side, mode, hero, at, small }, the address’s choices: a side starts the game
//       at once, at a spot’s name or a room’s id when `at` names one; without, the start screen
//     world: the runtime’s (step, draw, resize, wants, lowerQuality, attached, dispose), and the
//       page’s: start({ station, side, hero, mode, fresh }), pause(on), set({ view | sound |
//       subtitles }), quit(), map(open), choose(i), look(dx, dy), stick(x, y), press(name, down);
//       `game` for the checks
//   In development, window.__deathstar: { g, teleport(where, x, z), do(name, arg), info() }:
//     do calls one of the page’s calls by name, or presses an action (use, helmet…) for a step;
//     info() → { calls, triangles, room, mode } of the last frame drawn

import { STEP, drain, newGame, promptOf, step, teleport, ticksFor } from './rules/game';
import { SAVE, SAVE_VERSION, blank, clean } from './rules/save';
import { STATIONS } from './rules/stations';

export const KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  jump: ['Space'],
  crouch: ['KeyC'],
  use: ['KeyE'],
  reload: ['KeyR'],
  view: ['KeyV'],
  helmet: ['KeyH'],
  roar: ['KeyG'],
  map: ['KeyM', 'Tab'],
  pause: ['Escape', 'KeyP'],
  talk1: ['Digit1'],
  talk2: ['Digit2'],
  talk3: ['Digit3'],
  talk4: ['Digit4'],
};
// Over a menu only P is bound: the runtime stops the default of every bound
// key, and the start screen and the pause menu need Tab, Space and the
// arrows to move between and press their buttons.
const MENU_KEYS = { pause: ['KeyP'] };

const SENS = 0.0022; // radians a pixel the mouse turns the head
const PITCH = 1.2; // radians the head tilts at most up or down
const PAD_TURN = 3; // radians a second the pad’s right stick turns at full tilt
const RUN_PUSH = 0.95; // a stick pushed this far runs
const HUD_EVERY = 0.1; // seconds between 'hud' events at most
// The glow round the light strips and grids. Bloom picks what is brighter
// than the threshold before the house look tone-maps it, and under the
// station’s lamps the walls and the glossy floor reach about 2 there: a
// lower threshold glows the whole corridor into a grey veil.
const BLOOM = { strength: 0.6, radius: 0.4, threshold: 2.2 };
// presses the game takes for the one step after them: kept until a step comes, so a
// press in a frame too short for a step still counts
const PRESSES = ['use', 'helmet', 'roar', 'reload', 'jump'];
// what to do in a story, until the story chains say it step by step
const AIMS = {
  ds1: {
    rebel: 'Get out of the freighter’s hold and up to Docking Control 327.',
    imperial: 'Report to the lift lobby past the bay’s blast door, then take the lift down to Level 5.',
  },
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const round = (v, k = 100) => Math.round(v * k) / k;
const freshSeed = () => Math.floor(Math.random() * 2 ** 31);

export default {
  id: 'deathstar-inside',
  shading: 'glsl',
  mb: 6, // (WORLD_MB['/deathstar/inside']: the first room’s kit and the cast)
  label: 'Aboard the Death Star',
  async create(rt, props = {}) {
    // (the scene needs WebGL and three, so it loads only when a world is made)
    const { createScene } = await import('./scene/index.js');
    let renderer = rt.gfx.renderer;
    const tier = rt.quality?.tier ?? 'high';
    const small = Boolean(props.small) || tier === 'low';
    rt.saves?.register({ key: SAVE, version: SAVE_VERSION, migrate: (old) => clean(old) });
    const save = clean(rt.saves?.get(SAVE, null) ?? blank());
    const persist = () => rt.saves?.set(SAVE, save);

    let mode = 'start'; // 'start' | 'play' | 'pause'
    let mapOpen = false;
    let chosen = null; // the last game begun: { station, side, hero, play }, for the start screen
    let bloom = tier === 'high' || tier === 'ultra';
    let view = null; // the scene
    let post = null; // the bloom chain
    const size = { w: 1, h: 1 };
    const look = { yaw: 0, pitch: 0 };
    const touch = { x: 0, y: 0, held: new Set(), pressed: new Set() };
    const latched = new Set();
    let choice = null;
    let acc = 0;
    let lastUi = '';
    let lastHud = '';
    let hudAt = HUD_EVERY;
    let bound = null;
    let aiming = false;
    let drawn = { calls: 0, triangles: 0 };
    let gone = false;
    const was = { autoReset: renderer.info?.autoReset };

    // what the world says before the page is listening waits for the first step
    const waiting = [];
    let stepped = false;
    const tell = (type, data) => {
      if (stepped) rt.events?.emit(type, data);
      else waiting.push([type, data]);
    };

    function makePost() {
      post?.dispose();
      post = null;
      if (!bloom || !rt.gfx.post || !view) return;
      post = rt.gfx.post([
        { kind: 'render', scene: view.scene, camera: view.camera },
        { kind: 'bloom', ...BLOOM },
        { kind: 'output' },
      ]);
      post.composer?.setPixelRatio?.(renderer.getPixelRatio?.() ?? 1);
      post.setSize?.(size.w, size.h);
    }

    // a scene for the station the game is on: made again only when the station changes
    function sceneFor(station) {
      if (view?.station === station) return;
      post?.dispose();
      post = null;
      view?.dispose();
      view = Object.assign(createScene(renderer, { tier, small, station }), { station });
      view.resize(size.w, size.h);
      makePost();
    }

    function bind(keys) {
      if (bound === keys) return;
      bound = keys;
      rt.input.bind(keys);
    }

    // The game behind the start screen stands on the bay’s deck, where an
    // Imperial begins, so the station is there to see before you choose.
    let g = newGame({ station: props.station ?? 'ds1', side: 'imperial', mode: 'roam', seed: freshSeed(), save });

    function begin({ station = 'ds1', side = 'rebel', hero = null, mode: play = 'story', fresh = false } = {}) {
      const id = station in STATIONS ? station : 'ds1';
      const own = side === 'imperial' ? 'imperial' : 'rebel';
      if (fresh && play === 'story') save[id].story[own] = null;
      g = newGame({ station: id, side: own, mode: play, hero, seed: freshSeed(), save });
      sceneFor(g.station);
      look.yaw = g.you.yaw;
      look.pitch = 0;
      acc = 0;
      mapOpen = false;
      latched.clear();
      chosen = { station: g.station, side: g.side, hero: g.you.hero, play: g.mode };
      mode = 'play';
      persist();
      tell('achievement', { id: 'ds-aboard' });
    }

    function keep() {
      save[g.station].seen = [...g.seen];
      persist();
    }

    // ── input ──

    const pressed = (snap, name) => (KEYS[name] ?? []).some((code) => snap?.pressed?.has(code)) || touch.pressed.has(name);

    function intent(snap) {
      const held = (name) => Boolean(snap?.action?.(name)) || touch.held.has(name);
      const pad = snap?.pad ?? null;
      let forward = (held('forward') ? 1 : 0) - (held('back') ? 1 : 0);
      let strafe = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
      let stick = false;
      if (pad && (pad.lx || pad.ly)) {
        [strafe, forward, stick] = [pad.lx, -pad.ly, true];
      }
      if (touch.x || touch.y) {
        [strafe, forward, stick] = [touch.x, touch.y, true];
      }
      const push = Math.hypot(forward, strafe);
      if (push > 1) {
        forward /= push;
        strafe /= push;
      }
      // forward is (sin yaw, −cos yaw) and right (cos yaw, sin yaw): yaw 0 faces −z, turning towards +x
      const [s, c] = [Math.sin(look.yaw), Math.cos(look.yaw)];
      const once = (name) => latched.has(name);
      return {
        dir: { x: forward * s + strafe * c, z: -forward * c + strafe * s },
        yaw: look.yaw,
        pitch: look.pitch,
        run: held('run') || (stick && push >= RUN_PUSH) || Boolean(pad?.lb),
        jump: held('jump') || Boolean(pad?.a) || once('jump'),
        crouch: held('crouch') || Boolean(pad?.b),
        use: once('use'),
        fire: held('fire') || Boolean(pad?.rt),
        aim: held('aim') || Boolean(pad?.lt),
        alt: held('alt'),
        reload: once('reload'),
        helmet: once('helmet'),
        roar: once('roar'),
        map: mapOpen,
        choice,
      };
    }
    const still = () => ({ dir: { x: 0, z: 0 }, yaw: look.yaw, pitch: look.pitch });

    // what the keys ask of the module itself: the pause, the map, the view, a choice
    function menuKeys(snap) {
      const tapped = snap?.tapped ?? {};
      const p = snap?.pressed?.has('KeyP') || touch.pressed.has('pause') || Boolean(tapped.start);
      if (mode === 'pause') {
        // (only P plays on: Esc arriving here is the browser letting go of the pointer)
        if (p) mode = 'play';
        return;
      }
      if (mode !== 'play') return;
      if (pressed(snap, 'pause') || tapped.start) {
        if (mapOpen) mapOpen = false;
        else mode = 'pause';
        return;
      }
      if (pressed(snap, 'map')) mapOpen = !mapOpen;
      if (pressed(snap, 'view') || tapped.y) setView(save.settings.view === 'first' ? 'third' : 'first');
      for (let i = 1; i <= 4; i++) if (pressed(snap, `talk${i}`)) choice = i - 1;
      for (const name of PRESSES) if (pressed(snap, name)) latched.add(name);
      if (tapped.x) latched.add('use');
    }

    function setView(v) {
      if (v !== 'third' && v !== 'first') return;
      save.settings.view = v;
      persist();
    }

    // ── what the page is told ──

    function report(dt, force = false) {
      const play = mode === 'play' || mode === 'pause';
      const ui = {
        mode,
        station: chosen?.station ?? null,
        side: chosen?.side ?? null,
        hero: chosen?.hero ?? null,
        play: chosen?.play ?? null,
        objective: play && g.mode === 'story' ? (AIMS[g.station]?.[g.side] ?? null) : null,
        prompt: mode === 'play' && !mapOpen ? promptOf(g) : null,
        talk: null,
        map: { open: mode === 'play' && mapOpen, seen: play ? [...g.seen] : [...save[g.station].seen] },
        settings: { ...save.settings },
        saved: Object.fromEntries(Object.keys(STATIONS).map((id) => [id, { rebel: Boolean(save[id]?.story.rebel), imperial: Boolean(save[id]?.story.imperial) }])),
      };
      const k = JSON.stringify(ui);
      if (k !== lastUi) {
        lastUi = k;
        tell('ui', ui);
      }
      hudAt += dt;
      if (hudAt < HUD_EVERY && !force) return;
      hudAt = 0;
      const you = g.you;
      const hud = {
        hp: Math.round(you.hp),
        heat: round(you.heat),
        venting: false,
        gun: you.gun,
        alert: 'calm',
        section: g.layout.rooms.get(you.room)?.section ?? null,
        room: you.room,
        at: { x: round(you.x), z: round(you.z), yaw: round(you.yaw) },
        aim: aiming,
      };
      const h = JSON.stringify(hud);
      if (h !== lastHud) {
        lastHud = h;
        tell('hud', hud);
      }
    }

    sceneFor(g.station);
    if (props.side) {
      begin({ station: props.station, side: props.side, hero: props.hero, mode: props.mode ?? 'story' });
      if (props.at && teleport(g, props.at)) look.yaw = g.you.yaw;
    }
    bind(mode === 'play' ? KEYS : MENU_KEYS);

    const world = {
      get game() {
        return g;
      },
      ready: view.ready,
      resize(w, h) {
        size.w = w;
        size.h = h;
        view.resize(w, h);
        post?.composer?.setPixelRatio?.(renderer.getPixelRatio?.() ?? 1);
        post?.setSize?.(w, h);
      },
      step(dt, snap) {
        if (!stepped) {
          stepped = true;
          for (const [type, data] of waiting.splice(0)) rt.events?.emit(type, data);
        }
        bind(mode === 'play' ? KEYS : MENU_KEYS);
        menuKeys(snap);
        touch.pressed.clear();
        aiming = mode === 'play' && (touch.held.has('aim') || Boolean(snap?.pad?.lt));
        if (mode === 'play') {
          const pad = snap?.pad;
          if (pad && !mapOpen && (pad.rx || pad.ry)) {
            look.yaw += pad.rx * PAD_TURN * dt;
            look.pitch = clamp(look.pitch - pad.ry * PAD_TURN * dt, -PITCH, PITCH);
          }
          const { ticks, left } = ticksFor(dt, acc);
          acc = left;
          if (ticks) {
            const input = mapOpen ? still() : intent(snap);
            latched.clear();
            choice = null;
            for (let i = 0; i < ticks; i++) step(g, i === 0 ? input : { ...input, use: false, helmet: false, roar: false, reload: false });
          }
          let grew = false;
          for (const e of drain(g)) if (e.type === 'room') grew = true;
          if (grew && g.seen.size !== save[g.station].seen.length) keep();
        } else acc = 0;
        bind(mode === 'play' ? KEYS : MENU_KEYS);
        report(dt);
      },
      draw(frame) {
        const r = frame?.renderer ?? renderer;
        if (r !== renderer) {
          // (a lost context gave the runtime a new renderer: the bloom chain was made on the old one)
          renderer = r;
          was.autoReset = r.info?.autoReset;
          makePost();
        }
        view.sync(g, mode === 'play' ? acc / STEP : 1, { yaw: look.yaw, pitch: look.pitch, view: save.settings.view, aim: aiming });
        // counted over the whole frame (bloom draws several times), for the budget checks
        if (r.info) {
          r.info.autoReset = false;
          r.info.reset?.();
        }
        if (post) post.render();
        else r.render(view.scene, view.camera);
        if (r.info) drawn = { calls: r.info.render.calls, triangles: r.info.render.triangles };
      },
      wants: () => !gone,
      lowerQuality(level) {
        if (level >= 2 && bloom) {
          bloom = false;
          makePost();
        }
        post?.composer?.setPixelRatio?.(renderer.getPixelRatio?.() ?? 1);
        post?.setSize?.(size.w, size.h);
      },
      // the page listens now: it hears the whole picture again
      attached() {
        lastUi = '';
        lastHud = '';
      },

      // ── from the page ──
      start(choice) {
        begin(choice);
      },
      pause(on) {
        if (on && mode === 'play') mode = 'pause';
        else if (!on && mode === 'pause') mode = 'play';
      },
      set(s = {}) {
        if (s.view !== undefined) setView(s.view);
        if (typeof s.sound === 'boolean') save.settings.sound = s.sound;
        if (typeof s.subtitles === 'boolean') save.settings.subtitles = s.subtitles;
        persist();
      },
      quit() {
        keep();
        mode = 'start';
        mapOpen = false;
      },
      map(open) {
        if (mode === 'play') mapOpen = Boolean(open);
      },
      choose(i) {
        choice = i;
      },
      look(dx, dy) {
        if (mode !== 'play' || mapOpen) return;
        look.yaw += dx * SENS;
        look.pitch = clamp(look.pitch - dy * SENS, -PITCH, PITCH);
      },
      stick(x, y) {
        touch.x = x;
        touch.y = y;
      },
      press(name, down) {
        if (down) {
          touch.held.add(name);
          touch.pressed.add(name);
          if (PRESSES.includes(name)) latched.add(name);
        } else touch.held.delete(name);
      },
      dispose() {
        if (gone) return;
        gone = true;
        keep();
        rt.input.unbind();
        post?.dispose();
        view.dispose();
        if (renderer.info) renderer.info.autoReset = was.autoReset ?? true;
        if (typeof window !== 'undefined' && window.__deathstar?.world === world) delete window.__deathstar;
      },
    };

    if (import.meta.env?.DEV && typeof window !== 'undefined') {
      window.__deathstar = {
        world,
        get g() {
          return g;
        },
        teleport(where, x, z) {
          const ok = teleport(g, where, x, z);
          if (ok) look.yaw = g.you.yaw;
          return ok;
        },
        do(name, arg) {
          const call = ['start', 'pause', 'set', 'quit', 'map', 'choose'].includes(name) ? world[name] : null;
          // anything else as its key would: a press the next step takes
          if (call) call(arg);
          else touch.pressed.add(name);
          return this.info();
        },
        info: () => ({ ...drawn, room: g.you.room, mode }),
      };
    }
    return world;
  },
};
