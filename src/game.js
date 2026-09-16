// ===================================================================
// game.js — simulation core: economy, flags, spawning, victory.
// ===================================================================
import { World, toPx, toTile, MAP_W, MAP_H } from './world.js';
import { TILE } from './art.js';
import { Building, Lair, Unit, Projectile } from './entities.js';
import { peasantBrain, heroBrain, guardBrain, monsterBrain } from './brains.js';
import { Fx } from './fx.js';
import {
  BUILDINGS, CLASSES, MONSTERS, LAIRS, FLAGS, RES_RATE, START,
  DAY_SECONDS, TAX_INTERVAL, RESURRECT_COST, HERO_CLASSES, PEACE_DAYS, STRUCTURE_DMG,
  XP_TABLE, MAX_LEVEL, DROPS, LAIR_DROPS, MARKET_SLOTS, MARKET_RESTOCK,
  MISSIONS, RAIDS_ENABLED, CALLING_ORDER, DISTRESS_WINDOW, RECRUIT_DMG,
  THREAT_PER_DAY, THREAT_CAP, SEPARATION_CAP, SPECS, WORK_TALENTS, XP_SHARE_BONUS, XP_SHARE_BONUS_CAP,
  SUPPORT_SHARE, CREDIT_WINDOW
} from './data.js';
import { makeRng, clamp, dist } from './util.js';
import { rollItem, scoreFor, canUse, describe, TIERS } from './items.js';

// Every camp now keeps a standing garrison, which on a nine-lair map is most
// of thirty monsters before a single raid sets out. The old cap of 32 would
// have left the far camps empty -- exactly the thing garrisons exist to stop.
const MONSTER_CAP = 78;
const WILDLIFE_CAP = 10;

export class Game {
  constructor(seed, audio) {
    this.seed = seed >>> 0;
    this.rng = makeRng(this.seed ^ 0x9e3779b9);
    this.audio = audio;
    this.fx = new Fx();
    this.world = new World(this.seed);

    this.units = [];
    this.buildings = [];
    this.lairs = [];
    this.projectiles = [];
    this.flags = [];
    this.graves = [];        // fallen heroes awaiting resurrection
    this.notices = [];

    this.res = { ...START };
    this.reserved = 0;       // gold promised to reward flags
    this.pop = 0;
    this.popCap = 0;
    this.day = 1;
    this.time = 0;
    this.taxIn = TAX_INTERVAL;
    this.fogIn = 0;
    this.waveIn = DAY_SECONDS * (PEACE_DAYS + 1.5);
    this.wildIn = 25;
    this.pathBudget = 0;
    this.speed = 1;
    this.paused = false;
    this.over = null;        // 'win' | 'lose'
    this.stats = { kills: 0, heroesLost: 0, lairsCleared: 0, goldEarned: 0, flagsPaid: 0 };
    this.nextFlagId = 1;
    this.peaceDays = PEACE_DAYS;
    this.raidsEnabled = RAIDS_ENABLED;
    this.selection = [];
    this.placing = null;

    this.setup();
  }

  // -----------------------------------------------------------------
  setup() {
    const w = this.world;
    const s = w.start;

    // the lairs the world generator picked out
    for (const spot of w.lairSpots) {
      const l = new Lair(this, spot.kind, spot.x, spot.y);
      this.lairs.push(l);
      w.addProp(LAIRS[spot.kind].prop, spot.x, spot.y, { lairId: l.id });
    }

    // your city centre, already standing
    const px = s.x - 1, py = s.y - 1;
    const palace = new Building(this, 'palace', px, py, true);
    this.buildings.push(palace);
    this.palace = palace;
    this.recomputePop();

    // three peasants to start the whole machine
    for (let i = 0; i < 3; i++) {
      const t = w.nearestFree(s.x + (i - 1) * 2, s.y + 3, 6);
      this.spawnUnit('peasant', toPx(t.x), toPx(t.y), 'realm');
    }
    // Every camp keeps a standing guard from the first day. Walking into one
    // is meant to be a fight you chose, not a coin flip on whether anybody
    // happens to be home.
    for (const l of this.lairs) l.muster(l.garrisonSize);

    this.revealAround(palace.x, palace.y, 13);
    this.camera = { x: palace.x, y: palace.y };
  }

  // -----------------------------------------------------------------
  // spawning
  // -----------------------------------------------------------------
  /** How much harder the world has grown, in attribute points. */
  get threat() {
    return Math.min(THREAT_CAP, Math.floor((this.day - 1) * THREAT_PER_DAY));
  }

  spawnUnit(kind, x, y, faction) {
    const u = new Unit(this, kind, x, y, faction);
    if (faction === 'monster') {
      // the same per-point rules everything else obeys, applied to the passage
      // of time: later monsters are simply bigger, faster and harder to kill
      const t = this.threat;
      if (t > 0) {
        u.classBonus = { str: t, agi: t, con: t, int: t };
        u.hp = u.maxHpNow;
      }
    }
    u.brain = faction === 'monster' ? monsterBrain
      : kind === 'peasant' ? peasantBrain
        : kind === 'guard' ? guardBrain : heroBrain;
    u.homeX = x; u.homeY = y;
    this.units.push(u);
    this.fx.puff(x, y - 4, faction === 'monster' ? '#a06ecf' : '#d8cfe6', 5);
    if (faction === 'realm') this.recomputePop();
    return u;
  }

  spawnProjectile(from, to, dmg, kind, crit = false) {
    this.projectiles.push(new Projectile(this, from, to, dmg, kind, crit));
  }

  /** How many monsters are currently marching on the realm. */
  raidersOut() {
    let n = 0;
    for (const u of this.units) if (!u.dead && u.faction === 'monster' && u.raiding) n++;
    return n;
  }
  get raidCap() { return clamp(3 + Math.floor((this.day - this.peaceDays) / 4), 3, 9); }

  /**
   * A lair only raids once your realm is close enough to bother it.
   * Expanding toward a lair is what turns it hostile -- that is the pressure
   * valve that keeps early game survivable and late game tense.
   */
  lairThreatensUs(lair, tiles = 22) {
    if (!lair || lair.dead) return false;
    const b = this.nearestBuilding(lair.x, lair.y, x => !x.dead, tiles * TILE);
    return !!b;
  }

  monsterBudgetOk() {
    let n = 0;
    for (const u of this.units) if (!u.dead && u.faction === 'monster') n++;
    return n < MONSTER_CAP;
  }

  // -----------------------------------------------------------------
  // queries used by the AI
  // -----------------------------------------------------------------
  enemiesNear(x, y, range, myFaction) {
    const out = [];
    const r2 = range * range;
    for (const u of this.units) {
      if (u.dead || u.faction === myFaction) continue;
      const dx = u.x - x, dy = u.y - y;
      if (dx * dx + dy * dy <= r2) out.push(u);
    }
    if (myFaction === 'realm') {
      for (const l of this.lairs) {
        if (l.dead) continue;
        if (dist(l.x, l.y, x, y) - l.radius <= range) out.push(l);
      }
    } else {
      for (const b of this.buildings) {
        if (b.dead) continue;
        if (dist(b.x, b.y, x, y) - b.radius <= range) out.push(b);
      }
    }
    return out;
  }

  /**
   * Closest hostile within `range`. `includeStructures` brings in whatever
   * counts as a building to the *other* side: lairs for the realm, your town
   * for the monsters.
   */
  nearestEnemy(x, y, range, myFaction, includeStructures = false) {
    let best = null, bestD = range;
    for (const u of this.units) {
      if (u.dead || u.faction === myFaction) continue;
      if (u.unseen) continue;            // you cannot pick a fight with what you cannot see
      const d = dist(u.x, u.y, x, y);
      if (d < bestD) { bestD = d; best = u; }
    }
    if (includeStructures) {
      const list = myFaction === 'monster' ? this.buildings : this.lairs;
      for (const b of list) {
        if (b.dead) continue;
        const d = dist(b.x, b.y, x, y) - b.radius;
        if (d < bestD) { bestD = d; best = b; }
      }
    }
    return best;
  }

  nearestBuilding(x, y, pred, maxDist = 1e9) {
    let best = null, bestD = maxDist;
    for (const b of this.buildings) {
      if (b.dead || (pred && !pred(b))) continue;
      const d = dist(b.x, b.y, x, y);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  /** Is anything of the realm within `range` of this point? */
  someoneNear(x, y, range) {
    for (const u of this.units) {
      if (u.dead || u.faction !== 'realm') continue;
      if (dist(u.x, u.y, x, y) <= range) return true;
    }
    for (const b of this.buildings) {
      if (b.dead) continue;
      if (dist(b.x, b.y, x, y) - b.radius <= range) return true;
    }
    return false;
  }

  nearestDepot(x, y) {
    return this.nearestBuilding(x, y, b => b.complete && b.def.depot);
  }

  /** Extra yield from a lumberyard / mining camp standing near a node. */
  depotBoost(tx, ty, res) {
    let boost = 0;
    const x = toPx(tx), y = toPx(ty);
    for (const b of this.buildings) {
      if (b.dead || !b.complete || !b.def.boost) continue;
      const add = b.def.boost[res];
      if (!add) continue;
      if (dist(b.x, b.y, x, y) <= b.def.radius * TILE) boost += add;
    }
    return boost;
  }

  healBuilding(x, y) {
    return this.nearestBuilding(x, y, b => b.complete && (b.defId === 'temple' || b.def.shop === 'rest'))
      || this.nearestBuilding(x, y, b => b.complete && b.def.guild)
      || this.palace;
  }

  smithPrice(u) { return 80 + (u.upgrades || 0) * 70; }

  /**
   * A tile on the edge of the known world, within `maxTiles` of the hero's
   * home. Anchoring to home is what stops a curious warrior from strolling
   * forty tiles into an ogre den: to reach further you have to pay a flag.
   */
  frontierTile(homeX, homeY, maxTiles) {
    const w = this.world;
    const cx = toTile(homeX), cy = toTile(homeY);
    for (let tries = 0; tries < 60; tries++) {
      const a = this.rng() * Math.PI * 2;
      const d = 5 + this.rng() * maxTiles;
      const tx = Math.round(cx + Math.cos(a) * d);
      const ty = Math.round(cy + Math.sin(a) * d);
      if (!w.inside(tx, ty) || !w.passable(tx, ty)) continue;
      if (w.fog[w.idx(tx, ty)] === 0) return { tx, ty };
    }
    return null;
  }

  /** What a raiding monster marches toward. */
  raidTarget(u) {
    const b = this.nearestBuilding(u.x, u.y, b => !b.dead, 2400);
    if (b) return b;
    let best = null, bestD = 2400;
    for (const v of this.units) {
      if (v.dead || v.faction !== 'realm') continue;
      const d = dist(v.x, v.y, u.x, u.y);
      if (d < bestD) { bestD = d; best = v; }
    }
    return best;
  }

  // -----------------------------------------------------------------
  // damage & death
  // -----------------------------------------------------------------
  applyDamage(target, amount, src, crit = false) {
    if (!target || target.dead) return;
    if (target.kindClass === 'unit') {
      target.damageTaken(amount, src);
      if (target.faction === 'realm' && !target.target && src && src.kindClass === 'unit') {
        target.engage(src);   // fight back
      }
    } else {
      amount *= STRUCTURE_DMG;
      target.damage(amount, src);
      if (target.faction === 'realm') this.reportAttack(target, src);
    }
    this.fx.damage(target.x, target.y - (target.radius || 6), amount, crit);
  }

  onUnitDeath(u, src) {
    this.fx.burst(u.x, u.y - 4, u.faction === 'monster' ? '#a03a3a' : '#c0a0d0', 10, 46, 0.6);
    this.audio.play('die');
    if (u.job && u.job.type === 'build' && u.job.site) u.job.site.builders--;

    if (u.faction === 'monster') {
      this.stats.kills++;
      if (src && src.kindClass === 'unit' && src.faction === 'realm') {
        src.kills++;
        if (src.isHero) {
          src.gold += u.def.gold;
          this.fx.coin(u.x, u.y - 10, u.def.gold);
        }
      }
      this.shareXp(u, src, u.def.xp);
      this.rollDrop(u, src);
    } else if (u.isHero) {
      this.stats.heroesLost++;
      this.graves.push({
        kind: u.kind, name: u.name, level: u.level, xp: u.xp,
        upgrades: u.upgrades || 0, homeId: u.homeId, x: u.x, y: u.y
      });
      this.world.addProp('tomb', toTile(u.x), toTile(u.y));
      this.notify(`${u.name} the ${u.title} has fallen`, 'bad');
    } else if (u.kind === 'peasant') {
      this.notify('A peasant was killed', 'bad');
    }
    this.recomputePop();
  }

  /** Shout once, not sixty times a second, when the town is being chewed on. */
  reportAttack(b, src) {
    if (this.time - (this.lastAttackCry || -99) < 9) return;
    this.lastAttackCry = this.time;
    this.notify(`${b.name} under attack!`, 'bad');
    this.audio.play('warn');
    this.alertAt = { x: b.x, y: b.y, t: this.time };
  }

  onBuildingComplete(b) {
    this.audio.play('build');
    this.fx.ring(b.x, b.bottom - 8, '#ffc94a', 16);
    this.notify(`${b.name} completed`, 'good');
    this.recomputePop();
    this.revealAround(b.x, b.y, (b.def.sight || 7));
    for (const u of this.units) {
      if (u.job && u.job.type === 'build' && u.job.site === b) u.job = null;
    }
  }

  onBuildingDestroyed(b, src) {
    this.fx.burst(b.x, b.y, '#a03a3a', 24, 70, 1.0);
    this.audio.play('crash');
    this.notify(`${b.name} destroyed!`, 'bad');
    this.world.addProp('rock', b.tx, b.ty);
    this.recomputePop();
    if (b === this.palace) this.endGame('lose');
  }

  onLairDestroyed(l, src) {
    this.stats.lairsCleared++;
    this.fx.burst(l.x, l.y, '#ffc94a', 30, 80, 1.2);
    this.audio.play('crash');
    const reward = l.def.reward;
    this.addResource('gold', reward);
    this.notify(`${l.name} destroyed! +${reward} gold`, 'good');
    this.shareXp(l, src, l.def.xp);
    const hoard = LAIR_DROPS[l.def.id];
    if (hoard) this.rollDrop({ x: l.x, y: l.y, kind: l.def.id }, src, hoard);
    // its brood loses cohesion and wanders
    for (const m of l.spawned) if (!m.dead) m.raiding = true;
    const i = this.world.props.findIndex(p => p.lairId === l.id);
    if (i >= 0) {
      const p = this.world.props[i];
      this.world.propAt[this.world.idx(p.tx, p.ty)] = -1;
      this.world.props[i] = { ...p, kind: 'rock', lairId: null };
    }
    if (this.lairs.every(x => x.dead)) this.endGame('win');
  }

  endGame(result) {
    if (this.over) return;
    this.over = result;
    this.audio.play(result === 'win' ? 'win' : 'lose');
  }

  // -----------------------------------------------------------------
  // economy
  // -----------------------------------------------------------------
  addResource(res, n) {
    this.res[res] = (this.res[res] || 0) + n;
    if (res === 'gold' && n > 0) this.stats.goldEarned += n;
  }
  canAfford(cost) {
    for (const k in cost) if ((this.res[k] || 0) < cost[k]) return false;
    return true;
  }
  spend(cost) {
    if (!this.canAfford(cost)) return false;
    for (const k in cost) this.res[k] -= cost[k];
    return true;
  }
  get spendableGold() { return this.res.gold; }

  recomputePop() {
    let cap = 0;
    for (const b of this.buildings) if (!b.dead && b.complete && b.def.pop) cap += b.def.pop;
    let pop = 0;
    for (const u of this.units) if (!u.dead && u.faction === 'realm') pop += u.def.pop || 0;
    this.popCap = cap; this.pop = pop;
  }

  collectTax() {
    let total = 0;
    for (const b of this.buildings) {
      if (b.dead || !b.complete || !b.def.tax) continue;
      total += b.def.tax;
    }
    if (total > 0) {
      this.addResource('gold', total);
      if (this.palace && !this.palace.dead) this.fx.coin(this.palace.x, this.palace.y - 26, total);
    }
  }

  // -----------------------------------------------------------------
  // player commands
  // -----------------------------------------------------------------
  canPlace(defId, tx, ty) {
    const def = BUILDINGS[defId];
    if (!def) return false;
    if (!this.world.areaFree(tx, ty, def.fw, def.fh, true)) return false;
    // must be on ground you have actually seen
    for (let y = ty; y < ty + def.fh; y++)
      for (let x = tx; x < tx + def.fw; x++)
        if (!this.world.seen(x, y)) return false;
    return true;
  }

  unlocked(defId) {
    const def = BUILDINGS[defId];
    if (!def || !def.needs) return true;
    return def.needs.every(n => this.buildings.some(b => !b.dead && b.complete && b.defId === n));
  }

  placeBuilding(defId, tx, ty) {
    const def = BUILDINGS[defId];
    if (!this.unlocked(defId)) { this.notify(`Requires ${BUILDINGS[def.needs[0]].name}`, 'bad'); return null; }
    if (!this.canPlace(defId, tx, ty)) { this.notify('Cannot build there', 'bad'); return null; }
    if (!this.canAfford(def.cost)) { this.notify('Not enough resources', 'bad'); return null; }
    this.spend(def.cost);
    // clear scenery under the footprint
    for (let y = ty; y < ty + def.fh; y++) {
      for (let x = tx; x < tx + def.fw; x++) {
        const i = this.world.idx(x, y);
        const p = this.world.propAt[i];
        if (p >= 0) { this.world.propAt[i] = -1; this.world.props[p].removed = true; }
      }
    }
    const b = new Building(this, defId, tx, ty, false);
    this.buildings.push(b);
    this.audio.play('place');
    this.notify(`${def.name} site laid — peasants will build it`, 'good');
    this.sendBuilders(b, 2);
    return b;
  }

  /** Who to call up: idle hands first, then whoever is closest. */
  pickTrainee(x, y) {
    const pool = this.units.filter(u => !u.dead && u.kind === 'peasant' && !u.knightKind);
    if (!pool.length) return null;
    const idle = pool.filter(u => u.mission === 'none');
    // only pull somebody off a job if nobody is standing around
    const from = idle.length ? idle : pool;
    return from.sort((a, b) => dist(a.x, a.y, x, y) - dist(b.x, b.y, x, y))[0];
  }

  /** Take a unit off the board without the fanfare of a death. */
  retireUnit(u) {
    if (u.job && u.job.type === 'build' && u.job.site) u.job.site.builders--;
    u.job = null;
    u.dead = true;
  }

  /**
   * Knight a villager into a soldier class. Soldiers are not conjured out of
   * gold -- somebody's miner puts down the pick. They keep who they were:
   * their baseline and everything the work taught them carry over, and the
   * class bonus is laid on top rather than replacing any of it.
   */
  knightVillager(u, kind, hall) {
    if (!u || u.dead || u.kind !== 'peasant') return null;
    const cls = CLASSES[kind];
    if (!cls) return null;
    const home = hall
      || this.nearestBuilding(u.x, u.y, b => b.complete && b.def.guild === kind);
    if (!home) {
      const need = Object.values(BUILDINGS).find(d => d.guild === kind);
      this.notify(`Build a ${need ? need.name : 'guild'} first`, 'bad');
      return null;
    }
    if (!home.complete) { this.notify(`${home.name} is not finished yet`, 'bad'); return null; }
    // the drilling villager already paid and already holds their place
    if (!u.knightKind && this.guildRoll(home, kind) >= home.def.maxHeroes) {
      this.notify(`${home.name} is full`, 'bad');
      return null;
    }
    if (!u.knightKind) {
      if (!this.canAfford(cls.cost)) { this.notify(`Not enough gold to train a ${cls.name}`, 'bad'); return null; }
      this.spend(cls.cost);
    }

    const w = this.spawnUnit(kind, u.x, u.y, 'realm');
    w.name = u.name;
    w.baseStats = { ...u.baseStats };   // they are still themselves
    w.training = { ...u.training };     // and still know what the work taught them
    w.hp = w.maxHpNow;
    w.gold = 20;
    w.stance = 'defend';
    w.homeId = home.id; w.homeX = home.x; w.homeY = home.y;
    this.retireUnit(u);
    this.recomputePop();
    this.fx.ring(w.x, w.y - 8, MISSIONS[kind] ? MISSIONS[kind].colour : '#e07a50', 15);
    this.fx.text(w.x, w.y - 20, kind === 'ranger' ? 'TAKES THE BOW' : 'TAKES UP ARMS', '#e07a50', 24);
    this.audio.play('recruit');
    this.notify(`${w.name} becomes a ${cls.name}`, 'good');
    this.lastTrained = w;
    return w;
  }

  /**
   * Drop a ready-made party next to the City Centre. This is a testing hatch,
   * reached with ?test=1 (or ?heroes=warrior:3,cleric:1), not something the
   * game does on its own -- levelling a soldier to the rank cap the honest way
   * is a campaign's work, and trying out a specialisation should not require
   * one first.
   */
  spawnTestParty(spec = 'warrior:3,ranger:3', level = MAX_LEVEL) {
    const made = [];
    let ring = 3;
    for (const part of String(spec).split(',')) {
      const [kind, nRaw] = part.split(':');
      const cls = CLASSES[kind];
      if (!cls || !HERO_CLASSES.includes(kind)) continue;
      const n = Math.max(1, Math.min(8, parseInt(nRaw, 10) || 1));
      for (let i = 0; i < n; i++) {
        const a = (made.length / 6) * Math.PI * 2 + 0.4;
        const t = this.world.nearestFree(
          Math.round(toTile(this.palace.x) + Math.cos(a) * ring),
          Math.round(toTile(this.palace.y) + Math.sin(a) * ring), 9);
        const u = this.spawnUnit(kind, toPx(t.x), toPx(t.y), 'realm');
        u.level = Math.max(1, Math.min(MAX_LEVEL, level));
        u.xp = XP_TABLE[u.level - 1] || 0;
        u.hp = u.maxHpNow;
        u.mana = u.maxMana;
        u.gold = 40;
        u.stance = 'defend';
        made.push(u);
        if (made.length % 6 === 0) ring += 2;
      }
    }
    if (made.length) {
      this.notify(`${made.length} veterans answer the call`, 'good');
    }
    return made;
  }

  /**
   * Loot. Not everything carries something -- a rat almost never does and an
   * ogre often will -- and whatever falls goes to one of the heroes who was
   * actually there, chosen at random among them. They wear it if it beats
   * what they have, by their own class's reckoning, and otherwise carry it to
   * market.
   */
  rollDrop(victim, killer, forced = null) {
    const table = forced || DROPS[victim.kind];
    if (!table) return null;
    const count = table.count || 1;
    const out = [];
    for (let i = 0; i < count; i++) {
      if (!forced && this.rng() > table.chance) continue;
      const item = rollItem(this.rng, { tierBias: table.bias || 0 });
      const taker = this.pickLooter(victim);
      if (!taker) { this.groundLoot(item, victim.x, victim.y); out.push(item); continue; }
      const where = taker.takeItem(item);
      const tier = TIERS[item.tier];
      this.fx.text(taker.x, taker.y - 26, item.name, tier.colour, 30);
      if (tier.rank >= 2) {
        this.notify(`${taker.name} finds ${item.name} (${tier.name.toLowerCase()})`, 'good');
        this.fx.ring(taker.x, taker.y - 6, tier.colour, 14);
        this.audio.play('level');
      } else if (where === 'worn') {
        this.notify(`${taker.name} puts on ${item.name}`);
      }
      out.push(item);
    }
    return out.length ? out[0] : null;
  }

  /** Whichever hero was nearby when it fell, picked at random among them. */
  pickLooter(victim) {
    const near = this.units.filter(u => !u.dead && u.isHero
      && dist(u.x, u.y, victim.x, victim.y) < 260);
    const pool = near.length ? near : this.units.filter(u => !u.dead && u.isHero);
    if (!pool.length) return null;
    return pool[Math.floor(this.rng() * pool.length) % pool.length];
  }

  /** Nobody to take it: it goes straight to the market shelf instead. */
  groundLoot(item) {
    const market = this.buildings.find(b => !b.dead && b.complete && b.def.market);
    if (market) this.stockMarket(market, item);
  }

  // -----------------------------------------------------------------
  // the marketplace
  // -----------------------------------------------------------------
  /** Put an item on the shelf, dropping the cheapest if the shelf is full. */
  stockMarket(b, item) {
    if (!b.stock) b.stock = [];
    b.stock.push(item);
    if (b.stock.length > MARKET_SLOTS) {
      b.stock.sort((x, y) => y.value - x.value);
      b.stock.length = MARKET_SLOTS;
    }
  }

  /** The shelf refills itself over time, so there is always something to want. */
  restockMarket(b, dt) {
    if (!b.stock) b.stock = [];
    b.restockIn = (b.restockIn === undefined ? 8 : b.restockIn) - dt;
    if (b.restockIn > 0) return;
    b.restockIn = MARKET_RESTOCK;
    if (b.stock.length >= MARKET_SLOTS) return;
    // what the shelf offers improves as the realm does
    const bias = Math.min(1.6, (this.day - 1) * 0.05);
    this.stockMarket(b, rollItem(this.rng, { tierBias: bias }));
  }

  /**
   * A hero at the market: sells whatever they are carrying, then buys the one
   * thing on the shelf that beats what they are wearing and that they can
   * actually afford. Their gold, their decision -- you only take the tax.
   */
  heroTrades(u, b) {
    if (!b.stock) b.stock = [];
    let sold = 0;
    for (const it of u.bag) {
      const price = Math.round(it.value * 0.5);
      u.gold += price;
      this.addResource('gold', Math.round(price * 0.25));   // your cut
      this.stockMarket(b, it);
      sold += price;
    }
    if (sold > 0) {
      u.bag.length = 0;
      this.fx.coin(b.x, b.y - 12, sold);
      this.audio.play('coin');
    }

    let best = null, bestGain = 0, bestIdx = -1;
    for (let i = 0; i < b.stock.length; i++) {
      const it = b.stock[i];
      if (!canUse(u, it) || it.value > u.gold) continue;
      const key = u.bestSlotFor(it);
      const gain = scoreFor(u, it) - scoreFor(u, u.gear[key]);
      if (gain > bestGain) { bestGain = gain; best = it; bestIdx = i; }
    }
    if (best) {
      u.gold -= best.value;
      this.addResource('gold', Math.round(best.value * 0.3));   // your cut again
      b.stock.splice(bestIdx, 1);
      u.takeItem(best);
      this.notify(`${u.name} buys ${best.name}`, 'good');
      this.fx.text(u.x, u.y - 24, 'BOUGHT', TIERS[best.tier].colour, 26);
      this.audio.play('coin');
    }
    return !!best || sold > 0;
  }

  /**
   * Hand out the credit for something dying. It used to go entirely to
   * whoever landed the last blow, which meant two of any three heroes who
   * fought a thing together got nothing at all, and a cleric who kept all
   * three of them standing got nothing ever.
   *
   * Now everyone who had a hand in it recently shares, and the party earns a
   * little more in total than a lone hero would -- so each individual share
   * is smaller but bringing friends is still worth doing.
   */
  shareXp(victim, killer, amount) {
    if (!amount) return;
    const weight = new Map();
    const add = (u, w) => {
      if (!u || u.dead || u.kindClass !== 'unit' || u.faction !== 'realm') return;
      if (!u.isHero) return;
      weight.set(u, Math.max(weight.get(u) || 0, w));
    };
    if (victim.contributors) for (const u of victim.contributors()) add(u, 1);
    add(killer, 1);
    // Whoever kept the party standing took part in this too -- but at a lower
    // weight than the people actually swinging. A cleric supports every kill
    // in a fight, so on a full share they would out-level the soldiers they
    // are there to keep alive, which is exactly backwards.
    for (const u of this.units) {
      if (u.dead || !u.isHero || !u.def.heal || weight.has(u)) continue;
      if (this.time - (u.lastSupport || -99) > CREDIT_WINDOW) continue;
      add(u, SUPPORT_SHARE);
    }
    if (!weight.size) return;
    let total = 0;
    for (const w of weight.values()) total += w;
    const extra = Math.min(XP_SHARE_BONUS_CAP, weight.size - 1);
    const pot = amount * (1 + XP_SHARE_BONUS * extra);
    for (const [u, w] of weight) u.gainXp(pot * (w / total));
  }

  /**
   * Lock in a specialisation. Offered once the soldier is ranked high enough,
   * taken once, and permanent -- it is the one irreversible choice a unit
   * makes, which is what gives it any weight.
   */
  chooseSpec(u, specId) {
    if (!u || u.dead || !u.canSpec) return null;
    const list = SPECS[u.kind] || [];
    const sp = list.find(x => x.id === specId);
    if (!sp) return null;
    u.spec = sp.id;
    u.title = `${sp.name} ${CLASSES[u.kind].name}`;
    u.hp = u.maxHpNow;                  // the new constitution is theirs at once
    // Rage you have to work up; focus you simply have, until you spend it.
    const pw = u.chargeDef;
    u.charge = pw && pw.startFull ? pw.max : 0;
    if (sp.stealth) u.conceal(Infinity);
    this.fx.ring(u.x, u.y - 6, sp.colour, 18);
    this.fx.text(u.x, u.y - 22, sp.name.toUpperCase(), sp.colour, 28);
    this.audio.play('level');
    this.notify(`${u.name} becomes a ${sp.name} ${CLASSES[u.kind].name}`, 'good');
    return sp;
  }

  /** Put a talent point into one of a calling's talents. */
  spendTalent(u, missionId, talentId) {
    if (!u || u.dead) return false;
    const ok = u.spendTalent(missionId, talentId);
    if (ok) {
      this.fx.text(u.x, u.y - 16, '+' + (WORK_TALENTS[missionId]
        .find(t => t.id === talentId) || {}).name, '#7fd8a0', 20);
      this.audio.play('coin');
    }
    return ok;
  }

  /** Hand every point in a tree back, so a bad pick is never permanent. */
  resetTalents(u, missionId) {
    if (!u || u.dead) return false;
    u.clearTalents(missionId);
    this.notify(`${u.name} rethinks their ${(MISSIONS[missionId] || {}).name || missionId} training`);
    return true;
  }

  /**
   * Everyone already promised to a guild: soldiers of that class plus the
   * villagers currently drilling for it. Both count against its capacity.
   */
  guildRoll(guildBuilding, kind) {
    let n = 0;
    for (const u of this.units) {
      if (u.dead) continue;
      if (u.homeId === guildBuilding.id && u.kind === kind) n++;
      else if (u.kind === 'peasant' && u.knightKind === kind && u.knightHall === guildBuilding.id) n++;
    }
    return n;
  }

  /**
   * Mark a villager for knighthood. They do not become a soldier on the spot --
   * they down tools, take up a spear, guard the other villagers while they
   * drill, and are knighted when the drilling is done.
   */
  markForKnighthood(u, kind, hall) {
    if (!u || u.dead || u.kind !== 'peasant') return null;
    if (u.knightKind) { this.notify(`${u.name} is already drilling`, 'bad'); return null; }
    const cls = CLASSES[kind];
    const m = MISSIONS[kind];
    if (!cls || !m) return null;
    const home = hall
      || this.nearestBuilding(u.x, u.y, b => b.complete && b.def.guild === kind);
    if (!home) {
      const need = Object.values(BUILDINGS).find(d => d.guild === kind);
      this.notify(`Build a ${need ? need.name : 'guild'} first`, 'bad');
      return null;
    }
    if (!home.complete) { this.notify(`${home.name} is not finished yet`, 'bad'); return null; }
    if (this.guildRoll(home, kind) >= home.def.maxHeroes) { this.notify(`${home.name} is full`, 'bad'); return null; }
    if (!this.canAfford(cls.cost)) { this.notify(`Not enough gold to train a ${cls.name}`, 'bad'); return null; }
    this.spend(cls.cost);

    if (u.job && u.job.type === 'build' && u.job.site) u.job.site.builders--;
    u.job = null;
    u.prevJob = null;
    u.carry = 0;
    u.mission = kind;
    u.knightKind = kind;
    u.knightHall = home.id;
    u.knightLeft = m.drill;
    u.knightTotal = m.drill;
    u.knightPaid = cls.cost.gold || 0;
    u.bonusDmg = RECRUIT_DMG;      // a spear in hand counts for something
    u.stalledOn = null;
    u.path = null; u.needPath = null;
    this.fx.text(u.x, u.y - 18, 'CALLED UP', m.colour, 22);
    this.audio.play('order');
    this.notify(`${u.name} is called up to the ${home.name}`, 'good');
    return u;
  }

  /** Change of heart: give the villager back their life, and the gold back. */
  cancelKnighthood(u, quiet) {
    if (!u || !u.knightKind) return false;
    if (u.knightPaid) { this.res.gold += u.knightPaid; }
    if (!quiet) this.notify(`${u.name} returns to the fields`, '');
    u.knightKind = null; u.knightHall = null;
    u.knightLeft = 0; u.knightTotal = 0; u.knightPaid = 0;
    u.bonusDmg = 0;
    return true;
  }

  /** Kept for older call sites; warriors are just one kind of knighting. */
  trainWarrior(u, hall) { return this.knightVillager(u, 'warrior', hall); }

  /**
   * The most recent worker to be attacked, if the cry is still fresh.
   * Soldiers on Defend drop everything for this.
   */
  distressed() {
    let best = null, latest = -1;
    for (const u of this.units) {
      if (u.dead || u.faction !== 'realm' || u.kind !== 'peasant') continue;
      const hit = u.lastHit || -1e9;
      if (this.time - hit > DISTRESS_WINDOW) continue;
      if (hit > latest) { latest = hit; best = u; }
    }
    return best;
  }

  /** Put the nearest peasants on a site; miners remember what they were doing. */
  sendBuilders(site, count) {
    const pool = this.units
      .filter(u => !u.dead && u.kind === 'peasant' && !(u.job && u.job.type === 'build'))
      .sort((a, c) => {
        // free hands first, then whoever is closest
        const fa = a.job ? 1 : 0, fc = c.job ? 1 : 0;
        if (fa !== fc) return fa - fc;
        return dist(a.x, a.y, site.x, site.y) - dist(c.x, c.y, site.x, site.y);
      });
    let n = 0;
    for (const p of pool) {
      if (n >= count) break;
      if (p.job) p.prevJob = p.job;
      p.job = { type: 'build', site };
      p.path = null; p.needPath = null;
      site.builders++;
      n++;
    }
    if (!n) this.notify('No peasants free to build — hire more', 'bad');
    return n;
  }

  recruit(building, kind, mission) {
    const cls = CLASSES[kind];
    if (!cls || !building || building.dead) return null;
    if (!building.complete) { this.notify(`${building.name} is not finished yet`, 'bad'); return null; }
    if (this.pop + (cls.pop || 0) > this.popCap) { this.notify('Population cap reached — build huts', 'bad'); return null; }
    if (building.def.guild === kind) {
      // a guild arms a villager rather than summoning a stranger
      const trainee = this.pickTrainee(building.x, building.y);
      if (!trainee) { this.notify('No villager free to train', 'bad'); return null; }
      return this.markForKnighthood(trainee, kind, building);
    }
    if (building.def.guild) {
      const alive = this.units.filter(u => !u.dead && u.homeId === building.id).length;
      if (alive >= building.def.maxHeroes) { this.notify(`${building.name} is full`, 'bad'); return null; }
    }
    if (!this.canAfford(cls.cost)) { this.notify('Not enough gold', 'bad'); return null; }
    this.spend(cls.cost);
    const t = building.approach(null);
    const u = this.spawnUnit(kind, toPx(t.x), toPx(t.y), 'realm');
    if (kind === 'peasant' && mission) u.mission = mission;
    u.homeId = building.id;
    u.homeX = building.x; u.homeY = building.y;
    if (u.isHero) {
      u.gold = 25;
      this.notify(`${u.name} the ${u.title} joins the realm`, 'good');
    }
    this.audio.play('recruit');
    return u;
  }

  resurrect(graveIndex) {
    const gr = this.graves[graveIndex];
    if (!gr) return null;
    const cls = CLASSES[gr.kind];
    const temple = this.buildings.some(b => !b.dead && b.complete && b.defId === 'temple');
    const price = Math.round(cls.cost.gold * RESURRECT_COST * (temple ? 0.5 : 1));
    if (this.res.gold < price) { this.notify(`Need ${price} gold to raise ${gr.name}`, 'bad'); return null; }
    if (this.pop + 1 > this.popCap) { this.notify('Population cap reached', 'bad'); return null; }
    const guild = this.buildings.find(b => b.id === gr.homeId && !b.dead)
      || this.buildings.find(b => !b.dead && b.complete && b.def.guild === gr.kind)
      || this.palace;
    this.res.gold -= price;
    const t = guild.approach(null);
    const u = this.spawnUnit(gr.kind, toPx(t.x), toPx(t.y), 'realm');
    u.homeId = guild.id; u.homeX = guild.x; u.homeY = guild.y;
    u.name = gr.name;
    u.level = gr.level; u.xp = gr.xp; u.upgrades = gr.upgrades;
    u.bonusDmg = gr.upgrades * 4;
    u.hp = u.maxHpNow;
    this.graves.splice(graveIndex, 1);
    this.fx.ring(u.x, u.y - 8, '#7fd8a0', 16);
    this.audio.play('level');
    this.notify(`${u.name} walks again`, 'good');
    return u;
  }

  /** Which calling a given resource implies. */
  missionForNode(kind) {
    return kind === 'goldmine' ? 'miner'
      : kind === 'quarry' ? 'quarrier'
        : (kind === 'tree' || kind === 'pine') ? 'woodcutter' : 'none';
  }

  /**
   * Give peasants a calling. They keep it until you change it, finding their
   * own work and moving on when a seam runs dry.
   */
  assignMission(units, missionId) {
    const m = MISSIONS[missionId];
    if (!m) return 0;

    // "Warrior" is not a job you do in the fields -- it changes what you are
    if (m.becomes) {
      const made = [];
      for (const u of units) { if (this.markForKnighthood(u, m.becomes)) made.push(u); }
      this.lastTrained = made[made.length - 1] || null;
      this.trainedBatch = made;
      return made.length;
    }

    // Anyone in the realm can take a calling -- villagers and veterans alike.
    // A knighthood is a layer on top of who somebody is, so sending a warrior
    // back to the seam costs them nothing they earned.
    let n = 0, first = null;
    for (const u of units) {
      if (!u || u.dead) continue;
      if (u.kind !== 'peasant' && !u.isHero) continue;
      if (u.knightKind) this.cancelKnighthood(u);
      if (u.job && u.job.type === 'build' && u.job.site) u.job.site.builders--;
      u.mission = missionId;
      u.job = null;
      u.prevJob = null;
      u.stalledOn = null;
      u.target = null;
      u.state = 'idle';
      u.path = null; u.needPath = null;
      if (!first) first = u;
      n++;
    }
    if (n) {
      this.notify(n === 1
        ? `${first.name} is now a ${m.name}`
        : `${n} of the realm are now ${m.name}s`, 'good');
      this.audio.play('order');
    }
    return n;
  }

  /** Tapping a specific seam: same calling, but start on the one you picked. */
  assignWorkers(units, node) {
    let n = 0;
    const mission = this.missionForNode(node.kind);
    for (const u of units) {
      if (u.dead || u.kind !== 'peasant') continue;
      if (u.job && u.job.type === 'build' && u.job.site) u.job.site.builders--;
      u.mission = mission;
      u.job = { type: 'harvest', node };
      u.prevJob = null;
      u.stalledOn = null;
      u.state = 'walk';
      u.path = null; u.needPath = null;
      const t = this.world.approachTile(node.tx, node.ty, node.fw, node.fh, u.x, u.y);
      u.goTo(t.x, t.y);
      n++;
    }
    if (n) {
      const what = node.kind === 'goldmine' ? 'the gold mine' : node.kind === 'quarry' ? 'the quarry' : 'the woods';
      this.notify(`${n} peasant${n > 1 ? 's' : ''} sent to ${what}`, 'good');
      this.audio.play('order');
    }
    return n;
  }

  moveWorkers(units, tx, ty) {
    let n = 0;
    for (const u of units) {
      if (u.dead || u.kind !== 'peasant') continue;
      if (u.job && u.job.type === 'build' && u.job.site) u.job.site.builders--;
      u.job = null;
      u.mission = 'none';
      u.homeX = toPx(tx); u.homeY = toPx(ty);
      u.goTo(tx, ty, 1);
      n++;
    }
    if (n) this.audio.play('order');
    return n;
  }

  // -----------------------------------------------------------------
  // reward flags
  // -----------------------------------------------------------------
  placeFlag(type, x, y, bounty) {
    const def = FLAGS[type];
    if (!def) return null;
    if (type !== 'fear') {
      if (this.res.gold < bounty) { this.notify('Not enough gold for that bounty', 'bad'); return null; }
      this.res.gold -= bounty;
      this.reserved += bounty;
    } else bounty = 0;

    const f = {
      id: this.nextFlagId++, type, x, y, bounty, paid: 0,
      radius: type === 'explore' ? 4 : type === 'fear' ? 5 : 5,
      done: false, claimed: null, age: 0
    };
    this.flags.push(f);
    this.audio.play('flag');
    this.notify(`${def.name} raised${bounty ? ` — ${bounty} gold offered` : ''}`);
    return f;
  }

  removeFlag(f) {
    const i = this.flags.indexOf(f);
    if (i < 0) return;
    if (!f.done && f.bounty > f.paid) {
      const refund = f.bounty - f.paid;
      this.res.gold += refund;
      this.reserved -= refund;
      this.notify(`Flag withdrawn — ${refund} gold returned`);
    }
    this.flags.splice(i, 1);
    for (const u of this.units) if (u.flagId === f.id) u.flagId = null;
  }

  /** Called every think-tick while a hero stands inside a flag's circle. */
  heroAtFlag(u, f, since) {
    const r = f.radius * TILE;
    switch (f.type) {
      case 'explore': {
        this.revealAround(f.x, f.y, f.radius + 4);
        this.payFlag(f, u, f.bounty);
        break;
      }
      case 'attack': {
        // Living defenders first. Searching with structures included always
        // returned the lair itself -- the flag sits on top of it, so its edge
        // distance is negative and it wins every time, and the heroes hacked
        // at the building while the rats ate them.
        const foe = this.nearestEnemy(f.x, f.y, r + 40, 'realm', false)
          || this.nearestEnemy(u.x, u.y, 110, 'realm', false);
        if (foe) { u.engage(foe); u.fight(since); return; }
        const lair = this.lairs.find(l => !l.dead && dist(l.x, l.y, f.x, f.y) <= r + 24);
        if (lair) { u.engage(lair); u.fight(since); return; }
        this.payFlag(f, u, f.bounty);
        break;
      }
      case 'defend': {
        f.claimed = u.id;
        const foe = this.nearestEnemy(f.x, f.y, r + 40, 'realm');
        if (foe) { u.engage(foe); u.fight(since); }
        const tick = Math.min(f.bounty - f.paid, (f.bounty / 45) * since);
        if (tick > 0) {
          f.paid += tick;
          u.gold += tick;
          this.reserved -= tick;
          if (Math.random() < 0.12) this.fx.coin(u.x, u.y - 12, tick * 8);
        }
        if (f.paid >= f.bounty - 0.01) this.payFlag(f, u, 0);
        break;
      }
    }
  }

  payFlag(f, u, amount) {
    if (f.done) return;
    f.done = true;
    // defend flags trickle out, so release whatever rounding left behind
    const residue = Math.max(0, f.bounty - f.paid - amount);
    if (residue > 0) { this.res.gold += residue; this.reserved -= residue; }
    if (amount > 0) {
      u.gold += amount;
      this.reserved -= amount;
      f.paid += amount;
      this.fx.coin(u.x, u.y - 14, amount);
      this.fx.text(f.x, f.y - 20, 'CLAIMED', '#ffc94a', 24);
    }
    this.stats.flagsPaid++;
    this.audio.play('reward');
    this.notify(`${u.name} claimed the ${FLAGS[f.type].name.toLowerCase()}${amount ? ` (+${Math.round(amount)}g)` : ''}`, 'good');
    const i = this.flags.indexOf(f);
    if (i >= 0) this.flags.splice(i, 1);
    for (const h of this.units) if (h.flagId === f.id) h.flagId = null;
  }

  heroShops(u, b) {
    u.shopCool = (u.shopCool || 0) - 0.3;
    if (u.shopCool > 0) return;
    u.shopCool = 1.4;
    const kind = b.def.shop;
    let price = 0;
    if (kind === 'market') {
      if (!this.heroTrades(u, b)) u.state = 'idle';
      return;                       // the market takes its own cut as it goes
    }
    if (kind === 'potion') {
      price = 45;
      if (u.gold < price || u.potions >= 2) { u.state = 'idle'; return; }
      u.potions++;
      this.fx.text(b.x, b.y - 18, 'potion', '#7fd8a0', 18);
    } else if (kind === 'weapon') {
      price = this.smithPrice(u);
      if (u.gold < price) { u.state = 'idle'; return; }
      u.upgrades = (u.upgrades || 0) + 1;
      u.bonusDmg += 4;
      this.fx.text(b.x, b.y - 18, 'weapon +' + u.upgrades, '#ffc94a', 20);
    } else if (kind === 'rest') {
      price = 25;
      if (u.gold < price || u.hp > u.maxHpNow * 0.92) { u.state = 'idle'; return; }
      u.heal(u.maxHpNow * 0.45);
    } else return;

    u.gold -= price;
    const tax = Math.round(price * 0.7);
    this.addResource('gold', tax);
    this.fx.coin(b.x, b.y - b.radius - 6, tax);
    this.audio.play('coin');
  }

  // -----------------------------------------------------------------
  revealAround(x, y, rTiles) {
    this.world.reveal(toTile(x), toTile(y), rTiles);
  }

  notify(msg, tone = '') {
    this.notices.push({ msg, tone, t: 0 });
    if (this.notices.length > 6) this.notices.shift();
  }

  exhaustNode(node) {
    node.amount = 0;
    const w = this.world;
    // a felled tree vanishes; a spent mine leaves its hole behind but stops
    // blocking the ground it stood on
    if (node.kind === 'tree' || node.kind === 'pine') w.removeProp(node);
    else {
      for (let y = node.ty; y < node.ty + node.fh; y++)
        for (let x = node.tx; x < node.tx + node.fw; x++)
          if (w.inside(x, y)) w.blocked[w.idx(x, y)] = 0;
    }
    // whoever was working it simply looks for the next one on their next think
    for (const u of this.units) if (u.job && u.job.node === node) u.job = null;
  }

  // -----------------------------------------------------------------
  // main tick
  // -----------------------------------------------------------------
  update(dt) {
    if (this.paused || this.over) { this.fx.update(dt); return; }
    dt = Math.min(dt, 0.05) * this.speed;
    this.time += dt;
    this.pathBudget = 26;

    // day clock
    const newDay = 1 + Math.floor(this.time / DAY_SECONDS);
    if (newDay !== this.day) {
      this.day = newDay;
      this.onNewDay();
    }

    // taxes
    this.taxIn -= dt;
    if (this.taxIn <= 0) { this.taxIn = TAX_INTERVAL; this.collectTax(); }

    // fog: dim, then everything friendly lights its own patch
    this.fogIn -= dt;
    if (this.fogIn <= 0) {
      this.fogIn = 0.25;
      this.world.dimFog();
      for (const u of this.units) {
        if (u.dead || u.faction !== 'realm') continue;
        this.world.reveal(u.tx, u.ty, u.def.sight);
      }
      for (const b of this.buildings) {
        if (b.dead) continue;
        this.world.reveal(toTile(b.x), toTile(b.y), b.def.sight || (b.complete ? (b.defId === 'palace' ? 12 : 8) : 5));
      }
    }

    for (const b of this.buildings) if (!b.dead) b.update(dt);
    for (const l of this.lairs) if (!l.dead) l.update(dt);
    for (const u of this.units) if (!u.dead) u.update(dt);
    for (const p of this.projectiles) if (!p.dead) p.update(dt);
    this.separate(dt);
    this.fx.update(dt);

    // wandering wildlife keeps the map from feeling empty
    this.wildIn -= dt;
    if (this.wildIn <= 0) {
      this.wildIn = 22 + this.rng() * 26;
      this.spawnWildlife();
    }

    // escalating raids
    this.waveIn -= dt;
    if (this.waveIn <= 0) {
      this.waveIn = Math.max(80, 200 - this.day * 5);
      if (this.raidsEnabled && this.day > PEACE_DAYS) this.launchRaid();
    }

    // sweep the dead
    if (this.units.some(u => u.dead)) this.units = this.units.filter(u => !u.dead);
    if (this.projectiles.length && this.projectiles.some(p => p.dead)) {
      this.projectiles = this.projectiles.filter(p => !p.dead);
    }
    if (this.buildings.some(b => b.dead)) {
      this.buildings = this.buildings.filter(b => !b.dead);
      this.recomputePop();
    }
    this.selection = this.selection.filter(e => !e.dead);
  }

  /**
   * Tiles around a footprint that somebody is already standing on, as "x,y"
   * keys, so an arriving unit can pick a different one.
   */
  standingTiles(self, o) {
    const s = new Set();
    const cx = o.tx * TILE, cy = o.ty * TILE;
    for (const v of this.units) {
      if (v.dead || v === self) continue;
      if (Math.abs(v.x - cx) > 96 || Math.abs(v.y - cy) > 96) continue;
      s.add(toTile(v.x) + ',' + toTile(v.y));
    }
    return s;
  }

  /**
   * Nudge overlapping units apart. Without this a mine looks like it is
   * being worked by one very wide peasant.
   *
   * The nudge must never out-push walking. It used to be applied straight to
   * each pair, immediately, at a strength that beat a single movement step --
   * so a crowd converging on one approach tile deadlocked: every unit stepped
   * forward and was shoved back exactly as far, and the whole knot stood
   * still for minutes on end while cheerfully reporting itself as `moving`.
   *
   * So: accumulate the shoves, then clamp each unit's total to a fraction of
   * the ground it can cover this tick. Whatever else happens, a walking unit
   * keeps most of its step and the jam resolves itself. Right of way goes to
   * whoever is actually travelling -- the one standing still is the one who
   * steps aside, which is also what people do.
   */
  separate(dt) {
    const arr = this.units;
    const MIN = 11, MIN2 = MIN * MIN;   // a shade over two 5px radii: shoulders, not overlap
    for (let i = 0; i < arr.length; i++) {
      const u = arr[i];
      if (!u.dead) { u.pushX = 0; u.pushY = 0; }
    }
    for (let i = 0; i < arr.length; i++) {
      const a = arr[i];
      if (a.dead) continue;
      for (let j = i + 1; j < arr.length; j++) {
        const b = arr[j];
        if (b.dead) continue;
        let dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= MIN2) continue;
        let d = Math.sqrt(d2);
        if (d < 0.001) { dx = (Math.random() - 0.5); dy = (Math.random() - 0.5); d = 0.5; }
        const shove = (MIN - d) / d;
        let wa = 0.5, wb = 0.5;
        if (a.moving && !b.moving) { wa = 0; wb = 1; }
        else if (b.moving && !a.moving) { wa = 1; wb = 0; }
        a.pushX -= dx * shove * wa; a.pushY -= dy * shove * wa;
        b.pushX += dx * shove * wb; b.pushY += dy * shove * wb;
      }
    }
    for (let i = 0; i < arr.length; i++) {
      const u = arr[i];
      if (u.dead) continue;
      let px = u.pushX, py = u.pushY;
      if (!px && !py) continue;
      const m = Math.hypot(px, py);
      const cap = Math.max(0.25, u.speed * dt * SEPARATION_CAP);
      if (m > cap) { px = px / m * cap; py = py / m * cap; }
      const nx = u.x + px, ny = u.y + py;
      if (this.world.passable(toTile(nx), toTile(ny))) { u.x = nx; u.y = ny; }
    }
  }

  onNewDay() {
    if (this.day % 5 === 0) this.notify(`Day ${this.day}`);
    // heroes idle in town slowly recover between adventures
    for (const u of this.units) {
      if (u.faction === 'realm' && u.isHero && !u.target) u.heal(u.maxHpNow * 0.1);
    }
  }

  spawnWildlife() {
    let wild = 0;
    for (const u of this.units) if (!u.dead && u.faction === 'monster' && !u.lair) wild++;
    if (wild >= WILDLIFE_CAP || !this.monsterBudgetOk()) return;
    const w = this.world;
    for (let t = 0; t < 40; t++) {
      const x = this.rng.int(2, w.w - 3), y = this.rng.int(2, w.h - 3);
      if (!w.passable(x, y)) continue;
      const d = dist(toPx(x), toPx(y), this.palace.x, this.palace.y);
      if (d < 22 * TILE) continue;
      const kind = this.rng.chance(0.6) ? 'rat' : 'slime';
      const m = this.spawnUnit(kind, toPx(x), toPx(y), 'monster');
      m.raidIn = 1e9;   // wildlife never raids the town
      return;
    }
  }

  launchRaid() {
    const live = this.lairs.filter(l => !l.dead && l.active && this.lairThreatensUs(l, 26));
    if (!live.length || !this.monsterBudgetOk()) return;
    // the further into the game, the nastier the visitors
    const lair = this.rng.pick(live);
    const size = clamp(1 + Math.floor((this.day - PEACE_DAYS) / 4), 1, 4);
    let kind = lair.def.spawn;
    if (this.day > 16 && this.rng.chance(0.3)) kind = 'demon';
    for (let i = 0; i < size; i++) {
      if (!this.monsterBudgetOk()) break;
      const t = this.world.nearestFree(lair.tx + this.rng.int(-2, 2), lair.ty + this.rng.int(-2, 2), 6);
      const m = this.spawnUnit(kind, toPx(t.x), toPx(t.y), 'monster');
      m.lair = lair;
      m.raiding = true;
      m.raidIn = 0;
    }
    this.notify(`A ${MONSTERS[kind].name} raid marches on the realm!`, 'bad');
    this.audio.play('warn');
  }
}
