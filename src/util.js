// Small shared helpers: deterministic RNG, math, a binary heap for A*.

/** Mulberry32 — tiny deterministic PRNG so a seed always rebuilds the same realm. */
export function makeRng(seed) {
  let a = seed >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.int = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
  rng.range = (lo, hi) => lo + rng() * (hi - lo);
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.chance = (p) => rng() < p;
  rng.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  return rng;
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
};
export const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));

/** Move `cur` toward `target` by at most `max`. */
export const approach = (cur, target, max) => {
  const d = target - cur;
  if (Math.abs(d) <= max) return target;
  return cur + Math.sign(d) * max;
};

/** Min-heap keyed by numeric score. Used by the A* open set. */
export class Heap {
  constructor() { this.items = []; this.score = []; }
  get size() { return this.items.length; }
  clear() { this.items.length = 0; this.score.length = 0; }
  push(item, score) {
    const it = this.items, sc = this.score;
    it.push(item); sc.push(score);
    let i = it.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (sc[p] <= sc[i]) break;
      [it[p], it[i]] = [it[i], it[p]];
      [sc[p], sc[i]] = [sc[i], sc[p]];
      i = p;
    }
  }
  pop() {
    const it = this.items, sc = this.score;
    const top = it[0];
    const last = it.pop(), lastS = sc.pop();
    if (it.length) {
      it[0] = last; sc[0] = lastS;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < sc.length && sc[l] < sc[m]) m = l;
        if (r < sc.length && sc[r] < sc[m]) m = r;
        if (m === i) break;
        [it[m], it[i]] = [it[i], it[m]];
        [sc[m], sc[i]] = [sc[i], sc[m]];
        i = m;
      }
    }
    return top;
  }
}

/** Fantasy name generator — heroes need names you can mourn. */
const FIRST = ['Aldric','Bryn','Corvin','Dara','Eryn','Fendrel','Gwyn','Hale','Ivo','Jora','Kael','Lyra',
  'Maren','Nyx','Orin','Perrin','Quill','Rhea','Sorrel','Tavin','Ulric','Vesna','Wren','Yarin','Zeph',
  'Mira','Brack','Thrain','Isolde','Rurik','Sable','Halvar','Edda','Cassius','Nell','Torvald','Yseult'];
const LAST = ['the Bold','of Ashvale','Ironhand','the Quick','Stormcloak','Brightblade','the Meek',
  'Ravenwood','Emberfell','the Thrifty','Oakenshield','Nightspur','the Lucky','Grimsdottir','Farwalker',
  'the Greedy','Silverfoot','of Thornhold','Hollowmoor','the Stout'];
export function heroName(rng) {
  return `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
}

/** Peasants get a plain given name. You are assigning them a life, after all. */
export function peasantName(rng) {
  return rng.pick(FIRST);
}

export const fmt = (n) => {
  n = Math.floor(n);
  return n >= 10000 ? (n / 1000).toFixed(1) + 'k' : String(n);
};
