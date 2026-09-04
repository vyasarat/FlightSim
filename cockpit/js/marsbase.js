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
  if (mars.phase === "idle" && roverActive()) {
    if (Math.hypot(rover.x - mars.x, rover.y - mars.y, rover.z - mars.z) > MB.armDist) {
      mars.phase = "armed";
      mars.wentOut = true;
    }
  } else if (mars.phase === "armed") {
    if (!roverActive()) { mars.phase = "idle"; }
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
