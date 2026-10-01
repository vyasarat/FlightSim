"use strict";
// ---------------------------------------------------------------------------
// The rover. Landed on the Moon or Mars, the slot button rolls a buggy out of
// the capsule. Like everything else in the game: hold the throttle to go,
// drag left / right to steer (drag down backs up slowly). It hops over bumps
// in the body's gravity, collects glowing rocks (a note each, and it leaves a
// blinking beacon where each one was; they re-arm with the refit). Tap the
// button again and it drives itself back and climbs in -- nothing to line up,
// and the rocket is ready to launch.
// ---------------------------------------------------------------------------

const rover = {
  active: false, body: null, returning: false,
  x: 0, y: 0, z: 0, h: 0, vh: 0, speed: 0, t: 0, thrPrev: false,
  n: new THREE.Vector3(0, 1, 0), f: new THREE.Vector3(0, 0, -1),
  mesh: null, wheels: [], rocks: [], beacons: [], toys: [], craters: [], stuck: false,
};
const rvTmp = new THREE.Vector3(), rvTmp2 = new THREE.Vector3();
// Scratches for the boulder roll below. It runs for every boulder on every
// frame he is out driving, and it was allocating three fresh Vector3s each
// time round -- the one thing on an iPad that turns into a visible hitch
// later, when the collector finally comes for them.
const rvBn = new THREE.Vector3(), rvBv = new THREE.Vector3(), rvBax = new THREE.Vector3();

// These temporary surface groups own their geometry and non-cached materials.
// Textures and Three's Sprite geometry are shared; lam() belongs to matCache.
// Pass the whole retiring collection so materials shared within it dispose once.
function disposeSurfaceObjects(objects) {
  const geometries = new Set(), materials = new Set();
  const sharedMaterials = new Set(Object.values(matCache));
  for (const root of objects) {
    if (!root) continue;
    if (root.parent) root.parent.remove(root);
    root.traverse(o => {
      if (o.geometry && !o.isSprite) geometries.add(o.geometry);
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        if (m && !sharedMaterials.has(m)) materials.add(m);
      }
    });
  }
  for (const g of geometries) g.dispose();
  for (const m of materials) m.dispose();
}

function buildRover() {
  const g = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({ color: 0xf2f4f7 });
  const gold = new THREE.MeshLambertMaterial({ color: 0xd4a72c, emissive: 0x2a2008 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1f2328 });
  const blue = new THREE.MeshLambertMaterial({ color: 0x2b4fb0, emissive: 0x0d1a44 });
  const yellow = new THREE.MeshLambertMaterial({ color: 0xffd23e });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 3.6), yellow); body.position.y = 1.1; g.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.3, 1.0), new THREE.MeshLambertMaterial({ color: 0xe0483e })); stripe.position.set(0, 1.1, 1.3); g.add(stripe);
  const foil = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.3, 3.7), gold); foil.position.y = 0.6; g.add(foil);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 2.2), blue); panel.position.set(0, 1.6, -0.4); g.add(panel);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6), dark); mast.position.set(0.6, 2.3, 1.2); g.add(mast);
  const cam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.4), dark); cam.position.set(0.6, 3.15, 1.3); g.add(cam);
  const dish = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.25, 10, 1, true), white); dish.position.set(-0.8, 2.0, -0.8); dish.rotation.x = -0.9; g.add(dish);
  for (const [sx, sz] of [[-1.5, 1.3], [1.5, 1.3], [-1.5, -1.3], [1.5, -1.3]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.45, 12), dark);
    w.rotation.z = Math.PI / 2; w.position.set(sx, 0.55, sz); g.add(w); rover.wheels.push(w);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.5, 8), gold); hub.rotation.z = Math.PI / 2; hub.position.set(sx, 0.55, sz); g.add(hub);
  }
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), new THREE.MeshBasicMaterial({ color: 0x5ff1ff })); lamp.position.set(-0.6, 1.7, 1.75); g.add(lamp);
  toyFinishFleet(g, "rover");
  g.visible = false;
  castsShadow(g);
  scene.add(g);
  rover.mesh = g;
}

function roverCan() {
  return !!(state.vp && state.vp.rocket && state.phase === "TAXI" && rk.onBody && !rk.onBody.dock && !state.exploding && !rover.active);
}
function roverActive() { return rover.active; }

// A point on the body's surface some way from the capsule, in a random direction along the ground.
function surfacePoint(b, fromN, dist, angle) {
  rvTmp.set(0, 1, 0); if (Math.abs(fromN.y) > 0.9) rvTmp.set(1, 0, 0);
  const t1 = rvTmp.clone().cross(fromN).normalize(), t2 = fromN.clone().cross(t1).normalize();
  const dir = fromN.clone().multiplyScalar(b.r).add(t1.multiplyScalar(Math.cos(angle) * dist)).add(t2.multiplyScalar(Math.sin(angle) * dist)).normalize();
  return { x: b.x + dir.x * b.r, y: b.y + dir.y * b.r, z: b.z + dir.z * b.r, dir };
}
function placeRocks(b) {
  disposeSurfaceObjects(rover.rocks.map(o => o.mesh));
  rover.rocks = [];
  rover.n.set(state.x - b.x, state.y - b.y, state.z - b.z).normalize();
  const colors = [0x5ff1ff, 0xff7ab8, 0x7cff5a, 0xffd23e, 0xff9a3a, 0xb388ff, 0x5ff1ff, 0xff7ab8];
  for (let i = 0; i < 8; i++) {
    const p = surfacePoint(b, rover.n, 35 + rnd() * 110, rnd() * Math.PI * 2);
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), new THREE.MeshLambertMaterial({ color: colors[i], emissive: colors[i], emissiveIntensity: 0.7 }));
    m.position.set(p.x + p.dir.x * 0.8, p.y + p.dir.y * 0.8, p.z + p.dir.z * 0.8);
    m.rotation.set(rnd() * 3, rnd() * 3, 0);
    scene.add(m);
    rover.rocks.push({ mesh: m, x: m.position.x, y: m.position.y, z: m.position.z, lit: false, i });
  }
}
// The toys. Three ramps on the crater rims (drive over one fast and it is a big low-g
// jump with a whoop), a patch of soft sand where the wheels spin and dust flies until he
// wiggles the stick -- or it pops him out by itself -- and three boulders to shove, which
// roll off and thud into one of two craters with confetti. The camera button honks.
// A ramp's shape, from the same profile its solid uses (solids.js): h(t) =
// rise * t^k across its length, `w` wide, the foot at z = 0 and the lip at
// z = -len, so it stands with local -Z uphill.
function rampProfileMesh(len, rise, w, k, mat) {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.lineTo(len, 0);
  sh.lineTo(len, rise);
  const n = 14;
  for (let i = n - 1; i >= 0; i--) { const t = i / n; sh.lineTo(len * t, rise * Math.pow(t, k)); }
  const geo = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false });
  geo.translate(0, 0, -w / 2);
  const m = new THREE.Mesh(geo, mat);
  m.rotation.y = Math.PI / 2;           // shape-x runs uphill along local -Z
  return m;
}

function placeToys(b) {
  disposeSurfaceObjects(rover.toys.map(o => o.mesh));
  rover.toys = [];
  const tan = new THREE.MeshLambertMaterial({ color: b.name === "mars" ? 0xc98a5a : 0xd9d2b8 });
  const rockM = new THREE.MeshLambertMaterial({ color: b.name === "mars" ? 0x8a3f22 : 0x777b84 });
  const put = (mesh, p, lift) => { mesh.position.set(p.x + p.dir.x * lift, p.y + p.dir.y * lift, p.z + p.dir.z * lift); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.dir); scene.add(mesh); };
  solidDropOwner("toys");
  const RR = TUNE.rover.ramp;
  for (let i = 0; i < 3; i++) {   // ramps: a kicker, its high lip facing away from the capsule
    const ang = 0.4 + i * 2.1, p = surfacePoint(b, rover.n, 40 + i * 12, ang);
    const g = new THREE.Group();
    // the surface he drives up, drawn from the same profile the rover rides
    const k = Math.max(1, RR.lipSlope * RR.len / RR.rise);
    const wedge = rampProfileMesh(RR.len, RR.rise, RR.w, k, tan);
    wedge.position.z = RR.len / 2; g.add(wedge);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(RR.w + 0.2, 0.3, 0.6), new THREE.MeshBasicMaterial({ color: 0xffd23e }));
    lip.position.set(0, RR.rise, -RR.len / 2); g.add(lip);
    g.position.set(p.x, p.y, p.z);
    // turn it to face outward along the ground: local -Z is uphill
    const q = surfacePoint(b, rover.n, 52 + i * 12, ang), out = new THREE.Vector3(q.x - p.x, q.y - p.y, q.z - p.z); out.addScaledVector(p.dir, -out.dot(p.dir)).normalize();
    g.up.copy(p.dir); g.lookAt(p.x - out.x, p.y - out.y, p.z - out.z);
    scene.add(g);
    const foot = [p.x - out.x * RR.len / 2, p.y - out.y * RR.len / 2, p.z - out.z * RR.len / 2];
    const sb = solidRamp(foot, [out.x, out.y, out.z], [p.dir.x, p.dir.y, p.dir.z], RR.len, RR.rise, RR.w, RR.lipSlope, null, { owner: "toys" });
    rover.toys.push({ kind: "ramp", mesh: g, x: p.x, y: p.y, z: p.z, dir: out, solid: sb });
  }
  { const p = surfacePoint(b, rover.n, 75, 3.6);   // the sand
    const disc = new THREE.Mesh(new THREE.SphereGeometry(b.r + 0.35, 20, 6, 0, Math.PI * 2, 0, 13 / b.r), tan);
    disc.position.set(b.x, b.y, b.z); disc.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.dir); scene.add(disc);
    rover.toys.push({ kind: "sand", mesh: disc, x: p.x, y: p.y, z: p.z, r: 12, wiggles: 0, lastSign: 0, inT: 0 }); }
  const craters = [];
  for (let i = 0; i < 2; i++) { const p = surfacePoint(b, rover.n, 95, 1.0 + i * 3.3);   // the craters that swallow boulders
    const ring = new THREE.Mesh(new THREE.TorusGeometry(6, 0.7, 8, 24), rockM); put(ring, p, 0.3);
    craters.push({ x: p.x, y: p.y, z: p.z }); rover.toys.push({ kind: "crater", mesh: ring, x: p.x, y: p.y, z: p.z }); }
  rover.craters = craters;
  for (let i = 0; i < 3; i++) {   // boulders between the capsule and the craters
    const p = surfacePoint(b, rover.n, 60, 0.9 + i * 0.9 + (i === 2 ? 2.2 : 0));
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5, 0), rockM); put(m, p, 1.5);
    rover.toys.push({ kind: "boulder", mesh: m, x: m.position.x, y: m.position.y, z: m.position.z, vx: 0, vy: 0, vz: 0, sunk: false,
                      solid: solidToyBall(m.position.x, m.position.y, m.position.z, 1.5, "toys", m) });
  }
}
function updateToys(dt, b) {
  const sp = Math.abs(rover.speed);
  for (const t of rover.toys) {
    if (t.kind === "ramp") {
      // a surface now (solids.js), driven up in updateRover: nothing to trigger
    } else if (t.kind === "sand") {
      const inside = Math.hypot(t.x - rover.x, t.y - rover.y, t.z - rover.z) < t.r && rover.h <= 0;
      if (inside && !rover.stuck) { rover.stuck = true; t.inT = 0; t.wiggles = 0; t.lastSign = 0; noiseBurst(0.3, 250, 0.2, 0); flags.roverSandIn = (flags.roverSandIn || 0) + 1; }
      if (rover.stuck) {
        t.inT += dt;
        rover.speed = clamp(rover.speed * (1 - Math.min(1, 4 * dt)), -1.2, 1.2);   // wheels spin, it barely moves
        if (state.throttleHeld && rnd() < dt * 8) { wakePuff(rover.x + (rnd() - 0.5) * 2, rover.y, rover.z + (rnd() - 0.5) * 2, 0xd9c9a0, 0.5, 1.4, 0.6); if (rnd() < 0.3) noiseBurst(0.06, 500, 0.1, 0); }
        const sgn = Math.sign(state.ctrlBank) * (Math.abs(state.ctrlBank) > 0.4 ? 1 : 0);
        if (sgn && sgn !== t.lastSign) { if (t.lastSign) t.wiggles++; t.lastSign = sgn; }
        if (t.wiggles >= 4 || t.inT > 7) {   // out it pops (by itself if he does not wiggle: nothing is ever stuck)
          rover.stuck = false; rover.vh = 2.5; rover.h = 0.05;
          rover.x += rover.f.x * 3; rover.y += rover.f.y * 3; rover.z += rover.f.z * 3; rover.speed = 8;
          for (let k = 0; k < 10; k++) wakePuff(rover.x + (rnd() - 0.5) * 3, rover.y, rover.z + (rnd() - 0.5) * 3, 0xd9c9a0, 0.8, 2.5, 0.8);
          deepPop(); chirp(); flags.roverSandOut = (flags.roverSandOut || 0) + 1;
        }
      }
      if (!inside && rover.stuck && Math.hypot(t.x - rover.x, t.y - rover.y, t.z - rover.z) > t.r + 4) rover.stuck = false;
    } else if (t.kind === "boulder" && !t.sunk) {
      // shove it: it rolls along the ground and slows
      const dx = t.x - rover.x, dy = t.y - rover.y, dz = t.z - rover.z, d = Math.hypot(dx, dy, dz);
      if (d < 3.2 && sp > 1) { const s = Math.max(6, sp * 1.1); t.vx = rover.f.x * s; t.vy = rover.f.y * s; t.vz = rover.f.z * s; noiseBurst(0.12, 200, 0.25, 0); rover.speed *= 0.5; }
      const n = rvBn.set(t.x - b.x, t.y - b.y, t.z - b.z).normalize();
      const v = rvBv.set(t.vx, t.vy, t.vz); v.addScaledVector(n, -v.dot(n)); v.multiplyScalar(1 - Math.min(1, 0.12 * dt));
      t.vx = v.x; t.vy = v.y; t.vz = v.z;
      t.x += t.vx * dt; t.y += t.vy * dt; t.z += t.vz * dt;
      const rr = Math.hypot(t.x - b.x, t.y - b.y, t.z - b.z); t.x = b.x + (t.x - b.x) / rr * (b.r + 1.5); t.y = b.y + (t.y - b.y) / rr * (b.r + 1.5); t.z = b.z + (t.z - b.z) / rr * (b.r + 1.5);
      t.mesh.position.set(t.x, t.y, t.z);
      if (t.solid) solidFollow(t.solid, t.x, t.y, t.z);
      const vs = v.length(); if (vs > 0.2) { t.mesh.rotateOnWorldAxis(rvBax.crossVectors(n, v).normalize(), vs * dt / 1.5); if (rnd() < dt * 2) noiseBurst(0.08, 150, 0.08 * Math.min(1, vs / 6), 0); }
      for (const c of rover.craters) if (Math.hypot(c.x - t.x, c.y - t.y, c.z - t.z) < 5) {
        t.sunk = true; t.mesh.position.addScaledVector(n, -1.2); t.vx = t.vy = t.vz = 0;
        if (t.solid) solidFollow(t.solid, t.mesh.position.x, t.mesh.position.y, t.mesh.position.z);
        deepPop(); confettiBurst(); chime(); flags.roverBoulders = (flags.roverBoulders || 0) + 1;
      }
    }
  }
}
function roverHorn() { if (!rover.active) return false; synthBlip("square", 330, 330, 0.25, 0.22, 0); synthBlip("square", 262, 262, 0.25, 0.18, 0.3); flags.roverHorns = (flags.roverHorns || 0) + 1; return true; }
function roverDeploy() {
  if (!roverCan()) return false;
  if (!rover.mesh) buildRover();
  const b = rk.onBody;
  rover.body = b; rover.returning = false;
  rover.n.set(state.x - b.x, state.y - b.y, state.z - b.z).normalize();
  // roll out to the side of the capsule, facing away from it
  const p = surfacePoint(b, rover.n, 7, state.heading + Math.PI / 2);
  rover.x = p.x; rover.y = p.y; rover.z = p.z; rover.h = 0; rover.vh = 0; rover.speed = 0; rover.t = 0;
  rover.bangT = 0; rover.onRamp = null; rover.gPrev = 0;
  rover.f.set(rover.x - state.x, rover.y - state.y, rover.z - state.z);
  rover.f.addScaledVector(rover.n, -rover.f.dot(rover.n)).normalize();
  placeRocks(b);
  placeToys(b); rover.stuck = false;
  rover.mesh.visible = true;
  rover.active = true;
  rover.thrPrev = state.throttleHeld;
  el.roverBtn.dataset.mode = "back";
  rustle(); chirp();
  flags.roverOut = (flags.roverOut || 0) + 1;
  return true;
}
function roverReturn() {
  if (!rover.active) return false;
  rover.returning = true;
  toot();
  return true;
}
function toggleRover() { return rover.active ? roverReturn() : roverDeploy(); }
function roverReset() {
  rover.active = false; rover.returning = false;
  if (typeof setTone === "function") setTone("rover", "sawtooth", 60, 0);
  if (rover.mesh) rover.mesh.visible = false;
  disposeSurfaceObjects(rover.rocks.map(o => o.mesh));
  rover.rocks = [];
  disposeSurfaceObjects(rover.toys.map(o => o.mesh));
  rover.toys = []; rover.craters = []; rover.stuck = false;
  solidDropOwner("toys");
  disposeSurfaceObjects(rover.beacons.map(o => o.mesh));
  rover.beacons = [];
  if (el.roverBtn) el.roverBtn.dataset.mode = "out";
}
function plantBeacon() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.2, 6), new THREE.MeshLambertMaterial({ color: 0xf2f4f7 })); pole.position.y = 1.6; g.add(pole);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3b30 })); lamp.position.y = 3.4; g.add(lamp);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.06), new THREE.MeshLambertMaterial({ color: 0xffd23e, side: THREE.DoubleSide })); flag.position.set(0.7, 2.6, 0); g.add(flag);
  g.position.set(rover.x, rover.y, rover.z);
  g.up.copy(rover.n); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), rover.n);
  scene.add(g);
  rover.beacons.push({ mesh: g, lamp });
  while (rover.beacons.length > 6) { const old = rover.beacons.shift(); disposeSurfaceObjects([old.mesh]); }
  chirp(); noiseBurst(0.12, 900, 0.25, 0);
  flags.roverBeacons = (flags.roverBeacons || 0) + 1;
}

function updateRover(dt) {
  const b = rover.body;
  rover.t += dt;
  // in pieces: it waits, then comes back where it happened, backed off the
  // thing it hit, facing away from it. Nothing is lost.
  if (rover.bangT > 0) {
    rover.bangT -= dt;
    rover.speed = 0;
    if (rover.bangT <= 0) roverReassembleAt();
    return;
  }
  // local frame on the sphere
  rover.n.set(rover.x - b.x, rover.y - b.y, rover.z - b.z).normalize();
  rover.f.addScaledVector(rover.n, -rover.f.dot(rover.n)).normalize();
  let accel = 0, turn = 0;
  if (rover.returning) {
    // drive itself back to the capsule and climb in
    rvTmp.set(state.x - rover.x, state.y - rover.y, state.z - rover.z);
    const dist = rvTmp.length();
    rvTmp.addScaledVector(rover.n, -rvTmp.dot(rover.n)).normalize();
    rvTmp2.copy(rover.f).cross(rvTmp);
    turn = -clamp(rvTmp2.dot(rover.n) * 3, -1, 1);
    if (Math.abs(turn) < 0.05 && rover.f.dot(rvTmp) < 0) turn = 1;   // exactly tail-on: pick a side
    accel = rover.f.dot(rvTmp) > 0.2 ? 0.8 : 0.2;
    if (dist < 9) {
      rover.active = false; rover.returning = false; rover.mesh.visible = false;
      el.roverBtn.dataset.mode = "out";
      setTone("rover", "sawtooth", 60, 0);
      chirp(); flags.roverBack = (flags.roverBack || 0) + 1;
      return;
    }
  } else {
    // throttle = go; the stick steers; a pull down backs up slowly.
    // NOT negated. `rate` below is applied as applyAxisAngle(n, -rate), so a
    // positive `turn` is a negative rotation about the surface normal, which is
    // clockwise seen from above -- a right turn. With the minus here the rover
    // steered backwards for its whole life: drag right, nose goes left.
    accel = state.throttleHeld ? 1 : (state.ctrlPitch < -0.3 ? -0.5 : 0);
    turn = clamp(state.ctrlBank, -1, 1);
  }
  // The step scales the drive speed both ways (js/speed.js); the numbers
  // themselves now live in TUNE.rover rather than as literals here.
  const RV = TUNE.rover, rvStep = spdMul();
  const want = accel * (accel > 0 ? RV.cruise * rvStep : RV.reverse * rvStep);
  rover.speed += (want - rover.speed) * Math.min(1, (accel !== 0 ? 2.2 : 1.4) * dt);
  if (Math.abs(rover.speed) < 0.05) rover.speed = 0;
  // turn about the surface normal (slower when crawling)
  const rate = turn * 1.9 * dt * (0.45 + 0.55 * Math.min(1, Math.abs(rover.speed) / 6));   // turns in place too, a bit slower
  if (rate) rover.f.applyAxisAngle(rover.n, -rate).normalize();
  // move along the ground and stay on the sphere
  rover.x += rover.f.x * rover.speed * dt; rover.y += rover.f.y * rover.speed * dt; rover.z += rover.f.z * rover.speed * dt;
  rvTmp.set(rover.x - b.x, rover.y - b.y, rover.z - b.z).normalize();
  // bumps: a little hop now and then when rolling fast, in the body's gravity
  if (Math.abs(rover.speed) > 5 && rover.h <= 0 && rnd() < dt * 1.1) { rover.vh = 1.5 + rnd() * 2.5; noiseBurst(0.06, 400, 0.12, 0); }
  rover.vh -= b.g * 1.6 * dt;
  rover.h += rover.vh * dt;
  // THE GROUND is the sphere, or a ramp's surface where there is one (solids.js).
  // He drives UP a ramp: while he is on it his height is its height and his
  // climb is its rise under him, so what he leaves the lip with is the lip's
  // slope times his speed, and nothing else. A face higher than a step is a
  // wall, and the one wall law has it.
  const gr = roverGround(rvTmp);
  if (gr.wall) { roverHit(gr.wall); rvTmp.set(rover.x - b.x, rover.y - b.y, rover.z - b.z).normalize(); }
  else if (rover.h < gr.g) {
    if (rover.vh < -2.5 && gr.g <= 0) noiseBurst(0.08, 300, 0.18, 0);
    rover.vh = gr.ramp ? Math.max(0, (gr.g - rover.gPrev) / Math.max(dt, 1e-3)) : 0;
    rover.h = gr.g;
  }
  // off a lip: that is the launch
  if (rover.onRamp && !gr.ramp && rover.h > 0.3) roverLaunched(rover.onRamp);
  rover.onRamp = gr.ramp; rover.gPrev = gr.g;
  const R = b.r + 0.9 + rover.h;
  rover.x = b.x + rvTmp.x * R; rover.y = b.y + rvTmp.y * R; rover.z = b.z + rvTmp.z * R;
  // everything else he can hit: the one registry, the one law
  if (!rover.bangT) {
    const hit = solidQuery(rover.x, rover.y, rover.z, TUNE.solid.r.rover, SOLID.ROVER, undefined, sb => !!sb.ramp || !!sb.toy);
    if (hit) roverHit(hit);
  }
  // rocks: roll over one and it chimes and sparkles
  for (const r of rover.rocks) {
    if (r.lit) continue;
    if (Math.hypot(r.x - rover.x, r.y - rover.y, r.z - rover.z) < 4.5) {
      r.lit = true; r.mesh.visible = false;
      ringNote(r.i % 12);
      for (let k = 0; k < 6; k++) wakePuff(r.x + (rnd() - 0.5) * 2, r.y + rnd() * 2, r.z + (rnd() - 0.5) * 2, r.mesh.material.color.getHex(), 0.8, 2.5, 0.7);
      flags.roverRocks = (flags.roverRocks || 0) + 1;
      plantBeacon();   // marks where it was found
    } else {
      r.mesh.rotation.y += dt * 0.8;
    }
  }
  updateToys(dt, b);
  for (const bc of rover.beacons) bc.lamp.visible = (frameCount % 40) < 22;
  // the model
  const m = rover.mesh;
  m.position.set(rover.x, rover.y, rover.z);
  m.up.copy(rover.n);
  rvTmp.set(rover.x + rover.f.x, rover.y + rover.f.y, rover.z + rover.f.z);
  m.lookAt(rvTmp);
  for (const w of rover.wheels) w.rotation.x += rover.speed * dt / 0.55;
  setTone("rover", "sawtooth", 55 + Math.abs(rover.speed) * 7, Math.abs(rover.speed) > 0.3 ? 0.045 : 0);
  setEngine(0); setRocketEngine(0, 1);
  forward.copy(rover.f);
}
function roverCamera(dt) {
  camera.up.copy(rover.n);
  if (state.viewChase) {
    camDesired.set(rover.x - rover.f.x * 15 + rover.n.x * 6, rover.y - rover.f.y * 15 + rover.n.y * 6, rover.z - rover.f.z * 15 + rover.n.z * 6);
    camera.position.lerp(camDesired, Math.min(1, 5 * dt));
    lookV.set(rover.x + rover.f.x * 4 + rover.n.x * 1.5, rover.y + rover.f.y * 4 + rover.n.y * 1.5, rover.z + rover.f.z * 4 + rover.n.z * 1.5);
  } else {
    camera.position.set(rover.x + rover.n.x * 2.4 + rover.f.x * 1.2, rover.y + rover.n.y * 2.4 + rover.f.y * 1.2, rover.z + rover.n.z * 2.4 + rover.f.z * 1.2);
    lookV.set(rover.x + rover.f.x * 40 + rover.n.x * 2, rover.y + rover.f.y * 40 + rover.n.y * 2, rover.z + rover.f.z * 40 + rover.n.z * 2);
  }
  camera.lookAt(lookV);
}

// ---------------------------------------------------------------------------
// THE ROVER AND THE ONE REGISTRY (solids.js). It used to have no list at all:
// the domes, the garage, the masts and the parked Starships were air to it,
// and its ramps were circles that set a hop. Now it asks what everything asks.
// ---------------------------------------------------------------------------
const rvRampL = { a: 0, s: 0, h: 0 };
const rvGround = { g: 0, ramp: null, wall: null };
// The ground under him: 0 (the sphere), or the highest ramp surface he is over.
// A ramp face he meets more than a step BELOW its surface -- its side, or the
// lip's back -- is a wall.
function roverGround(up) {
  rvGround.g = 0; rvGround.ramp = null; rvGround.wall = null;
  const b = rover.body, step = TUNE.rover.stepUp;
  for (const sb of surfSolids) {
    if (!sb.ramp) continue;
    const rp = sb.ramp;
    // his foot: the sphere's surface under him
    const fx = b.x + up.x * b.r, fy = b.y + up.y * b.r, fz = b.z + up.z * b.r;
    solidRampLocal(rp, fx, fy, fz, rvRampL);
    const half = rp.w / 2, reach = TUNE.solid.r.rover * 0.6;
    if (rvRampL.a < -reach || rvRampL.a > rp.len + reach || Math.abs(rvRampL.s) > half + reach) continue;
    if (Math.abs(rvRampL.h) > 30) continue;
    const inside = rvRampL.a >= 0 && rvRampL.a <= rp.len && Math.abs(rvRampL.s) <= half;
    const top = solidRampH(rp, rvRampL.a);
    if (inside) {
      if (top - rover.h > step && rover.onRamp !== sb) {
        // came at it through a face, not up its slope
        const toSide = half - Math.abs(rvRampL.s), toBack = rp.len - rvRampL.a;
        const n = toBack < toSide ? rp.dir : rvRampL.s > 0 ? rp.side : [-rp.side[0], -rp.side[1], -rp.side[2]];
        rvGround.wall = { b: sb, kind: "ramp", d: Math.min(toSide, toBack) + reach, nx: n[0], ny: n[1], nz: n[2] };
        return rvGround;
      }
      if (top > rvGround.g) { rvGround.g = top; rvGround.ramp = sb; }
    } else if (rvRampL.a > rp.len && rover.onRamp !== sb && rover.h < rp.rise - step &&
               Math.abs(rvRampL.s) <= half && rvRampL.a < rp.len + reach) {
      // nose against the lip's back face
      rvGround.wall = { b: sb, kind: "ramp", d: rp.len + reach - rvRampL.a, nx: rp.dir[0], ny: rp.dir[1], nz: rp.dir[2] };
      return rvGround;
    }
  }
  return rvGround;
}

// Off a lip, into the air: the noise, the count, and on Mars the tumble.
function roverLaunched(sb) {
  synthBlip("sine", 400, 900, 0.35, 0.28, 0); noiseBurst(0.15, 700, 0.15, 0);
  flags.roverJumps = (flags.roverJumps || 0) + 1;
  flags.rampLaunch = { owner: sb.owner, vh: +rover.vh.toFixed(2), speed: +Math.abs(rover.speed).toFixed(2) };
  if (sb.owner === "mars" && typeof marsJumpLaunched === "function") marsJumpLaunched(sb);
}

// The one wall law, on a sphere: over the crawl a bang, at or under it a shove.
// The push is along the ground (the part of the normal across the sphere); a
// thing he lands on top of holds him up instead.
function roverHit(hit) {
  const n = rover.n;
  let nx = hit.nx, ny = hit.ny, nz = hit.nz;
  const dn = nx * n.x + ny * n.y + nz * n.z;
  nx -= n.x * dn; ny -= n.y * dn; nz -= n.z * dn;
  const tl = Math.hypot(nx, ny, nz);
  if (tl < 0.3 && dn > 0) {           // on top of it: it is a floor
    rover.h += hit.d; if (rover.vh < 0) rover.vh = 0;
    return;
  }
  nx /= tl || 1; ny /= tl || 1; nz /= tl || 1;
  // Driving itself home is not his choice: it slides round whatever is in the
  // way and never bangs, or a dome between it and the capsule would be a loop.
  if (rover.returning) {
    rover.x += nx * (hit.d + 0.3); rover.y += ny * (hit.d + 0.3); rover.z += nz * (hit.d + 0.3);
    const into = rover.f.x * nx + rover.f.y * ny + rover.f.z * nz;
    if (into < 0) { rover.f.x -= nx * into; rover.f.y -= ny * into; rover.f.z -= nz * into; rover.f.normalize(); }
    return;
  }
  const crawl = Math.abs(rover.speed) <= TUNE.solid.crawl.rover;
  solidCount("rover", hit.kind, crawl ? "shove" : "crash");
  flags.wallHits = (flags.wallHits || 0) + 1;
  if (!crawl) { roverBang(nx, ny, nz); return; }
  const k = hit.d + 0.3;
  rover.x += nx * k; rover.y += ny * k; rover.z += nz * k;
  rover.speed *= 0.35;
  noiseBurst(0.12, 220, 0.2, 0);
  flags.solidShoves = (flags.solidShoves || 0) + 1;
}

function roverBang(nx, ny, nz) {
  rover.bangT = TUNE.solid.reassemble;
  rover.bangN = [nx, ny, nz];
  rover.speed = 0; rover.vh = 0;
  triggerExplosion(rover.x, rover.y + 1, rover.z, 0.7);
  cameraHitStop(0.8);
  if (rover.mesh) rover.mesh.visible = false;
  flags.roverCrashes = (flags.roverCrashes || 0) + 1;
}

// Back where it happened, walked off the thing it hit, turned away from it.
function roverReassembleAt() {
  const b = rover.body, n = rover.bangN || [0, 0, 0], back = TUNE.solid.backOff;
  rover.bangT = 0;
  rover.x += n[0] * back; rover.y += n[1] * back; rover.z += n[2] * back;
  for (let i = 0; i < 8; i++) {
    const h = solidQuery(rover.x, rover.y, rover.z, TUNE.solid.r.rover + 1, SOLID.ROVER);
    if (!h) break;
    rover.x += h.nx * (h.d + 1); rover.y += h.ny * (h.d + 1); rover.z += h.nz * (h.d + 1);
  }
  rvTmp.set(rover.x - b.x, rover.y - b.y, rover.z - b.z).normalize();
  rover.n.copy(rvTmp);
  rover.h = 0; rover.vh = 0; rover.onRamp = null; rover.gPrev = 0;
  const R = b.r + 0.9;
  rover.x = b.x + rvTmp.x * R; rover.y = b.y + rvTmp.y * R; rover.z = b.z + rvTmp.z * R;
  rvTmp2.set(n[0], n[1], n[2]); rvTmp2.addScaledVector(rover.n, -rvTmp2.dot(rover.n));
  if (rvTmp2.lengthSq() > 1e-4) rover.f.copy(rvTmp2.normalize());
  if (rover.mesh) rover.mesh.visible = true;
  thunk();
  flags.roverReassembles = (flags.roverReassembles || 0) + 1;
}
