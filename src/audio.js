// ===================================================================
// audio.js — WebAudio chiptune. No samples, just square waves.
// ===================================================================
const SFX = {
  place:   { type: 'square',   f: 220, to: 440, d: 0.10, v: 0.16 },
  build:   { type: 'square',   f: 330, to: 660, d: 0.22, v: 0.16 },
  coin:    { type: 'square',   f: 880, to: 1320, d: 0.08, v: 0.10 },
  hit:     { type: 'square',   f: 160, to: 90,  d: 0.06, v: 0.11 },
  bow:     { type: 'sawtooth', f: 620, to: 300, d: 0.07, v: 0.08 },
  cast:    { type: 'triangle', f: 420, to: 900, d: 0.16, v: 0.11 },
  boom:    { type: 'sawtooth', f: 180, to: 60,  d: 0.28, v: 0.16, noise: true },
  die:     { type: 'square',   f: 300, to: 70,  d: 0.22, v: 0.12 },
  crash:   { type: 'sawtooth', f: 140, to: 40,  d: 0.5,  v: 0.20, noise: true },
  level:   { type: 'square',   f: 523, to: 1046, d: 0.30, v: 0.14, arp: [0, 4, 7, 12] },
  recruit: { type: 'square',   f: 392, to: 784, d: 0.20, v: 0.13, arp: [0, 5, 9] },
  flag:    { type: 'triangle', f: 500, to: 760, d: 0.16, v: 0.13 },
  reward:  { type: 'square',   f: 660, to: 1320, d: 0.32, v: 0.14, arp: [0, 7, 12, 16] },
  heal:    { type: 'triangle', f: 700, to: 1100, d: 0.18, v: 0.10 },
  drink:   { type: 'triangle', f: 300, to: 520, d: 0.14, v: 0.10 },
  order:   { type: 'square',   f: 520, to: 620, d: 0.06, v: 0.09 },
  warn:    { type: 'sawtooth', f: 200, to: 150, d: 0.45, v: 0.16, arp: [0, -3] },
  win:     { type: 'square',   f: 523, to: 1568, d: 0.9,  v: 0.18, arp: [0, 4, 7, 12, 16, 19] },
  lose:    { type: 'sawtooth', f: 330, to: 80,  d: 1.1,  v: 0.18 },
  ui:      { type: 'square',   f: 700, to: 700, d: 0.03, v: 0.07 }
};

// A short, slightly melancholy loop. Degrees in a natural minor scale.
const SCALE = [0, 2, 3, 5, 7, 8, 10, 12];
const MELODY = [0, 4, 3, 4, 2, 4, 3, 1, 0, 2, 3, 5, 4, 3, 2, 1];
const BASS = [0, 0, 5, 5, 3, 3, 4, 4];

export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicOn = true;
    this.master = null;
    this.musicTimer = null;
    this.step = 0;
  }

  ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 1;
    this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.32;
    this.musicBus.connect(this.master);
    return this.ctx;
  }

  resume() {
    const c = this.ensure();
    if (c && c.state === 'suspended') c.resume();
    if (this.musicOn) this.startMusic();
  }

  play(name) {
    if (this.muted) return;
    const s = SFX[name];
    if (!s) return;
    const c = this.ensure();
    if (!c || c.state !== 'running') return;
    const now = c.currentTime;
    const notes = s.arp || [0];
    notes.forEach((semi, i) => {
      const t = now + i * (s.d / notes.length) * 0.85;
      const o = c.createOscillator();
      const gain = c.createGain();
      o.type = s.type;
      const mul = Math.pow(2, semi / 12);
      o.frequency.setValueAtTime(s.f * mul, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(30, s.to * mul), t + s.d);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(s.v, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + s.d);
      o.connect(gain); gain.connect(this.sfxBus);
      o.start(t); o.stop(t + s.d + 0.02);
    });
  }

  // --- background music ------------------------------------------
  startMusic() {
    const c = this.ensure();
    if (!c || this.musicTimer) return;
    const tick = () => {
      if (!this.musicOn || this.muted || c.state !== 'running') return;
      const t = c.currentTime + 0.02;
      const root = 196;                            // G3
      const m = MELODY[this.step % MELODY.length];
      const b = BASS[(this.step >> 1) % BASS.length];
      this.blip(root * 2 * Math.pow(2, SCALE[m % SCALE.length] / 12), t, 0.28, 'square', 0.05);
      if (this.step % 2 === 0) {
        this.blip(root / 2 * Math.pow(2, SCALE[b % SCALE.length] / 12), t, 0.5, 'triangle', 0.09);
      }
      this.step++;
    };
    this.musicTimer = setInterval(tick, 320);
  }
  blip(freq, t, dur, type, vol) {
    const c = this.ctx;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.musicBus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }
  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (this.musicOn) this.startMusic();
    return this.musicOn;
  }
}
