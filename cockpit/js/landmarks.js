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
const airports = [];        // per-airport reactive parts (beacon, windsock, hangar doors)
const casinoLights = [];    // casino light strips (declared early: filled by buildRouteLandmarks)
const gateMatGold = new THREE.MeshBasicMaterial({ color: 0xffc43a, transparent: true, opacity: 0.9, fog: false });
const gateMatGreen = new THREE.MeshBasicMaterial({ color: 0x3fdc6a, transparent: true, opacity: 0.95, fog: false });
const gateGeo = new THREE.TorusGeometry(1, 0.06, 8, 32);
function addGate(x, y, z, hw, hh, follow, name) {
  const mesh = new THREE.Mesh(gateGeo, gateMatGold);
  mesh.position.set(x, y, z);
  mesh.scale.set(hw, hh, 1);
  scene.add(mesh);
  const g = { mesh, x, y, z, hw, hh, cooldown: 0, green: 0, follow: follow || null, name: name || "" };
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
    if ((state.phase !== "AIRBORNE" && state.phase !== "CLIMB_AWAY") || state.exploding || g.cooldown > 0) continue;
    const dx = state.x - g.x, dy = state.y - g.y, dz = state.z - g.z;
    if (Math.abs(dz) > 6 || Math.abs(dx) > g.hw || Math.abs(dy) > g.hh) continue;
    g.cooldown = TUNE.gateRearm;
    g.green = TUNE.gateGreenTime;
    g.mesh.material = gateMatGreen;
    flags.gates++;
    fanfare();
    sparkleBurst();
    if (g.bounceGroup) g.bounceT = 1.4;   // the bridge bounces after you fly under it
  }
  // bridges bounce after you fly under them
  for (const g of gates) {
    if (!(g.bounceT > 0)) continue;
    g.bounceT -= dt;
    const k = Math.max(0, g.bounceT / 1.4);
    g.bounceGroup.position.y = g.bounceBaseY + Math.sin((1.4 - g.bounceT) * 16) * 2.2 * k * k;
    if (g.bounceT <= 0) g.bounceGroup.position.y = g.bounceBaseY;
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
// ---- wake: spray over water, dust over the desert, and bomb splashes
const wakePuffs = [];
for (let i = 0; i < 64; i++) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
  m.visible = false;
  scene.add(m);
  wakePuffs.push({ mesh: m, life: 0, max: 1, rise: 0, grow: 0 });
}
let wakeEmitT = 0;
function wakePuff(x, y, z, color, size, rise, life) {
  const p = wakePuffs.find(q => q.life <= 0) || wakePuffs[0];
  p.life = p.max = life; p.rise = rise; p.grow = size * 2.2;
  p.mesh.visible = true;
  p.mesh.material.color.setHex(color);
  p.mesh.material.opacity = 0.6;
  p.mesh.position.set(x, y, z);
  p.mesh.scale.setScalar(size);
}
function splashAt(x, y, z, big) {
  for (let i = 0; i < 8; i++) wakePuff(x + (rnd() - 0.5) * 6 * big, y + 0.5, z + (rnd() - 0.5) * 6 * big, 0xe8f6ff, 1.5 * big, 9 * big, 0.9);
}
function updateWake(dt) {
  wakeEmitT -= dt;
  if (wakeEmitT <= 0 && (state.phase === "AIRBORNE" || state.phase === "CLIMB_AWAY") && !state.exploding && state.speed > 20) {
    const terr = terrainEff(state.x, state.z);
    const agl = state.y - Math.max(terr, TUNE.waterLevel);
    if (agl < 12) {
      const overWater = terr < TUNE.waterLevel - 0.2;
      const overSand = desertMask(state.z) > 0.5;
      if (overWater || overSand) {
        wakeEmitT = 0.06;
        const bx = state.x + forward.x * -6, bz = state.z + forward.z * -6;
        wakePuff(bx + (rnd() - 0.5) * 3, Math.max(terr, TUNE.waterLevel) + 0.6, bz + (rnd() - 0.5) * 3,
          overWater ? 0xe8f6ff : 0xe9d9a8, 1.2, overWater ? 3 : 2, 0.7);
      }
    }
  }
  for (const p of wakePuffs) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.mesh.visible = false; continue; }
    const t = 1 - p.life / p.max;
    p.mesh.position.y += p.rise * dt;
    p.mesh.scale.setScalar(p.mesh.scale.x + p.grow * dt);
    p.mesh.material.opacity = 0.6 * (1 - t);
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

function addRouteLandmark(g, x, z, name) {
  g.position.set(x, terrainEff(x, z) - 0.5, z);
  g.userData.name = name || g.userData.name || "";
  scene.add(g);
  ROUTE_LANDMARKS.push({ g, x, z, name: g.userData.name });
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
  addRouteLandmark(ny, -260, skylineZ, "skyline");

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
  addRouteLandmark(statue, -520, half - 2350 * RS, "statue");

  // Decks high enough to fly under with room (plane needs 8 m over the water
  // and 3 m under the deck) and no deck crossing the departure/arrival
  // centreline (|x| < 150 is kept clear of every bridge).
  const harborZ = half - 1480 * RS;
  addRouteLandmark(suspensionBridge(0xd0342c, 620, 58, 34, 18), -520, harborZ, "bridgeNY1");
  addRouteLandmark(suspensionBridge(0xd0342c, 540, 52, 32, 16), 480, harborZ - 260 * RS, "bridgeNY2");

  const silosFarm = new THREE.Group();
  silosFarm.userData.trackSolids = true;
  silosFarm.userData.pending = [];
  for (let i = 0; i < 6; i++) {
    lmCyl(silosFarm, 6, 6, 26, i % 2 ? 0xc9ccd4 : 0xb0413a, -80 + i * 34, 13, i % 2 * 20, 10);
  }
  addRouteLandmark(silosFarm, 560, half * 0.28, "silosFarm");   // east of the lake (x=240 was on the lake bed)

  const midCity = new THREE.Group();
  midCity.userData.trackSolids = true;
  midCity.userData.pending = [];
  for (let i = 0; i < 9; i++) {
    const bx = -130 + i * 32 + hashSalt(i, 9, 211) * 12;
    const bh = 50 + hashSalt(i, 9, 212) * 64;
    lmBox(midCity, 20 + hashSalt(i, 9, 213) * 10, bh, 18, i % 2 ? 0x5a6470 : 0x6e7a88, bx, bh / 2, (hashSalt(i, 9, 214) - 0.5) * 100);
  }
  lmBox(midCity, 22, 155, 22, 0x22262c, 8, 77.5, 0);
  addRouteLandmark(midCity, -340, half * 0.55, "midCity");

  const silosPlains = new THREE.Group();
  silosPlains.userData.trackSolids = true;
  silosPlains.userData.pending = [];
  for (let i = 0; i < 4; i++) {
    lmCyl(silosPlains, 5.5, 5.5, 22, 0xd8cdb4, i * 30 - 45, 11, 0, 10);
  }
  addRouteLandmark(silosPlains, 430, -half * 0.18, "silosPlains");

  const casinos = new THREE.Group();
  casinos.userData.trackSolids = true;
  casinos.userData.pending = [];
  for (let i = 0; i < 5; i++) {
    const bh2 = 52 + hashSalt(i, 11, 221) * 50;
    lmBox(casinos, 24 + i * 2, bh2, 20, [0xd8b04a, 0xc9963f, 0xb87f2f, 0xd8b04a, 0xcf9d3a][i], -95 + i * 47, bh2 / 2, (i % 2) * 26 - 13);
  }
  for (let i = 0; i < 5; i++) {
    const bh2 = 52 + hashSalt(i, 11, 221) * 50;
    for (let k = 0; k < 3; k++) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(25 + i * 2, 1.2, 0.6), new THREE.MeshBasicMaterial({ color: 0xffd23e, fog: false }));
      strip.position.set(-95 + i * 47, 14 + k * (bh2 - 20) / 2, (i % 2) * 26 - 13 + 10.4);
      casinos.add(strip);
      strip.userData.wx = -250; strip.userData.wz = -half * 0.555;   // world anchor for the "close" test
      casinoLights.push(strip);
    }
  }
  const ball = new THREE.Mesh(new THREE.SphereGeometry(12, 12, 10), lam(0xe8c860));
  ball.position.set(100, 105, 13);
  casinos.add(ball);
  casinos.userData.pending.push({ lx: 100, ly0: 93, lz: 13, hw: 12, hd: 12, y1: 117, mesh: ball });
  addRouteLandmark(casinos, -250, -half * 0.555, "casinos");

  const caBridge = suspensionBridge(0xd0342c, 700, 78, 30, 20);
  addRouteLandmark(caBridge, -530, -half + 1480 * RS, "bridgeCA");  // clear of the runway, apron and centreline

  const letters = new THREE.Group();
  letters.userData.trackSolids = true;
  letters.userData.pending = [];
  const hill = new THREE.Mesh(new THREE.CylinderGeometry(140, 200, 42, 14), lam(0x9a8f6a));
  hill.position.y = 18;
  letters.add(hill);
  letters.userData.pending.push({ lx: 0, ly0: -3, lz: 0, hw: 200, hd: 200, y1: 39, mesh: hill });   // the skirt reaches r 200
  for (let i = 0; i < 7; i++) {
    const blk = lmBox(letters, 16, 22, 4, 0xf4f8fa, -84 + i * 28, 38 + Math.sin(i / 6 * Math.PI) * 9, -10);
    blk.rotation.x = -0.4;
  }
  addRouteLandmark(letters, 560, -half + 1700 * RS, "letters");  // well clear of the CA runway, pad and downtown

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
  addRouteLandmark(downtown, 460, -half + 1080 * RS, "downtown");
})();

// ---- sparkle spots: twenty hidden gems tucked around the world. Fly through
// one and it bursts and stays lit for good (a small beacon), so the more he
// explores, the more lit the world gets. Remembered across launches; once all
// are found they quietly reset so there is always something to find.
const spots = [];
const spotMatIdle = new THREE.MeshBasicMaterial({ color: 0xffd23e, fog: false, transparent: true, opacity: 0.9 });
const spotMatLit = new THREE.MeshBasicMaterial({ color: 0x9df7ff, fog: false });
const spotGeo = new THREE.IcosahedronGeometry(3.2, 0);
const beamGeo = new THREE.CylinderGeometry(0.6, 0.6, 60, 6, 1, true);
const beamMat = new THREE.MeshBasicMaterial({ color: 0x9df7ff, fog: false, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
function addSpot(x, y, z) {
  y = Math.max(y, Math.max(terrainEff(x, z), TUNE.waterLevel) + 12);   // always in clear air
  const mesh = new THREE.Mesh(spotGeo, spotMatIdle);
  mesh.position.set(x, y, z);
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.set(x, y + 30, z);
  beam.visible = false;
  scene.add(mesh); scene.add(beam);
  spots.push({ mesh, beam, x, y, z, lit: false });
}
(function placeSpots() {
  const half = ROUTE_HALF(), RS = ROUTE_SCALE(), W = TUNE.waterLevel;
  const g = (x, z) => Math.max(terrainEff(x, z), W);
  // landmarks are looked up by name so reordering/adding one can't misplace a spot
  const L = (name) => ROUTE_LANDMARKS.find(l => l.name === name);
  const top = (l) => { let t = 0; for (const p of l.g.userData.pending || []) t = Math.max(t, p.y1); return l.g.position.y + t; };
  const on = (name, dx, dyAboveTop, dz) => { const l = L(name); if (l) addSpot(l.x + dx, top(l) + dyAboveTop, l.z + dz); };
  on("skyline", 40, 14, 30);          // NY spire tip
  on("statue", 11, 14, 0);            // over the statue's torch
  on("bridgeNY1", 0, 14, 0);          // over the NY bridge towers
  on("silosFarm", 0, 14, 20);         // farm silos
  on("midCity", 8, 14, 0);            // mid-city tower top
  on("silosPlains", 0, 14, 0);        // plains silos
  on("casinos", 100, 14, 13);         // above the casino ball
  on("bridgeCA", 0, 14, 0);           // over the CA bridge towers
  on("letters", 0, 14, 30);           // above the hillside letters
  on("downtown", 0, 14, 0);           // downtown roof
  // in the landscape
  {
    const zc = -1500 * RS; let best = -1e9, bx = 0, bz = zc;
    for (let x = -800; x <= 800; x += 40) for (let z = zc - 400; z <= zc + 400; z += 40) { const h = terrainEff(x, z); if (h > best) { best = h; bx = x; bz = z; } }
    addSpot(bx, best + 10, bz);                                    // the highest mountain peak
  }
  addSpot(0, g(0, -3800 * RS) + 22, -3800 * RS);                   // inside the canyon
  addSpot(-350 * RS, g(-350 * RS, 1800 * RS) + 24, 1800 * RS);      // the lake island
  addSpot(0, W + 12, half - 1420 * RS);                             // low over the harbour water
  addSpot(200, g(200, half - 0.8 * TUNE.routeLength) + 45, half - 0.8 * TUNE.routeLength);   // desert
  addSpot(-500, g(-500, half * 0.35) + 40, half * 0.35);            // farmland
  addSpot(340, g(340, 500) + 30, 500);                              // over the railway (TRAIN_X, declared later)
  addSpot(600, g(600, -half * 0.3) + 60, -half * 0.3);              // out over the plains
})();
function lightSpot(s, quiet) {
  s.lit = true;
  s.mesh.material = spotMatLit;
  s.mesh.scale.setScalar(1.4);
  s.beam.visible = true;
  if (!quiet) { chime(); sparkleBurst(); flags.spots = (flags.spots || 0) + 1; }
}
function updateSpots(dt) {
  const inFlight = (state.phase === "AIRBORNE" || state.phase === "CLIMB_AWAY") && !state.exploding;
  for (const s of spots) {
    s.mesh.rotation.y += dt * (s.lit ? 0.6 : 2.2);
    s.mesh.rotation.x += dt * 0.7;
    if (!s.lit) s.mesh.position.y = s.y + Math.sin(frameCount * 0.05 + s.x) * 1.5;
    if (s.lit || !inFlight) continue;
    const dx = state.x - s.x, dy = state.y - s.y, dz = state.z - s.z;
    if (dx * dx + dy * dy + dz * dz < 16 * 16) {
      lightSpot(s, false);
      try { localStorage.setItem("lp.spots", JSON.stringify(spots.map(q => q.lit ? 1 : 0))); } catch (err) {}
    }
  }
}
function restoreSpots() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem("lp.spots") || "null"); } catch (err) {}
  if (!Array.isArray(saved) || saved.length !== spots.length) return;
  if (saved.every(Boolean)) { try { localStorage.removeItem("lp.spots"); } catch (err) {} return; }   // all found: start fresh
  saved.forEach((v, i) => { if (v) lightSpot(spots[i], true); });
}

// Night windows: little lit squares on every tall landmark box, only visible
// after dark. Built once from the solids the landmarks registered.
const windowMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false, transparent: true, opacity: 0 });
const windowInst = (() => {
  const cells = [];
  for (const L of ROUTE_LANDMARKS) {
    let perLandmark = 0;
    if (L.g.userData.bridgeDeckY) continue;   // bridge towers have no windows
    for (const p of L.g.userData.pending || []) {
      if (perLandmark >= 600) break;           // spread the budget over every landmark
      const h = p.y1 - p.ly0;
      if (h < 24 || !p.mesh || !p.mesh.geometry || !p.mesh.geometry.parameters || p.mesh.geometry.parameters.width === undefined) continue;
      const w = p.mesh.geometry.parameters.width, d = p.mesh.geometry.parameters.depth;
      for (let y = p.ly0 + 5; y < p.y1 - 4; y += 9) {
        for (let x = -w / 2 + 3.5; x < w / 2 - 3; x += 7) {
          if (hashSalt(Math.round(x * 7), Math.round(y * 3), 303) < 0.3) continue;
          cells.push([L.x + p.lx + x, y + L.g.position.y, L.z + p.lz + d / 2 + 0.3, 0]);
          cells.push([L.x + p.lx + x, y + L.g.position.y, L.z + p.lz - d / 2 - 0.3, 0]);
          perLandmark += 2;
        }
        for (let z = -d / 2 + 3.5; z < d / 2 - 3; z += 7) {
          if (hashSalt(Math.round(z * 7), Math.round(y * 3), 304) < 0.3) continue;
          cells.push([L.x + p.lx + w / 2 + 0.3, y + L.g.position.y, L.z + p.lz + z, 1]);
          cells.push([L.x + p.lx - w / 2 - 0.3, y + L.g.position.y, L.z + p.lz + z, 1]);
          perLandmark += 2;
        }
      }
      if (cells.length > 4000) break;
    }
  }
  const n = Math.min(cells.length, 4000);
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(3.4, 4, 0.2), windowMat, Math.max(1, n));
  const d = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    const c = cells[i];
    d.position.set(c[0], c[1], c[2]); d.rotation.set(0, c[3] ? Math.PI / 2 : 0, 0); d.updateMatrix();
    inst.setMatrixAt(i, d.matrix);
  }
  inst.count = n;
  inst.visible = false;
  inst.frustumCulled = false;   // bound would be the single origin box: the whole set vanished off-centre
  scene.add(inst);
  return inst;
})();

// Gates: under every suspension bridge, inside the canyon, and one that rides
// with the locomotive (placed after the train is built, below).
for (const L of ROUTE_LANDMARKS) {
  const deckY = L.g.userData.bridgeDeckY;
  if (!deckY) continue;
  const groundY = Math.max(terrainEff(L.x, L.z), TUNE.waterLevel);
  // Legal air under a deck: >= terrainClearance above the water, and clear of
  // the deck collider (deck box is 4.5 thick, PRAD 3). The hoop is centred on
  // that band, and only exists if the band is comfortably wide.
  const bottom = groundY + TUNE.terrainClearance + 1;
  const top = L.g.position.y + deckY - 2.25 - 3.5;
  if (top - bottom < 10) continue;
  const hh = (top - bottom) / 2;
  const gate = addGate(L.x, bottom + hh, L.z, 70, hh, null, "bridge:" + (L.name || ""));
  gate.bounceGroup = L.g;
  gate.bounceBaseY = L.g.position.y;
}
{
  const zc = -3800 * ROUTE_SCALE();
  const gy = Math.max(terrainEff(0, zc), TUNE.waterLevel);
  addGate(0, gy + TUNE.terrainClearance + 1 + 30, zc, 42, 30, null, "canyon");   // bottom of the hoop is legal air
}

// ---- airports: a terminal complex beside each runway, on the side away from
// nothing in particular (NY east, CA west) so the two feel different. Every
// building and parked plane is a solid; the apron, taxiways and lights are not.
const airportSpinners = [];
let lightsChase = 0;        // runway edge lights chase during the arrival show
function L_elev(a) { return AIRPORTS[a.idx].elev; }
// Send the apron vehicles out to the plane (after a landing) or home (takeoff roll).
function apronVehiclesTo(idx, toPlane) {
  const a = airports.find(r => r.idx === idx);
  if (!a) return;
  a.vehicles.forEach((v, i) => {
    if (toPlane) {
      // start on the parallel taxiway abeam the plane so the drive-in is short
      // wherever he stopped, then pull up beside it (for the rocket: from the pad's hangar road)
      if (state.vp.rocket) { v.x = state.x + a.m * 20; v.z = state.z + 60 + i * 12; }
      else { v.x = a.m * 88; v.z = state.z + (i ? -40 : 40); }
      v.tx = state.x + a.m * (12 + i * 6); v.tz = state.z + (i ? -10 : 8);
    } else { v.tx = v.homeX; v.tz = v.homeZ; }
  });
}
// The arrival show: fireworks over the terminal, edge lights chasing.
const fireworkColors = [0xff3b6b, 0xffd23e, 0x3ad1ff, 0x7cff5a, 0xff7ab8, 0xffffff];
let fwQueue = [];
function arrivalShow(idx) {
  const a = airports.find(r => r.idx === idx);
  if (!a) return;
  lightsChase = 5;
  for (let i = 0; i < 7; i++) {
    fwQueue.push({ t: 0.3 + i * 0.55, x: a.m * (150 + (rnd() - 0.5) * 160), y: L_elev(a) + 70 + rnd() * 50, z: a.cz + (rnd() - 0.5) * 300, c: fireworkColors[i % fireworkColors.length] });
    fireworkSound(0.3 + i * 0.55 - 1.0 > 0 ? i * 0.55 - 0.7 : 0);
  }
}
function updateFireworks(dt) {
  if (!fwQueue.length) return;
  for (const f of fwQueue) f.t -= dt;
  const due = fwQueue.filter(f => f.t <= 0);
  if (due.length) flags.fireworks = (flags.fireworks || 0) + due.length;
  fwQueue = fwQueue.filter(f => f.t > 0);
  for (const f of due) {
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2, b = (rnd() - 0.5) * Math.PI;
      wakePuff(f.x + Math.cos(a) * Math.cos(b) * 3, f.y + Math.sin(b) * 3, f.z + Math.sin(a) * Math.cos(b) * 3, f.c, 1.6, Math.sin(b) * 14, 1.3);
    }
    if (a_beaconFlash) a_beaconFlash(1);
  }
}
let a_beaconFlash = null;
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
  const cab = lmBox(g, 15, 6, 15, 0x2f3a48, m * 150, 45, 260, true);
  cab.material = new THREE.MeshLambertMaterial({ color: 0x2f3a48 });   // own material: it flashes on a fly-by
  lmBox(g, 17, 1, 17, 0x8a93a0, m * 150, 48.5, 260, false);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4030, fog: false }));
  beacon.position.set(m * 150, 50.5, 260);
  g.add(beacon);
  blinkers.push(beacon);
  const rec = { idx, cz: ap.cz, m, beacon, cab, doors: [], sock: null, buzz: 0, doorOpen: 0, flyby: 0, vehicles: [] };
  airports.push(rec);
  addSpot(m * 150, ap.elev + 66, ap.cz + 260);   // sparkle spot above the control tower
  // apron vehicles: a fuel truck and a baggage cart that drive out to the plane
  const part = (parent, geo, color, x, y, z, rx) => { const mm = new THREE.Mesh(geo, lam(color)); mm.position.set(x, y, z); if (rx) mm.rotation.x = rx; parent.add(mm); return mm; };
  const truck = new THREE.Group();
  part(truck, new THREE.BoxGeometry(3.2, 2.6, 7), 0xffd23e, 0, 1.8, 0);
  part(truck, new THREE.BoxGeometry(3, 2.2, 2.2), 0x2f3a48, 0, 1.6, 4.3);
  part(truck, new THREE.CylinderGeometry(1.2, 1.2, 5.5, 10), 0xeef1f4, 0, 3.6, -0.5, Math.PI / 2);
  const cart = new THREE.Group();
  part(cart, new THREE.BoxGeometry(2.2, 1.8, 3), 0x36c46a, 0, 1.2, 0);
  for (const dz of [-3.6, -7]) part(cart, new THREE.BoxGeometry(2, 1.4, 2.6), 0x8a93a0, 0, 1, dz);
  for (const v of [truck, cart]) { v.position.set(m * 180, 0.5, v === truck ? 120 : 160); scene.add(v); }
  rec.vehicles.push({ mesh: truck, homeX: m * 180, homeZ: 120, x: m * 180, z: 120, tx: m * 180, tz: 120 },
                    { mesh: cart, homeX: m * 180, homeZ: 160, x: m * 180, z: 160, tx: m * 180, tz: 160 });
  // hangars with arched roofs
  for (const z of [-300, -370]) {
    lmBox(g, 56, 14, 44, 0xb0b6bf, m * 215, 7, z, true);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 56, 12, 1, false, 0, Math.PI), lam(0x8f96a0));
    roof.rotation.set(0, 0, Math.PI / 2);   // cylinder axis -> x: the arch spans the 56 m width
    roof.position.set(m * 215, 14, z);
    g.add(roof);
    g.userData.pending.push({ lx: m * 215, ly0: 14, lz: z, hw: 28, hd: 22, y1: 36, mesh: roof });
    const door = lmBox(g, 40, 10, 1, 0x3c4350, m * (215 - 28 * m), 5, z, false);
    door.userData.baseX = door.position.x;
    rec.doors.push(door);
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
  rec.sock = sock;

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
  // launch complex on the far side (SLC-40 style): concrete pad, launch mount over a
  // flame trench with a deflector, the strongback that swings away at ignition, four
  // lightning towers, a water tower for the deluge, the integration hangar at the base
  {
    const P = TUNE.rocketTune.pad, px = -m * P.dx, pz = P.dz, H = P.mountH;
    lmBox(g, 96, 0.3, 96, 0x9a9ea6, px, 0.15, pz, false);                       // pad
    lmBox(g, 14, 0.2, 70, 0x2a2e34, px, 0.45, pz + 22, false);                  // flame trench
    for (let z = 0; z < 60; z += 12) lmBox(g, 15, 0.3, 1, 0x5d6269, px, 0.5, pz + 8 + z, false);   // trench grating
    const defl = lmBox(g, 12, 1.4, 14, 0x555a62, px, 1.4, pz + 12, false);       // flame deflector ramp
    defl.rotation.x = -0.55;
    lmBox(g, 16, 1.2, 16, 0x6b7078, px, H - 0.6, pz, true);                     // launch mount (its top is the pad floor)
    for (const [cx, cz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) lmBox(g, 2.4, H - 1.2, 2.4, 0x5a5f66, px + cx, (H - 1.2) / 2, pz + cz, false);
    lmBox(g, 0.5, 1.4, 0.5, 0xff7a1a, px - 7.5, H + 0.7, pz - 7.5, false);       // hold-down clamps
    lmBox(g, 0.5, 1.4, 0.5, 0xff7a1a, px + 7.5, H + 0.7, pz - 7.5, false);
    const sb = new THREE.Group();                                                // strongback (TEL), hinged at its base
    sb.position.set(px, 0, pz - 7);
    const part = (w, h, d, c, x, y, z) => { const mm = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c)); mm.position.set(x, y, z); sb.add(mm); return mm; };
    part(4.5, 22, 3, 0x3c4350, 0, 11, 0);
    for (let y = 3; y < 22; y += 4.5) part(5.2, 0.5, 3.6, 0x8a93a0, 0, y, 0);
    part(1.2, 1.2, 5.5, 0xe6eaf0, 0, 8, 3.2); part(1.2, 1.2, 5.5, 0xe6eaf0, 0, 15, 3.2);   // umbilical arms toward the rocket
    part(6, 0.8, 6, 0x2f3a48, 0, 0.4, -1);
    g.add(sb);
    rec.strongback = sb;
    for (const [cx, cz] of [[-42, -42], [42, -42], [-42, 42], [42, 42]]) {      // lightning towers
      lmCyl(g, 0.9, 1.6, 40, 0xe6eaf0, px + cx, 20, pz + cz, 8, true);
      lmBox(g, 1.6, 1.6, 1.6, 0xd71920, px + cx, 40.8, pz + cz, false);
    }
    lmCyl(g, 1.4, 1.4, 16, 0x8a93a0, px - m * 44, 8, pz - 70, 8, false);       // water tower
    lmCyl(g, 6, 6, 9, 0xeef1f4, px - m * 44, 20.5, pz - 70, 14, true);
    lmBox(g, 40, 13, 56, 0xd8dde4, px, 6.5, pz + 110, true);                    // integration hangar
    lmBox(g, 30, 10, 1, 0x3c4350, px, 5, pz + 81.5, false);
    lmBox(g, 8, 0.2, 60, 0x5e636b, px, 0.42, pz + 52, false);                   // road from the hangar to the pad
    // pad edge lights: their own material so they can strobe through the countdown
    const padLightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, fog: false });
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2;
      const lt = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.2), padLightMat);
      lt.position.set(px + Math.cos(a) * 46, 0.9, pz + Math.sin(a) * 46); g.add(lt);
    }
    rec.padLightMat = padLightMat;
    // the catch tower ("Mechazilla"): a tall lattice with two arms that close on a Super Heavy booster
    {
      const C = TUNE.rocketTune.catch, tz = pz + C.dz - 18;
      lmBox(g, 6, 62, 6, 0x3c4350, px, 31, tz, true);
      for (let y = 6; y < 62; y += 8) lmBox(g, 7, 0.5, 7, 0x8a93a0, px, y, tz, false);
      lmBox(g, 8, 2, 8, 0x2f3a48, px, C.armY + 1.5, tz, false);
      const arms = [];
      for (const sx of [-1, 1]) {
        const hinge = new THREE.Group(); hinge.position.set(px + sx * 3.2, C.armY, tz + 3.5);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 22), lam(0x1f2328)); arm.position.set(sx * 1.1, 0, 11); hinge.add(arm);
        const pad2 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 4), lam(0xffd23e)); pad2.position.set(sx * 0.4, 0, 20); hinge.add(pad2);
        hinge.rotation.y = sx * 0.55;
        g.add(hinge); arms.push(hinge);
      }
      rec.catchArms = arms; rec.catchClosed = false;
      // the catch-zone glow: the column of air the booster drops into. Off unless
      // one is actually coming down, so the pad is not permanently lit up.
      const TC = TUNE.towerCatch;
      const zone = new THREE.Mesh(new THREE.CylinderGeometry(TC.glowR, TC.glowR, TC.glowH, 20, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x5ff1ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, fog: false }));
      zone.position.set(px, C.armY + TC.glowH / 2, tz + 14);
      zone.visible = false;
      g.add(zone);
      rec.catchZone = zone;
      // a ladder of lights up the tower, to sweep after a catch
      rec.catchLights = [];
      for (let y = 8; y < 60; y += 5) {
        const lt = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 1.4),
          new THREE.MeshBasicMaterial({ color: 0x2a2f38, fog: false }));
        lt.position.set(px + 3.6, y, tz);
        g.add(lt);
        rec.catchLights.push(lt);
      }
    }
    rec.padX = px; rec.padZ = ap.cz + pz;
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
// Buzz the airport: low over the apron and the beacon strobes, the windsock
// whips, the hangar doors slide open. Everything eases back when he leaves.
let beaconFlashT = 0;
a_beaconFlash = (t) => { beaconFlashT = t; };
function updateAirports(dt) {
  for (const s of airportSpinners) s.rotation.y += dt * 0.9;
  updateFireworks(dt);
  if (beaconFlashT > 0) { beaconFlashT -= dt; for (const a of airports) a.beacon.visible = Math.floor(beaconFlashT * 14) % 2 === 0; }
  const agl = state.y - Math.max(terrainEff(state.x, state.z), TUNE.waterLevel);
  for (const a of airports) {
    const near = Math.abs(state.z - a.cz) < 520 && Math.abs(state.x - a.m * 170) < 330 && agl < 70 &&
      (state.phase === "AIRBORNE" || state.phase === "CLIMB_AWAY");
    a.buzz += ((near ? 1 : 0) - a.buzz) * Math.min(1, (near ? 6 : 1.2) * dt);
    a.beacon.userData.override = a.buzz > 0.05 || beaconFlashT > 0;
    if (a.buzz > 0.05) {
      a.beacon.visible = Math.sin(frameCount * 0.9) > 0;      // fast strobe overrides the slow blink
      a.sock.rotation.y = Math.sin(frameCount * 0.35) * 0.8 * a.buzz;
      a.sock.rotation.z = Math.PI / 2 + Math.sin(frameCount * 0.5) * 0.25 * a.buzz;
    }
    for (const d of a.doors) d.position.x = d.userData.baseX + a.m * 30 * a.buzz;
    // fly-by: pass close to the tower and its cab lights flash
    const tdx = state.x - a.m * 150, tdz = state.z - (a.cz + 260), tdy = state.y - (L_elev(a) + 45);
    const closeTower = tdx * tdx + tdz * tdz + tdy * tdy < 110 * 110 && state.phase === "AIRBORNE";
    if (closeTower && a.flyby <= 0) a.flyby = 2.5;
    if (a.flyby > 0) { a.flyby -= dt; a.cab.material.color.setHex(Math.floor(a.flyby * 8) % 2 ? 0xfff3a8 : 0x2f3a48); if (a.flyby <= 0) a.cab.material.color.setHex(0x2f3a48); }
    // apron vehicles drive to their target (the parked plane or home)
    for (const v of a.vehicles) {
      const dx = v.tx - v.x, dz = v.tz - v.z, d = Math.hypot(dx, dz);
      if (d > 0.5) {
        const step = Math.min(d, 34 * dt);
        v.x += dx / d * step; v.z += dz / d * step;
        v.mesh.rotation.y = Math.atan2(dx, dz);
      }
      v.mesh.position.set(v.x, terrainEff(v.x, v.z) + 0.5, v.z);
    }
  }
  if (lightsChase > 0) {
    lightsChase -= dt;
    edgeLightMat.color.setHex(Math.floor(lightsChase * 10) % 2 ? 0xffd23e : 0x3fdc6a);
    if (lightsChase <= 0) edgeLightMat.color.setHex(0xfff2b0);
  }
  // casino lights: steady gold, but wild colour cycling when he's close
  if (casinoLights.length) {
    const c0 = casinoLights[0];
    const dx = state.x - c0.userData.wx, dz = state.z - c0.userData.wz;
    const close = dx * dx + dz * dz < 420 * 420;
    for (let i = 0; i < casinoLights.length; i++) {
      const l = casinoLights[i];
      l.material.color.setHex(close ? [0xff3b6b, 0x3ad1ff, 0xffd23e, 0x7cff5a][(i + Math.floor(frameCount * 0.25)) % 4] : 0xffd23e);
    }
  }
}

// ---- shootable targets: hot-air balloons drifting along the route, a blimp
// cruising it end to end, a UFO zig-zagging over the desert, and boats on the
// great lake. A missile (or the plane) pops them; they come back a few seconds
// later somewhere else. Nothing is counted, nothing is lost.
const targets = [];
const TARGET_HIT_R = { balloon: 11, blimp: 17, ufo: 12, boat: 9, flock: 15, kite: 9, disc: 11 };
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
  const stripe = new THREE.Mesh(new THREE.SphereGeometry(6.05, 12, 8, 0, Math.PI * 2, 1.2, 0.8), new THREE.MeshLambertMaterial({ color: 0xe0483e }));
  stripe.scale.set(1, 1, 3.2); g.add(stripe);
  g.userData.glow = stripe;   // lit up at night
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
// A V of seven paper planes gliding together (no living things in this game);
// pops into a puff of paper.
function makeFlock() {
  const g = new THREE.Group();
  const mat = lam(0xf4f6f8), edge = lam(0xd4d9e0);
  for (let i = 0; i < 7; i++) {
    const k = i === 0 ? 0 : Math.ceil(i / 2), side = i % 2 ? -1 : 1;
    const plane = new THREE.Group();
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 3.2), mat);
      wing.position.set(s * 1.1, 0, 0); wing.rotation.z = s * 0.35; plane.add(wing);
      wing.userData.side = s;
    }
    const keel = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 3.2), edge);
    keel.position.y = -0.45; plane.add(keel);
    plane.position.set(side * k * 3.4, -k * 0.5, k * 3.6);
    g.add(plane);
  }
  return g;
}
// A diamond kite on a string with a tail, bobbing over its anchor.
function makeKite(color) {
  const g = new THREE.Group();
  const sail = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 0.15), lam(color));
  sail.rotation.z = Math.PI / 4; sail.scale.y = 1.4; g.add(sail);
  const spar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 7.2, 0.2), lam(0x3c3a36)); g.add(spar);
  for (let i = 0; i < 5; i++) {
    const bow = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.1), lam(i % 2 ? 0xffd23e : 0xf2f4f7));
    bow.position.set(Math.sin(i * 1.3) * 0.8, -4.5 - i * 1.6, 0); bow.rotation.z = i * 0.7; g.add(bow);
  }
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 40, 4), lam(0xe8e8e8));
  string.position.set(0, -20, 6); string.rotation.x = 0.3; g.add(string);
  return g;
}
// A bullseye on a pole -- the archery-range classic, big and satisfying.
function makeDisc() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 24, 8), lam(0x8a93a0));
  pole.position.y = -12; g.add(pole);
  for (const [r, col, dz] of [[9, 0xe0483e, 0], [6.2, 0xf2f4f7, 0.35], [3.4, 0xe0483e, 0.7], [1.2, 0xffd23e, 1.05]]) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.6, 24), new THREE.MeshLambertMaterial({ color: col }));
    ring.rotation.x = Math.PI / 2; ring.position.z = dz; g.add(ring);
  }
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
    const y = Math.max(terrainEff(x, z), TUNE.waterLevel) + 90 + rnd() * 80;
    const dpx = x - state.x, dpy = y - state.y, dpz = z - state.z;
    if (dpx * dpx + dpy * dpy + dpz * dpz < 300 * 300) continue;   // never pop into existence on the plane
    let inside = false;
    forEachSolid(b => { if (!inside && Math.abs(x - b.x) < b.hw + 12 && Math.abs(z - b.z) < b.hd + 12 && y > b.y0 - 12 && y < b.y1 + 12) inside = true; });
    if (inside) continue;
    t.x = x; t.z = z; t.y = y;
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
function placeFlock(t) {
  const half = ROUTE_HALF();
  for (let tries = 0; tries < 30; tries++) {
    // farmland and plains (route fraction 0.24 - 0.56) and the coast strips
    const p = 0.24 + rnd() * 0.32;
    t.cz = half - p * TUNE.routeLength; t.cx = (rnd() - 0.5) * 1400;
    if (inCorridor(t.cx, t.cz, 300)) continue;
    break;
  }
  t.orbit = 90 + rnd() * 120; t.speed = 0.25 + rnd() * 0.15; t.t = rnd() * 100; t.alt = 35 + rnd() * 30;
  t.x = t.cx + Math.cos(t.t * t.speed) * t.orbit; t.z = t.cz + Math.sin(t.t * t.speed) * t.orbit;
  t.y = Math.max(terrainEff(t.x, t.z), TUNE.waterLevel) + t.alt;
}
function placeKite(t) {
  const half = ROUTE_HALF();
  for (let tries = 0; tries < 30; tries++) {
    const p = 0.05 + rnd() * 0.9;
    const z = half - p * TUNE.routeLength, x = (rnd() < 0.5 ? -1 : 1) * (250 + rnd() * 500);
    if (inCorridor(x, z, 200) || terrainEff(x, z) < TUNE.waterLevel + 2) continue;
    t.ax = x; t.az = z; t.ay = terrainEff(x, z); break;
  }
  t.alt = 28 + rnd() * 22; t.t = rnd() * 100;
  t.x = t.ax; t.z = t.az; t.y = t.ay + t.alt;
}
function placeDisc(t) {
  const half = ROUTE_HALF();
  for (let tries = 0; tries < 40; tries++) {
    const p = 0.08 + rnd() * 0.84;
    const z = half - p * TUNE.routeLength, x = (rnd() < 0.5 ? -1 : 1) * (120 + rnd() * 600);
    if (inCorridor(x, z, 200) || terrainEff(x, z) < TUNE.waterLevel + 2) continue;
    let inside = false;
    forEachSolid(b => { if (!inside && Math.abs(x - b.x) < b.hw + 14 && Math.abs(z - b.z) < b.hd + 14) inside = true; });
    if (inside) continue;
    t.x = x; t.z = z; t.y = terrainEff(x, z) + 24; break;
  }
  rnd();   // (keeps the deterministic sequence stable)
  t.mesh.rotation.y = 0;   // always face along the route -- edge-on discs are invisible
}
function placeBoat(t) {
  const RS = ROUTE_SCALE();
  // great lake (lakeShape): the water is a ring around a central island, so the
  // boats orbit at ~75% of the lake's radii where it is deepest.
  t.cx = -350 * RS; t.cz = 1800 * RS;
  // Try orbit sizes from the outer rim inward and keep the first one that is
  // under water at every sample point.
  let k = 0.9;
  for (let kk = 0.94; kk >= 0.6; kk -= 0.02) {
    let wet = true;
    for (let a = 0; a < Math.PI * 2 && wet; a += Math.PI / 12) {
      if (terrainEff(t.cx + Math.cos(a) * 640 * RS * kk, t.cz + Math.sin(a) * 420 * RS * kk) > TUNE.waterLevel - 1.5) wet = false;
    }
    if (wet) { k = kk - 0.01 * rnd() * 2; break; }
  }
  t.orbitX = 640 * RS * k; t.orbitZ = 420 * RS * k;
  t.speed = 0.05 + rnd() * 0.04; t.t = rnd() * 100;
  t.x = t.cx + Math.cos(t.t * t.speed) * t.orbitX; t.z = t.cz + Math.sin(t.t * t.speed) * t.orbitZ; t.y = TUNE.waterLevel + 0.4;
}
// Called from main.js once `state` exists (placement keeps balloons off the plane).
function initTargets() {
  for (let i = 0; i < 8; i++) addTarget("balloon", makeBalloon(balloonPalette[i % balloonPalette.length]), placeBalloon);
  addTarget("blimp", makeBlimp(), placeBlimp);
  addTarget("blimp", makeBlimp(), placeBlimp);
  addTarget("ufo", makeUfo(), placeUfo);
  for (let i = 0; i < 5; i++) addTarget("boat", makeBoat([0xf2f4f7, 0xe0483e, 0x1c75bc, 0xffd23e, 0x36c46a][i]), placeBoat);
  for (let i = 0; i < 4; i++) addTarget("flock", makeFlock(), placeFlock);
  for (let i = 0; i < 5; i++) addTarget("kite", makeKite([0xe0483e, 0x3aa0ff, 0xffd23e, 0x36c46a, 0xff7ab8][i]), placeKite);
  for (let i = 0; i < 8; i++) addTarget("disc", makeDisc(), placeDisc);
}

function killTarget(t, hx, hy, hz, byPlane) {
  t.alive = false;
  t.mesh.visible = false;
  t.respawn = 6 + rnd() * 4;
  flags.targets++;
  const soft = t.kind === "balloon" || t.kind === "flock" || t.kind === "kite";
  triggerExplosion(hx, hy, hz, soft ? 0.45 : 0.8, state.exploding || (soft && !byPlane));
  if (t.kind === "balloon" || t.kind === "ufo" || t.kind === "disc") sparkleBurst();
  // every target has its own voice
  if (t.kind === "disc") gong();
  else if (t.kind === "boat") { splash(); splashAt(t.x, t.y, t.z, 1.4); }
  else if (t.kind === "kite") flutter();
  else if (t.kind === "flock") rustle();
  else if (t.kind === "blimp") deepPop();
  else if (t.kind === "ufo") sciFi();
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
      if (!(t.zip > 0)) {
        const dx = t.x - state.x, dy = t.y - state.y, dz = t.z - state.z;
        if (dx * dx + dy * dy + dz * dz < 150 * 150) { t.zip = 2.5; sciFi(); flags.hellos = (flags.hellos || 0) + 1; }
      }
      if (t.zip > 0) { t.zip -= dt; t.t += dt * 5; }
      t.x = t.cx + Math.sin(t.t * 0.9) * 320;
      t.z = t.cz + Math.sin(t.t * 0.55) * 260;
      t.y = 150 + Math.sin(t.t * 1.7) * 35;
      t.mesh.position.set(t.x, t.y, t.z);
      t.mesh.rotation.y += dt * 4;
      t.mesh.rotation.z = Math.cos(t.t * 0.9) * 0.25;
      if (t.mesh.userData.lights) t.mesh.userData.lights.material.color.setHex(Math.floor(t.t * 4) % 2 ? 0x3fdc6a : 0xff4030);
    } else if (t.kind === "flock") {
      t.x = t.cx + Math.cos(t.t * t.speed) * t.orbit;
      t.z = t.cz + Math.sin(t.t * t.speed) * t.orbit;
      const gy = Math.max(terrainEff(t.x, t.z), TUNE.waterLevel) + t.alt;
      t.y += (gy - t.y) * Math.min(1, 2 * dt);
      t.mesh.position.set(t.x, t.y + Math.sin(t.t * 1.1) * 2, t.z);
      const vx = -Math.sin(t.t * t.speed), vz = Math.cos(t.t * t.speed);
      t.mesh.rotation.y = Math.atan2(vx, vz) + Math.PI;
      // paper planes wobble gently rather than flap
      const wob = Math.sin(t.t * 2.2) * 0.12;
      for (const plane of t.mesh.children) plane.rotation.z = wob + Math.sin(t.t * 1.7 + plane.position.x) * 0.08;
    } else if (t.kind === "kite") {
      t.x = t.ax + Math.sin(t.t * 0.7) * 9;
      t.z = t.az + Math.cos(t.t * 0.5) * 6;
      t.y = t.ay + t.alt + Math.sin(t.t * 1.3) * 3;
      t.mesh.position.set(t.x, t.y, t.z);
      t.mesh.rotation.z = Math.sin(t.t * 0.9) * 0.3;
      t.mesh.rotation.x = 0.35 + Math.sin(t.t * 0.6) * 0.1;
    } else if (t.kind === "disc") {
      // static; nothing to do
    } else if (t.kind === "boat") {
      t.x = t.cx + Math.cos(t.t * t.speed) * t.orbitX;
      t.z = t.cz + Math.sin(t.t * t.speed) * t.orbitZ;
      t.mesh.position.set(t.x, t.y + Math.sin(t.t * 1.3) * 0.15, t.z);
      // bow points along the direction of travel
      const vx = -Math.sin(t.t * t.speed) * t.orbitX, vz = Math.cos(t.t * t.speed) * t.orbitZ;
      t.mesh.rotation.y = Math.atan2(vx, vz);
      t.mesh.rotation.z = Math.sin(t.t * 1.1) * 0.05;
    }
    // a close pass gets a hello: boats sound their horn, balloons squeak and wobble
    if (t.hello > 0) t.hello -= dt;
    if ((state.phase === "AIRBORNE" || state.phase === "CLIMB_AWAY") && !state.exploding && !(t.hello > 0)) {
      const hx = t.x - state.x, hy = t.y - state.y, hz = t.z - state.z;
      const hd2 = hx * hx + hy * hy + hz * hz;
      if (t.kind === "boat" && hd2 < 70 * 70) { t.hello = 8; boatHorn(); flags.hellos = (flags.hellos || 0) + 1; }
      else if (t.kind === "balloon" && hd2 < 45 * 45) { t.hello = 6; squeak(); t.wobble = 1.2; }
    }
    if (t.wobble > 0) { t.wobble -= dt; t.mesh.rotation.z = Math.sin(t.t * 12) * 0.25 * t.wobble; }
    // flying into one is a mid-air, same as traffic
    if ((state.phase === "AIRBORNE" || state.phase === "CLIMB_AWAY") && !state.exploding) {
      const dx = t.x - state.x, dy = t.y - state.y, dz = t.z - state.z;
      if (dx * dx + dy * dy + dz * dz < (t.r + 3) * (t.r + 3)) {
        killTarget(t, (t.x + state.x) / 2, (t.y + state.y) / 2, (t.z + state.z) / 2, true);
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
  g.z = trainHead - 26;   // just ahead of the locomotive, clear of its collider
  g.y = terrainEff(TRAIN_X, g.z) + 6 + 42;
});

// locomotive headlight (a lit cone that only shows at night)
const trainLamp = new THREE.Mesh(new THREE.ConeGeometry(1.2, 6, 8), new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false, transparent: true, opacity: 0 }));
trainLamp.rotation.x = -Math.PI / 2;
trainLamp.visible = false;
scene.add(trainLamp);
let trainTootT = 0;
function updateTrain(dt, px, pz) {
  const mid = (TRAIN_ZMIN + TRAIN_ZMAX) / 2;
  trainTootT -= dt;
  {
    const dx = px - TRAIN_X, dz = pz - trainHead;
    if (trainTootT <= 0 && dx * dx + dz * dz < 160 * 160 && state.phase === "AIRBORNE") { toot(); trainTootT = 9; flags.hellos = (flags.hellos || 0) + 1; }
  }
  trainSolids.length = 0;
  if (Math.abs(pz - mid) > 2800 || Math.abs(px - TRAIN_X) > 2800) return;
  trainHead -= TUNE.trainSpeed * dt;
  if (trainHead < TRAIN_ZMIN) { trainHead = TRAIN_ZMAX; trainCarGone.fill(false); }
  const dummyT = dummyObj;
  for (let i = 0; i < TRAIN_CARS; i++) {
    const cz = trainHead + i * 17;
    if (cz > TRAIN_ZMAX || trainCarGone[i]) {
      // Not on the track yet: park the instance out of sight instead of leaving
      // its previous matrix frozen where the car used to be.
      dummyT.position.set(0, -9999, 0); dummyT.rotation.set(0, 0, 0); dummyT.scale.setScalar(0.001); dummyT.updateMatrix();
      trainInst.setMatrixAt(i, dummyT.matrix);
      continue;
    }
    const gy = terrainEff(TRAIN_X, cz);
    dummyT.position.set(TRAIN_X, gy + 6, cz);
    dummyT.rotation.set(0, 0, 0);
    dummyT.scale.set(1, 1, 1);
    dummyT.updateMatrix();
    trainInst.setMatrixAt(i, dummyT.matrix);
    trainSolids.push({ x: TRAIN_X, z: cz, hw: 4.5, hd: 8.5, y0: gy + 1, y1: gy + 11.5, car: i });
  }
  trainInst.instanceMatrix.needsUpdate = true;
  trainLamp.position.set(TRAIN_X, terrainEff(TRAIN_X, trainHead) + 6, trainHead - 10);
}
// Shot cars leave the train (they come back when it loops round).
const trainCarGone = new Array(TRAIN_CARS).fill(false);
function shootTrainCar(i, hx, hy, hz) {
  if (trainCarGone[i]) return false;
  trainCarGone[i] = true;
  flags.targets++;
  sparkleBurst();
  clang();
  return true;
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
