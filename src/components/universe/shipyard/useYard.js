// The yard's draft in React: staged until applied, dropped on revert. The
// reducer and settle are pure (tested in Node); the hook wires them to the
// page's live ship and wallet. The rules are yardRules.js's.
//
// useYard({ live, kind, unlocked, economy, version, onApply }) → { draft,
//   checked, changes, dirty, setPart, setModule, setHull, roll, paste,
//   revert, apply, looking, setLooking }
// apply() → { ok, why } (onApply({ diff, toBuy }) does the buying and
// fitting; whatever it says, the draft opens again on what's flown).

import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { check, diff, openDraft, rollDraft, setHull, setModule, setPart } from '../yardRules';

export const openYard = (live, kind = null) => ({ draft: openDraft(live), touched: false, kind });

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// { draft, touched, kind }: touched once anything's staged, so the live
// ship changing underneath (a fit from elsewhere) doesn't wipe it; a new
// crew is a new ship, and whatever was staged was for the last one.
export function yardReducer(state, action) {
  const staged = (draft) => (same(draft, state.draft) ? state : { ...state, draft, touched: true });
  switch (action.type) {
    case 'live':
      return state.touched && (action.kind ?? state.kind) === state.kind ? state : openYard(action.live, action.kind ?? state.kind);
    case 'revert':
      return openYard(action.live, state.kind);
    case 'part':
      return staged(setPart(state.draft, action.slot, action.id));
    case 'module':
      return staged(setModule(state.draft, action.slot, action.id));
    case 'hull':
      return staged(setHull(state.draft, action.garage, action.lastBuild ?? null));
    case 'roll':
      return staged(rollDraft(state.draft, action.seed, action.unlocked, action.owned));
    case 'paste':
      return staged({ ...state.draft, build: { ...action.build } });
    default:
      return state;
  }
}

// After Apply: the draft opens on what's flown now, whether it went
// through or not (a refusal means the saves moved under it: start again
// from them), and the refusal's why, or null.
export const settle = (state, live, result) => ({ state: openYard(live), why: result?.ok ? null : (result?.why ?? 'refused') });

export function useYard({ live, kind, unlocked = [], economy = null, version = 0, onApply }) {
  const [state, dispatch] = useReducer(yardReducer, null, () => openYard(live, kind));
  const [looking, setLooking] = useState(null);
  // (the page makes a new object each render: what matters is what's in it)
  const liveKey = JSON.stringify(live);
  const liveNow = useMemo(() => JSON.parse(liveKey), [liveKey]);
  useEffect(() => dispatch({ type: 'live', live: liveNow, kind }), [liveNow, kind]);

  const { draft } = state;
  // (`version` is the wallet's: a purchase or an earning changes the bill)
  const checked = useMemo(() => (version >= 0 ? check(draft, { kind, unlocked, economy }) : null), [draft, kind, unlocked, economy, version]);
  const changes = useMemo(() => diff(draft, liveNow), [draft, liveNow]);

  const apply = useCallback(() => {
    if (!checked.ok || !changes.length) return { ok: false, why: checked.issues[0]?.why ?? 'nothing' };
    const result = onApply?.({ diff: changes, toBuy: checked.toBuy, draft }) ?? { ok: false, why: 'refused' };
    const after = settle(state, liveNow, result);
    dispatch({ type: 'revert', live: result.ok ? (result.live ?? liveNow) : liveNow });
    return { ok: Boolean(result.ok), why: after.why, result };
  }, [checked, changes, onApply, draft, state, liveNow]);

  return {
    draft,
    checked,
    changes,
    dirty: changes.length > 0,
    setPart: (slot, id) => dispatch({ type: 'part', slot, id }),
    setModule: (slot, id) => dispatch({ type: 'module', slot, id }),
    setHull: (garage, lastBuild) => dispatch({ type: 'hull', garage, lastBuild }),
    roll: (seed, owned) => dispatch({ type: 'roll', seed, unlocked, owned }),
    paste: (build) => dispatch({ type: 'paste', build }),
    revert: () => dispatch({ type: 'revert', live: liveNow }),
    apply,
    looking,
    setLooking,
  };
}
