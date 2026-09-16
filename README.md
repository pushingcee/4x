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
- Or open the **Folk** tab to move the workforce around in bulk, or pick one villager
  by name and give them a calling of their own.
- **Build** a Barracks, train warriors, then raise a **Flag** to tempt them somewhere.

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

Every unit has four attributes. Five is the baseline — a unit with straight fives
behaves exactly as its raw definition says — and **every single point counts**, so
nothing a veteran learns is ever rounded away.

| Attribute | Effect |
|---|---|
| **Strength** | +2.2% melee damage per point |
| **Agility** | +1.6% attack speed per point |
| **Constitution** | +7 health per point |
| **Intelligence** | +4 mana per point, and +0.8% critical chance per point (capped at 45%) |

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

**Nothing is ever lost.** Knighting a villager keeps every point and every
talent they earned, and a soldier can be given a working calling again at any
time — tell a warrior to mine and they will go and mine, with all their
training intact. A knighthood is a layer on top of who somebody is, not a
replacement for it.

Tap any peasant and their sheet shows all four tracks at once — mastered, part-done,
and never started — so you can see exactly what a given villager has become.

**Warriors grow by rank instead.** They cap at **level 5**, and every level grants
**+5 to every attribute** — the only thing levels do, so a hero's numbers come from one
place. Ranks are *earned*, not handed out: the table runs 60 / 180 / 420 / 850 experience,
so level 5 is the work of a whole campaign rather than an afternoon.

The two systems multiply. A villager taken through **every** calling and then knighted
and levelled to 5 ends up with roughly **2.2× the health and 2.7× the damage** of a
conscript pulled straight off the farm — near **six times** the staying power in a
straight fight. Raising a veteran is the strongest thing you can do with your time.

Every load walks back to the City Centre, so **distance is the whole economy**. Where
the seams fell on your map decides how rich you are.

## Warriors and flags

Build a **Barracks** (Warriors) or a **Rangers Guild** (fast archers who see further)
and you can knight villagers into soldiers — but a soldier is never conjured out of
gold, and never on the spot. Set a villager's calling to **War** or **Scout** and they
are **called up**: they down tools, take up a spear, and drill for the best part of a
minute before they are knighted. The guild's own button calls up whoever is idle, and
only pulls somebody off a job if nobody is standing around.

**A recruit is already useful.** While drilling they stop gathering and become militia —
they walk among the people still working, hit harder than an ordinary villager, and go
for anything that threatens a worker. Change their calling before the drill finishes and
they go back to the fields with the fee refunded. Recruits hold a place in their guild's
roster, so three drilling villagers fill a three-soldier Barracks.

A class is a **layer, not a replacement**. Knighting keeps everything a villager already
was — their baseline and everything the work taught them — and adds the class bonus on
top, so nothing can ever go *down* by being promoted:

| | STR | AGI | CON | INT |
|---|---|---|---|---|
| Warrior | +8 | +2 | +7 | — |
| Ranger | +2 | +9 | +3 | +1 |

A villager who mastered mining becomes a STR 18 / CON 17 warrior with 214 health, where
one straight off the farm starts at 13 / 12 and 179. Veterans make better soldiers.

### Wizards and Clerics

Two more guilds, and two callings that are nothing like the first two.

A **Wizards Guild** turns a villager into a **Wizard**: fire at a hundred
pixels' reach that lands on *everything* standing together, not just what it
was aimed at. Full damage on the target and 60% on everyone within a
fireball's width of it, so the tighter a pack marches the worse it goes for
them. A wizard is also made of paper -- 66 base health and the earliest nerve
of anyone in the realm -- so they open at range and leave before it gets
close.

A **Temple** turns one into a **Cleric**, and a cleric does not wait to be
useful. They go *looking*: anybody in the realm below 72% health is a reason
to cross up to 520 pixels of map, and they hurry when they do. Two things
come out of them:

- **Mending** — 24 health every two seconds, more with rank, always on
  whoever is **worst off** within reach.
- **Blessing** — +25% damage and a fifth of the harm turned aside, for 20
  seconds, on **anyone who comes near**: a villager hauling ore as readily as
  a warrior mid-swing. Whoever is closest to a fight simply goes first in the
  queue. A cleric is not only a bandage.

**They travel with the soldiers.** A cleric is not a scout and not a duellist
— alone they are a robe with a mace — so with nobody hurt they keep station
near the nearest fighting hero rather than wandering. They never pick a fight
of their own, never take an attack goal, and back away from anything that gets
within three tiles, mending and blessing as they retreat. They swing only when
genuinely cornered.

Mana comes back faster the cleverer they are: a flat rate everyone gets, plus
a share per point of intelligence over five. A cleric at INT 23 regenerates
3.4/second working; at INT 43, 5.8/second, out of a pool nearly twice the
size. Putting a *quarrier* through the Temple is worth doing.

Both cost **mana**, which is what intelligence has been quietly buying all
along: 4 per point of INT, refilling slowly while they work and faster while
they stand still. A cleric in a hard fight runs the pool most of the way down,
so how much they can do really is how clever they are.

Crucially a cleric keeps out of reach -- they back off from anything that gets
within about three tiles, mending and blessing as they retreat, and stand off
on the near side of a patient rather than walking into the melee to reach
them. The first version did walk in, and died in every single test.

Measured against a mixed pack of ogres and skeletons that three level-3
warriors cannot quite handle: without a cleric the party was wiped having
killed three of seven. With one, the same party cleared all seven and two
walked away. Roughly fifty heals a fight and three soldiers blessed at once.

Neither has specialisations yet -- those come later.

### Experience, and who gets it

Rank used to go entirely to whoever landed the killing blow. Three warriors
beating a skeleton together meant one of them got all 24 experience and the
other two got nothing, and a cleric who kept all three alive got nothing ever.

Now **everyone who had a hand in it shares**, and taking part means either
hitting the thing or being hit by it -- so a Protection warrior holding a
camp's attention while the others do the killing earns their share of it.
Credit lasts 12 seconds, so wandering in at the end earns nothing.

The pot is a little larger than a lone hero would have earned, capped at four
contributors, and split evenly:

| Party | Each gets | Pot |
|---|---|---|
| Alone | 100% | 1.00x |
| Two | 58% | 1.15x |
| Three | 43% | 1.30x |
| Four or more | 1.45 / n | 1.45x |

So an individual share is always smaller than a solo kill, but the party as a
whole earns more, and nobody is ever left out. Gold from a kill still goes to
whoever struck the blow -- heroes are greedy, and that has never been fair.

**Healers count at half weight.** A cleric supports every kill in a fight
rather than some of them, so on a full share they would out-level the soldiers
they exist to keep alive. At half they level alongside. On top of that they
earn rank directly for the job: experience per point of health *actually*
restored, so topping up somebody already full pays nothing and there is
nothing to farm, plus a little for each blessing.

### Talents

Work does not just raise attributes, it earns **talent points** — three per
calling, handed out as that calling's training track fills. Each calling has a
tree of three talents at three ranks each, so three points never cover a tree
and the choice is a real one:

| Talent | Per rank |
|---|---|
| Capacity (Deep Pockets, Big Bundles, Broad Back, Full Hod) | +25% carried per load |
| Rate (Steady Swing, Sharp Axe, True Chisel, Scaffolding) | +20% faster at the work |
| Legwork (Sure Footing, Trailblazer, Quarry Legs, On The Run) | +12% movement while working |

Points are earned and spent per calling, and **Rethink** hands a tree's points
back, so nothing you pick is a trap. A miner with three ranks of Deep Pockets
hauls 35 gold a trip instead of 20.

### Specialisations

At **level 5** a soldier chooses a specialisation. It is the one permanent
decision a unit makes, and each is worth exactly **twenty attribute points** —
the choice is about shape, never about power. Each also unlocks an ability
paid for out of a class resource: warriors work themselves into a **Rage**,
rangers hold a **Focus**.

| Warrior | Points | Ability |
|---|---|---|
| **Fury** | +10 STR, +10 AGI | **Rampage** — swings twice as fast and drinks back a quarter of the damage dealt |
| **Arms** | +8 STR, +8 AGI, +4 CON | **Mortal Strike** — one crushing blow for triple damage |
| **Protection** | +15 CON, +5 STR | **Shield Wall** — takes half damage and drags every nearby monster onto itself |

| Ranger | Points | Ability |
|---|---|---|
| **Longbowman** | +8 STR, +12 AGI | **Aimed Shot** — triple damage, and a third more reach than anything can answer |
| **Mercenary** | +6 STR, +10 AGI, +4 CON | **Ambush** — a brutal opener, far worse if it lands before they are seen |
| **Assassin** | +14 AGI, +6 INT | **Vanish** — steps out of sight, closes unseen, opens with a five-fold strike |

Measured against an unspecialised level 5: warriors gain **×1.27 / ×1.32 /
×1.42** staying power, rangers **×1.46 / ×1.35 / ×1.19**. The assassin looks
weakest on paper and is not — the number cannot see an opener landing at 2.4×
on something that never got to swing back.

**Mercenaries and assassins fight out of the dark.** They are invisible to
monsters while unseen, strike for a bonus when they open from it, and then
break off rather than standing and trading — strike, leave, come again. In a
four-on-one brawl an assassin spends a third of the fight unseen and takes
about a third of the attention it otherwise would.

### Stances

Soldiers take no orders, but they do have a standing posture, set per soldier:

- **Defend** (the default) — holds the realm. Walks a beat between the buildings and the
  working villagers, and **drops everything to sprint** at anything attacking a worker
  anywhere in the kingdom.
- **Roam** — wanders off into the dark, scouts, and picks fights with lairs on its own.

A defender averages about 6 tiles from home where a roamer drifts past 25. Flags still
tempt either of them — that is what flags are for.

Beyond the stance, the only way to steer them is to put money on the map:

- **Attack** — paid when the area is cleared of monsters and lairs.
- **Explore** — paid on arrival; the fog lifts around it.
- **Defend** — pays out gradually while a warrior holds the ground.
- **Fear** — free, and makes them avoid a place entirely.

Gold on a flag sits in escrow (shown in brackets beside your treasury) and is refunded
in full if you withdraw it.

Peasants are not completely helpless. They will run from a monster they merely see, but
something already biting them gets hit back — and they break off and flee once badly
hurt. A lone peasant can see off a rat; anything larger needs a warrior.

## Current scope

City Centre, Barracks, Rangers Guild, Wizards Guild and Temple, with peasants,
four soldier classes and flags. The shops, towers and huts are defined but
switched off behind `BUILD_ORDER_FULL` in `src/data.js`.

Raids are on. After a few days of peace, lairs close enough to your buildings send
parties at the town — so expanding toward a nest is what makes it hostile. Build a
Barracks and warriors will meet them in the field; build nothing and your peasants get
picked off around day 17 and the City Centre erodes from there.

**A camp fights back.** Hit one and it sounds the alarm: for the next 25 seconds it
musters reinforcements at nearly twice the usual rate, so a raiding party has to kill
the garrison faster than the lair can replace it. The muster is finite — the camp cannot
bleed you forever — but a party that is merely *adequate* will lose the race. Monsters
also toughen as the days pass, so a day-40 goblin is about three times the day-1 one;
the realm has to grow at least as fast as the dark does.

Roughly where the ladder sits: a rat nest falls to a single fresh warrior, a goblin camp
**wipes** two of them but falls to three at level 2, a skeleton camp costs a life at
three level 3s, and an ogre den wants three level-5 veterans — and still takes one of
them. Gold buys courage, too: a fat enough bounty will talk soldiers into a fight they
would otherwise refuse.

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
