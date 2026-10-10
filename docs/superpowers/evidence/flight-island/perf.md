# The flight before and after lane J

`node scripts/perf-probe.mjs fly` (Hoth, software GL in the lane’s container: the times are the container’s, the scene’s counts are what to compare), then the smoke. Before: `main` at a6a23b33, before the first edit. After: the lane’s head, after the last.

## Before

```
== fly  on webgl  ready 35.3s  total 87s  heap 125 MB
phase      secs  fps    p50   p95   p99   max  >50 >100 links   mid texMB bufMB draws ktris sizes
load       35.3  48.2   16.7  23.2    46  3165   16    8    28     0 118.2   6.8     8    16     5
settle     26.6   4.4  209.5 313.5 643.2   911  112  111     2     0   0.6   4.9   271   588     0
idle          4   3.5  272.6 332.2 332.2   332   13   13     0     0     0   0.7   293   636     0
fly          14   3.4  293.8 340.7 581.1   581   45   45     0     0     0   4.2   295   635     0
bank        7.2   3.3  288.9 465.5 660.7   661   23   23     0     0     0   1.8   294   636     0
```

## After

```
== fly  on webgl  ready 32.3s  total 85s  heap 123 MB
phase      secs  fps    p50   p95   p99   max  >50 >100 links   mid texMB bufMB draws ktris sizes
load       32.3  53.8   16.7  17.7    35  1163   12    8    28     0 118.2   7.2     8    16     5
settle       27   4.3  222.5 319.9 678.7   694  113  112     2     0   0.6   4.8   271   587     0
idle          4   3.4  288.6   332   332   332   13   13     0     0     0   0.7   293   636     0
fly          14   3.4  287.7 329.8 362.3   362   47   47     0     0     0   4.2   295   635     0
bank        7.2   3.2    308 355.3 447.9   448   22   22     0     0     0   1.7   293   635     0
```

Shader links, uploads, draws and thousands of triangles a phase are the same (one draw and one kilo-triangle apart in the bank, where the ship’s path differs by a frame); the frame times move by the container’s noise both ways.

## The smoke

`node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /fly/hoth,/fly/coruscant,/galaxy/hoth/surface`: everything green before (`/fly/hoth` 12 s, `/fly/coruscant` 30 s, `/galaxy/hoth/surface` 59 s) and after (12 s, 26 s, 54 s).

## The chunks

983 files in `dist/assets` before, 985 after: the two new are a 67-byte `room` chunk (`universe/shared/room.js`, the face the flight loads the relays through, lazily as before) and an 88-byte facade of `nostr` that rollup makes for it. Nothing else moved, by name.
