// =============================================================
//  Dungeon Crawler - Step 3: health and stamina
// =============================================================
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { LEVELS } from './levels.js';
import { updateHUD, flashHurt } from './hud.js';

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
};

// The player's current numbers. These change as you play.
const player = {
  health: PLAYER_STATS.maxHealth,
  maxHealth: PLAYER_STATS.maxHealth,
  stamina: PLAYER_STATS.maxStamina,
  maxStamina: PLAYER_STATS.maxStamina,
  staminaRegenTimer: 0, // counts down; stamina refills when it reaches 0
  winded: false,        // true after running out of stamina completely
};

// Use up some stamina (later: attacks, power attacks and blocking will use this too)
function useStamina(amount) {
  player.stamina = Math.max(0, player.stamina - amount);
  player.staminaRegenTimer = PLAYER_STATS.staminaRegenDelay;
  if (player.stamina === 0) player.winded = true;
}

function updateStamina(dt) {
  if (player.staminaRegenTimer > 0) {
    player.staminaRegenTimer -= dt;
    return;
  }
  player.stamina = Math.min(player.maxStamina, player.stamina + PLAYER_STATS.staminaRegenPerSecond * dt);
  if (player.winded && player.stamina >= PLAYER_STATS.windedRecoverAt) player.winded = false;
}

// Take damage (later: enemies will call this, and armor will reduce the amount)
function takeDamage(amount) {
  player.health = Math.max(0, player.health - amount);
  flashHurt();
}

// ---------- Basic setup: renderer, scene, camera ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
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
}

buildLevel(LEVELS[0]);

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

overlay.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => overlay.classList.add('hidden'));
controls.addEventListener('unlock', () => overlay.classList.remove('hidden'));

// ---------- Keyboard ----------
const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  // TEST ONLY: press K to hurt yourself, so we can check the health bar works.
  // Remove this once there are enemies.
  if (e.code === 'KeyK' && !e.repeat && controls.isLocked) takeDamage(10);
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

// ---------- Collision ----------
// Treats the player as a circle on the ground and pushes it out of any box it overlaps.
function resolveCollisions(pos) {
  const r = SETTINGS.playerRadius;
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

// ---------- Movement ----------
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const move = new THREE.Vector3();

function updateMovement(dt) {
  if (!controls.isLocked) return;

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
  if (move.lengthSq() === 0) return;

  // You can only run if you have stamina left and aren't winded
  const wantsToRun = keys['ShiftLeft'] || keys['ShiftRight'];
  const running = wantsToRun && !player.winded && player.stamina > 0;
  const speed = running ? SETTINGS.runSpeed : SETTINGS.walkSpeed;
  move.normalize().multiplyScalar(speed * dt); // normalize = diagonal isn't faster

  // Move in small slices so a big step (e.g. on a slow computer) can't skip through a wall
  const startX = camera.position.x;
  const startZ = camera.position.z;
  const steps = Math.ceil(move.length() / (SETTINGS.playerRadius / 2));
  for (let i = 0; i < steps; i++) {
    camera.position.x += move.x / steps;
    camera.position.z += move.z / steps;
    resolveCollisions(camera.position);
  }

  // Running only costs stamina if you actually got somewhere (not when pushing into a wall)
  const moved = Math.hypot(camera.position.x - startX, camera.position.z - startZ);
  if (running && moved > move.length() * 0.3) useStamina(PLAYER_STATS.runStaminaPerSecond * dt);
}

// ---------- Main loop ----------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1); // cap so a lag spike can't teleport you through walls

  updateMovement(dt);
  if (controls.isLocked) updateStamina(dt);
  updateHUD(player, dt);
  updateTorchLights(clock.elapsedTime);

  renderer.render(scene, camera);
}
animate();

// Keep the picture the right shape when the window is resized
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
