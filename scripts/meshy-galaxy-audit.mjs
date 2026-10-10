// The audit lane (docs/research/2026-10-07-star-wars-buildings-audit.md):
// the galaxy worlds' buildings the audit found poor or off-model, each to be
// remade by scripts/meshy-galaxy-buildings.mjs like its own and in its
// format (that script's header has the fields), lifted out of a
// Wookieepedia picture of the place as it is on screen. Ordered by the
// audit's priority. Kept in a file of their own; their tasks go in
// scripts/meshy-galaxy-audit-tasks.json (MESHY_TASKS), made on the account
// whose key is MESHY_API_KEY_ACC_3 (a task is read back with the key that
// made it).
//
//   MESHY_API_KEY=$MESHY_API_KEY_ACC_3 MESHY_TASKS=scripts/meshy-galaxy-audit-tasks.json MESHY_REVIEW=lab/meshy/audit node scripts/meshy-galaxy-buildings.mjs <step> <kind …>
export const BUILDINGS = {
  // dagobah: yodahut (now quality 3, accuracy 3; priority 9): The current
  // model is a smooth white egg with tube windows, lifted from McQuarrie's
  // white painting. It is the second white result in a row, after
  // 'yodahut-first'. In the film the hut is a low, lumpy, dark grey-green mud
  // mound with a spike on top and a glowing round door, with gnarltree roots
  // draped over it. It stands right at Dagobah's landing spot, next to the
  // X-wing. File:YodaHutt-DB.png is a sharp, dark, wet ESB exterior of the
  // whole hut with little occlusion, so a remake from it should not come out
  // white.
  yodahut: {
    ref: 'File:YodaHutt-DB.png',
    crop: [0.15,0.1,0.72,0.57],
    lift: 'the low lumpy dwelling of dark grey-green mud and clay, about twice as wide as it is tall: one big rounded dome with a short pointed spike on its top, a smaller rounded dome joined on its left with a short wide round tube jutting out of its front, a round arched doorway glowing warm orange low on the big dome\'s right side, a small round window glowing orange high on the big dome\'s upper left, thick gnarled dark wet tree roots draped over it and gripping its sides, wet moss and dirt round its base; without the small robot, the water or the big tree trunk behind it',
    metres: 10,
    along: 'w',
    tris: 20000,
    tex: 2048,
    yaw: -0.6,
    detail: 'adobe',
  },
  // coruscant: The Jedi Temple (now quality 3, accuracy 5; priority 9): The
  // Sketchfab model has three flat untextured colours (cream, red, black),
  // needle-cone spires and red Imperial-era stripes. In game, from the
  // forecourt, it reads as bare lavender slabs. The ziggurat and five-spire
  // layout is right. A clean full front view exists: TCW's TZBSB still, from
  // the film model.
  jeditemple: {
    ref: 'File:JediTemple-TZBSB.png',
    crop: [0.25,0.03,0.55,0.97],
    lift: 'the stepped temple (a vast truncated pyramid of pale cream-beige stone with sloping walls cut by long dark vertical grooves, tall flat buttress slabs rising up the middle of the front and at the corners, a broad low base platform round it with a row of small arched niches, a flat roof terrace with small low domed hatches, and five tall smooth round towers on the roof: the middle one tallest with a flared crown and pointed tip, four thinner ones round it with rounded ribbed caps), without the city round it or the flying vehicles',
    metres: 200,
    along: 'w',
    tris: 40000,
    tex: 2048,
    detail: 'stone',
  },
  // naboo: stonehead (now quality 7, accuracy 3; priority 7): The current
  // model, made from a text prompt, is a craggy amphibian gargoyle with
  // droopy lobes. In game (my sacred-place shot) it reads as a mossy boulder:
  // you can't tell it is a face from the side. The film's heads are a
  // different design, calm humanoid faces with grid lines, almond eyes and a
  // tall ribbed headdress. The clearest view is File:Nass on Sacred
  // Place.png. File:Elder statue.jpg is the production maquette of exactly
  // that head, the whole head isolated on white, so it makes a clean, compact
  // lift.
  stonehead: {
    ref: 'File:Elder statue.jpg',
    crop: [0,0,1,1],
    lift: 'the colossal carved stone head: a calm elongated face with almond-shaped eyes under a carved brow band, a straight nose and closed full lips, its surface divided by shallow carved grid lines, a round carved disc on the brow, round ear ornaments with hanging coiled pendants at each side, and a tall cylindrical headdress of stacked tiers of rounded vertical ribs; weathered grey stone with green moss and lichen in the grooves, the base cut flat just under the chin',
    metres: 7.5,
    along: 'h',
    tris: 16000,
    tex: 2048,
    detail: 'stone',
  },
  // kashyyyk: kachirho (now quality 3, accuracy 2; priority 7): The built
  // Kachirho is a toy: a smooth, straight, tan 230 m pole with four flat disc
  // decks, acorn pods, and hexagon leaf pads on sticks
  // (renders/kachirho-built.jpg; shots2 kachirho-far/deck). On screen (the
  // film's still of the shore) it is a gnarled, slightly leaning giant. Its
  // foot is a wide mass of roots built over with wooden houses, it carries
  // dozens of hanging cone pods, and its crown is broad, flat and dense. The
  // old lift (a game render, crop with the crown cut off) lost the city and
  // shipped as wroshyrgreat. The film still shows the whole tree.
  kachirho: {
    ref: 'File:Kachirho.png',
    crop: [0.07,0,0.43,0.68],
    lift: 'the one colossal ancient tree in the middle (a vast gnarled grey-brown trunk leaning slightly, spreading at its foot into a wide mass of buttress roots built over with dark wooden houses, platforms and walkways; heavy twisting branches under a broad, flat, dense dark-green canopy; dozens of small dark-brown wooden pods shaped like downward-pointing cones with small peaked caps hanging all over the lower trunk), on its own, without the water, the stilted platforms standing in the water, the smaller trees beside it or the mountains',
    metres: 230,
    along: 'h',
    tris: 40000,
    tex: 2048,
    styles: ['tree'],
    detail: 'bark',
  },
  // geonosis: foundry (now quality 3, accuracy 3; priority 7): Smooth merged
  // orange balls with flat yellow ovals and two chimneys: a blob. The canon
  // exterior of the primary droid foundry is a towering eroded sandstone keep
  // with three needle spires. No live-action exterior exists, but the Clone
  // Wars still shows the whole building, clear of clutter except small spires
  // at its foot.
  foundry: {
    ref: 'File:PrimaryGeonosianDroidFactory.png',
    crop: [0.4,0.04,0.29,0.8],
    lift: 'the towering rock fortress on its own, seen in plain daylight (a massive eroded red-ochre sandstone keep with buttressed walls and dark arched openings round its foot, three tall slender needle spires of stacked bulging rings rising from its top, the middle one the tallest), without the small spires and rocks round its base or the sky',
    metres: 100,
    along: 'h',
    tris: 36000,
    tex: 2048,
    detail: 'redrock',
  },
  // coruscant: 500 Republica (now quality 3, accuracy 2; priority 7): The
  // built one is a pale fluted needle 660 m tall with lit rings. The screen
  // tower (TPM) is a massive dark bronze stepped cluster of rounded shafts up
  // to a ribbed dome crown. In game, from the bridge, it is a generic column.
  // The TPM still shows the whole crown clean against the sky, and a lane row
  // already exists but was never run.
  republica: {
    ref: 'File:500Republica.png',
    crop: [0.15,0,0.71,1],
    lift: 'the tall stepped skyscraper (a massive tower of clustered rounded vertical shafts of dark bronze-brown metal stepping inward in tiers up to a slim ribbed dome crown with a short mast, every face covered in rows of small windows), the whole tower down to the bottom of the picture, in plain dusk light, without the flying vehicles',
    metres: 100,
    along: 'w',
    tris: 30000,
    tex: 2048,
  },
  // coruscant: Dex's Diner (now quality 4, accuracy 3; priority 7): The built
  // one is a beige capsule on a teal slab with a big DEX'S DINER neon sign.
  // The film diner is a long, low, horizontally ribbed dark-steel building
  // with rounded ends, oval windows, red-brown end caps and two roof disc
  // vents. The AotC still shows the whole diner in three-quarter front view
  // with little occlusion. A lane row exists, but its crop clips the right
  // end and the base.
  dexdiner: {
    ref: 'File:Dexs Diner.jpg',
    crop: [0.07,0.1,0.84,0.78],
    lift: 'the small diner (a long low building with rounded ends: walls of horizontally ribbed dark brushed steel, thick vertical ribs between a band of large oval windows lit warm inside, a round orange sign in the middle window, a thin red trim line along the walls, a flat roof with two round disc vents, raised red-brown end caps with sloping tops at both ends, an arched door with a red frame left of the middle, a curved steel skirt at the base), without the buildings behind it, the people, the bins or the parked speeder',
    metres: 22,
    along: 'w',
    tris: 20000,
    tex: 2048,
    solids: 'built',
    detail: 'metal',
  },
  // tatooine: cantina (now quality 6, accuracy 5; priority 6): The current
  // model came from a text-prompt concept (library lane). The owner turned
  // down such concepts elsewhere. It has two bright-white smudged domes, a
  // square box vestibule and a porthole door, and reads as a generic dome.
  // The cantina on screen is a big low dome behind a flat-topped front wall
  // with rounded shoulders, a deep round-arched entrance, a lower left wing
  // with its own doorway, a vent hood on the ledge and a mast. Outlaws'
  // render of the set shows the whole exterior.
  // (made as its own kind, moscantina: Nevarro's town keeps the old cantina)
  moscantina: {
    ref: 'File:ChalmunsCantina-OutlawsLocations.jpg',
    crop: [0.47,0.3,0.18,0.25],
    lift: 'the domed desert tavern: one large low dome of sand-coloured plaster rising behind a tall flat-topped front wall with rounded shoulders; right of the middle of the front a deep rounded-arch entrance recess with a dark doorway, a plain blank sign plate over the door and a small round window above it; a lower flat-topped wing to the left with its own small doorway; a boxy slatted vent hood on the roof ledge and a thin metal mast on top of the dome; sand-worn tan plaster with streaks, in plain midday daylight (not the dusty haze), without the people, the droid, the pole and the machinery in the foreground and the buildings at either side',
    metres: 22,
    along: 'w',
    tris: 24000,
    tex: 2048,
    solids: 'built',
    detail: 'adobe',
  },
  // tatooine: palace (now quality 5, accuracy 6; priority 6): The geometry is
  // right: drum, two overhanging saucer roofs, a slim capped tower, a domed
  // annex and the rock. But it is the buildings lane's retexture of the
  // owner's model, recoloured flat to #9d6b60 (texture mean 156,107,96, sd
  // 13,10,9). In game it reads as salmon clay, the rocks pink too, and it is
  // the skyline piece seen from the homestead. The screen palace is
  // rust-brown weathered stone with seams, lit window bands and blue trim.
  // The fill lane already has this still's lift and model paid for, so try
  // that one first.
  palace: {
    ref: 'File:BobaFettsPalace-TMCh16.png',
    crop: [0.155,0.02,0.665,0.85],
    lift: 'the great round fortress: one huge cylindrical drum of weathered rust-brown stone with faint vertical seams, horizontal bands and rows of small square windows, crowned by two stacked wide overhanging saucer-shaped roofs with a band of small lit windows under each and a small domed cupola with a blue band on top; behind it on the right a tall slim cylindrical tower with a flared saucer cap and a domed top with a blue band, and in front of the tower a shorter round annex with a domed roof ringed by small round windows; a thin stair curving up the drum\'s side; the rough brown rocks at its foot; plain midday daylight (not the dusk haze)',
    metres: 75,
    along: 'w',
    tris: 45000,
    tex: 2048,
    solids: 'built',
    detail: 'adobe',
  },
  // kamino: tipoca (now quality 3, accuracy 3; priority 6): This Sketchfab
  // model (1.5k tris) stands in for every 'tower': 4 placed plus 10
  // scattered, including the Prime Minister's tower. It is a faceted drum on
  // 4 square legs, like a coffee table. In game the Prime Minister's tower is
  // a squat dark disc whose top is only ~7 m above the pad. Tipoca's towers
  // are tall heavy tapering towers on wide saucers. The Clone Wars city still
  // shows one whole tower building.
  tipoca: {
    ref: 'File:TipocaCity-CC.png',
    crop: [0.625,0,0.205,0.62],
    lift: 'one tall tower building on its own (a broad low saucer-shaped dome of grey metal plates ringed with rows of small lit windows, a tall heavy tapering grey tower rising from its middle with a band of lit windows near its foot, a flat top with thin antenna masts, standing on a ring of thin pylons), without the smaller domes and walkways round it',
    metres: 64,
    along: 'h',
    tris: 26000,
    tex: 2048,
    styles: ['tower'],
  },
  // coruscant: Processional Way / Senate plaza statues (now quality 3,
  // accuracy 3; priority 6): The built statue is a cylinder robe, a sphere
  // head, a cone hood and rod arms. In game, from the Processional Way
  // bridge, the statues read as pillars with knobs. The Processional Way's
  // hooded robed Jedi on stepped pedestals are one self-contained object:
  // TCW's silhouette shows the design, and the Deceived render shows the same
  // design lit and detailed.
  statue: {
    ref: 'File:ProcessionalWay-Deceived.png',
    crop: [0.72,0,0.19,0.62],
    lift: 'the tall statue (a hooded robed figure of weathered dark bronze, both hands on the hilt of an upright sword held before its chest with the blade rising a little above the hood, a wide sash at the waist, a long plain robe to the feet, standing on a square stepped grey stone pedestal), the whole statue and pedestal, in plain daylight, without the wall behind',
    metres: 28,
    along: 'h',
    tris: 12000,
    tex: 1024,
    styles: ['jedi'],
  },
  // mustafar: fortress (now quality 4, accuracy 6; priority 6): The Sketchfab
  // model (2.7k tris, flat black, no maps) has the right two-pronged shape
  // but reads as a smooth black slab with red stripes up close and in game
  // (shots2/mustafar-fortress-high.png). It is 120 m tall and can be seen
  // from the landing about 560 m away. The audit's ref (the OWK still) is a
  // dark front-on silhouette against a dark sky, with the base hidden behind
  // the cliff. The Rogue One production painting shows the whole tower from
  // three-quarters above, base and all, against lava and grey ground, so it
  // is a better picture to lift.
  fortress: {
    ref: 'File:FortressVaderConceptArt-R1.jpg',
    crop: [0.49,0.02,0.23,0.8],
    lift: 'the tall black tower (a slim four-sided tapering monolith of dark ribbed metal panels that splits for its upper third into two tall narrow blade-like prongs with a narrow open gap between them, a deep vertical groove running on down between them to its foot, standing on a wide low base of angled black buttresses with ridged sloping tops, a thin glowing orange seam running down one corner of the base), without the rocks, the lava, the smoke or the ground',
    metres: 120,
    along: 'h',
    tris: 40000,
    tex: 2048,
    detail: 'metal',
  },
  // geonosis: commandpost (now quality 3, accuracy 2; priority 5): Yoda's
  // forward command center in the film is a long low boat-shaped armoured
  // platform in weathered red and off-white, with a parapet deck and a
  // sensor-dish mast. The built one is a white prefab box with a flat roof. A
  // clear film still shows the whole hull side-on (a gunship behind it, which
  // the lift removes).
  commandpost: {
    ref: 'File:Forward-Command-Center-Geonosis.png',
    crop: [0,0.04,1,0.94],
    lift: 'the long low armoured command platform on its own (a boat-shaped hull of weathered dark red and off-white plates with a flat ledge running round it and a low skid under it, a raised parapet round its open top deck, a tall mast with a curved grey sensor dish, a cluster of grey equipment boxes beside the mast), without the aircraft behind it, its wing, its round gun turret or the two soldiers on the deck',
    metres: 17,
    along: 'w',
    tris: 20000,
    tex: 1024,
    detail: 'metal',
  },
  // bespin: cloudcity (now quality 3, accuracy 4; priority unverified): An
  // 800-tri lathe: a waisted cream cylinder with a bulb top, a spire and glow
  // bands, with no panels, rims or windows. The same tower is the plaza's
  // centrepiece (scale 2.2) and all 46 skyline towers, so from the landing
  // (shot platform327) the city reads as a row of identical salt shakers. On
  // screen (the ESB SE daytime still) the towers are stepped grey-white
  // cylinders with projecting rims, flat drum caps and pairs of slot windows.
  // One self-contained exterior object with a usable film still. The existing
  // lane spec cloudtower crops File:Cloud City Streets SWB.png with the
  // tower's top cut off at the frame edge.
  cloudcity: {
    ref: 'File:Cloud City Daytime.png',
    crop: [0.48,0.22,0.155,0.78],
    lift: 'the tall slender round tower in the middle (three stacked light grey-white cylinders, each a little narrower than the one below, parted by thin projecting rims; a low flat disc cap with a short finial on top; pairs of small dark vertical slot windows round each tier; smooth painted metal panels with faint vertical seams), whole, on a slightly flared round base; leave out the small red flying vehicle in front of its top and the towers around it',
    metres: 60,
    along: 'h',
    tris: 12000,
    tex: 2048,
    detail: 'paint',
  },
  // nevarro: the domes of Nevarro City (now quality 5, accuracy 5; priority
  // unverified): It was lifted from the untextured grey miniature, so its
  // texture is flat putty grey with no weathering. It is too flat (11 x 3.5
  // m). On screen the domes are pale weathered stone, about twice as wide as
  // they are tall, on a drum, with a flat cap on top. The S1 spaceport still
  // shows a clear one, with only its foot hidden behind rock.
  nevarrodome: {
    ref: 'File:NevarroCitySpaceport.png',
    crop: [0.27,0.42,0.12,0.16],
    lift: 'the round domed stone building: a low cylindrical drum wall with a slight ledge round its top, a smooth rounded dome above it and a flat round cap on its crown, in pale grey weathered stone with darker streaks, chips and patches; the drum complete down to the ground',
    metres: 11,
    along: 'w',
    tris: 14000,
    tex: 1024,
    detail: 'stone',
  },
  // lothal: the old Imperial tower (Sabine's tower) (now quality 3, accuracy
  // 1; priority unverified): It is Yavin's jungle lookout: a see-through
  // steel lattice of thin rods. Ahsoka's Sabine tower is a tall tapering
  // stone-block shaft with a fluted foot, a saucer cabin with two long
  // antenna arms, and a mast. There is a clean live-action still of the whole
  // tower.
  // (made as its own kind, lothtower: Yavin keeps its lattice lookout)
  lothtower: {
    ref: 'File:LothalTower-LiveAction.png',
    crop: [0.13,0.015,0.75,0.96],
    lift: 'the very tall slender tower: a long tapering round shaft of grey stone blocks in banded sections, a flared ribbed foot on a low round plinth, a round saucer-shaped cabin near the top with two long thin horizontal antenna arms, and a thin mast with small crossbars above it',
    metres: 40,
    along: 'h',
    tris: 20000,
    tex: 2048,
    detail: 'stone',
  },
  // sorgan: the krill farmers' huts (now quality 4, accuracy 2; priority
  // unverified): A rectangular gabled thatched cottage on a white base slab,
  // its walls shredded into torn polygons. Sorgan's huts are round: a plank
  // and wicker drum under a bulbous slatted roof rising to a tall thin spire,
  // on the ground among the ponds, not on stilts. A village still shows one
  // whole, with only its lower drum partly hidden.
  stilthut: {
    ref: 'File:Sorgan Human Tribe The Mandalorian.png',
    crop: [0.115,0.05,0.135,0.44],
    lift: 'the round hut in the middle: a low round drum wall of weathered grey wooden planks and woven reeds, a bulbous roof of curved dark brown wooden slats over thatch rising into a tall thin pointed spire; the whole hut down to the ground',
    metres: 9,
    along: 'h',
    tris: 15000,
    tex: 1024,
    detail: 'wood',
  },
  // tatooine: benhut (now quality 6, accuracy 5; priority 4): In game the
  // Sketchfab hut is a tall box with a dome, an arched plank-door porch and
  // poking roof sticks: a nice generic Tunisian hut, but not Ben's. In the
  // film his hut is a long, low block with steeply battered walls, a dome on
  // the flat roof and a lower wing. The film still shows it whole, though
  // small.
  benhut: {
    ref: 'File:Kenobihut.jpg',
    crop: [0.136,0.33,0.372,0.26],
    lift: 'the low squat desert hut: a long rectangular block with thick, steeply sloping battered walls of rough sand-coloured plaster with eroded runnels, one round dome sitting on its flat roof, a lower wing at one end, a short post at a roof corner and a thin pole at the other end of the roof, two small round stone drums by the wall; plain midday daylight; without the tall pole tower beside it, the vehicle and the dark rocks in front',
    metres: 9,
    along: 'w',
    tris: 16000,
    tex: 1024,
    detail: 'adobe',
  },
  // tatooine: stall (now quality 4, accuracy 4; priority 4): The kitbash pick
  // is two pale cloth awnings on poles with no counter or goods; one cloth
  // hangs detached and floating. Market stalls on screen (the Mos Espa set)
  // are a canvas-roofed pole frame with hanging dried goods, a counter,
  // baskets and pots of produce. A clean set photo shows one whole.
  stall: {
    ref: 'File:Mos Espa stall.png',
    crop: [0.15,0.04,0.7,0.93],
    lift: 'the market stall: a boxy frame of thin wooden poles with a sagging pale canvas roof and side flaps, bunches of dried goods hanging under the roof, a plain wooden counter, and in front round woven baskets and squat metal pots on stands piled with fruit, nuts and roots; dusty desert colours, plain daylight; without the plaster wall behind it, the long pole lying on the right and the buildings in the distance',
    metres: 3.6,
    along: 'w',
    tris: 12000,
    tex: 1024,
  },
  // kashyyyk: wookieehouse (now quality 5, accuracy 3; priority 4): Clean but
  // generic: an acorn pod with a smooth green cone roof on a disc deck on
  // stilts. It reads as an Ewok or hobbit hut (shots2 village), and no
  // Wookiee home on screen has a green dome. The recognisable Wookiee home is
  // Chewbacca's round timber treehouse (McQuarrie's painting, the exterior
  // used for the Holiday Special and on Wookieepedia's Chewbacca's home
  // page): a slatted gallery under a ribbed conical roof with a small
  // windowed drum on top, on a flared underside of radiating struts. In the
  // painting the whole house is in view, and it is one exterior object with
  // no floors.
  wookieehouse: {
    ref: 'File:House exterior rmq.jpg',
    crop: [0.24,0.1,0.74,0.62],
    lift: 'the large round wooden house in front (a wide circular gallery with a slatted railing all round, tall timber-framed walls and windows behind it under deep overhanging eaves on curved brackets, a broad low conical roof of radial timber ribs and planks rising to a small upper drum with a ring of arched windows, a smaller roof and a crown of short posts at its peak, a flared underside of radiating wooden struts gathering onto a short thick round wooden post that stands it on the ground), weathered natural brown wood in plain daylight, on its own, without the trees round it and through it, the smaller house behind or the walkway and ladder',
    metres: 12,
    along: 'w',
    tris: 16000,
    tex: 1024,
    detail: 'wood',
  },
  // mustafar: droidplatform (now quality 4, accuracy 3; priority 4): The
  // built one is a disc over a half-dome with an orange ball. The film's
  // panning droids, which the duellists ride, have a flat disc top, a head
  // with two lens eyes, a ribbed body between side plates, long arms and a
  // molten bucket. A clean, whole, isolated render of the screen asset exists
  // at 1313x2000 on white, three times the resolution of the audit's 448x664
  // copy. Three are placed, 70-120 m from the landing.
  droidplatform: {
    ref: 'File:Panning-droid negtd.png',
    crop: [0,0,1,1],
    lift: 'the hovering industrial droid (a wide flat round disc platform on top with a raised rim, a narrow box head under its front edge with two round glowing violet lens eyes, a thick ribbed horizontal cylinder body between two flat side plates with a vent grille under it, long thin jointed arms down its sides, and a big round-bottomed banded metal bucket full of glowing molten metal hung on pivots beneath), rusty orange-brown weathered metal, on its own',
    metres: 6.6,
    along: 'h',
    tris: 12000,
    tex: 1024,
    detail: 'metal',
  },
  // tatooine: tent (now quality 2, accuracy 4; priority 3): 149-tri tan cones
  // with sticks and a door box floating off the cone. The cone is close to
  // the Book of Boba Fett's plain pyramid tents but reads as a teepee. The
  // films' iconic Tusken dwellings (Attack of the Clones) are low ribbed
  // domes of hide and mud over bent poles, with crossed pole ends on top and
  // an arched door. One is fully in view in the film still. A self-contained
  // solid that suits Meshy.
  tent: {
    ref: 'File:Urtya tents.png',
    crop: [0.465,0.13,0.505,0.55],
    lift: 'the domed hut: a low round dome of rough sun-dried hides and mud plaster stretched over a frame of bent poles whose ribs show through, the pole ends crossed and sticking out at the top, one dark arched doorway; pale sandy grey-brown, plain midday daylight (not the dusk light), without the robed figure, the hut at the left edge and the huts behind',
    metres: 5.5,
    along: 'w',
    tris: 12000,
    tex: 1024,
    styles: ['tusken'],
  },
  // tatooine: mosspire (now quality 4, accuracy 4; priority 2): A plain 20 m
  // cylinder with a narrower cylinder, a tiny dome and a pipe (2.5k tris). It
  // reads as a pillar. Mos Eisley's round towers on screen have two stacked
  // mushroom caps over a buttressed shaft, and the Special Edition wide shot
  // shows one cleanly.
  mosspire: {
    ref: 'File:Mos Eisley.png',
    crop: [0.765,0.055,0.105,0.47],
    lift: 'the tall round tower: a thick, slightly tapering shaft of weathered tan stone with shallow buttress ribs, slit windows and a small door at its foot, crowned by two stacked wide rounded mushroom-shaped caps with a dark recessed band under each; dusty sand-brown plaster streaked with grime; without the domed houses in front of it and the buildings behind it',
    metres: 20,
    along: 'h',
    tris: 12000,
    tex: 1024,
    detail: 'adobe',
  },
};
