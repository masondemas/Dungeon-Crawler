# Dungeon Crawler — Project Notes

A first-person melee dungeon crawler that runs in the browser.
Plain HTML + JavaScript, Three.js loaded from a CDN, no build tools.
Hosted on GitHub Pages from the root of the `main` branch of this repository.
Live at: https://masondemas.github.io/Dungeon-Crawler/

## Files

| File | What it does |
|---|---|
| `index.html` | The web page: crosshair, controls hint, "click to play" screen, loads Three.js |
| `game.js` | All game code: builds the level from its map, camera, movement, mouse look, collisions, torches |
| `hud.js` | Keeps the on-screen health and stamina bars up to date; floating damage numbers |
| `weapons.js` | Weapon stats (data only) and the low-poly weapon models |
| `combat.js` | Weapon in your hand, swing animation, hit detection |
| `dummies.js` | Training dummies (practice targets) |
| `equipment.js` | Shield and armor stats (data only) and shield models |
| `pickups.js` | Things you pick up by walking over them (healing potions), the potion model, the exit portal |
| `enemies.js` | Enemy and boss stats (data only), enemy models and behaviour |
| `effects.js` | Blood spurts: one pooled particle system for all droplets |
| `wounds.js` | Cuts that build up on enemies where they were hit, and the overall bloodied look |
| `progress.js` | Carries potions and gear from one level to the next (browser session storage) |
| `levels.js` | The level maps, drawn as text (edit this to design levels) |
| `NOTES.md` | This file |
| `README.md` | Short intro + how to play |

## Game design (full vision)

- **View & movement:** first person, WASD to move, mouse to look.
- **World:** linear dungeons made of rooms + corridors (not open world).
- **Progression:** each level ends in a boss room; difficulty rises each level.
- **Level size:** several medium-sized levels rather than one giant one. Each
  level should take **10–12 minutes** to play through (exploring + fights + boss).
  Rough guess: about 8–12 rooms with fights, joined by corridors. We'll tune this
  by playtesting once enemies exist.
- **Combat (melee only, Skyrim-inspired):**
  - Light attack
  - Hold-to-charge power attack
  - Block
  - Stamina bar (attacks, power attacks and blocking cost stamina)
- **Weapons (data-driven stats, not separate code):**
  - Daggers: fast, weak
  - Swords: balanced
  - Axes: slow, strong
  - Maces: slowest, stagger enemies
- **Defence:** shields improve blocking; armor reduces damage taken.
- **Healing:** potions on a hotkey with a short drinking delay; health regen
  starts after ~5 seconds without taking damage.
- **Not in the game:** magic, bows, throwables.
- **Look:** low-poly; placeholder shapes are fine for now.

## What's built

### Step 1: Room, movement, mouse look ✅
- One stone room (16 × 20 m) with stone-block walls, a flagstone floor, a ceiling,
  four flickering wall torches, and two pillars.
- Stone textures are drawn by code (no image files).
- Walls and pillars are solid. Everything solid is listed in `colliders` in
  `game.js`. The player is treated as a circle and pushed out of any box it touches.
- Click the screen to lock the mouse; Esc releases it.
- WASD movement, with Shift to run (a small extra; it will cost stamina later).
- Crosshair in the centre and a controls hint in the bottom-left corner.

### Step 2: Rooms joined by corridors ✅
- Levels are drawn as text maps in `levels.js`. Each character is a 2 × 2 m square:
  `#` wall, `.` floor, `S` start, `P` pillar, `T` torch on a wall, `R` red torch.
- Level 1 "The Old Crypt" is a linear path: start room → corridor → pillar hall →
  corridor south → side room → winding corridor → large boss room (red torches,
  four pillars). There's no boss yet.
- Each level can choose which way the player faces at the start (`startFacing`).
- Speed trick: only the 8 torches nearest the player actually cast light
  (17 torches in level 1). The game moves this small set of lights around as you
  walk, so it stays fast however many torches a map has.
- The player carries a faint lantern so dark corridors are still visible.
- The level name shows in the top-left corner.

### Step 3: Health and stamina ✅
- Health bar (red) and stamina bar (green) at the bottom centre. They shrink in
  from both ends like Skyrim's. A pale "ghost" shows what you just lost, then
  slides away.
- Player numbers live in `PLAYER_STATS` at the top of `game.js`
  (max health 100, max stamina 100, run cost, refill speed, refill delay).
- Running (Shift) costs 20 stamina per second, but only while you're actually
  moving. Pushing into a wall costs nothing.
- Stamina refills at 25 per second after a 1 second pause.
- Run it to 0 and you're **winded**: the bar turns dull and you can't run
  until it refills to 30.
- `takeDamage()` lowers health and flashes the screen edges red.
  `useStamina()` is ready for attacks and blocking to use later.
- Controls hint moved to the top-right corner to make room for the bars.
- **Test only:** press **K** to take 10 damage. Remove this once enemies exist.

### Step 4: Sword and light attack ✅
- Low-poly iron sword in the bottom-right of the screen. It bobs as you walk.
  It's drawn in its own layer on top of the world, so it never clips into walls.
- **Left click = light attack:** a diagonal slash from upper right to lower left
  (wind-up → strike → recover). Click again during the end of a swing to chain
  the next one.
- Weapons are **data** in `weapons.js` (damage, reach, arc, wind-up / strike /
  recover times, stamina cost). The sword: 15 damage, 2.3 m reach, 100° arc.
  Light attacks cost 0 stamina, like Skyrim. Change `staminaCost` to make them cost some.
- Hit detection: during the strike part of the swing, anything in reach and
  inside the swing's arc gets hit, once per swing.
- Anything hittable is a "target" (`position`, `radius`, `onHit()`). Enemies
  will use the same setup.
- **Training dummies:** map letter `D`. They wobble, flash red and show a
  floating damage number when hit, and can't be destroyed. Level 1 has 3 (two in
  the start room, one in the pillar hall).
- **Update fix:** `index.html` adds a version number (`?v=4`) to every game file,
  so browsers download fresh files after each update. **Bump this number with every
  update** (all lines in the import map plus the `game.js` script tag).

### Step 5: The first enemy (Ghoul) ✅
- Map letter `E` places a Ghoul: a hunched, low-poly green figure with glowing eyes.
- Enemy stats are **data** in `enemies.js` (`ENEMY_TYPES`): Ghoul has 45 health,
  12 damage, 2.6 m/s speed, 1.7 m attack range, 0.65 s wind-up and 1 s rest after attacking.
- Behaviour (states): **idle** until it sees you (within 16 m, no wall between you)
  → **chase** (walks to where it last saw you, gives up if it loses you) → **wind-up**
  (raises arms, your warning) → **strike** (lunges and slashes; it hits only if you're
  still close and in front of it) → **recover** → chase again.
- Hitting an enemy: red flash, flinch, small shove back, floating damage number,
  and a health bar over its head. Hitting an idle enemy wakes it up.
- 3 sword hits kill a Ghoul. It falls over, sinks into the floor and is removed.
- Enemies and the player can't walk through each other. Enemies also keep
  apart from each other.
- Line-of-sight check (`canSee`) uses the map. Enemies can't see through walls,
  and your sword no longer hits through wall corners (fixed known issue).
- **Death:** at 0 health a "YOU DIED" screen appears; click to restart (reloads the page).
- The K "hurt yourself" test key was removed.
- Level 1 has 4 Ghouls: one in the pillar hall, two in the side room, one in the
  winding corridor. The boss room is still empty.

### Step 6: Power attacks and blocking ✅
- **Power attack (hold left click):** the swing starts straight away. If you
  keep holding past the wind-up, it turns into a charge. The sword pulls back
  and trembles, and the crosshair grows and turns orange, then becomes a red ✕
  at full charge (grey if you lack the stamina). Release to strike.
  - Damage ×1.5 (barely charged) up to ×2.5 (full charge, ~0.8 s). Sword: 23–38.
  - Costs 25 stamina; with less, it's just a normal swing.
  - **Staggers** enemies for 0.8 s, cancelling an attack they're winding up.
  - The swing and recovery are a bit slower. You walk at 60% speed while charging.
  - Bigger orange damage numbers.
- **Block (hold right click):** the sword is raised diagonally across your body.
  - Blocks 60% of a hit's damage from the front (120° arc), costing 1.2 stamina
    per point blocked. A Ghoul hit (12) → you take 5 and use ~9 stamina.
  - A blocked enemy **recoils** (staggered for 0.6 s), giving you an opening.
  - **Guard break:** not enough stamina → the full hit gets through and you can't
    block for 1.2 s ("Guard broken!"). Blocking comes back by itself if you're
    still holding right click.
  - While blocking: 55% walking speed, no running, no attacking, and stamina
    doesn't refill.
  - Feedback: "Blocked" message, silver-blue screen edge flash, sword jolts.
- All the numbers are weapon data in `weapons.js`, or in `PLAYER_STATS` (block arc,
  guard-break time, move speeds). Shields will improve the block numbers in step 8.

### Step 7: Weapon table (dagger, sword, axe, mace) ✅
- Four weapons in `WEAPONS` (`weapons.js`), all using the same combat code:

  | | Dagger | Sword | Axe | Mace |
  |---|---|---|---|---|
  | Damage (light) | 7 | 15 | 26 | 22 |
  | Swing (wind-up / strike / recover, s) | 0.06 / 0.08 / 0.15 | 0.12 / 0.12 / 0.26 | 0.22 / 0.15 / 0.42 | 0.30 / 0.16 / 0.46 |
  | Reach (m) / arc | 1.8 / 70° | 2.3 / 100° | 2.4 / 115° | 2.1 / 90° |
  | Power charge time / cost | 0.5 s / 15 | 0.8 s / 25 | 1.0 s / 30 | 1.1 s / 30 |
  | Power damage multiplier | ×1.6–2.8 | ×1.5–2.5 | ×1.5–2.6 | ×1.5–2.5 |
  | Block reduction | 35% | 60% | 50% | 55% |
  | Walk speed | 108% | 100% | 95% | 92% |
  | Special | – | – | – | every hit staggers (0.45 s) |

- New stats: `hitStagger` (stagger on normal hits, maces only) and
  `moveSpeed` (heavier = slower walking).
- **Stun-lock protection:** after a stagger ends, an enemy ignores light-hit
  staggers for 1.2 s, so a mace can't keep an enemy stunned forever. Power
  attacks always stagger.
- **Switching:** number keys **1–4** (dagger, sword, axe, mace). The old weapon
  lowers out of view and the new one rises. The weapon panel (bottom right) shows
  what you hold. You start with the sword.
- Low-poly models for each: dagger (short blade), axe (long handle, flared
  blade), mace (flanged head with spike).

### Step 8: Shields and armor ✅
- **Shields** (`SHIELDS` in `equipment.js`) are held in the left hand, bottom-left
  of the screen. With a shield, right click raises the **shield** instead of the
  weapon, and the shield's block numbers replace the weapon's:

  | | Weapon only (sword) | Wooden Shield | Iron Shield |
  |---|---|---|---|
  | Damage blocked | 60% | 75% | 85% |
  | Stamina per point blocked | 1.2 | 0.9 | 0.7 |
  | Block angle | 120° | 150° | 160° |
  | Walk speed | – | 100% | 96% |

- **Armor** (`ARMOR` in `equipment.js`) reduces every hit you take, blocked or not:
  Leather −20%, Chainmail −35% (96% walk speed), Plate −50% (88% walk speed).
  Order: block first, then armor on what's left.
  Example, Ghoul hit (12): leather unblocked → 10, leather + wooden shield block → 2.
- The equipment panel (bottom right) shows weapon, shield and armor.
- **Start:** sword + wooden shield + leather armor.
- **Test keys** (until pickups or classes): **Q** cycles shields (none → wooden →
  iron), **X** cycles armor (none → leather → chainmail → plate).

### Step 9: Healing potions and health regeneration ✅
- **Potions:** you start with 2. Press **R** to drink: it takes 1.1 s (the shield
  lowers and you lift the bottle), then heals **+40**.
  - While drinking: 50% walk speed, no running, attacking or blocking, so
    drinking mid-fight is risky.
  - The potion is used up when you start drinking. You can't drink at full health.
  - The counter shows next to the health bar (`R 🧪 2`).
- **Potion pickups:** map letter `H`, a floating, spinning red bottle with a
  glow on the floor. Walk over it to collect (+1 potion). Level 1 has 3: pillar
  hall corner, side room corner, and the corridor just before the boss room.
  This is the first pickup; weapons and armor can use the same system later.
- **Health regen:** after **5 s** without taking damage, health refills at
  **3 per second**. Any damage resets the wait. The health bar glows while
  regenerating.
- Numbers in `PLAYER_STATS` (`startingPotions`, `potionHeal`, `potionDrinkTime`,
  `drinkMoveSpeed`, `regenDelay`, `regenPerSecond`).

### Step 10: Bosses, level exits, a second level ✅
- **Ghouls retuned** (they were too easy): health 45 → 60, damage 12 → 14,
  speed 2.6 → 3.0, wind-up 0.65 → 0.55 s, rest after attacking 1.0 → 0.8 s.
- **New enemy, Skeleton** (map letter `K`): 75 health, 16 damage, 3.4 m/s,
  0.5 s wind-up. Bone-white with icy blue eyes, thinner body.
- **Bosses** (map letter `B`; each level says which boss in `boss:`):
  - **The Crypt Lord** (Level 1): giant horned Ghoul, 1.9× size, 450 health,
    28 damage, reach 2.8 m, slow (2.4 m/s), long 0.85 s wind-up.
  - **The Bone Colossus** (Level 2): giant horned Skeleton, 2.1× size, 520
    health, 30 damage, reach 3 m.
  - Boss rules (all data): **knockback** (shoves you back about 1.2 m, about 0.7 m
    when blocked); a blocked boss doesn't recoil; **immune to light-hit
    staggers** (maces too); power-attack staggers are **half as long**;
    **enrage** at 50% health (speed ×1.35, wind-up ×0.75, rest ×0.6) with an
    announcement.
  - Big boss health bar at the top of the screen once the boss notices you.
    The controls hint hides during boss fights to make room.
- **Exit portal** (map letter `X`): a stone arch that glows blue when the boss
  dies. Walk in to finish the level. Levels without a boss have it open from the start.
- **Level complete screen:** time played (only counts while playing, not
  paused) and enemies defeated. Click to go to the next level.
- **Victory screen** after the last level → click to play again from Level 1.
- **Levels:** the level number is in the address (`index.html?level=2`).
  Potions and gear carry over (`progress.js`, browser session storage). You
  start each level at full health. **Dying restarts the current level** with the
  potions and gear you started it with.
- **Difficulty per level:** `difficulty` in `levels.js` multiplies every enemy's
  health and damage. Level 1 = 1.0, Level 2 = 1.3.
- **Level 1 extended** (42 × 62 tiles): start room → pillar hall → side room →
  great hall (old boss room) → ossuary → long gallery → big boss room (26 × 15
  tiles). 14 Ghouls, 5 potions, the Crypt Lord, exit portal behind the boss.
- **Level 2 "The Bone Halls"** (44 × 52 tiles): 8 rooms in a loop from the south
  up to a wide north-west boss room. 15 Skeletons, 5 Ghouls, 6 potions,
  the Bone Colossus.

### Combat upgrade, stage 1: Combo swings ✅
- Light attacks in a row form a **3-hit combo**: 1) right-to-left slash,
  2) left-to-right backhand, 3) **overhead chop** (×1.3 damage, bigger
  damage number, a 30% longer wind-up). Then it starts over.
- Pause for **1 second** (`COMBO_RESET_TIME` in `combat.js`) and the combo resets to swing 1.
- Every swing has 4 parts: **wind-up** (eases into the pulled-back pose) →
  **strike** (starts slow, whips through fast; this is when it hits) →
  **follow-through** (the blade carries on past and slows down) → **recover**.
  Chained swings flow straight from the follow-through into the next wind-up.
- Swing shapes are data in `SWINGS` (`combat.js`): wind-up / strike /
  follow-through poses, timing scales, damage multiplier, and the blade's
  travel direction (`sweep`, passed along with every hit for effects).
- Speed comes from each weapon's `windup` / `strike` / `recover` (plus optional
  `followThrough` and `finisherMultiplier` in `weapons.js`), so daggers combo
  fastest and maces slowest.
- **Power attacks stay separate:** they always use the big right-to-left swing,
  don't count as a combo step, and reset the combo.
- Clicking during any part of a swing queues the next one, so fast clicking
  chains the full combo.

### Combat upgrade, stage 2: Blood ✅
- Every hit sprays droplets from the impact point (the side of the target facing
  you; higher up for overhead chops), mostly in the **direction the blade was
  travelling** (`sweep` from stage 1), plus a little out of the wound and upward.
- Spurt size: normal hit **12** droplets, overhead finisher **24**, power attack
  **32** (finisher and power also fly faster and further).
- Droplets arc and fall with gravity, splat flat on the floor, and shrink away
  within ~0.5–1.2 s.
- Colour is data: `bloodColour` on each enemy type (Ghouls red, Crypt Lord darker
  red, Skeletons and the Bone Colossus pale **bone chips**). Training dummies
  spill **straw**.
- **Performance:** one `InstancedMesh` holds a fixed pool of **400** droplets
  (`effects.js`). Old droplets get reused when it's full, so nothing is created
  mid-fight and all droplets are drawn together in one go.

### Combat upgrade, stage 3: Accumulating wounds ✅
- Every hit leaves a **cut** on the exact spot the blade struck. A ray from the
  player into the enemy's 3D model finds the surface (`findHitSurface` in `wounds.js`).
  The blood spurt now also starts from that exact spot.
- Cuts lie flat on the surface, **lined up with the swing** (side slashes are
  sideways, overhead chops vertical), with a little random twist and 4 different
  cut pictures drawn by code.
- **Bigger hits leave bigger cuts** (size grows with damage; ×1.3 for the
  finisher, ×1.5 for power attacks). Hits spread around the body naturally.
- Each cut is **attached to the body part it hit**, so it moves with that part
  (arms, falling over when dead). Cuts stay until the enemy dies and vanish with
  the body. Max 30 per enemy (the oldest gets reused).
- **Overall bloodied look:** as health drops, the body's colours blend towards
  the wound colour (up to 45%), so a badly hurt enemy looks it.
- `woundColour` is data per enemy type: red gashes on Ghouls and the Crypt Lord,
  dark cracks on Skeletons and the Bone Colossus, dark tears on dummies.
- **Swapping in real 3D models later.** The wound system never looks at the
  placeholder shapes. Each enemy only needs:
  - `woundRoot`: its 3D model (any Three.js object, e.g. a loaded glTF scene).
  - `woundColour`: the colour of its cuts.
  - **Its own copy of its materials** (clone them when loading each enemy),
    so the bloodied tint only affects that one enemy.
  - **Animated models with bones (skinned meshes):** each cut is attached to the
    **nearest bone**, so it follows the animation.
  - Mark anything that shouldn't get cuts (health bars, weapon glows) with
    `object.userData.noWounds = true`.

## Planned build order

1. ~~One room, WASD + mouse look, collisions, crosshair, hint~~ ✅
2. ~~Level layout: several rooms joined by corridors, built from a text map~~ ✅
3. ~~Player stats + HUD: health bar and stamina bar~~ ✅
4. ~~First-person weapon in view, plus the light attack (swing + hit detection)~~ ✅
5. ~~A basic enemy: placeholder shape that chases you, attacks, takes damage and dies~~ ✅
   **Then:** place enemies around Level 1, playtest, and grow the level until a
   run takes 10–12 minutes (more rooms, plus `tileSize` if rooms feel cramped).
6. ~~Power attack (hold to charge) and blocking, both using stamina~~ ✅
7. ~~Weapon data table (dagger / sword / axe / mace) and stagger from maces~~ ✅
8. ~~Shields and armor~~ ✅
9. ~~Healing potions (hotkey + drink delay) and health regen after 5 s~~ ✅
10. ~~Boss room at the end of the level, then the next level with harder enemies~~ ✅
    **Next:** playtest. Use the time on the level complete screen to grow the
    levels towards 10–12 minutes each. Then the graphics pass (see Graphics plan).
11. Menus: start, death/restart, level complete.
12. Polish: sounds, better low-poly models, lighting tweaks.

## Combat upgrade (4 stages, requested after step 10)

1. ~~Combo swings (alternating directions, overhead finisher, wind-up / strike / follow-through)~~ ✅
2. ~~Blood spurts on hits (bigger on power attacks and the finisher)~~ ✅
3. ~~Accumulating wounds on enemies (must work with real 3D models later)~~ ✅
4. Sound: Web Audio placeholder sounds in one sound manager, replaceable with files

## Known issues / limitations

- Three.js comes from the internet (jsDelivr), so the game needs an internet
  connection to load.
- The game must be opened through a web server (GitHub Pages, or a local
  server). Double-clicking `index.html` will **not** work, because browsers
  block this kind of script when a page is opened straight from a file.
- No jumping or crouching yet (not in the plan unless we decide we want it).
- Desktop only for now: needs a keyboard and mouse.
- Level length: first guess is about 6–8 minutes for Level 1, short of the
  10–12 minute goal. Check the times on the level complete screen and extend
  the maps (more rooms and enemies) to match.
- Bosses use the same simple behaviour as other enemies, just stronger. Ideas
  for later: special attacks (ground slam, charge), summoning minions.
- If the browser blocks session storage, potions and gear won't carry between
  levels (you start each level with the default gear). The game still works.
- You can skip to a level by typing `?level=2` at the end of the address. Handy
  for testing, and harmless.
- If a map row has the wrong length, the game shows a warning in the browser
  console (F12), and the level may look broken.
- Walls are all the same height and there are no doors yet.
- Health never refills yet (regen is step 9). The death screen is basic and
  restarts by reloading the page (proper menus are step 11).
- Enemies have no real pathfinding. They walk straight towards where they last
  saw you, so if you break line of sight around a corner they may lose you.
  Fine for now; smarter pathfinding can come later if it feels too easy.
- Light hits don't interrupt an enemy's attack; only power attacks stagger
  (maces will stagger with every hit in step 7).
- Block and power attack make the (already easy) Ghouls even easier.
  Rebalance when we tune Level 1.
- **Decided direction (to build later):** instead of having everything from the
  start (keys 1–4, Q, X are test keys), gear will either be **picked up** in the
  dungeon, or **chosen by class** (a class decides your starting weapons,
  shield and armor). Possibly both. All gear is already data, so both work.
- Weapon balance is a first guess. Rough damage per second: dagger ~37, sword ~45,
  axe ~51, mace ~35 (+ stagger). Tune after playtesting.
- An enemy pressed right up against you can poke an arm through the camera.

## Playtest feedback

- **Steps 1–7:** everything works.
- **Step 5:** Ghouls feel **extremely easy**. → Step 10: Ghouls made tougher
  and more numerous, Skeletons added, and per-level difficulty. Re-check.

## Graphics plan

- **Gameplay first, then graphics.** Don't make art while the combat and enemies are still changing.
- **When:** a full graphics pass after step 10, once there's a complete
  playable level (enemies, combat, potions, boss).
- **Before that:** small looks-related fixes are fine if something is ugly or
  hard to read during play.
- **Ideas for the pass:** better low-poly models for weapons, enemies and props;
  hand-made textures; dungeon dressing (bones, barrels, chains, rubble);
  better lighting (shadows, light shafts, dust); hit effects (sparks, blood).
- No sounds yet (step 12).
