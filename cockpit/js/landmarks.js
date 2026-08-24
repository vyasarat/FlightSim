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
  // The NY cluster sits 1 km further out than it used to: the airport's runway
  // spans +-700 and the apron another 300 beside it, so anything closer
  // crossed the runway (the bridges) or stood on short final (the skyline).
  const skylineZ = half - 1900 * RS;
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
  addRouteLandmark(statue, -520, half - 2350 * RS);

  const harborZ = half - 1480 * RS;
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
  addRouteLandmark(caBridge, -400, -half + 1480 * RS);  // clear of the runway + apron

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

// ---- airports: a terminal complex beside each runway, on the side away from
// nothing in particular (NY east, CA west) so the two feel different. Every
// building and parked plane is a solid; the apron, taxiways and lights are not.
const airportSpinners = [];
const edgeLightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, fog: false });
const greenLightMat = new THREE.MeshBasicMaterial({ color: 0x3fdc6a, fog: false });
const redLightMat = new THREE.MeshBasicMaterial({ color: 0xe0483e, fog: false });
function buildAirport(idx) {
  const ap = AIRPORTS[idx];
  const m = idx === 0 ? 1 : -1;                 // apron side
  const halfL = TUNE.runwayLength / 2, halfW = TUNE.runwayWidth / 2;
  const g = new THREE.Group();
  g.userData.trackSolids = true;
  g.userData.pending = [];
  const asphalt = 0x5e636b, apron = 0x777c85, paint = 0xffd23e;

  // apron slab + parallel taxiway + two connectors to the runway
  // Stacked ground layers keep >= 0.15 between faces so nothing z-fights.
  lmBox(g, 200, 0.3, 760, apron, m * 170, 0.15, 0, false);
  lmBox(g, 18, 0.2, 900, asphalt, m * 88, 0.4, 0, false);
  for (const cz of [-300, 300]) lmBox(g, 70, 0.2, 18, asphalt, m * (halfW + 30), 0.4, cz, false);
  for (let z = -430; z <= 430; z += 40) lmBox(g, 0.8, 0.04, 18, paint, m * 88, 0.62, z, false);
  for (const cz of [-300, 300]) for (let x = halfW + 8; x < halfW + 62; x += 14) lmBox(g, 12, 0.04, 0.8, paint, m * x, 0.62, cz, false);

  // terminal: long hall, glass band, roof, jet bridges toward the apron
  lmBox(g, 40, 14, 220, 0xd8dde4, m * 232, 7, 0, true);
  lmBox(g, 41, 4, 222, 0x6fa7d9, m * 232, 8, 0, false);
  lmBox(g, 46, 1.2, 226, 0x8a93a0, m * 232, 14.6, 0, false);
  for (const z of [-70, 0, 70]) {
    lmBox(g, 26, 3.2, 4, 0xb8c2cf, m * 199, 6.5, z, true);
    lmBox(g, 5, 6, 5, 0x8a93a0, m * 188, 3, z, true);
  }
  // control tower with cab and beacon
  lmCyl(g, 4, 5, 42, 0xe6eaf0, m * 150, 21, 260, 10, true);
  lmBox(g, 15, 6, 15, 0x2f3a48, m * 150, 45, 260, true);
  lmBox(g, 17, 1, 17, 0x8a93a0, m * 150, 48.5, 260, false);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4030, fog: false }));
  beacon.position.set(m * 150, 50.5, 260);
  g.add(beacon);
  blinkers.push(beacon);
  // hangars with arched roofs
  for (const z of [-300, -370]) {
    lmBox(g, 56, 14, 44, 0xb0b6bf, m * 215, 7, z, true);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 56, 12, 1, false, 0, Math.PI), lam(0x8f96a0));
    roof.rotation.z = Math.PI / 2; roof.rotation.y = Math.PI / 2;
    roof.position.set(m * 215, 14, z);
    g.add(roof);
    lmBox(g, 40, 10, 1, 0x3c4350, m * (215 - 28 * m), 5, z, false);
  }
  // fuel tanks
  for (const z of [340, 372]) lmCyl(g, 9, 9, 12, 0xeef1f4, m * 245, 6, z, 14, true);
  // parked airliners at the gates, nose to the terminal
  for (const [z, ci] of [[-70, 0], [0, 1], [70, 2]]) {
    const plane = makeTrafficModel(trafficPalette[ci % trafficPalette.length]);
    plane.scale.setScalar(1.35);
    plane.position.set(m * 160, 3.2, z);
    plane.rotation.y = m > 0 ? -Math.PI / 2 : Math.PI / 2;
    g.add(plane);
    g.userData.pending.push({ lx: m * 160, ly0: 0, lz: z, hw: 12, hd: 12, y1: 8, mesh: plane });
  }
  // radar dish (spins) and windsock on the far side
  lmCyl(g, 1.2, 1.6, 10, 0xe6eaf0, -m * 95, 5, -470, 8, false);
  const dish = new THREE.Mesh(new THREE.BoxGeometry(12, 4, 0.8), lam(0xf2f4f7));
  dish.position.set(-m * 95, 11, -470);
  dish.rotation.x = -0.35;
  g.add(dish);
  airportSpinners.push(dish);
  lmCyl(g, 0.3, 0.3, 9, 0xf2f4f7, -m * 90, 4.5, 420, 6, false);
  const sock = new THREE.Mesh(new THREE.ConeGeometry(1.4, 6, 8), lam(0xff7a1a));
  sock.rotation.z = Math.PI / 2;
  sock.position.set(-m * 87, 9, 420);
  g.add(sock);

  // runway edge lights + threshold bars (green facing the approach, red at the far end)
  const n = Math.floor(TUNE.runwayLength / 50);
  const lights = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.5, 0.9), edgeLightMat, n * 2);
  const d = new THREE.Object3D();
  let li = 0;
  for (let i = 0; i < n; i++) for (const sx of [-1, 1]) {
    d.position.set(sx * (halfW + 2.5), 0.45, -halfL + 25 + i * 50);
    d.updateMatrix(); lights.setMatrixAt(li++, d.matrix);
  }
  g.add(lights);
  for (const [endZ, mat] of [[halfL + 3, greenLightMat], [-halfL - 3, greenLightMat]]) {
    const bar = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.5, 0.9), mat, 12);
    for (let k = 0; k < 12; k++) { d.position.set(-halfW + 2.5 + k * (TUNE.runwayWidth - 5) / 11, 0.45, endZ); d.updateMatrix(); bar.setMatrixAt(k, d.matrix); }
    g.add(bar);
    const inner = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.5, 0.9), redLightMat, 12);
    for (let k = 0; k < 12; k++) { d.position.set(-halfW + 2.5 + k * (TUNE.runwayWidth - 5) / 11, 0.45, endZ - Math.sign(endZ) * 6); d.updateMatrix(); inner.setMatrixAt(k, d.matrix); }
    g.add(inner);
  }
  // addRouteLandmark anchors a group at terrain - 0.5 (so landmark bases sink
  // into the ground). Airport ground layers are measured from the runway
  // surface, so lift everything by that 0.5: otherwise the apron is buried and
  // the taxiway's top face is coplanar with the terrain (it shimmered).
  for (const c of g.children) c.position.y += 0.5;
  for (const pnd of g.userData.pending) { pnd.ly0 += 0.5; pnd.y1 += 0.5; }
  addRouteLandmark(g, 0, ap.cz);
}
for (let i = 0; i < AIRPORTS.length; i++) buildAirport(i);
function updateAirports(dt) {
  for (const s of airportSpinners) s.rotation.y += dt * 0.9;
}

// ---- shootable targets: hot-air balloons drifting along the route, a blimp
// cruising it end to end, a UFO zig-zagging over the desert, and boats on the
// great lake. A missile (or the plane) pops them; they come back a few seconds
// later somewhere else. Nothing is counted, nothing is lost.
const targets = [];
const TARGET_HIT_R = { balloon: 11, blimp: 17, ufo: 12, boat: 9 };
const balloonPalette = [0xe0483e, 0xffd23e, 0x3aa0ff, 0x36c46a, 0xff7ab8, 0xff8a1f];
function makeBalloon(color) {
  const g = new THREE.Group();
  const env = new THREE.Mesh(new THREE.SphereGeometry(7, 10, 8), lam(color));
  env.scale.y = 1.15; env.position.y = 9; g.add(env);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.2, 1.6, 12), lam(0xf2f4f7));
  band.position.y = 9; g.add(band);
  const throat = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 1.2, 3, 8), lam(color));
  throat.position.y = 1.5; g.add(throat);
  const basket = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 2.4), lam(0x8a5a2b));
  basket.position.y = -1.5; g.add(basket);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 4), lam(0x3c3a36));
    rope.position.set(sx * 1.1, 0.2, sz * 1.1); g.add(rope);
  }
  return g;
}
function makeBlimp() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(6, 12, 8), lam(0xd8dde4));
  body.scale.set(1, 1, 3.2); g.add(body);
  const stripe = new THREE.Mesh(new THREE.SphereGeometry(6.05, 12, 8, 0, Math.PI * 2, 1.2, 0.8), lam(0xe0483e));
  stripe.scale.set(1, 1, 3.2); g.add(stripe);
  const gondola = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 8), lam(0x2f3a48));
  gondola.position.y = -6; g.add(gondola);
  for (const sx of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(7, 0.6, 5), lam(0xe0483e));
    fin.position.set(sx * 4, 0, -16); g.add(fin);
  }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 7, 5), lam(0xe0483e));
  tail.position.set(0, 4, -16); g.add(tail);
  return g;
}
function makeUfo() {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(9, 6, 2.4, 16), lam(0xb8bec9));
  g.add(disc);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x8fe8ff, transparent: true, opacity: 0.8 }));
  dome.position.y = 1.2; g.add(dome);
  const lights = new THREE.Mesh(new THREE.TorusGeometry(7.5, 0.5, 6, 16), new THREE.MeshBasicMaterial({ color: 0x3fdc6a, fog: false }));
  lights.rotation.x = Math.PI / 2; lights.position.y = -0.6; g.add(lights);
  g.userData.lights = lights;
  return g;
}
function makeBoat(color) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(5, 2.4, 13), lam(color));
  hull.position.y = 0.6; g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(2.5, 5, 4), lam(color));
  bow.rotation.x = Math.PI / 2; bow.rotation.y = Math.PI / 4; bow.position.set(0, 0.6, 9); g.add(bow);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.6, 5), lam(0xf2f4f7));
  cabin.position.set(0, 3, -1); g.add(cabin);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6, 5), lam(0x3c3a36));
  mast.position.set(0, 6.5, -1); g.add(mast);
  return g;
}
function addTarget(kind, mesh, place) {
  const t = { kind, mesh, x: 0, y: 0, z: 0, alive: true, respawn: 0, t: rnd() * 100, place, r: TARGET_HIT_R[kind] };
  scene.add(mesh);
  targets.push(t);
  t.place(t, true);
  return t;
}
function placeBalloon(t) {
  const half = ROUTE_HALF();
  for (let tries = 0; tries < 30; tries++) {
    const z = (rnd() * 2 - 1) * (half - 2000);
    const x = (rnd() - 0.5) * 1600;
    if (inCorridor(x, z, 300)) continue;
    t.x = x; t.z = z;
    t.y = Math.max(terrainEff(x, z), TUNE.waterLevel) + 90 + rnd() * 80;
    t.vx = (rnd() - 0.5) * 2.5; t.vz = (rnd() - 0.5) * 2.5;
    return;
  }
}
function placeBlimp(t, first) {
  const half = ROUTE_HALF();
  t.dir = first ? (rnd() < 0.5 ? 1 : -1) : -t.dir;
  t.x = (rnd() < 0.5 ? -1 : 1) * (450 + rnd() * 300);
  t.z = -t.dir * (half - 1800);
  t.y = 210 + rnd() * 40;
}
function placeUfo(t) {
  t.cx = 0; t.cz = ROUTE_HALF() - 0.8 * TUNE.routeLength;   // desert centre
  t.x = t.cx; t.z = t.cz; t.y = 150;
}
function placeBoat(t) {
  const RS = ROUTE_SCALE();
  // great lake (lakeShape): the water is a ring around a central island, so the
  // boats orbit at ~75% of the lake's radii where it is deepest.
  t.cx = -350 * RS; t.cz = 1800 * RS;
  const k = 0.66 + rnd() * 0.16;
  t.orbitX = 640 * RS * k; t.orbitZ = 420 * RS * k;
  t.speed = 0.05 + rnd() * 0.04; t.t = rnd() * 100;
  t.x = t.cx + Math.cos(t.t * t.speed) * t.orbitX; t.z = t.cz + Math.sin(t.t * t.speed) * t.orbitZ; t.y = TUNE.waterLevel + 0.4;
}
for (let i = 0; i < 5; i++) addTarget("balloon", makeBalloon(balloonPalette[i % balloonPalette.length]), placeBalloon);
addTarget("blimp", makeBlimp(), placeBlimp);
addTarget("ufo", makeUfo(), placeUfo);
for (let i = 0; i < 3; i++) addTarget("boat", makeBoat([0xf2f4f7, 0xe0483e, 0x1c75bc][i]), placeBoat);

function killTarget(t, hx, hy, hz) {
  t.alive = false;
  t.mesh.visible = false;
  t.respawn = 6 + rnd() * 4;
  flags.targets++;
  triggerExplosion(hx, hy, hz, t.kind === "balloon" ? 0.5 : 0.8);
  if (t.kind === "balloon" || t.kind === "ufo") sparkleBurst();
}
function updateTargets(dt) {
  for (const t of targets) {
    if (!t.alive) {
      t.respawn -= dt;
      if (t.respawn <= 0) { t.place(t, false); t.alive = true; t.mesh.visible = true; }
      continue;
    }
    t.t += dt;
    if (t.kind === "balloon") {
      t.x += t.vx * dt; t.z += t.vz * dt;
      const floor = Math.max(terrainEff(t.x, t.z), TUNE.waterLevel) + 60;
      if (t.y < floor) t.y += 8 * dt;
      t.mesh.position.set(t.x, t.y + Math.sin(t.t * 0.7) * 1.5, t.z);
      t.mesh.rotation.y = t.t * 0.1;
    } else if (t.kind === "blimp") {
      t.z += t.dir * 24 * dt;
      if (Math.abs(t.z) > ROUTE_HALF() - 1500) placeBlimp(t, false);
      t.mesh.position.set(t.x, t.y + Math.sin(t.t * 0.5) * 2, t.z);
      t.mesh.rotation.y = t.dir > 0 ? 0 : Math.PI;
      t.mesh.rotation.z = Math.sin(t.t * 0.3) * 0.04;
    } else if (t.kind === "ufo") {
      t.x = t.cx + Math.sin(t.t * 0.9) * 320;
      t.z = t.cz + Math.sin(t.t * 0.55) * 260;
      t.y = 150 + Math.sin(t.t * 1.7) * 35;
      t.mesh.position.set(t.x, t.y, t.z);
      t.mesh.rotation.y += dt * 4;
      t.mesh.rotation.z = Math.cos(t.t * 0.9) * 0.25;
      if (t.mesh.userData.lights) t.mesh.userData.lights.material.color.setHex(Math.floor(t.t * 4) % 2 ? 0x3fdc6a : 0xff4030);
    } else if (t.kind === "boat") {
      t.x = t.cx + Math.cos(t.t * t.speed) * t.orbitX;
      t.z = t.cz + Math.sin(t.t * t.speed) * t.orbitZ;
      t.mesh.position.set(t.x, t.y + Math.sin(t.t * 1.3) * 0.15, t.z);
      // bow points along the direction of travel
      const vx = -Math.sin(t.t * t.speed) * t.orbitX, vz = Math.cos(t.t * t.speed) * t.orbitZ;
      t.mesh.rotation.y = Math.atan2(vx, vz);
      t.mesh.rotation.z = Math.sin(t.t * 1.1) * 0.05;
    }
    // flying into one is a mid-air, same as traffic
    if ((state.phase === "AIRBORNE" || state.phase === "CLIMB_AWAY") && !state.exploding) {
      const dx = t.x - state.x, dy = t.y - state.y, dz = t.z - state.z;
      if (dx * dx + dy * dy + dz * dz < (t.r + 3) * (t.r + 3)) {
        killTarget(t, (t.x + state.x) / 2, (t.y + state.y) / 2, (t.z + state.z) / 2);
        flags.midairs++;
        state.exploding = true;
        state.explodeTimer = TUNE.reassembleDelay;
        safePos.x = state.x; safePos.z = state.z;
        safePos.y = Math.max(state.y + 30, Math.max(terrainEff(state.x, state.z), TUNE.waterLevel) + 60);
        shakeAmp = 1;
      }
    }
  }
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
