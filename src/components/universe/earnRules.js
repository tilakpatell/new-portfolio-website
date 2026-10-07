// The small rules of paying into the wallet (economy.js), kept out of the
// hooks, pages and scenes that use them so they're tested in Node.
//
// createPayLedger(seed) → { once(key) → boolean }: true the first time a key
//   is asked of it, false after, for what pays once a visit (a standing
//   level per side, an ally per pilot, a hunter helped per pilot and
//   hunter); `seed` is what's paid for already (places found, quests done).
// createCarry() → { add(n) → whole points to pay now }: the war's points
//   come in fractions (a fighter's a tenth of one), and the wallet pays
//   whole ones, so the rest is carried till it makes one.
// createPayQueue() → { pay(what, n, side) → earnings, attach(economy) →
//   earnings }: the wallet loads in its own chunk, after the page, so what's
//   earned before it's there is kept and paid when it's attached. Each
//   returns the earnings paid just then (economy.earn's), for the HUD's note.
// hunterEarn(factions, { faction, kind, prey }) → 'killAce' | 'killPirate' |
//   'killHunter' | null: what a hunter you shot down pays (economy.js's EARN),
//   the same in the universe and the galaxy. Its faction's ace pays more; a
//   pirate, or a pack sent after someone else, is a pirate; one with no
//   faction pays nothing.

export function createPayLedger(seed = []) {
  const paid = new Set(seed);
  return {
    once(key) {
      if (paid.has(key)) return false;
      paid.add(key);
      return true;
    },
  };
}

const EPSILON = 1e-6; // (ten tenths add up to 0.9999999999999999)

export function createCarry() {
  let owed = 0;
  return {
    add(n) {
      if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return 0;
      owed += n;
      const whole = Math.floor(owed + EPSILON);
      if (whole < 1) return 0;
      owed = Math.max(0, owed - whole);
      return whole;
    },
  };
}

export function createPayQueue() {
  let wallet = null;
  const owed = [];
  const earn = ([what, n, side]) => wallet.earn(what, n, { side });
  return {
    pay(what, n = 1, side = null) {
      if (!wallet) {
        owed.push([what, n, side]);
        return [];
      }
      return [earn([what, n, side])];
    },
    attach(economy) {
      wallet = economy ?? null;
      return wallet ? owed.splice(0).map(earn) : [];
    },
  };
}

export function hunterEarn(factions, hunter) {
  if (!hunter?.faction) return null;
  const faction = factions?.[hunter.faction];
  if (faction?.ace && faction.ace === hunter.kind) return 'killAce';
  return faction?.role === 'pirates' || hunter.prey ? 'killPirate' : 'killHunter';
}
