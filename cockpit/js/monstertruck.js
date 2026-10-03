"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- THE MONSTER TRUCK (v136).
//
// A loop of dirt track on the plains, west of the motorway. On its east leg a
// giant blue monster truck waits at the start; ahead of it, a ramp and, beyond
// the ramp, six rusty junk cars parked nose to tail. Point at it and after
// 3-2-1 the truck roars off, hits the ramp, flies, lands on the junk cars and
// rolls along the row squashing every one of them flat with a crunch, bounces
// down on to the dirt and brakes. Then it drives round the loop home, and once
// it has gone the cars pop back up one by one. Nothing to press, nothing to
// miss.
//
// RULES THIS FILE KEEPS
//   * Nothing living: the truck's windows are dark glass with nobody in them,
//     and the junk cars are empty wrecks. Machines squashing machines.
//   * It is something he POINTS at; in the car it arms by his speed so the
//     landing happens in his windscreen. No unannounced bang: 3-2-1 first.
//   * Every car comes back exactly as it was. Nothing is lost.
//   * Solid where it stands: the ramp (a surface driven up, never a trigger),
//     each junk car (its height follows its squash), and the truck itself,
//     whose capsule follows it round the loop.
//   * It shares the one big numeral through spCountBusy; it stands down for a
//     police pull-over or the picker.
//   * Its own random stream and its own puff pool.
// ---------------------------------------------------------------------------
const MTRUCK = TUNE.monsterTruck;

const MT_SEED = 0x7A0C;
let mtSeed = MT_SEED;
function mtRnd() { mtSeed = (mtSeed * 1664525 + 1013904223) >>> 0; return mtSeed / 4294967296; }

const mtruck = {
  g: null, truck: null, body: null, wheels: [], cars: [], reticle: null, solid: null, ramp: null,
  path: [], len: 0, legLen: 0, dirX: 0, dirZ: -1, groundY: 0,
  phase: "armed",                // armed | count | run | air | crush | brake | rest | home
  t: 0, d: 0, v: 0, x: 0, y: 0, z: 0, vy: 0, heading: 0, pitch: 0, bounce: 0, bounceV: 0, spin: 0,
  clock: 0, popT: 0, puffs: [], puffCursor: 0, puffMesh: null,
};

// ---- the path: the jump leg south, a U-turn west, the return leg north, a U-turn home
function mtBuildPath() {
  const T = MTRUCK;
  const dx = T.s[0] - T.n[0], dz = T.s[1] - T.n[1], L = Math.hypot(dx, dz);
  const fx = dx / L, fz = dz / L, wx = fz, wz = -fx;     // (wx, wz) points WEST of the jump leg
  mtruck.dirX = fx; mtruck.dirZ = fz; mtruck.legLen = L;
  const P = [];
  const step = 2;
  for (let d = 0; d <= L; d += step) P.push({ x: T.n[0] + fx * d, z: T.n[1] + fz * d });
  // south U-turn, centre loopR west of the leg's south end
  const R = T.loopR, cx = T.s[0] + wx * R, cz = T.s[1] + wz * R;
  for (let a = step / R; a < Math.PI; a += step / R) {
    P.push({ x: cx - wx * R * Math.cos(a) + fx * R * Math.sin(a), z: cz - wz * R * Math.cos(a) + fz * R * Math.sin(a) });
  }
  for (let d = 0; d <= L; d += step) P.push({ x: T.s[0] + wx * 2 * R - fx * d, z: T.s[1] + wz * 2 * R - fz * d });
  const nx = T.n[0] + wx * R, nz = T.n[1] + wz * R;
  for (let a = step / R; a < Math.PI; a += step / R) {
    P.push({ x: nx + wx * R * Math.cos(a) - fx * R * Math.sin(a), z: nz + wz * R * Math.cos(a) - fz * R * Math.sin(a) });
  }
  let acc = 0;
  for (let i = 0; i < P.length; i++) { if (i) acc += Math.hypot(P[i].x - P[i - 1].x, P[i].z - P[i - 1].z); P[i].d = acc; }
  const last = P[P.length - 1];
  mtruck.len = acc + Math.hypot(P[0].x - last.x, P[0].z - last.z);
  mtruck.path = P;
  mtruck.west = { x: wx, z: wz };
}
function mtAt(d) {
  const P = mtruck.path;
  d = ((d % mtruck.len) + mtruck.len) % mtruck.len;
  let lo = 0, hi = P.length - 1;
  if (d >= P[hi].d) {
    const a = P[hi], b = P[0], k = (d - a.d) / (mtruck.len - a.d);
    return { x: lerp(a.x, b.x, k), z: lerp(a.z, b.z, k), h: Math.atan2(b.x - a.x, b.z - a.z) };
  }
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m].d <= d) lo = m; else hi = m; }
  const a = P[lo], b = P[hi], k = (d - a.d) / Math.max(1e-6, b.d - a.d);
  return { x: lerp(a.x, b.x, k), z: lerp(a.z, b.z, k), h: Math.atan2(b.x - a.x, b.z - a.z) };
}

// ---- models -----------------------------------------------------------------
function mtBuildTruck() {
  const P = TUNE.palette, S = MTRUCK.truckScale;
  const g = new THREE.Group();
  const k = lsKit();
  // a blue body with flames of yellow, high on its springs; dark glass, nobody in it
  k.add(P.blue, new THREE.BoxGeometry(3.4, 1.6, 6.6), 0, 3.6, 0);
  k.add(P.blue, new THREE.BoxGeometry(3.0, 1.4, 3.0), 0, 5.0, -0.6);
  k.add(P.ink, new THREE.BoxGeometry(3.05, 0.9, 2.2), 0, 5.15, -0.3);         // the dark windows, all round
  k.add(P.warning, new THREE.BoxGeometry(3.5, 0.35, 4.2), 0, 3.9, 1.2);       // a yellow stripe
  k.add(P.ink, new THREE.BoxGeometry(2.6, 0.5, 6.0), 0, 2.4, 0);              // the chassis
  k.add(P.steel, new THREE.BoxGeometry(3.6, 0.4, 0.5), 0, 3.1, 3.5);          // bumpers
  k.add(P.steel, new THREE.BoxGeometry(3.6, 0.4, 0.5), 0, 3.1, -3.5);
  for (const x of [-1, 1]) k.add(P.warning, lsCyl(0.35, 0.35, 0.2, 10), x * 1.1, 3.7, 3.4, Math.PI / 2, 0, 0);   // headlights
  const meshes = k.build(g, sledPaint);
  mtruck.body = meshes[0];
  mtruck.body.userData.noShatter = true;
  // four enormous wheels: a tyre, a hub and chunky tread blocks, each its own group so it spins
  mtruck.wheels = [];
  for (const [x, z] of [[-2.3, 2.3], [2.3, 2.3], [-2.3, -2.3], [2.3, -2.3]]) {
    const w = new THREE.Group();
    const wk = lsKit();
    wk.add(P.ink, lsCyl(1.75, 1.75, 1.4, 16), 0, 0, 0, 0, 0, Math.PI / 2);
    wk.add(P.warning, lsCyl(0.8, 0.8, 1.46, 10), 0, 0, 0, 0, 0, Math.PI / 2);
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      wk.add(P.ink, new THREE.BoxGeometry(1.5, 0.35, 0.55), 0, Math.cos(a) * 1.8, Math.sin(a) * 1.8, a, 0, 0);
    }
    wk.build(w, sledPaint);
    w.position.set(x, 1.75, z);
    g.add(w);
    mtruck.wheels.push(w);
  }
  g.scale.setScalar(S);
  return g;
}

function mtBuildCar(color) {
  const P = TUNE.palette;
  const g = new THREE.Group();
  const k = lsKit();
  k.add(color, new THREE.BoxGeometry(1.8, 0.8, 4.2), 0, 0.75, 0);
  k.add(color, new THREE.BoxGeometry(1.6, 0.6, 2.0), 0, 1.45, -0.2);
  k.add(P.ink, new THREE.BoxGeometry(1.62, 0.42, 1.7), 0, 1.47, -0.2);        // empty, dark windows
  for (const [x, z] of [[-0.85, 1.3], [0.85, 1.3], [-0.85, -1.3], [0.85, -1.3]]) k.add(P.ink, lsCyl(0.36, 0.36, 0.25, 10), x, 0.36, z, 0, 0, Math.PI / 2);
  const meshes = k.build(g, sledPaint);
  g.scale.setScalar(MTRUCK.carScale);
  g.userData.body = meshes[0];
  return g;
}

function mtBuild() {
  const P = TUNE.palette, T = MTRUCK;
  mtBuildPath();
  const g = new THREE.Group();
  g.userData.name = "monsterTruck";
  // the ground: the highest point along the jump leg, so the dirt never sinks
  let hi = -1e9;
  for (const p of mtruck.path) hi = Math.max(hi, terrainEff(p.x, p.z));
  const gy = hi + T.dirtY;
  mtruck.groundY = gy;
  // the dirt: one strip of boxes along the path, merged
  const dk = lsKit();
  const P0 = mtruck.path;
  for (let i = 0; i < P0.length; i += 3) {
    const a = P0[i], b = P0[Math.min(P0.length - 1, i + 3)];
    const len = Math.hypot(b.x - a.x, b.z - a.z) + 1.5;
    const lo = Math.min(terrainEff(a.x, a.z), terrainEff(b.x, b.z));
    const h = gy - lo + 1.5;
    dk.add(P.sand, new THREE.BoxGeometry(T.trackW, h, len), (a.x + b.x) / 2, gy - h / 2, (a.z + b.z) / 2, 0, Math.atan2(b.x - a.x, b.z - a.z), 0);
  }
  const dirt = dk.build(g, c => artLam(c, "terrain"))[0];
  dirt.userData.noShatter = true;
  // the ramp: a wedge of planks, yellow-and-black chevrons on its face
  const rampStart = T.runUp, rp = mtAt(rampStart);
  const yaw = Math.atan2(mtruck.dirX, mtruck.dirZ);
  const ang = Math.atan2(T.rampRise, T.rampLen), slope = Math.hypot(T.rampLen, T.rampRise);
  const rk = lsKit();
  const rcx = rp.x + mtruck.dirX * T.rampLen / 2, rcz = rp.z + mtruck.dirZ * T.rampLen / 2;
  const rampGeo = new THREE.BoxGeometry(T.trackW - 1, 1.2, slope);
  rk.add(P.fire, rampGeo, rcx, gy + T.rampRise / 2 - 0.4, rcz, ang, yaw, 0);
  for (let i = 0; i < 5; i++) {
    const k = (i + 0.5) / 5, px = rp.x + mtruck.dirX * T.rampLen * k, pz = rp.z + mtruck.dirZ * T.rampLen * k;
    rk.add(i % 2 ? P.ink : P.warning, new THREE.BoxGeometry(T.trackW - 1.2, 0.1, slope / 5 - 0.4), px, gy + T.rampRise * k + 0.25, pz, ang, yaw, 0);
  }
  // the ramp's back: a wall under the lip
  const lipX = rp.x + mtruck.dirX * T.rampLen, lipZ = rp.z + mtruck.dirZ * T.rampLen;
  rk.add(P.ink, new THREE.BoxGeometry(T.trackW - 1, T.rampRise, 1), lipX - mtruck.dirX * 0.5, gy + T.rampRise / 2, lipZ - mtruck.dirZ * 0.5, 0, yaw, 0);
  rk.build(g, sledPaint);
  mtruck.lip = { x: lipX, z: lipZ, d: rampStart + T.rampLen };
  // the junk cars
  const carCols = [P.rust, P.grey, P.green, P.slate, P.blue, P.sand];
  mtruck.cars = [];
  for (let i = 0; i < T.cars; i++) {
    const dd = T.carsAt + i * T.carGap, p = mtAt(dd);
    const c = mtBuildCar(carCols[i % carCols.length]);
    c.position.set(p.x, gy, p.z);
    c.rotation.y = yaw;               // square on the row: its solid box is too
    g.add(c);
    const h = 1.9 * T.carScale;
    const sb = solidBox3(p.x, gy + h / 2, p.z, [mtruck.west.x, 0, mtruck.west.z], [0, 1, 0], [mtruck.dirX, 0, mtruck.dirZ],
      0.9 * T.carScale, h / 2, 2.1 * T.carScale, "parked");
    sb.mesh = c.userData.body; sb.mt = true;
    mtruck.cars.push({ g: c, d: dd, h, sq: 0, flat: false, pop: 0, solid: sb, cy: gy });
  }
  castsAndReceives(g);
  scene.add(g);
  mtruck.g = g;
  // the ramp's solid: a surface he drives up (and the truck does)
  const rs = solidRamp([rp.x, gy, rp.z], [mtruck.dirX, 0, mtruck.dirZ], [0, 1, 0], T.rampLen, T.rampRise, T.trackW - 1, 1, staticSolids, { mt: true });
  mtruck.ramp = rs;

  // the target, over the start, facing him
  const ret = new THREE.Group();
  ret.add(new THREE.Mesh(new THREE.TorusGeometry(T.reticleR, 1.0, 8, 28), new THREE.MeshBasicMaterial({ color: 0xff3b30, fog: false })));
  for (const [rx, ry] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(rx ? 4.5 : 1.1, ry ? 4.5 : 1.1, 1.1), new THREE.MeshBasicMaterial({ color: 0xffd23e, fog: false }));
    tick.position.set(rx * (T.reticleR + 2.4), ry * (T.reticleR + 2.4), 0);
    ret.add(tick);
  }
  ret.add(new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3b30, fog: false })));
  const lip = mtruck.lip;
  ret.position.set(lip.x, gy + T.reticleY, lip.z);
  scene.add(ret);
  mtruck.reticle = ret;

  // the truck and its capsule
  const tr = mtBuildTruck();
  castsAndReceives(tr);
  scene.add(tr);
  mtruck.truck = tr;
  const sc = solidCapsule([0, -1e4, 0], [0, -1e4, 0], 1, "pillar");
  sc.mesh = mtruck.body; sc.mt = true;
  mtruck.solid = sc;

  // dust and smoke: one instanced draw
  const pm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x5a5a5a, transparent: true, opacity: 0.85, depthWrite: false }), T.puffs);
  pm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  pm.setColorAt(0, new THREE.Color(0xffffff));
  pm.count = 0; pm.frustumCulled = false;
  scene.add(pm);
  mtruck.puffMesh = pm;
  for (let i = 0; i < T.puffs; i++) mtruck.puffs.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r0: 1, r1: 2, r: 0, c: 0xffffff });
  mtReset();
}

function mtPuff(x, y, z, vx, vy, vz, r0, r1, life, color) {
  let p = mtruck.puffs.find(q => q.life <= 0);
  if (!p) { p = mtruck.puffs[mtruck.puffCursor]; mtruck.puffCursor = (mtruck.puffCursor + 1) % mtruck.puffs.length; }
  p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.r0 = r0; p.r1 = r1; p.r = r0; p.life = p.max = life; p.c = color;
}
function mtUpdatePuffs(dt) {
  const pm = mtruck.puffMesh;
  let n = 0;
  const drag = Math.exp(-dt * 1.4);
  for (const p of mtruck.puffs) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) continue;
    p.vx *= drag; p.vy *= drag; p.vz *= drag;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    const k = 1 - p.life / p.max;
    p.r = lerp(p.r0, p.r1, Math.sqrt(k)) * (k > 0.7 ? 1 - (k - 0.7) / 0.3 * 0.85 : 1);
    lsTmpO.position.set(p.x, p.y, p.z); lsTmpO.scale.setScalar(p.r); lsTmpO.rotation.set(0, 0, 0); lsTmpO.updateMatrix();
    pm.setMatrixAt(n, lsTmpO.matrix);
    pm.setColorAt(n, lsTmpC.setHex(p.c));
    n++;
  }
  pm.count = n;
  if (n) { pm.instanceMatrix.needsUpdate = true; if (pm.instanceColor) pm.instanceColor.needsUpdate = true; }
}

// ---- state ------------------------------------------------------------------
function mtCarSet(c, k) {
  // k: 0 standing .. 1 flat
  c.sq = k;
  const s = 1 - (1 - MTRUCK.squash) * k;
  c.g.scale.set(MTRUCK.carScale * (1 + 0.12 * k), MTRUCK.carScale * s, MTRUCK.carScale * (1 + 0.06 * k));
  const h = c.h * s;
  c.solid.o3.c[1] = c.cy + h / 2; c.solid.o3.e[1] = h / 2;
  c.solid.y0 = c.cy; c.solid.y1 = c.cy + h;
}
function mtPlace() {
  const T = MTRUCK, S = T.truckScale;
  const tr = mtruck.truck;
  tr.position.set(mtruck.x, mtruck.y + mtruck.bounce, mtruck.z);
  tr.rotation.set(0, 0, 0);
  tr.rotation.y = mtruck.heading;
  tr.rotateX(-mtruck.pitch);
  for (const w of mtruck.wheels) w.rotation.x = mtruck.spin;
  // its capsule: nose to tail at the body's height
  const fx = Math.sin(mtruck.heading), fz = Math.cos(mtruck.heading), h = 3.3 * S, cy = mtruck.y + mtruck.bounce + 3.4 * S;
  const rec = mtruck.solid, c = rec.cap;
  c.a[0] = mtruck.x - fx * h; c.a[1] = cy; c.a[2] = mtruck.z - fz * h;
  c.b[0] = mtruck.x + fx * h; c.b[1] = cy; c.b[2] = mtruck.z + fz * h;
  c.r = 2.2 * S;
  rec.x = mtruck.x; rec.z = mtruck.z; rec.hw = Math.abs(fx) * h + c.r; rec.hd = Math.abs(fz) * h + c.r;
  rec.y0 = cy - c.r; rec.y1 = cy + c.r;
}
function mtToStart() {
  const p = mtAt(0);
  mtruck.d = 0; mtruck.v = 0; mtruck.vy = 0; mtruck.x = p.x; mtruck.z = p.z; mtruck.y = mtruck.groundY;
  mtruck.heading = p.h; mtruck.pitch = 0; mtruck.bounce = 0; mtruck.bounceV = 0;
}
function mtReset() {
  if (!mtruck.truck) return;
  mtSeed = MT_SEED;
  mtruck.phase = "armed"; mtruck.t = 0; mtruck.popT = 0;
  for (const c of mtruck.cars) { mtCarSet(c, 0); c.flat = false; c.pop = 0; }
  for (const p of mtruck.puffs) p.life = 0;
  mtruck.puffMesh.count = 0;
  mtToStart(); mtPlace();
  mtruck.reticle.visible = true;
  setTone("mtRoar", "sawtooth", MTRUCK.roarHz, 0);
  if (el.bigNum.classList.contains("sky") && mtruck.counting) { countdownClear(); el.bigNum.classList.remove("sky"); }
  mtruck.counting = false;
}
function mtHear() { return clamp(1 - Math.hypot(state.x - mtruck.x, state.y - mtruck.y, state.z - mtruck.z) / MTRUCK.hearR, 0, 1); }
function mtBusy() {
  if (typeof menuOpen === "function" && menuOpen()) return true;
  return typeof police !== "undefined" && !!police.active && police.state === "pullover";
}
// from the first numeral to the landing on the cars, in seconds
function mtToLanding() {
  const T = MTRUCK, d = T.runUp + T.rampLen;
  const tAcc = T.topSpeed / T.accel, dAcc = 0.5 * T.accel * tAcc * tAcc;
  const tRun = d <= dAcc ? Math.sqrt(2 * d / T.accel) : tAcc + (d - dAcc) / T.topSpeed;
  return T.count + tRun + T.airT;
}
function mtLanding() { const p = mtAt(MTRUCK.carsAt); return { x: p.x, y: mtruck.groundY + 3, z: p.z }; }
function mtAimed() {
  if (state.exploding || eject.active || mtBusy() || spCountBusy("monsterTruck")) return false;
  const T = MTRUCK, L = mtLanding();
  const dx = L.x - state.x, dz = L.z - state.z, dy = L.y - state.y;
  const d = Math.hypot(dx, dy, dz), dh = Math.hypot(dx, dz);
  // in the car: by the speed he is going OR heading for (the step he has set), so
  // a car still picking up speed does not arrive before the truck does
  const vCar = typeof CAR !== "undefined" ? Math.max(Math.abs(state.speed), CAR.cruise * spdMul()) : Math.abs(state.speed);
  const R = typeof vehKind === "function" && vehKind() === "car" ? T.carView + vCar * mtToLanding() : T.armR;
  if (d > R || dh < T.innerR) return false;
  const fx = -Math.sin(state.heading), fz = -Math.cos(state.heading);
  return (dx * fx + dz * fz) / dh > Math.cos(T.coneDeg * DEG);
}
function mtStart() { mtruck.phase = "count"; mtruck.t = MTRUCK.count; mtruck.counting = true; flags.mtCountdowns = (flags.mtCountdowns || 0) + 1; }
function mtForce() { if (mtruck.phase === "armed") mtStart(); }

// the top of whatever is under the wheels at distance d along the jump leg
function mtSurface(d) {
  const T = MTRUCK, gy = mtruck.groundY;
  if (d >= T.runUp && d <= T.runUp + T.rampLen) return gy + T.rampRise * (d - T.runUp) / T.rampLen;
  let top = gy;
  for (const c of mtruck.cars) if (Math.abs(d - c.d) < 2.1 * T.carScale) top = Math.max(top, c.cy + c.h * (1 - (1 - T.squash) * c.sq));
  return top;
}

function updateMonsterTruck(dt) {
  if (!mtruck.truck) return;
  const T = MTRUCK;
  mtruck.clock += dt;
  const near = Math.hypot(state.x - mtruck.x, state.z - mtruck.z) < TUNE.fogFar * T.drawFog;
  mtruck.g.visible = near; mtruck.truck.visible = near;
  mtruck.reticle.visible = near && mtruck.phase === "armed";
  if (mtruck.reticle.visible) {
    mtruck.reticle.lookAt(camera.position.x, mtruck.reticle.position.y, camera.position.z);
    mtruck.reticle.scale.setScalar(1 + Math.sin(mtruck.clock * T.reticleRate) * 0.12);
  }
  const ph = mtruck.phase;
  const hear = mtHear();
  let roar = 0;
  if (ph === "armed") {
    if (mtAimed()) mtStart();
    roar = 0.12;            // idling
  } else if (ph === "count") {
    if (mtBusy()) {
      countdownClear(); el.bigNum.classList.remove("sky"); mtruck.counting = false;
      mtruck.phase = "armed"; flags.mtStandDowns = (flags.mtStandDowns || 0) + 1;
    } else {
      mtruck.t -= dt;
      el.bigNum.classList.add("sky");
      countdownTo(mtruck.t, T.count);
      roar = 0.3 + 0.5 * (1 - mtruck.t / T.count);           // revving
      mtruck.bounce = Math.sin(mtruck.clock * 30) * 0.08 * (1 - mtruck.t / T.count);
      if (mtruck.t <= 0) {
        countdownClear(); el.bigNum.classList.remove("sky"); mtruck.counting = false;
        mtruck.phase = "run"; mtruck.v = 0; mtruck.bounce = 0;
        flags.mtRuns = (flags.mtRuns || 0) + 1;
        for (let i = 0; i < 8; i++) mtPuff(mtruck.x - Math.sin(mtruck.heading) * 6, mtruck.groundY + 1, mtruck.z - Math.cos(mtruck.heading) * 6,
          (mtRnd() - 0.5) * 6, 2, (mtRnd() - 0.5) * 6, 2, 7, 1.8, TUNE.palette.grey);
      }
    }
  } else if (ph === "run") {
    mtruck.v = Math.min(T.topSpeed, mtruck.v + T.accel * dt);
    mtruck.d += mtruck.v * dt;
    const p = mtAt(mtruck.d);
    mtruck.x = p.x; mtruck.z = p.z; mtruck.heading = p.h;
    mtruck.y = mtSurface(mtruck.d);
    mtruck.pitch = mtruck.d > T.runUp ? Math.atan2(T.rampRise, T.rampLen) : 0;
    roar = 1;
    if (mtRnd() < dt * 20) mtPuff(mtruck.x - Math.sin(mtruck.heading) * 7, mtruck.groundY + 1, mtruck.z - Math.cos(mtruck.heading) * 7,
      0, 3, 0, 2, 6, 1.4, TUNE.palette.sand);
    if (mtruck.d >= mtruck.lip.d) {
      mtruck.phase = "air";
      mtruck.y = mtruck.groundY + T.rampRise;          // it leaves from the lip, not the ground past it
      const a = Math.atan2(T.rampRise, T.rampLen);
      mtruck.vy = mtruck.v * Math.sin(a); mtruck.v = mtruck.v * Math.cos(a);
      flags.mtJumps = (flags.mtJumps || 0) + 1;
      if (hear > 0) whoosh();
    }
  } else if (ph === "air") {
    mtruck.d += mtruck.v * dt;
    mtruck.vy -= T.gravity * dt;
    mtruck.y += mtruck.vy * dt;
    const p = mtAt(mtruck.d);
    mtruck.x = p.x; mtruck.z = p.z;
    mtruck.pitch = Math.atan2(mtruck.vy, mtruck.v) * 0.8;
    mtruck.airMax = Math.max(mtruck.airMax || 0, mtruck.y - mtruck.groundY);
    roar = 0.9;
    const top = mtSurface(mtruck.d);
    if (mtruck.y <= top && mtruck.vy < 0) {
      mtruck.y = top;
      mtruck.bounceV = mtruck.vy * 0.35; mtruck.vy = 0;
      mtruck.phase = "crush";
      flags.mtLandings = (flags.mtLandings || 0) + 1;
      if (hear > 0) { bigBoom(mtruck.x, mtruck.y, mtruck.z); thunk(); }
      shakeAmp = Math.max(shakeAmp, T.shake * clamp(1 - Math.hypot(state.x - mtruck.x, state.z - mtruck.z) / T.shakeR, 0, 1));
      // the landing's dust: a short, low puff blown off to the WEST of the row,
      // so the flattened cars are what he sees, not a cloud over them
      for (let i = 0; i < 8; i++) mtPuff(mtruck.x + mtruck.west.x * (6 + mtRnd() * 4), mtruck.groundY + 1, mtruck.z + mtruck.west.z * (6 + mtRnd() * 4) + (mtRnd() - 0.5) * 8,
        mtruck.west.x * 9, 1.5, mtruck.west.z * 9 + (mtRnd() - 0.5) * 4, 2, 5, 1.1, TUNE.palette.sand);
    }
  } else if (ph === "crush" || ph === "brake") {
    if (ph === "brake") mtruck.v = Math.max(0, mtruck.v - T.brake * dt);
    else mtruck.v = Math.max(T.topSpeed * 0.4, mtruck.v - 2 * dt);
    mtruck.d += mtruck.v * dt;
    const p = mtAt(mtruck.d);
    mtruck.x = p.x; mtruck.z = p.z; mtruck.heading = p.h;
    const top = mtSurface(mtruck.d);
    // falls off the end of the row, or rolls on the cars' tops
    if (mtruck.y > top) { mtruck.vy -= T.gravity * dt; mtruck.y = Math.max(top, mtruck.y + mtruck.vy * dt); if (mtruck.y === top) { if (mtruck.vy < -4) mtruck.bounceV = mtruck.vy * 0.3; mtruck.vy = 0; } }
    else { mtruck.y = top; mtruck.vy = 0; }
    mtruck.pitch *= Math.exp(-dt * 6);
    roar = ph === "brake" ? 0.4 : 0.8;
    if (ph === "crush" && mtruck.d > mtruck.cars[mtruck.cars.length - 1].d + 6) mtruck.phase = "brake";
    if (ph === "brake" && mtruck.v <= 0) { mtruck.phase = "rest"; mtruck.t = T.rest; }
  } else if (ph === "rest") {
    mtruck.t -= dt;
    roar = 0.12;
    if (mtruck.t <= 0) mtruck.phase = "home";
  } else if (ph === "home") {
    // round the loop home, easing in at the start line
    const left = mtruck.len - mtruck.d;
    mtruck.v = Math.min(T.returnSpeed, Math.max(2, left * 0.5));
    mtruck.d += mtruck.v * dt;
    const p = mtAt(mtruck.d);
    mtruck.x = p.x; mtruck.z = p.z; mtruck.heading = p.h; mtruck.y = mtruck.groundY; mtruck.pitch = 0;
    roar = 0.35;
    if (mtruck.d >= mtruck.len - 0.2) {
      mtToStart();
      mtruck.phase = "armed";
      flags.mtHomes = (flags.mtHomes || 0) + 1;
    }
  }
  // the cars: squashed by the wheels on top of them, popping back once he is round the bend
  for (const c of mtruck.cars) {
    const onTop = (ph === "air" || ph === "crush" || ph === "brake") && Math.abs(mtruck.d - c.d) < T.crushReach * T.truckScale && mtruck.y <= c.cy + c.h + 0.5;
    if (onTop && !c.flat) {
      c.flat = true; c.crushT = 0;
      flags.mtCrushes = (flags.mtCrushes || 0) + 1;
      if (hear > 0) { noiseBurst(0.3, 400, 0.4 * hear, 0); synthBlip("square", 180, 60, 0.25, 0.2 * hear, 0); }
      for (let i = 0; i < 3; i++) mtPuff(mtMid(c).x + mtruck.west.x * 5, c.cy + 0.6, mtMid(c).z + mtruck.west.z * 5 + (mtRnd() - 0.5) * 4, mtruck.west.x * 6, 1.5, mtruck.west.z * 6, 1, 3, 0.8, TUNE.palette.white);
    }
    if (c.flat && c.sq < 1) mtCarSet(c, Math.min(1, c.sq + dt * 9));
  }
  if ((ph === "home" && mtruck.d > mtruck.legLen + Math.PI * T.loopR + 40) || ph === "armed") {
    mtruck.popT -= dt;
    const next = mtruck.cars.find(c => c.flat);
    if (next && mtruck.popT <= 0) {
      next.flat = false; next.pop = T.popTime; mtruck.popT = T.popDelay;
      if (hear > 0) boing();
    }
  }
  for (const c of mtruck.cars) {
    if (c.pop > 0) {
      c.pop -= dt;
      const k = 1 - Math.max(0, c.pop) / MTRUCK.popTime;
      // up past standing and back: a pop
      mtCarSet(c, Math.max(0, 1 - k * 1.15));
      if (c.pop <= 0) { mtCarSet(c, 0); if (!mtruck.cars.some(q => q.flat || q.pop > 0)) flags.mtRestored = (flags.mtRestored || 0) + 1; }
    }
  }
  // springs
  mtruck.bounceV += (-mtruck.bounce * 60 - mtruck.bounceV * 6) * dt;
  mtruck.bounce += mtruck.bounceV * dt;
  mtruck.spin += mtruck.v * dt / (1.75 * T.truckScale);
  setTone("mtRoar", "sawtooth", T.roarHz * (1 + 0.6 * Math.min(1, mtruck.v / T.topSpeed)), T.roar * roar * hear);
  mtPlace();
  mtClearPath(dt);
  mtUpdatePuffs(dt);
}

// Something sitting still on the track ahead of the moving truck (a helicopter
// hovering low over it) is stepped sideways off it before the truck gets there
// -- the bang is only ever his, flown in at speed.
function mtClearPath(dt) {
  if (Math.abs(mtruck.v) < 1 || state.exploding) return;
  if (typeof vehCrawl === "function" && Math.abs(state.speed) > vehCrawl()) return;
  const T = MTRUCK, S = T.truckScale;
  const fx = Math.sin(mtruck.heading), fz = Math.cos(mtruck.heading);
  const rx = state.x - mtruck.x, rz = state.z - mtruck.z;
  const along = rx * fx + rz * fz, across = rx * fz - rz * fx;
  const half = 2.2 * S + (typeof vehSolidR === "function" ? vehSolidR() : 3) + 2;
  if (along < -4 * S || along > T.clearAhead || Math.abs(across) >= half || state.y > mtruck.y + 8 * S + 4) return;
  const side = across >= 0 ? 1 : -1;
  const step = Math.min(half - Math.abs(across), T.clearSpeed * dt);
  state.x += fz * side * step; state.z += -fx * side * step;
  flags.mtSidesteps = (flags.mtSidesteps || 0) + 1;
}
function mtMid(c) { return c.g.position; }
function mtSquash(i, k) { const c = mtruck.cars[i]; mtCarSet(c, k); return c.solid.y1 - c.cy; }
function mtCarsState() { return mtruck.cars.map(c => ({ sq: Math.round(c.sq * 100) / 100, flat: c.flat, y1: Math.round((c.solid.y1 - c.cy) * 10) / 10 })); }
function mtPuffsLive() { return mtruck.puffs.filter(p => p.life > 0).map(p => ({ x: p.x, y: p.y, z: p.z, r: p.r })); }

// Streamed trees and towns keep off the loop.
function mtCovers(x, z, extra) {
  const T = MTRUCK;
  if (!mtruck.path.length) return false;
  const rx = x - T.n[0], rz = z - T.n[1];
  const along = rx * mtruck.dirX + rz * mtruck.dirZ, across = rx * mtruck.west.x + rz * mtruck.west.z;
  const r = 30 + (extra || 0);
  return along > -T.loopR - r && along < mtruck.legLen + T.loopR + r && across > -r && across < 2 * T.loopR + r;
}

mtBuild();
spCountRegister("monsterTruck", () => mtruck.phase === "count");
