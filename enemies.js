// =============================================================
//  Enemies: stats (data) and behaviour
// =============================================================
// Every enemy type uses the same code. Only these numbers differ.
//
//   health        hit points
//   damage        how much one of its attacks hurts you
//   speed         walking speed in metres per second
//   attackRange   how close it needs to be to start an attack (metres)
//   windup        seconds it spends raising its arms before striking (your warning!)
//   recover       seconds it rests after attacking before it can move/attack again
//   sightRange    how far away it can notice you (metres)
//   turnSpeed     how fast it can turn to face you (radians per second)
//   radius        how wide it is for collisions
//   scale         how big the model is (1 = person-sized)
//   bloodColour   colour of the spurt when you hit it (skeletons give off bone chips)
//   woundColour   colour of the cuts that build up on its body (see wounds.js)
//   hitSound      sound when your blade hits it (see sounds.js)
//   voice         sound it makes now and then when you're nearby; voicePitch makes it deeper (<1)
//
// Extra numbers only bosses use:
//   isBoss              shows the big health bar at the top of the screen
//   lightStaggerImmune  normal hits (even maces) can't stagger it, only power attacks
//   staggerResistance   power-attack staggers are this much shorter (0.5 = half as long)
//   knockback           how hard its hits shove you backwards (even through a block)
//   enrage              below this share of health it gets faster and fiercer

import * as THREE from 'three';

export const ENEMY_TYPES = {
  ghoul: {
    name: 'Ghoul',
    health: 60,
    damage: 14,
    speed: 3.0,
    attackRange: 1.7,
    windup: 0.55,
    recover: 0.8,
    sightRange: 16,
    turnSpeed: 5,
    radius: 0.4,
    scale: 1,
    skinColour: 0x7d8c62,
    clothColour: 0x3b3328,
    eyeColour: 0xff5a1f,
    bloodColour: 0xa01212,
    woundColour: 0xa81818,
    hitSound: 'hitFlesh',
    voice: 'enemyGroan',
    voicePitch: 1,
  },
  skeleton: {
    name: 'Skeleton',
    health: 75,
    damage: 16,
    speed: 3.4,
    attackRange: 1.8,
    windup: 0.5,
    recover: 0.7,
    sightRange: 18,
    turnSpeed: 6,
    radius: 0.38,
    scale: 1.05,
    thin: true,
    skinColour: 0xd8d0b8,
    clothColour: 0x4a4038,
    eyeColour: 0x6ad7ff,
    bloodColour: 0xd9d2bf, // bone chips, not blood
    woundColour: 0x3a2c20, // dark cracks in the bone
    hitSound: 'hitBone',
    voice: 'boneRattle',
    voicePitch: 1,
  },

  // ----- Bosses -----
  cryptLord: {
    name: 'The Crypt Lord',
    health: 450,
    damage: 28,
    speed: 2.4,
    attackRange: 2.8,
    windup: 0.85,
    recover: 1.1,
    sightRange: 30,
    turnSpeed: 3,
    radius: 0.8,
    scale: 1.9,
    horns: true,
    skinColour: 0x5e6e48,
    clothColour: 0x2a1f1a,
    eyeColour: 0xff3010,
    bloodColour: 0x8e0e0e,
    woundColour: 0x9a1212,
    hitSound: 'hitFlesh',
    voice: 'enemyGroan',
    voicePitch: 0.6,
    isBoss: true,
    lightStaggerImmune: true,
    staggerResistance: 0.5,
    knockback: 7,
    enrage: { at: 0.5, speed: 1.35, windup: 0.75, recover: 0.6 },
  },
  boneColossus: {
    name: 'The Bone Colossus',
    health: 520,
    damage: 30,
    speed: 2.7,
    attackRange: 3.0,
    windup: 0.8,
    recover: 1.0,
    sightRange: 30,
    turnSpeed: 3.4,
    radius: 0.85,
    scale: 2.1,
    thin: true,
    horns: true,
    skinColour: 0xcfc6ab,
    clothColour: 0x3a3029,
    eyeColour: 0x58c8ff,
    bloodColour: 0xd2c9b0, // bone chips, not blood
    woundColour: 0x3a2c20, // dark cracks in the bone
    hitSound: 'hitBone',
    voice: 'enemyGroan',
    voicePitch: 0.55,
    isBoss: true,
    lightStaggerImmune: true,
    staggerResistance: 0.5,
    knockback: 8,
    enrage: { at: 0.5, speed: 1.35, windup: 0.75, recover: 0.6 },
  },
};

// Arm angles (radians) for each moment of an attack
const ARMS_REST = -0.25;
const ARMS_RAISED = -2.4;
const ARMS_STRUCK = -0.7;

// Builds the low-poly placeholder body. The model faces +Z.
function buildModel(type) {
  const skin = new THREE.MeshStandardMaterial({ color: type.skinColour, roughness: 0.9, flatShading: true });
  const cloth = new THREE.MeshStandardMaterial({ color: type.clothColour, roughness: 1, flatShading: true });
  const eyes = new THREE.MeshBasicMaterial({ color: type.eyeColour });

  const root = new THREE.Group();     // sits on the floor, turns to face the player
  const body = new THREE.Group();     // tips over when the enemy dies
  root.add(body);

  const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

  // Legs swing from the hips
  const legs = [-0.13, 0.13].map((x) => {
    const hip = new THREE.Group();
    hip.position.set(x, 0.8, 0);
    const leg = box(0.15, 0.8, 0.15, cloth);
    leg.position.y = -0.4;
    hip.add(leg);
    body.add(hip);
    return hip;
  });

  const torso = box(type.thin ? 0.42 : 0.52, 0.66, type.thin ? 0.24 : 0.32, cloth);
  torso.position.y = 1.14;
  torso.rotation.x = 0.18; // hunched forward
  body.add(torso);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.19, 0), skin);
  head.position.set(0, 1.6, 0.1);
  body.add(head);

  // Horns (bosses)
  if (type.horns) {
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.28, 5), cloth);
      horn.position.set(side * 0.14, 1.78, 0.06);
      horn.rotation.z = -side * 0.7;
      horn.rotation.x = -0.3;
      body.add(horn);
    }
  }

  for (const x of [-0.07, 0.07]) {
    const eye = box(0.05, 0.035, 0.03, eyes);
    eye.position.set(x, 1.63, 0.27);
    body.add(eye);
  }

  // Arms swing from the shoulders
  const armX = type.thin ? 0.29 : 0.34;
  const arms = [-armX, armX].map((x) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(x, 1.38, 0.05);
    const arm = box(type.thin ? 0.08 : 0.12, 0.72, type.thin ? 0.08 : 0.12, skin);
    arm.position.y = -0.36;
    shoulder.add(arm);
    body.add(shoulder);
    return shoulder;
  });

  return { root, body, legs, arms, materials: [skin, cloth] };
}

// Small health bar that floats over the enemy's head and always faces the camera
function buildHealthBar() {
  const group = new THREE.Group();
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, 0.09),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 })
  );
  const fillGeo = new THREE.PlaneGeometry(0.76, 0.06);
  fillGeo.translate(0.38, 0, 0); // grow from the left edge
  const fill = new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({ color: 0xc83a2e }));
  fill.position.set(-0.38, 0, 0.001);
  group.add(back, fill);
  group.visible = false;
  group.userData.noWounds = true; // don't put cuts on the health bar
  return { group, fill };
}

// world = things the enemy needs to know about the game:
//   getPlayerPosition(), canSee(from, to), moveCircle(pos, dx, dz, radius),
//   damagePlayer(amount, enemy), onEnemyKilled(enemy), announce(text)
// difficulty = multiplies health and damage (later levels are harder)
export function createEnemy(scene, typeName, x, z, world, difficulty = 1) {
  // Each enemy gets its own copy of the stats, so enraging one boss doesn't change others
  const base = ENEMY_TYPES[typeName];
  const type = { ...base, health: Math.round(base.health * difficulty), damage: Math.round(base.damage * difficulty) };
  const model = buildModel(type);
  model.root.position.set(x, 0, z);
  model.root.scale.setScalar(type.scale);
  const bar = buildHealthBar();
  bar.group.position.y = 2.05;
  model.root.add(bar.group);
  scene.add(model.root);

  const enemy = {
    type,
    alive: true,
    removed: false,         // true once the body has fully sunk away
    health: type.health,
    maxHealth: type.health,
    radius: type.radius,
    isBoss: !!type.isBoss,
    enraged: false,
    position: new THREE.Vector3(x, 1.2 * type.scale, z), // chest height: what the player aims at
    feet: model.root.position,              // where it stands on the floor (moving this moves the enemy)
    bloodColour: type.bloodColour,
    woundColour: type.woundColour,
    hitSound: type.hitSound,
    voice: type.voice,
    voicePitch: type.voicePitch ?? 1,
    nextVoice: 2 + Math.random() * 6,       // seconds until it next groans (see game.js)
    woundRoot: model.root,                  // the 3D model that cuts get stuck onto (see wounds.js)
    height: 1.7 * type.scale,               // roughly how tall it is (for placing hit effects)
    state: 'idle',          // 'idle' | 'chase' | 'windup' | 'strike' | 'recover' | 'stagger' | 'dead'
    staggerTime: 0,         // how long the current stagger lasts
    staggerImmunity: 0,     // after being staggered, light hits can't stagger again for a moment
    stateTime: 0,
    facing: Math.random() * Math.PI * 2,
    lastSeen: null,
    flash: 0,
    knock: new THREE.Vector2(0, 0),
    walkCycle: 0,

    onHit(damage, direction, options = {}) {
      if (!this.alive) return;
      this.health -= damage;
      this.flash = 1;
      const shove = 2.5 / type.scale; // big enemies barely move
      this.knock.set(direction.x * shove, direction.z * shove);
      if (!type.isBoss) bar.group.visible = true; // bosses use the big bar at the top instead
      bar.fill.scale.x = Math.max(0, this.health / this.maxHealth);
      if (this.state === 'idle') this.setState('chase'); // hitting it wakes it up
      if (this.health <= 0) { this.die(); return; }
      // Knocked off balance? Power attacks always stagger. Light-hit staggers (maces)
      // don't work again straight away, so an enemy can't be stun-locked forever.
      // Bosses ignore light-hit staggers and shake off power staggers faster.
      if (!options.stagger) return;
      if (!options.forceStagger && (type.lightStaggerImmune || this.staggerImmunity > 0)) return;
      this.stagger(options.stagger * (1 - (type.staggerResistance || 0)));
    },

    // Knocked off balance: can't move or attack for a moment (cancels an attack in progress)
    stagger(seconds) {
      if (!this.alive) return;
      this.staggerTime = Math.max(seconds, this.state === 'stagger' ? this.staggerTime - this.stateTime : 0);
      this.setState('stagger');
    },

    // Its attack bounced off the player's block
    recoil() {
      const back = this.facing + Math.PI;
      this.knock.set(Math.sin(back) * 3, Math.cos(back) * 3);
      this.stagger(0.6);
    },

    die() {
      this.alive = false;
      this.setState('dead');
      bar.group.visible = false;
      world.onEnemyKilled(this);
    },

    setState(state) {
      this.state = state;
      this.stateTime = 0;
    },

    update(dt, camera) {
      this.stateTime += dt;
      const root = model.root;

      // ----- Dead: fall over, then sink into the floor and disappear -----
      if (this.state === 'dead') {
        const t = this.stateTime;
        model.body.rotation.x = -Math.min(t / 0.5, 1) * (Math.PI / 2);
        if (t > 1.5) root.position.y = -(t - 1.5) * 0.6;
        if (t > 3.5) { scene.remove(root); this.removed = true; }
        updateFlash(this, dt, model);
        return;
      }

      const player = world.getPlayerPosition();
      const dx = player.x - root.position.x;
      const dz = player.z - root.position.z;
      const dist = Math.hypot(dx, dz);
      const seesPlayer = dist < type.sightRange && world.canSee(root.position, player);
      if (seesPlayer) this.lastSeen = new THREE.Vector3(player.x, 0, player.z);

      // Bosses get angry when badly hurt: faster, with quicker attacks
      if (type.enrage && !this.enraged && this.health <= this.maxHealth * type.enrage.at) {
        this.enraged = true;
        type.speed *= type.enrage.speed;
        type.windup *= type.enrage.windup;
        type.recover *= type.enrage.recover;
        world.announce(`${type.name} is enraged!`);
      }

      let moving = false;

      if (this.state === 'idle') {
        if (seesPlayer) this.setState('chase');
      }

      else if (this.state === 'chase') {
        if (seesPlayer && dist <= type.attackRange) {
          this.setState('windup');
        } else if (this.lastSeen) {
          // Walk towards where we last saw the player
          const tx = this.lastSeen.x - root.position.x;
          const tz = this.lastSeen.z - root.position.z;
          const tdist = Math.hypot(tx, tz);
          if (tdist < 0.4 && !seesPlayer) {
            this.lastSeen = null;
            this.setState('idle'); // lost them
          } else {
            turnTowards(this, Math.atan2(tx, tz), type.turnSpeed * 1.5, dt);
            const step = Math.min(type.speed * dt, tdist);
            world.moveCircle(root.position, Math.sin(this.facing) * step, Math.cos(this.facing) * step, type.radius);
            moving = true;
          }
        } else {
          this.setState('idle');
        }
      }

      else if (this.state === 'windup') {
        // Keep turning to face the player while raising the arms
        turnTowards(this, Math.atan2(dx, dz), type.turnSpeed, dt);
        if (this.stateTime >= type.windup) {
          this.setState('strike');
          // Did the attack connect? Player must still be close and in front of us.
          const angleOff = Math.abs(angleDifference(Math.atan2(dx, dz), this.facing));
          if (dist <= type.attackRange + 0.5 && angleOff < THREE.MathUtils.degToRad(60) && seesPlayer) {
            world.damagePlayer(type.damage, this);
          }
        }
      }

      else if (this.state === 'strike') {
        // A quick lunge forward
        const lunge = 1.2 * dt;
        world.moveCircle(root.position, Math.sin(this.facing) * lunge, Math.cos(this.facing) * lunge, type.radius);
        if (this.stateTime >= 0.15) this.setState('recover');
      }

      else if (this.state === 'recover') {
        if (this.stateTime >= type.recover) this.setState('chase');
      }

      else if (this.state === 'stagger') {
        if (this.stateTime >= this.staggerTime) {
          this.setState('chase');
          this.staggerImmunity = 1.2;
        }
      }
      this.staggerImmunity = Math.max(0, this.staggerImmunity - dt);

      // Being shoved by a hit
      if (this.knock.lengthSq() > 0.0001) {
        world.moveCircle(root.position, this.knock.x * dt, this.knock.y * dt, type.radius);
        this.knock.multiplyScalar(Math.max(0, 1 - dt * 8));
      }

      // ----- Animation -----
      root.rotation.y = this.facing;
      this.position.set(root.position.x, 1.2 * type.scale, root.position.z);

      let armAngle = ARMS_REST;
      if (this.state === 'windup') armAngle = THREE.MathUtils.lerp(ARMS_REST, ARMS_RAISED, Math.min(this.stateTime / type.windup, 1));
      else if (this.state === 'strike') armAngle = THREE.MathUtils.lerp(ARMS_RAISED, ARMS_STRUCK, Math.min(this.stateTime / 0.15, 1));
      else if (this.state === 'recover') armAngle = THREE.MathUtils.lerp(ARMS_STRUCK, ARMS_REST, Math.min(this.stateTime / 0.4, 1));
      else if (this.state === 'stagger') armAngle = -1.2 + Math.sin(this.stateTime * 18) * 0.5; // flailing

      if (moving) this.walkCycle += dt * type.speed * 3.2;
      const swing = moving ? Math.sin(this.walkCycle) * 0.6 : 0;
      model.legs[0].rotation.x = swing;
      model.legs[1].rotation.x = -swing;
      model.arms[0].rotation.x = armAngle + (this.state === 'chase' ? -swing * 0.4 : 0);
      model.arms[1].rotation.x = armAngle + (this.state === 'chase' ? swing * 0.4 : 0);
      model.body.position.y = moving ? Math.abs(Math.sin(this.walkCycle)) * 0.05 : 0;

      // Flinch backwards for a moment when hit; reel back further while staggered
      const reel = this.state === 'stagger' ? 0.35 * Math.max(0, 1 - this.stateTime / this.staggerTime) : 0;
      model.body.rotation.x = -this.flash * 0.25 - reel;

      // Health bar always faces the camera
      if (bar.group.visible) bar.group.quaternion.copy(root.quaternion).invert().multiply(camera.quaternion);

      updateFlash(this, dt, model);
    },
  };
  return enemy;
}

// ---------- Small helpers ----------
function updateFlash(enemy, dt, model) {
  enemy.flash = Math.max(0, enemy.flash - dt * 5);
  for (const m of model.materials) m.emissive.setRGB(enemy.flash * 0.9, enemy.flash * 0.1, 0);
}

// Smallest signed difference between two angles (-PI..PI)
function angleDifference(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function turnTowards(enemy, targetAngle, speed, dt) {
  const diff = angleDifference(targetAngle, enemy.facing);
  const maxTurn = speed * dt;
  enemy.facing += Math.max(-maxTurn, Math.min(maxTurn, diff));
}
