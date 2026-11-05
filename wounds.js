// =============================================================
//  Wounds: cuts and scratches that build up on enemies where they were hit
// =============================================================
// How it works:
//   1. game.js finds the exact spot on the enemy's 3D model the blade struck
//      (findHitSurface below: a ray from the player into the model).
//   2. addWound() lays a small flat "cut" picture on that spot, turned to line up
//      with the swing, and ATTACHES it to the part of the model that was hit.
//      So when that part moves (an arm swinging, the body falling over), the cut
//      moves with it. When the enemy is removed, its cuts go with it.
//   3. setBloodied() slowly darkens the whole body as its health drops.
//
// None of this knows what the model looks like. It works with the placeholder
// box models AND with real 3D models later. For a real model, the enemy just needs:
//   woundRoot    the model (any THREE.Object3D: a loaded glTF scene works)
//   woundColour  the colour of its cuts
// If the model is an animated "skinned" mesh (with bones), each cut is attached
// to the nearest bone so it follows the animation.
// Anything that shouldn't get cuts (like a floating health bar) can be marked
// with  object.userData.noWounds = true.

import * as THREE from 'three';

const MAX_WOUNDS_PER_TARGET = 30; // after this, the oldest cut is reused

// ---------- Cut pictures (drawn by code) ----------
// White-ish edges with a black centre, so tinting them with a colour gives
// "coloured cut with a dark gash in the middle".
function makeCutTexture(seed) {
  const w = 128, h = 48;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  let r = seed * 9301 + 49297;
  const rand = () => ((r = (r * 9301 + 49297) % 233280) / 233280);

  // The cut: a long, thin, tapered, slightly wavy shape
  const bend = (rand() - 0.5) * 14;
  const thick = 7 + rand() * 6;
  const drawCut = (scale, colour) => {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(6, h / 2);
    ctx.quadraticCurveTo(w / 2, h / 2 - thick * scale + bend, w - 6, h / 2 + (rand() - 0.5) * 4);
    ctx.quadraticCurveTo(w / 2, h / 2 + thick * scale + bend, 6, h / 2);
    ctx.fill();
  };
  drawCut(1.0, 'rgba(255, 255, 255, 0.85)'); // bruised edge (takes the wound colour)
  drawCut(0.45, 'rgba(0, 0, 0, 1)');          // deep dark centre

  // A few little nicks and drips around it
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + rand() * 0.4})`;
    const x = 20 + rand() * (w - 40);
    const y = h / 2 + (rand() - 0.3) * thick * 2.2;
    ctx.fillRect(x, y, 2 + rand() * 3, 2 + rand() * 6);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
const CUT_TEXTURES = [0, 1, 2, 3].map(makeCutTexture);

// One material per (picture, colour) pair, shared by every cut that uses it
const materialCache = new Map();
function cutMaterial(variant, colour) {
  const key = `${variant}-${colour}`;
  if (!materialCache.has(key)) {
    materialCache.set(key, new THREE.MeshLambertMaterial({
      map: CUT_TEXTURES[variant],
      color: colour,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,       // draw on top of the surface without flickering
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    }));
  }
  return materialCache.get(key);
}
const cutGeometry = new THREE.PlaneGeometry(1, 0.38);

// ---------- Finding where the blade hit ----------
const raycaster = new THREE.Raycaster();

function isWoundable(object) {
  for (let o = object; o; o = o.parent) if (o.userData.noWounds) return false;
  return object.isMesh && object.visible;
}

// Shoots a ray from the player into the target's model and returns
// { point, normal, object } for the first surface it hits, or null.
export function findHitSurface(target, fromPosition, aimPoint) {
  if (!target.woundRoot) return null;
  // Try aiming at the expected hit point first, then straight at the target's middle
  for (const aim of [aimPoint, target.position]) {
    const dir = aim.clone().sub(fromPosition);
    const dist = dir.length();
    raycaster.set(fromPosition, dir.normalize());
    raycaster.far = dist + 3;
    const hit = raycaster.intersectObject(target.woundRoot, true).find((h) => isWoundable(h.object) && h.face);
    if (hit) {
      const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      return { point: hit.point, normal, object: hit.object };
    }
  }
  return null;
}

// ---------- Adding a cut ----------
// For animated (skinned) models: the bone nearest to the hit, so the cut follows the animation
function attachPointFor(object, point) {
  if (!object.isSkinnedMesh || !object.skeleton) return object;
  let best = object;
  let bestDist = Infinity;
  const bonePos = new THREE.Vector3();
  for (const bone of object.skeleton.bones) {
    bone.getWorldPosition(bonePos);
    const d = bonePos.distanceToSquared(point);
    if (d < bestDist) { bestDist = d; best = bone; }
  }
  return best;
}

const basis = new THREE.Matrix4();
const xAxis = new THREE.Vector3();
const yAxis = new THREE.Vector3();

// surface = result of findHitSurface; sweep = direction the blade travelled; size in metres
export function addWound(target, surface, sweep, size) {
  const { point, normal, object } = surface;

  // Line the cut up with the blade's path, flattened onto the surface
  xAxis.copy(sweep).addScaledVector(normal, -sweep.dot(normal));
  if (xAxis.lengthSq() < 1e-4) xAxis.set(1, 0, 0).addScaledVector(normal, -normal.x); // blade hit straight on
  xAxis.normalize();
  // A little random twist so cuts don't all look identical
  xAxis.applyAxisAngle(normal, (Math.random() - 0.5) * 0.5);
  yAxis.crossVectors(normal, xAxis).normalize();
  basis.makeBasis(xAxis, yAxis, normal);

  const variant = Math.floor(Math.random() * CUT_TEXTURES.length);
  const cut = new THREE.Mesh(cutGeometry, cutMaterial(variant, target.woundColour ?? 0x8a1010));
  cut.userData.noWounds = true; // cuts themselves never get cut
  cut.position.copy(point).addScaledVector(normal, 0.004);
  cut.quaternion.setFromRotationMatrix(basis);
  cut.scale.set(size, size * (0.8 + Math.random() * 0.5), 1);
  cut.renderOrder = 1;

  // Put it in the world at the right spot, then hand it to the body part
  // (attach() keeps it exactly where it is while changing its parent)
  const parent = attachPointFor(object, point);
  parent.updateMatrixWorld(true);
  object.parent && object.parent.updateMatrixWorld(true);
  const world = target.woundRoot.parent;
  world.add(cut);
  cut.updateMatrixWorld(true);
  parent.attach(cut);

  // Keep a list per target; reuse the oldest cut when there are too many
  target.wounds = target.wounds || [];
  target.wounds.push(cut);
  if (target.wounds.length > MAX_WOUNDS_PER_TARGET) {
    const old = target.wounds.shift();
    old.parent && old.parent.remove(old);
  }
}

// ---------- Getting bloodier overall ----------
// hurt = 0 (unharmed) to 1 (nearly dead). Slowly blends the body's colours towards
// the wound colour. Each enemy must have its own materials for this (ours do; for
// real models, clone the materials when loading each enemy).
export function setBloodied(target, hurt) {
  if (!target.woundRoot) return;
  const stain = new THREE.Color(target.woundColour ?? 0x8a1010).multiplyScalar(0.55);
  target.woundRoot.traverse((o) => {
    if (!o.isMesh || o.userData.noWounds) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m.color || m.isMeshBasicMaterial) continue; // leave glowing eyes etc. alone
      if (!m.userData.baseColour) m.userData.baseColour = m.color.clone();
      m.color.copy(m.userData.baseColour).lerp(stain, Math.min(hurt, 1) * 0.45);
    }
  });
}
