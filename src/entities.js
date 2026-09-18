// ===================================================================
// entities.js — structures, units and projectiles.
// Behaviour lives in brains.js; this file is movement, combat, state.
// ===================================================================
import { TILE } from './art.js';
import { toPx, toTile } from './world.js';
import {
  BUILDINGS, CLASSES, MONSTERS, LAIRS, XP_TABLE, MAX_LEVEL, LEVEL_STATS,
  STAT_ORDER, STAT_EFFECT, RUSH_SPEED, LAIR_ALARM_RATE, LAIR_ALARM_TIME,
  SPECS, SPEC_LEVEL, POWERS, ABILITIES, STEALTH_REVEAL, DEBUFF,
  GARRISON_NEAR, GARRISON_PER_RING, GARRISON_EXTRA_CAP,
  BLESSING, MANA_REGEN, MANA_REST, MANA_REGEN_PER_INT, XP_PER_HEAL, XP_PER_BLESSING, CREDIT_WINDOW
} from './data.js';
import { clamp, dist, heroName, peasantName } from './util.js';
import { SLOT_KEYS, slotOf, canUse, scoreFor } from './items.js';

let NEXT_ID = 1;
export const newId = () => NEXT_ID++;

// -------------------------------------------------------------------
// structures
// -------------------------------------------------------------------
class Structure {
  constructor(game, tx, ty, fw, fh, hp, faction) {
    this.game = game;
    this.id = newId();
    this.kindClass = 'structure';
    this.tx = tx; this.ty = ty; this.fw = fw; this.fh = fh;
    this.x = tx * TILE + (fw * TILE) / 2;
    this.y = ty * TILE + (fh * TILE) / 2;
    this.bottom = (ty + fh) * TILE;
    this.radius = (Math.max(fw, fh) * TILE) / 2;
    this.maxHp = hp; this.hp = hp;
    this.faction = faction;
    this.dead = false;
    this.hitFlash = 0;
  }
  occupy() {
    const w = this.game.world;
    for (let y = this.ty; y < this.ty + this.fh; y++)
      for (let x = this.tx; x < this.tx + this.fw; x++)
        if (w.inside(x, y)) w.occupied[w.idx(x, y)] = this.id;
  }
  release() {
    const w = this.game.world;
    for (let y = this.ty; y < this.ty + this.fh; y++)
      for (let x = this.tx; x < this.tx + this.fw; x++)
        if (w.inside(x, y) && w.occupied[w.idx(x, y)] === this.id) w.occupied[w.idx(x, y)] = -1;
  }
  /** A walkable tile touching this structure, for units that want to reach it. */
  adjacentTile() {
    const w = this.game.world;
    for (let r = 0; r < 3; r++) {
      for (let y = this.ty - 1 - r; y <= this.ty + this.fh + r; y++) {
        for (let x = this.tx - 1 - r; x <= this.tx + this.fw + r; x++) {
          if (w.passable(x, y)) return { x, y };
        }
      }
    }
    return w.nearestFree(this.tx, this.ty);
  }
  /** Walkable tile touching this structure, nearest to whoever is coming. */
  approach(from) {
    return this.game.world.approachTile(this.tx, this.ty, this.fw, this.fh,
      from ? from.x : this.x, from ? from.y : this.y);
  }
  damage(n, src) {
    if (this.dead) return;
    this.creditHit(src);
    this.hp -= n;
    this.hitFlash = 0.14;
    if (this.hp <= 0) { this.hp = 0; this.onDestroyed(src); }
  }
  /** Same shared-credit bookkeeping a unit keeps -- a camp is a group effort. */
  creditHit(src) {
    if (!src || src.kindClass !== 'unit' || src.faction !== 'realm') return;
    if (!this.credit) this.credit = new Map();
    this.credit.set(src, this.game.time);
  }
  contributors() {
    const out = [];
    if (!this.credit) return out;
    for (const [u, t] of this.credit) {
      if (u.dead || u.faction !== 'realm') continue;
      if (this.game.time - t > CREDIT_WINDOW) continue;
      out.push(u);
    }
    return out;
  }
  onDestroyed() { this.dead = true; }
}

export class Building extends Structure {
  constructor(game, defId, tx, ty, complete = false) {
    const def = BUILDINGS[defId];
    super(game, tx, ty, def.fw, def.fh, def.hp, 'realm');
    this.kindClass = 'building';
    this.defId = defId;
    this.def = def;
    this.complete = complete;
    this.progress = complete ? 1 : 0;
    this.hp = complete ? def.hp : Math.max(8, Math.round(def.hp * 0.12));
    this.cool = 0;
    this.heroIds = [];      // heroes belonging to this guild
    this.rally = null;
    this.builders = 0;
    this.spawnCool = 0;
    this.recruitQueue = [];
    this.occupy();
  }

  get name() { return this.def.name; }

  addProgress(amount) {
    if (this.complete) return;
    this.progress = clamp(this.progress + amount, 0, 1);
    this.hp = Math.max(this.hp, Math.round(this.def.hp * (0.12 + 0.88 * this.progress)));
    if (this.progress >= 1) {
      this.complete = true;
      this.hp = this.def.hp;
      this.game.onBuildingComplete(this);
    }
  }

  update(dt) {
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (!this.complete) return;
    if (this.def.market) this.game.restockMarket(this, dt);

    // watch towers shoot, and see in the dark
    if (this.def.attack) {
      this.cool -= dt;
      if (this.cool <= 0) {
        const foe = this.game.nearestEnemy(this.x, this.y, this.def.attack.range, 'realm');
        if (foe) {
          this.cool = this.def.attack.rate;
          this.game.spawnProjectile(this, foe, this.def.attack.dmg, 'bolt');
        }
      }
    }
    // guard houses keep their garrison topped up
    if (this.def.garrison) {
      this.spawnCool -= dt;
      const alive = this.game.units.filter(u => !u.dead && u.homeId === this.id).length;
      if (alive < this.def.garrison && this.spawnCool <= 0) {
        this.spawnCool = 14;
        const t = this.approach(null);
        const g = this.game.spawnUnit('guard', toPx(t.x), toPx(t.y), 'realm');
        g.homeId = this.id;
        g.homeX = this.x; g.homeY = this.y;
      }
    }
  }

  onDestroyed(src) {
    this.dead = true;
    this.release();
    this.game.onBuildingDestroyed(this, src);
  }
}

export class Lair extends Structure {
  constructor(game, kind, tx, ty) {
    const def = LAIRS[kind];
    super(game, tx, ty, 2, 2, def.hp, 'monster');
    this.kindClass = 'lair';
    this.lairKind = kind;
    this.def = def;
    this.spawnCool = def.every * (0.4 + Math.random() * 0.8);
    this.spawned = [];
    this.active = false;
    this.alarmLeft = 0;
    this.alarmCooldown = false;
    this.occupy();
  }
  get name() { return this.def.name; }

  update(dt) {
    if (this.hitFlash > 0) this.hitFlash -= dt;
    // a lair sleeps until you find it, or until it gets bored of waiting
    if (!this.active) {
      const g = this.game;
      const poked = g.someoneNear(this.x, this.y, 9 * TILE);
      if (this.wakeDay === undefined) {
        const away = Math.hypot(this.tx - g.world.start.x, this.ty - g.world.start.y);
        this.wakeDay = this.def.wake + Math.floor(away / 3);
      }
      if (poked || g.day >= this.wakeDay) {
        this.active = true;
        if (poked && g.day < this.def.wake) g.notify(`${this.def.name} has noticed you`, 'bad');
      } else return;
    }
    this.spawned = this.spawned.filter(u => !u.dead);
    // A camp under attack musters for a while, then runs out of bodies to
    // throw. The window has to end or the camp can never be taken.
    if (this.alarmLeft > 0) this.alarmLeft -= dt;
    this.spawnCool -= dt * (this.alarmLeft > 0 ? 1 / LAIR_ALARM_RATE : 1);
    if (this.spawnCool <= 0) {
      this.spawnCool = this.def.every * (0.75 + Math.random() * 0.5);
      if (this.spawned.length < this.def.max && this.game.monsterBudgetOk()) {
        const t = this.approach(null);
        const m = this.game.spawnUnit(this.def.spawn, toPx(t.x), toPx(t.y), 'monster');
        m.lair = this;
        this.spawned.push(m);
      }
    }
  }

  /**
   * Waking a lair fills it at once. A nest that only trickles out defenders
   * is a free trophy for the first hero who stumbles on it.
   */
  /** How many defenders this camp keeps standing, before it is ever provoked. */
  get garrisonSize() {
    const g = this.game;
    const away = Math.hypot(this.tx - g.world.start.x, this.ty - g.world.start.y);
    const beyond = Math.max(0, away - GARRISON_NEAR);
    const extra = Math.min(GARRISON_EXTRA_CAP, Math.floor(beyond / GARRISON_PER_RING));
    return Math.min(this.def.max, (this.def.garrison || 2) + extra);
  }

  /** Put defenders on the ground. Used for the standing guard and for waking. */
  muster(n) {
    const g = this.game;
    for (let i = this.spawned.filter(u => !u.dead).length; i < n; i++) {
      if (!g.monsterBudgetOk()) break;
      const t = this.approach(null);
      const m = g.spawnUnit(this.def.spawn, toPx(t.x) + (Math.random() - 0.5) * 12,
        toPx(t.y) + (Math.random() - 0.5) * 12, 'monster');
      m.lair = this;
      m.homeX = this.x; m.homeY = this.y;
      this.spawned.push(m);
    }
  }

  wake(announce) {
    if (this.active) return;
    this.active = true;
    const g = this.game;
    if (announce) g.notify(`${this.def.name} has noticed you`, 'bad');
    this.muster(this.def.max);
  }

  damage(n, src) {
    if (!this.active && !this.dead) this.wake(true);   // poke it and it stirs
    if (!(this.alarmLeft > 0) && this.alarmCooldown !== true) {
      this.alarmLeft = LAIR_ALARM_TIME;                // sound the muster, once
      this.alarmCooldown = true;
    }
    super.damage(n, src);
  }

  onDestroyed(src) {
    this.dead = true;
    this.release();
    this.game.onLairDestroyed(this, src);
  }
}

// -------------------------------------------------------------------
// units
// -------------------------------------------------------------------
export class Unit {
  constructor(game, kind, x, y, faction) {
    this.game = game;
    this.id = newId();
    this.kindClass = 'unit';
    this.kind = kind;
    this.faction = faction;
    const def = faction === 'monster' ? MONSTERS[kind] : CLASSES[kind];
    this.def = def;
    this.sprite = def.sprite || kind;

    this.x = x; this.y = y;
    this.radius = def.big ? 7 : 5;
    this.level = 1;
    this.xp = 0;
    this.gold = 0;
    this.kills = 0;
    // Attributes. A flat 5 is the baseline the rest of the numbers assume, so
    // a unit with 5s behaves exactly as its raw definition says; points above
    // or below that are what actually move anything.
    this.baseStats = { str: 5, agi: 5, con: 5, int: 5, ...(def.stats || {}) };
    // A class is a layer on top of whoever you already were, never a rewrite.
    this.classBonus = { str: 0, agi: 0, con: 0, int: 0, ...(def.knight || {}) };
    this.spec = null;          // chosen once at the rank cap, then permanent
    this._charge = 0;          // rage or focus; casters run on mana instead
    this.abilityCd = 0;
    this.strikeAb = null;      // an ability riding the next bolt
    this.burn = 0;             // seconds left on fire, and what it costs per second
    this.burnDps = 0;
    this.burnSrc = null;
    this.burnTick = 0;
    this.weakened = 0;         // seconds of hitting softer
    this.slowed = 0;           // seconds of moving slower
    this.boss = false;         // a named champion leading a raid
    this.frenzy = 0;           // Rampage
    this.guarded = 0;          // Shield Wall
    this.hidden = 0;           // seconds of being unseen
    this.stealthIn = 0;        // countdown to slipping out of sight again
    this.withdraw = 0;         // breaking off after a strike from the dark
    this.blessed = 0;          // seconds left of a cleric's blessing
    this.gear = {};            // slot key -> item worn
    this.bag = [];             // picked up, not worn: sold at the market
    this.strikeMul = 0;        // a charged blow waiting to land
    this.stance = 'defend';    // soldiers only: defend the realm, or roam it
    this.rushing = 0;          // seconds left of answering a distress call
    this.maxHp = def.hp;
    this.speed = def.speed;
    this.dmg = def.dmg;
    this.bonusDmg = 0;
    this.potions = 0;

    this.dir = 1;
    this.frame = 0;
    this.anim = 0;
    this.cool = 0;
    this.thinkIn = Math.random() * 0.4;
    this.state = 'idle';
    this.target = null;       // combat target
    this.path = null;
    this.pathIdx = 0;
    this.goal = null;         // {tx,ty,near}
    this.needPath = null;
    this.repathIn = 0;
    this.stuck = 0;
    this.watchIn = 1;
    this.watchX = x; this.watchY = y;
    this.dead = false;
    this.hitFlash = 0;
    this.selected = false;
    this.mission = 'none';    // peasants: the calling you gave them
    this.job = null;          // the concrete task that calling produced
    this.carry = 0;
    this.carryRes = null;
    this.homeId = null;       // guild or guard house
    this.homeX = x; this.homeY = y;
    this.flagId = null;       // reward flag being pursued
    this.fleeing = 0;
    this.restIn = 0;
    this.idleWander = 0;
    this.hp = this.maxHpNow;
    this.mana = this.maxMana;
    this.name = faction !== 'realm' ? def.name
      : kind === 'peasant' ? peasantName(game.rng)
        : kind === 'guard' ? def.name
          : heroName(game.rng);
    this.title = def.name;
  }

  get isHero() { return this.faction === 'realm' && !!CLASSES[this.kind] && this.kind !== 'peasant' && this.kind !== 'guard'; }

  /** Points granted purely by rank: LEVEL_STATS to everything per level gained. */
  get levelBonus() { return (this.level - 1) * LEVEL_STATS; }

  /** The specialisation chosen at the rank cap, if any. */
  get specDef() {
    const list = SPECS[this.kind];
    return list ? list.find(sp => sp.id === this.spec) || null : null;
  }
  /** Points from that choice. Every specialisation is worth the same twenty. */
  get specBonus() {
    const sp = this.specDef;
    return sp ? sp.bonus : { str: 0, agi: 0, con: 0, int: 0 };
  }
  /** True once they are ranked high enough to choose, and have not yet. */
  get canSpec() {
    return !this.spec && this.level >= SPEC_LEVEL && !!SPECS[this.kind];
  }

  // ---- class resource -------------------------------------------
  /** Rage for warriors, focus for rangers. Null for anyone with neither. */
  get chargeDef() {
    const sp = this.specDef;
    if (!sp) return null;
    const ab = ABILITIES[sp.ability];
    return ab ? POWERS[ab.power] : null;
  }
  get maxCharge() { const p = this.chargeDef; return p ? (p.mana ? this.maxMana : p.max) : 0; }
  /** Rage or focus for soldiers; for a caster it is simply their mana. */
  get charge() { const p = this.chargeDef; return p && p.mana ? this.mana : this._charge; }
  set charge(v) { const p = this.chargeDef; if (p && p.mana) this.mana = v; else this._charge = v; }
  get ability() {
    const sp = this.specDef;
    return sp ? ABILITIES[sp.ability] || null : null;
  }
  get abilityReady() {
    const ab = this.ability;
    return !!ab && this.abilityCd <= 0 && this.charge >= ab.cost;
  }
  gainCharge(n) {
    if (!this.chargeDef || n <= 0) return;
    this.charge = Math.min(this.maxCharge, this.charge + n);
  }

  /**
   * Everything a unit is: their baseline, what the work taught them, the class
   * laid on top, and their rank. Every term adds -- nothing here replaces
   * anything else, so a promotion can never make you worse at something.
   */
  /** Attribute points from everything currently worn. */
  get gearStats() {
    const out = { str: 0, agi: 0, con: 0, int: 0 };
    for (const k in this.gear) {
      const it = this.gear[k];
      if (!it) continue;
      for (const s of STAT_ORDER) out[s] += it.stats[s] || 0;
    }
    return out;
  }
  /** One modifier totalled across everything worn. */
  gearMod(kind) {
    let n = 0;
    for (const k in this.gear) {
      const it = this.gear[k];
      if (it && it.mods && it.mods[kind]) n += it.mods[kind];
    }
    return n;
  }

  get stats() {
    const b = this.baseStats, c = this.classBonus, l = this.levelBonus;
    const p = this.specBonus, e = this.gearStats;
    return {
      str: b.str + c.str + l + p.str + e.str,
      agi: b.agi + c.agi + l + p.agi + e.agi,
      con: b.con + c.con + l + p.con + e.con,
      int: b.int + c.int + l + p.int + e.int
    };
  }

  // ---- loot -----------------------------------------------------
  /**
   * Take an item. Worn if it beats what is already in that slot on this
   * hero's own terms, and otherwise kept to sell -- a warrior does not throw
   * away a wand, they carry it to market.
   */
  takeItem(item) {
    if (!item) return null;
    if (!canUse(this, item)) { this.bag.push(item); return 'bag'; }
    const key = this.bestSlotFor(item);
    const worn = this.gear[key];
    if (!worn || scoreFor(this, item) > scoreFor(this, worn)) {
      this.gear[key] = item;
      if (worn) this.bag.push(worn);
      this.hp = Math.min(this.maxHpNow, this.hp);
      return 'worn';
    }
    this.bag.push(item);
    return 'bag';
  }
  /** Of the slots this fits, the emptiest or the weakest. */
  bestSlotFor(item) {
    const keys = SLOT_KEYS.filter(k => slotOf(k) === item.slot);
    if (!keys.length) return item.slot;
    let worst = keys[0], worstScore = Infinity;
    for (const k of keys) {
      const s = this.gear[k] ? scoreFor(this, this.gear[k]) : -1;
      if (s < worstScore) { worstScore = s; worst = k; }
    }
    return worst;
  }
  /** Everything worn, as a flat list for the sheet. */
  gearList() {
    return SLOT_KEYS.map(k => ({ key: k, item: this.gear[k] || null }));
  }

  get power() {
    const strBonus = Math.max(0.25, 1 + (this.stats.str - 5) * STAT_EFFECT.dmgPerPoint);
    const sp = this.specDef;
    const blessing = this.blessed > 0 ? BLESSING.dmgMul : 1;
    const weak = this.weakened > 0 ? DEBUFF.weakMul : 1;
    const steel = this.gearMod('dmg');
    return (this.dmg + this.bonusDmg + steel) * strBonus * ((sp && sp.dmgMul) || 1) * blessing * weak;
  }
  /** How wide a bolt lands. Only wizards splash, and not every wizard. */
  get splashRadius() {
    const sp = this.specDef;
    return (this.def.splash || 0) * (sp && sp.splashMul != null ? sp.splashMul : 1);
  }

  /** What a staff or a pendant adds to a spell, as a multiplier. */
  get spellPower() { return 1 + this.gearMod('spell') / 100; }
  /** Anyone whose damage comes out of a book rather than an arm. */
  get isCaster() { return !!this.def.heal || this.kind === 'wizard'; }

  /** Seconds between swings, quickened by agility -- and halved in a Rampage. */
  get attackRate() {
    const quick = Math.max(0.35, 1 + (this.stats.agi - 5) * STAT_EFFECT.speedPerPoint);
    return this.def.rate / quick / (this.frenzy > 0 ? 2 : 1);
  }

  /** How far they can reach. A longbow reaches a good deal further. */
  get reach() {
    const sp = this.specDef;
    return this.def.range * ((sp && sp.rangeMul) || 1);
  }

  get critChance() {
    return Math.min(STAT_EFFECT.critCap,
      this.stats.int * STAT_EFFECT.critPerPoint + this.gearMod('crit') / 100);
  }
  get maxMana() { return this.stats.int * STAT_EFFECT.manaPerPoint + this.gearMod('mana'); }
  /** Mana per second. Intelligence buys the rate as well as the pool. */
  manaRegen(resting) {
    const base = resting ? MANA_REST : MANA_REGEN;
    return base + Math.max(0, this.stats.int - 5) * MANA_REGEN_PER_INT;
  }
  get tx() { return toTile(this.x); }
  get ty() { return toTile(this.y); }

  // ---- movement -------------------------------------------------
  goTo(tx, ty, near = 0) {
    this.goal = { tx, ty, near };
    this.needPath = { tx, ty, near };
    this.tryPath();
  }
  tryPath() {
    if (!this.needPath) return;
    if (this.game.pathBudget <= 0) return;      // try again next frame
    this.game.pathBudget--;
    const { tx, ty, near } = this.needPath;
    const p = this.game.world.findPath(this.tx, this.ty, tx, ty, near);
    this.needPath = null;
    if (p && p.length) { this.path = p; this.pathIdx = 0; this.stuck = 0; }
    else if (p && !p.length) { this.path = null; this.arrived = true; }
    else {
      // unreachable: drift toward it anyway so units never freeze solid
      this.path = null;
      const f = this.game.world.nearestFree(tx, ty, 6);
      if (f && (f.x !== tx || f.y !== ty)) {
        const p2 = this.game.world.findPath(this.tx, this.ty, f.x, f.y, Math.max(1, near));
        if (p2 && p2.length) { this.path = p2; this.pathIdx = 0; }
      }
      if (!this.path) this.pathFailed = true;
    }
  }
  stop() { this.path = null; this.needPath = null; this.goal = null; }

  atGoal(padding = TILE * 0.9) {
    if (!this.goal) return true;
    return dist(this.x, this.y, toPx(this.goal.tx), toPx(this.goal.ty)) <= padding + this.goal.near * TILE;
  }

  stepMove(dt) {
    if (this.needPath) this.tryPath();
    if (!this.path || this.pathIdx >= this.path.length) { this.moving = false; return; }
    const wp = this.path[this.pathIdx];
    const gx = toPx(wp.x), gy = toPx(wp.y);
    const dx = gx - this.x, dy = gy - this.y;
    const d = Math.hypot(dx, dy);
    // adrenaline in flight; and a soldier answering a worker's scream runs
    const haste = this.fleeing > 0 ? 1.3 : this.rushing > 0 ? RUSH_SPEED : 1;
    const slow = this.slowed > 0 ? DEBUFF.slowMul : 1;
    const step = this.speed * haste * slow * dt;
    this.moving = true;
    if (d <= step) {
      this.x = gx; this.y = gy;
      this.pathIdx++;
      if (this.pathIdx >= this.path.length) { this.path = null; this.arrived = true; this.moving = false; }
    } else {
      this.x += (dx / d) * step;
      this.y += (dy / d) * step;
      if (Math.abs(dx) > 0.4) this.dir = dx > 0 ? 1 : -1;
    }
    this.anim += dt * (this.speed / 14);
    this.frame = (this.anim | 0) % 2;
  }

  // ---- combat ---------------------------------------------------
  /**
   * Gap between this unit and its target. For structures that means the
   * distance to the footprint edge -- centre distance makes a melee unit
   * standing at a corner think it is still out of reach.
   */
  distTo(e) {
    if (e.kindClass === 'unit') return dist(this.x, this.y, e.x, e.y) - (e.radius || 0);
    const x0 = e.tx * TILE, y0 = e.ty * TILE;
    const x1 = x0 + e.fw * TILE, y1 = y0 + e.fh * TILE;
    const dx = Math.max(x0 - this.x, 0, this.x - x1);
    const dy = Math.max(y0 - this.y, 0, this.y - y1);
    return Math.hypot(dx, dy);
  }
  canReach(e) { return this.distTo(e) <= this.reach + 2; }

  engage(e) {
    this.target = e;
  }

  fight(dt) {
    const t = this.target;
    if (!t || t.dead) { this.target = null; return false; }
    const d = this.distTo(t);
    if (d <= this.reach) {
      this.path = null; this.needPath = null; this.moving = false;
      this.dir = t.x >= this.x ? 1 : -1;
      this.cool -= dt;
      if (this.cool <= 0) {
        this.cool = this.attackRate;
        this.strike(t);
      }
      return true;
    }
    // chase: walk onto a unit's tile, or right up against a structure
    this.repathIn -= dt;
    if (this.repathIn <= 0) {
      this.repathIn = 0.5 + Math.random() * 0.3;
      if (t.kindClass === 'unit') {
        this.goTo(toTile(t.x), toTile(t.y), 0);
      } else {
        const a = t.approach(this);
        this.goTo(a.x, a.y, 0);
      }
    }
    return true;
  }

  strike(t) {
    let dmg = this.power * (0.85 + Math.random() * 0.3);
    const crit = Math.random() < this.critChance;
    if (crit) dmg *= STAT_EFFECT.critMultiplier;
    // A blow charged by an ability, spent on this swing and this swing only.
    if (this.strikeMul > 0) { dmg *= this.strikeMul; this.strikeMul = 0; }
    if (this.isCaster) dmg *= this.spellPower;
    // Coming out of the dark is worth more than coming at them head on.
    const sp = this.specDef;
    if (this.hidden > 0) {
      if (sp && sp.openerMul) dmg *= sp.openerMul;
      this.reveal();
    }
    const pw = this.chargeDef;
    if (pw && pw.onHit) this.gainCharge(pw.onHit);
    if (this.frenzy > 0) this.heal(dmg * 0.25);   // Rampage drinks it back
    const steal = this.gearMod('lifesteal');
    if (steal > 0) this.heal(dmg * steal / 100);
    if (this.def.ranged) {
      const bolt = this.kind === 'wizard' ? (sp && sp.bolt) || 'fire' : this.def.bolt || 'arrow';
      const p = this.game.spawnProjectile(this, t, dmg, bolt, crit);
      // an armed ability rides this bolt and goes off where it lands
      p.ability = this.strikeAb; this.strikeAb = null;
      this.game.audio.play(bolt === 'arrow' ? 'bow' : 'cast');
    } else {
      this.game.applyDamage(t, dmg, this, crit);
      // a spider's bite slows whoever it got its fangs into
      if (this.def.venom && t.kindClass === 'unit') t.slowed = Math.max(t.slowed, this.def.venom);
      this.game.audio.play('hit');
      this.game.fx.burst(t.x, t.y - 4, crit ? '#ffc94a' : '#ffd0a0', crit ? 7 : 3, crit ? 44 : 26, 0.26);
    }
  }

  /**
   * What a wizard's bolt leaves behind on whoever it touched, on top of the
   * damage: a burn, a curse, or a drink for the caster. `primary` is the one
   * it was aimed at; splash victims get the mark but do not feed the leech.
   */
  spellLanded(v, dmg, primary) {
    const sp = this.specDef;
    if (!sp) return;
    if (v.kindClass === 'unit') {
      if (sp.burn) v.ignite(dmg * sp.burn.frac, sp.burn.lasts, this);
      if (sp.weaken) v.weakened = Math.max(v.weakened, sp.weaken.lasts);
    }
    if (sp.leech && primary) this.heal(dmg * sp.leech);
  }
  /** Set alight: `dps` a second for `lasts` seconds, credited to `src`. */
  ignite(dps, lasts, src) {
    if (this.dead) return;
    if (this.burn <= 0) this.burnTick = DEBUFF.tick;
    // a fresh, hotter fire replaces a dying one; a weaker one only extends it
    this.burnDps = Math.max(this.burnDps * (this.burn > 0 ? 1 : 0), dps);
    this.burn = Math.max(this.burn, lasts);
    this.burnSrc = src;
  }
  /** The slow bleed of a burn or a blight. Ticks every half second, credited. */
  tickAfflictions(dt) {
    if (this.burn > 0) {
      this.burn -= dt;
      this.burnTick -= dt;
      if (this.burnTick <= 0) {
        this.burnTick += DEBUFF.tick;
        this.game.applyDamage(this, this.burnDps * DEBUFF.tick, this.burnSrc, false, true);
        this.game.fx.puff(this.x, this.y - 8, '#ff8a2a', 1);
      }
      if (this.burn <= 0) { this.burnDps = 0; this.burnSrc = null; }
    }
    if (this.weakened > 0) this.weakened -= dt;
    if (this.slowed > 0) this.slowed -= dt;
  }

  /**
   * Returns the health actually restored, which is not the same as the health
   * offered: topping up somebody already full restores nothing. Everything
   * that pays out for healing pays on this number, so there is nothing to
   * farm by mending the healthy.
   */
  heal(n) {
    const before = this.hp;
    this.hp = Math.min(this.maxHpNow, this.hp + n);
    const given = this.hp - before;
    if (given > 0.5) this.game.fx.text(this.x, this.y - 12, '+' + Math.round(given), '#7fd8a0', 16);
    return given;
  }

  /**
   * Note that somebody had a hand in this unit's downfall, so the credit can
   * be shared out when it finally falls instead of going entirely to whoever
   * landed the last blow.
   */
  creditHit(src) {
    if (!src || src.kindClass !== 'unit' || src.faction !== 'realm') return;
    if (!this.credit) this.credit = new Map();
    this.credit.set(src, this.game.time);
  }
  /** Everyone still alive who had a hand in it, recently enough to count. */
  contributors() {
    const out = [];
    if (!this.credit) return out;
    for (const [u, t] of this.credit) {
      if (u.dead || u.faction !== 'realm') continue;
      if (this.game.time - t > CREDIT_WINDOW) continue;
      out.push(u);
    }
    return out;
  }

  /** Slip out of sight. Only specialisations that know how can do it. */
  conceal(seconds) {
    const sp = this.specDef;
    if (!sp || !sp.stealth) return;
    if (this.hidden <= 0) this.game.fx.puff(this.x, this.y - 6, '#9b6fff', 3);
    this.hidden = Math.max(this.hidden, seconds);
    // Whoever was watching loses them: without this a monster keeps its lock
    // and stealth means nothing to the only things it is supposed to fool.
    for (const m of this.game.units) {
      if (!m.dead && m.faction !== this.faction && m.target === this) m.target = null;
    }
  }
  /** Break cover, and start the clock on slipping away again. */
  reveal() {
    const wasHidden = this.hidden > 0;
    if (wasHidden) this.game.fx.puff(this.x, this.y - 6, '#c9a227', 2);
    this.hidden = 0;
    const sp = this.specDef;
    this.stealthIn = sp && sp.stealth ? sp.stealthIn : 0;
    // Having struck from the dark, get back out of it rather than standing
    // there trading blows -- that is the whole of the trade.
    if (wasHidden && sp && sp.stealth) this.withdraw = STEALTH_REVEAL;
  }
  /** Invisible to the enemy: hidden, and not currently something's target. */
  get unseen() { return this.hidden > 0; }

  get maxHpNow() {
    const con = (this.stats.con - 5) * STAT_EFFECT.hpPerPoint;
    return Math.round(this.maxHp + con);
  }

  gainXp(n) {
    if (!this.isHero) return;
    this.xp += n;
    while (this.level < MAX_LEVEL && this.xp >= XP_TABLE[this.level]) {
      this.level++;
      this.hp = this.maxHpNow;              // the new constitution is usable at once
      this.game.fx.text(this.x, this.y - 16, 'LEVEL ' + this.level, '#ffc94a', 26);
      this.game.fx.text(this.x, this.y - 28, `+${LEVEL_STATS} ALL`, '#7fd8a0', 22);
      this.game.fx.ring(this.x, this.y - 6, '#ffc94a', 12);
      this.game.audio.play('level');
      this.game.notify(`${this.name} reached level ${this.level} (+${LEVEL_STATS} to every attribute)`, 'good');
    }
  }

  /**
   * Everything a specialisation runs on: its ability timer, the resource that
   * pays for it, whatever the last ability left running, and -- for those who
   * know how -- slipping back out of sight once nothing is looking at them.
   */
  tickSpec(dt) {
    const sp = this.specDef;
    if (!sp) return;
    if (this.abilityCd > 0) this.abilityCd -= dt;
    if (this.frenzy > 0) this.frenzy -= dt;
    if (this.guarded > 0) this.guarded -= dt;
    if (this.withdraw > 0) this.withdraw -= dt;

    const p = this.chargeDef;
    if (p) {
      const fighting = !!(this.target && !this.target.dead);
      if (p.regen) this.gainCharge((fighting ? p.regen : (p.idleRegen || p.regen)) * dt);
      if (p.decay && !fighting) this.charge = Math.max(0, this.charge - p.decay * dt);
    }

    if (sp.stealth) {
      if (this.hidden > 0) {
        if (this.hidden !== Infinity) this.hidden -= dt;
        if (this.hidden <= 0) this.reveal();
      } else {
        // out of a fight and left alone long enough: back into the dark
        // Fading mid-fight is the whole point of these two; what stops them is
        // being hit, not merely having somebody in mind.
        const quiet = this.game.time - (this.lastHit || -99) > 2;
        const sp2 = sp.stealthIn + STEALTH_REVEAL;
        this.stealthIn = quiet
          ? this.stealthIn - dt
          : Math.min(sp2, this.stealthIn + dt * 0.5);   // a fight keeps them visible
        if (this.stealthIn <= 0) this.conceal(Infinity);
      }
    }
  }

  /**
   * Spend the resource and set the specialisation's trick going. Charged
   * blows (Mortal Strike, Aimed Shot, Ambush, the Vanish opener) arm the next
   * swing rather than hitting immediately, so they still have to connect.
   */
  useAbility(target) {
    const ab = this.ability;
    if (!ab || !this.abilityReady) return false;
    this.charge -= ab.cost;
    this.abilityCd = ab.cd;
    const g = this.game, sp = this.specDef;
    g.fx.text(this.x, this.y - 22, ab.name.toUpperCase(), sp.colour, 24);
    g.fx.ring(this.x, this.y - 6, sp.colour, 13);
    g.audio.play('level');

    switch (ab.id) {
      case 'rampage':
        this.frenzy = ab.lasts;
        break;
      case 'shield_wall': {
        this.guarded = ab.lasts;
        // insist on being the one they hit
        for (const m of g.units) {
          if (m.dead || m.faction !== 'monster') continue;
          if (dist(m.x, m.y, this.x, this.y) > (sp.taunt || 120)) continue;
          m.target = this;
        }
        break;
      }
      case 'vanish':
        this.conceal(ab.lasts);
        this.strikeMul = ab.mult;
        break;
      case 'ambush':
        this.strikeMul = this.hidden > 0 ? ab.hiddenMult : ab.mult;
        break;
      case 'exsanguinate':
      case 'firestorm':
      case 'blight':
        // rides the next bolt; the projectile does the rest where it lands
        this.strikeMul = ab.mult || 1;
        this.strikeAb = ab.id;
        break;
      case 'radiance': {
        // everybody nearby at once, paid like any other mending
        const h = this.def.heal;
        const amount = h.amount * (1 + (this.level - 1) * 0.2) * this.spellPower
          * (sp.healMul || 1) * ab.mult;
        let given = 0;
        for (const a of g.units) {
          if (a.dead || a.faction !== 'realm') continue;
          if (dist(a.x, a.y, this.x, this.y) > ab.radius) continue;
          const got = a.heal(amount);
          if (got > 0) { given += got; g.fx.ring(a.x, a.y - 6, sp.colour, 9); }
        }
        if (given > 0) { this.gainXp(given * XP_PER_HEAL); this.lastSupport = g.time; }
        g.fx.burst(this.x, this.y - 8, '#fff6c8', 14, 70, 0.5);
        g.audio.play('heal');
        break;
      }
      case 'hymn': {
        // a blessing on everyone in earshot, and a shield for the singer
        this.guarded = ab.lasts;
        let n = 0;
        for (const a of g.units) {
          if (a.dead || a.faction !== 'realm' || a === this) continue;
          if (dist(a.x, a.y, this.x, this.y) > ab.radius) continue;
          a.blessed = Math.max(a.blessed, BLESSING.lasts * (sp.blessMul || 1));
          g.fx.ring(a.x, a.y - 6, BLESSING.colour, 11);
          n++;
        }
        if (n) { this.gainXp(XP_PER_BLESSING * n); this.lastSupport = g.time; }
        g.audio.play('heal');
        break;
      }
      default:
        this.strikeMul = ab.mult || 1;
    }
    if (target && !target.dead) this.target = target;
    // Anyone who fights out of the dark breaks off after their blow, whether
    // the blow was the vanishing kind or not: strike, leave, come again.
    if (sp.stealth && ab.id !== 'vanish') this.withdraw = STEALTH_REVEAL;
    return true;
  }

  damageTaken(n, src) {
    this.creditHit(src);
    // Standing in front of it is taking part. Without this a Protection
    // warrior holding the whole camp's attention while everyone else does the
    // killing would earn nothing at all for it.
    if (src && src.kindClass === 'unit' && src.faction === 'monster'
      && this.faction === 'realm' && src.creditHit) src.creditHit(this);
    if (this.guarded > 0) n *= 0.5;         // Shield Wall, or a paladin's hymn
    if (this.blessed > 0) n *= BLESSING.soak;
    const sp = this.specDef;
    if (sp && sp.soak) n *= sp.soak;        // plate over the robe
    if (this.def.soak) n *= this.def.soak;  // a wraith is only half here
    const pw = this.chargeDef;
    if (pw && pw.onHurt) this.gainCharge(pw.onHurt);
    if (this.hidden > 0) this.reveal();     // being hit gives you away
    this.hp -= n;
    this.hitFlash = 0.12;
    this.lastHit = this.game.time;
    if (src && src.kindClass === 'unit') this.lastAttacker = src;
    if (this.hp <= 0) { this.hp = 0; this.die(src); }
  }

  die(src) {
    if (this.dead) return;
    this.dead = true;
    this.game.onUnitDeath(this, src);
  }

  update(dt) {
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.cool > 0) this.cool -= dt;
    if (this.fleeing > 0) this.fleeing -= dt;
    if (this.rushing > 0) this.rushing -= dt;
    this.tickSpec(dt);
    this.tickAfflictions(dt);
    if (this.dead) return;                  // a burn can be the end of you
    // a troll knits itself back together -- unless it is on fire
    if (this.def.regen && this.burn <= 0 && this.hp < this.maxHpNow) {
      this.hp = Math.min(this.maxHpNow, this.hp + this.def.regen * dt);
    }
    if (this.blessed > 0) this.blessed -= dt;
    // Mana pays for mending and blessing, so it has to refill -- faster when
    // they are standing about than when they are working a fight.
    if (this.maxMana > 0 && this.mana < this.maxMana) {
      const rest = !this.target && !this.moving;
      this.mana = Math.min(this.maxMana, this.mana + this.manaRegen(rest) * dt);
    }
    this.thinkIn -= dt;
    this.thinkAcc = (this.thinkAcc || 0) + dt;
    if (this.thinkIn <= 0) {
      this.thinkIn = 0.28 + Math.random() * 0.22;
      const since = this.thinkAcc;
      this.thinkAcc = 0;
      this.brain(this, since);
    }
    if (!this.target || this.target.dead || this.distTo(this.target) > this.reach) {
      this.stepMove(dt);
    }

    // Watchdog. Wanting to be somewhere and getting no closer is a bug, not a
    // plan, and nothing above is allowed to freeze a unit for good -- two of
    // them managed it for minutes at a time. So measure it: ask for the path
    // again first, and if that changes nothing, `stuck` keeps climbing and
    // the brain gets to abandon the errand.
    this.watchIn -= dt;
    if (this.watchIn <= 0) {
      this.watchIn = 1;
      if (this.goal && !this.target && !this.atGoal()) {
        const moved = Math.hypot(this.x - this.watchX, this.y - this.watchY);
        this.stuck = moved < 2 ? this.stuck + 1 : 0;
        if (this.stuck >= 2 && !this.path && !this.needPath) {
          this.needPath = { tx: this.goal.tx, ty: this.goal.ty, near: this.goal.near };
        }
      } else this.stuck = 0;
      this.watchX = this.x; this.watchY = this.y;
    }
  }
}

// -------------------------------------------------------------------
/** What each kind of bolt looks like when it lands. */
const BOLT_LOOK = {
  arrow: { spark: '#ffe0a0' },
  bolt: { spark: '#d0e4ff' },
  fire: { burst: '#ff9040', ring: '#ffd070' },
  blood: { burst: '#c8203a', ring: '#ff6a7a' },
  dark: { burst: '#7a3fbf', ring: '#b57cff' }
};

export class Projectile {
  constructor(game, from, to, dmg, kind, crit = false) {
    this.game = game;
    this.crit = crit;
    this.x = from.x; this.y = from.y - 6;
    this.target = to;
    this.tx = to.x; this.ty = to.y - 4;
    this.dmg = dmg;
    this.kind = kind;
    this.owner = from;
    this.speed = kind === 'arrow' ? 210 : 130;
    this.dead = false;
    this.t = 0;
    this.splash = from.splashRadius || 0;   // how wide it lands
    this.ability = null;                    // an ability riding along
  }
  update(dt) {
    this.t += dt;
    if (this.target && !this.target.dead) { this.tx = this.target.x; this.ty = this.target.y - 4; }
    const dx = this.tx - this.x, dy = this.ty - this.y;
    const d = Math.hypot(dx, dy);
    const step = this.speed * dt;
    if (d <= step || this.t > 3) {
      this.hit();
      return;
    }
    this.x += (dx / d) * step;
    this.y += (dy / d) * step;
    this.angle = Math.atan2(dy, dx);
  }
  hit() {
    this.dead = true;
    const g = this.game, o = this.owner;
    const ab = this.ability ? ABILITIES[this.ability] : null;
    const look = BOLT_LOOK[this.kind] || BOLT_LOOK.arrow;
    if (!look.burst) {
      // an arrow, or a tower's bolt: one target, no magic
      if (this.target && !this.target.dead) {
        g.applyDamage(this.target, this.dmg, o, this.crit);
        g.fx.burst(this.x, this.y, look.spark, 4, 30, 0.25);
      }
      return;
    }
    // a spell. An ability widens it (Firestorm, Blight) or narrows it to the
    // one it was aimed at (Exsanguinate); otherwise the wizard's own splash.
    const radius = ab && ab.radius ? ab.radius : this.splash;
    g.fx.burst(this.x, this.y, look.burst, ab ? 18 : 12, ab ? 80 : 60, 0.45);
    g.fx.ring(this.x, this.y, look.ring, ab && ab.radius ? 14 : 10);
    g.audio.play('boom');
    const victims = radius > 0
      ? g.enemiesNear(this.x, this.y, radius, o.faction)
      : (this.target && !this.target.dead ? [this.target] : []);
    let dealt = 0;
    for (const f of victims) {
      const primary = f === this.target;
      // an ability's blast is full strength to everyone under it
      const share = primary || (ab && ab.radius) ? 1 : 0.6;
      const dmg = this.dmg * share;
      g.applyDamage(f, dmg, o, this.crit);
      if (primary) dealt = dmg;
      if (o.spellLanded) o.spellLanded(f, dmg, primary);
      if (ab && ab.id === 'firestorm' && f.kindClass === 'unit') f.ignite(dmg * ab.burnFrac, ab.burn, o);
    }
    if (ab && ab.id === 'exsanguinate' && dealt > 0) o.heal(dealt);
    if (ab && ab.id === 'blight') {
      g.addZone({ x: this.x, y: this.y, r: ab.radius, t: ab.lasts, owner: o,
        dps: this.dmg * ab.dpsFrac, colour: o.specDef.colour });
    }
  }
}
