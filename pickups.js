// =============================================================
//  Pickups: things lying in the dungeon that you collect by walking over them
// =============================================================
// For now: healing potions (map letter H). Later: weapons, shields, armor...
import * as THREE from 'three';

// ---------- Potion bottle model (used on the floor and in your hand) ----------
export function buildPotionModel() {
  const group = new THREE.Group();
  const glass = new THREE.MeshStandardMaterial({
    color: 0xdde8ee, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.35, flatShading: true,
  });
  const liquid = new THREE.MeshStandardMaterial({
    color: 0xc41e2a, emissive: 0x7a0610, emissiveIntensity: 0.9, roughness: 0.4, flatShading: true,
  });
  const cork = new THREE.MeshStandardMaterial({ color: 0x9a7650, roughness: 1, flatShading: true });

  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.085, 1), glass);
  body.position.y = 0.085;
  const fill = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 1), liquid);
  fill.position.y = 0.08;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.07, 6), glass);
  neck.position.y = 0.19;
  const stopper = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.035, 6), cork);
  stopper.position.y = 0.24;
  group.add(fill, body, neck, stopper);
  return group;
}

// ---------- A potion lying on the floor ----------
// kind = what it gives you when picked up ('potion')
export function createPickup(scene, kind, x, z) {
  const model = buildPotionModel();
  model.scale.setScalar(1.6);
  model.position.set(x, 0.35, z);
  scene.add(model);

  // A faint red glow on the floor under it, so it's easy to spot in the dark
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(0.4, 12),
    new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.25, depthWrite: false })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(x, 0.01, z);
  scene.add(glow);

  let time = Math.random() * 10;
  return {
    kind,
    position: model.position,
    collected: false,

    update(dt) {
      time += dt;
      model.rotation.y += dt * 1.5;                       // slowly spin
      model.position.y = 0.35 + Math.sin(time * 2.5) * 0.06; // and bob up and down
      glow.material.opacity = 0.2 + Math.sin(time * 2.5) * 0.06;
    },

    collect() {
      this.collected = true;
      scene.remove(model, glow);
    },
  };
}
