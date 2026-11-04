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
| `enemies.js` | Enemy stats (data only), enemy models and behaviour |
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

## Planned build order

1. ~~One room, WASD + mouse look, collisions, crosshair, hint~~ ✅
2. ~~Level layout: several rooms joined by corridors, built from a text map~~ ✅
3. ~~Player stats + HUD: health bar and stamina bar~~ ✅
4. ~~First-person weapon in view, plus the light attack (swing + hit detection)~~ ✅
5. ~~A basic enemy: placeholder shape that chases you, attacks, takes damage and dies~~ ✅
   **Then:** place enemies around Level 1, playtest, and grow the level until a
   run takes 10–12 minutes (more rooms, plus `tileSize` if rooms feel cramped).
6. ~~Power attack (hold to charge) and blocking, both using stamina~~ ✅
7. Weapon data table (dagger / sword / axe / mace) and stagger from maces.
8. Shields and armor.
9. Healing potions (hotkey + drink delay) and health regen after 5 s.
10. Boss room at the end of the level, then the next level with harder enemies.
11. Menus: start, death/restart, level complete.
12. Polish: sounds, better low-poly models, lighting tweaks.

## Known issues / limitations

- Three.js comes from the internet (jsDelivr), so the game needs an internet
  connection to load.
- The game must be opened through a web server (GitHub Pages, or a local
  server). Double-clicking `index.html` will **not** work, because browsers
  block this kind of script when a page is opened straight from a file.
- No jumping or crouching yet (not in the plan unless we decide we want it).
- Desktop only for now: needs a keyboard and mouse.
- Level 1 is currently small (about 1–2 minutes to walk through). This is on
  purpose while we build combat; it gets expanded after step 5.
- Level 1 has no exit yet. Reaching the boss room does nothing until step 10.
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
- An enemy pressed right up against you can poke an arm through the camera.

## Playtest feedback

- **Step 5:** Ghouls feel **extremely easy**. Keep them as the starting point,
  then make them tougher when we tune Level 1 (ideas: more health, faster,
  shorter wind-up, attacking in groups, tougher enemy types later on).

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
