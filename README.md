# Realm of Majesty

A 16-bit fantasy kingdom sim in the spirit of **Majesty: The Fantasy Kingdom Sim**,
written as a single dependency-free web page. Built to be played with a thumb on a phone.

**The premise:** you are the sovereign, not the general. Peasants obey you.
Heroes do not. They wander off, pick their own fights, buy their own swords and
die in ditches. The only way to steer them is to put money on the map.

![the realm](docs/screenshot.png)

## Playing

- **One finger drags** the map, **two fingers pinch** to zoom, **tap** to select.
- **Zoom** steps through Close / Mid / Far / Wide. Tap the corner map to open the whole
  realm, then tap anywhere on it to jump there.
- Select any unit and hit **Follow** to lock the camera onto it; drag the map to let go.
- **Tap your City Centre** → *Hire Peasant*. Peasants are your entire economy.
- **Tap a gold mine, quarry or forest** → *Send 1 / Send 3 / Send all idle*.
  They walk there, dig, and haul the load back to the nearest depot.
  (Or select peasants first and tap the resource — either works.)
- **Build** a guild, hire a hero from it, then **raise an attack flag** on a monster
  lair. The bounty is held in escrow and paid to whichever hero actually does the job.
- **Destroy every lair to win.** Lose your City Centre and the realm falls.

Keyboard, if you are at a desk: `B` build, `F` flags, `K` realm, `P` select peasants,
`M` full map, `C` follow the selected unit, `space` pause, arrows pan, `+`/`-` zoom,
shift-drag to box-select.

## How the kingdom actually works

**Peasants** mine gold, quarry stone, cut wood, raise buildings and repair them.
They flee from anything with teeth. They are the only units that take orders.

**Heroes** score the whole world several times a second — bounties, visible monsters,
known lairs, shops worth visiting, unexplored ground — weighted by their class's
greed and courage, and discounted by distance and by the danger already standing there.
Then they do whatever scored highest. That is the entire game:

| Class | Temperament |
|---|---|
| Warrior | Tough, brave, cheap to please. Charges almost anything. |
| Ranger | Fast, greedy, roams widest. Will chase any flag for coin. |
| Wizard | Devastating at range, fragile, flees early and sensibly. |
| Cleric | Heals the wounded, and the Temple halves resurrection costs. |

Heroes stay within their own patch of the realm unless a bounty tempts them further —
so **flags are how you project force**, not orders.

**Reward flags** are your only lever on them:

- **Attack** — paid when the area is cleared of monsters and lairs.
- **Explore** — paid on arrival; the fog lifts around it.
- **Defend** — pays out gradually while a hero holds the ground.
- **Fear** — free, and makes heroes avoid a place entirely.

Gold you put on a flag is held in escrow (shown in brackets beside your treasury) and
refunded in full if you withdraw the flag.

**The money loop** is the one Majesty players will recognise: heroes keep the loot
they earn, then spend it at your Marketplace, Blacksmith and Inn — and you tax
every purchase at 70%. An armed, well-supplied hero is a revenue stream.

**Monster lairs** sleep until you come near them or the calendar catches up, and
they fill with defenders the moment they wake — so an undefended nest is never free
loot. Lairs only send raiders once your buildings are close enough to bother them,
which means *expanding toward a lair is what makes it hostile*. The first few days
are peaceful on purpose: get a mine running and a guild up.

## Running it locally

No build step, no dependencies. Any static server will do:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Add `?seed=12345` to the URL to replay a specific realm.

## Deployment

Pushing to the default branch runs `.github/workflows/deploy.yml`, which publishes
the repository root to GitHub Pages. It needs **Settings → Pages → Source: GitHub Actions**
enabled once on the repository.

## Layout

```
index.html          shell, HUD markup
styles.css          16-bit UI skin, mobile-first
src/
  main.js           boot, frame loop, onboarding
  game.js           simulation core: economy, flags, spawning, victory
  brains.js         peasant / hero / guard / monster AI
  entities.js       units, buildings, lairs, projectiles
  world.js          map generation, fog of war, A*
  render.js         camera, depth-sorted drawing, pixel font, minimap
  ui.js             DOM panels and all pointer input
  art.js            every sprite, generated at runtime from code
  audio.js          WebAudio chiptune SFX and music
  data.js           all balance numbers in one place
  fx.js             particles and floating text
  util.js           RNG, math, binary heap
```

There are no image or audio assets: sprites are drawn from character grids and
procedural shapes at load time, and the sound is synthesised square waves.
