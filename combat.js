// =============================================================
//  Combat: the weapon in your hand, swinging it, and hitting things
// =============================================================
import * as THREE from 'three';
import { buildWeaponModel } from './weapons.js';

// ---------- Weapon poses ----------
// Where the weapon sits on screen at each moment of a swing.
// pos = position in front of the camera, rot = tilt (in radians).
const POSES = {
  rest:    { pos: [0.32, -0.30, -0.60], rot: [-0.55, 0.0, 0.12] },   // held ready, bottom right
  windup:  { pos: [0.34, -0.04, -0.58], rot: [0.35, 0.2, -0.55] },   // raised up to the right
  strike:  { pos: [-0.22, -0.32, -0.62], rot: [-0.6, 0.0, 1.65] },   // slashed across to the left
};

// Turns a pose into something we can smoothly blend between
function toTransform(pose) {
  return {
    pos: new THREE.Vector3(...pose.pos),
    quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(...pose.rot)),
  };
}
const T = {
  rest: toTransform(POSES.rest),
  windup: toTransform(POSES.windup),
  strike: toTransform(POSES.strike),
};

// Easing curves make movement start/stop smoothly instead of robotically
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// ---------- Setup ----------
// The weapon is drawn in its own little scene on top of the world,
// so it never pokes through walls when you stand close to them.
export function createCombat({ camera, getTargets, canSee, useStamina, getStamina, onHitTarget }) {
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

  // Swing state
  let phase = 'ready';   // 'ready' | 'windup' | 'strike' | 'recover'
  let phaseTime = 0;
  let queued = false;    // clicked again near the end of a swing
  const alreadyHit = new Set();
  let bobTime = 0;

  function startAttack() {
    if (weapon.staminaCost > 0) {
      if (getStamina() < weapon.staminaCost) return; // too tired to swing
      useStamina(weapon.staminaCost);
    }
    phase = 'windup';
    phaseTime = 0;
    alreadyHit.clear();
  }

  // Called when the player clicks
  function attack() {
    if (!weapon) return;
    if (phase === 'ready') startAttack();
    else if (phase === 'recover' || phase === 'strike') queued = true; // chain the next swing
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
      target.onHit(weapon.damage, dir);
      onHitTarget(target, weapon.damage);
    }
  }

  // ---------- Every frame ----------
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();

  function update(dt, moveAmount) {
    if (!weapon) return;
    phaseTime += dt;

    if (phase === 'windup') {
      const t = Math.min(phaseTime / weapon.windup, 1);
      pos.lerpVectors(T.rest.pos, T.windup.pos, easeOut(t));
      quat.slerpQuaternions(T.rest.quat, T.windup.quat, easeOut(t));
      if (t >= 1) { phase = 'strike'; phaseTime = 0; }
    } else if (phase === 'strike') {
      const t = Math.min(phaseTime / weapon.strike, 1);
      pos.lerpVectors(T.windup.pos, T.strike.pos, easeInOut(t));
      quat.slerpQuaternions(T.windup.quat, T.strike.quat, easeInOut(t));
      checkHits();
      if (t >= 1) { phase = 'recover'; phaseTime = 0; }
    } else if (phase === 'recover') {
      const t = Math.min(phaseTime / weapon.recover, 1);
      pos.lerpVectors(T.strike.pos, T.rest.pos, easeInOut(t));
      quat.slerpQuaternions(T.strike.quat, T.rest.quat, easeInOut(t));
      if (queued && t > 0.35) { queued = false; startAttack(); }    // chained swing
      else if (t >= 1) { phase = 'ready'; phaseTime = 0; }
    } else {
      pos.copy(T.rest.pos);
      quat.copy(T.rest.quat);
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

  return { equip, attack, update, render, resize, isSwinging: () => phase !== 'ready' };
}
