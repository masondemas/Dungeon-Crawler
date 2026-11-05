// =============================================================
//  Effects: blood spurts (and other little particle bursts)
// =============================================================
// Performance: every droplet in the game is one copy of the same tiny shape,
// all drawn together in a single "InstancedMesh". There's a fixed pool of droplets
// that gets reused, so nothing new is created during a fight.
import * as THREE from 'three';

const GRAVITY = 9.8;

export function createBloodSystem(scene, maxParticles = 400) {
  const mesh = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.05, 0), // a small low-poly blob
    new THREE.MeshBasicMaterial({ color: 0xffffff }), // colour comes from each droplet
    maxParticles
  );
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false; // droplets move around a lot; always draw them
  // Give every droplet a colour slot now (the graphics card needs to know about colours from the start)
  for (let i = 0; i < maxParticles; i++) mesh.setColorAt(i, new THREE.Color(0xffffff));
  mesh.count = 0;
  scene.add(mesh);

  // One entry per droplet in the pool
  const particles = [];
  for (let i = 0; i < maxParticles; i++) {
    particles.push({
      alive: false,
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      age: 0,
      life: 1,
      size: 1,
      onFloor: false,
      colour: new THREE.Color(),
    });
  }
  let next = 0; // where in the pool the next droplet goes (oldest get reused first)

  const dummy = new THREE.Object3D();
  const tmpColour = new THREE.Color();

  // Spray droplets from a point.
  //   point      where the hit landed
  //   direction  which way the blade was travelling (droplets mostly fly this way)
  //   away       direction pointing away from the player (adds a bit of "out of the wound")
  //   count      how many droplets
  //   colour     their colour (a hex number like 0x7a0c0c)
  //   force      1 = normal, more = faster and further
  function spurt({ point, direction, away, count, colour, force = 1 }) {
    const base = new THREE.Color(colour);
    for (let i = 0; i < count; i++) {
      const p = particles[next];
      next = (next + 1) % maxParticles;

      p.alive = true;
      p.onFloor = false;
      p.age = 0;
      p.life = 0.45 + Math.random() * 0.5;
      p.size = 0.6 + Math.random() * 0.9;
      p.position.copy(point).add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1
      ));

      // Mostly along the blade's path, some out of the wound, a bit upwards, plus randomness
      const speed = (1.5 + Math.random() * 3) * force;
      p.velocity.copy(direction).multiplyScalar(1)
        .addScaledVector(away, 0.45)
        .add(new THREE.Vector3((Math.random() - 0.5) * 0.9, Math.random() * 0.8 + 0.2, (Math.random() - 0.5) * 0.9))
        .normalize()
        .multiplyScalar(speed);

      // Slightly different shade for each droplet so it doesn't look flat
      p.colour.copy(base).multiplyScalar(0.7 + Math.random() * 0.5);
    }
  }

  function update(dt) {
    let count = 0;
    for (const p of particles) {
      if (!p.alive) continue;
      p.age += dt;
      if (p.age >= p.life) { p.alive = false; continue; }

      if (!p.onFloor) {
        p.velocity.y -= GRAVITY * dt;
        p.velocity.multiplyScalar(1 - dt * 1.5); // air slows it down a little
        p.position.addScaledVector(p.velocity, dt);
        if (p.position.y <= 0.01) {
          // Hit the floor: stop and flatten into a little splat
          p.position.y = 0.01;
          p.onFloor = true;
          p.life = Math.max(p.life, p.age + 0.6); // splats linger a moment longer
        }
      }

      // Shrink away towards the end of its life (that's the "fade")
      const remaining = 1 - p.age / p.life;
      const s = p.size * Math.min(1, remaining * 2.5);
      dummy.position.copy(p.position);
      if (p.onFloor) dummy.scale.set(s * 1.8, s * 0.25, s * 1.8); // flat splat
      else dummy.scale.set(s, s * 1.3, s);                        // slightly stretched while flying
      dummy.updateMatrix();
      mesh.setMatrixAt(count, dummy.matrix);
      mesh.setColorAt(count, tmpColour.copy(p.colour));
      count++;
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  return { spurt, update };
}
