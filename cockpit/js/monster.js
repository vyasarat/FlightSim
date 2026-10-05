"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- THE MONSTER TRUCK HE DRIVES (v141).
//
// A card in the picker: the blue monster truck, about three times the SUV, with
// wheels taller than a man. He drives it ANYWHERE -- the roads, the fields, the
// cities -- and it steers freely, the way the rover does: no lane keep, no
// junction rule, no road it has to be on. It starts at the monster-truck arena,
// in front of the set-piece's giant truck, nose at its ramp (which is still the
// set-piece's own; this one only drives up it and flies off it).
//
// THE CONTROLS are the car's, one finger: finger down = drive, drag left/right =
// steer, drag up = a burst. Drag DOWN backs it up slowly, so it is never stuck
// against something too big to crush (the rover's own rule). The speed steps
// are the usual pair. No new button, no new HUD.
//
// IT NEVER BANGS. That is the whole feature, and it is the one law (solids.js)
// with a different answer: over its crawl nothing explodes -- what it drives into
// is CRUSHED (a house, a shed, a wall, a container, a parked car, the junk cars)
// or KNOCKED FLYING (traffic on the motorway and in the cities), and whatever is
// too big to crush (a tower, a bridge pier, a ship) simply stops it: a shove,
// and its speed gone. Landing a jump on something small crushes that too.
// Everything it crushed POPS BACK once he has driven away (`popR`, `popAfter`):
// nothing is ever taken away. Machines and structures only -- there is nothing
// living in the registry to crush (birds and gulls are noSolid).
//
// THE GROUND is whatever it would stand on: the terrain, a road deck, a city
// street, the top of anything low enough to roll up on to (`step`), and a ramp's
// surface. It drives UP a ramp and leaves the lip with what the slope gives it.
// WATER is the one place it will not go: the shore stops it, and it backs off.
// ---------------------------------------------------------------------------
const MON = TUNE.monster;
const mon = {
  steer: 0, vy: 0, air: false, pitch: 0, wheelSpin: 0, bounce: 0, bounceV: 0,
  crushed: [], debris: [], debrisMesh: null, cursor: 0, onRamp: null, groundPrev: 0,
  splashT: 0, shake: 0,
};
const monTmp = new THREE.Vector3(), monM = new THREE.Matrix4(), monQ = new THREE.Quaternion(), monS = new THREE.Vector3();

function monActive() { return !!(state.vp && state.vp.monster); }
// No set-piece countdown now (setpieces.js spCountBusy): in the arena, or just after a crush.
function monQuiet() {
  if (!monActive()) return false;
  if ((mon.lastCrushT || 0) > 0) return true;
  if (typeof mtLanding === "function") { const L = mtLanding(); if (Math.hypot(state.x - L.x, state.z - L.z) < TUNE.monsterTruck.monsterQuiet) return true; }
  return false;
}

// ---- the model: the set-piece truck's shapes, its own copy (monstertruck.js
// keeps its truck's parts in globals of its own) -------------------------------
function buildMonsterModel() {
  const P = TUNE.palette;
  const outer = new THREE.Group(), g = new THREE.Group();
  const k = lsKit();
  k.add(P.blue, new THREE.BoxGeometry(3.4, 1.6, 6.6), 0, 3.6, 0);
  // the cab is its own part: from the driving seat it is where he sits, so it is not drawn
  const cab = new THREE.Group(), ck = lsKit();
  ck.add(P.blue, new THREE.BoxGeometry(3.0, 1.4, 3.0), 0, 5.0, -0.6);
  ck.add(P.ink, new THREE.BoxGeometry(3.05, 0.9, 2.2), 0, 5.15, -0.3);         // dark glass, nobody to see
  ck.build(cab, sledPaint);
  g.add(cab);
  k.add(P.warning, new THREE.BoxGeometry(3.5, 0.35, 4.2), 0, 3.9, 1.2);
  // the bonnet, as he sees it from the cab: two yellow racing stripes and a steel scoop
  for (const x of [-0.75, 0.75]) k.add(P.warning, new THREE.BoxGeometry(0.45, 0.06, 3.9), x, 4.43, 1.4);
  k.add(P.steel, new THREE.BoxGeometry(1.1, 0.45, 1.3), 0, 4.62, 1.9);
  k.add(P.ink, new THREE.BoxGeometry(2.6, 0.5, 6.0), 0, 2.4, 0);
  k.add(P.steel, new THREE.BoxGeometry(3.6, 0.4, 0.5), 0, 3.1, 3.5);
  k.add(P.steel, new THREE.BoxGeometry(3.6, 0.4, 0.5), 0, 3.1, -3.5);
  for (const x of [-1, 1]) k.add(P.warning, lsCyl(0.35, 0.35, 0.2, 10), x * 1.1, 3.7, 3.4, Math.PI / 2, 0, 0);
  k.build(g, sledPaint);
  const wheels = [];
  for (const [x, z] of [[-2.3, 2.3], [2.3, 2.3], [-2.3, -2.3], [2.3, -2.3]]) {
    const w = new THREE.Group(), wk = lsKit();
    wk.add(P.ink, lsCyl(1.75, 1.75, 1.4, 16), 0, 0, 0, 0, 0, Math.PI / 2);
    wk.add(P.warning, lsCyl(0.8, 0.8, 1.46, 10), 0, 0, 0, 0, 0, Math.PI / 2);
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      wk.add(P.ink, new THREE.BoxGeometry(1.5, 0.35, 0.55), 0, Math.cos(a) * 1.8, Math.sin(a) * 1.8, a, 0, 0);
    }
    wk.build(w, sledPaint);
    w.position.set(x, 1.75, z);
    g.add(w); wheels.push(w);
  }
  g.rotation.y = Math.PI;              // its nose is +z; the game's forward is -z
  g.scale.setScalar(MON.scale);
  outer.add(g);
  outer.userData.wheels = wheels;
  outer.userData.cab = cab;
  outer.userData.height = 5.8 * MON.scale;
  outer.rotation.order = "YXZ";
  return outer;
}

// ---- where it starts: the arena's run-up, in front of the set-piece's truck,
// nose at the ramp -----------------------------------------------------------
function monSpawn() {
  const T = TUNE.monsterTruck, dx = T.s[0] - T.n[0], dz = T.s[1] - T.n[1], L = Math.hypot(dx, dz);
  const fx = dx / L, fz = dz / L;
  const d = Math.min(T.runUp - 45, 55);
  state.x = T.n[0] + fx * d; state.z = T.n[1] + fz * d;
  state.y = monGround(state.x, state.z, terrainEff(state.x, state.z)).y;
  state.heading = Math.atan2(-fx, -fz);
  state.speed = 0; state.pitch = 0; state.bank = 0; state.phase = "TAXI";
  mon.steer = 0; mon.vy = 0; mon.air = false; mon.pitch = 0; mon.onRamp = null; mon.groundPrev = state.y; mon.lastDry = null;
  monRestoreAll();
  monSnapCamera();
  thunk();
}
// The chase camera starts where it belongs, not wherever the last vehicle left it.
function monSnapCamera() {
  const fx = -Math.sin(state.heading), fz = -Math.cos(state.heading), C = MON.cam;
  camera.position.set(state.x - fx * C.back, state.y + C.up, state.z - fz * C.back);
}

// ---- the ground under it ------------------------------------------------------
// The highest thing at (x, z) it can stand on from `base`: terrain, a road deck,
// a city street, a top within `step`, a ramp's surface. `water` when the ground
// there is under the sea and nothing stands over it.
const monGroundOut = { y: 0, water: false, ramp: null };
function monGround(x, z, base) {
  const o = monGroundOut;
  const t = terrainEff(x, z), sea = seaLevelAt(x, z);
  o.water = t < sea; o.y = o.water ? sea : t; o.ramp = null;
  const reach = base + MON.step;
  // A road he is not level with is not his road (CLAUDE.md): a road is ground
  // only within reach of his wheels -- a city flyover over him he drives under.
  // The one allowance is the MOTORWAY on an embankment, climbed from the land
  // beside it, and only while he is on that land: where the motorway's own
  // survey calls it "ground" (under HW.bridgeAt over the land) -- never a bridge,
  // which stands open on piers and he drives under.
  const road = y => y > o.y - 0.5 && y <= reach;
  if (typeof highway !== "undefined" && highway.built) {
    const n = hwyNearest(x, z);
    const bank = n && n.type !== "bridge" && n.type !== "tunnel" && n.y - t < HW.bridgeAt && base - t < 1.5;
    if (n && Math.abs(n.lateral) < highway.halfW && n.y > o.y - 0.5 && (n.y <= reach || bank)) { o.y = Math.max(o.y, n.y); o.water = false; }
  }
  if (typeof stSurfaceAt === "function") {
    const sy = stSurfaceAt(x, z);
    if (sy !== null && road(sy)) { o.y = Math.max(o.y, sy); o.water = false; }
  }
  forEachSolid(b => {
    if (b.y1 <= o.y || b.y0 > reach || b.car !== undefined || b.park || b.cap || isSolidHidden(b)) return;
    if (Math.abs(x - b.x) > b.hw || Math.abs(z - b.z) > b.hd) return;
    if (b.ramp) {
      const Lr = solidRampLocal(b.ramp, x, base, z, solidRampTmp);
      if (Lr.a < 0 || Lr.a > b.ramp.len || Math.abs(Lr.s) > b.ramp.w / 2) return;
      const top = b.ramp.o[1] + solidRampH(b.ramp, Lr.a);
      if (top <= reach && top > o.y) { o.y = top; o.water = false; o.ramp = b; }
      return;
    }
    if (b.y1 > reach) return;
    if (b.o3 && !solidTestBox3(b.o3, x, b.y1 - 0.3, z, 0.01)) return;
    o.y = b.y1; o.water = false;
  });
  return o;
}

// ---- what it can crush ----------------------------------------------------------
// Small and solid and drawn: a building or wall no taller than crushH, a
// container, a parked car, a junk car. Not a choreographed set-piece part
// (noShatter), not the bore's lining or a quay (no mesh to hide), not a ramp.
const monTopOf = new Map();
function monStand(b) {
  // the whole thing's height: a city building is several tiers on one proxy
  const m = b.mesh;
  if (!m) return b.y1 - b.y0;
  if (monTopOf.has(m)) return monTopOf.get(m);
  let lo = Infinity, hi = -Infinity;
  forEachSolid(o => { if (o.mesh === m) { lo = Math.min(lo, o.y0); hi = Math.max(hi, o.y1); } });
  monTopOf.set(m, hi - lo);
  return hi - lo;
}
function monJunkCar(b) {
  if (typeof mtruck === "undefined") return null;
  return mtruck.cars.find(c => c.solid === b) || null;
}
function monCanCrush(b) {
  if (b.ramp || b.cap) return false;
  if (b.park) return true;
  const jc = monJunkCar(b);
  if (jc) return jc.sq < 0.5;           // already flat: it is ground now, not a thing to crush
  if (b.mesh) {
    if (b.mesh.userData && b.mesh.userData.noShatter) return false;
    return monStand(b) <= MON.crushH;
  }
  if (b.idx !== undefined) return b.y1 - b.y0 <= MON.crushH;
  return false;
}

function monCrush(b) {
  const rec = { b, t: 0, x: b.x, z: b.z, kind: solidKind(b) };
  if (b.park) { if (typeof stKnock === "function") stKnock(b.park); rec.selfRestores = true; monFling(b.x, b.y0, b.z); }
  else if (monJunkCar(b)) {
    const c = monJunkCar(b); mtCarSet(c, 1); rec.junk = c;
    // during the set-piece's own show it is one of the show's flat cars, and
    // the show stands it up again with the rest (monstertruck.js pops every flat one)
    if (mtruck.phase !== "armed") { c.flat = true; rec.selfRestores = true; }
  }
  else if (b.mesh) { b.mesh.visible = false; rec.mesh = b.mesh; }
  else if (b.idx !== undefined) {
    const m = new THREE.Matrix4();
    buildingInst.getMatrixAt(b.idx, m);
    rec.idx = b.idx; rec.mat = m; rec.gen = buildingGen;
    hiddenTownIdx.add(b.idx);
    dummyObj.position.set(0, -9999, 0); dummyObj.scale.setScalar(0.001); dummyObj.updateMatrix();
    buildingInst.setMatrixAt(b.idx, dummyObj.matrix);
    buildingInst.instanceMatrix.needsUpdate = true;
  }
  mon.crushed.push(rec);
  // THE CRUSH READS IN ONE FRAME (v143): the frame he touches it, the thing
  // is gone and in its place stands a cloud of blocks filling its WHOLE shape
  // -- a building-sized heap of pieces -- that bursts outward and tumbles
  // down. Never a single block over a building still standing: the whole of
  // a city building (all its tiers, one stand-in mesh) is what bursts. None
  // starts near his cab (debrisClear), and they fly away from him.
  let x0 = b.x - b.hw, x1 = b.x + b.hw, z0 = b.z - b.hd, z1 = b.z + b.hd, y0 = b.y0, y1 = b.y1;
  if (b.mesh) forEachSolid(o => { if (o.mesh === b.mesh) { x0 = Math.min(x0, o.x - o.hw); x1 = Math.max(x1, o.x + o.hw); z0 = Math.min(z0, o.z - o.hd); z1 = Math.max(z1, o.z + o.hd); y0 = Math.min(y0, o.y0); y1 = Math.max(y1, o.y1); } });
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, R = Math.max(x1 - x0, z1 - z0) / 2, H = Math.max(2, y1 - Math.max(y0, terrainEff(cx, cz)));
  const pal = TUNE.palette, cols = b.park || rec.junk ? [pal.rust, pal.steel, pal.ink]
    : b.idx !== undefined ? [pal.white, pal.red, pal.warning, pal.concrete]
    : [pal.rust, pal.concrete, pal.white, pal.steel, pal.red];
  const n = Math.round(clamp(H * R / 5, 12, MON.burstMax));
  const base = Math.max(y0, terrainEff(cx, cz));
  for (let i = 0; i < n; i++) {
    const px = x0 + rnd() * (x1 - x0), pz = z0 + rnd() * (z1 - z0), py = base + rnd() * H;
    if (Math.hypot(px - state.x, pz - state.z) < MON.debrisClear) continue;
    monDebris(px, py, pz, cols[i % cols.length], cx, cz, R);
  }
  noiseBurst(0.28, 260, 0.45, 0); thunk();
  mon.shake = Math.max(mon.shake, 0.35);
  flags.monCrushes = (flags.monCrushes || 0) + 1;
  mon.lastCrushT = MON.quietAfterCrush;
  flags.monCrushedKinds = flags.monCrushedKinds || {};
  flags.monCrushedKinds[rec.kind] = (flags.monCrushedKinds[rec.kind] || 0) + 1;
}

// Back as it was. False only for a junk car while the set-piece's show is
// running: the show squashes and stands its own cars, so it waits for that.
function monRestore(rec) {
  monClearDebrisNear(rec.x, rec.z, 60);   // it comes back whole: its own pieces go with that
  if (rec.mesh) rec.mesh.visible = true;
  else if (rec.junk) {
    if (typeof mtCarSet !== "function") return true;
    if (mtruck.phase !== "armed") { rec.junk.flat = true; return true; }   // the show's now: it pops every flat car
    mtCarSet(rec.junk, 0); rec.junk.flat = false;
  } else if (rec.idx !== undefined) {
    // by its generation, not by the shared hidden set: opening the picker clears
    // that set (restoreShattered) without putting this matrix back
    if (rec.gen === buildingGen) {
      buildingInst.setMatrixAt(rec.idx, rec.mat);
      buildingInst.instanceMatrix.needsUpdate = true;
    }
    hiddenTownIdx.delete(rec.idx);
  }
  flags.monPops = (flags.monPops || 0) + 1;
  return true;
}
// Everything at once: leaving the monster (any vehicle change), or a new spawn.
// A junk car the show is busy with is the show's.
function monRestoreAll() { for (const r of mon.crushed) if (!r.selfRestores) monRestore(r); mon.crushed.length = 0; }

// ---- the pieces that fly: one instanced draw ------------------------------------
function monDebrisInit() {
  if (mon.debrisMesh) return;
  const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), MON.debris);
  m.frustumCulled = false; m.count = MON.debris;
  for (let i = 0; i < MON.debris; i++) { mon.debris.push({ life: 0, x: 0, y: -1e4, z: 0, vx: 0, vy: 0, vz: 0, s: 1, r: 0 }); m.setColorAt(i, new THREE.Color(0xffffff)); }
  mon.debrisMesh = m; scene.add(m);
}
function monDebris(x, y, z, color, cx, cz, R) {
  monDebrisInit();
  const i = mon.cursor = (mon.cursor + 1) % MON.debris, p = mon.debris[i];
  // burst OUT of what was crushed, from where each piece was in it: away from
  // its middle, up, and carried on the way he is going -- never back at the cab
  const fx = -Math.sin(state.heading), fz = -Math.cos(state.heading);
  let ox = x - (cx === undefined ? x : cx), oz = z - (cz === undefined ? z : cz);
  const ol = Math.hypot(ox, oz) || 1; ox /= ol; oz /= ol;
  if (ox * fx + oz * fz < -0.2) { ox += fx * 0.8; oz += fz * 0.8; }   // the side facing him goes sideways, not at him
  const sp = 4 + rnd() * 9;
  p.life = MON.debrisLife; p.x = x; p.y = y; p.z = z;
  p.vx = ox * sp + fx * Math.max(4, Math.abs(state.speed)) * 0.5;
  p.vz = oz * sp + fz * Math.max(4, Math.abs(state.speed)) * 0.5;
  // a burst, then the heap falls: up a little, and gravity has the rest
  p.vy = 2 + rnd() * 9; p.s = clamp((R || 8) * 0.22, 1, 3.8) * (0.6 + rnd() * 0.8); p.r = rnd() * 6;
  mon.debrisMesh.setColorAt(i, new THREE.Color(color));
  mon.debrisMesh.instanceColor.needsUpdate = true;
}
function monUpdateDebris(dt) {
  if (!mon.debrisMesh) return;
  let live = false;
  mon.debris.forEach((p, i) => {
    if (p.life > 0) {
      live = true;
      p.life -= dt; p.vy -= MON.gravity * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.r += dt * 6;
      const g = terrainEff(p.x, p.z);
      if (p.y < g + p.s * 0.5) { p.y = g + p.s * 0.5; p.vy = Math.abs(p.vy) * 0.25; p.vx *= 0.6; p.vz *= 0.6; }
    }
    const s = p.life > 0 ? p.s * Math.min(1, p.life * 2) : 0.0001;
    monQ.setFromAxisAngle(monTmp.set(0.6, 0.8, 0).normalize(), p.r);
    monM.compose(monTmp.set(p.x, p.life > 0 ? p.y : -1e4, p.z), monQ, monS.set(s, s, s));
    mon.debrisMesh.setMatrixAt(i, monM);
  });
  mon.debrisMesh.instanceMatrix.needsUpdate = live || mon.debrisWasLive;
  mon.debrisWasLive = live;
}
function monClearDebrisNear(x, z, r) { for (const p of mon.debris) if (p.life > 0 && Math.hypot(p.x - x, p.z - z) < r) p.life = 0; }
function monDebrisLive() { return mon.debris.filter(p => p.life > 0).length; }


// ---- a car knocked FLYING: the motorway's traffic and a parked car simply
// vanish when they are hit (they come back later); from the monster they are
// seen to go -- a car thrown up spinning, down again, and gone. A few, reused.
function monFlyerInit() {
  if (mon.flyers) return;
  mon.flyers = [];
  const P = TUNE.palette, cols = [P.red, P.cyan, P.warning, P.green, P.white];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.1, 4.4), new THREE.MeshLambertMaterial({ color: cols[i % cols.length] }));
    body.position.y = 0.9; g.add(body);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 2.2), new THREE.MeshLambertMaterial({ color: P.ink }));
    cab.position.set(0, 1.8, -0.2); g.add(cab);
    g.visible = false; scene.add(g);
    mon.flyers.push({ g, life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, rz: 0 });
  }
  mon.flyerAt = 0;
}
function monFling(x, y, z) {
  monFlyerInit();
  const f = mon.flyers[mon.flyerAt = (mon.flyerAt + 1) % mon.flyers.length];
  const fx = -Math.sin(state.heading), fz = -Math.cos(state.heading), side = rnd() < 0.5 ? -1 : 1;
  f.x = x + fz * side * 5; f.y = y + 2; f.z = z - fx * side * 5; f.life = 3.2;   // already out to the side of the cab
  // up and AHEAD, a little to one side: over the bonnet where he sees it from
  // the seat, and out from behind the cab in the chase view (v143)
  f.vx = fx * (Math.abs(state.speed) + 10) + fz * side * 7; f.vz = fz * (Math.abs(state.speed) + 10) - fx * side * 7; f.vy = 15 + rnd() * 4;
  f.rx = (rnd() - 0.5) * 9; f.rz = side * (5 + rnd() * 4);
  f.g.visible = true; f.g.position.set(f.x, f.y, f.z); f.g.rotation.set(0, state.heading, 0);
  flags.monFlings = (flags.monFlings || 0) + 1;
}
function monUpdateFlyers(dt) {
  if (!mon.flyers) return;
  for (const f of mon.flyers) {
    if (f.life <= 0) continue;
    f.life -= dt;
    f.vy -= MON.gravity * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
    const g = Math.max(terrainEff(f.x, f.z), seaLevelAt(f.x, f.z));
    if (f.y < g) { f.y = g; f.vy = Math.abs(f.vy) * 0.3; f.vx *= 0.5; f.vz *= 0.5; f.rx *= 0.5; f.rz *= 0.5; }
    f.g.position.set(f.x, f.y, f.z);
    f.g.rotation.x += f.rx * dt; f.g.rotation.z += f.rz * dt;
    const s = clamp(f.life * 2, 0, 1);
    f.g.scale.setScalar(s);
    if (f.life <= 0) f.g.visible = false;
  }
}

// ---- the frame --------------------------------------------------------------------
function updateMonster(dt) {
  el.rotateArrow.classList.remove("on");
  state.phase = "TAXI";                // "not flying" -- every surface vehicle's word (vehicles.js)
  monUpdateDebris(dt);
  monUpdateFlyers(dt);
  monUpdatePops(dt);
  if (mon.lastCrushT > 0) mon.lastCrushT -= dt;
  if (state.exploding) return;
  const touching = state.touching && !menuOpen();
  const range = (TUNE.dragRangeX * Math.min(window.innerWidth, window.innerHeight)) / (TUNE.car.dragRangeX * window.innerWidth);
  let bank = touching ? clamp(state.ctrlBank * range, -1, 1) : 0;
  const pitch = touching ? clamp(state.ctrlPitch, -1, 1) : 0;
  if (Math.abs(bank) < MON.steerDead) bank = 0;

  // ---- go, back, burst. The step scales what it aims for.
  const mul = spdMul();
  let want = 0;
  if (touching) want = pitch < -0.35 ? -MON.reverse * mul : (pitch > 0.35 ? MON.burst : MON.cruise) * mul;
  const rate = !touching ? MON.coast : (Math.sign(want - state.speed) === Math.sign(state.speed) || state.speed === 0 ? MON.accel : MON.brake + MON.accel);
  if (!mon.air) {
    const d = want - state.speed, stepV = rate * dt;
    state.speed += Math.abs(d) < stepV ? d : Math.sign(d) * stepV;
    if (!touching && Math.abs(state.speed) < 0.3) state.speed = 0;
  }

  // ---- steer freely, as the rover does: faster turning rolling, slower stopped
  if (!mon.air) {
    const roll = clamp(Math.abs(state.speed) / 8, 0, 1);
    const degS = (MON.turnInPlace + (MON.turnRate - MON.turnInPlace) * roll) * bank;
    state.heading -= degS * DEG * dt * (state.speed < -0.5 ? -1 : 1);
  }
  state.bank += ((mon.air ? 0 : -bank * 5) - state.bank) * Math.min(1, 4 * dt);

  // ---- move, and where it would be: water stops it
  const fx = -Math.sin(state.heading), fz = -Math.cos(state.heading);
  const nx = state.x + fx * state.speed * dt, nz = state.z + fz * state.speed * dt;
  const gAhead = monGround(nx + fx * Math.sign(state.speed) * MON.hullR * 0.6, nz + fz * Math.sign(state.speed) * MON.hullR * 0.6, state.y);
  if (gAhead.water && !mon.air) {
    state.speed *= 0.3;
    if (mon.splashT <= 0) { splash(); mon.splashT = 1.2; flags.monShore = (flags.monShore || 0) + 1; }
  } else { state.x = nx; state.z = nz; }
  if (mon.splashT > 0) mon.splashT -= dt;

  // ---- up and down: the ground, a ramp, the air
  const g = monGround(state.x, state.z, state.y);
  if (mon.air) {
    mon.vy -= MON.gravity * dt;
    state.y += mon.vy * dt;
    if (state.y <= g.y) {
      const hard = -mon.vy;
      state.y = g.y; mon.air = false;
      if (g.water && mon.lastDry) {
        // a jump that came down in the water: a splash, and back on the last dry
        // ground it had, nose to the land -- never stuck on the lake
        splash(); splashAt(state.x, seaLevelAt(state.x, state.z), state.z, 1.4);
        state.x = mon.lastDry.x; state.z = mon.lastDry.z; state.y = mon.lastDry.y;
        state.heading = mon.lastDry.h + Math.PI; state.speed = 0;
        flags.monWaterLandings = (flags.monWaterLandings || 0) + 1;
      }
      if (hard > MON.landCrush) monLandCrush();
      mon.bounceV = -Math.min(1.2, hard * 0.08); mon.vy = 0;
      thunk(); noiseBurst(0.2, 180, Math.min(0.5, hard * 0.03), 0);
      mon.shake = Math.max(mon.shake, Math.min(0.6, hard * 0.04));
      flags.monLandings = (flags.monLandings || 0) + 1;
    }
  } else if (g.y >= state.y - 0.6) {
    // on the ground (or a gentle step down): rides it, and a ramp's rise is its climb
    const rise = (g.y - state.y) / Math.max(dt, 1e-3);
    state.y = g.y;
    mon.vy = g.ramp ? Math.max(0, rise) : 0;
    mon.onRamp = g.ramp;
    if (!g.water) { const L = mon.lastDry || (mon.lastDry = {}); L.x = state.x; L.z = state.z; L.y = state.y; L.h = state.heading; }
  } else {
    // the ground has dropped away: off a lip, off a roof, over a dip -- flying
    mon.air = true;
    if (!mon.onRamp) mon.vy = Math.min(mon.vy, 0);
    flags.monJumps = (flags.monJumps || 0) + (mon.onRamp ? 1 : 0);
    if (mon.onRamp) whoosh();
    mon.onRamp = null;
  }
  // pitch with the slope, or with the flight
  const slopeP = mon.air ? Math.atan2(mon.vy, Math.max(4, Math.abs(state.speed))) : Math.atan2(state.y - mon.groundPrev, Math.max(0.05, Math.abs(state.speed) * dt)) * Math.sign(state.speed || 1);
  mon.pitch += (clamp(slopeP / DEG, -35, 35) - mon.pitch) * Math.min(1, 6 * dt);
  state.pitch = mon.pitch;
  mon.groundPrev = state.y;
  state.airVy = mon.air ? mon.vy : 0;
  forward.set(fx, 0, fz);

  // ---- what it meets: crushed, knocked flying, or (too big) a shove. Never a bang.
  monMeet();
  monTraffic();

  // the springs, the wheels, the voice
  mon.bounceV += (-mon.bounce * 60 - mon.bounceV * 7) * dt; mon.bounce += mon.bounceV * dt;
  mon.wheelSpin += state.speed * dt / (1.75 * MON.scale);
  if (mon.shake > 0) { shakeAmp = Math.max(shakeAmp, mon.shake); mon.shake = Math.max(0, mon.shake - dt * 1.5); }
  setEngine(clamp(0.35 + Math.abs(state.speed) / MON.cruise * 0.6, 0, 1.3));
}

// The column of its body against the registry, a few times a frame (it can be
// against two things at once). Under its wheels is ground (monGround), not a wall.
function monMeet() {
  const skip = new Set();
  for (let k = 0; k < 4; k++) {
    const hit = solidCol(state.x, state.z, state.y + MON.step, state.y + MON.hullH, MON.hullR, SOLID.CAR, b => skip.has(b) || !!b.ramp);
    if (!hit) return;
    skip.add(hit.b);
    solidCount("monster", hit.kind, Math.abs(state.speed) >= MON.crushMinV && monCanCrush(hit.b) ? "crush" : "shove");
    if (Math.abs(state.speed) >= MON.crushMinV && monCanCrush(hit.b)) {
      monCrush(hit.b);
      state.speed *= MON.crushSlow;
      continue;
    }
    // too big (or too slow): it stops against it, pushed out, its speed gone
    const d = hit.d + 0.2;
    state.x += hit.nx * d; state.z += hit.nz * d;
    const into = -(Math.sign(state.speed) * ((-Math.sin(state.heading)) * hit.nx + (-Math.cos(state.heading)) * hit.nz));
    if (into > 0) state.speed *= 0.3;
    if (!mon.bumpT || mon.bumpT <= 0) { noiseBurst(0.14, 200, 0.25, 0); mon.bumpT = 0.4; flags.monShoves = (flags.monShoves || 0) + 1; }
  }
}

// Landing on something small crushes it: whatever is under it within its hull.
function monLandCrush() {
  forEachSolid(b => {
    if (isSolidHidden(b) || !monCanCrush(b)) return;
    if (Math.abs(state.x - b.x) > b.hw + MON.hullR * 0.7 || Math.abs(state.z - b.z) > b.hd + MON.hullR * 0.7) return;
    if (b.y1 < state.y - 1 || b.y0 > state.y + MON.hullH) return;
    monCrush(b);
  });
}

// Traffic, on the motorway and in the cities: knocked spinning away, and back
// later, as every machine he touches is.
function monTraffic() {
  const R = MON.hullR + 3;
  if (typeof hwyTrafficNear === "function") {
    for (let i = 0; i < 3; i++) {
      const t = hwyTrafficNear(state.x, state.z, R);
      if (!t || Math.abs((t.wy !== undefined ? t.wy : state.y) - state.y) > MON.hullH) break;
      monFling(t.wx, state.y, t.wz);
      hwyKnockTraffic(t); noiseBurst(0.2, 300, 0.35, 0); mon.shake = Math.max(mon.shake, 0.25);
      flags.monKnocks = (flags.monKnocks || 0) + 1;
    }
  }
  if (typeof stTraffic !== "undefined") {
    for (const v of stTraffic.list) {
      if (!v.alive || v.spin || v.wx === undefined) continue;
      if (Math.abs(v.wx - state.x) > R || Math.abs(v.wz - state.z) > R) continue;
      if (Math.hypot(v.wx - state.x, v.wz - state.z) > R) continue;
      stKnock(v); noiseBurst(0.2, 300, 0.35, 0); mon.shake = Math.max(mon.shake, 0.25);
      flags.monKnocks = (flags.monKnocks || 0) + 1;
    }
  }
}

// What it crushed pops back once he has driven away from it. Nothing is lost.
function monUpdatePops(dt) {
  if (mon.bumpT > 0) mon.bumpT -= dt;
  for (let i = mon.crushed.length - 1; i >= 0; i--) {
    const r = mon.crushed[i];
    r.t += dt;
    const far = !monActive() || Math.hypot(state.x - r.x, state.z - r.z) > MON.popR;
    if (r.selfRestores) { mon.crushed.splice(i, 1); continue; }
    if (r.t >= MON.popAfter && far && monRestore(r)) mon.crushed.splice(i, 1);
  }
}

// ---- the camera: the chase behind and above, or the seat high in its cab --------
function monCamera(dt) {
  camera.up.set(0, 1, 0);
  const fx = -Math.sin(state.heading), fz = -Math.cos(state.heading), C = MON.cam;
  if (state.viewChase) {
    camDesired.set(state.x - fx * C.back, state.y + C.up, state.z - fz * C.back);
    const gy = Math.max(terrainEff(camDesired.x, camDesired.z), TUNE.waterLevel) + 2;
    if (camDesired.y < gy) camDesired.y = gy;
    // In a city street the building behind him would be between the camera and
    // the truck -- the picture a wall. The camera comes in along the line to
    // the truck to the last clear point (a few probes; it is only a camera).
    const ex = state.x, ey = state.y + C.up * 0.6, ez = state.z;
    let k = 1;
    for (let j = 1; j <= 10; j++) {
      const u = j / 10, px = ex + (camDesired.x - ex) * u, py = ey + (camDesired.y - ey) * u, pz = ez + (camDesired.z - ez) * u;
      // (a building or a wall: not a mast, a dome or the giant truck's capsule, which it sees past)
      if (solidQuery(px, py, pz, 2.5, SOLID.AIR, undefined, b => b.car !== undefined || !!b.park || !!b.cap)) { k = (j - 1) / 10; break; }
    }
    let kk = 1;
    if (k < 1) {
      // as near as it has to be, and higher the nearer it comes: over the cab, looking down on it
      kk = Math.max(k, C.minPull);
      camDesired.set(ex + (camDesired.x - ex) * kk, ey + (camDesired.y - ey) * kk + (1 - kk) * C.pullRise, ez + (camDesired.z - ez) * kk);
    }
    camera.position.lerp(camDesired, Math.min(1, C.lag * dt));
    // ... and the nearer it has come, the more it looks DOWN at the truck, so the
    // whole cab and its wheels stay in the picture, not one blue slab of roof
    const near = 1 - kk;
    lookV.set(state.x + fx * C.look * (1 - near * 0.8), state.y + 4 - near * 3, state.z + fz * C.look * (1 - near * 0.8));
    camera.lookAt(lookV);
  } else {
    // THE SEAT (v143): high in the cab, a little back, looking down over the
    // blue bonnet with the tops of the two front wheels at the corners -- he is
    // up there, and the traffic is small below him
    camera.position.set(state.x - fx * C.seatBack, state.y + C.eye + mon.bounce, state.z - fz * C.seatBack);
    camera.rotation.set(-C.seatPitch * DEG + state.pitch * DEG * 0.6, state.heading, -state.bank * DEG * 0.3, "YXZ");
    // a wider lens in the cab, so both front wheels are at the windscreen's corners
    // (on top of the shared feel's speed-widening and punch, not instead of them)
    const want = C.seatFov + (feel.fov - TUNE.fov);
    if (Math.abs(camera.fov - want) > 0.02) { camera.fov = want; camera.updateProjectionMatrix(); }
  }
}
function monPoseModel(m) {
  if (m.userData.cab) m.userData.cab.visible = state.viewChase;
  m.position.set(state.x, state.y + mon.bounce, state.z);
  m.rotation.set(state.pitch * DEG, state.heading, -state.bank * DEG);
  for (const w of m.userData.wheels || []) w.rotation.x = -mon.wheelSpin;
}
