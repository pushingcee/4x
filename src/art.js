// ===================================================================
// art.js — every pixel in this game is generated at runtime.
// A shared humanoid template gives all the little folk the same
// 16-bit silhouette; palettes and overlays make them distinct.
// ===================================================================

export const TILE = 16;

/** Curated 16-bit-ish palette. */
export const PAL = {
  none: null,
  outline: '#1a1226',
  shadow: 'rgba(12,8,20,0.35)',

  // terrain
  water1: '#2a4a7a', water2: '#20406e', water3: '#3d6aa3',
  sand: '#d9b37a', sandD: '#b58e57',
  grass1: '#3c7a3f', grass2: '#4a8f47', grass3: '#2f6335', grassDry: '#6e9142',
  dirt: '#7a5b3a', dirtD: '#5e452b',
  rock: '#6b6b7d', rockD: '#4b4b5c', rockL: '#8f8fa3',
  snow: '#dfe7f2',

  // wood & stone
  wood: '#8a5a2e', woodL: '#b4753a', woodD: '#5e3c1e',
  stone: '#8d94a6', stoneL: '#b6bccb', stoneD: '#5e6473',
  roofR: '#a63a3a', roofRD: '#7a2626', roofB: '#3a5aa6', roofBD: '#26397a',
  roofG: '#3a8a5a', roofGD: '#25603d', roofP: '#6f3a8a', roofPD: '#4a2360',
  thatch: '#c9a14a', thatchD: '#9b7930',

  // people
  skin: '#e8b08a', skinD: '#c08560', skinPale: '#efd6bf',
  hairB: '#4a3220', hairR: '#a6522a', hairW: '#d9d2c4', hairK: '#2b2130',
  eye: '#1a1226',
  cloth: {
    peasant: '#8a7a5a', peasantT: '#6b5c3e',
    warrior: '#a63a3a', warriorT: '#e0c060',
    ranger: '#3a7a4a', rangerT: '#274f33',
    wizard: '#4a4aa6', wizardT: '#8fa0ff',
    cleric: '#e6e2d2', clericT: '#e0c060',
    guard: '#4a5a7a', guardT: '#9fb0cc',
    rogue: '#5a3a6a', rogueT: '#c08adf'
  },
  metal: '#b9c2d0', metalD: '#79808f', gold: '#ffc94a', goldD: '#b8801c',
  pants: '#3f4a5e', pantsD: '#2a3244', boot: '#4a3220',

  // specialisations: each one owns a colour the base classes do not use
  spec: {
    fury: '#ff7a3a', furyD: '#8a2626',
    arms: '#ffc94a', armsD: '#7a2e2e',
    prot: '#3a5aa6', protL: '#6fb6ff',
    bow: '#7fd8a0', bowD: '#2f6a3f', bowM: '#3f8a4f',
    merc: '#c9a227', mercD: '#7a5a32',
    sin: '#9b6fff', sinD: '#2c1f3a', sinM: '#3d2a55', sinP: '#221a2e',
    blood: '#c8203a', bloodD: '#7a1024', bloodP: '#5a0c1a', bloodK: '#2a0810', bloodL: '#ff6a7a',
    fire: '#ff8a2a', fireD: '#b4341e', fireY: '#ffe066', fireT: '#ffb020', fireP: '#8a2214', fireK: '#4a1a10',
    dark: '#7a3fbf', darkD: '#241a36', darkM: '#5a2f8f', darkL: '#b57cff', darkW: '#3a2a4a', darkS: '#cfc3d6',
    light: '#ffe9a0', lightW: '#fff6c8', lightR: '#f4f0e4', lightH: '#e8d6a0', lightB: '#7a2626',
    pal: '#e0c060', palW: '#e6e2d2'
  },

  // monsters
  gob: '#6a9a3a', gobD: '#48701f',
  bone: '#e4e0cf', boneD: '#a8a292',
  ratF: '#6d5b4a', ratFD: '#4b3e32',
  ogre: '#9a7a5a', ogreD: '#6e553c',
  demon: '#b4402a', demonD: '#7d2718',
  slime: '#5fd0a0', slimeD: '#2f8c68',
  troll: '#7a9a6a', trollD: '#4f6a44', moss: '#4a8f47',
  wraith: '#6f8fb8', wraithL: '#a8c8e8', wraithG: '#8fe0ff',
  cult: '#5a1020', cultD: '#3a0a14',
  spider: '#3a2a44', spiderL: '#5a4466',
  drake: '#c85a2a', drakeD: '#8a2e1e', drakeB: '#e0a060',

  // fx / ui
  red: '#e05050', green: '#6ecf8e', blue: '#5aa0e6', purple: '#a06ecf',
  white: '#f2e9ff', black: '#120c1c'
};

// ---------------------------------------------------------------
// canvas helpers
// ---------------------------------------------------------------
export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  return c;
}

/** Paint a char-grid onto a context. `map` turns chars into colors. */
function paint(ctx, rows, map, ox = 0, oy = 0) {
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const col = map[row[x]];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
}
export { paint };

const px = (ctx, x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); };

// ---------------------------------------------------------------
// humanoid template
// ---------------------------------------------------------------
const HEAD = [
  '................',
  '.....oooooo.....',
  '....ohhhhhho....',
  '....ohssssho....',
  '....osesseso....',
  '....osssssso....',
  '.....osssso.....'
];
const TORSO = [
  '....occcccco....',
  '...soccccccos...',
  '...soccccccos...',
  '....otttttto....',
  '....oppppppo....'
];
const LEGS_A = [
  '....oppooppo....',
  '....oppooppo....',
  '....okkookko....'
];
const LEGS_B = [
  '....oppooppo....',
  '...oppo..oppo...',
  '...okko...okko..'
];

/**
 * Build one 16x16 humanoid.
 * opts: {skin,hair,cloth,trim,pants,boot,frame}
 */
function humanoid(ctx, o, frame) {
  const map = {
    '.': null, o: PAL.outline, h: o.hair, s: o.skin, e: PAL.eye,
    c: o.cloth, t: o.trim, p: o.pants, k: o.boot
  };
  const bob = frame === 1 ? -1 : 0;
  paint(ctx, HEAD, map, 0, 1 + bob);
  paint(ctx, TORSO, map, 0, 8 + bob);
  if (!o.legless) paint(ctx, frame === 1 ? LEGS_B : LEGS_A, map, 0, 13);
}

// ---------------------------------------------------------------
// per-class overlays (weapons, hats, tools)
// ---------------------------------------------------------------
const OVERLAY = {
  warrior(ctx) {                                   // helm + sword + shield
    px(ctx, 4, 2, 8, 1, PAL.metal);
    px(ctx, 4, 3, 1, 2, PAL.metal); px(ctx, 11, 3, 1, 2, PAL.metal);
    px(ctx, 13, 4, 1, 8, PAL.outline);             // blade edge
    px(ctx, 12, 4, 1, 8, PAL.metal);
    px(ctx, 11, 11, 3, 1, PAL.goldD);              // crossguard
    px(ctx, 12, 12, 1, 2, PAL.wood);               // grip
    px(ctx, 1, 9, 3, 5, PAL.woodD);                // shield
    px(ctx, 2, 10, 1, 3, PAL.metal);
  },
  ranger(ctx) {                                    // hood + bow + quiver
    px(ctx, 4, 1, 8, 2, PAL.cloth.rangerT);
    px(ctx, 3, 3, 1, 3, PAL.cloth.rangerT);
    px(ctx, 12, 3, 1, 3, PAL.cloth.rangerT);
    px(ctx, 2, 6, 1, 7, PAL.wood);                 // bow limb
    px(ctx, 3, 5, 1, 1, PAL.wood); px(ctx, 3, 13, 1, 1, PAL.wood);
    px(ctx, 1, 7, 1, 5, PAL.stoneL);               // string
    px(ctx, 12, 7, 2, 4, PAL.woodD);               // quiver
    px(ctx, 12, 6, 1, 1, PAL.metal); px(ctx, 13, 6, 1, 1, PAL.metal);
  },
  wizard(ctx) {                                    // pointy hat + staff
    px(ctx, 7, -1, 2, 1, PAL.cloth.wizardT);
    px(ctx, 6, 0, 4, 1, PAL.cloth.wizard);
    px(ctx, 5, 1, 6, 1, PAL.cloth.wizard);
    px(ctx, 3, 2, 10, 1, PAL.cloth.wizardT);
    px(ctx, 13, 3, 1, 12, PAL.wood);               // staff
    px(ctx, 12, 2, 3, 2, PAL.blue);
    px(ctx, 13, 2, 1, 1, PAL.white);
  },
  cleric(ctx) {                                    // mitre + mace + halo
    px(ctx, 5, 0, 6, 2, PAL.cloth.cleric);
    px(ctx, 7, -1, 2, 1, PAL.gold);
    px(ctx, 4, 2, 8, 1, PAL.gold);
    px(ctx, 13, 8, 2, 3, PAL.metal);
    px(ctx, 13, 11, 1, 4, PAL.wood);
    px(ctx, 6, 10, 4, 1, PAL.gold); px(ctx, 7, 9, 2, 3, PAL.gold);
  },
  peasant(ctx) {                                   // straw hat + hoe
    px(ctx, 3, 2, 10, 1, PAL.thatch);
    px(ctx, 4, 1, 8, 1, PAL.thatchD);
    px(ctx, 13, 4, 1, 11, PAL.wood);
    px(ctx, 11, 4, 3, 1, PAL.metalD);
  },
  guard(ctx) {                                     // helm + spear
    px(ctx, 4, 2, 8, 1, PAL.metal);
    px(ctx, 7, 0, 2, 2, PAL.red);
    px(ctx, 13, 1, 1, 14, PAL.wood);
    px(ctx, 12, 1, 3, 2, PAL.metal);
    px(ctx, 1, 9, 3, 5, PAL.guardT !== undefined ? PAL.cloth.guardT : PAL.metal);
  },
  goblin(ctx) {                                    // big ears + crude blade
    px(ctx, 2, 4, 2, 2, PAL.gob); px(ctx, 12, 4, 2, 2, PAL.gob);
    px(ctx, 1, 3, 1, 2, PAL.gobD); px(ctx, 14, 3, 1, 2, PAL.gobD);
    px(ctx, 13, 6, 1, 6, PAL.metalD);
    px(ctx, 12, 11, 3, 1, PAL.woodD);
  },
  skeleton(ctx) {                                  // ribs + scythe
    px(ctx, 5, 9, 6, 1, PAL.boneD);
    px(ctx, 5, 11, 6, 1, PAL.boneD);
    px(ctx, 13, 2, 1, 13, PAL.woodD);
    px(ctx, 10, 2, 4, 1, PAL.metal);
    px(ctx, 10, 3, 1, 1, PAL.metal);
  },
  ogre(ctx) {                                      // horns + club
    px(ctx, 3, 1, 1, 2, PAL.bone); px(ctx, 12, 1, 1, 2, PAL.bone);
    px(ctx, 12, 5, 3, 6, PAL.woodD);
    px(ctx, 13, 11, 1, 4, PAL.wood);
    px(ctx, 12, 5, 1, 1, PAL.stone); px(ctx, 14, 7, 1, 1, PAL.stone);
  },
  demon(ctx) {
    px(ctx, 3, 2, 1, 3, PAL.demonD); px(ctx, 12, 2, 1, 3, PAL.demonD);
    px(ctx, 2, 8, 2, 5, PAL.demonD); px(ctx, 12, 8, 2, 5, PAL.demonD);
    px(ctx, 13, 4, 1, 9, PAL.metal);
  },
  troll(ctx) {                                     // nose, tusks, moss, a slab of a club
    px(ctx, 7, 5, 2, 2, PAL.trollD);
    px(ctx, 6, 7, 1, 1, PAL.bone); px(ctx, 9, 7, 1, 1, PAL.bone);
    px(ctx, 5, 9, 1, 1, PAL.moss); px(ctx, 9, 10, 1, 1, PAL.moss); px(ctx, 6, 2, 1, 1, PAL.moss);
    px(ctx, 12, 3, 3, 8, PAL.woodD);
    px(ctx, 13, 11, 1, 4, PAL.wood);
    px(ctx, 12, 4, 1, 1, PAL.stone); px(ctx, 14, 6, 1, 1, PAL.stone); px(ctx, 13, 9, 1, 1, PAL.stone);
  },
  wraith(ctx, frame) {                             // hood, a void for a face, tatters, no feet
    hood(ctx, PAL.wraith);
    px(ctx, 6, 4, 1, 1, PAL.wraithG); px(ctx, 9, 4, 1, 1, PAL.wraithG);
    px(ctx, 5, 12, 1, 2 - frame, PAL.wraith); px(ctx, 7, 12, 1, 3, PAL.wraith);
    px(ctx, 9, 12, 1, 2 + frame, PAL.wraith); px(ctx, 10, 12, 1, 1, PAL.wraith);
    px(ctx, 6, 14, 1, 1, PAL.wraithL); px(ctx, 8, 15 - frame, 1, 1, PAL.wraithL);
    px(ctx, 1, 6 + frame, 1, 1, PAL.wraithG); px(ctx, 14, 9 - frame, 1, 1, PAL.wraithG);
  },
  cultist(ctx) {                                   // crimson hood, red eyes, skull staff
    hood(ctx, PAL.cult);
    px(ctx, 6, 4, 1, 1, PAL.spec.blood); px(ctx, 9, 4, 1, 1, PAL.spec.blood);
    px(ctx, 7, 9, 2, 1, PAL.spec.blood);
    staff(ctx, PAL.woodD, PAL.bone);
    px(ctx, 12, 2, 1, 1, PAL.outline); px(ctx, 14, 2, 1, 1, PAL.outline);
  },
  slime() {}
};


// ---------------------------------------------------------------
// specialisations -- the same little folk, dressed for the job they
// chose at the cap. Keyed `class/spec`; each replaces the class overlay
// and recolours the body, so every one reads at a glance on the map.
// ---------------------------------------------------------------
const SPEC_BODY = {
  // warriors
  'warrior/fury': { hair: PAL.hairR, cloth: PAL.spec.furyD, trim: PAL.spec.fury, pants: PAL.pantsD },
  'warrior/arms': { hair: PAL.hairB, cloth: PAL.spec.armsD, trim: PAL.gold, pants: PAL.pantsD },
  'warrior/protection': { hair: PAL.hairB, cloth: PAL.metal, trim: PAL.metalD, pants: PAL.pantsD },
  // rangers
  'ranger/longbow': { hair: PAL.hairB, cloth: PAL.spec.bowM, trim: PAL.spec.bow, pants: PAL.pants },
  'ranger/mercenary': { hair: PAL.hairB, cloth: PAL.spec.mercD, trim: PAL.spec.merc, pants: PAL.pantsD },
  'ranger/assassin': { hair: PAL.hairK, cloth: PAL.spec.sinD, trim: PAL.spec.sin, pants: PAL.spec.sinP, boot: PAL.outline },
  // wizards
  'wizard/blood': { skin: PAL.skinPale, hair: PAL.hairK, cloth: PAL.spec.bloodD, trim: PAL.spec.blood, pants: PAL.spec.bloodP, boot: PAL.spec.bloodK },
  'wizard/fire': { skin: PAL.skin, hair: PAL.hairR, cloth: PAL.spec.fireD, trim: PAL.spec.fireT, pants: PAL.spec.fireP, boot: PAL.spec.fireK },
  'wizard/dark': { skin: PAL.spec.darkS, hair: PAL.hairK, cloth: PAL.spec.darkD, trim: PAL.spec.dark, pants: PAL.black, boot: PAL.black },
  // clerics
  'cleric/light': { skin: PAL.skin, hair: PAL.spec.lightH, cloth: PAL.spec.lightR, trim: PAL.gold, pants: PAL.spec.palW, boot: PAL.boot },
  'cleric/paladin': { skin: PAL.skin, hair: PAL.hairB, cloth: PAL.metal, trim: PAL.gold, pants: PAL.metalD, boot: PAL.boot }
};

/** A sword held on the right (x = 12..14) or the left (x = 1..3). */
function blade(ctx, side, top, len, grip = PAL.wood) {
  const bx = side > 0 ? 12 : 3, ex = side > 0 ? 13 : 2;
  px(ctx, ex, top, 1, len, PAL.outline);         // dark edge
  px(ctx, bx, top, 1, len, PAL.metal);
  px(ctx, bx - 1, top + len, 3, 1, PAL.goldD);   // crossguard
  px(ctx, bx, top + len + 1, 1, 2, grip);
}
/** A full helm over the hair rows, with cheek guards. */
function helm(ctx, top = PAL.metalD, main = PAL.metal, cheeks = 3) {
  px(ctx, 4, 1, 8, 1, top);
  px(ctx, 4, 2, 8, 1, main);
  px(ctx, 4, 3, 1, cheeks, main); px(ctx, 11, 3, 1, cheeks, main);
}
/** A hood that swallows the hair rows and frames the face. */
function hood(ctx, col) {
  px(ctx, 6, 0, 4, 1, col);
  px(ctx, 4, 1, 8, 3, col);
  px(ctx, 3, 3, 1, 4, col); px(ctx, 12, 3, 1, 4, col);
}
/** A staff on the right with a 3x3 head at the top. */
function staff(ctx, shaft, head, y = 3) {
  px(ctx, 13, y, 1, 15 - y, shaft);
  if (head) px(ctx, 12, y - 2, 3, 3, head);
}
/** A gold cross on the chest. */
function cross(ctx, col = PAL.gold) {
  px(ctx, 7, 8, 2, 3, col);
  px(ctx, 6, 9, 4, 1, col);
}

const SPEC_OVERLAY = {
  // ---- warriors -------------------------------------------------
  'warrior/fury'(ctx) {                            // wild hair, warpaint, twin blades
    px(ctx, 5, 1, 1, 1, PAL.hairR); px(ctx, 7, 0, 1, 2, PAL.hairR);
    px(ctx, 9, 0, 1, 2, PAL.hairR); px(ctx, 10, 1, 1, 1, PAL.hairR);
    px(ctx, 6, 5, 1, 1, PAL.spec.fury); px(ctx, 9, 5, 1, 1, PAL.spec.fury);
    px(ctx, 4, 8, 1, 1, PAL.metalD); px(ctx, 11, 8, 1, 1, PAL.metalD);   // studs
    blade(ctx, 1, 3, 8); blade(ctx, -1, 3, 8);
  },
  'warrior/arms'(ctx) {                            // full helm, pauldrons, greatsword
    helm(ctx, PAL.metalD, PAL.metal);
    px(ctx, 7, 0, 2, 1, PAL.gold);                 // crest
    px(ctx, 4, 8, 2, 1, PAL.metal); px(ctx, 10, 8, 2, 1, PAL.metal);
    px(ctx, 12, 0, 1, 1, PAL.metal);               // tip
    px(ctx, 12, 1, 1, 10, PAL.metal); px(ctx, 13, 1, 1, 10, PAL.metalD);
    px(ctx, 11, 11, 4, 1, PAL.gold);               // wide crossguard
    px(ctx, 12, 12, 1, 3, PAL.woodD);
    px(ctx, 12, 15, 1, 1, PAL.gold);               // pommel
  },
  'warrior/protection'(ctx) {                      // plumed helm, tower shield, short sword
    helm(ctx, PAL.metalD, PAL.metal, 4);
    px(ctx, 6, 0, 4, 1, PAL.spec.protL);           // plume
    px(ctx, 7, 8, 2, 3, PAL.spec.prot);            // tabard stripe
    px(ctx, 0, 6, 4, 9, PAL.spec.prot);            // shield
    px(ctx, 0, 6, 4, 1, PAL.metal); px(ctx, 0, 14, 4, 1, PAL.metalD);
    px(ctx, 0, 6, 1, 9, PAL.metalD);
    px(ctx, 1, 9, 2, 2, PAL.metal);                // boss
    blade(ctx, 1, 6, 5);
  },

  // ---- rangers --------------------------------------------------
  'ranger/longbow'(ctx) {                          // deep hood, feather, a bow taller than they are
    px(ctx, 4, 1, 8, 2, PAL.spec.bowD);
    px(ctx, 3, 3, 1, 3, PAL.spec.bowD); px(ctx, 12, 3, 1, 3, PAL.spec.bowD);
    px(ctx, 11, 0, 2, 1, PAL.bone); px(ctx, 12, 1, 1, 1, PAL.bone);   // feather
    px(ctx, 1, 2, 1, 13, PAL.wood);                // limb
    px(ctx, 2, 1, 1, 1, PAL.wood); px(ctx, 2, 15, 1, 1, PAL.wood);
    px(ctx, 2, 8, 1, 2, PAL.woodD);                // grip
    px(ctx, 0, 2, 1, 13, PAL.stoneL);              // string
    px(ctx, 12, 6, 2, 5, PAL.woodD);               // quiver
    px(ctx, 12, 5, 2, 1, PAL.metal); px(ctx, 12, 4, 2, 1, PAL.spec.bow);
  },
  'ranger/mercenary'(ctx) {                        // bandana, scar, sword, short bow, purse
    px(ctx, 5, 2, 6, 1, PAL.roofR);
    px(ctx, 11, 2, 2, 1, PAL.roofR); px(ctx, 12, 3, 1, 1, PAL.roofRD);
    px(ctx, 10, 4, 1, 3, PAL.skinD);               // scar
    blade(ctx, 1, 4, 7);
    px(ctx, 1, 5, 1, 8, PAL.wood);                 // bow slung on the off side
    px(ctx, 2, 4, 1, 1, PAL.wood); px(ctx, 2, 13, 1, 1, PAL.wood);
    px(ctx, 0, 5, 1, 8, PAL.stoneL);
    px(ctx, 9, 11, 2, 1, PAL.gold);                // coin purse
  },
  'ranger/assassin'(ctx) {                         // hood, mask, glowing eyes, twin daggers
    hood(ctx, PAL.spec.sinD);
    px(ctx, 5, 5, 6, 2, PAL.spec.sinM);            // mask
    px(ctx, 6, 4, 1, 1, PAL.spec.darkL); px(ctx, 9, 4, 1, 1, PAL.spec.darkL);
    px(ctx, 13, 7, 1, 5, PAL.metal); px(ctx, 12, 11, 3, 1, PAL.metalD); px(ctx, 13, 12, 1, 2, PAL.spec.sinM);
    px(ctx, 2, 7, 1, 5, PAL.metal); px(ctx, 1, 11, 3, 1, PAL.metalD); px(ctx, 2, 12, 1, 2, PAL.spec.sinM);
  },

  // ---- wizards --------------------------------------------------
  'wizard/blood'(ctx, frame) {                     // crimson hood, red eyes, knife, a floating blood orb
    hood(ctx, PAL.spec.bloodD);
    px(ctx, 6, 4, 1, 1, PAL.spec.blood); px(ctx, 9, 4, 1, 1, PAL.spec.blood);
    px(ctx, 7, 9, 2, 1, PAL.spec.blood);           // rune
    px(ctx, 2, 7, 1, 4, PAL.metal); px(ctx, 2, 10, 1, 1, PAL.spec.blood);
    px(ctx, 1, 11, 3, 1, PAL.goldD); px(ctx, 2, 12, 1, 2, PAL.woodD);
    px(ctx, 12, 6, 3, 3, PAL.spec.blood);          // orb
    px(ctx, 13, 7, 1, 1, PAL.spec.bloodL);
    px(ctx, 13, 9, 1, 1, PAL.spec.bloodD); px(ctx, 14, 10, 1, 1, PAL.spec.bloodD);   // drip
    px(ctx, 12, 4 + frame, 1, 1, PAL.spec.blood); px(ctx, 15, 5 - frame, 1, 1, PAL.spec.bloodL);
  },
  'wizard/fire'(ctx, frame) {                      // burning hat tip, flame staff, ember emblem
    px(ctx, 7, 0, 2, 1, PAL.spec.fireY);
    px(ctx, 6, 1, 4, 1, PAL.spec.fireD);
    px(ctx, 3, 2, 10, 1, PAL.spec.fireT);
    px(ctx, 8, 8, 1, 1, PAL.spec.fireT); px(ctx, 7, 9, 1, 1, PAL.spec.fireT); px(ctx, 8, 9, 1, 1, PAL.spec.fireY);
    staff(ctx, PAL.woodD, PAL.spec.fire);
    px(ctx, 13, 1, 1, 2, PAL.spec.fireY);
    px(ctx, 12 + frame * 2, 0, 1, 1, PAL.spec.fire);
  },
  'wizard/dark'(ctx, frame) {                      // wide-brimmed hat, violet eyes, skull staff, wisps
    px(ctx, 6, 0, 4, 1, PAL.spec.darkD);
    px(ctx, 5, 1, 6, 1, PAL.spec.darkM);
    px(ctx, 2, 2, 12, 1, PAL.spec.darkD);
    px(ctx, 6, 4, 1, 1, PAL.spec.darkL); px(ctx, 9, 4, 1, 1, PAL.spec.darkL);
    px(ctx, 7, 9, 2, 1, PAL.spec.dark);
    staff(ctx, PAL.spec.darkW, PAL.bone);
    px(ctx, 12, 2, 1, 1, PAL.outline); px(ctx, 14, 2, 1, 1, PAL.outline);
    px(ctx, 13, 0, 1, 1, PAL.spec.darkL);
    px(ctx, 1, 7 + frame, 1, 1, PAL.spec.dark); px(ctx, 2, 5 - frame, 1, 1, PAL.spec.dark);
    px(ctx, 0, 10 - frame, 1, 1, PAL.spec.darkM);
  },

  // ---- clerics --------------------------------------------------
  'cleric/light'(ctx, frame) {                     // halo, circlet, sun staff, prayer book
    px(ctx, 5, 0, 6, 1, PAL.gold); px(ctx, 7, 0, 2, 1, PAL.spec.lightW);
    px(ctx, 4, 2, 8, 1, PAL.gold);
    cross(ctx);
    staff(ctx, PAL.goldD, PAL.spec.light);
    px(ctx, 13, 2, 1, 1, PAL.spec.lightW);
    if (frame) { px(ctx, 13, 0, 1, 1, PAL.gold); px(ctx, 11, 2, 1, 1, PAL.gold); px(ctx, 15, 2, 1, 1, PAL.gold); }
    else { px(ctx, 11, 0, 1, 1, PAL.gold); px(ctx, 15, 0, 1, 1, PAL.gold); px(ctx, 15, 4, 1, 1, PAL.gold); }
    px(ctx, 1, 9, 3, 3, PAL.spec.lightB);          // book
    px(ctx, 2, 10, 1, 1, PAL.gold);
  },
  'cleric/paladin'(ctx) {                          // crested helm, tabard, sun shield, mace
    helm(ctx, PAL.goldD, PAL.metal);
    px(ctx, 7, 0, 2, 1, PAL.gold);
    px(ctx, 6, 8, 4, 3, PAL.spec.palW);
    cross(ctx);
    px(ctx, 0, 7, 4, 7, PAL.spec.palW);            // shield
    px(ctx, 0, 7, 4, 1, PAL.gold); px(ctx, 0, 13, 4, 1, PAL.goldD);
    px(ctx, 0, 7, 1, 7, PAL.goldD);
    px(ctx, 1, 9, 2, 2, PAL.gold);
    px(ctx, 13, 9, 1, 6, PAL.wood);                // mace
    px(ctx, 12, 6, 3, 3, PAL.metal);
    px(ctx, 13, 5, 1, 1, PAL.metal); px(ctx, 11, 7, 1, 1, PAL.metal); px(ctx, 15, 7, 1, 1, PAL.metal);
    px(ctx, 13, 7, 1, 1, PAL.gold);
  }
};

/**
 * Every sprite key the specialisations own, by class. The sprite for a
 * specialisation is `${class}/${spec}`; anything not listed here falls back
 * to the plain class sprite, so a new specialisation never draws nothing.
 */
export const SPEC_SPRITES = {
  warrior: ['fury', 'arms', 'protection'],
  ranger: ['longbow', 'mercenary', 'assassin'],
  wizard: ['blood', 'fire', 'dark'],
  cleric: ['light', 'paladin']
};
export const hasSpecSprite = (kind, spec) => !!SPEC_OVERLAY[`${kind}/${spec}`];

/** Class → body colours. */
const BODY = {
  peasant: { skin: PAL.skin, hair: PAL.hairB, cloth: PAL.cloth.peasant, trim: PAL.cloth.peasantT, pants: PAL.pants, boot: PAL.boot },
  warrior: { skin: PAL.skin, hair: PAL.hairR, cloth: PAL.cloth.warrior, trim: PAL.cloth.warriorT, pants: PAL.pantsD, boot: PAL.boot },
  ranger: { skin: PAL.skin, hair: PAL.hairB, cloth: PAL.cloth.ranger, trim: PAL.cloth.rangerT, pants: PAL.pants, boot: PAL.boot },
  wizard: { skin: PAL.skinPale, hair: PAL.hairW, cloth: PAL.cloth.wizard, trim: PAL.cloth.wizardT, pants: PAL.cloth.wizard, boot: PAL.pantsD },
  cleric: { skin: PAL.skin, hair: PAL.hairW, cloth: PAL.cloth.cleric, trim: PAL.cloth.clericT, pants: PAL.cloth.cleric, boot: PAL.boot },
  guard: { skin: PAL.skin, hair: PAL.hairB, cloth: PAL.cloth.guard, trim: PAL.cloth.guardT, pants: PAL.pantsD, boot: PAL.boot },
  goblin: { skin: PAL.gob, hair: PAL.gobD, cloth: PAL.woodD, trim: PAL.dirtD, pants: PAL.dirtD, boot: PAL.outline },
  skeleton: { skin: PAL.bone, hair: PAL.boneD, cloth: PAL.boneD, trim: PAL.rockD, pants: PAL.boneD, boot: PAL.rockD },
  ogre: { skin: PAL.ogre, hair: PAL.ogreD, cloth: PAL.dirtD, trim: PAL.woodD, pants: PAL.dirt, boot: PAL.outline },
  demon: { skin: PAL.demon, hair: PAL.demonD, cloth: PAL.demonD, trim: PAL.gold, pants: PAL.demonD, boot: PAL.outline },
  troll: { skin: PAL.troll, hair: PAL.trollD, cloth: PAL.dirtD, trim: PAL.woodD, pants: PAL.dirt, boot: PAL.outline },
  wraith: { skin: PAL.outline, hair: PAL.wraith, cloth: PAL.wraith, trim: PAL.wraithL, pants: null, boot: null, legless: true },
  cultist: { skin: PAL.skinPale, hair: PAL.hairK, cloth: PAL.cult, trim: PAL.spec.blood, pants: PAL.cultD, boot: PAL.outline }
};

// bespoke non-humanoid critters -----------------------------------
const RAT = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '..........oo....',
  '.o.......orrro..',
  '..oo...orrrrrro.',
  '....ooorrrrrreo.',
  '....orrrrrrrro..',
  '.....o.oo.oo.o..',
  '................',
  '................',
  '................'
];
const SLIME = [
  '................',
  '................',
  '................',
  '................',
  '.....oooooo.....',
  '....osssssso....',
  '...osslssssso...',
  '..osssssssssso..',
  '..osseossoesso..',
  '..ossssssssssso.',
  '..ossssssssssso.',
  '..ooooooooooooo.',
  '................',
  '................',
  '................',
  '................'
];

const SPIDER = [
  '................',
  '................',
  '................',
  '................',
  '..o.........o...',
  '...o..oooo..o...',
  '....oobbbboo....',
  '.oooblbbbbbooo..',
  '....obbbbbbbbo..',
  '.ooobbbbbbbeeo..',
  '....obbbbbbbbo..',
  '.oooblbbbbbooo..',
  '....oobbbboo....',
  '...o..oooo..o...',
  '..o.........o...',
  '................'
];
const DRAKE = [
  '................',
  '................',
  '.....oo.........',
  '....owwo........',
  '...owwwwo.......',
  '..owwwwwwo..oo..',
  '.owwwwwwwo.orro.',
  '.orrrrrrrrorreo.',
  'orrrrrrrrrrrrro.',
  'orrrrbbbbbrrro..',
  '.orrrbbbbbrro...',
  '..orrrrrrrro....',
  '...oroo.oro.....',
  '..oro....oro....',
  '..ooo....ooo....',
  '................'
];

const spriteCache = new Map();

/**
 * 16x16 unit sprite. dir: 1 = facing right, -1 = facing left.
 * frame: 0 idle, 1 step. `kind` is a class, a monster, or `class/spec` for
 * a soldier who has chosen a specialisation.
 */
export function unitSprite(kind, frame = 0, dir = 1) {
  const key = `u:${kind}:${frame}:${dir}`;
  let c = spriteCache.get(key);
  if (c) return c;

  const base = makeCanvas(16, 16);
  const ctx = base.getContext('2d');

  if (kind === 'rat') {
    paint(ctx, RAT, { '.': null, o: PAL.outline, r: PAL.ratF, e: PAL.red },
      0, frame === 1 ? -1 : 0);
  } else if (kind === 'slime') {
    paint(ctx, SLIME, { '.': null, o: PAL.outline, s: PAL.slime, l: PAL.white, e: PAL.outline },
      0, frame === 1 ? -1 : 0);
  } else if (kind === 'spider') {
    paint(ctx, SPIDER, { '.': null, o: PAL.outline, b: PAL.spider, l: PAL.spiderL, e: PAL.red },
      0, frame === 1 ? -1 : 0);
  } else if (kind === 'drake') {
    paint(ctx, DRAKE, { '.': null, o: PAL.outline, r: PAL.drake, w: PAL.drakeD, b: PAL.drakeB, e: PAL.spec.fireY },
      0, frame === 1 ? -1 : 0);
    if (frame === 1) px(ctx, 12, 3, 1, 1, PAL.spec.fire);   // a lick of flame
  } else if (SPEC_OVERLAY[kind]) {
    // `class/spec`: the class body under the specialisation's colours and kit
    const cls = kind.slice(0, kind.indexOf('/'));
    humanoid(ctx, { ...(BODY[cls] || BODY.peasant), ...SPEC_BODY[kind] }, frame);
    SPEC_OVERLAY[kind](ctx, frame);
  } else {
    const cls = kind.includes('/') ? kind.slice(0, kind.indexOf('/')) : kind;
    const body = BODY[cls] || BODY.peasant;
    humanoid(ctx, body, frame);
    const ov = OVERLAY[cls];
    if (ov) ov(ctx, frame);
  }

  let out = base;
  if (dir === -1) {
    out = makeCanvas(16, 16);
    const o = out.getContext('2d');
    o.imageSmoothingEnabled = false;
    o.translate(16, 0); o.scale(-1, 1);
    o.drawImage(base, 0, 0);
  }
  spriteCache.set(key, out);
  return out;
}

// ---------------------------------------------------------------
// buildings — drawn procedurally, anchored bottom-left
// ---------------------------------------------------------------
function roofGable(ctx, x, y, w, h, light, dark) {
  // stepped triangular roof with a highlight ridge
  for (let i = 0; i < h; i++) {
    const inset = Math.floor((i * (w / 2 - 1)) / h);
    px(ctx, x + inset, y + i, w - inset * 2, 1, i < h / 2 ? light : dark);
  }
  px(ctx, x, y + h - 1, w, 1, dark);
}

function wallBlock(ctx, x, y, w, h, main, dark, light) {
  px(ctx, x, y, w, h, main);
  px(ctx, x, y, 1, h, light);
  px(ctx, x + w - 1, y, 1, h, dark);
  px(ctx, x, y + h - 1, w, 1, dark);
  // brick dither
  for (let yy = y + 2; yy < y + h - 1; yy += 3) {
    for (let xx = x + 1 + ((yy / 3) % 2 ? 2 : 0); xx < x + w - 1; xx += 4) {
      px(ctx, xx, yy, 1, 1, dark);
    }
  }
}

function door(ctx, x, y, w, h, col = PAL.woodD) {
  px(ctx, x, y, w, h, col);
  px(ctx, x + 1, y + 1, w - 2, h - 1, PAL.outline);
  px(ctx, x + w - 2, y + Math.floor(h / 2), 1, 1, PAL.gold);
}
function window_(ctx, x, y, w = 2, h = 2) {
  px(ctx, x, y, w, h, PAL.outline);
  px(ctx, x, y, w, 1, PAL.blue);
}
function banner(ctx, x, y, col) {
  px(ctx, x, y - 6, 1, 7, PAL.woodD);
  px(ctx, x + 1, y - 6, 4, 4, col);
  px(ctx, x + 1, y - 2, 1, 1, col); px(ctx, x + 4, y - 2, 1, 1, col);
}

const BUILD_ART = {
  palace(ctx, W, H) {                     // 3x3 keep with towers
    px(ctx, 2, H - 4, W - 4, 4, PAL.stoneD);
    wallBlock(ctx, 6, H - 26, W - 12, 22, PAL.stone, PAL.stoneD, PAL.stoneL);
    roofGable(ctx, 4, H - 34, W - 8, 9, PAL.roofB, PAL.roofBD);
    // side towers
    wallBlock(ctx, 1, H - 30, 7, 26, PAL.stone, PAL.stoneD, PAL.stoneL);
    wallBlock(ctx, W - 8, H - 30, 7, 26, PAL.stone, PAL.stoneD, PAL.stoneL);
    for (const tx of [1, W - 8]) {
      px(ctx, tx, H - 34, 7, 4, PAL.roofB);
      px(ctx, tx, H - 31, 7, 1, PAL.roofBD);
      for (let i = 0; i < 7; i += 2) px(ctx, tx + i, H - 35, 1, 1, PAL.stoneL);
      window_(ctx, tx + 2, H - 24);
      window_(ctx, tx + 2, H - 16);
    }
    door(ctx, W / 2 - 3, H - 12, 6, 8, PAL.woodL);
    window_(ctx, W / 2 - 7, H - 22, 3, 3);
    window_(ctx, W / 2 + 4, H - 22, 3, 3);
    px(ctx, W / 2 - 1, H - 42, 1, 8, PAL.woodD);
    px(ctx, W / 2, H - 42, 6, 4, PAL.gold);
    px(ctx, W / 2 + 2, H - 41, 2, 2, PAL.roofRD);
  },
  hut(ctx, W, H) {
    wallBlock(ctx, 3, H - 13, W - 6, 13, PAL.dirt, PAL.dirtD, PAL.woodL);
    roofGable(ctx, 1, H - 21, W - 2, 9, PAL.thatch, PAL.thatchD);
    door(ctx, W / 2 - 2, H - 8, 4, 8);
    window_(ctx, 5, H - 11);
  },
  warriors_guild(ctx, W, H) {
    wallBlock(ctx, 2, H - 17, W - 4, 17, PAL.wood, PAL.woodD, PAL.woodL);
    roofGable(ctx, 0, H - 25, W, 9, PAL.roofR, PAL.roofRD);
    door(ctx, W / 2 - 3, H - 10, 6, 10);
    window_(ctx, 4, H - 15); window_(ctx, W - 6, H - 15);
    // crossed swords sign
    px(ctx, W / 2 - 4, H - 15, 8, 1, PAL.metal);
    px(ctx, W / 2 - 1, H - 18, 1, 5, PAL.metal);
    banner(ctx, W - 4, H - 25, PAL.roofR);
  },
  barracks(ctx, W, H) {
    // timber hall with a weapon rack and a banner
    wallBlock(ctx, 2, H - 18, W - 4, 18, PAL.wood, PAL.woodD, PAL.woodL);
    roofGable(ctx, 0, H - 26, W, 9, PAL.roofR, PAL.roofRD);
    door(ctx, W / 2 - 3, H - 11, 6, 11);
    window_(ctx, 4, H - 16); window_(ctx, W - 6, H - 16);
    // crossed spears over the door
    px(ctx, W / 2 - 5, H - 16, 10, 1, PAL.metal);
    px(ctx, W / 2 - 1, H - 20, 1, 6, PAL.woodD);
    px(ctx, W / 2 - 2, H - 21, 3, 2, PAL.metal);
    // training dummy outside
    px(ctx, 3, H - 9, 1, 9, PAL.woodD);
    px(ctx, 1, H - 8, 5, 3, PAL.thatch);
    banner(ctx, W - 4, H - 26, PAL.roofR);
  },
  rangers_guild(ctx, W, H) {
    px(ctx, 4, H - 6, 3, 6, PAL.woodD); px(ctx, W - 7, H - 6, 3, 6, PAL.woodD);
    wallBlock(ctx, 2, H - 18, W - 4, 13, PAL.woodL, PAL.woodD, PAL.thatch);
    roofGable(ctx, 0, H - 26, W, 9, PAL.roofG, PAL.roofGD);
    door(ctx, W / 2 - 3, H - 11, 6, 6);
    window_(ctx, 4, H - 16);
    px(ctx, W - 7, H - 16, 4, 1, PAL.wood);     // bow sign
    px(ctx, W - 8, H - 17, 1, 3, PAL.wood);
    banner(ctx, 3, H - 26, PAL.roofG);
  },
  wizards_guild(ctx, W, H) {
    wallBlock(ctx, 3, H - 16, W - 6, 16, PAL.stone, PAL.stoneD, PAL.stoneL);
    // tall tower
    wallBlock(ctx, W - 12, H - 30, 9, 26, PAL.stone, PAL.stoneD, PAL.stoneL);
    for (let i = 0; i < 6; i++) px(ctx, W - 12 + i, H - 33, 1, 3, i % 2 ? PAL.roofP : PAL.roofPD);
    px(ctx, W - 12, H - 36, 9, 4, PAL.roofP);
    px(ctx, W - 10, H - 39, 5, 3, PAL.roofP);
    px(ctx, W - 8, H - 41, 2, 2, PAL.roofPD);
    px(ctx, W - 8, H - 43, 2, 2, PAL.blue);
    window_(ctx, W - 9, H - 26, 3, 3);
    window_(ctx, W - 9, H - 18, 3, 3);
    roofGable(ctx, 1, H - 23, W - 10, 8, PAL.roofP, PAL.roofPD);
    door(ctx, 5, H - 10, 5, 10);
    px(ctx, 12, H - 14, 3, 3, PAL.blue);
  },
  temple(ctx, W, H) {
    px(ctx, 1, H - 3, W - 2, 3, PAL.stoneL);
    wallBlock(ctx, 3, H - 18, W - 6, 15, PAL.stoneL, PAL.stoneD, PAL.white);
    for (let i = 4; i < W - 4; i += 5) px(ctx, i, H - 17, 2, 14, PAL.white);
    roofGable(ctx, 0, H - 26, W, 9, PAL.gold, PAL.goldD);
    px(ctx, W / 2 - 1, H - 34, 2, 9, PAL.gold);
    px(ctx, W / 2 - 4, H - 31, 8, 2, PAL.gold);
    door(ctx, W / 2 - 3, H - 12, 6, 9, PAL.woodL);
  },
  marketplace(ctx, W, H) {
    for (let i = 0; i < W; i += 4) {
      px(ctx, i, H - 20, 4, 5, i % 8 ? PAL.roofR : PAL.white);
    }
    px(ctx, 0, H - 15, W, 1, PAL.woodD);
    px(ctx, 2, H - 15, 2, 15, PAL.woodD); px(ctx, W - 4, H - 15, 2, 15, PAL.woodD);
    px(ctx, 4, H - 10, W - 8, 4, PAL.woodL);        // stall table
    px(ctx, 6, H - 12, 2, 2, PAL.red); px(ctx, 10, H - 12, 2, 2, PAL.gold);
    px(ctx, 14, H - 12, 2, 2, PAL.green); px(ctx, 18, H - 12, 2, 2, PAL.purple);
    px(ctx, 4, H - 6, W - 8, 6, PAL.dirt);
  },
  blacksmith(ctx, W, H) {
    wallBlock(ctx, 2, H - 16, W - 4, 16, PAL.rock, PAL.rockD, PAL.rockL);
    roofGable(ctx, 0, H - 23, W, 8, PAL.roofRD, PAL.outline);
    px(ctx, W - 9, H - 30, 5, 8, PAL.rockD);         // chimney
    px(ctx, W - 9, H - 31, 5, 2, PAL.rock);
    px(ctx, 4, H - 11, 8, 8, PAL.outline);           // forge mouth
    px(ctx, 5, H - 9, 6, 5, '#ff7a2a');
    px(ctx, 6, H - 7, 4, 3, PAL.gold);
    px(ctx, W - 10, H - 9, 7, 3, PAL.metalD);        // anvil
    px(ctx, W - 8, H - 6, 3, 4, PAL.metalD);
  },
  guardhouse(ctx, W, H) {
    wallBlock(ctx, 2, H - 15, W - 4, 15, PAL.stone, PAL.stoneD, PAL.stoneL);
    for (let i = 2; i < W - 2; i += 4) px(ctx, i, H - 19, 3, 4, PAL.stone);
    px(ctx, 2, H - 16, W - 4, 2, PAL.stoneD);
    door(ctx, W / 2 - 2, H - 9, 5, 9);
    window_(ctx, 4, H - 13); window_(ctx, W - 7, H - 13);
    banner(ctx, W / 2 + 6, H - 19, PAL.roofB);
  },
  tower(ctx, W, H) {
    const x = W / 2 - 5;
    wallBlock(ctx, x, H - 30, 10, 30, PAL.stone, PAL.stoneD, PAL.stoneL);
    for (let i = 0; i < 10; i += 3) px(ctx, x + i, H - 34, 2, 4, PAL.stoneL);
    px(ctx, x - 1, H - 31, 12, 2, PAL.stoneD);
    window_(ctx, x + 4, H - 24, 2, 3);
    window_(ctx, x + 4, H - 14, 2, 3);
    px(ctx, x + 3, H - 38, 1, 5, PAL.woodD);
    px(ctx, x + 4, H - 38, 4, 3, PAL.roofB);
  },
  lumberyard(ctx, W, H) {
    px(ctx, 1, H - 8, W - 2, 8, PAL.dirtD);
    for (let i = 2; i < W - 2; i += 4) px(ctx, i, H - 12, 3, 4, PAL.woodL);
    for (let i = 3; i < W - 3; i += 4) px(ctx, i, H - 16, 3, 4, PAL.wood);
    px(ctx, 2, H - 24, 3, 12, PAL.woodD); px(ctx, W - 5, H - 24, 3, 12, PAL.woodD);
    px(ctx, 1, H - 26, W - 2, 3, PAL.thatch);
    px(ctx, W - 10, H - 22, 1, 8, PAL.metalD);       // saw
    px(ctx, W - 13, H - 22, 4, 1, PAL.metal);
  },
  mining_camp(ctx, W, H) {
    px(ctx, 1, H - 6, W - 2, 6, PAL.rockD);
    px(ctx, 3, H - 18, 3, 12, PAL.woodD); px(ctx, W - 6, H - 18, 3, 12, PAL.woodD);
    px(ctx, 2, H - 20, W - 4, 3, PAL.wood);
    px(ctx, 7, H - 13, W - 14, 7, PAL.outline);      // mine mouth
    px(ctx, 8, H - 11, W - 16, 5, '#2a2036');
    px(ctx, W - 8, H - 10, 5, 4, PAL.woodL);         // cart
    px(ctx, W - 7, H - 12, 3, 2, PAL.gold);
    px(ctx, W - 8, H - 6, 2, 2, PAL.outline);
  },
  inn(ctx, W, H) {
    wallBlock(ctx, 2, H - 16, W - 4, 16, PAL.woodL, PAL.woodD, PAL.thatch);
    roofGable(ctx, 0, H - 24, W, 9, PAL.roofRD, PAL.outline);
    door(ctx, W / 2 - 3, H - 10, 6, 10);
    window_(ctx, 4, H - 14, 3, 3); window_(ctx, W - 7, H - 14, 3, 3);
    px(ctx, W - 6, H - 20, 5, 4, PAL.thatch);        // mug sign
    px(ctx, W - 5, H - 19, 3, 2, PAL.gold);
    px(ctx, W - 4, H - 28, 6, 6, PAL.roofRD);
  }
};

const buildCache = new Map();

/**
 * Building sprite. `fw`,`fh` are the footprint in tiles.
 * Returned canvas is (fw*16) x (fh*16 + EXTRA) and anchored so that its
 * bottom edge sits on the bottom of the footprint.
 */
export const BUILD_EXTRA = 28;
export function buildingSprite(id, fw, fh, state = 'done') {
  const key = `b:${id}:${state}`;
  let c = buildCache.get(key);
  if (c) return c;

  const W = fw * TILE, H = fh * TILE + BUILD_EXTRA;
  c = makeCanvas(W, H);
  const ctx = c.getContext('2d');

  if (state === 'site') {
    // scaffolding + foundation
    px(ctx, 2, H - 6, W - 4, 6, PAL.dirtD);
    px(ctx, 3, H - 8, W - 6, 3, PAL.stoneD);
    for (let i = 3; i < W - 3; i += 6) px(ctx, i, H - 22, 2, 15, PAL.woodL);
    px(ctx, 3, H - 22, W - 6, 2, PAL.wood);
    px(ctx, 3, H - 15, W - 6, 2, PAL.wood);
    px(ctx, W - 9, H - 30, 2, 9, PAL.woodD);
    px(ctx, W - 9, H - 30, 7, 2, PAL.woodD);
  } else if (state === 'rubble') {
    px(ctx, 2, H - 8, W - 4, 8, PAL.rockD);
    px(ctx, 5, H - 12, 6, 5, PAL.rock);
    px(ctx, W - 12, H - 11, 7, 4, PAL.rock);
    px(ctx, 8, H - 14, 3, 3, PAL.stoneD);
    for (let i = 4; i < W - 4; i += 5) px(ctx, i, H - 4, 2, 2, PAL.outline);
  } else {
    const fn = BUILD_ART[id] || BUILD_ART.hut;
    fn(ctx, W, H);
  }

  buildCache.set(key, c);
  return c;
}

// ---------------------------------------------------------------
// props: trees, rocks, resource nodes, lairs, flags
// ---------------------------------------------------------------
const propCache = new Map();

export function propSprite(kind, variant = 0) {
  const key = `p:${kind}:${variant}`;
  let c = propCache.get(key);
  if (c) return c;

  const size = kind === 'lair_ogre' ? 32 : kind.startsWith('lair') ? 32 : kind === 'goldmine' || kind === 'quarry' ? 32 : 16;
  c = makeCanvas(size, size + (kind === 'tree' ? 8 : 0));
  const ctx = c.getContext('2d');
  const H = c.height;

  switch (kind) {
    case 'tree': {
      const dark = variant % 2 ? PAL.grass3 : '#2a5a2f';
      const lit = variant % 2 ? PAL.grass2 : '#3f7a42';
      px(ctx, 7, H - 6, 3, 6, PAL.woodD);
      px(ctx, 7, H - 6, 1, 6, PAL.wood);
      // layered canopy
      px(ctx, 3, H - 12, 11, 7, dark);
      px(ctx, 2, H - 10, 13, 4, dark);
      px(ctx, 4, H - 16, 9, 6, dark);
      px(ctx, 5, H - 19, 7, 4, dark);
      px(ctx, 5, H - 15, 5, 4, lit);
      px(ctx, 6, H - 18, 3, 3, lit);
      px(ctx, 4, H - 9, 3, 2, lit);
      break;
    }
    case 'pine': {
      px(ctx, 7, H - 5, 2, 5, PAL.woodD);
      for (let i = 0; i < 4; i++) {
        const w = 11 - i * 2, y = H - 8 - i * 4;
        px(ctx, 8 - (w >> 1), y, w, 4, i % 2 ? '#2a5a3a' : '#357046');
      }
      px(ctx, 7, H - 22, 2, 2, '#357046');
      break;
    }
    case 'rock': {
      px(ctx, 3, 9, 10, 6, PAL.rockD);
      px(ctx, 4, 6, 8, 5, PAL.rock);
      px(ctx, 5, 5, 4, 3, PAL.rockL);
      px(ctx, 10, 11, 3, 2, PAL.rockL);
      break;
    }
    case 'bush': {
      px(ctx, 4, 9, 8, 5, PAL.grass3);
      px(ctx, 5, 7, 6, 4, PAL.grass2);
      px(ctx, 6, 8, 2, 2, PAL.grassDry);
      break;
    }
    case 'goldmine': {
      px(ctx, 2, 18, 28, 14, PAL.rockD);
      px(ctx, 4, 12, 24, 10, PAL.rock);
      px(ctx, 6, 9, 16, 6, PAL.rockL);
      px(ctx, 10, 18, 12, 12, PAL.outline);          // entrance
      px(ctx, 11, 20, 10, 10, '#241a2e');
      px(ctx, 9, 16, 14, 3, PAL.woodD);              // beam
      px(ctx, 9, 18, 2, 12, PAL.woodD); px(ctx, 21, 18, 2, 12, PAL.woodD);
      for (const [gx, gy] of [[5, 14], [24, 15], [7, 22], [25, 23], [3, 26]]) {
        px(ctx, gx, gy, 2, 2, PAL.gold);
        px(ctx, gx, gy, 1, 1, '#fff3c0');
      }
      break;
    }
    case 'quarry': {
      px(ctx, 1, 16, 30, 16, PAL.rockD);
      px(ctx, 3, 11, 26, 8, PAL.rock);
      px(ctx, 6, 8, 18, 5, PAL.rockL);
      for (const [gx, gy, s] of [[5, 20, 5], [13, 22, 6], [22, 19, 5], [9, 27, 4], [20, 27, 6]]) {
        px(ctx, gx, gy, s, s - 1, PAL.stone);
        px(ctx, gx, gy, s - 2, 1, PAL.stoneL);
      }
      break;
    }
    case 'lair_rat': {
      px(ctx, 4, 20, 24, 10, PAL.dirtD);
      px(ctx, 8, 14, 16, 10, PAL.dirt);
      px(ctx, 12, 20, 9, 9, PAL.outline);
      px(ctx, 13, 22, 7, 7, '#1a1020');
      for (let i = 0; i < 8; i++) px(ctx, 5 + i * 3, 26 + (i % 2), 2, 1, PAL.woodD);
      px(ctx, 15, 26, 1, 1, PAL.red); px(ctx, 18, 26, 1, 1, PAL.red);
      break;
    }
    case 'lair_goblin': {
      px(ctx, 3, 22, 26, 9, PAL.dirtD);
      // hide tent
      px(ctx, 6, 12, 20, 12, PAL.dirt);
      px(ctx, 8, 9, 16, 5, PAL.gobD);
      px(ctx, 13, 16, 7, 9, PAL.outline);
      px(ctx, 15, 5, 2, 9, PAL.woodD);                // totem
      px(ctx, 13, 3, 6, 3, PAL.bone);
      px(ctx, 14, 4, 1, 1, PAL.red); px(ctx, 17, 4, 1, 1, PAL.red);
      px(ctx, 4, 24, 3, 6, PAL.woodD); px(ctx, 26, 24, 3, 6, PAL.woodD);
      break;
    }
    case 'lair_skeleton': {
      px(ctx, 2, 23, 28, 8, '#3a3550');
      for (const [gx, gy, w, h] of [[5, 15, 6, 9], [14, 12, 7, 12], [23, 17, 5, 7]]) {
        px(ctx, gx, gy, w, h, PAL.stone);
        px(ctx, gx, gy, w, 2, PAL.stoneL);
        px(ctx, gx + 1, gy + 3, w - 2, 1, PAL.stoneD);
      }
      px(ctx, 16, 8, 3, 6, PAL.stone);
      px(ctx, 14, 10, 7, 2, PAL.stone);
      px(ctx, 8, 27, 3, 2, PAL.bone); px(ctx, 20, 28, 4, 2, PAL.bone);
      px(ctx, 11, 20, 1, 1, '#8fe0ff'); px(ctx, 24, 22, 1, 1, '#8fe0ff');
      break;
    }
    case 'lair_ogre': {
      px(ctx, 2, 21, 28, 11, PAL.rockD);
      px(ctx, 5, 10, 22, 13, PAL.rock);
      px(ctx, 8, 6, 16, 6, PAL.rockL);
      px(ctx, 11, 17, 11, 14, PAL.outline);
      px(ctx, 12, 19, 9, 12, '#1a1020');
      px(ctx, 3, 14, 3, 10, PAL.bone); px(ctx, 27, 15, 3, 9, PAL.bone);
      px(ctx, 2, 11, 5, 4, PAL.bone);                 // skull pile
      px(ctx, 3, 12, 1, 1, PAL.outline); px(ctx, 5, 12, 1, 1, PAL.outline);
      px(ctx, 14, 24, 2, 2, PAL.red); px(ctx, 18, 24, 2, 2, PAL.red);
      break;
    }
    case 'lair_spider': {
      px(ctx, 3, 20, 26, 11, '#2a2036');
      px(ctx, 10, 12, 12, 14, PAL.outline);          // the hollow
      px(ctx, 12, 15, 8, 11, '#120c1c');
      // web strands
      for (let i = 0; i < 6; i++) { px(ctx, 4 + i * 4, 6 + (i % 2) * 3, 1, 1, PAL.stoneL); px(ctx, 6 + i * 4, 9 + (i % 3), 3, 1, PAL.stoneL); }
      px(ctx, 6, 4, 1, 16, PAL.stoneL); px(ctx, 25, 5, 1, 14, PAL.stoneL);
      px(ctx, 3, 8, 26, 1, PAL.stoneL);
      // egg sacs
      px(ctx, 4, 22, 4, 4, PAL.bone); px(ctx, 24, 23, 5, 5, PAL.bone); px(ctx, 25, 24, 1, 1, PAL.white);
      px(ctx, 15, 19, 1, 1, PAL.red); px(ctx, 17, 19, 1, 1, PAL.red);
      break;
    }
    case 'lair_troll': {
      px(ctx, 2, 21, 28, 11, PAL.rockD);
      px(ctx, 4, 8, 24, 15, PAL.rock);
      px(ctx, 7, 5, 18, 5, PAL.rockL);
      for (const [mx, my] of [[5, 9], [22, 7], [9, 19], [25, 17]]) px(ctx, mx, my, 3, 2, PAL.moss);
      px(ctx, 11, 15, 11, 15, PAL.outline);
      px(ctx, 12, 17, 9, 13, '#1a1020');
      px(ctx, 3, 23, 2, 8, PAL.woodD); px(ctx, 2, 20, 4, 4, PAL.woodD);   // the club, leant
      px(ctx, 24, 26, 6, 3, PAL.bone); px(ctx, 26, 24, 3, 3, PAL.bone);
      px(ctx, 27, 25, 1, 1, PAL.outline);
      px(ctx, 15, 22, 1, 1, PAL.red); px(ctx, 18, 22, 1, 1, PAL.red);
      break;
    }
    case 'lair_wraith': {
      // a barrow: a turf mound with a stone door, lit from within
      px(ctx, 2, 24, 28, 7, PAL.dirtD);
      px(ctx, 4, 12, 24, 13, PAL.grass3);
      px(ctx, 8, 8, 16, 6, PAL.grass3);
      px(ctx, 6, 10, 20, 2, PAL.grass1);
      px(ctx, 12, 16, 9, 12, PAL.stoneD);
      px(ctx, 13, 18, 7, 10, PAL.outline);
      px(ctx, 14, 20, 5, 8, '#1a2a3a');
      px(ctx, 16, 22, 1, 1, PAL.wraithG); px(ctx, 15, 25, 1, 1, PAL.wraithG); px(ctx, 18, 24, 1, 1, PAL.wraithG);
      px(ctx, 5, 14, 2, 5, PAL.stone); px(ctx, 25, 15, 2, 5, PAL.stone);   // standing stones
      px(ctx, 9, 5, 3, 3, PAL.wraithG); px(ctx, 10, 6, 1, 1, PAL.white);   // a light over the mound
      break;
    }
    case 'lair_cultist': {
      // a shrine: paved ground, an obelisk, an altar that has seen use
      px(ctx, 1, 22, 30, 9, PAL.stoneD);
      for (let i = 2; i < 30; i += 5) px(ctx, i, 26, 3, 1, PAL.stone);
      px(ctx, 13, 3, 6, 20, PAL.stoneD);
      px(ctx, 14, 2, 4, 21, PAL.stone);
      px(ctx, 15, 1, 2, 1, PAL.stone);
      px(ctx, 15, 6, 2, 2, PAL.spec.blood); px(ctx, 14, 9, 4, 1, PAL.spec.blood); px(ctx, 15, 11, 2, 3, PAL.spec.blood);
      px(ctx, 4, 17, 9, 6, PAL.stone);               // altar
      px(ctx, 4, 17, 9, 1, PAL.stoneL);
      px(ctx, 6, 18, 5, 2, PAL.spec.blood); px(ctx, 7, 20, 1, 3, PAL.spec.bloodD);
      px(ctx, 22, 15, 1, 5, PAL.bone); px(ctx, 26, 16, 1, 4, PAL.bone);   // candles
      px(ctx, 22, 13, 1, 2, PAL.spec.fireY); px(ctx, 26, 14, 1, 2, PAL.spec.fireY);
      break;
    }
    case 'lair_drake': {
      // a roost: scorched rock, a fire in the mouth of it, and an egg
      px(ctx, 1, 20, 30, 12, PAL.rockD);
      px(ctx, 3, 9, 26, 13, PAL.rock);
      px(ctx, 7, 4, 18, 7, PAL.rockL);
      px(ctx, 10, 13, 12, 15, PAL.outline);
      px(ctx, 11, 16, 10, 12, '#1a1020');
      px(ctx, 13, 21, 6, 7, PAL.spec.fireD); px(ctx, 14, 19, 4, 6, PAL.spec.fire); px(ctx, 15, 18, 2, 4, PAL.spec.fireY);
      for (const [sx, sy] of [[4, 12], [24, 11], [6, 24], [26, 25]]) px(ctx, sx, sy, 2, 1, PAL.outline);   // scorch
      px(ctx, 24, 24, 4, 5, PAL.drake); px(ctx, 25, 23, 2, 1, PAL.drake); px(ctx, 25, 25, 1, 1, PAL.drakeB);   // egg
      px(ctx, 2, 26, 5, 2, PAL.bone); px(ctx, 4, 24, 2, 2, PAL.bone);
      break;
    }
    case 'tomb': {
      px(ctx, 5, 8, 6, 8, PAL.stone);
      px(ctx, 5, 8, 6, 2, PAL.stoneL);
      px(ctx, 4, 14, 8, 2, PAL.stoneD);
      px(ctx, 7, 10, 2, 4, PAL.stoneD); px(ctx, 6, 11, 4, 1, PAL.stoneD);
      break;
    }
    case 'chest': {
      px(ctx, 4, 8, 9, 6, PAL.woodD);
      px(ctx, 4, 8, 9, 2, PAL.wood);
      px(ctx, 7, 10, 3, 3, PAL.gold);
      break;
    }
  }
  propCache.set(key, c);
  return c;
}

/** Reward flag banner. type: attack | explore | defend | fear */
export function flagSprite(type, frame = 0) {
  const key = `f:${type}:${frame}`;
  let c = propCache.get(key);
  if (c) return c;
  c = makeCanvas(16, 20);
  const ctx = c.getContext('2d');
  const col = { attack: PAL.red, explore: PAL.blue, defend: PAL.green, fear: PAL.gold }[type] || PAL.red;
  const dark = { attack: '#8a2020', explore: '#2a5a9a', defend: '#2a7a4a', fear: '#9a7a10' }[type] || '#8a2020';
  px(ctx, 6, 3, 1, 17, PAL.woodD);
  const wave = frame ? 1 : 0;
  px(ctx, 7, 3 + wave, 7, 6, col);
  px(ctx, 7, 7 + wave, 7, 2, dark);
  px(ctx, 13, 4 + wave, 1, 4, dark);
  px(ctx, 5, 19, 4, 1, PAL.outline);
  // emblem
  if (type === 'attack') { px(ctx, 9, 5 + wave, 3, 1, PAL.white); px(ctx, 10, 4 + wave, 1, 3, PAL.white); }
  if (type === 'explore') { px(ctx, 9, 4 + wave, 1, 3, PAL.white); px(ctx, 10, 5 + wave, 2, 1, PAL.white); }
  if (type === 'defend') { px(ctx, 9, 4 + wave, 3, 3, PAL.white); px(ctx, 10, 7 + wave, 1, 1, PAL.white); }
  if (type === 'fear') { px(ctx, 10, 4 + wave, 1, 2, PAL.black); px(ctx, 10, 7 + wave, 1, 1, PAL.black); }
  propCache.set(key, c);
  return c;
}

// ---------------------------------------------------------------
// terrain tiles
// ---------------------------------------------------------------
export const T = { WATER: 0, SAND: 1, GRASS: 2, DGRASS: 3, DIRT: 4, ROCK: 5, ROAD: 6 };

const tileCache = new Map();
/** One 16x16 terrain tile. `v` picks a deterministic dither variant. */
export function tileSprite(type, v) {
  const key = `t:${type}:${v}`;
  let c = tileCache.get(key);
  if (c) return c;
  c = makeCanvas(TILE, TILE);
  const ctx = c.getContext('2d');
  // mulberry32 keeps the dither from falling into visible columns
  const speck = (col, n, seed) => {
    let a = (seed * 0x9e3779b9) >>> 0;
    const rnd = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = 0; i < n; i++) {
      px(ctx, (rnd() * 16) | 0, (rnd() * 16) | 0, 1, 1, col);
    }
  };
  switch (type) {
    case T.WATER:
      px(ctx, 0, 0, 16, 16, PAL.water2);
      for (let y = 0; y < 16; y += 4) px(ctx, 0, y + (v % 2), 16, 2, PAL.water1);
      speck(PAL.water3, 5, v + 7);
      break;
    case T.SAND:
      px(ctx, 0, 0, 16, 16, PAL.sand);
      speck(PAL.sandD, 10, v + 3);
      break;
    case T.GRASS:
      px(ctx, 0, 0, 16, 16, PAL.grass1);
      speck(PAL.grass2, 16, v + 1);
      speck(PAL.grass3, 8, v + 31);
      break;
    case T.DGRASS:
      px(ctx, 0, 0, 16, 16, PAL.grass3);
      speck(PAL.grass1, 12, v + 5);
      speck(PAL.grassDry, 5, v + 11);
      break;
    case T.DIRT:
      px(ctx, 0, 0, 16, 16, PAL.dirt);
      speck(PAL.dirtD, 12, v + 2);
      speck(PAL.sandD, 4, v + 17);
      break;
    case T.ROCK:
      px(ctx, 0, 0, 16, 16, PAL.rockD);
      speck(PAL.rock, 20, v + 4);
      speck(PAL.rockL, 6, v + 23);
      break;
    case T.ROAD:
      px(ctx, 0, 0, 16, 16, PAL.dirtD);
      speck(PAL.dirt, 14, v + 9);
      speck(PAL.sandD, 6, v + 13);
      break;
  }
  tileCache.set(key, c);
  return c;
}

/** Small square icon of any sprite, for HTML cards. */
export function iconCanvas(draw, size, scale) {
  const c = makeCanvas(size * scale, size * scale);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.scale(scale, scale);
  draw(ctx);
  c.style.width = c.width / (window.devicePixelRatio > 1 ? 2 : 1) + 'px';
  return c;
}
