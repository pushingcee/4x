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
  RES_RATE, CLASSES, BUILDINGS, MISSIONS, STANCES, MONSTERS, STAT_EFFECT,
  ROADSIDE, ROAD_LEASH,
  BLESSING, HEAL_COST, MEND_RANGE, MEND_AT, CLERIC_KEEP, CLERIC_TETHER,
  XP_PER_HEAL, XP_PER_BLESSING, WARBAND
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
    // ---- wizards: the bolt has to have somewhere to land
    case 'exsanguinate':
      // the drink is worth most when there is something to refill, or the
      // target is big enough to be worth the mana either way
      return t && (u.hp < u.maxHpNow * 0.85 || t.def.big || t.kindClass !== 'unit' || full)
        ? u.useAbility(t) : false;
    case 'firestorm':
    case 'blight': {
      // area spells want a crowd under them; a lone rat is not worth a storm
      if (!t) return false;
      const packed = g.enemiesNear(t.x, t.y, ab.radius, 'realm')
        .filter(m => m.kindClass === 'unit').length;
      return (packed >= 2 || full) ? u.useAbility(t) : false;
    }
    // ---- clerics: everyone nearby, when enough of them need it
    case 'radiance': {
      let hurt = 0, worst = 1;
      for (const a of g.units) {
        if (a.dead || a.faction !== 'realm') continue;
        if (dist(a.x, a.y, u.x, u.y) > ab.radius) continue;
        const f = a.hp / a.maxHpNow;
        if (f < MEND_AT) hurt++;
        if (f < worst) worst = f;
      }
      return (hurt >= 2 || worst < 0.4) ? u.useAbility(null) : false;
    }
    case 'hymn': {
      // sing when there is a fight on and a line of people to bless
      let want = 0;
      for (const a of g.units) {
        if (a.dead || a.faction !== 'realm' || a === u || a.blessed > 0) continue;
        if (dist(a.x, a.y, u.x, u.y) > ab.radius) continue;
        const busy = (a.target && !a.target.dead) || g.time - (a.lastHit || -99) < 4;
        if (busy || a.isHero) want++;
      }
      const fight = !!g.nearestEnemy(u.x, u.y, ab.radius + 60, 'realm');
      // A paladin sings from inside the fight rather than behind it: the
      // hymn is half their own armour, so being in it is reason enough.
      const front = !!(u.specDef && u.specDef.frontline);
      const pressed = front
        && (g.time - (u.lastHit || -99) < 3 || u.hp < u.maxHpNow * 0.8);
      return ((want >= (front ? 1 : 2) && fight) || pressed) ? u.useAbility(null) : false;
    }
    default:
      return t ? u.useAbility(t) : false;
  }
}

export function peasantBrain(u, since) {
  const g = u.game;

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

function carryCap(u) {
  return RES_RATE[u.job?.node?.kind]?.carry || 12;
}

function doHarvest(u, g, since) {
  const node = u.job && u.job.node;
  if (!node || node.amount <= 0) { u.job = null; u.state = 'idle'; return; }
  const cap = RES_RATE[node.kind].carry;
  if (u.carry >= cap) return deliver(u, g);

  if (touching(u, node)) {
    u.state = 'harvest';
    u.stalledOn = null;
    u.path = null;
    const info = RES_RATE[node.kind];
    const boost = g.depotBoost(node.tx, node.ty, info.res);
    const got = Math.min(info.rate * (1 + boost) * since, cap - u.carry, node.amount);
    u.carry += got;
    node.amount -= got;
    u.carryRes = info.res;
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
    site.addProgress(since / site.def.build);
    if (Math.random() < 0.4) g.fx.puff(site.x + (Math.random() - .5) * site.fw * TILE, site.bottom - 6, '#d8cfe6', 1);
  } else {
    u.state = 'walk';
    walkTo(u, g, site);
  }
}

function doRepair(u, g, since, b) {
  if (touching(u, b, 1.5)) {
    u.path = null;
    b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.06 * since);
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

/**
 * Who is a support unit and who merely knows first aid. A cleric keeps out
 * of reach, crosses the map to the wounded and never picks a fight; a
 * Paladin is a cleric by guild and a soldier by trade, so `frontline` takes
 * them out of all of that and lets them behave like the warrior they are.
 */
const isSupport = (u) => !!u.def.heal && !(u.specDef && u.specDef.frontline);

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

/**
 * Would this monster actually be in the fight? A camp's own garrison always
 * would. Anything else joins only once the brawl reaches it, and a
 * NEIGHBOURING camp's guard counts for less even then: they come out in ones
 * and twos as they notice, not as one wall. Summing every breathing thing
 * inside a flat radius is what made two camps pitched close together into a
 * single problem nobody was ever brave enough to solve.
 */
function joinsIn(m, x, y, camp) {
  if (camp && m.lair === camp) return 1;
  const theirs = m.lair && !m.lair.dead && m.lair !== camp ? WARBAND.spill : 1;
  const pull = (m.def.aggro || 140) * 0.8;
  const d = dist(m.x, m.y, x, y);
  if (d <= pull) return theirs;
  const fade = WARBAND.fade * TILE;
  return d >= pull + fade ? 0 : theirs * (1 - (d - pull) / fade);
}

/**
 * A camp as a key: what two heroes compare to agree they mean the same one,
 * and the same string the road-shyness above is filed under, so declaring
 * for a camp and being wary of the way there are talking about one place.
 */
const campKey = (o) => o ? `lair:${o.id}` : null;

/**
 * Everyone who has declared for the same camp. Distance is not a
 * disqualifier: a warrior still three screens out is part of the warband,
 * they are simply not swinging yet. That is the whole point -- heroes commit
 * to a camp BEFORE they can take it, and the commitment is what lets the
 * numbers gather.
 */
function warband(g, hero, key, x, y) {
  const band = { count: 0, force: 0, top: hero.level, seen: new Set() };
  if (!key) return band;
  for (const a of g.units) {
    if (a.dead || a === hero || a.faction !== 'realm') continue;
    if (a.warTarget !== key) continue;
    const d = dist(a.x, a.y, x, y);
    if (d > WARBAND.reach * TILE) continue;
    band.count++;
    band.force += strength(a) * (d < 5 * TILE ? 1 : 0.7);
    band.seen.add(a);
    if (a.level > band.top) band.top = a.level;
  }
  return band;
}

/**
 * Hype. Soldiers massing for an assault talk each other into it: every
 * comrade makes the rest braver, and a hero of higher level at the front of
 * the crowd is worth several ordinary ones. You follow the person who looks
 * like they have done this before.
 */
function hype(band, hero) {
  const crowd = Math.min(WARBAND.cap, 1 + band.count * WARBAND.join);
  const lead = 1 + Math.min(WARBAND.leaderCap,
    Math.max(0, band.top - hero.level) * WARBAND.leader);
  return crowd * lead;
}

/**
 * The sum a hero does before walking into a camp: everything that would
 * swing at them, everything that would swing for them, and how brave the
 * crowd at their shoulder makes them feel about the difference.
 *
 * `brave` is the one number the callers gate on. One is even odds for a hero
 * of ordinary nerve; anything less and they want company, or gold.
 */
function siegeOdds(g, hero, x, y, camp, radius, key, bounty = 0) {
  let threat = 0;
  for (const m of g.units) {
    if (m.dead || m.faction !== 'monster') continue;
    const w = joinsIn(m, x, y, camp);
    if (w > 0) threat += strength(m) * w;
  }
  // The camp itself never swings back, but it is a wall you have to stand in
  // front of and break while the garrison musters -- which is exactly why a
  // stronger camp wants more bodies whatever happens to be outside it at the
  // moment somebody looks.
  if (camp && !camp.dead) threat += strength(camp) * WARBAND.wall;

  const band = warband(g, hero, key, x, y);
  let mine = strength(hero) * (1 + (hero.level - 1) * 0.12) + band.force;
  for (const a of g.units) {
    if (a.dead || a.faction !== 'realm' || a === hero) continue;
    if (band.seen.has(a)) continue;                  // already in the warband
    if (!a.isHero && a.kind !== 'guard') continue;
    const withTrouble = dist(a.x, a.y, x, y) <= radius * 1.4;
    const withMe = dist(a.x, a.y, hero.x, hero.y) <= 170;
    if (!withTrouble && !withMe) continue;
    mine += strength(a) * (withTrouble ? 0.8 : 0.55);
  }

  // Gold is the lever that overrules the arithmetic, and it is priced against
  // what is being asked: enough to buy a hero into a rat nest is pocket
  // change, enough to buy one into an ogre den on their own is a fortune.
  // At full price they stop doing sums altogether and go, which is how you
  // send somebody on a death mission and what the number on the flag means.
  const paid = bounty * (0.45 + hero.def.greed);
  const price = Math.max(WARBAND.floor, threat * WARBAND.price);
  const bought = Math.min(1, paid / price);
  // Resolve. A decision already made is worth something on its own: without
  // this a hero sitting exactly on the line flips between massing and
  // charging every third of a second and spends the whole battle walking
  // back and forth. Having already set off counts for more than having
  // merely declared.
  const resolve = hero.warCharge === key ? WARBAND.resolve
    : hero.warTarget === key ? WARBAND.declared : 1;
  const nerve = hype(band, hero) * (1 + bought * WARBAND.goldCap) * resolve;
  const odds = mine / Math.max(1, threat);
  return { threat, mine, odds, band, nerve, bought, brave: odds * nerve };
}

/**
 * Where a warband forms up: short of the camp, on the side it came from, and
 * outside whatever lives there can smell. Everyone from the same home works
 * it out the same way, so they pile up on the same patch of grass instead of
 * loitering singly in a ring around the thing none of them dare touch.
 */
function musterPoint(g, camp, u) {
  const dx = u.homeX - camp.x, dy = u.homeY - camp.y;
  const len = Math.hypot(dx, dy) || 1;
  const wake = MONSTERS[camp.def.spawn];
  const want = Math.max(WARBAND.stand * TILE, (wake ? wake.aggro : 160) + 3 * TILE);
  return g.world.nearestFree(
    toTile(camp.x + (dx / len) * want), toTile(camp.y + (dy / len) * want), 8);
}

/** Is there anybody left who could come? No point massing alone. */
function anyoneToWaitFor(g, u) {
  for (const a of g.units) {
    if (a.dead || a === u || a.faction !== 'realm' || !a.isHero) continue;
    if (isSupport(a) || a.stance === 'defend') continue;
    return true;
  }
  return false;
}

/**
 * What one fresh warrior is worth, for when the player has no heroes at all
 * and the panel still owes them a number. Built the same way a real one is,
 * so it does not quietly disagree with the article on the ground.
 */
function notionalWarrior() {
  const c = CLASSES.warrior;
  const stat = (k) => (c.stats[k] || 5) + ((c.knight && c.knight[k]) || 0);
  return strength({
    kindClass: 'unit',
    power: c.dmg * (1 + (stat('str') - 5) * STAT_EFFECT.dmgPerPoint),
    hp: c.hp + (stat('con') - 5) * STAT_EFFECT.hpPerPoint
  });
}

/**
 * What the player is told when they tap a camp, worked out with the same
 * arithmetic the heroes use -- a number that disagrees with what they
 * actually do would be worse than no number at all.
 */
export function campAssessment(g, camp) {
  const heroes = g.units.filter(u => !u.dead && u.isHero && !isSupport(u));
  let threat = 0;
  for (const m of g.units) {
    if (m.dead || m.faction !== 'monster') continue;
    const w = joinsIn(m, camp.x, camp.y, camp);
    if (w > 0) threat += strength(m) * w;
  }
  if (!camp.dead) threat += strength(camp) * WARBAND.wall;
  const typical = heroes.length
    ? heroes.reduce((s, h) => s + strength(h) * (1 + (h.level - 1) * 0.12), 0) / heroes.length
    : notionalWarrior();
  // The bar the heroes themselves would apply, not a guess at one: a panel
  // that promises three swords will do where the heroes want five is worse
  // than a panel that says nothing.
  const bar = 1.15 - (heroes.length
    ? heroes.reduce((s, h) => s + h.def.courage, 0) / heroes.length
    : CLASSES.warrior.courage);
  const key = campKey(camp);
  let need = 1;
  // n heroes see n-1 comrades apiece, and hype each other accordingly
  while (need < 12 && need * typical
    * Math.min(WARBAND.cap, 1 + (need - 1) * WARBAND.join) < threat * bar) need++;
  return {
    threat, need,
    here: heroes.filter(h => h.warTarget === key).length,
    price: Math.ceil(Math.max(WARBAND.floor, threat * WARBAND.price))
  };
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

  // The anchor belongs to one roadside scuffle and dies with it. Left lying
  // around it would cancel the next fight the moment they walked anywhere.
  if (u.roadAnchor && (!u.target || u.target.dead)) u.roadAnchor = null;

  // --- 0. spend the temper -----------------------------------------
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
      u.warTarget = null;        // a hero running is nobody's reason to charge
      u.rallyKey = null;
      u.warCharge = null;
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
  if (isSupport(u)) {
    // how close a robe lets them come before it backs away
    const keep = CLERIC_KEEP * ((u.specDef && u.specDef.keep) || 1);
    const close = g.nearestEnemy(u.x, u.y, keep, 'realm');
    if (close) {
      const cornered = u.distTo(close) <= u.reach + 6
        && g.time - (u.lastHit || -99) < 2
        && u.hp > u.maxHpNow * 0.4;
      if (!cornered) {
        u.target = null;
        u.state = 'mend';
        tryHeal(u, g, since) || tryBless(u, g, since);
        backAwayFrom(u, g, close, keep + 30);
        return;
      }
      u.engage(close);      // nowhere left to go: swing the mace
    }
  }

  if (u.target && !u.target.dead) {
    const d = u.distTo(u.target);
    // Stand and fight what reaches you; do not follow it home. A monster
    // that would have to be chased back inside its camp's reach is left to
    // come again, unless the camp is one this hero could take anyway.
    if (d > u.reach * 1.5 && u.target.kindClass === 'unit') {
      const camp = campBehind(g, u.target);
      if (camp && !couldTake(g, u, camp)) u.target = null;
    }
    // Trouble on the road is answered, not chased. Once a scuffle has pulled
    // them this far from where it started, the errand wins again.
    if (u.roadAnchor && dist(u.x, u.y, u.roadAnchor.x, u.roadAnchor.y) > ROAD_LEASH) {
      u.target = null;
      u.roadAnchor = null;
    }
    if (u.target && d < 260) {
      // clerics prefer patching people up mid-fight, and buffing whoever is
      // swinging, over swinging themselves -- a cleric's mace is a last resort
      if (isSupport(u) && (tryHeal(u, g, since) || tryBless(u, g, since))) return;
      u.state = 'fight';
      u.fight(since);
      return;
    }
    u.target = null;
  }
  if (isSupport(u) && (tryHeal(u, g, since) || tryBless(u, g, since))) return;

  // --- 2b. a cleric goes looking ------------------------------------
  // The difference between a cleric and a soldier who knows first aid: they
  // cross the map to somebody bleeding instead of mending whoever wanders by.
  // They do it from arm's length, though: a cleric standing in the middle of
  // a melee is a dead cleric, and a dead cleric heals nobody.
  if (isSupport(u)) {
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

  // --- 2c. anything already in the way ------------------------------
  // A hero on an errand used to walk straight past a monster that was
  // swinging at them, because a flag worth 400 gold outscores a rat, and
  // arrive at the camp bleeding with a tail of them behind. Whatever is
  // close enough to be a nuisance gets answered where it stands -- but the
  // anchor above means answered, not followed.
  // Only while they are actually going somewhere. At a camp there is always
  // a defender within three tiles, so without this the rule fires forever and
  // nobody ever swings at the wall -- a siege that never lands a blow on the
  // thing it came to break. Standing still, the ordinary scoring below
  // already weighs whatever is nearby.
  if (u.path && !u.target && !isSupport(u) && u.fleeing <= 0) {
    // Whoever is actually biting us counts wherever they are standing; a
    // bystander has to be genuinely in the way. Answering everything within
    // sight is not self-defence, it is picking fights, and in a crowded
    // corner of the map it stops a party ever arriving anywhere.
    const biter = u.lastAttacker;
    const bitten = biter && !biter.dead && biter.faction === 'monster'
      && g.time - (u.lastHit || -99) < 3 && u.distTo(biter) < ROAD_LEASH;
    const nuisance = bitten ? biter : g.nearestEnemy(u.x, u.y, ROADSIDE, 'realm', false);
    if (nuisance && u.engage(nuisance)) {
      u.roadAnchor = { x: u.x, y: u.y };
      u.state = 'fight';
      u.fight(since);
      return;
    }
  }

  // A paladin is not a field hospital, but they will not stand beside
  // somebody bleeding out and do nothing between swings.
  if (u.def.heal && !isSupport(u) && !u.target) tryHeal(u, g, since);

  // --- 3. score the world -------------------------------------------
  const best = chooseGoal(u, g);
  u.goalKind = best ? best.kind : 'idle';
  // Declaring for a camp is a public act: it is what the next hero to look at
  // the same camp counts, so it has to be recorded whether we are walking in
  // or still standing outside working up to it.
  u.warTarget = best && best.key ? best.key : null;
  if (!u.warTarget) { u.rallyKey = null; u.warCharge = null; u.warName = null; }

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
        // The road matters as much as the destination -- and the bounty buys
        // only half as much nerve for it: the purse is for the fight at the
        // flag, not for walking through somebody else's camp to reach it.
        const nerve = 1 + Math.min(2, (f.bounty / 350) * (0.5 + def.greed)) * 0.5;
        if (routeTooRisky(u, g, `flag:${f.id}`, { x: f.x, y: f.y, r: (f.radius + 2) * TILE }, nerve)) {
          u.flagId = null;
          return heroIdle(u, g);
        }
      } else {
        u.path = null;
        g.heroAtFlag(u, f, since);
      }
      return;
    }

    case 'camp': {
      const camp = best.camp, f = best.flag;
      u.warName = camp ? camp.name : 'the camp';

      if (!best.ready) {
        // Stacking up. Stand short of the camp with whoever else has declared
        // for it and let the crowd do its work -- but not forever: a hero who
        // waits with nobody arriving gives up on that camp for a while and
        // goes and finds something useful to do. Only the waiting counts
        // against their patience; the walk out there does not.
        u.warCharge = null;
        if (u.rallyKey !== best.key) { u.rallyKey = best.key; u.rallyFor = WARBAND.patience; }
        u.state = 'rally';
        const spot = musterPoint(g, camp, u);
        const far = spot ? dist(toPx(spot.x), toPx(spot.y), u.x, u.y) : 0;
        if (spot && far > 3 * TILE) {
          if (!u.path && !u.needPath) u.goTo(spot.x, spot.y, 2);
          // Forming up outside a camp is not a reason to walk through another
          // one on the way -- and nobody is massing yet, so the nerve for the
          // road is whatever this hero has on their own.
          if (routeTooRisky(u, g, best.key, { lair: camp }, roadNerve(best.nerve))) return heroIdle(u, g);
          // No path to the mustering ground and none coming: standing about
          // failing to get there is waiting like any other, and it has to
          // count against their patience or they stand there for good.
          if (!u.path && !u.needPath) u.rallyFor -= since;
          else return;
        } else {
          u.rallyFor -= since;
        }
        if (u.rallyFor <= 0) {
          u.shunKey = best.key;
          u.shunUntil = g.time + WARBAND.shun;
          u.rallyKey = null; u.warTarget = null; u.warName = null;
          return heroIdle(u, g);
        }
        idleAround(u, g, toPx(spot ? spot.x : u.tx), toPx(spot ? spot.y : u.ty), 2);
        u.state = 'rally';        // idleAround calls it loitering; it is not
        return;
      }

      // In we go, and once we have set off we stay set off.
      u.warCharge = best.key;
      u.rallyKey = null;
      u.state = 'quest';
      if (f) {
        u.flagId = f.id;
        const d = dist(u.x, u.y, f.x, f.y);
        if (d > f.radius * TILE * 0.7) {
          if (!u.path && !u.needPath) u.goTo(toTile(f.x), toTile(f.y), 1);
          // The road is weighed with the same nerve the camp was: a warband
          // that is brave enough for the camp is brave enough for the way in.
          if (routeTooRisky(u, g, best.key, camp ? { lair: camp }
            : { x: f.x, y: f.y, r: (f.radius + 2) * TILE }, roadNerve(best.nerve))) {
            u.flagId = null;
            return heroIdle(u, g);
          }
        } else {
          u.path = null;
          g.heroAtFlag(u, f, since);
        }
        return;
      }
      // Somebody who will not hit a building still has a part in the siege:
      // they kill what comes out of it. With nothing left outside, they have
      // no business here and the next think-tick sends them elsewhere.
      if (!u.mayAttack(camp)) {
        const prey = g.nearestEnemy(camp.x, camp.y, g.lairReach(camp) * TILE, 'realm', false);
        if (!prey) return heroIdle(u, g);
        u.engage(prey);
        u.state = 'fight';
        u.fight(since);
        return;
      }
      if (u.distTo(camp) <= u.reach) { u.engage(camp); u.fight(since); }
      else {
        walkTo(u, g, camp);
        if (routeTooRisky(u, g, best.key, { lair: camp }, roadNerve(best.nerve))) return heroIdle(u, g);
      }
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
      // curiosity is not worth walking through a camp for
      if (routeTooRisky(u, g, 'explore', {}, 0.7)) { u.exploreGoal = null; return heroIdle(u, g); }
      if (u.arrived) { u.arrived = false; u.exploreGoal = null; }
      return;
    }
  }
  heroIdle(u, g);
}

/**
 * Could this hero, as things stand, take that camp? Three instincts ask it --
 * whether to chase a prowler home, whether the road past it is walkable,
 * whether curiosity may go that way -- and they all deserve the same answer,
 * worked out the same way the assault itself would be.
 */
function couldTake(g, u, camp) {
  const { brave } = siegeOdds(g, u, camp.x, camp.y, camp,
    g.lairReach(camp) * TILE, campKey(camp));
  return brave >= 1.15 - u.def.courage;
}

/** The living camp this monster is standing within reach of, if any. */
function campBehind(g, m) {
  const l = m.lair;
  if (!l || l.dead || !g.world.seen(l.tx, l.ty)) return null;
  return dist(m.x, m.y, l.x, l.y) <= g.lairReach(l) * TILE ? l : null;
}

/**
 * Self-preservation on the road. The pathfinder already skirts every camp
 * it can; this is for the camp it cannot get round. Once a path exists it is
 * walked once, on paper, and every camp it crosses -- other than the one it
 * is going to -- is weighed the way the destination was. Lose that sum and
 * the hero says so, drops the errand for a while, and picks another. Gold
 * still buys nerve: `nerve` is the same bounty multiplier the flag used.
 */
function routeTooRisky(u, g, key, goal, nerve) {
  const path = u.path;
  if (!path || u.routeChecked === path) return false;
  u.routeChecked = path;
  const def = u.def;
  for (const l of g.lairs) {
    if (l.dead || !g.world.seen(l.tx, l.ty)) continue;
    if (goal.lair === l) continue;
    if (goal.x !== undefined && dist(l.x, l.y, goal.x, goal.y) <= goal.r) continue;   // the target itself
    const reach = g.lairReach(l);
    let crossed = false;
    for (let i = 3; i < path.length; i++) {
      if (Math.hypot(path[i].x - (l.tx + 1), path[i].y - (l.ty + 1)) <= reach) { crossed = true; break; }
    }
    if (!crossed) continue;
    // Weighed the way the destination was: this camp's own garrison however
    // far it has strayed, its neighbours only as far as they would actually
    // join. Summing everything inside the reach counted the camp we are
    // walking TO all over again, and two camps pitched close together came
    // out as one wall with no way past it in either direction.
    const { brave } = siegeOdds(g, u, l.x, l.y, l, reach * TILE, campKey(l));
    if (brave * nerve >= 1.15 - def.courage) continue;             // they can take it
    u.shy = u.shy || {};
    u.shy[key] = g.time + 60;
    u.stop();
    g.fx.text(u.x, u.y - 20, 'NOT PAST THAT', '#ff9d9d', 22);
    return true;
  }
  return false;
}
const isShy = (u, g, key) => !!(u.shy && u.shy[key] > g.time);
/**
 * Gold and company buy only half as much nerve for the road as for the camp
 * itself. The purse is for the fight you are being paid for, and the crowd
 * at your shoulder is going to that camp, not this one.
 */
const roadNerve = (nerve) => 1 + (nerve - 1) * 0.5;

function tryHeal(u, g, since) {
  const h = u.def.heal, sp = u.specDef;
  u.healCool = (u.healCool || 0) - since;
  if (u.healCool > 0) return false;
  const range = h.range * ((sp && sp.mendMul) || 1);
  let best = null, worst = 1;
  for (const a of g.units) {
    if (a.dead || a.faction !== 'realm' || a === u) continue;
    const f = a.hp / a.maxHpNow;
    if (f >= MEND_AT) continue;
    if (dist(a.x, a.y, u.x, u.y) > range) continue;
    if (f < worst) { worst = f; best = a; }
  }
  // nobody else is hurt? a cleric bleeding out is still somebody who is hurt
  if (!best && u.hp < u.maxHpNow * 0.6) best = u;
  if (!best) return false;
  if (u.mana < HEAL_COST) return false;
  u.mana -= HEAL_COST;
  u.healCool = h.rate;
  const given = best.heal(h.amount * (1 + (u.level - 1) * 0.2) * u.spellPower * ((sp && sp.healMul) || 1));
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
  best.blessed = BLESSING.lasts * ((u.specDef && u.specDef.blessMul) || 1);
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
    if (!a.isHero || isSupport(a)) continue;       // stand with the fighters
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
  if (isSupport(u)) return null;
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
    let { threat, mine } = dangerAt(g, m.x, m.y, 90, u);
    // A prowler at the edge of its camp is the camp. Chasing the one you can
    // see into the reach of the ones you cannot is how parties get eaten.
    const camp = campBehind(g, m);
    if (camp) threat = Math.max(threat, siegeOdds(g, u, camp.x, camp.y, camp,
      g.lairReach(camp) * TILE, campKey(camp)).threat);
    const odds = mine / Math.max(1, threat);
    if (odds < 1 - def.courage) continue;
    let value = (m.def.gold * 1.4 + m.def.xp * 1.2) * (0.6 + greed);
    // defend the town: monsters near our buildings are urgent
    const nearTown = g.nearestBuilding(m.x, m.y, b => b.complete, 150);
    if (nearTown) value *= holding ? 5 : 3.2;
    value *= clamp(odds, 0.3, 2.2);
    opts.push({ kind: 'fight', target: m, score: value / (1 + (d / TILE) * 0.16) * fearPenalty(g, m.x, m.y) });
  }

  // (a2) the finale -- and the finale is not a risk assessment.
  // Everything these instincts protect is a hero's ability to come back and
  // fight another day. When the last camp is rubble and the thing under it is
  // walking at the City Centre, there is no other day and nowhere to come
  // back to, so the sums are off: everybody goes, wherever it is, whatever
  // the odds, and keeps going until it or the realm is finished.
  if (g.dragon && !g.dragon.dead && !isSupport(u)) {
    const d = dist(u.x, u.y, g.dragon.x, g.dragon.y);
    opts.push({ kind: 'fight', target: g.dragon, score: 1e6 / (1 + (d / TILE) * 0.02) });
  }

  // A hero who walked away from a camp for want of company does not turn
  // straight round and start waiting on it again.
  const shunned = (key) => u.shunKey === key && g.time < u.shunUntil;
  const mayWait = anyoneToWaitFor(g, u);

  /**
   * One camp, one option, two phases. Going in and forming up used to be two
   * entries competing on score, and a hero sitting between them flipped
   * every think-tick and walked back and forth until something ate them.
   * They are the same intention: what changes is whether there are enough of
   * us yet.
   */
  const considerCamp = (camp, key, value, d, bar, brave, nerve, flag) => {
    if (isShy(u, g, key)) return;                    // the road there was too much
    // A camp is only worth a knife while there is somebody outside it to use
    // the knife on: the building itself is somebody else's job.
    if (camp && !u.mayAttack(camp)
      && !g.nearestEnemy(camp.x, camp.y, g.lairReach(camp) * TILE, 'realm', false)) return;
    const ready = brave >= bar;
    if (!ready) {
      if (!camp || holding || !mayWait || shunned(key)) return;
      if (brave < bar * WARBAND.rallyAt) return;     // hopeless, not merely hard
    }
    opts.push({
      kind: 'camp', camp, key, flag, ready, nerve,
      score: value * (ready ? 1 : 0.55) / (1 + (d / TILE) * (flag ? 0.1 : 0.14))
        * fearPenalty(g, camp ? camp.x : flag.x, camp ? camp.y : flag.y)
    });
  };

  // (b) reward flags — the whole point of the game
  for (const f of g.flags) {
    if (f.type === 'fear' || f.done) continue;
    if (isShy(u, g, `flag:${f.id}`)) continue;     // the road there was too much, for now
    const d = dist(u.x, u.y, f.x, f.y);
    const camp = f.type === 'attack' ? g.campNear(f.x, f.y, f.radius * TILE + 40) : null;
    const key = camp ? campKey(camp) : `flag:${f.id}`;
    let value = f.bounty * (0.45 + greed * 1.25);
    if (f.type === 'explore') value *= def.id === 'ranger' ? 1.7 : 0.85;
    if (f.type === 'defend') value *= 1.0 + (f.claimed === u.id ? 0.7 : 0);
    if (f.claimed && f.claimed !== u.id && f.type !== 'attack') value *= 0.35;
    if (f.type === 'attack') {
      const { brave, bought, nerve } = siegeOdds(
        g, u, f.x, f.y, camp, f.radius * TILE + 30, key, f.bounty);
      // A full-price bounty is a death mission, knowingly paid for: they stop
      // doing sums and go. Short of that the odds still have to be faced,
      // with whatever nerve the gold and the crowd can muster between them.
      considerCamp(camp, key, value, d, 0.85 - def.courage,
        bought >= 1 ? Infinity : brave, nerve, f);
      continue;
    }
    opts.push({
      kind: 'flag', flag: f,
      score: value / (1 + (d / TILE) * 0.1) * fearPenalty(g, f.x, f.y)
    });
  }

  // (c) monster lairs they know about, within their patch of the realm
  const homeX = u.homeX, homeY = u.homeY;
  for (const l of g.lairs) {
    if (l.dead) continue;
    if (!g.world.seen(l.tx, l.ty)) continue;
    if (isShy(u, g, `lair:${l.id}`)) continue;
    if (dist(l.x, l.y, homeX, homeY) > def.wander * 1.6 * TILE) continue;
    const d = dist(u.x, u.y, l.x, l.y);
    const key = campKey(l);
    // The camp's own garrison counts however far it has wandered from the
    // door; the reach only decides who ELSE gets swept in.
    const { brave, nerve } = siegeOdds(g, u, l.x, l.y, l, g.lairReach(l) * TILE, key);
    const value = l.def.reward * 0.5 * (0.5 + greed) * (0.6 + u.level * 0.25) * (holding ? 0.3 : 1);
    considerCamp(l, key, value, d, 1.15 - def.courage, brave, nerve, null);
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
  if (t && !isShy(u, g, 'explore')) {
    const gx = toPx(t.tx), gy = toPx(t.ty);
    const d = dist(u.x, u.y, gx, gy);
    // Curiosity stops at the edge of a known camp's reach. A frontier tile
    // inside it is not a discount, it is off the list -- unless the camp is
    // one this hero could take, in which case it is a fight, not a stroll.
    let lairShy = 1;
    for (const l of g.lairs) {
      if (l.dead || !g.world.seen(l.tx, l.ty)) continue;
      if (dist(l.x, l.y, gx, gy) >= (g.lairReach(l) + 3) * TILE) continue;
      lairShy = couldTake(g, u, l) ? 0.3 : 0;
      break;
    }
    if (!lairShy) u.exploreGoal = null;         // draw another next time
    if (lairShy) opts.push({
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
    // a boss's escort keeps marching as long as its lord is still on its feet
    if (u.raidLeft <= 0 && !u.boss && u.lair && u.lair.leader && !u.lair.leader.dead) u.raidLeft = 20;
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
