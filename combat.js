// =============================================================
//  Combat: the weapon in your hand, attacking, power attacks and blocking
// =============================================================
import * as THREE from 'three';
import { buildWeaponModel } from './weapons.js';
import { buildShieldModel } from './equipment.js';
import { buildPotionModel } from './pickups.js';

// ---------- Weapon poses ----------
// Where the weapon sits on screen at each moment.
// pos = position in front of the camera, rot = tilt (in radians).
const POSES = {
  rest:    { pos: [0.32, -0.30, -0.60], rot: [-0.55, 0.0, 0.12] },   // held ready, bottom right
  charged: { pos: [0.30, -0.14, -0.56], rot: [0.3, 0.25, -0.65] },   // pulled far back for a power attack
  block:   { pos: [0.26, -0.26, -0.56], rot: [-0.2, 0.35, 0.95] },  // held sideways across your body
  lowered: { pos: [0.36, -0.95, -0.55], rot: [-1.1, 0.0, 0.2] },    // out of view (while switching weapons)
};

// ---------- Swings ----------
// Every swing has 3 key poses: wind-up (pulled back), strike (where the fast slash ends)
// and follow-through (the weapon carries on a little past the target, then slows).
//   windupScale / strikeScale  make this swing's wind-up or strike longer than the weapon's normal timing
//   damage      damage multiplier for this swing
//   sweep       direction the blade travels, as seen from the player (x = right, y = up, z = towards you)
const SWINGS = {
  // 1st in the combo: right to left
  right: {
    windup: { pos: [0.34, -0.04, -0.58], rot: [0.35, 0.2, -0.55] },
    strike: { pos: [-0.26, -0.17, -0.62], rot: [-0.35, 0.0, 1.5] },
    follow: { pos: [-0.36, -0.24, -0.60], rot: [-0.55, 0.0, 1.78] },
    windupScale: 1, strikeScale: 1, damage: 1,
    sweep: [-1, -0.25, 0],
  },
  // 2nd in the combo: left to right (a backhand)
  left: {
    windup: { pos: [-0.16, -0.06, -0.58], rot: [0.3, -0.3, 0.95] },
    strike: { pos: [0.30, -0.17, -0.62], rot: [-0.35, 0.0, -1.35] },
    follow: { pos: [0.40, -0.24, -0.60], rot: [-0.55, 0.0, -1.65] },
    windupScale: 1, strikeScale: 1, damage: 1,
    sweep: [1, -0.25, 0],
  },
  // 3rd in the combo: overhead chop (a longer wind-up, more damage)
  overhead: {
    windup: { pos: [0.14, 0.00, -0.52], rot: [0.85, 0.0, -0.2] },
    strike: { pos: [0.08, -0.20, -0.66], rot: [-1.55, 0.0, -0.05] },
    follow: { pos: [0.08, -0.27, -0.62], rot: [-1.8, 0.0, -0.05] },
    windupScale: 1.3, strikeScale: 1.1, damage: 1.3, // (a weapon can set finisherMultiplier to change the 1.3)
    sweep: [0, -1, -0.3],
  },
};
const COMBO = ['right', 'left', 'overhead'];
const COMBO_RESET_TIME = 1.0; // pause this long (seconds) and the combo starts over

// Shield poses (left hand)
const SHIELD_POSES = {
  rest:    { pos: [-0.44, -0.36, -0.62], rot: [0.25, 0.65, 0.1] },   // held low at your side
  block:   { pos: [-0.2, -0.33, -0.6], rot: [0.12, 0.32, 0.0] },     // raised in front of you (you can see over it)
  lowered: { pos: [-0.44, -0.95, -0.6], rot: [0.8, 0.65, 0.1] },     // out of view (while switching)
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
const SW = {};
for (const name in SWINGS) {
  SW[name] = {
    ...SWINGS[name],
    windup: toTransform(SWINGS[name].windup),
    strike: toTransform(SWINGS[name].strike),
    follow: toTransform(SWINGS[name].follow),
    sweep: new THREE.Vector3(...SWINGS[name].sweep).normalize(),
  };
}
const ST = {};
for (const name in SHIELD_POSES) ST[name] = toTransform(SHIELD_POSES[name]);

// Easing curves make movement start/stop smoothly instead of robotically
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeIn = (t) => t * t * t; // starts slow, finishes very fast: good for the strike

// If you let go this soon after charging starts, it still counts as a light attack
const TAP_GRACE = 0.15;

// ---------- Setup ----------
// The weapon is drawn in its own little scene on top of the world,
// so it never pokes through walls when you stand close to them.
export function createCombat({ camera, getTargets, canSee, useStamina, getStamina, onHitTarget, onChargeChange, onSwingStart = () => {}, onSwingMissed = () => {} }) {
  const weaponScene = new THREE.Scene();
  const weaponCamera = new THREE.PerspectiveCamera(60, camera.aspect, 0.01, 10);
  weaponScene.add(new THREE.HemisphereLight(0xffe2b0, 0x221811, 0.9));
  const handLight = new THREE.PointLight(0xffc880, 3, 3, 1.5);
  handLight.position.set(0.3, 0.2, 0);
  weaponScene.add(handLight);

  const holder = new THREE.Group(); // moves around during swings
  weaponScene.add(holder);
  const shieldHolder = new THREE.Group(); // the shield, in your left hand
  weaponScene.add(shieldHolder);
  let shield = null;
  let shieldModel = null;
  let shieldRaise = 1; // 0 = lowered out of view, 1 = in hand (animates when switching)

  // Potion bottle (only visible while drinking)
  const potionHolder = new THREE.Group();
  const potionModel = buildPotionModel();
  potionModel.scale.setScalar(0.9);
  potionHolder.add(potionModel);
  potionHolder.visible = false;
  weaponScene.add(potionHolder);
  let drinkTime = 0;       // how long we've been drinking
  let drinkDuration = 0;   // 0 = not drinking
  let onDrinkDone = null;

  let weapon = null;
  let model = null;

  function swapModel(newWeapon) {
    weapon = newWeapon;
    if (model) holder.remove(model);
    model = buildWeaponModel(weapon);
    model.scale.setScalar(0.7); // size of the weapon on screen
    holder.add(model);
  }

  // Switch weapons: the old one lowers out of view, then the new one comes up
  let nextWeapon = null;
  function equip(newWeapon) {
    if (!weapon) { swapModel(newWeapon); return; } // first weapon: no animation
    if (newWeapon === weapon && phase !== 'swapOut') return;
    nextWeapon = newWeapon;
    attackHeld = false;
    queued = false;
    onChargeChange(null);
    if (phase !== 'swapOut') setPhase('swapOut');
  }

  // Switch shields (null = no shield)
  function equipShield(newShield) {
    if (shieldModel) shieldHolder.remove(shieldModel);
    shield = newShield;
    shieldModel = null;
    if (shield) {
      shieldModel = buildShieldModel(shield);
      shieldModel.scale.setScalar(0.7);
      shieldHolder.add(shieldModel);
      shieldRaise = 0; // slide up into view
    }
  }

  // The block numbers to use right now: the shield's if you have one, otherwise the weapon's
  function getBlockStats(defaultArc) {
    if (shield) return { reduction: shield.blockReduction, staminaPerDamage: shield.blockStaminaPerDamage, arc: shield.blockArc };
    return { reduction: weapon.blockReduction, staminaPerDamage: weapon.blockStaminaPerDamage, arc: defaultArc };
  }

  // Start drinking a potion. onDone() runs when the drink is finished.
  function drink(duration, onDone) {
    if (drinkDuration > 0 || phase !== 'ready') return false;
    drinkDuration = duration;
    drinkTime = 0;
    onDrinkDone = onDone;
    attackHeld = false;
    queued = false;
    return true;
  }
  const isDrinking = () => drinkDuration > 0;

  // ----- State -----
  // phase: 'ready' | 'windup' | 'charging' | 'strike' | 'follow' | 'recover' | 'swapOut' | 'swapIn'
  let phase = 'ready';
  let phaseTime = 0;
  let attackHeld = false;   // is the left button down right now?
  let queued = false;       // clicked again near the end of a swing
  let power = 0;            // 0 = light attack, otherwise how charged this swing is (0..1)
  let swing = SW.right;     // the swing we're doing right now
  let comboStep = 0;        // which swing of the combo comes next (0, 1, 2)
  let sinceLastSwing = 99;  // seconds since the last swing finished (for resetting the combo)
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
    // Paused too long? Start the combo from the first swing again.
    if (sinceLastSwing > COMBO_RESET_TIME) comboStep = 0;
    swing = SW[COMBO[comboStep]];
    comboStep = (comboStep + 1) % COMBO.length;
    power = 0;
    alreadyHit.clear();
    setPhase('windup');
  }

  // How long each part of the current swing takes, using this weapon's own speed
  const followTime = () => weapon.followThrough ?? weapon.strike * 0.8;
  const windupTime = () => weapon.windup * swing.windupScale;
  const strikeTime = () => weapon.strike * swing.strikeScale * (power > 0 ? 1.3 : 1); // power swings are a little slower

  function strike(chargeTime) {
    // A real power attack needs enough stamina, otherwise it's just a normal swing
    const charged = chargeTime - TAP_GRACE;
    if (charged > 0 && getStamina() >= weapon.powerStaminaCost) {
      useStamina(weapon.powerStaminaCost);
      power = Math.max(0.01, Math.min(charged / weapon.powerChargeTime, 1));
      // Power attacks are their own big right-to-left swing, separate from the combo
      swing = SW.right;
      comboStep = 0;
    } else {
      power = 0;
    }
    onChargeChange(null);
    enterStrike();
  }

  // The fast part of a swing begins (this is when the swoosh plays)
  function enterStrike() {
    onSwingStart({ weapon, isPower: power > 0, isFinisher: power === 0 && swing === SW.overhead });
    setPhase('strike');
  }

  // ----- Input (called from game.js) -----
  function pressAttack() {
    attackHeld = true;
    if (!weapon || blockHeld || isDrinking()) return;       // can't attack while blocking or drinking
    if (phase === 'ready') startAttack();
    else if (['windup', 'strike', 'follow', 'recover'].includes(phase)) queued = true; // chain the next swing
    // (clicks while switching weapons are ignored)
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
      // Which way is the blade travelling, in the world? (used for the shove, and later for blood)
      const sweep = swing.sweep.clone().applyQuaternion(camera.quaternion);
      // Push direction = the blade's sideways travel plus a bit forward
      const dir = new THREE.Vector3(sweep.x, 0, sweep.z).addScaledVector(forward, 0.6).normalize();

      const isPower = power > 0;
      const isFinisher = !isPower && swing === SW.overhead;
      const multiplier = isPower
        ? THREE.MathUtils.lerp(weapon.powerMinMultiplier, weapon.powerMaxMultiplier, power)
        : isFinisher ? (weapon.finisherMultiplier ?? swing.damage) : 1;
      const damage = Math.round(weapon.damage * multiplier);
      if (isPower) dir.multiplyScalar(1.8);            // power attacks shove harder
      else if (isFinisher) dir.multiplyScalar(1.3);
      // Power attacks always stagger. Some weapons (maces) also stagger on normal hits.
      target.onHit(damage, dir, {
        stagger: isPower ? weapon.powerStagger : weapon.hitStagger,
        forceStagger: isPower,
      });
      onHitTarget(target, damage, isPower, { sweep, isFinisher, swingName: COMBO.find((n) => SW[n] === swing) });
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
    const blockTarget = blockHeld && phase === 'ready' && !isDrinking() ? 1 : 0;
    const blockStep = dt / 0.12; // takes 0.12 seconds to raise fully
    blockAmount += Math.max(-blockStep, Math.min(blockStep, blockTarget - blockAmount));

    if (phase !== 'ready') sinceLastSwing = 0;
    else sinceLastSwing += dt;

    if (phase === 'windup') {
      const t = Math.min(phaseTime / windupTime(), 1);
      pos.lerpVectors(from.pos, swing.windup.pos, easeOut(t));
      quat.slerpQuaternions(from.quat, swing.windup.quat, easeOut(t));
      if (t >= 1) {
        // Still holding the button? Start charging a power attack.
        if (attackHeld) { queued = false; setPhase('charging'); }
        else enterStrike();
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
      // The fast part: starts slowly and whips through at the end
      const t = Math.min(phaseTime / strikeTime(), 1);
      pos.lerpVectors(from.pos, swing.strike.pos, easeIn(t));
      quat.slerpQuaternions(from.quat, swing.strike.quat, easeIn(t));
      if (t > 0.3) checkHits(); // the start of the swing is too early to hit
      if (t >= 1) {
        if (alreadyHit.size === 0) onSwingMissed(); // hit nothing (maybe a wall?)
        setPhase('follow');
      }
    } else if (phase === 'follow') {
      // Follow-through: the weapon's weight carries it a little further, slowing down
      const t = Math.min(phaseTime / (followTime() * (power > 0 ? 1.4 : 1)), 1);
      pos.lerpVectors(from.pos, swing.follow.pos, easeOut(t));
      quat.slerpQuaternions(from.quat, swing.follow.quat, easeOut(t));
      if (t < 0.4) checkHits(); // the blade can still connect right at the start of the follow-through
      if (t >= 1) {
        if (queued) { queued = false; startAttack(); } // chain straight into the next swing
        else setPhase('recover');
      }
    } else if (phase === 'recover') {
      const duration = weapon.recover * (power > 0 ? 1.6 : 1); // power attacks take longer to recover
      const t = Math.min(phaseTime / duration, 1);
      pos.lerpVectors(from.pos, T.rest.pos, easeInOut(t));
      quat.slerpQuaternions(from.quat, T.rest.quat, easeInOut(t));
      if (queued) { queued = false; startAttack(); } // chained swing
      else if (t >= 1) setPhase('ready');
    } else if (phase === 'swapOut') {
      const t = Math.min(phaseTime / 0.18, 1);
      pos.lerpVectors(from.pos, T.lowered.pos, easeInOut(t));
      quat.slerpQuaternions(from.quat, T.lowered.quat, easeInOut(t));
      if (t >= 1) {
        swapModel(nextWeapon);
        setPhase('swapIn');
      }
    } else if (phase === 'swapIn') {
      const t = Math.min(phaseTime / 0.22, 1);
      pos.lerpVectors(T.lowered.pos, T.rest.pos, easeOut(t));
      quat.slerpQuaternions(T.lowered.quat, T.rest.quat, easeOut(t));
      if (t >= 1) setPhase('ready');
    } else {
      // Ready: blend between resting and blocking (with a shield, the shield blocks instead)
      const weaponBlock = shield ? 0 : blockAmount;
      pos.lerpVectors(T.rest.pos, T.block.pos, easeInOut(weaponBlock));
      quat.slerpQuaternions(T.rest.quat, T.block.quat, easeInOut(weaponBlock));
    }

    // Jolt when a hit lands on our block (on the weapon, or on the shield)
    if (impact > 0 && !shield) {
      pos.z += impact * 0.08;
      pos.y -= impact * 0.04;
      quat.multiply(tmpQuat.setFromEuler(tmpEuler.set(impact * 0.3, 0, 0)));
    }

    // ----- Drinking a potion -----
    // The bottle comes up from below, tips towards your mouth, then drops away.
    let shieldDown = 0;
    if (isDrinking()) {
      drinkTime += dt;
      const t = Math.min(drinkTime / drinkDuration, 1);
      const up = Math.min(t / 0.25, 1);              // first quarter: lift
      const down = Math.max((t - 0.8) / 0.2, 0);     // last fifth: lower
      const raise = easeOut(up) * (1 - easeInOut(down));
      potionHolder.visible = true;
      const tip = Math.min(1, Math.max(0, (t - 0.15) / 0.3)); // tip it towards your mouth
      potionHolder.position.set(-0.05 + 0.12 * (1 - raise), -0.7 + 0.5 * raise, -0.45);
      potionHolder.rotation.set(raise * tip * 1.1, 0, 0.35 - tip * 0.15);
      potionHolder.position.y += Math.sin(drinkTime * 20) * 0.004 * raise; // gulp
      shieldDown = raise;
      if (t >= 1) {
        drinkDuration = 0;
        potionHolder.visible = false;
        if (onDrinkDone) onDrinkDone();
      }
    }

    // ----- Shield -----
    if (shield) {
      shieldRaise = Math.min(1, shieldRaise + dt / 0.25);
      const sPos = new THREE.Vector3().lerpVectors(ST.rest.pos, ST.block.pos, easeInOut(blockAmount));
      const sQuat = new THREE.Quaternion().slerpQuaternions(ST.rest.quat, ST.block.quat, easeInOut(blockAmount));
      sPos.lerpVectors(ST.lowered.pos, sPos, easeOut(shieldRaise) * (1 - shieldDown)); // drops while drinking
      if (impact > 0) { sPos.z += impact * 0.07; sPos.y -= impact * 0.03; }
      // Bob with your steps (a little out of time with the weapon)
      const sBob = blockAmount > 0.5 ? 0.3 : 1;
      sPos.x += Math.sin(bobTime + 0.6) * 0.01 * moveAmount * sBob;
      sPos.y += Math.abs(Math.cos(bobTime + 0.6)) * 0.014 * moveAmount * sBob;
      shieldHolder.position.copy(sPos);
      shieldHolder.quaternion.copy(sQuat);
    }
    impact = Math.max(0, impact - dt * 5);

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
    equipShield,
    getShield: () => shield,
    getBlockStats,
    drink,
    isDrinking,
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
    isSwitching: () => phase === 'swapOut' || phase === 'swapIn',
    getComboStep: () => comboStep,
    blockImpact: () => { impact = 1; },
    breakGuard: () => { blockAmount = 0; blockHeld = false; },
  };
}
