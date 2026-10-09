# Decisions

The record of choices the site has made, so the next session that asks “why not X?” finds the answer instead of a grep through the specs.

## The shape

- One file per decision: `YYYY-MM-DD-<slug>.md`, dated the day it was made.
- Four sections, in this order: **Context** (the question and what was measured), **Decision** (what was chosen, in a sentence or two), **Consequences** (what follows, good and bad), **Revisit when** (the facts that would reopen it).
- Under 80 lines. Link the spec that holds the long version rather than copying it.
- Never edited after a week. A change of mind is a new entry that links the old one; the old one stays as it was, so the record shows what was known when.
- Written when a session makes or touches a choice, not retroactively.

## Entries

| date | decision |
| --- | --- |
| 2026-10-08 | [three.js over Babylon.js](2026-10-08-three-over-babylon.md): three.js stays the renderer; WebGPU through `three/webgpu` and TSL |
| 2026-10-08 | [Fingers added to the Meshy skeleton](2026-10-08-fingers-on-the-meshy-skeleton.md): finger and twist bones written into each figure by its geometry; no re-rig; one skeleton, every clip kept |
