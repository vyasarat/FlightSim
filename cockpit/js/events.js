"use strict";
// ---------------------------------------------------------------------------
// Space events. Every rocket launch the game secretly draws ONE of six events
// -- never the same one twice in a row -- and stages it in its phase of flight:
//
//   race       ascent    a second rocket launches beside him and climbs along
//   meteors    orbit     glowing rocks streak past, close enough to shoot
//   comet      orbit     one enormous comet; fly through the tail for glitter
//   impacts    Moon      meteors thump down around the rover, leaving craters
//   escort     reentry   a spread of meteors burns up alongside the capsule
//   fireworks  recovery  a barrage over the landing site, reflections included
//
// Events are huge, loud and self-announcing: there is nothing on the HUD that
// points at one. None of them is ever required, none of them blocks, and none
// of them can be lost -- ignored, an event simply does not happen this flight.
// Only machines and rocks are ever burst.
//
// Everything an event puts in the world lives under `evGroup` (plus the two
// models that are built once and reused), so a pad spawn clears the lot.
// ---------------------------------------------------------------------------

const EV = TUNE.events;
const EVENT_KINDS = ["race", "meteors", "comet", "impacts", "escort", "fireworks"];

const evGroup = new THREE.Group();
scene.add(evGroup);

const ev = {
  kind: null,        // what this launch drew (null: no event this flight)
  prev: null,        // the previous draw -- never drawn twice in a row
  dest: null,        // the destination the draw assumed
  armed: false,      // a real liftoff has happened: the event may stage
  started: false,
  done: false,
  t: 0,              // seconds since it started staging
  spawnT: 0,
  n: 0,              // how many pieces it has spawned so far
  props: [],         // meteors, chunks, impactors, streaks, debris
  craters: [],
  fw: [],            // queued firework shells
  race: null,
  comet: null,
  coat: null,
  landings: 0,       // watches flags.rocketLandings for the recovery barrage
  wet: false, base: 0,   // where the recovery barrage bursts, and whether it reflects
};

try {
  const s = localStorage.getItem("lp.lastEvent");
  if (EVENT_KINDS.indexOf(s) >= 0) ev.prev = s;   // anything else (corrupt, renamed) is ignored silently
} catch (err) {}

// ---- shared geometry / materials: an event spawns Meshes, never new buffers
const evRockGeo = new THREE.IcosahedronGeometry(1, 0);
const evSpeckGeo = new THREE.SphereGeometry(0.16, 5, 4);
const evRingGeo = new THREE.TorusGeometry(1, 0.16, 6, 18);
const evDiscGeo = new THREE.CircleGeometry(1, 20);
const evRockMat = new THREE.MeshLambertMaterial({ color: 0xffb45a, emissive: 0xff7a1a, emissiveIntensity: 0.9 });
const evChunkMat = new THREE.MeshLambertMaterial({ color: 0xffd9a0, emissive: 0xffa040, emissiveIntensity: 0.8 });
const evFireMat = new THREE.MeshBasicMaterial({ color: 0xffc86a });
const evSpeckMat = new THREE.MeshBasicMaterial({ color: 0xfff2a8 });

// Sparks: trails and bursts. Their own pool with unlit materials -- the shared
// wake puffs are Lambert-shaded, which in the dark of space renders them brown.
// They shrink away instead of fading, so one material can serve them all.
// 0..EV_FW0-1 are trail and burst colours; from EV_FW0 on they are firework
// colours, saturated enough to read against a bright daytime sky.
const EV_SPARK_MATS = [0xffd23e, 0xffffff, 0xff9a3a, 0xfff2a8, 0x9fe6ff,
                       0xff3b6b, 0xffd23e, 0x36c46a, 0x3aa0ff, 0xff7ab8].map(c => new THREE.MeshBasicMaterial({ color: c, fog: false }));
const EV_FW0 = 5;
const evSparks = [];
for (let i = 0; i < 130; i++) {
  const m = new THREE.Mesh(evSpeckGeo, EV_SPARK_MATS[0]);
  m.visible = false;
  scene.add(m);
  evSparks.push({ mesh: m, life: 0, max: 1, size: 1, vx: 0, vy: 0, vz: 0 });
}
let evSparkNext = 0;
function evSpark(x, y, z, ci, size, life, vx, vy, vz) {
  const s = evSparks[evSparkNext++ % evSparks.length];
  s.life = s.max = life; s.size = size;
  s.vx = vx || 0; s.vy = vy || 0; s.vz = vz || 0;
  s.mesh.material = EV_SPARK_MATS[((ci % EV_SPARK_MATS.length) + EV_SPARK_MATS.length) % EV_SPARK_MATS.length];
  s.mesh.position.set(x, y, z);
  s.mesh.scale.setScalar(size);
  s.mesh.visible = true;
}
function evSparksUpdate(dt) {
  for (const s of evSparks) {
    if (s.life <= 0) continue;
    s.life -= dt;
    if (s.life <= 0) { s.mesh.visible = false; continue; }
    s.mesh.position.x += s.vx * dt; s.mesh.position.y += s.vy * dt; s.mesh.position.z += s.vz * dt;
    s.mesh.scale.setScalar(s.size * (s.life / s.max));
  }
}
function evSparksClear() { for (const s of evSparks) { s.life = 0; s.mesh.visible = false; } }
function evSparksAlive() { let n = 0; for (const s of evSparks) if (s.life > 0) n++; return n; }

function evAdd(mesh) { evGroup.add(mesh); return mesh; }
function evDrop(mesh) {
  if (!mesh) return;
  evGroup.remove(mesh);
  mesh.traverse(o => {
    if (o.userData.ownMat && o.material) o.material.dispose();
    if (o.userData.ownGeo && o.geometry) o.geometry.dispose();
  });
}

// ---------------------------------------------------------------------------
// the draw
// ---------------------------------------------------------------------------
function eventValid(kind) {
  if (kind === "impacts") return state.dest === "moon";   // a Mars or station flight never draws the Moon's impacts
  return true;
}
function eventsDraw() {
  ev.kind = null;
  ev.dest = state.dest;
  if (!(state.vp && state.vp.rocket)) return null;
  if (rnd() >= EV.eventChance) return null;
  let pool = EVENT_KINDS.filter(k => k !== ev.prev && eventValid(k));
  if (!pool.length) pool = EVENT_KINDS.filter(eventValid);
  if (!pool.length) return null;
  ev.kind = pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))];
  ev.prev = ev.kind;
  try { localStorage.setItem("lp.lastEvent", ev.kind); } catch (err) {}
  return ev.kind;
}
// Called from spawnForTakeoff: last flight's event goes away, a new one is drawn.
function eventsSpawn() {
  eventsReset();
  if (state.vp && state.vp.rocket) eventsDraw();
}
// The destination is picked after the pad spawn, so a draw that assumed the old
// one is redrawn against the new one (this is the only way `impacts` is fair).
function eventsOnDest() {
  if (state.vp && state.vp.rocket && state.dest !== ev.dest) eventsDraw();
}
// Called at T-0: only a real liftoff arms the event (a teleport never does).
function eventsArm() { ev.armed = true; }

function eventsReset() {
  ev.kind = null; ev.armed = false; ev.started = false; ev.done = false;
  ev.t = 0; ev.spawnT = 0; ev.n = 0;
  for (const p of ev.props) evDrop(p.mesh);
  ev.props.length = 0;
  for (const c of ev.craters) evDrop(c.mesh);
  ev.craters.length = 0;
  ev.fw.length = 0;
  if (ev.race) { ev.race.g.visible = false; ev.race = null; }
  if (ev.comet) { ev.comet.g.visible = false; ev.comet = null; }
  if (ev.coat) { evDrop(ev.coat.g); ev.coat = null; }
  ev.landings = flags.rocketLandings || 0;
  evSparksClear();
  setTone("evRace", "sawtooth", EV.race.rumbleFreq, 0);
  setTone("evComet", "sine", EV.comet.freq, 0);
}
// Test hook: stage a named event on demand.
function eventsForce(kind) {
  eventsReset();
  if (EVENT_KINDS.indexOf(kind) < 0) return null;
  ev.kind = kind; ev.dest = state.dest; ev.armed = true;
  return ev.kind;
}
// The rocket has no missiles -- except during the shower, when the plane's
// missile button (its slot is free on a rocket) comes up so he can shoot.
function eventsWantMissile() {
  return ev.kind === "meteors" && ev.started && !ev.done &&
    !!(state.vp && state.vp.rocket) && state.phase === "AIRBORNE" &&
    !state.exploding && !rk.onBody && !roverActive() && !astroActive();
}

// ---------------------------------------------------------------------------
// small shared helpers
// ---------------------------------------------------------------------------
const evTmp = new THREE.Vector3(), evTmp2 = new THREE.Vector3(), evTmp3 = new THREE.Vector3();
function evAxis(out) {   // the rocket's body axis (where the nose points)
  const pr = state.pitch * DEG, cp = Math.cos(pr);
  return out.set(-Math.sin(state.heading) * cp, Math.sin(pr), -Math.cos(state.heading) * cp);
}
function evRandDir(out) {
  const a = rnd() * Math.PI * 2, u = rnd() * 2 - 1, s = Math.sqrt(1 - u * u);
  return out.set(Math.cos(a) * s, u, Math.sin(a) * s);
}
// The camera's own basis. Several events lay their props out in it rather than in
// world or body axes: the chase camera lags and swings about, so anything placed
// off the rocket's heading can end up behind the view entirely.
const evFwd = new THREE.Vector3(), evRt = new THREE.Vector3(), evUp = new THREE.Vector3();
function evCamFrame() {
  camera.getWorldDirection(evFwd);
  if (!Number.isFinite(evFwd.x) || evFwd.lengthSq() < 0.5) evFwd.set(-Math.sin(state.heading), 0, -Math.cos(state.heading));
  evRt.set(0, 1, 0).cross(evFwd);
  if (evRt.lengthSq() < 0.02) evRt.set(Math.cos(state.heading), 0, -Math.sin(state.heading));
  evRt.normalize();
  evUp.crossVectors(evFwd, evRt).normalize();
  // How far down the view the rocket itself sits. Floored, because in the cockpit
  // view the camera is on its nose: without that, everything laid out relative to
  // him would be pushed out to the edges of the frame.
  return Math.max(camera.position.distanceTo(evTmp.set(state.x, state.y, state.z)), EV.minStandoff);
}
function evFramePoint(out, ahead, right, up) {
  return out.set(
    camera.position.x + evFwd.x * ahead + evRt.x * right + evUp.x * up,
    camera.position.y + evFwd.y * ahead + evRt.y * right + evUp.y * up,
    camera.position.z + evFwd.z * ahead + evRt.z * right + evUp.z * up);
}
function evRock(size, mat) {
  const m = new THREE.Mesh(evRockGeo, mat || evRockMat);
  m.scale.setScalar(size);
  return evAdd(m);
}
function evSparkle(x, y, z, n, size, spread, life) {
  for (let i = 0; i < n; i++) {
    const d = evRandDir(evTmp);
    evSpark(x, y, z, Math.floor(rnd() * EV_FW0), size * (0.6 + rnd() * 0.8), life,
      d.x * spread, d.y * spread, d.z * spread);
  }
}

// ---------------------------------------------------------------------------
// 1. RACE TO ORBIT -- a second rocket climbs beside him the whole way up
// ---------------------------------------------------------------------------
let raceModel = null;
function raceBuild() {
  if (raceModel) return raceModel;
  const g = new THREE.Group();
  buildRocketStack(g, {
    mA: new THREE.MeshLambertMaterial({ color: 0xe8ecf2 }),
    mB: new THREE.MeshLambertMaterial({ color: 0x2b6cd4 }),
    glassM: new THREE.MeshLambertMaterial({ color: 0x2f3a48 }),
  });
  const p = g.userData.rocket;
  if (g.userData.plumeLight) g.remove(g.userData.plumeLight);   // one extra light would recompile every shader
  if (p.plasma) g.remove(p.plasma);
  const glint = new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
  glint.position.z = -7;
  glint.visible = false;
  g.add(glint);
  g.userData.glint = glint;
  g.visible = false;
  scene.add(g);
  raceModel = g;
  return g;
}
function raceApply(r) {
  const p = r.g.userData.rocket;
  p.booster.visible = !r.staged;
  p.stage2.visible = true;
  p.capsule.visible = true;
  for (const f of p.fairing) f.visible = true;
  const s = r.staged ? 0.6 : 1;
  p.flame.visible = !r.parked;
  // drawn long, so the plume still reads from a couple of hundred metres away
  p.flame.scale.set(s * 1.3, s * EV.race.plume, s * 1.3);
  p.flame.position.z = (r.staged ? p.stage2.userData.baseZ + 1.1 : p.booster.userData.baseZ + 1.7) + 1.6 * (EV.race.plume - 1) * s;
}
function raceStart() {
  const g = raceBuild();
  ev.race = { g, t: 0, staged: false, parked: false, side: rnd() < 0.5 ? -1 : 1 };
  raceApply(ev.race);
  raceUpdate(0);      // place it before it is shown: otherwise it flashes at the world origin
  g.visible = true;
  liftoffRoar();
  flags.evRace = (flags.evRace || 0) + 1;
}
function raceUpdate(dt) {
  const r = ev.race, R = EV.race;
  r.t += dt;
  if (!r.parked) {
    // Rubber-banded: it climbs beside him, drifting higher and lower, so the two
    // of them go up side by side however he flies. There is nothing to win.
    //
    // Placed off the camera's own look direction rather than his heading: on a
    // fast vertical climb the chase camera lags below and looks steeply up, so
    // anything laid out along the heading falls off the bottom of the screen.
    // This way it is framed beside him whatever the camera is doing.
    const camD = evCamFrame();
    const rise = R.upBase + Math.sin(r.t * R.bob) * R.upSwing;
    evFramePoint(r.g.position, camD + R.far, R.side * r.side, rise);
    r.g.position.y = Math.max(r.g.position.y, Math.max(terrainEff(r.g.position.x, r.g.position.z), TUNE.waterLevel) + 40);
    r.g.rotation.set(state.pitch * DEG, state.heading, 0);
    const alt = rocketAlt();
    if (!r.staged && alt > R.stageAlt) {
      r.staged = true;
      const p = r.g.userData.rocket;
      const clone = p.booster.clone();
      p.booster.updateMatrixWorld(true);
      clone.applyMatrix4(p.booster.matrixWorld);
      clone.matrixAutoUpdate = true;
      evAdd(clone);
      ev.props.push({ kind: "debris", mesh: clone, life: R.debrisLife,
        vx: rk.vx * 0.7 + (rnd() - 0.5) * 12, vy: rk.vy * 0.5 - 12, vz: rk.vz * 0.7 + (rnd() - 0.5) * 12,
        rx: (rnd() - 0.5) * R.debrisSpin, ry: (rnd() - 0.5) * R.debrisSpin });
      stageSep();
      flags.evRaceStages = (flags.evRaceStages || 0) + 1;
      raceApply(r);
    }
    if (alt > R.parkAlt) { r.parked = true; raceApply(r); setTone("evRace", "sawtooth", R.rumbleFreq, 0); }
  }
  if (r.parked) {
    r.g.userData.glint.visible = (frameCount % 46) < 12;   // a glint in a nearby orbit
    return;
  }
  const d = Math.hypot(r.g.position.x - state.x, r.g.position.y - state.y, r.g.position.z - state.z);
  setTone("evRace", "sawtooth", R.rumbleFreq, R.rumbleGain * clamp(1 - d / R.rumbleFar, 0, 1));
}

// ---------------------------------------------------------------------------
// 2. METEOR SHOWER -- glowing rocks crossing in front of him, there to be shot
// ---------------------------------------------------------------------------
function meteorSpawn() {
  const M = EV.meteors;
  const ax = evAxis(evTmp).clone();
  // a point ahead of him, jittered: that is where this one crosses
  const off = evRandDir(evTmp2).multiplyScalar(rnd() * M.pass);
  const tx = state.x + ax.x * M.ahead + off.x, ty = state.y + ax.y * M.ahead + off.y, tz = state.z + ax.z * M.ahead + off.z;
  // a direction across his path, never straight down the nose
  const d = evRandDir(evTmp3);
  d.addScaledVector(ax, -d.dot(ax) * 0.85).normalize();
  const m = evRock(M.size * (0.6 + rnd() * 0.8));
  m.position.set(tx + d.x * M.range, ty + d.y * M.range, tz + d.z * M.range);
  ev.props.push({ kind: "meteor", mesh: m, i: ev.n,
    vx: -d.x * M.speed, vy: -d.y * M.speed, vz: -d.z * M.speed,
    rx: (rnd() - 0.5) * 2, ry: (rnd() - 0.5) * 2,
    life: (M.range * 2) / M.speed, trail: 0, whooshed: false });
}
function meteorBurst(p) {
  const M = EV.meteors;
  const x = p.mesh.position.x, y = p.mesh.position.y, z = p.mesh.position.z;
  p.life = 0;
  for (let i = 0; i < M.chunks; i++) {
    const c = new THREE.Mesh(evRockGeo, evChunkMat);
    c.scale.setScalar(M.chunkSize * (0.6 + rnd() * 0.9));
    c.position.set(x, y, z);
    evAdd(c);
    const d = evRandDir(evTmp);
    ev.props.push({ kind: "chunk", mesh: c, life: M.chunkLife,
      vx: p.vx * 0.3 + d.x * M.chunkSpeed, vy: p.vy * 0.3 + d.y * M.chunkSpeed, vz: p.vz * 0.3 + d.z * M.chunkSpeed,
      rx: (rnd() - 0.5) * 6, ry: (rnd() - 0.5) * 6 });
  }
  evSparkle(x, y, z, 12, 5, 18, 0.9);
  triggerExplosion(x, y, z, 0.45, true);
  ringNote(p.i % 12);
  noiseBurst(0.22, 900, M.volume, 0);
  flags.evMeteorHits = (flags.evMeteorHits || 0) + 1;
}
function meteorsUpdate(dt) {
  const M = EV.meteors;
  if (ev.n < M.count) {
    ev.spawnT -= dt;
    if (ev.spawnT <= 0) { ev.spawnT = M.interval; meteorSpawn(); ev.n++; }
  } else if (!ev.props.some(p => p.kind === "meteor" && p.life > 0)) {
    ev.done = true;
  }
  // Pointing, not timing: a missile fired at a rock bends onto it. Without this he
  // would have to lead a crossing target, which is exactly the thing this game
  // never asks for. Only rocks are ever tracked, and only during the shower.
  for (const m of missiles) {
    if (!m.alive) continue;
    const sp = Math.hypot(m.vx, m.vy, m.vz);
    if (sp < 1) continue;
    let best = null, bestD = M.lockR;
    for (const p of ev.props) {
      if (p.kind !== "meteor" || p.life <= 0) continue;
      const dx = p.mesh.position.x - m.x, dy = p.mesh.position.y - m.y, dz = p.mesh.position.z - m.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > bestD || d < 1) continue;
      if ((m.vx * dx + m.vy * dy + m.vz * dz) / (sp * d) < M.lockDot) continue;   // behind it: let it go
      best = { dx, dy, dz, d }; bestD = d;
    }
    if (!best) continue;
    const k = Math.min(1, M.lockRate * dt);
    const nx = m.vx / sp + (best.dx / best.d - m.vx / sp) * k;
    const ny = m.vy / sp + (best.dy / best.d - m.vy / sp) * k;
    const nz = m.vz / sp + (best.dz / best.d - m.vz / sp) * k;
    const nl = Math.hypot(nx, ny, nz) || 1;
    m.vx = nx / nl * sp; m.vy = ny / nl * sp; m.vz = nz / nl * sp;
  }
  // shot down, or flown into: either way it bursts
  for (const p of ev.props) {
    if (p.kind !== "meteor" || p.life <= 0) continue;
    const px = p.mesh.position.x, py = p.mesh.position.y, pz = p.mesh.position.z;
    let hit = false;
    for (const m of missiles) {
      if (!m.alive) continue;
      if (Math.hypot(m.x - px, m.y - py, m.z - pz) < M.hitR) {
        m.alive = false; m.mesh.visible = false; hit = true; break;
      }
    }
    if (!hit && !state.exploding && Math.hypot(state.x - px, state.y - py, state.z - pz) < M.hitR) hit = true;
    if (hit) meteorBurst(p);
  }
}

// ---------------------------------------------------------------------------
// 3. COMET FLYBY -- one enormous comet; the tail is the thing to fly through
// ---------------------------------------------------------------------------
let cometModel = null;
function cometBuild() {
  if (cometModel) return cometModel;
  const C = EV.comet;
  const g = new THREE.Group();
  // fog: false throughout -- it is seen from a kilometre away, and the scene fog
  // would otherwise paint the whole thing flat grey
  const head = new THREE.Mesh(new THREE.SphereGeometry(C.r, 20, 14),
    new THREE.MeshLambertMaterial({ color: 0xd8f4ff, emissive: 0x6fd6ff, emissiveIntensity: 0.9, fog: false }));
  g.add(head);
  const coma = new THREE.Mesh(new THREE.SphereGeometry(C.r * 1.9, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0x9fe6ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  g.add(coma);
  // the tail streams back along +z in model space, widening as it goes
  // Two shells, each fading to nothing along its length via vertex colours. Flat
  // opacity made it a solid grey cone: additive shells stack, and with no gradient
  // there is no soft end to it. The fade also hides the far opening.
  for (const [len, rad, op, col] of [[C.tail, C.tailR, 0.34, 0x8fe0ff], [C.tail * 0.66, C.tailR * 0.6, 0.38, 0xd8f4ff]]) {
    const geo = new THREE.CylinderGeometry(rad, C.r * 0.7, len, 20, 1, true);
    const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      // +y is the wide far end, -y the narrow end at the head
      const k = Math.pow(clamp(1 - (pos.getY(i) + len / 2) / len, 0, 1), 1.7);
      cols[i * 3] = cols[i * 3 + 1] = cols[i * 3 + 2] = k;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    const t = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: col, vertexColors: true, transparent: true, opacity: op,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    t.rotation.x = Math.PI / 2;
    t.position.z = len / 2;
    g.add(t);
  }
  g.visible = false;
  scene.add(g);
  cometModel = g;
  return g;
}
function cometStart() {
  const C = EV.comet;
  const g = cometBuild();
  g.visible = true;
  const d = evRandDir(evTmp).clone();
  const off = evRandDir(evTmp2).clone();
  off.addScaledVector(d, -off.dot(d)).normalize().multiplyScalar(C.dist * (0.6 + rnd() * 0.7));
  const cx = state.x + off.x, cy = state.y + off.y, cz = state.z + off.z;   // closest approach
  const back = C.speed * C.life * 0.5;
  ev.comet = { g, d, x: cx - d.x * back, y: cy - d.y * back, z: cz - d.z * back, t: 0, inTail: false, pulse: 0 };
  fanfare();
  flags.evComet = (flags.evComet || 0) + 1;
}
function coatStart() {
  const C = EV.comet;
  const g = new THREE.Group();
  const specks = [];
  for (let i = 0; i < C.coat; i++) {
    const s = new THREE.Mesh(evSpeckGeo, evSpeckMat);
    const d = evRandDir(evTmp).clone().multiplyScalar(C.coatR * (0.4 + rnd() * 0.6));
    s.position.copy(d);
    g.add(s);
    specks.push({ m: s, a: rnd() * Math.PI * 2, r: d.length(), sp: 0.4 + rnd() * 1.2, y: d.y });
  }
  evAdd(g);
  ev.coat = { g, specks, t: 0 };
}
function cometUpdate(dt) {
  const C = EV.comet, c = ev.comet;
  c.t += dt;
  c.x += c.d.x * C.speed * dt; c.y += c.d.y * C.speed * dt; c.z += c.d.z * C.speed * dt;
  c.g.position.set(c.x, c.y, c.z);
  c.g.lookAt(c.x - c.d.x, c.y - c.d.y, c.z - c.d.z);   // +z (the tail) points back along the track
  // distance from him to the tail axis: the segment from the head back along -d
  evTmp.set(state.x - c.x, state.y - c.y, state.z - c.z);
  const along = clamp(-evTmp.dot(c.d), 0, C.tail);
  const lat = evTmp2.copy(evTmp).addScaledVector(c.d, along).length();
  const inTail = lat < C.tailR && along > 0 && !state.exploding;
  if (inTail) {
    if (!c.inTail) { c.inTail = true; fanfare(); flags.evCometTail = (flags.evCometTail || 0) + 1; if (!ev.coat) coatStart(); }
    c.pulse -= dt;
    if (c.pulse <= 0) { c.pulse = 0.25; sparkleBurst(); evSparkle(state.x, state.y, state.z, 12, 6, 24, 0.7); }
  } else if (c.inTail) {
    c.inTail = false;
  }
  const d = Math.hypot(c.x - state.x, c.y - state.y, c.z - state.z);
  setTone("evComet", "sine", C.freq, C.gain * clamp(1 - d / C.hearDist, 0, 1));
  if (c.t > C.life) { c.g.visible = false; ev.comet = null; ev.done = true; setTone("evComet", "sine", C.freq, 0); }
}
function coatUpdate(dt) {
  const c = ev.coat;
  c.t += dt;
  c.g.position.set(state.x, state.y, state.z);
  for (const s of c.specks) {
    s.a += s.sp * dt;
    s.m.position.set(Math.cos(s.a) * s.r, s.y + Math.sin(s.a * 1.7) * 1.5, Math.sin(s.a) * s.r);
    s.m.visible = ((frameCount + Math.floor(s.a * 9)) % 14) < 9;
  }
}

// ---------------------------------------------------------------------------
// 4. METEOR IMPACTS -- they thump down around the rover and leave glowing craters
// ---------------------------------------------------------------------------
function impactSpawn(b) {
  const I = EV.impacts;
  const n = evTmp.set(rover.x - b.x, rover.y - b.y, rover.z - b.z).normalize();
  const dist = I.near[0] + rnd() * (I.near[1] - I.near[0]);
  const p = surfacePoint(b, n, dist, rnd() * Math.PI * 2);
  const up = evTmp2.set(p.x - b.x, p.y - b.y, p.z - b.z).normalize();
  const m = evRock(1.9 + rnd() * 1.2);
  // it comes in on a slant from high above that spot
  const side = evRandDir(evTmp3).clone();
  side.addScaledVector(up, -side.dot(up)).normalize().multiplyScalar(I.from * 0.35);
  m.position.set(p.x + up.x * I.from + side.x, p.y + up.y * I.from + side.y, p.z + up.z * I.from + side.z);
  const dir = evTmp3.set(p.x - m.position.x, p.y - m.position.y, p.z - m.position.z).normalize();
  ev.props.push({ kind: "impactor", mesh: m, body: b,
    vx: dir.x * I.speed, vy: dir.y * I.speed, vz: dir.z * I.speed,
    rx: (rnd() - 0.5) * 3, ry: (rnd() - 0.5) * 3,
    tx: p.x, ty: p.y, tz: p.z, nx: up.x, ny: up.y, nz: up.z,
    life: (I.from * 1.15) / I.speed, trail: 0 });
}
function impactLand(p) {
  const I = EV.impacts;
  p.life = 0;
  // a raised rim and a glowing floor: from a rover's eye height the rim alone
  // foreshortens to a bar, so the floor is what says "crater" from across the plain
  const mat = new THREE.MeshBasicMaterial({ color: 0xff9a3a, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
  const g = new THREE.Group();
  const ring = new THREE.Mesh(evRingGeo, mat);
  ring.userData.ownMat = true;   // the pair share it; one owner disposes it
  ring.scale.setScalar(I.craterR);
  g.add(ring);
  const floor = new THREE.Mesh(evDiscGeo, mat);
  floor.scale.setScalar(I.craterR * 0.95);
  floor.position.z = -0.25;   // the group's local +z points into the ground: lift the floor out of it
  g.add(floor);
  g.position.set(p.tx + p.nx * 0.3, p.ty + p.ny * 0.3, p.tz + p.nz * 0.3);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), evTmp.set(p.nx, p.ny, p.nz));
  g.rotateX(Math.PI / 2);
  evAdd(g);
  ev.craters.push({ mesh: g, mat, x: p.tx, y: p.ty, z: p.tz, popped: false, t: rnd() * 6 });
  for (let i = 0; i < I.dust; i++) {
    wakePuff(p.tx + (rnd() - 0.5) * 8, p.ty + p.ny * 1.5, p.tz + (rnd() - 0.5) * 8,
      0xd9d2b8, 1.2, 3 + rnd() * 4, 1.4);
  }
  evSparkle(p.tx + p.nx * 2, p.ty + p.ny * 2, p.tz + p.nz * 2, 9, 5, 14, 0.9);
  boomSound();
  shakeAmp = Math.max(shakeAmp, I.shake);
  flags.evImpactHits = (flags.evImpactHits || 0) + 1;
}
function impactsUpdate(dt, b) {
  const I = EV.impacts;
  if (ev.n < I.count) {
    ev.spawnT -= dt;
    if (ev.spawnT <= 0) { ev.spawnT = I.interval; impactSpawn(b); ev.n++; }
  }
  // drive into a glowing crater and it bursts
  for (const c of ev.craters) {
    c.t += dt;
    if (c.popped) continue;
    c.mat.opacity = 0.55 + 0.35 * Math.sin(c.t * 3.2);
    if (Math.hypot(c.x - rover.x, c.y - rover.y, c.z - rover.z) < I.popR) {
      c.popped = true;
      c.mat.color.setHex(0x6e727b);
      c.mat.opacity = 0.5;
      evSparkle(c.x, c.y, c.z, 14, 6, 16, 1.0);
      sparkleBurst();
      chime();
      flags.evCraterPops = (flags.evCraterPops || 0) + 1;
    }
  }
}

// ---------------------------------------------------------------------------
// 5. SHOOTING-STAR ESCORT -- his fireball is one of many, all the way down
// ---------------------------------------------------------------------------
function escortSpawn() {
  const E = EV.escort;
  const m = new THREE.Mesh(evRockGeo, evFireMat);
  m.scale.setScalar(E.size * (0.6 + rnd() * 0.8));
  // spread across the view at roughly his own depth, so they read as fireballs
  // keeping him company rather than specks somewhere off the side of the screen
  const camD = evCamFrame();
  evFramePoint(m.position, camD + E.ahead * (0.2 + rnd()),
    (rnd() - 0.5) * 2 * E.spread, (rnd() - 0.5) * 1.4 * E.spread);
  evAdd(m);
  const d = evRandDir(evTmp3).clone().multiplyScalar(E.drift);
  ev.props.push({ kind: "streak", mesh: m, life: E.life, max: E.life,
    vx: rk.vx + d.x, vy: rk.vy + d.y, vz: rk.vz + d.z,
    rx: (rnd() - 0.5) * 4, ry: (rnd() - 0.5) * 4, trail: 0 });
  whoosh();
}
function escortUpdate(dt) {
  const E = EV.escort;
  if (ev.n < E.count) {
    ev.spawnT -= dt;
    if (ev.spawnT <= 0) { ev.spawnT = E.interval; escortSpawn(); ev.n++; }
  } else if (!ev.props.some(p => p.kind === "streak" && p.life > 0)) {
    ev.done = true;
  }
}

// ---------------------------------------------------------------------------
// 6. FIREWORKS WELCOME -- a barrage over the landing site. Nothing to press.
// ---------------------------------------------------------------------------
function fireworksStart() {
  const F = EV.fireworks;
  ev.wet = terrainEff(state.x, state.z) < TUNE.waterLevel - 0.2;
  ev.base = ev.wet ? TUNE.waterLevel : Math.max(terrainEff(state.x, state.z), TUNE.waterLevel);
  // Offsets, not fixed points: the shells go up over wherever the capsule is when
  // each one bursts, so the barrage rides along with the recovery ship or truck
  // instead of being left behind over the splashdown mark.
  for (let i = 0; i < F.count; i++) {
    ev.fw.push({
      t: 0.5 + i * F.interval,
      dx: (rnd() - 0.5) * 2 * F.spread,
      dz: (rnd() - 0.5) * 2 * F.spread,
      h: F.height * (0.6 + rnd() * 0.7),
      ci: EV_FW0 + i % (EV_SPARK_MATS.length - EV_FW0),
    });
    fireworkSound(i * F.interval);
  }
  cheer();
  flags.evFireworks = (flags.evFireworks || 0) + 1;
}
function fireworksUpdate(dt) {
  const F = EV.fireworks;
  if (!ev.fw.length) return;
  const due = [];
  for (const f of ev.fw) { f.t -= dt; if (f.t <= 0) due.push(f); }
  if (!due.length) return;
  ev.fw = ev.fw.filter(f => f.t > 0);
  for (const f of due) {
    const cx = state.x + f.dx, cz = state.z + f.dz, cy = ev.base + f.h;
    for (let i = 0; i < F.puffs; i++) {
      const d = evRandDir(evTmp);
      evSpark(cx, cy, cz, f.ci, F.size, 1.5, d.x * F.burst, d.y * F.burst, d.z * F.burst);
      // over water the burst comes back off the surface: a ring of its own colour
      // spreading on the sea underneath it (the water is opaque, so a mirrored
      // copy below it would simply not be there)
      if (ev.wet) evSpark(cx, ev.base + 0.6, cz, f.ci, F.size * 0.6, 1.1, d.x * F.burst * 0.7, 0, d.z * F.burst * 0.7);
    }
    flags.evFireworkShells = (flags.evFireworkShells || 0) + 1;
  }
}

// ---------------------------------------------------------------------------
// the props: everything already out keeps moving, whatever else is happening
// ---------------------------------------------------------------------------
function evPropsUpdate(dt) {
  const M = EV.meteors;
  for (let i = ev.props.length - 1; i >= 0; i--) {
    const p = ev.props[i];
    if (p.life <= 0) { evDrop(p.mesh); ev.props.splice(i, 1); continue; }
    p.life -= dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.mesh.rotation.x += p.rx * dt;
    p.mesh.rotation.y += p.ry * dt;
    if (p.kind === "meteor") {
      p.trail -= dt;
      if (p.trail <= 0) {
        p.trail = M.trail;
        evSpark(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, p.i, 5, 0.7);
      }
      if (!p.whooshed && Math.hypot(p.mesh.position.x - state.x, p.mesh.position.y - state.y, p.mesh.position.z - state.z) < M.whooshDist) {
        p.whooshed = true;
        whoosh();
      }
    } else if (p.kind === "impactor") {
      p.trail -= dt;
      if (p.trail <= 0) { p.trail = 0.05; evSpark(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 2, 5, 0.6); }
      // it lands when it reaches the surface point it was aimed at
      const gap = (p.mesh.position.x - p.tx) * p.nx + (p.mesh.position.y - p.ty) * p.ny + (p.mesh.position.z - p.tz) * p.nz;
      if (gap <= 0.5) { impactLand(p); evDrop(p.mesh); ev.props.splice(i, 1); }
    } else if (p.kind === "streak") {
      p.trail -= dt;
      if (p.trail <= 0) {
        p.trail = 0.035;
        evSpark(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 2, 12, 0.5);
      }
      const k = clamp(p.life / p.max, 0, 1);
      p.mesh.scale.setScalar(EV.escort.size * k);   // it burns up
      if (p.life <= dt) evSparkle(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 5, 4, 10, 0.6);
    }
  }
}

// ---------------------------------------------------------------------------
// the switch
// ---------------------------------------------------------------------------
function updateEvents(dt) {
  evSparksUpdate(dt);
  if (!state.vp || !state.vp.rocket) {
    if (ev.kind || ev.props.length || ev.race || ev.comet || ev.coat) eventsReset();
    return;
  }
  evPropsUpdate(dt);
  if (ev.race) raceUpdate(dt);
  if (ev.comet) cometUpdate(dt);
  if (ev.coat) coatUpdate(dt);
  fireworksUpdate(dt);
  if (!ev.armed || !ev.kind || ev.done) { ev.landings = flags.rocketLandings || 0; return; }
  ev.t += dt;

  const flying = state.phase === "AIRBORNE" && !state.exploding && !rk.onBody;
  const inSpace = flying && state.spaceF > 0.5 && !roverActive() && !astroActive();

  if (ev.kind === "race") {
    if (!ev.started && flying && rocketAlt() > EV.race.startAlt) { ev.started = true; raceStart(); }
    if (ev.started && ev.race && ev.race.parked) ev.done = true;
  } else if (ev.kind === "meteors") {
    if (!ev.started && inSpace) { ev.started = true; flags.evMeteors = (flags.evMeteors || 0) + 1; ev.spawnT = 0; }
    if (ev.started) meteorsUpdate(dt);
  } else if (ev.kind === "comet") {
    if (!ev.started && inSpace) { ev.started = true; cometStart(); }
  } else if (ev.kind === "impacts") {
    const on = roverActive() && rover.body && rover.body.name === "moon";
    if (!ev.started && on) { ev.started = true; ev.spawnT = 1.2; flags.evImpacts = (flags.evImpacts || 0) + 1; }
    if (ev.started && on) impactsUpdate(dt, rover.body);
  } else if (ev.kind === "escort") {
    if (!ev.started && flying && rk.reentry > 0.25) { ev.started = true; ev.spawnT = 0; flags.evEscort = (flags.evEscort || 0) + 1; }
    if (ev.started) escortUpdate(dt);
  } else if (ev.kind === "fireworks") {
    const landings = flags.rocketLandings || 0;
    if (!ev.started && landings > ev.landings && !rk.onBody) { ev.started = true; fireworksStart(); }
    else if (ev.started && !ev.fw.length) ev.done = true;
    ev.landings = landings;
  }
}
