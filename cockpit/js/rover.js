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
  mesh: null, wheels: [], rocks: [], beacons: [], arches: [], loopT: 0,
};
const rvTmp = new THREE.Vector3(), rvTmp2 = new THREE.Vector3();

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
  g.visible = false;
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
  for (const r of rover.rocks) scene.remove(r.mesh);
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
// The loop: six glowing arches in a ring around the landing site. Drive through each for a
// rising note; all six and it is fireworks, then they re-arm (like the flight gates).
function placeArches(b) {
  for (const a of rover.arches) scene.remove(a.mesh);
  rover.arches = [];
  for (let i = 0; i < 6; i++) {
    const ang = i / 6 * Math.PI * 2, p = surfacePoint(b, rover.n, 60, ang);
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x5ff1ff });
    for (const sx of [-1, 1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 5, 8), mat); post.position.set(sx * 4, 2.5, 0); g.add(post); }
    const bar = new THREE.Mesh(new THREE.TorusGeometry(4, 0.35, 8, 20, Math.PI), mat); bar.position.y = 5; g.add(bar);
    g.position.set(p.x, p.y, p.z);
    // stand on the ground, facing along the ring (tangent) so the loop drives through them
    const up = p.dir.clone();
    const q = surfacePoint(b, rover.n, 60, ang + 0.1);
    const t = new THREE.Vector3(q.x - p.x, q.y - p.y, q.z - p.z); t.addScaledVector(up, -t.dot(up)).normalize();
    g.up.copy(up); g.lookAt(p.x + t.x, p.y + t.y, p.z + t.z);
    scene.add(g);
    rover.arches.push({ mesh: g, mat, x: p.x, y: p.y, z: p.z, lit: false, i });
  }
  rover.loopT = 0;
}
function archesReset() { for (const a of rover.arches) { a.lit = false; a.mat.color.setHex(0x5ff1ff); } rover.loopT = 0; }
function updateArches(dt) {
  if (rover.loopT > 0) { rover.loopT -= dt; if (rover.loopT <= 0) archesReset(); return; }
  for (const a of rover.arches) {
    if (a.lit) continue;
    if (Math.hypot(a.x - rover.x, a.y - rover.y, a.z - rover.z) < 6) {
      a.lit = true; a.mat.color.setHex(0x7cff5a);
      ringNote(a.i * 2);
      flags.roverArches = (flags.roverArches || 0) + 1;
    }
  }
  if (rover.arches.length && rover.arches.every(a => a.lit)) {
    fanfare(); confettiBurst(); for (let i = 0; i < 5; i++) fireworkSound(0.3 + i * 0.4);
    flags.roverLoops = (flags.roverLoops || 0) + 1;
    rover.loopT = TUNE.gateRearm;
  }
}
function roverDeploy() {
  if (!roverCan()) return false;
  if (!rover.mesh) buildRover();
  const b = rk.onBody;
  rover.body = b; rover.returning = false;
  rover.n.set(state.x - b.x, state.y - b.y, state.z - b.z).normalize();
  // roll out to the side of the capsule, facing away from it
  const p = surfacePoint(b, rover.n, 7, state.heading + Math.PI / 2);
  rover.x = p.x; rover.y = p.y; rover.z = p.z; rover.h = 0; rover.vh = 0; rover.speed = 0; rover.t = 0;
  rover.f.set(rover.x - state.x, rover.y - state.y, rover.z - state.z);
  rover.f.addScaledVector(rover.n, -rover.f.dot(rover.n)).normalize();
  placeRocks(b);
  placeArches(b);
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
  if (rover.mesh) rover.mesh.visible = false;
  for (const r of rover.rocks) scene.remove(r.mesh);
  rover.rocks = [];
  for (const a of rover.arches) scene.remove(a.mesh);
  rover.arches = [];
  for (const bc of rover.beacons) scene.remove(bc.mesh);
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
  while (rover.beacons.length > 6) { const old = rover.beacons.shift(); scene.remove(old.mesh); }
  chirp(); noiseBurst(0.12, 900, 0.25, 0);
  flags.roverBeacons = (flags.roverBeacons || 0) + 1;
}

function updateRover(dt) {
  const b = rover.body;
  rover.t += dt;
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
    accel = rover.f.dot(rvTmp) > 0.2 ? 0.8 : 0.2;
    if (dist < 9) {
      rover.active = false; rover.returning = false; rover.mesh.visible = false;
      el.roverBtn.dataset.mode = "out";
      setTone("rover", "sawtooth", 60, 0);
      chirp(); flags.roverBack = (flags.roverBack || 0) + 1;
      return;
    }
  } else {
    // throttle = go; the stick steers; a pull down backs up slowly
    accel = state.throttleHeld ? 1 : (state.ctrlPitch < -0.3 ? -0.5 : 0);
    turn = -clamp(state.ctrlBank, -1, 1);
  }
  const want = accel * (accel > 0 ? 14 : 6);
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
  if (rover.h < 0) { if (rover.vh < -2.5) noiseBurst(0.08, 300, 0.18, 0); rover.h = 0; rover.vh = 0; }
  const R = b.r + 0.9 + rover.h;
  rover.x = b.x + rvTmp.x * R; rover.y = b.y + rvTmp.y * R; rover.z = b.z + rvTmp.z * R;
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
  updateArches(dt);
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
