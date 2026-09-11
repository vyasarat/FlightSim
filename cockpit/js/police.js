"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- THE POLICE CHASE.
//
// Two cars come out of a side road behind him, lights and sirens on, and stay
// in his mirror until he loses them or they give up. That is the whole of it.
//
// IT COSTS HIM NOTHING. Being caught is a scene, not a penalty: the cars angle
// across in front and behind, the lights strobe, an officer waves, the shared
// countdown numerals run 3-2-1, and then they peel away and he drives off with
// the engine still running. No score, no message, no delay he cannot drive out
// of. Ten seconds start to finish. That is the "nothing is ever taken away"
// rule applied to the one mechanic in the game that looks like a punishment.
//
// THEY ARE MACHINES. The officer is drawn in his seat and never gets out, is
// never a target, and nothing can ever happen to him -- the same rule the
// astronaut and the birds live under. The CARS crash, explode and reassemble
// like every other machine here, and that is the only thing that ever does.
//
// RUBBER-BANDED, like the rival rocket and the rival jet-ski. Their speed comes
// from how far behind they are, not from a throttle of their own, so they are
// always about to catch him and never quite do. There is no winner to be.
//
// HE CAN ALWAYS GET OUT. Two independent ways: outrun them past `giveUpDist`,
// or simply wait -- after `maxChase` seconds they peel off regardless. A chase
// he cannot end would be a thing taken away, and there is no such thing here.
//
// ONLY THE CAR. Nothing about this exists for an aeroplane, a boat or a rocket.
// ---------------------------------------------------------------------------

const PL = TUNE.police;

const police = {
  built: false, g: null, mesh: null, cars: [],
  active: false, state: "away",     // away | chase | pullover | leaving
  t: 0, chaseT: 0, stoppedT: 0, scheme: null, schemeKey: null, wasWrecked: false, resume: 0,
  sirenT: 0, blink: 0, from: null,
};

// The colour schemes are an event pool with the "once" policy, which is the
// same mechanism the space programme's draw uses (js/eventpool.js): one drawn
// per chase, never the same one twice running, remembered across reloads.
const POLICE_POOL = evpRegister({
  name: "police",
  policy: "once",
  kind: "livery",            // paint, not an event: the three rules are not about it
  memory: "lp.lastPolice",
  members: Object.keys(PL.schemes).map(key => ({ key, state: police })),
});
POLICE_POOL.prev = evpLoadLast(POLICE_POOL);

// ---------------------------------------------------------------------------
// One car: a body, a roof bar with two lamps, and an officer who stays in it.
// ---------------------------------------------------------------------------
function plBuildCar() {
  const g = new THREE.Group();
  // Sized against HIS car, which is the only scale reference he has: a police
  // car that dwarfs the thing it is chasing reads as a lorry with a light on.
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.0, 5.4), mattMat(0xffffff));
  body.position.y = 0.85; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.85, 2.5), mattMat(0x20242b));
  cabin.position.set(0, 1.72, -0.25); g.add(cabin);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(2.54, 0.55, 3.0), mattMat(0xf2f4f7));
  panel.position.set(0, 0.85, 0.35); g.add(panel);
  // the roof bar
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.2, 0.5), mattMat(0x20242b));
  bar.position.set(0, 2.24, -0.25); g.add(bar);
  const lamps = [];
  for (const sx of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.26, 0.44),
      new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
    m.position.set(sx * 0.52, 2.26, -0.25);
    g.add(m); lamps.push(m);
  }
  // wheels, so it reads as a car from the chase camera rather than a brick
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.42, 10), mattMat(0x1a1d22));
    w.rotation.z = Math.PI / 2;
    w.position.set(sx * 1.26, 0.56, sz * 1.72);
    g.add(w);
  }
  // The officer. Drawn in the seat, and that is where he stays: he is not a
  // target, he is not solid, nothing can be aimed at him and nothing can
  // happen to him. The arm waves at the pull-over and does nothing else.
  const who = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.34), mattMat(0x1c4f9c));
  torso.position.y = 0.28; who.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 6), mattMat(0xe8c9a0));
  head.position.y = 0.70; who.add(head);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.46, 0.14), mattMat(0x1c4f9c));
  arm.position.set(-0.34, 0.38, 0); arm.geometry.translate(0, -0.23, 0);
  who.add(arm);
  who.position.set(-0.46, 1.32, -0.35);
  who.userData.noSolid = true; who.userData.noShatter = true;
  g.add(who);

  const wave = new THREE.Group();
  g.userData = { lamps, officer: who, arm, body, panel, bar, wave };
  castsShadow(g);
  return g;
}

function plBuild() {
  if (police.built) return;
  const g = new THREE.Group();
  g.visible = false;
  for (let i = 0; i < PL.cars; i++) {
    const c = plBuildCar();
    g.add(c);
    police.cars.push({
      g: c, s: 0, lat: 0, speed: 0, weave: Math.random() * 6.283,
      crashT: 0, dead: 0, x: 0, z: 0, y: 0, heading: 0, role: i,
    });
  }
  scene.add(g);
  police.g = g;
  police.built = true;
}

function plPaint(key) {
  const sc = PL.schemes[key] || PL.schemes[Object.keys(PL.schemes)[0]];
  police.scheme = sc; police.schemeKey = key;
  for (const c of police.cars) {
    const u = c.g.userData;
    u.body.material = mattMat(sc.body);
    u.panel.material = mattMat(sc.panel);
    u.lamps[0].material = new THREE.MeshBasicMaterial({ color: sc.bar[0], fog: false });
    u.lamps[1].material = new THREE.MeshBasicMaterial({ color: sc.bar[1], fog: false });
  }
}

// ---------------------------------------------------------------------------
// Starting, and stopping
// ---------------------------------------------------------------------------
// Two different questions, and conflating them is what let a crash end a chase.
// `policeCan` is whether one may START -- never mid-explosion. `policeHolds` is
// whether one CONTINUES, and a crash is not an escape: he explodes, reassembles
// free on the road, and they are behind him again with the sirens still going.
// Only climbing out of the car ends it that way.
function policeCan() {
  return typeof vehKind === "function" && vehKind() === "car" && !state.exploding;
}
function policeHolds() {
  return typeof vehKind === "function" && vehKind() === "car";
}

function policeStart(fromJunction) {
  if (!policeCan() || police.active) return false;
  plBuild();
  plPaint(evpDraw("police") || Object.keys(PL.schemes)[0]);
  police.active = true;
  police.state = "chase";
  police.t = 0; police.chaseT = 0; police.stoppedT = 0; police.sirenT = 0;
  police.wasWrecked = false; police.resume = 0;
  police.from = fromJunction || null;
  police.g.visible = true;
  const fx = -Math.sin(state.heading), fz = -Math.cos(state.heading);
  const rx = -fz, rz = fx;
  police.cars.forEach((c, i) => {
    const side = i % 2 ? 1 : -1;
    c.x = state.x - fx * (PL.spawnBehind + i * 16) + rx * side * PL.spawnSide;
    c.z = state.z - fz * (PL.spawnBehind + i * 16) + rz * side * PL.spawnSide;
    c.y = plRoadY(c.x, c.z);
    c.heading = state.heading;
    c.speed = state.speed;
    c.dead = 0; c.crashT = 0;
    c.g.visible = true;
  });
  flags.policeChases = (flags.policeChases || 0) + 1;
  return true;
}

function policeStop(whoop) {
  if (!police.active) return;
  police.active = false;
  police.state = "away";
  if (police.g) police.g.visible = false;
  plSiren(0);
  if (typeof engDuck === "function") engDuck(1);
  if (whoop && typeof synthBlip === "function") {
    synthBlip("sine", PL.sirenHz[1], PL.sirenHz[0], 0.9, 0.06, 0);   // the last whoop
  }
  countdownClear();
  flags.policeEnded = (flags.policeEnded || 0) + 1;
}

// The road surface under a police car. They drive the same roads he does, so
// they ask the same question the car asks.
// The road surface under a police car -- the wheels sit ON it, so this is the
// surface and not a metre above it. They drive the same roads he does, so they
// ask the same question the car asks.
function plRoadY(x, z) {
  if (typeof hwyNearest !== "function" || !highway.built) return terrainEff(x, z);
  const n = hwyNearest(x, z);
  const onRoad = n && Math.abs(n.lateral) < highway.halfW + 8;
  return onRoad ? n.y : Math.max(terrainEff(x, z), TUNE.waterLevel);
}

// ---------------------------------------------------------------------------
// The siren. Two tones alternating, warm rather than harsh, and DUCKED: it
// rides under the engine and the events rather than over them. Nothing in this
// game is allowed to be the loudest thing just because it is urgent.
// ---------------------------------------------------------------------------
function plSiren(gain, hz) {
  if (typeof setTone !== "function") return;
  setTone("policeSiren", "sine", hz || PL.sirenHz[0], gain);
  setTone("policeSirenB", "triangle", (hz || PL.sirenHz[0]) * 0.5, gain * 0.45);
}

// The siren and the duck, one frame of them. Returns how far the nearest is.
function plSirenFrame(dt) {
  police.sirenT += dt * PL.sirenRate;
  const two = Math.sin(police.sirenT * Math.PI * 2) > 0;
  const nearest = Math.min(...police.cars.map(c => Math.hypot(c.x - state.x, c.z - state.z)));
  const near = clamp(1 - nearest / PL.giveUpDist, 0, 1);
  plSiren(PL.sirenGain * near * (police.state === "leaving" ? 0.4 : 1),
          two ? PL.sirenHz[0] : PL.sirenHz[1]);
  // DUCKED, not loud. The siren gets room by everything else standing down a
  // little, not by being the loudest thing on the mix -- which is the rule the
  // engines already follow, applied to the one sound with an excuse to break it.
  if (typeof engDuck === "function") engDuck(lerp(1, PL.duck, near));
  return nearest;
}

// The lamps strobe whatever else is happening, including while he is in pieces.
function plLamps() {
  for (const c of police.cars) {
    const u = c.g.userData;
    const a = Math.sin(police.blink * Math.PI * 2) > 0;
    u.lamps[0].visible = a;
    u.lamps[1].visible = !a;
  }
}

// ---------------------------------------------------------------------------
// The frame
// ---------------------------------------------------------------------------
function updatePolice(dt) {
  if (!police.built) return;
  // A crash ends it too -- he explodes, reassembles free, and they are gone.
  // That is a third way out and it costs him nothing either.
  if (police.active && !policeHolds()) { policeStop(false); return; }
  if (!police.active) { plSiren(0); if (typeof engDuck === "function") engDuck(1); return; }

  police.t += dt;
  police.chaseT += dt;
  police.blink += dt * PL.lightHz;

  // ---- HIS crash, and what happens after it.
  // While he is in pieces they hold station with the sirens still on; the moment
  // he is back on the road they re-form behind him and pick it straight up.
  // Nothing about the chase is reset, because crashing is not a way out of one.
  if (state.exploding) {
    police.wasWrecked = true;
    police.resume = PL.resumeIn;
    for (const c of police.cars) c.speed *= Math.max(0, 1 - dt * 1.6);
    plSirenFrame(dt);
    plLamps();
    for (const c of police.cars) { c.g.position.set(c.x, c.y, c.z); c.g.rotation.y = c.heading; }
    return;
  }
  if (police.wasWrecked) {
    police.wasWrecked = false;
    const fx0 = -Math.sin(state.heading), fz0 = -Math.cos(state.heading);
    for (const c of police.cars) { c.dead = 0; c.crashT = 0; plRespawn(c, fx0, fz0, -fz0, fx0); }
    flags.policeResumed = (flags.policeResumed || 0) + 1;
  }
  if (police.resume > 0) police.resume -= dt;

  const fx = -Math.sin(state.heading), fz = -Math.cos(state.heading);
  const rx = -fz, rz = fx;

  const nearest = plSirenFrame(dt);
  plLamps();

  if (police.state === "chase") plChase(dt, fx, fz, rx, rz, nearest);
  else if (police.state === "pullover") plPullOver(dt, fx, fz, rx, rz);
  else if (police.state === "leaving") plLeave(dt, fx, fz);

  // put them where they are
  for (const c of police.cars) {
    c.g.position.set(c.x, c.y, c.z);
    c.g.rotation.y = c.heading;
    if (c.dead > 0) {
      c.dead -= dt;
      c.g.rotation.z = Math.sin(c.dead * 9) * 0.5;
      c.g.visible = c.dead > 0.3;
      if (c.dead <= 0) plRespawn(c, fx, fz, rx, rz);
    } else {
      c.g.rotation.z = 0;
      c.g.visible = true;
    }
  }
}

// ---- the chase ------------------------------------------------------------
function plChase(dt, fx, fz, rx, rz, nearest) {
  // He is out of it if he outruns them, or simply if he waits: two ways out,
  // and neither of them is something he has to be told about.
  // Not while they are still re-forming after his crash: the reassembly moves
  // HIM, and the jump in the gap is not something he outran.
  if (police.resume > 0) return;
  if (nearest > PL.giveUpDist) { flags.policeOutrun = (flags.policeOutrun || 0) + 1; police.state = "leaving"; police.t = 0; return; }
  if (police.chaseT > PL.maxChase) { flags.policeGaveUp = (flags.policeGaveUp || 0) + 1; police.state = "leaving"; police.t = 0; return; }

  // caught: stopped, with one of them alongside
  if (state.speed < PL.caughtSpeed && nearest < 40) {
    police.stoppedT += dt;
    if (police.stoppedT > PL.caughtTime) {
      police.state = "pullover"; police.t = 0;
      flags.policeCaught = (flags.policeCaught || 0) + 1;
      return;
    }
  } else police.stoppedT = 0;

  police.cars.forEach((c, i) => {
    if (c.dead > 0) return;
    // RUBBER-BANDED: the speed comes from the gap, not from a throttle. The
    // band is wide enough that he can see them fall back when he goes and come
    // up when he does not, and narrow enough that they never actually arrive.
    const dx = state.x - c.x, dz = state.z - c.z;
    const gap = Math.hypot(dx, dz);
    const want = lerp(PL.hold[0], PL.hold[1], i / Math.max(1, PL.cars - 1));
    const over = clamp((gap - want) / 40, -1, 1);
    const target = clamp(state.speed * (1 + over * (PL.speedOver - 1) * 2) + over * 8, 6, PL.topSpeed);
    c.speed += clamp(target - c.speed, -50 * dt, 45 * dt);

    // aim at a point beside him, weaving
    c.weave += dt * PL.weave.rate * (1 + i * 0.35);
    const side = (i % 2 ? 1 : -1) * (PL.weave.amp + Math.sin(c.weave) * PL.weave.amp);
    const tx = state.x - fx * want + rx * side;
    const tz = state.z - fz * want + rz * side;
    const want2 = Math.atan2(-(tx - c.x), -(tz - c.z));
    c.heading += clamp(wrapPi(want2 - c.heading), -2.6 * dt, 2.6 * dt);
    c.x += -Math.sin(c.heading) * c.speed * dt;
    c.z += -Math.cos(c.heading) * c.speed * dt;
    c.y += (plRoadY(c.x, c.z) - c.y) * Math.min(1, 8 * dt);

    // Sometimes one of them loses it. It is a machine, it explodes and it comes
    // back -- the same free reassembly every other machine in this game gets.
    if (c.crashT > 0) { c.crashT -= dt; return; }
    if (plNearSolid(c.x, c.y, c.z) && Math.random() < PL.crashChance * dt * 60 * 0.016) {
      triggerExplosion(c.x, c.y + 1, c.z, 0.8);
      c.dead = 1.6; c.crashT = 3.0;
      flags.policeCrashes = (flags.policeCrashes || 0) + 1;
    }
  });
}

function plNearSolid(x, y, z) {
  let hit = false;
  forEachSolid(b => {
    if (hit || isSolidHidden(b)) return;
    if (Math.abs(x - b.x) < b.hw + 3 && Math.abs(z - b.z) < b.hd + 3 &&
        y > b.y0 - 3 && y < b.y1 + 3) hit = true;
  });
  if (!hit && typeof hwyTrafficNear === "function" && hwyTrafficNear(x, z, 6)) hit = true;
  return hit;
}

function plRespawn(c, fx, fz, rx, rz) {
  const side = c.role % 2 ? 1 : -1;
  c.x = state.x - fx * (PL.spawnBehind + 20) + rx * side * PL.spawnSide;
  c.z = state.z - fz * (PL.spawnBehind + 20) + rz * side * PL.spawnSide;
  c.y = plRoadY(c.x, c.z);
  c.heading = state.heading;
  c.speed = state.speed;
  c.dead = 0;
}

// ---- the pull-over --------------------------------------------------------
// One angled in front, one behind, lights strobing, a wave, 3-2-1 in the shared
// numerals, and away. Nothing is taken and nothing is required: he can drive
// off through the whole of it if he wants to, and the scene simply ends.
function plPullOver(dt, fx, fz, rx, rz) {
  const P = PL.pullOver;
  const total = P.count + P.hold + P.leave;
  police.cars.forEach((c, i) => {
    if (c.dead > 0) return;
    const front = i === 0;
    const tx = state.x + fx * (front ? P.gap : -P.gap);
    const tz = state.z + fz * (front ? P.gap : -P.gap);
    c.x += (tx - c.x) * Math.min(1, 3.2 * dt);
    c.z += (tz - c.z) * Math.min(1, 3.2 * dt);
    c.y += (plRoadY(c.x, c.z) - c.y) * Math.min(1, 8 * dt);
    const want = state.heading + (front ? 1 : -1) * P.angle * DEG;
    c.heading += clamp(wrapPi(want - c.heading), -2.2 * dt, 2.2 * dt);
    c.speed = 0;
    // the wave: the officer's arm, out of the window, and nothing else moves
    const u = c.g.userData;
    if (u.arm) u.arm.rotation.z = front ? Math.sin(police.t * 5) * 0.9 - 0.3 : 0;
  });

  // one short blip as they settle, then the numerals
  if (police.t < dt * 2 && typeof synthBlip === "function") synthBlip("sine", 620, 760, 0.28, 0.05, 0);
  // The shared countdown numerals, the same ones every wind-up in the game uses
  // -- and numerals are the one thing that is allowed on screen, only while a
  // wind-up is actually running.
  const left = P.count + P.hold - police.t;
  if (left > 0 && left <= P.count + 0.001) countdownTo(left, P.count);
  else if (left <= 0) countdownClear();

  if (police.t > total - P.leave) { police.state = "leaving"; police.t = 0; countdownClear(); }
  // and he can simply drive away out of it, at any point
  if (state.speed > PL.caughtSpeed * 2.2) { police.state = "leaving"; police.t = 0; countdownClear(); }
}

// ---- peeling off ----------------------------------------------------------
function plLeave(dt, fx, fz) {
  police.cars.forEach((c) => {
    if (c.dead > 0) return;
    c.speed += clamp(14 - c.speed, -30 * dt, 30 * dt);
    const away = c.role % 2 ? 0.7 : -0.7;
    c.heading += away * dt * 0.7;
    c.x += -Math.sin(c.heading) * c.speed * dt;
    c.z += -Math.cos(c.heading) * c.speed * dt;
    c.y += (plRoadY(c.x, c.z) - c.y) * Math.min(1, 8 * dt);
    const u = c.g.userData;
    if (u.arm) u.arm.rotation.z = 0;
  });
  if (police.t > PL.pullOver.leave) policeStop(true);
}

// ---- the test surface ------------------------------------------------------
function policeState() {
  return {
    active: police.active, state: police.state, scheme: police.schemeKey,
    chaseT: +police.chaseT.toFixed(2),
    nearest: police.active ? +Math.min(...police.cars.map(c => Math.hypot(c.x - state.x, c.z - state.z))).toFixed(1) : null,
    cars: police.cars.map(c => ({ x: Math.round(c.x), z: Math.round(c.z), dead: +c.dead.toFixed(2) })),
    bigNum: el.bigNum ? el.bigNum.textContent : "",
  };
}
