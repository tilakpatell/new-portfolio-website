// What the crews say in a galaxy far, far away (systems.js): the four crews
// of the universe map (universe/crews.js) flying the Star Wars galaxy, over
// the same comms. Pure data, in the crews' own shape: a line is
// [speaker, text, clip?], an exchange is a list of lines said in turn,
// 'comms' is a voice on the radio that isn't the crew, and Artoo and Chewie
// say what they mean, in brackets.
//
// `arrive` has one exchange per system, said the first time you drop out of
// hyperspace there: Luke and Han have history with half of them (and Artoo,
// whose memory was never wiped, with more than Luke knows), Rick and Morty
// are tourists from another universe, and Walt and Jesse are a long way from
// Albuquerque. `events` are the jump between systems (and `course`, the
// first time the nose comes onto another system's star), and the moments the
// systems play out (the Death Star's tractor beam and its hangar at
// Alderaan, Hoth's ion cannon and the transports getting away, the
// superlaser over Scarif and its shield, Starkiller Base drinking its sun,
// the second Death Star's shield at Endor, a Star Destroyer arriving).
// `hunted` and `kill` are the galaxy's own hunters (galaxy/hunted.js): the
// Separatists' droids, the First Order's TIEs and the Sith Eternal's.
// galaxyCrew lays all this over a crew's own lines.

export const GALAXY_LINES = {
  cruiser: {
    arrive: {
      tatooine: [
        ['morty', 'Two suns, Rick! It’s like a postcard!'],
        ['rick', 'Tatooine, Morty. No water, two suns, a wretched hive of scum and villainy. I love it.'],
      ],
      hoth: [
        ['morty', 'Rick, it’s just ice. Ice, and… is that a snow lizard?'],
        ['rick', 'Tauntaun, Morty. Smells bad on the outside. You don’t want to know about the inside.'],
      ],
      endor: [
        ['comms', 'It’s a trap!', 'itsATrap'],
        ['morty', 'Rick, there’s a whole Death Star up there, and teddy bears on the moon!'],
        ['rick', 'Ewoks, Morty. Adorable. Also tried to roast a smuggler. Skip the banquet.'],
      ],
      yavin: [
        ['morty', 'Rick, is that the Death Star coming round the planet?'],
        ['rick', 'The original, Morty. Two-meter exhaust port, straight to the reactor. Who signed off on that?'],
      ],
      alderaan: [
        ['morty', 'Rick… where’s the planet? There’s just rocks.'],
        ['rick', 'That was Alderaan, Morty. The Empire made an example of it.'],
        ['comms', 'That’s no moon. It’s a space station.', 'noMoon'],
      ],
      bespin: [
        ['morty', 'Rick, a whole city floating in the clouds!'],
        ['rick', 'Cloud City, Morty. Gas mines, great sunsets, and the management sells you to Darth Vader.'],
      ],
      dagobah: [
        ['comms', 'Do. Or do not. There is no try.', 'doOrDoNot'],
        ['morty', 'Rick, the swamp’s talking to me.'],
        ['rick', 'That’s Yoda, Morty. Nine hundred years old, and still can’t put a sentence in order.'],
      ],
      mustafar: [
        ['morty', 'Rick, the whole planet’s on fire!'],
        ['rick', 'Mustafar, Morty. Lava, mining, and the galaxy’s most famous argument about the high ground.'],
      ],
      coruscant: [
        ['morty', 'It’s all city, Rick! The whole planet!'],
        ['rick', 'Coruscant, Morty. A trillion people, and a Senate that cheered in its own Emperor.'],
      ],
      naboo: [
        ['morty', 'Aw, it’s so pretty, Rick. Lakes and waterfalls and everything.'],
        ['rick', 'Naboo, Morty. Lovely place. Nice quiet senator called Palpatine. Nothing to worry about.'],
      ],
      kashyyyk: [
        ['morty', 'Rick, those trees go up for, like, miles!'],
        ['rick', 'Wroshyr trees, Morty. Wookiee country. Rule one: let the Wookiee win.'],
      ],
      kamino: [
        ['morty', 'Rick, it’s raining. Everywhere. Forever.'],
        ['rick', 'Kamino, Morty. They grew an army here out of one bounty hunter. Amateurs.'],
        ['meeseeks', 'Ooh, yeah! Can do!', 'canDo'],
      ],
      geonosis: [
        ['morty', 'Rick, there’s an arena down there! With monsters!'],
        ['rick', 'Geonosis, Morty. They tried to execute three people in there and started a war instead.'],
      ],
      scarif: [
        ['morty', 'A beach planet! Rick, can we stop? Please?'],
        ['rick', 'Scarif, Morty. Lovely beaches. Historically terrible survival rate.'],
      ],
      jakku: [
        ['morty', 'Rick, there’s a crashed Star Destroyer in the sand!'],
        ['rick', 'Jakku, Morty. The galaxy’s junkyard. Somebody left the Millennium Falcon here under a tarp.'],
      ],
      crait: [
        ['morty', 'Rick, the ground’s white, but it goes red where you touch it!'],
        ['rick', 'Salt on red rock, Morty. A guy held off a whole army here without even showing up.'],
      ],
      starkiller: [
        ['morty', 'Rick, that planet’s got a giant trench cut all the way round it!'],
        ['rick', 'Starkiller Base, Morty. It’s a Death Star, but bigger. That was the whole pitch.'],
      ],
      exegol: [
        ['morty', 'Rick, it’s all lightning and Star Destroyers and creepy chanting!'],
        ['rick', 'Exegol, Morty. Somehow, Palpatine returned. Don’t ask how. Nobody knows.'],
      ],
      ahchto: [
        ['morty', 'Aww, Rick, look at the little bird things!'],
        ['rick', 'Porgs, Morty. Basically merchandise with wings.'],
        ['morty', 'And why is that old man milking a walrus?'],
      ],
    },
    events: {
      jump: [
        ['morty', 'Rick, why are the stars all stretchy?'],
        ['rick', 'Hyperspace, Morty. It’s a portal for people with time to kill.'],
      ],
      course: [
        ['morty', 'Rick, that star’s got a name on it!'],
        ['rick', 'They all do, Morty. Every one’s a system. Nose on it, punch the hyperdrive, we’re there.'],
      ],
      tractor: [
        ['morty', 'Rick, the controls aren’t working! It’s pulling us in!'],
        ['rick', 'Tractor beam, Morty. Don’t fight it. I’ve always wanted the tour.'],
      ],
      boarded: [
        ['morty', 'Rick, they pulled us right inside the Death Star!'],
        ['rick', 'You son of a bitch. I’m in.', 'imIn'],
      ],
      ion: [
        ['morty', 'Whoa! The planet just shot a Star Destroyer!'],
        ['rick', 'Ion cannon, Morty. Doesn’t blow it up, just fries everything with a plug.'],
      ],
      superlaser: [
        ['morty', 'Rick! The Death Star just shot the planet!'],
        ['rick', 'One reactor, Morty. That’s the Empire going easy. Let’s not stick around for full power.'],
      ],
      'starkiller-charge': [
        ['morty', 'Rick, the sun’s going dark! Something’s drinking it!'],
        ['rick', 'Starkiller’s charging, Morty. It eats a whole sun to fire once. Real efficient.'],
      ],
      'starkiller-fire': [
        ['morty', 'Rick! It fired! Those were whole planets, Rick!'],
        ['rick', 'That was the Hosnian system, Morty. And they still built a weak spot into this thing.'],
      ],
      'shield-down': [
        ['comms', 'The shield is down! Commence attack on the Death Star’s main reactor.'],
        ['morty', 'They did it, Rick! The teddy bears did it!'],
        ['rick', 'Never underestimate a species with nothing to lose and a lot of logs, Morty.'],
      ],
      'shield-up': [
        ['comms', 'Break off the attack! The shield is still up!'],
        ['morty', 'Rick, they put it back up!'],
        ['rick', 'Course they did, Morty. Somebody go help the teddy bears again.'],
      ],
      'scarif-shield': [
        ['comms', 'Disqualified!', 'disqualified'],
        ['morty', 'Rick, we bounced off the whole planet!'],
        ['rick', 'Planetary shield, Morty. There’s one gate. Even the Empire has a front door.'],
      ],
      escaped: [
        ['morty', 'They made it, Rick! They got away!'],
        ['rick', 'Good for them. Running away is underrated, Morty. Trust me, I’m an expert.'],
      ],
      destroyer: [
        ['morty', 'Rick! A giant triangle just came out of nowhere!'],
        ['rick', 'Star Destroyer, Morty. A mile of Imperial overcompensation. Keep your head down.'],
      ],
    },
    hunted: {
      separatists: [
        ['morty', 'Rick, droid fighters! A whole swarm of ’em!'],
        ['rick', 'Vulture droids, Morty. Cheap, dumb, and they come in bulk. Shoot!'],
      ],
      firstorder: [
        ['morty', 'Rick, TIE fighters! The shiny new kind!'],
        ['rick', 'First Order, Morty. The Empire’s reboot. Same helmets, worse ideas. Shoot back!'],
      ],
      sith: [
        ['morty', 'Rick, red TIEs! They’re coming out of the lightning!'],
        ['rick', 'Sith fighters, Morty. Space goths. Shoot ’em before they start monologuing.'],
      ],
    },
    kill: {
      vulture: [
        ['comms', 'What is my purpose?', 'purpose'],
        ['rick', 'You blow up, buddy. Nailed it.'],
      ],
      trifighter: [
        ['rick', 'Riggity riggity wrecked, son!', 'riggity'],
        ['morty', 'It had three arms, Rick! Three!'],
      ],
      tiefo: [
        ['morty', 'I got one! A First Order one!'],
        ['rick', 'New paint job, same TIE, Morty. Pops just the same.'],
      ],
    },
  },
  xwing: {
    arrive: {
      tatooine: [
        ['luke', 'Home. If there’s a bright center to the universe, this is the planet farthest from it.'],
        ['comms', 'These aren’t the droids you’re looking for.', 'notTheDroids'],
        ['r2', '[a smug whistle: they absolutely were]'],
      ],
      hoth: [
        ['luke', 'Hoth. A wampa, a night in the snow, and Han cutting open a tauntaun to keep me warm.'],
        ['r2', '[a queasy warble]'],
      ],
      endor: [
        ['comms', 'It’s a trap!', 'itsATrap'],
        ['luke', 'The Emperor’s here, Artoo. And my father. I can feel him.'],
        ['r2', '[a worried warble]'],
      ],
      yavin: [
        ['luke', 'Yavin. The Death Star’s coming round the planet. Just like Beggar’s Canyon back home.'],
        ['r2', '[a nervous whistle: last time here, Vader blasted him]'],
      ],
      alderaan: [
        ['luke', 'This is where Alderaan was, Artoo. Leia’s home.'],
        ['comms', 'That’s no moon. It’s a space station.', 'noMoon'],
        ['luke', 'I have a very bad feeling about this.', 'badFeelingLuke'],
      ],
      bespin: [
        ['luke', 'Bespin. I lost a hand here. And found out who my father was.'],
        ['r2', '[a soft, guilty whistle: he knew all along]'],
      ],
      dagobah: [
        ['luke', 'Dagobah. I know, Artoo, I know. All the scopes are dead again.'],
        ['r2', '[a worried warble: last time, something in the swamp swallowed him]'],
        ['comms', 'Do. Or do not. There is no try.', 'doOrDoNot'],
      ],
      mustafar: [
        ['luke', 'Mustafar. Something terrible happened here, Artoo. I can feel it.'],
        ['r2', '[a quiet, careful beep: he’s been here before, and he isn’t saying]'],
      ],
      coruscant: [
        ['luke', 'Coruscant. The whole planet’s one city. You’ve never seen anything like it, Artoo.'],
        ['r2', '[an amused whistle: he flew through a battle here once]'],
      ],
      naboo: [
        ['luke', 'Naboo. Lakes and waterfalls. It’s beautiful, Artoo.'],
        ['r2', '[a long, soft whistle: this was her home]'],
        ['luke', 'Whose home, Artoo?'],
      ],
      kashyyyk: [
        ['luke', 'Kashyyyk. Chewie’s homeworld. Look at the size of those trees!'],
        ['r2', '[a nervous beep: he once played a Wookiee at holochess, and was told to let him win]'],
      ],
      kamino: [
        ['luke', 'Artoo, this planet isn’t in the archives. Someone erased it.'],
        ['r2', '[a cagey beep: someone did]'],
      ],
      geonosis: [
        ['r2', '[a boastful whistle: he flew through a droid factory here, on rockets]'],
        ['luke', 'Rockets? Artoo, I’ve never once seen you fly.'],
      ],
      scarif: [
        ['luke', 'Scarif. This is where they stole the Death Star plans. The plans you carried, Artoo.'],
        ['r2', '[a slow, solemn whistle]'],
      ],
      jakku: [
        ['luke', 'More desert. I don’t like sand, Artoo. It’s coarse, and it gets everywhere.'],
        ['r2', '[a startled beep: he’s heard that somewhere before]'],
      ],
      crait: [
        ['luke', 'An old Rebel base on the salt. I feel like I’ll be needed here one day, Artoo.'],
        ['r2', '[a puzzled warble]'],
      ],
      starkiller: [
        ['luke', 'This was Ilum. The Jedi came here for the crystals in their lightsabers.'],
        ['r2', '[an angry, rising whistle: and look what they did to it]'],
      ],
      exegol: [
        ['luke', 'Exegol. The dark side’s so strong here I can hardly breathe.'],
        ['r2', '[a frightened, wavering whistle]'],
      ],
      ahchto: [
        ['luke', 'An island at the end of the galaxy. A good place to disappear.'],
        ['comms', 'Help me, Obi-Wan Kenobi. You’re my only hope.', 'helpMeObiWan'],
        ['luke', 'Artoo. That was a cheap move.'],
      ],
    },
    events: {
      jump: [
        ['luke', 'Coordinates set. Hang on, Artoo!'],
        ['r2', '[a whoop as the stars stretch into lines]'],
      ],
      course: [
        ['luke', 'Artoo, that star. Can you plot a course?'],
        ['r2', '[a quick run of beeps: course plotted, say the word]'],
      ],
      tractor: [
        ['luke', 'Why are we still moving towards it?'],
        ['r2', '[a frantic warble: tractor beam]'],
      ],
      boarded: [
        ['comms', 'TK-421, why aren’t you at your post?'],
        ['luke', 'Artoo, plug in. Find the tractor beam, and find the princess.'],
        ['r2', '[a smug trill: found both]'],
      ],
      ion: [
        ['comms', 'Stand by, ion control… Fire!'],
        ['luke', 'Direct hit! That Star Destroyer’s dead in space.'],
        ['r2', '[a cheering beep]'],
      ],
      superlaser: [
        ['comms', 'You may fire when ready.', 'fireWhenReady'],
        ['luke', 'The Death Star! It’s firing on its own base!'],
        ['r2', '[a horrified shriek]'],
      ],
      'starkiller-charge': [
        ['luke', 'The star’s going dark. That planet is drinking it in!'],
        ['r2', '[a frightened, rising whistle]'],
      ],
      'starkiller-fire': [
        ['luke', 'It fired through hyperspace. Artoo… I felt every one of them.'],
        ['r2', '[a long, low, mournful whistle]'],
      ],
      'shield-down': [
        ['comms', 'The shield is down! Commence attack on the Death Star’s main reactor.'],
        ['luke', 'They did it! Come on, Artoo!'],
        ['r2', '[a triumphant whistle]', 'r2Whistle'],
      ],
      'shield-up': [
        ['comms', 'Break off the attack! The shield is still up!'],
        ['luke', 'Pulling up! Come on, Han…'],
        ['r2', '[a worried warble]'],
      ],
      'scarif-shield': [
        ['r2', '[an alarmed shriek]'],
        ['luke', 'There’s a shield over the whole planet! We’ll have to go in through the gate.'],
      ],
      escaped: [
        ['luke', 'They made it! They’re away!'],
        ['r2', '[a proud whistle: he’s run a blockade or two himself]'],
      ],
      destroyer: [
        ['r2', '[a frantic warble]'],
        ['luke', 'Star Destroyer, coming out of lightspeed right on top of us!'],
      ],
    },
    hunted: {
      separatists: [
        ['luke', 'Droid starfighters? I thought those went out with the Clone Wars!'],
        ['r2', '[an indignant whistle: he’s fought these before]'],
      ],
      firstorder: [
        ['luke', 'TIEs, but not the Empire’s. Whoever they are, they’re not friendly!'],
        ['r2', '[an urgent warble]'],
      ],
      sith: [
        ['luke', 'Red TIEs. I can feel the dark side on them.'],
        ['r2', '[a frightened shriek]', 'r2Scream'],
      ],
    },
    kill: {
      vulture: [
        ['luke', 'Got the droid!'],
        ['r2', '[a smug whistle]'],
      ],
      trifighter: [
        ['luke', 'Tri-fighter down! Those take some stopping.'],
        ['r2', '[a triumphant whistle]', 'r2Whistle'],
      ],
      tiefo: [
        ['luke', 'Got him! New TIEs, same blind spot.'],
        ['r2', '[a delighted whoop]'],
      ],
    },
  },
  falcon: {
    arrive: {
      tatooine: [
        ['han', 'Tatooine. Last time I was here I owed Jabba, and Greedo wanted to talk about it.'],
        ['chewie', '[a knowing grumble: Greedo didn’t get to finish]'],
      ],
      hoth: [
        ['han', 'Hoth. Still cold enough to freeze a tauntaun solid.'],
        ['chewie', '[a warning growl: the asteroid field’s that way, and the odds aren’t good]'],
        ['han', 'Never tell me the odds.', 'neverTellOdds'],
      ],
      endor: [
        ['comms', 'It’s a trap!', 'itsATrap'],
        ['han', 'Endor. Last time, the Ewoks wanted to cook me. I’m staying up here.'],
        ['chewie', '[a guilty rumble: the trap with the meat in it was his fault]'],
      ],
      yavin: [
        ['han', 'Yavin. I came back for the kid here. Don’t spread it around, I got a reputation.'],
        ['chewie', '[a pointed roar: and he still never got a medal]'],
      ],
      alderaan: [
        ['han', 'Our position is correct, except… no Alderaan.'],
        ['comms', 'That’s no moon. It’s a space station.', 'noMoon'],
        ['han', 'It’s too big to be a space station.'],
      ],
      bespin: [
        ['han', 'Bespin. Lando’s place. Last time, he sold us out and Vader put me on ice.'],
        ['chewie', '[a furious roar: he still hasn’t forgiven Lando]'],
      ],
      dagobah: [
        ['han', 'A swamp? The kid trained here? No wonder he came back talking in riddles.'],
        ['chewie', '[a disapproving growl]'],
      ],
      mustafar: [
        ['han', 'Lava planet, big black castle. Let me guess who lives here.'],
        ['chewie', '[a nervous whine: let’s not knock]'],
      ],
      coruscant: [
        ['han', 'Coruscant. Too many cops, too many politicians, and they all want a cut.'],
        ['chewie', '[a grumble about the traffic]'],
      ],
      naboo: [
        ['han', 'Naboo. The Emperor’s from here, you know. Nice lakes, though.'],
        ['chewie', '[an unimpressed grunt]'],
      ],
      kashyyyk: [
        ['chewie', '[a joyful roar: home]', 'chewieRoar'],
        ['han', 'Kashyyyk. Chewie fought the droids here in the Clone Wars. Never lets me forget it.'],
      ],
      kamino: [
        ['han', 'Kamino. So this is where Boba Fett came from. One of him was plenty.'],
        ['chewie', '[a heartfelt roar of agreement]'],
      ],
      geonosis: [
        ['han', 'Geonosis. Bugs, droid factories and a big arena. Not my kind of crowd.'],
        ['chewie', '[a low growl: he’s met their droids]'],
      ],
      scarif: [
        ['han', 'A shield over the whole planet, and one gate. Even I wouldn’t smuggle in here.'],
        ['chewie', '[a solemn rumble: some brave people did]'],
      ],
      jakku: [
        ['han', 'Jakku. If anybody ever leaves the Falcon on this junk pile, you come and find her.'],
        ['chewie', '[a solemn roar: he promises]'],
      ],
      crait: [
        ['comms', 'They hate that ship!'],
        ['han', 'Everybody hates this ship. Their mistake.'],
        ['chewie', '[a proud roar]'],
      ],
      starkiller: [
        ['han', 'So, it’s big.'],
        ['chewie', '[a worried growl: he has a bad feeling about this one]'],
        ['han', 'Relax. There’s always a way to blow these things up.'],
      ],
      exegol: [
        ['han', 'Exegol. Hokey religions and ancient weapons, and a whole fleet of ’em.'],
        ['chewie', '[a defiant roar: Lando’s bringing friends]'],
      ],
      ahchto: [
        ['han', 'Islands, rain, and a bunch of little birds staring at me.'],
        ['chewie', '[a guilty rumble: he definitely did not roast a porg here]'],
      ],
    },
    events: {
      jump: [
        ['chewie', '[a hopeful whine: will the hyperdrive work this time?]'],
        ['han', 'It’ll work. Punch it!'],
      ],
      course: [
        ['han', 'Every star out there’s somewhere, pal. Point her nose at one and we punch it.'],
        ['chewie', '[an impatient roar: then punch it]'],
      ],
      tractor: [
        ['han', 'We’re caught in a tractor beam! It’s pulling us in!'],
        ['chewie', '[a furious roar]'],
        ['han', 'I’m gonna have to shut down. But they’re not getting me without a fight!'],
      ],
      boarded: [
        ['comms', 'TK-421, why aren’t you at your post?'],
        ['han', 'Into the smuggling compartments, Chewie. Never thought I’d be smuggling myself.'],
        ['chewie', '[a muffled, cramped grumble]'],
      ],
      ion: [
        ['han', 'There goes the ion cannon. Now’s our chance, Chewie!'],
        ['chewie', '[an approving roar]'],
      ],
      superlaser: [
        ['han', 'They’re shooting at their own planet!'],
        ['chewie', '[a horrified roar]'],
        ['han', 'That’s the Empire. Not even their own people are safe.'],
      ],
      'starkiller-charge': [
        ['han', 'It’s sucking the sun dry. When the light’s gone, it fires.'],
        ['chewie', '[an urgent roar: then let’s not be here when it does]'],
      ],
      'starkiller-fire': [
        ['han', 'The whole Hosnian system. In one shot.'],
        ['chewie', '[a long, grieving howl]'],
      ],
      'shield-down': [
        ['comms', 'The shield is down! Commence attack on the Death Star’s main reactor.'],
        ['han', 'That’s our cue. Not a scratch on her this time, Chewie.'],
        ['chewie', '[a doubtful rumble]'],
      ],
      'shield-up': [
        ['comms', 'Break off the attack! The shield is still up!'],
        ['han', 'Back up? Somebody down there’s not doing their job.'],
        ['chewie', '[an indignant roar: he means “that was us”]'],
      ],
      'scarif-shield': [
        ['han', 'A shield over the whole planet? Who does that?'],
        ['chewie', '[a pointed growl: the gate, Han]'],
        ['han', 'I know where the gate is.'],
      ],
      escaped: [
        ['han', 'They made the jump! Not bad for a ship that isn’t the Falcon.'],
        ['chewie', '[a pleased rumble]'],
      ],
      destroyer: [
        ['han', 'Came out of lightspeed way too close. Somebody’s admiral is in trouble.'],
        ['chewie', '[a nervous growl]'],
      ],
    },
    hunted: {
      separatists: [
        ['han', 'Droid fighters? What year is it?'],
        ['chewie', '[an angry roar: he fought these on Kashyyyk]'],
      ],
      firstorder: [
        ['han', 'TIEs on our tail. Good. They hate this ship.'],
        ['chewie', '[a defiant roar]'],
      ],
      sith: [
        ['chewie', '[an alarmed roar: red TIEs, out of the storm]'],
        ['han', 'I got a bad feeling about this.', 'badFeelingHan'],
      ],
    },
    kill: {
      vulture: [
        ['han', 'Scratch one droid.'],
        ['chewie', '[a satisfied roar]'],
      ],
      trifighter: [
        ['han', 'That one took a few. She’s still got it.'],
        ['chewie', '[a triumphant roar]', 'chewieRoar'],
      ],
      tiefo: [
        ['han', 'Ha! Told you they hate this ship.'],
        ['chewie', '[laughs]', 'chewieLaugh'],
      ],
    },
  },
  rv: {
    arrive: {
      tatooine: [
        ['jesse', 'Yo, two suns! It’s like Albuquerque in July, times two!'],
        ['walt', 'A desert run by a crime lord, Jesse. Water’s the product here. They pull it out of the air.'],
      ],
      hoth: [
        ['jesse', 'Mr. White, it’s all snow! The RV doesn’t even have heat!'],
        ['walt', 'Then keep the engine running, Jesse. Out there, nothing lasts the night.'],
      ],
      endor: [
        ['comms', 'It’s a trap!', 'itsATrap'],
        ['jesse', 'Yo, who said that? Is it a trap? Mr. White, is it a trap?!'],
        ['walt', 'Everything’s a trap, Jesse. The trick is knowing whose.'],
      ],
      yavin: [
        ['jesse', 'Yo, they’re gonna fight that giant death ball with those little planes?'],
        ['walt', 'One exhaust port, two meters wide, straight to the reactor. Their engineer should be fired.'],
      ],
      alderaan: [
        ['jesse', 'Mr. White, there’s supposed to be a planet here. It’s all just rocks.'],
        ['walt', 'Alderaan, Jesse. They destroyed it to make a point.'],
        ['comms', 'That’s no moon. It’s a space station.', 'noMoon'],
      ],
      bespin: [
        ['jesse', 'Yo, a whole city floating in the clouds! How does that even work?'],
        ['walt', 'A businessman here cut a deal with the wrong partner, Jesse. I know the feeling.'],
      ],
      dagobah: [
        ['comms', 'Do. Or do not. There is no try.', 'doOrDoNot'],
        ['jesse', 'Yo, the swamp is giving me life advice.'],
        ['walt', 'He’s right, Jesse. I’ve been telling you that for years.'],
      ],
      mustafar: [
        ['jesse', 'Yo, it’s all lava! Like, all of it!'],
        ['walt', 'A man came here a hero, Jesse, and left as something else entirely.'],
        ['jesse', 'That… sounds like somebody I know.'],
      ],
      coruscant: [
        ['jesse', 'Yo, the whole planet is one big city!'],
        ['comms', 'Hi, I’m Saul Goodman. Did you know that you have rights?', 'saulHi'],
        ['walt', 'A trillion people, Jesse, and somehow Saul still bought the ad space.'],
      ],
      naboo: [
        ['jesse', 'Yo, it’s like, so pretty. Lakes and waterfalls and stuff.'],
        ['walt', 'A polite, patient senator from here ran everything in secret, Jesse. I’ve met the type.'],
      ],
      kashyyyk: [
        ['jesse', 'Yo, these trees are huge! Like, skyscraper huge!'],
        ['walt', 'Wookiee country, Jesse. If you play them at anything, let the Wookiee win.'],
      ],
      kamino: [
        ['walt', 'Cloning, Jesse. One template, millions of units, perfect consistency.'],
        ['jesse', 'Yeah, Mr. White! Yeah, science!', 'yeahScience'],
      ],
      geonosis: [
        ['jesse', 'Yo, there’s a whole factory down there just making robots.'],
        ['walt', 'Droid foundries, Jesse. Production at scale. Now that is a superlab.'],
      ],
      scarif: [
        ['jesse', 'Yo, a beach planet! Can we stop, Mr. White? Like, for an hour?'],
        ['walt', 'It’s an Imperial records vault with a shield over the whole planet, Jesse. We are not stopping.'],
      ],
      jakku: [
        ['jesse', 'Yo, there’s a crashed spaceship the size of a city out there in the sand.'],
        ['walt', 'Scavengers, Jesse. Lock the RV. Out here, anything that isn’t moving becomes parts.'],
      ],
      crait: [
        ['jesse', 'Yo, the ground’s white on top and red underneath. That’s crazy.'],
        ['walt', 'Salt on a red mineral, Jesse. Could be cinnabar. Mercury. You remember what mercury can do.'],
        ['jesse', 'The fake crystal that blew up Tuco’s office? Sick!'],
      ],
      starkiller: [
        ['jesse', 'Yo, they turned a whole planet into a gun?'],
        ['walt', 'And they power it by eating a sun, Jesse. That’s not chemistry. That’s ego.'],
      ],
      exegol: [
        ['walt', 'Somehow, Palpatine returned, Jesse. A man who simply refuses to stay dead.'],
        ['jesse', 'He can’t keep getting away with it!', 'gettingAway'],
      ],
      ahchto: [
        ['jesse', 'Yo, look at the little bird dudes! So cute!'],
        ['walt', 'A Jedi came here to hide from everything he’d done, Jesse. I had a cabin in New Hampshire.'],
      ],
    },
    events: {
      jump: [
        ['walt', 'Pull the lever, Jesse.'],
        ['jesse', 'Yo, the stars went all stretchy! The RV’s doing lightspeed!'],
      ],
      course: [
        ['jesse', 'Yo, Mr. White, that star’s got a name. They all got names!'],
        ['walt', 'Every one is a system, Jesse. We point at one, and we jump.'],
      ],
      tractor: [
        ['jesse', 'Mr. White, the wheel’s not doing anything! Something’s got us!'],
        ['walt', 'A tractor beam. They’re reeling us in, Jesse. Stay calm, and let me do the talking.'],
      ],
      boarded: [
        ['comms', 'TK-421, why aren’t you at your post?'],
        ['jesse', 'This is my own private domicile and I will not be harassed, bitch!', 'domicile'],
        ['walt', 'Jesse. We’re parked inside their battle station. It’s their domicile.'],
      ],
      ion: [
        ['jesse', 'Yo! The ice planet just zapped that big triangle!'],
        ['walt', 'An ion pulse, Jesse. It wipes their electronics.'],
        ['jesse', 'Like our magnet! Yeah, magnets!'],
      ],
      superlaser: [
        ['jesse', 'Yo! They just shot their own base! Their own people!'],
        ['walt', 'Covering their tracks, Jesse. When the lab’s compromised, you burn the lab.'],
      ],
      'starkiller-charge': [
        ['jesse', 'Yo, the sun is like, draining into that planet!'],
        ['walt', 'It’s charging, Jesse. A battery the size of a planet. Horrifying. But elegant.'],
      ],
      'starkiller-fire': [
        ['jesse', 'Mr. White… it just blew up a bunch of planets. With people on them.'],
        ['walt', 'I know, Jesse. No one should have that kind of power.'],
      ],
      'shield-down': [
        ['comms', 'The shield is down! Commence attack on the Death Star’s main reactor.'],
        ['jesse', 'The force field’s down! Mr. White, we can go in!'],
        ['walt', 'The main reactor, Jesse. Take out the heart of an operation and the rest falls.'],
      ],
      'shield-up': [
        ['comms', 'Break off the attack! The shield is still up!'],
        ['jesse', 'Yo, it’s back! The force field thing is back!'],
        ['walt', 'Then we wait, Jesse. Patience is half the job.'],
      ],
      'scarif-shield': [
        ['jesse', 'Yo, we bounced! The whole planet’s got a force field!'],
        ['walt', 'A perimeter, Jesse. There’s a gate. There is always a gate.'],
      ],
      escaped: [
        ['jesse', 'Yo, they made it out! They jumped!'],
        ['walt', 'A clean exit, Jesse. Always have one planned.'],
      ],
      destroyer: [
        ['jesse', 'Yo, a giant triangle just showed up out of nowhere!'],
        ['walt', 'A Star Destroyer, Jesse. The DEA of this galaxy. Don’t speed.'],
      ],
    },
    hunted: {
      separatists: [
        ['jesse', 'Yo, robot bird things! They’re shooting at us!'],
        ['walt', 'Automated, Jesse. No judgment, no imagination. We out-think them.'],
      ],
      firstorder: [
        ['jesse', 'Yo, these bug zappers are all shiny and new!'],
        ['walt', 'A new regime, Jesse. Same product, better packaging. Shoot back.'],
      ],
      sith: [
        ['jesse', 'Mr. White, red TIE things everywhere! We are in so much danger!'],
        ['walt', 'I am not in danger, Skyler. I am the danger.', 'theDanger'],
        ['jesse', 'Did you just call me Skyler?'],
      ],
    },
    kill: {
      vulture: [
        ['jesse', 'Robot bird down! Yeah!'],
        ['walt', 'One less unit, Jesse. Keep counting.'],
      ],
      trifighter: [
        ['jesse', 'Yeah, Mr. White! Yeah, science!', 'yeahScience'],
        ['walt', 'Three hits for three arms, Jesse. Persistence.'],
      ],
      tiefo: [
        ['jesse', 'Yo, I tagged a shiny one!'],
        ['walt', 'New regime, Jesse. Same weak points.'],
      ],
    },
  },
};

// A crew (universe/crews.js) as it is in the galaxy: its own lines, with
// the galaxy's arrivals in place of the universe map's (there are no
// stations or fandom planets here) and the galaxy's events, hunters and
// kills over its own (so a TIE shot down still gets the crew's own line).
// A crew the galaxy has nothing for comes back as it was.
export function galaxyCrew(crew) {
  const g = crew && GALAXY_LINES[crew.id];
  if (!g) return crew ?? null;
  return {
    ...crew,
    arrive: g.arrive,
    events: { ...crew.events, ...g.events },
    hunted: { ...crew.hunted, ...g.hunted },
    kill: { ...crew.kill, ...g.kill },
  };
}
