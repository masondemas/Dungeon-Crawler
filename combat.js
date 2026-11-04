// =============================================================
//  Combat: the weapon in your hand, attacking, power attacks and blocking
// =============================================================
import * as THREE from 'three';
import { buildWeaponModel } from './weapons.js';

// ---------- Weapon poses ----------
// Where the weapon sits on screen at each moment.
// pos = position in front of the camera, rot = tilt (in radians).
const POSES = {
  rest:    { pos: [0.32, -0.30, -0.60], rot: [-0.55, 0.0, 0.12] },   // held ready, bottom right
  windup:  { pos: [0.34, -0.04, -0.58], rot: [0.35, 0.2, -0.55] },   // raised up to the right
  charged: { pos: [0.30, -0.14, -0.56], rot: [0.3, 0.25, -0.65] },   // pulled far back for a power attack
  strike:  { pos: [-0.22, -0.32, -0.62], rot: [-0.6, 0.0, 1.65] },   // slashed across to the left
  block:   { pos: [0.26, -0.26, -0.56], rot: [-0.2, 0.35, 0.95] },  // held sideways across your body
};

// Turns a pose into something we can smoothly blend between
function toTransform(pose) {
  return {
    pos: new THREE.Vector3(...pose.pos),
    quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(...pose.rot)),
  };
}
const T = {};
for (const name in POSES) T[name] = toTransform(POSES[name]);

// Easing curves make movement start/stop smoothly instead of robotically
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// If you let go this soon after charging starts, it still counts as a light attack
const TAP_GRACE = 0.15;

// ---------- Setup ----------
// The weapon is drawn in its own little scene on top of the world,
// so it never pokes through walls when you stand close to them.
export function createCombat({ camera, getTargets, canSee, useStamina, getStamina, onHitTarget, onChargeChange }) {
  const weaponScene = new THREE.Scene();
  const weaponCamera = new THREE.PerspectiveCamera(60, camera.aspect, 0.01, 10);
  weaponScene.add(new THREE.HemisphereLight(0xffe2b0, 0x221811, 0.9));
  const handLight = new THREE.PointLight(0xffc880, 3, 3, 1.5);
  handLight.position.set(0.3, 0.2, 0);
  weaponScene.add(handLight);

  const holder = new THREE.Group(); // moves around during swings
  weaponScene.add(holder);

  let weapon = null;
  let model = null;

  function equip(newWeapon) {
    weapon = newWeapon;
    if (model) holder.remove(model);
    model = buildWeaponModel(weapon);
    model.scale.setScalar(0.7); // size of the weapon on screen
    holder.add(model);
  }

  // ----- State -----
  // phase: 'ready' | 'windup' | 'charging' | 'strike' | 'recover'
  let phase = 'ready';
  let phaseTime = 0;
  let attackHeld = false;   // is the left button down right now?
  let queued = false;       // clicked again near the end of a swing
  let power = 0;            // 0 = light attack, otherwise how charged this swing is (0..1)
  let blockHeld = false;    // is the right button down right now?
  let blockAmount = 0;      // 0 = sword down, 1 = fully raised to block
  let impact = 0;           // little jolt when a hit is blocked
  const alreadyHit = new Set();
  let bobTime = 0;
  const from = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() }; // pose a phase starts from

  function setPhase(newPhase) {
    from.pos.copy(holder.position);
    from.quat.copy(holder.quaternion);
    phase = newPhase;
    phaseTime = 0;
  }

  function startAttack() {
    if (weapon.staminaCost > 0) {
      if (getStamina() < weapon.staminaCost) return; // too tired to swing
      useStamina(weapon.staminaCost);
    }
    power = 0;
    alreadyHit.clear();
    setPhase('windup');
  }

  function strike(chargeTime) {
    // A real power attack needs enough stamina, otherwise it's just a normal swing
    const charged = chargeTime - TAP_GRACE;
    if (charged > 0 && getStamina() >= weapon.powerStaminaCost) {
      useStamina(weapon.powerStaminaCost);
      power = Math.max(0.01, Math.min(charged / weapon.powerChargeTime, 1));
    } else {
      power = 0;
    }
    onChargeChange(null);
    setPhase('strike');
  }

  // ----- Input (called from game.js) -----
  function pressAttack() {
    attackHeld = true;
    if (!weapon || blockHeld) return;                       // can't attack while holding block
    if (phase === 'ready') startAttack();
    else if (phase === 'recover' || phase === 'strike') queued = true; // chain the next swing
  }

  function releaseAttack() {
    attackHeld = false;
    if (phase === 'charging') strike(phaseTime);
  }

  function setBlock(held) {
    blockHeld = held;
  }

  // ---------- Hit detection ----------
  const forward = new THREE.Vector3();
  const toTarget = new THREE.Vector3();

  function checkHits() {
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const halfArc = THREE.MathUtils.degToRad(weapon.arc / 2);

    for (const target of getTargets()) {
      if (alreadyHit.has(target)) continue; // each swing hits each target only once
      toTarget.subVectors(target.position, camera.position);
      toTarget.y = 0;
      const dist = toTarget.length();
      if (dist - target.radius > weapon.reach) continue;            // too far away
      const angle = forward.angleTo(toTarget.normalize());
      const extra = Math.atan2(target.radius, Math.max(dist, 0.01)); // wide targets are easier to clip
      if (angle > halfArc + extra) continue;                         // not in front of us
      if (!canSee(camera.position, target.position)) continue;       // a wall is in the way

      alreadyHit.add(target);
      // Push direction = sideways sweep (right to left) plus a bit forward
      const right = new THREE.Vector3().crossVectors(forward, camera.up);
      const dir = forward.clone().multiplyScalar(0.6).addScaledVector(right, -1).normalize();

      const isPower = power > 0;
      const multiplier = isPower
        ? THREE.MathUtils.lerp(weapon.powerMinMultiplier, weapon.powerMaxMultiplier, power)
        : 1;
      const damage = Math.round(weapon.damage * multiplier);
      if (isPower) dir.multiplyScalar(1.8); // power attacks shove harder
      target.onHit(damage, dir, { stagger: isPower ? weapon.powerStagger : 0 });
      onHitTarget(target, damage, isPower);
    }
  }

  // ---------- Every frame ----------
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const tmpQuat = new THREE.Quaternion();
  const tmpEuler = new THREE.Euler();

  function update(dt, moveAmount) {
    if (!weapon) return;
    phaseTime += dt;

    // Raise or lower the block (only when not in the middle of an attack)
    if (phase !== 'ready') blockAmount = 0; // attacking drops the guard straight away
    const blockTarget = blockHeld && phase === 'ready' ? 1 : 0;
    const blockStep = dt / 0.12; // takes 0.12 seconds to raise fully
    blockAmount += Math.max(-blockStep, Math.min(blockStep, blockTarget - blockAmount));

    if (phase === 'windup') {
      const t = Math.min(phaseTime / weapon.windup, 1);
      pos.lerpVectors(from.pos, T.windup.pos, easeOut(t));
      quat.slerpQuaternions(from.quat, T.windup.quat, easeOut(t));
      if (t >= 1) {
        // Still holding the button? Start charging a power attack.
        if (attackHeld) setPhase('charging');
        else setPhase('strike');
      }
    } else if (phase === 'charging') {
      const charge = Math.min(Math.max(phaseTime - TAP_GRACE, 0) / weapon.powerChargeTime, 1);
      const t = Math.min(phaseTime / 0.3, 1);
      pos.lerpVectors(from.pos, T.charged.pos, easeOut(t));
      quat.slerpQuaternions(from.quat, T.charged.quat, easeOut(t));
      // The weapon trembles more the longer you charge
      pos.x += (Math.random() - 0.5) * 0.006 * charge;
      pos.y += (Math.random() - 0.5) * 0.006 * charge;
      const enoughStamina = getStamina() >= weapon.powerStaminaCost;
      onChargeChange(phaseTime > TAP_GRACE ? { amount: charge, possible: enoughStamina } : null);
    } else if (phase === 'strike') {
      const duration = weapon.strike * (power > 0 ? 1.3 : 1); // power swings are a little slower
      const t = Math.min(phaseTime / duration, 1);
      pos.lerpVectors(from.pos, T.strike.pos, easeInOut(t));
      quat.slerpQuaternions(from.quat, T.strike.quat, easeInOut(t));
      if (t > 0.15) checkHits(); // the very start of the swing is too early to hit
      if (t >= 1) setPhase('recover');
    } else if (phase === 'recover') {
      const duration = weapon.recover * (power > 0 ? 1.6 : 1); // and take longer to recover
      const t = Math.min(phaseTime / duration, 1);
      pos.lerpVectors(from.pos, T.rest.pos, easeInOut(t));
      quat.slerpQuaternions(from.quat, T.rest.quat, easeInOut(t));
      if (queued && t > 0.35) { queued = false; startAttack(); } // chained swing
      else if (t >= 1) setPhase('ready');
    } else {
      // Ready: blend between resting and blocking
      pos.lerpVectors(T.rest.pos, T.block.pos, easeInOut(blockAmount));
      quat.slerpQuaternions(T.rest.quat, T.block.quat, easeInOut(blockAmount));
    }

    // Jolt when a hit lands on our block
    if (impact > 0) {
      pos.z += impact * 0.08;
      pos.y -= impact * 0.04;
      quat.multiply(tmpQuat.setFromEuler(tmpEuler.set(impact * 0.3, 0, 0)));
      impact = Math.max(0, impact - dt * 5);
    }

    // Gentle bob while walking
    bobTime += dt * (4 + moveAmount * 6);
    const bob = phase === 'ready' ? moveAmount : 0;
    pos.x += Math.sin(bobTime) * 0.012 * bob;
    pos.y += Math.abs(Math.cos(bobTime)) * 0.018 * bob;

    holder.position.copy(pos);
    holder.quaternion.copy(quat);
  }

  // Draws the weapon on top of everything else
  function render(renderer) {
    renderer.clearDepth();
    renderer.render(weaponScene, weaponCamera);
  }

  function resize(aspect) {
    weaponCamera.aspect = aspect;
    weaponCamera.updateProjectionMatrix();
  }

  return {
    equip,
    pressAttack,
    releaseAttack,
    setBlock,
    update,
    render,
    resize,
    getWeapon: () => weapon,
    isBlocking: () => blockAmount > 0.6,   // raised enough to actually block
    isGuarding: () => blockAmount > 0,     // raised at all (slows you down)
    isCharging: () => phase === 'charging',
    blockImpact: () => { impact = 1; },
    breakGuard: () => { blockAmount = 0; blockHeld = false; },
  };
}
