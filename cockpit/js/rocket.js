"use strict";
// ---------------------------------------------------------------------------
// The rocket: its own flight model, modelled loosely on a Falcon 9.
//
//   - Vertical launch from the pad (the runway). Hold the throttle to burn;
//     release to coast. The stick tilts the rocket (drag up = nose up, i.e.
//     back toward vertical; drag down = pitch over toward the horizon), left /
//     right yaws it.
//   - Thrust acts along the body axis; gravity fades out above the atmosphere;
//     drag only in the atmosphere. In space you coast.
//   - Three drops, each only allowed above its altitude: the booster (grid fins,
//     landing legs -- it flies itself back down and lands on its legs), the two
//     fairing halves, then the second stage. What is left is the capsule on
//     its thrusters. Landing anywhere gives the whole stack back.
//   - The Moon and Mars hang in the sky above the atmosphere. Come in slowly
//     and you land (fireworks, then launch again from there); come in fast and
//     you explode and reassemble, like everything else.
// ---------------------------------------------------------------------------

const RK = TUNE.rocketTune;
const rk = {                     // rocket-specific state (plane fields stay in `state`)
  vx: 0, vy: 0, vz: 0,
  stage: 0,                      // 0 full stack, 1 booster gone, 2 fairing gone, 3 stage 2 gone (capsule)
  fuel: [0, 0, 0],               // booster, second stage, capsule (Infinity)
  igniteT: 0,                    // engine spool before liftoff
  onBody: null,                  // null (Earth pad / ground), or a BODIES entry when landed on it
  landedT: 0,
  reentry: 0,
};
const BODIES = [
  { name: "moon", x: RK.moon.x, y: RK.moon.y, z: RK.moon.z, r: RK.moon.r, g: RK.moon.g, color: 0xb9bcc4 },
  { name: "mars", x: RK.mars.x, y: RK.mars.y, z: RK.mars.z, r: RK.mars.r, g: RK.mars.g, color: 0xc65a2e },
];
const rkAxis = new THREE.Vector3();
const rkTmp = new THREE.Vector3();

// ---- the Moon and Mars (always in the scene; the fog hides them from the ground)
for (const b of BODIES) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: b.color, emissive: b.name === "moon" ? 0x7a7e88 : 0x6e2a12 });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(b.r, 36, 24), mat);
  g.add(sphere);
  // craters / features: darker discs pressed into the surface
  const seedBase = b.name === "moon" ? 51 : 77;
  const n = b.name === "moon" ? 26 : 14;
  for (let i = 0; i < n; i++) {
    const th = hashSalt(i, seedBase, 1) * Math.PI * 2, ph = (hashSalt(i, seedBase, 2) - 0.5) * Math.PI;
    const cr = b.r * (0.05 + hashSalt(i, seedBase, 3) * 0.09);
    const c = new THREE.Mesh(new THREE.CircleGeometry(cr, 14), new THREE.MeshLambertMaterial({ color: b.name === "moon" ? 0x8e929b : 0x9c4322, emissive: b.name === "moon" ? 0x4e525a : 0x4a1d0c }));
    const dir = new THREE.Vector3(Math.cos(ph) * Math.cos(th), Math.sin(ph), Math.cos(ph) * Math.sin(th));
    c.position.copy(dir).multiplyScalar(b.r + 0.6);
    c.lookAt(dir.clone().multiplyScalar(b.r * 2));
    g.add(c);
  }
  if (b.name === "mars") {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(b.r * 0.3, 16, 10), new THREE.MeshLambertMaterial({ color: 0xf2f4f7 }));
    cap.position.y = b.r * 0.9; cap.scale.y = 0.35; g.add(cap);
  }
  g.position.set(b.x, b.y, b.z);
  scene.add(g);
  b.mesh = g;
}

// ---- the stack. Nose points -z in model space (same convention as the planes,
// so pitch 90 = straight up with the shared forward() maths).
function buildRocketStack(g, mats) {
  const white = new THREE.MeshLambertMaterial({ color: 0xf4f6f8 });
  const black = new THREE.MeshLambertMaterial({ color: 0x1f2328 });
  const grey = new THREE.MeshLambertMaterial({ color: 0x8a93a0 });
  const R = 0.95;
  const mk = (geo, mat, x, y, z, rx, ry, rz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.rotation.set(rx || 0, ry || 0, rz || 0); return m; };
  const along = (len) => new THREE.CylinderGeometry(R, R, len, 16);

  // booster (z from +7.5 base to -0.5 top), interstage black band, 9 engines, grid fins, legs
  const booster = new THREE.Group();
  booster.add(mk(along(8), white, 0, 0, 3.5, Math.PI / 2));
  booster.add(mk(new THREE.CylinderGeometry(R + 0.01, R + 0.01, 1.1, 16), black, 0, 0, -0.55, Math.PI / 2));
  for (let i = 0; i < 9; i++) {
    const a = i / 8 * Math.PI * 2, rr = i === 8 ? 0 : 0.55;
    booster.add(mk(new THREE.ConeGeometry(0.22, 0.6, 8), grey, Math.cos(a) * rr, Math.sin(a) * rr, 7.75, Math.PI / 2));
  }
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const fin = mk(new THREE.BoxGeometry(0.9, 0.08, 0.7), black, Math.cos(a) * (R + 0.35), Math.sin(a) * (R + 0.35), 0.3, 0, 0, a);
    booster.add(fin);
    const leg = mk(new THREE.BoxGeometry(0.16, 0.3, 3.2), black, Math.cos(a) * (R + 0.1), Math.sin(a) * (R + 0.1), 6.0, 0, 0, a);
    leg.userData.leg = true; leg.userData.a = a;
    booster.add(leg);
  }
  booster.userData.baseZ = 7.5;
  g.add(booster);

  // second stage (z -0.5 .. -3.5) with its single vacuum engine
  const stage2 = new THREE.Group();
  stage2.add(mk(along(3), white, 0, 0, -2.0, Math.PI / 2));
  stage2.add(mk(new THREE.ConeGeometry(0.42, 0.9, 10), grey, 0, 0, -0.2, Math.PI / 2));
  stage2.userData.baseZ = -0.2;
  g.add(stage2);

  // capsule (inside the fairing until it opens) with a window and thrusters
  const capsule = new THREE.Group();
  capsule.add(mk(new THREE.CylinderGeometry(0.75, 0.9, 1.4, 12), mats.mA, 0, 0, -4.3, Math.PI / 2));
  capsule.add(mk(new THREE.ConeGeometry(0.75, 1.2, 12), white, 0, 0, -5.6, -Math.PI / 2));
  capsule.add(mk(new THREE.CircleGeometry(0.28, 10), mats.glassM, 0, 0.5, -5.05, 0.6));
  capsule.userData.baseZ = -3.55;
  g.add(capsule);

  // fairing halves (ogive, split left/right), covering the capsule
  const fairing = [];
  for (const s of [-1, 1]) {
    const half = new THREE.Group();
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.06, R + 0.06, 2.0, 16, 1, false, s > 0 ? 0 : Math.PI, Math.PI), white);
    cyl.rotation.x = Math.PI / 2; cyl.position.z = -4.5; half.add(cyl);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(R + 0.06, 2.2, 16, 1, false, s > 0 ? 0 : Math.PI, Math.PI), white);
    cone.rotation.x = -Math.PI / 2; cone.position.z = -6.6; half.add(cone);
    half.userData.side = s;
    fairing.push(half);
    g.add(half);
  }

  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.2, 10), new THREE.MeshBasicMaterial({ color: 0xffb43a }));
  flame.rotation.x = -Math.PI / 2;
  flame.position.z = 9.2;
  g.add(flame);
  g.userData.flame = flame;
  g.userData.rocket = { booster, stage2, capsule, fairing, flame };
  g.userData.halfLen = 7.6;
  rocketApplyStages(g);
}

// Show the parts that are still attached; put the flame under the live engine.
function rocketApplyStages(g) {
  const p = g.userData.rocket;
  if (!p) return;
  p.booster.visible = rk.stage === 0;
  p.fairing.forEach(f => { f.visible = rk.stage <= 1; });
  p.stage2.visible = rk.stage <= 2;
  const baseZ = rk.stage === 0 ? p.booster.userData.baseZ : rk.stage <= 2 ? p.stage2.userData.baseZ : p.capsule.userData.baseZ;
  p.flame.position.z = baseZ + (rk.stage === 0 ? 1.7 : rk.stage <= 2 ? 1.1 : 0.7);
  p.flame.scale.setScalar(rk.stage === 0 ? 1 : rk.stage <= 2 ? 0.6 : 0.35);
}

function rocketRestock() {
  rk.stage = 0;
  rk.fuel = [RK.fuel[0], RK.fuel[1], Infinity];
  if (vehicleModel) rocketApplyStages(vehicleModel);
}
function rocketHalfLen() { return (vehicleModel && vehicleModel.userData.halfLen || 7.6) * (state.vp.size || 1); }
function rocketAlt() {
  return state.y - Math.max(terrainEff(state.x, state.z), TUNE.waterLevel);
}
function rocketNextDropAlt() { return rk.stage < 3 ? RK.stageAlt[rk.stage] : Infinity; }
function rocketCanDrop() {
  return state.phase === "AIRBORNE" && !state.exploding && rk.stage < 3 && !rk.onBody && rocketAlt() >= rocketNextDropAlt();
}

// ---- falling stages
const fallingStages = [];
function dropStage() {
  if (!rocketCanDrop() || !vehicleModel) return false;
  const p = vehicleModel.userData.rocket;
  const parts = rk.stage === 0 ? [p.booster] : rk.stage === 1 ? p.fairing : [p.stage2];
  const kind = rk.stage === 0 ? "booster" : rk.stage === 1 ? "fairing" : "stage2";
  vehicleModel.updateMatrixWorld(true);
  for (const part of parts) {
    const clone = part.clone();
    part.updateMatrixWorld(true);
    clone.applyMatrix4(part.matrixWorld);
    clone.matrixAutoUpdate = true;
    scene.add(clone);
    const side = part.userData.side || 0;
    const sx = Math.cos(state.heading) * side, sz = -Math.sin(state.heading) * side;
    fallingStages.push({
      mesh: clone, kind,
      x: clone.position.x, y: clone.position.y, z: clone.position.z,
      vx: rk.vx * 0.9 + sx * 6, vy: rk.vy * 0.9 - 4, vz: rk.vz * 0.9 + sz * 6,
      rx: (rnd() - 0.5) * 1.2, ry: (rnd() - 0.5) * 1.2, life: kind === "booster" ? 60 : 30, landed: false,
    });
  }
  rk.stage++;
  rocketApplyStages(vehicleModel);
  stageSep();
  flags.stageDrops = (flags.stageDrops || 0) + 1;
  return true;
}
function updateFallingStages(dt) {
  for (let i = fallingStages.length - 1; i >= 0; i--) {
    const s = fallingStages[i];
    s.life -= dt;
    if (s.life <= 0) { scene.remove(s.mesh); fallingStages.splice(i, 1); continue; }
    if (s.landed) continue;
    const ground = Math.max(terrainEff(s.x, s.z), TUNE.waterLevel);
    const alt = s.y - ground;
    const g = RK.gravity * clamp(1 - s.y / RK.gravityFade, 0, 1);
    s.vy -= g * dt;
    if (s.kind === "booster") {
      // Falcon-style: it flips upright, burns to slow down, and lands on its legs.
      const up = new THREE.Vector3(0, 1, 0);
      s.mesh.quaternion.slerp(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), up), Math.min(1, 1.5 * dt));
      s.vx *= 1 - Math.min(1, 1.2 * dt); s.vz *= 1 - Math.min(1, 1.2 * dt);
      if (s.vy < 0 && alt < 260) {
        const want = -Math.max(6, alt * 0.25);   // slow to ~6 m/s for touchdown
        s.vy += (want - s.vy) * Math.min(1, 3 * dt);
        for (const c of s.mesh.children) if (c.userData.leg) c.rotation.z = c.userData.a + 0.9 * clamp(1 - alt / 200, 0, 1) * 0;  // legs stay; deploy = swing out below
        for (const c of s.mesh.children) if (c.userData.leg) { c.rotation.set(0, 0, c.userData.a); c.position.x = Math.cos(c.userData.a) * (0.95 + 0.1 + 1.1 * clamp(1 - alt / 200, 0, 1)); c.position.y = Math.sin(c.userData.a) * (0.95 + 0.1 + 1.1 * clamp(1 - alt / 200, 0, 1)); }
      }
      if (alt <= 7.6 * (state.vp.size || 1)) {
        s.landed = true; s.vx = s.vy = s.vz = 0;
        s.y = ground + 7.6 * (state.vp.size || 1);
        s.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0));
        s.mesh.position.set(s.x, s.y, s.z);
        boosterLand();
        flags.boosterLandings = (flags.boosterLandings || 0) + 1;
        continue;
      }
    } else {
      s.mesh.rotation.x += s.rx * dt; s.mesh.rotation.y += s.ry * dt;
      if (alt <= 2) { s.life = Math.min(s.life, 0.01); }
    }
    s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
    s.mesh.position.set(s.x, s.y, s.z);
  }
}

// ---- gravity / atmosphere helpers
function rocketGravityAt(x, y, z) {
  // Earth pulls down, fading out above the atmosphere; a nearby body pulls toward itself.
  let gx = 0, gy = -RK.gravity * clamp(1 - y / RK.gravityFade, 0, 1), gz = 0;
  for (const b of BODIES) {
    const dx = b.x - x, dy = b.y - y, dz = b.z - z;
    const d = Math.hypot(dx, dy, dz);
    if (d < b.r * 2.6) {
      const k = b.g * clamp(1 - (d - b.r) / (b.r * 1.6), 0, 1) / Math.max(d, 1);
      gx += dx * k; gy += dy * k; gz += dz * k;
    }
  }
  return [gx, gy, gz];
}
function rocketNearestBody() {
  let best = null, bd = Infinity;
  for (const b of BODIES) {
    const d = Math.hypot(b.x - state.x, b.y - state.y, b.z - state.z) - b.r;
    if (d < bd) { bd = d; best = b; }
  }
  return { body: best, dist: bd };
}

// ---- the flight model. Runs instead of the plane branch; the common tail of
// update() (camera, HUD, sky, rewards) follows.
function updateRocket(dt) {
  const grounded = state.phase === "TAXI" || state.phase === "ROLL";
  const halfLen = rocketHalfLen();

  // buttons: throttle always (hold to burn); the rocket has no missiles/speed steps/gear
  el.throttleBtn.classList.remove("hidden");
  el.rotateArrow.classList.remove("on");
  el.slowBtn.classList.add("hidden"); el.fastBtn.classList.add("hidden"); el.missileBtn.classList.add("hidden");
  el.skipBtn.classList.add("hidden"); el.gearBtn.classList.add("hidden");
  el.stageBtn.classList.toggle("hidden", !rocketCanDrop());
  el.stageBtn.dataset.stage = String(rk.stage);

  if (grounded) {
    // sitting on the pad (or on a body): upright, still, restocked
    if (rk.onBody) {
      const b = rk.onBody;
      rkAxis.set(state.x - b.x, state.y - b.y, state.z - b.z).normalize();
      rkTmp.copy(rkAxis).multiplyScalar(b.r + halfLen);
      state.x = b.x + rkTmp.x; state.y = b.y + rkTmp.y; state.z = b.z + rkTmp.z;
      state.pitch = Math.asin(clamp(rkAxis.y, -1, 1)) / DEG;
      state.heading = Math.atan2(-rkAxis.x, -rkAxis.z);
    } else {
      state.y = Math.max(terrainEff(state.x, state.z), TUNE.waterLevel) + halfLen;
      state.pitch += (90 - state.pitch) * Math.min(1, 6 * dt);
    }
    state.bank = 0;
    rk.vx = rk.vy = rk.vz = 0;
    state.speed = 0;
    rumble = 0;
    setRolling(0);
    if (state.throttleHeld) {
      rk.igniteT += dt;
      rumble = 0.03 + rk.igniteT * 0.02;
      setEngine(0.4 + rk.igniteT * 0.4);
      if (rk.igniteT >= RK.igniteTime) {
        state.phase = "AIRBORNE";
        state.liftoffTimer = 0;
        state.maxAglSinceLiftoff = 1e9;
        flags.liftoff++;
        rk.igniteT = 0;
        liftoffRoar();
        rumble = 0.05;
      }
    } else {
      rk.igniteT = 0;
      setEngine(0.01);
    }
    forward.set(0, 1, 0);
    return;
  }

  // ---- in flight
  const burning = state.throttleHeld && rk.fuel[Math.min(rk.stage, 2)] > 0;
  if (burning) rk.fuel[Math.min(rk.stage, 2)] -= dt;
  const thrust = burning ? RK.thrust[Math.min(rk.stage, 3)] : 0;

  // attitude from the stick: up = nose up (toward vertical), down = pitch over; left/right = yaw
  if (state.touching) {
    state.pitch = clamp(state.pitch + state.ctrlPitch * RK.turnRateDeg * dt, -90, 90);
    state.heading -= state.ctrlBank * RK.turnRateDeg * 0.8 * DEG * dt;
    state.bank += (state.ctrlBank * 18 - state.bank) * Math.min(1, 4 * dt);
  } else {
    state.bank += (0 - state.bank) * Math.min(1, 3 * dt);
  }
  const pr = state.pitch * DEG, hr = state.heading, cp = Math.cos(pr);
  rkAxis.set(-Math.sin(hr) * cp, Math.sin(pr), -Math.cos(hr) * cp);

  const [gx, gy, gz] = rocketGravityAt(state.x, state.y, state.z);
  rk.vx += (rkAxis.x * thrust + gx) * dt;
  rk.vy += (rkAxis.y * thrust + gy) * dt;
  rk.vz += (rkAxis.z * thrust + gz) * dt;
  const inAtmo = clamp(1 - state.y / RK.gravityFade, 0, 1);
  const dragK = RK.drag * inAtmo;
  rk.vx *= 1 - Math.min(1, dragK * dt); rk.vy *= 1 - Math.min(1, dragK * dt); rk.vz *= 1 - Math.min(1, dragK * dt);
  let sp = Math.hypot(rk.vx, rk.vy, rk.vz);
  if (sp > RK.maxSpeed) { const k = RK.maxSpeed / sp; rk.vx *= k; rk.vy *= k; rk.vz *= k; sp = RK.maxSpeed; }
  state.x += rk.vx * dt; state.y += rk.vy * dt; state.z += rk.vz * dt;
  state.speed = sp;
  state.airVy = null;
  // velocity direction for the shared systems (alarm prediction, wall push-out)
  if (sp > 0.5) forward.set(rk.vx / sp, rk.vy / sp, rk.vz / sp); else forward.copy(rkAxis);

  setEngine(burning ? 0.95 + 0.15 * Math.random() : 0.02);
  rumble = burning ? 0.02 : 0;
  // reentry glow: fast and descending into the atmosphere
  rk.reentry = (rk.vy < -60 && inAtmo > 0.2 && inAtmo < 0.95) ? Math.min(1, rk.reentry + dt) : Math.max(0, rk.reentry - dt);

  resolveSolidWalls();
  if (state.exploding) return;

  // ---- touching a body
  const { body, dist } = rocketNearestBody();
  if (body && dist <= halfLen + 1) {
    rkAxis.set(state.x - body.x, state.y - body.y, state.z - body.z).normalize();
    const inward = rk.vx * rkAxis.x + rk.vy * rkAxis.y + rk.vz * rkAxis.z;
    if (inward > 0) {
      // just launched from it: still touching but moving away -- not a landing
    } else if (sp <= RK.landSpeed) {
      rocketLandOn(body);
    } else {
      rocketCrash(body.x + rkAxis.x * (body.r + 90), body.y + rkAxis.y * (body.r + 90), body.z + rkAxis.z * (body.r + 90));
    }
    return;
  }
  // ---- touching the Earth
  const ground = Math.max(terrainEff(state.x, state.z), TUNE.waterLevel);
  if (state.y - halfLen <= ground && rk.vy <= 0) {
    const upright = state.pitch > 55;
    const onLand = terrainEff(state.x, state.z) >= TUNE.waterLevel - 0.2;
    if (sp <= RK.landSpeed && upright && onLand) rocketLandOn(null);
    else rocketCrash(state.x, ground + 70, state.z);
  }
}

function rocketLandOn(body) {
  rk.onBody = body;
  rk.vx = rk.vy = rk.vz = 0;
  state.speed = 0;
  state.phase = "TAXI";
  state.throttleHeld = false;
  releaseThrottle();
  rocketRestock();
  if (body) {
    flags[body.name + "Landings"] = (flags[body.name + "Landings"] || 0) + 1;
    confettiBurst(); cheer();
    for (let i = 0; i < 6; i++) fireworkSound(i * 0.5);
    rk.showT = 4;
  } else {
    chirp(); touchdownFx();
    flags.rocketLandings = (flags.rocketLandings || 0) + 1;
  }
}
function rocketCrash(sx, sy, sz) {
  state.exploding = true;
  state.explodeTimer = TUNE.reassembleDelay;
  safePos.x = sx; safePos.y = sy; safePos.z = sz;
  triggerExplosion(state.x, state.y, state.z, 1);
  shatterAround(state.x, state.y, state.z);
}
// Called from the shared reassemble: point the rocket up again with the full stack.
function rocketAfterReassemble() {
  rk.vx = 0; rk.vy = 4; rk.vz = 0;
  state.pitch = 90; state.bank = 0;
  rk.onBody = null;
  rocketRestock();
}
// Camera for the rocket: cockpit looks along the body axis; chase sits behind and a little below.
const camUp = new THREE.Vector3(0, 1, 0);
function rocketCamera(dt) {
  const pr = state.pitch * DEG, hr = state.heading, cp = Math.cos(pr);
  rkAxis.set(-Math.sin(hr) * cp, Math.sin(pr), -Math.cos(hr) * cp);
  const sh = shakeAmp + rumble;
  // near the Moon or Mars, "up" is away from its centre so its surface reads as the ground
  const nb = rocketNearestBody();
  camUp.set(0, 1, 0);
  if (nb.body && nb.dist < nb.body.r * 1.2) {
    rkTmp.set(state.x - nb.body.x, state.y - nb.body.y, state.z - nb.body.z).normalize();
    const k = clamp(1 - nb.dist / (nb.body.r * 1.2), 0, 1);
    camUp.lerp(rkTmp, k).normalize();
  }
  camera.up.copy(camUp);
  if (state.viewChase) {
    const fx = -Math.sin(hr), fz = -Math.cos(hr);
    camDesired.set(state.x - fx * 34 - rkAxis.x * 6, state.y + 4 - rkAxis.y * 6 + 6, state.z - fz * 34 - rkAxis.z * 6);
    camera.position.lerp(camDesired, Math.min(1, 4 * dt));
    lookV.set(state.x + rkAxis.x * 4, state.y + rkAxis.y * 4, state.z + rkAxis.z * 4);
    camera.lookAt(lookV);
  } else {
    camera.position.set(state.x + rkAxis.x * (rocketHalfLen() - 1.5), state.y + rkAxis.y * (rocketHalfLen() - 1.5), state.z + rkAxis.z * (rocketHalfLen() - 1.5));
    lookV.set(camera.position.x + rkAxis.x * 100, camera.position.y + rkAxis.y * 100, camera.position.z + rkAxis.z * 100);
    camera.lookAt(lookV);
    camera.rotateZ(-state.bank * DEG);
  }
  camera.position.x += (Math.random() - 0.5) * 9 * sh;
  camera.position.y += (Math.random() - 0.5) * 7 * sh;
  camera.position.z += (Math.random() - 0.5) * 9 * sh;
}
