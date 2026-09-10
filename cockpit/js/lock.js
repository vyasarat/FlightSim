"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- the lock, and the dock it lifts him into.
//
// THE PROBLEM IT SOLVES. A lock with one water level is not a lock, it is a
// gate. This game has one sea plane at TUNE.waterLevel, so rather than assert a
// difference that is not there, the far side of this one is a new place: an
// impounded dock cut into the headland north of the harbour and held six metres
// up, whose only way in or out by water is the chamber. The lift is then
// honestly earned, and being six metres up is its own payoff -- from in there
// he can see over the spit to the sea.
//
// HOW THE SECOND LEVEL IS ALLOWED TO EXIST. CLAUDE.md says water is
// `terrainEff < waterLevel` and nothing else, because water defined twice
// drifts apart from the ground under it. This does not add a second definition:
// `seaLevelAt` in terrain.js is now the single answer to "how high is the water
// here", and `lockLevelAt` below is the only thing that ever gives it a
// different one. Everything that floats asks seaLevelAt. The rule holds; it
// takes a position now.
//
// The ground does the rest, and terrain.js cuts it in the order that matters:
// the DOCK floor is left ABOVE the global sea, so the world's water plane never
// appears in it and the only thing filling it is the dock's own surface; the
// CHAMBER floor goes BELOW it, because the chamber must hold water at both
// heights.
//
// THE LOOP IS EVERY OTHER SET-PIECE'S LOOP. A giant obvious thing (a fifty-metre
// gap in a wall, with red beacons), one control (one contextual button, which
// only exists when he is actually in the chamber), a visible wind-up (bells,
// beacons, the shared countdown numerals), a huge payoff (the water and his
// whole boat move, and a new place opens), and a free reset (the gates re-open
// on their own, and sitting still long enough lets him straight back out).
//
// IT IS NEVER THE WAY ANYWHERE, and this is the rule the sea events live by too.
// The harbour mouth under the drawbridge is still wide open and still the way to
// the sea. The lock leads only to the dock. Nothing is required, nothing is
// blocked, nothing is taken away -- and NEVER STUCK is absolute: idling in the
// chamber re-opens the gate he came in by, and a boat that somehow ends up on
// the wrong side of a shut gate is let through rather than held.
//
// BOTH BOATS FIT. The chamber is fifty metres wide and a hundred and forty
// long: five beams and nearly three lengths of the yacht. That is absurd for a
// real lock and exactly right for a four-year-old lining a ship up on a gap.
// ---------------------------------------------------------------------------

const LK = TUNE.lock;

const lock = {
  g: null, built: false,
  gates: { s: null, n: null },     // each { pivots: [left, right], open: 0..1 }
  beacons: [], sillLamps: [],
  fill: 0,                          // 0 = harbour level, 1 = dock level
  state: "idle",                    // idle | warn | closing | filling | opening | done
  t: 0,                             // the timer the current phase runs on
  dir: 1,                           // 1 = lifting him to the dock, -1 = letting him down
  idle: 0,                          // how long he has sat in the chamber doing nothing
  clock: 0,
  water: null,                      // the chamber's own animated surface
  dockWater: null,                  // ... and the dock's, which never moves
  wasInside: false,
};

const LK_LOW = () => TUNE.waterLevel;
const LK_HIGH = () => TUNE.waterLevel + LK.lift;

// ---------------------------------------------------------------------------
// THE ONE PLACE A SECOND WATER LEVEL COMES FROM.
//
// Returns the surface height at a point, or null to mean "the world's own sea".
// The chamber's answer moves with `fill`, which is what makes the lift visible:
// the water goes up and his whole boat goes up with it, because the boat asks
// this every frame for its resting height.
// ---------------------------------------------------------------------------
function lockLevelAt(x, z) {
  if (!lock.built) return null;
  if (lkIn(x, z, LK.chamber)) return lerp(LK_LOW(), LK_HIGH(), lock.fill);
  if (lkIn(x, z, LK.dock) || lkIn(x, z, LK.approachN)) return LK_HIGH();
  return null;
}

// Rect test with no feather: the water's edge is the masonry, which is a hard
// line, unlike the terrain blend that shapes the ground under it.
function lkIn(x, z, r) {
  return x >= r.x[0] && x <= r.x[1] && z >= r.z[0] && z <= r.z[1];
}
function lkCx(r) { return (r.x[0] + r.x[1]) / 2; }
function lkCz(r) { return (r.z[0] + r.z[1]) / 2; }

// Is he in the chamber, clear of both gate lines? `insideMargin` keeps a hull
// that is still half through a gateway from counting as in.
function lockInside(x, z) {
  return x >= LK.chamber.x[0] && x <= LK.chamber.x[1] &&
         z >= LK.gateS + LK.insideMargin && z <= LK.gateN - LK.insideMargin;
}

function lockBoatInside() {
  return (typeof boatActive === "function" && (boatActive() || yachtActive())) &&
         lockInside(state.x, state.z);
}

// ---------------------------------------------------------------------------
// The build. Masonry, two pairs of gates, the beacons, and the dock beyond.
// Everything that does not move is merged; only the gate leaves are their own
// objects, exactly as the drawbridge does it.
// ---------------------------------------------------------------------------
function lockBuild() {
  if (lock.built) return;
  const C = TUNE.palette;
  lock.g = new THREE.Group();
  scene.add(lock.g);

  const conc = mattMat(C.concrete);
  const dark = mattMat(C.slate);
  const boxes = [];
  const push = (x, y, z, w, h, d) => boxes.push({ x, y, z, w, h, d });

  const cx = lkCx(LK.chamber);
  const halfW = (LK.chamber.x[1] - LK.chamber.x[0]) / 2;
  const zS = LK.gateS, zN = LK.gateN;
  const midZ = (zS + zN) / 2, lenZ = zN - zS;
  const floor = TUNE.waterLevel - LK.chamberDepth;

  // ---- the chamber walls: two long masonry runs either side of the gap
  for (const s of [-1, 1]) {
    const wx = cx + s * (halfW + LK.wallT / 2);
    push(wx, (floor + LK.wallY) / 2, midZ, LK.wallT, LK.wallY - floor, lenZ + 60);
    lockSolid(wx, floor, midZ, LK.wallT / 2, (lenZ + 60) / 2, LK.wallY);
  }
  // ---- the sills: a low step in the floor under each gate, so the gap reads
  for (const z of [zS, zN]) {
    push(cx, floor + 0.6, z, halfW * 2 + LK.wallT * 2, 1.2, 3.4);
  }
  // ---- the quay around the dock, and the wharf edge he can see over
  const D = LK.dock;
  const dTop = TUNE.waterLevel + LK.lift + 1.4;
  for (const s of [-1, 1]) {
    push(lkCx(D) + s * ((D.x[1] - D.x[0]) / 2 + 5), dTop - 3, lkCz(D), 10, 6, D.z[1] - D.z[0] + 20);
    lockSolid(lkCx(D) + s * ((D.x[1] - D.x[0]) / 2 + 5), dTop - 6, lkCz(D), 5, (D.z[1] - D.z[0] + 20) / 2, dTop);
  }
  push(lkCx(D), dTop - 3, D.z[1] + 5, D.x[1] - D.x[0] + 20, 6, 10);
  lockSolid(lkCx(D), dTop - 6, D.z[1] + 5, (D.x[1] - D.x[0] + 20) / 2, 5, dTop);

  // ---- the wharf, north of the dock, and what stands on it.
  //
  // Everything here sits on the RIM, not on `dTop`. The first pass measured the
  // sheds from the quay's coping instead and buried them five metres into the
  // headland -- from the water they read as brown slabs floating over a field.
  // The rim is the ground up here; that is what things stand on.
  const wharfY = LK.rim.y;
  const wharfZ = (D.z[1] + LK.rim.z[1]) / 2;
  for (let i = 0; i < LK.sheds; i++) {
    const sx = lerp(D.x[0] + 80, D.x[1] - 80, LK.sheds === 1 ? 0.5 : i / (LK.sheds - 1));
    push(sx, wharfY + 5, wharfZ, 62, 10, 30);
    lockSolid(sx, wharfY, wharfZ, 31, 15, wharfY + 10);
  }
  lock.g.add(lkMergeBoxes(boxes, conc));

  // Container stacks along the east side of the wharf: colour and a sense of
  // scale, and the one thing that says this is a working dock rather than a
  // pond. Machines and boxes only, as everywhere else.
  const stackBoxes = [];
  for (let i = 0; i < LK.stacks; i++) {
    const sz = lerp(D.z[1] + 24, LK.rim.z[1] - 40, LK.stacks === 1 ? 0.5 : i / (LK.stacks - 1));
    for (let k = 0; k < 3; k++) stackBoxes.push({ x: D.x[1] + 34, y: wharfY + 1.4 + k * 2.7, z: sz, w: 6, h: 2.6, d: 13 });
  }
  if (stackBoxes.length) lock.g.add(lkMergeBoxes(stackBoxes, mattMat(C.rust)));

  // ---- the gates. Two leaves each, hinged on the walls, swinging back flat.
  for (const [key, gz] of [["s", zS], ["n", zN]]) {
    const pivots = [];
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(cx + s * halfW, floor, gz);
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(halfW, LK.gateH, LK.gateT), dark);
      // hinged at the wall: the leaf hangs inboard of its pivot
      leaf.position.set(-s * halfW / 2, LK.gateH / 2, 0);
      leaf.castShadow = true;
      pivot.add(leaf);
      lock.g.add(pivot);
      pivots.push({ pivot, side: s });
    }
    lock.gates[key] = { pivots, open: 0, z: gz };
  }

  // ---- the beacons: red lamps on the wall heads, which is the wind-up
  const lampGeo = new THREE.SphereGeometry(1.5, 8, 6);
  for (let i = 0; i < LK.beacons; i++) {
    const s = i % 2 ? 1 : -1;
    const z = i < 2 ? zS : zN;
    const m = new THREE.Mesh(lampGeo, new THREE.MeshBasicMaterial({ color: 0x5a1b16 }));
    m.position.set(cx + s * (halfW + LK.wallT / 2), LK.wallY + 2.2, z);
    lock.g.add(m);
    lock.beacons.push(m);
  }

  // ---- the two water surfaces.
  //
  // The chamber's moves; the dock's never does. Both are their own quads
  // because the world's plane is a single sheet at TUNE.waterLevel and cannot
  // be in two places. They sit fractionally proud of it so there is nothing to
  // z-fight with when the chamber is at the low level and the two coincide.
  const wmat = () => new THREE.MeshPhongMaterial({
    color: TUNE.water.color, transparent: true, opacity: 0.92,
    specular: TUNE.water.specular, shininess: TUNE.water.shininess,
  });
  // The chamber's quad spans EXACTLY gate to gate. It used to overhang into the
  // approaches, which meant that once the chamber filled, six metres of raised
  // water stood over the harbour outside the shut gate.
  lock.water = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2, lenZ), wmat());
  lock.water.rotation.x = -Math.PI / 2;
  lock.water.position.set(cx, TUNE.waterLevel + 0.03, midZ);
  lock.g.add(lock.water);

  // The dock's, which never moves: one quad per rect rather than one bounding
  // box over both, because the approach is fifty metres wide and the dock five
  // hundred -- a single quad would have laid water across the rim.
  lock.dockWater = [];
  for (const r of [D, LK.approachN]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(r.x[1] - r.x[0], r.z[1] - r.z[0]), wmat());
    w.rotation.x = -Math.PI / 2;
    w.position.set(lkCx(r), LK_HIGH() + 0.03, lkCz(r));
    lock.g.add(w);
    lock.dockWater.push(w);
  }

  lock.built = true;
  lockApplyGates();
}

// A box that the boat bumps and anything flying hits, in both lists at once --
// the harbour's rule, so the two can never disagree.
function lockSolid(x, y0, z, hw, hd, y1) {
  const b = { x, y0, z, hw, hd, y1, mesh: null };
  staticSolids.push(b);
  return b;
}

// The harbour's merge helper adds straight into `harbor.g`; this one hands the
// mesh back so the lock owns its own group.
function lkMergeBoxes(specs, mat) {
  const m = new THREE.Mesh(carMergeBoxes(specs), mat);
  m.castShadow = true;
  m.receiveShadow = false;
  return m;
}

// ---------------------------------------------------------------------------
// The cycle.
//
// One button, and it only exists when he is in the chamber. Pressing it starts
// the wind-up; the wind-up is bells, beacons and the shared countdown numerals;
// then the gates shut, the water moves with his boat on it, and the far gate
// opens. Nothing here can fail and nothing can be lost.
// ---------------------------------------------------------------------------
function lockCanCycle() {
  return lock.built && lock.state === "idle" && lockBoatInside() && !state.exploding;
}

function lockPress() {
  if (!lockCanCycle()) return false;
  // Which way is out? Whichever level he is NOT at.
  lock.dir = lock.fill < 0.5 ? 1 : -1;
  lock.state = "warn";
  lock.t = LK.warn;
  lkBells();
  flags.lockCycles = (flags.lockCycles || 0) + 1;
  return true;
}

function lockUpdate(dt) {
  if (!lock.built) return;
  lock.clock += dt;

  const inside = lockBoatInside();
  // NEVER STUCK. Sitting in the chamber doing nothing for long enough re-opens
  // the gate he came in by, so there is no way to be shut in.
  if (inside && lock.state === "idle") {
    lock.idle += dt;
    if (lock.idle > LK.idleReset) lkOpenSide(lock.fill < 0.5 ? "s" : "n");
  } else if (!inside) {
    lock.idle = 0;
  }

  switch (lock.state) {
    case "idle": {
      // With nobody in it the chamber offers its gate to whoever comes near --
      // an approach that opens itself, so a four-year-old never has to aim at a
      // shut gate.
      if (!inside) {
        const near = lkNearestGate();
        if (near) lkOpenSide(near);
        else lkCloseBoth();
      }
      break;
    }
    case "warn": {
      lock.t -= dt;
      setBigNum(Math.max(1, Math.ceil(lock.t)));
      if (lock.t <= 0) { lock.state = "closing"; lock.t = LK.gateTime; setBigNum(null); lkRumble(); }
      break;
    }
    case "closing": {
      lock.t -= dt;
      lkCloseBoth();
      if (lock.t <= 0) { lock.state = "filling"; lock.t = LK.fillTime; }
      break;
    }
    case "filling": {
      lock.t -= dt;
      const k = clamp(1 - lock.t / LK.fillTime, 0, 1);
      lock.fill = lock.dir > 0 ? k : 1 - k;
      if (lock.t <= 0) {
        lock.fill = lock.dir > 0 ? 1 : 0;
        lock.state = "opening"; lock.t = LK.gateTime;
        lkRumble();
      }
      break;
    }
    case "opening": {
      lock.t -= dt;
      lkOpenSide(lock.dir > 0 ? "n" : "s");
      if (lock.t <= 0) { lock.state = "idle"; lock.idle = 0; chime(); }
      break;
    }
  }

  lockApplyGates(dt);
  lkBeacons();
  if (lock.water) lock.water.position.y = lerp(LK_LOW(), LK_HIGH(), lock.fill) + 0.03;
}

// Which gate is a boat approaching, if any? Only ever the one on the side he is
// actually on -- opening both would drain the dock.
function lkNearestGate() {
  if (typeof boatActive !== "function") return null;
  if (!(boatActive() || yachtActive())) return null;
  const cx = lkCx(LK.chamber);
  if (Math.abs(state.x - cx) > 180) return null;
  const dS = Math.abs(state.z - LK.gateS), dN = Math.abs(state.z - LK.gateN);
  // he must be on the OUTSIDE of that gate, and the chamber must already be at
  // that gate's level or the water would fall out of it
  if (dS < LK.nearGate && state.z < LK.gateS && lock.fill < 0.02) return "s";
  if (dN < LK.nearGate && state.z > LK.gateN && lock.fill > 0.98) return "n";
  return null;
}

function lkOpenSide(side) {
  const other = side === "s" ? "n" : "s";
  lock.gates[side].want = 1;
  lock.gates[other].want = 0;
}
function lkCloseBoth() { lock.gates.s.want = 0; lock.gates.n.want = 0; }

function lockApplyGates(dt) {
  const rate = dt ? dt / LK.gateTime : 1;
  for (const key of ["s", "n"]) {
    const g = lock.gates[key];
    if (g.want === undefined) g.want = 0;
    g.open += clamp(g.want - g.open, -rate, rate);
    const ang = g.open * LK.gateOpenDeg * DEG;
    for (const p of g.pivots) p.pivot.rotation.y = p.side * ang;
  }
}

// The beacons: red, alternating, and only while something is about to move or
// is moving. Silence and darkness the rest of the time, so they mean something.
function lkBeacons() {
  const live = lock.state !== "idle";
  const on = live && Math.sin(lock.clock * 9) > 0;
  for (const [i, m] of lock.beacons.entries()) {
    m.material.color.setHex(live && (on === (i % 2 === 0)) ? 0xff3b30 : 0x5a1b16);
  }
}

// The voice. Bells first, then the hydraulics -- nothing this big moves in this
// game without announcing itself, which is the set-piece rule.
function lkBells() {
  for (let i = 0; i < 6; i++) synthBlip("triangle", 820, 620, 0.17, 0.05, i * 0.36);
  for (let i = 0; i < 6; i++) synthBlip("triangle", 1120, 860, 0.13, 0.032, 0.09 + i * 0.36);
}
function lkRumble() {
  noiseBurst(2.0, 260, 0.10, 0);
  synthBlip("sawtooth", 40, 56, 2.4, 0.07, 0.05);
  synthBlip("sine", 96, 84, 1.8, 0.04, 0.1);
}

// The contextual button. It exists only while he is in the chamber with the
// gates at rest, which is the one moment pressing it means anything.
function lockUpdateButton() {
  const show = lockCanCycle();
  el.lockBtn.classList.toggle("hidden", !show);
}

lockBuild();
