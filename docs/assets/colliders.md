# Colliders from names

A prop’s physics is modelled, not coded. Bruno Simon’s folio-2025 does it this way, and so does the site: in Blender, beside the thing you see, you build its physics out of plain shapes and name them. The site reads the names when the model loads (`src/lib/three/colliders.js`, its rules in `src/lib/physics/fromModel.js`), makes the bodies, and never draws those shapes.

## The names

- **A body** is any object whose name has `physical` in it: `crate_physical`, `crate_physical_dynamic`.
- **Its type** is in the same name. `dynamic` falls, rolls and can be knocked about. `kinematic` is moved by code. Anything else is `fixed` (a wall, a post, a table that never moves).
- **Its colliders** are the body’s direct children, named by shape. Blender’s `.001` suffix is fine: `cuboid.001` reads as `cuboid`.

| child name starts with | make it from | its size is |
|---|---|---|
| `cuboid` | a 1 m cube (Blender’s default cube is 2 m: scale it by ½ and apply the scale) | its scale: a cube scaled 2 × 1 × 4 is 2 m by 1 m by 4 m |
| `ball` | a 1 m sphere | its scale, the same all three ways (a ball scaled more one way than another stops the load with the body’s name) |
| `cylinder` | a 1 m cylinder, standing on its axis | its height from scale Y, its width from scale X |
| `capsule` | a 1 m cylinder with round ends, standing | its height from scale Y (ends included), its width from scale X |
| `hull` | any mesh | the convex wrap round its points (for a rock, a bottle) |
| `trimesh` | any mesh | its own triangles, exactly; only on a fixed body (a moving one falls through the ground) |

Each collider sits where you put it: its position and rotation inside the body are kept. Size the shapes by scale, not in Edit Mode: the site reads the scale, so a cube enlarged in Edit Mode with a scale of 1 is still a 1 m cube. A body with no collider children gets one box round its own mesh.

A body inside another body, or inside any group, is its own body, placed through its parents.

## Mass, friction, bounce

Set them as custom properties on the body (Object Properties → Custom Properties), which Blender’s glTF exporter writes as the node’s extras and three.js reads as `userData`:

- `mass` in kilograms. A dynamic body without one weighs 0.1 kg, his default: light enough that anything sets it off.
- `friction` and `restitution` (bounce), when the thing needs its own.

A dynamic body starts asleep and wakes when something touches it, so a room full of props costs nothing until you walk into it.

## Exporting

Export the whole thing, the look and the physical shapes together, as one GLB. Keep the physical objects separate from the look: the site hides every `physical` object and its children, so a body that is also the visible mesh disappears.

`scripts/gen3d/web.mjs` keeps the shapes through the web cut (it strips the meshes of the shapes sized by scale and keeps their empty nodes). To check what a written model will make:

```
node scripts/gen3d/web.mjs --check-colliders public/models/gen3d/crate.glb
crate_physical_dynamic: dynamic, cuboid, 3 kg
```

## One example

```
crate                      ← the mesh you see
crate_physical_dynamic     ← an empty, custom property mass = 3
  └ cuboid                 ← the default cube, scale 0.6 × 0.4 × 0.6, at (0, 0.4, 0)
```

## Adding a prop

On a planet landing, a model named in the landing’s `models` (`src/components/universe/landings/landings.js`) that has physical nodes is its own body: `furnish.js` reads them through `collidersOf` before the spec’s `body` or the kind’s entry in `bodies.js`, and makes them one body (the first’s type, every collider, the masses summed), so the line to add is the model itself. Anywhere else, one call:

```js
import { collidersOf } from '../lib/three/colliders';
for (const { desc } of collidersOf(model).bodies) physics.add(desc);
```

The places in `desc` are relative to the model’s root; a world that stands the model somewhere moves the bodies with it.
