/*
 * CHARACTER CLASH — game data
 * ---------------------------
 * All character stats, moves, and arena definitions live in this file.
 * Nothing in here talks to the DOM — edit freely to rebalance the game.
 *
 * Stat scale (roughly):
 *   HP      80–140  (battle health pool)
 *   ATK     45–95   (physical move power scaling)
 *   DEF     45–95   (reduces incoming damage of both categories)
 *   SPD     35–95   (higher acts first each round)
 *   SPC     50–90   (special move power scaling)
 *
 * Move fields:
 *   name        display name
 *   category    "physical" | "special" | "status"
 *   power       0 for pure status moves
 *   accuracy    0-100 chance to connect
 *   description flavor text shown in the move tooltip / log
 *   effect      optional { type, ... } — see script.js `applyMoveEffect`
 *               types: heal, buffSelf, debuffTarget, dot, flinch
 */

const CHARACTERS = [
  {
    id: "garfield",
    name: "Garfield",
    title: "The Lazy Legend",
    tagline: "Hates Mondays. Loves lasagna. Surprisingly hard to knock over.",
    emoji: "🐱",
    color: "#f4a11c",
    colorDark: "#c9780a",
    stats: { hp: 140, atk: 65, def: 95, spd: 35, spc: 55 },
    moves: [
      {
        name: "Lasagna Attack",
        category: "physical",
        power: 70,
        accuracy: 95,
        description: "Hurls an entire tray of lasagna. Some of it gets eaten on the way, restoring a little HP.",
        effect: { type: "heal", amount: 0.12, target: "self", onlyIfHit: true },
      },
      {
        name: "Lazy Swipe",
        category: "physical",
        power: 40,
        accuracy: 100,
        description: "A half-hearted paw swat. Barely tries, but rarely misses.",
      },
      {
        name: "Monday Rage",
        category: "physical",
        power: 85,
        accuracy: 80,
        description: "Unleashes a lifetime of hatred for Mondays. Powerful, but reckless.",
        effect: { type: "debuffTarget", stat: "def", stages: -1, chance: 25 },
      },
      {
        name: "Nap",
        category: "status",
        power: 0,
        accuracy: 100,
        description: "Takes a long nap and recovers a solid chunk of HP.",
        effect: { type: "heal", amount: 0.35, target: "self" },
      },
    ],
  },
  {
    id: "hachiware",
    name: "Hachiware",
    title: "The Encouraging Otter",
    tagline: "Endlessly cheerful. Always ready to lend a paw and a pep talk.",
    emoji: "🦈",
    color: "#5fb8e0",
    colorDark: "#2f86ad",
    stats: { hp: 95, atk: 55, def: 60, spd: 80, spc: 90 },
    moves: [
      {
        name: "Singing",
        category: "special",
        power: 50,
        accuracy: 95,
        description: "An oddly soothing tune that rattles focus. May slow the target down.",
        effect: { type: "debuffTarget", stat: "spd", stages: -1, chance: 20 },
      },
      {
        name: "Cheer Up",
        category: "status",
        power: 0,
        accuracy: 100,
        description: "A burst of encouragement. Sharpens focus and raises Attack.",
        effect: { type: "buffSelf", stat: "atk", stages: 1 },
      },
      {
        name: "Pickaxe Swing",
        category: "physical",
        power: 65,
        accuracy: 90,
        description: "Swings a trusty little pickaxe. Hard work pays off.",
      },
      {
        name: "Friendship Boost",
        category: "status",
        power: 0,
        accuracy: 100,
        description: "Draws strength from friendship — restores HP and sharpens Special power.",
        effect: { type: "heal", amount: 0.18, target: "self", also: { type: "buffSelf", stat: "spc", stages: 1 } },
      },
    ],
  },
  {
    id: "trigger-happy",
    name: "Trigger Happy",
    title: "Twin-Blaster Gremlin",
    tagline: "Small, gold, and armed to the teeth. Shoots first, giggles later.",
    emoji: "🧌",
    color: "#f2d43a",
    colorDark: "#b89a12",
    stats: { hp: 85, atk: 95, def: 45, spd: 90, spc: 60 },
    moves: [
      {
        name: "Dual Blasters",
        category: "physical",
        power: 75,
        accuracy: 90,
        description: "Fires both blasters at once in a golden blaze.",
      },
      {
        name: "Chaos Shot",
        category: "special",
        power: 90,
        accuracy: 75,
        description: "A wild, unaimed barrage. Hits hard when it connects, and can crack armor.",
        effect: { type: "debuffTarget", stat: "def", stages: -1, chance: 10 },
      },
      {
        name: "Ricochet",
        category: "physical",
        power: 55,
        accuracy: 100,
        description: "Bounces a shot off every wall in the arena until it finds its mark.",
      },
      {
        name: "Happy Trigger",
        category: "status",
        power: 0,
        accuracy: 100,
        description: "Gets way too excited. Attack and Speed spike, but footing gets sloppy.",
        effect: { type: "buffSelf", stat: "atk", stages: 1, also: { type: "buffSelf", stat: "spd", stages: 1, also: { type: "buffSelf", stat: "def", stages: -1 } } },
      },
    ],
  },
  {
    id: "sackboy",
    name: "Sackboy",
    title: "The Crafty Hero",
    tagline: "Stitched from burlap and big ideas. Handy in a pinch, tougher than he looks.",
    emoji: "🧵",
    color: "#c98a4b",
    colorDark: "#8f5f2f",
    stats: { hp: 100, atk: 70, def: 80, spd: 65, spc: 65 },
    moves: [
      {
        name: "Yarn Punch",
        category: "physical",
        power: 60,
        accuracy: 100,
        description: "A springy, yarn-wrapped haymaker.",
      },
      {
        name: "Stitch Up",
        category: "status",
        power: 0,
        accuracy: 100,
        description: "Patches up torn seams and recovers HP.",
        effect: { type: "heal", amount: 0.25, target: "self" },
      },
      {
        name: "Pop-Up Attack",
        category: "physical",
        power: 80,
        accuracy: 85,
        description: "Pops out of nowhere from a hidden trapdoor for a surprise hit.",
        effect: { type: "critBonus", amount: 15 },
      },
      {
        name: "Crafty Defense",
        category: "status",
        power: 0,
        accuracy: 100,
        description: "Rigs up scrap-built armor plating. Defense rises sharply.",
        effect: { type: "buffSelf", stat: "def", stages: 2 },
      },
    ],
  },
  {
    id: "spongebob-fuggler",
    name: "SpongeBob Fuggler",
    title: "The Friendly (Allegedly) Fry Cook",
    tagline: "A fuzzy, fanged, deeply unsettling take on an endlessly upbeat fry cook. Means well. Probably.",
    emoji: "🧽",
    color: "#f4e04d",
    colorDark: "#5c3fa0",
    stats: { hp: 100, atk: 75, def: 65, spd: 75, spc: 70 },
    moves: [
      {
        name: "Bubble Blast",
        category: "special",
        power: 65,
        accuracy: 100,
        description: "A dependable blast of soap bubbles. Simple, but it works.",
      },
      {
        name: "Krabby Patty",
        category: "status",
        power: 0,
        accuracy: 100,
        description: "Shares a secret-formula patty. Restores a generous amount of HP.",
        effect: { type: "heal", amount: 0.3, target: "self" },
      },
      {
        name: "Creepy Stare",
        category: "status",
        power: 0,
        accuracy: 100,
        description: "Fixes the opponent with an unblinking, oddly toothy stare. Their Attack falters.",
        effect: { type: "debuffTarget", stat: "atk", stages: -1 },
      },
      {
        name: "Bite",
        category: "physical",
        power: 70,
        accuracy: 95,
        description: "A surprisingly big mouth for such a friendly fry cook.",
      },
    ],
  },
  {
    id: "domo",
    name: "Domo-kun",
    title: "The Odd Little Monster",
    tagline: "Brown, fuzzy, mostly mouth. Nobody's sure what he is, but he hits hard.",
    emoji: "👾",
    color: "#8a5a3b",
    colorDark: "#5c3a24",
    stats: { hp: 135, atk: 90, def: 75, spd: 45, spc: 50 },
    moves: [
      {
        name: "Domo Smash",
        category: "physical",
        power: 85,
        accuracy: 90,
        description: "A heavy two-fisted smash. Simple and devastating.",
      },
      {
        name: "Monster Roar",
        category: "status",
        power: 0,
        accuracy: 100,
        description: "An earsplitting roar from an enormous mouth. Opponent's Attack drops.",
        effect: { type: "debuffTarget", stat: "atk", stages: -1 },
      },
      {
        name: "Chomp",
        category: "physical",
        power: 65,
        accuracy: 100,
        description: "Chomps down hard. Might rattle the opponent enough to stall them.",
        effect: { type: "flinch", chance: 15 },
      },
      {
        name: "Domo Dance",
        category: "status",
        power: 0,
        accuracy: 100,
        description: "An bizarre little victory dance. Somehow makes him faster.",
        effect: { type: "buffSelf", stat: "spd", stages: 2 },
      },
    ],
  },
  {
    id: "jake",
    name: "Jake",
    title: "The Shape-Shifting Dog",
    tagline: "Stretchy, magical, and always down for a fight — mathematically speaking.",
    emoji: "🐶",
    color: "#f0c531",
    colorDark: "#b8930f",
    stats: { hp: 100, atk: 75, def: 65, spd: 75, spc: 80 },
    moves: [
      {
        name: "Stretch Punch",
        category: "physical",
        power: 70,
        accuracy: 95,
        description: "Winds up an arm from across the arena for a stretchy haymaker.",
      },
      {
        name: "Shape Shift",
        category: "status",
        power: 0,
        accuracy: 100,
        description: "Morphs into a sturdier, smarter shape. Defense and Special rise.",
        effect: { type: "buffSelf", stat: "def", stages: 1, also: { type: "buffSelf", stat: "spc", stages: 1 } },
      },
      {
        name: "Dog Spin",
        category: "physical",
        power: 60,
        accuracy: 100,
        description: "Curls up and spins like a furry buzzsaw. Reliable and steady.",
      },
      {
        name: "Mathematical!",
        category: "special",
        power: 95,
        accuracy: 80,
        description: "Channels pure magical dog energy into one glowing, math-powered blast.",
      },
    ],
  },
];

const ARENAS = [
  { id: "living-room", name: "The Living Room", gradient: ["#4a3a2f", "#2b2118"] },
  { id: "arcade", name: "Neon Arcade", gradient: ["#2a0d4d", "#12042b"] },
  { id: "forest", name: "Whispering Forest", gradient: ["#1f4a2e", "#0e2818"] },
  { id: "space", name: "Deep Space Void", gradient: ["#0b1030", "#02040f"] },
  { id: "bedroom", name: "The Bedroom Fort", gradient: ["#3a2450", "#1c1030"] },
];

const STAGE_LABELS = {
  atk: "ATK",
  def: "DEF",
  spd: "SPD",
  spc: "SPC",
};
