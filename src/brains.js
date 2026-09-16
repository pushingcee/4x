// ===================================================================
// brains.js — the Majesty part.
//
// You never order a hero anywhere. You make places attractive and the
// hero decides. Every hero scores the world every third of a second:
// bounties pull, danger pushes, greed and courage weight both.
// Peasants are the exception — those you may boss around directly.
// ===================================================================
import { toPx, toTile } from './world.js';
import { canUse, scoreFor } from './items.js';
import { TILE } from './art.js';
import {
  RES_RATE, CLASSES, BUILDINGS, MISSIONS, STANCES,
  BLESSING, HEAL_COST, MEND_RANGE, MEND_AT, CLERIC_KEEP, CLERIC_TETHER,
  XP_PER_HEAL, XP_PER_BLESSING
} from './data.js';
import { dist, clamp } from './util.js';

const tileDist = (a, b) => dist(a.x, a.y, b.x, b.y) / TILE;

/**
 * Distance from a unit to the nearest edge of a tile footprint, in pixels.
 * Centre-distance lies about diagonals and leaves workers pacing forever.
 */
function edgeDist(u, tx, ty, fw, fh) {
  const x0 = tx * TILE, y0 = ty * TILE, x1 = x0 + fw * TILE, y1 = y0 + fh * TILE;
  const dx = Math.max(x0 - u.x, 0, u.x - x1);
  const dy = Math.max(y0 - u.y, 0, u.y - y1);
  return Math.hypot(dx, dy);
}
/**
 * Close enough to work. The slack is not a taste call: a worker sent to an
 * approach tile can end up anywhere on it -- the crowd nudge sees to that --
 * and the far corner of a DIAGONAL approach tile sits sqrt(2) tiles from the
 * footprint edge. Anything tighter than that and a worker standing exactly
 * where it was told to stand reports itself as not yet arrived, asks for a
 * path to the tile it is already on, gets an empty one back, and stands
 * there until the end of the world.
 */
const touching = (u, o, slack = 1.5) =>
  edgeDist(u, o.tx, o.ty, o.fw || 1, o.fh || 1) <= slack * TILE;

/**
 * Send a unit to stand beside a footprint -- and not on top of whoever is
 * already standing there. Everyone picking the same approach tile is what
 * makes a seam look like it is being worked by one very wide peasant; given
 * a free tile each they fan out around it instead, for the same walk.
 */
function walkTo(u, g, o) {
  if (u.path || u.needPath) return;
  const t = g.world.approachTile(o.tx, o.ty, o.fw || 1, o.fh || 1, u.x, u.y, g.standingTiles(u, o));
  u.goTo(t.x, t.y);
}

// -------------------------------------------------------------------
// PEASANTS — directly commandable workforce
// -------------------------------------------------------------------
/**
 * When to spend the temper. Each specialisation wants a different moment:
 * the berserker wants a crowd, the duellist wants the biggest thing in front
 * of it, the shield wants to be in trouble, and the killers want to open a
 * fight rather than finish one.
 */
function useAbilityWisely(u, g) {
  const ab = u.ability;
  if (!ab) return false;
  const t = u.target && !u.target.dead ? u.target : null;
  const full = u.charge >= u.maxCharge * 0.95;

  switch (ab.id) {
    case 'rampage': {
      // worth it when there is enough in front of them to chew through --
      // and never worth sitting on once the temper has nowhere left to go
      if (!t) return false;
      const crowd = g.units.filter(m => !m.dead && m.faction === 'monster'
        && dist(m.x, m.y, u.x, u.y) < 90).length;
      return (crowd >= 2 || u.hp < u.maxHpNow * 0.8 || full) ? u.useAbility(t) : false;
    }
    case 'mortal_strike':
      // the duellist's blow: aimed at whatever is actually in front of them
      return t ? u.useAbility(t) : false;
    case 'shield_wall': {
      // a shield is no use once you are already dead -- put it up early
      const beingHit = g.time - (u.lastHit || -99) < 2.5;
      return (beingHit || u.hp < u.maxHpNow * 0.9 || full) ? u.useAbility(t) : false;
    }
    case 'aimed_shot':
      return t ? u.useAbility(t) : false;
    case 'ambush':
      // best out of the dark, but a full head of focus is not worth hoarding
      return t && (u.hidden > 0 || full) ? u.useAbility(t) : false;
    case 'vanish': {
      // open on something worth opening on, or disappear when it turns bad
      const prey = t || g.nearestEnemy(u.x, u.y, u.reach * 1.6, 'realm');
      return prey ? u.useAbility(prey) : false;
    }
    default:
      return t ? u.useAbility(t) : false;
  }
}

export function peasantBrain(u, since) {
  const g = u.game;

  // A villager called up to a guild stops being a worker: they drill, and
  // they stand between the monsters and everyone still holding a shovel.
  if (u.knightKind) return recruitBrain(u, g, since);

  // 1. danger. A peasant will run from something it merely sees, but if the
  //    thing is already biting them, running just means dying tired.
  const foe = g.nearestEnemy(u.x, u.y, 64, 'realm');
  if (foe) {
    const underAttack = g.time - (u.lastHit || -99) < 3;
    const cornered = u.distTo(foe) <= u.reach + 8;
    const badlyHurt = u.hp < u.maxHpNow * 0.35;

    if ((underAttack || cornered) && !badlyHurt) {
      u.fleeing = 0;
      u.state = 'defend';
      u.engage(u.lastAttacker && !u.lastAttacker.dead && u.distTo(u.lastAttacker) < 80
        ? u.lastAttacker : foe);
      u.fight(since);
      return;
    }
    u.fleeing = 2.6;
    u.state = 'flee';
    u.target = null;
    const safe = g.nearestBuilding(u.x, u.y, b => b.complete) || g.palace;
    if (safe && !touching(u, safe, 2)) walkTo(u, g, safe);
    return;
  }
  if (u.fleeing > 0) return;
  u.target = null;

  return workShift(u, g, since, MISSIONS[u.mission] || MISSIONS.none);
}

/**
 * A shift's work, whoever is doing it. Peasants live here, and so does any
 * veteran you have sent back to the fields -- a knighthood adds to what
 * somebody is, it does not stop them being able to swing a pick.
 */
function workShift(u, g, since, mission) {
  // 2. An explicit construction order outranks the standing calling. Without
  //    this the calling's own search overwrites the build job every tick and
  //    nothing ever gets built by anyone who already has a trade.
  if (u.job && u.job.type === 'build') {
    if (u.carry > 0) return deliver(u, g);      // drop the load off first
    return doBuild(u, g, since, u.job.site);
  }

  // 3. line up the next seam before anything else, so a peasant hauling a
  //    load home already knows where they are going back to
  if (mission.nodes && !findWork(u, g, mission)) return missionStalled(u, g, mission);

  // 4. a full pack goes home first, whatever the mission
  if (u.carry > 0 && (u.state === 'deliver' || !u.job)) return deliver(u, g);

  if (mission.nodes) return doHarvest(u, g, since);

  // 5. builders, and idlers who happen to see something half-finished
  const site = g.nearestBuilding(u.x, u.y, b => !b.complete && b.builders < 4);
  if (site) { u.job = { type: 'build', site }; site.builders++; return; }

  const hurt = g.nearestBuilding(u.x, u.y, b => b.complete && b.hp < b.maxHp * 0.95, 260);
  if (hurt) { u.state = 'repair'; return doRepair(u, g, since, hurt); }

  if (mission.build) return missionStalled(u, g, mission);
  idleAround(u, g, u.homeX, u.homeY, 5);
}

/**
 * Keep the peasant pointed at a valid seam for their mission.
 * A pinned node (you tapped a specific mine) is honoured until it runs out;
 * after that they go looking for the next nearest one on their own.
 */
function findWork(u, g, mission) {
  let cur = u.job && u.job.type === 'harvest' ? u.job.node : null;
  // Seconds of trying and no closer: the seam is walled in, or the only way
  // to stand at it is taken. Write it off for this villager and look
  // elsewhere, rather than leaving them in a field holding a pick forever.
  if (cur && u.stuck >= 5) {
    (u.unreachable || (u.unreachable = new Set())).add(cur);
    g.notify(`${u.name} cannot get at that ${mission.res}`, 'bad');
    u.job = null; u.stuck = 0; u.path = null; u.needPath = null;
    cur = null;
  }
  if (cur && cur.amount > 0 && !cur.removed && mission.nodes.includes(cur.kind)) return true;

  const next = g.world.nearestHarvestable(mission.nodes, u.x, u.y, u.unreachable);
  if (!next) { u.job = null; return false; }
  if (cur) g.notify(`${u.name} moves on to the next ${mission.res === 'wood' ? 'stand of trees' : 'seam'}`);
  u.job = { type: 'harvest', node: next };
  // don't yank someone off a delivery run just because their seam changed
  if (u.carry <= 0) {
    u.state = 'walk';
    u.path = null; u.needPath = null;
  }
  return true;
}

/** Nothing left to do for this calling: say so once, then wait near home. */
function missionStalled(u, g, mission) {
  if (!u.stalledOn || u.stalledOn !== mission.id) {
    u.stalledOn = mission.id;
    g.notify(mission.build
      ? `${u.name} has nothing to build`
      : `${u.name} can find no ${mission.res} to gather`, 'bad');
  }
  u.state = 'idle';
  idleAround(u, g, u.homeX, u.homeY, 5);
}

/**
 * Militia. Marked for knighthood, not yet knighted: they drill down the clock,
 * guard whoever is still working, and only run when they are nearly finished.
 */
function recruitBrain(u, g, since) {
  u.knightLeft = Math.max(0, (u.knightLeft || 0) - since);

  // wounded badly enough that dying would waste the training
  if (u.hp < u.maxHpNow * 0.3) {
    const foe = g.nearestEnemy(u.x, u.y, 70, 'realm');
    if (foe) {
      u.fleeing = 2;
      u.state = 'flee';
      u.target = null;
      const safe = g.nearestBuilding(u.x, u.y, b => b.complete) || g.palace;
      if (safe && !touching(u, safe, 2)) walkTo(u, g, safe);
      return;
    }
  }

  // ready: report to the guild and be knighted
  if (u.knightLeft <= 0) {
    const hall = g.buildings.find(b => b.id === u.knightHall && !b.dead && b.complete)
      || g.nearestBuilding(u.x, u.y, b => b.complete && b.def.guild === u.knightKind);
    if (!hall) { g.cancelKnighthood(u); return; }
    if (touching(u, hall, 1.6)) { g.knightVillager(u, u.knightKind, hall); return; }
    u.state = 'walk';
    walkTo(u, g, hall);
    return;
  }

  // something already biting them, or biting anyone else
  if (u.target && !u.target.dead && u.distTo(u.target) < 170) {
    u.state = 'defend';
    u.fight(since);
    return;
  }
  u.target = null;

  const victim = g.distressed();
  if (victim && victim !== u) {
    const foe = (victim.lastAttacker && !victim.lastAttacker.dead
      && dist(victim.lastAttacker.x, victim.lastAttacker.y, victim.x, victim.y) < 160)
      ? victim.lastAttacker
      : g.nearestEnemy(victim.x, victim.y, 140, 'realm', false);
    if (foe) {
      u.rushing = 1.2;
      u.state = 'rescue';
      u.engage(foe);
      u.fight(since);
      return;
    }
  }

  // anything prowling near the people they are supposed to be protecting
  const near = g.nearestEnemy(u.x, u.y, 150, 'realm', false);
  if (near) {
    const threatens = g.units.some(v => !v.dead && v.kind === 'peasant' && !v.knightKind
      && dist(v.x, v.y, near.x, near.y) < 150)
      || !!g.nearestBuilding(near.x, near.y, b => b.complete, 150);
    if (threatens) {
      u.state = 'defend';
      u.engage(near);
      u.fight(since);
      return;
    }
  }

  // otherwise walk the rows among the people still working
  u.postFor = (u.postFor || 0) - since;
  if (!u.post || u.post.dead || u.postFor <= 0) {
    const folk = g.units.filter(v => !v.dead && v.kind === 'peasant' && v !== u && !v.knightKind);
    const anchors = folk.length ? folk : g.buildings.filter(b => !b.dead);
    u.post = anchors.length ? anchors[(Math.random() * anchors.length) | 0] : g.palace;
    u.postFor = 6 + Math.random() * 6;
  }
  const p = u.post && !u.post.dead ? u.post : g.palace;
  idleAround(u, g, p ? p.x : u.homeX, p ? p.y : u.homeY, 4);
  u.state = 'drill';
}

function carryCap(u) {
  const base = RES_RATE[u.job?.node?.kind]?.carry || 12;
  return base * u.talentMul(u.mission, 'capacity');
}

function doHarvest(u, g, since) {
  const node = u.job && u.job.node;
  if (!node || node.amount <= 0) { u.job = null; u.state = 'idle'; return; }
  const cap = RES_RATE[node.kind].carry * u.talentMul(u.mission, 'capacity');
  if (u.carry >= cap) return deliver(u, g);

  if (touching(u, node)) {
    u.state = 'harvest';
    u.stalledOn = null;
    u.path = null;
    const info = RES_RATE[node.kind];
    const boost = g.depotBoost(node.tx, node.ty, info.res);
    const got = Math.min(
      info.rate * (1 + boost) * u.talentMul(u.mission, 'rate') * since,
      cap - u.carry, node.amount);
    u.carry += got;
    node.amount -= got;
    u.carryRes = info.res;
    // the calling only teaches you anything while you are actually swinging
    u.train(u.mission, got);
    if (Math.random() < 0.28) {
      g.fx.puff(u.x + (Math.random() - .5) * 8, u.y - 4,
        info.res === 'gold' ? '#ffc94a' : info.res === 'stone' ? '#b6bccb' : '#b4753a', 2);
    }
    if (node.amount <= 0) g.exhaustNode(node);
  } else {
    u.state = 'walk';
    walkTo(u, g, node);
  }
}

function deliver(u, g) {
  u.state = 'deliver';
  const depot = g.nearestDepot(u.x, u.y);
  if (!depot) { u.state = 'idle'; return; }
  if (touching(u, depot)) {
    if (u.carry > 0) {
      const amount = Math.floor(u.carry);
      if (amount > 0) {
        g.addResource(u.carryRes, amount);
        g.fx.coin(depot.x, depot.y - depot.radius, amount);
        g.audio.play('coin');
      }
      u.carry = 0;
    }
    u.state = u.job ? 'walk' : 'idle';
    u.path = null;
    if (u.job && u.job.type === 'harvest') walkTo(u, g, u.job.node);
    else if (u.job && u.job.type === 'build') walkTo(u, g, u.job.site);
  } else {
    walkTo(u, g, depot);
  }
}

function doBuild(u, g, since, site) {
  if (!site || site.dead || site.complete) {
    if (site) site.builders = Math.max(0, site.builders - 1);
    // back to the mine they were pulled off
    u.job = u.prevJob && u.prevJob.node && u.prevJob.node.amount > 0 ? u.prevJob : null;
    u.prevJob = null;
    u.state = 'idle';
    return;
  }
  if (touching(u, site, 1.5)) {
    u.state = 'build';
    u.path = null;
    site.addProgress(since * u.talentMul('builder', 'rate') / site.def.build);
    u.train('builder', since);
    if (Math.random() < 0.4) g.fx.puff(site.x + (Math.random() - .5) * site.fw * TILE, site.bottom - 6, '#d8cfe6', 1);
  } else {
    u.state = 'walk';
    walkTo(u, g, site);
  }
}

function doRepair(u, g, since, b) {
  if (touching(u, b, 1.5)) {
    u.path = null;
    b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.06 * since * u.talentMul('builder', 'rate'));
    u.train('builder', since * 0.5);   // mending counts, but for less
    if (Math.random() < 0.3) g.fx.puff(b.x, b.bottom - 8, '#ffd070', 1);
  } else {
    walkTo(u, g, b);
  }
}

function idleAround(u, g, cx, cy, r) {
  u.state = 'idle';
  u.idleWander -= 0.3;
  if (u.idleWander > 0 || u.path || u.needPath) return;
  u.idleWander = 2 + Math.random() * 4;
  const a = Math.random() * Math.PI * 2, d = Math.random() * r;
  const t = g.world.nearestFree(toTile(cx) + Math.cos(a) * d, toTile(cy) + Math.sin(a) * d, 5);
  u.goTo(t.x, t.y);
}

// -------------------------------------------------------------------
// HEROES — they weigh the world and decide for themselves
// -------------------------------------------------------------------

/** Rough combat strength, used on both sides of every risk assessment. */
function strength(e) {
  if (e.kindClass !== 'unit') return e.maxHp * 0.35;
  return e.power * 3.2 + e.hp * 0.7;
}

/**
 * How scared is this hero of what is standing around (x,y)?
 * Friends count whether they are already at the trouble or merely near the
 * hero -- heroes are optimists about who will follow them.
 */
function dangerAt(g, x, y, radius, hero) {
  let threat = 0;
  for (const m of g.units) {
    if (m.dead || m.faction !== 'monster') continue;
    if (dist(m.x, m.y, x, y) > radius) continue;
    threat += strength(m);
  }
  let mine = strength(hero) * (1 + (hero.level - 1) * 0.12);
  for (const a of g.units) {
    if (a.dead || a.faction !== 'realm' || a === hero) continue;
    if (!a.isHero && a.kind !== 'guard') continue;
    const withTrouble = dist(a.x, a.y, x, y) <= radius * 1.4;
    const withMe = dist(a.x, a.y, hero.x, hero.y) <= 170;
    if (!withTrouble && !withMe) continue;
    mine += strength(a) * (withTrouble ? 0.8 : 0.55);
  }
  return { threat, mine };
}

function fearPenalty(g, x, y) {
  let p = 1;
  for (const f of g.flags) {
    if (f.type !== 'fear') continue;
    const d = dist(f.x, f.y, x, y);
    if (d < f.radius * TILE) p *= 0.04;
    else if (d < f.radius * TILE * 2) p *= 0.4;
  }
  return p;
}

export function heroBrain(u, since) {
  const g = u.game;
  const def = u.def;
  const hpFrac = u.hp / u.maxHpNow;

  // --- 0. a soldier you sent back to work is a worker, first ---------
  // Knighthood is a layer, not a life sentence: give a veteran a calling and
  // they go and do it, keeping everything they are. They still fight anything
  // that comes at them -- doWork falls through to the danger checks below
  // only when there is no work to be had.
  const calling = MISSIONS[u.mission];
  if (calling && (calling.nodes || calling.build) && !u.flagId) {
    const foe = g.nearestEnemy(u.x, u.y, 72, 'realm');
    if (!foe) { workShift(u, g, since, calling); return; }
  }

  // --- 0b. spend the temper ----------------------------------------
  if (u.abilityReady) useAbilityWisely(u, g);

  // --- 0c. hit, and gone -------------------------------------------
  // A killer with nothing left to spend does not stand in the open taking
  // blows: if they are visible, out of tricks and being hit, they break off
  // and go back into the dark. Armed, they strike; unarmed, they leave.
  const stealthy = u.specDef && u.specDef.stealth;
  if (stealthy && u.hidden <= 0 && !u.abilityReady
      && g.time - (u.lastHit || -99) < 2) {
    u.withdraw = Math.max(u.withdraw, 1.4);
  }

  // A killer who has just come out of the dark breaks off instead of standing
  // there trading: back away, drop out of sight, come again from somewhere
  // else. Without this an assassin is just a warrior with worse armour.
  if (u.withdraw > 0) {
    const hunter = g.nearestEnemy(u.x, u.y, 140, 'realm');
    u.target = null;
    u.state = 'stalk';
    if (hunter) {
      const dx = u.x - hunter.x, dy = u.y - hunter.y;
      const len = Math.hypot(dx, dy) || 1;
      const away = g.world.nearestFree(
        toTile(u.x + (dx / len) * 70), toTile(u.y + (dy / len) * 70), 6);
      if (away && (away.x !== u.tx || away.y !== u.ty)) u.goTo(away.x, away.y, 1);
    }
    return;
  }

  // --- 1. stay alive ------------------------------------------------
  if (hpFrac < 0.42 && u.potions > 0) {
    u.potions--;
    u.heal(u.maxHpNow * 0.5);
    g.audio.play('drink');
  }
  const wounded = hpFrac < def.courage + 0.3;
  if (wounded) {
    const local = dangerAt(g, u.x, u.y, 110, u);
    if (local.threat > local.mine * 0.55 || hpFrac < def.courage) {
      u.target = null;
      u.flagId = null;
      u.state = 'flee';
      u.fleeing = 1.2;
      const refuge = g.healBuilding(u.x, u.y);
      if (refuge) {
        if (touching(u, refuge, 1.8)) {
          u.path = null;
          u.state = 'rest';
          const rate = refuge.def.shop === 'rest' ? 0.16 : refuge.defId === 'temple' ? 0.2 : 0.09;
          u.heal(u.maxHpNow * rate * since);
          if (u.hp >= u.maxHpNow * 0.98) u.state = 'idle';
        } else {
          walkTo(u, g, refuge);
        }
        return;
      }
    }
  }
  // out of combat regeneration, slow
  if (!u.target && u.hp < u.maxHpNow) u.heal(u.maxHpNow * 0.03 * since);

  // --- 1b. a worker is screaming -----------------------------------
  // This has to come BEFORE the "already busy" check: a soldier locked onto
  // something else would otherwise never re-evaluate and never hear the call.
  if (u.stance === 'defend') {
    const victim = g.distressed();
    if (victim) {
      const foe = (victim.lastAttacker && !victim.lastAttacker.dead
        && dist(victim.lastAttacker.x, victim.lastAttacker.y, victim.x, victim.y) < 160)
        ? victim.lastAttacker
        : g.nearestEnemy(victim.x, victim.y, 140, 'realm', false);
      if (foe) {
        u.rushing = 1.2;
        u.state = 'rescue';
        u.engage(foe);
        u.fight(since);
        return;
      }
    }
  }

  // --- 2. already swinging at something? ----------------------------
  // A wall does not bite back. If we are hitting a lair or a building while
  // something alive is within reach, deal with the living thing first.
  if (u.target && !u.target.dead && u.target.kindClass !== 'unit') {
    const biting = g.nearestEnemy(u.x, u.y, 96, 'realm', false);
    if (biting) u.target = biting;
  }
  // --- 2a. a cleric keeps out of reach ------------------------------
  // This has to come BEFORE the fighting: a cleric handed a target by being
  // hit would otherwise stand and trade blows, which is how the first version
  // of them died in every single test. They are not fighters. They back off,
  // mending and blessing as they go, and only swing when genuinely cornered.
  if (def.heal) {
    const close = g.nearestEnemy(u.x, u.y, CLERIC_KEEP, 'realm');
    if (close) {
      const cornered = u.distTo(close) <= u.reach + 6
        && g.time - (u.lastHit || -99) < 2
        && u.hp > u.maxHpNow * 0.4;
      if (!cornered) {
        u.target = null;
        u.state = 'mend';
        tryHeal(u, g, since) || tryBless(u, g, since);
        backAwayFrom(u, g, close, CLERIC_KEEP + 30);
        return;
      }
      u.engage(close);      // nowhere left to go: swing the mace
    }
  }

  if (u.target && !u.target.dead) {
    const d = u.distTo(u.target);
    if (d < 260) {
      // clerics prefer patching people up mid-fight, and buffing whoever is
      // swinging, over swinging themselves -- a cleric's mace is a last resort
      if (def.heal && (tryHeal(u, g, since) || tryBless(u, g, since))) return;
      u.state = 'fight';
      u.fight(since);
      return;
    }
    u.target = null;
  }
  if (def.heal && (tryHeal(u, g, since) || tryBless(u, g, since))) return;

  // --- 2b. a cleric goes looking ------------------------------------
  // The difference between a cleric and a soldier who knows first aid: they
  // cross the map to somebody bleeding instead of mending whoever wanders by.
  // They do it from arm's length, though: a cleric standing in the middle of
  // a melee is a dead cleric, and a dead cleric heals nobody.
  if (def.heal) {
    const patient = findPatient(u, g);
    if (patient) {
      u.target = null;
      u.state = 'mend';
      if (dist(patient.x, patient.y, u.x, u.y) > def.heal.range * 0.75) {
        u.rushing = 1.0;                    // hurry: they are bleeding
        // stand off on the near side rather than walking onto them
        const spot = standOff(g, patient, u, def.heal.range * 0.7);
        if (spot && (spot.x !== u.tx || spot.y !== u.ty)) u.goTo(spot.x, spot.y, 1);
      }
      return;
    }

    // Nobody hurt: go and stand with the soldiers. A cleric wandering the map
    // alone is a robe with a mace -- their whole worth is being there already
    // when somebody starts bleeding, so they travel with the people who do.
    const anchor = healerAnchor(u, g);
    if (anchor) {
      u.target = null;
      const d = dist(anchor.x, anchor.y, u.x, u.y);
      if (d > CLERIC_TETHER) {
        u.state = 'follow';
        const spot = g.world.nearestFree(anchor.tx, anchor.ty, 7);
        if (spot && (spot.x !== u.tx || spot.y !== u.ty)) u.goTo(spot.x, spot.y, 3);
        return;
      }
      if (d > CLERIC_TETHER * 0.45) { u.state = 'follow'; return; }
    }
  }

  // --- 3. score the world -------------------------------------------
  const best = chooseGoal(u, g);
  u.goalKind = best ? best.kind : 'idle';

  if (!best) { return heroIdle(u, g); }

  switch (best.kind) {
    case 'guard':
      return standWatch(u, g);

    case 'fight':
      u.engage(best.target);
      u.state = 'fight';
      u.fight(since);
      return;

    case 'flag': {
      const f = best.flag;
      u.flagId = f.id;
      u.state = 'quest';
      const d = dist(u.x, u.y, f.x, f.y);
      if (d > f.radius * TILE * 0.7) {
        if (!u.path && !u.needPath) u.goTo(toTile(f.x), toTile(f.y), 1);
      } else {
        u.path = null;
        g.heroAtFlag(u, f, since);
      }
      return;
    }

    case 'lair': {
      const l = best.lair;
      u.state = 'quest';
      if (u.distTo(l) <= u.reach) { u.engage(l); u.fight(since); }
      else walkTo(u, g, l);
      return;
    }

    case 'shop': {
      const b = best.building;
      u.state = 'shop';
      if (touching(u, b, 1.6)) { u.path = null; g.heroShops(u, b); }
      else walkTo(u, g, b);
      return;
    }

    case 'explore': {
      u.state = 'explore';
      if (!u.path && !u.needPath) u.goTo(best.tx, best.ty, 2);
      if (u.arrived) { u.arrived = false; u.exploreGoal = null; }
      return;
    }
  }
  heroIdle(u, g);
}

function tryHeal(u, g, since) {
  const h = u.def.heal;
  u.healCool = (u.healCool || 0) - since;
  if (u.healCool > 0) return false;
  let best = null, worst = 1;
  for (const a of g.units) {
    if (a.dead || a.faction !== 'realm' || a === u) continue;
    const f = a.hp / a.maxHpNow;
    if (f >= MEND_AT) continue;
    if (dist(a.x, a.y, u.x, u.y) > h.range) continue;
    if (f < worst) { worst = f; best = a; }
  }
  // nobody else is hurt? a cleric bleeding out is still somebody who is hurt
  if (!best && u.hp < u.maxHpNow * 0.6) best = u;
  if (!best) return false;
  if (u.mana < HEAL_COST) return false;
  u.mana -= HEAL_COST;
  u.healCool = h.rate;
  const given = best.heal(h.amount * (1 + (u.level - 1) * 0.2) * u.spellPower);
  // Rank for mending, paid on health actually restored -- so there is nothing
  // to farm by bandaging the healthy. Keeping people alive is the job.
  if (given > 0) {
    u.gainXp(given * XP_PER_HEAL);
    u.lastSupport = g.time;
  }
  g.fx.ring(best.x, best.y - 6, '#7fd8a0', 9);
  g.audio.play('heal');
  u.state = 'heal';
  return true;
}

/**
 * A blessing goes on somebody who is about to need it rather than somebody
 * who already did: whoever is closest to a fight and not already blessed.
 * It is the cleric's other half -- they are not only a bandage.
 */
function tryBless(u, g, since) {
  if (!u.def.heal) return false;
  u.blessCool = (u.blessCool || 0) - since;
  if (u.blessCool > 0 || u.mana < BLESSING.cost) return false;
  // Anyone who comes near gets one -- a villager hauling ore as readily as a
  // warrior mid-swing. The score only decides who is first in the queue.
  let best = null, bestScore = -1;
  for (const a of g.units) {
    if (a.dead || a.faction !== 'realm' || a === u) continue;
    if (a.blessed > 0) continue;
    if (dist(a.x, a.y, u.x, u.y) > BLESSING.range) continue;
    const fighting = (a.target && !a.target.dead) ? 3 : 0;
    const bitten = g.time - (a.lastHit || -99) < 4 ? 3 : 0;
    const soldier = a.isHero ? 2 : 0;
    const score = fighting + bitten + soldier;
    if (score > bestScore) { bestScore = score; best = a; }
  }
  if (!best) return false;
  u.mana -= BLESSING.cost;
  u.blessCool = BLESSING.rate;
  best.blessed = BLESSING.lasts;
  u.gainXp(XP_PER_BLESSING);
  u.lastSupport = g.time;
  g.fx.ring(best.x, best.y - 6, BLESSING.colour, 11);
  g.fx.text(best.x, best.y - 18, 'BLESSED', BLESSING.colour, 18);
  g.audio.play('heal');
  u.state = 'bless';
  return true;
}

/**
 * Where a cleric wants to be: with the soldiers. They are not a scout and not
 * a duellist -- on their own they are a robe with a mace. The nearest hero
 * who is not another cleric is the anchor; failing that, the town.
 */
function healerAnchor(u, g) {
  let best = null, bestD = Infinity;
  for (const a of g.units) {
    if (a.dead || a.faction !== 'realm' || a === u) continue;
    if (!a.isHero || a.def.heal) continue;         // stand with the fighters
    const d = dist(a.x, a.y, u.x, u.y);
    if (d < bestD) { bestD = d; best = a; }
  }
  return best;
}

/** Put some ground between a caster and whatever is reaching for them. */
function backAwayFrom(u, g, foe, want) {
  const dx = u.x - foe.x, dy = u.y - foe.y;
  const len = Math.hypot(dx, dy) || 1;
  const spot = g.world.nearestFree(
    toTile(u.x + (dx / len) * want), toTile(u.y + (dy / len) * want), 7);
  if (spot && (spot.x !== u.tx || spot.y !== u.ty)) u.goTo(spot.x, spot.y, 1);
}

/**
 * A tile within reach of the patient but on the side away from the fighting,
 * so a cleric can work without being part of it.
 */
function standOff(g, patient, u, want) {
  const foe = g.nearestEnemy(patient.x, patient.y, 200, 'realm');
  let dx, dy;
  if (foe) { dx = patient.x - foe.x; dy = patient.y - foe.y; }
  else { dx = u.x - patient.x; dy = u.y - patient.y; }
  const len = Math.hypot(dx, dy) || 1;
  return g.world.nearestFree(
    toTile(patient.x + (dx / len) * want), toTile(patient.y + (dy / len) * want), 7);
}

/**
 * Somebody, anywhere in the realm, who needs a cleric. This is what makes a
 * cleric different from a soldier who happens to know first aid: they go
 * looking, across the whole map, instead of mending whoever wanders past.
 */
function findPatient(u, g) {
  let best = null, worst = MEND_AT;
  for (const a of g.units) {
    if (a.dead || a.faction !== 'realm' || a === u) continue;
    const f = a.hp / a.maxHpNow;
    if (f >= worst) continue;
    if (dist(a.x, a.y, u.x, u.y) > MEND_RANGE) continue;
    worst = f; best = a;
  }
  return best;
}

/** Is anything on that shelf actually an upgrade for this hero, and affordable? */
function marketHasBetter(u, b) {
  if (!b.stock || !b.stock.length) return false;
  for (const it of b.stock) {
    if (!canUse(u, it) || it.value > u.gold) continue;
    if (scoreFor(u, it) > scoreFor(u, u.gear[u.bestSlotFor(it)])) return true;
  }
  return false;
}

/** Everything a hero might want, scored on one scale. */
function chooseGoal(u, g) {
  const def = u.def;
  // Clerics are not fighters and do not go looking. They keep station with
  // the soldiers and answer flags only to stand where they are wanted --
  // hunting lairs is somebody else's trade.
  if (def.heal) return null;
  const opts = [];
  const greed = def.greed;
  const holding = u.stance === 'defend';

  // (0) Standing watch is a positive choice, not what is left over. Without
  // this a defender always found some frontier tile worth more than home.
  if (holding) opts.push({ kind: 'guard', score: 20 });

  // (a) monsters they can see
  for (const m of g.units) {
    if (m.dead || m.faction !== 'monster') continue;
    const d = dist(u.x, u.y, m.x, m.y);
    const sightPx = def.sight * TILE + 40;
    if (d > sightPx) continue;
    if (!g.world.visible(toTile(m.x), toTile(m.y)) && d > u.reach * 1.5) continue;
    const { threat, mine } = dangerAt(g, m.x, m.y, 90, u);
    const odds = mine / Math.max(1, threat);
    if (odds < 1 - def.courage) continue;
    let value = (m.def.gold * 1.4 + m.def.xp * 1.2) * (0.6 + greed);
    // defend the town: monsters near our buildings are urgent
    const nearTown = g.nearestBuilding(m.x, m.y, b => b.complete, 150);
    if (nearTown) value *= holding ? 5 : 3.2;
    value *= clamp(odds, 0.3, 2.2);
    opts.push({ kind: 'fight', target: m, score: value / (1 + (d / TILE) * 0.16) * fearPenalty(g, m.x, m.y) });
  }

  // (b) reward flags — the whole point of the game
  for (const f of g.flags) {
    if (f.type === 'fear' || f.done) continue;
    const d = dist(u.x, u.y, f.x, f.y);
    const { threat, mine } = dangerAt(g, f.x, f.y, f.radius * TILE + 30, u);
    const odds = mine / Math.max(1, threat);
    // Gold buys courage. Without this the odds gate was absolute and a hero
    // would refuse a camp no matter how much was piled on it, which makes the
    // one lever the player has over them useless exactly when it matters.
    const nerve = 1 + Math.min(2, (f.bounty / 350) * (0.5 + greed));
    if (f.type === 'attack' && odds * nerve < 0.85 - def.courage) continue;
    let value = f.bounty * (0.45 + greed * 1.25);
    if (f.type === 'explore') value *= def.id === 'ranger' ? 1.7 : 0.85;
    if (f.type === 'defend') value *= 1.0 + (f.claimed === u.id ? 0.7 : 0);
    if (f.claimed && f.claimed !== u.id && f.type !== 'attack') value *= 0.35;
    opts.push({ kind: 'flag', flag: f, score: value / (1 + (d / TILE) * 0.1) * fearPenalty(g, f.x, f.y) });
  }

  // (c) monster lairs they know about, within their patch of the realm
  const homeX = u.homeX, homeY = u.homeY;
  for (const l of g.lairs) {
    if (l.dead) continue;
    if (!g.world.seen(l.tx, l.ty)) continue;
    if (dist(l.x, l.y, homeX, homeY) > def.wander * 1.6 * TILE) continue;
    const d = dist(u.x, u.y, l.x, l.y);
    const { threat, mine } = dangerAt(g, l.x, l.y, 120, u);
    if (mine < threat * (1.15 - def.courage)) continue;
    const value = l.def.reward * 0.5 * (0.5 + greed) * (0.6 + u.level * 0.25) * (holding ? 0.3 : 1);
    opts.push({ kind: 'lair', lair: l, score: value / (1 + (d / TILE) * 0.14) * fearPenalty(g, l.x, l.y) });
  }

  // (d) spend the loot — heroes are terrible savers, and your taxes love it
  // A full bag is its own reason to walk into town, whatever the purse says.
  const hauling = u.bag && u.bag.length > 0;
  if (u.gold >= 50 || hauling) {
    for (const b of g.buildings) {
      if (!b.complete || !b.def.shop) continue;
      if (b.def.shop === 'weapon' && u.gold < g.smithPrice(u)) continue;
      if (b.def.shop === 'potion' && u.potions >= 2) continue;
      if (b.def.shop === 'rest' && u.hp > u.maxHpNow * 0.9) continue;
      if (b.def.shop === 'market' && !hauling && !marketHasBetter(u, b)) continue;
      const d = dist(u.x, u.y, b.x, b.y);
      const value = b.def.shop === 'market'
        ? (hauling ? 130 : 105) * (0.6 + greed)
        : (b.def.shop === 'weapon' ? 90 : 55) * (0.6 + greed);
      opts.push({ kind: 'shop', building: b, score: value / (1 + (d / TILE) * 0.2) });
    }
  }

  // (e) restlessness: every hero drifts outward, rangers most of all
  const wanderlust = { ranger: 1.7, warrior: 0.8, cleric: 0.5, wizard: 0.45 }[def.id] || 0.6;
  const t = u.exploreGoal && !g.world.seen(u.exploreGoal.tx, u.exploreGoal.ty)
    ? u.exploreGoal : (u.exploreGoal = g.frontierTile(u.homeX, u.homeY, def.wander));
  if (t) {
    const gx = toPx(t.tx), gy = toPx(t.ty);
    const d = dist(u.x, u.y, gx, gy);
    // curiosity stops at the edge of a known lair's territory
    let lairShy = 1;
    for (const l of g.lairs) {
      if (l.dead || !g.world.seen(l.tx, l.ty)) continue;
      if (dist(l.x, l.y, gx, gy) < 9 * TILE) { lairShy = 0.15; break; }
    }
    opts.push({
      kind: 'explore', tx: t.tx, ty: t.ty,
      score: 30 * wanderlust * lairShy * (holding ? 0.1 : 1)
        / (1 + (d / TILE) * 0.09) * fearPenalty(g, gx, gy)
    });
  }

  if (!opts.length) return null;
  opts.sort((a, b) => b.score - a.score);
  return opts[0];
}

/**
 * Walking the beat: pick a building or a working villager, loiter near them
 * for a while, then move on to somebody else.
 */
function standWatch(u, g) {
  const home = g.buildings.find(b => b.id === u.homeId && !b.dead) || g.palace;
  u.postFor = (u.postFor || 0) - 0.3;
  if (!u.post || u.post.dead || u.postFor <= 0) {
    const anchors = [
      ...g.buildings.filter(b => !b.dead),
      ...g.units.filter(x => !x.dead && x.kind === 'peasant')
    ];
    u.post = anchors.length ? anchors[(Math.random() * anchors.length) | 0] : home;
    u.postFor = 7 + Math.random() * 8;
  }
  const p = u.post && !u.post.dead ? u.post : home;
  idleAround(u, g, p ? p.x : u.homeX, p ? p.y : u.homeY, 4);
  u.state = 'guard';           // idleAround sets 'idle'; we are on the beat
}

function heroIdle(u, g) {
  if (u.stance === 'defend') return standWatch(u, g);
  const home = g.buildings.find(b => b.id === u.homeId && !b.dead) || g.palace;
  const cx = home ? home.x : u.homeX, cy = home ? home.y : u.homeY;
  idleAround(u, g, cx, cy, u.def.wander);
}

// -------------------------------------------------------------------
// GUARDS — the only soldiers who do as they are told
// -------------------------------------------------------------------
export function guardBrain(u, since) {
  const g = u.game;
  const leash = u.def.leash || 150;
  if (u.target && !u.target.dead && u.target.kindClass !== 'unit') {
    const biting = g.nearestEnemy(u.x, u.y, 96, 'realm', false);
    if (biting) u.target = biting;
  }
  if (u.target && !u.target.dead && dist(u.x, u.y, u.homeX, u.homeY) < leash * 1.4) {
    u.state = 'fight'; u.fight(since); return;
  }
  const foe = g.nearestEnemy(u.homeX, u.homeY, leash, 'realm');
  if (foe) { u.engage(foe); u.state = 'fight'; u.fight(since); return; }
  if (u.hp < u.maxHpNow) u.heal(u.maxHpNow * 0.02 * since);
  idleAround(u, g, u.homeX, u.homeY, 3);
}

// -------------------------------------------------------------------
// MONSTERS
// -------------------------------------------------------------------
export function monsterBrain(u, since) {
  const g = u.game;
  const def = u.def;

  // a monster that is not raiding stays near its lair: no endless pursuit
  const anchorX = u.lair && !u.lair.dead ? u.lair.x : u.homeX;
  const anchorY = u.lair && !u.lair.dead ? u.lair.y : u.homeY;
  const strayed = !u.raiding && dist(u.x, u.y, anchorX, anchorY) > 9 * TILE;

  if (!strayed && u.target && !u.target.dead && u.distTo(u.target) < def.aggro) {
    u.state = 'fight'; u.fight(since); return;
  }
  u.target = null;
  if (strayed) {
    u.state = 'return';
    if (!u.path && !u.needPath) u.goTo(toTile(anchorX), toTile(anchorY), 2);
    return;
  }

  const mayRaid = g.raidsEnabled && def.raid && g.day > g.peaceDays
    && (!u.lair || (u.lair.active && g.lairThreatensUs(u.lair)))
    && (u.raiding || g.raidersOut() < g.raidCap);

  // anything of the realm close enough to smell. Buildings are only fair
  // game once the peace is over -- early rats pester people, not walls.
  const prey = g.nearestEnemy(u.x, u.y, def.aggro, 'monster', mayRaid);
  if (prey) { u.engage(prey); u.state = 'fight'; u.fight(since); return; }

  // raiders periodically march on the town, then give up and go home
  u.raidIn = (u.raidIn === undefined ? 55 + Math.random() * 80 : u.raidIn) - since;
  if (u.raiding) {
    u.raidLeft = (u.raidLeft === undefined ? 75 : u.raidLeft) - since;
    if (u.raidLeft <= 0) {
      u.raiding = false;
      u.raidLeft = undefined;
      u.raidIn = 70 + Math.random() * 90;
      u.target = null;
    }
  }
  if ((mayRaid && u.raidIn <= 0) || u.raiding) {
    if (!u.raiding) { u.raiding = true; u.raidLeft = 75; }
    const objective = g.raidTarget(u);
    if (objective) {
      u.state = 'raid';
      if (u.distTo(objective) <= u.reach) { u.engage(objective); u.fight(since); }
      else if (objective.kindClass === 'unit') {
        if (!u.path && !u.needPath) u.goTo(toTile(objective.x), toTile(objective.y), 0);
      } else walkTo(u, g, objective);
      return;
    }
    u.raiding = false;
    u.raidIn = 45 + Math.random() * 60;
  }

  // otherwise prowl around the lair
  if (dist(u.x, u.y, anchorX, anchorY) > 10 * TILE) {
    u.state = 'return';
    if (!u.path && !u.needPath) u.goTo(toTile(anchorX), toTile(anchorY), 2);
    return;
  }
  idleAround(u, g, anchorX, anchorY, 4);
}

export const BRAINS = { peasant: peasantBrain, guard: guardBrain, hero: heroBrain, monster: monsterBrain };
