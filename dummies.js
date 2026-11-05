// =============================================================
//  Training dummies: straw targets to practise hitting
// =============================================================
// They can't be destroyed. When hit they wobble and flash red.
// Anything the player can hit is a "target" with:
//   position (where it is), radius (how wide it is), onHit(damage, direction)

import * as THREE from 'three';

const wood = new THREE.MeshStandardMaterial({ color: 0x5a3d24, roughness: 0.9, flatShading: true });
const strawColour = 0xc9a75a;

export function createDummy(scene, x, z) {
  // Each dummy gets its own straw material so it can flash red on its own
  const straw = new THREE.MeshStandardMaterial({ color: strawColour, roughness: 1, flatShading: true });

  // "pivot" sits at the base; tilting it makes the whole dummy wobble
  const pivot = new THREE.Group();
  pivot.position.set(x, 0, z);

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.9, 6), wood);
  post.position.y = 0.95;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.75, 7), straw);
  body.position.y = 1.15;
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), straw);
  head.position.y = 1.75;
  const arms = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.1), wood);
  arms.position.y = 1.4;
  pivot.add(post, body, head, arms);

  // A flat base so it doesn't look like it's floating
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.12, 6), wood);
  base.position.set(x, 0.06, z);

  scene.add(pivot, base);

  const dummy = {
    position: new THREE.Vector3(x, 1.2, z),
    radius: 0.35,
    bloodColour: 0xc9a75a, // straw flies out instead of blood
    woundColour: 0x4a3418, // torn, dark straw
    hitSound: 'hitStraw',
    woundRoot: pivot,
    height: 1.9,
    wobble: new THREE.Vector2(0, 0),      // current lean (x = lean along X, y = lean along Z)
    wobbleSpeed: new THREE.Vector2(0, 0),
    flash: 0,

    onHit(damage, direction) {
      // Get knocked back in the direction of the swing (harder hits wobble more)
      this.wobbleSpeed.x += direction.x * 3;
      this.wobbleSpeed.y += direction.z * 3;
      this.flash = 1;
    },

    update(dt) {
      // A spring pulls the dummy back upright; damping makes the wobble die down
      const stiffness = 60;
      const damping = 6;
      this.wobbleSpeed.x += (-this.wobble.x * stiffness - this.wobbleSpeed.x * damping) * dt;
      this.wobbleSpeed.y += (-this.wobble.y * stiffness - this.wobbleSpeed.y * damping) * dt;
      this.wobble.x += this.wobbleSpeed.x * dt;
      this.wobble.y += this.wobbleSpeed.y * dt;
      pivot.rotation.z = -this.wobble.x;
      pivot.rotation.x = this.wobble.y;

      // Red flash fades out
      this.flash = Math.max(0, this.flash - dt * 4);
      straw.emissive.setRGB(this.flash * 0.8, 0, 0);
    },
  };
  return dummy;
}
