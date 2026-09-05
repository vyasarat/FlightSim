"use strict";
// ---------------------------------------------------------------------------
// The Mars base. Landing on Mars used to be a patch of red ground with eight
// glowing rocks on it; now it is somewhere -- glass domes, antenna masts, a
// rover garage, a row of Starships already standing there, red dunes, and a
// handful of tiny astronauts to whom nothing can ever happen.
//
// It is built around WHEREVER he comes down, with the lit pad drawn as a ring
// about the rocket itself. That way he always lands in the middle of the base,
// and "drive back to the pad" is the same thing as "drive back to the rocket" --
// so the whole set-piece needs no new control at all.
//
//   shortly after he starts driving   a light on the horizon, a big-numeral
//                                     countdown, and a cargo Starship comes
//                                     down under power beside the base. It
//                                     stays for the rest of the visit.
//   drive back onto the lit pad       the rover parks itself, the pad counts
//                                     down, and his rocket lifts off for home.
//
// The Moon is left exactly as it was.
// ---------------------------------------------------------------------------

const MB = TUNE.marsBase;
const mars = {
  g: null, body: null,
  x: 0, y: 0, z: 0, n: new THREE.Vector3(0, 1, 0),
  pad: null, padMat: null, lights: [],
  cargo: null, cargoGlow: null, horizonLight: null,
  phase: "none",     // none | idle | armed | returning | count | launch
  t: 0, cargoT: 0, cargoPhase: "waiting",   // waiting | count | falling | down
  wentOut: false, clock: 0,
  boostT: 0,         // survives marsClear: the pad's hand stays on the throttle after lift-off
  // things to do out there
  jumps: [], rocks: [], rocksAway: false, drone: null,
  jump: { air: false, peaked: false, t: 0, roll: 0, spin: 0, flipT: 0, flipFrom: 0 },
};
const mbTmp = new THREE.Vector3();

function marsIsHome() {
  return !!(state.vp && state.vp.rocket && rk.onBody && rk.onBody.name === "mars");
}

function marsClear() {
  if (mars.g) { scene.remove(mars.g); mars.g = null; }
  if (mars.cargo) scene.remove(mars.cargo);          // it lives in the scene, not the base group
  if (mars.horizonLight) scene.remove(mars.horizonLight);
  countdownClear();
  mars.pad = null; mars.padMat = null; mars.lights = [];
  mars.cargo = null; mars.cargoGlow = null; mars.horizonLight = null;
  mars.phase = "none"; mars.t = 0; mars.cargoT = 0; mars.cargoPhase = "waiting";
  mars.wentOut = false;
  marsToysClear();
}

// Everything is laid out around the rocket, on the surface, standing up along
// the local normal. `place` does the orienting so nothing below has to think.
function marsPlace(g, dist, angle, lift) {
  const p = surfacePoint(mars.body, mars.n, dist, angle);
  g.position.set(p.x + p.dir.x * (lift || 0), p.y + p.dir.y * (lift || 0), p.z + p.dir.z * (lift || 0));
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.dir);
  return p;
}

function marsBuild() {
  marsClear();
  const b = rk.onBody;
  mars.body = b;
  mars.n.set(state.x - b.x, state.y - b.y, state.z - b.z).normalize();
  // the pad goes on the GROUND under him, not at his own height: he is standing a
  // few metres up on his legs, and the ring has to be where the rover drives
  mars.x = b.x + mars.n.x * b.r;
  mars.y = b.y + mars.n.y * b.r;
  mars.z = b.z + mars.n.z * b.r;
  const g = new THREE.Group();
  const rust = 0xb4552c, pale = 0xd8dde4, steel = 0xc9ced6, dark = 0x3c4350;

  // (Mars's own surface is the right rust already -- it only ever looked white in
  // testing because that was landing on the polar ice cap, dead on the north pole.)
  // red dunes, low and wide, so the ground has shape to drive over
  for (let i = 0; i < MB.dunes; i++) {
    const r = MB.duneR[0] + hashSalt(i, 77, 4) * (MB.duneR[1] - MB.duneR[0]);
    const d = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: i % 2 ? 0x9c4522 : rust }));
    d.scale.y = 0.22;
    marsPlace(d, MB.spread * (0.7 + hashSalt(i, 77, 6) * 1.5), hashSalt(i, 77, 8) * Math.PI * 2, -1);
    g.add(d);
  }
  // glass domes with a connecting tube each
  for (let i = 0; i < MB.domes; i++) {
    const dome = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(MB.domeR, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.45 }));
    dome.add(shell);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(MB.domeR, 0.9, 6, 24), lam(pale));
    rim.rotation.x = Math.PI / 2; dome.add(rim);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff2b0, fog: false }));
    lamp.position.y = MB.domeR + 1.5; dome.add(lamp);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, MB.domeR * 1.4, 8), lam(pale));
    tube.rotation.z = Math.PI / 2; tube.position.set(MB.domeR * 0.8, 3, 0); dome.add(tube);
    marsPlace(dome, MB.spread * 0.62, 0.7 + i * 1.5, 0);
    g.add(dome);
  }
  // the rover garage: an open shed it could drive into
  {
    const gar = new THREE.Group();
    const shed = new THREE.Mesh(new THREE.BoxGeometry(22, 9, 16), lam(pale));
    shed.position.y = 4.5; gar.add(shed);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(14, 7, 1), lam(0x23282f));
    mouth.position.set(0, 3.6, 8.2); gar.add(mouth);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(24, 1, 18), lam(0xd4a72c));
    roof.position.y = 9.4; gar.add(roof);
    marsPlace(gar, MB.spread * 0.5, 3.4, 0);
    g.add(gar);
  }
  // antenna masts with dishes
  for (let i = 0; i < MB.masts; i++) {
    const m = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, MB.mastH, 6), lam(pale));
    pole.position.y = MB.mastH / 2; m.add(pole);
    const dish = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.6, 12, 1, true), lam(pale));
    dish.position.y = MB.mastH; dish.rotation.x = -0.7; m.add(dish);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.8, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff3b30, fog: false }));
    tip.position.y = MB.mastH + 1.5; m.add(tip);
    marsPlace(m, MB.spread * 0.75, 2.2 + i * 1.15, 0);
    g.add(m);
  }
  // a row of Starships already standing there
  for (let i = 0; i < MB.parked; i++) {
    const sh = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 34, 14), lam(steel));
    hull.position.y = 17; sh.add(hull);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(3.4, 11, 14), lam(steel));
    nose.position.y = 39.5; sh.add(nose);
    for (const sx of [-1, 1]) {
      const flap = new THREE.Mesh(new THREE.BoxGeometry(1, 9, 4), lam(0x23272d));
      flap.position.set(sx * 3.4, 30, -1.5); sh.add(flap);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.9, 7, 0.9), lam(dark));
      leg.position.set(sx * 3.2, 3.2, 0); leg.rotation.z = sx * 0.28; sh.add(leg);
    }
    marsPlace(sh, MB.spread * 1.05, 4.4 + i * 0.42, 0);
    g.add(sh);
  }
  // tiny astronauts, dotted about. Never solid, never a target, never removed.
  for (let i = 0; i < MB.astros; i++) {
    const a = buildAstronaut(true);
    a.visible = true;
    a.scale.setScalar(1.6);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 9), lam(0xf2f4f7));
    helmet.position.y = 0.7; a.add(helmet);
    a.userData.noShatter = true;
    marsPlace(a, MB.spread * (0.45 + hashSalt(i, 91, 2) * 0.55), 0.35 + i * 1.27, 1.6);
    g.add(a);
  }
  // the lit pad: a ring drawn about the rocket itself, so where he lands IS the pad
  {
    const pad = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(MB.padR, 28), lam(0x5b5049));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.25; pad.add(disc);
    const padMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, fog: false });
    mars.padMat = padMat;
    mars.lights = [];
    for (let i = 0; i < MB.padLights; i++) {
      const a = i / MB.padLights * Math.PI * 2;
      const lt = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 1.6), padMat);
      lt.position.set(Math.cos(a) * MB.padR, 0.9, Math.sin(a) * MB.padR);
      pad.add(lt); mars.lights.push(lt);
    }
    marsPlace(pad, 0.01, 0, 0);
    g.add(pad);
    mars.pad = pad;
  }
  marsToysBuild(g);
  castsAndReceives(g);
  scene.add(g);
  mars.g = g;
  mars.phase = "idle";
  mars.cargoPhase = "waiting";
  mars.cargoT = MB.cargoDelay;
  mars.wentOut = false;
  flags.marsBases = (flags.marsBases || 0) + 1;
}

// ---- the cargo Starship that comes down beside the base
function marsBuildCargo() {
  const g = new THREE.Group();
  const steel = 0xc9ced6, dark = 0x23272d;
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 36, 14), lam(steel));
  hull.position.y = 18; g.add(hull);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(3.6, 12, 14), lam(steel));
  nose.position.y = 42; g.add(nose);
  for (const sx of [-1, 1]) {
    const flap = new THREE.Mesh(new THREE.BoxGeometry(1, 10, 4.5), lam(dark));
    flap.position.set(sx * 3.6, 31, -1.6); g.add(flap);
  }
  const legs = [];
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(1.1, 9, 1.1), lam(dark));
    leg.position.set(Math.cos(a) * 3.4, 4, Math.sin(a) * 3.4);
    leg.userData.a = a;
    g.add(leg); legs.push(leg);
  }
  g.userData.legs = legs;
  const glow = new THREE.Mesh(new THREE.ConeGeometry(3.2, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffb43a, fog: false }));
  glow.rotation.x = Math.PI;      // the plume hangs below it
  glow.position.y = -5;
  g.add(glow);
  g.userData.glow = glow;
  return g;
}

function marsCargoStart() {
  const p = surfacePoint(mars.body, mars.n, MB.cargoOffset, 2.9);
  mars.cargo = marsBuildCargo();
  mars.cargoTo = p;
  mars.cargoH = MB.cargoFrom;
  mars.cargo.position.set(p.x + p.dir.x * mars.cargoH, p.y + p.dir.y * mars.cargoH, p.z + p.dir.z * mars.cargoH);
  mars.cargo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.dir);
  for (const l of mars.cargo.userData.legs) l.position.y = 8;   // tucked up until the last moment
  scene.add(mars.cargo);
  mars.cargoPhase = "falling";
  flags.marsCargoArrivals = (flags.marsCargoArrivals || 0) + 1;
}

function marsCargoDown() {
  mars.cargoPhase = "down";
  const p = mars.cargoTo;
  for (let i = 0; i < MB.dust; i++) {
    wakePuff(p.x + (rnd() - 0.5) * 34, p.y + p.dir.y * 2 + rnd() * 6, p.z + (rnd() - 0.5) * 34,
      0xc98a5a, 3.2, MB.dustRise, MB.dustLife);
  }
  if (mars.cargo.userData.glow) mars.cargo.userData.glow.visible = false;
  deepPop(); noiseBurst(0.5, 110, 0.34, 0);
  shakeAmp = Math.max(shakeAmp, 0.5);
}

function marsGoHome() {
  mars.phase = "count";
  mars.t = MB.padCount;
}

function updateMarsBase(dt) {
  // The pad keeps his throttle in for a moment after lift-off and then lets go.
  // Releasing it the instant he was airborne just let Mars pull him back down; not
  // releasing it at all left the engine burning for ever with nobody's finger on
  // anything. This runs outside the on-Mars test so it survives leaving.
  if (mars.boostT > 0) {
    mars.boostT -= dt;
    if (state.vp && state.vp.rocket && !rk.onBody && state.phase === "AIRBORNE") state.throttleHeld = true;
    if (mars.boostT <= 0) { state.throttleHeld = false; releaseThrottle(); }
  }
  // built the moment he sets down on Mars, cleared the moment he is not there
  if (!marsIsHome()) {
    if (mars.phase === "launch" && mars.boostT <= 0) {
      mars.boostT = MB.boost;
      flags.marsDepartures = (flags.marsDepartures || 0) + 1;
    }
    if (mars.phase !== "none") marsClear();
    return;
  }
  if (mars.phase === "none" || (mars.body && rk.onBody !== mars.body) ||
      Math.hypot(state.x - mars.x, state.y - mars.y, state.z - mars.z) > MB.padR * 3) {
    marsBuild();
  }
  mars.clock += dt;
  updateMarsToys(dt);

  // the pad lights: a steady amber, hurrying once it is taking him home
  if (mars.padMat) {
    const counting = mars.phase === "count" || mars.phase === "launch";
    const on = counting ? (Math.floor(mars.clock * 9) % 2 === 0) : (Math.sin(mars.clock * 2.2) > -0.3);
    mars.padMat.color.setHex(on ? (counting ? 0xffffff : 0xffd23e) : 0x5a4a18);
  }

  // ---- the cargo ship, announced and then flown down beside the base
  if (roverActive() && mars.cargoPhase === "waiting") {
    mars.cargoT -= dt;
    if (mars.cargoT <= 0) { mars.cargoPhase = "count"; mars.cargoT = MB.cargoCount; synthBlip("sine", 180, 320, 1.0, 0.16, 0); }
  } else if (mars.cargoPhase === "count") {
    mars.cargoT -= dt;
    countdownTo(mars.cargoT, MB.cargoCount);
    // a light low on the horizon, where it is coming from
    if (!mars.horizonLight) {
      const p = surfacePoint(mars.body, mars.n, MB.cargoOffset, 2.9);
      mars.horizonLight = new THREE.Mesh(new THREE.SphereGeometry(3.5, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff2b0, fog: false }));
      mars.horizonLight.position.set(p.x + p.dir.x * 140, p.y + p.dir.y * 140, p.z + p.dir.z * 140);
      scene.add(mars.horizonLight);
    }
    mars.horizonLight.visible = (frameCount % 26) < 14;
    if (mars.cargoT <= 0) {
      countdownClear();
      if (mars.horizonLight) { scene.remove(mars.horizonLight); mars.horizonLight = null; }
      marsCargoStart();
    }
  } else if (mars.cargoPhase === "falling") {
    const p = mars.cargoTo;
    mars.cargoH -= MB.cargoSpeed * dt;
    const legOut = clamp(1 - mars.cargoH / 120, 0, 1);
    for (const l of mars.cargo.userData.legs) {
      l.position.y = 8 - legOut * 4;
      l.rotation.z = Math.cos(l.userData.a) * legOut * 0.3;
      l.rotation.x = -Math.sin(l.userData.a) * legOut * 0.3;
    }
    if (mars.cargo.userData.glow) {
      const k = 0.7 + rnd() * 0.6;
      mars.cargo.userData.glow.scale.set(k, 1 + legOut * 0.6, k);
    }
    if (mars.cargoH < 260 && rnd() < dt * 22) {
      wakePuff(p.x + (rnd() - 0.5) * 26, p.y + 1, p.z + (rnd() - 0.5) * 26, 0xc98a5a, 2.2, 4, 1.8);
    }
    if (mars.cargoH <= MB.cargoLegs * 3) {
      mars.cargoH = MB.cargoLegs * 3;
      marsCargoDown();
    }
    mars.cargo.position.set(p.x + p.dir.x * mars.cargoH, p.y + p.dir.y * mars.cargoH, p.z + p.dir.z * mars.cargoH);
  }

  // ---- the way home. He drives out, and driving back onto the lit pad takes him.
  if (mars.phase === "idle" && roverActive() && !marsDroneActive()) {
    if (Math.hypot(rover.x - mars.x, rover.y - mars.y, rover.z - mars.z) > MB.armDist) {
      mars.phase = "armed";
      mars.wentOut = true;
    }
  } else if (mars.phase === "armed") {
    if (!roverActive()) { mars.phase = "idle"; }
    else if (marsDroneActive()) { /* flying the drone: the pad waits */ }
    else if (Math.hypot(rover.x - mars.x, rover.y - mars.y, rover.z - mars.z) < MB.triggerR) {
      mars.phase = "returning";
      roverReturn();                    // it parks itself: nothing to line up, no new button
      flags.marsPadCalls = (flags.marsPadCalls || 0) + 1;
    }
  } else if (mars.phase === "returning") {
    if (!roverActive()) marsGoHome();
  } else if (mars.phase === "count") {
    mars.t -= dt;
    countdownTo(mars.t, MB.padCount);
    if (mars.t <= 0) {
      countdownClear();
      mars.phase = "launch";
      state.throttleHeld = true;        // the pad lights him: the normal launch, hands off
    }
  } else if (mars.phase === "launch") {
    state.throttleHeld = true;        // the pad lights him: the normal launch, hands off
  }
}

// ===========================================================================
// Things to DO out there. Everything below is Mars-only: the Moon keeps its
// own quiet toys. Nothing here can be failed, lost or run out of.
// ===========================================================================

const mbT2 = new THREE.Vector3(), mbT3 = new THREE.Vector3(), mbT4 = new THREE.Vector3();
const mbBasis = new THREE.Matrix4();
const MARS_ROCK = 0x8c4a2a, MARS_ROCK2 = 0xa85c34;

// Point a group along the surface: +Y is the local up, -Z is `fwd`.
function marsAim(g, up, fwd) {
  mbT3.copy(fwd).addScaledVector(up, -fwd.dot(up)).normalize();
  mbT4.copy(mbT3).cross(up).normalize();                    // right = fwd x up
  mbBasis.makeBasis(mbT4, up, mbT3.clone().negate());
  g.quaternion.setFromRotationMatrix(mbBasis);
  return mbT3.clone();
}

// ---------------------------------------------------------------------------
// 1. DUNE JUMPS. Sculpted ramps out on the dunes, ringed in the pad's own
// language so they read as "go through here". Hit one with any speed on and it
// throws him: he tumbles, and where he points the nose is the whole skill.
// A bad landing rolls it over, and it rights itself in about a second.
// ---------------------------------------------------------------------------
function marsBuildJumps(g) {
  const J = MB.jumps;
  mars.jumps = [];
  const dirt = new THREE.MeshLambertMaterial({ color: 0xb4643a });
  const lip = new THREE.MeshLambertMaterial({ color: 0xd4a72c });   // a gold edge, so the lip reads as an edge
  for (let i = 0; i < J.count; i++) {
    const ang = (i / J.count) * Math.PI * 2 + 0.6;
    const dist = J.dist[0] + rnd() * (J.dist[1] - J.dist[0]);
    const p = surfacePoint(mars.body, mars.n, dist, ang);
    const jg = new THREE.Group();
    jg.position.set(p.x, p.y, p.z);
    // uphill points away from the base: he drives out, and up
    mbT2.set(p.x - mars.x, p.y - mars.y, p.z - mars.z);
    if (mbT2.lengthSq() < 1e-4) mbT2.set(1, 0, 0);
    const fwd = marsAim(jg, p.dir, mbT2);

    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.lineTo(J.len, 0);
    sh.lineTo(J.len, J.rise);
    sh.quadraticCurveTo(J.len * 0.45, J.rise * 0.30, 0, 0);   // a scooped run-up
    const geo = new THREE.ExtrudeGeometry(sh, { depth: J.w, bevelEnabled: false });
    geo.translate(0, 0, -J.w / 2);
    const ramp = new THREE.Mesh(geo, dirt);
    ramp.rotation.y = Math.PI / 2;      // shape-x runs uphill along local -Z
    jg.add(ramp);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(J.w + 0.6, 0.5, 1.2), lip);
    edge.position.set(0, J.rise, -J.len);
    jg.add(edge);
    // the ring, standing over the lip and tipped back along the slope
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, fog: false });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(J.ringR, 0.55, 8, 22), ringMat);
    ring.position.set(0, J.rise + J.ringR * 0.8, -J.len - 1.5);
    ring.rotation.x = -0.4;
    jg.add(ring);
    g.add(jg);
    mars.jumps.push({ g: jg, ring, mat: ringMat, x: p.x, y: p.y, z: p.z, dir: fwd, armed: false });
  }
}

// The launch itself. Runs before updateRover, so it sets the hop the rover's own
// gravity then flies -- no second physics model, and it lands the way it always did.
function marsJumpCheck(dt) {
  const J = MB.jumps, a = mars.jump;
  const sp = Math.abs(rover.speed);
  for (const j of mars.jumps) {
    const d = Math.hypot(j.x - rover.x, j.y - rover.y, j.z - rover.z);
    j.mat.color.setHex((frameCount % 30) < 18 ? 0xffd23e : 0x6b5410);
    if (d < J.hitR && sp > J.minSpeed && rover.h < J.groundish && !j.armed && rover.f.dot(j.dir) > 0.3) {
      j.armed = true;
      rover.vh = Math.max(rover.vh, J.kick + sp * J.kickPerSpeed);
      rover.h = Math.max(rover.h, 0.06);
      a.air = true; a.roll = 0; a.peaked = false; a.t = 0;
      a.spin = J.spin * (0.7 + rnd() * 0.6);
      synthBlip("sine", 380, 980, 0.4, 0.3, 0);
      noiseBurst(0.18, 650, 0.18, 0);
      for (let k = 0; k < 8; k++) wakePuff(j.x + (rnd() - 0.5) * 6, j.y + rnd() * 3, j.z + (rnd() - 0.5) * 6, 0xc98a5a, 1.6, 3, 1.2);
      flags.marsJumps = (flags.marsJumps || 0) + 1;
    }
    if (d > J.hitR * 1.8) j.armed = false;      // one launch per pass
  }
}

// The tumble, applied after the rover has written its own orientation.
function marsJumpLate(dt) {
  const J = MB.jumps, a = mars.jump;
  if (a.air) {
    a.roll += a.spin * dt;
    a.t += dt;
    // It is only "down" once it has properly been UP. Testing the height alone
    // called the landing on the launch frame itself -- the rover was still at
    // 0.2 m with all its speed ahead of it -- so it never tumbled at all.
    if (rover.h > J.airborneAt) a.peaked = true;
    if (a.t > J.maxAir) { a.air = false; a.peaked = false; a.roll = 0; }
    else if (a.peaked && rover.h <= 0.3) {
      // down. A dust burst either way; if it came down well off level it rolls
      // over, and picks itself up. Nothing is lost, ever.
      a.air = false; a.peaked = false;
      const off = wrapPi(a.roll);
      for (let k = 0; k < J.dust; k++) {
        wakePuff(rover.x + (rnd() - 0.5) * 9, rover.y + rnd() * 3, rover.z + (rnd() - 0.5) * 9, 0xc98a5a, 1.8, 4, J.dustLife);
      }
      noiseBurst(0.22, 300, 0.22, 0);
      if (Math.abs(off) > J.flipAt) { a.flipT = J.flipTime; a.flipFrom = off; synthBlip("square", 220, 160, 0.3, 0.16, 0); flags.marsJumpFlips = (flags.marsJumpFlips || 0) + 1; }
      else { chirp(); }
      a.roll = 0;
      flags.marsJumpLandings = (flags.marsJumpLandings || 0) + 1;
    }
  }
  if (!a.air && a.flipT > 0) a.flipT = Math.max(0, a.flipT - dt);
  const amt = a.air ? a.roll : (a.flipT > 0 ? a.flipFrom * (a.flipT / J.flipTime) : 0);
  if (amt) { rover.mesh.rotateX(-amt); rover.mesh.rotateZ(amt * 0.55); }   // it reads as a tumble from behind, not only from the side
}

// ---------------------------------------------------------------------------
// 2. BOULDER FIELD. Loose rock between the domes. Shove one and it rolls,
// knocks the next one on, and topples the stacked cairns. Drive away and come
// back and the whole field is set up again.
// ---------------------------------------------------------------------------
function marsBuildBoulders(g) {
  const B = MB.boulders;
  mars.rocks = [];
  const mat1 = new THREE.MeshLambertMaterial({ color: MARS_ROCK });
  const mat2 = new THREE.MeshLambertMaterial({ color: MARS_ROCK2 });
  const add = (dist, ang, r, h, stack) => {
    const p = surfacePoint(mars.body, mars.n, dist, ang);
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), stack ? mat2 : mat1);
    m.position.set(p.x + p.dir.x * h, p.y + p.dir.y * h, p.z + p.dir.z * h);
    m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    g.add(m);
    const rk_ = { mesh: m, r, h, vh: 0, stack: !!stack,
                  x: m.position.x, y: m.position.y, z: m.position.z,
                  v: new THREE.Vector3(), home: { dist, ang, r, h, stack: !!stack } };
    mars.rocks.push(rk_);
    return rk_;
  };
  for (let i = 0; i < B.count; i++) {
    const r = B.r[0] + rnd() * (B.r[1] - B.r[0]);
    add(B.dist[0] + rnd() * (B.dist[1] - B.dist[0]), rnd() * Math.PI * 2, r, r, false);
  }
  // the cairns: little stacks, asking to be knocked over
  for (let c = 0; c < B.cairns; c++) {
    const dist = B.dist[0] + rnd() * (B.dist[1] - B.dist[0]);
    const ang = rnd() * Math.PI * 2;
    let h = 0;
    for (let k = 0; k < B.cairnRocks; k++) {
      const r = B.r[1] * (1 - k * 0.22);
      h += r;
      add(dist, ang, r, h, true).cairn = c;
      h += r * 0.85;
    }
  }
}

function marsRocksReset() {
  const B = MB.boulders;
  for (const rk_ of mars.rocks) {
    const p = surfacePoint(mars.body, mars.n, rk_.home.dist, rk_.home.ang);
    rk_.h = rk_.home.h; rk_.vh = 0; rk_.stack = rk_.home.stack;
    rk_.v.set(0, 0, 0); rk_.armed = false;
    rk_.x = p.x + p.dir.x * rk_.h; rk_.y = p.y + p.dir.y * rk_.h; rk_.z = p.z + p.dir.z * rk_.h;
    rk_.mesh.position.set(rk_.x, rk_.y, rk_.z);
  }
  mars.rocksAway = false;
  flags.marsFieldResets = (flags.marsFieldResets || 0) + 1;
}

function marsTopple(rk_, vx, vy, vz) {
  if (!rk_.stack) return;
  const B = MB.boulders;
  for (const o of mars.rocks) {
    if (!o.stack || o.cairn !== rk_.cairn) continue;
    o.stack = false;
    o.v.set(vx * (0.5 + rnd() * 0.7), vy * (0.5 + rnd() * 0.7), vz * (0.5 + rnd() * 0.7));
    o.vh = 1.5 + rnd() * 2.5;
  }
  noiseBurst(0.3, 220, 0.26, 0);
  synthBlip("square", 200, 120, 0.35, 0.14, 0.05);
  flags.marsCairns = (flags.marsCairns || 0) + 1;
}

function marsUpdateBoulders(dt, b) {
  const B = MB.boulders, sp = Math.abs(rover.speed);
  // drive away and come back and it is all standing again
  const away = Math.hypot(rover.x - mars.x, rover.y - mars.y, rover.z - mars.z) > B.resetDist;
  if (away) mars.rocksAway = true;
  else if (mars.rocksAway) marsRocksReset();

  for (const rk_ of mars.rocks) {
    // ---- the shove
    const d = Math.hypot(rk_.x - rover.x, rk_.y - rover.y, rk_.z - rover.z);
    if (d < rk_.r + B.shoveR && sp > 0.6) {
      const push = (B.shove + sp * B.shovePerSpeed) * (2.2 / (1.4 + rk_.r));
      if (rk_.stack) marsTopple(rk_, rover.f.x * push, rover.f.y * push, rover.f.z * push);
      else {
        rk_.v.set(rover.f.x * push, rover.f.y * push, rover.f.z * push);
        // it keeps shoving while they are touching -- bulldozing one along is the
        // good bit -- but it only hops, knocks and counts once per pass, or a rock
        // being pushed would skip along in the air the whole way
        if (!rk_.armed) { rk_.armed = true; rk_.vh = Math.max(rk_.vh, 0.8); noiseBurst(0.1, 320, 0.16, 0); flags.marsShoves = (flags.marsShoves || 0) + 1; }
      }
    } else if (d > rk_.r + B.shoveR * 2.2) rk_.armed = false;
    if (rk_.stack) continue;

    // ---- roll, hop and settle, in Mars gravity
    mbT2.set(rk_.x - b.x, rk_.y - b.y, rk_.z - b.z).normalize();
    rk_.v.addScaledVector(mbT2, -rk_.v.dot(mbT2));         // motion stays along the ground
    rk_.vh -= b.g * 1.6 * dt;
    rk_.h += rk_.vh * dt;
    if (rk_.h <= rk_.r) { rk_.h = rk_.r; if (rk_.vh < -2) noiseBurst(0.07, 260, 0.14, 0); rk_.vh = 0; }
    const spd = rk_.v.length();
    if (spd > 0.02) {
      rk_.x += rk_.v.x * dt; rk_.y += rk_.v.y * dt; rk_.z += rk_.v.z * dt;
      rk_.v.multiplyScalar(Math.max(0, 1 - B.drag * dt));
      // it looks like it is rolling because it is rolling
      mbT3.copy(rk_.v).normalize().cross(mbT2).normalize();
      rk_.mesh.rotateOnWorldAxis(mbT3, -spd * dt / rk_.r);
    } else rk_.v.set(0, 0, 0);
    mbT2.set(rk_.x - b.x, rk_.y - b.y, rk_.z - b.z).normalize();
    const R = b.r + rk_.h;
    rk_.x = b.x + mbT2.x * R; rk_.y = b.y + mbT2.y * R; rk_.z = b.z + mbT2.z * R;
    rk_.mesh.position.set(rk_.x, rk_.y, rk_.z);
  }

  // ---- rock into rock: they knock each other on, and knock the cairns down
  for (let i = 0; i < mars.rocks.length; i++) {
    const a = mars.rocks[i];
    if (a.stack || a.v.lengthSq() < 0.25) continue;
    for (let k = 0; k < mars.rocks.length; k++) {
      if (k === i) continue;
      const o = mars.rocks[k];
      const dx = o.x - a.x, dy = o.y - a.y, dz = o.z - a.z;
      const dd = Math.hypot(dx, dy, dz), rr = a.r + o.r;
      if (dd > rr || dd < 1e-4) continue;
      const nx = dx / dd, ny = dy / dd, nz = dz / dd;
      const hit = a.v.x * nx + a.v.y * ny + a.v.z * nz;
      if (hit <= 0) continue;
      if (o.stack) { marsTopple(o, nx * hit * 1.4, ny * hit * 1.4, nz * hit * 1.4); continue; }
      const give = hit * B.bounce * (a.r / (a.r + o.r)) * 2;
      o.v.x += nx * give; o.v.y += ny * give; o.v.z += nz * give;
      o.vh = Math.max(o.vh, 0.6);
      a.v.multiplyScalar(1 - B.bounce * 0.5);
      const push = (rr - dd) * 0.5;
      o.x += nx * push; o.y += ny * push; o.z += nz * push;
      a.x -= nx * push; a.y -= ny * push; a.z -= nz * push;
      noiseBurst(0.08, 300, 0.14, 0);
      flags.marsRockHits = (flags.marsRockHits || 0) + 1;
    }
  }
}

// ---------------------------------------------------------------------------
// 3. THE MARS HELICOPTER. A little drone parked by the garage. Drive up to it,
// tap once, and he is flying it -- with exactly the control the big helicopter
// has, point-to-go, so there is nothing new to learn. Touch the rover and it
// comes down beside it and he is driving again. No job, nothing to shoot.
// ---------------------------------------------------------------------------
function marsBuildDrone(g) {
  const D = MB.drone;
  const dg = new THREE.Group();
  const gold = new THREE.MeshLambertMaterial({ color: 0xd4a72c, emissive: 0x2a2008 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1f2328 });
  const blue = new THREE.MeshLambertMaterial({ color: 0x2b4fb0, emissive: 0x0d1a44 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.1, 1.7), gold); body.position.y = 1.6; dg.add(body);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 1.5), blue); panel.position.y = 3.9; dg.add(panel);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 6), dark); mast.position.y = 2.6; dg.add(mast);
  const blades = [];
  for (let i = 0; i < 2; i++) {
    const hub = new THREE.Group(); hub.position.y = 2.9 + i * 0.5; dg.add(hub);
    for (let k = 0; k < 2; k++) {
      const bl = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.16, 0.5), new THREE.MeshLambertMaterial({ color: 0xf2f4f7, emissive: 0x30343a }));
      bl.rotation.y = k * Math.PI / 2;
      hub.add(bl);
    }
    blades.push(hub);
  }
  for (const [sx, sz] of [[-0.55, 0.55], [0.55, 0.55], [-0.55, -0.55], [0.55, -0.55]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 5), dark);
    leg.position.set(sx, 0.75, sz); leg.rotation.z = sx * 0.18; leg.rotation.x = -sz * 0.18; dg.add(leg);
  }
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.26, 7, 6), new THREE.MeshBasicMaterial({ color: 0x5ff1ff, fog: false }));
  lamp.position.set(0, 1.6, 0.95); dg.add(lamp);
  castsShadow(dg);
  scene.add(dg);                       // it flies away from the base, so it lives in the scene
  const p = surfacePoint(mars.body, mars.n, D.parkDist, D.parkAngle);
  mars.drone = {
    g: dg, blades, lamp, active: false, home: false,
    x: p.x, y: p.y, z: p.z, h: 0, vh: 0, speed: 0, turn: 0, stallT: 0, forced: false, grace: 0,
    n: p.dir.clone(), f: new THREE.Vector3(), target: null, targetDist: 0, spin: 0,
  };
  mbT2.set(mars.x - p.x, mars.y - p.y, mars.z - p.z);
  if (mbT2.lengthSq() < 1e-4) mbT2.set(1, 0, 0);
  mars.drone.f.copy(marsAim(dg, p.dir, mbT2));
  dg.position.set(p.x, p.y, p.z);
}

function marsDroneActive() { return !!(mars.drone && mars.drone.active); }
function marsDroneCan() {
  if (!mars.drone || mars.drone.active || !roverActive()) return false;
  return Math.hypot(mars.drone.x - rover.x, mars.drone.y - rover.y, mars.drone.z - rover.z) < MB.drone.callR;
}
// One button, two things, and the second one is always there: he can never be
// stuck up in the air with no way back to the rover.
function marsDronePress() {
  if (marsDroneActive()) { mars.drone.home = true; chirp(); return true; }
  if (!marsDroneCan()) return false;
  const dr = mars.drone;
  dr.active = true; dr.home = false; dr.speed = 0; dr.turn = 0; dr.vh = MB.drone.vRate * 0.5; dr.stallT = 0;
  dr.grace = MB.drone.graceTime;
  synthBlip("sine", 300, 760, 0.5, 0.26, 0);
  flags.marsDroneFlights = (flags.marsDroneFlights || 0) + 1;
  return true;
}
function marsDroneLand() {
  const dr = mars.drone;
  dr.active = false; dr.home = false; dr.speed = 0; dr.turn = 0; dr.vh = 0; dr.h = 0;
  chirp(); noiseBurst(0.12, 400, 0.14, 0);
  flags.marsDroneLandings = (flags.marsDroneLandings || 0) + 1;
}

// ---- what is under his finger, out here. The ground is a sphere, so it is one
// line of algebra rather than the helicopter's march over rolling terrain.
const mdRay = new THREE.Raycaster();
const mdNdc = new THREE.Vector2();
const mdList = [];
function marsDronePick(nx, ny) {
  const b = mars.body;
  camera.updateMatrixWorld();
  mdNdc.set(nx, ny);
  mdRay.setFromCamera(mdNdc, camera);
  const o = mdRay.ray.origin, d = mdRay.ray.direction;
  let best = null;
  mdList.length = 0;
  if (mars.g) mdList.push(mars.g);
  if (mars.cargo) mdList.push(mars.cargo);
  if (rover.mesh && rover.mesh.visible) mdList.push(rover.mesh);
  // The pick must test where these things are NOW, not where they were drawn last
  // frame -- the rover in particular has just moved under him.
  for (const m of mdList) m.updateWorldMatrix(false, true);
  const hits = mdRay.intersectObjects(mdList, true);
  if (hits.length) {
    let onRover = false;
    for (let p = hits[0].object; p; p = p.parent) if (p === rover.mesh) { onRover = true; break; }
    best = { point: hits[0].point.clone(), dist: hits[0].distance, rover: onRover };
  }
  // the ground itself
  const ox = o.x - b.x, oy = o.y - b.y, oz = o.z - b.z;
  const bq = ox * d.x + oy * d.y + oz * d.z;
  const cq = ox * ox + oy * oy + oz * oz - b.r * b.r;
  const disc = bq * bq - cq;
  if (disc >= 0) {
    const s = Math.sqrt(disc);
    let t = -bq - s;
    if (t < 0) t = -bq + s;
    if (t >= 0 && (!best || t < best.dist)) {
      best = { point: new THREE.Vector3(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t), dist: t, rover: false };
    }
  }
  return best;
}

function updateMarsDrone(dt) {
  const D = MB.drone, dr = mars.drone, b = mars.body;
  // one finger, always: the same as the big helicopter, nothing else to hold
  el.throttleBtn.classList.add("hidden");
  el.rotateArrow.classList.remove("on");
  el.slowBtn.classList.add("hidden");
  el.fastBtn.classList.add("hidden");
  el.gearBtn.classList.add("hidden");

  dr.n.set(dr.x - b.x, dr.y - b.y, dr.z - b.z).normalize();
  dr.f.addScaledVector(dr.n, -dr.f.dot(dr.n));
  if (dr.f.lengthSq() < 1e-6) dr.f.set(1, 0, 0).addScaledVector(dr.n, -dr.n.x);
  dr.f.normalize();

  if (dr.grace > 0) dr.grace -= dt;
  const touching = state.touching && !menuOpen();
  const nx = touching ? (state.touchIsPoint ? state.touchNX : clamp(state.ctrlBank, -1, 1)) : 0;
  const ny = touching ? (state.touchIsPoint ? state.touchNY : clamp(state.ctrlPitch, -1, 1)) : 0;

  let have = false, aimH = dr.h, wantSpeed = 0, dist = 0;
  dr.target = null;
  mbT2.set(0, 0, 0);
  if (dr.home) {
    mbT2.set(rover.x - dr.x, rover.y - dr.y, rover.z - dr.z);
    dr.target = { x: rover.x, y: rover.y, z: rover.z };
    have = true;
  } else if (touching) {
    const hit = marsDronePick(nx, ny);
    if (hit && hit.rover && dr.grace <= 0) {
      dr.home = true;                            // touch the rover: come home and land
      mbT2.set(rover.x - dr.x, rover.y - dr.y, rover.z - dr.z);
      dr.target = { x: rover.x, y: rover.y, z: rover.z };
      have = true;
      chirp();
    } else if (hit) {
      mbT2.set(hit.point.x - dr.x, hit.point.y - dr.y, hit.point.z - dr.z);
      dr.target = { x: hit.point.x, y: hit.point.y, z: hit.point.z };
      aimH = clamp(mbT3.set(hit.point.x - b.x, hit.point.y - b.y, hit.point.z - b.z).length() - b.r + D.hoverH, D.minH, D.maxH);
      have = true;
    } else {
      // the sky over the dunes: go that way, and climb
      mbT2.copy(mdRay.ray.direction).multiplyScalar(400);
      aimH = clamp(dr.h + D.hoverH * clamp(ny, 0.2, 1) * 2, D.minH, D.maxH);
      have = true;
    }
  }

  // How far it still has to FLY -- along the ground, not through the air. Measuring
  // the whole 3D gap counted its own hover height as distance, so on the way home it
  // could never get "close enough" to come down and just circled overhead for ever.
  dist = mbT2.length();
  const along = mbT2.dot(dr.n);
  const flat = Math.sqrt(Math.max(0, dist * dist - along * along));
  dr.targetDist = flat;
  let facing = 0;
  if (have && flat > 0.5) {
    mbT2.addScaledVector(dr.n, -mbT2.dot(dr.n));
    if (mbT2.lengthSq() > 1e-6) {
      mbT2.normalize();
      mbT3.copy(dr.f).cross(mbT2);
      let cmd = -clamp(mbT3.dot(dr.n) * 3, -1, 1);
      if (Math.abs(cmd) < 0.05 && dr.f.dot(mbT2) < 0) cmd = 1;      // exactly tail-on: pick a side
      dr.turn += (cmd * D.turnRate - dr.turn) * Math.min(1, D.turnAccel * dt);
      facing = Math.max(0, dr.f.dot(mbT2));
      wantSpeed = Math.min(D.cruise, flat * D.approach) * facing;
    }
  }
  if (!have) dr.turn += (0 - dr.turn) * Math.min(1, D.turnAccel * dt);
  if (Math.abs(dr.turn) < 0.4) dr.turn = 0;
  if (dr.turn) dr.f.applyAxisAngle(dr.n, -dr.turn * DEG * dt).normalize();

  // coming home: stop over the rover and settle beside it
  if (dr.home && flat < D.landR) { wantSpeed = 0; aimH = 0; }
  else if (dr.home) aimH = Math.max(aimH, D.hoverH);

  // Never stuck: a finger held on somewhere it is plainly not reaching means go,
  // whatever the reason. The same guarantee the big helicopter has.
  const going = have && flat > D.landR * 2;
  if (going && dr.speed < D.stallSpeed) dr.stallT += dt; else dr.stallT = 0;
  dr.forced = going && dr.stallT > D.stallTime;
  if (dr.forced) wantSpeed = D.cruise;

  const k = wantSpeed > dr.speed ? D.accel : D.hoverDamp;
  dr.speed += (wantSpeed - dr.speed) * Math.min(1, k * dt);
  if (dr.speed < 0.15) dr.speed = 0;

  const wantVh = clamp((aimH - dr.h) * D.vGain, -D.vRate, D.vRate);
  dr.vh += (wantVh - dr.vh) * Math.min(1, D.vAccel * dt);
  dr.h = clamp(dr.h + dr.vh * dt, 0, D.maxH);

  dr.x += dr.f.x * dr.speed * dt; dr.y += dr.f.y * dr.speed * dt; dr.z += dr.f.z * dr.speed * dt;
  mbT3.set(dr.x - b.x, dr.y - b.y, dr.z - b.z).normalize();
  const R = b.r + dr.h;
  dr.x = b.x + mbT3.x * R; dr.y = b.y + mbT3.y * R; dr.z = b.z + mbT3.z * R;
  dr.n.copy(mbT3);

  dr.spin += D.rotor * dt;
  dr.blades[0].rotation.y = dr.spin;
  dr.blades[1].rotation.y = -dr.spin;
  dr.lamp.visible = (frameCount % 30) < 18;
  dr.g.position.set(dr.x, dr.y, dr.z);
  marsAim(dr.g, dr.n, dr.f);
  dr.g.rotateX(-(dr.speed / D.cruise) * 0.16);     // it leans into the run

  setTone("rover", "sawtooth", 150 + dr.speed * 4, 0.05);
  setEngine(0); setRocketEngine(0, 1);
  forward.copy(dr.f);

  if (dr.home && flat < D.landR && dr.h < 0.4) marsDroneLand();
}

function marsDroneCamera(dt) {
  const dr = mars.drone;
  camera.up.copy(dr.n);
  // The higher it is, the further down it looks: what he wants to see out here is
  // the ground he is flying over, not the black sky above the horizon.
  const tilt = Math.min(22, dr.h * 0.5);
  if (state.viewChase) {
    camDesired.set(dr.x - dr.f.x * 18 + dr.n.x * 8, dr.y - dr.f.y * 18 + dr.n.y * 8, dr.z - dr.f.z * 18 + dr.n.z * 8);
    camera.position.lerp(camDesired, Math.min(1, 5 * dt));
    const d = 1.5 - tilt * 0.5;
    lookV.set(dr.x + dr.f.x * 22 + dr.n.x * d, dr.y + dr.f.y * 22 + dr.n.y * d, dr.z + dr.f.z * 22 + dr.n.z * d);
  } else {
    // low on the nose: under its own rotors, so the blades are not in his face
    camera.position.set(dr.x + dr.n.x * 1.2 + dr.f.x * 1.4, dr.y + dr.n.y * 1.2 + dr.f.y * 1.4, dr.z + dr.n.z * 1.2 + dr.f.z * 1.4);
    const d = 1.5 - tilt;
    lookV.set(dr.x + dr.f.x * 40 + dr.n.x * d, dr.y + dr.f.y * 40 + dr.n.y * d, dr.z + dr.f.z * 40 + dr.n.z * d);
  }
  camera.lookAt(lookV);
}

// ---- the three of them, driven from the base's own update
function marsToysBuild(g) {
  marsToysClear();          // a rebuild must not leave the old drone in the scene
  marsBuildJumps(g);
  marsBuildBoulders(g);
  marsBuildDrone(g);
}
function marsToysClear() {
  if (mars.drone) { scene.remove(mars.drone.g); mars.drone = null; }
  mars.jumps = []; mars.rocks = []; mars.rocksAway = false;
  mars.jump.air = false; mars.jump.peaked = false; mars.jump.t = 0; mars.jump.roll = 0; mars.jump.flipT = 0;
}
function updateMarsToys(dt) {
  if (!roverActive() || !mars.body) return;
  if (marsDroneActive()) { updateMarsDrone(dt); return; }   // the rover waits where he left it
  marsJumpCheck(dt);
  marsUpdateBoulders(dt, mars.body);
}
function marsLate(dt) {
  if (mars.jumps.length && roverActive() && rover.mesh && !marsDroneActive()) marsJumpLate(dt);
}
