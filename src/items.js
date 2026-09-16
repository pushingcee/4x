// ===================================================================
// items.js — loot: what drops, what it is called, and who wants it.
//
// An item is a small bag of attribute points plus at most one modifier,
// wrapped in a name. Heroes judge them on their own terms -- a warrior
// weighs strength heavily and intelligence not at all -- so the same
// pendant is a prize to one and junk to another.
// ===================================================================
import { STATS, STAT_ORDER } from './data.js';

/** Where a thing is worn. Two ears and two ring fingers, as usual. */
export const SLOTS = {
  weapon: { id: 'weapon', name: 'Weapon', keys: ['weapon'] },
  chest: { id: 'chest', name: 'Chest', keys: ['chest'] },
  neck: { id: 'neck', name: 'Neck', keys: ['neck'] },
  ear: { id: 'ear', name: 'Earring', keys: ['ear1', 'ear2'] },
  ring: { id: 'ring', name: 'Ring', keys: ['ring1', 'ring2'] }
};
/** The equipment sheet, in the order it is shown. */
export const SLOT_KEYS = ['weapon', 'chest', 'neck', 'ear1', 'ear2', 'ring1', 'ring2'];
export const slotOf = (key) => key.replace(/[12]$/, '');

/**
 * Weapons are class-locked. A wizard cannot swing an axe and a warrior has
 * no idea what to do with a wand, so loot that lands in the wrong hands is
 * simply sold rather than silently wasted.
 */
export const WEAPONS = {
  sword: { id: 'sword', name: 'Sword', dmg: 1.0 },
  axe: { id: 'axe', name: 'Axe', dmg: 1.25, flat: true },
  dagger: { id: 'dagger', name: 'Dagger', dmg: 0.8, crit: true },
  staff: { id: 'staff', name: 'Staff', dmg: 1.0, caster: true },
  wand: { id: 'wand', name: 'Wand', dmg: 0.85, caster: true }
};

/**
 * Who may hold what. Rangers carry a blade for the specialisations that get
 * in close: the assassin takes swords, the mercenary daggers.
 */
export const CLASS_WEAPONS = {
  warrior: ['sword', 'axe'],
  ranger: ['sword', 'dagger'],
  wizard: ['staff', 'wand'],
  cleric: ['staff', 'wand']
};
export const SPEC_WEAPONS = {
  assassin: ['sword'],
  mercenary: ['dagger']
};

/**
 * What each class is actually trying to get more of, in the order it cares.
 * Everything a hero does with loot -- equipping, buying, selling -- comes out
 * of these weights and nothing else.
 */
export const CLASS_WEIGHTS = {
  warrior: { str: 1.0, con: 0.7, agi: 0.45, int: 0.05 },
  ranger: { agi: 1.0, str: 0.6, con: 0.4, int: 0.1 },
  wizard: { int: 1.0, con: 0.55, agi: 0.2, str: 0.05 },
  cleric: { int: 1.0, con: 0.6, agi: 0.2, str: 0.05 },
  guard: { con: 1.0, str: 0.8, agi: 0.3, int: 0.05 },
  peasant: { con: 0.6, str: 0.6, agi: 0.6, int: 0.6 }
};

/** A ranger who never closes to melee has no use for strength. */
export function weightsFor(u) {
  const base = CLASS_WEIGHTS[u.kind] || CLASS_WEIGHTS.peasant;
  if (u.kind === 'ranger' && u.spec === 'longbow') return { ...base, str: 0.25 };
  return base;
}

export const TIERS = {
  common: { id: 'common', name: 'Common', colour: '#c9c2d8', rank: 0, weight: 62, value: 30 },
  rare: { id: 'rare', name: 'Rare', colour: '#6fb6ff', rank: 1, weight: 27, value: 90 },
  epic: { id: 'epic', name: 'Epic', colour: '#b46fff', rank: 2, weight: 9, value: 240 },
  legendary: { id: 'legendary', name: 'Legendary', colour: '#ffa030', rank: 3, weight: 2, value: 650 }
};
export const TIER_ORDER = ['common', 'rare', 'epic', 'legendary'];

/**
 * Modifiers, the part that is not simply attributes. Weapons lean toward
 * doing harm; jewellery toward mana and mischief. Spell power is legendary
 * only, which is what makes a legendary staff worth crossing a map for.
 */
export const MODS = {
  dmg: { id: 'dmg', name: 'Damage', fmt: (v) => `+${v} damage` },
  mana: { id: 'mana', name: 'Mana', fmt: (v) => `+${v} mana` },
  spell: { id: 'spell', name: 'Spell Power', fmt: (v) => `+${v}% spell damage and healing` },
  lifesteal: { id: 'lifesteal', name: 'Lifesteal', fmt: (v) => `${v}% of damage dealt drunk back` },
  crit: { id: 'crit', name: 'Critical', fmt: (v) => `+${v}% critical chance` }
};

// -------------------------------------------------------------------
// naming
// -------------------------------------------------------------------
const BASE_NAMES = {
  sword: ['Longsword', 'Broadsword', 'Claymore', 'Sabre', 'Falchion'],
  axe: ['Battleaxe', 'Cleaver', 'Bardiche', 'Hatchet', 'Waraxe'],
  dagger: ['Dirk', 'Stiletto', 'Kris', 'Shiv', 'Poniard'],
  staff: ['Oaken Staff', 'Runed Stave', 'Gnarled Branch', 'Pilgrim Staff'],
  wand: ['Willow Wand', 'Bone Wand', 'Glass Rod', 'Ash Switch'],
  chest: ['Chainmail', 'Brigandine', 'Scale Hauberk', 'Padded Vest', 'Cuirass'],
  neck: ['Pendant', 'Torc', 'Amulet', 'Locket', 'Choker'],
  ear: ['Earring', 'Hoop', 'Stud', 'Drop'],
  ring: ['Band', 'Signet', 'Circlet Ring', 'Loop']
};

/** Suffixes read off the stat the thing is best at. */
const SUFFIX = {
  str: ['of the Bear', 'of the Ox', 'of Brute Force', 'of the Ram'],
  agi: ['of the Dashing', 'of the Fox', 'of Swift Feet', 'of the Hare'],
  con: ['of the Mountain', 'of the Boar', 'of Stone Hide', 'of the Oak'],
  int: ['of the Sage', 'of the Owl', 'of Quiet Study', 'of the Moon']
};
const MOD_SUFFIX = {
  dmg: ['of Cruelty', 'of the Executioner'],
  mana: ['of the Wellspring', 'of Deep Waters'],
  spell: ['of the Archmage', 'of Burning Words'],
  lifesteal: ['of the Leech', 'of Red Thirst'],
  crit: ['of the Hawk', 'of the Keen Edge']
};
/** Epics get a name in front as well, so they read as somebody's work. */
const EPIC_PREFIX = ['Grim', 'Hollow', 'Gilded', 'Ashen', 'Storm', 'Thorn', 'Ember', 'Pale'];

/** Legendaries are named things, not descriptions. */
const LEGENDARY_NAMES = {
  sword: ['Serathil', 'Kelen’s Dagger of Escape', 'Mournblade', 'The Widowmaker'],
  axe: ['Stonewood Cleaver', 'The Butcher’s Promise', 'Ironhowl'],
  dagger: ['Whisper', 'The Quiet Argument', 'Nightsliver'],
  staff: ['Alleria’s Burden', 'The Long Reckoning', 'Starwood'],
  wand: ['The Last Word', 'Emberquill'],
  chest: ['The Ninth Hauberk', 'Coat of the Drowned King'],
  neck: ['The Sunless Locket', 'Heartstring'],
  ear: ['The Listening Stone', 'Gallowdrop'],
  ring: ['The Unbroken Circle', 'Widow’s Band']
};

const FLAVOUR = [
  'Taken from a tomb nobody admits to opening.',
  'The smith who made it was never paid, and said so at length.',
  'Older than the realm, and in better condition.',
  'It was buried for a reason. The reason has been forgotten.',
  'Won in a wager. The other party did not survive settling it.',
  'Three owners so far. None of them retired.',
  'Still warm, which is the part nobody likes to mention.',
  'Whoever carried it last walked a very long way to put it down.',
  'The engraving is a name. It is not the name of the maker.',
  'It hums, faintly, when there is killing to be done.'
];

// -------------------------------------------------------------------
// generation
// -------------------------------------------------------------------
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];
const rint = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

/** Attribute points a tier is worth, before it is split between stats. */
const TIER_POINTS = { common: [2, 4], rare: [5, 8], epic: [9, 13], legendary: [14, 19] };

/**
 * Roll one item. `tierBias` nudges richer monsters toward better loot without
 * ever guaranteeing it -- an ogre is likelier to be carrying something worth
 * having, not certain to be.
 */
export function rollItem(rng, { slot, tier, tierBias = 0, weaponType } = {}) {
  const slotId = slot || pick(rng, ['weapon', 'chest', 'neck', 'ear', 'ring']);
  const t = tier || rollTier(rng, tierBias);
  const def = TIERS[t];
  const wt = slotId === 'weapon'
    ? (weaponType || pick(rng, Object.keys(WEAPONS)))
    : null;

  // the attribute points, split one or two ways
  const [lo, hi] = TIER_POINTS[t];
  let budget = rint(rng, lo, hi);
  const stats = { str: 0, agi: 0, con: 0, int: 0 };
  const twoStats = def.rank >= 2 || (def.rank === 1 && rng() < 0.5);
  const first = pick(rng, STAT_ORDER);
  if (twoStats) {
    let second = pick(rng, STAT_ORDER.filter(k => k !== first));
    const share = Math.max(1, Math.round(budget * (0.35 + rng() * 0.2)));
    stats[second] = share;
    stats[first] = budget - share;
  } else {
    stats[first] = budget;
  }

  // the modifier: always on epic and above, sometimes on a weapon below it
  const mods = {};
  const wantsMod = def.rank >= 2 || (wt && rng() < 0.35);
  if (wantsMod) {
    const kind = rollMod(rng, wt, def.rank);
    mods[kind] = modAmount(rng, kind, def.rank, wt);
  }

  const it = {
    id: Math.floor(rng() * 1e9),
    slot: slotId, weapon: wt, tier: t,
    stats, mods,
    value: Math.round(def.value * (0.75 + rng() * 0.5))
  };
  it.name = nameFor(rng, it, first);
  if (def.rank >= 2) it.flavour = pick(rng, FLAVOUR);
  return it;
}

function rollTier(rng, bias) {
  // bias shifts weight from the common end toward the rare end
  const w = TIER_ORDER.map(id => {
    const base = TIERS[id].weight;
    return Math.max(0.2, base * (1 + bias * TIERS[id].rank) / (1 + bias * 0.9));
  });
  let total = 0;
  for (const x of w) total += x;
  let r = rng() * total;
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return TIER_ORDER[i]; }
  return 'common';
}

function rollMod(rng, weaponType, rank) {
  const pool = [];
  if (weaponType) {
    const w = WEAPONS[weaponType];
    if (w.flat) pool.push('dmg', 'dmg');          // axes hit flatly harder
    if (w.crit) pool.push('crit', 'crit');        // daggers find the gap
    if (w.caster) pool.push('mana', rank >= 3 ? 'spell' : 'mana');
    pool.push('dmg', 'lifesteal');
  } else {
    pool.push('mana', 'crit', 'lifesteal');
    if (rank >= 3) pool.push('spell');
  }
  const kind = pick(rng, pool);
  // spell power is a legendary privilege wherever it turns up
  return (kind === 'spell' && rank < 3) ? 'mana' : kind;
}

function modAmount(rng, kind, rank, weaponType) {
  const scale = 1 + rank * 0.8;
  switch (kind) {
    case 'dmg': {
      const w = weaponType ? WEAPONS[weaponType].dmg : 1;
      return Math.max(1, Math.round(rint(rng, 2, 4) * scale * w));
    }
    case 'mana': return Math.round(rint(rng, 8, 16) * scale);
    case 'spell': return rint(rng, 12, 25);
    case 'lifesteal': return rint(rng, 3, 5) + rank * 2;
    case 'crit': return rint(rng, 2, 4) + rank;
    default: return 1;
  }
}

function nameFor(rng, it, mainStat) {
  const baseList = BASE_NAMES[it.weapon || it.slot] || BASE_NAMES.ring;
  const base = pick(rng, baseList);
  const rank = TIERS[it.tier].rank;
  if (rank >= 3) {
    const named = LEGENDARY_NAMES[it.weapon || it.slot];
    if (named) return pick(rng, named);
  }
  const modKind = Object.keys(it.mods)[0];
  const suffix = modKind && rng() < 0.5
    ? pick(rng, MOD_SUFFIX[modKind] || SUFFIX[mainStat])
    : pick(rng, SUFFIX[mainStat] || SUFFIX.str);
  if (rank >= 2) return `${pick(rng, EPIC_PREFIX)} ${base} ${suffix}`;
  if (rank >= 1) return `${base} ${suffix}`;
  return `${base} ${suffix}`;
}

// -------------------------------------------------------------------
// judging
// -------------------------------------------------------------------
/** Can this unit even use it? Weapons are class-locked; the rest is not. */
export function canUse(u, item) {
  if (!item) return false;
  if (item.slot !== 'weapon') return true;
  const allowed = (u.spec && SPEC_WEAPONS[u.spec]) || CLASS_WEAPONS[u.kind];
  return !!allowed && allowed.includes(item.weapon);
}

/**
 * What an item is worth TO THIS HERO. Attributes are weighted by what the
 * class cares about; modifiers are weighted by whether they can use them --
 * spell power is worthless to a warrior and lifesteal near enough worthless
 * to somebody who never lands a blow.
 */
export function scoreFor(u, item) {
  if (!item || !canUse(u, item)) return 0;
  const w = weightsFor(u);
  let score = 0;
  for (const k of STAT_ORDER) score += (item.stats[k] || 0) * (w[k] || 0);
  const caster = !!u.def.heal || u.kind === 'wizard';
  const m = item.mods || {};
  if (m.dmg) score += m.dmg * (caster ? 0.3 : 1.1);
  if (m.mana) score += m.mana * (caster ? 0.25 : 0.02);
  if (m.spell) score += m.spell * (caster ? 1.1 : 0.05);
  if (m.lifesteal) score += m.lifesteal * (caster ? 0.2 : 1.0);
  if (m.crit) score += m.crit * 0.8;
  return score;
}

/** A plain reading of the item, for the sheet and for the shop. */
export function describe(item) {
  const bits = [];
  for (const k of STAT_ORDER) {
    if (item.stats[k]) bits.push(`+${item.stats[k]} ${STATS[k].short}`);
  }
  for (const k in item.mods) bits.push(MODS[k].fmt(item.mods[k]));
  return bits.join(' · ');
}

export const tierColour = (item) => TIERS[item.tier].colour;
