import { NodeIO } from "@gltf-transform/core";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DIRS } from "../../src/components/galaxy/surface/combatRules.js";
import {
  GENERIC,
  classify,
  clipOf,
  measure,
  rigOf,
  tableFor,
} from "./bf2017-strokes.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
// Luke's first strike, the socket's chain only (Reference → … → Spine2 → Wep_Root)
const FIXTURE = join(
  HERE,
  "..",
  "fixtures",
  "bf2017",
  "web",
  "anims",
  "walrus_humanmale",
  "a_luke_attackloop_strike1.glb",
);

describe("a 2017 clip’s name", () => {
  it.each([
    [
      "A_Luke_AttackLoop_Strike3_V2_BackToIdle",
      { hero: "luke", kind: "return", index: 3, variant: 2 },
    ],
    [
      "A_Luke_AttackLoop_Strike4_V2_BackToIdle 1",
      { hero: "luke", kind: "return", index: 4, variant: 2 },
    ],
    [
      "A_Dooku_AttackLoop_Strike2_BackToIdle_02",
      { hero: "dooku", kind: "return", index: 2, variant: 1 },
    ],
    [
      "A_Luke_AttackLoop_Strike6",
      { hero: "luke", kind: "strike", index: 6, variant: 1 },
    ],
    [
      "A_Vader_AttackLoop_Strike1_V2",
      { hero: "vader", kind: "strike", index: 1, variant: 2 },
    ],
    [
      "A_Vader_Stand_Block_SwingLeft_03",
      { hero: "vader", kind: "block", dir: "left", variant: 3 },
    ],
    ["A_Luke_Block_Stagger_01", { hero: "luke", kind: "block", variant: 1 }],
    [
      "A_Vader_LightAttack_Blocked_05",
      { hero: "vader", kind: "blocked", index: 5 },
    ],
    [
      "A_Luke_Stagger_Front_02",
      { hero: "luke", kind: "stagger", dir: "front", variant: 2 },
    ],
    ["A_Vader_Stagger_Fwd_01", { hero: "vader", kind: "stagger", dir: "back" }],
    ["A_ObiWan_Dodge_Left_01", { hero: "obiwan", kind: "dodge", dir: "left" }],
    ["A_Luke_Stand_SaberDash_01", { hero: "luke", kind: "dash" }],
    ["A_Luke_Jump_SaberAttack_Light_FH_01", { hero: "luke", kind: "jump" }],
    ["A_Vader_Stand_Block_Choke_01", { hero: "vader", kind: "force" }],
    ["A_Luke_Defeated_01", { hero: "luke", kind: "defeat" }],
    ["C_Luke_Stand_Walk_Fwd_01", { hero: "luke", kind: "locomotion" }],
  ])("%s", (name, want) => {
    expect(classify(name)).toMatchObject(want);
  });
});

const doc = await new NodeIO().readBinary(
  new Uint8Array(readFileSync(FIXTURE)),
);

describe("a strike, measured on the game’s rig", () => {
  const m = measure(clipOf(doc.getRoot().listAnimations()[0]), rigOf(doc));

  // (checked by hand once: the tip a metre up the socket's +y is half a
  // metre or more before the hips, along their facing, from 0.2 s to 0.3 s,
  // at 33, 48, 44 and 33 m/s, sweeping from the right across the front;
  // the snap out of the guard at 0.033 s is as fast, beside the head, and
  // must not count: ual-bake's 0.15 m along +z counts it, [0.05, 0.093])
  it("lands where the blade crosses the front, not on the snap out of the guard", () => {
    expect(m.contact).toEqual([0.107, 0.36]);
  });

  it("reads the way it cuts and the plane it sweeps from the tip’s path", () => {
    expect(Object.keys(DIRS)).toContain(m.dir);
    expect(m.dir).toBe("right");
    expect(Math.abs(m.plane[1])).toBeGreaterThan(0.9); // (a level cut)
  });

  it("carries the trajectory’s travel as root rows, the way ual-bake writes them", () => {
    expect(m.root[0]).toEqual([0, 0, 0]);
    expect(m.root.at(-1)[2]).toBeCloseTo(2, 1);
    expect(m.duration).toBeGreaterThan(1.5);
  });
});

describe("a hero’s table", () => {
  const at = (name, more = {}) => ({
    name,
    duration: 1,
    contact: [0.2, 0.3],
    dir: "up",
    ...more,
  });
  const clips = [
    at("A_Luke_AttackLoop_Strike2"),
    at("A_Luke_AttackLoop_Strike1"),
    at("A_Luke_AttackLoop_Strike1_BackToIdle", { duration: 0.7 }),
    at("A_Luke_AttackLoop_Strike2_BackToIdle", { duration: 0.6 }),
    at("A_Luke_AttackLoop_Strike1_V2"),
    at("A_Luke_Block_Stagger_01"),
    at("A_Luke_Stagger_Front_01"),
    at("A_Luke_Dodge_Back_01"),
    at("A_Luke_Stand_SaberDash_01"),
    at("A_Luke_Jump_SaberAttack_Light_FH_01"),
    at("A_Vader_AttackLoop_Strike3"),
  ];
  const t = tableFor("luke", clips);

  it("keeps the game’s chain, each strike with its return", () => {
    expect(t.strikes.map((s) => [s.name, s.return])).toEqual([
      ["A_Luke_AttackLoop_Strike1", "A_Luke_AttackLoop_Strike1_BackToIdle"],
      ["A_Luke_AttackLoop_Strike1_V2", null],
      ["A_Luke_AttackLoop_Strike2", "A_Luke_AttackLoop_Strike2_BackToIdle"],
    ]);
    expect(t.strikes[0].returnDuration).toBe(0.7);
  });

  it("never lists a return as a strike, nor another hero’s", () => {
    expect(t.strikes.some((s) => /BackToIdle|Vader/.test(s.name))).toBe(false);
  });

  it("blocks either side with the block it has, when it has no side of its own", () => {
    expect(t.blocks).toEqual({
      left: ["A_Luke_Block_Stagger_01"],
      right: ["A_Luke_Block_Stagger_01"],
      any: "A_Luke_Block_Stagger_01",
    });
    expect(t.blocked).toHaveLength(6);
  });

  it("fills what the set lacks from the game’s generic humanoid, never another library", () => {
    expect(t.dodges.back).toBe("A_Luke_Dodge_Back_01");
    expect(t.dodges.left).toBe(GENERIC.dodges.left);
    expect(t.staggers.back).toEqual(GENERIC.staggers.back);
    expect(t.defeat).toBe(GENERIC.defeat);
    const names = JSON.stringify(t).match(/"[A-Za-z]+_[A-Za-z0-9_ ]+"/g) ?? [];
    expect(names.length).toBeGreaterThan(10);
    expect(JSON.stringify(t)).not.toMatch(/sword\.|"Sword_/);
  });

  it("names the dash and the jump attack", () => {
    expect(t.dash.name).toBe("A_Luke_Stand_SaberDash_01");
    expect(t.jump.contact).toEqual([0.2, 0.3]);
  });
});
