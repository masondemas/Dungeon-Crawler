// =============================================================
//  Dungeon Crawler - Step 1: one stone room, walk + look around
// =============================================================
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// ---------- Settings (tweak these freely) ----------
const SETTINGS = {
  walkSpeed: 4,         // metres per second
  runSpeed: 7,          // metres per second while holding Shift
  playerHeight: 1.7,    // eye height in metres
  playerRadius: 0.4,    // how "wide" the player is for collisions
  roomWidth: 16,        // size of the room (X direction)
  roomDepth: 20,        // size of the room (Z direction)
  roomHeight: 5,
  wallThickness: 1,
};

// ---------- Basic setup: renderer, scene, camera ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050403);
scene.fog = new THREE.Fog(0x050403, 6, 30); // far things fade into darkness

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, SETTINGS.playerHeight, SETTINGS.roomDepth / 2 - 2);

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

// Makes a material whose texture repeats once every 2 metres, whatever the surface size
function stoneMaterial(baseTexture, widthMetres, heightMetres, tint = 0xffffff) {
  const tex = baseTexture.clone();
  tex.needsUpdate = true;
  tex.repeat.set(widthMetres / 2, heightMetres / 2);
  return new THREE.MeshStandardMaterial({ map: tex, color: tint, roughness: 0.95, flatShading: true });
}

// ---------- Build the room ----------
// Every solid thing the player can bump into goes in this list.
// Each entry is a box on the ground: { minX, maxX, minZ, maxZ }.
const colliders = [];

function addSolidBox(x, z, width, depth, height, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, height / 2, z);
  scene.add(mesh);
  colliders.push({ minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 });
  return mesh;
}

const W = SETTINGS.roomWidth;
const D = SETTINGS.roomDepth;
const H = SETTINGS.roomHeight;
const T = SETTINGS.wallThickness;

// Floor
const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), stoneMaterial(floorTexture, W, D));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// Ceiling (darker)
const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D), stoneMaterial(floorTexture, W, D, 0x666666));
ceiling.rotation.x = Math.PI / 2;
ceiling.position.y = H;
scene.add(ceiling);

// Four walls
addSolidBox(0, -D / 2 - T / 2, W + 2 * T, T, H, stoneMaterial(wallTexture, W, H)); // north
addSolidBox(0,  D / 2 + T / 2, W + 2 * T, T, H, stoneMaterial(wallTexture, W, H)); // south
addSolidBox(-W / 2 - T / 2, 0, T, D, H, stoneMaterial(wallTexture, D, H));         // west
addSolidBox( W / 2 + T / 2, 0, T, D, H, stoneMaterial(wallTexture, D, H));         // east

// Two pillars in the middle (also solid, good for testing collisions)
addSolidBox(-3, -2, 1.2, 1.2, H, stoneMaterial(wallTexture, 1.2, H));
addSolidBox( 3, -2, 1.2, 1.2, H, stoneMaterial(wallTexture, 1.2, H));

// ---------- Lighting ----------
scene.add(new THREE.HemisphereLight(0x8899aa, 0x221811, 0.35)); // dim general light

// Wall torches: a small glowing block plus a warm flickering light
const torches = [];
function addTorch(x, z) {
  const flame = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.35, 0.2),
    new THREE.MeshBasicMaterial({ color: 0xffaa44 })
  );
  flame.position.set(x, 2.6, z);
  scene.add(flame);

  const light = new THREE.PointLight(0xff9933, 25, 14, 1.6);
  light.position.set(x, 2.6, z);
  scene.add(light);
  torches.push(light);
}
addTorch(-W / 2 + 0.15, -4);
addTorch( W / 2 - 0.15, -4);
addTorch(-W / 2 + 0.15,  5);
addTorch( W / 2 - 0.15,  5);

// ---------- Mouse look (pointer lock) ----------
const controls = new PointerLockControls(camera, document.body);
const overlay = document.getElementById('overlay');

overlay.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => overlay.classList.add('hidden'));
controls.addEventListener('unlock', () => overlay.classList.remove('hidden'));

// ---------- Keyboard ----------
const keys = {};
window.addEventListener('keydown', (e) => { keys[e.code] = true; });
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

  const running = keys['ShiftLeft'] || keys['ShiftRight'];
  const speed = running ? SETTINGS.runSpeed : SETTINGS.walkSpeed;
  move.normalize().multiplyScalar(speed * dt); // normalize = diagonal isn't faster

  // Move in small slices so a big step (e.g. on a slow computer) can't skip through a wall
  const steps = Math.ceil(move.length() / (SETTINGS.playerRadius / 2));
  for (let i = 0; i < steps; i++) {
    camera.position.x += move.x / steps;
    camera.position.z += move.z / steps;
    resolveCollisions(camera.position);
  }
}

// ---------- Main loop ----------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1); // cap so a lag spike can't teleport you through walls

  updateMovement(dt);

  // Make torches flicker a little
  const t = clock.elapsedTime;
  torches.forEach((light, i) => {
    light.intensity = 25 + Math.sin(t * 9 + i * 2) * 2 + Math.random() * 2;
  });

  renderer.render(scene, camera);
}
animate();

// Keep the picture the right shape when the window is resized
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
