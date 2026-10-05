// Who flies you round the universe map: Rick and Morty in the space cruiser,
// Luke and Artoo in an X-wing, or Han and Chewie in the Millennium Falcon.
// Pure data: the panel offers the ships, the scene builds the one picked and
// the comms box says these lines as things happen.
//
// A line is [speaker, text, clip?]; an exchange is a list of lines said in
// turn. A line with a clip (lib/clips.js) plays the recording under its
// subtitle; the rest are voiced by sounds.js. The speaker 'comms' is a
// voice on the radio that isn't one of the crew (no face).
// `arrive` has one exchange per place on the map (the stations and the
// planets), said the first time you reach it.
// Artoo and Chewie don't speak Basic: their lines are what they mean, in
// brackets, and sound like them (sounds.js).

export const CREWS = [
  {
    id: 'cruiser',
    ship: 'The space cruiser',
    label: 'Rick and Morty',
    speakers: {
      rick: { name: 'Rick', color: '#a8dcf0', voice: 'rick' },
      morty: { name: 'Morty', color: '#f5d33f', voice: 'morty' },
      meeseeks: { name: 'Mr. Meeseeks', color: '#7cc8ec', voice: 'morty' },
    },
    launch: [
      ['rick', 'Wubba lubba dub dub!', 'wubba'],
      ['rick', 'Alright Morty, the whole site’s out here. Try not to touch anything.'],
      ['morty', 'Aw jeez, Rick. Which one first?'],
    ],
    boost: [['rick', 'Wubba lubba dub dub!', 'wubba']],
    bump: [
      ['rick', 'Riggity riggity wrecked, son!', 'riggity'],
      ['morty', 'Rick, you flew into a planet!'],
    ],
    // into a planet too fast (the cruiser comes back through a portal)
    crash: [
      ['comms', 'I can’t take it anymore. I just wanna die.', 'cantTakeIt'],
      ['morty', 'Rick! We crashed into a planet, Rick!'],
      ['rick', 'Relax, Morty. I backed us up. Portal’s open.'],
    ],
    // sitting still a while
    idle: [['rick', 'Lick, lick, lick my balls! Ha ha! Yeah! Say that all the time!', 'lickLick']],
    // something flying past you (traffic.js)
    traffic: {
      patrol: [
        ['morty', 'Rick, it’s the Federation!'],
        ['rick', 'Act natural, Morty. We’re two guys out for a drive.'],
      ],
      gromflomite: [
        ['morty', 'Bugs, Rick! Space bugs!'],
        ['rick', 'Gromflomites, Morty. The Federation’s errand boys.'],
      ],
      meeseeks: [
        ['meeseeks', 'I’m Mr. Meeseeks! Look at me!', 'meeseeks'],
        ['morty', 'What’s he even doing out here?'],
      ],
      birdperson: [
        ['morty', 'Is that Birdperson?'],
        ['rick', 'Birdperson! My man.'],
      ],
    },
    // shooting one down
    kill: {
      any: [
        ['morty', 'Oh geez, Rick, I hit one!'],
        ['rick', 'Relax, Morty. It’s the Federation. Nobody’s gonna miss ’em.'],
      ],
      meeseeks: [
        ['morty', 'Rick! I popped a Meeseeks!'],
        ['rick', 'He’s fine, Morty. Existence is pain to a Meeseeks.'],
      ],
      birdperson: [
        ['morty', 'Rick, I shot Birdperson!'],
        ['rick', 'He’ll be fine, Morty. Phoenixperson’s a whole thing.'],
      ],
      saucer: [
        ['morty', 'Rick! That was a family!'],
        ['rick', 'They had it coming, Morty. Probably.'],
      ],
      hauler: [['rick', 'Whoops. There goes somebody’s plumbus delivery.']],
      gearship: [
        ['morty', 'Rick, you shot a Gear Person!'],
        ['rick', 'Revolio’s gonna be so mad, Morty.'],
      ],
      councilship: [
        ['morty', 'I got one of the Ricks!'],
        ['rick', 'One less Rick, Morty. The multiverse can spare it.'],
      ],
    },
    // hunters after you (hunters.js), by who they are
    hunted: {
      federation: [
        ['morty', 'Rick! The Federation’s on our tail!'],
        ['rick', 'Course they are, Morty. I’m the most wanted man in the galaxy. Shoot back!'],
      ],
      council: [
        ['comms', 'Rick Sanchez of Earth C-137, by order of the Council of Ricks: surrender your portal gun.'],
        ['rick', 'The Council. A bunch of Ricks who think they’re better than me. Light ’em up, Morty.'],
      ],
    },
    // their lasers hitting you, your shields low, shot down
    hit: [
      ['morty', 'Rick, we’re hit!'],
      ['rick', 'It’s a scratch, Morty.'],
    ],
    shields: [
      ['morty', 'Rick, the shields are almost gone!'],
      ['rick', 'Then stop getting hit, Morty!'],
    ],
    destroyed: [
      ['morty', 'We’re going down, Rick!'],
      ['rick', 'Relax. I backed us up again. Portal’s open.'],
    ],
    // getting away from them, and shooting the lot down
    escaped: [
      ['rick', 'Lost ’em, Morty. Too easy.'],
      ['morty', 'Oh man. Oh jeez.'],
    ],
    cleared: [
      ['rick', 'That’s what you get for messing with the smartest man in the universe!'],
      ['morty', 'I did most of the shooting, Rick.'],
    ],
    // the director's set pieces (director.js), and going out into deep space
    events: {
      distress: [
        ['comms', 'Mayday, mayday! Gromflomites! Anybody!'],
        ['morty', 'Rick, that family’s in trouble!'],
        ['rick', 'Ugh. Fine. Heroics. Shoot the bugs, Morty.'],
      ],
      rescued: [
        ['comms', 'Thank you, strangers! Squanch you very much!'],
        ['rick', 'Yeah, yeah. Don’t make it a thing.'],
      ],
      convoy: [
        ['morty', 'Look at all those ships, Rick.'],
        ['rick', 'A convoy, Morty. Plumbuses, mostly. Everybody needs a plumbus.'],
      ],
      comet: [
        ['morty', 'Whoa, Rick, a comet!'],
        ['rick', 'It’s a dirty snowball, Morty. Don’t make a wish.'],
      ],
      deep: [
        ['morty', 'Rick, where are we going? There’s nothing out here.'],
        ['rick', 'That’s the thing about space, Morty. It’s mostly space. Hit the boost.'],
      ],
      trench: [
        ['morty', 'Rick, why are we flying down a trench on the Death Star?'],
        ['rick', 'Because it’s there, Morty. Floor it.'],
      ],
    },
    // the first time you come up on one of deep space's wonders (deep.js)
    wonders: {
      deathstar: [
        ['morty', 'Rick, is that a… moon?'],
        ['rick', 'Wrong universe, Morty. Don’t touch it. That thing’s got lawyers.'],
      ],
      citadel: [
        ['morty', 'The Citadel of Ricks!'],
        ['rick', 'A whole city of me, Morty. Worst place in the multiverse.'],
      ],
      maw: [
        ['morty', 'Rick, why’s the light all bendy?'],
        ['rick', 'Black hole, Morty. Fly in there and you’re spaghetti. Literal spaghetti.'],
      ],
      aurelia: [
        ['morty', 'That planet’s huge, Rick!'],
        ['rick', 'Gas giant, Morty. It’s all hydrogen and disappointment.'],
      ],
      glacia: [['rick', 'Ice giant. Cold, blue and not interested in you, Morty.']],
      ember: [
        ['morty', 'Another sun, Rick!'],
        ['rick', 'There are billions of ’em, Morty. Don’t get attached.'],
      ],
      halcyon: [['rick', 'A blue star, Morty. Burns hot, dies young. Like my first marriage.']],
      veil: [
        ['morty', 'It’s beautiful, Rick.'],
        ['rick', 'It’s a gas cloud, Morty. Stars get born in there. Gross.'],
      ],
      cradle: [['rick', 'Another nebula. Seen one, seen ’em all, Morty.']],
    },
    edge: [['rick', 'Nothing out there but more nothing, Morty. Turning back.']],
    arrive: {
      home: [
        ['morty', 'Whose space station is this, Rick?'],
        ['rick', 'Tilak’s. The guy who built this whole universe, Morty. Show some respect.'],
      ],
      experience: [
        ['rick', 'Six jobs on one station, Morty. AWS, Bose, the works.'],
        ['morty', 'That’s, like, a real career, Rick.'],
      ],
      projects: [
        ['meeseeks', 'I’m Mr. Meeseeks! Look at me!', 'meeseeks'],
        ['morty', 'They’re building stuff in there, Rick!'],
        ['rick', 'A Game Boy emulator, a file system, a shell. Kid’s a tinkerer, Morty. I like him.'],
      ],
      resume: [
        ['rick', 'One page, Morty. A whole career on one page.'],
        ['morty', 'Mine would just say “went on adventures.”'],
      ],
      contact: [
        ['morty', 'A big antenna! Can we call home?'],
        ['rick', 'It’s for messages to Tilak, Morty. Don’t prank call him.'],
      ],
      terminal: [
        ['rick', 'A terminal. Finally, something for grown-ups.'],
        ['morty', 'Rick, what’s sudo?'],
      ],
      starwars: [
        ['morty', 'Rick, is that… is that the Death Star?'],
        ['rick', 'A moon-sized battle station with one exhaust port. Peak Empire engineering, Morty.'],
      ],
      music: [
        ['rick', 'Indian classical music, Morty. Ragas older than most galaxies.'],
        ['morty', 'It’s, uh, it’s actually really relaxing, Rick.'],
      ],
      middleearth: [
        ['morty', 'There’s a volcano with a giant eye over it, Rick!'],
        ['rick', 'Middle-earth. Don’t put on any rings, Morty. I mean it.'],
      ],
      transformers: [
        ['rick', 'Cybertron. A whole planet of cars that are also robots.'],
        ['morty', 'That’s the coolest thing I’ve ever seen, Rick.'],
      ],
      marvel: [
        ['morty', 'Six glowing stones, Rick. That seems important.'],
        ['rick', 'Infinity Stones. Half the universe gone with one snap. Amateurs.'],
      ],
      breakingbad: [
        ['rick', 'Albuquerque, Morty. A chemistry teacher went way off the syllabus down there.'],
        ['morty', 'Maybe we just, uh, keep the windows up.'],
      ],
      office: [
        ['morty', 'A planet made of paper, Rick?'],
        ['rick', 'Scranton. A paper company, Morty. Somehow the most dangerous place on the map.'],
      ],
      rickmorty: [
        ['rick', 'Home sweet dimension, Morty. C-137.'],
        ['morty', 'Can we stop for a bit? I just want one normal day.'],
      ],
      gaming: [
        ['comms', 'Coool.', 'cool'],
        ['morty', 'It’s all blocks, Rick. Like an old Game Boy.'],
        ['rick', 'Somebody wrote a whole Game Boy in code, Morty. Respect.'],
      ],
      travel: [
        ['rick', 'Earth. Somebody’s been all over this one.'],
        ['morty', 'Look at all those routes, Rick!'],
      ],
      caribbean: [
        ['morty', 'Rick, there’s a giant tentacle coming out of that ocean!'],
        ['rick', 'The Caribbean, Morty. Pirates. It’s just crime with better hats.'],
      ],
    },
  },
  {
    id: 'xwing',
    ship: 'An X-wing',
    label: 'Luke and Artoo',
    speakers: {
      luke: { name: 'Luke', color: '#ff9f4a', voice: 'luke' },
      r2: { name: 'R2-D2', color: '#7fb2ff', voice: 'r2' },
    },
    launch: [
      ['luke', 'Red Five, standing by.'],
      ['r2', '[an eager whistle]'],
    ],
    boost: [
      ['luke', 'Hang on, Artoo!'],
      ['r2', '[a delighted whoop]'],
    ],
    bump: [
      ['r2', '[an alarmed shriek]'],
      ['luke', 'I’ve got a bad feeling about this.'],
    ],
    crash: [
      ['r2', '[a long, falling scream]'],
      ['luke', 'We’re okay, Artoo. Get the spare and let’s get back up there.'],
    ],
    traffic: {
      tie: [
        ['luke', 'TIE fighters! Artoo, lock them down!'],
        ['r2', '[an urgent warble]'],
      ],
      interceptor: [
        ['luke', 'Interceptors, coming in fast!'],
        ['r2', '[a frightened whistle]'],
      ],
      xwing: [
        ['comms', 'Red Five, this is Red Leader. Glad you could join us.'],
        ['luke', 'Copy, Red Leader.'],
      ],
      slave1: [
        ['luke', 'That’s Boba Fett’s ship!'],
        ['r2', '[a nervous warble]'],
      ],
    },
    kill: {
      any: [
        ['luke', 'Got him!'],
        ['r2', '[a triumphant whistle]'],
      ],
      xwing: [
        ['comms', 'Red Five, you just shot one of ours!'],
        ['luke', 'Sorry, Red Leader!'],
      ],
      slave1: [
        ['luke', 'Got the bounty hunter!'],
        ['r2', '[a delighted whistle]'],
      ],
      freighter: [
        ['comms', 'Red Five, that was a civilian freighter!'],
        ['luke', 'It came out of nowhere!'],
      ],
      transport: [
        ['comms', 'Red Five! That was one of our transports!'],
        ['r2', '[a horrified shriek]'],
      ],
      tieadvanced: [
        ['luke', 'I hit Vader’s ship! It’s spinning away!'],
        ['r2', '[a triumphant whistle]'],
      ],
    },
    hunted: {
      empire: [
        ['comms', 'Red Five, you’ve got TIEs on your tail!'],
        ['luke', 'I see them! Hang on, Artoo!'],
      ],
      // Vader himself, in his TIE Advanced
      ace: [
        ['luke', 'That TIE… it’s him. It’s Vader!'],
        ['comms', 'No, I am your father.', 'vader'],
      ],
    },
    hit: [
      ['r2', '[an alarmed shriek]'],
      ['luke', 'I’m hit! Artoo, see what you can do!'],
    ],
    shields: [
      ['luke', 'Shields are failing!'],
      ['comms', 'Use the Force, Luke.', 'useTheForce'],
    ],
    destroyed: [
      ['luke', 'I’ve lost her! Artoo!'],
      ['r2', '[a long, falling whistle]'],
    ],
    escaped: [
      ['luke', 'We lost them!'],
      ['r2', '[a relieved whistle]'],
    ],
    cleared: [
      ['luke', 'That’s all of them!'],
      ['comms', 'Great shot, kid. That was one in a million.'],
    ],
    events: {
      destroyer: [
        ['r2', '[a frantic warble]'],
        ['luke', 'Star Destroyer, right on top of us! They’re launching fighters!'],
      ],
      distress: [
        ['comms', 'This is Rebel transport Bright Hope. We’re under attack, requesting assistance!'],
        ['luke', 'Hang on, Bright Hope. Artoo, lock on!'],
      ],
      rescued: [
        ['comms', 'Thank you, Red Five. The Rebellion owes you one.'],
        ['luke', 'May the Force be with you.'],
      ],
      convoy: [
        ['luke', 'A Rebel convoy. Looks like they’re moving out.'],
        ['r2', '[a cheerful beep]'],
      ],
      comet: [
        ['luke', 'A comet! Back on Tatooine you’d see one every few years.'],
        ['r2', '[an unimpressed beep]'],
      ],
      deep: [
        ['luke', 'Nothing but stars out here, Artoo.'],
        ['r2', '[a nervous whistle]'],
      ],
      trench: [
        ['comms', 'Stay on target…'],
        ['luke', 'I’m in the trench! Artoo, watch our backs!'],
        ['r2', '[an alarmed shriek]'],
      ],
    },
    wonders: {
      deathstar: [
        ['comms', 'That’s no moon.'],
        ['luke', 'It’s a space station. I have a bad feeling about this.'],
      ],
      citadel: [
        ['luke', 'A whole city out here, full of… the same old man?'],
        ['r2', '[a confused warble]'],
      ],
      maw: [
        ['luke', 'A black hole. Keep us well clear, Artoo.'],
        ['r2', '[an emphatic beep]'],
      ],
      aurelia: [['luke', 'Look at the size of that planet!']],
      glacia: [['luke', 'Reminds me of Hoth. Let’s not stop.']],
      ember: [['luke', 'Another sun. Almost feels like home.']],
      halcyon: [['luke', 'A blue sun. I’ve never seen one this close.']],
      veil: [
        ['luke', 'A nebula. It’s beautiful, Artoo.'],
        ['r2', '[a soft whistle]'],
      ],
      cradle: [['luke', 'Another nebula. Good place to hide, if we had to.']],
    },
    edge: [['luke', 'Nothing out there, Artoo. Bringing her around.']],
    arrive: {
      home: [
        ['luke', 'That’s his home base. Artoo, say hello.'],
        ['r2', '[a cheerful greeting]'],
      ],
      experience: [
        ['luke', 'Six missions logged. That’s a real flight record.'],
        ['r2', '[an impressed whistle]'],
      ],
      projects: [
        ['luke', 'A workshop! Artoo, you’d love it in there.'],
        ['r2', '[an excited spin of beeps]'],
      ],
      resume: [
        ['luke', 'His service record. One page, every word of it true.'],
        ['r2', '[a data-transfer chirp]'],
      ],
      contact: [
        ['luke', 'A relay station. We can get a message to him from here.'],
        ['r2', '[a hopeful bleep]'],
      ],
      terminal: [
        ['luke', 'Artoo, plug in. See what you can find.'],
        ['r2', '[a smug, triumphant trill]'],
      ],
      starwars: [
        ['luke', 'The Death Star. Stay on target, Artoo.'],
        ['r2', '[a worried warble]'],
      ],
      music: [
        ['luke', 'Artoo, are you picking up that music?'],
        ['r2', '[hums along, slightly off key]'],
      ],
      middleearth: [
        ['luke', 'A dark tower and a burning eye. Reminds me of someone.'],
        ['r2', '[a low, nervous beep]'],
      ],
      transformers: [
        ['luke', 'A whole planet of droids, Artoo.'],
        ['r2', '[an excited squeal]'],
      ],
      marvel: [
        ['luke', 'Those stones feel like the Force, only louder.'],
        ['r2', '[a cautious whistle]'],
      ],
      breakingbad: [
        ['luke', 'More desert. It looks just like Tatooine.'],
        ['r2', '[a grumpy razz]'],
      ],
      office: [
        ['luke', 'Paper? Who still uses paper?'],
        ['r2', '[a sarcastic blip]'],
      ],
      rickmorty: [
        ['luke', 'That portal isn’t on any of our charts.'],
        ['r2', '[a frantic stream of beeps]'],
      ],
      gaming: [
        ['luke', 'Look, Artoo. A droid made of blocks.'],
        ['r2', '[an 8-bit chirp]'],
      ],
      travel: [
        ['luke', 'So much blue. Nothing like home.'],
        ['r2', '[a happy trill]'],
      ],
      caribbean: [
        ['luke', 'A whole world of water, and one black ship on it.'],
        ['r2', '[a wary, bubbling whistle]'],
      ],
    },
  },
  {
    id: 'falcon',
    ship: 'The Millennium Falcon',
    label: 'Han and Chewie',
    speakers: {
      han: { name: 'Han', color: '#e8d3b0', voice: 'han' },
      chewie: { name: 'Chewbacca', color: '#d0965a', voice: 'chewie' },
    },
    launch: [
      ['han', 'Chewie, we’re home.'],
      ['chewie', '[a happy roar]'],
    ],
    boost: [
      ['han', 'Punch it, Chewie!'],
      ['chewie', '[roars]'],
    ],
    bump: [
      ['han', 'It’s not my fault!'],
      ['chewie', '[a furious roar]'],
    ],
    crash: [
      ['chewie', '[a horrified roar]'],
      ['han', 'Hold together, baby. Hold together!'],
    ],
    traffic: {
      tie: [
        ['han', 'Here they come!'],
        ['chewie', '[a roar]'],
      ],
      interceptor: [
        ['han', 'Interceptors. Chewie, get on the guns.'],
        ['chewie', '[an eager growl]'],
      ],
      xwing: [
        ['han', 'Rebels. They’re friendly, Chewie. Don’t shoot.'],
        ['chewie', '[a grumble]'],
      ],
      slave1: [
        ['han', 'Boba Fett? Boba Fett?! Where?'],
        ['chewie', '[an alarmed roar]'],
      ],
    },
    kill: {
      any: [
        ['han', 'Great, kid! Don’t get cocky.'],
        ['chewie', '[a happy roar]'],
      ],
      xwing: [
        ['han', 'That was one of ours!'],
        ['chewie', '[an angry roar]'],
      ],
      slave1: [
        ['han', 'So long, Fett. No bounty today.'],
        ['chewie', '[a triumphant roar]'],
      ],
      freighter: [
        ['han', 'Hey, that guy was a smuggler like us!'],
        ['chewie', '[a scolding roar]'],
      ],
      transport: [
        ['comms', 'Falcon! That was a Rebel transport!'],
        ['han', 'My hand slipped!'],
      ],
      tieadvanced: [
        ['han', 'Ha! Vader’s spinning off into space!'],
        ['chewie', '[a delighted roar]'],
      ],
    },
    hunted: {
      empire: [
        ['han', 'Imperials on our tail. Chewie, get us some speed!'],
        ['chewie', '[a worried roar]'],
      ],
      ace: [
        ['han', 'That’s Vader’s TIE. Great. Just great.'],
        ['comms', 'No, I am your father.', 'vader'],
      ],
    },
    hit: [
      ['han', 'We’re taking hits!'],
      ['chewie', '[an angry roar]'],
    ],
    shields: [
      ['han', 'Shields are going! Chewie, angle the deflector!'],
      ['chewie', '[a frantic roar]'],
    ],
    destroyed: [
      ['han', 'Chewie, punch it!'],
      ['chewie', '[a mournful howl]'],
    ],
    escaped: [
      ['han', 'Ha! Never tell me the odds.'],
      ['chewie', '[a happy roar]'],
    ],
    cleared: [
      ['han', 'That’s the last of them. Not bad for a hunk of junk.'],
      ['chewie', '[a triumphant roar]'],
    ],
    events: {
      destroyer: [
        ['han', 'Star Destroyer! Why is it always a Star Destroyer?'],
        ['chewie', '[an alarmed roar]'],
      ],
      distress: [
        ['comms', 'Mayday! Imperial fighters, we can’t shake them!'],
        ['han', 'Not our problem.'],
        ['chewie', '[an insistent growl]'],
        ['han', 'Fine, fine. Let’s go be heroes.'],
      ],
      rescued: [
        ['comms', 'Thanks, Falcon! We owe you one.'],
        ['han', 'Yeah. Pay up in credits.'],
      ],
      convoy: [
        ['han', 'A convoy. Bet there’s good cargo in those holds.'],
        ['chewie', '[a disapproving growl]'],
        ['han', 'I’m just saying.'],
      ],
      comet: [['han', 'A comet. Don’t get any ideas, Chewie. We’re not chasing it.']],
      deep: [
        ['han', 'Out here it’s just us and the stars, pal.'],
        ['chewie', '[a contented growl]'],
      ],
      trench: [
        ['han', 'The trench? Chewie, we’re not an X-wing!'],
        ['chewie', '[a worried roar]'],
      ],
    },
    wonders: {
      deathstar: [
        ['han', 'That’s no moon. That’s trouble.'],
        ['chewie', '[a worried roar]'],
      ],
      citadel: [['han', 'A station full of the same crazy old guy. I’ve seen worse cantinas.']],
      maw: [['han', 'Black hole. Even the Falcon can’t outrun that.']],
      aurelia: [['han', 'Big planet. Probably full of smugglers.']],
      glacia: [['han', 'I’ve had enough ice planets for one lifetime.']],
      ember: [['han', 'Another sun. Same old galaxy.']],
      halcyon: [['han', 'Blue star. Pretty. Don’t fly into it, Chewie.']],
      veil: [
        ['han', 'A nebula. Good place to lose the Empire.'],
        ['chewie', '[an agreeing growl]'],
      ],
      cradle: [['han', 'More nebula. The Kessel Run had more of these.']],
    },
    edge: [['han', 'Nothing out there but rocks. Turning around.']],
    arrive: {
      home: [
        ['han', 'Nice place. Not as nice as the Falcon.'],
        ['chewie', '[a polite growl]'],
      ],
      experience: [
        ['han', 'AWS, RTX, Bose. Kid’s had more jobs than I’ve had bounties.'],
        ['chewie', '[laughs]'],
      ],
      projects: [
        ['han', 'A Game Boy emulator? Chewie, we’re keeping that.'],
        ['chewie', '[a pleased rumble]'],
      ],
      resume: [
        ['han', 'One page? Mine would need a lawyer.'],
        ['chewie', '[agrees]'],
      ],
      contact: [
        ['han', 'Send him a message. Keep it short, nobody reads the long ones.'],
        ['chewie', '[a short, polite roar]'],
      ],
      terminal: [
        ['han', 'A terminal. Chewie, you’re the one who reads the manuals.'],
        ['chewie', '[an offended growl]'],
      ],
      starwars: [
        ['han', 'The Death Star. I’m not going in there. Again.'],
        ['chewie', '[a long groan]'],
      ],
      music: [
        ['han', 'Nice tune. Chewie, are you crying?'],
        ['chewie', '[sniffs, then roars]'],
      ],
      middleearth: [
        ['han', 'Giant eye, big volcano. Hard pass.'],
        ['chewie', '[agrees, loudly]'],
      ],
      transformers: [
        ['han', 'Robots that turn into cars? Don’t give the Falcon ideas.'],
        ['chewie', '[laughs]'],
      ],
      marvel: [
        ['han', 'Six stones. Bet I could sell those.'],
        ['chewie', '[a warning growl]'],
      ],
      breakingbad: [
        ['han', 'Albuquerque. My kind of town. Nobody asks questions.'],
        ['chewie', '[a suspicious huff]'],
      ],
      office: [
        ['han', 'Paper and coffee mugs. Looks like Imperial paperwork.'],
        ['chewie', '[a bored yawn]'],
      ],
      rickmorty: [
        ['han', 'Never trust a portal you didn’t open yourself.'],
        ['chewie', '[a nervous whine]'],
      ],
      gaming: [
        ['han', 'Blocks? Chewie, did you build this?'],
        ['chewie', '[a proud roar]'],
      ],
      travel: [
        ['han', 'Everybody’s been everywhere on this one.'],
        ['chewie', '[a contented rumble]'],
      ],
      caribbean: [
        ['han', 'Pirates. Finally, some honest people.'],
        ['chewie', '[an approving growl]'],
      ],
    },
  },
];

const BY_ID = new Map(CREWS.map((c) => [c.id, c]));

export const crewById = (id) => BY_ID.get(id) ?? null;

// A remembered or linked ship id, or null for anything else.
export const parseShip = (id) => (typeof id === 'string' && BY_ID.has(id) ? id : null);

// What the crew says when something happens: 'launch', 'boost', 'bump',
// 'edge', 'crash', 'idle', 'hit', 'shields', 'destroyed', 'escaped' or
// 'cleared' (where a crew has those), 'arrive' at a place, 'traffic' going
// past (by kind), a 'kill' (by kind, or any), 'hunted' (by who: the
// faction, or 'ace'), an 'event' (by the director's id) or a 'wonder' (by
// its id). An exchange, or null.
export function linesFor(crew, event, id) {
  if (!crew) return null;
  if (event === 'arrive') return crew.arrive[id] ?? null;
  if (event === 'traffic') return crew.traffic?.[id] ?? null;
  if (event === 'kill') return crew.kill?.[id] ?? crew.kill?.any ?? null;
  if (event === 'hunted') return crew.hunted?.[id] ?? null;
  if (event === 'event') return crew.events?.[id] ?? null;
  if (event === 'wonder') return crew.wonders?.[id] ?? null;
  return crew[event] ?? null;
}
