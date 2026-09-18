// ===================================================================
// sheet.js — a contact sheet of every hero sprite, reached with
// `?sprites=1`. Not part of the game: it exists so the art can be
// judged side by side, at size, without levelling anyone to see it.
// ===================================================================
import { unitSprite, makeCanvas, SPEC_SPRITES, PAL } from './art.js';
import { CLASSES, HERO_CLASSES, SPECS } from './data.js';

const SCALE = 5;
const CELL = 16 * SCALE + 12;
const LABEL = 14;
const ROW = CELL * 2 + LABEL + 18;

/** The name a specialisation goes by, whether or not it is in the game yet. */
const NAMES = { blood: 'Blood', fire: 'Fire', dark: 'Dark', light: 'Light', paladin: 'Paladin' };
const nameOf = (kind, spec) => {
  const sp = (SPECS[kind] || []).find(x => x.id === spec);
  return sp ? sp.name : NAMES[spec] || spec;
};

/** Draw the sheet onto a fresh canvas and return it. */
export function drawSpriteSheet() {
  const cols = 1 + Math.max(...HERO_CLASSES.map(k => (SPEC_SPRITES[k] || []).length));
  const c = makeCanvas(cols * CELL + 90, HERO_CLASSES.length * ROW + 10);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#2a2036';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.font = '12px monospace';
  ctx.textBaseline = 'top';

  HERO_CLASSES.forEach((kind, r) => {
    const y0 = 10 + r * ROW;
    ctx.fillStyle = PAL.gold;
    ctx.fillText(CLASSES[kind].name.toUpperCase(), 8, y0 + CELL - 6);
    const keys = [kind, ...(SPEC_SPRITES[kind] || []).map(sp => `${kind}/${sp}`)];
    keys.forEach((key, i) => {
      const x0 = 90 + i * CELL;
      // idle and step, on grass, facing right
      [0, 1].forEach(frame => {
        const y = y0 + frame * CELL;
        ctx.fillStyle = frame ? PAL.grass3 : PAL.grass1;
        ctx.fillRect(x0, y, 16 * SCALE, 16 * SCALE);
        ctx.drawImage(unitSprite(key, frame, 1), x0, y, 16 * SCALE, 16 * SCALE);
      });
      ctx.fillStyle = i ? PAL.white : PAL.stoneL;
      ctx.fillText(i ? nameOf(kind, key.slice(kind.length + 1)) : 'base', x0, y0 + CELL * 2 + 2);
    });
  });
  return c;
}

/** Drop the sheet over the page. Tap it to dismiss. */
export function spriteSheet(parent) {
  const wrap = document.createElement('div');
  wrap.id = 'sheet';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:99;overflow:auto;background:#1a1226;padding:8px';
  const c = drawSpriteSheet();
  c.style.imageRendering = 'pixelated';
  wrap.appendChild(c);
  wrap.addEventListener('click', () => wrap.remove());
  parent.appendChild(wrap);
  return wrap;
}
