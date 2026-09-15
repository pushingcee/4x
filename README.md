# Realm of Majesty

A 16-bit kingdom sim, written as a single dependency-free web page and built to be
played with a thumb on a phone.

**The premise:** you are a small god with a valley full of peasants. You do not
micromanage them. You tell each one **what they are for**, and they go and find the
work themselves.

![the realm](docs/screenshot.png)

## Playing

- **One finger drags** the map, **two fingers pinch** to zoom, **tap** to select.
- **Zoom** steps through Close / Mid / Far / Wide. Tap the corner map to open the whole
  realm, then tap anywhere on it to jump there.
- Select any unit and hit **Follow** to lock the camera onto it; drag the map to let go.
- **Tap your City Centre** → *Hire Peasant*.
- **Tap a peasant** and pick a calling: **Mine**, **Wood**, **Stone**, **Build** or **Idle**.
- Or open the **Peasants** tab to move the whole workforce between callings at once.

Keyboard, if you are at a desk: `B` peasants, `K` realm, `P` select peasants,
`M` full map, `C` follow the selected unit, `space` pause, arrows pan, `+`/`-` zoom,
shift-drag to box-select.

## Callings

A calling is permanent until you change it, and it is a *standing instruction*, not a
destination. A Miner walks to the nearest gold seam, works it until it is empty, and
then walks to the next nearest one without being asked. When there is genuinely nothing
left they say so by name and wait near home rather than milling about pretending.

| Calling | What they do |
|---|---|
| **Miner** | Finds the nearest gold mine and works it out, then the next. |
| **Woodcutter** | Fells the nearest woodland tree by tree; felled trees disappear. |
| **Quarrier** | Cuts stone at the nearest quarry and moves on when it is spent. |
| **Builder** | Runs to whatever is half-built or damaged. |
| **Idle** | Loiters near home and lends a hand with construction. |

You can still override a calling by tapping a **specific** mine, quarry or tree — that
sets the matching calling *and* starts them on the seam you picked. The **Peasants** tab
also lists every peasant by name, so you can single one out and give them a calling of
their own.

## Attributes

Every unit has four attributes. They read in steps of five, and five is the baseline —
a unit with straight fives behaves exactly as its raw definition says.

| Attribute | Effect |
|---|---|
| **Strength** | +5% melee damage per 5 points |
| **Agility** | +5% attack speed per 5 points |
| **Constitution** | +4 health per point |
| **Intelligence** | +4 mana per point, and +3% critical chance per 5 points |

Peasants start at 5 across the board; hero classes start lopsided (a warrior is strong
and tough and never crits, a wizard is frail and crits often) which is the seed of the
class system.

**Work is what changes them.** Each calling trains two attributes, up to five points
each, and progress only accrues while a peasant is *actually doing the job* — walking
to the seam and hauling the load home teach nothing.

| Calling | Trains |
|---|---|
| Miner | STR + CON |
| Woodcutter | AGI + STR |
| Quarrier | CON + INT |
| Builder | INT + AGI |

Points earned are permanent and stack across callings, so a peasant who has mastered
mining and then woodcutting ends up at STR 15. Veterans are worth keeping.

Every load walks back to the City Centre, so **distance is the whole economy**. Where
the seams fell on your map decides how rich you are.

## Current scope

The game is deliberately stripped back to the peasant economy while that loop is built
out. Only the City Centre exists; the guilds, shops, towers and the heroes who used to
take reward-flag bounties are switched off — the code is all still there, behind
`BUILD_ORDER_FULL` and `RAIDS_ENABLED` in `src/data.js`, waiting to come back a piece
at a time.

Monster lairs still breed and their broods still prowl their own ground. They will not
march on your town, but a peasant sent to a seam next to a nest is a peasant you may not
see again — so **where** you send them matters.

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
  brains.js         peasant callings, plus the dormant hero / guard / monster AI
  entities.js       units, buildings, lairs, projectiles
  world.js          map generation, fog of war, A*
  render.js         camera, depth-sorted drawing, pixel font, minimap
  ui.js             DOM panels and all pointer input
  art.js            every sprite, generated at runtime from code
  audio.js          WebAudio chiptune SFX and music
  data.js           missions, balance numbers, and what is switched on
  fx.js             particles and floating text
  util.js           RNG, math, binary heap
```

There are no image or audio assets: sprites are drawn from character grids and
procedural shapes at load time, and the sound is synthesised square waves.
