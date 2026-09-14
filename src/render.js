// ===================================================================
// render.js — chunky integer-scaled 2D rendering.
// Everything is drawn at 1x into world pixels and magnified by an
// integer factor, so the pixels stay square and honest.
// ===================================================================
import {
  TILE, PAL, tileSprite, unitSprite, buildingSprite, propSprite,
  flagSprite, makeCanvas, BUILD_EXTRA
} from './art.js';
import { toPx, toTile } from './world.js';
import { clamp } from './util.js';
import { BUILDINGS, FLAGS } from './data.js';

// ---- 3x5 pixel font ------------------------------------------------
const G = {
  A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6],
  E: [7, 4, 6, 4, 7], F: [7, 4, 6, 4, 4], G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5],
  I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2], K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7],
  M: [5, 7, 7, 5, 5], N: [5, 7, 7, 7, 5], O: [2, 5, 5, 5, 2], P: [6, 5, 6, 4, 4],
  Q: [2, 5, 5, 7, 3], R: [6, 5, 6, 5, 5], S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2],
  U: [5, 5, 5, 5, 3], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5],
  Y: [5, 5, 2, 2, 2], Z: [7, 1, 2, 4, 7],
  0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [7, 1, 7, 4, 7], 3: [7, 1, 7, 1, 7],
  4: [5, 5, 7, 1, 1], 5: [7, 4, 7, 1, 7], 6: [7, 4, 7, 5, 7], 7: [7, 1, 1, 1, 1],
  8: [7, 5, 7, 5, 7], 9: [7, 5, 7, 1, 7],
  '+': [0, 2, 7, 2, 0], '-': [0, 0, 7, 0, 0], '.': [0, 0, 0, 0, 2], ',': [0, 0, 0, 2, 4],
  '!': [2, 2, 2, 0, 2], '/': [1, 1, 2, 4, 4], '%': [5, 1, 2, 4, 5], ':': [0, 2, 0, 2, 0],
  '(': [1, 2, 2, 2, 1], ')': [4, 2, 2, 2, 4], '?': [6, 1, 2, 0, 2], "'": [2, 2, 0, 0, 0],
  ' ': [0, 0, 0, 0, 0]
};

export function textWidth(s) { return s.length * 4 - 1; }

export function drawText(ctx, str, x, y, col = '#f2e9ff', shadow = '#120c1c') {
  str = String(str).toUpperCase();
  for (let pass = shadow ? 0 : 1; pass < 2; pass++) {
    ctx.fillStyle = pass === 0 ? shadow : col;
    const ox = pass === 0 ? 1 : 0, oy = pass === 0 ? 1 : 0;
    let cx = x;
    for (const ch of str) {
      const g = G[ch] || G['?'];
      for (let r = 0; r < 5; r++) {
        const bits = g[r];
        if (!bits) continue;
        if (bits & 4) ctx.fillRect(cx + ox, y + r + oy, 1, 1);
        if (bits & 2) ctx.fillRect(cx + 1 + ox, y + r + oy, 1, 1);
        if (bits & 1) ctx.fillRect(cx + 2 + ox, y + r + oy, 1, 1);
      }
      cx += 4;
    }
  }
}

// -------------------------------------------------------------------
export class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.game = game;
    this.scale = 3;
    this.minScale = 2; this.maxScale = 6;
    this.cam = { x: game.palace.x, y: game.palace.y };
    this.ground = null;
    this.mini = makeCanvas(game.world.w, game.world.h);
    this.miniIn = 0;
    this.hoverTile = null;
    this.bakeGround();
    this.resize();
  }

  /** The static terrain is painted once into one big offscreen canvas. */
  bakeGround() {
    const w = this.game.world;
    const c = makeCanvas(w.w * TILE, w.h * TILE);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    for (let y = 0; y < w.h; y++) {
      for (let x = 0; x < w.w; x++) {
        const i = w.idx(x, y);
        g.drawImage(tileSprite(w.tiles[i], w.vary[i]), x * TILE, y * TILE);
      }
    }
    this.ground = c;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const cw = Math.max(1, Math.round(window.innerWidth * dpr));
    const ch = Math.max(1, Math.round(window.innerHeight * dpr));
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw; this.canvas.height = ch;
    }
    this.dpr = dpr;
    this.autoScale();
  }

  autoScale() {
    // aim for roughly 30 tiles across, then clamp to sane integers
    const want = this.canvas.width / (30 * TILE);
    this.scale = clamp(Math.round(want), this.minScale, this.maxScale);
  }
  zoomStep() {
    this.scale = this.scale >= this.maxScale ? this.minScale : this.scale + 1;
  }

  get viewW() { return this.canvas.width / this.scale; }
  get viewH() { return this.canvas.height / this.scale; }

  clampCam() {
    const w = this.game.world;
    const halfW = this.viewW / 2, halfH = this.viewH / 2;
    const maxX = w.w * TILE, maxY = w.h * TILE;
    this.cam.x = clamp(this.cam.x, Math.min(halfW, maxX / 2), Math.max(maxX - halfW, maxX / 2));
    this.cam.y = clamp(this.cam.y, Math.min(halfH, maxY / 2), Math.max(maxY - halfH, maxY / 2));
  }

  screenToWorld(sx, sy) {
    const dpr = this.dpr;
    return {
      x: (sx * dpr - this.canvas.width / 2) / this.scale + this.cam.x,
      y: (sy * dpr - this.canvas.height / 2) / this.scale + this.cam.y
    };
  }
  worldToScreen(wx, wy) {
    return {
      x: ((wx - this.cam.x) * this.scale + this.canvas.width / 2) / this.dpr,
      y: ((wy - this.cam.y) * this.scale + this.canvas.height / 2) / this.dpr
    };
  }

  centerOn(x, y) { this.cam.x = x; this.cam.y = y; this.clampCam(); }

  // -----------------------------------------------------------------
  draw(dt) {
    const g = this.game, w = g.world, ctx = this.ctx;
    this.clampCam();
    const vw = this.viewW, vh = this.viewH;
    const ox = Math.floor(this.cam.x - vw / 2);
    const oy = Math.floor(this.cam.y - vh / 2);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0d1a22';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.scale, 0, 0, this.scale, -ox * this.scale, -oy * this.scale);

    // --- ground -----------------------------------------------------
    ctx.drawImage(this.ground, ox, oy, Math.ceil(vw) + 1, Math.ceil(vh) + 1,
      ox, oy, Math.ceil(vw) + 1, Math.ceil(vh) + 1);

    const tx0 = Math.max(0, toTile(ox) - 1), tx1 = Math.min(w.w - 1, toTile(ox + vw) + 1);
    const ty0 = Math.max(0, toTile(oy) - 1), ty1 = Math.min(w.h - 1, toTile(oy + vh) + 2);

    // --- collect drawables, sort by feet ---------------------------
    const list = [];
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const i = w.idx(tx, ty);
        if (!w.fog[i]) continue;
        const p = w.propAt[i];
        if (p < 0) continue;
        const prop = w.props[p];
        if (!prop || prop.removed) continue;
        list.push({ z: (ty + 1) * TILE, kind: 'prop', o: prop });
      }
    }
    for (const n of w.nodes) {
      if (n.amount <= 0) continue;
      if (n.tx + 2 < tx0 || n.tx > tx1 || n.ty + 2 < ty0 || n.ty > ty1) continue;
      if (!w.seen(n.tx, n.ty)) continue;
      list.push({ z: (n.ty + n.fh) * TILE, kind: 'node', o: n });
    }
    for (const b of g.buildings) {
      if (b.dead) continue;
      if (b.tx + b.fw < tx0 || b.tx > tx1 || b.ty + b.fh < ty0 || b.ty > ty1) continue;
      if (!w.seen(b.tx, b.ty)) continue;
      list.push({ z: b.bottom, kind: 'building', o: b });
    }
    for (const l of g.lairs) {
      if (l.dead) continue;
      if (l.tx + 2 < tx0 || l.tx > tx1 || l.ty + 2 < ty0 || l.ty > ty1) continue;
      if (!w.seen(l.tx, l.ty)) continue;
      list.push({ z: l.bottom, kind: 'lair', o: l });
    }
    for (const u of g.units) {
      if (u.dead) continue;
      if (u.x < ox - 24 || u.x > ox + vw + 24 || u.y < oy - 32 || u.y > oy + vh + 32) continue;
      if (u.faction === 'monster' && !w.visible(u.tx, u.ty)) continue;
      if (u.faction === 'realm' && !w.seen(u.tx, u.ty)) continue;
      list.push({ z: u.y + 8, kind: 'unit', o: u });
    }
    for (const f of g.flags) {
      list.push({ z: f.y + 10, kind: 'flag', o: f });
    }
    list.sort((a, b) => a.z - b.z);

    // --- flag ground circles (under everything) --------------------
    for (const f of g.flags) this.drawFlagArea(ctx, f);

    // --- draw ------------------------------------------------------
    const t = performance.now() / 1000;
    for (const item of list) {
      switch (item.kind) {
        case 'prop': this.drawProp(ctx, item.o); break;
        case 'node': this.drawNode(ctx, item.o); break;
        case 'building': this.drawBuilding(ctx, item.o); break;
        case 'lair': this.drawLair(ctx, item.o); break;
        case 'unit': this.drawUnit(ctx, item.o); break;
        case 'flag': this.drawFlag(ctx, item.o, t); break;
      }
    }

    // --- projectiles ----------------------------------------------
    for (const p of g.projectiles) {
      if (p.kind === 'fire') {
        ctx.fillStyle = '#ffb040';
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
        ctx.fillStyle = '#fff0b0';
        ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
      } else if (p.kind === 'bolt') {
        ctx.fillStyle = '#d0e4ff';
        ctx.fillRect(p.x - 2, p.y - 1, 5, 2);
      } else {
        ctx.fillStyle = '#e8d8a0';
        ctx.fillRect(p.x - 3, p.y, 5, 1);
        ctx.fillStyle = '#b9c2d0';
        ctx.fillRect(p.x + 2, p.y, 2, 1);
      }
    }

    // --- particles & floating text --------------------------------
    for (const q of g.fx.parts) {
      ctx.globalAlpha = clamp(1 - q.t / q.life, 0, 1);
      ctx.fillStyle = q.col;
      ctx.fillRect(q.x | 0, q.y | 0, q.sz, q.sz);
    }
    ctx.globalAlpha = 1;
    for (const q of g.fx.texts) {
      const k = q.t / q.life;
      ctx.globalAlpha = clamp(1.6 - k * 1.6, 0, 1);
      drawText(ctx, q.str, Math.round(q.x - textWidth(q.str) / 2), Math.round(q.y - k * q.rise), q.col);
    }
    ctx.globalAlpha = 1;

    // --- fog of war ------------------------------------------------
    this.drawFog(ctx, tx0, tx1, ty0, ty1);

    // --- selection, bars, ghost ------------------------------------
    for (const e of g.selection) this.drawSelectionMark(ctx, e);
    for (const u of g.units) {
      if (u.dead) continue;
      if (u.x < ox - 24 || u.x > ox + vw + 24 || u.y < oy - 32 || u.y > oy + vh + 32) continue;
      if (u.faction === 'monster' && !w.visible(u.tx, u.ty)) continue;
      if (u.faction === 'realm' && !w.seen(u.tx, u.ty)) continue;
      this.drawUnitBar(ctx, u);
    }
    for (const b of g.buildings) {
      if (!b.dead && w.seen(b.tx, b.ty)) this.drawStructureBar(ctx, b);
    }
    for (const l of g.lairs) {
      if (!l.dead && w.visible(l.tx, l.ty)) this.drawStructureBar(ctx, l);
    }

    if (g.placing) this.drawGhost(ctx);

    // --- minimap ----------------------------------------------------
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawMinimap(ctx, dt);
  }

  // -----------------------------------------------------------------
  drawProp(ctx, p) {
    const s = propSprite(p.kind, p.v);
    const x = p.tx * TILE + (TILE - Math.min(s.width, 16)) / 2;
    if (p.kind.startsWith('lair')) return;   // lairs draw themselves
    ctx.drawImage(s, Math.round(x - (s.width > 16 ? (s.width - 16) / 2 : 0)),
      Math.round((p.ty + 1) * TILE - s.height));
  }

  drawNode(ctx, n) {
    const s = propSprite(n.kind);
    ctx.drawImage(s, n.tx * TILE, (n.ty + n.fh) * TILE - s.height);
    // depletion pips
    const frac = n.amount / n.max;
    if (frac < 0.999) {
      const bw = 14;
      const x = n.tx * TILE + (n.fw * TILE - bw) / 2, y = (n.ty + n.fh) * TILE + 1;
      ctx.fillStyle = '#120c1c'; ctx.fillRect(x - 1, y - 1, bw + 2, 4);
      ctx.fillStyle = n.kind === 'goldmine' ? PAL.gold : PAL.stone;
      ctx.fillRect(x, y, Math.max(1, Math.round(bw * frac)), 2);
    }
    if (n.workers && n.workers.length) {
      drawText(ctx, String(n.workers.length), n.tx * TILE + 1, (n.ty) * TILE - 6, '#f2e9ff');
    }
  }

  drawBuilding(ctx, b) {
    const s = buildingSprite(b.defId, b.fw, b.fh, b.complete ? 'done' : 'site');
    const x = b.tx * TILE;
    const y = b.bottom - s.height;
    // ground shadow
    ctx.fillStyle = PAL.shadow;
    ctx.fillRect(x + 1, b.bottom - 3, b.fw * TILE - 2, 3);
    if (b.hitFlash > 0) { ctx.globalAlpha = 1; this.drawFlashed(ctx, s, x, y); }
    else ctx.drawImage(s, x, y);
    if (!b.complete) {
      const bw = b.fw * TILE - 4;
      const bx = x + 2, by = b.bottom + 1;
      ctx.fillStyle = '#120c1c'; ctx.fillRect(bx - 1, by - 1, bw + 2, 4);
      ctx.fillStyle = PAL.gold; ctx.fillRect(bx, by, Math.round(bw * b.progress), 2);
    }
  }

  drawLair(ctx, l) {
    const s = propSprite(l.def.prop);
    const x = l.tx * TILE, y = (l.ty + l.fh) * TILE - s.height;
    ctx.fillStyle = PAL.shadow;
    ctx.fillRect(x + 2, l.bottom - 3, l.fw * TILE - 4, 3);
    if (l.hitFlash > 0) this.drawFlashed(ctx, s, x, y);
    else ctx.drawImage(s, x, y);
  }

  drawFlashed(ctx, s, x, y) {
    ctx.drawImage(s, x, y);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.55;
    ctx.drawImage(s, x, y);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  drawUnit(ctx, u) {
    const moving = u.moving || u.state === 'harvest' || u.state === 'build';
    const frame = moving ? (u.frame | 0) % 2 : 0;
    const s = unitSprite(u.sprite, frame, u.dir);
    const x = Math.round(u.x - 8), y = Math.round(u.y - 14);
    ctx.fillStyle = PAL.shadow;
    ctx.fillRect(x + 4, Math.round(u.y) - 1, 8, 2);
    if (u.def.big) {
      ctx.save();
      ctx.translate(Math.round(u.x), Math.round(u.y + 2));
      ctx.scale(1.35, 1.35);
      ctx.drawImage(s, -8, -16);
      ctx.restore();
    } else if (u.hitFlash > 0) {
      this.drawFlashed(ctx, s, x, y);
    } else {
      ctx.drawImage(s, x, y);
    }
    // a peasant with a full pack
    if (u.carry > 0.5) {
      const col = u.carryRes === 'gold' ? PAL.gold : u.carryRes === 'stone' ? PAL.stone : PAL.woodL;
      ctx.fillStyle = PAL.outline; ctx.fillRect(x + (u.dir > 0 ? 1 : 12), y + 6, 4, 4);
      ctx.fillStyle = col; ctx.fillRect(x + (u.dir > 0 ? 1 : 12), y + 6, 3, 3);
    }
  }

  drawUnitBar(ctx, u) {
    const hurt = u.hp < u.maxHpNow - 0.5;
    if (!hurt && !u.selected) return;
    const w = 12, x = Math.round(u.x - w / 2), y = Math.round(u.y - 19);
    ctx.fillStyle = '#120c1c'; ctx.fillRect(x - 1, y - 1, w + 2, 4);
    const f = clamp(u.hp / u.maxHpNow, 0, 1);
    ctx.fillStyle = u.faction === 'monster' ? '#e05050' : f > 0.5 ? '#6ecf8e' : f > 0.25 ? '#ffc94a' : '#e05050';
    ctx.fillRect(x, y, Math.max(1, Math.round(w * f)), 2);
    if (u.isHero) {
      drawText(ctx, String(u.level), x + w + 2, y - 2, '#ffc94a');
    }
  }

  drawStructureBar(ctx, b) {
    if (b.hp >= b.maxHp - 0.5 && !b.selected) return;
    const w = b.fw * TILE - 4, x = b.tx * TILE + 2, y = b.bottom - b.fh * TILE - 6;
    ctx.fillStyle = '#120c1c'; ctx.fillRect(x - 1, y - 1, w + 2, 4);
    const f = clamp(b.hp / b.maxHp, 0, 1);
    ctx.fillStyle = b.faction === 'monster' ? '#e05050' : f > 0.5 ? '#6ecf8e' : f > 0.25 ? '#ffc94a' : '#e05050';
    ctx.fillRect(x, y, Math.max(1, Math.round(w * f)), 2);
  }

  drawSelectionMark(ctx, e) {
    const isUnit = e.kindClass === 'unit';
    const cx = e.x, cy = isUnit ? e.y : e.bottom - 2;
    const rx = isUnit ? 7 : (e.fw * TILE) / 2, ry = isUnit ? 3 : (e.fh * TILE) / 4;
    ctx.strokeStyle = '#ffc94a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    // little corner ticks for structures
    if (!isUnit) {
      const x0 = e.tx * TILE, y0 = e.ty * TILE, w = e.fw * TILE, h = e.fh * TILE;
      ctx.fillStyle = '#ffc94a';
      for (const [px, py] of [[x0, y0], [x0 + w - 3, y0], [x0, y0 + h - 3], [x0 + w - 3, y0 + h - 3]]) {
        ctx.fillRect(px, py, 3, 1); ctx.fillRect(px, py, 1, 3);
      }
    }
    if (isUnit && e.job && e.job.type === 'harvest' && e.job.node) {
      const n = e.job.node;
      ctx.strokeStyle = 'rgba(255,201,74,0.4)';
      ctx.beginPath();
      ctx.moveTo(e.x, e.y - 6);
      ctx.lineTo(n.tx * TILE + TILE, n.ty * TILE + TILE);
      ctx.stroke();
    }
  }

  drawFlagArea(ctx, f) {
    const col = FLAGS[f.type].colour;
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.radius * TILE, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = col;
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  drawFlag(ctx, f, t) {
    const s = flagSprite(f.type, Math.floor(t * 4) % 2);
    ctx.drawImage(s, Math.round(f.x - 6), Math.round(f.y - 20));
    if (f.bounty > 0) {
      const label = Math.round(f.bounty - f.paid) + 'G';
      drawText(ctx, label, Math.round(f.x - textWidth(label) / 2), Math.round(f.y - 28), PAL.gold);
    }
  }

  drawFog(ctx, tx0, tx1, ty0, ty1) {
    const w = this.game.world;
    ctx.fillStyle = '#0a0713';
    for (let ty = ty0; ty <= ty1; ty++) {
      let runStart = -1;
      for (let tx = tx0; tx <= tx1 + 1; tx++) {
        const unseen = tx <= tx1 && w.fog[w.idx(tx, ty)] === 0;
        if (unseen && runStart < 0) runStart = tx;
        else if (!unseen && runStart >= 0) {
          ctx.fillRect(runStart * TILE, ty * TILE, (tx - runStart) * TILE, TILE);
          runStart = -1;
        }
      }
    }
    ctx.fillStyle = 'rgba(10,7,19,0.38)';
    for (let ty = ty0; ty <= ty1; ty++) {
      let runStart = -1;
      for (let tx = tx0; tx <= tx1 + 1; tx++) {
        const dim = tx <= tx1 && w.fog[w.idx(tx, ty)] === 1;
        if (dim && runStart < 0) runStart = tx;
        else if (!dim && runStart >= 0) {
          ctx.fillRect(runStart * TILE, ty * TILE, (tx - runStart) * TILE, TILE);
          runStart = -1;
        }
      }
    }
  }

  drawGhost(ctx) {
    const g = this.game, p = g.placing;
    if (!this.hoverTile) return;
    const { x: tx, y: ty } = this.hoverTile;
    if (p.type === 'building') {
      const def = BUILDINGS[p.defId];
      const ok = g.canPlace(p.defId, tx, ty) && g.canAfford(def.cost);
      const s = buildingSprite(p.defId, def.fw, def.fh, 'done');
      ctx.globalAlpha = 0.65;
      ctx.drawImage(s, tx * TILE, (ty + def.fh) * TILE - s.height);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = ok ? '#6ecf8e' : '#e05050';
      ctx.lineWidth = 1;
      ctx.strokeRect(tx * TILE + 0.5, ty * TILE + 0.5, def.fw * TILE - 1, def.fh * TILE - 1);
      ctx.fillStyle = ok ? 'rgba(110,207,142,0.18)' : 'rgba(224,80,80,0.22)';
      ctx.fillRect(tx * TILE, ty * TILE, def.fw * TILE, def.fh * TILE);
    } else if (p.type === 'flag') {
      const col = FLAGS[p.flagType].colour;
      const x = tx * TILE + TILE / 2, y = ty * TILE + TILE / 2;
      ctx.globalAlpha = 0.2; ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(x, y, 5 * TILE, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.drawImage(flagSprite(p.flagType, 0), Math.round(x - 6), Math.round(y - 20));
    }
  }

  // -----------------------------------------------------------------
  drawMinimap(ctx, dt) {
    const g = this.game, w = g.world;
    this.miniIn -= dt;
    if (this.miniIn <= 0) {
      this.miniIn = 0.4;
      const m = this.mini.getContext('2d');
      const img = m.createImageData(w.w, w.h);
      const d = img.data;
      for (let i = 0; i < w.w * w.h; i++) {
        let r = 10, gr = 7, b = 19;
        if (w.fog[i]) {
          const t = w.tiles[i];
          if (t === 0) { r = 32; gr = 64; b = 110; }
          else if (t === 1) { r = 190; gr = 155; b = 105; }
          else if (t === 2) { r = 60; gr = 122; b = 63; }
          else if (t === 3) { r = 47; gr = 99; b = 53; }
          else if (t === 4) { r = 110; gr = 82; b = 52; }
          else { r = 100; gr = 100; b = 118; }
          if (w.fog[i] === 1) { r *= 0.62; gr *= 0.62; b *= 0.62; }
        }
        d[i * 4] = r; d[i * 4 + 1] = gr; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
      }
      m.putImageData(img, 0, 0);
      const dot = (x, y, col, s = 2) => { m.fillStyle = col; m.fillRect(x - (s >> 1), y - (s >> 1), s, s); };
      for (const n of w.nodes) if (n.amount > 0 && w.seen(n.tx, n.ty)) dot(n.tx, n.ty, n.kind === 'goldmine' ? '#ffc94a' : '#b6bccb', 2);
      for (const l of g.lairs) if (!l.dead && w.seen(l.tx, l.ty)) dot(l.tx, l.ty, '#a03ad0', 3);
      for (const b of g.buildings) if (!b.dead && w.seen(b.tx, b.ty)) dot(b.tx + (b.fw >> 1), b.ty + (b.fh >> 1), b.complete ? '#f2e9ff' : '#8a7a5a', b.defId === 'palace' ? 4 : 2);
      for (const u of g.units) {
        if (u.dead) continue;
        if (u.faction === 'monster') { if (w.visible(u.tx, u.ty)) dot(u.tx, u.ty, '#e05050', 2); }
        else dot(u.tx, u.ty, u.isHero ? '#6fd0ff' : '#6ecf8e', 2);
      }
      for (const f of g.flags) dot(toTile(f.x), toTile(f.y), FLAGS[f.type].colour, 3);
    }

    const size = Math.round(Math.min(110 * this.dpr, this.canvas.width * 0.26));
    const pad = Math.round(6 * this.dpr);
    const top = Math.round((this.topInset || 34) * this.dpr);
    const x = this.canvas.width - size - pad, y = top;
    this.miniRect = { x, y, size };
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#120c1c';
    ctx.fillRect(x - 2, y - 2, size + 4, size + 4);
    ctx.drawImage(this.mini, x, y, size, size);
    ctx.strokeStyle = '#7a5fa8';
    ctx.lineWidth = Math.max(1, this.dpr);
    ctx.strokeRect(x - 1, y - 1, size + 2, size + 2);
    // viewport box
    const sx = size / (w.w * TILE), sy = size / (w.h * TILE);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      x + (this.cam.x - this.viewW / 2) * sx, y + (this.cam.y - this.viewH / 2) * sy,
      this.viewW * sx, this.viewH * sy
    );
  }

  minimapHit(sx, sy) {
    if (!this.miniRect) return null;
    const dpr = this.dpr;
    const { x, y, size } = this.miniRect;
    const px = sx * dpr, py = sy * dpr;
    if (px < x || px > x + size || py < y || py > y + size) return null;
    const w = this.game.world;
    return {
      x: ((px - x) / size) * w.w * TILE,
      y: ((py - y) / size) * w.h * TILE
    };
  }
}
