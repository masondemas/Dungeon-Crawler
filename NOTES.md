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
| `levels.js` | The level maps, drawn as text (edit this to design levels) |
| `NOTES.md` | This file |
| `README.md` | Short intro + how to play |

## Game design (full vision)

- **View & movement:** first person, WASD to move, mouse to look.
- **World:** linear dungeons made of rooms + corridors (not open world).
- **Progression:** each level ends in a boss room; difficulty rises each level.
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

## Planned build order

1. ~~One room, WASD + mouse look, collisions, crosshair, hint~~ ✅
2. ~~Level layout: several rooms joined by corridors, built from a text map~~ ✅
3. Player stats + HUD: health bar and stamina bar.
4. First-person weapon in view, plus the light attack (swing animation, hit detection).
5. A basic enemy: placeholder shape that chases you, attacks, takes damage and dies.
6. Power attack (hold to charge) and blocking, both using stamina.
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
- Level 1 has no exit yet. Reaching the boss room does nothing until step 10.
- If a map row has the wrong length, the game shows a warning in the browser
  console (F12), and the level may look broken.
- Walls are all the same height and there are no doors yet.
