// ===================================================================
// sheet.js — a contact sheet of every hero sprite, reached with
// `?sprites=1`. Not part of the game: it exists so the art can be
// judged side by side, at size, without levelling anyone to see it.
// ===================================================================
import { unitSprite, itemSprite, makeCanvas, SPEC_SPRITES, PAL } from './art.js';
import { CLASSES, HERO_CLASSES, SPECS } from './data.js';
import { TIERS, TIER_ORDER } from './items.js';

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

/** Every kind of thing a hero can wear or swing, in the order it reads. */
const ITEM_KINDS = ['sword', 'axe', 'dagger', 'staff', 'wand', 'chest', 'neck', 'ear', 'ring'];
const LOOT_CELL = 16 * 3 + 10;
const LOOT_ROWS = TIER_ORDER.length * LOOT_CELL + LABEL + 28;

/** Draw the sheet onto a fresh canvas and return it. */
export function drawSpriteSheet() {
  const cols = 1 + Math.max(...HERO_CLASSES.map(k => (SPEC_SPRITES[k] || []).length));
  const c = makeCanvas(
    Math.max(cols * CELL + 90, ITEM_KINDS.length * LOOT_CELL + 90),
    HERO_CLASSES.length * ROW + LOOT_ROWS + 10);
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

  // the loot, every kind against every tier: the icon is the same silhouette
  // throughout, so this is really a check on the metal and the stone
  const ly = 10 + HERO_CLASSES.length * ROW + 14;
  ctx.fillStyle = PAL.gold;
  ctx.fillText('LOOT', 8, ly - 12);
  ITEM_KINDS.forEach((kind, i) => {
    const x0 = 90 + i * LOOT_CELL;
    ctx.fillStyle = PAL.stoneL;
    ctx.fillText(kind, x0, ly - 12);
    TIER_ORDER.forEach((tier, r) => {
      const y = ly + r * LOOT_CELL;
      ctx.fillStyle = TIERS[tier].colour;
      ctx.fillRect(x0, y, 16 * 3 + 4, 16 * 3 + 4);
      ctx.fillStyle = '#241a38';
      ctx.fillRect(x0 + 2, y + 2, 16 * 3, 16 * 3);
      ctx.drawImage(itemSprite(kind, tier), x0 + 2, y + 2, 16 * 3, 16 * 3);
      if (!i) {
        ctx.fillStyle = TIERS[tier].colour;
        ctx.fillText(TIERS[tier].name, 8, y + 16);
      }
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
