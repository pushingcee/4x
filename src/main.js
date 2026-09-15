// ===================================================================
// main.js — boot, the frame loop, and first-run onboarding.
// ===================================================================
import { Game } from './game.js';
import { Renderer } from './render.js';
import { UI } from './ui.js';
import { Audio } from './audio.js';

const boot = document.getElementById('boot');
const bar = document.getElementById('bootbar');
const msg = document.getElementById('bootmsg');

const step = (pct, text) => new Promise(res => {
  bar.style.width = pct + '%';
  msg.textContent = text;
  requestAnimationFrame(() => setTimeout(res, 16));
});

function seedFromUrl() {
  const p = new URLSearchParams(location.search);
  const s = p.get('seed');
  if (s && /^\d+$/.test(s)) return (+s) >>> 0;
  return (Math.random() * 1e9) >>> 0;
}

async function start() {
  const seed = seedFromUrl();
  await step(12, 'raising mountains...');

  const audio = new Audio();
  const game = new Game(seed, audio);
  await step(55, 'planting forests...');

  const canvas = document.getElementById('view');
  const renderer = new Renderer(canvas, game);
  renderer.topInset = 36;
  await step(82, 'waking the monsters...');

  const ui = new UI(game, renderer, audio, document.getElementById('app'));
  renderer.centerOn(game.palace.x, game.palace.y + 12);
  await step(100, 'long live the realm');

  document.getElementById('app').hidden = false;
  boot.classList.add('gone');
  setTimeout(() => boot.remove(), 600);

  // expose for debugging from the console
  window.REALM = { game, renderer, ui, audio };

  if (!localStorage.getItem('realm.seen')) {
    try { localStorage.setItem('realm.seen', '1'); } catch (_) { /* private mode */ }
    ui.showModal(`
      <h2>Welcome, sovereign</h2>
      <p>You are a small god with a valley full of peasants. You do not micromanage them &mdash;
      you tell them <b>what they are for</b>, and they go and do it.</p>
      <p><b>1.</b> Tap your <b>City Centre</b> and hire a few peasants.</p>
      <p><b>2.</b> Tap one and choose a calling: <b>Mine</b>, <b>Wood</b>, <b>Stone</b> or <b>Build</b>.
      They will hunt down the nearest seam themselves and keep at it forever.</p>
      <p><b>3.</b> Use the <b>Folk</b> tab to move your workforce around, or pick one villager
      by name. Work trains them: every calling raises two attributes.</p>
      <p><b>4.</b> <b>Build</b> a Barracks, set a villager's calling to <b>War</b>, then raise an
      attack <b>Flag</b> on a monster lair and watch the greedy fool charge in.</p>
      <p><b>Getting around.</b> One finger pans, two fingers pinch to zoom, and
      <b>Zoom</b> steps through Close / Mid / Far / Wide. Tap the little map in the corner
      to open the whole realm, then tap anywhere on it to jump there.</p>
      <p>Select any hero or peasant and hit <b>Follow</b> to ride along with them.</p>
      <p>Destroy every lair to win.</p>`,
      [{ label: 'Rule the realm', cls: 'primary', fn: () => ui.hideModal() }]);
  }

  // ---- frame loop ------------------------------------------------
  let last = performance.now();
  let acc = 0;
  const FIXED = 1 / 60;

  function frame(now) {
    const raw = Math.min((now - last) / 1000, 0.25);
    last = now;
    acc += raw;
    let guard = 0;
    while (acc >= FIXED && guard++ < 5) {
      game.update(FIXED);
      acc -= FIXED;
    }
    renderer.draw(raw);
    ui.update(raw);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // keep the canvas honest across rotation / URL-bar resize
  const onResize = () => renderer.resize();
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 200));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', () => { last = performance.now(); });
  // any first touch unlocks WebAudio on iOS
  const unlock = () => { audio.resume(); window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock);
}

start().catch(err => {
  msg.textContent = 'Failed to start: ' + err.message;
  console.error(err);
});
