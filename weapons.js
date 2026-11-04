// =============================================================
//  Weapons: all weapon stats live here as data
// =============================================================
// Every weapon uses the same combat code. Only these numbers differ.
// (Daggers, axes and maces get added here in a later step.)
//
//   damage        how much health one light attack takes off
//   reach         how far it hits, in metres (measured from the player)
//   arc           how wide the swing is, in degrees (90 = a quarter circle in front of you)
//   windup        seconds pulling the weapon back before the swing
//   strike        seconds of the actual swing (this is when it can hit things)
//   recover       seconds returning to the ready pose (you can queue the next attack here)
//   staminaCost   stamina used per light attack (0 = free, like Skyrim)
//   model         which shape to draw (see buildWeaponModel below)

import * as THREE from 'three';

export const WEAPONS = {
  sword: {
    name: 'Iron Sword',
    damage: 15,
    reach: 2.3,
    arc: 100,
    windup: 0.12,
    strike: 0.12,
    recover: 0.26,
    staminaCost: 0,
    model: 'sword',
  },
};

// ---------- Weapon models (low-poly placeholder shapes) ----------
// The handle is at (0, 0, 0) and the weapon points up the Y axis.
const iron = new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.35, roughness: 0.35, flatShading: true });
const darkIron = new THREE.MeshStandardMaterial({ color: 0x6a6d73, metalness: 0.3, roughness: 0.5, flatShading: true });
const leather = new THREE.MeshStandardMaterial({ color: 0x4a2f1c, roughness: 0.9, flatShading: true });

function part(geometry, material, x, y, z) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  return mesh;
}

export function buildWeaponModel(weapon) {
  const group = new THREE.Group();

  if (weapon.model === 'sword') {
    // Blade: a flat box with a pointed tip
    group.add(part(new THREE.BoxGeometry(0.07, 0.75, 0.015), iron, 0, 0.5, 0));
    const tip = part(new THREE.ConeGeometry(0.05, 0.14, 4), iron, 0, 0.945, 0);
    tip.scale.z = 0.3;
    tip.rotation.y = Math.PI / 4;
    group.add(tip);
    group.add(part(new THREE.BoxGeometry(0.24, 0.04, 0.05), darkIron, 0, 0.11, 0));          // crossguard
    group.add(part(new THREE.CylinderGeometry(0.022, 0.025, 0.18, 6), leather, 0, 0, 0));     // grip
    group.add(part(new THREE.IcosahedronGeometry(0.035, 0), darkIron, 0, -0.1, 0));           // pommel
  }

  return group;
}
