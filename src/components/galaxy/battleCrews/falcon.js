// Han and Chewie’s lines in the galaxy's wars' battles (battleLines.js says
// how they're picked, by the side you swore to's stance, the war and the
// place, and how their blanks are filled).

export default {
  battle: {
    ask: {
      any: [
        [
          "han",
          "Two fleets, one Falcon, and nobody’s paid us yet. So whose side are we on?",
        ],
        ["chewie", "[an impatient roar: pick one, and hurry]"],
        [
          "han",
          "What he said. Swear on the holotable or the panel. I like to know who I’m shooting at.",
        ],
      ],
    },
    front: {
      light: [
        [
          "han",
          "They’re fighting over {place}, and {us} need a fast ship. Lucky them, we’ve got the fastest.",
        ],
        ["chewie", "[a pointed roar: and a Wookiee]"],
      ],
      dark: [
        [
          "han",
          "Battle at {place}. The credits from {us} cleared, so today they’re the good guys.",
        ],
        ["chewie", "[a long, disapproving growl]"],
        ["han", "Don’t look at me like that. You like eating too."],
      ],
      hutt: [
        [
          "han",
          "Hutts at {place}. They never fight their own battles. They hire guys like me.",
        ],
        ["chewie", "[a knowing rumble: guys exactly like him]"],
      ],
    },
    join: {
      light: [
        ["han", "Here’s where the fun begins."],
        ["chewie", "[a roar, and the quad cannons open up]"],
      ],
      dark: [
        [
          "han",
          "Right into the thick of it. Danger money, Chewie. I’m charging {us} double.",
        ],
        ["chewie", "[a disbelieving grunt: he’ll never collect]"],
      ],
    },
    gens: {
      light: [
        [
          "han",
          "Shield generators are down! Tell me those were theirs, Chewie.",
        ],
        ["chewie", "[an unhelpful shrug of a growl]"],
      ],
      dark: [
        [
          "han",
          "Somebody’s shield generators just blew. Whoever they belonged to, my rates just went up.",
        ],
        ["chewie", "[an exasperated roar]"],
      ],
    },
    bridge: {
      light: [
        [
          "han",
          "There goes a bridge! Whoever was giving orders on that ship isn’t any more.",
        ],
        ["chewie", "[a grim roar: keep flying]"],
      ],
      dark: [
        [
          "han",
          "Scratch one bridge. If that was whoever’s paying us, Chewie, we’re working for free now.",
        ],
        ["chewie", "[a long-suffering groan]"],
      ],
    },
    reactor: {
      light: [
        [
          "han",
          "That reactor’s going critical! Punch it, Chewie, before it takes us with it!",
        ],
        ["chewie", "[a frantic roar, already punching it]"],
      ],
      dark: [
        [
          "han",
          "Reactor’s going! Whoever’s ship that is, I’m not insured for it. Get us clear!",
        ],
        ["chewie", "[a roar: he’s never been insured for anything]"],
      ],
    },
    won: {
      light: [
        ["han", "That’s {place} for {us}. Don’t everybody thank me at once."],
        ["chewie", "[a victory roar that rattles the cockpit]"],
      ],
      dark: [
        ["han", "We won. Well, {us} won. We just got paid."],
        ["chewie", "[a grumble: he isn’t spending his share]"],
      ],
      hutt: [
        [
          "han",
          "Look at {them} run! Somebody tell Jabba. Actually, let me tell Jabba.",
        ],
        ["chewie", "[a delighted roar: he wants to see Jabba’s face]"],
      ],
    },
    lost: {
      light: [
        [
          "han",
          "We’re beaten at {place}. Pull back, Chewie, and before you say it: it’s not my fault!",
        ],
        ["chewie", "[a long, mournful howl]"],
      ],
      dark: [
        [
          "han",
          "So {us} lost. Tell me their credits cleared before they cleared out, Chewie.",
        ],
        ["chewie", "[a dry, unsympathetic rumble]"],
      ],
      hutt: [
        [
          "han",
          "Beaten by {them}. Jabba’s gonna hang this one on his wall. Right next to me.",
        ],
        ["chewie", "[an embarrassed groan]"],
      ],
    },
    turncoat: {
      light: [
        [
          "han",
          "Flying for {us} now? Fine. I came back at Yavin too, and nobody’s let me forget it.",
        ],
        ["chewie", "[a glad roar: about time]"],
      ],
      dark: [
        [
          "han",
          "Switching to {us}. Their money’s better. Their manners aren’t.",
        ],
        ["chewie", "[a furious roar, and a long list of objections]"],
        ["han", "Noted. Now strap in."],
      ],
    },
    ace: {
      light: [
        [
          "han",
          "That was their ace! Best they had, and the Falcon flew rings round them.",
        ],
        ["chewie", "[a roar: don’t get cocky]"],
        ["han", "Who, me?"],
      ],
      dark: [
        [
          "han",
          "Got their best pilot. Nothing personal. Well, a bit personal. They shot first.",
        ],
        ["chewie", "[a doubtful grumble: did they, though?]"],
      ],
    },
    escort: {
      light: [
        [
          "han",
          "Company from {us}, on our wing. Stay out of my way and we’ll get along fine.",
        ],
        ["chewie", "[a pleased rumble: company at last]"],
      ],
      dark: [
        [
          "han",
          "Escort from {us}. Either they like us, or they’re making sure we don’t run off with the money.",
        ],
        ["chewie", "[a suspicious growl: it’s the second one]"],
      ],
    },
    deserter: {
      light: [
        [
          "han",
          "We walked out on {them}, and this is their space. Nobody make any sudden moves.",
        ],
        ["chewie", "[an anxious whine: they’ve got long memories]"],
      ],
      dark: [
        [
          "han",
          "We ditched {them} for a better offer, and now we’re in their space. Fly casual, Chewie.",
        ],
        ["chewie", "[a guilty rumble: he knows some of these pilots]"],
      ],
    },
    intercept: {
      light: [
        ["han", "Got it! Whatever they were bringing, it isn’t getting there."],
        ["chewie", "[a satisfied roar]"],
      ],
      dark: [
        [
          "han",
          "Down it goes. One less for {them}, and one more line on my invoice.",
        ],
        ["chewie", "[an unimpressed grunt]"],
      ],
    },
    runners: {
      light: [
        [
          "han",
          "There go the runners. Somebody’s making a break for it, and I know just how they feel.",
        ],
        ["chewie", "[a fond rumble: they’ve run a few blockades themselves]"],
      ],
      dark: [
        [
          "han",
          "Runners, going for broke. Used to be me in there. Pays better out here.",
        ],
        ["chewie", "[a wistful growl]"],
      ],
    },
    gate: {
      light: [
        [
          "han",
          "The shield’s fallen! Door’s open, Chewie. Let’s hope we’re the ones walking through it.",
        ],
        ["chewie", "[an uncertain rumble]"],
      ],
      dark: [
        [
          "han",
          "Shield’s gone. Somebody’s getting a visit. I charge extra for house calls.",
        ],
        ["chewie", "[a groan at the joke]"],
      ],
    },
    interdictor: {
      light: [
        [
          "han",
          "Interdictor’s got its wells up. Nobody’s jumping out of here. Including us.",
        ],
        ["chewie", "[an outraged roar at the hyperdrive]"],
        ["han", "It’s not her fault this time."],
      ],
      dark: [
        [
          "han",
          "Gravity wells. Whoever owns that Interdictor, it’s got us stuck here too. I’m billing by the hour.",
        ],
        ["chewie", "[a trapped, unhappy growl]"],
      ],
    },
    blockade: {
      light: [
        [
          "han",
          "A blockade. I made the Kessel Run in less than twelve parsecs, Chewie. This is nothing.",
        ],
        ["chewie", "[a sceptical grumble about parsecs]"],
      ],
      dark: [
        [
          "han",
          "Blockades. I’ve run a hundred of them, and never got paid this well to be near one.",
        ],
        ["chewie", "[a rumble: money isn’t everything]"],
      ],
    },
  },
  battleWar: {
    clone: {
      front: {
        light: [
          [
            "han",
            "The Republic against the Separatists at {place}. Clones on our side. Feels weird, Chewie.",
          ],
          ["chewie", "[an approving roar: he fought beside them on Kashyyyk]"],
          ["han", "Yeah, yeah. Just don’t tell them what they turn into."],
        ],
        dark: [
          [
            "han",
            "Flying for the Separatists against the Republic. Droids don’t tip, but Count Dooku pays up front.",
          ],
          ["chewie", "[a savage roar: those droids invaded Kashyyyk]"],
          ["han", "I know, pal. One job. Then we go back to hating them."],
        ],
      },
      won: {
        light: [
          [
            "han",
            "The Republic holds {place}! Somebody tell the droids. Roger, roger.",
          ],
          ["chewie", "[a roar of laughter]"],
        ],
        dark: [
          [
            "han",
            "The Separatists have {place}. The clankers won, Chewie. I want paying in credits, not droids.",
          ],
          ["chewie", "[a disgusted growl]"],
        ],
      },
    },
    gcw: {
      front: {
        light: [
          [
            "han",
            "The Rebellion against the Empire at {place}. I ain’t in this for your revolution. Who am I kidding?",
          ],
          ["chewie", "[a teasing roar: he’s in it for the princess]"],
        ],
        dark: [
          [
            "han",
            "Working for the Empire against the Rebellion. They threw me out of their Academy for having a mind of my own.",
          ],
          ["chewie", "[a thunderous roar: the Empire put Wookiees in chains]"],
          ["han", "We take their money, pal. That’s all we take."],
        ],
      },
      won: {
        light: [
          [
            "han",
            "The Empire’s running and the Rebellion has {place}. Somebody owes me another medal.",
          ],
          ["chewie", "[a meaningful roar: he’s still waiting for his first]"],
        ],
        dark: [
          [
            "han",
            "The Empire has {place}. Get the money, Chewie, and let’s not stay for the parade.",
          ],
          ["chewie", "[a growl: he wants no part of any parade]"],
        ],
      },
    },
    remnant: {
      front: {
        light: [
          [
            "han",
            "The New Republic against what’s left of the Empire at {place}. I thought we finished this at Endor.",
          ],
          ["chewie", "[a weary groan: they never stay finished]"],
        ],
        dark: [
          [
            "han",
            "On the Imperial Remnant’s payroll against the New Republic. Leia’s gonna kill me. Then she’ll make a speech.",
          ],
          ["chewie", "[a horrified roar: he isn’t the one telling her]"],
        ],
      },
      won: {
        light: [
          [
            "han",
            "The New Republic holds {place}. Leia’ll want a report. I’ll say I was brilliant.",
          ],
          ["chewie", "[a snort: he’ll tell her what really happened]"],
        ],
        dark: [
          [
            "han",
            "The Remnant has {place}. Same old Empire, same bad uniforms, same good money.",
          ],
          ["chewie", "[a sour moan: the money isn’t that good]"],
        ],
      },
    },
  },
  battleAt: {
    endor: {
      war: "gcw",
      front: {
        light: [
          [
            "han",
            "Endor. Last time I lent Lando the Falcon for this, and he swore not a scratch.",
          ],
          ["chewie", "[a reproachful growl: she came back without her dish]"],
        ],
        dark: [
          [
            "han",
            "Endor, for the Empire. Under a Death Star, next to the Executor. What could go wrong?",
          ],
          ["chewie", "[an alarmed roar: everything, he’s seen how this ends]"],
        ],
      },
      won: {
        light: [
          [
            "han",
            "Endor’s the Rebellion’s. The Ewoks’ll throw a party. I’m staying up here, thanks.",
          ],
          ["chewie", "[a happy roar: he’s going down for the party]"],
        ],
        dark: [
          [
            "han",
            "The Empire holds Endor. Didn’t go that way last time. Somebody’s rewriting history.",
          ],
          ["chewie", "[an uneasy growl: the Ewoks won’t like it]"],
        ],
      },
    },
    hoth: {
      war: "gcw",
      front: {
        light: [
          [
            "han",
            "Hoth. Death Squadron’s over Echo Base, and the transports need a way out. I know the drill.",
          ],
          [
            "chewie",
            "[a worried growl: last time, the hyperdrive didn’t work]",
          ],
        ],
        dark: [
          [
            "han",
            "Hoth, for the Empire. Vader’s up there on the Executor. I’d rather be inside a tauntaun.",
          ],
          ["chewie", "[a heartfelt roar: so would he]"],
        ],
      },
      won: {
        light: [
          [
            "han",
            "The Rebellion wins at Hoth. Better than last time: nobody’s flying into an asteroid field.",
          ],
          ["chewie", "[a relieved roar]"],
        ],
        dark: [
          [
            "han",
            "Hoth’s the Empire’s, like last time, except this time I’m on the payroll.",
          ],
          ["chewie", "[a low howl for Echo Base]"],
        ],
      },
    },
    scarif: {
      war: "gcw",
      front: {
        light: [
          [
            "han",
            "Scarif. One gate, one shield, and the plans to a Death Star down there. No pressure.",
          ],
          [
            "chewie",
            "[a grim growl: nobody came back from the beach last time]",
          ],
        ],
        dark: [
          [
            "han",
            "Scarif, guarding the Empire’s filing cabinet. Easy money. Nobody breaks in here.",
          ],
          ["chewie", "[a wary rumble: somebody always does]"],
        ],
      },
      won: {
        light: [
          [
            "han",
            "Scarif’s the Rebellion’s, and the plans are out. Somebody tell the kid about that exhaust port.",
          ],
          ["chewie", "[an exultant roar]"],
        ],
        dark: [
          [
            "han",
            "The Empire wins at Scarif, and the gate stays shut. No plans, no exhaust port. Good luck, kid.",
          ],
          ["chewie", "[an unhappy growl]"],
        ],
      },
    },
    yavin: {
      war: "gcw",
      front: {
        light: [
          [
            "han",
            "Yavin. The Death Star’s coming round the planet, and this time I’m here from the start.",
          ],
          [
            "chewie",
            "[a gruff roar: no running off with the reward this time]",
          ],
        ],
        dark: [
          [
            "han",
            "Yavin, for the Empire. Last time here, I sent Vader spinning off into space. He remembers.",
          ],
          ["chewie", "[a worried rumble: Vader never forgets]"],
        ],
      },
      won: {
        light: [
          [
            "han",
            "Great shot, kid! That was one in a million! The Rebellion has Yavin.",
          ],
          ["chewie", "[a jubilant roar]"],
        ],
        dark: [
          [
            "han",
            "Yavin’s the Empire’s. The kid’s gonna be mad. I’ll tell him I was only here for the reward.",
          ],
          ["chewie", "[a disappointed groan]"],
        ],
      },
    },
    bespin: {
      war: "gcw",
      front: {
        light: [
          [
            "han",
            "Bespin. A blockade over Cloud City. I owe Lando a punch, but I guess this’ll do.",
          ],
          ["chewie", "[a growl: he’d settle for throttling Lando again]"],
        ],
        dark: [
          [
            "han",
            "Bespin, for the Empire. Last time I was their guest here, they froze me in carbonite.",
          ],
          ["chewie", "[an incredulous roar: and now he’s working for them?]"],
        ],
      },
      won: {
        light: [
          [
            "han",
            "The Empire’s cleared off Bespin. Lando’s gonna say he planned the whole thing.",
          ],
          ["chewie", "[a rude grunt: he didn’t]"],
        ],
        dark: [
          [
            "han",
            "The Empire’s got Bespin. Somebody check that the carbon-freezing chamber’s switched off. Just in case.",
          ],
          ["chewie", "[a nervous whine: he’ll check it twice]"],
        ],
      },
    },
    coruscant: {
      war: "clone",
      front: {
        light: [
          [
            "han",
            "Coruscant, and the Separatists have grabbed the Chancellor. Do we really have to rescue that guy?",
          ],
          [
            "chewie",
            "[a doubtful growl: he’s got a bad feeling about the Chancellor]",
          ],
        ],
        dark: [
          [
            "han",
            "Hitting Coruscant for the Separatists. Grievous wants the Chancellor. I wouldn’t. He’s trouble.",
          ],
          ["chewie", "[a rumble of agreement: big trouble]"],
        ],
      },
      won: {
        light: [
          [
            "han",
            "Coruscant’s the Republic’s, and the Chancellor’s safe. Why does that make me nervous?",
          ],
          ["chewie", "[a troubled rumble]"],
        ],
        dark: [
          [
            "han",
            "The Separatists win at Coruscant. Nobody saw that coming. Well, maybe the Chancellor did.",
          ],
          ["chewie", "[a suspicious rumble]"],
        ],
      },
    },
    naboo: {
      war: "clone",
      front: {
        light: [
          [
            "han",
            "Naboo, and the Trade Federation’s parked its doughnuts round it again. Some people never learn.",
          ],
          ["chewie", "[an amused rumble]"],
        ],
        dark: [
          [
            "han",
            "Naboo, for the Separatists. Didn’t this go badly for the Trade Federation last time?",
          ],
          ["chewie", "[a roar: a little boy in a fighter blew up their ship]"],
        ],
      },
      won: {
        light: [
          [
            "han",
            "The Republic has Naboo. Nice lakes, weird politicians, and no droids. Good day.",
          ],
          ["chewie", "[a contented grunt]"],
        ],
        dark: [
          [
            "han",
            "Naboo’s the Separatists’. The Trade Federation finally won one. Don’t tell the Gungans.",
          ],
          ["chewie", "[a growl: he’s telling the Gungans]"],
        ],
      },
    },
    lothal: {
      war: "remnant",
      front: {
        light: [
          [
            "han",
            "Lothal, and Thrawn’s back on the Chimaera. Hera’s Ghost is up there for the New Republic. I’m in.",
          ],
          ["chewie", "[an eager roar: he’s always wanted to see her fly]"],
        ],
        dark: [
          [
            "han",
            "Lothal, for the Remnant, under Thrawn. Last time he was here, space whales took his ship. Whales!",
          ],
          ["chewie", "[a jittery growl: keep an eye out for whales]"],
        ],
      },
      won: {
        light: [
          [
            "han",
            "Thrawn’s gone again, and the New Republic holds Lothal. Hope the whales take him further this time.",
          ],
          ["chewie", "[a howl of laughter]"],
        ],
        dark: [
          [
            "han",
            "Lothal’s the Remnant’s. Thrawn wins. Never trust a guy with glowing red eyes, Chewie.",
          ],
          ["chewie", "[an ashamed growl]"],
        ],
      },
    },
  },
};
