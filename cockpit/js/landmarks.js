"use strict";
const trainSolids = [];
function forEachSolid(cb) {
  for (const b of buildingBoxes) cb(b);
  for (const b of staticSolids) cb(b);
  for (const arr of streamedSolids.values()) for (const b of arr) cb(b);
  for (const b of trainSolids) cb(b);
}

const matCache = {};
function lam(color) {
  if (!matCache[color]) matCache[color] = new THREE.MeshLambertMaterial({ color });
  return matCache[color];
}
const staticSolids = [];
function addSolidBox(x, y0, z, hw, hd, y1, mesh) {
  staticSolids.push({ x, y0, z, hw, hd, y1, mesh });
}
function lmBox(g, w, h, d, color, x, y, z, solid) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(color));
  m.position.set(x, y, z);
  g.add(m);
  if ((solid === undefined || solid) && g.userData.trackSolids) {
    g.userData.pending.push({ lx: x, ly0: y - h / 2, lz: z, hw: w / 2, hd: d / 2, y1: y + h / 2, mesh: m });
    m.userData.shatterable = true;
  }
  return m;
}
function lmCyl(g, rT, rB, h, color, x, y, z, seg, solid) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rT, rB, h, seg || 8), lam(color));
  m.position.set(x, y, z);
  g.add(m);
  if ((solid === undefined || solid) && g.userData.trackSolids) {
    const r = Math.max(rT, rB);
    g.userData.pending.push({ lx: x, ly0: y - h / 2, lz: z, hw: r, hd: r, y1: y + h / 2, mesh: m });
    m.userData.shatterable = true;
  }
  return m;
}

const ROUTE_LANDMARKS = [];
// ---- mission gates: gold hoops you fly through for a fanfare. Never fail,
// never expire; they re-arm after gateRearm so he can do it again.
const gates = [];
const gateMatGold = new THREE.MeshBasicMaterial({ color: 0xffc43a, transparent: true, opacity: 0.9, fog: false });
const gateMatGreen = new THREE.MeshBasicMaterial({ color: 0x3fdc6a, transparent: true, opacity: 0.95, fog: false });
const gateGeo = new THREE.TorusGeometry(1, 0.06, 8, 32);
function addGate(x, y, z, hw, hh, follow) {
  const mesh = new THREE.Mesh(gateGeo, gateMatGold);
  mesh.position.set(x, y, z);
  mesh.scale.set(hw, hh, 1);
  scene.add(mesh);
  const g = { mesh, x, y, z, hw, hh, cooldown: 0, green: 0, follow: follow || null };
  gates.push(g);
  return g;
}
function updateGates(dt) {
  for (const g of gates) {
    if (g.follow) { g.follow(g); g.mesh.position.set(g.x, g.y, g.z); }
    if (g.cooldown > 0) g.cooldown -= dt;
    if (g.green > 0) { g.green -= dt; if (g.green <= 0) g.mesh.material = gateMatGold; }
    const pulse = 1 + Math.sin(frameCount * 0.09) * 0.05;
    g.mesh.scale.set(g.hw * pulse, g.hh * pulse, 1);
    if (state.phase !== "AIRBORNE" || state.exploding || g.cooldown > 0) continue;
    const dx = state.x - g.x, dy = state.y - g.y, dz = state.z - g.z;
    if (Math.abs(dz) > 6 || Math.abs(dx) > g.hw || Math.abs(dy) > g.hh) continue;
    g.cooldown = TUNE.gateRearm;
    g.green = TUNE.gateGreenTime;
    g.mesh.material = gateMatGreen;
    flags.gates++;
    fanfare();
    sparkleBurst();
  }
}

// ---- crash aftermath: smoke column + crater that linger (the crash is the
// most exciting thing in the game, so it should leave a mark for a while).
const smokeMat = new THREE.MeshLambertMaterial({ color: 0x5a5f66, transparent: true, opacity: 0.55 });
const smokePuffs = [];
for (let i = 0; i < 12; i++) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 7, 5), smokeMat.clone());
  m.visible = false;
  scene.add(m);
  smokePuffs.push({ mesh: m, life: 0, max: 1 });
}
const smokeSources = [];
function startSmoke(x, y, z, dur) { smokeSources.push({ x, y, z, t: dur, emit: 0 }); if (smokeSources.length > 3) smokeSources.shift(); }
function updateSmoke(dt) {
  for (let i = smokeSources.length - 1; i >= 0; i--) {
    const src = smokeSources[i];
    src.t -= dt; src.emit -= dt;
    if (src.t <= 0) { smokeSources.splice(i, 1); continue; }
    if (src.emit <= 0) {
      src.emit = 0.28;
      const p = smokePuffs.find(q => q.life <= 0);
      if (p) {
        p.life = p.max = 2.6;
        p.mesh.visible = true;
        p.mesh.position.set(src.x + (rnd() - 0.5) * 4, src.y + 1, src.z + (rnd() - 0.5) * 4);
        p.mesh.scale.setScalar(2.5);
        p.mesh.material.opacity = 0.55;
      }
    }
  }
  for (const p of smokePuffs) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.mesh.visible = false; continue; }
    const t = 1 - p.life / p.max;
    p.mesh.position.y += 6 * dt;
    p.mesh.scale.setScalar(2.5 + t * 9);
    p.mesh.material.opacity = 0.55 * (1 - t);
  }
}
const craterMat = new THREE.MeshBasicMaterial({ color: 0x1e1a18, transparent: true, opacity: 0.6, depthWrite: false });
const craters = [];
for (let i = 0; i < 4; i++) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(9, 14), craterMat.clone());
  m.rotation.x = -Math.PI / 2;
  m.visible = false;
  scene.add(m);
  craters.push({ mesh: m, life: 0 });
}
let craterNext = 0;
function placeCrater(x, y, z) {
  const c = craters[craterNext++ % craters.length];
  c.life = TUNE.craterFade;
  c.mesh.visible = true;
  c.mesh.position.set(x, y + 0.15, z);
  c.mesh.material.opacity = 0.6;
}
function updateCraters(dt) {
  for (const c of craters) {
    if (c.life <= 0) continue;
    c.life -= dt;
    if (c.life <= 0) { c.mesh.visible = false; continue; }
    c.mesh.material.opacity = 0.6 * Math.min(1, c.life / (TUNE.craterFade * 0.5));
  }
}
// ---- touchdown: tyre puffs under the wheels
const tyrePuffs = [];
for (let i = 0; i < 4; i++) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshLambertMaterial({ color: 0xd8d2c8, transparent: true, opacity: 0.7 }));
  m.visible = false;
  scene.add(m);
  tyrePuffs.push({ mesh: m, life: 0 });
}
function tyrePuffAt(x, y, z) {
  for (let i = 0; i < tyrePuffs.length; i++) {
    const p = tyrePuffs[i];
    p.life = 0.6;
    p.mesh.visible = true;
    p.mesh.position.set(x + (i < 2 ? -2.2 : 2.2) + (rnd() - 0.5), y + 0.4, z + (rnd() - 0.5) * 3);
    p.mesh.scale.setScalar(0.8);
    p.mesh.material.opacity = 0.7;
  }
}
function updateTyrePuffs(dt) {
  for (const p of tyrePuffs) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.mesh.visible = false; continue; }
    const t = 1 - p.life / 0.6;
    p.mesh.position.y += 2.5 * dt;
    p.mesh.scale.setScalar(0.8 + t * 3);
    p.mesh.material.opacity = 0.7 * (1 - t);
  }
}

function addRouteLandmark(g, x, z) {
  g.position.set(x, terrainEff(x, z) - 0.5, z);
  scene.add(g);
  ROUTE_LANDMARKS.push({ g, x, z });
  if (g.userData.pending) {
    for (const p of g.userData.pending) {
      addSolidBox(x + p.lx, p.ly0 + g.position.y, z + p.lz, p.hw, p.hd, p.y1 + g.position.y, p.mesh);
    }
  }
}

function suspensionBridge(cableColor, len, towerH, deckY, deckW) {
  const g = new THREE.Group();
  g.userData.trackSolids = true;
  g.userData.pending = [];
  g.userData.bridgeDeckY = deckY;
  for (const sx of [-len / 2 + 55, len / 2 - 55]) {
    lmBox(g, 13, towerH, 11, 0x8a4a3a, sx, deckY + towerH / 2, 0);
    lmBox(g, 13, towerH, 11, 0x8a4a3a, sx, deckY + towerH / 2, deckW);
  }
  lmBox(g, len, 4.5, deckW + 2, 0x9aa2ad, 0, deckY, deckW / 2);
  for (const sz of [0, deckW]) {
    lmBox(g, len * 0.44, 1.6, 1.6, cableColor, -len * 0.28, deckY + towerH * 0.4, sz, false);
    lmBox(g, len * 0.44, 1.6, 1.6, cableColor, len * 0.28, deckY + towerH * 0.4, sz, false);
  }
  return g;
}

(function buildRouteLandmarks() {
  const RS = ROUTE_SCALE();
  const half = ROUTE_HALF();

  const ny = new THREE.Group();
  ny.userData.trackSolids = true;
  ny.userData.pending = [];
  const skylineZ = half - 900 * RS;
  for (let i = 0; i < 14; i++) {
    const bx = -160 + hashSalt(i, 7, 201) * 320;
    const bz = (hashSalt(i, 7, 202) - 0.5) * 300;
    const bh = 45 + hashSalt(i, 7, 203) * 115;
    const bw = 20 + hashSalt(i, 7, 204) * 16;
    lmBox(ny, bw, bh, bw * 0.85, i % 3 === 0 ? 0x5d6b7d : 0x77879a, bx, bh / 2, bz);
  }
  lmCyl(ny, 5, 7.5, 165, 0xaebccd, 40, 82.5, 30, 10);
  lmCyl(ny, 1.4, 2.6, 48, 0xcdd8e4, 40, 178, 30, 8);
  addRouteLandmark(ny, -260, skylineZ);

  const statue = new THREE.Group();
  statue.userData.trackSolids = true;
  statue.userData.pending = [];
  lmCyl(statue, 36, 42, 8, 0x8d9299, 0, 4, 0, 12);
  lmBox(statue, 12, 15, 12, 0x6d7a70, 0, 15.5, 0);
  lmCyl(statue, 4.5, 6.5, 24, 0x3f8f5a, 0, 35, 0, 10);
  const head = new THREE.Mesh(new THREE.SphereGeometry(3.6, 10, 8), lam(0x3f8f5a));
  head.position.y = 50;
  statue.add(head);
  const arm = lmBox(statue, 2.6, 14, 2.6, 0x3f8f5a, 5.5, 53, 0, false);
  arm.rotation.z = 0.45;
  const torch = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd23e }));
  torch.position.set(11, 60, 0);
  statue.add(torch);
  const island = new THREE.Mesh(new THREE.CylinderGeometry(46, 54, 7, 12), lam(0x77c95f));
  island.position.y = 3.5;
  statue.add(island);
  addRouteLandmark(statue, -520, half - 1350 * RS);

  const harborZ = half - 480 * RS;
  addRouteLandmark(suspensionBridge(0xd0342c, 620, 58, 16, 18), -120, harborZ);
  addRouteLandmark(suspensionBridge(0xd0342c, 540, 52, 16, 16), 420, harborZ - 260 * RS);

  const silosFarm = new THREE.Group();
  silosFarm.userData.trackSolids = true;
  silosFarm.userData.pending = [];
  for (let i = 0; i < 6; i++) {
    lmCyl(silosFarm, 6, 6, 26, i % 2 ? 0xc9ccd4 : 0xb0413a, -80 + i * 34, 13, i % 2 * 20, 10);
  }
  addRouteLandmark(silosFarm, 240, half * 0.28);

  const midCity = new THREE.Group();
  midCity.userData.trackSolids = true;
  midCity.userData.pending = [];
  for (let i = 0; i < 9; i++) {
    const bx = -130 + i * 32 + hashSalt(i, 9, 211) * 12;
    const bh = 50 + hashSalt(i, 9, 212) * 64;
    lmBox(midCity, 20 + hashSalt(i, 9, 213) * 10, bh, 18, i % 2 ? 0x5a6470 : 0x6e7a88, bx, bh / 2, (hashSalt(i, 9, 214) - 0.5) * 100);
  }
  lmBox(midCity, 22, 155, 22, 0x22262c, 8, 77.5, 0);
  addRouteLandmark(midCity, -340, half * 0.55);

  const silosPlains = new THREE.Group();
  silosPlains.userData.trackSolids = true;
  silosPlains.userData.pending = [];
  for (let i = 0; i < 4; i++) {
    lmCyl(silosPlains, 5.5, 5.5, 22, 0xd8cdb4, i * 30 - 45, 11, 0, 10);
  }
  addRouteLandmark(silosPlains, 430, -half * 0.18);

  const casinos = new THREE.Group();
  casinos.userData.trackSolids = true;
  casinos.userData.pending = [];
  for (let i = 0; i < 5; i++) {
    const bh2 = 52 + hashSalt(i, 11, 221) * 50;
    lmBox(casinos, 24 + i * 2, bh2, 20, [0xd8b04a, 0xc9963f, 0xb87f2f, 0xd8b04a, 0xcf9d3a][i], -95 + i * 47, bh2 / 2, (i % 2) * 26 - 13);
  }
  const ball = new THREE.Mesh(new THREE.SphereGeometry(12, 12, 10), lam(0xe8c860));
  ball.position.set(100, 105, 13);
  casinos.add(ball);
  casinos.userData.pending.push({ lx: 100, ly0: 93, lz: 13, hw: 12, hd: 12, y1: 117, mesh: ball });
  addRouteLandmark(casinos, -250, -half * 0.555);

  const caBridge = suspensionBridge(0xd0342c, 700, 78, 21, 20);
  addRouteLandmark(caBridge, -400, -half + 380 * RS);

  const letters = new THREE.Group();
  letters.userData.trackSolids = true;
  letters.userData.pending = [];
  const hill = new THREE.Mesh(new THREE.CylinderGeometry(140, 200, 42, 14), lam(0x9a8f6a));
  hill.position.y = 18;
  letters.add(hill);
  for (let i = 0; i < 7; i++) {
    const blk = lmBox(letters, 16, 22, 4, 0xf4f8fa, -84 + i * 28, 38 + Math.sin(i / 6 * Math.PI) * 9, -10);
    blk.rotation.x = -0.4;
  }
  addRouteLandmark(letters, 240, -half + 620 * RS);

  const downtown = new THREE.Group();
  downtown.userData.trackSolids = true;
  downtown.userData.pending = [];
  for (let i = 0; i < 10; i++) {
    const bx = -125 + i * 28 + hashSalt(i, 13, 231) * 10;
    const bh3 = 55 + hashSalt(i, 13, 232) * 68;
    lmBox(downtown, 18 + hashSalt(i, 13, 233) * 10, bh3, 18, i % 3 === 0 ? 0x8a97a8 : 0xb8c2cf, bx, bh3 / 2, (hashSalt(i, 13, 234) - 0.5) * 76);
  }
  // Beside the approach, not under it: the corridor is clear of solids for
  // ringStartDistance beyond both runway ends (see inCorridor + harness check).
  addRouteLandmark(downtown, 460, -half + 1080 * RS);
})();

// Gates: under every suspension bridge, inside the canyon, and one that rides
// with the locomotive (placed after the train is built, below).
for (const L of ROUTE_LANDMARKS) {
  const deckY = L.g.userData.bridgeDeckY;
  if (!deckY) continue;
  const groundY = Math.max(terrainEff(L.x, L.z), TUNE.waterLevel);
  const top = L.g.position.y + deckY - 3;
  if (top - groundY < 9) continue; // deck too close to the water to fly under
  const hh = (top - groundY) / 2;
  addGate(L.x, groundY + hh, L.z, 70, hh, null);
}
{
  const zc = -3800 * ROUTE_SCALE();
  const gy = Math.max(terrainEff(0, zc), TUNE.waterLevel);
  addGate(0, gy + 34, zc, 42, 30, null);
}

const TRAIN_CARS = 22;
const trainInst = new THREE.InstancedMesh(
  new THREE.BoxGeometry(7, 9, 15),
  new THREE.MeshLambertMaterial({ color: 0xffffff }),
  TRAIN_CARS
);
for (let i = 0; i < TRAIN_CARS; i++) {
  trainInst.setColorAt(i, tmpColor.setHex(i === 0 ? 0xb0413a : (i % 2 ? 0x8a6f52 : 0x5f6b78)));
}
trainInst.instanceColor.needsUpdate = true;
scene.add(trainInst);
const TRAIN_X = 340;
const TRAIN_ZMIN = -600 * ROUTE_SCALE(), TRAIN_ZMAX = 1600 * ROUTE_SCALE();
let trainHead = TRAIN_ZMAX;
addGate(TRAIN_X, 0, trainHead, 30, 30, g => {
  g.z = trainHead + 8;
  g.y = terrainEff(TRAIN_X, g.z) + 6 + 34;
});

function updateTrain(dt, px, pz) {
  const mid = (TRAIN_ZMIN + TRAIN_ZMAX) / 2;
  trainSolids.length = 0;
  if (Math.abs(pz - mid) > 2800 || Math.abs(px - TRAIN_X) > 2800) return;
  trainHead -= TUNE.trainSpeed * dt;
  if (trainHead < TRAIN_ZMIN) trainHead = TRAIN_ZMAX;
  const dummyT = dummyObj;
  for (let i = 0; i < TRAIN_CARS; i++) {
    const cz = trainHead + i * 17;
    if (cz > TRAIN_ZMAX) continue;
    const gy = terrainEff(TRAIN_X, cz);
    dummyT.position.set(TRAIN_X, gy + 6, cz);
    dummyT.rotation.set(0, 0, 0);
    dummyT.scale.set(1, 1, 1);
    dummyT.updateMatrix();
    trainInst.setMatrixAt(i, dummyT.matrix);
    trainSolids.push({ x: TRAIN_X, z: cz, hw: 4.5, hd: 8.5, y0: gy + 1, y1: gy + 11.5 });
  }
  trainInst.instanceMatrix.needsUpdate = true;
}

let cullTimer = 0;
function cullLandmarks(dt, px, pz) {
  cullTimer -= dt;
  if (cullTimer > 0) return;
  cullTimer = 0.35;
  const maxD2 = TUNE.fogFar * TUNE.fogFar * 2.1;
  for (const L of ROUTE_LANDMARKS) {
    const dx = L.x - px, dz = L.z - pz;
    L.g.visible = dx * dx + dz * dz < maxD2;
  }
}
