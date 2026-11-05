// =============================================================
//  Dungeon Crawler - Combat upgrade, stage 2: blood
// =============================================================
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { LEVELS } from './levels.js';
import { updateHUD, flashHurt, showDamageNumber, setCharge, showMessage, flashBlock, updateFlashes, setWeaponPanel, setBossBar } from './hud.js';
import { WEAPONS, WEAPON_KEYS } from './weapons.js';
import { SHIELDS, SHIELD_KEYS, ARMOR, ARMOR_KEYS } from './equipment.js';
import { createCombat } from './combat.js';
import { createDummy } from './dummies.js';
import { createEnemy } from './enemies.js';
import { createPickup, createExitPortal } from './pickups.js';
import { loadProgress, saveProgress, clearProgress } from './progress.js';
import { createBloodSystem } from './effects.js';

// ---------- Settings (tweak these freely) ----------
const SETTINGS = {
  walkSpeed: 4,         // metres per second
  runSpeed: 7,          // metres per second while holding Shift
  playerHeight: 1.7,    // eye height in metres
  playerRadius: 0.4,    // how "wide" the player is for collisions
  tileSize: 2,          // each map character is this many metres wide
  wallHeight: 4,
  pillarSize: 1.2,
  maxTorchLights: 8,    // only the nearest torches actually cast light (keeps the game fast)
};

// ---------- Player stats (tweak these freely) ----------
const PLAYER_STATS = {
  maxHealth: 100,
  maxStamina: 100,
  runStaminaPerSecond: 20,   // stamina used each second while running
  staminaRegenPerSecond: 25, // stamina gained back each second while resting
  staminaRegenDelay: 1,      // seconds to wait after using stamina before it refills
  windedRecoverAt: 30,       // if stamina hits 0, you can't run again until it's back to this
  blockArc: 120,             // blocking only stops hits coming from this wide an angle in front (degrees)
  guardBreakTime: 1.2,       // seconds you can't block after your guard is broken
  blockMoveSpeed: 0.55,      // walking speed multiplier while blocking
  chargeMoveSpeed: 0.6,      // walking speed multiplier while charging a power attack
  startingPotions: 2,
  potionHeal: 40,            // health one potion gives back
  potionDrinkTime: 1.1,      // seconds it takes to drink (you're open to attack meanwhile!)
  drinkMoveSpeed: 0.5,       // walking speed multiplier while drinking
  regenDelay: 5,             // seconds without taking damage before health starts coming back
  regenPerSecond: 3,         // health regained each second after that
};

// ---------- Which level are we playing? ----------
// The level number is in the page address, e.g. index.html?level=2
const levelNumber = Math.min(Math.max(parseInt(new URLSearchParams(location.search).get('level'), 10) || 1, 1), LEVELS.length);
const currentLevel = LEVELS[levelNumber - 1];

// Potions and gear carried over from the previous level (if any)
const saved = loadProgress();
const carried = saved && saved.level === levelNumber ? saved : null;

// The player's current numbers. These change as you play.
const player = {
  health: PLAYER_STATS.maxHealth,
  maxHealth: PLAYER_STATS.maxHealth,
  stamina: PLAYER_STATS.maxStamina,
  maxStamina: PLAYER_STATS.maxStamina,
  staminaRegenTimer: 0, // counts down; stamina refills when it reaches 0
  winded: false,        // true after running out of stamina completely
  dead: false,
  guardBrokenTimer: 0,  // counts down; you can't block until it reaches 0
  armor: ARMOR[carried?.armor] || ARMOR.leather, // what you're wearing (see equipment.js)
  potions: carried ? carried.potions : PLAYER_STATS.startingPotions,
  timeSinceHit: 999,    // seconds since we last took damage (for health regen)
};

// Use up some stamina (later: attacks, power attacks and blocking will use this too)
function useStamina(amount) {
  player.stamina = Math.max(0, player.stamina - amount);
  player.staminaRegenTimer = PLAYER_STATS.staminaRegenDelay;
  if (player.stamina === 0) player.winded = true;
}

function updateStamina(dt) {
  // Stamina doesn't refill while you hold your guard up
  if (combat.isGuarding()) player.staminaRegenTimer = Math.max(player.staminaRegenTimer, 0.3);
  if (player.staminaRegenTimer > 0) {
    player.staminaRegenTimer -= dt;
    return;
  }
  player.stamina = Math.min(player.maxStamina, player.stamina + PLAYER_STATS.staminaRegenPerSecond * dt);
  if (player.winded && player.stamina >= PLAYER_STATS.windedRecoverAt) player.winded = false;
}

// Take damage (later: enemies will call this, and armor will reduce the amount)
function takeDamage(amount, { quiet = false } = {}) {
  if (player.dead || amount <= 0) return;
  player.health = Math.max(0, player.health - amount);
  player.timeSinceHit = 0; // getting hurt resets the health regen wait
  if (!quiet) flashHurt();
  if (player.health === 0) playerDies();
}

// Big enemies (bosses) shove you backwards when they hit you
const knockback = new THREE.Vector2(0, 0);
function knockPlayerBack(attacker, strength) {
  const dx = camera.position.x - attacker.feet.x;
  const dz = camera.position.z - attacker.feet.z;
  const len = Math.hypot(dx, dz) || 1;
  knockback.set((dx / len) * strength, (dz / len) * strength);
}

// An enemy's attack reached us. Blocking it (from the front, with enough stamina) reduces the damage.
function receiveEnemyAttack(amount, attacker) {
  if (player.dead) return;

  if (combat.isBlocking()) {
    // Is the attacker in front of us?
    const look = new THREE.Vector3();
    camera.getWorldDirection(look);
    const toAttacker = new THREE.Vector3(attacker.feet.x - camera.position.x, 0, attacker.feet.z - camera.position.z);
    look.y = 0;
    const block = combat.getBlockStats(PLAYER_STATS.blockArc); // shield numbers if you have one
    const inFront = look.angleTo(toAttacker) < THREE.MathUtils.degToRad(block.arc / 2);

    if (inFront) {
      const blocked = amount * block.reduction;
      const cost = blocked * block.staminaPerDamage;
      if (player.stamina >= cost) {
        // Good block: take only a little damage, the attacker bounces off
        useStamina(cost);
        takeDamage(applyArmor(amount - blocked), { quiet: true });
        combat.blockImpact();
        flashBlock();
        showMessage('Blocked', '#cfe0ff');
        if (attacker.type.knockback) knockPlayerBack(attacker, attacker.type.knockback * 0.6);
        else attacker.recoil(); // small enemies bounce off your block; bosses don't
        return;
      }
      // Not enough stamina: the guard breaks and the full hit gets through
      useStamina(player.stamina);
      combat.breakGuard();
      player.guardBrokenTimer = PLAYER_STATS.guardBreakTime;
      showMessage('Guard broken!', '#ff8a6a');
    }
  }
  takeDamage(applyArmor(amount));
  if (attacker.type.knockback) knockPlayerBack(attacker, attacker.type.knockback);
}

// Armor takes a share off every hit
function applyArmor(amount) {
  return Math.round(amount * (1 - player.armor.damageReduction));
}

// ---------- Healing ----------
function drinkPotion() {
  if (player.potions <= 0) { showMessage('No potions', '#c9a0a0'); return; }
  if (player.health >= player.maxHealth) { showMessage('Health is full'); return; }
  const started = combat.drink(PLAYER_STATS.potionDrinkTime, () => {
    const before = player.health;
    player.health = Math.min(player.maxHealth, player.health + PLAYER_STATS.potionHeal);
    showMessage(`+${Math.round(player.health - before)} health`, '#8fe08a');
  });
  if (started) player.potions -= 1; // the potion is used up as soon as you start drinking
}

// Slowly get health back after a few seconds without being hurt
function updateRegen(dt) {
  player.timeSinceHit += dt;
  player.regenerating = player.timeSinceHit >= PLAYER_STATS.regenDelay && player.health < player.maxHealth;
  if (player.regenerating) {
    player.health = Math.min(player.maxHealth, player.health + PLAYER_STATS.regenPerSecond * dt);
  }
}

// Very simple death for now (a proper death/restart menu comes later)
function playerDies() {
  player.dead = true;
  document.getElementById('death-screen').classList.remove('hidden');
  controls.unlock();
}
// Clicking restarts this level (with the potions and gear you started it with)
document.getElementById('death-screen').addEventListener('click', () => location.reload());

// ---------- Basic setup: renderer, scene, camera ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.autoClear = false; // we draw the world first, then the weapon on top
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050403);
scene.fog = new THREE.Fog(0x050403, 4, 26); // far things fade into darkness

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
scene.add(camera);

// ---------- Stone texture, drawn by code (no image files needed) ----------
// Draws rows of grey stone blocks with darker mortar lines between them.
function makeStoneTexture({ blockW, blockH, baseShade }) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Mortar colour fills the background
  ctx.fillStyle = '#1c1a17';
  ctx.fillRect(0, 0, size, size);

  const gap = 4;
  for (let row = 0; row * blockH < size; row++) {
    const offset = (row % 2) * (blockW / 2); // stagger every other row like real brickwork
    for (let x = -blockW; x < size + blockW; x += blockW) {
      const shade = baseShade + Math.floor(Math.random() * 30 - 15);
      ctx.fillStyle = `rgb(${shade}, ${shade - 4}, ${shade - 10})`;
      ctx.fillRect(x + offset + gap / 2, row * blockH + gap / 2, blockW - gap, blockH - gap);
    }
  }

  // Sprinkle speckles so the stone looks rough instead of flat
  for (let i = 0; i < 4000; i++) {
    const v = Math.floor(Math.random() * 60);
    ctx.fillStyle = `rgba(${v}, ${v}, ${v}, 0.25)`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter; // slightly pixelated, fits the low-poly look
  return texture;
}

const wallTexture = makeStoneTexture({ blockW: 64, blockH: 32, baseShade: 110 });
const floorTexture = makeStoneTexture({ blockW: 64, blockH: 64, baseShade: 85 });

// Makes a material whose texture repeats once every 2 metres
function stoneMaterial(baseTexture, widthMetres, heightMetres, tint = 0xffffff) {
  const tex = baseTexture.clone();
  tex.needsUpdate = true;
  tex.repeat.set(widthMetres / 2, heightMetres / 2);
  return new THREE.MeshStandardMaterial({ map: tex, color: tint, roughness: 0.95, flatShading: true });
}

// ---------- Lighting ----------
scene.add(new THREE.HemisphereLight(0x8899aa, 0x221811, 0.3)); // dim general light

// A faint lantern the player carries, so dark corridors aren't pitch black
const lantern = new THREE.PointLight(0xffd9a0, 4, 9, 1.5);
camera.add(lantern);

// Every solid thing the player can bump into goes in this list.
// Each entry is a box on the ground: { minX, maxX, minZ, maxZ }.
const colliders = [];

// Every torch in the level: { position, colour }
const torches = [];

// Everything the player can hit with a weapon (training dummies and enemies)
const targets = [];

// Every enemy in the level
const enemies = [];

// Things lying around to pick up (potions)
const pickups = [];

// The level's boss and exit portal (if it has them)
let boss = null;
let exitPortal = null;

// Stats for the "level complete" screen
const levelStats = { time: 0, kills: 0, totalEnemies: 0 };

// Remembers the map so we can check "is there a wall here?" later
let levelGrid = null;

// ---------- Build a level from its text map ----------
function buildLevel(level) {
  const map = level.map;
  const T = SETTINGS.tileSize;
  const H = SETTINGS.wallHeight;

  const rows = map.length;
  const cols = map[0].length;
  const tileAt = (x, z) => (z < 0 || z >= rows || x < 0 || x >= cols) ? '#' : map[z][x];
  const isWall = (c) => c === '#' || c === 'T' || c === 'R';
  const centre = (x, z) => ({ x: x * T + T / 2, z: z * T + T / 2 });
  levelGrid = { tileAt, isWall };

  // First, sort every square into walls, floors and pillars
  const wallTiles = [];
  const floorTiles = [];
  const pillarTiles = [];
  let start = centre(1, 1);

  for (let z = 0; z < rows; z++) {
    if (map[z].length !== cols) console.warn(`Map row ${z} has the wrong length`);
    for (let x = 0; x < cols; x++) {
      const c = tileAt(x, z);
      if (isWall(c)) {
        // Only build walls that touch a floor; walls buried deep inside rock are never seen
        const touchesFloor = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !isWall(tileAt(x + dx, z + dz)));
        if (touchesFloor) wallTiles.push({ x, z, c });
      } else {
        floorTiles.push({ x, z });
        if (c === 'P') pillarTiles.push({ x, z });
        if (c === 'S') start = centre(x, z);
        if (c === 'D') {
          const p = centre(x, z);
          targets.push(createDummy(scene, p.x, p.z));
          colliders.push({ minX: p.x - 0.35, maxX: p.x + 0.35, minZ: p.z - 0.35, maxZ: p.z + 0.35 });
        }
        if (c === 'H') {
          const p = centre(x, z);
          pickups.push(createPickup(scene, 'potion', p.x, p.z));
        }
        // Enemies: E = Ghoul, K = Skeleton, B = this level's boss
        const enemyType = { E: 'ghoul', K: 'skeleton', B: level.boss }[c];
        if (enemyType) {
          const p = centre(x, z);
          const enemy = createEnemy(scene, enemyType, p.x, p.z, world, level.difficulty);
          enemies.push(enemy);
          targets.push(enemy);
          if (enemy.isBoss) boss = enemy;
        }
        if (c === 'X') {
          const p = centre(x, z);
          exitPortal = createExitPortal(scene, p.x, p.z);
          // Stand the arch against the wall, with its doorway facing the room
          const open = [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]]
            .find(([dx, dz]) => !isWall(tileAt(x + dx, z + dz)));
          if (open) exitPortal.face(open[2]);
        }
      }
    }
  }

  // Walls: one block per wall square. "InstancedMesh" draws many copies of one shape very cheaply.
  const dummy = new THREE.Object3D();
  const walls = new THREE.InstancedMesh(
    new THREE.BoxGeometry(T, H, T),
    stoneMaterial(wallTexture, T, H),
    wallTiles.length
  );
  wallTiles.forEach((tile, i) => {
    const p = centre(tile.x, tile.z);
    dummy.position.set(p.x, H / 2, p.z);
    dummy.updateMatrix();
    walls.setMatrixAt(i, dummy.matrix);
    colliders.push({ minX: p.x - T / 2, maxX: p.x + T / 2, minZ: p.z - T / 2, maxZ: p.z + T / 2 });
  });
  scene.add(walls);

  // Floor and ceiling: one flat square per walkable square
  const floorGeo = new THREE.PlaneGeometry(T, T);
  const floors = new THREE.InstancedMesh(floorGeo, stoneMaterial(floorTexture, T, T), floorTiles.length);
  const ceilings = new THREE.InstancedMesh(floorGeo, stoneMaterial(floorTexture, T, T, 0x555555), floorTiles.length);
  floorTiles.forEach((tile, i) => {
    const p = centre(tile.x, tile.z);
    dummy.position.set(p.x, 0, p.z);
    dummy.rotation.set(-Math.PI / 2, 0, 0); // lie flat, facing up
    dummy.updateMatrix();
    floors.setMatrixAt(i, dummy.matrix);
    dummy.position.y = H;
    dummy.rotation.set(Math.PI / 2, 0, 0);  // lie flat, facing down
    dummy.updateMatrix();
    ceilings.setMatrixAt(i, dummy.matrix);
  });
  dummy.rotation.set(0, 0, 0);
  scene.add(floors, ceilings);

  // Pillars
  const S = SETTINGS.pillarSize;
  const pillars = new THREE.InstancedMesh(
    new THREE.BoxGeometry(S, H, S),
    stoneMaterial(wallTexture, S, H),
    Math.max(pillarTiles.length, 1)
  );
  pillars.count = pillarTiles.length;
  pillarTiles.forEach((tile, i) => {
    const p = centre(tile.x, tile.z);
    dummy.position.set(p.x, H / 2, p.z);
    dummy.updateMatrix();
    pillars.setMatrixAt(i, dummy.matrix);
    colliders.push({ minX: p.x - S / 2, maxX: p.x + S / 2, minZ: p.z - S / 2, maxZ: p.z + S / 2 });
  });
  scene.add(pillars);

  // Torches: a small glowing block on the side of the wall that faces a floor
  for (const tile of wallTiles) {
    if (tile.c !== 'T' && tile.c !== 'R') continue;
    const dir = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dz]) => !isWall(tileAt(tile.x + dx, tile.z + dz)));
    if (!dir) continue;
    const p = centre(tile.x, tile.z);
    const colour = tile.c === 'R' ? 0xff2a1a : 0xff9933;
    const position = new THREE.Vector3(p.x + dir[0] * (T / 2 + 0.12), 2.6, p.z + dir[1] * (T / 2 + 0.12));

    const flame = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.35, 0.2),
      new THREE.MeshBasicMaterial({ color: tile.c === 'R' ? 0xff5533 : 0xffaa44 })
    );
    flame.position.copy(position);
    scene.add(flame);

    // Light sits a little further out from the wall so it lights the room, not just the wall
    const lightPos = position.clone().add(new THREE.Vector3(dir[0] * 0.5, 0, dir[1] * 0.5));
    torches.push({ position: lightPos, colour });
  }

  // Put the player at the start, looking the chosen way
  const facing = { north: 0, west: Math.PI / 2, south: Math.PI, east: -Math.PI / 2 };
  camera.position.set(start.x, SETTINGS.playerHeight, start.z);
  camera.rotation.set(0, facing[level.startFacing] ?? 0, 0);

  document.getElementById('level-name').textContent = level.name;
  levelStats.totalEnemies = enemies.length;
  if (exitPortal && !boss) exitPortal.open(); // no boss? the exit is open from the start
}

// ---------- What enemies need to know about the world ----------
const world = {
  getPlayerPosition: () => camera.position,
  canSee,
  moveCircle,
  damagePlayer: receiveEnemyAttack,
  announce: (text) => showMessage(text, '#ff7050'),
  onEnemyKilled(enemy) {
    levelStats.kills += 1;
    if (enemy === boss) {
      setBossBar(null);
      showMessage(`${enemy.type.name} is defeated! The way forward is open.`, '#9fe8ff');
      if (exitPortal) exitPortal.open();
    }
  },
};

buildLevel(currentLevel);

// ---------- Torch lights ----------
// Lots of real lights would make the game slow, so we keep a small set of lights
// and move them to whichever torches are closest to the player.
const torchLights = [];
for (let i = 0; i < SETTINGS.maxTorchLights; i++) {
  const light = new THREE.PointLight(0xff9933, 0, 14, 1.6);
  scene.add(light);
  torchLights.push(light);
}

function updateTorchLights(time) {
  const byDistance = torches
    .map((torch) => ({ torch, dist: torch.position.distanceToSquared(camera.position) }))
    .sort((a, b) => a.dist - b.dist);

  torchLights.forEach((light, i) => {
    const entry = byDistance[i];
    if (!entry) { light.intensity = 0; return; }
    light.position.copy(entry.torch.position);
    light.color.setHex(entry.torch.colour);
    // flicker a little
    light.intensity = 25 + Math.sin(time * 9 + entry.torch.position.x) * 2 + Math.random() * 2;
  });
}

// ---------- Mouse look (pointer lock) ----------
const controls = new PointerLockControls(camera, document.body);
const overlay = document.getElementById('overlay');

overlay.addEventListener('click', () => { if (!player.dead && !levelDone) controls.lock(); });
controls.addEventListener('lock', () => overlay.classList.add('hidden'));
controls.addEventListener('unlock', () => {
  if (!player.dead && !levelDone) overlay.classList.remove('hidden');
});

// ---------- Keyboard ----------
const keys = {};
// Left mouse button = attack (hold for a power attack), right mouse button = block
let blockButtonHeld = false;
window.addEventListener('mousedown', (e) => {
  if (!controls.isLocked || player.dead) return;
  if (e.button === 0) combat.pressAttack();
  if (e.button === 2) blockButtonHeld = true;
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) combat.releaseAttack();
  if (e.button === 2) blockButtonHeld = false;
});
// Stop the right-click menu from popping up
window.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  // Number keys 1-4 switch weapons (for now; later you might find weapons in the dungeon)
  const slot = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
  if (slot !== -1 && !e.repeat && controls.isLocked && !player.dead) equipWeapon(WEAPON_KEYS[slot]);
  // TEST KEYS until we have pickups or classes: Q cycles shields, X cycles armor
  if (e.code === 'KeyQ' && !e.repeat && controls.isLocked && !player.dead) cycleShield();
  if (e.code === 'KeyX' && !e.repeat && controls.isLocked && !player.dead) cycleArmor();
  // R = drink a healing potion
  if (e.code === 'KeyR' && !e.repeat && controls.isLocked && !player.dead) drinkPotion();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

// ---------- Collision ----------
// Treats a person (player or enemy) as a circle on the ground,
// and pushes it out of any box it overlaps.
function resolveCollisions(pos, r = SETTINGS.playerRadius) {
  for (const box of colliders) {
    // Closest point on the box to the player's centre
    const cx = Math.max(box.minX, Math.min(pos.x, box.maxX));
    const cz = Math.max(box.minZ, Math.min(pos.z, box.maxZ));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const distSq = dx * dx + dz * dz;
    if (distSq >= r * r) continue; // not touching this box

    if (distSq > 0.000001) {
      // Touching an edge or corner: push straight away from it
      const dist = Math.sqrt(distSq);
      const push = r - dist;
      pos.x += (dx / dist) * push;
      pos.z += (dz / dist) * push;
    } else {
      // Centre ended up inside the box: push out through the nearest side
      const outLeft = pos.x - box.minX + r;
      const outRight = box.maxX - pos.x + r;
      const outBack = pos.z - box.minZ + r;
      const outFront = box.maxZ - pos.z + r;
      const smallest = Math.min(outLeft, outRight, outBack, outFront);
      if (smallest === outLeft) pos.x -= outLeft;
      else if (smallest === outRight) pos.x += outRight;
      else if (smallest === outBack) pos.z -= outBack;
      else pos.z += outFront;
    }
  }
}

// Moves a circle by (dx, dz) in small slices so it can't skip through a wall
function moveCircle(pos, dx, dz, radius) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (radius / 2)));
  for (let i = 0; i < steps; i++) {
    pos.x += dx / steps;
    pos.z += dz / steps;
    resolveCollisions(pos, radius);
  }
}

// Is there a clear line (no walls) between two points? Checks the map every 25 cm.
function canSee(from, to) {
  const T = SETTINGS.tileSize;
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const steps = Math.ceil(Math.hypot(dx, dz) / 0.25);
  for (let i = 1; i < steps; i++) {
    const x = from.x + (dx * i) / steps;
    const z = from.z + (dz * i) / steps;
    if (levelGrid.isWall(levelGrid.tileAt(Math.floor(x / T), Math.floor(z / T)))) return false;
  }
  return true;
}

// Stops people overlapping: pushes enemies apart from each other, and the player out of enemies
function separatePeople() {
  const living = enemies.filter((e) => e.alive);
  for (let i = 0; i < living.length; i++) {
    for (let j = i + 1; j < living.length; j++) {
      pushApart(living[i].feet, living[i].radius, living[j].feet, living[j].radius, 0.5);
    }
    // The player gets pushed fully out (enemies don't get shoved around by walking into them)
    pushApart(camera.position, SETTINGS.playerRadius, living[i].feet, living[i].radius, 1);
  }
}

// Pushes two circles apart. share = how much of the push the first one takes (0..1).
function pushApart(a, ra, b, rb, share) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  const dist = Math.hypot(dx, dz);
  const overlap = ra + rb - dist;
  if (overlap <= 0 || dist < 0.0001) return;
  const nx = dx / dist;
  const nz = dz / dist;
  a.x += nx * overlap * share;
  a.z += nz * overlap * share;
  b.x -= nx * overlap * (1 - share);
  b.z -= nz * overlap * (1 - share);
}

// ---------- Movement ----------
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const move = new THREE.Vector3();

// Returns how fast we're moving: 0 = standing still, 1 = walking, more = running
function updateMovement(dt) {
  if (!controls.isLocked || player.dead) return 0;

  // Which way is the camera facing (flattened so looking up/down doesn't change speed)
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  right.crossVectors(forward, camera.up).normalize();

  move.set(0, 0, 0);
  if (keys['KeyW']) move.add(forward);
  if (keys['KeyS']) move.sub(forward);
  if (keys['KeyD']) move.add(right);
  if (keys['KeyA']) move.sub(right);
  if (move.lengthSq() === 0) return 0;

  // You can only run if you have stamina left and aren't winded
  // (and you can't run while blocking or charging a power attack)
  const wantsToRun = keys['ShiftLeft'] || keys['ShiftRight'];
  const busy = combat.isGuarding() || combat.isCharging() || combat.isDrinking();
  const running = wantsToRun && !busy && !player.winded && player.stamina > 0;
  let speed = running ? SETTINGS.runSpeed : SETTINGS.walkSpeed;
  // Heavy weapons, shields and armor slow you down a little
  speed *= combat.getWeapon().moveSpeed * (combat.getShield()?.moveSpeed ?? 1) * player.armor.moveSpeed;
  if (combat.isGuarding()) speed *= PLAYER_STATS.blockMoveSpeed;
  else if (combat.isCharging()) speed *= PLAYER_STATS.chargeMoveSpeed;
  if (combat.isDrinking()) speed *= PLAYER_STATS.drinkMoveSpeed;
  move.normalize().multiplyScalar(speed * dt); // normalize = diagonal isn't faster

  // Move in small slices so a big step (e.g. on a slow computer) can't skip through a wall
  const startX = camera.position.x;
  const startZ = camera.position.z;
  moveCircle(camera.position, move.x, move.z, SETTINGS.playerRadius);

  // Running only costs stamina if you actually got somewhere (not when pushing into a wall)
  const moved = Math.hypot(camera.position.x - startX, camera.position.z - startZ);
  if (running && moved > move.length() * 0.3) useStamina(PLAYER_STATS.runStaminaPerSecond * dt);
  return running ? 1.5 : 1;
}

// ---------- Blood ----------
const blood = createBloodSystem(scene);

// Spray from where the blade struck, in the direction it was travelling
function spurtBlood(target, isPower, info) {
  const toPlayer = new THREE.Vector3(camera.position.x - target.position.x, 0, camera.position.z - target.position.z).normalize();
  const point = target.position.clone().addScaledVector(toPlayer, target.radius * 0.9);
  // Overhead chops land higher (shoulder / head), side swings around the chest
  if (info.swingName === 'overhead') point.y += target.height * 0.18;
  else point.y += (Math.random() - 0.3) * target.height * 0.12;

  const big = isPower || info.isFinisher;
  blood.spurt({
    point,
    direction: info.sweep,
    away: toPlayer.clone().negate(),
    count: isPower ? 32 : info.isFinisher ? 24 : 12,
    colour: target.bloodColour ?? 0xa01212,
    force: big ? 1.5 : 1,
  });
}

// ---------- Combat ----------
const combat = createCombat({
  camera,
  getTargets: () => targets.filter((t) => t.alive !== false),
  canSee,
  useStamina,
  getStamina: () => player.stamina,
  // Show a floating damage number where the target is on screen
  // info = { sweep (direction the blade was moving), isFinisher (3rd combo swing), swingName }
  onHitTarget(target, damage, isPower, info) {
    const p = target.position.clone().project(camera);
    const x = (p.x + 1) / 2 * window.innerWidth;
    const y = (1 - p.y) / 2 * window.innerHeight - 40;
    showDamageNumber(x, y, damage, isPower || info.isFinisher);
    spurtBlood(target, isPower, info);
  },
  // Show how charged a power attack is on the crosshair
  onChargeChange: setCharge,
});
// ---------- Equipment ----------
function refreshEquipmentPanel(weapon = combat.getWeapon()) {
  setWeaponPanel(WEAPON_KEYS.map((k) => WEAPONS[k]), weapon, combat.getShield(), player.armor);
}

function equipWeapon(key) {
  const weapon = WEAPONS[key];
  combat.equip(weapon);
  refreshEquipmentPanel(weapon);
  showMessage(weapon.name);
}

function cycleShield() {
  const current = SHIELD_KEYS.findIndex((k) => (k ? SHIELDS[k] : null) === combat.getShield());
  const next = SHIELD_KEYS[(current + 1) % SHIELD_KEYS.length];
  combat.equipShield(next ? SHIELDS[next] : null);
  refreshEquipmentPanel();
  showMessage(next ? SHIELDS[next].name : 'No Shield');
}

function cycleArmor() {
  const current = ARMOR_KEYS.findIndex((k) => ARMOR[k] === player.armor);
  player.armor = ARMOR[ARMOR_KEYS[(current + 1) % ARMOR_KEYS.length]];
  refreshEquipmentPanel();
  showMessage(player.armor.name);
}

// Starting equipment (or what you carried from the previous level)
combat.equip(WEAPONS[carried?.weapon] || WEAPONS.sword);
combat.equipShield(carried ? SHIELDS[carried.shield] || null : SHIELDS.wooden);
refreshEquipmentPanel();

// Remember what we started this level with, so dying restarts the level the same way
const keyOf = (table, item) => Object.keys(table).find((k) => table[k] === item) || null;
function currentProgress(level) {
  return {
    level,
    potions: player.potions,
    weapon: keyOf(WEAPONS, combat.getWeapon()),
    shield: keyOf(SHIELDS, combat.getShield()),
    armor: keyOf(ARMOR, player.armor),
  };
}
saveProgress(currentProgress(levelNumber));

// ---------- Finishing a level ----------
let levelDone = false;
const formatTime = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

function completeLevel() {
  levelDone = true;
  controls.unlock();
  const isLast = levelNumber === LEVELS.length;
  const screen = document.getElementById('level-complete');
  screen.querySelector('h1').textContent = isLast ? 'VICTORY' : 'LEVEL COMPLETE';
  screen.querySelector('.subtitle').textContent = isLast
    ? 'You have conquered every level of the dungeon!'
    : `${currentLevel.name.replace(/^Level \d+: /, '')} is cleared.`;
  screen.querySelector('.stats').innerHTML =
    `Time: <b>${formatTime(levelStats.time)}</b> &nbsp;·&nbsp; Enemies defeated: <b>${levelStats.kills} / ${levelStats.totalEnemies}</b>`;
  screen.querySelector('.next').textContent = isLast ? 'Click to play again from Level 1' : `Click to continue to Level ${levelNumber + 1}`;
  screen.classList.remove('hidden');

  if (!isLast) saveProgress(currentProgress(levelNumber + 1)); // carry potions and gear forward
}

document.getElementById('level-complete').addEventListener('click', () => {
  if (levelNumber === LEVELS.length) {
    clearProgress();
    location.href = location.pathname + '?level=1';
  } else {
    location.href = location.pathname + `?level=${levelNumber + 1}`;
  }
});

// ---------- Main loop ----------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1); // cap so a lag spike can't teleport you through walls

  const moveAmount = updateMovement(dt);
  if (controls.isLocked && !player.dead && !levelDone) {
    levelStats.time += dt;
    updateStamina(dt);
    combat.update(dt, moveAmount);
    player.guardBrokenTimer = Math.max(0, player.guardBrokenTimer - dt);
    combat.setBlock(blockButtonHeld && player.guardBrokenTimer <= 0);
    updateRegen(dt);
    blood.update(dt);

    // Walk over a potion to pick it up
    for (const pickup of pickups) {
      if (pickup.collected) continue;
      pickup.update(dt);
      const dx = pickup.position.x - camera.position.x;
      const dz = pickup.position.z - camera.position.z;
      if (dx * dx + dz * dz < 0.9 * 0.9) {
        pickup.collect();
        player.potions += 1;
        showMessage('Found a healing potion', '#ff8f8f');
      }
    }
    for (const enemy of enemies) enemy.update(dt, camera);
    separatePeople();

    // Being shoved back by a big hit
    if (knockback.lengthSq() > 0.01) {
      moveCircle(camera.position, knockback.x * dt, knockback.y * dt, SETTINGS.playerRadius);
      knockback.multiplyScalar(Math.max(0, 1 - dt * 6));
    }

    // Boss health bar appears once the boss notices you
    if (boss && boss.alive && boss.state !== 'idle') setBossBar(boss);

    // Walk into the open exit to finish the level
    if (exitPortal) {
      exitPortal.update(dt);
      const dx = exitPortal.position.x - camera.position.x;
      const dz = exitPortal.position.z - camera.position.z;
      if (exitPortal.isOpen && dx * dx + dz * dz < 1.2 * 1.2) completeLevel();
    }
    resolveCollisions(camera.position); // in case an enemy pushed us into a wall
  }
  for (const dummy of targets) if (!enemies.includes(dummy)) dummy.update(dt);

  // Forget enemies whose bodies have fully disappeared
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].removed) {
      targets.splice(targets.indexOf(enemies[i]), 1);
      enemies.splice(i, 1);
    }
  }
  updateHUD(player, dt);
  updateFlashes(dt);
  updateTorchLights(clock.elapsedTime);

  renderer.clear();
  renderer.render(scene, camera);
  combat.render(renderer); // weapon drawn last, on top of the world
}
animate();

// Keep the picture the right shape when the window is resized
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  combat.resize(camera.aspect);
});
