// ===================================================================
// data.js — all the balance numbers in one readable place.
// ===================================================================

export const COST_KEYS = ['gold', 'wood', 'stone'];

/**
 * Buildings. `fw/fh` footprint in tiles. `needs` gates the build menu.
 * `role` drives behaviour: depot, guild, shop, defence, housing.
 */
export const BUILDINGS = {
  palace: {
    id: 'palace', name: 'City Centre', fw: 3, fh: 3, hp: 2400,
    cost: { gold: 0, wood: 0, stone: 0 }, build: 0, unique: true,
    pop: 6, depot: true, tax: 2, sight: 12,
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
    desc: 'Drop-off for timber. Peasants cutting wood nearby haul 60% more.'
  },
  mining_camp: {
    id: 'mining_camp', name: 'Mining Camp', fw: 2, fh: 2, hp: 340,
    cost: { gold: 70, wood: 40, stone: 0 }, build: 9,
    depot: true, boost: { gold: 0.5, stone: 0.5 }, radius: 11,
    desc: 'Drop-off for ore and stone. Nearby miners work 50% faster.'
  },
  marketplace: {
    id: 'marketplace', name: 'Marketplace', fw: 2, fh: 2, hp: 380,
    cost: { gold: 130, wood: 70, stone: 20 }, build: 12, needs: ['palace'],
    tax: 4, shop: 'potion',
    desc: 'Heroes spend their loot here and you tax every coin. Sells healing potions.'
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
  warriors_guild: {
    id: 'warriors_guild', name: 'Warriors Guild', fw: 2, fh: 2, hp: 620,
    cost: { gold: 170, wood: 90, stone: 40 }, build: 16, needs: ['palace'],
    guild: 'warrior', maxHeroes: 3,
    desc: 'Recruits Warriors: tough, brave, cheap to please. They charge anything.'
  },
  rangers_guild: {
    id: 'rangers_guild', name: 'Rangers Guild', fw: 2, fh: 2, hp: 520,
    cost: { gold: 160, wood: 110, stone: 10 }, build: 15, needs: ['palace'],
    guild: 'ranger', maxHeroes: 3,
    desc: 'Recruits Rangers: fast, greedy scouts who will chase any flag for coin.'
  },
  wizards_guild: {
    id: 'wizards_guild', name: 'Wizards Guild', fw: 2, fh: 2, hp: 500,
    cost: { gold: 240, wood: 80, stone: 90 }, build: 20, needs: ['marketplace'],
    guild: 'wizard', maxHeroes: 2,
    desc: 'Recruits Wizards: devastating at range, fragile, and prone to running away.'
  },
  temple: {
    id: 'temple', name: 'Temple', fw: 2, fh: 2, hp: 560,
    cost: { gold: 220, wood: 90, stone: 70 }, build: 19, needs: ['marketplace'],
    guild: 'cleric', maxHeroes: 2, resurrect: 0.5,
    desc: 'Recruits Clerics who heal the wounded, and halves the cost of raising the dead.'
  },
  guardhouse: {
    id: 'guardhouse', name: 'Guard House', fw: 2, fh: 2, hp: 600,
    cost: { gold: 110, wood: 60, stone: 40 }, build: 12, needs: ['palace'],
    garrison: 3, garrisonRange: 150,
    desc: 'Two guards patrol nearby and never wander off. Unlike heroes, they obey.'
  },
  tower: {
    id: 'tower', name: 'Watch Tower', fw: 1, fh: 1, hp: 440,
    cost: { gold: 90, wood: 20, stone: 80 }, build: 10, needs: ['palace'],
    attack: { dmg: 20, range: 100, rate: 1.2 }, sight: 10,
    desc: 'Shoots bolts at anything hostile in range. Also lifts the fog around it.'
  }
};

export const BUILD_ORDER = ['hut', 'lumberyard', 'mining_camp', 'marketplace', 'inn', 'blacksmith',
  'warriors_guild', 'rangers_guild', 'temple', 'wizards_guild', 'guardhouse', 'tower'];

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
    id: 'peasant', name: 'Peasant', hp: 34, dmg: 3, rate: 1.2, range: 12, speed: 30,
    sight: 6, cost: { gold: 30 }, greed: 0, courage: 0, wander: 6, pop: 1,
    desc: 'Digs, chops, builds, repairs, panics.'
  },
  warrior: {
    id: 'warrior', name: 'Warrior', hp: 130, dmg: 14, rate: 0.85, range: 14, speed: 33,
    sight: 8, cost: { gold: 115 }, greed: 0.55, courage: 0.22, wander: 17, pop: 0,
    xpMul: 1, desc: 'Melee bruiser. Brave to the point of stupidity.'
  },
  ranger: {
    id: 'ranger', name: 'Ranger', hp: 84, dmg: 11, rate: 1.0, range: 86, speed: 44,
    sight: 11, cost: { gold: 105 }, greed: 0.9, courage: 0.4, wander: 30, pop: 0,
    ranged: true, desc: 'Scout and archer. Explores on her own, loves a bounty.'
  },
  wizard: {
    id: 'wizard', name: 'Wizard', hp: 66, dmg: 26, rate: 1.7, range: 100, speed: 29,
    sight: 9, cost: { gold: 180 }, greed: 0.7, courage: 0.55, wander: 14, pop: 0,
    ranged: true, splash: 26, desc: 'Fireballs from afar. Flees early, and rightly so.'
  },
  cleric: {
    id: 'cleric', name: 'Cleric', hp: 96, dmg: 9, rate: 1.2, range: 16, speed: 33,
    sight: 9, cost: { gold: 150 }, greed: 0.3, courage: 0.35, wander: 16, pop: 0,
    heal: { amount: 24, range: 80, rate: 2.0 }, desc: 'Heals wounded allies, smites the odd skeleton.'
  },
  guard: {
    id: 'guard', name: 'Guard', hp: 115, dmg: 11, rate: 1.0, range: 14, speed: 30,
    sight: 8, cost: { gold: 0 }, greed: 0, courage: 0.15, wander: 5, pop: 0,
    leash: 150, desc: 'Garrison soldier. Stays where you put him.'
  }
};

export const HERO_CLASSES = ['warrior', 'ranger', 'wizard', 'cleric'];

/** XP needed for each level beyond the first. */
export const XP_TABLE = [0, 30, 80, 165, 290, 460, 690, 1000, 1400, 1900];
export const LEVEL_HP = 0.22;   // +22% max hp per level
export const LEVEL_DMG = 0.18;  // +18% damage per level

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
    id: 'goblin', name: 'Goblin', hp: 50, dmg: 9, rate: 0.95, range: 13, speed: 34,
    sight: 8, gold: 16, xp: 12, sprite: 'goblin', aggro: 170, raid: true,
    desc: 'Raids buildings in packs. Will burn your huts given the chance.'
  },
  skeleton: {
    id: 'skeleton', name: 'Skeleton', hp: 76, dmg: 13, rate: 1.05, range: 13, speed: 29,
    sight: 9, gold: 30, xp: 24, sprite: 'skeleton', aggro: 200, raid: true,
    desc: 'Tireless undead soldier. Feels no fear and takes no prisoners.'
  },
  ogre: {
    id: 'ogre', name: 'Ogre', hp: 200, dmg: 27, rate: 1.5, range: 16, speed: 25,
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
  rat: { id: 'rat', name: 'Rat Nest', hp: 340, spawn: 'rat', every: 18, max: 3, reward: 110, prop: 'lair_rat', xp: 30, wake: 2 },
  goblin: { id: 'goblin', name: 'Goblin Camp', hp: 720, spawn: 'goblin', every: 17, max: 4, reward: 260, prop: 'lair_goblin', xp: 70, wake: 6 },
  skeleton: { id: 'skeleton', name: 'Haunted Graveyard', hp: 1150, spawn: 'skeleton', every: 19, max: 4, reward: 520, prop: 'lair_skeleton', xp: 130, wake: 11 },
  ogre: { id: 'ogre', name: 'Ogre Den', hp: 1700, spawn: 'ogre', every: 24, max: 3, reward: 950, prop: 'lair_ogre', xp: 260, wake: 16 }
};

/** No raids at all before this day: time to get a mine and a guild going. */
export const PEACE_DAYS = 4;

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

export const RES_RATE = {
  goldmine: { res: 'gold', rate: 1.1, carry: 12 },
  quarry: { res: 'stone', rate: 1.0, carry: 12 },
  tree: { res: 'wood', rate: 1.35, carry: 12 },
  pine: { res: 'wood', rate: 1.35, carry: 12 }
};

export const START = { gold: 420, wood: 260, stone: 140 };
export const DAY_SECONDS = 60;      // one in-game day
export const TAX_INTERVAL = 12;     // seconds between tax collections
export const RESURRECT_COST = 0.6;
/**
 * Swinging at a building is not the same as swinging at a throat. Halving
 * structure damage gives sieges -- in both directions -- time to matter.
 */
export const STRUCTURE_DMG = 0.5;  // fraction of hire cost to raise a dead hero
