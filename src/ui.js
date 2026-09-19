// ===================================================================
// ui.js — DOM HUD, pointer input, and every player-facing command.
// Designed thumb-first: one-finger pan, tap to select, big buttons.
// ===================================================================
import { TILE, buildingSprite, unitSprite, propSprite, flagSprite, makeCanvas, PAL, hasSpecSprite } from './art.js';
import {
  BUILDINGS, BUILD_ORDER, CLASSES, FLAGS, MONSTERS, LAIRS, RES_RATE, RESURRECT_COST,
  MISSIONS, MISSION_ORDER, CALLING_ORDER, STATS, STAT_ORDER, MAX_LEVEL,
  STANCES, STANCE_ORDER, SPECS, SPEC_LEVEL, ABILITIES,
  MARKET_SLOTS,
  GUILD_TIERS, FORTIFY, DRAGON,
} from './data.js';
import { toTile, toPx } from './world.js';
import { campAssessment } from './brains.js';
import {
  SLOT_KEYS, SLOTS, slotOf, describe, tierColour, TIERS, canUse, scoreFor
} from './items.js';
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

/** Everything above the baseline of 5: class, rank and specialisation. */
function earned(u, k) {
  return (u.classBonus ? u.classBonus[k] : 0) + u.levelBonus
    + (u.specBonus ? u.specBonus[k] : 0);
}

function attrBlock(u) {
  const st = u.stats;
  return `<div class="attrs" data-live="attrs">` + STAT_ORDER.map(k => {
    const s = STATS[k];
    const bonus = earned(u, k);
    return `<div class="attr" style="--as:${s.colour}"
      title="${s.name}: ${s.desc}${bonus ? ` (${bonus} earned above the baseline of 5)` : ''}">
      <b>${st[k]}${bonus ? `<i>+${bonus}</i>` : ''}</b><span>${s.short}</span></div>`;
  }).join('') + `</div>`;
}

/** The one permanent choice: which kind of soldier they become at the cap. */
function specBlock(u) {
  const list = SPECS[u.kind];
  if (!list) return '';
  if (u.spec) {
    const sp = u.specDef, ab = u.ability;
    const c = u.maxCharge ? Math.round((u.charge / u.maxCharge) * 100) : 0;
    const pw = u.chargeDef;
    return `<div class="spec chosen" style="--sc:${sp.colour}">
      <div class="head">${sp.name.toUpperCase()}</div>
      <div class="sdesc">${sp.desc}</div>
      ${pw ? `<div class="trow" data-live="charge">
        <span class="tn">${pw.name} <i>${ab ? ab.name : ''}</i></span>
        <span class="tbar" style="--tc:${pw.colour}"><i style="width:${c}%"></i></span>
        <span class="tp">${Math.round(u.charge)}</span>
      </div>` : ''}
      ${ab ? `<div class="sdesc"><b>${ab.name}</b> &mdash; ${ab.desc}
        <i>(${ab.cost} ${pw ? pw.name.toLowerCase() : ''})</i></div>` : ''}
    </div>`;
  }
  if (!u.canSpec) {
    return `<div class="spec locked"><div class="head">SPECIALISATION</div>
      <div class="sdesc">Chosen at level ${SPEC_LEVEL}. ${list.map(sp => sp.name).join(', ')}.</div></div>`;
  }
  return `<div class="spec offer">
    <div class="head">CHOOSE A SPECIALISATION &mdash; this is permanent</div>
    ${list.map(sp => `<button class="specbtn" data-spec="${sp.id}" style="--sc:${sp.colour}">
      <span class="sprow"><span class="pic" data-unit="${hasSpecSprite(u.kind, sp.id) ? `${u.kind}/${sp.id}` : u.kind}"></span><b>${sp.name}</b></span>
      <span class="bon">${STAT_ORDER.filter(k => sp.bonus[k])
        .map(k => `+${sp.bonus[k]} ${STATS[k].short}`).join(' &middot; ')}</span>
      <span class="sdesc">${sp.desc}</span>
      <span class="sdesc ab">${ABILITIES[sp.ability].name}: ${ABILITIES[sp.ability].desc}</span>
    </button>`).join('')}
  </div>`;
}

/**
 * The five shelves. Heroes come here on their own and spend their own gold --
 * you get a cut of every deal in both directions -- so this is a window on
 * the trade rather than a shop you operate.
 */
function marketBlock(b) {
  const stock = b.stock || [];
  const rows = [];
  for (let i = 0; i < MARKET_SLOTS; i++) {
    const it = stock[i];
    rows.push(`<div class="gearrow ${it ? '' : 'empty'}">
      <span class="gslot">${i + 1}</span>
      <span class="grow2">${it
        ? itemLine(it, `<span class="iprice">${it.value}g</span>`)
        : '<span class="istat">empty &mdash; something will turn up</span>'}</span>
    </div>`);
  }
  return `<div class="gear" data-live="market">
    <div class="head">SHELVES &mdash; heroes buy and sell here themselves</div>
    ${rows.join('')}</div>`;
}

/** One line of loot: what it is, what it gives, and what it is worth. */
function itemLine(it, extra = '') {
  if (!it) return '';
  const t = TIERS[it.tier];
  return `<span class="iname" style="--ic:${t.colour}">${it.name}</span>
    <span class="istat">${describe(it)}</span>
    ${it.flavour ? `<span class="iflav">&ldquo;${it.flavour}&rdquo;</span>` : ''}
    ${extra}`;
}

/** Everything a hero is wearing, plus whatever they are hauling to market. */
function gearBlock(u) {
  const rows = SLOT_KEYS.map(k => {
    const it = u.gear[k];
    const label = SLOTS[slotOf(k)].name;
    return `<div class="gearrow ${it ? '' : 'empty'}">
      <span class="gslot">${label}</span>
      <span class="grow2">${it ? itemLine(it) : '<span class="istat">empty</span>'}</span>
    </div>`;
  }).join('');
  const bag = u.bag && u.bag.length
    ? `<div class="gearrow bag"><span class="gslot">Bag</span><span class="grow2">
        ${u.bag.map(it => `<span class="iname" style="--ic:${tierColour(it)}">${it.name}</span>`).join(', ')}
        <span class="istat">carried to market</span></span></div>`
    : '';
  return `<div class="gear" data-live="gear">
    <div class="head">EQUIPMENT</div>${rows}${bag}</div>`;
}

/** What a soldier does when nothing is shouting at them. */
function stancePicker(current) {
  return `<div class="missions stances">` + STANCE_ORDER.map(id => {
    const st = STANCES[id];
    return `<button class="btn small mbtn ${current === id ? 'on' : ''}"
      style="--mc:${st.colour}" data-stance="${id}">${st.short}</button>`;
  }).join('') + `</div>`;
}

/**
 * The row of calling buttons. Only the work callings: soldier classes are
 * hired at their guild rather than grown out of a villager, so they are not
 * something you can set anybody to.
 */
function missionPicker(currentId) {
  const ids = CALLING_ORDER.filter(id => !MISSIONS[id].becomes);
  return `<div class="missions">` + ids.map(id => {
    const m = MISSIONS[id];
    return `<button class="btn small mbtn ${currentId === id ? 'on' : ''}"
      style="--mc:${m.colour}" data-mission="${id}">${m.short}</button>`;
  }).join('') + `</div>`;
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
    this.touchedAt = performance.now();
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
    this.touchedAt = performance.now();
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
    if (e.key === 'b' || e.key === 'B') this.openDrawer('peasants');
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
    // woodland is a node in its own right now
    const pi = w.propAt[w.idx(tx, ty)];
    if (pi >= 0 && w.seen(tx, ty)) {
      const p = w.props[pi];
      if (p.kindClass === 'node' && !p.removed && p.amount > 0) return p;
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
    this.renderSelection(true);
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

  /**
   * What the selection panel's *buttons* depend on. Numbers that tick along
   * (health, carried gold) are deliberately absent: they get refreshed in
   * place instead, because replacing the panel's DOM mid-tap eats the tap.
   */
  selectionSignature() {
    const sel = this.game.selection;
    return sel.length + '|' + sel.map(e => [
      e.stock ? e.stock.map(i => i.id).join('.') : '-',
      e.id, e.kindClass, e.kind || e.defId || e.type,
      e.mission, e.complete, e.amount > 0, this.r.follow === e,
      e.spec || '-', e.canSpec ? 'y' : 'n',
      e.gear ? SLOT_KEYS.map(k => (e.gear[k] ? e.gear[k].id : 0)).join('.') : '-',
      e.bag ? e.bag.length : 0
    ].join(',')).join(';');
  }

  renderSelection(force = false) {
    const g = this.game;
    const el = $('#selpanel');
    const sel = g.selection;
    if (!sel.length || g.placing) { el.hidden = true; this.selSig = null; return; }
    el.hidden = false;

    // Same controls as last time? Just freshen the numbers.
    const sig = this.selectionSignature();
    if (!force && sig === this.selSig) { if (this.selRefresh) this.selRefresh(); return; }
    this.selSig = sig;
    this.selRefresh = null;

    if (sel.length > 1) {
      const peasants = sel.filter(u => u.kind === 'peasant' || u.isHero);
      const shared = peasants.length && peasants.every(p => p.mission === peasants[0].mission)
        ? peasants[0].mission : null;
      el.innerHTML = `
        <div class="sel-head"><div><h3>${sel.length} selected</h3>
        <div class="meta">${peasants.length} peasant${peasants.length === 1 ? '' : 's'}</div></div></div>
        ${peasants.length ? missionPicker(shared) : ''}
        <div class="hint">Or tap a <b>mine</b>, <b>quarry</b> or <b>tree</b> to start them there.</div>
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

  unitJobText(u) {
    // what is on their back beats what they are heading toward
    if (u.state === 'deliver' && u.carry > 0 && u.carryRes) return `hauling ${u.carryRes}`;
    if (u.state === 'defend') return 'fighting back';
    if (u.state === 'rescue') return 'to the rescue';
    if (u.state === 'guard') return 'on watch';
    if (u.state === 'mend') return 'going to the wounded';
    if (u.state === 'follow') return 'keeping station';
    if (u.state === 'heal') return 'tending the hurt';
    if (u.state === 'bless') return 'blessing the faithful';
    if (u.state === 'stalk') return 'melting away';
    if (u.state === 'rally') return u.warName ? `massing on ${u.warName}` : 'massing for an assault';
    if (u.job && u.job.type === 'build') return 'building';
    if (u.job && u.job.type === 'harvest' && u.job.node) {
      const k = u.job.node.kind;
      return `${u.state === 'deliver' ? 'hauling' : 'working'} ${k === 'goldmine' ? 'gold' : k === 'quarry' ? 'stone' : 'wood'}`;
    }
    if (u.job && u.job.type === 'build') return 'building';
    return u.state;
  }

  renderUnitPanel(el, u) {
    const g = this.game;
    const following = this.r.follow === u;
    const hpF = clamp(u.hp / u.maxHpNow, 0, 1);
    const cls = hpF > 0.5 ? '' : hpF > 0.25 ? 'mid' : 'low';
    const job = this.unitJobText(u);
    const isMine = u.faction === 'realm';
    el.innerHTML = `
      <div class="sel-head">
        <span class="pic"></span>
        <div class="grow">
          <h3>${u.name}</h3>
          <div class="meta" data-live="meta">${u.title}${u.isHero ? ` &middot; level ${u.level}/${MAX_LEVEL}` : ''} &middot; ${job}</div>
          <div class="hp"><i data-live="hp" class="${cls}" style="width:${hpF * 100}%"></i></div>
        </div>
      </div>
      ${attrBlock(u)}
      <div class="statline" data-live="stats">
        <span>HP <b>${Math.ceil(u.hp)}/${u.maxHpNow}</b></span>
        <span>DMG <b>${u.power.toFixed(1)}</b></span>
        <span>MANA <b>${u.isCaster ? Math.round(u.mana) + '/' : ''}${u.maxMana}</b></span>
        <span>CRIT <b>${Math.round(u.critChance * 100)}%</b></span>
        ${u.isHero ? `<span>GOLD <b>${Math.floor(u.gold)}</b></span>
        <span>XP <b>${Math.floor(u.xp)}</b></span>
        <span>KILLS <b>${u.kills}</b></span>
        ${u.potions ? `<span>POTIONS <b>${u.potions}</b></span>` : ''}
        ${u.upgrades ? `<span>WEAPON <b>+${u.upgrades}</b></span>` : ''}` : ''}
        ${u.carry > 0 ? `<span>CARRYING <b>${Math.floor(u.carry)} ${u.carryRes}</b></span>` : ''}
      </div>
      ${isMine && u.kind === 'peasant' ? missionPicker(u.mission) : ''}
      ${u.isHero ? `${specBlock(u)}${gearBlock(u)}${stancePicker(u.stance)}` : ''}
      <div class="acts">
        <button class="btn small ${following ? 'danger' : 'primary'}" data-act="follow">${following ? 'Stop following' : 'Follow'}</button>
        <button class="btn small" data-act="center">Centre</button>
        <button class="btn small" data-act="clear">Close</button>
      </div>
      ${u.isHero ? `<div class="hint">${STANCES[u.stance].desc} They still take no orders &mdash;
        raise a <b>flag</b> and pay enough to tempt them.</div>` : ''}
      ${u.kind === 'peasant' ? `<div class="hint">${MISSIONS[u.mission].desc}</div>` : ''}
`;
    el.querySelector('.pic').replaceWith(spriteEl(unitSprite(u.sprite, 0, 1), 16, 16, 36));
    // the picker shows what each choice will look like on the map
    el.querySelectorAll('.specbtn [data-unit]').forEach(s => s.replaceWith(unitIcon(s.dataset.unit)));
    this.wireSelActions(el, u);
    // keep the live numbers moving without touching the buttons
    this.selRefresh = () => {
      if (u.dead) { this.renderSelection(true); return; }
      const f = clamp(u.hp / u.maxHpNow, 0, 1);
      const bar = el.querySelector('[data-live="hp"]');
      if (bar) {
        bar.style.width = f * 100 + '%';
        bar.className = f > 0.5 ? '' : f > 0.25 ? 'mid' : 'low';
      }
      const meta = el.querySelector('[data-live="meta"]');
      if (meta) meta.textContent = `${u.title}${u.isHero ? ` · level ${u.level}/${MAX_LEVEL}` : ''} · ${this.unitJobText(u)}`;
      const attrs = el.querySelector('[data-live="attrs"]');
      if (attrs) {
        const st = u.stats;
        STAT_ORDER.forEach((k, i) => {
          const cell = attrs.children[i];
          const bonus = earned(u, k);
          if (cell) cell.querySelector('b').innerHTML = `${st[k]}${bonus ? `<i>+${bonus}</i>` : ''}`;
        });
      }
      const stats = el.querySelector('[data-live="stats"]');
      if (stats) {
        const bits = [`HP <b>${Math.ceil(u.hp)}/${u.maxHpNow}</b>`, `DMG <b>${u.power.toFixed(1)}</b>`,
          `MANA <b>${u.isCaster ? Math.round(u.mana) + '/' : ''}${u.maxMana}</b>`,
          `CRIT <b>${Math.round(u.critChance * 100)}%</b>`];
        if (u.isHero) bits.push(`GOLD <b>${Math.floor(u.gold)}</b>`, `XP <b>${Math.floor(u.xp)}</b>`, `KILLS <b>${u.kills}</b>`);
        if (u.carry > 0) bits.push(`CARRYING <b>${Math.floor(u.carry)} ${u.carryRes}</b>`);
        stats.innerHTML = bits.map(b => `<span>${b}</span>`).join('');
      }
    };
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
        actions += `<button class="btn small primary" data-recruit="${def.guild}">Hire ${c.name} (${c.cost.gold}g) ${g.guildRoll(b, def.guild)}/${b.maxHeroes}</button>`;
        const next = GUILD_TIERS[b.tier];
        if (next) actions += `<button class="btn small" data-act="train" title="${next.desc}">Drill: ${next.name} (${next.cost}g)</button>`;
      }
      if (!b.fortified) actions += `<button class="btn small" data-act="fortify" title="${FORTIFY.desc}">Fortify (${g.fortifyCost(b)}g)</button>`;
    }
    const status = b.complete
      ? ['operational', b.tierDef && b.tierDef.name.toLowerCase(), b.fortified && 'fortified'].filter(Boolean).join(' &middot; ')
      : `under construction ${Math.round(b.progress * 100)}%`;
    el.innerHTML = `
      <div class="sel-head">
        <span class="pic"></span>
        <div class="grow">
          <h3>${def.name}</h3>
          <div class="meta" data-live="meta">${status}</div>
          <div class="hp"><i data-live="hp" class="${hpF > 0.5 ? '' : hpF > 0.25 ? 'mid' : 'low'}" style="width:${hpF * 100}%"></i></div>
        </div>
      </div>
      <div class="statline">
        <span>HP <b>${Math.ceil(b.hp)}/${b.maxHp}</b></span>
        ${def.pop ? `<span>POP <b>+${def.pop}</b></span>` : ''}
        ${def.tax ? `<span>TAX <b>+${def.tax}</b></span>` : ''}
        ${def.guild ? `<span>HEROES <b>${g.units.filter(u => !u.dead && u.homeId === b.id).length}/${b.maxHeroes}</b></span>` : ''}
        ${b.tierDef ? `<span>RECRUITS <b>level ${b.tierDef.level}</b></span>` : ''}
      </div>
      ${def.market ? marketBlock(b) : ''}
      <div class="hint">${def.desc}</div>
      <div class="acts">${actions}
        <button class="btn small" data-act="center">Centre</button>
        ${!b.complete ? `<button class="btn small" data-act="sendbuilders">Send builders</button>` : ''}
        <button class="btn small" data-act="clear">Close</button>
      </div>`;
    el.querySelector('.pic').replaceWith(buildIcon(b.defId));
    this.wireSelActions(el, b);
    this.selRefresh = () => {
      if (b.dead) { this.renderSelection(true); return; }
      const f = clamp(b.hp / b.maxHp, 0, 1);
      const bar = el.querySelector('[data-live="hp"]');
      if (bar) {
        bar.style.width = f * 100 + '%';
        bar.className = f > 0.5 ? '' : f > 0.25 ? 'mid' : 'low';
      }
      const meta = el.querySelector('[data-live="meta"]');
      if (meta) {
        meta.innerHTML = b.complete
          ? ['operational', b.tierDef && b.tierDef.name.toLowerCase(), b.fortified && 'fortified'].filter(Boolean).join(' &middot; ')
          : `under construction ${Math.round(b.progress * 100)}%`;
      }
    };
  }

  renderLairPanel(el, l) {
    const m = MONSTERS[l.def.spawn];
    // What your heroes make of it. They mass before they attack, so the two
    // numbers that matter are how many this needs and how many have declared.
    const a = campAssessment(this.game, l);
    const need = (x) => `${x.need >= 12 ? '12+' : x.need} ${x.need === 1 ? 'sword' : 'swords'}`;
    const who = (x) => (x.here
      ? `<b>${x.here}</b> ${x.here === 1 ? 'hero has' : 'heroes have'} declared for it`
      : 'nobody has declared for it yet');
    const massing = who(a);
    el.innerHTML = `
      <div class="sel-head">
        <span class="pic"></span>
        <div class="grow">
          <h3>${l.name}</h3>
          <div class="meta" data-live="meta">spawns ${m.name} &middot; ${l.spawned.filter(x => !x.dead).length}/${l.def.max} out</div>
          <div class="hp"><i class="low" data-live="hp" style="width:${(l.hp / l.maxHp) * 100}%"></i></div>
        </div>
      </div>
      <div class="statline"><span>HP <b data-live="hpnum">${Math.ceil(l.hp)}/${l.maxHp}</b></span>
      <span>BOUNTY <b>${l.def.reward}g</b></span>
      <span>NEEDS <b data-live="need">${need(a)}</b></span></div>
      <div class="hint">${m.desc} Destroy every lair to win. Your heroes gather before they go in &mdash;
      right now <span data-live="massing">${massing}</span>. A bounty of about <b data-live="price">${a.price}g</b>
      on an attack flag here buys one in on their own, whatever the odds.</div>
      <div class="acts">
        <button class="btn small primary" data-act="flaghere">Attack flag here</button>
        <button class="btn small" data-act="center">Centre</button>
        <button class="btn small" data-act="clear">Close</button>
      </div>`;
    el.querySelector('.pic').replaceWith(spriteEl(propSprite(l.def.prop), 32, 32, 34));
    this.wireSelActions(el, l);
    // The numbers that matter here move on their own -- defenders muster,
    // heroes declare -- so keep them live rather than frozen at tap time.
    this.selRefresh = () => {
      if (l.dead) { this.renderSelection(true); return; }
      const now = campAssessment(this.game, l);
      const f = clamp(l.hp / l.maxHp, 0, 1);
      const set = (k, v) => { const e = el.querySelector(`[data-live="${k}"]`); if (e) e.innerHTML = v; };
      const bar = el.querySelector('[data-live="hp"]');
      if (bar) bar.style.width = f * 100 + '%';
      set('meta', `spawns ${m.name} &middot; ${l.spawned.filter(x => !x.dead).length}/${l.def.max} out`);
      set('hpnum', `${Math.ceil(l.hp)}/${l.maxHp}`);
      set('need', need(now));
      set('massing', who(now));
      set('price', `${now.price}g`);
    };
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
          <div class="meta" data-live="meta">yields ${info.res} &middot; ${Math.ceil(n.amount)} left</div>
          <div class="hp"><i data-live="hp" style="width:${(n.amount / n.max) * 100}%"></i></div>
        </div>
      </div>
      <div class="statline" data-live="stats"><span>WORKERS <b>${workers.length}</b></span><span>IDLE PEASANTS <b>${idle}</b></span></div>
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
    this.selRefresh = () => {
      if (n.amount <= 0 || n.removed) { this.renderSelection(true); return; }
      const meta = el.querySelector('[data-live="meta"]');
      if (meta) meta.innerHTML = `yields ${info.res} &middot; ${Math.ceil(n.amount)} left`;
      const bar = el.querySelector('[data-live="hp"]');
      if (bar) bar.style.width = (n.amount / n.max) * 100 + '%';
      const stats = el.querySelector('[data-live="stats"]');
      if (stats) {
        const w = g.units.filter(u => !u.dead && u.job && u.job.type === 'harvest' && u.job.node === n).length;
        const free = g.units.filter(u => !u.dead && u.kind === 'peasant' && u.mission === 'none').length;
        stats.innerHTML = `<span>WORKERS <b>${w}</b></span><span>IDLE PEASANTS <b>${free}</b></span>`;
      }
    };
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
          case 'train':
            if (g.trainGuild(e)) this.renderSelection(true);
            break;
          case 'fortify':
            if (g.fortify(e)) this.renderSelection(true);
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
    el.querySelectorAll('[data-spec]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (g.chooseSpec(e, btn.dataset.spec)) this.audio.play('order');
        this.renderSelection(true);
      });
    });
    el.querySelectorAll('[data-stance]').forEach(btn => {
      btn.addEventListener('click', () => {
        const heroes = g.selection.filter(x => x.kindClass === 'unit' && x.isHero);
        const targets = heroes.length ? heroes : (e && e.isHero ? [e] : []);
        if (!targets.length) return;
        for (const h of targets) h.stance = btn.dataset.stance;
        this.notify(targets.length === 1
          ? `${targets[0].name} will ${STANCES[btn.dataset.stance].name.toLowerCase()}`
          : `${targets.length} soldiers will ${STANCES[btn.dataset.stance].name.toLowerCase()}`);
        this.audio.play('order');
        this.renderSelection(true);
      });
    });
    el.querySelectorAll('[data-mission]').forEach(btn => {
      btn.addEventListener('click', () => {
        // callings are villagers' work; soldiers are for fighting
        const folk = g.selection.filter(x => x.kindClass === 'unit' && x.kind === 'peasant');
        const targets = folk.length ? folk : (e && e.kind === 'peasant' ? [e] : []);
        if (!targets.length) return;
        g.assignMission(targets, btn.dataset.mission);
        this.renderSelection(true);
        if (this.tab === 'peasants') this.renderDrawer();
        this.renderTopbar();
      });
    });
    el.querySelectorAll('[data-recruit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const u = g.recruit(e, btn.dataset.recruit);
        if (u) { this.renderSelection(true); this.renderTopbar(); }
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
    $('#drawer-title').textContent =
      tab === 'build' ? 'Build' : tab === 'flags' ? 'Reward Flags'
        : tab === 'peasants' ? 'Peasants' : 'Realm';
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
    else if (this.tab === 'peasants') this.renderPeasants(body, true);
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

  /** The Peasants tab: hire, and move people between callings. */
  /** "Miner · working gold" */
  peasantLine(p) {
    return `${MISSIONS[p.mission].name} · ${this.unitJobText(p)}`;
  }

  /** What a guild's roster is up to. */
  troopLine(crew) {
    return crew.length ? this.warriorStatus(crew) : 'nobody under arms';
  }

  /** "2 patrolling, 1 fighting" -- or a nudge if there are none. */
  warriorStatus(list) {
    if (!list.length) return 'nobody under arms';
    const verb = { fight: 'fighting', quest: 'on a flag', explore: 'scouting', flee: 'retreating',
      rest: 'recovering', shop: 'shopping', idle: 'patrolling', walk: 'marching',
      guard: 'on watch', rescue: 'to the rescue', rally: 'massing for an assault' };
    const busy = {};
    for (const w of list) { const v = verb[w.state] || w.state; busy[v] = (busy[v] || 0) + 1; }
    return Object.entries(busy).map(([k, n]) => `${n} ${k}`).join(', ');
  }

  /** "2 working, 1 hauling" -- what a calling's crew is up to right now. */
  missionStatus(crew, m) {
    if (!crew.length) return m.res ? `no one gathering ${m.res}` : 'nobody assigned';
    const verb = { walk: 'walking', harvest: 'working', deliver: 'hauling', build: 'building',
      repair: 'mending', flee: 'fleeing', idle: 'waiting',
      defend: 'fighting', rescue: 'to the rescue' };
    const busy = {};
    for (const p of crew) { const v = verb[p.state] || p.state; busy[v] = (busy[v] || 0) + 1; }
    return Object.entries(busy).map(([k, n]) => `${n} ${k}`).join(', ');
  }

  renderPeasants(body, force = false) {
    const g = this.game;
    const peasants = g.units.filter(u => !u.dead && u.kind === 'peasant');
    const cost = CLASSES.peasant.cost.gold;
    const canHire = g.res.gold >= cost && g.pop < g.popCap;
    const byMission = (id) => peasants.filter(p => p.mission === id);

    // Rebuilding this list every frame would swallow taps on the +/- buttons,
    // so only rebuild when the crew actually changes.
    const sig = peasants.map(p => p.id + ':' + p.mission).join(',') + '|' + canHire
      + '|' + CALLING_ORDER.filter(id => MISSIONS[id].becomes)
        .map(id => g.units.filter(u => !u.dead && u.kind === MISSIONS[id].becomes).length).join('.');
    if (!force && sig === this.peasantSig && this.peasantRefresh) { this.peasantRefresh(); return; }
    this.peasantSig = sig;

    let html = `
      <div class="hint">Tap a name to select that crew. <b>+</b> moves one villager onto that calling.</div>
      <div class="mrow">
        <div class="grow"><span class="nm">Peasants</span>
        <span class="sub">${peasants.length} of ${g.popCap} housed &middot; ${g.res.gold} gold in the treasury</span></div>
        <button class="btn small primary" data-hire ${canHire ? '' : 'disabled'}>Hire ${cost}g</button>
      </div>`;

    for (const id of MISSION_ORDER) {
      const m = MISSIONS[id];
      const crew = byMission(id);
      const detail = this.missionStatus(crew, m);
      html += `
        <div class="mrow">
          <span class="swatch" style="background:${m.colour}"></span>
          <div class="grow" data-pick="${id}">
            <span class="nm">${m.name}</span>
            <span class="sub" data-status="${id}">${detail}</span>
          </div>
          <span class="cnt">${crew.length}</span>
          <span class="pm">
            <button data-minus="${id}" ${crew.length ? '' : 'disabled'}>&minus;</button>
            <button data-plus="${id}">+</button>
          </span>
        </div>`;
    }

    // the guilds' rosters, counted on the same list as the callings
    const soldierKinds = CALLING_ORDER.filter(id => MISSIONS[id].becomes);
    const troops = (id) => g.units.filter(u => !u.dead && u.kind === MISSIONS[id].becomes);
    for (const id of soldierKinds) {
      const m = MISSIONS[id];
      const crew = troops(id);
      html += `
        <div class="mrow">
          <span class="swatch" style="background:${m.colour}"></span>
          <div class="grow" data-picktroop="${id}">
            <span class="nm">${m.name}</span>
            <span class="sub" data-troopstatus="${id}">${this.troopLine(crew)}</span>
          </div>
          <span class="cnt">${crew.length}</span>
          <span class="pm">
            <button disabled title="A hero is hired for good">&minus;</button>
            <button data-arm="${id}">+</button>
          </span>
        </div>`;
    }

    // Every peasant by name: the whole point is being able to single one out
    // and give them a calling of their own.
    html += `<div class="hint" style="margin-top:6px">Tap anyone to give them a calling of their own.</div>`;
    for (const p of peasants) {
      const m = MISSIONS[p.mission];
      html += `
        <div class="who-row" data-who="${p.id}">
          <span class="swatch" style="background:${m.colour}"></span>
          <div class="grow">
            <span class="nm">${p.name}</span>
            <span class="sub" data-who-sub="${p.id}">${this.peasantLine(p)}</span>
          </div>
          <span class="go">&rsaquo;</span>
        </div>`;
    }

    body.innerHTML = html;

    body.querySelectorAll('[data-arm]').forEach(btn => btn.addEventListener('click', () => {
      const kind = MISSIONS[btn.dataset.arm].becomes;
      const hall = g.nearestBuilding(g.palace.x, g.palace.y, b => b.complete && b.def.guild === kind);
      if (!hall) {
        const need = Object.values(BUILDINGS).find(d => d.guild === kind);
        this.notify(`Build a ${need ? need.name : 'guild'} first`, 'bad');
        return;
      }
      if (g.recruit(hall, kind)) { this.renderDrawer(); this.renderTopbar(); }
    }));
    body.querySelectorAll('[data-picktroop]').forEach(row => row.addEventListener('click', () => {
      const crew = troops(row.dataset.picktroop);
      if (!crew.length) { this.notify(`No ${MISSIONS[row.dataset.picktroop].name.toLowerCase()}s yet`); return; }
      this.setSelection(crew);
      this.audio.play('ui');
    }));

    body.querySelectorAll('[data-who]').forEach(row => row.addEventListener('click', () => {
      const u = g.units.find(x => x.id === +row.dataset.who && !x.dead);
      if (!u) return;
      this.setSelection([u]);
      this.r.centerOn(u.x, u.y);
      this.closeDrawer();
      this.audio.play('ui');
    }));

    // live status lines, without disturbing the controls
    this.peasantRefresh = () => {
      for (const id of MISSION_ORDER) {
        const el = body.querySelector(`[data-status="${id}"]`);
        if (el) el.textContent = this.missionStatus(byMission(id), MISSIONS[id]);
      }
      for (const p of peasants) {
        const el = body.querySelector(`[data-who-sub="${p.id}"]`);
        if (el) el.textContent = this.peasantLine(p);
      }
      for (const id of soldierKinds) {
        const el = body.querySelector(`[data-troopstatus="${id}"]`);
        if (el) el.textContent = this.troopLine(troops(id));
      }
    };

    body.querySelector('[data-hire]')?.addEventListener('click', () => {
      if (g.recruit(g.palace, 'peasant')) { this.renderDrawer(); this.renderTopbar(); }
    });
    body.querySelectorAll('[data-pick]').forEach(el => el.addEventListener('click', () => {
      const crew = byMission(el.dataset.pick);
      if (!crew.length) { this.notify('Nobody has that calling yet'); return; }
      this.setSelection(crew);
      this.audio.play('ui');
    }));
    body.querySelectorAll('[data-minus]').forEach(b => b.addEventListener('click', () => {
      const crew = byMission(b.dataset.minus);
      if (!crew.length) return;
      g.assignMission([crew[crew.length - 1]], 'none');
      this.renderDrawer();
    }));
    body.querySelectorAll('[data-plus]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.plus;
      const free = id === 'none' ? [] : byMission('none');   // +Idle means hire
      if (free.length) g.assignMission([free[0]], id);
      else if (!g.recruit(g.palace, 'peasant', id)) return;
      this.renderDrawer();
      this.renderTopbar();
    }));
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
      html += `<div class="hint">No heroes in this realm yet &mdash; guilds and the rest of the
        kingdom are switched off while the peasant economy is built out.</div>`;
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
    const mining = peasants.filter(p => p.mission !== 'none').length;
    html += `<div class="hint" style="margin-top:8px">
      <b>Where the money comes from.</b> ${mining} peasant${mining === 1 ? '' : 's'} on a calling,
      plus ${g.buildings.filter(b => !b.dead && b.complete && b.def.tax).length} building's taxes
      every ${12} seconds. Assign callings in the <b>Peasants</b> tab.</div>`;

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
    // Escrowed flag bounties, and what the buildings bring in each payday.
    const esc = Math.round(g.reserved);
    const d = $('#r-gold-d');
    const bits = [];
    if (esc > 0) bits.push(`(${esc})`);
    bits.push(`+${g.taxDue()}`);
    d.textContent = bits.join(' ');
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
      <p><b>You are a small god with a small valley.</b> Peasants are the one thing that
      actually listens to you. Give each a <b>calling</b> &mdash; Miner, Woodcutter, Quarrier,
      Builder &mdash; and they go and find the work themselves.</p>
      <p><b>Callings stick.</b> A miner walks to the nearest gold seam, works it out, and then
      walks to the next one without being asked. Tap a specific mine, quarry or tree to start
      someone in a particular spot instead.</p>
      <p><b>Assigning.</b> Tap a peasant for their calling buttons, or open the
      <b>Peasants</b> tab to move your whole workforce around at once.</p>
      <p><b>Distance is the economy.</b> Every load walks to the nearest <b>depot</b>, and at
      the start the City Centre is the only one. The rich seams are the far ones, so the way
      to get richer is to put a depot out there: a <b>Lumberyard</b> or a <b>Mining Camp</b>
      shortens the walk and makes everyone working nearby faster into the bargain.</p>
      <p><b>An outpost is a bet.</b> The far ground is where the lairs are, and raiders march
      on the nearest building they can find &mdash; which is now yours, standing on its own a
      long way from home. A <b>Guard House</b> keeps three soldiers who never wander off; a
      <b>Watch Tower</b> shoots at anything hostile and lifts the fog around it. Both cost the
      stone you went out there to cut.</p>
      <p><b>The treasury.</b> Buildings pay <b>tax</b> every twelve seconds &mdash; a
      Marketplace 10, an Inn or Blacksmith 7, a hut or an outpost 3 or 4 &mdash; and a
      gold seam pays far less than it used to. Building is how you get rich; mining only
      gets you started.</p>
      <p><b>What gold is for.</b> An army draws no wage. Spend the treasury instead on
      <b>drilling</b> a guild &mdash; Drilled (220g) sends recruits out at level 2 and holds
      one more hero, Veteran (520g) at level 3 and two more &mdash; and on <b>fortifying</b>
      a building: half again the health, repaired to full, a harder-hitting tower, a fourth
      guard. Both are bought once, on the building's own panel, and neither is a bill.</p>
      <p><b>What the attributes do.</b> Strength adds melee damage, agility attack speed,
      constitution health, and intelligence both mana and critical chance &mdash; every
      single point counts. Heroes gain <b>+5 to everything</b> per level, up to level 5,
      and those ranks are hard-won.</p>
      <p><b>Wizards and Clerics.</b> A <b>Wizards Guild</b> hires a <b>Wizard</b>: fire at range that lands on a whole pack at once, wrapped in nothing
      but a robe. A <b>Temple</b> hires a <b>Cleric</b>, who goes looking for the
      hurt anywhere in the realm rather than waiting for them &mdash; mending the wounded
      and <b>blessing</b> whoever is about to be. Both spend <b>mana</b>, which is what
      intelligence has been buying all along.</p>
      <p><b>Loot.</b> Monsters carry things &mdash; rarely if they are weak, often if they
      are not, always from a razed camp &mdash; and whatever falls goes to one of the
      heroes who was there. Seven slots: weapon, chest, neck, two earrings, two rings.
      Weapons are class-locked, and each hero judges an item by what their own class
      wants: a warrior weighs strength, a ranger agility, a caster intelligence. They
      wear what beats what they have and carry the rest to market.</p>
      <p><b>The Marketplace.</b> Five shelves that restock themselves. Heroes sell you
      what they cannot use and buy what beats what they are wearing, with their own gold
      &mdash; and you take a cut of both ends.</p>
      <p><b>No camp is empty.</b> Every lair keeps a garrison from the first day, and the
      further from home the bigger it is. Walking into one is always a fight.</p>
      <p><b>Who earns the rank.</b> Everyone who had a hand in a kill shares it &mdash;
      landing a hit or taking one both count &mdash; and the party earns a little more in
      total than a lone hero would, so nobody is left out for arriving second. Clerics
      count at half weight and earn rank directly for mending and blessing.</p>
      <p><b>Specialisations.</b> At level 5 a soldier picks one, once, for good. Warriors
      choose <b>Fury</b> (twin blades, all speed), <b>Arms</b> (one great weapon, one
      opponent) or <b>Protection</b> (shield up, soaks everything). Rangers choose
      <b>Longbowman</b> (reach above all), <b>Mercenary</b> or <b>Assassin</b> &mdash; the
      last two walk unseen, open hard out of the dark, and break off rather than trade.
      Wizards choose <b>Blood</b> (one target, no splash, every bolt drinks), <b>Fire</b>
      (wider splash, and everything it touches burns) or <b>Dark</b> magic (bolts that
      weaken, and a <b>Blight</b> that curses the ground). Clerics become a <b>Follower of
      the Light</b> (stronger, longer mending and a burst that heals everyone) or a
      <b>Paladin</b> (plate, longer blessings, and a hymn that blesses everyone at once).
      Each is worth the same twenty attribute points, and each unlocks an ability paid
      for with <b>Rage</b>, <b>Focus</b> or <b>Mana</b>. Each also changes how the hero
      looks, so a party reads at a glance from across the map.</p>
      <p><b>Three realms.</b> <b>Easy</b> is the game as it was, up to the ogre den, with
      raids you can meet in the field. <b>Hard</b> keeps that map and makes the raids mean
      it. <b>Endgame</b> is the wide map with everything past the ogres. Chosen once, when
      the realm is raised; <b>?mode=</b> in the address skips the question.</p>
      <p><b>The far reaches</b> (Endgame). Past the ogres the map keeps going: a <b>Spider Hollow</b>
      (fast, and the bite slows you), a <b>Troll Warren</b> (they knit back together unless
      they are burning), a <b>Wraith Barrow</b> (steel half goes through them), a <b>Blood
      Shrine</b> (cultists throwing blood-fire at range) and a <b>Drake Roost</b> (fire over
      a whole line). Each is a bigger ask than the ogre den and pays like it.</p>
      <p><b>The thing under the last camp</b> (Endgame). Razing the last camp does not win it:
      <b>${DRAGON.name}</b> comes up out of the hole, six times a drake's health, and unlike
      every other raider in the game it never gets bored and goes home. Nor do your soldiers
      &mdash; there is no next fight to stay alive for, so every one of them goes at it
      wherever it is, whatever the odds. Kill it and the realm is yours, with three
      <b>legendaries</b> and 6000 gold for the trouble.</p>
      <p><b>Raids get worse</b> (Hard and Endgame). They grow with the days, from day ten they can bring two
      kinds of monster at once, and from day eighteen the far camps march too. Clear every camp
      that can see you and it is the next ones out that come instead &mdash; razing your
      neighbours buys better raids, not fewer. Every
      <b>third</b> raid is led by a <b>boss</b>: a named champion of the worst camp that
      has woken, with an escort that stays as long as it does. It wears a crown, it does
      not go home, it always carries a <b>legendary</b> item, and it pulses gold on the
      little map from the moment it sets out, fog or no fog.</p>
      <p><b>The camps fight back.</b> Strike a lair and it raises the alarm, mustering
      reinforcements far faster for a while &mdash; you have to out-kill it, not outlast
      it. Monsters also grow stronger as the days pass, so send enough, and remember a
      big enough bounty will buy courage your soldiers do not have on their own.</p>
      <p><b>Soldiers.</b> Build a <b>Barracks</b> or a <b>Rangers Guild</b> and hire from it.
      A hero costs gold and nothing else &mdash; no villager puts down a pick for it &mdash;
      and each guild holds only two or three, so soldiers are what your buildings let you
      have rather than what your workforce can be ground into. They arrive good at the job
      and get better by fighting. Callings are villagers' work &mdash; a soldier you have
      paid a guild for is for fighting, not for hauling stone.</p>
      <p><b>Trouble on the road.</b> A soldier on an errand deals with anything within three
      tiles, or anything that has just hit them, before walking on &mdash; but answers it
      where it stands rather than chasing: drag them nine tiles from where the scuffle
      started and they break off and get back to it.</p>
      <p><b>Self-preservation.</b> Everyone of the realm gives a known camp a wide berth on
      the road, out to the reach of its garrison, wherever there is a way round. Where there
      is not, a hero walks the route on paper first and weighs every camp it crosses the way
      they weigh the destination: lose that sum and they say <b>not past that</b>, drop the
      errand for a while and pick another. A fat enough bounty still talks them through.</p>
      <p><b>Stances.</b> A soldier set to <b>Defend</b> walks a beat around your buildings and
      workers and sprints to anyone under attack; one set to <b>Roam</b> wanders off to scout and
      hunt lairs. Either way they take no orders &mdash; raise a <b>flag</b> and pay enough.</p>
      <p><b>Peasants are not helpless.</b> They run from a monster they can see, but anything
      already biting them gets hit back &mdash; until they are badly hurt, at which point they
      sensibly leave.</p>
      <p><b>Camera.</b> Drag to pan, pinch to zoom, or tap <b>Zoom</b> for Close / Mid / Far / Wide.
      Tap the corner map to open the full realm and jump anywhere. Select a unit and hit
      <b>Follow</b> to have the camera track it.</p>
      <p>Seed <b>${g.seed}</b> &middot; <b style="color:${g.mode.colour}">${g.mode.name}</b> &middot; day <b>${g.day}</b> &middot; lairs left <b>${g.lairs.filter(l => !l.dead).length}</b></p>`,
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
        ? (g.mode.finale
          ? `Every camp is rubble, ${DRAGON.name} is cooling on the grass beside the last of them, and your heroes are insufferable about it.`
          : 'Every lair is rubble, every road is safe, and your heroes are insufferable about it.')
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
    // A finger on the glass means a click is still in flight: touch browsers
    // synthesise it well after pointerup, and a rebuild in between loses it.
    const settling = this.pointers.size > 0 || performance.now() - (this.touchedAt || 0) < 500;
    if (this.refreshIn <= 0 && !settling) {
      this.refreshIn = 0.3;
      this.renderTopbar();
      if (this.game.selection.length) this.renderSelection();
      if (this.tab === 'kingdom') this.renderRealm($('#drawer-body'));
      else if (this.tab === 'peasants') this.renderPeasants($('#drawer-body'));
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
