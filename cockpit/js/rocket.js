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
  reentry: 0,                    // plasma glow 0..1
  chute: 0, chuteT: 0,           // 0 none, 1 drogue, 2 mains; seconds since the last pop
  satOut: false,                 // the satellite has been deployed on this flight
  refitT: 0,                     // seconds until the pad rolls out a new stack after an Earth landing
};
const BODIES = [
  { name: "moon", x: RK.moon.x, y: RK.moon.y, z: RK.moon.z, r: RK.moon.r, g: RK.moon.g, color: 0x9a9ea8 },
  { name: "mars", x: RK.mars.x, y: RK.mars.y, z: RK.mars.z, r: RK.mars.r, g: RK.mars.g, color: 0xb04f28 },
  // the station's docking port: a tiny "body" with no gravity that the capsule noses into
  { name: "station", x: station.position.x, y: station.position.y + station.userData.portY, z: station.position.z, r: 3, g: 0, dock: true, assistR: 140, mesh: station },
];
const rkAxis = new THREE.Vector3();
const Q_UPRIGHT = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0));
const rkTmp = new THREE.Vector3();

// ---- the Moon and Mars (always in the scene; the fog hides them from the ground)
for (const b of BODIES) {
  if (b.dock) continue;
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: b.color, emissive: b.name === "moon" ? 0x3a3d44 : 0x3a1608 });   // dim enough not to burn out up close (the rover drives on it)
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(b.r, 96, 64), mat);   // fine enough that the ground is where the rover drives (facet sag < 1 m)
  g.add(sphere);
  // craters / features: darker discs pressed into the surface
  const seedBase = b.name === "moon" ? 51 : 77;
  const n = b.name === "moon" ? 26 : 14;
  for (let i = 0; i < n; i++) {
    const th = hashSalt(i, seedBase, 1) * Math.PI * 2, ph = (hashSalt(i, seedBase, 2) - 0.5) * Math.PI;
    const cr = b.r * (0.05 + hashSalt(i, seedBase, 3) * 0.09);
    // a cap of the sphere itself (a flat disc would stand proud of the ground at its rim)
    const c = new THREE.Mesh(new THREE.SphereGeometry(b.r + 0.25, 16, 6, 0, Math.PI * 2, 0, cr / b.r), new THREE.MeshLambertMaterial({ color: b.name === "moon" ? 0x6e727b : 0x7c3319, emissive: b.name === "moon" ? 0x24272c : 0x22100a }));
    const dir = new THREE.Vector3(Math.cos(ph) * Math.cos(th), Math.sin(ph), Math.cos(ph) * Math.sin(th));
    c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
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
  const plumeLight = new THREE.PointLight(0xff9a3a, 0, 320, 1.6);   // lights the pad at night
  plumeLight.position.z = 9.5;
  g.add(plumeLight);
  g.userData.plumeLight = plumeLight;
  // plasma sheath for reentry: a bright shock layer on the heat shield (the capsule's
  // base, +z) and a wake streaming past the nose. Additive, faded by rk.reentry.
  const plasma = new THREE.Group();
  const plasmaMats = [];
  [[-3.3, 1.5, 1.0, 0xffd27a], [-4.6, 1.9, 0.55, 0xff8a2a], [-6.4, 2.4, 0.32, 0xff6a1a], [-8.8, 3.0, 0.18, 0xff4a10]].forEach(([z, r, a, c]) => {
    const m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    m.userData.peak = a; plasmaMats.push(m);
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), m);
    s.position.z = z; s.scale.set(1, 1, 1.5); plasma.add(s);
  });
  plasma.visible = false;
  g.add(plasma);
  g.userData.rocket = { booster, stage2, capsule, fairing, flame, plasma, plasmaMats };
  g.userData.halfLen = 7.6;
  rocketApplyStages(g);
}

// Starship: a stainless Super Heavy booster (grid fins, a ring of engines) and the
// Ship on top (black tiles down one side, two small fore flaps, two big aft flaps).
function buildStarshipStack(g, mats) {
  const steel = new THREE.MeshLambertMaterial({ color: 0xc9ced6, emissive: 0x1a1d22 });
  const tiles = new THREE.MeshLambertMaterial({ color: 0x23272d });
  const grey = new THREE.MeshLambertMaterial({ color: 0x6b7078 });
  const R = 1.15;
  const mk = (geo, mat, x, y, z, rx, ry, rz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.rotation.set(rx || 0, ry || 0, rz || 0); return m; };
  const booster = new THREE.Group();
  booster.add(mk(new THREE.CylinderGeometry(R, R, 9, 18), steel, 0, 0, 5, Math.PI / 2));
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; booster.add(mk(new THREE.ConeGeometry(0.2, 0.5, 6), grey, Math.cos(a) * 0.8, Math.sin(a) * 0.8, 9.7, Math.PI / 2)); }
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; booster.add(mk(new THREE.ConeGeometry(0.2, 0.5, 6), grey, Math.cos(a) * 0.3, Math.sin(a) * 0.3, 9.7, Math.PI / 2)); }
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; booster.add(mk(new THREE.BoxGeometry(1.2, 0.1, 0.9), tiles, Math.cos(a) * (R + 0.5), Math.sin(a) * (R + 0.5), 1.0, 0, 0, a)); }
  booster.userData.baseZ = 9.5;
  g.add(booster);
  const ship = new THREE.Group();
  ship.add(mk(new THREE.CylinderGeometry(R, R, 5.5, 18), steel, 0, 0, -2.25, Math.PI / 2));
  ship.add(mk(new THREE.CylinderGeometry(R + 0.02, R + 0.02, 5.5, 18, 1, false, Math.PI, Math.PI), tiles, 0, 0, -2.25, Math.PI / 2));   // heat-shield tiles down one side
  ship.add(mk(new THREE.ConeGeometry(R, 3, 18), steel, 0, 0, -6.5, -Math.PI / 2));
  ship.add(mk(new THREE.ConeGeometry(R + 0.02, 3, 18, 1, false, Math.PI, Math.PI), tiles, 0, 0, -6.5, -Math.PI / 2));
  for (const sx of [-1, 1]) {
    ship.add(mk(new THREE.BoxGeometry(1.3, 0.12, 1.2), tiles, sx * (R + 0.55), 0, -5.2));          // fore flaps
    ship.add(mk(new THREE.BoxGeometry(2.0, 0.14, 2.0), tiles, sx * (R + 0.9), 0, -0.6));           // aft flaps
  }
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; ship.add(mk(new THREE.ConeGeometry(0.22, 0.6, 6), grey, Math.cos(a) * 0.45, Math.sin(a) * 0.45, 0.75, Math.PI / 2)); }
  ship.add(mk(new THREE.CircleGeometry(0.3, 10), mats.glassM, 0, 0.7, -4.6, 0.6));
  ship.userData.baseZ = 0.5;
  g.add(ship);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4.0, 10), new THREE.MeshBasicMaterial({ color: 0xffb43a }));
  flame.rotation.x = -Math.PI / 2;
  flame.position.z = 11.2;
  g.add(flame);
  g.userData.flame = flame;
  const plumeLight = new THREE.PointLight(0xff9a3a, 0, 320, 1.6);
  plumeLight.position.z = 11.5;
  g.add(plumeLight);
  g.userData.plumeLight = plumeLight;
  const plasma = new THREE.Group();
  const plasmaMats = [];
  [[0.3, 1.9, 1.0, 0xffd27a], [-1.4, 2.3, 0.55, 0xff8a2a], [-3.6, 2.8, 0.32, 0xff6a1a], [-6.4, 3.4, 0.18, 0xff4a10]].forEach(([z, r, a, c]) => {
    const m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    m.userData.peak = a; plasmaMats.push(m);
    const sph = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), m);
    sph.position.z = z; sph.scale.set(1, 1, 1.5); plasma.add(sph);
  });
  plasma.visible = false;
  g.add(plasma);
  g.userData.rocket = { booster, stage2: ship, capsule: ship, fairing: [], flame, plasma, plasmaMats, starship: true };
  g.userData.halfLen = 9.6;
  rocketApplyStages(g);
}

// Show the parts that are still attached; put the flame under the live engine.
function rocketApplyStages(g) {
  const p = g.userData.rocket;
  if (!p) return;
  if (p.starship) {
    p.booster.visible = rk.stage === 0;
    p.flame.position.z = rk.stage === 0 ? 11.2 : 2.2;
    p.flame.scale.setScalar(rk.stage === 0 ? 1.5 : 0.9);
    return;
  }
  p.booster.visible = rk.stage === 0;
  p.fairing.forEach(f => { f.visible = rk.stage <= 1; });
  p.stage2.visible = rk.stage <= 2;
  const baseZ = rk.stage === 0 ? p.booster.userData.baseZ : rk.stage <= 2 ? p.stage2.userData.baseZ : p.capsule.userData.baseZ;
  p.flame.position.z = baseZ + (rk.stage === 0 ? 1.7 : rk.stage <= 2 ? 1.1 : 0.7);
  p.flame.scale.setScalar(rk.stage === 0 ? 1 : rk.stage <= 2 ? 0.6 : 0.35);
}

function rocketRestock() {
  rk.stage = 0;
  rk.fuel = rocketFullTanks();
  rk.satOut = false;             // a new satellite rides up with every new stack
  rk.refitT = 0;
  if (typeof roverReset === "function") roverReset();   // rocks and beacons come back fresh
  if (typeof astroReset === "function") astroReset();
  if (typeof cancelRecovery === "function") cancelRecovery();
  rk.reentry = 0;
  chuteReset();
  if (vehicleModel) rocketApplyStages(vehicleModel);
}
// Distance from the reference point down to the base of the lowest attached
// part (booster 7.5, second stage -0.2, capsule -3.55 -- negative means the
// base is above the reference), scaled. Used for ground contact and standing.
function rocketHalfLen() {
  const base = state.vp && state.vp.starship ? (rk.stage === 0 ? 9.5 : 0.5) : (rk.stage === 0 ? 7.5 : rk.stage <= 2 ? -0.2 : -3.55);
  return base * (state.vp.size || 1);
}
function rocketAlt() {
  return state.y - Math.max(terrainEff(state.x, state.z), TUNE.waterLevel);
}
// Which rocket: the Falcon stack has three drops (final stage 3, the capsule); Starship has one (final stage 1, the Ship).
function rocketFinalStage() { return state.vp && state.vp.starship ? 1 : 3; }
function rocketIsFinal() { return rk.stage >= rocketFinalStage(); }
// Which tank the live engine drinks from: Falcon booster / second stage (fairing on or off) / capsule; Starship booster / Ship.
function rocketTank() { if (state.vp && state.vp.starship) return rk.stage === 0 ? 0 : 1; return rk.stage === 0 ? 0 : rk.stage <= 2 ? 1 : 2; }
function rocketFullTanks() { return state.vp && state.vp.starship ? [RK.starship.fuel[0], Infinity, Infinity] : [RK.fuel[0], RK.fuel[1], Infinity]; }
function rocketNoseLen() { return (state.vp && state.vp.starship ? 7.5 : 6.2) * (state.vp.size || 1); }
function rocketNextDropAlt() {
  if (rk.stage >= rocketFinalStage()) return Infinity;
  return state.vp.starship ? RK.starship.stageAlt[rk.stage] : RK.stageAlt[rk.stage];
}
function rocketCanDrop() {
  return state.phase === "AIRBORNE" && !state.exploding && rk.stage < rocketFinalStage() && !rk.onBody && rocketAlt() >= rocketNextDropAlt();
}

// ---- falling stages
const fallingStages = [];
function dropStage() {
  if (!rocketCanDrop() || !vehicleModel) return false;
  const p = vehicleModel.userData.rocket;
  const parts = rk.stage === 0 ? [p.booster] : rk.stage === 1 ? p.fairing : [p.stage2];
  const kind = rk.stage === 0 ? "booster" : rk.stage === 1 ? "fairing" : "stage2";
  const size = state.vp.size || 1;
  vehicleModel.position.set(state.x, state.y, state.z);
  vehicleModel.rotation.set(state.pitch * DEG, state.heading, -state.bank * DEG);
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
      vx: rk.vx * 0.9 + sx * 6, vy: kind === "booster" ? Math.min(rk.vy * 0.9 - 4, 25) : rk.vy * 0.9 - 4, vz: rk.vz * 0.9 + sz * 6,
      rx: (rnd() - 0.5) * 1.2, ry: (rnd() - 0.5) * 1.2, life: kind === "booster" ? 60 : kind === "fairing" ? 150 : 30, landed: false,
      target: kind === "booster" ? boosterTargetFor(rk.vx, rk.vz) : null, t: 0,
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
    s.t += dt;
    let ground = Math.max(terrainEff(s.x, s.z), TUNE.waterLevel);
    if (s.target && s.target.barge && Math.abs(s.x - s.target.x) < 26 && Math.abs(s.z - s.target.z) < 44) ground = Math.max(ground, s.target.y);
    if (s.target && s.target.catch && Math.abs(s.x - s.target.x) < 6 && Math.abs(s.z - s.target.z) < 6) ground = Math.max(ground, s.target.y - (s.mesh.userData.baseZ || 7.6) * (state.vp.size || 1));   // the arms take it here
    const alt = s.y - ground;
    const [gx, gy, gz] = rocketGravityAt(s.x, s.y, s.z);   // Earth's pull fades out; the Moon and Mars pull their own
    s.vx += gx * dt; s.vy += gy * dt; s.vz += gz * dt;
    const inSpace = s.y > RK.gravityFade;
    if (s.kind === "booster") {
      // Falcon-style: boostback burn kills the inherited climb in the first
      // seconds, it flips upright, brakes near the ground and lands on its legs.
      if (s.life > 55 && s.vy > 0) s.vy *= 1 - Math.min(1, 1.6 * dt);
      s.mesh.quaternion.slerp(Q_UPRIGHT, Math.min(1, 1.5 * dt));
      if (s.target && s.life < 57 && !inSpace) {
        // grid fins: fly to the target (the droneship or the pad side), arriving over it
        const dx = s.target.x - s.x, dz = s.target.z - s.z, d = Math.hypot(dx, dz);
        const want = Math.min(60, d * 0.3);
        const tvx = d > 1 ? dx / d * want : 0, tvz = d > 1 ? dz / d * want : 0;
        s.vx += (tvx - s.vx) * Math.min(1, 1.5 * dt); s.vz += (tvz - s.vz) * Math.min(1, 1.5 * dt);
        if (d > 60 && alt < 180) { const hold = clamp((150 - alt) * 0.5, -6, 12); s.vy += (hold - s.vy) * Math.min(1, 3 * dt); }   // hover across until it is over the target
      } else { s.vx *= 1 - Math.min(1, 1.2 * dt); s.vz *= 1 - Math.min(1, 1.2 * dt); }
      if (!s.boomed && s.vy < -30 && alt < 700) { s.boomed = true; sonicBoom(); flags.sonicBooms = (flags.sonicBooms || 0) + 1; }
      if (s.vy < 0 && alt < 260) {
        const want = -Math.max(6, alt * 0.25);   // slow to ~6 m/s for touchdown
        s.vy += (want - s.vy) * Math.min(1, 3 * dt);
        for (const c of s.mesh.children) if (c.userData.leg) { c.rotation.set(0, 0, c.userData.a); c.position.x = Math.cos(c.userData.a) * (0.95 + 0.1 + 1.1 * clamp(1 - alt / 200, 0, 1)); c.position.y = Math.sin(c.userData.a) * (0.95 + 0.1 + 1.1 * clamp(1 - alt / 200, 0, 1)); }
      }
      const baseLen = (s.mesh.userData.baseZ || 7.6) * (state.vp.size || 1);
      if (alt <= baseLen) {
        s.landed = true; s.vx = s.vy = s.vz = 0;
        s.y = ground + baseLen;
        s.mesh.quaternion.copy(Q_UPRIGHT);
        s.mesh.position.set(s.x, s.y, s.z);
        boosterLand();
        flags.boosterLandings = (flags.boosterLandings || 0) + 1;
        if (s.target && s.target.barge && Math.abs(s.x - s.target.x) < 26 && Math.abs(s.z - s.target.z) < 44) { flags.bargeLandings = (flags.bargeLandings || 0) + 1; boatHorn(); }
        if (s.target && s.target.catch && Math.abs(s.x - s.target.x) < 6 && Math.abs(s.z - s.target.z) < 6) {
          // caught: the arms close on it and it hangs there
          const a = airports.find(r => r.idx === state.originIdx);
          if (a) a.catchClosed = true;
          clang(); flags.boosterCatches = (flags.boosterCatches || 0) + 1;
        }
        continue;
      }
    } else if (s.kind === "fairing" && s.t > 1.5 && s.y < RK.gravityFade) {
      // the halves pop small chutes and drift down to the net boat
      if (!s.canopy) {
        s.canopy = buildCanopy(2.2, 0xffd23e); s.canopy.position.y = 7; s.canopy.scale.setScalar(0.1);
        s.mesh.add(s.canopy); s.mesh.rotation.set(0, 0, 0); s.mesh.quaternion.identity();
        chutePop(false);
        flags.fairingChutes = (flags.fairingChutes || 0) + 1;
      }
      const pop = clamp((s.t - 1.5) / 0.8, 0.1, 1); s.canopy.scale.setScalar(pop);
      s.mesh.rotation.z = Math.sin(s.t * 1.7) * 0.15;
      const boat = fairingBoatFor();
      const bd = boat ? Math.hypot(boat.x - s.x, boat.z - s.z) : 0;
      let sink = -(9 + Math.max(0, alt - 60) * 0.06);   // quick when high, gentle at the boat
      if (bd > 30 && alt < 45) sink = clamp((35 - alt) * 0.4, -4, 8);   // hover across until it is over the boat
      s.vy += (sink - s.vy) * Math.min(1, 1.4 * dt);
      if (boat) {
        const dx = boat.x - s.x, dz = boat.z - s.z, d = bd;
        const want = Math.min(40, d * 0.25);
        s.vx += ((d > 1 ? dx / d * want : 0) - s.vx) * Math.min(1, 1.2 * dt); s.vz += ((d > 1 ? dz / d * want : 0) - s.vz) * Math.min(1, 1.2 * dt);
        if (alt <= 9 && d < 14) {   // into the net
          s.life = Math.min(s.life, 0.01);
          splashAt(boat.x, TUNE.waterLevel, boat.z, 1.2); rustle(); chirp();
          flags.fairingsCaught = (flags.fairingsCaught || 0) + 1;
        }
      }
      if (alt <= 2) { s.life = Math.min(s.life, 0.01); splashAt(s.x, TUNE.waterLevel, s.z, 1); }
    } else {
      s.mesh.rotation.x += s.rx * dt; s.mesh.rotation.y += s.ry * dt;
      if (alt <= 2) { s.life = Math.min(s.life, 0.01); }
    }
    s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
    s.mesh.position.set(s.x, s.y, s.z);
  }
}

// ---- gravity / atmosphere helpers
const gScratch = [0, 0, 0];
function rocketGravityAt(x, y, z) {
  // Earth pulls down, fading out above the atmosphere; a nearby body pulls toward itself.
  // (Returns a shared scratch array: read it before the next call.)
  let gx = 0, gy = -RK.gravity * clamp(1 - y / RK.gravityFade, 0, 1), gz = 0;
  for (const b of BODIES) {
    const dx = b.x - x, dy = b.y - y, dz = b.z - z;
    const d = Math.hypot(dx, dy, dz);
    if (d < b.r * 2.6) {
      const k = b.g * clamp(1 - (d - b.r) / (b.r * 1.6), 0, 1) / Math.max(d, 1);
      gx += dx * k; gy += dy * k; gz += dz * k;
    }
  }
  gScratch[0] = gx; gScratch[1] = gy; gScratch[2] = gz;
  return gScratch;
}
// Cached per frame and per position: it is asked for by the assist, the camera, the
// station and the landing check every frame (callers only read the result).
const nbCache = { body: null, dist: Infinity, frame: -1, x: NaN, y: NaN, z: NaN };
function rocketNearestBody() {
  if (nbCache.frame === frameCount && nbCache.x === state.x && nbCache.y === state.y && nbCache.z === state.z) return nbCache;
  let best = null, bd = Infinity;
  for (const b of BODIES) {
    const d = Math.hypot(b.x - state.x, b.y - state.y, b.z - state.z) - b.r;
    if (d < bd) { bd = d; best = b; }
  }
  nbCache.body = best; nbCache.dist = bd; nbCache.frame = frameCount; nbCache.x = state.x; nbCache.y = state.y; nbCache.z = state.z;
  return nbCache;
}

// ---- the flight model. Runs instead of the plane branch; the common tail of
// update() (camera, HUD, sky, rewards) follows.
// The go button: where it will take him (a destination's icon, the runway home, or the
// capsule seat while he is floating about the station).
function updateGoButton() {
  const out = astroActive() && astro.mode !== "leaving";
  el.skipBtn.classList.toggle("hidden", !(rocketCanSkip() || out));
  const tb = rocketSkipTarget(); const tname = out ? "capsule" : tb ? tb.name : "home";
  if (el.skipBtn.dataset.target !== tname) el.skipBtn.dataset.target = tname;
}
function updateRocket(dt) {
  const grounded = state.phase === "TAXI" || state.phase === "ROLL";
  const halfLen = rocketHalfLen();
  updateChuteVisual(dt);
  updatePad(dt, grounded);
  el.roverBtn.classList.toggle("hidden", !(roverCan() || roverActive()));
  el.hatchBtn.classList.toggle("hidden", !(stationCanEnter() || astroActive()));
  if (roverActive()) { updateRover(dt); rk.igniteT = 0; return; }   // driving: the capsule waits
  if (astroActive()) { updateGoButton(); updateAstronaut(dt); rk.igniteT = 0; updateStationDocked(dt, true); return; }   // floating inside: the capsule waits at the port

  // buttons: throttle always (hold to burn); the rocket has no missiles/speed steps/gear
  el.throttleBtn.classList.remove("hidden");
  el.rotateArrow.classList.remove("on");
  el.slowBtn.classList.add("hidden"); el.fastBtn.classList.add("hidden"); el.missileBtn.classList.add("hidden");
  el.gearBtn.classList.add("hidden");
  updateGoButton();
  el.stageBtn.classList.toggle("hidden", !rocketCanDrop());
  if (el.stageBtn.dataset.stage !== String(rk.stage)) el.stageBtn.dataset.stage = String(rk.stage);
  el.satBtn.classList.toggle("hidden", !rocketCanDeploySat());
  el.chuteBtn.classList.toggle("hidden", !rocketCanChute());

  if (grounded) {
    // sitting on the pad (or on a body): upright, still, restocked
    if (rk.onBody) {
      const b = rk.onBody;
      rkAxis.set(state.x - b.x, state.y - b.y, state.z - b.z).normalize();
      if (b.dock) {
        // docked nose-first: the nose tip sits on the port, the body points away from it
        rkTmp.copy(rkAxis).multiplyScalar(b.r + rocketNoseLen());
        state.x = b.x + rkTmp.x; state.y = b.y + rkTmp.y; state.z = b.z + rkTmp.z;
        state.pitch = Math.asin(clamp(-rkAxis.y, -1, 1)) / DEG;
        state.heading = Math.atan2(rkAxis.x, rkAxis.z);
        updateStationDocked(dt, true);
      } else {
        rkTmp.copy(rkAxis).multiplyScalar(b.r + halfLen);
        state.x = b.x + rkTmp.x; state.y = b.y + rkTmp.y; state.z = b.z + rkTmp.z;
        state.pitch = Math.asin(clamp(rkAxis.y, -1, 1)) / DEG;
        state.heading = Math.atan2(-rkAxis.x, -rkAxis.z);
      }
    } else {
      state.y = Math.max(rk.groundHere !== undefined ? rk.groundHere : -1e9, Math.max(terrainEff(state.x, state.z), TUNE.waterLevel)) + halfLen;
      state.pitch += (90 - state.pitch) * Math.min(1, 6 * dt);
    }
    state.bank = 0;
    rk.vx = rk.vy = rk.vz = 0;
    state.speed = 0;
    rumble = 0;
    setRolling(0);
    setEngine(0);   // never the propeller drone
    setReentryRoar(0);
    rk.reentry = Math.max(0, rk.reentry - dt * 2);
    reentryOverlay();
    // after an Earth landing the capsule (or whatever came down) sits where it
    // touched for a few seconds, then the pad rolls out a fresh stack
    if (recoveryActive()) { updateRecovery(dt); state.pitch = 90; forward.set(0, 1, 0); return; }
    if (rk.refitT > 0 && !rk.onBody && !state.throttleHeld) {
      rk.refitT -= dt;
      if (rk.refitT <= 0) rocketRefit();
    }
    if (state.throttleHeld && !menuOpen()) {   // never launch behind the destination cards
      rk.igniteT += dt;
      rumble = 0.03 + rk.igniteT * 0.02;
      setRocketEngine(0.35 + 0.65 * clamp(rk.igniteT / RK.igniteTime, 0, 1), 0);
      if (rk.igniteT >= RK.igniteTime) {
        state.phase = "AIRBORNE";
        state.liftoffTimer = 0;
        state.maxAglSinceLiftoff = 1e9;
        flags.liftoff++;
        rk.igniteT = 0;
        if (!rk.onBody) apronVehiclesTo(state.originIdx, false);
        rk.launchedFromBody = !!rk.onBody;
        if (rk.onBody && rk.onBody.dock) {
          // undock: turn away from the port and back off on the thrusters
          const b = rk.onBody;
          rkAxis.set(state.x - b.x, state.y - b.y, state.z - b.z).normalize();
          state.pitch = Math.asin(clamp(rkAxis.y, -1, 1)) / DEG;
          state.heading = Math.atan2(-rkAxis.x, -rkAxis.z);
          rk.vx = rkAxis.x * 8; rk.vy = rkAxis.y * 8; rk.vz = rkAxis.z * 8;
          flags.undocks = (flags.undocks || 0) + 1;
        }
        if (!rk.onBody) { rk.delugeT = 2.2; liftoffShockwave(); }
        rk.onBody = null;
        rk.refitT = 0;
        chuteReset();
        liftoffRoar();
        rumble = 0.05;
      }
    } else {
      rk.igniteT = 0;
      setRocketEngine(0, 0);
    }
    forward.set(0, 1, 0);
    return;
  }

  // ---- in flight
  const burning = state.throttleHeld && rk.fuel[rocketTank()] > 0;
  if (burning) rk.fuel[rocketTank()] -= dt;
  const thrust = burning ? (state.vp.starship ? RK.starship.thrust[Math.min(rk.stage, 1)] : RK.thrust[Math.min(rk.stage, 3)]) : 0;

  // attitude from the stick: up = nose up (toward vertical), down = pitch over; left/right = yaw
  if (state.touching) {
    const upSign = camUp.y < -0.2 ? -1 : 1;   // standing on a body's underside: screen-up is Earth-down
    state.pitch = clamp(state.pitch + state.ctrlPitch * upSign * RK.turnRateDeg * dt, -90, 90);
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
  rocketLandingAssist(dt, burning);
  const inAtmo = clamp(1 - state.y / RK.gravityFade, 0, 1);
  const capsuleAtmo = rocketIsFinal() && inAtmo > 0 && rocketNearestBody().dist > 600;
  let dragK = RK.drag * inAtmo + (capsuleAtmo ? RK.capsuleDrag * inAtmo : 0);
  rk.vx *= 1 - Math.min(1, dragK * dt); rk.vy *= 1 - Math.min(1, dragK * dt); rk.vz *= 1 - Math.min(1, dragK * dt);
  updateReentryAndChutes(dt, capsuleAtmo, burning);
  let sp = Math.hypot(rk.vx, rk.vy, rk.vz);
  if (sp > RK.maxSpeed) { const k = RK.maxSpeed / sp; rk.vx *= k; rk.vy *= k; rk.vz *= k; sp = RK.maxSpeed; }
  state.x += rk.vx * dt; state.y += rk.vy * dt; state.z += rk.vz * dt;
  state.speed = sp;
  state.airVy = null;
  // velocity direction for the shared systems (alarm prediction, wall push-out)
  if (sp > 0.5) forward.set(rk.vx / sp, rk.vy / sp, rk.vz / sp); else forward.copy(rkAxis);

  setEngine(0);
  setRocketEngine(burning ? 1 : 0, state.spaceF);
  rumble = burning ? 0.02 : 0;
  if (rk.reentry > 0.02) rumble = Math.max(rumble, 0.03 + rk.reentry * 0.09);
  setReentryRoar(rk.reentry);
  reentryOverlay();

  resolveSolidWalls(state.y - halfLen);
  if (state.exploding) return;

  // ---- touching a body
  const { body, dist } = rocketNearestBody();
  updateStationDocked(dt, false);
  const contact = body && body.dock ? rocketNoseLen() : halfLen;
  if (body && dist <= contact + 1) {
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
  // ---- touching the Earth (or a rooftop: solid tops are landable ground)
  let ground = Math.max(terrainEff(state.x, state.z), TUNE.waterLevel);
  forEachSolid(b => {
    if (isSolidHidden(b) || b.car !== undefined) return;
    if (Math.abs(state.x - b.x) < b.hw && Math.abs(state.z - b.z) < b.hd && state.y - halfLen <= b.y1 + 1.5 && state.y > b.y0) ground = Math.max(ground, b.y1);
  });
  rk.groundHere = ground;
  if (state.y - halfLen <= ground && rk.vy <= 0) {
    const upright = state.pitch > 40 || sp <= RK.landSpeed * 0.3 || rk.chute > 0;
    if (sp <= RK.landSpeed && upright) rocketLandOn(null);
    else rocketCrash(state.x, ground + 70, state.z);
  }
}

// Landing assist: near the Moon / Mars / the ground, and not burning away from
// it, the rocket brakes to a gentle descent and stands itself upright, so
// coasting in always ends in a landing. Burning hard straight into a surface
// is the only way to arrive fast.
function rocketLandingAssist(dt, burning) {
  if (rk.chute > 0 || rk.reentry > 0.3) return;   // the parachutes are the capsule's landing assist
  const { body, dist } = rocketNearestBody();
  let nx = 0, ny = 1, nz = 0, gap = Infinity;
  if (body && dist < (body.assistR || body.r * (RK.assistRange - 1))) {
    rkTmp.set(state.x - body.x, state.y - body.y, state.z - body.z).normalize();
    nx = rkTmp.x; ny = rkTmp.y; nz = rkTmp.z; gap = dist;
  } else if (!body || dist > body.r) {
    const agl = state.y - Math.max(terrainEff(state.x, state.z), TUNE.waterLevel);
    if (agl < RK.assistEarthAgl && state.y < RK.gravityFade) gap = agl;
  }
  if (!Number.isFinite(gap)) return;
  const inward = -(rk.vx * nx + rk.vy * ny + rk.vz * nz);   // speed toward the surface
  const awayBurn = burning && (rkAxis.x * nx + rkAxis.y * ny + rkAxis.z * nz) > 0.3;
  if (awayBurn || inward < -2) return;                      // leaving: no assist
  // target: descend at assistDescent, faster when high, no sideways drift
  const want = Math.max(RK.assistDescent, gap * 0.16);
  const k = Math.min(1, 2.5 * dt);
  const tvx = -nx * want, tvy = -ny * want, tvz = -nz * want;
  rk.vx += (tvx - rk.vx) * k; rk.vy += (tvy - rk.vy) * k; rk.vz += (tvz - rk.vz) * k;
  // stand up: attitude eases toward the surface normal unless he is steering
  if (!state.touching || Math.abs(state.ctrlPitch) < 0.15) {
    const f = body && body.dock ? -1 : 1;   // docking: nose toward the port
    const wantPitch = Math.asin(clamp(f * ny, -1, 1)) / DEG;
    const wantHeading = (Math.abs(nx) + Math.abs(nz)) < 1e-4 ? state.heading : Math.atan2(-f * nx, -f * nz);   // straight up: keep his heading
    state.pitch += (wantPitch - state.pitch) * Math.min(1, 2 * dt);
    state.heading += wrapPi(wantHeading - state.heading) * Math.min(1, 2 * dt);
  }
}

// Skip-to-landing, the rocket's version of the runway button: jump to a slow
// descent just above the nearest planet (in space) or the home pad (lower
// down), and let the landing assist bring it in.
function rocketSkipTarget() {
  if (state.y > TUNE.spaceAltitude + TUNE.spaceBlendBand && !rk.launchedFromBody) return BODIES.find(b => b.name === state.dest) || rocketNearestBody().body;
  return null;   // Earth: the pad he took off from (also after a planet visit -- the way home)
}
function rocketCanSkip() {
  if (state.phase !== "AIRBORNE" || state.exploding || rk.chute > 0) return false;   // under a chute the chute is the landing
  const body = rocketSkipTarget();
  if (body) return Math.hypot(body.x - state.x, body.y - state.y, body.z - state.z) - body.r > body.r * RK.assistRange;
  return rocketAlt() > RK.assistEarthAgl + 60;
}
function rocketSkipToLanding() {
  if (!rocketCanSkip()) return false;
  const body = rocketSkipTarget();
  if (body) {
    if (body.dock) rkTmp.set(0, 1, 0);   // the station: come down its ring line onto the port
    else rkTmp.set(state.x - body.x, state.y - body.y, state.z - body.z).normalize();
    const out = body.r + RK.skipOut;
    state.x = body.x + rkTmp.x * out; state.y = body.y + rkTmp.y * out; state.z = body.z + rkTmp.z * out;
    rk.vx = -rkTmp.x * 30; rk.vy = -rkTmp.y * 30; rk.vz = -rkTmp.z * 30;
    state.pitch = Math.asin(clamp(rkTmp.y, -1, 1)) / DEG;
    state.heading = Math.atan2(-rkTmp.x, -rkTmp.z);
  } else if (rocketIsFinal() && state.y > TUNE.spaceAltitude) {
    // deorbit: the capsule drops out of space above home, heat shield first, and rides
    // the plasma and the parachutes down (nothing to do but watch, or steer a little)
    // ... and comes down somewhere new each time -- a field or the sea around home, never
    // the runway or the pad (the refit brings the new stack to the pad afterwards)
    const site = rocketLandingSite();
    state.x = site.x; state.z = site.z; state.y = RK.deorbitAlt;
    rk.vx = 0; rk.vy = -150; rk.vz = 0;
    state.pitch = 90; state.heading = state.dirIdx === 0 ? 0 : Math.PI;
    flags.deorbits = (flags.deorbits || 0) + 1;
  } else {
    const pad = rocketPad(state.originIdx);
    state.x = pad.x; state.z = pad.z; state.y = pad.ground + 200;
    rk.vx = 0; rk.vy = -12; rk.vz = 0;
    state.pitch = 90; state.heading = state.dirIdx === 0 ? 0 : Math.PI;
  }
  state.bank = 0;
  state.throttleHeld = false;
  releaseThrottle();
  flags.rocketSkips = (flags.rocketSkips || 0) + 1;
  unlockAudio();
  return true;
}

function rocketLandingSite() {
  const pad = rocketPad(state.originIdx), ap = AIRPORTS[state.originIdx];
  for (let tries = 0; tries < 40; tries++) {
    const a = rnd() * Math.PI * 2, r = 500 + rnd() * 700;
    const x = Math.cos(a) * r, z = ap.cz + Math.sin(a) * r;
    if (Math.abs(x) < TUNE.runwayWidth / 2 + 120 && Math.abs(z - ap.cz) < TUNE.runwayLength / 2 + 300) continue;   // the runway strip
    if (Math.hypot(x - pad.x, z - pad.z) < 160) continue;
    let clear = true;
    forEachSolid(b => { if (Math.abs(x - b.x) < b.hw + 30 && Math.abs(z - b.z) < b.hd + 30) clear = false; });
    if (clear) return { x, z };
  }
  return { x: pad.x + 400, z: pad.z };
}
function rocketLandOn(body) {
  rk.onBody = body;
  rk.vx = rk.vy = rk.vz = 0;
  state.speed = 0;
  state.phase = "TAXI";
  state.throttleHeld = false;
  releaseThrottle();
  // Only the home pad rolls out a new rocket, and only after a few seconds sitting
  // where you came down. On the Moon or Mars you stay whatever you arrived as -- a
  // capsule lands as a capsule and lifts off again on its thrusters.
  if (body) rk.fuel = rocketFullTanks();   // every landing or docking refuels: nothing is ever stuck out there
  if (body && body.dock) {
    flags.stationDockings = (flags.stationDockings || 0) + 1;
    clang(); chime(); confettiBurst();
    if (dockRings && dockRings.every(r => r.lit)) {   // the whole ring line: the finale
      fanfare(); for (let i = 0; i < 5; i++) fireworkSound(0.3 + i * 0.4);
      flags.dockPerfect = (flags.dockPerfect || 0) + 1;
    }
    dockRingsReset();
  } else if (body) {
    flags[body.name + "Landings"] = (flags[body.name + "Landings"] || 0) + 1;
    confettiBurst(); cheer();
    for (let i = 0; i < 6; i++) fireworkSound(i * 0.5);
  } else {
    rk.refitT = RK.refitDelay;
    flags.rocketLandings = (flags.rocketLandings || 0) + 1;
    if (rk.chute > 0) {
      // the float-down finished: the whole show
      flags.chuteLandings = (flags.chuteLandings || 0) + 1;
      const overWater = terrainEff(state.x, state.z) < TUNE.waterLevel - 0.2;
      if (overWater) { splash(); if (typeof splashAt === "function") splashAt(state.x, TUNE.waterLevel, state.z, true); } else touchdownFx();
      confettiBurst(); cheer();
      for (let i = 0; i < 4; i++) fireworkSound(0.4 + i * 0.5);
      chuteCollapse();
      rk.refitT = 0;
      startRecovery();   // the ship or the truck comes for it; the ride is the refit
    } else {
      chirp(); touchdownFx();
    }
  }
}
function rocketCrash(sx, sy, sz) {
  // reassemble beside anything solid at that spot so the assist lands next to it, not back onto it
  forEachSolid(b => {
    if (Math.abs(sx - b.x) < b.hw + 8 && Math.abs(sz - b.z) < b.hd + 8) { sx = b.x + (sx >= b.x ? 1 : -1) * (b.hw + 30); sz = b.z + (sz >= b.z ? 1 : -1) * (b.hd + 30); }
  });
  state.exploding = true;
  state.explodeTimer = TUNE.reassembleDelay;
  safePos.x = sx; safePos.y = sy; safePos.z = sz;
  rk.reentry = 0; reentryOverlay(); setReentryRoar(0); chuteReset();
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
// The pad rolls out a fresh stack (same as picking the rocket again), with a chime.
function rocketRefit() {
  rk.refitT = 0;
  spawnForTakeoff(state.originIdx, state.dirIdx);
  el.screenDest.classList.remove("hiddenS");   // a fresh stack: pick the next destination
  if (typeof keys !== "undefined") keys.clear();
  chime(); stageSep();
  flags.refits = (flags.refits || 0) + 1;
}
// Camera for the rocket: cockpit looks along the body axis; chase sits behind and a little below.
const camUp = new THREE.Vector3(0, 1, 0);
const camQ = new THREE.Quaternion(), camQi = new THREE.Quaternion();
function rocketCamera(dt) {
  const pr = state.pitch * DEG, hr = state.heading, cp = Math.cos(pr);
  rkAxis.set(-Math.sin(hr) * cp, Math.sin(pr), -Math.cos(hr) * cp);
  const sh = shakeAmp + rumble;
  // near the Moon or Mars, "up" is away from its centre so its surface reads as the ground
  const nb = rocketNearestBody();
  camUp.set(0, 1, 0);
  if (nb.body && !nb.body.dock && nb.dist < nb.body.r * 1.2) {
    rkTmp.set(state.x - nb.body.x, state.y - nb.body.y, state.z - nb.body.z).normalize();
    const k = clamp(1 - nb.dist / (nb.body.r * 1.2), 0, 1);
    // slerp Earth-up toward the surface normal (a vector lerp passes through zero on undersides)
    camQ.setFromUnitVectors(camUp, rkTmp);
    camQi.identity();
    camQi.slerp(camQ, k);
    camUp.applyQuaternion(camQi).normalize();
  }
  camera.up.copy(camUp);
  if (state.viewChase) {
    const fx = -Math.sin(hr), fz = -Math.cos(hr);
    // beside/behind the rocket, a little toward its nose, and lifted along "up"
    camDesired.set(state.x - fx * 34 + rkAxis.x * 4 + camUp.x * 8, state.y + rkAxis.y * 4 + camUp.y * 8, state.z - fz * 34 + rkAxis.z * 4 + camUp.z * 8);
    // never inside the Moon / Mars (a camera inside a sphere sees nothing) or under the ground
    for (const b of BODIES) {
      rkTmp.set(camDesired.x - b.x, camDesired.y - b.y, camDesired.z - b.z);
      const d = rkTmp.length();
      if (d < b.r + 6) { rkTmp.multiplyScalar((b.r + 6) / Math.max(d, 0.001)); camDesired.set(b.x + rkTmp.x, b.y + rkTmp.y, b.z + rkTmp.z); }
    }
    const camGround = Math.max(terrainEff(camDesired.x, camDesired.z), TUNE.waterLevel) + 2.5;
    if (camDesired.y < camGround && state.y < RK.gravityFade) camDesired.y = camGround;
    if (rk.chute > 0) { camDesired.x -= fx * 14; camDesired.z -= fz * 14; camDesired.y += 6; }   // step back to fit the canopies
    camera.position.lerp(camDesired, Math.min(1, 4 * dt));
    const la = rk.chute > 0 ? 12 : 4;
    lookV.set(state.x + rkAxis.x * la, state.y + rkAxis.y * la, state.z + rkAxis.z * la);
    camera.lookAt(lookV);
  } else {
    camera.position.set(state.x + rkAxis.x * (rocketHalfLen() - 1.5), state.y + rkAxis.y * (rocketHalfLen() - 1.5), state.z + rkAxis.z * (rocketHalfLen() - 1.5));
    // through reentry the view leans toward the horizon so the Earth's curve rolls under the glow
    const lean = rk.reentry * 2.0, cl = Math.cos(lean), sl = Math.sin(lean), fx = -Math.sin(hr), fz = -Math.cos(hr);
    lookV.set(camera.position.x + (rkAxis.x * cl + fx * sl) * 100, camera.position.y + rkAxis.y * cl * 100, camera.position.z + (rkAxis.z * cl + fz * sl) * 100);
    camera.lookAt(lookV);
    camera.rotateZ(-state.bank * DEG);
  }
  camera.position.x += (Math.random() - 0.5) * 9 * sh;
  camera.position.y += (Math.random() - 0.5) * 7 * sh;
  camera.position.z += (Math.random() - 0.5) * 9 * sh;
}


// ---- the pad: the strongback stands against the rocket while it waits and swings
// back at ignition (SpaceX lowers it minutes before launch); the water deluge steams
// out of the flame trench through ignition and liftoff.
function updatePad(dt, grounded) {
  const a = airports.find(r => r.idx === state.originIdx);
  if (!a || !a.strongback) return;
  const onPad = grounded && !rk.onBody && Math.hypot(state.x - a.padX, state.z - a.padZ) < 20;
  const want = onPad && rk.igniteT < 0.25 && !(rk.delugeT > 0) ? 0 : -0.55;
  a.strongback.rotation.x += (want - a.strongback.rotation.x) * Math.min(1, 1.6 * dt);
  // countdown: the pad lights strobe faster and faster through the ignite hold
  if (a.padLightMat) {
    let hex = 0xfff2b0;
    if (onPad && rk.igniteT > 0) { const rate = 3 + rk.igniteT * 9; hex = (Math.floor(rk.igniteT * rate) % 2) ? 0xffffff : 0x5a4a18; }
    if (a.padLightMat.color.getHex() !== hex) a.padLightMat.color.setHex(hex);
  }
  updateShockwave(dt);
  if (a.catchArms) {
    if (rk.delugeT > 0) a.catchClosed = false;   // a launch: let go for the next one
    const wantA = a.catchClosed ? 0.08 : 0.55;
    for (const [i, arm] of a.catchArms.entries()) { const sgn = i === 0 ? 1 : -1; arm.rotation.y += (sgn * wantA - arm.rotation.y) * Math.min(1, 1.8 * dt); }
  }
  const steaming = (onPad && rk.igniteT > 0.4) || (rk.delugeT || 0) > 0;
  if (rk.delugeT > 0) rk.delugeT -= dt;
  if (steaming) {
    const gy = AIRPORTS[state.originIdx].elev + 1;
    for (let i = 0; i < 2; i++) wakePuff(a.padX + (rnd() - 0.5) * 18, gy, a.padZ + 6 + rnd() * 40, 0xffffff, 2.6, 7, 1.6);
  }
}

// ---- T-0: a white flash and a ring racing out across the pad
let shockwave = null;
function liftoffShockwave() {
  if (!shockwave) {
    shockwave = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40), new THREE.MeshBasicMaterial({ color: 0xfff4d6, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    shockwave.rotation.x = -Math.PI / 2;
    scene.add(shockwave);
  }
  shockwave.position.set(state.x, Math.max(terrainEff(state.x, state.z), TUNE.waterLevel) + 1.5, state.z);
  shockwave.userData.t = 0;
  shockwave.visible = true;
  el.flash.classList.add("on");
  setTimeout(() => el.flash.classList.remove("on"), 110);
  deepPop();
  flags.shockwaves = (flags.shockwaves || 0) + 1;
}
function updateShockwave(dt) {
  if (!shockwave || !shockwave.visible) return;
  const t = (shockwave.userData.t += dt);
  if (t > 1.4) { shockwave.visible = false; return; }
  const r = 6 + t * 150;
  shockwave.scale.set(r, r, 1);
  shockwave.material.opacity = 0.8 * (1 - t / 1.4);
}

// ===========================================================================
// The way home, Dragon style: deploy the satellite up in space, deorbit, glow
// through the air heat-shield first, drogue, mains, float down, refit.
// ===========================================================================

// ---- the satellite. Rides up inside the capsule; pops out ahead of the nose,
// unfolds its panels and drifts off blinking. A new one comes with every stack.
const satellites = [];
function buildSatellite() {
  const g = new THREE.Group();
  const gold = new THREE.MeshLambertMaterial({ color: 0xd4a72c, emissive: 0x3a2a08 });
  const blue = new THREE.MeshLambertMaterial({ color: 0x2b4fb0, emissive: 0x0d1a44, side: THREE.DoubleSide });
  const grey = new THREE.MeshLambertMaterial({ color: 0xb8bec8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.6), gold); g.add(body);
  const dish = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.35, 12, 1, true), grey);
  dish.position.set(0, 0.85, 0); dish.rotation.x = Math.PI; g.add(dish);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), grey); mast.position.set(0, -1.1, 0); g.add(mast);
  const panels = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.x = s * 0.6;
    const p = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.06, 1.2), blue); p.position.x = s * 1.7;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 0.08), grey); rib.position.x = s * 1.7;
    pivot.add(p); pivot.add(rib); pivot.scale.x = 0.03; g.add(pivot); panels.push(pivot);
  }
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
  lamp.position.set(0, 0.7, 0.85); g.add(lamp);
  g.userData = { panels, lamp };
  return g;
}
function rocketCanDeploySat() {
  return state.phase === "AIRBORNE" && !state.exploding && rocketIsFinal() && !rk.satOut && !rk.onBody && rk.chute === 0 &&
    (state.spaceF > 0.8 || rocketAlt() > RK.satAlt);
}
function deploySatellite() {
  if (!rocketCanDeploySat()) return false;
  const g = buildSatellite();
  const vs = state.vp.size || 1;
  g.scale.setScalar(vs);
  g.position.set(state.x + rkAxis.x * 7 * vs, state.y + rkAxis.y * 7 * vs, state.z + rkAxis.z * 7 * vs);
  scene.add(g);
  // push out along the nose with a little sideways nudge so it clears the window
  const side = Math.cos(state.heading), sidez = -Math.sin(state.heading);
  satellites.push({
    mesh: g, t: 0,
    x: g.position.x, y: g.position.y, z: g.position.z,
    vx: rk.vx + rkAxis.x * 3 + side * 0.8, vy: rk.vy + rkAxis.y * 3, vz: rk.vz + rkAxis.z * 3 + sidez * 0.8,
    rx: 0.15, ry: 0.25,
  });
  while (satellites.length > 10) { const old = satellites.shift(); scene.remove(old.mesh); }
  rk.satOut = true;
  rk.stackLeft = 5; rk.stackT = 0.9;   // ... then five flat ones follow, one by one
  stageSep(); satBeep();
  flags.satDeploys = (flags.satDeploys || 0) + 1;
  return true;
}
function buildFlatSat() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.22, 1.5), new THREE.MeshLambertMaterial({ color: 0x1e2a44, emissive: 0x0a1020 })); g.add(body);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 4.2), new THREE.MeshLambertMaterial({ color: 0x2b4fb0, emissive: 0x0d1a44 })); panel.position.set(0, 0.2, 0); g.add(panel);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), new THREE.MeshBasicMaterial({ color: 0x5ff1ff })); lamp.position.set(1.2, 0.3, 0); g.add(lamp);
  g.userData = { panels: [], lamp, flat: true };
  return g;
}
function deployStackPiece(k) {
  const g = buildFlatSat();
  const vs = state.vp.size || 1;
  g.scale.setScalar(vs);
  g.position.set(state.x + rkAxis.x * 5 * vs, state.y + rkAxis.y * 5 * vs, state.z + rkAxis.z * 5 * vs);
  scene.add(g);
  const side = Math.cos(state.heading), sidez = -Math.sin(state.heading), fan = (k - 2) * 0.9;
  satellites.push({ mesh: g, t: 0, x: g.position.x, y: g.position.y, z: g.position.z,
    vx: rk.vx + rkAxis.x * 2.5 + side * fan, vy: rk.vy + rkAxis.y * 2.5 + 0.3 * k, vz: rk.vz + rkAxis.z * 2.5 + sidez * fan, rx: 0.08, ry: 0.4 });
  while (satellites.length > 10) { const old = satellites.shift(); scene.remove(old.mesh); }
  synthBlip("sine", 1500 + k * 120, 1500 + k * 120, 0.1, 0.18, 0);
  flags.satDeploys = (flags.satDeploys || 0) + 1;
}
function updateSatellites(dt) {
  if (rk.stackLeft > 0) {
    if (state.exploding || !rocketIsFinal()) rk.stackLeft = 0;
    else if (state.phase === "AIRBORNE") { rk.stackT -= dt; if (rk.stackT <= 0) { rk.stackT = 0.9; rk.stackLeft--; deployStackPiece(4 - rk.stackLeft); } }   // (waits while landed)
  }
  for (const s of satellites) {
    s.t += dt;
    const [gx, gy, gz] = rocketGravityAt(s.x, s.y, s.z);
    s.vx += gx * dt * 0.2; s.vy += gy * dt * 0.2; s.vz += gz * dt * 0.2;   // a whisper of gravity: it hangs up there
    s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
    s.mesh.position.set(s.x, s.y, s.z);
    s.mesh.rotation.x += s.rx * dt; s.mesh.rotation.y += s.ry * dt;
    const unfold = clamp((s.t - 0.8) / 2.5, 0, 1);
    const k = 0.03 + 0.97 * (1 - Math.pow(1 - unfold, 3));
    for (const p of s.mesh.userData.panels) p.scale.x = k;
    s.mesh.userData.lamp.visible = (s.t % 1.2) < 0.15;
  }
}

// ---- the docking rings: three glowing hoops stacked above the port. Fly down through
// them for rising notes; dock with all three lit and the station throws a party.
let dockRings = null;
function buildDockRings() {
  const b = BODIES[2];
  dockRings = [];
  [170, 115, 60].forEach((h, i) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(9, 0.9, 8, 28), new THREE.MeshBasicMaterial({ color: 0x5ff1ff, transparent: true, opacity: 0.55 }));
    m.rotation.x = Math.PI / 2;
    m.position.set(b.x, b.y + h, b.z);
    m.visible = false;
    scene.add(m);
    dockRings.push({ mesh: m, x: b.x, y: b.y + h, z: b.z, lit: false, i });
  });
}
function dockRingsReset() { if (dockRings) for (const r of dockRings) { r.lit = false; r.mesh.material.opacity = 0.55; r.mesh.material.color.setHex(0x5ff1ff); } }
function updateDockRings(dt) {
  if (!dockRings) buildDockRings();
  const show = state.spaceF > 0.5 && rocketIsFinal() && !rk.onBody;
  for (const r of dockRings) {
    r.mesh.visible = show;
    if (!show) continue;
    r.mesh.rotation.z += dt * (r.lit ? 2.5 : 0.6);
    if (!r.lit && Math.hypot(state.x - r.x, state.z - r.z) < 9 && Math.abs(state.y - r.y) < 6) {
      r.lit = true; r.mesh.material.opacity = 1; r.mesh.material.color.setHex(0x7cff5a);
      ringNote(4 + r.i * 2);
      flags.dockRings = (flags.dockRings || 0) + 1;
    }
  }
}
// ---- the station: the port glows as the capsule closes in; docked, the windows
// light up and the solar arrays unfold (and stay out).
function updateStationDocked(dt, docked) {
  const u = station.userData;
  if (!u || !u.portMat) return;
  if (!docked) updateDockRings(dt);
  const b = BODIES[2];
  const d = Math.hypot(b.x - state.x, b.y - state.y, b.z - state.z);
  const near = clamp(1 - d / 160, 0, 1);
  const pulse = 0.35 + near * 0.65 * (0.6 + 0.4 * Math.sin(frameCount * 0.25));
  if (Math.abs(u.portMat.opacity - pulse) > 0.02) u.portMat.opacity = pulse;
  if (docked) {
    if (dockRings) for (const r of dockRings) r.mesh.visible = false;
    u.lightMat.color.setHex(0xfff2b0);
    for (const p of u.panels) p.scale.x += (1 - p.scale.x) * Math.min(1, 1.2 * dt);
  }
}

// ---- the parachutes. Live in the scene (not on the model) so the cockpit view,
// looking up along the nose, sees the canopies overhead.
let chuteGroup = null, chuteParts = null, chuteCollapseT = 0;
function buildCanopy(r, red) {
  // eight gores, white and red in turn; lit from inside too (he looks up at them from the window)
  const g = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({ color: 0xf4f6f8, emissive: 0x8e9297, side: THREE.DoubleSide });
  const stripe = new THREE.MeshLambertMaterial({ color: red, emissive: 0x7a2420, side: THREE.DoubleSide });
  for (let k = 0; k < 8; k++) g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 4, 8, k * Math.PI / 4, Math.PI / 4, 0, Math.PI / 2), k % 2 ? stripe : white));
  return g;
}
function buildChutes() {
  chuteGroup = new THREE.Group();
  const vs = state.vp.size || 1;
  const lineMat = new THREE.LineBasicMaterial({ color: 0xe8ecf2 });
  const mk = (r, h, ox, oz, red) => {
    const c = new THREE.Group();
    const canopy = buildCanopy(r, red); canopy.position.set(ox, h, oz); c.add(canopy);
    const pts = [];
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; pts.push(new THREE.Vector3(0, 0, 0), new THREE.Vector3(ox + Math.cos(a) * r * 0.95, h, oz + Math.sin(a) * r * 0.95)); }
    c.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    c.scale.setScalar(vs);
    return c;
  };
  const drogue = mk(1.5, 9, 0, 0, 0xe0483e);
  const mains = new THREE.Group();
  [[0, -4.5], [3.9, 2.2], [-3.9, 2.2]].forEach(([ox, oz]) => mains.add(mk(4.4, 17, ox, oz, 0xe0483e)));
  chuteGroup.add(drogue); chuteGroup.add(mains);
  chuteGroup.visible = false;
  scene.add(chuteGroup);
  chuteParts = { drogue, mains };
}
function rocketCanChute() {
  if (state.phase !== "AIRBORNE" || state.exploding || !rocketIsFinal() || rk.onBody || rk.chute >= 2 || state.vp.starship) return false;
  if (state.y > RK.gravityFade || rk.vy > -1 || rocketNearestBody().dist < 600) return false;
  return rocketAlt() < RK.chuteAlt[rk.chute];
}
function deployChute() {
  if (!rocketCanChute()) return false;
  if (!chuteGroup) buildChutes();
  rk.chute++; rk.chuteT = 0; chuteCollapseT = 0;
  chutePop(rk.chute === 2);
  flags.chuteDeploys = (flags.chuteDeploys || 0) + 1;
  return true;
}
function chuteReset() { rk.chute = 0; rk.chuteT = 0; chuteCollapseT = 0; if (chuteGroup) chuteGroup.visible = false; }
function chuteCollapse() { chuteCollapseT = 1.2; }
function updateReentryAndChutes(dt, capsuleAtmo, burning) {
  // plasma: the bare capsule, fast, down in the air
  const sp = Math.hypot(rk.vx, rk.vy, rk.vz);
  const plasma = capsuleAtmo && !burning && rk.vy < 0 && state.y < RK.reentryAlt && sp > RK.reentrySpeed;
  const want = plasma ? clamp((sp - RK.reentrySpeed) / 120, 0.35, 1) : 0;
  rk.reentry += (want - rk.reentry) * Math.min(1, (plasma ? 2.5 : 1.2) * dt);
  if (rk.reentry < 0.02 && !plasma) rk.reentry = 0;
  const glowing = rk.reentry > 0.3;
  if (glowing && !rk.glowing) flags.reentries = (flags.reentries || 0) + 1;
  rk.glowing = glowing;
  // heat shield first (base down): the capsule trims itself upright while glowing or under a chute
  if (plasma || rk.chute > 0) {
    const steering = state.touching && Math.abs(state.ctrlPitch) > 0.15 && rk.chute === 0;
    if (!steering) state.pitch += (90 - state.pitch) * Math.min(1, 2.5 * dt);
  }
  // chutes: pop by themselves low down, ease the fall to the sink rate, a little steering
  if (rocketCanChute() && rocketAlt() < RK.chuteAutoAlt[rk.chute]) deployChute();
  if (rk.chute > 0) {
    rk.chuteT += dt;
    const k = Math.min(1, (rk.chute === 2 ? 2.2 : 1.1) * dt);
    const hr = state.heading, fx = -Math.sin(hr), fz = -Math.cos(hr), rx = Math.cos(hr), rz = -Math.sin(hr);
    const drift = state.touching ? RK.chuteDrift : 0;
    const tvx = (fx * state.ctrlPitch + rx * state.ctrlBank) * drift, tvz = (fz * state.ctrlPitch + rz * state.ctrlBank) * drift;
    rk.vx += (tvx - rk.vx) * k; rk.vz += (tvz - rk.vz) * k;
    rk.vy += (-RK.chuteSink[rk.chute - 1] - rk.vy) * k;
    state.bank = Math.sin(rk.chuteT * 1.3) * 5;
  }
}
function updateChuteVisual(dt) {
  if (!chuteGroup) return;
  const show = rk.chute > 0 && !state.exploding;
  chuteGroup.visible = show;
  if (!show) return;
  // the risers gather at the capsule's nose tip (model z -6.2 from the reference point), along the body axis
  const vs0 = state.vp.size || 1;
  const nl = rocketNoseLen() - 0.2 * vs0;
  chuteGroup.position.set(state.x + rkAxis.x * nl, state.y + rkAxis.y * nl, state.z + rkAxis.z * nl);
  chuteGroup.rotation.set(0, state.heading, state.bank * DEG * 0.5);
  const pop = Math.min(1, rk.chuteT / 0.9);
  let s = clamp(pop < 1 ? 0.15 + 0.85 * (1 - Math.pow(1 - pop, 3)) * (1 + 0.12 * Math.sin(pop * Math.PI)) : 1, 0.05, 1.12);
  let sy = s;
  if (chuteCollapseT > 0) { chuteCollapseT -= dt; sy = Math.max(0.02, chuteCollapseT / 1.2); if (chuteCollapseT <= 0) { chuteReset(); return; } }
  chuteParts.drogue.visible = rk.chute === 1;
  chuteParts.mains.visible = rk.chute === 2;
  const vs = state.vp.size || 1;
  (rk.chute === 1 ? chuteParts.drogue : chuteParts.mains).scale.set(vs * s, vs * sy, vs * s);
}
// The glow the pilot sees: the plasma sheath on the model in the chase view, and a
// hot orange vignette over the window in both views.
let reentryShown = -1;
function reentryOverlay() {
  const r = rk.reentry;
  const o = r < 0.02 ? 0 : (state.viewChase ? 0.45 : 0.95) * r;
  if (Math.abs(o - reentryShown) > 0.01) { reentryShown = o; el.reentryGlow.style.opacity = o.toFixed(2); }
  if (vehicleModel && vehicleModel.userData.rocket && vehicleModel.userData.rocket.plasma) {
    const p = vehicleModel.userData.rocket;
    p.plasma.visible = r > 0.02;
    if (p.plasma.visible) { const flick = 0.85 + Math.random() * 0.3; for (const m of p.plasmaMats) m.opacity = m.userData.peak * r * flick; }
  }
}
