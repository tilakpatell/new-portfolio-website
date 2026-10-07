// Luke and Artoo’s lines in the galaxy's wars' battles (battleLines.js says
// how they're picked, by the side you swore to's stance, the war and the
// place, and how their blanks are filled).

export default {
  battle: {
    ask: {
      any: [
        [
          "luke",
          "There’s a battle out there, and we’re nobody’s. Which side are we flying for?",
        ],
        [
          "r2",
          "[an insistent beep: swear us to one on the holotable or the panel, and quickly]",
        ],
      ],
    },
    front: {
      light: [
        [
          "r2",
          "[a sharp run of beeps: the fleets are engaged over {place}, capital ships on both sides]",
        ],
        ["luke", "It’s {us} against {them}, Artoo. Let’s get in there."],
      ],
      dark: [
        [
          "r2",
          "[a flat, dutiful beep: battle over {place}, and he notes for the record whose side we are on]",
        ],
        [
          "luke",
          "I know, Artoo. We’re with {us} today. Let’s just get this over with.",
        ],
      ],
      hutt: [
        [
          "r2",
          "[a sour beep: Hutt gunships. He served drinks on a Hutt’s sail barge once, and never again]",
        ],
        [
          "luke",
          "The last Hutt I met fed me to a rancor. Let’s not get boarded, Artoo.",
        ],
      ],
    },
    join: {
      light: [
        [
          "luke",
          "Red Five, joining up with {us}. Lock S-foils in attack position.",
        ],
        ["r2", "[an eager whistle]"],
      ],
      dark: [
        ["luke", "Joining up. Artoo, what’s our callsign with {us}?"],
        ["r2", "[a sulky beep: he refuses to say it]"],
      ],
    },
    gens: {
      light: [
        [
          "r2",
          "[a quick, excited warble: a flagship’s shield generators are down, its hull bare]",
        ],
        [
          "luke",
          "Her shields are gone! If she’s theirs, we go for the bridge. If she’s ours, we cover her.",
        ],
      ],
      dark: [
        [
          "luke",
          "That flagship’s lost its shields. I can’t even tell which way I’m hoping, Artoo.",
        ],
        ["r2", "[a pointed beep: he can]"],
      ],
    },
    bridge: {
      light: [
        ["luke", "The bridge is gone! That flagship’s flying itself now."],
        ["r2", "[a worried warble: flying itself at somebody]"],
      ],
      dark: [
        [
          "luke",
          "A bridge just went up. There were people on that bridge, Artoo.",
        ],
        ["r2", "[a quiet, accusing beep: he had noticed]"],
      ],
    },
    reactor: {
      light: [
        [
          "luke",
          "Her reactor’s going! Artoo, all power to the engines before she blows!",
        ],
        ["r2", "[a frantic whistle: the engines have it]"],
      ],
      dark: [
        [
          "r2",
          "[a rising alarm: a reactor is going critical, and he would like to leave]",
        ],
        ["luke", "So would I, Artoo. This battle, this side, all of it."],
      ],
    },
    won: {
      light: [
        ["luke", "We did it! That’s {place} for {us}, Artoo."],
        ["r2", "[a happy trill]"],
      ],
      dark: [
        [
          "luke",
          "We won. Whatever happens to {place} under {us} is on us now, Artoo.",
        ],
        ["r2", "[a low, accusing whistle]"],
      ],
      hutt: [
        [
          "luke",
          "We beat the Hutts at {place}! Jabba would have hated this, Artoo.",
        ],
        [
          "r2",
          "[a satisfied beep: he once delivered a message to a Hutt, and likes this one better]",
        ],
      ],
    },
    lost: {
      light: [
        ["r2", "[a low, falling tone: the fleet is pulling out]"],
        ["luke", "We’ll be back for {place}. We always come back."],
      ],
      dark: [
        ["r2", "[a cheerful little trill, quickly stifled]"],
        ["luke", "Artoo! We lost. You could at least pretend to be sorry."],
      ],
      hutt: [
        ["r2", "[a sour whistle: that leaves {place} with the Hutts]"],
        [
          "luke",
          "Nobody should have to live under a Hutt. I’ve seen what Jabba hung on his walls, Artoo.",
        ],
      ],
    },
    turncoat: {
      light: [
        [
          "luke",
          "We’re flying for {us} now. I should never have flown for {them}, Artoo.",
        ],
        ["r2", "[a relieved whistle: welcome back]"],
      ],
      dark: [
        ["r2", "[a long, disbelieving whistle]"],
        [
          "luke",
          "I know how it looks, Artoo. We fly for {us} now. Please don’t tell Leia.",
        ],
        ["r2", "[a scandalised shriek: he is telling Leia, and everyone else]"],
      ],
    },
    ace: {
      light: [
        ["luke", "Their ace is down! That’ll rattle {them}, Artoo."],
        ["r2", "[a triumphant whistle: one in a million]"],
      ],
      dark: [
        ["luke", "I got their ace. I really hope they punched out, Artoo."],
        ["r2", "[a cold, reproachful beep: he knows exactly who that was]"],
      ],
    },
    escort: {
      light: [
        ["r2", "[a happy whistle: friendly fighters on our wing]"],
        ["luke", "A whole squadron from {us}! Now it’s a fight, Artoo."],
      ],
      dark: [
        [
          "luke",
          "Fighters from {us}, forming up on our wing. Funny, I don’t feel any safer.",
        ],
        ["r2", "[a muttered beep: neither does he]"],
      ],
    },
    deserter: {
      light: [
        [
          "r2",
          "[an urgent warble: this space is held by {them}, and they remember us]",
        ],
        [
          "luke",
          "They know we walked out on them. Good. I’d do it again, Artoo.",
        ],
      ],
      dark: [
        ["luke", "We’re in space held by {them}, Artoo. They’ll know my ship."],
        ["r2", "[a reproachful beep: they’ll know why we left, too]"],
      ],
    },
    intercept: {
      light: [
        ["luke", "Got it! That one’s not getting through."],
        ["r2", "[a smug whistle]"],
      ],
      dark: [
        [
          "luke",
          "Got it. I hope that was a bomber, Artoo, and not somebody’s way out.",
        ],
        ["r2", "[a disapproving whistle: he was rooting for that one]"],
      ],
    },
    runners: {
      light: [
        ["r2", "[an alert warble: runners, breaking through the lines]"],
        ["luke", "There they go! Cover ours, stop theirs. Simple, Artoo."],
        ["r2", "[a sceptical beep: it never is]"],
      ],
      dark: [
        [
          "luke",
          "Runners, making their break. If they’re ours, we cover them. If they’re not… we’ll see.",
        ],
        ["r2", "[a hopeful trill: he knows which ones he is rooting for]"],
      ],
    },
    gate: {
      light: [
        [
          "r2",
          "[a startled whistle: the shield is down, and the way to the planet is open]",
        ],
        [
          "luke",
          "The shield’s gone! Whoever holds {place} now, it’s wide open, Artoo.",
        ],
      ],
      dark: [
        [
          "luke",
          "The shield’s down. There’s nothing between {place} and the guns now.",
        ],
        ["r2", "[a worried warble for whoever is down there]"],
      ],
    },
    interdictor: {
      light: [
        [
          "luke",
          "An Interdictor! Its gravity wells have everyone pinned. Nobody’s jumping out of this one.",
        ],
        ["r2", "[a nervous whistle: including us]"],
      ],
      dark: [
        [
          "r2",
          "[a jittery beep: gravity wells, nobody can jump out, and he has checked twice]",
        ],
        [
          "luke",
          "I know, Artoo. We couldn’t leave even if we wanted to. And I want to.",
        ],
      ],
    },
    blockade: {
      light: [
        [
          "luke",
          "Somebody’s running a blockade. Artoo, have you ever done this?",
        ],
        [
          "r2",
          "[a proud whistle: once, on a Naboo royal starship, and the Queen herself thanked him]",
        ],
      ],
      dark: [
        [
          "luke",
          "A blockade. Whoever’s running it, Artoo, I hope they make it. Even if they’re not ours.",
        ],
        ["r2", "[a sharp beep: especially if they’re not ours]"],
      ],
    },
  },
  battleWar: {
    clone: {
      front: {
        light: [
          [
            "luke",
            "The Clone Wars, Artoo. The Republic against the Separatists. Father flew in this war.",
          ],
          ["r2", "[a fond, knowing whistle: right beside him]"],
        ],
        dark: [
          [
            "r2",
            "[an outraged shriek: he spent the whole Clone Wars fighting these droids]",
          ],
          [
            "luke",
            "I know, Artoo. Flying for the Separatists isn’t what Father would have done.",
          ],
          ["r2", "[a cagey beep: Father did worse, later]"],
        ],
      },
      won: {
        light: [
          [
            "luke",
            "Another system for the Republic! The clones are cheering on the comms, Artoo.",
          ],
          ["r2", "[a proud whistle: he remembers that sound]"],
        ],
        dark: [
          [
            "luke",
            "A win for the Separatists. The droids are celebrating. Roger, roger.",
          ],
          ["r2", "[a disgusted raspberry]"],
        ],
      },
    },
    gcw: {
      front: {
        light: [
          [
            "luke",
            "The Rebellion against the Empire. This is what I left Tatooine for, Artoo.",
          ],
          ["r2", "[a keen, ready whistle]"],
        ],
        dark: [
          [
            "luke",
            "Flying for the Empire. Father would be pleased, Artoo. That’s what scares me.",
          ],
          ["r2", "[a long, low whistle of deep disapproval]"],
        ],
      },
      won: {
        light: [
          [
            "luke",
            "Another one for the Rebellion! The Empire can’t be everywhere, Artoo.",
          ],
          ["r2", "[a jaunty run of beeps]"],
        ],
        dark: [
          [
            "luke",
            "The Empire wins. Somewhere, the Emperor’s smiling. I feel sick, Artoo.",
          ],
          ["r2", "[a pointed beep: that is called a conscience]"],
        ],
      },
    },
    remnant: {
      front: {
        light: [
          [
            "luke",
            "The New Republic against the Imperial Remnant. The war’s meant to be over, Artoo.",
          ],
          ["r2", "[a weary beep: somebody forgot to tell the Remnant]"],
        ],
        dark: [
          [
            "luke",
            "Flying for the Imperial Remnant, against Leia and the New Republic. What am I doing, Artoo?",
          ],
          ["r2", "[a sharp beep: he has been asking that since take-off]"],
        ],
      },
      won: {
        light: [
          [
            "luke",
            "That’s one for the New Republic. One less hiding place for the Remnant, Artoo.",
          ],
          ["r2", "[a cheerful trill]"],
        ],
        dark: [
          [
            "luke",
            "The Remnant won. We beat the Empire once, Artoo, and now I’m helping it back up.",
          ],
          ["r2", "[a withering whistle: yes, and the whole galaxy saw]"],
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
            "luke",
            "Endor. Han’s on the moon with the strike team. We hold till that shield comes down.",
          ],
          ["r2", "[a worried warble: Admiral Ackbar thinks it’s a trap]"],
        ],
        dark: [
          [
            "luke",
            "Defending the Emperor’s Death Star. Artoo, I came to Endor to turn my father, not to join him.",
          ],
          ["r2", "[a despairing whistle]"],
        ],
      },
      won: {
        light: [
          [
            "luke",
            "We won at Endor! The Ewoks will be drumming on stormtrooper helmets all night.",
          ],
          ["r2", "[a delighted whistle: he is going to dance]"],
        ],
        dark: [
          [
            "luke",
            "The Empire holds Endor. The Emperor was right about me. I hate that, Artoo.",
          ],
          [
            "r2",
            "[a stubborn beep: there’s still good in Luke, whatever the Emperor says]",
          ],
        ],
      },
    },
    hoth: {
      war: "gcw",
      front: {
        light: [
          [
            "luke",
            "Hoth again. The ion cannon’s firing. Cover the transports till they’re all away, Artoo.",
          ],
          ["r2", "[a shivering warble: and then somewhere warm]"],
        ],
        dark: [
          [
            "luke",
            "Hoth, flying for the Empire. Those are Rebel transports, Artoo. Those are my friends.",
          ],
          ["r2", "[a stricken warble: and they are running from us]"],
        ],
      },
      won: {
        light: [
          [
            "luke",
            "Hoth is ours! The Empire’s fleet is pulling back. Nobody will believe this, Artoo.",
          ],
          ["r2", "[a gleeful whistle: not even the wampa]"],
        ],
        dark: [
          [
            "luke",
            "The Empire has Hoth. I hope the transports got away, Artoo. I really do.",
          ],
          ["r2", "[a quiet beep: he counted them out, and some did]"],
        ],
      },
    },
    scarif: {
      war: "gcw",
      front: {
        light: [
          [
            "luke",
            "Scarif. Somebody’s down there stealing the Death Star plans. Let’s buy them time, Artoo.",
          ],
          ["r2", "[a nervous warble at the Shield Gate]"],
        ],
        dark: [
          [
            "luke",
            "Guarding the Death Star plans for the Empire. Artoo, those plans are how I met you.",
          ],
          ["r2", "[an aghast warble: and Ben, and Han, and Leia]"],
        ],
      },
      won: {
        light: [
          [
            "luke",
            "The plans are away! Whoever was down on that beach, they made it count, Artoo.",
          ],
          ["r2", "[a slow, solemn whistle]"],
        ],
        dark: [
          [
            "luke",
            "The Empire held Scarif. The plans never got out. Artoo… then how did I ever meet you?",
          ],
          ["r2", "[an airy beep: he has his ways]"],
        ],
      },
    },
    yavin: {
      war: "gcw",
      front: {
        light: [
          [
            "luke",
            "The Death Star’s coming round Yavin. A two-metre exhaust port. I used to bullseye womp rats, Artoo.",
          ],
          ["r2", "[a brave, wobbly whistle: he will mind the stabiliser]"],
        ],
        dark: [
          [
            "luke",
            "Defending the Death Star at Yavin, for the Empire. Ben would be so disappointed.",
          ],
          [
            "r2",
            "[a reproachful whistle: Ben is disappointed, from wherever he is]",
          ],
        ],
      },
      won: {
        light: [
          [
            "luke",
            "The Death Star’s gone! Artoo, I think I hear medals in our future.",
          ],
          ["r2", "[a hopeful whistle: and maybe an oil bath]"],
        ],
        dark: [
          [
            "luke",
            "The Empire won at Yavin. The Death Star’s still out there, and that’s on us, Artoo.",
          ],
          ["r2", "[a long, mournful whistle]"],
        ],
      },
    },
    bespin: {
      war: "gcw",
      front: {
        light: [
          [
            "luke",
            "Bespin. Han’s down there somewhere, and so’s Vader. Let’s be quick, Artoo.",
          ],
          [
            "r2",
            "[a smug beep: if the hyperdrive fails again, he knows the fix]",
          ],
        ],
        dark: [
          [
            "luke",
            "Flying Vader’s escort over Cloud City. Artoo, he’d ask me to join him. I already have.",
          ],
          ["r2", "[a despairing whistle: and it hasn’t even cost a hand]"],
        ],
      },
      won: {
        light: [
          [
            "luke",
            "Bespin is ours! Lando’s opening up the city. And this time I kept both hands, Artoo.",
          ],
          ["r2", "[a relieved trill]"],
        ],
        dark: [
          [
            "luke",
            "The Empire holds Bespin. Han’s probably in carbonite by now. I did that, Artoo.",
          ],
          ["r2", "[a cold, quiet beep that does not disagree]"],
        ],
      },
    },
    coruscant: {
      war: "clone",
      front: {
        light: [
          [
            "luke",
            "Coruscant, Artoo. The Chancellor’s been taken aboard the Invisible Hand. Mind the buzz droids.",
          ],
          ["r2", "[a smug beep: he knows exactly where to poke them]"],
        ],
        dark: [
          [
            "luke",
            "Separatists over Coruscant, and we’re with them. Artoo, we’re helping kidnap the Chancellor.",
          ],
          ["r2", "[a cagey beep: the Chancellor is not what he seems]"],
        ],
      },
      won: {
        light: [
          [
            "luke",
            "Coruscant’s safe for the Republic! Somebody landed half a burning cruiser. Who flies like that?",
          ],
          ["r2", "[a proud, cagey whistle: he knows who]"],
        ],
        dark: [
          [
            "luke",
            "The Separatists won over Coruscant. Grievous got away with the Chancellor. Is that… good, Artoo?",
          ],
          ["r2", "[a long, complicated whistle: honestly, it might be]"],
        ],
      },
    },
    naboo: {
      war: "clone",
      front: {
        light: [
          [
            "luke",
            "Lucrehulks round Naboo. Artoo, didn’t somebody blow one of these up from the inside?",
          ],
          [
            "r2",
            "[a delighted whistle: a nine-year-old, by accident, and he was there]",
          ],
        ],
        dark: [
          [
            "luke",
            "Flying for the Separatists over Naboo. Artoo, it’s so beautiful down there.",
          ],
          ["r2", "[a pleading whistle: so leave it alone]"],
        ],
      },
      won: {
        light: [
          [
            "luke",
            "Naboo is free! The Gungans will be throwing a parade, Artoo.",
          ],
          [
            "r2",
            "[a fond trill: he went to the last one, the one with the giant glowing ball]",
          ],
        ],
        dark: [
          [
            "luke",
            "The Separatists hold Naboo. I can’t explain it, Artoo, but that feels personal.",
          ],
          ["r2", "[a soft, sad whistle: it is]"],
        ],
      },
    },
    lothal: {
      war: "remnant",
      front: {
        light: [
          [
            "luke",
            "Lothal. Thrawn’s back, and the Chimaera with him. The Ghost is flying with us, Artoo.",
          ],
          [
            "r2",
            "[a guarded whistle: he has met Chopper, and is choosing not to mention it]",
          ],
        ],
        dark: [
          [
            "luke",
            "Flying for Thrawn over Lothal. Artoo, a Jedi gave everything to send him away.",
          ],
          [
            "r2",
            "[a horrified warble: Chopper will never let him hear the end of it]",
          ],
        ],
      },
      won: {
        light: [
          [
            "luke",
            "Lothal holds! The Chimaera’s jumped. Somewhere, a loth-wolf is very pleased, Artoo.",
          ],
          [
            "r2",
            "[a long, howling whistle, as near to a loth-wolf as he can manage]",
          ],
        ],
        dark: [
          [
            "luke",
            "The Remnant has Lothal back. Thrawn will make the most of it. He always does.",
          ],
          ["r2", "[a grim beep: and Thrawn has studied our flying, too]"],
        ],
      },
    },
  },
};
