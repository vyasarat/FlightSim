"use strict";
// WORKING RULES (moved here from CLAUDE.md)
// Mars only -- the Moon stays as it was. The jump LAUNCH runs in updateMarsToys
// (before updateRover, so it sets the hop the rover's own gravity then flies);
// the TUMBLE runs in marsLate off updateSetpiecesLate, because updateRover
// rewrites the mesh orientation every frame. The drone keeps its point-to-go on
// a sphere, so any distance that decides "arrived" must be measured along the
// ground, never through the air, or its own hover height keeps it permanently
// far away.
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
  pad: null, padMat: null, lights: [], padGlow: null,
  cargo: null, cargoGlow: null, horizonLight: null,
  phase: "none",     // none | idle | armed | returning | count | launch
  t: 0, cargoT: 0, cargoPhase: "waiting",   // waiting | count | falling | down
  wentOut: false, clock: 0,
  boostT: 0,         // survives marsClear: the pad's hand stays on the throttle after lift-off
  // things to do out there
  jumps: [], rocks: [], rocksAway: false, drone: null, pal: null, stars: null, flag: null, dustT: 0,
  jump: { air: false, peaked: false, t: 0, roll: 0, spin: 0, flipT: 0, flipFrom: 0 },
};
const mbTmp = new THREE.Vector3();

function marsIsHome() {
  return !!(state.vp && state.vp.rocket && rk.onBody && rk.onBody.name === "mars");
}

function marsClear() {
  disposeSurfaceObjects([mars.g, mars.cargo, mars.horizonLight]);
  mars.g = null;
  const flagIndex = ambFlags.indexOf(mars.flag);
  if (flagIndex !== -1) ambFlags.splice(flagIndex, 1);
  mars.flag = null;
  countdownClear();
  mars.pad = null; mars.padMat = null; mars.lights = []; mars.padGlow = null;
  mars.cargo = null; mars.cargoGlow = null; mars.horizonLight = null;
  mars.phase = "none"; mars.t = 0; mars.cargoT = 0; mars.cargoPhase = "waiting";
  mars.wentOut = false;
  marsToysClear();
  solidDropOwner("mars");
}

// Everything is laid out around the rocket, on the surface, standing up along
// the local normal. `place` does the orienting so nothing below has to think.
function marsPlace(g, dist, angle, lift) {
  const p = surfacePoint(mars.body, mars.n, dist, angle);
  g.position.set(p.x + p.dir.x * (lift || 0), p.y + p.dir.y * (lift || 0), p.z + p.dir.z * (lift || 0));
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.dir);
  return p;
}

// The base in the one registry (solids.js). `obj` has been placed (its
// position and quaternion are the world's: the base group stands at the
// origin); shapes are given in its own frame and turned into the world's.
const msA = new THREE.Vector3(), msB = new THREE.Vector3();
function marsCap(obj, a, b, r, kind) {
  msA.set(a[0], a[1], a[2]).applyQuaternion(obj.quaternion).add(obj.position);
  msB.set(b[0], b[1], b[2]).applyQuaternion(obj.quaternion).add(obj.position);
  const sb = solidCapsule([msA.x, msA.y, msA.z], [msB.x, msB.y, msB.z], r, kind, SOLID.ALL, surfSolids);
  sb.owner = "mars"; sb.mesh = obj;
  obj.userData.noShatter = true;       // solid, not breakable: people live here
  return sb;
}
function marsBox(obj, c, e, kind) {
  msA.set(c[0], c[1], c[2]).applyQuaternion(obj.quaternion).add(obj.position);
  const ax = k => { const v = new THREE.Vector3(k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0).applyQuaternion(obj.quaternion); return [v.x, v.y, v.z]; };
  const sb = solidBox3(msA.x, msA.y, msA.z, ax(0), ax(1), ax(2), e[0], e[1], e[2], kind, SOLID.ALL, surfSolids);
  sb.owner = "mars"; sb.mesh = obj;
  obj.userData.noShatter = true;
  return sb;
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
  const rust = 0xb5522e, pale = 0xd8dde4, steel = 0xc9ced6, dark = 0x3c4350;

  // (Mars's own surface is the right rust already -- it only ever looked white in
  // testing because that was landing on the polar ice cap, dead on the north pole.)
  // red dunes, low and wide, so the ground has shape to drive over
  for (let i = 0; i < MB.dunes; i++) {
    const r = MB.duneR[0] + hashSalt(i, 77, 4) * (MB.duneR[1] - MB.duneR[0]);
    const d = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      artLam(i % 2 ? 0x9c4522 : rust, "mars"));
    d.scale.y = 0.22;
    marsPlace(d, MB.spread * (0.7 + hashSalt(i, 77, 6) * 1.5), hashSalt(i, 77, 8) * Math.PI * 2, -1);
    g.add(d);
  }
  // glass domes with a connecting tube each
  for (let i = 0; i < MB.domes; i++) {
    const dome = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(MB.domeR, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      artPaint(new THREE.MeshLambertMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.45 }), "deck", { mul: [0.625, 0.625] }));
    dome.add(shell);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(MB.domeR, 0.9, 6, 24), lam(pale));
    rim.rotation.x = Math.PI / 2; dome.add(rim);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff2b0, fog: false }));
    lamp.position.y = MB.domeR + 1.5; dome.add(lamp);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, MB.domeR * 1.4, 8), artLam(pale, "corrugated"));
    tube.rotation.z = Math.PI / 2; tube.position.set(MB.domeR * 0.8, 3, 0); dome.add(tube);
    marsPlace(dome, MB.spread * 0.62, 0.7 + i * 1.5, 0);
    g.add(dome);
    marsCap(dome, [0, 0, 0], [0, 0, 0], MB.domeR, "dome");
    marsCap(dome, [MB.domeR * 0.1, 3, 0], [MB.domeR * 1.5, 3, 0], 3, "dome");   // its tube
  }
  // the rover garage: an open shed it could drive into
  {
    const gar = new THREE.Group();
    const shed = new THREE.Mesh(new THREE.BoxGeometry(22, 9, 16), artLam(pale, "corrugated"));
    shed.position.y = 4.5; gar.add(shed);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(14, 7, 1), lam(0x1f2328));
    mouth.position.set(0, 3.6, 8.2); gar.add(mouth);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(24, 1, 18), lam(0xd4a72c));
    roof.position.y = 9.4; gar.add(roof);
    marsPlace(gar, MB.spread * 0.5, 3.4, 0);
    g.add(gar);
    marsBox(gar, [0, 5, 0], [12, 5, 9], "building");
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
    if (i === 0) {
      // a flag on the first mast: out here the wind is the only thing that moves
      // on its own, and it is what tells him the place is alive
      const fl = registerFlag(makeFlag(9, 5.5, TUNE.palette.red));
      fl.position.set(4.6, MB.mastH - 5, 0);
      m.add(fl);
      mars.flag = fl;
    }
    marsPlace(m, MB.spread * 0.75, 2.2 + i * 1.15, 0);
    g.add(m);
    marsCap(m, [0, 0, 0], [0, MB.mastH, 0], 0.9, "pillar");
    marsCap(m, [0, MB.mastH, 0], [0, MB.mastH, 0], 3.2, "pillar");            // the dish
  }
  // a row of Starships already standing there
  for (let i = 0; i < MB.parked; i++) {
    const sh = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 34, 14), lam(steel));
    hull.position.y = 17; sh.add(hull);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(3.4, 11, 14), lam(steel));
    nose.position.y = 39.5; sh.add(nose);
    for (const sx of [-1, 1]) {
      const flap = new THREE.Mesh(new THREE.BoxGeometry(1, 9, 4), lam(0x1f2328));
      flap.position.set(sx * 3.4, 30, -1.5); sh.add(flap);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.9, 7, 0.9), lam(dark));
      leg.position.set(sx * 3.2, 3.2, 0); leg.rotation.z = sx * 0.28; sh.add(leg);
    }
    marsPlace(sh, MB.spread * 1.05, 4.4 + i * 0.42, 0);
    g.add(sh);
    marsCap(sh, [0, 2, 0], [0, 42, 0], 3.6, "parked");
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
    // the glow over them: one draw call for the whole ring, and it is what makes
    // the pad read as lit from the far side of the dunes
    const pts = mars.lights.map(l => l.position);
    mars.padGlow = glowField(pts, TUNE.sky.padLightColor, TUNE.sky.padLightSize, TUNE.sky.padLightOpacity);
    pad.add(mars.padGlow);
    marsPlace(pad, 0.01, 0, 0);
    g.add(pad);
    mars.pad = pad;
  }
  marsToysBuild(g);
  castsAndReceives(g);
  if (mars.stars) { castsShadow(mars.stars.g, false); receivesShadow(mars.stars.g, false); }   // light has no shadow
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
  const steel = 0xc9ced6, dark = 0x1f2328;
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
  marsCap(mars.cargo, [0, 2, 0], [0, 44, 0], 3.8, "parked");                 // down, it is solid
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
  // dust on the wind. It reuses the wake-puff pool, so it costs no draw call of
  // its own -- the place just stops being perfectly still.
  mars.dustT -= dt;
  if (mars.dustT <= 0) {
    mars.dustT = TUNE.ambient.marsDustEvery * (0.6 + rnd() * 0.9);
    const p = surfacePoint(mars.body, mars.n, 60 + rnd() * 160, rnd() * Math.PI * 2);
    for (let k = 0; k < 4; k++) {
      wakePuff(p.x + (rnd() - 0.5) * 30, p.y + rnd() * 10 + 3, p.z + (rnd() - 0.5) * 30,
               0xc98a5a, 2.4 + rnd() * 2, 5, 3.2);
    }
  }

  // the pad lights: a steady amber, hurrying once it is taking him home
  if (mars.padMat) {
    const counting = mars.phase === "count" || mars.phase === "launch";
    const on = counting ? (Math.floor(mars.clock * 9) % 2 === 0) : (Math.sin(mars.clock * 2.2) > -0.3);
    mars.padMat.color.setHex(on ? (counting ? 0xf2f4f7 : 0xffd23e) : 0x5a4a18);
    if (mars.padGlow) {
      mars.padGlow.material.opacity = on ? TUNE.sky.padLightOpacity : TUNE.sky.padLightOpacity * 0.15;
      mars.padGlow.material.color.setHex(counting ? 0xf2f4f7 : TUNE.sky.padLightColor);
    }
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
      if (mars.horizonLight) { disposeSurfaceObjects([mars.horizonLight]); mars.horizonLight = null; }
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
const MARS_ROCK = 0x8c4a2a, MARS_ROCK2 = 0xb5522e;

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

    // a scooped run-up, drawn from the very profile the rover drives up (solids.js)
    const k = Math.max(1, J.lipSlope * J.len / J.rise);
    jg.add(rampProfileMesh(J.len, J.rise, J.w, k, dirt));
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
    const sb = solidRamp([p.x, p.y, p.z], [fwd.x, fwd.y, fwd.z], [p.dir.x, p.dir.y, p.dir.z],
                         J.len, J.rise, J.w, J.lipSlope, null, { owner: "mars" });
    mars.jumps.push({ g: jg, ring, mat: ringMat, x: p.x, y: p.y, z: p.z, dir: fwd, armed: false, solid: sb });
  }
}

// The ramps are SURFACES now (solids.js): he drives up one and leaves its lip
// with the lip's slope times his speed -- no kick, no trigger circle. This only
// blinks the rings; the launch comes from the rover (roverLaunched), and this is
// what it does on Mars: the tumble, the noise, the dust.
function marsJumpCheck(dt) {
  for (const j of mars.jumps) j.mat.color.setHex((frameCount % 30) < 18 ? 0xffd23e : 0x6b5410);
}
function marsJumpLaunched(sb) {
  const J = MB.jumps, a = mars.jump;
  const j = mars.jumps.find(q => q.solid === sb);
  if (!j) return;
  a.air = true; a.roll = 0; a.peaked = false; a.t = 0;
  a.spin = J.spin * (0.7 + rnd() * 0.6);
  synthBlip("sine", 380, 980, 0.4, 0.3, 0);
  noiseBurst(0.18, 650, 0.18, 0);
  for (let k = 0; k < 8; k++) wakePuff(j.x + (rnd() - 0.5) * 6, j.y + rnd() * 3, j.z + (rnd() - 0.5) * 6, 0xc98a5a, 1.6, 3, 1.2);
  flags.marsJumps = (flags.marsJumps || 0) + 1;
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
// A spot on the ground clear of the base (solids.js): since v129 a dome is a
// dome, and a cairn laid against one could not be reached without hitting it.
// Walked straight out of whatever is in the way; no random numbers drawn, so
// the stream everything after it sees is the one it always saw.
function marsClearSpot(p, clearR) {
  const b = mars.body, q = { x: p.x, y: p.y, z: p.z, dir: p.dir.clone() };
  for (let i = 0; i < 12; i++) {
    const hit = solidQuery(q.x + q.dir.x * 1.5, q.y + q.dir.y * 1.5, q.z + q.dir.z * 1.5, clearR, SOLID.ROVER, undefined, sb => !!sb.toy || !!sb.ramp);
    if (!hit) break;
    const dn = hit.nx * q.dir.x + hit.ny * q.dir.y + hit.nz * q.dir.z;
    let tx = hit.nx - q.dir.x * dn, ty = hit.ny - q.dir.y * dn, tz = hit.nz - q.dir.z * dn;
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl; ty /= tl; tz /= tl;
    q.x += tx * (hit.d + 1.5); q.y += ty * (hit.d + 1.5); q.z += tz * (hit.d + 1.5);
    q.dir.set(q.x - b.x, q.y - b.y, q.z - b.z).normalize();
    q.x = b.x + q.dir.x * b.r; q.y = b.y + q.dir.y * b.r; q.z = b.z + q.dir.z * b.r;
  }
  return q;
}

function marsBuildBoulders(g) {
  const B = MB.boulders;
  mars.rocks = [];
  const mat1 = new THREE.MeshLambertMaterial({ color: MARS_ROCK });
  const mat2 = new THREE.MeshLambertMaterial({ color: MARS_ROCK2 });
  const add = (dist, ang, r, h, stack) => {
    const p = marsClearSpot(surfacePoint(mars.body, mars.n, dist, ang), B.r[1] + TUNE.solid.r.rover + 3);
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), stack ? mat2 : mat1);
    m.position.set(p.x + p.dir.x * h, p.y + p.dir.y * h, p.z + p.dir.z * h);
    m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    g.add(m);
    const rk_ = { mesh: m, r, h, vh: 0, stack: !!stack,
                  x: m.position.x, y: m.position.y, z: m.position.z,
                  v: new THREE.Vector3(), home: { dist, ang, r, h, stack: !!stack } };
    rk_.solid = solidToyBall(rk_.x, rk_.y, rk_.z, r, "mars", m);
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
    const p = marsClearSpot(surfacePoint(mars.body, mars.n, rk_.home.dist, rk_.home.ang), B.r[1] + TUNE.solid.r.rover + 3);
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
  for (const rk_ of mars.rocks) if (rk_.solid) solidFollow(rk_.solid, rk_.x, rk_.y, rk_.z);
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
      const bl = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.16, 0.5), new THREE.MeshLambertMaterial({ color: 0xf2f4f7, emissive: 0x2f3a48 }));
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
  toyFinishFleet(dg, "drone");
  castsShadow(dg);
  // Scale audit: it was coming out 6.7 m tall with a 5.8 m rotor span, against a
  // 4.9 m rover -- the little scout drone was bigger than the thing it scouts
  // for. This is the model only; every distance that decides anything is
  // untouched.
  dg.scale.setScalar(MB.drone.modelScale);
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
// The drone against the one registry. Over its crawl a bang, at or under it a
// shove; flying itself home it slides round and never bangs. True if it went bang.
function marsDroneSolid(b) {
  const dr = mars.drone;
  const hit = solidQuery(dr.x, dr.y, dr.z, TUNE.solid.r.drone, SOLID.ROVER);
  if (!hit) return false;
  // the sleepy rover is a friend, not a wall: the drone taking off beside it only ever nudges off it
  const crawl = dr.home || dr.speed <= TUNE.solid.crawl.drone || (!!mars.pal && hit.b === mars.pal.solid);
  solidCount("drone", hit.kind, crawl ? "shove" : "crash");
  flags.wallHits = (flags.wallHits || 0) + 1;
  if (!crawl) {
    dr.bangT = TUNE.solid.reassemble; dr.bangN = [hit.nx, hit.ny, hit.nz];
    dr.speed = 0; dr.vh = 0;
    triggerExplosion(dr.x, dr.y, dr.z, 0.5);
    cameraHitStop(0.6);
    dr.g.visible = false;
    flags.droneCrashes = (flags.droneCrashes || 0) + 1;
    return true;
  }
  const k = hit.d + 0.3;
  dr.x += hit.nx * k; dr.y += hit.ny * k; dr.z += hit.nz * k;
  dr.h = Math.max(0, Math.hypot(dr.x - b.x, dr.y - b.y, dr.z - b.z) - b.r);
  const into = dr.f.x * hit.nx + dr.f.y * hit.ny + dr.f.z * hit.nz;
  if (dr.home && into < 0) { dr.f.x -= hit.nx * into; dr.f.y -= hit.ny * into; dr.f.z -= hit.nz * into; }
  dr.speed *= dr.home ? 0.9 : 0.35;
  if (!dr.home) { noiseBurst(0.12, 220, 0.2, 0); flags.solidShoves = (flags.solidShoves || 0) + 1; }
  return false;
}
function marsDroneReassemble(b) {
  const dr = mars.drone, n = dr.bangN || [0, 0, 0], back = TUNE.solid.backOff;
  dr.bangT = 0;
  dr.x += n[0] * back; dr.y += n[1] * back; dr.z += n[2] * back;
  for (let i = 0; i < 8; i++) {
    const h = solidQuery(dr.x, dr.y, dr.z, TUNE.solid.r.drone + 1, SOLID.ROVER);
    if (!h) break;
    dr.x += h.nx * (h.d + 1); dr.y += h.ny * (h.d + 1); dr.z += h.nz * (h.d + 1);
  }
  dr.h = Math.max(0, Math.hypot(dr.x - b.x, dr.y - b.y, dr.z - b.z) - b.r);
  dr.speed = 0; dr.vh = 0;
  dr.g.visible = true;
  dr.g.position.set(dr.x, dr.y, dr.z);
  thunk();
  flags.droneReassembles = (flags.droneReassembles || 0) + 1;
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
  // in pieces: it waits, then comes back where it happened, backed off
  if (dr.bangT > 0) {
    dr.bangT -= dt; dr.speed = 0;
    if (dr.bangT <= 0) marsDroneReassemble(b);
    return;
  }
  // one finger, always: the same as the big helicopter, nothing else to hold
  el.rotateArrow.classList.remove("on");

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
      // point-to-go, same rule as the big helicopter: scale the cap, leave the
      // `flat * D.approach` taper alone (js/speed.js)
      wantSpeed = Math.min(D.cruise * spdMul(), flat * D.approach) * facing;
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
  if (dr.forced) wantSpeed = D.cruise * spdMul();

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
  // the one registry and the one law (solids.js): a mast, a dome, a Starship
  if (marsDroneSolid(b)) return;

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

// ---------------------------------------------------------------------------
// 4. THE SLEEPY ROVER (v209). An old little rover, asleep out past the dunes,
// dusty, its panels folded and its head down. Nothing points at it: Mars is so
// small that from the pad it is under the curve, and only a slow amber blink on
// its antenna gives it away over the horizon. Drive up to it -- or fly the drone
// down to it -- and it wakes: the dust shakes off, the panels open, its eyes
// light and it beeps hello. Then it trundles after him, never far from its own
// spot; stop beside it and it does a happy spin. Drive away and it goes home and
// nods off again, ready to be found the next time. No button, no job, nothing
// to lose. It is a machine, and it is solid the way a boulder is: the rover
// nudges it aside, never bangs into it.
//
// It draws no rnd(): its puffs are jittered by hashSalt, so every random number
// the boulders and the jumps see is the one they always saw. Its meshes are made
// on vkQuiet's own stream for the same reason (three.js draws for every id).
// ---------------------------------------------------------------------------
const MP = MB.pal;
function marsBuildPal(g) {
  // and the kit's own seed put back, as raceitems does, so every later lazy kit builder is unmoved
  const s0 = vkSeed;
  try { vkQuiet(0, () => marsBuildPalQuiet(g)); } finally { vkSeed = s0; }
}
function marsBuildPalQuiet(g) {
  {
    const pg = new THREE.Group();
    const dark = lam(0x1f2328), steel = lam(0xc9ced6), gold = lam(0xd4a72c);
    const coat = new THREE.MeshLambertMaterial({ color: 0xc98a5a });      // dusty while it sleeps
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 2.2), coat); body.position.y = 1.05; pg.add(body);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 2.3), gold); deck.position.y = 1.46; pg.add(deck);
    const wheels = [];
    for (const sx of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 2.0), dark); arm.position.set(sx * 1.0, 0.78, 0); pg.add(arm);
      for (const sz of [-0.85, 0, 0.85]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10), dark);
        w.rotation.z = Math.PI / 2; w.position.set(sx * 1.0, 0.38, sz); pg.add(w); wheels.push(w);
      }
    }
    // the panels lie folded shut over its back while it sleeps and open out like wings when
    // it wakes (one hinge a little higher, so shut they lie one on the other)
    const panels = [];
    const blue = new THREE.MeshLambertMaterial({ color: 0x2b4fb0, emissive: 0x0d1a44 });
    for (const sx of [-1, 1]) {
      const hinge = new THREE.Group(); hinge.position.set(sx * 0.85, sx > 0 ? 1.52 : 1.64, 0.3); pg.add(hinge);
      const pn = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 1.5), blue); pn.position.x = sx * 0.65; hinge.add(pn);
      hinge.userData.side = sx; panels.push(hinge);
    }
    // the neck and the head: two round eyes on a camera box, the thing a four-year-old reads as a face
    const neck = new THREE.Group(); neck.position.set(0, 1.5, -0.75); pg.add(neck);
    const mastGeo = new THREE.CylinderGeometry(0.08, 0.08, 1, 6); mastGeo.translate(0, 0.5, 0);   // it grows from its foot
    const mast = new THREE.Mesh(mastGeo, steel); neck.add(mast);
    const head = new THREE.Group(); head.rotation.order = "YXZ"; neck.add(head);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.45, 0.5), steel); head.add(box);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x3c4350, fog: false });
    for (const sx of [-0.23, 0.23]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), eyeMat); eye.position.set(sx, 0.02, -0.26); head.add(eye);
    }
    const dish = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.22, 10, 1, true), steel);
    dish.position.set(0.5, 1.72, 1.25); dish.rotation.x = -0.6; pg.add(dish);
    // the whip antenna and its blink: one glow, one draw call, the only thing that gives it away
    const whip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.2, 4), steel); whip.position.set(-0.7, 3.05, 1.2); pg.add(whip);
    const tipMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, fog: false });
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), tipMat); tip.position.set(-0.7, 4.7, 1.2); pg.add(tip);
    const glow = glowField([tip.position], TUNE.sky.padLightColor, MP.glowSize, TUNE.sky.padLightOpacity);
    pg.add(glow);
    pg.traverse(o => { o.userData.noShatter = true; });
    g.add(pg);
    const p = surfacePoint(mars.body, mars.n, MP.homeDist, MP.homeAngle);
    // asleep it faces away from the base: he comes up behind it, and it turns round to see him
    mbT2.set(p.x - mars.x, p.y - mars.y, p.z - mars.z);
    if (mbT2.lengthSq() < 1e-4) mbT2.set(1, 0, 0);
    const f = marsAim(pg, p.dir, mbT2);
    mars.pal = {
      g: pg, coat, eyeMat, tipMat, glow, neck, mast, head, panels, wheels,
      state: "sleep", t: 0, k: 0, clock: 0, puffN: 0,
      x: p.x, y: p.y, z: p.z, n: p.dir.clone(), f, speed: 0, spin: 0, hop: 0, roll: 0,
      home: { x: p.x, y: p.y, z: p.z, f: f.clone() },
      yaw: 0, pitch: -0.5, nudged: false, stillT: 0, restT: 0, awayT: 0, stallT: 0, stallFrom: undefined, watch: null,
    };
    const L = MP.ballLift;
    mars.pal.solid = solidToyBall(p.x + p.dir.x * L, p.y + p.dir.y * L, p.z + p.dir.z * L, MP.r, "mars", body);
    marsPalPose(0);
  }
}

// Along the ground, never through the air: the drone's hover height is not distance.
function marsPalGround(ax, ay, az, bx, by, bz) {
  const b = mars.body;
  mbT3.set(ax - b.x, ay - b.y, az - b.z).normalize();
  mbT4.set(bx - b.x, by - b.y, bz - b.z).normalize();
  return b.r * Math.acos(clamp(mbT3.dot(mbT4), -1, 1));
}

function marsPalPuffs(n, spread) {
  const pl = mars.pal;
  for (let i = 0; i < n; i++) {
    const s = pl.puffN++;
    const jx = hashSalt(s, 209, 1) - 0.5, up = 0.3 + hashSalt(s, 209, 2) * 0.8, jz = hashSalt(s, 209, 3) - 0.5;
    wakePuff(pl.x + jx * spread + pl.n.x * up, pl.y + pl.n.y * up, pl.z + jz * spread + pl.n.z * up,
             0xc98a5a, 0.5 + up * 0.2, 1.2, MP.dustLife);
  }
}

// How awake it LOOKS, 0 asleep to 1 awake: the mast, the panels, the eyes, the dust.
function marsPalPose(k) {
  const pl = mars.pal;
  pl.k = k;
  pl.mast.scale.y = 0.35 + k * 0.85;
  pl.head.position.y = pl.mast.scale.y;
  for (const h of pl.panels) h.rotation.z = h.userData.side * (Math.PI - 0.04) * (1 - k);
  pl.coat.color.setHex(0xc98a5a).lerp(mbCleanCol, k);
}
const mbCleanCol = new THREE.Color(0xf2f4f7);

function marsPalWakeUp() {
  const pl = mars.pal;
  pl.state = "wake"; pl.t = MP.wakeTime; pl.stillT = 0; pl.restT = 0;
  marsPalPuffs(MP.dust, 3);      // low round its wheels: the panels and the eyes are the payoff, not the dust
  noiseBurst(0.3, 500, 0.16, 0);
  synthBlip("sine", 520, 520, 0.12, 0.22, 0.25);
  synthBlip("sine", 660, 660, 0.12, 0.22, 0.4);
  synthBlip("sine", 880, 1320, 0.24, 0.24, 0.55);
  flags.marsPalWakes = (flags.marsPalWakes || 0) + 1;
}

function updateMarsPal(dt) {
  const pl = mars.pal, b = mars.body;
  if (!pl) return;
  pl.clock += dt;
  const dr = mars.drone, flying = marsDroneActive();
  // who it can see: the drone while he flies it, otherwise the rover
  const who = flying ? dr : rover;
  const dWho = marsPalGround(pl.x, pl.y, pl.z, who.x, who.y, who.z);
  const low = !flying || dr.h < MP.droneWakeH;
  const found = dWho < MP.wakeR && low;
  const H = pl.home;
  const roverHome = marsPalGround(rover.x, rover.y, rover.z, H.x, H.y, H.z);
  const present = roverHome < MP.leaveR || (flying && marsPalGround(dr.x, dr.y, dr.z, H.x, H.y, H.z) < MP.leaveR);
  pl.watch = who;

  let goal = null, want = 0;
  if (pl.state === "sleep") {
    // the blink is the whole lure: slow, amber, and only while it sleeps
    const on = (pl.clock % MP.blinkEvery) < 0.5;
    pl.tipMat.color.setHex(on ? 0xffd23e : 0x5a4a18);
    pl.glow.visible = on;
    // the same size on screen however far off he is: a sprite that shrinks with distance is no lure
    if (on) pl.glow.material.size = Math.max(MP.glowSize, camera.position.distanceTo(pl.g.position) * MP.glowPerM);
    if (found) marsPalWakeUp();
  } else if (pl.state === "wake") {
    pl.t -= dt;
    const k = clamp(1 - pl.t / MP.wakeTime, 0, 1);
    marsPalPose(k);
    pl.roll = Math.sin(k * Math.PI * 4) * 0.12 * (1 - k);     // a shake, the dust coming off
    if (pl.t <= 0) { pl.state = "awake"; pl.roll = 0; }
  } else if (pl.state === "awake" || pl.state === "dance") {
    if (!present) { pl.awayT += dt; if (pl.awayT > MP.leaveAfter) { pl.state = "homing"; pl.awayT = 0; pl.stallT = 0; pl.stallFrom = undefined; chirp(); } }
    else pl.awayT = 0;
    if (pl.restT > 0) pl.restT -= dt;
    if (pl.state === "dance") {
      pl.t -= dt;
      const k = 1 - pl.t / MP.danceTime;
      pl.spin = k * Math.PI * 2;
      pl.hop = Math.sin(clamp(k, 0, 1) * Math.PI * 3) * 0.35;
      if (pl.t <= 0) { pl.state = "awake"; pl.spin = 0; pl.hop = 0; pl.restT = MP.danceRest; }
    } else if (!flying && roverHome < MP.leaveR) {
      // a little ahead of him and to one side, whichever it already is, held inside its leash
      mbT4.copy(rover.f).cross(rover.n);                           // his right
      const side = ((pl.x - rover.x) * mbT4.x + (pl.y - rover.y) * mbT4.y + (pl.z - rover.z) * mbT4.z) < 0 ? -MP.gapSide : MP.gapSide;
      const gx = rover.x + rover.f.x * MP.gapAhead + mbT4.x * side;
      const gy = rover.y + rover.f.y * MP.gapAhead + mbT4.y * side;
      const gz = rover.z + rover.f.z * MP.gapAhead + mbT4.z * side;
      goal = { x: gx, y: gy, z: gz };
      const fromHome = marsPalGround(gx, gy, gz, H.x, H.y, H.z), leashed = fromHome > MP.leash;
      if (leashed) {
        // as far as the leash goes, along the line from its spot towards him
        const s = MP.leash / fromHome;
        mbT2.set(H.x + (gx - H.x) * s - b.x, H.y + (gy - H.y) * s - b.y, H.z + (gz - H.z) * s - b.z).normalize();
        goal = { x: b.x + mbT2.x * b.r, y: b.y + mbT2.y * b.r, z: b.z + mbT2.z * b.r };
      }
      const dGoal = marsPalGround(pl.x, pl.y, pl.z, goal.x, goal.y, goal.z);
      // his own speed plus the gap: a follower on the gap alone sits one gap behind its spot, which put it
      // trailing at his shoulder, in no view. Near him it waits only while he is stopped; at the end
      // of its leash his speed is not its own (it would carry it past)
      const his = leashed ? 0 : Math.max(0, rover.speed);
      if (dWho > MP.closeEnough || his > MP.stillRover) want = Math.min(MP.cruise, his + (dGoal > MP.arriveR ? dGoal * MP.taper : 0));
    }
    // stop beside it (or hover the drone over it) and it does a happy spin
    const still = flying ? dr.speed < MP.stillDrone : Math.abs(rover.speed) < MP.stillRover;
    if (pl.state === "awake" && want === 0 && still && dWho < MP.danceR && low) pl.stillT += dt; else pl.stillT = 0;
    if (pl.state === "awake" && pl.stillT > MP.danceAfter && pl.restT <= 0) {
      pl.state = "dance"; pl.t = MP.danceTime; pl.stillT = 0;
      synthBlip("triangle", 700, 1100, 0.18, 0.2, 0);
      synthBlip("triangle", 1100, 700, 0.18, 0.2, 0.2);
      flags.marsPalDances = (flags.marsPalDances || 0) + 1;
    }
  } else if (pl.state === "homing") {
    if (present && found) { pl.state = "awake"; chirp(); }
    else {
      goal = H;
      const dHome = marsPalGround(pl.x, pl.y, pl.z, H.x, H.y, H.z);
      want = dHome > MP.arriveR ? Math.min(MP.cruise, dHome * MP.taper + 1) : 0;
      // never wedged for ever against a dome's face on the way: its speed is only what it asks for,
      // so it is PROGRESS that is measured -- no nearer home for stallTime and it naps there
      pl.stallT += dt;
      if (pl.stallFrom === undefined || pl.stallFrom - dHome >= MP.arriveR) { pl.stallFrom = dHome; pl.stallT = 0; }
      if ((dHome <= MP.arriveR && pl.speed < MP.settled) || pl.stallT > MP.stallTime) {
        pl.state = "nap"; pl.t = MP.napTime; pl.stallT = 0; pl.stallFrom = undefined; pl.speed = 0;
        synthBlip("sine", 440, 220, 0.5, 0.16, 0);
      }
    }
  } else if (pl.state === "nap") {
    pl.t -= dt;
    marsPalPose(clamp(pl.t / MP.napTime, 0, 1));
    if (found && present && pl.t < MP.napTime * 0.5) { marsPalWakeUp(); }
    else if (pl.t <= 0) {
      marsPalPose(0);
      pl.state = "sleep";
      flags.marsPalNaps = (flags.marsPalNaps || 0) + 1;
    }
  }
  if (pl.state !== "sleep") { pl.glow.visible = false; pl.tipMat.color.setHex(0x5a4a18); }

  // ---- drive: turn towards the goal, or towards whoever it is looking at
  pl.n.set(pl.x - b.x, pl.y - b.y, pl.z - b.z).normalize();
  pl.f.addScaledVector(pl.n, -pl.f.dot(pl.n)).normalize();
  let face = null;
  if (goal && want > 0) face = goal;
  else if (pl.state === "awake" && dWho > 3) face = who;
  else if (pl.state === "nap" || pl.state === "sleep") face = null;
  if (pl.state === "homing" && want === 0) { pl.f.lerp(H.f, Math.min(1, 3 * dt)).normalize(); }
  if (face) {
    mbT2.set(face.x - pl.x, face.y - pl.y, face.z - pl.z);
    mbT2.addScaledVector(pl.n, -mbT2.dot(pl.n));
    if (mbT2.lengthSq() > 1e-4) {
      mbT2.normalize();
      mbT3.copy(pl.f).cross(mbT2);
      const ang = Math.atan2(mbT3.dot(pl.n), pl.f.dot(mbT2));
      const step = clamp(ang, -MP.turnRate * DEG * dt, MP.turnRate * DEG * dt);
      pl.f.applyAxisAngle(pl.n, step).normalize();
    }
  }
  pl.speed += (want - pl.speed) * Math.min(1, MP.accel * dt);
  if (pl.speed < 0.05) pl.speed = 0;
  pl.x += pl.f.x * pl.speed * dt; pl.y += pl.f.y * pl.speed * dt; pl.z += pl.f.z * pl.speed * dt;
  // the one registry: a dome or a mast slides it round (it is never fast enough to bang).
  // Asked only when it has moved: a query walks every solid in the world (9,347 of them, the
  // cities' too), +0.6 ms a frame on Mars, and what can move into it -- a toy, a ramp -- it skips
  if (pl.speed > 0 || pl.nudged) {
    const hit = solidQuery(pl.x + pl.n.x * MP.ballLift, pl.y + pl.n.y * MP.ballLift, pl.z + pl.n.z * MP.ballLift, MP.r, SOLID.ROVER, undefined, sb => !!sb.toy || !!sb.ramp);
    if (hit) { pl.x += hit.nx * (hit.d + 0.2); pl.y += hit.ny * (hit.d + 0.2); pl.z += hit.nz * (hit.d + 0.2); }
  }
  pl.nudged = false;
  // and the rover nudges it aside, never through it: the rover skips toys, so this is the rule
  const near = TUNE.solid.r.rover + MP.r + 0.3;
  const dx = pl.x - rover.x, dy = pl.y - rover.y, dz = pl.z - rover.z, dd = Math.hypot(dx, dy, dz);
  if (!flying && dd < near && dd > 1e-4) {
    const k = (near - dd) / dd;
    pl.x += dx * k; pl.y += dy * k; pl.z += dz * k;
    pl.nudged = true;          // ... and next frame it is asked whether that pushed it into a dome
    flags.marsPalNudges = (flags.marsPalNudges || 0) + 1;
  }
  mbT3.set(pl.x - b.x, pl.y - b.y, pl.z - b.z).normalize();
  pl.x = b.x + mbT3.x * b.r; pl.y = b.y + mbT3.y * b.r; pl.z = b.z + mbT3.z * b.r;
  pl.n.copy(mbT3);
  if (pl.speed > 0) flags.marsPalMetres = (flags.marsPalMetres || 0) + pl.speed * dt;

  // ---- what he sees
  for (const w of pl.wheels) w.rotation.x -= pl.speed * dt / 0.38;
  pl.g.position.set(pl.x + pl.n.x * pl.hop, pl.y + pl.n.y * pl.hop, pl.z + pl.n.z * pl.hop);
  marsAim(pl.g, pl.n, pl.f);
  if (pl.spin) pl.g.rotateY(pl.spin);
  if (pl.roll) pl.g.rotateZ(pl.roll);
  // the head looks at him (or up at the drone) once it is awake, and droops asleep
  let yaw = 0, pitch = -0.5;
  if (pl.k > 0.5 && pl.state !== "nap") {
    mbT2.set(who.x - pl.x, who.y - pl.y, who.z - pl.z);
    mbT4.copy(pl.f).cross(pl.n);                                 // its right
    const fw = mbT2.dot(pl.f), rt = mbT2.dot(mbT4), up = mbT2.dot(pl.n) - 2.4;
    yaw = clamp(Math.atan2(-rt, fw), -2.2, 2.2);
    pitch = clamp(Math.atan2(up, Math.hypot(fw, rt)), -0.4, 1.1);
    if (pl.spin) yaw = 0;
  } else pitch = -0.5 * (1 - pl.k);
  pl.yaw += (yaw - pl.yaw) * Math.min(1, 6 * dt);
  pl.pitch += (pitch - pl.pitch) * Math.min(1, 6 * dt);
  pl.head.rotation.y = pl.yaw; pl.head.rotation.x = pl.pitch;
  // eyes: dark asleep, lit awake, with a blink now and then
  const blink = (pl.clock % 3.1) < 0.12;
  pl.eyeMat.color.setHex(pl.k > 0.6 && !blink ? 0x5ff1ff : 0x3c4350);
  solidFollow(pl.solid, pl.x + pl.n.x * MP.ballLift, pl.y + pl.n.y * MP.ballLift, pl.z + pl.n.z * MP.ballLift);
}

// ---------------------------------------------------------------------------
// 5. THE STAR SHOWER (v210). A while after the cargo ship is down, seven golden
// stars drift down out of the sky round wherever he is: the first right in
// front of him, each next one further out and all the way round, so the last
// few land under the curve and only their beams of light show over it. Drive
// into one (or fly the drone over it) and it is caught: it plays the next note
// up and flies to a ring of stars spinning over him. Catch the seventh and the
// ring spins up, lifts, and they shoot up in front of him one after another --
// seven fireworks -- and a big star opens where they burst and stays in the sky.
// A while later another shower comes. No button, no countdown numerals, nothing
// to lose: a star that is not caught simply waits where it landed.
//
// Like the sleepy rover it draws no rnd(): where they land and every spark's
// scatter come from hashSalt, and its meshes are made on vkQuiet's own stream,
// so everything else on Mars sees the stream it always saw. One InstancedMesh
// for the stars, one for their beams, one glow field, one spark cloud and the
// big star: six draw calls in all, whatever is happening.
// ---------------------------------------------------------------------------
const MS = MB.stars;
const MS_Y = new THREE.Vector3(0, 1, 0);
const msQ = new THREE.Quaternion(), msQ2 = new THREE.Quaternion(), msM = new THREE.Matrix4();
const msV = new THREE.Vector3(), msU = new THREE.Vector3(), msT = new THREE.Vector3(), msR = new THREE.Vector3(), msScl = new THREE.Vector3();
const MS_NOTES = [523, 587, 659, 784, 880, 1047, 1175, 1319];   // up the scale, one per star
const MS_FW = [0xff3b6b, 0xffd23e, 0x3ad1ff, 0x7cff5a, 0xff7ab8, 0xb388ff, 0xff9a3a, 0xf2f4f7];
const MS_GOLD = 0xffd23e;

// A five-pointed star, standing in its XY plane, a little thick so it turns solidly.
function marsStarGeo(r) {
  const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
    if (i) sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const geo = new THREE.ExtrudeGeometry(sh, { depth: r * 0.32, bevelEnabled: false });
  geo.translate(0, 0, -r * 0.16);
  return geo;
}

function marsBuildStars(g) {
  // on the kit's own stream, and its seed put back after, as the sleepy rover's is
  const s0 = vkSeed;
  try { vkQuiet(0, () => marsBuildStarsQuiet(g)); } finally { vkSeed = s0; }
}
function marsBuildStarsQuiet(g) {
  const N = MS.count, b = mars.body;
  const sg = new THREE.Group();
  // nothing he acts on is painted: plain bright gold, lit by nothing
  const starMesh = new THREE.InstancedMesh(marsStarGeo(MS.size), new THREE.MeshBasicMaterial({ color: 0xffe45c, fog: false }), N);
  starMesh.frustumCulled = false;        // one bounding sphere at the origin would cull it all
  sg.add(starMesh);
  // each landed star's beam: open, additive, fading to nothing at its top (black is clear)
  const pgeo = new THREE.CylinderGeometry(MS.pillarR * 0.35, MS.pillarR, MS.pillarH, 10, 1, true);
  pgeo.translate(0, MS.pillarH / 2, 0);
  const pos = pgeo.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = 1 - pos.getY(i) / MS.pillarH;
    col[i * 3] = k; col[i * 3 + 1] = 0.82 * k; col[i * 3 + 2] = 0.25 * k;
  }
  pgeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const pillarMesh = new THREE.InstancedMesh(pgeo, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: MS.pillarOpacity, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide, fog: false }), N);
  pillarMesh.frustumCulled = false;
  sg.add(pillarMesh);
  // one glow per star, wherever it is; one not in play sits at Mars's centre, inside the ground
  const centre = new THREE.Vector3(b.x, b.y, b.z), pts = [];
  for (let i = 0; i < N; i++) pts.push(centre);
  const glow = glowField(pts, MS_GOLD, MS.glowSize, 0.85);
  glow.frustumCulled = false;
  sg.add(glow);
  // the sparks: trails, the catch, the fireworks and the gold rain, one cloud
  const SN = MS.sparks;
  const spPos = new Float32Array(SN * 3), spCol = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) { spPos[i * 3] = b.x; spPos[i * 3 + 1] = b.y; spPos[i * 3 + 2] = b.z; }
  const sgeo = new THREE.BufferGeometry();
  sgeo.setAttribute("position", new THREE.BufferAttribute(spPos, 3).setUsage(THREE.DynamicDrawUsage));
  sgeo.setAttribute("color", new THREE.BufferAttribute(spCol, 3).setUsage(THREE.DynamicDrawUsage));
  const sparks = new THREE.Points(sgeo, new THREE.PointsMaterial({
    map: glowTex, size: MS.sparkSize, sizeAttenuation: true, vertexColors: true, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  sparks.frustumCulled = false;
  sg.add(sparks);
  // the big star the show leaves in the sky
  const big = new THREE.Mesh(marsStarGeo(MS.bigSize), new THREE.MeshBasicMaterial({ color: 0xffe45c, fog: false }));
  big.add(glowSprite(MS_GOLD, MS.bigSize * 3.6, 0.6));   // a child, so it grows with the star
  big.visible = false;
  sg.add(big);
  // never breakable, and never under his finger: the drone's pick must land on the ground, not on a beam or a spark
  sg.traverse(o => { o.userData.noShatter = true; o.raycast = () => {}; });
  g.add(sg);
  const list = [];
  for (let i = 0; i < N; i++) {
    list.push({ i, st: "off", t: 0, slot: -1, grow: 0,
      x: 0, y: 0, z: 0, n: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), cur: new THREE.Vector3() });
  }
  mars.stars = {
    g: sg, starMesh, pillarMesh, glow, sparks, big, list,
    phase: "wait", t: MS.first, clock: 0, caught: 0, showers: 0, bursts: 0, sparkN: 0, trailT: 0, rainT: 0, bigT: 0,
    cx: rover.x, cy: rover.y, cz: rover.z, cf: new THREE.Vector3(1, 0, 0), centre,
    burstAt: new THREE.Vector3(),
    sp: { life: new Float32Array(SN), max: new Float32Array(SN), v: new Float32Array(SN * 3), c: new Float32Array(SN * 3), cur: 0, dirty: true },
  };
  marsStarsDraw();
}

// A spark from the one cloud: the next dead one, or (all alive) the oldest.
function marsSpark(x, y, z, vx, vy, vz, hex, life) {
  const S = mars.stars, sp = S.sp, n = sp.life.length;
  let k = -1;
  for (let j = 0; j < n; j++) { const q = (sp.cur + j) % n; if (sp.life[q] <= 0) { k = q; break; } }
  if (k < 0) k = sp.cur;
  sp.cur = (k + 1) % n;
  const p = S.sparks.geometry.attributes.position.array;
  p[k * 3] = x; p[k * 3 + 1] = y; p[k * 3 + 2] = z;
  sp.v[k * 3] = vx; sp.v[k * 3 + 1] = vy; sp.v[k * 3 + 2] = vz;
  sp.c[k * 3] = ((hex >> 16) & 255) / 255; sp.c[k * 3 + 1] = ((hex >> 8) & 255) / 255; sp.c[k * 3 + 2] = (hex & 255) / 255;
  sp.life[k] = sp.max[k] = life;
  sp.dirty = true;
}
// A direction for a burst's spark, off hashSalt: no rnd(), ever.
function marsSparkDir(out) {
  const S = mars.stars, s = S.sparkN++;
  const a = hashSalt(s, 210, 1) * Math.PI * 2, z = hashSalt(s, 210, 2) * 2 - 1, r = Math.sqrt(1 - z * z);
  return out.set(Math.cos(a) * r, z, Math.sin(a) * r);
}
function marsSparkBurst(x, y, z, n, speed, hex, life) {
  for (let i = 0; i < n; i++) {
    marsSparkDir(msV);
    const s = speed * (0.6 + hashSalt(mars.stars.sparkN, 210, 3) * 0.4);
    marsSpark(x, y, z, msV.x * s, msV.y * s, msV.z * s, hex, life);
  }
}

// From a point on the ground, `dist` metres along the surface towards `dir`.
function marsWalk(px, py, pz, dir, dist) {
  const b = mars.body;
  msU.set(px - b.x, py - b.y, pz - b.z).normalize();
  msT.copy(dir).addScaledVector(msU, -dir.dot(msU));
  if (msT.lengthSq() < 1e-8) msT.set(1, 0, 0).addScaledVector(msU, -msU.x);
  msT.normalize();
  const th = dist / b.r;
  const d = msU.clone().multiplyScalar(Math.cos(th)).addScaledVector(msT, Math.sin(th)).normalize();
  return { x: b.x + d.x * b.r, y: b.y + d.y * b.r, z: b.z + d.z * b.r, dir: d };
}

// The shower: seven stars, laid out round him and dropped from high up, slanting in.
function marsStarShower(who) {
  const S = mars.stars, b = mars.body, N = MS.count;
  S.phase = "fall"; S.caught = 0; S.showers++;
  const up = new THREE.Vector3(who.x - b.x, who.y - b.y, who.z - b.z).normalize();
  const fwd = who.f.clone().addScaledVector(up, -who.f.dot(up)).normalize();
  const gx = b.x + up.x * b.r, gy = b.y + up.y * b.r, gz = b.z + up.z * b.r;
  const slant = fwd.clone().cross(up).normalize();           // they all come in from his left
  for (const s of S.list) {
    const salt = S.showers * 16 + s.i;
    const ang = s.i === 0 ? 0 : s.i * MS.turn + (hashSalt(salt, 210, 4) - 0.5) * 0.5;
    const dist = MS.firstDist + s.i * MS.stepDist + hashSalt(salt, 210, 5) * MS.jitter;
    let p = marsWalk(gx, gy, gz, fwd.clone().applyAxisAngle(up, ang), dist);
    // never on or near the lit pad: driving onto it takes him home
    const fromPad = marsPalGround(p.x, p.y, p.z, mars.x, mars.y, mars.z);
    if (fromPad < MS.padClear) {
      msV.set(p.x - mars.x, p.y - mars.y, p.z - mars.z);
      if (fromPad < 1) msV.copy(fwd);
      p = marsWalk(mars.x, mars.y, mars.z, msV.clone(), MS.padClear);
    }
    p = marsClearSpot(p, MS.clearR);                           // and off anything solid
    s.x = p.x; s.y = p.y; s.z = p.z; s.n.copy(p.dir);
    s.to.set(p.x + p.dir.x * MS.hover, p.y + p.dir.y * MS.hover, p.z + p.dir.z * MS.hover);
    s.from.copy(s.to).addScaledVector(s.n, MS.fallH).addScaledVector(slant, -MS.fallSlant);
    s.cur.copy(s.from);
    s.st = "fall"; s.t = -s.i * MS.stagger; s.slot = -1; s.grow = 0;
  }
  // a shimmer coming down the scale: something is coming out of the sky
  [1760, 1568, 1319, 1175, 1047].forEach((f, i) => synthBlip("triangle", f, f, 0.3, 0.12, i * 0.09));
  synthBlip("sine", 2400, 900, 1.2, 0.08, 0);
  flags.marsStarShowers = (flags.marsStarShowers || 0) + 1;
}

function marsStarCatch(s, flying) {
  const S = mars.stars;
  s.st = "fly"; s.t = 0; s.slot = S.caught++; s.from.copy(s.cur);
  const f = MS_NOTES[s.slot % MS_NOTES.length];
  synthBlip("triangle", f, f, 0.32, 0.3, 0);
  synthBlip("sine", f * 2, f * 2, 0.24, 0.1, 0.02);
  marsSparkBurst(s.cur.x, s.cur.y, s.cur.z, 14, 9, MS_GOLD, 0.7);
  flags.marsStarsCaught = (flags.marsStarsCaught || 0) + 1;
  if (flying) flags.marsStarDroneCatches = (flags.marsStarDroneCatches || 0) + 1;
  if (S.caught >= MS.count) {
    S.phase = "windup"; S.t = MS.windup;
    synthBlip("sine", 300, 1600, MS.windup, 0.16, 0.1);
  }
}

// Up they go: each to its own burst point, fanned across in front of him.
function marsStarLaunch(who) {
  const S = mars.stars, b = mars.body, N = MS.count;
  msU.set(who.x - b.x, who.y - b.y, who.z - b.z).normalize();
  msT.copy(who.f).addScaledVector(msU, -who.f.dot(msU)).normalize();
  msR.copy(msT).cross(msU).normalize();
  S.burstAt.set(who.x, who.y, who.z).addScaledVector(msT, MS.burstAhead).addScaledVector(msU, MS.burstUp);
  for (const s of S.list) {
    if (s.st !== "crown") continue;
    s.st = "launch"; s.t = -s.slot * MS.launchStagger; s.from.copy(s.cur);
    s.to.copy(S.burstAt).addScaledVector(msR, (s.slot - (N - 1) / 2) * MS.fan)
      .addScaledVector(msU, (hashSalt(S.showers * 16 + s.i, 210, 6) - 0.5) * 14);
    synthBlip("sine", 400, 1500, 0.9, 0.07, Math.max(0, -s.t));
  }
  S.phase = "payoff";
  whoosh();
}

function marsStarBurst(s) {
  const S = mars.stars;
  s.st = "gone";
  marsSparkBurst(s.cur.x, s.cur.y, s.cur.z, MS.burstSparks, MS.burst, MS_FW[s.slot % MS_FW.length], MS.sparkLife);
  noiseBurst(0.5, 700, 0.3, 0);
  noiseBurst(0.6, 2500, 0.14, 0.05);
  S.bursts++;
  flags.marsStarBursts = (flags.marsStarBursts || 0) + 1;
  if (S.list.every(q => q.st === "gone")) {
    // the big star opens where they burst, and stays
    S.big.position.copy(S.burstAt);
    S.big.visible = true; S.bigT = 0; S.rainT = MS.rain;
    cheer();
    flags.marsStarPayoffs = (flags.marsStarPayoffs || 0) + 1;
    S.phase = "rest"; S.t = MS.again;
    for (const q of S.list) { q.st = "off"; q.slot = -1; }
  }
}

function updateMarsStars(dt) {
  const S = mars.stars, b = mars.body;
  if (!S) return;
  S.clock += dt;
  const flying = marsDroneActive(), who = flying ? mars.drone : rover;
  const calm = mars.phase === "idle" || mars.phase === "armed";
  // ---- the shower's clock: out driving, never while the cargo ship has the sky, never on the way home
  if (S.phase === "wait" || S.phase === "rest") {
    S.t -= dt;
    if (S.t <= 0 && calm && mars.cargoPhase !== "count" && mars.cargoPhase !== "falling") marsStarShower(who);
  } else if (S.phase === "fall") {
    if (S.list.every(s => s.st !== "fall")) S.phase = "hunt";
  } else if (S.phase === "windup") {
    S.t -= dt;
    if (S.t <= 0 && S.list.every(s => s.st === "crown")) marsStarLaunch(who);
  }
  // the ring follows whoever he is driving, and glides across when he swaps
  const fk = Math.min(1, 8 * dt);
  S.cx += (who.x - S.cx) * fk; S.cy += (who.y - S.cy) * fk; S.cz += (who.z - S.cz) * fk;
  S.cf.lerp(who.f, fk).normalize();

  S.trailT -= dt;
  const trail = S.trailT <= 0;
  if (trail) S.trailT = MS.trailEvery;
  for (const s of S.list) {
    if (s.st === "fall") {
      s.t += dt;
      const k = clamp(s.t / MS.fallTime, 0, 1), e = 1 - (1 - k) * (1 - k);   // it slows as it comes in: it settles, never lands hard
      s.cur.lerpVectors(s.from, s.to, e);
      if (s.t > 0 && trail) marsSpark(s.cur.x, s.cur.y, s.cur.z, 0, 0, 0, MS_GOLD, 0.8);
      if (k >= 1) {
        s.st = "landed"; s.t = 0; s.grow = 0;
        marsSparkBurst(s.to.x, s.to.y, s.to.z, 10, 5, MS_GOLD, 0.8);
        synthBlip("triangle", 1568, 1568, 0.14, 0.05, 0);
        flags.marsStarsLanded = (flags.marsStarsLanded || 0) + 1;
      }
    } else if (s.st === "landed") {
      s.t += dt;
      s.grow = Math.min(1, s.t / MS.pillarGrow);
      s.cur.copy(s.to).addScaledVector(s.n, Math.sin(S.clock * 2 + s.i) * MS.bob);
      // caught: aim at it. Along the ground, and low -- a jump clean over it is not a catch
      const d = marsPalGround(who.x, who.y, who.z, s.x, s.y, s.z);
      const got = flying ? (d < MS.droneCatchR && mars.drone.h < MS.droneCatchH) : (d < MS.catchR && rover.h < MS.roverCatchH);
      if (got) marsStarCatch(s, flying);
    } else if (s.st === "fly" || s.st === "crown") {
      // its place in the ring over him
      msU.set(S.cx - b.x, S.cy - b.y, S.cz - b.z).normalize();
      msT.copy(S.cf).addScaledVector(msU, -S.cf.dot(msU)).normalize();
      msR.copy(msT).cross(msU);
      const wk = S.phase === "windup" ? clamp(1 - S.t / MS.windup, 0, 1) : 0;
      const a = s.slot / MS.count * Math.PI * 2 + S.clock * MS.crownSpin * (1 + wk * wk * 5);
      const h = MS.crownH + wk * MS.windupRise;
      msV.set(S.cx, S.cy, S.cz).addScaledVector(msU, h)
        .addScaledVector(msT, Math.cos(a) * MS.crownR).addScaledVector(msR, Math.sin(a) * MS.crownR);
      if (s.st === "fly") {
        s.t += dt;
        const k = clamp(s.t / MS.flyTime, 0, 1), e = 1 - (1 - k) * (1 - k);
        s.cur.lerpVectors(s.from, msV, e);
        if (trail) marsSpark(s.cur.x, s.cur.y, s.cur.z, 0, 0, 0, MS_GOLD, 0.5);
        if (k >= 1) s.st = "crown";
      } else s.cur.copy(msV);
      if (wk > 0.5 && trail) marsSpark(s.cur.x, s.cur.y, s.cur.z, 0, 0, 0, MS_GOLD, 0.4);
    } else if (s.st === "launch") {
      s.t += dt;
      if (s.t > 0) {
        const k = clamp(s.t / MS.launchTime, 0, 1), e = k * (2 - k);
        s.cur.lerpVectors(s.from, s.to, e);
        if (trail) marsSpark(s.cur.x, s.cur.y, s.cur.z, 0, 0, 0, MS_FW[s.slot % MS_FW.length], 0.6);
        if (k >= 1) marsStarBurst(s);
      }
    }
  }
  // ---- the big star: it pops open, then hangs there turning to face him and twinkling
  if (S.big.visible) {
    S.bigT += dt;
    const k = clamp(S.bigT / MS.bigPop, 0, 1);
    const pop = k < 1 ? 1 + 1.7 * Math.pow(k - 1, 3) + 0.7 * Math.pow(k - 1, 2) : 1;   // back-out: a little over, then settle
    S.big.scale.setScalar(Math.max(0.001, pop * (1 + 0.05 * Math.sin(S.clock * 3))));
    S.big.up.set(S.big.position.x - b.x, S.big.position.y - b.y, S.big.position.z - b.z).normalize();
    S.big.lookAt(camera.position);
    S.big.rotateZ(Math.sin(S.clock * 0.9) * 0.15);
    if (S.rainT > 0) {
      S.rainT -= dt;
      if (trail) {
        marsSparkDir(msV);
        msU.copy(S.big.up);
        marsSpark(S.big.position.x + msV.x * MS.bigSize, S.big.position.y + msV.y * MS.bigSize, S.big.position.z + msV.z * MS.bigSize,
                  -msU.x * 6, -msU.y * 6, -msU.z * 6, MS_GOLD, 2.2);
      }
    }
  }
  marsSparksUpdate(dt);
  marsStarsDraw();
}

function marsSparksUpdate(dt) {
  const S = mars.stars, sp = S.sp, n = sp.life.length, b = mars.body;
  const p = S.sparks.geometry.attributes.position.array, c = S.sparks.geometry.attributes.color.array;
  if (!sp.dirty) return;
  let alive = 0;
  const gx = -mars.n.x * MS.sparkG, gy = -mars.n.y * MS.sparkG, gz = -mars.n.z * MS.sparkG;
  const drag = Math.max(0, 1 - MS.drag * dt);
  for (let k = 0; k < n; k++) {
    if (sp.life[k] <= 0) { c[k * 3] = c[k * 3 + 1] = c[k * 3 + 2] = 0; continue; }
    sp.life[k] -= dt;
    if (sp.life[k] <= 0) {
      c[k * 3] = c[k * 3 + 1] = c[k * 3 + 2] = 0;
      p[k * 3] = b.x; p[k * 3 + 1] = b.y; p[k * 3 + 2] = b.z;
      continue;
    }
    alive++;
    const v = sp.v;
    v[k * 3] = (v[k * 3] + gx * dt) * drag; v[k * 3 + 1] = (v[k * 3 + 1] + gy * dt) * drag; v[k * 3 + 2] = (v[k * 3 + 2] + gz * dt) * drag;
    p[k * 3] += v[k * 3] * dt; p[k * 3 + 1] += v[k * 3 + 1] * dt; p[k * 3 + 2] += v[k * 3 + 2] * dt;
    const f = Math.min(1, sp.life[k] / sp.max[k] * 1.6);
    c[k * 3] = sp.c[k * 3] * f; c[k * 3 + 1] = sp.c[k * 3 + 1] * f; c[k * 3 + 2] = sp.c[k * 3 + 2] * f;
  }
  S.sparks.geometry.attributes.position.needsUpdate = true;
  S.sparks.geometry.attributes.color.needsUpdate = true;
  sp.dirty = alive > 0;       // one last upload clears the dead ones, then nothing until the next spark
}

// Every star where it is: the ones in play shown, the rest scaled to nothing.
function marsStarsDraw() {
  const S = mars.stars, b = mars.body;
  const gp = S.glow.geometry.attributes.position.array;
  for (const s of S.list) {
    const i = s.i;
    let sc = 0;
    if (s.st === "fall" || s.st === "landed") sc = 1;
    else if (s.st === "fly") sc = 1 - (1 - MS.crownScale) * clamp(s.t / MS.flyTime, 0, 1);
    else if (s.st === "crown") sc = MS.crownScale;
    else if (s.st === "launch") sc = MS.crownScale + (1 - MS.crownScale) * clamp(s.t / MS.launchTime, 0, 1);
    // standing up along the ground there, turning about its own up
    msU.set(s.cur.x - b.x, s.cur.y - b.y, s.cur.z - b.z).normalize();
    msQ.setFromUnitVectors(MS_Y, msU);
    msQ2.setFromAxisAngle(MS_Y, S.clock * MS.spin + i * 0.9);
    msQ.multiply(msQ2);
    msScl.setScalar(Math.max(sc, 1e-4));
    msM.compose(sc > 0 ? s.cur : S.centre, msQ, msScl);
    S.starMesh.setMatrixAt(i, msM);
    // its beam, only while it waits on the ground
    const ps = s.st === "landed" ? s.grow : 0;
    msV.set(s.x, s.y, s.z);
    msQ.setFromUnitVectors(MS_Y, s.n);
    msScl.set(Math.max(ps, 1e-4), Math.max(ps, 1e-4), Math.max(ps, 1e-4));
    msM.compose(ps > 0 ? msV : S.centre, msQ, msScl);
    S.pillarMesh.setMatrixAt(i, msM);
    // a glow on the ones out in the world -- not the ring over him: seven of them there washed the rover out
    const at = s.st === "fall" || s.st === "landed" || s.st === "launch" ? s.cur : S.centre;
    gp[i * 3] = at.x; gp[i * 3 + 1] = at.y; gp[i * 3 + 2] = at.z;
  }
  S.starMesh.instanceMatrix.needsUpdate = true;
  S.pillarMesh.instanceMatrix.needsUpdate = true;
  S.glow.geometry.attributes.position.needsUpdate = true;
}

// ---- the four of them, driven from the base's own update
function marsToysBuild(g) {
  marsToysClear();          // a rebuild must not leave the old drone in the scene
  marsBuildJumps(g);
  marsBuildBoulders(g);
  marsBuildDrone(g);
  marsBuildPal(g);          // on its own stream: what came before sees what it always saw
  marsBuildStars(g);        // and so is the star shower
}
function marsToysClear() {
  if (mars.drone) { disposeSurfaceObjects([mars.drone.g]); mars.drone = null; }
  mars.pal = null;          // it lives in the base group, which goes with it
  mars.stars = null;        // ... and so does the star shower
  mars.jumps = []; mars.rocks = []; mars.rocksAway = false;
  mars.jump.air = false; mars.jump.peaked = false; mars.jump.t = 0; mars.jump.roll = 0; mars.jump.flipT = 0;
}
function updateMarsToys(dt) {
  if (!roverActive() || !mars.body) return;
  updateMarsPal(dt);        // before the drone: flying it down to the sleepy rover wakes it too
  updateMarsStars(dt);      // and the drone catches stars too
  if (marsDroneActive()) { updateMarsDrone(dt); return; }   // the rover waits where he left it
  marsJumpCheck(dt);
  marsUpdateBoulders(dt, mars.body);
}
function marsLate(dt) {
  if (mars.jumps.length && roverActive() && rover.mesh && !marsDroneActive()) marsJumpLate(dt);
}
