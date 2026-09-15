// ===================================================================
// ui.js — DOM HUD, pointer input, and every player-facing command.
// Designed thumb-first: one-finger pan, tap to select, big buttons.
// ===================================================================
import { TILE, buildingSprite, unitSprite, propSprite, flagSprite, makeCanvas, PAL } from './art.js';
import { BUILDINGS, BUILD_ORDER, CLASSES, FLAGS, MONSTERS, LAIRS, RES_RATE, RESURRECT_COST } from './data.js';
import { toTile, toPx } from './world.js';
import { fmt, clamp, dist } from './util.js';

const $ = (s) => document.querySelector(s);

/** Wrap a cached sprite in a fresh canvas element scaled to fit a box. */
function spriteEl(src, boxW, boxH, cssH) {
  const c = makeCanvas(boxW, boxH);
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  const s = Math.min(boxW / src.width, boxH / src.height, 2);
  const w = Math.round(src.width * s), h = Math.round(src.height * s);
  x.drawImage(src, Math.round((boxW - w) / 2), Math.round(boxH - h), w, h);
  if (cssH) { c.style.height = cssH + 'px'; c.style.width = Math.round(boxW * (cssH / boxH)) + 'px'; }
  return c;
}
const buildIcon = (id) => {
  const d = BUILDINGS[id];
  return spriteEl(buildingSprite(id, d.fw, d.fh, 'done'), 56, 56, 34);
};
const unitIcon = (kind) => spriteEl(unitSprite(kind, 0, 1), 16, 16, 26);

function costText(cost, game) {
  const bits = [];
  for (const k of ['gold', 'wood', 'stone']) {
    if (!cost[k]) continue;
    const short = { gold: 'g', wood: 'w', stone: 's' }[k];
    const lack = game.res[k] < cost[k];
    bits.push(`<span class="${lack ? 'no' : ''}">${cost[k]}${short}</span>`);
  }
  return bits.join(' ') || 'free';
}

export class UI {
  constructor(game, renderer, audio, app) {
    this.game = game;
    this.r = renderer;
    this.audio = audio;
    this.app = app;
    this.tab = null;
    this.refreshIn = 0;
    this.pointers = new Map();
    this.panning = false;
    this.moved = 0;
    this.boxSelect = null;
    this.flagBounty = {};
    this.lastTap = 0;
    this.bind();
    this.renderTopbar();
    this.syncZoomLabel();
    // if the camera's subject dies, say so rather than silently drifting
    this.r.onFollowEnd = (gone) => {
      this.setFollowChip();
      this.notify(`${gone.name} is gone`, 'bad');
      this.renderSelection();
    };
  }

  // ---------------------------------------------------------------
  bind() {
    const cv = this.r.canvas;

    cv.addEventListener('pointerdown', e => this.onDown(e));
    cv.addEventListener('pointermove', e => this.onMove(e));
    window.addEventListener('pointerup', e => this.onUp(e));
    window.addEventListener('pointercancel', e => this.onUp(e));
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const before = this.r.screenToWorld(e.clientX, e.clientY);
      this.r.setScale(this.r.scaleF * (e.deltaY < 0 ? 1.18 : 1 / 1.18));
      const after = this.r.screenToWorld(e.clientX, e.clientY);
      this.r.cam.x += before.x - after.x;
      this.r.cam.y += before.y - after.y;
      this.syncZoomLabel();
    }, { passive: false });

    // iOS Safari ignores user-scalable=no and pinches the page instead of the
    // map unless these are cancelled outright.
    for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
      document.addEventListener(ev, e => e.preventDefault(), { passive: false });
    }
    cv.addEventListener('touchstart', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
    cv.addEventListener('touchmove', e => { e.preventDefault(); }, { passive: false });
    cv.addEventListener('dblclick', e => e.preventDefault());

    for (const b of document.querySelectorAll('.cmd[data-tab]')) {
      b.addEventListener('click', () => { this.audio.play('ui'); this.openDrawer(b.dataset.tab); });
    }
    $('#drawer-close').addEventListener('click', () => this.closeDrawer());
    $('#placecancel').addEventListener('click', () => this.cancelPlace());
    $('#btn-zoom').addEventListener('click', () => {
      this.audio.play('ui');
      this.r.zoomStep();
      this.syncZoomLabel();
    });
    $('#btn-speed').addEventListener('click', () => {
      this.audio.play('ui');
      const g = this.game;
      g.speed = g.speed === 1 ? 2 : g.speed === 2 ? 3 : 1;
      $('#speedlbl').textContent = g.speed + 'x';
    });
    $('#btn-menu').addEventListener('click', () => { this.audio.play('ui'); this.showMenu(); });

    window.addEventListener('keydown', e => this.onKey(e));
    window.addEventListener('resize', () => this.r.resize());
  }

  // ---------------------------------------------------------------
  // pointer input
  // ---------------------------------------------------------------
  onDown(e) {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
    // Capture is a nicety, not a requirement: if the browser refuses it, input
    // must still work rather than throwing out of the handler.
    try { this.r.canvas.setPointerCapture?.(e.pointerId); } catch (_) { /* no capture, no problem */ }
    this.moved = 0;
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
      this.pinchScale = this.r.scaleF;
      this.pinchAnchor = this.r.screenToWorld((a.x + b.x) / 2, (a.y + b.y) / 2);
      this.panning = false;
    } else if (e.shiftKey && e.pointerType === 'mouse') {
      const w = this.r.screenToWorld(e.clientX, e.clientY);
      this.boxSelect = { x0: w.x, y0: w.y, x1: w.x, y1: w.y };
    } else {
      this.panning = true;
    }
    this.audio.resume();
  }

  onMove(e) {
    const p = this.pointers.get(e.pointerId);
    const world = this.r.screenToWorld(e.clientX, e.clientY);
    this.r.hoverTile = { x: toTile(world.x), y: toTile(world.y) };
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    this.moved += Math.hypot(dx, dy);

    if (this.r.mapOpen) return;

    if (this.pointers.size === 2 && this.pinchStart) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      this.r.setScale(this.pinchScale * (d / this.pinchStart));
      // hold the point between the fingers still, unless the camera is
      // already locked to somebody
      if (!this.r.follow) {
        const after = this.r.screenToWorld((a.x + b.x) / 2, (a.y + b.y) / 2);
        this.r.cam.x += this.pinchAnchor.x - after.x;
        this.r.cam.y += this.pinchAnchor.y - after.y;
        this.r.clampCam();
      }
      this.syncZoomLabel();
      return;
    }
    if (this.boxSelect) { this.boxSelect.x1 = world.x; this.boxSelect.y1 = world.y; return; }
    if (this.panning && this.moved > 6) {
      this.stopFollow();                       // taking the wheel ends the tour
      this.r.cam.x -= dx * this.r.dpr / this.r.scale;
      this.r.cam.y -= dy * this.r.dpr / this.r.scale;
      this.r.clampCam();
    }
  }

  onUp(e) {
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinchStart = null;
    if (!p) return;

    if (this.boxSelect) {
      this.finishBoxSelect();
      this.boxSelect = null;
      return;
    }
    const held = performance.now() - p.t;
    const travel = Math.hypot(e.clientX - p.sx, e.clientY - p.sy);
    if (travel < 12 && held < 600 && this.pointers.size === 0) {
      const onMap = this.r.minimapHit(e.clientX, e.clientY);
      if (this.r.mapOpen) {
        if (onMap) { this.stopFollow(); this.r.centerOn(onMap.x, onMap.y); }
        this.r.mapOpen = false;
        this.audio.play('ui');
        return;
      }
      if (onMap) { this.r.mapOpen = true; this.audio.play('ui'); return; }
      this.handleTap(this.r.screenToWorld(e.clientX, e.clientY), held);
    }
    if (this.pointers.size === 0) this.panning = false;
  }

  finishBoxSelect() {
    const b = this.boxSelect;
    const x0 = Math.min(b.x0, b.x1), x1 = Math.max(b.x0, b.x1);
    const y0 = Math.min(b.y0, b.y1), y1 = Math.max(b.y0, b.y1);
    if (Math.abs(x1 - x0) < 6 && Math.abs(y1 - y0) < 6) return;
    const picked = this.game.units.filter(u =>
      !u.dead && u.faction === 'realm' && u.x >= x0 && u.x <= x1 && u.y >= y0 && u.y <= y1);
    this.setSelection(picked);
  }

  onKey(e) {
    const g = this.game;
    if (e.key === 'Escape') {
      if (this.r.mapOpen) { this.r.mapOpen = false; return; }
      this.cancelPlace(); this.closeDrawer(); this.setSelection([]); this.stopFollow();
    }
    if (e.key === 'm' || e.key === 'M') this.r.mapOpen = !this.r.mapOpen;
    if (e.key === 'c' || e.key === 'C') {
      const u = this.game.selection.find(x => x.kindClass === 'unit');
      if (u) this.startFollow(u); else this.stopFollow();
    }
    if (e.key === ' ') { e.preventDefault(); g.paused = !g.paused; this.notify(g.paused ? 'Paused' : 'Resumed'); }
    if (e.key === 'b' || e.key === 'B') this.openDrawer('build');
    if (e.key === 'f' || e.key === 'F') this.openDrawer('flags');
    if (e.key === 'k' || e.key === 'K') this.openDrawer('kingdom');
    if (e.key === 'p' || e.key === 'P') this.selectAllPeasants();
    if (e.key === '+' || e.key === '=') { this.r.setScale(this.r.scaleF + 1); this.syncZoomLabel(); }
    if (e.key === '-') { this.r.setScale(this.r.scaleF - 1); this.syncZoomLabel(); }
    const pan = 64;
    if (e.key.startsWith('Arrow')) this.stopFollow();
    if (e.key === 'ArrowLeft') this.r.cam.x -= pan;
    if (e.key === 'ArrowRight') this.r.cam.x += pan;
    if (e.key === 'ArrowUp') this.r.cam.y -= pan;
    if (e.key === 'ArrowDown') this.r.cam.y += pan;
  }

  // ---------------------------------------------------------------
  // camera: zoom + follow
  // ---------------------------------------------------------------
  syncZoomLabel() {
    const el = document.getElementById('zoomlbl');
    if (el) el.textContent = this.r.zoomName();
  }

  /** Lock the camera onto a unit and keep it there until told otherwise. */
  startFollow(u) {
    if (!u || u.dead) return;
    this.r.setFollow(u);
    this.setFollowChip();
    this.notify(`Following ${u.name}`);
    this.audio.play('ui');
    this.renderSelection();
  }
  stopFollow() {
    if (!this.r.follow) return;
    this.r.follow = null;
    this.setFollowChip();
    this.renderSelection();
  }

  /** The "Following X / Stop" chip that sits above the alert stack. */
  setFollowChip() {
    const box = $('#alerts');
    let chip = document.getElementById('followchip');
    const u = this.r.follow;
    if (!u) { if (chip) chip.remove(); return; }
    if (!chip) {
      chip = document.createElement('div');
      chip.id = 'followchip';
      chip.innerHTML = `<span class="who"></span><button type="button">Stop</button>`;
      chip.querySelector('button').addEventListener('click', () => {
        this.audio.play('ui');
        this.stopFollow();
      });
      box.insertBefore(chip, box.firstChild);
    }
    chip.querySelector('.who').textContent = `Following ${u.name}`;
  }

  // ---------------------------------------------------------------
  // tapping the world
  // ---------------------------------------------------------------
  handleTap(w, held) {
    const g = this.game;
    const tx = toTile(w.x), ty = toTile(w.y);

    if (g.placing) return this.doPlace(tx, ty);

    const hit = this.pick(w.x, w.y);
    const peasants = g.selection.filter(u => u.kindClass === 'unit' && u.kind === 'peasant');

    // a worker order: tap a resource with peasants selected
    if (peasants.length && hit && hit.kindClass === 'node') {
      g.assignWorkers(peasants, hit);
      this.renderSelection();
      return;
    }
    if (peasants.length && !hit) {
      const free = g.world.nearestFree(tx, ty, 6);
      g.moveWorkers(peasants, free.x, free.y);
      this.fxTap(w.x, w.y, '#6ecf8e');
      return;
    }

    if (hit) {
      // double-tap a peasant selects every peasant
      const now = performance.now();
      if (hit.kindClass === 'unit' && hit.kind === 'peasant' && now - this.lastTap < 350) {
        this.selectAllPeasants();
        this.lastTap = 0;
        return;
      }
      this.lastTap = now;
      this.setSelection([hit]);
      // already riding along with someone? switch the camera to the new subject
      if (this.r.follow && hit.kindClass === 'unit') this.startFollow(hit);
      else this.audio.play('ui');
    } else {
      this.setSelection([]);
    }
  }

  fxTap(x, y, col) { this.game.fx.ring(x, y, col, 7); }

  /** What is under this world point? Units first, then structures, nodes, lairs. */
  pick(x, y) {
    const g = this.game, w = g.world;
    let best = null, bestD = 13;
    for (const u of g.units) {
      if (u.dead) continue;
      if (u.faction === 'monster' && !w.visible(u.tx, u.ty)) continue;
      if (!w.seen(u.tx, u.ty)) continue;
      const d = dist(u.x, u.y - 6, x, y);
      if (d < bestD) { bestD = d; best = u; }
    }
    if (best) return best;
    const tx = toTile(x), ty = toTile(y);
    for (const b of g.buildings) {
      if (b.dead) continue;
      if (tx >= b.tx && tx < b.tx + b.fw && ty >= b.ty && ty < b.ty + b.fh) return b;
    }
    for (const l of g.lairs) {
      if (l.dead || !w.seen(l.tx, l.ty)) continue;
      if (tx >= l.tx && tx < l.tx + 2 && ty >= l.ty && ty < l.ty + 2) return l;
    }
    for (const n of w.nodes) {
      if (n.amount <= 0 || !w.seen(n.tx, n.ty)) continue;
      if (tx >= n.tx - 1 && tx < n.tx + n.fw + 1 && ty >= n.ty - 1 && ty < n.ty + n.fh + 1) {
        return Object.assign(n, { kindClass: 'node' });
      }
    }
    for (const f of g.flags) {
      if (Math.abs(f.x - x) < 10 && Math.abs(f.y - y) < 20) return Object.assign(f, { kindClass: 'flag' });
    }
    // forests are harvestable too
    const pi = w.propAt[w.idx(tx, ty)];
    if (pi >= 0 && w.seen(tx, ty)) {
      const p = w.props[pi];
      if ((p.kind === 'tree' || p.kind === 'pine') && !p.removed) {
        return Object.assign(p, { kindClass: 'node', fw: 1, fh: 1, amount: p.wood, max: p.wood || 1 });
      }
    }
    return null;
  }

  // ---------------------------------------------------------------
  // selection
  // ---------------------------------------------------------------
  setSelection(list) {
    for (const e of this.game.selection) e.selected = false;
    this.game.selection = list.filter(Boolean);
    for (const e of this.game.selection) e.selected = true;
    this.renderSelection();
  }
  selectAllPeasants() {
    const list = this.game.units.filter(u => !u.dead && u.kind === 'peasant');
    this.setSelection(list);
    if (list.length) this.notify(`${list.length} peasants selected — tap a mine, quarry or forest`);
    this.audio.play('order');
  }
  selectIdlePeasants() {
    const list = this.game.units.filter(u => !u.dead && u.kind === 'peasant' && !u.job);
    this.setSelection(list);
    this.notify(list.length ? `${list.length} idle peasants selected` : 'No idle peasants', list.length ? '' : 'bad');
  }

  renderSelection() {
    const g = this.game;
    const el = $('#selpanel');
    const sel = g.selection;
    if (!sel.length || g.placing) { el.hidden = true; return; }
    el.hidden = false;

    if (sel.length > 1) {
      const peas = sel.filter(u => u.kind === 'peasant').length;
      el.innerHTML = `
        <div class="sel-head"><div><h3>${sel.length} selected</h3>
        <div class="meta">${peas} peasant${peas === 1 ? '' : 's'}</div></div></div>
        <div class="hint">Tap a <b>gold mine</b>, <b>quarry</b> or <b>forest</b> to put them to work. Tap open ground to move them.</div>
        <div class="acts">
          <button class="btn small" data-act="idle">Select idle only</button>
          <button class="btn small" data-act="clear">Clear</button>
        </div>`;
      this.wireSelActions(el);
      return;
    }

    const e = sel[0];
    if (e.kindClass === 'unit') return this.renderUnitPanel(el, e);
    if (e.kindClass === 'building') return this.renderBuildingPanel(el, e);
    if (e.kindClass === 'lair') return this.renderLairPanel(el, e);
    if (e.kindClass === 'node') return this.renderNodePanel(el, e);
    if (e.kindClass === 'flag') return this.renderFlagPanel(el, e);
  }

  renderUnitPanel(el, u) {
    const g = this.game;
    const following = this.r.follow === u;
    const hpF = clamp(u.hp / u.maxHpNow, 0, 1);
    const cls = hpF > 0.5 ? '' : hpF > 0.25 ? 'mid' : 'low';
    const job = u.job && u.job.type === 'harvest'
      ? `mining ${u.job.node.kind === 'goldmine' ? 'gold' : u.job.node.kind === 'quarry' ? 'stone' : 'wood'}`
      : u.job && u.job.type === 'build' ? 'building'
        : u.state;
    const isMine = u.faction === 'realm';
    el.innerHTML = `
      <div class="sel-head">
        <span class="pic"></span>
        <div class="grow">
          <h3>${u.name}</h3>
          <div class="meta">${u.title}${u.isHero ? ` &middot; level ${u.level}` : ''} &middot; ${job}</div>
          <div class="hp"><i class="${cls}" style="width:${hpF * 100}%"></i></div>
        </div>
      </div>
      <div class="statline">
        <span>HP <b>${Math.ceil(u.hp)}/${u.maxHpNow}</b></span>
        <span>DMG <b>${u.power.toFixed(0)}</b></span>
        ${u.isHero ? `<span>GOLD <b>${Math.floor(u.gold)}</b></span>
        <span>XP <b>${Math.floor(u.xp)}</b></span>
        <span>KILLS <b>${u.kills}</b></span>
        ${u.potions ? `<span>POTIONS <b>${u.potions}</b></span>` : ''}
        ${u.upgrades ? `<span>WEAPON <b>+${u.upgrades}</b></span>` : ''}` : ''}
        ${u.carry > 0 ? `<span>CARRYING <b>${Math.floor(u.carry)} ${u.carryRes}</b></span>` : ''}
      </div>
      ${u.isHero ? `<div class="hint">Heroes take no orders. Raise a <b>flag</b> near what you want done and pay enough to tempt them.</div>` : ''}
      ${u.kind === 'peasant' ? `<div class="hint">Tap a <b>gold mine</b>, <b>quarry</b> or <b>forest</b> to assign this worker.</div>` : ''}
      <div class="acts">
        <button class="btn small ${following ? 'danger' : 'primary'}" data-act="follow">${following ? 'Stop following' : 'Follow'}</button>
        <button class="btn small" data-act="center">Centre</button>
        ${u.kind === 'peasant' ? `<button class="btn small" data-act="allpeasants">Select all peasants</button>` : ''}
        ${u.kind === 'peasant' && u.job ? `<button class="btn small" data-act="unassign">Stop work</button>` : ''}
        <button class="btn small" data-act="clear">Close</button>
      </div>`;
    el.querySelector('.pic').replaceWith(spriteEl(unitSprite(u.sprite, 0, 1), 16, 16, 36));
    this.wireSelActions(el, u);
  }

  renderBuildingPanel(el, b) {
    const g = this.game;
    const def = b.def;
    const hpF = clamp(b.hp / b.maxHp, 0, 1);
    let actions = '';
    if (b.complete) {
      if (def.recruit) {
        for (const k of def.recruit) {
          const c = CLASSES[k];
          actions += `<button class="btn small primary" data-recruit="${k}">Hire ${c.name} (${c.cost.gold}g)</button>`;
        }
      }
      if (def.guild) {
        const c = CLASSES[def.guild];
        const alive = g.units.filter(u => !u.dead && u.homeId === b.id).length;
        actions += `<button class="btn small primary" data-recruit="${def.guild}">Hire ${c.name} (${c.cost.gold}g) ${alive}/${def.maxHeroes}</button>`;
      }
    }
    el.innerHTML = `
      <div class="sel-head">
        <span class="pic"></span>
        <div class="grow">
          <h3>${def.name}</h3>
          <div class="meta">${b.complete ? 'operational' : `under construction ${Math.round(b.progress * 100)}%`}</div>
          <div class="hp"><i class="${hpF > 0.5 ? '' : hpF > 0.25 ? 'mid' : 'low'}" style="width:${hpF * 100}%"></i></div>
        </div>
      </div>
      <div class="statline">
        <span>HP <b>${Math.ceil(b.hp)}/${b.maxHp}</b></span>
        ${def.pop ? `<span>POP <b>+${def.pop}</b></span>` : ''}
        ${def.tax ? `<span>TAX <b>+${def.tax}</b></span>` : ''}
        ${def.guild ? `<span>HEROES <b>${g.units.filter(u => !u.dead && u.homeId === b.id).length}/${def.maxHeroes}</b></span>` : ''}
      </div>
      <div class="hint">${def.desc}</div>
      <div class="acts">${actions}
        <button class="btn small" data-act="center">Centre</button>
        ${!b.complete ? `<button class="btn small" data-act="sendbuilders">Send builders</button>` : ''}
        <button class="btn small" data-act="clear">Close</button>
      </div>`;
    el.querySelector('.pic').replaceWith(buildIcon(b.defId));
    this.wireSelActions(el, b);
  }

  renderLairPanel(el, l) {
    const m = MONSTERS[l.def.spawn];
    el.innerHTML = `
      <div class="sel-head">
        <span class="pic"></span>
        <div class="grow">
          <h3>${l.name}</h3>
          <div class="meta">spawns ${m.name} &middot; ${l.spawned.filter(x => !x.dead).length}/${l.def.max} out</div>
          <div class="hp"><i class="low" style="width:${(l.hp / l.maxHp) * 100}%"></i></div>
        </div>
      </div>
      <div class="statline"><span>HP <b>${Math.ceil(l.hp)}/${l.maxHp}</b></span>
      <span>BOUNTY <b>${l.def.reward}g</b></span></div>
      <div class="hint">${m.desc} Destroy every lair to win. Raise an <b>attack flag</b> here and your heroes will come.</div>
      <div class="acts">
        <button class="btn small primary" data-act="flaghere">Attack flag here</button>
        <button class="btn small" data-act="center">Centre</button>
        <button class="btn small" data-act="clear">Close</button>
      </div>`;
    el.querySelector('.pic').replaceWith(spriteEl(propSprite(l.def.prop), 32, 32, 34));
    this.wireSelActions(el, l);
  }

  renderNodePanel(el, n) {
    const g = this.game;
    const info = RES_RATE[n.kind];
    const label = n.kind === 'goldmine' ? 'Gold Mine' : n.kind === 'quarry' ? 'Stone Quarry' : 'Woodland';
    const workers = g.units.filter(u => !u.dead && u.job && u.job.type === 'harvest' && u.job.node === n);
    const idle = g.units.filter(u => !u.dead && u.kind === 'peasant' && !u.job).length;
    el.innerHTML = `
      <div class="sel-head">
        <span class="pic"></span>
        <div class="grow">
          <h3>${label}</h3>
          <div class="meta">yields ${info.res} &middot; ${Math.ceil(n.amount)} left</div>
          <div class="hp"><i style="width:${(n.amount / n.max) * 100}%"></i></div>
        </div>
      </div>
      <div class="statline"><span>WORKERS <b>${workers.length}</b></span><span>IDLE PEASANTS <b>${idle}</b></span></div>
      <div class="hint">Send peasants here and they will haul ${info.res} back to the nearest depot.</div>
      <div class="acts">
        <button class="btn small primary" data-send="1">Send 1</button>
        <button class="btn small primary" data-send="3">Send 3</button>
        <button class="btn small primary" data-send="99">Send all idle</button>
        ${workers.length ? `<button class="btn small" data-act="recall">Recall</button>` : ''}
        <button class="btn small" data-act="clear">Close</button>
      </div>`;
    el.querySelector('.pic').replaceWith(spriteEl(propSprite(n.kind, n.v || 0), 32, 32, 34));
    this.wireSelActions(el, n);
  }

  renderFlagPanel(el, f) {
    const def = FLAGS[f.type];
    const interested = this.game.units.filter(u => u.flagId === f.id).length;
    el.innerHTML = `
      <div class="sel-head">
        <span class="pic"></span>
        <div class="grow">
          <h3>${def.name}</h3>
          <div class="meta">${f.bounty ? `${Math.round(f.bounty - f.paid)} gold still offered` : 'no reward'}</div>
        </div>
      </div>
      <div class="statline"><span>HEROES ON IT <b>${interested}</b></span></div>
      <div class="hint">${def.desc}</div>
      <div class="acts">
        ${f.bounty ? `<button class="btn small primary" data-act="raise">Raise bounty +${def.presets[1]}</button>` : ''}
        <button class="btn small danger" data-act="removeflag">Withdraw</button>
        <button class="btn small" data-act="clear">Close</button>
      </div>`;
    el.querySelector('.pic').replaceWith(spriteEl(flagSprite(f.type, 0), 16, 20, 34));
    this.wireSelActions(el, f);
  }

  wireSelActions(el, e) {
    const g = this.game;
    el.querySelectorAll('[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.audio.play('ui');
        switch (btn.dataset.act) {
          case 'clear': this.setSelection([]); break;
          case 'center': this.stopFollow(); this.r.centerOn(e.x, e.y); break;
          case 'follow':
            if (this.r.follow === e) this.stopFollow();
            else this.startFollow(e);
            break;
          case 'idle': this.selectIdlePeasants(); break;
          case 'allpeasants': this.selectAllPeasants(); break;
          case 'unassign':
            if (e.job && e.job.type === 'build' && e.job.site) e.job.site.builders--;
            e.job = null; e.state = 'idle'; this.renderSelection();
            break;
          case 'recall':
            for (const u of g.units) if (u.job && u.job.node === e) u.job = null;
            this.renderSelection();
            break;
          case 'sendbuilders': {
            const peas = g.units.filter(u => !u.dead && u.kind === 'peasant' && (!u.job || u.job.type !== 'build'))
              .sort((a, c) => dist(a.x, a.y, e.x, e.y) - dist(c.x, c.y, e.x, e.y)).slice(0, 3);
            for (const p of peas) { p.job = { type: 'build', site: e }; e.builders++; }
            this.notify(`${peas.length} peasants sent to build`);
            break;
          }
          case 'flaghere':
            this.startPlaceFlag('attack', FLAGS.attack.presets[1]);
            this.doPlace(e.tx, e.ty);
            break;
          case 'raise': {
            const add = FLAGS[e.type].presets[1];
            if (g.res.gold < add) { this.notify('Not enough gold', 'bad'); break; }
            g.res.gold -= add; g.reserved += add; e.bounty += add;
            this.notify(`Bounty raised to ${Math.round(e.bounty)} gold`);
            this.renderSelection();
            break;
          }
          case 'removeflag': g.removeFlag(e); this.setSelection([]); break;
        }
      });
    });
    el.querySelectorAll('[data-recruit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const u = g.recruit(e, btn.dataset.recruit);
        if (u) { this.renderSelection(); this.renderTopbar(); }
      });
    });
    el.querySelectorAll('[data-send]').forEach(btn => {
      btn.addEventListener('click', () => {
        const want = +btn.dataset.send;
        const idle = g.units
          .filter(u => !u.dead && u.kind === 'peasant' && (!u.job || u.job.type === 'build'))
          .sort((a, c) => dist(a.x, a.y, toPx(e.tx), toPx(e.ty)) - dist(c.x, c.y, toPx(e.tx), toPx(e.ty)));
        const pick = idle.slice(0, want);
        if (!pick.length) { this.notify('No peasants free — hire more at the City Centre', 'bad'); return; }
        g.assignWorkers(pick, e);
        this.renderSelection();
      });
    });
  }

  // ---------------------------------------------------------------
  // drawer: build / flags / realm
  // ---------------------------------------------------------------
  openDrawer(tab) {
    if (this.tab === tab) return this.closeDrawer();
    this.tab = tab;
    $('#drawer').hidden = false;
    $('#selpanel').hidden = true;
    for (const b of document.querySelectorAll('.cmd[data-tab]')) b.classList.toggle('on', b.dataset.tab === tab);
    $('#drawer-title').textContent = tab === 'build' ? 'Build' : tab === 'flags' ? 'Reward Flags' : 'Realm';
    this.renderDrawer();
  }
  closeDrawer() {
    this.tab = null;
    $('#drawer').hidden = true;
    for (const b of document.querySelectorAll('.cmd[data-tab]')) b.classList.remove('on');
    this.renderSelection();
  }

  renderDrawer() {
    if (!this.tab) return;
    const body = $('#drawer-body');
    if (this.tab === 'build') this.renderBuild(body);
    else if (this.tab === 'flags') this.renderFlags(body);
    else this.renderRealm(body);
  }

  renderBuild(body) {
    const g = this.game;
    body.innerHTML = `<div class="grid"></div>
      <div class="hint">Lay a site and peasants will construct it. You need <b>peasants</b> for everything &mdash; hire them at the City Centre.</div>`;
    const grid = body.querySelector('.grid');
    for (const id of BUILD_ORDER) {
      const def = BUILDINGS[id];
      const ok = g.unlocked(id);
      const card = document.createElement('button');
      card.className = 'card' + (ok ? '' : ' locked');
      card.innerHTML = `<span class="pic"></span><span class="grow">
        <b class="cn">${def.name}</b>
        <span class="cc">${ok ? costText(def.cost, g) : 'needs ' + BUILDINGS[def.needs[0]].name}</span>
        <span class="cd">${def.desc}</span></span>`;
      card.querySelector('.pic').replaceWith(buildIcon(id));
      card.addEventListener('click', () => {
        this.audio.play('ui');
        if (!ok) { this.notify(`Requires ${BUILDINGS[def.needs[0]].name}`, 'bad'); return; }
        if (!g.canAfford(def.cost)) { this.notify('Not enough resources', 'bad'); return; }
        this.startPlaceBuilding(id);
      });
      grid.appendChild(card);
    }
  }

  renderFlags(body) {
    const g = this.game;
    body.innerHTML = `
      <div class="hint">Heroes cannot be ordered about. Put money on a spot and the greedy ones will go. Gold is held in escrow until the job is done, and refunded if you withdraw the flag.</div>
      <div class="grid"></div>`;
    const grid = body.querySelector('.grid');
    for (const key of ['attack', 'explore', 'defend', 'fear']) {
      const def = FLAGS[key];
      const card = document.createElement('div');
      card.className = 'card';
      card.style.flexDirection = 'column';
      const cur = this.flagBounty[key] ?? def.presets[Math.min(1, def.presets.length - 1)];
      card.innerHTML = `
        <div style="display:flex;gap:6px;align-items:center;width:100%">
          <span class="pic"></span>
          <span class="grow"><b class="cn">${def.name}</b><span class="cd">${def.desc}</span></span>
        </div>
        ${key === 'fear' ? '' : `<div class="seg">${def.presets.map(p =>
        `<button data-b="${p}" class="${p === cur ? 'on' : ''}">${p}g</button>`).join('')}</div>`}
        <button class="btn small primary" data-place style="width:100%">Place flag</button>`;
      card.querySelector('.pic').replaceWith(spriteEl(flagSprite(key, 0), 16, 20, 30));
      card.querySelectorAll('[data-b]').forEach(b => b.addEventListener('click', () => {
        this.flagBounty[key] = +b.dataset.b;
        card.querySelectorAll('[data-b]').forEach(x => x.classList.toggle('on', x === b));
        this.audio.play('ui');
      }));
      card.querySelector('[data-place]').addEventListener('click', () => {
        this.audio.play('ui');
        this.startPlaceFlag(key, key === 'fear' ? 0 : (this.flagBounty[key] ?? cur));
      });
      grid.appendChild(card);
    }
  }

  renderRealm(body) {
    const g = this.game;
    const heroes = g.units.filter(u => !u.dead && u.isHero);
    const guards = g.units.filter(u => !u.dead && u.kind === 'guard');
    const peasants = g.units.filter(u => !u.dead && u.kind === 'peasant');
    const working = peasants.filter(p => p.job).length;
    const lairsLeft = g.lairs.filter(l => !l.dead).length;

    let html = `<div class="hint">Day <b>${g.day}</b> &middot; lairs remaining <b>${lairsLeft}</b> &middot;
      monsters slain <b>${g.stats.kills}</b> &middot; gold escrowed in flags <b>${Math.round(g.reserved)}</b></div>`;

    html += `<div class="row"><div class="grow"><span class="nm">Peasants</span>
      <span class="sub">${peasants.length} total &middot; ${working} working &middot; ${peasants.length - working} idle</span></div>
      <button class="btn small" data-act="selidle">Idle</button>
      <button class="btn small" data-act="selall">All</button></div>`;

    if (!heroes.length) {
      html += `<div class="hint">No heroes yet. Build a <b>Warriors Guild</b> or <b>Rangers Guild</b>, then hire from it.</div>`;
    }
    for (const h of heroes) {
      const f = clamp(h.hp / h.maxHpNow, 0, 1);
      html += `<div class="row" data-focus="${h.id}"><span class="pic" data-unit="${h.sprite}"></span>
        <div class="grow"><span class="nm">${h.name} <span style="color:var(--gold)">L${h.level}</span></span>
        <span class="sub">${h.title} &middot; ${h.state}${h.goalKind ? ' (' + h.goalKind + ')' : ''} &middot; ${Math.floor(h.gold)}g</span>
        <span class="hp"><i class="${f > .5 ? '' : f > .25 ? 'mid' : 'low'}" style="width:${f * 100}%"></i></span></div></div>`;
    }
    if (guards.length) {
      html += `<div class="row"><div class="grow"><span class="nm">Guards</span>
        <span class="sub">${guards.length} on duty</span></div></div>`;
    }
    if (g.graves.length) {
      html += `<div class="hint" style="margin-top:6px">Fallen heroes. Raising one restores its level and gear.</div>`;
      g.graves.forEach((gr, i) => {
        const temple = g.buildings.some(b => !b.dead && b.complete && b.defId === 'temple');
        const price = Math.round(CLASSES[gr.kind].cost.gold * RESURRECT_COST * (temple ? 0.5 : 1));
        html += `<div class="row"><span class="pic" data-unit="${gr.kind}"></span>
          <div class="grow"><span class="nm">${gr.name}</span><span class="sub">${CLASSES[gr.kind].name} &middot; level ${gr.level}</span></div>
          <button class="btn small primary" data-raise="${i}">Raise ${price}g</button></div>`;
      });
    }
    html += `<div class="hint" style="margin-top:8px">
      <b>How this works.</b> Peasants obey you. Heroes do not &mdash; they chase bounties, loot and shiny swords.
      Build shops so they spend their gold at home; you tax every purchase.</div>`;

    body.innerHTML = html;
    body.querySelectorAll('[data-unit]').forEach(s => s.replaceWith(unitIcon(s.dataset.unit)));
    body.querySelectorAll('[data-focus]').forEach(row => row.addEventListener('click', () => {
      const h = g.units.find(u => u.id === +row.dataset.focus);
      if (h) { this.setSelection([h]); this.closeDrawer(); this.startFollow(h); }
    }));
    body.querySelectorAll('[data-raise]').forEach(b => b.addEventListener('click', () => {
      g.resurrect(+b.dataset.raise);
      this.renderDrawer();
    }));
    body.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.act === 'selidle') this.selectIdlePeasants();
      if (b.dataset.act === 'selall') this.selectAllPeasants();
      this.closeDrawer();
    }));
  }

  // ---------------------------------------------------------------
  // placement mode
  // ---------------------------------------------------------------
  startPlaceBuilding(defId) {
    this.game.placing = { type: 'building', defId };
    this.closeDrawer();
    $('#placebar').hidden = false;
    $('#placemsg').innerHTML = `Tap the map to place <b>${BUILDINGS[defId].name}</b>`;
    $('#selpanel').hidden = true;
  }
  startPlaceFlag(type, bounty) {
    this.game.placing = { type: 'flag', flagType: type, bounty };
    this.closeDrawer();
    $('#placebar').hidden = false;
    $('#placemsg').innerHTML = `Tap the map to raise the <b>${FLAGS[type].name}</b>${bounty ? ` (${bounty}g)` : ''}`;
    $('#selpanel').hidden = true;
  }
  cancelPlace() {
    this.game.placing = null;
    $('#placebar').hidden = true;
    this.renderSelection();
  }
  doPlace(tx, ty) {
    const g = this.game, p = g.placing;
    if (!p) return;
    if (p.type === 'building') {
      const b = g.placeBuilding(p.defId, tx, ty);
      if (b) { this.cancelPlace(); this.renderTopbar(); }
    } else {
      const f = g.placeFlag(p.flagType, toPx(tx), toPx(ty), p.bounty);
      if (f) { this.cancelPlace(); this.renderTopbar(); }
    }
  }

  // ---------------------------------------------------------------
  // chrome
  // ---------------------------------------------------------------
  renderTopbar() {
    const g = this.game;
    $('#r-gold').textContent = fmt(g.res.gold);
    $('#r-wood').textContent = fmt(g.res.wood);
    $('#r-stone').textContent = fmt(g.res.stone);
    $('#r-pop').textContent = `${g.pop}/${g.popCap}`;
    $('#r-day').textContent = g.day;
    const esc = Math.round(g.reserved);
    const d = $('#r-gold-d');
    d.textContent = esc > 0 ? `(${esc})` : '';
    d.className = '';
  }

  notify(msg, tone = '') {
    const box = $('#alerts');
    const el = document.createElement('div');
    el.className = 'alert ' + tone;
    el.textContent = msg;
    box.appendChild(el);
    // trim old alerts only -- the follow chip and alarm button live here too
    let alerts = box.querySelectorAll('.alert');
    while (alerts.length > 4) {
      alerts[0].remove();
      alerts = box.querySelectorAll('.alert');
    }
    setTimeout(() => { el.classList.add('fade'); setTimeout(() => el.remove(), 600); }, 2800);
  }

  showModal(html, actions) {
    const m = $('#modal'), box = $('#modalbox');
    box.innerHTML = html + `<div class="modal-acts"></div>`;
    const acts = box.querySelector('.modal-acts');
    for (const a of actions) {
      const b = document.createElement('button');
      b.className = 'btn ' + (a.cls || '');
      b.textContent = a.label;
      b.addEventListener('click', () => { this.audio.play('ui'); a.fn(); });
      acts.appendChild(b);
    }
    m.hidden = false;
  }
  hideModal() { $('#modal').hidden = true; }

  showMenu() {
    const g = this.game;
    this.showModal(`
      <h2>Realm of Majesty</h2>
      <p><b>You are the sovereign, not the general.</b> Peasants obey you directly. Heroes never do &mdash; they
      wander, loot and pick their own fights. To steer them you raise <b>reward flags</b> and put gold on them.</p>
      <p><b>Workers.</b> Tap a peasant (or a gold mine, quarry or forest) and use <b>Send</b> to put them to work.
      They haul to the nearest depot &mdash; the City Centre, a Lumberyard or a Mining Camp.</p>
      <p><b>Money.</b> Taxes tick in from your buildings, mines feed the treasury, and heroes hand their
      loot straight back when they shop at your Marketplace, Blacksmith and Inn.</p>
      <p><b>Goal.</b> Destroy every monster lair. Lose your City Centre and the realm falls.</p>
      <p><b>Camera.</b> Drag to pan, pinch to zoom, or tap <b>Zoom</b> for Close / Mid / Far / Wide.
      Tap the corner map to open the full realm and jump anywhere. Select a unit and hit
      <b>Follow</b> to have the camera track it.</p>
      <p>Seed <b>${g.seed}</b> &middot; day <b>${g.day}</b> &middot; lairs left <b>${g.lairs.filter(l => !l.dead).length}</b></p>`,
      [
        { label: this.audio.muted ? 'Sound: off' : 'Sound: on', fn: () => { this.audio.toggleMute(); this.hideModal(); this.showMenu(); } },
        { label: this.audio.musicOn ? 'Music: on' : 'Music: off', fn: () => { this.audio.toggleMusic(); this.hideModal(); this.showMenu(); } },
        { label: g.paused ? 'Resume' : 'Pause', fn: () => { g.paused = !g.paused; this.hideModal(); } },
        { label: 'New realm', cls: 'danger', fn: () => { location.search = '?seed=' + ((Math.random() * 1e9) | 0); } },
        { label: 'Close', cls: 'primary', fn: () => this.hideModal() }
      ]);
  }

  showEnd(result) {
    const g = this.game;
    const win = result === 'win';
    this.showModal(`
      <h2>${win ? 'The realm is at peace' : 'The realm has fallen'}</h2>
      <p>${win
        ? 'Every lair is rubble, every road is safe, and your heroes are insufferable about it.'
        : 'Your City Centre is ash. The heroes, predictably, were somewhere else.'}</p>
      <p>Days survived <b>${g.day}</b><br>
      Monsters slain <b>${g.stats.kills}</b><br>
      Lairs destroyed <b>${g.stats.lairsCleared}</b><br>
      Heroes lost <b>${g.stats.heroesLost}</b><br>
      Gold earned <b>${Math.round(g.stats.goldEarned)}</b></p>`,
      [{ label: 'New realm', cls: 'primary', fn: () => { location.search = '?seed=' + ((Math.random() * 1e9) | 0); } },
      { label: 'Keep looking', fn: () => this.hideModal() }]);
  }

  // ---------------------------------------------------------------
  update(dt) {
    this.refreshIn -= dt;
    if (this.refreshIn <= 0) {
      this.refreshIn = 0.35;
      this.renderTopbar();
      if (this.game.selection.length) this.renderSelection();
      if (this.tab === 'kingdom') this.renderRealm($('#drawer-body'));
    }
    // a fresh attack puts a jump-to-trouble button on screen
    const a = this.game.alertAt;
    const live = a && this.game.time - a.t < 12;
    if (live !== this.alarmShown) {
      this.alarmShown = live;
      let btn = document.getElementById('alarm');
      if (live && !btn) {
        btn = document.createElement('button');
        btn.id = 'alarm';
        btn.className = 'btn small danger';
        btn.textContent = 'Town under attack \u2192';
        btn.addEventListener('click', () => {
          const at = this.game.alertAt;
          if (at) this.r.centerOn(at.x, at.y);
          this.audio.play('ui');
        });
        document.getElementById('alerts').appendChild(btn);
      } else if (!live && btn) btn.remove();
    }

    // drain simulation notices into the alert stack
    while (this.game.notices.length) {
      const n = this.game.notices.shift();
      this.notify(n.msg, n.tone);
    }
    if (this.game.over && !this.endShown) {
      this.endShown = true;
      this.showEnd(this.game.over);
    }
  }
}
