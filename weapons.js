// =============================================================
//  Weapons: all weapon stats live here as data
// =============================================================
// Every weapon uses the same combat code. Only these numbers differ.
//
//   damage        how much health one light attack takes off
//   reach         how far it hits, in metres (measured from the player)
//   arc           how wide the swing is, in degrees (90 = a quarter circle in front of you)
//   windup        seconds pulling the weapon back before the swing
//   strike        seconds of the actual swing (this is when it can hit things)
//   recover       seconds returning to the ready pose (you can queue the next attack here)
//   followThrough seconds the weapon carries on past the target after the strike
//                 (optional: if left out it's 80% of the strike time)
//   finisherMultiplier  damage multiplier for the 3rd combo swing, the overhead chop
//                 (optional: if left out it's 1.3)
//
//   Combo: light attacks in a row go right-to-left, left-to-right, then an overhead
//   chop. Pause for about a second and it starts over. Each part of each swing uses
//   this weapon's windup/strike/recover times, so fast weapons combo faster.
//   staminaCost   stamina used per light attack (0 = free, like Skyrim)
//   hitStagger    seconds every hit knocks an enemy off balance (maces only)
//   moveSpeed     walking speed multiplier while holding this weapon (heavy = slower)
//
//   Power attack (hold left click):
//   powerChargeTime   seconds of holding to reach a full charge
//   powerMinMultiplier  damage multiplier for a barely-charged power attack
//   powerMaxMultiplier  damage multiplier for a fully charged power attack
//   powerStaminaCost  stamina used per power attack
//   powerStagger      seconds a power attack knocks enemies off balance
//
//   Blocking (hold right click):
//   blockReduction    how much of a hit's damage blocking stops (0.6 = 60%)
//   blockStaminaPerDamage  stamina used for each point of damage you block
//
//   swingWeight   how heavy the swoosh sounds (0 = light and quick, 1 = big and low)
//   model         which shape to draw (see buildWeaponModel below)

import * as THREE from 'three';

export const WEAPONS = {
  dagger: {
    name: 'Iron Dagger',
    damage: 7,
    reach: 1.8,
    arc: 70,
    windup: 0.06,
    strike: 0.08,
    recover: 0.15,
    staminaCost: 0,
    hitStagger: 0,
    moveSpeed: 1.08,
    powerChargeTime: 0.5,
    powerMinMultiplier: 1.6,
    powerMaxMultiplier: 2.8,
    powerStaminaCost: 15,
    powerStagger: 0.5,
    blockReduction: 0.35,
    blockStaminaPerDamage: 1.5,
    swingWeight: 0.1,
    model: 'dagger',
  },
  sword: {
    name: 'Iron Sword',
    damage: 15,
    reach: 2.3,
    arc: 100,
    windup: 0.12,
    strike: 0.12,
    recover: 0.26,
    staminaCost: 0,
    hitStagger: 0,
    moveSpeed: 1,
    powerChargeTime: 0.8,
    powerMinMultiplier: 1.5,
    powerMaxMultiplier: 2.5,
    powerStaminaCost: 25,
    powerStagger: 0.8,
    blockReduction: 0.6,
    blockStaminaPerDamage: 1.2,
    swingWeight: 0.35,
    model: 'sword',
  },
  axe: {
    name: 'Iron War Axe',
    damage: 26,
    reach: 2.4,
    arc: 115,
    windup: 0.22,
    strike: 0.15,
    recover: 0.42,
    staminaCost: 0,
    hitStagger: 0,
    moveSpeed: 0.95,
    powerChargeTime: 1.0,
    powerMinMultiplier: 1.5,
    powerMaxMultiplier: 2.6,
    powerStaminaCost: 30,
    powerStagger: 0.9,
    blockReduction: 0.5,
    blockStaminaPerDamage: 1.3,
    swingWeight: 0.8,
    model: 'axe',
  },
  mace: {
    name: 'Iron Mace',
    damage: 22,
    reach: 2.1,
    arc: 90,
    windup: 0.3,
    strike: 0.16,
    recover: 0.46,
    staminaCost: 0,
    hitStagger: 0.45,
    moveSpeed: 0.92,
    powerChargeTime: 1.1,
    powerMinMultiplier: 1.5,
    powerMaxMultiplier: 2.5,
    powerStaminaCost: 30,
    powerStagger: 1.3,
    blockReduction: 0.55,
    blockStaminaPerDamage: 1.3,
    swingWeight: 1.0,
    model: 'mace',
  },
};

// Which number key picks which weapon
export const WEAPON_KEYS = ['dagger', 'sword', 'axe', 'mace'];

// ---------- Weapon models (low-poly placeholder shapes) ----------
// The handle is at (0, 0, 0) and the weapon points up the Y axis.
const iron = new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.35, roughness: 0.35, flatShading: true });
const darkIron = new THREE.MeshStandardMaterial({ color: 0x6a6d73, metalness: 0.3, roughness: 0.5, flatShading: true });
const leather = new THREE.MeshStandardMaterial({ color: 0x4a2f1c, roughness: 0.9, flatShading: true });
const wood = new THREE.MeshStandardMaterial({ color: 0x6b4527, roughness: 0.85, flatShading: true });

function part(geometry, material, x, y, z) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  return mesh;
}

// A flat blade with a pointed tip (used by the sword and the dagger)
function blade(group, length, width, startY) {
  group.add(part(new THREE.BoxGeometry(width, length, 0.015), iron, 0, startY + length / 2, 0));
  const tip = part(new THREE.ConeGeometry(width * 0.72, width * 2, 4), iron, 0, startY + length + width, 0);
  tip.scale.z = 0.3;
  tip.rotation.y = Math.PI / 4;
  group.add(tip);
}

export function buildWeaponModel(weapon) {
  const group = new THREE.Group();

  if (weapon.model === 'sword') {
    blade(group, 0.75, 0.07, 0.125);
    group.add(part(new THREE.BoxGeometry(0.24, 0.04, 0.05), darkIron, 0, 0.11, 0));          // crossguard
    group.add(part(new THREE.CylinderGeometry(0.022, 0.025, 0.18, 6), leather, 0, 0, 0));     // grip
    group.add(part(new THREE.IcosahedronGeometry(0.035, 0), darkIron, 0, -0.1, 0));           // pommel
  }

  if (weapon.model === 'dagger') {
    blade(group, 0.3, 0.055, 0.09);
    group.add(part(new THREE.BoxGeometry(0.14, 0.03, 0.04), darkIron, 0, 0.08, 0));          // small guard
    group.add(part(new THREE.CylinderGeometry(0.02, 0.022, 0.13, 6), leather, 0, 0, 0));      // grip
    group.add(part(new THREE.IcosahedronGeometry(0.028, 0), darkIron, 0, -0.075, 0));         // pommel
  }

  if (weapon.model === 'axe') {
    group.add(part(new THREE.CylinderGeometry(0.025, 0.03, 0.95, 6), wood, 0, 0.3, 0));       // long handle
    group.add(part(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 6), leather, 0, 0, 0));       // grip wrap
    // Axe head: a flat blade that flares out to a wide cutting edge
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.045);       // where it meets the handle
    shape.lineTo(-0.15, -0.11);    // bottom of the edge (the "beard")
    shape.quadraticCurveTo(-0.21, 0.0, -0.15, 0.1); // curved cutting edge
    shape.lineTo(0, 0.045);
    shape.lineTo(0, -0.045);
    const headGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: false, curveSegments: 4 });
    headGeo.translate(0, 0, -0.0125);
    group.add(part(headGeo, iron, -0.02, 0.72, 0));
    group.add(part(new THREE.BoxGeometry(0.07, 0.1, 0.05), darkIron, 0.01, 0.72, 0));        // socket around the handle
  }

  if (weapon.model === 'mace') {
    group.add(part(new THREE.CylinderGeometry(0.024, 0.028, 0.6, 6), wood, 0, 0.2, 0));       // handle
    group.add(part(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 6), leather, 0, 0, 0));       // grip wrap
    group.add(part(new THREE.IcosahedronGeometry(0.03, 0), darkIron, 0, -0.1, 0));            // pommel
    // Heavy head with flanges (metal fins) around it
    group.add(part(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 6), darkIron, 0, 0.56, 0));
    for (let i = 0; i < 6; i++) {
      const flange = part(new THREE.BoxGeometry(0.03, 0.17, 0.09), iron, 0, 0.56, 0);
      flange.rotation.y = (i / 6) * Math.PI * 2;
      flange.translateZ(0.05);
      group.add(flange);
    }
    group.add(part(new THREE.ConeGeometry(0.04, 0.07, 6), darkIron, 0, 0.675, 0));            // top spike
  }

  return group;
}
