// ===================================================================
// entities.js — structures, units and projectiles.
// Behaviour lives in brains.js; this file is movement, combat, state.
// ===================================================================
import { TILE } from './art.js';
import { toPx, toTile } from './world.js';
import {
  BUILDINGS, CLASSES, MONSTERS, LAIRS, XP_TABLE, LEVEL_HP, LEVEL_DMG,
  MISSIONS, STAT_ORDER, STAT_EFFECT, TRAIN_MAX
} from './data.js';
import { clamp, dist, heroName, peasantName } from './util.js';

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
    this.hp -= n;
    this.hitFlash = 0.14;
    if (this.hp <= 0) { this.hp = 0; this.onDestroyed(src); }
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
    this.spawnCool -= dt;
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
  wake(announce) {
    if (this.active) return;
    this.active = true;
    const g = this.game;
    if (announce) g.notify(`${this.def.name} has noticed you`, 'bad');
    for (let i = 0; i < this.def.max; i++) {
      if (!g.monsterBudgetOk()) break;
      const t = this.approach(null);
      const m = g.spawnUnit(this.def.spawn, toPx(t.x) + (Math.random() - 0.5) * 12,
        toPx(t.y) + (Math.random() - 0.5) * 12, 'monster');
      m.lair = this;
      this.spawned.push(m);
    }
  }

  damage(n, src) {
    if (!this.active && !this.dead) this.wake(true);   // poke it and it stirs
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
    this.training = {};        // mission id -> work done toward its stat track
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

  /** Points earned by actually doing the work, per attribute. */
  get trained() {
    const out = { str: 0, agi: 0, con: 0, int: 0 };
    for (const id in this.training) {
      const m = MISSIONS[id];
      if (!m || !m.trains) continue;
      const frac = Math.min(1, this.training[id] / m.trainFull);
      const points = Math.floor(frac * TRAIN_MAX);
      for (const k of m.trains) out[k] += points;
    }
    return out;
  }

  /** Base attributes plus everything the calling taught them. */
  get stats() {
    const t = this.trained, b = this.baseStats;
    return { str: b.str + t.str, agi: b.agi + t.agi, con: b.con + t.con, int: b.int + t.int };
  }

  /**
   * Log work toward a calling's attribute track. Called from the brain when a
   * peasant actually swings a pick, never on a timer -- time served is not
   * the same thing as work done.
   */
  train(missionId, amount) {
    const m = MISSIONS[missionId];
    if (!m || !m.trains || amount <= 0) return;
    const before = Math.floor(Math.min(1, (this.training[missionId] || 0) / m.trainFull) * TRAIN_MAX);
    this.training[missionId] = Math.min(m.trainFull, (this.training[missionId] || 0) + amount);
    const after = Math.floor(Math.min(1, this.training[missionId] / m.trainFull) * TRAIN_MAX);
    if (after > before) {
      this.hp = Math.min(this.maxHpNow, this.hp + STAT_EFFECT.hpPerPoint); // new toughness is usable now
      if (after === TRAIN_MAX) {
        this.game.notify(`${this.name} has mastered ${m.name.toLowerCase()} work`, 'good');
        this.game.fx.text(this.x, this.y - 18, 'MASTERED', '#ffc94a', 26);
        this.game.audio.play('level');
      } else {
        this.game.fx.text(this.x, this.y - 16, '+' + m.trains.map(k => k.toUpperCase()).join(' +'), '#7fd8a0', 20);
      }
    }
  }

  get power() {
    const strBonus = 1 + Math.floor((this.stats.str - 5) / 5) * STAT_EFFECT.dmgPer5;
    return (this.dmg * (1 + (this.level - 1) * LEVEL_DMG) + this.bonusDmg) * strBonus;
  }

  /** Seconds between swings, quickened by agility. */
  get attackRate() {
    const quick = 1 + Math.floor((this.stats.agi - 5) / 5) * STAT_EFFECT.speedPer5;
    return this.def.rate / quick;
  }

  get critChance() {
    return Math.min(STAT_EFFECT.critCap, Math.floor(this.stats.int / 5) * STAT_EFFECT.critPer5);
  }
  get maxMana() { return this.stats.int * STAT_EFFECT.manaPerPoint; }
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
    // adrenaline: a hero in flight is faster than the thing chasing it
    const step = this.speed * (this.fleeing > 0 ? 1.3 : 1) * dt;
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
  canReach(e) { return this.distTo(e) <= this.def.range + 2; }

  engage(e) {
    this.target = e;
  }

  fight(dt) {
    const t = this.target;
    if (!t || t.dead) { this.target = null; return false; }
    const d = this.distTo(t);
    if (d <= this.def.range) {
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
    if (this.def.ranged) {
      this.game.spawnProjectile(this, t, dmg, this.kind === 'wizard' ? 'fire' : 'arrow', crit);
      this.game.audio.play(this.kind === 'wizard' ? 'cast' : 'bow');
    } else {
      this.game.applyDamage(t, dmg, this, crit);
      this.game.audio.play('hit');
      this.game.fx.burst(t.x, t.y - 4, crit ? '#ffc94a' : '#ffd0a0', crit ? 7 : 3, crit ? 44 : 26, 0.26);
    }
  }

  heal(n) {
    this.hp = Math.min(this.maxHpNow, this.hp + n);
    this.game.fx.text(this.x, this.y - 12, '+' + Math.round(n), '#7fd8a0', 16);
  }

  get maxHpNow() {
    const con = (this.stats.con - 5) * STAT_EFFECT.hpPerPoint;
    return Math.round((this.maxHp + con) * (1 + (this.level - 1) * LEVEL_HP));
  }

  gainXp(n) {
    if (!this.isHero) return;
    this.xp += n;
    while (this.level < XP_TABLE.length && this.xp >= XP_TABLE[this.level]) {
      this.level++;
      this.hp = this.maxHpNow;
      this.game.fx.text(this.x, this.y - 16, 'LEVEL ' + this.level, '#ffc94a', 26);
      this.game.fx.ring(this.x, this.y - 6, '#ffc94a', 12);
      this.game.audio.play('level');
      this.game.notify(`${this.name} reached level ${this.level}`, 'good');
    }
  }

  damageTaken(n, src) {
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
    this.thinkIn -= dt;
    this.thinkAcc = (this.thinkAcc || 0) + dt;
    if (this.thinkIn <= 0) {
      this.thinkIn = 0.28 + Math.random() * 0.22;
      const since = this.thinkAcc;
      this.thinkAcc = 0;
      this.brain(this, since);
    }
    if (!this.target || this.target.dead || this.distTo(this.target) > this.def.range) {
      this.stepMove(dt);
    }
  }
}

// -------------------------------------------------------------------
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
    this.speed = kind === 'fire' ? 130 : 210;
    this.dead = false;
    this.t = 0;
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
    const g = this.game;
    if (this.kind === 'fire') {
      g.fx.burst(this.x, this.y, '#ff9040', 12, 60, 0.45);
      g.fx.ring(this.x, this.y, '#ffd070', 10);
      g.audio.play('boom');
      const splash = CLASSES.wizard.splash;
      const foes = g.enemiesNear(this.x, this.y, splash, this.owner.faction);
      for (const f of foes) g.applyDamage(f, this.dmg * (f === this.target ? 1 : 0.6), this.owner, this.crit);
    } else {
      if (this.target && !this.target.dead) {
        g.applyDamage(this.target, this.dmg, this.owner, this.crit);
        g.fx.burst(this.x, this.y, '#ffe0a0', 4, 30, 0.25);
      }
    }
  }
}
