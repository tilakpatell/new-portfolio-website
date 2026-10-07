# Game AI for NPCs: what the studios do, and what this site should take

Date: 2026-10-07. A research pass before the NPC intelligence design
(`docs/superpowers/specs/2026-10-07-npc-intelligence-design.md`). The question: how do the
games whose enemies and companions feel smart build them, and which of those ideas fit a
static Three.js site whose rules are pure modules tested in Node? Read from the papers and
chapters where they are free (Game AI Pro's chapters, Orkin's F.E.A.R. paper, the Game
Developer write-ups), from library source (Yuka, behavior3js, Mistreevous, recast-navigation-js)
and from talks' secondary write-ups where the slides are not. Numbers quoted are the
papers' own; what this site should take from each is the last line of each section.

## The verdict first

The site's NPCs are already built the right way round: pure rules, a thin drawing, a seeded
random, tests. What they lack is not architecture but three things every studio system has
and none of ours does:

1. **Perception with memory.** Every NPC here reads the player's true position every frame.
   None keeps a *belief* (where it last saw you, how sure it is, how long ago). So nothing
   can be fooled, nothing searches, and nothing feels fair when it finds you.
2. **Utility, not timers.** Every brain is a small state machine with hand-picked timers
   (`NPC.duel`, `NPC.patience`, `FIGHT.runFor`). State machines decide *what*; they cannot
   weigh *how much*. The studios score options with considerations and response curves and
   pick the best, with momentum so the pick holds.
3. **Coordination.** A pack here shares a slot count (`slotsFor`) and nothing else. The
   studios give a group a frontline, roles, attack tokens, a confidence that spreads, and a
   search it runs together.

Everything below is one of those three, or spatial reasoning in service of them.

## 1. Deciding: utility, behaviour trees, planners

### Utility theory (Mark, Lewis, Dill, Graham)

Dave Mark's Infinite Axis Utility System (Guild Wars 2: Heart of Thorns, and Project
Borealis's open implementation): a *decision* has a list of *considerations*; each takes one
input normalised to 0..1 between two bookends (distance 0..100 m, health 0..1), passes it
through a *response curve* (linear, polynomial `y = x^k`, logistic, logit; the Heart of Thorns
palette is a handful of presets) and the scores *multiply*. Any consideration at zero kills the
decision, so cheap ones go first and expensive ones (a raycast) last. Two considerations on
nearly every decision stop twitching: *runtime* (`y = 1 − x^6` over the time it has run: it
stops being picked after a while) and *cooldown* (`y = x^5` since it last ran: it can't be
picked again at once). A *momentum* or inertia bonus on the running decision (Project
Borealis: a constant factor) stops flip-flopping between near-equal scores. Lewis's rules for
choosing considerations: mandatory switches first (not while another action runs, not while
rooted), then the ones that distinguish the behaviour, then balance and feel; prefer preset
curves; order by cost.

Dragon Age: Inquisition's Behaviour Decision System (Sebastian Hunt) scores "behaviour
snippets" with additive trees in designer bands: basic 10, offensive 20–40, support 25–45,
reaction 50–70, so a class always beats the class below and has 20 points of range within it.
Each snippet picks its own best target while scoring (a *target selector* node runs the
sub-tree per candidate and keeps the top).

Kevin Dill's dual utility (Zoo Tycoon 2): each option has a *rank* (absolute: only the top
rank's options are eligible) and a *weight* (relative: pick among them weighted-random,
after dropping any under some fraction of the best). Rank is for "must", weight is for
variety without stupidity. Dying had rank 1,000,000.

Baylor Wetzel's player study (Game AI Pro 3, ch. 4): players could not tell a Monte Carlo
opponent from a random one; perceived difficulty tracked *realism*, not win rate; the traits
they did notice were *persistence* (sticking to a target: switching every turn read as
"computery") and *revenge* (going after whoever hit you). Hustling AIs that shaved their
own dice when far ahead were rated as hard as the honest ones. The lesson: spend on
legibility and persistence, not on search depth.

*Take:* a scorer (`consider` + curves + multiply + momentum + runtime/cooldown) and a
dual-utility picker, in `src/lib/ai/utility.js`. Every brain's timers become considerations.

### Behaviour trees (Isla, Champandard, the JS libraries)

Halo 2's tree (Isla, GDC 2005): a prioritised list at each node, four levels deep, leaves are
concrete behaviours, *stimulus behaviours* override from events (a grenade, a dead leader),
and behaviours are self-describing so designers can add one without touching the others.
Halo 3 added a declarative *objectives* system: designers state tasks with filters and
priorities, squads fill them "like a Plinko machine", and each squad keeps a *clump*, a local
knowledge base of what's near. Alien: Isolation's xenomorph has 100+ nodes with 30 at the top,
and branches locked at the start that unlock as the player keeps doing a thing, so it seems
to learn. The JS libraries (behavior3js, BehaviorTree.js, Mistreevous) are all the same
shape: Sequence, Selector, Parallel, decorators (Inverter, Repeat, Cooldown, Guard), leaves
returning `RUNNING | SUCCESS | FAILURE`, one tree instance shared across agents with a
per-agent blackboard. Game AI Pro's "Behaviour Tree Starter Kit" (Champandard and Dunstan)
is the reference implementation; its "Overcoming Pitfalls" chapter warns against trees that
re-evaluate everything every tick (use event-driven reset) and against burying utility
numbers in tree conditions.

*Take:* a tiny tree (`sequence`, `select`, `guard`, `cooldown`, leaves as plain functions
over `(me, world, dt)`) for the brains whose shape is a script (an inspector's pull-over, a
trickster's toll), with utility nodes where a choice is a weighing. Not a library: 80 lines.

### Planners: GOAP and HTN (Orkin; Humphreys)

F.E.A.R. (Orkin, GDC 2006): three FSM states (Goto, Animate, UseSmartObject); everything
else is a plan. Goals (KillEnemy, Cover, Ambush, Dodge) have priorities; actions
(AttackFromCover, BlindFireFromCover, DodgeCovered, GotoNode) have symbolic preconditions and
effects on a world-state array; A* over actions finds the cheapest sequence to satisfy the
top goal. Sensors write *working memory* facts with a confidence (cover nodes nearby, the
enemy's position with its age); the AI never reads the player directly. Squad behaviours are
simple slot-fillers run by a coordinator that re-clusters by proximity: Get-to-Cover (one
suppresses while the rest move), Advance-Cover, Orderly-Advance, Search (pairs covering each
other). The "complex" behaviours players reported (flanking) were never written; they emerged
from individuals re-planning when their cover was invalidated. Dialogue tells the player what
the AI is thinking ("I'm flanking!"), which is what sells it.

*Take:* not a planner. The site's NPCs have two to five actions each; utility over them is
the same decision at a tenth of the code. What to take is *working memory with confidence*
and *dialogue that says what the brain decided* (the crews' lines already do the second).

## 2. Perceiving: sight, sound, memory, search

### Crytek's Target Tracks (Welsh, Game AI Pro ch. 31)

A *stim* is `{ type, source, position, radius }`. A perception manager filters stims by
subscription, range and hostility, and generates visual stims itself (view distance and
field of view first, raycast last, deferred). Each agent keeps one *target track* per source
with one *ADSR envelope* per stim type: attack (rise to peak over a time, after an ignore
delay), decay, sustain (a fraction of peak while the stim keeps coming), release (fall to
zero once it stops). Peaks: footsteps 25, weapon fire 50, primary field of view 100; a
secondary (peripheral) field of view has a lower peak and a longer attack. The track's value
is its highest envelope; the best target is the highest track. Perception is therefore a
*number that rises and falls*, not a flag, and target selection falls out of it.

### Splinter Cell: Blacklist (Walsh, Game AI Pro 2 ch. 28)

Four qualities a perception model must have: fairness, consistency, feedback, intelligence.
Vision: raycasts to eight bones; a stance decides how many must be visible before the
*detection timer* starts; the timer's range comes from which shape the player is in (a near
cone where detection is quick, a "coffin" box that widens then narrows with distance, a
peripheral) and scales with distance and light. Full timer: detected, with an intermediate
"saw something, going to look" state at a fraction. Hearing: every event has a radius and a
priority; audio distance is path distance, not straight-line. Environmental awareness: a
changed object (an open door, a light off) makes an event with a lifetime; the first NPC to
see it claims it and investigates, with a bark ("Did I leave that open?"), and barks go in
three tiers so the specific line is heard first and never worn out. Connectivity (TEAS):
areas and the chokes between them, so an NPC with no line of sight covers the door instead of
staring at a wall, and knows a dead end from a through room.

### The Last of Us (Naughty Dog, GDC 2014 write-up)

Keyhole view cones (narrow far, wide near); detection takes 1–2 s of visibility; the player
emits a quiet breathing sound so close enemies find him. A sighting makes a *data packet*
(position, time) that is shared with nearby NPCs. Search uses an *exposure map*: a grid of
navigable cells marked seen or unseen, so the search goes where nobody has looked. Infected
"canvass": pick head and body turns that cover the most unseen cells. A *combat coordinator*
assigns roles (Flankers, Approachers, OpportunisticShooters, StayUpAndAimer); flankers path
around the player's *combat vector* (the direction they're engaging). Cover points: the 20
nearest, four raycasts each against the player's firing angles.

### Memory markers (Shabbir, gamedev.net) and losing the target (Welsh, Game AI Pro 2 ch. 27)

A *memory marker* is where the NPC thinks you are: it moves to your real position only while
you are in view, and everything (aim, search, "last known") reads the marker. Welsh's two
tricks for the moment you're lost: keep knowing the true position for 2–3 s (intuition; Halo,
Crysis and Crackdown all do it), then search in two phases. Phase 1, narrow: go to the last
known position (cautious: walk, one NPC; aggressive: run until line of sight then walk, two or
three). Phase 2, broad: a *search coordinator* makes search spots (cover hidden from the last
known position, then random hidden navmesh points), hands each NPC the best (near the
estimate, near the NPC, and *a little* near the player's true position, for intuition), and
any spot an NPC can see on the way is marked searched for everyone. End the search by
spots or time, and let NPCs drift back to their rounds one at a time, never all at once.
Cautious searches end after phase 1; aggressive run both.

### Dishonored 2's chase flood (Couvidou, Game AI Pro Online 2021 ch. 6)

Dead reckoning hits walls; breadcrumbs cheat. Instead, flood the navigation grid from the last
known position: seed the cell hot (H = 20) and a *barrier* in the half-plane behind the
last known direction; each step heats untouched neighbours to H and cools the rest by one,
the barrier propagating with it; stop when no cells heat, when more than MH = 25 heat in one
step (a wide room: give up and search slowly) or after MS steps (20/30/40 by difficulty).
The chase destination is the value-weighted centroid of warm cells. Corridors keep the chase
going; open rooms end it. A loud new stimulus re-runs it.

### Alien: Isolation (Thompson, Game Developer)

Two tiers: a *director* that knows where the player is and a creature that must find out for
itself. The director keeps a *menace gauge* (up when the alien is close, in view or near on the
tracker) and when it peaks sends the alien away; it gives the alien a *search zone* near the
player, never the position. Sensors: footsteps (walk vs run), gunfire, the motion tracker's
own noise within 1.5 m, short rear ray traces. The site already has the director half
(`director.js` with `heat`, `calm`, `wanted`); it lacks the "never tell the creature" half.

*Take:* `src/lib/ai/perception.js`: stims with envelopes, a *belief* per target (`{ at, vel,
seenAt, confidence }`), the 2.5 s intuition, cone-and-range sight with a line-of-sight
callback, hearing by radius, and `search.js`: spot generation, claiming, sweeping-by-sight,
and a flood on a cell grid for chases. The watchers (Bree's Nazgûl, Shelob, the Easterlings)
get the detection timer and the two-phase search; the surface hostiles get beliefs; the
hunters' lead gets a *marker* so a planet between you and them really hides you.

## 3. Moving: steering, position selection, influence maps

### Context steering (Fray, Game AI Pro 2 ch. 18)

Reynolds' steering sums force vectors, so "chase A" and "avoid the rock in front of A" cancel
to nothing. Context steering has each behaviour write into two rings of slots round the
agent, an *interest* map and a *danger* map (16 slots is plenty), with falloff over
neighbouring slots; maps combine by max; then mask every slot whose danger is above the
minimum, pick the highest remaining interest, and interpolate between neighbouring slots for
a continuous heading. Speed is proportional to that interest. Blend this frame's map with
the last for free hysteresis. F1 2011 replaced 4,000 lines of steering with it and avoided
more collisions. Behaviours stay small and stateless.

### Yuka (Mugen87)

The Three.js-adjacent reference: `Vehicle` with `SteeringManager` summing weighted
behaviours (seek, flee, arrive, pursuit, evade, wander, obstacle avoidance by a velocity-scaled
detection box with lateral and braking forces, separation/alignment/cohesion, path following,
interpose, offset pursuit); `Vision` (range, field of view, obstacles, a `visible(point)`
test); `MemorySystem` of `MemoryRecord`s (`timeBecameVisible`, `timeLastSensed`,
`lastSensedPosition`, `visible`) with a `memorySpan` to filter valid records; `Think` as a
composite goal whose `GoalEvaluator`s each return a desirability × `characterBias` and the
best one `setGoal`s; `StateMachine`; `NavMesh` with A*/Dijkstra and a `CellSpacePartitioning`
for neighbour queries. It is a sound shape but 700 KB of classes against this site's plain
functions over `{ x, y, z }`; the ideas port in a few hundred lines.

### Position selection (Jack; Straatman; Johnson)

Killzone's tactical position picking (Straatman and Beij, 2005): generate candidate points,
score each by a weighted sum of tests (cover from each threat's line of fire, distance to
the threat band, distance from here, near allies, not in allies' lines of fire), take the
best. Matthew Jack's TPS (Crysis) is the same as a query language. Eric Johnson's "Taming
Spatial Queries" (2021) gives the fixes for what goes wrong: *oscillation* between symmetric
winners (bias one side a few percent; or explicit hysteresis: re-score the current
destination and only switch when the winner beats it by 10–20 %); *artificial boundaries*
(blend a test's weight by a continuous confidence instead of a decorator's if); and
*normalisation* (clamped bookends for "near enough to matter", unclamped when more enemies
in range should keep getting worse, targeted when there is an ideal distance). DOOM 2016
inverts cover: it looks for open spots near cover with maximum *visibility*, so demons stay
in view.

### Influence maps (Mark, Game AI Pro 2 ch. 30; Tozour)

A grid per faction, two kinds: *proximity* (where an agent could be in a second: linear
falloff out to speed × update period) and *threat* (what it could hit: `1 − (d/R)^4`, flat
most of the way then falling). Agents stamp precomputed *templates* with a strength
multiplier; the map is zeroed and restamped every 0.5–2 s. A *working map* round one agent
adds and multiplies layers by weights ("enemy threat + 0.5 × ally proximity, times my
interest template"), then `highest()` or `lowest()` gives a point. Used for: tanks standing
between enemies and casters, where to evade to, where enemies cluster, keeping allies from
bunching, and "enough allies on that target already".

### Formations and frontlines (Days Gone, Game AI Pro Online 2021 ch. 12)

Squads form by proximity and merge or split. *Confidence* per AI is the ratio of perceived
friendly strength (self + allies × their confidence + kills) to enemy strength (enemies ×
their confidence + own losses), binned to panicked / worried / neutral / confident / heroic;
a panicked ally counts for the *enemy*, so panic spreads; kills and losses decay over minutes.
The *frontline*: direction from the squad's centre to the enemy's, a line the squad never
crosses, a neutral buffer in front of the enemy, lanes one per member so nobody blocks a
friend's fire. Squad states by confidence: form up, hold, retreat in alternating halves
(nearest the line move first, the rest cover), press (furthest move first), then flank from
the lane ends, always leaving the rear open. Against the player, confidence rises while the
player hides and falls while the player charges, so passivity is punished and aggression
rewarded. Halo's morale (grunts flee when the elite dies) is the same thing made obvious.

### Attack tokens (DOOM 2016; the UE5 write-up)

A shared pool per target and attack category (melee 1, ranged 2, heavy 1); an enemy claims
before attacking and releases after, better-placed enemies can steal, and *everyone without
a token keeps moving*: strafing, advancing, taking cover, so the fight looks alive while
staying parseable. Difficulty is one scalar on the pool sizes. A periodic audit reclaims
tokens from the dead. The site's `slotsFor` is a token pool for one attack kind with no
stealing and no "what to do without one".

*Take:* `steer.js` (context maps for the walkers and the ships' close-in avoidance),
`spatial.js` (candidate scoring with hysteresis), `influence.js` (a small grid with
proximity/threat stamps and a working-map query), `squad.js` (confidence, frontline, lanes,
tokens with stealing and an audit).

## 4. Directing: pacing and drama

Left 4 Dead's director (Booth, GDC 2009): a per-player *intensity* that rises with damage
taken and nearby kills and decays over time; a loop of build-up → peak → relax → ...,
spawning only while intensity is below a ceiling and holding off until it falls; the
*flow* distance along the map decides where. Alien: Isolation's menace gauge is the same
with one creature. The site's `director.js` picks events with weights by heat and a calm
flag but has no intensity curve and no relax phase; the hunters' `packPlan` scales by heat.
Shadow of Mordor's Nemesis (Hoge, GDC 2018): persistent named enemies who remember and
reference what happened, come back scarred, and bring their own grudges; the site's
`npcMemory` (met, shot, grudge, downed) is the seed of this.

*Take:* an intensity meter in the director with a relax phase; the nemesis memory extended
with *how* each meeting ended, so its lines and openings follow (it comes in from behind if
you ran last time).

## 5. Flight: dogfighting AI

Air combat's pursuit curves: *lead* (nose ahead of the target: closes and is where guns
fire), *pure* (nose on it), *lag* (nose behind: holds range without overshooting). Energy:
a fighter that turns hard bleeds speed, so the better pilot trades altitude and speed and
takes the shot when the other is slow. The counters a game AI needs to look like a pilot:
the *break turn* when a shot is coming, the *overshoot* bait (slow suddenly so the pursuer
flies past), the *scissors* (both reversing turns until one ends up behind). The site's
hunters already fly lead pursuit with a `lead` factor, stations, runs and a tail; what they
lack is reading *your* state: they don't bait an overshoot when you're on their tail, don't
break when a bolt is coming, don't split a pack so one holds you while another comes from
your blind side. Star Wars: Squadrons' complaint thread is a warning: an AI that turns on a
dime and always sits on your tail is hated; the fix shipped was morale values and blind-spot
paths.

*Take:* in `hunterRules.js`, a *break* on an incoming shot read from your nose and speed,
a *bait* when you're on a hunter's tail, pack roles (bait, striker, blocker) handed out by
the squad module, and shots that go through the marker so a planet hides you.

## 6. Ambient life

Rain World: creatures with per-kind relationship tables and trackers (prey, threat, friend,
items, den, discomfort), living off-screen in an abstract room graph with "room
attractiveness"; nothing is scripted, so lizards fight each other and flee what fears them.
The Sims: every object *advertises* what needs it satisfies; a Sim picks the best advertisement
weighted by its needs with distance falloff; this is utility in the world rather than in the
head. Splinter Cell's three-tier barks and Halo's over-the-top fleeing both say: a reaction
only counts if the player sees and hears it.

*Take:* the surface actors (`actors.js`'s `think`) and the towns' folk get needs and
advertisements where there are things to want (a fire, a stall, a watchtower), and a
`relations` table (fears, hunts, ignores) that the perception module reads, so banthas run
from a speeder and troopers chase a Jawa.

## What not to take

- **A navmesh library** (recast-navigation-js is 2 MB of WASM): the worlds' solids are
  circles and boxes on a grid with `pushOut`; a flow field on that grid does what a mesh
  would at the size of a site.
- **A full planner**: see F.E.A.R. above.
- **Neural or search-based opponents**: Wetzel's players couldn't tell.
- **Yuka or behavior3js as dependencies**: the shapes port in a few hundred lines on the
  site's own vectors and seeded random, and stay testable the way everything else is.

## Sources

- Mark, D. "Building a Better Centaur: AI at Massive Scale" (GDC 2015) and the IAUS as
  implemented by Project Borealis: https://github.com/ProjectBorealis/IAUS/wiki
- Lewis, M. "Choosing Effective Utility-Based Considerations", Game AI Pro 3 ch. 13:
  http://www.gameaipro.com/GameAIPro3/GameAIPro3_Chapter13_Choosing_Effective_Utility-Based_Considerations.pdf
- Hunt, S. "Behavior Decision System: Dragon Age Inquisition's Utility Scoring Architecture",
  Game AI Pro 3 ch. 31
- Dill, K. "Dual-Utility Reasoning", Game AI Pro 2 ch. 3
- Wetzel, B. and Anderson, K. "What You See Is Not What You Get: Player Perception of AI
  Opponents", Game AI Pro 3 ch. 4
- Isla, D. "Handling Complexity in the Halo 2 AI" (GDC 2005); "Building a Better Battle: The
  Halo 3 AI Objectives System" (GDC 2008), via
  https://www.gamedeveloper.com/design/combat-evolved-the-encounter-design-of-halo-3
- Champandard, A. and Dunstan, P. "The Behavior Tree Starter Kit", Game AI Pro ch. 6;
  behavior3js, BehaviorTree.js and Mistreevous on npm
- Orkin, J. "Three States and a Plan: The A.I. of F.E.A.R." (GDC 2006):
  https://pages.cs.wisc.edu/~dyer/cs540/handouts/gdc2006_orkin_jeff_fear.pdf
- Welsh, R. "Crytek's Target Tracks Perception System", Game AI Pro ch. 31; "Looking for
  Trouble: Making NPCs Search Realistically", Game AI Pro 2 ch. 27
- Walsh, M. "Modeling Perception and Awareness in Tom Clancy's Splinter Cell Blacklist",
  Game AI Pro 2 ch. 28
- Naughty Dog, "Endure and Survive: the AI of The Last of Us" (GDC 2014), via
  https://www.gamedeveloper.com/design/endure-and-survive-the-ai-of-the-last-of-us
- Shabbir, A. "Memory Markers": https://www.gamedev.net/articles/programming/artificial-intelligence/memory-markers-r4142/
- Couvidou, L. "Flooding the Influence Map for Chase in Dishonored 2", Game AI Pro Online 2021 ch. 6
- Thompson, T. "The Perfect Organism: the AI of Alien: Isolation":
  https://www.gamedeveloper.com/design/the-perfect-organism-the-ai-of-alien-isolation
- Fray, A. "Context Steering: Behavior-Driven Steering at the Macro Scale", Game AI Pro 2 ch. 18
- Reynolds, C. "Steering Behaviors for Autonomous Characters" (GDC 1999)
- Mugen87, Yuka: https://github.com/Mugen87/yuka
- Mark, D. "Modular Tactical Influence Maps", Game AI Pro 2 ch. 30
- Straatman, R. and Beij, A. "Killzone's AI: Dynamic Procedural Tactics" (2005)
- Jack, M. "Tactical Position Selection: An Architecture and Query Language", Game AI Pro ch. 26
- Johnson, E. "Taming Spatial Queries: Tips for Natural Position Selection", Game AI Pro Online 2021 ch. 5
- Karlsson, T. "Squad Coordination in Days Gone", Game AI Pro Online 2021 ch. 12
- Thompson, T. "Cyber-Demons: the AI of DOOM (2016)":
  https://www.gamedeveloper.com/design/cyber-demons-the-ai-of-doom-2016-
- Stray Spark, "Attack token system: group combat that feels fair":
  https://www.strayspark.studio/blog/attack-token-system-ue5-group-combat-that-feels-fair
- Booth, M. "Replayable Cooperative Game Design: Left 4 Dead" (GDC 2009):
  https://cdn.fastly.steamstatic.com/apps/valve/2009/GDC2009_ReplayableCooperativeGameDesign_Left4Dead.pdf
- Hoge, C. "Helping Players Hate (or Love) Their Nemesis" (GDC 2018)
- Jakobsson, J. and Therrien, J. on Rain World:
  https://gamedeveloper.com/design/crafting-the-complex-chaotic-ecosystem-of-i-rain-world-i-
- Wright, W. on The Sims' advertisements (various talks)
- recast-navigation-js: https://github.com/isaac-mason/recast-navigation-js (looked at, not taken)
