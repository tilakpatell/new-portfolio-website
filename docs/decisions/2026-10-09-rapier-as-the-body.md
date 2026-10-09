# Rapier as the body, the AI as the brain

Date: 2026-10-09. The long version: `docs/superpowers/specs/2026-10-09-rapier-body-ai-brain-design.md`; the plan: `docs/superpowers/plans/2026-10-09-rapier-body-ai-brain.md`; where it was left: `docs/superpowers/HANDOFF-rapier-body.md`.

## Context

The owner asked for a gameplay and AI system with Rapier “embedded natively throughout the runtime”: the AI the brain, Rapier the body. The site had a brain (`src/lib/ai/`: perception, utility, trees, steering, squads), a combat ruleset (`src/lib/combat/`: bolts, blades, duels, accuracy) and a physics engine (`src/lib/physics/world.js`, Rapier for the props and the vehicles), and they did not share a body: a figure walked on hand-written circles and boxes, saw along a 2D line, and was hit as one wide capsule, each its own idea of the world.

## Decision

One Rapier world is the truth about what is solid on a surface: the ground as heightfield tiles sampled from the same `heightAt`, every solid the walker stopped at as a collider, the floors, a floor at knee depth under water. Every figure, the player included, is a kinematic capsule on Rapier’s character controller (`src/lib/physics/character.js`); a brain outputs only an intent (a velocity, a facing, an action), which the body turns into one controller move a substep. Sight is a ray (`src/lib/physics/queries.js`, on a per-frame budget that answers a refused ray with its last answer, never “clear”). A figure is hurt by region: head, chest, each upper arm, forearm, thigh and shin, capsules on its one body set from its bones each frame (`src/lib/physics/hurtbox.js`, `src/lib/three/combat/hitboxRig.js`); one capsule for a figure with no bones. Strikes and bolts are casts and rays, never dynamic bodies; sensor volumes (`zones.js`) are for what persists. A hit reaches the mind (`src/lib/ai/mind.js`: stunned, dead) and the body (a knock the controller carries along walls) separately, through one resolver (`src/lib/combat/damage.js`).

## Consequences

- The galaxy surface walks, sees and fights through Rapier: `surfacePhysics.js`, `playerBody.js`, `hostileBodies.js` beside its scene. Its planner (`hostiles.js`, `duellists.js`) is unchanged; it hands its plan to the body instead of writing the figure. The walker state stays the scene’s interface: the body is read back into it after each step.
- A hit says where. The head counts double, a limb less (`damage.js`’s `WHERE`); hit rates changed from the one wide capsule, padded 8 cm for a graze. A light hit knocks and flinches; a heavy one stuns.
- Rapier (1.7 MB) now loads on every surface, phones included; the walker is the fallback only when the engine fails to load.
- The saber keeps `blade.js`’s between-frames arc sweep against the regions (a linear cast would cut a swing’s arc short); `strike.js`, the Rapier cast, waits for a melee without a swinging blade.
- Three settings were found by measurement, not the plan: the controller’s normal nudge is 0.01 (at Rapier’s 1e-4 a run across a heightfield catches on a triangle edge about once a second); a figure placed inside a solid is pushed out by its contact normal before its first move (the controller never resolves a penetration it starts in); the shore and the world’s edge are judged from the body, not the drawn state, which is a substep behind.

## Revisit when

- A world wants a Rapier articulated ragdoll in place of the Verlet one: a new entry, with the joint budget.
- The hurtbox radii are tuned by play: the numbers in `hurtbox.js`’s `REGIONS` and `blaster.js`’s `HURT_PAD` change, the decision does not.
- A phone’s download of Rapier matters: then a surface without hostiles could skip it, as the crates once did.
- The next worlds (Rick and Morty, Middle-earth) adopt it: each is a lane on the same modules; a change to the modules’ contract is a new entry.
