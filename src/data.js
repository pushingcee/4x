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
    desc: '+4% melee damage per point' },
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
  dmgPerPoint: 0.040,     // strength, counted above the baseline of 5
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
 * THE PALADIN'S WARD.
 *
 * A blessing is a thing you cast on one person at a time, and against a wave
 * of casters that is no answer at all: by the time the fourth ally is blessed
 * the first three are dead. The paladin no longer blesses. They stand there
 * and everyone near them takes less harm, for as long as they are near and
 * the paladin is alive.
 *
 * That is the counterplay the game was missing. Splash damage punishes a
 * clumped party; the ward pays a clumped party back. Where you stand becomes
 * a decision instead of an accident, and killing the paladin becomes the
 * thing the monsters ought to do.
 *
 * `soak` is the share of damage that still gets through, so lower is better.
 * The Battle Hymn deepens it to `hymnSoak` for its duration rather than
 * handing out blessings.
 */
export const WARD = {
  range: 92,          // pixels -- about six tiles, a tight formation
  soak: 0.78,         // a fifth of the harm turned aside, always on
  hymnSoak: 0.55,     // and nearly half of it while the hymn is up
  tick: 0.3,          // seconds between sweeps; the mark lasts a little longer
  colour: '#e0c060'
};

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
export const MANA_REGEN = 2.0;          // per second, working
export const MANA_REST = 4.2;           // per second, standing about
export const MANA_REGEN_PER_INT = 0.22; // added to both, per point over five
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
 * The inn.
 *
 * The hearth mends anyone of the realm standing near it, purse or no purse:
 * an inn is a place, not a transaction, and a soldier who has just spent
 * everything at the smith is exactly the one who most needs to sit down.
 * The bed upstairs is what costs, and that is where the innkeeper's cut --
 * and your tax on it -- comes from.
 *
 * `seek` is the whole point of the building. Wounded heroes used to reach an
 * inn only by fleeing past it; now anyone under this much health will walk
 * there of their own accord once nothing more urgent is shouting, and a
 * soldier holding the line walks further to do it, because between waves
 * there is nowhere better for them to be.
 */
export const REST = {
  radius: 7,        // tiles the hearth reaches
  aura: 0.09,       // share of max health mended per second, just for being near
  tick: 0.4,        // how often the hearth is worked out, in seconds
  bed: 0.45,        // what a paid rest restores outright
  price: 25,
  seek: 0.75,       // hurt below this and they go and sit down
  pull: 130,        // how badly, at death's door; a defender pulls harder still
  holdPull: 210,
  leave: 0.97       // and they are up again at this
};

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
  },
  /**
   * Casters have no temper to work up: their abilities come out of the same
   * mana pool as everything else they do, so intelligence pays for the
   * tricks as well as the bolts and the bandages.
   */
  mana: {
    id: 'mana', name: 'Mana', colour: '#6fb6ff', mana: true,
    desc: 'The pool intelligence buys. Refills on its own, faster standing still.'
  }
};

/** What a curse or a burn does to whoever is carrying it. */
export const DEBUFF = {
  weakMul: 0.8,     // damage dealt while weakened
  slowMul: 0.65,    // speed while slowed
  tick: 0.5         // seconds between burn and blight ticks
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
  },
  // ---- wizards: every one of these rides the next bolt and lands where it lands
  exsanguinate: {
    id: 'exsanguinate', name: 'Exsanguinate', power: 'mana', cost: 30, cd: 8, lasts: 0,
    mult: 2.6, desc: 'One bolt that tears the blood out of a single foe for 2.6x damage, and pours all of it back into the caster.'
  },
  firestorm: {
    id: 'firestorm', name: 'Firestorm', power: 'mana', cost: 45, cd: 12, lasts: 0,
    mult: 1.4, radius: 52, burn: 5, burnFrac: 0.2,
    desc: 'The bolt bursts into a storm: full damage to everything around where it lands, and all of it left burning for five seconds.'
  },
  blight: {
    id: 'blight', name: 'Blight', power: 'mana', cost: 45, cd: 14, lasts: 7,
    mult: 1, radius: 48, dpsFrac: 0.15,
    desc: 'Curses the ground where the bolt lands for seven seconds: everything standing on it rots, slows, and hits softer.'
  },
  // ---- clerics: instant, on everyone nearby
  radiance: {
    id: 'radiance', name: 'Radiance', power: 'mana', cost: 40, cd: 12, lasts: 0,
    mult: 1.5, radius: 96,
    desc: 'A burst of light that mends every ally nearby at once, half again as strong as a touch.'
  },
  hymn: {
    id: 'hymn', name: 'Battle Hymn', power: 'mana', cost: 45, cd: 16, lasts: 6,
    radius: 110,
    desc: 'Deepens the ward to nearly half of all harm for six seconds, and the paladin takes half damage on top of it.'
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
    /**
     * Both of these put the bow down. A ranger's reach is the one thing they
     * trade away: they work from arm's length, out of the dark, and the
     * damage multipliers are what they are paid for giving up eighty pixels.
     */
    {
      id: 'mercenary', name: 'Mercenary', colour: '#c9a227',
      bonus: { str: 8, agi: 10, con: 8, int: 0 }, ability: 'ambush',
      melee: true, range: 15, dmgMul: 1.35,
      stealth: true, stealthIn: 3, openerMul: 1.8,
      desc: 'Paid to end things quickly, up close. Slips out of sight between fights and opens hard.'
    },
    {
      id: 'assassin', name: 'Assassin', colour: '#9b6fff',
      bonus: { str: 4, agi: 14, con: 4, int: 4 }, ability: 'vanish',
      melee: true, range: 15, dmgMul: 1.25,
      // Barely ever visible: they are back in the dark a breath after the
      // blow lands, and being unseen is the whole of their armour.
      stealth: true, stealthIn: 0.8, openerMul: 2.4,
      // A knife is for throats. They will not stand hacking at a camp wall
      // while the garrison it belongs to fills up behind them.
      unitsOnly: true,
      desc: 'Walks unseen, kills once, and is gone before the answer comes. Will not touch a building.'
    }
  ],
  /**
   * Wizards. `bolt` picks the projectile art; `splashMul` scales the fireball's
   * splash (0 makes it a single-target bolt); `burn` and `weaken` are what every
   * ordinary bolt leaves behind; `leech` is the share of a bolt's damage that
   * comes back as health.
   */
  wizard: [
    {
      id: 'blood', name: 'Blood Magic', title: 'Blood Mage', colour: '#c8203a',
      bonus: { str: 0, agi: 0, con: 8, int: 12 }, ability: 'exsanguinate',
      bolt: 'blood', splashMul: 0, dmgMul: 1.15, leech: 0.2,
      desc: 'Every bolt is aimed at one throat and drinks from it. No splash, no mercy, and hard to kill.'
    },
    {
      id: 'fire', name: 'Fire Magic', title: 'Fire Mage', colour: '#ff8a2a',
      bonus: { str: 0, agi: 4, con: 2, int: 14 }, ability: 'firestorm',
      bolt: 'fire', splashMul: 1.4, burn: { lasts: 3, frac: 0.2 },
      desc: 'Wider fire, and everything it touches keeps burning after it lands.'
    },
    {
      id: 'dark', name: 'Dark Magic', title: 'Dark Mage', colour: '#7a3fbf',
      bonus: { str: 0, agi: 6, con: 4, int: 10 }, ability: 'blight',
      bolt: 'dark', splashMul: 1, weaken: { lasts: 6 },
      desc: 'Bolts that leave their mark: whatever they touch hits softer for a while, and the ground itself can be cursed.'
    }
  ],
  /**
   * Clerics. `healMul` scales every touch, `mendMul` its reach, `blessMul` how
   * long a blessing lasts, `soak` what share of harm gets through to them, and
   * `keep` how close they let a monster come before backing off.
   */
  cleric: [
    {
      id: 'light', name: 'Follower of the Light', title: 'Follower of the Light', colour: '#ffe9a0',
      bonus: { str: 0, agi: 0, con: 6, int: 14 }, ability: 'radiance',
      healMul: 1.4, mendMul: 1.3,
      desc: 'Mending above all: a stronger touch, a longer reach, and a burst of light for when the whole line is bleeding.'
    },
    /**
     * The one cleric who is not a cleric. `frontline` takes them out of the
     * support brain entirely -- they pick fights, they hold ground, and the
     * mending is something that happens around them rather than the job. The
     * hymn is what they bring: everyone in earshot blessed at once.
     */
    {
      id: 'paladin', name: 'Paladin', title: 'Paladin', colour: '#e0c060',
      bonus: { str: 12, agi: 2, con: 14, int: 4 }, ability: 'hymn',
      frontline: true, dmgMul: 1.7,
      soak: 0.8, ward: true, healMul: 0.6,
      desc: 'Plate over the robe, and a mace they mean it with. Fights in the line, takes a fifth less harm, and everyone standing near them takes a fifth less too.'
    }
  ]
};

/**
 * Trouble on the road. A hero marching to a flag used to walk straight past
 * whatever was already biting them, because the flag outscored a rat -- and
 * arrived at the camp with half its health gone and a tail of monsters. Now
 * anything inside `ROADSIDE` gets dealt with first. `ROAD_LEASH` is what
 * stops that becoming a chase: drift this far from where the scuffle started
 * and they break off and get on with the errand.
 */
export const ROADSIDE = 3 * 16;       // pixels: close enough to be in the way
export const ROAD_LEASH = 9 * 16;     // ...and how far they will follow it

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
 *
 * THE TECH TREE. Every building except the blacksmith used to be available
 * on the first day, because almost all of them were gated on `['palace']`
 * and the palace is what you start with -- so the opening menu was eleven
 * cards, most of them unaffordable, and the order you built in never came
 * out of the game telling you anything. Each prerequisite now names
 * something you have actually done:
 *
 *     day one   hut, lumberyard, mining camp, barracks
 *     a hut     -> marketplace          (people before commerce)
 *     barracks  -> guard house, rangers guild
 *     camp      -> watch tower          (the stone comes from somewhere)
 *     market    -> inn, blacksmith, wizards guild
 *     inn       -> temple
 *
 * The Warriors Guild is gone. It was a second barracks with a different
 * name and forty more gold on the price, it was never in the build menu, and
 * drilling a barracks now covers everything it was for.
 */
export const BUILDINGS = {
  palace: {
    id: 'palace', name: 'City Centre', fw: 3, fh: 3, hp: 2400,
    cost: { gold: 0, wood: 0, stone: 0 }, build: 0, unique: true,
    pop: 14, depot: true, tax: 4, sight: 12,
    attack: { dmg: 11, range: 86, rate: 1.7 },
    recruit: ['peasant'],
    desc: 'Heart of the realm. Hires peasants, stores every resource, pays the taxes.'
  },
  hut: {
    id: 'hut', name: 'Peasant Hut', fw: 2, fh: 2, hp: 260,
    cost: { gold: 35, wood: 25, stone: 0 }, build: 7,
    pop: 4, tax: 3,
    desc: 'Shelter for four more souls. Raises your population cap and pays a little tax.'
  },
  lumberyard: {
    id: 'lumberyard', name: 'Lumberyard', fw: 2, fh: 2, hp: 320,
    cost: { gold: 70, wood: 20, stone: 10 }, build: 9,
    depot: true, boost: { wood: 0.6 }, radius: 11, tax: 4,
    desc: 'Drop-off for timber, and every woodcutter working within its reach fells faster. Upgrade it for more of both.'
  },
  mining_camp: {
    id: 'mining_camp', name: 'Mining Camp', fw: 2, fh: 2, hp: 340,
    cost: { gold: 70, wood: 40, stone: 0 }, build: 9,
    depot: true, boost: { gold: 0.5, stone: 0.5 }, radius: 11, tax: 4,
    desc: 'Drop-off for ore and stone, and every miner and quarrier within its reach works faster. Upgrade it for more of both.'
  },
  marketplace: {
    id: 'marketplace', name: 'Marketplace', fw: 2, fh: 2, hp: 380,
    cost: { gold: 130, wood: 70, stone: 20 }, build: 12, needs: ['hut'],
    tax: 10, shop: 'market', market: true,
    desc: 'Five shelves of arms and trinkets. Heroes sell you what they cannot use and buy what beats what they are wearing -- and you tax both ends of every deal.'
  },
  blacksmith: {
    id: 'blacksmith', name: 'Blacksmith', fw: 2, fh: 2, hp: 420,
    cost: { gold: 140, wood: 50, stone: 60 }, build: 13, needs: ['marketplace'],
    tax: 7, shop: 'weapon',
    desc: 'Heroes buy sharper steel, permanently raising their damage. You take a cut.'
  },
  inn: {
    id: 'inn', name: 'Inn', fw: 2, fh: 2, hp: 360,
    cost: { gold: 120, wood: 80, stone: 0 }, build: 11, needs: ['marketplace'],
    tax: 7, shop: 'rest',
    desc: 'The hearth mends anyone of the realm standing near it, coin or no coin, and wounded soldiers now come here of their own accord. Those with gold take a bed and heal outright — and you tax that.'
  },
  barracks: {
    id: 'barracks', name: 'Barracks', fw: 2, fh: 2, hp: 560,
    cost: { gold: 130, wood: 90, stone: 30 }, build: 14,
    guild: 'warrior', maxHeroes: 3, sight: 9,
    desc: 'Hires Warriors. They patrol, explore and answer reward flags -- but they pick their own fights.'
  },
  rangers_guild: {
    id: 'rangers_guild', name: 'Rangers Guild', fw: 2, fh: 2, hp: 520,
    cost: { gold: 160, wood: 110, stone: 10 }, build: 15, needs: ['barracks'],
    guild: 'ranger', maxHeroes: 3, sight: 10,
    desc: 'Hires Rangers: fast, sharp-eyed, deadly at range and never where you left them.'
  },
  wizards_guild: {
    id: 'wizards_guild', name: 'Wizards Guild', fw: 2, fh: 2, hp: 500,
    cost: { gold: 240, wood: 80, stone: 90 }, build: 20, needs: ['marketplace'],
    guild: 'wizard', maxHeroes: 2, sight: 9,
    desc: 'Hires Wizards: fire at range that lands on a whole pack at once, wrapped in nothing but a robe.'
  },
  temple: {
    id: 'temple', name: 'Temple', fw: 2, fh: 2, hp: 560,
    cost: { gold: 220, wood: 90, stone: 70 }, build: 19, needs: ['inn'],
    guild: 'cleric', maxHeroes: 2, resurrect: 0.5, sight: 9,
    desc: 'Hires Clerics, who go looking for the hurt and the outnumbered instead of waiting for them. Also halves the cost of raising the dead.'
  },
  guardhouse: {
    id: 'guardhouse', name: 'Guard House', fw: 2, fh: 2, hp: 600,
    cost: { gold: 110, wood: 60, stone: 40 }, build: 12, needs: ['barracks'],
    garrison: 3, garrisonRange: 150, tax: 2,
    desc: 'Three guards patrol nearby and never wander off. Unlike heroes, they obey.'
  },
  tower: {
    id: 'tower', name: 'Watch Tower', fw: 1, fh: 1, hp: 440,
    cost: { gold: 90, wood: 20, stone: 80 }, build: 10, needs: ['mining_camp'],
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
export const XP_TABLE = [0, 50, 145, 320, 620];
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
  },
  // ---- the far reaches: everything past the ogres -------------------
  // `regen` heals per second (not while burning); `soak` is the share of
  // harm that gets through; `venom` slows whoever it bites for that long;
  // `ranged` + `bolt` + `splash` make a caster of it.
  spider: {
    /**
     * The spider's trick is the venom, not the raw output -- but at 26 a bite
     * every three quarters of a second it quietly had the second highest
     * damage per second in the game, on the fastest legs, against a party it
     * had already slowed so they could not walk away from it. Five of them
     * wiped a rank-capped party fifteen times in sixteen. It now bites for a
     * shade less, a third less often, and the venom does the work.
     */
    id: 'spider', name: 'Giant Spider', hp: 300, dmg: 22, rate: 1.0, range: 14, speed: 42,
    sight: 9, gold: 110, xp: 100, sprite: 'spider', aggro: 240, raid: true, venom: 3,
    desc: 'Fast, and bites often. The venom slows whoever it gets its fangs into.'
  },
  troll: {
    id: 'troll', name: 'Troll', hp: 400, dmg: 36, rate: 1.55, range: 17, speed: 27,
    sight: 9, gold: 130, xp: 120, sprite: 'troll', aggro: 240, raid: true, big: true, regen: 5,
    desc: 'Knits itself back together as you cut it. Fire stops that.'
  },
  /**
   * The wraith's trick is supposed to be that steel goes THROUGH it. It was
   * also quietly carrying the highest damage per second in the game -- 42 a
   * blow every 1.1 seconds, faster than anything could walk away from -- so
   * five of them wiped a rank-capped party fourteen times in sixteen. The
   * soak is the point and stays; the damage comes down to a shade over an
   * ogre's, which is still a nightmare without being a formality.
   */
  wraith: {
    id: 'wraith', name: 'Wraith', hp: 260, dmg: 30, rate: 1.35, range: 16, speed: 38,
    sight: 11, gold: 140, xp: 130, sprite: 'wraith', aggro: 260, raid: true, soak: 0.7,
    desc: 'Half here. Steel goes through it as often as into it, and it is quicker than you.'
  },
  /**
   * The blood cultist was the worst thing in the game and not in a good way.
   * At day 30 it carried more health than a rank-capped warrior, twice the
   * damage, splash that hit the whole party at once, and a reach of 92 --
   * longer than a ranger's bow. Five of them deleted a full party in twenty
   * seconds and the party could not kill a single one. The only counterplay
   * was throwing gold at reward flags until enough bodies arrived.
   *
   * It is still the caster that punishes a clumped party, but the damage now
   * arrives as a fire that BURNS rather than a blow that lands: about a third
   * of the old hit up front and the rest over four seconds, which is a window
   * to break line of sight, heal it off, or kill the thing casting it. The
   * reach is now shorter than a bow, so a ranger out-ranges it -- that is the
   * counterplay the old one never had.
   */
  cultist: {
    id: 'cultist', name: 'Blood Cultist', hp: 280, dmg: 22, rate: 2.1, range: 64, speed: 30,
    sight: 11, gold: 150, xp: 140, sprite: 'cultist', aggro: 280, raid: true,
    ranged: true, bolt: 'blood', splash: 14,
    burn: { frac: 0.5, lasts: 4 },
    desc: 'Throws blood-fire that sticks and keeps burning, and it lands on everyone standing together. Out-ranged by a bow.'
  },
  drake: {
    id: 'drake', name: 'Drake', hp: 560, dmg: 46, rate: 1.9, range: 46, speed: 34,
    sight: 12, gold: 240, xp: 220, sprite: 'drake', aggro: 300, raid: true, big: true,
    ranged: true, bolt: 'fire', splash: 24,
    desc: 'Breathes fire over a whole line at once. The worst thing on the map that is not a boss.'
  }
};

/**
 * ===================================================================
 * MODES -- chosen once, before the realm is raised.
 * ===================================================================
 *
 * The far reaches and the boss waves were written for a party that takes a
 * whole campaign to gather, so they are not the default game. Easy is the
 * realm as it was, up to the ogres. Hard keeps that map and makes the raids
 * mean it. Endgame is the wide map with everything past the ogres awake.
 */
export const MODES = {
  easy: {
    id: 'easy', name: 'Easy', colour: '#7fd8a0', mapSize: 96, far: false, raids: 'classic',
    blurb: 'The realm as it was. Four kinds of camp, the ogre den at the far end, and raids you can meet in the field. Clear the map and the realm is yours.'
  },
  hard: {
    id: 'hard', name: 'Hard', colour: '#ffc94a', mapSize: 96, far: false, raids: 'waves',
    finale: true,
    blurb: 'The same map, but the raids mean it: bigger, mixed, and every third one led by a boss with an escort -- and razing the last camp wakes what was sleeping under it.'
  },
  endgame: {
    id: 'endgame', name: 'Endgame', colour: '#ff5a5a', mapSize: 120, far: true, raids: 'waves',
    finale: true,
    blurb: 'A wider realm and five camps past the ogres, each worse than the last -- their bosses come for you, and razing the last camp wakes what was sleeping under it.'
  }
};
export const MODE_ORDER = ['easy', 'hard', 'endgame'];
export const DEFAULT_MODE = 'easy';

/**
 * Bosses. Every third raid is led by one: a named champion of the camp it
 * came from, worth a fortune and carrying something. The multipliers sit on
 * top of the ordinary monster and on top of the day's threat, so a day-30
 * boss is a genuine event rather than a fat goblin.
 */
export const BOSS = {
  every: 3,          // raids per boss wave
  bonus: 12,         // attribute points over an ordinary one of its kind
  hpMul: 2.4, dmgMul: 1.5, goldMul: 4, xpMul: 4,
  escort: 2,         // extra ordinary raiders marching with it
  raidTime: 170,     // seconds it keeps coming before giving up (ordinary: 75)
  drop: { count: 2, bias: 2.0, tier: 'legendary' },   // one legendary, always, plus one more
  names: {
    rat: 'Rat King', slime: 'Great Ooze', goblin: 'Goblin Warlord', skeleton: 'Bone Lord',
    ogre: 'Ogre Chieftain', demon: 'Archfiend', spider: 'Brood Mother', troll: 'Troll King',
    wraith: 'Wraith Lord', cultist: 'High Priest', drake: 'Elder Drake'
  }
};

/**
 * The finale, on Hard and Endgame. Razing the last camp does not win the realm:
 * it takes the roof off whatever the camps were built over, and it comes for
 * your City Centre and does not get bored and go home. Everything you did
 * before this was the preparation.
 *
 * Rename it to taste -- this is the only place the name is written.
 */
/**
 * Tuned against parties that actually exist, at the day one actually arrives
 * on. Eight level-5 heroes in epic loot take it six times in eight and bury
 * half of them over about forty seconds; the same eight with nothing on take
 * it three times in eight; six heroes are a coin flip geared and hopeless
 * bare. So the loot from those fourteen camps is the difference, which is
 * the point of having gone and got it.
 *
 * Damage is the dial, not health: it decides whether the cleric can keep up,
 * and it is what turns a long fight into a wipe. More `hpMul` makes the
 * fight longer; more `dmgMul` makes it shorter and lost. Change that one
 * last, and a tenth at a time.
 */
export const DRAGON = {
  name: 'The Great Wyrm',
  title: 'the last thing left alive',
  spawn: 'drake',      // what it is, before the multipliers
  bonus: 30,           // attribute points over an ordinary drake
  hpMul: 6, dmgMul: 1.1,
  goldMul: 12, xpMul: 10,
  escort: 1,           // a drake comes up with it
  reward: 6000,        // the realm's purse for killing it
  drop: { count: 3, bias: 3.0, tier: 'legendary' }
};

/**
 * Raids grow with the days and, past a point, with the map: once the realm
 * is old enough, the far camps march too, whether or not you have built
 * toward them, and a raid can bring two kinds of monster at once.
 */
export const RAID = {
  minSize: 2, maxSize: 7, growEvery: 3,   // size = minSize + (days since peace) / growEvery
  mixedDay: 10,        // from this day a raid may draw a second kind from another camp
  farDay: 18,          // from this day any woken camp may raid, near or not
  farChance: 0.35,     // ...this often
  // A wave that finds nobody to send is not a quiet day earned, it is a wave
  // wasted: it used to reset the full timer and the realm simply went silent
  // for three minutes with nothing on screen to say why.
  retry: 20            // seconds until a wave that found no camp tries again
};

/**
 * `wake` is the day a lair stirs on its own. Seeing one wakes it early --
 * poke the nest and the nest pokes back, exactly as it should be.
 */
export const LAIRS = {
  rat: { id: 'rat', name: 'Rat Nest', hp: 380, spawn: 'rat', every: 18, max: 4, garrison: 3, reward: 140, prop: 'lair_rat', xp: 40, wake: 2 },
  goblin: { id: 'goblin', name: 'Goblin Camp', hp: 820, spawn: 'goblin', every: 17, max: 5, garrison: 4, reward: 320, prop: 'lair_goblin', xp: 90, wake: 6 },
  skeleton: { id: 'skeleton', name: 'Haunted Graveyard', hp: 1300, spawn: 'skeleton', every: 18, max: 5, garrison: 4, reward: 640, prop: 'lair_skeleton', xp: 170, wake: 11 },
  ogre: { id: 'ogre', name: 'Ogre Den', hp: 1900, spawn: 'ogre', every: 22, max: 3, garrison: 3, reward: 1150, prop: 'lair_ogre', xp: 320, wake: 16 },
  // the far reaches -- every one of these is a bigger ask than the ogre den
  spider: { id: 'spider', name: 'Spider Hollow', hp: 2200, spawn: 'spider', every: 16, max: 5, garrison: 4, reward: 1500, prop: 'lair_spider', xp: 400, wake: 20 },
  troll: { id: 'troll', name: 'Troll Warren', hp: 2500, spawn: 'troll', every: 24, max: 3, garrison: 3, reward: 1700, prop: 'lair_troll', xp: 440, wake: 22 },
  wraith: { id: 'wraith', name: 'Wraith Barrow', hp: 2600, spawn: 'wraith', every: 20, max: 4, garrison: 3, reward: 1900, prop: 'lair_wraith', xp: 480, wake: 24 },
  cultist: { id: 'cultist', name: 'Blood Shrine', hp: 2600, spawn: 'cultist', every: 20, max: 4, garrison: 3, reward: 2100, prop: 'lair_cultist', xp: 520, wake: 26 },
  drake: { id: 'drake', name: 'Drake Roost', hp: 3300, spawn: 'drake', every: 28, max: 3, garrison: 2, reward: 2900, prop: 'lair_drake', xp: 720, wake: 30 }
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
  demon: { chance: 0.55, bias: 1.4 },
  spider: { chance: 0.42, bias: 1.0 },
  troll: { chance: 0.48, bias: 1.2 },
  wraith: { chance: 0.5, bias: 1.3 },
  cultist: { chance: 0.52, bias: 1.4 },
  drake: { chance: 0.65, bias: 1.8 }
};
/** Shelf size and how often a new thing appears on it. */
export const MARKET_SLOTS = 5;
export const MARKET_RESTOCK = 22;

/** A razed camp always coughs something up, and the big ones cough up well. */
export const LAIR_DROPS = {
  rat: { count: 1, bias: 0.2 },
  goblin: { count: 1, bias: 0.6 },
  skeleton: { count: 2, bias: 1.0 },
  ogre: { count: 2, bias: 1.8 },
  spider: { count: 2, bias: 2.0 },
  troll: { count: 2, bias: 2.2 },
  wraith: { count: 3, bias: 2.3 },
  cultist: { count: 3, bias: 2.4 },
  drake: { count: 3, bias: 3.0 }
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
/**
 * How much of the day's threat a monster spends on STRENGTH.
 *
 * Threat used to buy all four attributes at full rate, which -- once damage
 * per point of strength was raised to make a veteran hero feel like one --
 * made a day-30 raider hit harder than anything could survive. The passage
 * of time now makes a monster harder to PUT DOWN rather than quicker to kill
 * you: constitution, agility and intelligence climb at the full rate, and
 * strength at this share of it.
 */
export const THREAT_STR_SHARE = 0.5;

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
  goldmine: { res: 'gold', rate: 0.6, carry: 12 },
  quarry: { res: 'stone', rate: 1.4, carry: 20 },
  tree: { res: 'wood', rate: 1.8, carry: 20 },
  pine: { res: 'wood', rate: 1.8, carry: 20 }
};

export const START = { gold: 420, wood: 260, stone: 140 };
export const DAY_SECONDS = 60;      // one in-game day
export const TAX_INTERVAL = 12;     // seconds between tax collections

/**
 * ===================================================================
 * GOLD SINKS -- things worth spending the treasury on.
 * ===================================================================
 *
 * An army does not draw a wage. Gold that piles up is spent on choices
 * instead: drilling a guild so its recruits arrive ranked and it holds one
 * more of them, and fortifying a building so it stands where it would have
 * fallen. Both are one-way, and both are decisions rather than a bill.
 */
export const GUILD_TIERS = [
  { name: 'Drilled', cost: 220, level: 2, slots: 1,
    desc: 'Recruits arrive at level 2, and the guild holds one more.' },
  { name: 'Veteran', cost: 520, level: 3, slots: 2,
    desc: 'Recruits arrive at level 3, and the guild holds two more.' }
];
/**
 * DEPOT UPGRADES.
 *
 * A lumberyard or a mining camp used to be a thing you put down once and
 * then never thought about again: it was as good on day forty as on day
 * nine, so the only way to gather faster was to put down another one. These
 * are the same decision a guild's drilling is -- gold, spent once, on a
 * building you already own, to make the ground you already hold worth more
 * than the ground you would have to go and take.
 *
 * `boostMul` multiplies whatever the depot's own `boost` is, `radius` adds
 * tiles to its reach, and `tax` is added to what it pays every payday.
 */
export const DEPOT_TIERS = [
  { name: 'Yard', cost: 200, boostMul: 1.55, radius: 3, tax: 3,
    desc: 'Half again the speed, three tiles further, and it pays more tax.' },
  { name: 'Works', cost: 460, boostMul: 2.2, radius: 6, tax: 8,
    desc: 'More than double the speed, six tiles further, and a serious income.' }
];

export const FORTIFY = {
  hpMul: 1.5,         // max health, and repaired to full
  towerDmgMul: 1.4,   // a fortified tower also hits harder
  extraGuard: 1,      // a fortified guard house keeps one more
  costPerHp: 0.25, costBase: 40,   // price: a quarter of the building's health in gold, plus this
  desc: 'Half again the health, repaired to full. A tower shoots harder; a guard house keeps a fourth guard.'
};
export const RESURRECT_COST = 0.6;  // fraction of hire cost to raise a dead hero
/**
 * Swinging at a building is not the same as swinging at a throat. Halving
 * structure damage gives sieges -- in both directions -- time to matter.
 */
export const STRUCTURE_DMG = 0.5;

/**
 * WARBAND — courage is a group property.
 *
 * Self-preservation used to be a sum over everything breathing within a
 * radius, which made two camps pitched near each other permanently
 * unattackable: neither could be taken without taking both, and nobody was
 * ever brave enough for both. Two things fix that, and both are things
 * soldiers actually do.
 *
 * First, only the people who would genuinely be in the fight count. A camp's
 * own garrison always would. The camp next door only joins if the brawl
 * reaches it, and then it arrives in ones and twos rather than as one wall,
 * which is what `spill` is for.
 *
 * Second, heroes hype each other. Every comrade who has declared for the same
 * camp makes the rest braver, and a high-level hero at the front of the crowd
 * is worth several ordinary ones, because people follow somebody who looks
 * like they have done this before. A hero who wants a camp but has not got
 * the numbers musters outside it and waits instead of wandering off -- which
 * is what lets the numbers ever arrive.
 */
export const WARBAND = {
  join: 0.26,        // nerve each comrade who has declared for the camp adds
  cap: 2.4,          // ...but a mob is only so much braver than a pair
  leader: 0.16,      // extra nerve per level a comrade has over this hero
  leaderCap: 0.8,
  spill: 0.55,       // weight of a NEIGHBOURING camp's garrison in the sum
  fade: 3,           // tiles over which a fight stops carrying to bystanders
  wall: 0.3,         // weight of the camp's own hp: a wall you break under fire
  reach: 34,         // tiles: how far off a comrade still counts as coming
  rallyAt: 0.45,     // muster rather than leave when this close to brave enough
  declared: 1.12,    // nerve for having already said you are in
  resolve: 1.3,      // ...and more for having already set off
  stand: 11,         // tiles from the camp a warband forms up (aggro permitting)
  patience: 38,      // seconds a hero waits for the others before giving up
  shun: 55,          // ...and how long they then leave that camp alone
  goldCap: 3,        // how much nerve a full-price bounty is worth
  price: 1.1,        // gold per point of threat that buys a hero outright
  floor: 120         // ...with a floor, so a rat nest is not bought for pennies
};
