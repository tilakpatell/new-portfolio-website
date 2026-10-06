# World voices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The worlds' conversations (Middle-earth's towns, the Office, the Citadel, then Avengers, Cybertron and Metherria) play in their speakers' cloned voices, like the crews' comms already do.

**Architecture:** One shared piece on the site: `src/lib/voiced.js` learns which speaker is which voice (`voiceOf`), what of a line is said aloud (`spoken`: the parts in “quotes”, when a line mixes them with narration), and how to play a line (`sayVoiced` / `stopVoiced`), with a `useVoiced(who, text)` hook. Each world's conversation panel calls the hook. `scripts/voices/export-lines.mjs` collects the same lines (id `lineId(voice, text)`, spoken `spoken(text)`), grab.py builds the new voices' references, generate.py makes them, unchanged.

**Tech Stack:** as docs/superpowers/plans/2026-10-06-voice-references-and-takes.md; vitest for the site side.

**Spec:** the user's ask: "Not done: the other worlds … Do this Now".

## Global Constraints

- A line's id is `lineId(voice, text)` with `text` exactly as the world shows it (narration included); the TTS text is `spoken(text)`.
- Narrators and voiceless speakers (`narrator`, `voice`, `caller`, beeps) are never voiced.
- Generated audio stays local (public/audio/voiced, git-ignored, out of builds).
- Edits to world components are one hook call each: other sessions are editing those worlds.

## Review Focus

- A line that changes while the last is still playing: the old one stops.
- Leaving a conversation (panel unmounts): its line stops.
- A speaker with no voice yet, or no manifest: silence, no error.
- Narration with no quotes said by a character node: voiced whole; narrator nodes never.

---

### Task 1: voiced.js: voices, spoken text, playback (vitest first)
- `voiceOf(who) -> string|null`, `spoken(text) -> string`, `sayVoiced(who, text) -> Promise<handle|null>`, `stopVoiced()`; `src/lib/useVoiced.js` hook.
- Tests in `src/lib/voiced.test.js`: quotes extracted and joined; no quotes -> whole text; aliases (strider->aragorn, councila->rick); narrator -> null.

### Task 2: wire the panels
- `middleearth/towns/TownHud.jsx` `Convo`: `useVoiced(node.who, node.say)`.
- Office and Citadel conversation panels: the same.

### Task 3: export the worlds' lines
- export-lines.mjs walks the towns', Office's and Citadel's conversations for `{ who, say }` nodes; VOICED grows.

### Task 4: references and lines
- sources.json: a show each (`lotr`, `office`), searches and quotes per voice; grab; generate; check in the browser.

### Task 5: Avengers, Cybertron, Metherria
- Their own line formats (`lines: [...]` per place/person, customer reactions) into the export, and a hook call where each is shown.
