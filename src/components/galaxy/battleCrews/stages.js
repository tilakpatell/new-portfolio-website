// The four crews’ lines for a galaxy battle’s stages and side objectives
// (battleLines.js merges them into each crew’s own; warfront.js says them):
// a group of targets to break (batteries, satellites, platforms, wells), a
// zone to hold, a ship to board, a bomber wave coming in, an ace joining the
// fight. Each said to every pilot there, attacking or defending, so each
// works whichever end of it you’re on. Apart from the crews’ own files,
// which are near the size the codebase keeps a file under.

export default {
  cruiser: {
    group: {
      light: [
        ["morty", "Rick, there’s a whole bunch of them! Satellites, guns, whatever those are!"],
        ["rick", "Then we break enough of them, Morty. Not all. Enough. That’s the secret to everything."],
      ],
      dark: [
        ["rick", "Several targets, Morty, and {us} want most of them gone. Most, not all. I’m not a perfectionist."],
        ["morty", "That’s, that’s not true at all, Rick."],
      ],
    },
    zone: {
      light: [
        ["rick", "We hold that spot, Morty. Just sit in it. Loiter. You’re a natural."],
        ["morty", "I-I don’t know if that’s a compliment, Rick."],
      ],
      dark: [
        ["morty", "Rick, they want us to just park next to that thing?"],
        ["rick", "Holding ground, Morty. It’s the most boring part of war, and {us} do it with style."],
      ],
    },
    board: {
      light: [
        ["rick", "Somebody’s boarding that ship, Morty. Engines out, a shuttle alongside. Space piracy, with paperwork."],
        ["morty", "Isn’t boarding a ship kind of, like, rude?"],
      ],
      dark: [
        ["morty", "Rick, {us} are gonna board that ship? With people on it?"],
        ["rick", "Engines first, Morty. Then we hover politely while somebody’s day gets ruined."],
      ],
    },
    wave: {
      light: [
        ["morty", "Rick! A whole wave of bombers, coming in at once!"],
        ["rick", "Ours, we cover. Theirs, we chop up before they get there. Shoot the slow ones, Morty."],
      ],
      dark: [
        ["rick", "Bomber wave, Morty. Ours or theirs, it’s the same maths: fewer of them, fewer explosions."],
        ["morty", "That’s, like, the nicest thing you’ve said all day."],
      ],
    },
    hunt: {
      light: [
        ["morty", "Rick, somebody really good just showed up. Like, scary good."],
        ["rick", "An ace, Morty. Every pilot here wants that kill. Try not to be the one it gets."],
      ],
      dark: [
        ["rick", "There’s an ace out there now, and {them} love a hero. Let’s see how heroic they are on fire."],
        ["morty", "Jeez, Rick."],
      ],
    },
  },
  xwing: {
    group: {
      light: [
        ["r2", "[a string of beeps: several targets, and he has counted them twice]"],
        ["luke", "We don’t need them all, Artoo. Just enough to open a hole."],
      ],
      dark: [
        ["luke", "Their batteries, their satellites, whatever {us} want knocked out, one after another."],
        ["r2", "[an unhappy beep: he preferred the other side]"],
      ],
    },
    zone: {
      light: [
        ["luke", "We have to hold that position. Stay close, Artoo, and keep them off it."],
        ["r2", "[a determined whistle: he is not going anywhere]"],
      ],
      dark: [
        ["r2", "[a puzzled warble: why are we parking in the middle of a battle]"],
        ["luke", "Because {us} need it held, Artoo. Just keep scanning."],
      ],
    },
    board: {
      light: [
        ["r2", "[an anxious beep: a ship is about to be boarded, and he has seen this before]"],
        ["luke", "Engines first, then a shuttle alongside. Whoever’s doing it, Artoo, we decide how it ends."],
      ],
      dark: [
        ["luke", "So {us} want that ship boarded. I know how this goes, Artoo."],
        ["r2", "[a mournful whistle: so does he, from the inside]"],
      ],
    },
    wave: {
      light: [
        ["r2", "[a frantic warble: bombers, a whole wave of them]"],
        ["luke", "Ours get covered, theirs get stopped. Stay on target, Artoo."],
      ],
      dark: [
        ["luke", "A bomber wave, coming in together. Somebody’s going to have a bad day."],
        ["r2", "[a grim beep: probably several somebodies]"],
      ],
    },
    hunt: {
      light: [
        ["r2", "[a high, alarmed whistle: an ace, and a good one]"],
        ["luke", "I see him. Stay with me, Artoo. Aces can be beaten like anyone else."],
      ],
      dark: [
        ["luke", "An ace just joined the fight, Artoo. I can feel it."],
        ["r2", "[a nervous chirp: he would rather not feel it up close]"],
      ],
    },
  },
  falcon: {
    group: {
      light: [
        ["han", "A whole row of targets. We don’t need all of them, just enough to make a mess."],
        ["chewie", "[an eager roar: he likes messes]"],
      ],
      dark: [
        ["chewie", "[a doubtful growl at the row of targets]"],
        ["han", "Pal, {us} pay by the target. Pick one and keep going."],
      ],
    },
    zone: {
      light: [
        ["han", "We’ve got to sit on that spot? In a firefight? Fine. Nobody parks like me."],
        ["chewie", "[a sceptical rumble]"],
      ],
      dark: [
        ["chewie", "[a confused howl: why are we holding still]"],
        ["han", "Because {us} want it held, and holding still’s the hard part. Hang on."],
      ],
    },
    board: {
      light: [
        ["han", "Somebody’s boarding that ship. Engines out, then a shuttle alongside. I’ve been on the other end of this. Not fun."],
        ["chewie", "[a knowing growl]"],
      ],
      dark: [
        ["han", "Boarding party. Looks like {us} want that ship in one piece."],
        ["chewie", "[an uneasy whine: he remembers the Death Star]"],
      ],
    },
    wave: {
      light: [
        ["chewie", "[an urgent roar: bombers, lots of them]"],
        ["han", "I see them. Ours we cover, theirs we cut down. Punch it."],
      ],
      dark: [
        ["han", "Here comes a bomber wave. Somebody’s hull’s about to have a lot more holes."],
        ["chewie", "[a grim grunt]"],
      ],
    },
    hunt: {
      light: [
        ["han", "That’s an ace. Somebody always wants to be the best pilot in the sky."],
        ["chewie", "[a pointed roar: that is usually you]"],
      ],
      dark: [
        ["chewie", "[a warning growl: hotshot inbound]"],
        ["han", "An ace, huh? Great. Now it’s a party."],
      ],
    },
  },
  rv: {
    group: {
      light: [
        ["jesse", "Yo, there’s like a whole row of targets, Mr. White!"],
        ["walt", "We don’t need all of them, Jesse. Just enough. Precision, not greed."],
      ],
      dark: [
        ["walt", "Jesse, {us} want those taken out. One by one. Methodically."],
        ["jesse", "Methodically. Got it. Like a cook."],
      ],
    },
    zone: {
      light: [
        ["walt", "We hold that position, Jesse. Territory is everything."],
        ["jesse", "Yeah, okay, I know how territory works, Mr. White."],
      ],
      dark: [
        ["jesse", "So we just hang out by that thing? While people shoot at us?"],
        ["walt", "We hold it, Jesse. That is the job {us} are paying for."],
      ],
    },
    board: {
      light: [
        ["walt", "Someone is boarding that ship. Engines first, then they hold alongside. A hostile takeover, Jesse."],
        ["jesse", "This is so not a business, Mr. White."],
      ],
      dark: [
        ["jesse", "Yo, we’re boarding a whole ship? Like pirates?"],
        ["walt", "Engines first. Then we wait while {us} take what they came for."],
      ],
    },
    wave: {
      light: [
        ["jesse", "Mr. White! Bombers! Like a whole flock of them!"],
        ["walt", "Ours we protect. Theirs we stop. It is not complicated, Jesse."],
      ],
      dark: [
        ["walt", "A bomber wave. Coordinated. Someone out there has a plan."],
        ["jesse", "Yeah, and it’s probably to blow us up."],
      ],
    },
    hunt: {
      light: [
        ["jesse", "Yo, that pilot is crazy good. Like, Heisenberg good."],
        ["walt", "An ace, Jesse. Every side has one. We take him down."],
      ],
      dark: [
        ["walt", "There is an ace in the fight now. A professional. I respect that."],
        ["jesse", "Respect it from far away, okay?"],
      ],
    },
  },
};
