// ===================================================================
// fx.js — floating numbers, puffs, sparks. Purely cosmetic.
// ===================================================================
export class Fx {
  constructor() { this.parts = []; this.texts = []; }

  text(x, y, str, col = '#f2e9ff', rise = 22) {
    this.texts.push({ x, y, str, col, t: 0, life: 1.1, rise });
  }
  damage(x, y, n, crit = false) {
    this.text(x, y - 6, '-' + Math.round(n), crit ? '#ffc94a' : '#ff8080', 18);
  }
  coin(x, y, n) { this.text(x, y - 8, '+' + Math.round(n), '#ffc94a', 20); }

  burst(x, y, col, n = 8, spd = 40, life = 0.5) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = spd * (0.4 + Math.random() * 0.8);
      this.parts.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 12,
        col, t: 0, life: life * (0.6 + Math.random() * 0.7), g: 46, sz: 1 + (Math.random() < 0.3 ? 1 : 0)
      });
    }
  }
  puff(x, y, col = '#d8cfe6', n = 5) {
    for (let i = 0; i < n; i++) {
      this.parts.push({
        x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 4,
        vx: (Math.random() - 0.5) * 10, vy: -8 - Math.random() * 10,
        col, t: 0, life: 0.45 + Math.random() * 0.3, g: -6, sz: 1
      });
    }
  }
  ring(x, y, col, r = 18) {
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.parts.push({
        x, y, vx: Math.cos(a) * r * 2, vy: Math.sin(a) * r * 2,
        col, t: 0, life: 0.34, g: 0, sz: 1
      });
    }
  }

  update(dt) {
    const p = this.parts;
    for (let i = p.length - 1; i >= 0; i--) {
      const q = p[i];
      q.t += dt;
      if (q.t >= q.life) { p.splice(i, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.g * dt;
      q.vx *= 0.94;
    }
    const t = this.texts;
    for (let i = t.length - 1; i >= 0; i--) {
      const q = t[i];
      q.t += dt;
      if (q.t >= q.life) t.splice(i, 1);
    }
  }
}
