"use strict";
// ---------------------------------------------------------------------------
// Things that move on their own. None of it is a target, none of it is solid,
// none of it can be reached: it exists so the world is not holding its breath
// waiting for him.
//
// The birds are the one living thing out here, and they follow the same rule as
// the astronaut: they are fine because NOTHING CAN HAPPEN TO THEM. They are not
// registered as targets, never added to any solid list, carry noSolid/noShatter,
// and are kept a long way off. He flies straight through a flock and it scatters
// -- politely, and unharmed. If you ever make them hittable, they have to become
// paper planes, the way the old ones did.
// ---------------------------------------------------------------------------

const AMB = TUNE.ambient;

// NAMING. These files share one global scope, and a later function declaration
// silently replaces an earlier one of the same name. `placeFlock` here was
// quietly overwritten by the paper-plane target placer in landmarks.js, which
// then mutated every bird flock into a half-target that could never be placed.
// Everything below is prefixed for that reason. The harness now guards it.
// ---- birds ----------------------------------------------------------------
// One instanced mesh for the lot: forty birds is one draw call.
const birdGeo = (() => {
  // a shallow V, two triangles, pointing -z
  const g = new THREE.BufferGeometry();
  const v = new Float32Array([
    0, 0, -0.9,   -1.6, 0.35, 0.7,   -0.35, 0, 0.25,
    0, 0, -0.9,    0.35, 0, 0.25,     1.6, 0.35, 0.7,
  ]);
  g.setAttribute("position", new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
})();
const birdMesh = new THREE.InstancedMesh(
  birdGeo,
  new THREE.MeshLambertMaterial({ color: AMB.birdColor, side: THREE.DoubleSide }),
  AMB.birdCount
);
birdMesh.frustumCulled = false;
birdMesh.userData.noSolid = true;      // belt and braces: never a wall, never shatters
birdMesh.userData.noShatter = true;
birdMesh.visible = false;
scene.add(birdMesh);

const birds = [];
for (let i = 0; i < AMB.birdCount; i++) {
  birds.push({ flock: Math.floor(i / AMB.birdsPerFlock), i: i % AMB.birdsPerFlock,
               phase: Math.random() * Math.PI * 2, flapRate: 5 + Math.random() * 3 });
}
const flocks = [];
for (let f = 0; f < Math.ceil(AMB.birdCount / AMB.birdsPerFlock); f++) {
  flocks.push({ x: 0, y: 0, z: 0, heading: 0, speed: 0, scatter: 0, placed: false });
}

function placeBirdFlock(fl, px, pz) {
  // Coast and lake first -- that is where they belong -- but never REFUSE to
  // place. Insisting on water meant that anywhere inland the flocks quietly
  // switched themselves off and stayed off, which is worse than a bird over a
  // field.
  let best = null;
  // Mostly ahead of him. Spread uniformly round the compass, five flocks in six
  // are behind his shoulder and he never sees a bird at all.
  // x = cos(a), z = sin(a) below, so this has to be atan2(fz, fx) -- with the
  // arguments the other way round the whole flock spawns mirrored about the
  // diagonal and he never catches one in frame.
  const fwd = Math.atan2(-Math.cos(state.heading), -Math.sin(state.heading));
  for (let tries = 0; tries < 10; tries++) {
    const a = fwd + (Math.random() - 0.5) * 2 * AMB.spawnArc;
    const d = AMB.spawn[0] + Math.random() * (AMB.spawn[1] - AMB.spawn[0]);
    const x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d;
    const g = terrainEff(x, z);
    const overWater = g <= TUNE.waterLevel + 6;
    if (!best || overWater) best = { x, z, g, overWater };
    if (overWater) break;
  }
  const ground = Math.max(best.g, TUNE.waterLevel);
  fl.x = best.x; fl.z = best.z;
  fl.y = ground + AMB.alt[0] + Math.random() * (AMB.alt[1] - AMB.alt[0]);
  fl.heading = Math.random() * Math.PI * 2;
  fl.speed = AMB.speed[0] + Math.random() * (AMB.speed[1] - AMB.speed[0]);
  fl.scatter = 0;
  fl.placed = true;
}

const ambDummy = new THREE.Object3D();
let ambClock = 0;

function updateBirds(dt, px, py, pz) {
  const far = state.spaceF > 0.4 || (typeof rk !== "undefined" && rk && rk.onBody);
  birdMesh.visible = !far;
  if (far) return;
  let n = 0;
  for (const fl of flocks) {
    if (!fl.placed) { placeBirdFlock(fl, px, pz); if (!fl.placed) continue; }
    const dx = fl.x - px, dz = fl.z - pz;
    const d2 = dx * dx + dz * dz;
    if (d2 > AMB.despawn * AMB.despawn) { placeBirdFlock(fl, px, pz); continue; }
    // he is close: they peel away. Nothing touches them and nothing can.
    if (d2 < AMB.scareRadius * AMB.scareRadius) {
      fl.scatter = Math.min(1, fl.scatter + dt * 2);
      const away = Math.atan2(-dx, -dz);
      fl.heading += wrapPi(away + Math.PI - fl.heading) * Math.min(1, 2.2 * dt);
    } else {
      fl.scatter = Math.max(0, fl.scatter - dt * 0.7);
      fl.heading += Math.sin(ambClock * 0.3 + fl.x * 0.01) * 0.25 * dt;
    }
    const sp = fl.speed * (1 + fl.scatter * 0.8);
    fl.x += -Math.sin(fl.heading) * sp * dt;
    fl.z += -Math.cos(fl.heading) * sp * dt;
    fl.y += Math.sin(ambClock * 0.5 + fl.heading) * 2 * dt + fl.scatter * 6 * dt;
    const gnd = Math.max(terrainEff(fl.x, fl.z), TUNE.waterLevel);
    fl.y = clamp(fl.y, gnd + AMB.alt[0] * 0.6, gnd + AMB.alt[1] * 1.6);
  }
  for (const b of birds) {
    const fl = flocks[b.flock];
    if (!fl || !fl.placed) { ambDummy.position.set(0, -9999, 0); ambDummy.updateMatrix(); birdMesh.setMatrixAt(n++, ambDummy.matrix); continue; }
    // a loose V behind the leader, widened when they scatter
    const row = Math.floor((b.i + 1) / 2), side = (b.i % 2) ? 1 : -1;
    const spread = AMB.spread * (1 + fl.scatter * 1.8);
    const fx = -Math.sin(fl.heading), fz = -Math.cos(fl.heading);
    const rx = -fz, rz = fx;
    ambDummy.position.set(
      fl.x - fx * row * spread + rx * side * row * spread * 0.8,
      fl.y + Math.sin(ambClock * b.flapRate + b.phase) * 0.6 + row * 0.4,
      fl.z - fz * row * spread + rz * side * row * spread * 0.8
    );
    ambDummy.rotation.set(0, fl.heading, Math.sin(ambClock * b.flapRate + b.phase) * 0.5);
    ambDummy.scale.setScalar(AMB.birdSize);
    ambDummy.updateMatrix();
    birdMesh.setMatrixAt(n++, ambDummy.matrix);
  }
  birdMesh.count = n;
  birdMesh.instanceMatrix.needsUpdate = true;
}

// ---- high traffic: airliners at cruise, with contrails --------------------
const highJets = [];
{
  const body = new THREE.CylinderGeometry(1.6, 1.6, 26, 8);
  body.rotateX(Math.PI / 2);
  for (let i = 0; i < AMB.highJets; i++) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(body, new THREE.MeshLambertMaterial({ color: TUNE.palette.white }));
    g.add(m);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(30, 0.7, 5), new THREE.MeshLambertMaterial({ color: TUNE.palette.steel }));
    g.add(wing);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 6, 5), new THREE.MeshLambertMaterial({ color: TUNE.palette.steel }));
    tail.position.set(0, 3, 11); g.add(tail);
    // the contrail: one long quad that grows behind it and fades
    const trail = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: true, side: THREE.DoubleSide })
    );
    scene.add(trail);
    g.userData.noSolid = true;
    g.visible = false;
    scene.add(g);
    highJets.push({ g, trail, x: 0, y: 0, z: 0, heading: 0, speed: 0, age: 0, placed: false });
  }
}

function placeHighJet(j, px, pz) {
  const a = Math.random() * Math.PI * 2;
  const d = AMB.highSpawn[0] + Math.random() * (AMB.highSpawn[1] - AMB.highSpawn[0]);
  j.x = px + Math.cos(a) * d;
  j.z = pz + Math.sin(a) * d;
  j.y = AMB.highAlt[0] + Math.random() * (AMB.highAlt[1] - AMB.highAlt[0]);
  j.heading = Math.random() * Math.PI * 2;
  j.speed = AMB.highSpeed;
  j.age = 0;
  j.placed = true;
}

function updateHighJets(dt, px, py, pz) {
  const off = state.spaceF > 0.4 || (typeof rk !== "undefined" && rk && rk.onBody);
  for (const j of highJets) {
    if (off) { j.g.visible = false; j.trail.visible = false; continue; }
    if (!j.placed) { placeHighJet(j, px, pz); }
    const dx = j.x - px, dz = j.z - pz;
    if (dx * dx + dz * dz > AMB.highDespawn * AMB.highDespawn) { placeHighJet(j, px, pz); continue; }
    j.age += dt;
    const fx = -Math.sin(j.heading), fz = -Math.cos(j.heading);
    j.x += fx * j.speed * dt;
    j.z += fz * j.speed * dt;
    j.g.visible = true;
    j.g.position.set(j.x, j.y, j.z);
    j.g.rotation.y = j.heading;
    // the trail sits behind it, growing to its full length and holding
    const len = Math.min(AMB.trailLength, j.age * j.speed);
    j.trail.visible = len > 20;
    if (j.trail.visible) {
      j.trail.position.set(j.x - fx * len / 2, j.y - 1.5, j.z - fz * len / 2);
      j.trail.rotation.set(-Math.PI / 2, 0, -j.heading);
      j.trail.scale.set(AMB.trailWidth, len, 1);
      j.trail.material.opacity = AMB.trailOpacity * clamp(1 - state.rainF, 0.2, 1);
    }
  }
}

// ---- flags: the wind has to be visible somewhere ---------------------------
function makeFlag(w, h, color) {
  const geo = new THREE.PlaneGeometry(w, h, 8, 1);
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
  m.userData.base = geo.attributes.position.array.slice();
  m.userData.noSolid = true;
  return m;
}
const ambFlags = [];
function registerFlag(m) { ambFlags.push(m); return m; }
function updateFlags(dt) {
  for (const m of ambFlags) {
    if (!m.visible || !m.parent) continue;
    const pos = m.geometry.attributes.position;
    const base = m.userData.base;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3];
      const k = (x + m.geometry.parameters.width / 2) / m.geometry.parameters.width;  // 0 at the pole
      pos.setZ(i, Math.sin(ambClock * AMB.flagRate + k * 6) * AMB.flagWave * k * k);
      pos.setY(i, base[i * 3 + 1] + Math.sin(ambClock * AMB.flagRate * 0.7 + k * 4) * AMB.flagWave * 0.3 * k);
    }
    pos.needsUpdate = true;
  }
}

// ---- the whole lot ---------------------------------------------------------
function updateAmbient(dt, px, py, pz) {
  ambClock += dt;
  updateBirds(dt, px, py, pz);
  updateHighJets(dt, px, py, pz);
  updateFlags(dt);
}
