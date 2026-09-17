// ===================================================================
// data.js — all the balance numbers in one readable place.
// ===================================================================

export const COST_KEYS = ['gold', 'wood', 'stone'];

/**
 * The four attributes everything in the realm is built on. Kept deliberately
 * Warcraft-simple: each one does exactly one obvious thing, and reads in
 * fives so the numbers stay legible.
 */
export const STATS = {
  str: { key: 'str', name: 'Strength', short: 'STR', colour: '#e07a50',
    desc: '+2.2% melee damage per point' },
  agi: { key: 'agi', name: 'Agility', short: 'AGI', colour: '#7fd8a0',
    desc: '+1.6% attack speed per point' },
  con: { key: 'con', name: 'Constitution', short: 'CON', colour: '#ff9db0',
    desc: '+7 health per point' },
  int: { key: 'int', name: 'Intelligence', short: 'INT', colour: '#6fb6ff',
    desc: '+4 mana and +0.8% critical chance per point' }
};
export const STAT_ORDER = ['str', 'agi', 'con', 'int'];

/**
 * A class is a LAYER, not a replacement. Knighting a villager keeps everything
 * they already are -- their baseline and everything the work taught them --
 * and adds the class bonus on top, so a veteran makes a better soldier and
 * nobody ever gets worse at something by being promoted.
 */

/** What a soldier is trying to do with their day. */
export const STANCES = {
  defend: {
    id: 'defend', name: 'Defend', short: 'Defend', colour: '#6fb6ff',
    desc: 'Holds the realm. Loiters among the buildings and the workers, and sprints to anyone attacked.'
  },
  roam: {
    id: 'roam', name: 'Roam', short: 'Roam', colour: '#ffc94a',
    desc: 'Wanders off into the dark, scouts, and picks fights with lairs on its own initiative.'
  }
};
export const STANCE_ORDER = ['defend', 'roam'];
export const RUSH_SPEED = 1.45;     // answering a worker's distress call
/**
 * The share of one movement step that crowd separation is allowed to undo.
 * Strictly below 1 or a knot of units can push each other to a standstill --
 * which it did, for minutes at a time.
 */
export const SEPARATION_CAP = 0.45;
export const DISTRESS_WINDOW = 5;   // seconds a cry for help stays live

/** How each attribute cashes out. One place to retune all of it. */
/**
 * Per POINT, not per five. Bracketing threw away most of a veteran's training
 * -- 23 strength and 19 strength bought exactly the same damage -- so every
 * point now moves the needle, and moves it further.
 */
export const STAT_EFFECT = {
  dmgPerPoint: 0.022,     // strength, counted above the baseline of 5
  speedPerPoint: 0.016,   // agility
  hpPerPoint: 7,          // constitution
  manaPerPoint: 4,        // intelligence
  critPerPoint: 0.008,    // intelligence, counted absolute
  critCap: 0.45,
  critMultiplier: 1.75
};

/**
 * Peasant missions. You do not tell a peasant which rock to hit -- you tell
 * them what they are for, and they go find the work themselves, forever,
 * moving on to the next seam when one runs dry.
 *
 * `nodes` lists the resource kinds the mission will hunt for.
 */
export const MISSIONS = {
  none: {
    id: 'none', name: 'Idle', short: 'Idle', colour: '#a596c4',
    desc: 'Loiters near home and lends a hand with whatever is being built.'
  },
  miner: {
    id: 'miner', name: 'Miner', short: 'Mine', colour: '#ffc94a',
    nodes: ['goldmine'], res: 'gold',
    desc: 'Seeks out the nearest gold mine and works it until it is empty, then finds another.'
  },
  woodcutter: {
    id: 'woodcutter', name: 'Woodcutter', short: 'Wood', colour: '#b4753a',
    nodes: ['tree', 'pine'], res: 'wood',
    desc: 'Fells the nearest woodland, tree by tree, and hauls the timber home.'
  },
  quarrier: {
    id: 'quarrier', name: 'Quarrier', short: 'Stone', colour: '#b6bccb',
    nodes: ['quarry'], res: 'stone',
    desc: 'Cuts stone at the nearest quarry and keeps going once it is exhausted.'
  },
  builder: {
    id: 'builder', name: 'Builder', short: 'Build', colour: '#7fd8a0',
    build: true,
    desc: 'Runs to whatever is half-built or damaged and works on it.'
  },
  warrior: {
    id: 'warrior', name: 'Warrior', short: 'War', colour: '#e07a50',
    becomes: 'warrior', at: 'barracks',
    desc: 'Hired at the Barracks. Answers flags, not orders, and charges anything.'
  },
  ranger: {
    id: 'ranger', name: 'Ranger', short: 'Scout', colour: '#3a8a5a',
    becomes: 'ranger', at: 'rangers_guild',
    desc: 'Hired at the Rangers Guild. A fast archer who sees further than anyone.'
  },
  wizard: {
    id: 'wizard', name: 'Wizard', short: 'Magic', colour: '#6fb6ff',
    becomes: 'wizard', at: 'wizards_guild',
    desc: 'Hired at the Wizards Guild. Throws fire that lands on everything standing together, and runs early.'
  },
  cleric: {
    id: 'cleric', name: 'Cleric', short: 'Faith', colour: '#ffe9a0',
    becomes: 'cleric', at: 'temple',
    desc: 'Hired at the Temple. Walks the realm looking for the hurt, mending anyone bleeding and blessing anyone about to be.'
  }
};

/**
 * A cleric's blessing. Not a heal: it is put on somebody who is about to be
 * in trouble, and makes them hit harder and fold slower while it lasts.
 */
export const BLESSING = {
  lasts: 20, dmgMul: 1.25, soak: 0.82, cost: 16, rate: 2.5, range: 110,
  colour: '#ffe9a0',
  desc: '+25% damage and a fifth of the harm turned aside'
};

/** How close a cleric tries to stay to the soldiers they are there to keep alive. */
export const CLERIC_TETHER = 120;

/**
 * What a caster's mana is actually for. It regenerates slowly on its own and
 * faster standing still, so intelligence buys both a deeper pool and more of
 * the things that come out of it.
 */
/**
 * Mana comes back faster the cleverer you are. The flat part is what anybody
 * gets; the rest is bought with intelligence above the baseline of five, so
 * INT buys both a deeper pool and a faster one -- which is the whole reason
 * to put a quarrier through the temple rather than a woodcutter.
 */
export const MANA_REGEN = 1.2;          // per second, working
export const MANA_REST = 3.0;           // per second, standing about
export const MANA_REGEN_PER_INT = 0.12; // added to both, per point over five
export const HEAL_COST = 12;

/**
 * Rank earned for supporting rather than killing. Healing pays per point of
 * health actually restored -- topping somebody already full restores nothing
 * and so earns nothing, which is what keeps it honest -- and a blessing pays
 * a small flat amount for the same reason a bandage does.
 */
export const XP_PER_HEAL = 0.03;
export const XP_PER_BLESSING = 1;

/**
 * Shared credit for a kill. Everyone who hurt it gets a cut rather than only
 * whoever happened to land the last blow, and the party as a whole earns a
 * little more than a lone hero would -- so bringing friends is worth it even
 * though each individual share is smaller.
 */
export const XP_SHARE_BONUS = 0.15;     // per extra contributor...
export const XP_SHARE_BONUS_CAP = 3;    // ...counted for at most this many
export const CREDIT_WINDOW = 12;        // seconds a hit still counts as taking part
/** A healer's weight in the split, against 1 for everyone doing the hitting. */
export const SUPPORT_SHARE = 0.5;

/**
 * How far a cleric will travel to somebody who needs them, and how hurt
 * somebody has to be before they are worth crossing the map for.
 */
export const MEND_RANGE = 520;
/** How close a cleric will let anything hostile get before backing off. */
export const CLERIC_KEEP = 52;
export const MEND_AT = 0.72;

/**
 * ===================================================================
 * SPECIALISATIONS -- chosen once, at the rank cap, and permanent.
 * ===================================================================
 *
 * Every specialisation is worth exactly twenty attribute points, spent
 * differently: the choice is about shape, never about power. On top of that
 * each one gets an ability, paid for out of its class resource.
 */
export const SPEC_LEVEL = 5;

/**
 * The resource an ability is paid for with. Warriors work themselves into a
 * temper; rangers settle and breathe.
 */
export const POWERS = {
  rage: {
    id: 'rage', name: 'Rage', colour: '#ff5a5a', max: 100,
    onHit: 9, onHurt: 7, regen: 0, decay: 3.5,
    desc: 'Builds by dealing and taking blows, and cools off out of a fight.'
  },
  focus: {
    id: 'focus', name: 'Focus', colour: '#7fd8a0', max: 100,
    onHit: 0, onHurt: 0, regen: 11, idleRegen: 20, decay: 0, startFull: true,
    desc: 'Gathers steadily, faster between shots, and full before a fight starts.'
  }
};

export const ABILITIES = {
  rampage: {
    id: 'rampage', name: 'Rampage', power: 'rage', cost: 70, cd: 9, lasts: 6,
    desc: 'A berserk flurry: swings twice as fast and drinks back a quarter of the damage dealt.'
  },
  mortal_strike: {
    id: 'mortal_strike', name: 'Mortal Strike', power: 'rage', cost: 60, cd: 8, lasts: 0,
    mult: 3.2, desc: 'One crushing blow for triple damage, aimed at whatever is in front of them.'
  },
  shield_wall: {
    id: 'shield_wall', name: 'Shield Wall', power: 'rage', cost: 55, cd: 13, lasts: 8,
    desc: 'Takes half damage, and drags every nearby monster onto itself and off everyone else.'
  },
  aimed_shot: {
    id: 'aimed_shot', name: 'Aimed Shot', power: 'focus', cost: 55, cd: 7, lasts: 0,
    mult: 3, desc: 'A long drawn shot for triple damage, loosed from further than anything can answer.'
  },
  ambush: {
    id: 'ambush', name: 'Ambush', power: 'focus', cost: 60, cd: 10, lasts: 0,
    mult: 2.5, hiddenMult: 4.5,
    desc: 'A brutal opening blow -- and far worse if it lands before they are seen.'
  },
  vanish: {
    id: 'vanish', name: 'Vanish', power: 'focus', cost: 65, cd: 15, lasts: 5,
    mult: 5, desc: 'Steps out of sight, closes unseen, and opens with a five-fold strike in the back.'
  }
};

export const SPECS = {
  warrior: [
    {
      id: 'fury', name: 'Fury', colour: '#ff7a3a',
      bonus: { str: 10, agi: 10, con: 0, int: 0 }, ability: 'rampage',
      desc: 'A blade in each hand and no thought of tomorrow. All damage, all speed, no guard.'
    },
    {
      id: 'arms', name: 'Arms', colour: '#ffc94a',
      bonus: { str: 8, agi: 8, con: 4, int: 0 }, ability: 'mortal_strike',
      desc: 'One great weapon and one opponent at a time. Hits hardest of anyone, one blow at a time.'
    },
    {
      id: 'protection', name: 'Protection', colour: '#6fb6ff',
      bonus: { str: 5, agi: 0, con: 15, int: 0 }, ability: 'shield_wall',
      taunt: 120,
      desc: 'Shield up, feet planted. Soaks what would kill anyone else, and insists on being the one hit.'
    }
  ],
  ranger: [
    {
      id: 'longbow', name: 'Longbowman', colour: '#7fd8a0',
      bonus: { str: 8, agi: 12, con: 0, int: 0 }, ability: 'aimed_shot',
      rangeMul: 1.35, dmgMul: 1.15,
      desc: 'Reach above all. Outranges everything on the map and opens fire before the enemy knows.'
    },
    {
      id: 'mercenary', name: 'Mercenary', colour: '#c9a227',
      bonus: { str: 6, agi: 10, con: 4, int: 0 }, ability: 'ambush',
      stealth: true, stealthIn: 3, openerMul: 1.8,
      desc: 'Paid to end things quickly. Slips out of sight between fights and opens hard.'
    },
    {
      id: 'assassin', name: 'Assassin', colour: '#9b6fff',
      bonus: { str: 0, agi: 14, con: 0, int: 6 }, ability: 'vanish',
      stealth: true, stealthIn: 2.5, openerMul: 2.4,
      desc: 'Walks unseen, kills once, and is gone before the answer comes.'
    }
  ]
};

/** How long a unit stays unseen after breaking stealth by striking. */
export const STEALTH_REVEAL = 2.5;

/** The work callings: what the Folk tab counts. */
export const MISSION_ORDER = ['miner', 'woodcutter', 'quarrier', 'builder', 'none'];

/**
 * Every calling plus the four soldier classes. The soldier entries are not
 * callings a villager can take -- nobody is promoted out of the fields any
 * more -- they are here so the Realm tab has a row per guild to count.
 */
export const CALLING_ORDER = ['miner', 'woodcutter', 'quarrier', 'builder', 'warrior', 'ranger', 'wizard', 'cleric', 'none'];

/**
 * Buildings. `fw/fh` footprint in tiles. `needs` gates the build menu.
 * `role` drives behaviour: depot, guild, shop, defence, housing.
 */
export const BUILDINGS = {
  palace: {
    id: 'palace', name: 'City Centre', fw: 3, fh: 3, hp: 2400,
    cost: { gold: 0, wood: 0, stone: 0 }, build: 0, unique: true,
    pop: 14, depot: true, tax: 2, sight: 12,
    attack: { dmg: 11, range: 86, rate: 1.7 },
    recruit: ['peasant'],
    desc: 'Heart of the realm. Hires peasants, stores every resource, pays the taxes.'
  },
  hut: {
    id: 'hut', name: 'Peasant Hut', fw: 2, fh: 2, hp: 260,
    cost: { gold: 35, wood: 25, stone: 0 }, build: 7,
    pop: 4, tax: 1,
    desc: 'Shelter for four more souls. Raises your population cap and pays a little tax.'
  },
  lumberyard: {
    id: 'lumberyard', name: 'Lumberyard', fw: 2, fh: 2, hp: 320,
    cost: { gold: 70, wood: 20, stone: 10 }, build: 9,
    depot: true, boost: { wood: 0.6 }, radius: 11,
    desc: 'Drop-off for timber. Woodcutters within eleven tiles fell 60% faster.'
  },
  mining_camp: {
    id: 'mining_camp', name: 'Mining Camp', fw: 2, fh: 2, hp: 340,
    cost: { gold: 70, wood: 40, stone: 0 }, build: 9,
    depot: true, boost: { gold: 0.5, stone: 0.5 }, radius: 11,
    desc: 'Drop-off for ore and stone. Miners and quarriers within eleven tiles work 50% faster.'
  },
  marketplace: {
    id: 'marketplace', name: 'Marketplace', fw: 2, fh: 2, hp: 380,
    cost: { gold: 130, wood: 70, stone: 20 }, build: 12,
    tax: 4, shop: 'market', market: true,
    desc: 'Five shelves of arms and trinkets. Heroes sell you what they cannot use and buy what beats what they are wearing -- and you tax both ends of every deal.'
  },
  blacksmith: {
    id: 'blacksmith', name: 'Blacksmith', fw: 2, fh: 2, hp: 420,
    cost: { gold: 140, wood: 50, stone: 60 }, build: 13, needs: ['marketplace'],
    tax: 3, shop: 'weapon',
    desc: 'Heroes buy sharper steel, permanently raising their damage. You take a cut.'
  },
  inn: {
    id: 'inn', name: 'Inn', fw: 2, fh: 2, hp: 360,
    cost: { gold: 120, wood: 80, stone: 0 }, build: 11, needs: ['palace'],
    tax: 3, shop: 'rest',
    desc: 'Heroes drink, boast, and heal fast. Idle heroes drift here between jobs.'
  },
  barracks: {
    id: 'barracks', name: 'Barracks', fw: 2, fh: 2, hp: 560,
    cost: { gold: 130, wood: 90, stone: 30 }, build: 14,
    guild: 'warrior', maxHeroes: 3, sight: 9,
    desc: 'Hires Warriors. They patrol, explore and answer reward flags -- but they pick their own fights.'
  },
  warriors_guild: {
    id: 'warriors_guild', name: 'Warriors Guild', fw: 2, fh: 2, hp: 620,
    cost: { gold: 170, wood: 90, stone: 40 }, build: 16, needs: ['palace'],
    guild: 'warrior', maxHeroes: 3,
    desc: 'Recruits Warriors: tough, brave, cheap to please. They charge anything.'
  },
  rangers_guild: {
    id: 'rangers_guild', name: 'Rangers Guild', fw: 2, fh: 2, hp: 520,
    cost: { gold: 160, wood: 110, stone: 10 }, build: 15, needs: ['palace'],
    guild: 'ranger', maxHeroes: 3, sight: 10,
    desc: 'Hires Rangers: fast, sharp-eyed, deadly at range and never where you left them.'
  },
  wizards_guild: {
    id: 'wizards_guild', name: 'Wizards Guild', fw: 2, fh: 2, hp: 500,
    cost: { gold: 240, wood: 80, stone: 90 }, build: 20,
    guild: 'wizard', maxHeroes: 2, sight: 9,
    desc: 'Hires Wizards: fire at range that lands on a whole pack at once, wrapped in nothing but a robe.'
  },
  temple: {
    id: 'temple', name: 'Temple', fw: 2, fh: 2, hp: 560,
    cost: { gold: 220, wood: 90, stone: 70 }, build: 19,
    guild: 'cleric', maxHeroes: 2, resurrect: 0.5, sight: 9,
    desc: 'Hires Clerics, who go looking for the hurt and the outnumbered instead of waiting for them. Also halves the cost of raising the dead.'
  },
  guardhouse: {
    id: 'guardhouse', name: 'Guard House', fw: 2, fh: 2, hp: 600,
    cost: { gold: 110, wood: 60, stone: 40 }, build: 12, needs: ['palace'],
    garrison: 3, garrisonRange: 150,
    desc: 'Three guards patrol nearby and never wander off. Unlike heroes, they obey.'
  },
  tower: {
    id: 'tower', name: 'Watch Tower', fw: 1, fh: 1, hp: 440,
    cost: { gold: 90, wood: 20, stone: 80 }, build: 10, needs: ['palace'],
    attack: { dmg: 20, range: 100, rate: 1.2 }, sight: 10,
    desc: 'Shoots bolts at anything hostile in range. Also lifts the fog around it.'
  }
};

/**
 * What the player can actually put down, in the order the menu shows it.
 *
 * The realm is no longer a City Centre and a ring of peasants walking further
 * and further for worse and worse seams. Depots go out to the seams, and the
 * things that keep a depot alive go out with them -- which is the whole game
 * now: the rich ground is the far ground, and the far ground is where the
 * lairs are.
 */
export const BUILD_ORDER = ['hut', 'lumberyard', 'mining_camp', 'guardhouse', 'tower',
  'marketplace', 'inn', 'blacksmith', 'barracks', 'rangers_guild', 'wizards_guild', 'temple'];

/** Kept as an alias: nothing is switched off behind a flag any more. */
export const BUILD_ORDER_FULL = BUILD_ORDER;

/**
 * Lairs near your buildings send raiding parties once the peace ends. Distance
 * still gates it: expanding toward a lair is what makes it hostile.
 */
export const RAIDS_ENABLED = true;

/**
 * Hero and unit classes.
 * Heroes cost no population -- their guild already caps how many exist,
 * and making them compete with peasants for huts just punishes ambition.
 * greed   — how strongly a flag bounty pulls them.
 * courage — how far below full health they will still fight.
 * wander  — how far from town they roam unprompted.
 */
export const CLASSES = {
  peasant: {
    id: 'peasant', name: 'Peasant', hp: 34, dmg: 5, rate: 1.1, range: 12, speed: 30,
    sight: 6, cost: { gold: 30 }, greed: 0, courage: 0, wander: 6, pop: 1,
    stats: { str: 5, agi: 5, con: 5, int: 5 },
    desc: 'Digs, chops, builds, repairs, panics. The realm runs on them.'
  },
  warrior: {
    id: 'warrior', name: 'Warrior', hp: 130, dmg: 14, rate: 0.85, range: 14, speed: 33,
    sight: 8, cost: { gold: 115 }, greed: 0.55, courage: 0.22, wander: 17, pop: 0,
    stats: { str: 8, agi: 5, con: 8, int: 5 },
    knight: { str: 8, agi: 2, con: 7, int: 0 },
    xpMul: 1, desc: 'Melee bruiser. Brave to the point of stupidity.'
  },
  ranger: {
    id: 'ranger', name: 'Ranger', hp: 84, dmg: 11, rate: 1.0, range: 86, speed: 44,
    sight: 11, cost: { gold: 105 }, greed: 0.9, courage: 0.4, wander: 30, pop: 0,
    stats: { str: 5, agi: 8, con: 6, int: 5 },
    knight: { str: 2, agi: 9, con: 3, int: 1 },
    ranged: true, desc: 'Scout and archer. Explores on her own, loves a bounty.'
  },
  wizard: {
    id: 'wizard', name: 'Wizard', hp: 66, dmg: 26, rate: 1.7, range: 100, speed: 29,
    sight: 9, cost: { gold: 180 }, greed: 0.7, courage: 0.55, wander: 14, pop: 0,
    stats: { str: 5, agi: 5, con: 6, int: 8 },
    knight: { str: 0, agi: 1, con: 1, int: 11 },
    ranged: true, splash: 26, desc: 'Fireballs from afar. Flees early, and rightly so.'
  },
  cleric: {
    id: 'cleric', name: 'Cleric', hp: 96, dmg: 9, rate: 1.2, range: 16, speed: 33,
    sight: 9, cost: { gold: 150 }, greed: 0.3, courage: 0.35, wander: 16, pop: 0,
    stats: { str: 5, agi: 5, con: 7, int: 8 },
    knight: { str: 1, agi: 1, con: 4, int: 8 },
    heal: { amount: 24, range: 80, rate: 2.0 }, desc: 'Heals wounded allies, smites the odd skeleton.'
  },
  guard: {
    id: 'guard', name: 'Guard', hp: 115, dmg: 11, rate: 1.0, range: 14, speed: 30,
    sight: 8, cost: { gold: 0 }, greed: 0, courage: 0.15, wander: 5, pop: 0,
    knight: { str: 4, agi: 1, con: 6, int: 0 },
    leash: 150, desc: 'Garrison soldier. Stays where you put him.'
  }
};

export const HERO_CLASSES = ['warrior', 'ranger', 'wizard', 'cleric'];

/** XP needed for each level beyond the first. */
/**
 * XP thresholds for levels 2..5. Levels no longer apply their own flat
 * multipliers -- they hand out attribute points instead, so a hero's numbers
 * come from exactly one place and the class system stays legible.
 */
export const XP_TABLE = [0, 60, 180, 420, 850];
export const MAX_LEVEL = XP_TABLE.length;   // 5
export const LEVEL_STATS = 5;               // +5 to every attribute per level

export const MONSTERS = {
  rat: {
    id: 'rat', name: 'Giant Rat', hp: 26, dmg: 5, rate: 1.0, range: 12, speed: 31,
    sight: 7, gold: 7, xp: 5, sprite: 'rat', aggro: 120, desc: 'Vermin. Dangerous only to peasants.'
  },
  slime: {
    id: 'slime', name: 'Slime', hp: 44, dmg: 7, rate: 1.4, range: 12, speed: 18,
    sight: 6, gold: 12, xp: 9, sprite: 'slime', aggro: 100, desc: 'Slow, acidic, weirdly persistent.'
  },
  goblin: {
    id: 'goblin', name: 'Goblin', hp: 62, dmg: 10, rate: 0.95, range: 13, speed: 34,
    sight: 8, gold: 16, xp: 12, sprite: 'goblin', aggro: 170, raid: true,
    desc: 'Raids buildings in packs. Will burn your huts given the chance.'
  },
  skeleton: {
    id: 'skeleton', name: 'Skeleton', hp: 98, dmg: 15, rate: 1.05, range: 13, speed: 29,
    sight: 9, gold: 30, xp: 24, sprite: 'skeleton', aggro: 200, raid: true,
    desc: 'Tireless undead soldier. Feels no fear and takes no prisoners.'
  },
  ogre: {
    id: 'ogre', name: 'Ogre', hp: 270, dmg: 30, rate: 1.5, range: 16, speed: 25,
    sight: 9, gold: 85, xp: 70, sprite: 'ogre', aggro: 220, raid: true, big: true,
    desc: 'One hit flattens a peasant. Bring wizards.'
  },
  demon: {
    id: 'demon', name: 'Demon', hp: 300, dmg: 34, rate: 1.2, range: 18, speed: 30,
    sight: 11, gold: 160, xp: 130, sprite: 'demon', aggro: 300, raid: true, big: true,
    desc: 'Comes when the realm grows fat. Pray you built a temple.'
  }
};

/**
 * `wake` is the day a lair stirs on its own. Seeing one wakes it early --
 * poke the nest and the nest pokes back, exactly as it should be.
 */
export const LAIRS = {
  rat: { id: 'rat', name: 'Rat Nest', hp: 380, spawn: 'rat', every: 18, max: 4, garrison: 3, reward: 140, prop: 'lair_rat', xp: 40, wake: 2 },
  goblin: { id: 'goblin', name: 'Goblin Camp', hp: 820, spawn: 'goblin', every: 17, max: 5, garrison: 4, reward: 320, prop: 'lair_goblin', xp: 90, wake: 6 },
  skeleton: { id: 'skeleton', name: 'Haunted Graveyard', hp: 1300, spawn: 'skeleton', every: 18, max: 5, garrison: 4, reward: 640, prop: 'lair_skeleton', xp: 170, wake: 11 },
  ogre: { id: 'ogre', name: 'Ogre Den', hp: 1900, spawn: 'ogre', every: 22, max: 3, garrison: 3, reward: 1150, prop: 'lair_ogre', xp: 320, wake: 16 }
};

/**
 * A camp is never empty. Garrisons stand there from the first day, so walking
 * into one is always a fight -- finding half of them deserted and razing those
 * for free made the map a lottery rather than a decision.
 *
 * Camps further from home also keep a bigger guard, so the danger reads off
 * the map: near ones are a first outing, distant ones are an expedition.
 */
export const GARRISON_NEAR = 26;         // tiles within which a camp keeps only its base guard
export const GARRISON_PER_RING = 15;     // one extra defender per this many tiles beyond that
export const GARRISON_EXTRA_CAP = 3;

/**
 * Loot. Weak things rarely carry anything worth having and strong things
 * usually do, so the reason to go after an ogre den is not only the bounty.
 * `bias` tilts the tier roll: an ogre is likelier to be carrying something
 * good, never certain to be.
 */
export const DROPS = {
  rat: { chance: 0.05, bias: 0 },
  slime: { chance: 0.07, bias: 0 },
  goblin: { chance: 0.13, bias: 0.15 },
  skeleton: { chance: 0.22, bias: 0.4 },
  ogre: { chance: 0.40, bias: 0.9 },
  demon: { chance: 0.55, bias: 1.4 }
};
/** Shelf size and how often a new thing appears on it. */
export const MARKET_SLOTS = 5;
export const MARKET_RESTOCK = 22;

/** A razed camp always coughs something up, and the big ones cough up well. */
export const LAIR_DROPS = {
  rat: { count: 1, bias: 0.2 },
  goblin: { count: 1, bias: 0.6 },
  skeleton: { count: 2, bias: 1.0 },
  ogre: { count: 2, bias: 1.8 }
};

/** No raids at all before this day: time to get a mine and a guild going. */
export const PEACE_DAYS = 4;

/**
 * A camp under attack musters: for a short window it breeds faster, so razing
 * one is a fight rather than a demolition job. The window is deliberately
 * FINITE -- a permanent bonus just makes a camp unkillable, because attackers
 * rightly clear the defenders before touching the building.
 */
export const LAIR_ALARM_RATE = 0.55;
export const LAIR_ALARM_TIME = 25;

/**
 * The world hardens as the days pass. Monsters spawned later carry this many
 * extra attribute points, which the ordinary per-point rules then turn into
 * health, damage and speed -- so a day-30 goblin is genuinely a problem.
 */
export const THREAT_PER_DAY = 0.45;
export const THREAT_CAP = 22;

export const FLAGS = {
  attack: {
    id: 'attack', name: 'Attack Flag', colour: '#e05050',
    desc: 'Heroes hunt whatever stands here. Paid when the area is cleared.',
    presets: [50, 150, 400, 1000]
  },
  explore: {
    id: 'explore', name: 'Explore Flag', colour: '#5aa0e6',
    desc: 'Heroes march into the dark and reveal it. Paid on arrival.',
    presets: [30, 90, 250, 600]
  },
  defend: {
    id: 'defend', name: 'Defend Flag', colour: '#6ecf8e',
    desc: 'Heroes loiter here and kill what comes. Paid slowly while guarded.',
    presets: [40, 120, 320, 800]
  },
  fear: {
    id: 'fear', name: 'Fear Flag', colour: '#ffc94a',
    desc: 'Heroes avoid this place entirely. Costs nothing but your pride.',
    presets: [0]
  }
};

/**
 * A load walks to the nearest depot, and at the start of the game the City
 * Centre is the only one there is -- so these numbers are tuned for the long
 * trudge home. A Lumberyard or a Mining Camp out at the seam is what shortens
 * it, which is exactly the decision the outposts exist to offer.
 */
export const RES_RATE = {
  goldmine: { res: 'gold', rate: 1.5, carry: 20 },
  quarry: { res: 'stone', rate: 1.4, carry: 20 },
  tree: { res: 'wood', rate: 1.8, carry: 20 },
  pine: { res: 'wood', rate: 1.8, carry: 20 }
};

export const START = { gold: 420, wood: 260, stone: 140 };
export const DAY_SECONDS = 60;      // one in-game day
export const TAX_INTERVAL = 12;     // seconds between tax collections
export const RESURRECT_COST = 0.6;  // fraction of hire cost to raise a dead hero
/**
 * Swinging at a building is not the same as swinging at a throat. Halving
 * structure damage gives sieges -- in both directions -- time to matter.
 */
export const STRUCTURE_DMG = 0.5;
