// =============================================================
//  Shields and armor: stats (data) and shield models
// =============================================================
import * as THREE from 'three';

// ---------- Shields ----------
// When you block with a shield, these numbers replace the weapon's block numbers.
//
//   blockReduction        how much of a hit's damage blocking stops (0.75 = 75%)
//   blockStaminaPerDamage stamina used for each point of damage you block
//   blockArc              how wide an angle in front of you the shield covers (degrees)
//   moveSpeed             walking speed multiplier while carrying it
//   model                 which shape to draw
export const SHIELDS = {
  wooden: {
    name: 'Wooden Shield',
    blockReduction: 0.75,
    blockStaminaPerDamage: 0.9,
    blockArc: 150,
    moveSpeed: 1,
    model: 'round',
  },
  iron: {
    name: 'Iron Shield',
    blockReduction: 0.85,
    blockStaminaPerDamage: 0.7,
    blockArc: 160,
    moveSpeed: 0.96,
    model: 'heater',
  },
};
// The order Q cycles through (null = no shield)
export const SHIELD_KEYS = [null, 'wooden', 'iron'];

// ---------- Armor ----------
//   damageReduction  how much less damage you take from every hit (0.2 = 20% less)
//   moveSpeed        walking speed multiplier while wearing it
export const ARMOR = {
  none:      { name: 'No Armor',  damageReduction: 0,    moveSpeed: 1 },
  leather:   { name: 'Leather Armor', damageReduction: 0.2,  moveSpeed: 1 },
  chainmail: { name: 'Chainmail', damageReduction: 0.35, moveSpeed: 0.96 },
  plate:     { name: 'Plate Armor', damageReduction: 0.5, moveSpeed: 0.88 },
};
// The order X cycles through
export const ARMOR_KEYS = ['none', 'leather', 'chainmail', 'plate'];

// ---------- Shield models (low-poly placeholder shapes) ----------
// The shield faces the camera (+Z) with its centre at (0, 0, 0).
const wood = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.9, flatShading: true });
const darkWood = new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.9, flatShading: true });
const iron = new THREE.MeshStandardMaterial({ color: 0x9a9fa8, metalness: 0.4, roughness: 0.45, flatShading: true });
const darkIron = new THREE.MeshStandardMaterial({ color: 0x5e6167, metalness: 0.3, roughness: 0.5, flatShading: true });

export function buildShieldModel(shield) {
  const group = new THREE.Group();

  if (shield.model === 'round') {
    // A round shield made of wooden planks with an iron rim and a centre boss
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.035, 12), wood);
    disc.rotation.x = Math.PI / 2;
    group.add(disc);
    for (const x of [-0.15, 0, 0.15]) {           // plank lines
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.55, 0.01), darkWood);
      line.position.set(x, 0, 0.02);
      group.add(line);
    }
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.018, 4, 12), darkIron);
    group.add(rim);
    const boss = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), darkIron);
    boss.rotation.x = Math.PI / 2;
    boss.position.z = 0.015;
    group.add(boss);
  }

  if (shield.model === 'heater') {
    // A pointed iron shield (wide at the top, pointed at the bottom)
    const shape = new THREE.Shape();
    shape.moveTo(-0.26, 0.3);
    shape.lineTo(0.26, 0.3);
    shape.lineTo(0.26, 0.02);
    shape.quadraticCurveTo(0.22, -0.28, 0, -0.42);
    shape.quadraticCurveTo(-0.22, -0.28, -0.26, 0.02);
    shape.lineTo(-0.26, 0.3);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.015, bevelSegments: 1, curveSegments: 5 });
    geo.translate(0, 0.04, -0.0175);
    group.add(new THREE.Mesh(geo, iron));
    // A raised cross down the middle for decoration
    const bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 0.02), darkIron);
    bar1.position.set(0, -0.02, 0.03);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.02), darkIron);
    bar2.position.set(0, 0.16, 0.03);
    group.add(bar1, bar2);
  }

  return group;
}
