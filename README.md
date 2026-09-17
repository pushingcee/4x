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
- **Build** a Lumberyard or a Mining Camp out beside a far seam — it becomes the depot
  everything is hauled to, and it makes the crew around it faster.
- Cover an outpost with a **Guard House** or a **Watch Tower**, because raiders go for
  whatever building is nearest and that is now yours.
- **Build** a Barracks and **hire** a warrior, then raise a **Flag** to tempt them somewhere.

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
nothing a level ever grants is rounded away.

| Attribute | Effect |
|---|---|
| **Strength** | +2.2% melee damage per point |
| **Agility** | +1.6% attack speed per point |
| **Constitution** | +7 health per point |
| **Intelligence** | +4 mana per point, and +0.8% critical chance per point (capped at 45%) |

Peasants sit at 5 across the board and stay there — they are workers, not projects.
Hero classes arrive lopsided, and that is the whole class system: a warrior is strong
and tough and never crits, a wizard is frail and crits often.

A hero's numbers come from exactly four places, and every one of them is visible on
their sheet:

| Source | What it gives |
|---|---|
| **Class baseline** | what the profession is, e.g. a warrior at STR 8 / CON 8 |
| **Class bonus** | the layer on top, +8 STR / +7 CON for a warrior |
| **Rank** | **+5 to every attribute** per level, to a cap of level 5 |
| **Gear and specialisation** | what they looted and what they chose at the cap |

A freshly hired warrior is STR 16 / CON 15 with 200 health. **Rank is the only
progression a unit has, and rank comes from fighting** — the table runs
60 / 180 / 420 / 850 experience, so level 5 is a campaign's work rather than an
afternoon's. What that buys, measured against the same hero on their first day:

| Hero at level 5 | Health | Damage |
|---|---|---|
| Warrior (Fury) | ×1.70 | ×1.53 |
| Warrior (Protection) | ×2.23 | ×1.44 |
| Ranger (Longbowman) | ×2.25 | ×1.83 |
| Wizard | ×2.75 | ×1.44 |
| Cleric | ×2.01 | ×1.43 |

There used to be a second track: villagers trained attributes by working, and a knight
was a villager who had been walked through every calling first. It is gone. It read as
a checklist with one correct order rather than a decision — the fastest route to a good
knight was always the same five instructions in the same order — and it made the answer
to every question "grind another villager".

Progression now lives on the map instead. Every load walks to the nearest **depot**, so
**distance is the whole economy** — and the answer to distance is to move the depot.

## Outposts

At the start the City Centre is the only depot on the map, so every load walks the whole
way home and the rich far seams are barely worth working. Two buildings change that:

| Outpost | What it does |
|---|---|
| **Lumberyard** | A depot for timber. Woodcutters within 11 tiles fell **60% faster**. |
| **Mining Camp** | A depot for ore and stone. Miners and quarriers within 11 tiles work **50% faster**. |

Plant one beside a distant seam and it becomes the nearest depot for everything around
it: the walk collapses, and the crew gets faster into the bargain.

**An outpost is a bet, not a free upgrade.** Raiders march on whatever building is
nearest to them, and the far ground is where the lairs are — so a Lumberyard out at the
edge of the map is the first thing a camp finds. Two buildings answer that:

| Cover | What it does |
|---|---|
| **Guard House** | Keeps three guards who patrol within 150px and **never wander off**. |
| **Watch Tower** | Shoots bolts at anything hostile in range, and lifts the fog around it. |

Both cost the stone you went out there to cut, which is the loop: the far seam pays for
the outpost, the outpost pays for its cover, the cover lets you sit close enough to a
lair to be worth raiding, and clearing that lair opens the ground past it.

**The depot and the cover multiply.** Ten peasants put on the furthest gold seam of the
seed-4242 map — 506px from home, no soldiers anywhere — over four minutes, averaged
across forty runs:

| | Gold in four minutes |
|---|---|
| Bare seam | 46 |
| Guard House + Watch Tower, no depot | 89 |
| Mining Camp, no cover | 38 |
| **Mining Camp + cover** | **319** |

That is about **seven times** a bare far seam, and neither building gets close on its
own: a depot with nobody guarding it is a depot your crew never lives long enough to
reach, and cover with no depot just means they survive a walk that was never worth
making.

That run is deliberately the worst case — the furthest seam, unescorted, with the peace
already over — and the crew is still wiped inside four minutes. Outposts buy you the
economy of the far ground; they do not buy you the right to be there. That part is what
soldiers are for.

Losing an outpost is a setback, not a defeat. Losing the City Centre still is.

## Hiring soldiers, and flags

Build a **Barracks** (Warriors) or a **Rangers Guild** (fast archers who see further)
and hire from it. **A hero costs gold and nothing else** — no villager puts down a pick,
nobody drills, and your workforce does not shrink. Each guild holds only two or three,
so the number of soldiers you can field is a question of what you have built, not of
how many villagers you have ground through the fields.

| | STR | AGI | CON | INT | Health |
|---|---|---|---|---|---|
| Warrior | 16 | 7 | 15 | 5 | 200 |
| Ranger | 7 | 17 | 9 | 6 | 112 |
| Wizard | 5 | 6 | 7 | 19 | 80 |
| Cleric | 6 | 6 | 11 | 16 | 138 |

A hero can still be given a working **calling** — tell a warrior to mine and they will
go and mine. Being sworn to a guild is what somebody *is*; a calling is only what they
are doing this afternoon.

### Wizards and Clerics

Two more guilds, and two classes that are nothing like the first two.

A **Wizards Guild** hires a **Wizard**: fire at a hundred
pixels' reach that lands on *everything* standing together, not just what it
was aimed at. Full damage on the target and 60% on everyone within a
fireball's width of it, so the tighter a pack marches the worse it goes for
them. A wizard is also made of paper -- 66 base health and the earliest nerve
of anyone in the realm -- so they open at range and leave before it gets
close.

A **Temple** hires a **Cleric**, and a cleric does not wait to be
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

### Loot

Monsters carry things, and the stronger the monster the likelier it is
carrying something worth having -- a rat almost never, an ogre two times in
five, a razed camp always. Whatever falls goes to one of the heroes who was
actually there, chosen at random among them.

Seven slots: **weapon, chest, neck, two earrings, two rings.** Weapons are
class-locked, so loot that lands in the wrong hands is carried to market
rather than silently wasted:

| Class | Carries |
|---|---|
| Warrior | swords, axes |
| Ranger | swords and daggers — **assassins** take swords, **mercenaries** daggers |
| Wizard, Cleric | staves, wands |

Four tiers, and what they carry:

| Tier | What it rolls |
|---|---|
| **Common** | one attribute |
| **Rare** | one attribute, larger — or two |
| **Epic** | two attributes and a modifier, with flavour text |
| **Legendary** | two attributes well above epic, a modifier, and a name of its own |

Beyond attributes an item can carry flat **damage** (axes hit flatly harder),
**mana**, **critical chance** (daggers find the gap), **lifesteal**, or —
legendary only — **spell power**, which multiplies a wizard's fire and a
cleric's mending alike.

Names are built from what the thing is and what it does, so they read:
*Band of the Bear*, *Thorn Brigandine of Deep Waters*, *Grim Waraxe of the
Bear*. Legendaries get names instead of descriptions — *Serathil*,
*Ironhowl*, *The Unbroken Circle*, *Coat of the Drowned King* — and epics and
legendaries carry a line of flavour.

**Heroes judge loot on their own terms** and nobody else's:

| Class | Wants |
|---|---|
| Warrior | STR > CON > AGI |
| Ranger | AGI > STR > CON — and a longbowman, who never closes, discounts strength |
| Wizard, Cleric | INT > CON > the rest |

They wear it if it beats what is in that slot by their own reckoning, and
carry it to market if it does not.

### The Marketplace

Five shelves, restocked over time, and the stock improves as the realm does.
Heroes walk in on their own: they sell everything in their bag, then buy the
one thing on the shelf that beats what they are wearing and that they can
actually afford. **You tax both ends of every deal** — a quarter of what they
sell and near a third of what they spend — so a marketplace is an income, not
an expense. What they sell goes straight back onto the shelf for somebody else
to find.

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

### What happened to talents

Every calling used to hand out three **talent points**, spent per villager in that
calling's own tree — carry more, work faster, walk quicker. Three trees times three
talents times three ranks, chosen individually for every peasant you owned.

They are gone, and the ideas survived them: the same three effects now come from
**buildings** instead. A Lumberyard is Big Bundles for everybody standing near it, and
you decide it once, by choosing where to put the thing, instead of twenty times in a
menu. The decision moved from a stat sheet onto the map, which is where you were
looking anyway.

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

Everything defined in `src/data.js` is now buildable: City Centre, Peasant Hut,
Lumberyard, Mining Camp, Guard House, Watch Tower, Marketplace, Inn, Blacksmith,
Barracks, Rangers Guild, Wizards Guild and Temple — with peasants, four hero classes
and flags. Nothing is switched off behind a flag any more.

**No camp is ever empty.** Every lair keeps a standing garrison from the first
day -- a rat nest three, a goblin camp four, an ogre den three -- and camps
more than twenty-six tiles from home keep more, up to three extra. Walking
into one is a fight you chose rather than a coin flip on whether anybody
happens to be home.

Raids are on. After a few days of peace, lairs close enough to your buildings send
parties at whatever building is **nearest to them** — so expanding toward a nest is what
makes it hostile, and a forward outpost is what it finds first. Build a Barracks and
warriors will meet them in the field; build nothing and your peasants get picked off
around day 17 and the City Centre erodes from there.

**A camp fights back.** Hit one and it sounds the alarm: for the next 25 seconds it
musters reinforcements at nearly twice the usual rate, so a raiding party has to kill
the garrison faster than the lair can replace it. The muster is finite — the camp cannot
bleed you forever — but a party that is merely *adequate* will lose the race. Monsters
also toughen as the days pass, so a day-40 goblin is about three times the day-1 one;
the realm has to grow at least as fast as the dark does.

Roughly where the ladder sits: a rat nest falls to a single fresh warrior, a goblin camp
**wipes** two of them but falls to three at level 2, a skeleton camp costs a life at
three level 3s, and an ogre den wants three level-5 veterans — and still takes one of
them. Since heroes no longer inherit a villager's training, rank is the only thing that
closes that gap, and rank comes from the smaller fights first. Gold buys courage, too: a
fat enough bounty will talk soldiers into a fight they would otherwise refuse.

## Running it locally

No build step, no dependencies. Any static server will do:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Add `?seed=12345` to the URL to replay a specific realm.

### Testing hatch

Levelling a soldier to the rank cap honestly is a campaign's work, which is a
lot to ask before trying a specialisation out. So:

| URL | What you get |
|---|---|
| `?test=1` | three level-5 warriors and three level-5 rangers outside the City Centre, plus 1500 gold to build with |
| `?heroes=warrior:2,cleric:1,wizard:1` | whatever you name, in whatever numbers |
| `?test=1&level=3` | the same party at a different rank |

They arrive at full health on walkable ground, ranked high enough that the
specialisation picker is waiting on their sheet. Combine with `?seed=` to test
the same party on the same map twice. Without one of these parameters nothing
is spawned and the game starts exactly as it always did.

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
  brains.js         peasant callings, plus the hero / guard / monster AI
  entities.js       units, buildings, lairs, projectiles
  world.js          map generation, fog of war, A*
  render.js         camera, depth-sorted drawing, pixel font, minimap
  ui.js             DOM panels and all pointer input
  art.js            every sprite, generated at runtime from code
  audio.js          WebAudio chiptune SFX and music
  data.js           missions, buildings, classes, and every balance number
  fx.js             particles and floating text
  util.js           RNG, math, binary heap
```

There are no image or audio assets: sprites are drawn from character grids and
procedural shapes at load time, and the sound is synthesised square waves.
