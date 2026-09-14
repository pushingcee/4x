// ===================================================================
// world.js — map generation, fog of war, and A* pathfinding.
// ===================================================================
import { makeRng, clamp, Heap } from './util.js';
import { T, TILE } from './art.js';

export const MAP_W = 96;
export const MAP_H = 96;

/** Layered value noise. Cheap, deterministic, good enough for islands. */
function valueNoise(rng, w, h, freq, octaves = 4) {
  const out = new Float32Array(w * h);
  let amp = 1, tot = 0;
  for (let o = 0; o < octaves; o++) {
    const gw = Math.max(2, Math.ceil(w / (freq / (1 << o)))) + 1;
    const gh = Math.max(2, Math.ceil(h / (freq / (1 << o)))) + 1;
    const grid = new Float32Array(gw * gh);
    for (let i = 0; i < grid.length; i++) grid[i] = rng();
    const cw = w / (gw - 1), ch = h / (gh - 1);
    for (let y = 0; y < h; y++) {
      const gy = y / ch, y0 = Math.floor(gy), ty = gy - y0;
      const sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < w; x++) {
        const gx = x / cw, x0 = Math.floor(gx), tx = gx - x0;
        const sx = tx * tx * (3 - 2 * tx);
        const a = grid[y0 * gw + x0], b = grid[y0 * gw + x0 + 1];
        const c = grid[(y0 + 1) * gw + x0], d = grid[(y0 + 1) * gw + x0 + 1];
        const top = a + (b - a) * sx, bot = c + (d - c) * sx;
        out[y * w + x] += (top + (bot - top) * sy) * amp;
      }
    }
    tot += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}

export class World {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.w = MAP_W; this.h = MAP_H;
    const n = this.w * this.h;
    this.tiles = new Uint8Array(n);
    this.vary = new Uint8Array(n);
    this.blocked = new Uint8Array(n);   // static terrain blockage
    this.occupied = new Int16Array(n).fill(-1); // building id per tile
    this.fog = new Uint8Array(n);       // 0 unseen, 1 remembered, 2 visible
    this.props = [];                    // decorative + harvestable scenery
    this.propAt = new Int16Array(n).fill(-1);

    // A* scratch
    this._g = new Float32Array(n);
    this._from = new Int32Array(n);
    this._stamp = new Int32Array(n);
    this._gen = 0;
    this._heap = new Heap();

    this.generate();
  }

  idx(x, y) { return y * this.w + x; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }

  // -------------------------------------------------------------
  generate() {
    const rng = makeRng(this.seed);
    const { w, h } = this;
    const elev = valueNoise(rng, w, h, 34, 5);
    const moist = valueNoise(rng, w, h, 22, 3);

    // radial falloff => continent with a coastline
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const nx = (x / w) * 2 - 1, ny = (y / h) * 2 - 1;
        const d = Math.sqrt(nx * nx + ny * ny) / 1.18;
        const e = elev[i] - Math.max(0, d * d * 1.05 - 0.05);
        let t;
        if (e < 0.26) t = T.WATER;
        else if (e < 0.30) t = T.SAND;
        else if (e > 0.70) t = T.ROCK;
        else if (e > 0.62) t = T.DIRT;
        else t = moist[i] > 0.52 ? T.GRASS : T.DGRASS;
        this.tiles[i] = t;
        this.vary[i] = (Math.imul(x + 1, 0x27d4eb2d) ^ Math.imul(y + 1, 0x165667b1) ^ this.seed) >>> 28;
        this.blocked[i] = (t === T.WATER || t === T.ROCK) ? 1 : 0;
      }
    }

    // pick a start: flat, open, near map centre
    this.start = this.findStartSpot(rng);

    // clear a friendly plain around the start
    const { x: sx, y: sy } = this.start;
    for (let y = sy - 7; y <= sy + 7; y++) {
      for (let x = sx - 7; x <= sx + 7; x++) {
        if (!this.inside(x, y)) continue;
        const d = Math.hypot(x - sx, y - sy);
        if (d > 7) continue;
        const i = this.idx(x, y);
        if (this.tiles[i] === T.WATER) continue;
        if (this.tiles[i] === T.ROCK || this.tiles[i] === T.DIRT) {
          this.tiles[i] = T.DGRASS;
        }
        this.blocked[i] = 0;
      }
    }

    this.scatterScenery(rng);
    this.placeResources(rng);
    this.lairSpots = this.pickLairSpots(rng);
  }

  findStartSpot(rng) {
    let best = null, bestScore = -1e9;
    for (let tries = 0; tries < 900; tries++) {
      const x = rng.int(18, this.w - 19), y = rng.int(18, this.h - 19);
      let land = 0;
      for (let dy = -5; dy <= 5; dy++) {
        for (let dx = -5; dx <= 5; dx++) {
          const i = this.idx(clamp(x + dx, 0, this.w - 1), clamp(y + dy, 0, this.h - 1));
          if (!this.blocked[i]) land++;
        }
      }
      const centreBias = -Math.hypot(x - this.w / 2, y - this.h / 2) * 0.9;
      const score = land + centreBias;
      if (score > bestScore) { bestScore = score; best = { x, y }; }
    }
    return best || { x: this.w >> 1, y: this.h >> 1 };
  }

  addProp(kind, tx, ty, data = {}) {
    if (!this.inside(tx, ty)) return null;
    const i = this.idx(tx, ty);
    if (this.propAt[i] >= 0) return null;
    const p = { id: this.props.length, kind, tx, ty, v: (tx * 3 + ty * 5) & 7, ...data };
    this.props.push(p);
    this.propAt[i] = p.id;
    return p;
  }

  scatterScenery(rng) {
    const { w, h } = this;
    // forest clumps
    for (let c = 0; c < 130; c++) {
      const cx = rng.int(2, w - 3), cy = rng.int(2, h - 3);
      if (this.blocked[this.idx(cx, cy)]) continue;
      const r = rng.int(2, 5), pine = rng.chance(0.4);
      for (let y = cy - r; y <= cy + r; y++) {
        for (let x = cx - r; x <= cx + r; x++) {
          if (!this.inside(x, y)) continue;
          if (Math.hypot(x - cx, y - cy) > r) continue;
          const i = this.idx(x, y);
          if (this.blocked[i] || this.tiles[i] === T.SAND) continue;
          if (Math.hypot(x - this.start.x, y - this.start.y) < 6) continue;
          if (!rng.chance(0.55)) continue;
          this.addProp(pine ? 'pine' : 'tree', x, y, { wood: 120 + rng.int(0, 90) });
        }
      }
    }
    // loose rocks & bushes
    for (let c = 0; c < 340; c++) {
      const x = rng.int(0, w - 1), y = rng.int(0, h - 1);
      const i = this.idx(x, y);
      if (this.blocked[i] || this.tiles[i] === T.WATER) continue;
      this.addProp(rng.chance(0.5) ? 'rock' : 'bush', x, y);
    }
  }

  placeResources(rng) {
    const { w, h } = this;
    this.nodes = [];
    const tryNode = (kind, minD, maxD, amount) => {
      for (let t = 0; t < 500; t++) {
        const x = rng.int(3, w - 5), y = rng.int(3, h - 5);
        const d = Math.hypot(x - this.start.x, y - this.start.y);
        if (d < minD || d > maxD) continue;
        if (!this.areaFree(x, y, 2, 2)) continue;
        // gold likes hills, stone likes rock
        const near = this.countNear(x, y, 3, T.ROCK) + this.countNear(x, y, 3, T.DIRT);
        if (kind !== 'goldmine' && near < 2) continue;
        const node = {
          id: this.nodes.length, kind, tx: x, ty: y, fw: 2, fh: 2,
          amount, max: amount, workers: []
        };
        this.nodes.push(node);
        for (let yy = y; yy < y + 2; yy++) {
          for (let xx = x; xx < x + 2; xx++) this.blocked[this.idx(xx, yy)] = 1;
        }
        return node;
      }
      return null;
    };
    // a couple of starter nodes close to home, then plenty further out
    tryNode('goldmine', 5, 11, 3000);
    tryNode('quarry', 5, 12, 2400);
    for (let i = 0; i < 9; i++) tryNode('goldmine', 9, 46, 2200 + rng.int(0, 2600));
    for (let i = 0; i < 7; i++) tryNode('quarry', 9, 46, 2000 + rng.int(0, 2200));
  }

  countNear(x, y, r, type) {
    let n = 0;
    for (let yy = y - r; yy <= y + r; yy++)
      for (let xx = x - r; xx <= x + r; xx++)
        if (this.inside(xx, yy) && this.tiles[this.idx(xx, yy)] === type) n++;
    return n;
  }

  /** Is an fw x fh footprint at (x,y) clear of blockage, props and buildings? */
  areaFree(x, y, fw, fh, ignoreProps = false) {
    for (let yy = y; yy < y + fh; yy++) {
      for (let xx = x; xx < x + fw; xx++) {
        if (!this.inside(xx, yy)) return false;
        const i = this.idx(xx, yy);
        if (this.blocked[i] || this.occupied[i] >= 0) return false;
        if (!ignoreProps && this.propAt[i] >= 0) {
          const k = this.props[this.propAt[i]].kind;
          if (k === 'tree' || k === 'pine') return false;
        }
      }
    }
    return true;
  }

  pickLairSpots(rng) {
    const spots = [];
    const kinds = [
      { kind: 'rat', min: 17, max: 28, n: 3 },
      { kind: 'goblin', min: 23, max: 38, n: 3 },
      { kind: 'skeleton', min: 30, max: 48, n: 2 },
      { kind: 'ogre', min: 36, max: 56, n: 1 }
    ];
    for (const k of kinds) {
      for (let i = 0; i < k.n; i++) {
        for (let t = 0; t < 600; t++) {
          const x = rng.int(2, this.w - 4), y = rng.int(2, this.h - 4);
          const d = Math.hypot(x - this.start.x, y - this.start.y);
          if (d < k.min || d > k.max) continue;
          if (!this.areaFree(x, y, 2, 2)) continue;
          if (spots.some(s => Math.hypot(s.x - x, s.y - y) < 9)) continue;
          spots.push({ kind: k.kind, x, y });
          break;
        }
      }
    }
    return spots;
  }

  // -------------------------------------------------------------
  // passability & fog
  // -------------------------------------------------------------
  passable(x, y) {
    if (!this.inside(x, y)) return false;
    const i = y * this.w + x;
    return !this.blocked[i] && this.occupied[i] < 0;
  }
  /** Movement cost multiplier (roads are quick, sand and forest drag). */
  cost(x, y) {
    const i = y * this.w + x;
    const t = this.tiles[i];
    let c = t === T.ROAD ? 0.75 : t === T.SAND ? 1.25 : 1;
    const p = this.propAt[i];
    if (p >= 0) {
      const k = this.props[p].kind;
      if (k === 'tree' || k === 'pine') c *= 1.6;
    }
    return c;
  }

  reveal(cx, cy, r) {
    const r2 = r * r;
    const x0 = Math.max(0, (cx - r) | 0), x1 = Math.min(this.w - 1, (cx + r) | 0);
    const y0 = Math.max(0, (cy - r) | 0), y1 = Math.min(this.h - 1, (cy + r) | 0);
    for (let y = y0; y <= y1; y++) {
      const dy = y - cy;
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        if (dx * dx + dy * dy > r2) continue;
        this.fog[y * this.w + x] = 2;
      }
    }
  }
  /** Visible tiles decay to "remembered" each tick before units re-light them. */
  dimFog() {
    const f = this.fog;
    for (let i = 0; i < f.length; i++) if (f[i] === 2) f[i] = 1;
  }
  seen(x, y) { return this.inside(x, y) && this.fog[y * this.w + x] > 0; }
  visible(x, y) { return this.inside(x, y) && this.fog[y * this.w + x] === 2; }

  // -------------------------------------------------------------
  // A*
  // -------------------------------------------------------------
  /**
   * @returns array of tile coords [{x,y}...] excluding the start tile, or null.
   * `near` allows stopping adjacent to a blocked goal (mines, buildings, enemies).
   */
  findPath(sx, sy, gx, gy, near = 0, maxNodes = 4500) {
    sx |= 0; sy |= 0; gx |= 0; gy |= 0;
    if (!this.inside(sx, sy) || !this.inside(gx, gy)) return null;
    if (sx === gx && sy === gy) return [];

    const w = this.w, h = this.h;
    const gen = ++this._gen;
    const g = this._g, from = this._from, stamp = this._stamp, heap = this._heap;
    heap.clear();

    const H = (x, y) => {
      const dx = Math.abs(x - gx), dy = Math.abs(y - gy);
      return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy);
    };
    const goalOk = (x, y) => {
      if (near <= 0) return x === gx && y === gy;
      const dx = Math.abs(x - gx), dy = Math.abs(y - gy);
      return Math.max(dx, dy) <= near;
    };

    const s = sy * w + sx;
    g[s] = 0; from[s] = -1; stamp[s] = gen;
    heap.push(s, H(sx, sy));

    let expanded = 0, found = -1;
    while (heap.size) {
      const cur = heap.pop();
      const cx = cur % w, cy = (cur / w) | 0;
      if (goalOk(cx, cy)) { found = cur; break; }
      if (++expanded > maxNodes) break;

      for (let d = 0; d < 8; d++) {
        const dx = DX[d], dy = DY[d];
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        const isGoalCell = (nx === gx && ny === gy);
        if (!this.passable(nx, ny) && !(near > 0 && isGoalCell)) continue;
        // no corner-cutting through blocked diagonals
        if (dx && dy && (!this.passable(cx + dx, cy) || !this.passable(cx, cy + dy))) continue;
        const step = (dx && dy ? Math.SQRT2 : 1) * this.cost(nx, ny);
        const ng = g[cur] + step;
        if (stamp[ni] === gen && ng >= g[ni]) continue;
        stamp[ni] = gen; g[ni] = ng; from[ni] = cur;
        heap.push(ni, ng + H(nx, ny));
      }
    }
    if (found < 0) return null;

    const path = [];
    let c = found;
    while (c !== s && c >= 0) {
      path.push({ x: c % w, y: (c / w) | 0 });
      c = from[c];
    }
    path.reverse();
    return path;
  }

  /**
   * Nearest walkable tile that touches the rectangle (tx,ty,fw,fh), measured
   * from the pixel position (fx,fy). Units use this to walk *up to* mines and
   * buildings instead of trying to stand inside them.
   */
  approachTile(tx, ty, fw, fh, fx, fy) {
    let best = null, bestD = Infinity;
    for (let r = 1; r <= 3 && !best; r++) {
      for (let y = ty - r; y < ty + fh + r; y++) {
        for (let x = tx - r; x < tx + fw + r; x++) {
          if (x >= tx && x < tx + fw && y >= ty && y < ty + fh) continue;
          if (!this.passable(x, y)) continue;
          const dx = x * 16 + 8 - fx, dy = y * 16 + 8 - fy;
          const d = dx * dx + dy * dy;
          if (d < bestD) { bestD = d; best = { x, y }; }
        }
      }
    }
    return best || this.nearestFree(tx, ty, 6);
  }

  /** Closest walkable tile to (x,y), searched in rings. */
  nearestFree(x, y, maxR = 8) {
    x = clamp(x | 0, 0, this.w - 1); y = clamp(y | 0, 0, this.h - 1);
    if (this.passable(x, y)) return { x, y };
    for (let r = 1; r <= maxR; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const nx = x + dx, ny = y + dy;
          if (this.passable(nx, ny)) return { x: nx, y: ny };
        }
      }
    }
    return { x, y };
  }
}

const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DY = [0, 0, 1, -1, 1, -1, 1, -1];

export const toTile = (px) => Math.floor(px / TILE);
export const toPx = (t) => t * TILE + TILE / 2;
