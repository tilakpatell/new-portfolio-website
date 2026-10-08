# Heroes from everywhere, each with their own abilities — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (native, inline: the owner asked for no subagents). Steps use checkbox (- [ ]) syntax.

**Goal:** On the galaxy's worlds you walk in as the ship's own lead (Rick off the cruiser, Walt off the RV, Han off the Falcon, Luke off the X-wing), may change to any hero from the corner panel without leaving the world, and whoever you are may carry the galaxy's guns. Each hero has two abilities of their own on G and V, as the films give them: Boba Fett flies, Han throws the thermal detonator with the DL-44 in hand, Chewie roars, Rick hops through a portal, Morty sprints, Leia heals, Walt throws fulminated mercury.

**Architecture:** the abilities are a pure tested file, `galaxy/surface/abilityRules.js` (the cards of numbers, which pair a party spec carries, the jetpack's tank); `galaxy/heroes.js` names each hero's pair and gains the crews from elsewhere (Rick and Morty as Meshy figures, Walt and Jesse from the city); `surface/scene.js` plays them from one `power(slot)` on the kind plus a `stepJet` for the held one; the HUD, the touch buttons and the panel read the names from the rules.

**Tech Stack:** three 0.186, Vitest, playwright-core on SwiftShader for the browser check.

## Global Constraints

- No new models: the crews' figures the universe's foot party already loads.
- `scene.js`'s diff stays to `power`, `stepBombs`, `stepJet`, `stepWalk`'s rules, the HUD's event and the touch handlers.
- No sequel-trilogy content.

## Review Focus

- A hero with no `abilities` (the party's mate from `footScene.js`) falls back to the Force or the detonator pair (`abilitiesOf`, tested).
- The jetpack never refills in the air and never overfills (`jetStep`, tested).
- A hero from elsewhere keeps their own gun though it isn't pickable (`readHero`, tested).

## Tasks

- [x] `abilityRules.js` with its tests: the cards, `abilitiesOf`, `JET`, `jetStep`.
- [x] `heroes.js`: the pairs, the four from elsewhere, the ships' leads; `heroSpec` carries `abilities`; tests.
- [x] `combatRules.js`: `forceAt` and `pushVelocity` take a push's own numbers (the roar).
- [x] `scene.js`: `power` on the kind, bombs with a spec, the jetpack, the sprint, the hop, the medpack; the HUD names the pair; touch holds G.
- [x] `GalaxySurface.jsx`, `SurfaceView.jsx`, `HeroPanel.jsx`: the names, the sides, the help text.
- [x] Browser check: Rick off the cruiser and his hop, Morty's sprint, Walt's fulminate, Boba flying and refilling, Han and Chewie, Rick with a DL-44.
- [ ] Later: swap the hero without the world remounting; Rick's B gadget cycle on the surface; per-hero voice lines for the abilities.
