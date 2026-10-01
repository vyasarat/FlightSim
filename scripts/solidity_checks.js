"use strict";
// ---------------------------------------------------------------------------
// THE SOLIDITY SWEEP (v129): every vehicle into every kind of solid.
//
// The bug behind this file kept coming back in one shape -- a solid was only
// solid for the vehicle it had been built for -- and every earlier check asked
// one vehicle about one wall. This one asks all of them about all of them.
//
// 1. THE REGISTRY. Every record in the one registry (solids.js) has a kind from
//    SOLID_KINDS and blocks every vehicle class unless it says otherwise; every
//    vehicle has a class, a radius and a crawl speed; and no vehicle keeps a
//    collision list of its own (read from the source, not assumed).
// 2. THE MATRIX. For every vehicle x every kind of solid, a real instance of it,
//    reachable by that vehicle, is driven or flown into at CRUISE and at CRAWL
//    through the vehicle's own update: cruise must be a crash (and a free
//    reassembly), crawl a shove. The verdict is judged from signals any build
//    has -- did it explode, did its centre get inside the thing -- so the same
//    scenarios replay on an older build for the BEFORE matrix:
//        node scripts/solidity_checks.js <old-root>     (prints before and after)
//    A cell no vehicle of that kind can physically reach is "-" and says why.
// 3. THE KNOWN FAILURES, each with its own proof: the rover's ramps are surfaces
//    it drives up (launch measured on every ramp at three speeds), the bore is a
//    corridor (the car steered at both walls, the roof from above), and no
//    traffic route crosses a runway, taxiway, apron or road except at a junction
//    or on a bridge (roadCrossings, streets.js).
// ---------------------------------------------------------------------------
const fs = require("fs"), path = require("path");

const VEHS = ["plane", "heli", "rocket", "car", "boat", "yacht", "rover", "drone"];
const KINDS = ["building", "wall", "pillar", "tunnel", "portal", "ramp", "rock",
               "dome", "pad", "parked", "crane", "container", "ship", "bridge"];

// ---- in the page: the runner. Build-neutral on purpose (it replays on v128):
// it touches only state, the vehicle objects and api calls both builds have.
function install() {
  const L = window.__lp, st = L.state;
  L.noRender = true;
  const CARD = { plane: "prop", heli: "helicopter", rocket: "rocket", car: "car", boat: "speedboat", yacht: "yacht" };
  const R = { plane: 3, heli: 3, rocket: 3, car: 3, boat: 4.5, yacht: 17, rover: 2.2, drone: 1.6 };
  const T = L.TUNE;
  const speeds = () => ({
    plane: { cruise: st.vp && st.vp.cruiseSpeed || 60 },
    heli: { cruise: T.heli.cruise * 0.7, crawl: 6 },
    rocket: { cruise: 80 },
    car: { cruise: T.car ? T.car.cruise : 46, crawl: 10 },
    boat: { cruise: T.boat.cruise, crawl: 10 },
    yacht: { cruise: T.yacht.cruise, crawl: 3.5 },
    rover: { cruise: T.rover.cruise, crawl: 3.5 },
    drone: { cruise: T.marsBase.drone.cruise, crawl: 4 },
  });
  const fwd = h => [-Math.sin(h), -Math.cos(h)];
  const headingOf = (dx, dz) => Math.atan2(-dx, -dz);

  // Is a point inside a target shape (no inflation)?
  function inside(t, x, y, z) {
    if (t.o3) {
      const o = t.o3, d = [x - o.c[0], y - o.c[1], z - o.c[2]], A = [o.u, o.v, o.w];
      for (let j = 0; j < 3; j++) if (Math.abs(d[0] * A[j][0] + d[1] * A[j][1] + d[2] * A[j][2]) > o.e[j]) return false;
      return true;
    }
    if (t.cap) {
      const a = t.cap.a, b = t.cap.b, ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const l2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2] || 1e-9;
      const k = Math.max(0, Math.min(1, ((x - a[0]) * ab[0] + (y - a[1]) * ab[1] + (z - a[2]) * ab[2]) / l2));
      return Math.hypot(x - a[0] - ab[0] * k, y - a[1] - ab[1] * k, z - a[2] - ab[2] * k) < t.cap.r;
    }
    return Math.abs(x - t.x) < t.hw && Math.abs(z - t.z) < t.hd && y > t.y0 - 1 && y < t.y1;
  }

  function counters() {
    const f = L.flags;
    return (f.exploded || 0) + (f.carCrashes || 0) + (f.boatCrashes || 0) + (f.yachtCrashes || 0) +
           (f.roverCrashes || 0) + (f.droneCrashes || 0) + (f.rocketCrashes || 0);
  }

  // ---- Earth: put a vehicle at a spawn, pointing along `dir`, moving at v.
  // Is the target standing there now? Town buildings stream in around him, and
  // a blast hides what it shatters -- neither is solid while it is not there.
  function present(t) {
    let ok = false;
    L.forEachSolid(b => {
      if (ok) return;
      if (t.o3 ? (b.o3 && Math.abs(b.o3.c[0] - t.o3.c[0]) < 0.5 && Math.abs(b.o3.c[2] - t.o3.c[2]) < 0.5)
               : (!b.o3 && !b.cap && Math.abs(b.x - t.x) < 0.5 && Math.abs(b.z - t.z) < 0.5 && Math.abs(b.y0 - t.y0) < 0.5)) {
        ok = !(b.mesh && (b.mesh.visible === false || (b.mesh.parent && b.mesh.parent.visible === false)));
      }
    });
    return ok;
  }
  function place(sc) {
    const s = sc.spawn;
    if (L.restoreShattered) L.restoreShattered();
    st.exploding = false; st.explodeTimer = 0;
    L.api.setVehicle(CARD[sc.veh]);
    L.api.spawnAt(0, 0);
    for (let i = 0; i < 20; i++) L.update(1 / 60);
    st.exploding = false;
    st.x = s.x; st.z = s.z; st.y = s.y; st.heading = s.h; st.speed = sc.v;
    if (sc.veh === "plane") { st.phase = "AIRBORNE"; st.pitch = 0; st.bank = 0; st.engaged = false; st.approachData = null; st.liftoffTimer = 0; st.gearDown = false; }
    if (sc.veh === "heli") { st.phase = "AIRBORNE"; heli.altitude = s.y; heli.vy = 0; heli.target = null; heli.vertical = 0; }
    if (sc.veh === "rocket") {
      st.phase = "AIRBORNE"; L.rk.onBody = null; L.rk.stage = 3; st.pitch = 0;
      // its reference point is not its body: put the body's lowest point where
      // the spawn says, and judge "inside" from there
      const hl = typeof rocketHalfLen === "function" ? rocketHalfLen() : 0;
      sc.spawn.y += hl; sc.yOff = -hl; st.y = sc.spawn.y;
    }
    if (sc.veh === "car" && typeof car !== "undefined") { car.steer = 0; car.crashCool = 0; car.boost = 0; }
    if (sc.veh === "boat" && typeof boat !== "undefined") { boat.air = 0; boat.crashCool = 0; boat.beach = 0; }
  }
  function force(sc) {
    const s = sc.spawn, f = fwd(s.h);
    st.heading = s.h; st.speed = sc.v;
    if (sc.veh === "plane") { st.pitch = 0; st.bank = 0; st.y = s.y; }
    if (sc.veh === "heli") { heli.vx = f[0] * sc.v; heli.vz = f[1] * sc.v; heli.vy = 0; heli.altitude = s.y; st.y = s.y; heli.target = null; }
    if (sc.veh === "rocket") { L.rk.vx = f[0] * sc.v; L.rk.vz = f[1] * sc.v; L.rk.vy = 0; st.y = s.y; }
    if (sc.veh === "yacht" && typeof yacht !== "undefined") yacht.steer = 0;
  }
  // Mars: the targets are laid out the same in any build, from marsPlace's own
  // numbers, so the old build can be asked the same question.
  function marsTargets() {
    const MB = T.marsBase, b = L.mars.body, n = L.mars.n, out = [];
    const sp = (dist, ang) => surfacePoint(b, n, dist, ang);
    const up = p => [p.dir.x, p.dir.y, p.dir.z];
    for (let i = 0; i < MB.domes; i++) { const p = sp(MB.spread * 0.62, 0.7 + i * 1.5); out.push({ kind: "dome", id: "dome" + i, p, t: { cap: { a: [p.x, p.y, p.z], b: [p.x, p.y, p.z], r: MB.domeR } }, ext: MB.domeR }); }
    { const p = sp(MB.spread * 0.5, 3.4); out.push({ kind: "building", id: "garage", p, t: { cap: { a: [p.x, p.y, p.z], b: [p.x, p.y, p.z], r: 8 } }, ext: 12 }); }
    for (let i = 0; i < MB.masts; i++) { const p = sp(MB.spread * 0.75, 2.2 + i * 1.15), u = up(p); out.push({ kind: "pillar", id: "mast" + i, p, t: { cap: { a: [p.x, p.y, p.z], b: [p.x + u[0] * 20, p.y + u[1] * 20, p.z + u[2] * 20], r: 0.8 } }, ext: 1, h: 4 }); }
    for (let i = 0; i < MB.parked; i++) { const p = sp(MB.spread * 1.05, 4.4 + i * 0.42), u = up(p); out.push({ kind: "parked", id: "ship" + i, p, t: { cap: { a: [p.x, p.y, p.z], b: [p.x + u[0] * 40, p.y + u[1] * 40, p.z + u[2] * 40], r: 3.4 } }, ext: 3.6, h: 6 }); }
    // a ramp from the SIDE is a wall
    L.mars.jumps.forEach((j, i) => {
      const J = MB.jumps, d = j.dir;
      const nrm = new THREE.Vector3(j.x - b.x, j.y - b.y, j.z - b.z).normalize();
      const side = new THREE.Vector3(d.x, d.y, d.z).cross(nrm).normalize();
      const mid = { x: j.x + d.x * J.len * 0.75, y: j.y + d.y * J.len * 0.75, z: j.z + d.z * J.len * 0.75, dir: nrm };
      out.push({ kind: "ramp", id: "jump" + i, p: mid, side: [side.x, side.y, side.z], ramp: { o: [j.x, j.y, j.z], dir: [d.x, d.y, d.z], len: J.len, w: J.w }, ext: J.w / 2, h: 1 });
    });
    const boulder = (L.rover.toys || []).find(t => t.kind === "boulder" && !t.sunk);
    if (boulder) out.push({ kind: "rock", id: "boulder", p: { x: boulder.x, y: boulder.y, z: boulder.z, dir: new THREE.Vector3(boulder.x - b.x, boulder.y - b.y, boulder.z - b.z).normalize() }, toy: boulder, ext: 1.5, t: { cap: { a: [boulder.x, boulder.y, boulder.z], b: [boulder.x, boulder.y, boulder.z], r: 1.5 } } });
    return out;
  }
  function landMars() {
    const b = L.BODIES[1];
    L.api.setVehicle("starship"); L.api.placeOnRunway();
    st.dest = b.name; st.phase = "TAXI"; L.rk.onBody = b; L.rk.stage = 1;
    const nn = new THREE.Vector3(0.62, 0.5, 0.6).normalize();
    st.x = b.x + nn.x * (b.r + 12); st.y = b.y + nn.y * (b.r + 12); st.z = b.z + nn.z * (b.r + 12);
    st.exploding = false;
    L.update(1 / 60);
    if (!L.mars.g && L.marsBuild) L.marsBuild();
    L.roverDeploy();
    for (let i = 0; i < 30; i++) L.update(1 / 60);
  }
  // Mars scenario: the rover or the drone at `dist` metres from a target along
  // a tangent, heading at it.
  function runMars(sc) {
    const b = L.mars.body, tg = marsTargets().find(q => q.id === sc.target);
    if (!tg) return { out: "missing" };
    const nrm = tg.p.dir;
    // the approach direction: along the ground, from a fixed tangent (or the ramp's side)
    let d = tg.side ? new THREE.Vector3(...tg.side) : new THREE.Vector3(1, 0, 0).addScaledVector(nrm, -nrm.x).normalize();
    if (sc.flip) d.negate();
    const v = sc.v, dist = tg.ext + R[sc.veh] + Math.max(8, v * 0.6);
    const c0 = counters(), h0 = JSON.stringify(L.flags.solidHits || {});
    let entered = false, moved = 0, bang = false;
    const toy0 = tg.toy ? [tg.toy.x, tg.toy.y, tg.toy.z] : null;
    if (sc.veh === "rover") {
      const R_ = L.rover;
      if (!R_.active) L.roverDeploy();
      if (L.marsDroneActive && L.marsDroneActive()) L.marsDroneLand();   // the rover waits while the drone flies
      R_.bangT = 0; if (R_.mesh) R_.mesh.visible = true;
      const s = new THREE.Vector3(tg.p.x, tg.p.y, tg.p.z).addScaledVector(d, dist);
      const sn = s.clone().sub(new THREE.Vector3(b.x, b.y, b.z)).normalize();
      R_.x = b.x + sn.x * (b.r + 0.9); R_.y = b.y + sn.y * (b.r + 0.9); R_.z = b.z + sn.z * (b.r + 0.9);
      R_.h = 0; R_.vh = 0; R_.f.copy(d).negate(); R_.onRamp = null; R_.gPrev = 0; R_.returning = false;
      const frames = Math.round(60 * Math.min(8, (dist + tg.ext * 2 + 12) / v + 1));
      for (let i = 0; i < frames; i++) {
        if (L.mars.phase === "armed") L.mars.phase = "idle";
        L.mars.wentOut = false;
        if (!R_.bangT) R_.speed = v;
        L.update(1 / 60);
        if (R_.bangT > 0) bang = true;
        if (tg.toy) { if (Math.hypot(R_.x - tg.toy.x, R_.y - tg.toy.y, R_.z - tg.toy.z) < 1.2) entered = true; }
        else if (tg.t && inside(tg.t, R_.x, R_.y, R_.z)) entered = true;
        if (tg.ramp) {
          const rp = tg.ramp, dx = R_.x - rp.o[0], dy = R_.y - rp.o[1], dz = R_.z - rp.o[2];
          const a = dx * rp.dir[0] + dy * rp.dir[1] + dz * rp.dir[2];
          const s2 = dx * tg.side[0] + dy * tg.side[1] + dz * tg.side[2];
          if (a > 2 && a < rp.len - 1 && Math.abs(s2) < rp.w / 2 - 1.5 && R_.h < 0.5) entered = true;
        }
      }
      if (toy0) moved = Math.hypot(tg.toy.x - toy0[0], tg.toy.y - toy0[1], tg.toy.z - toy0[2]);
      R_.bangT = 0; if (R_.mesh) R_.mesh.visible = true;
    } else {
      const dr = L.mars.drone;
      if (!dr) return { out: "missing" };
      if (!dr.active) { dr.x = L.rover.x; dr.y = L.rover.y; dr.z = L.rover.z; if (L.marsDroneCan && L.marsDroneCan()) L.marsDronePress(); }
      if (!dr.active) return { out: "missing" };
      dr.bangT = 0; dr.g.visible = true; dr.home = false; dr.grace = 0;
      const hh = tg.h !== undefined ? tg.h : Math.min(6, tg.ext * 0.5);
      const s = new THREE.Vector3(tg.p.x, tg.p.y, tg.p.z).addScaledVector(d, dist);
      const sn = s.clone().sub(new THREE.Vector3(b.x, b.y, b.z)).normalize();
      dr.x = b.x + sn.x * (b.r + hh); dr.y = b.y + sn.y * (b.r + hh); dr.z = b.z + sn.z * (b.r + hh); dr.h = hh; dr.vh = 0;
      dr.f.copy(d).negate();
      const frames = Math.round(60 * Math.min(8, (dist + tg.ext * 2 + 12) / v + 1));
      for (let i = 0; i < frames; i++) {
        if (!dr.bangT) { dr.speed = v; dr.h = hh; dr.vh = 0; dr.f.copy(d).negate(); }
        L.update(1 / 60);
        if (dr.bangT > 0) bang = true;
        if (tg.t && inside(tg.t, dr.x, dr.y, dr.z)) entered = true;
        if (tg.ramp) {
          const rp = tg.ramp, dx = dr.x - rp.o[0], dy = dr.y - rp.o[1], dz = dr.z - rp.o[2];
          const a = dx * rp.dir[0] + dy * rp.dir[1] + dz * rp.dir[2], s2 = dx * tg.side[0] + dy * tg.side[1] + dz * tg.side[2];
          if (a > 2 && a < rp.len - 1 && Math.abs(s2) < rp.w / 2 - 1) entered = true;
        }
      }
      if (toy0) moved = Math.hypot(tg.toy.x - toy0[0], tg.toy.y - toy0[1], tg.toy.z - toy0[2]);
      dr.bangT = 0; dr.g.visible = true;
    }
    const crashed = bang || counters() > c0;
    const hits = JSON.stringify(L.flags.solidHits || {}) !== h0;
    return { out: crashed ? "crash" : entered ? "through" : toy0 && moved > 1 ? "moves" : hits ? "shove" : "untouched", moved: +moved.toFixed(1) };
  }

  function runEarth(sc) {
    place(sc);
    // hold at the spawn while the scenery streams in around him
    const v = sc.v;
    sc.v = 0;
    for (let i = 0; i < 40; i++) { force(sc); st.x = sc.spawn.x; st.z = sc.spawn.z; if (sc.veh !== "car") st.y = sc.spawn.y; L.update(1 / 60); st.exploding = false; }
    sc.v = v;
    st.x = sc.spawn.x; st.z = sc.spawn.z; st.y = sc.spawn.y;
    if (!sc.replay && !present(sc.target)) return { out: "missing" };
    const w0 = (L.flags.wallHits || 0) + (L.flags.solidShoves || 0);
    const c0 = counters(), t = sc.target, f = fwd(sc.spawn.h);
    let entered = false, bang = false, minAlong = Infinity;
    const frames = Math.round(60 * sc.secs);
    for (let i = 0; i < frames; i++) {
      force(sc);
      L.update(1 / 60);
      if (st.exploding) { bang = true; break; }
      if (inside(t, st.x, st.y + (sc.veh === "car" ? 1 : 0) + (sc.yOff || 0) + (sc.veh === "rocket" ? 1 : 0), st.z)) { entered = true; }
      // past its far side with nothing ever touched counts as through too (a
      // shove that slides him round a thin pillar is not)
      const along = (st.x - sc.spawn.x) * f[0] + (st.z - sc.spawn.z) * f[1];
      if (along > sc.farAlong && (L.flags.wallHits || 0) + (L.flags.solidShoves || 0) === w0) entered = true;
    }
    const crashed = bang || counters() > c0;
    st.exploding = false;
    return { out: crashed ? "crash" : entered ? "through" : "shove" };
  }

  // ---- a ramp, driven up from its foot at speed v: does he leave the lip, and
  // how high does he go? Build-neutral: it reads only the rover's height.
  function landOn(b) {
    L.api.setVehicle("starship"); L.api.placeOnRunway();
    st.dest = b.name; st.phase = "TAXI"; L.rk.onBody = b; L.rk.stage = 1;
    const nn = new THREE.Vector3(0.62, 0.5, 0.6).normalize();
    st.x = b.x + nn.x * (b.r + 12); st.y = b.y + nn.y * (b.r + 12); st.z = b.z + nn.z * (b.r + 12);
    st.exploding = false;
    L.update(1 / 60);
    if (b.name === "mars" && !L.mars.g && L.marsBuild) L.marsBuild();
    if (L.rover.active) { L.rover.active = false; }
    L.roverDeploy();
    for (let i = 0; i < 20; i++) L.update(1 / 60);
  }
  function ramps() {
    const out = [];
    (L.rover.toys || []).filter(t => t.kind === "ramp").forEach((t, i) => {
      const len = T.rover.ramp ? T.rover.ramp.len : 8, rise = T.rover.ramp ? T.rover.ramp.rise : 2.2;
      out.push({ id: L.rover.body.name + "-toy" + i, foot: [t.x - t.dir.x * len / 2, t.y - t.dir.y * len / 2, t.z - t.dir.z * len / 2], dir: [t.dir.x, t.dir.y, t.dir.z], len, rise });
    });
    if (L.rover.body.name === "mars") L.mars.jumps.forEach((j, i) => out.push({ id: "mars-jump" + i, foot: [j.x, j.y, j.z], dir: [j.dir.x, j.dir.y, j.dir.z], len: T.marsBase.jumps.len, rise: T.marsBase.jumps.rise }));
    return out;
  }
  function rampRun(rp, v) {
    const R_ = L.rover, b = R_.body;
    if (L.marsDroneActive && L.marsDroneActive()) L.marsDroneLand();
    R_.bangT = 0; if (R_.mesh) R_.mesh.visible = true; R_.returning = false; R_.stuck = false;
    const s = new THREE.Vector3(rp.foot[0] - rp.dir[0] * 25, rp.foot[1] - rp.dir[1] * 25, rp.foot[2] - rp.dir[2] * 25);
    const sn = s.clone().sub(new THREE.Vector3(b.x, b.y, b.z)).normalize();
    R_.x = b.x + sn.x * (b.r + 0.9); R_.y = b.y + sn.y * (b.r + 0.9); R_.z = b.z + sn.z * (b.r + 0.9);
    R_.h = 0; R_.vh = 0; R_.onRamp = null; R_.gPrev = 0;
    R_.f.set(rp.dir[0], rp.dir[1], rp.dir[2]);
    let peak = 0, air = 0, pastLip = false, crashed = false, onIt = 0;
    const j0 = (L.flags.roverJumps || 0) + (L.flags.marsJumps || 0);
    for (let i = 0; i < 60 * 7; i++) {
      // (the lit pad is his way home: driven over after going far enough out it
      // parks him and launches the rocket -- keep it disarmed for this)
      if (L.mars && L.mars.phase === "armed") L.mars.phase = "idle";
      if (L.mars) L.mars.wentOut = false;
      R_.speed = v; R_.f.addScaledVector(R_.n, -R_.f.dot(R_.n));
      L.update(1 / 60);
      if (R_.bangT > 0) { crashed = true; break; }
      const a = (R_.x - rp.foot[0]) * rp.dir[0] + (R_.y - rp.foot[1]) * rp.dir[1] + (R_.z - rp.foot[2]) * rp.dir[2];
      if (a > 0 && a < rp.len && R_.h > 0.1) onIt++;
      if (a > rp.len) { pastLip = true; peak = Math.max(peak, R_.h); if (R_.h > 0.5) air += 1 / 60; }
      if (pastLip && R_.h <= 0 && air > 0) break;
    }
    return { v: +v.toFixed(1), peak: +peak.toFixed(2), air: +air.toFixed(2), climbed: onIt > 5, crashed,
             jumps: (L.flags.roverJumps || 0) + (L.flags.marsJumps || 0) - j0 };
  }

  window.__sm = {
    landOn, ramps, rampRun,
    speeds, landMars, marsTargets, runMars, runEarth, counters,
    run(sc) { try { return sc.mars ? runMars(sc) : runEarth(sc); } catch (e) { return { out: "error", err: String(e).slice(0, 200) }; } },
  };
  return true;
}

// ---- in the page, NEW build only: find, for every vehicle and kind, a real
// instance it can reach and an approach to it that meets nothing else first.
function generate() {
  const L = window.__lp, st = L.state, T = L.TUNE;
  const R = { plane: 3, heli: 3, rocket: 3, car: 3, boat: 4.5, yacht: 17 };
  const CLS = { plane: L.SOLID.AIR, heli: L.SOLID.AIR, rocket: L.SOLID.AIR, car: L.SOLID.CAR, boat: L.SOLID.BOAT, yacht: L.SOLID.BOAT };
  const V = window.__sm.speeds();
  const byKind = {};
  L.forEachSolid(b => { const k = L.solidKind(b); if (b.car !== undefined || b.toy || b.ramp) return; (byKind[k] = byKind[k] || []).push(b); });
  const snap = b => b.o3 ? { o3: JSON.parse(JSON.stringify(b.o3)) } : b.cap ? { cap: JSON.parse(JSON.stringify(b.cap)) } : { x: b.x, z: b.z, hw: b.hw, hd: b.hd, y0: b.y0, y1: b.y1 };
  const ground = (x, z) => L.terrainEff(x, z);
  const wet = (x, z, deep) => L.terrainEff(x, z) < L.seaLevelAt(x, z) - deep;
  // horizontal faces of a record: [centre of the face, outward normal, depth behind it]
  function faces(b) {
    if (b.o3) {
      const o = b.o3, out = [];
      for (const [ax, e, far] of [[o.u, o.e[0], o.e[0] * 2], [o.w, o.e[2], o.e[2] * 2]]) {
        if (Math.abs(ax[1]) > 0.2) continue;
        for (const s of [1, -1]) out.push({ x: o.c[0] + ax[0] * e * s, z: o.c[2] + ax[2] * e * s, nx: ax[0] * s, nz: ax[2] * s, far, y0: b.y0, y1: b.y1 });
      }
      return out;
    }
    return [
      { x: b.x + b.hw, z: b.z, nx: 1, nz: 0, far: b.hw * 2, y0: b.y0, y1: b.y1 }, { x: b.x - b.hw, z: b.z, nx: -1, nz: 0, far: b.hw * 2, y0: b.y0, y1: b.y1 },
      { x: b.x, z: b.z + b.hd, nx: 0, nz: 1, far: b.hd * 2, y0: b.y0, y1: b.y1 }, { x: b.x, z: b.z - b.hd, nx: 0, nz: -1, far: b.hd * 2, y0: b.y0, y1: b.y1 },
    ];
  }
  const out = [], why = {};
  for (const veh of ["plane", "heli", "rocket", "car", "boat", "yacht"]) {
    for (const kind of Object.keys(byKind)) {
      for (const mode of ["cruise", "crawl"]) {
        const v = V[veh][mode];
        if (!v) { why[veh + ":" + kind + ":" + mode] = veh === "plane" ? "a plane on the ground is rail-locked to its runway's centreline, and in the air never slower than 18 m/s" : "its landing envelope, not a crawl, decides (rocket)"; continue; }
        const list = byKind[kind];
        const stride = Math.max(1, Math.floor(list.length / 80));
        let found = null;
        for (let i = 0; i < list.length && !found; i += stride) {
          const b = list[i];
          if (L.solidBlocks && !L.solidBlocks(b, CLS[veh])) continue;
          if (b.mesh && (b.mesh.visible === false)) continue;
          if (b.park && !b.park.drawn) continue;
          for (const fc of faces(b)) {
            const r = R[veh], stand = r + Math.max(10, v * 0.4);
            const sx = fc.x + fc.nx * stand, sz = fc.z + fc.nz * stand;
            let y;
            const air = veh === "plane" || veh === "heli" || veh === "rocket";
            if (air) {
              y = (fc.y0 + fc.y1) / 2;
              const floor = Math.max(ground(sx, sz), T.waterLevel) + (veh === "heli" ? 3 : veh === "rocket" ? 4 : T.terrainClearance + 2);
              if (y < floor) y = Math.min(fc.y1 - 1.5, floor);
              if (y < floor - 0.1 || y > fc.y1 - 1) continue;
            } else if (veh === "car") {
              y = ground(sx, sz);
              if (wet(sx, sz, 0) || !(fc.y0 < y + 2 && fc.y1 > y + 1)) continue;
            } else {
              y = T.waterLevel;
              if (!wet(sx, sz, veh === "yacht" ? 3 : 1) || !(fc.y1 > y + 0.5 && fc.y0 < y + 2)) continue;
            }
            // the path in: clear of everything but this kind, and fit for the vehicle
            let ok = true;
            const n = Math.ceil(stand / 2);
            for (let k = 0; k <= n && ok; k++) {
              const t = k / n, px = sx - fc.nx * stand * t, pz = sz - fc.nz * stand * t;
              if (air && Math.max(ground(px, pz), T.waterLevel) > y - (veh === "heli" ? 2.5 : veh === "rocket" ? 3.5 : T.terrainClearance + 1.5)) ok = false;
              if (veh === "car" && (wet(px, pz, 0) || Math.abs(ground(px, pz) - y) > 2.5)) ok = false;
              if ((veh === "boat" || veh === "yacht") && k < n - Math.ceil(r / 2) && !wet(px, pz, veh === "yacht" ? 2 : 0.5)) ok = false;
              const hit = (veh === "boat" || veh === "yacht") ? solidCol(px, pz, T.waterLevel - 0.5, T.waterLevel + 2.5, r, CLS[veh])
                                                            : L.solidQuery(px, y + (veh === "car" ? 1 : 0), pz, r, CLS[veh]);
              if (hit && L.solidKind(hit.b) !== kind) ok = false;
            }
            if (!ok) continue;
            found = { veh, kind, mode, v, spawn: { x: sx, y: veh === "car" ? y : y, z: sz, h: Math.atan2(fc.nx, fc.nz) },
                      target: snap(b), farAlong: stand + fc.far + r, secs: Math.min(10, (stand + fc.far + 30) / v + 1.5) };
            break;
          }
        }
        if (found) out.push(found);
        else why[veh + ":" + kind + ":" + mode] = "no " + kind + " it can reach with a clear run in";
      }
    }
  }
  return { scenarios: out, why };
}

function marsScenarios(page) {
  return page.evaluate(() => {
    window.__sm.landMars();
    const V = window.__sm.speeds(), out = [];
    for (const tg of window.__sm.marsTargets()) {
      for (const veh of ["rover", "drone"]) for (const mode of ["cruise", "crawl"]) {
        if (veh === "drone" && tg.kind === "rock") continue;
        out.push({ mars: true, veh, kind: tg.kind, mode, v: V[veh][mode], target: tg.id });
      }
    }
    return out;
  });
}

// Run a list of scenarios on a page, one kind at a time per vehicle (the first
// instance that runs clean decides the cell; Mars ones after the Earth ones).
async function runAll(page, earth, mars) {
  await page.evaluate(install);
  const res = [];
  for (const sc of earth) res.push({ ...sc, ...(await page.evaluate(s => window.__sm.run(s), sc)) });
  if (mars.length) {
    await page.evaluate(() => window.__sm.landMars());
    // one cell per (veh, kind, mode): the first target of that kind
    const seen = new Set();
    for (const sc of mars) {
      const key = sc.veh + ":" + sc.kind + ":" + sc.mode;
      if (seen.has(key)) continue;
      seen.add(key);
      res.push({ ...sc, ...(await page.evaluate(s => window.__sm.run(s), sc)) });
    }
  }
  return res;
}

// The printed matrix: a row per vehicle, a column per kind, "cruise/crawl".
const SYM = { crash: "C", shove: "S", through: "T", moves: "M", missing: "?", error: "E", untouched: "U" };
function table(res, why) {
  const cell = (veh, kind, mode) => {
    const r = res.find(q => q.veh === veh && q.kind === kind && q.mode === mode);
    return r ? SYM[r.out] || "?" : "-";
  };
  const w = 10;
  let s = "vehicle".padEnd(8) + KINDS.map(k => k.slice(0, w - 1).padStart(w)).join("") + "\n";
  for (const veh of VEHS) s += veh.padEnd(8) + KINDS.map(k => (cell(veh, k, "cruise") + "/" + cell(veh, k, "crawl")).padStart(w)).join("") + "\n";
  return s + "  C crash+reassemble  S shove  T THROUGH  M moves (a toy: it rolls away)  - cannot reach one";
}

// What each cell must be.
function want(r) {
  if (r.veh === "rover" && r.kind === "rock") return ["moves", "shove"];   // the toy boulder: shoved at any speed, never passed
  return r.mode === "cruise" ? ["crash"] : ["shove"];
}

async function rampSweep(page) {
  await page.evaluate(install);
  const out = [];
  for (const body of [1, 0]) {
    const list = await page.evaluate(bi => { window.__sm.landOn(window.__lp.BODIES[bi]); return window.__sm.ramps(); }, body);
    for (const rp of list) {
      const runs = [];
      for (const k of [0.6, 1.0, 1.5]) runs.push(await page.evaluate(([rp, k]) => window.__sm.rampRun(rp, window.__lp.TUNE.rover.cruise * k), [rp, k]));
      out.push({ id: rp.id, rise: rp.rise, runs });
    }
  }
  return out;
}

async function sweep(page) {
  const gen = await page.evaluate(generate);
  const mars = await marsScenarios(page);
  return { gen, mars };
}

module.exports = async function solidityChecks({ newPage, check }) {
  const { page, errors } = await newPage(1024, 768);
  await page.evaluate(install);

  // ---- 1. the registry
  const reg = await page.evaluate(() => {
    const L = window.__lp, bad = [], kinds = {};
    L.forEachSolid(b => {
      const k = L.solidKind(b);
      kinds[k] = (kinds[k] || 0) + 1;
      if (!L.SOLID_KINDS.includes(k)) bad.push("kind:" + k);
      if (b.blocks !== undefined && b.blocks !== L.SOLID.ALL && !b.allowNarrow) bad.push("narrow:" + k);
    });
    const vehs = {};
    for (const k of Object.keys(L.VEHICLE_CONTRACT)) vehs[k] = { cls: L.VEHICLE_CONTRACT[k].solidClass, r: L.TUNE.solid.r[k], crawl: L.TUNE.solid.crawl[k] };
    return { bad, kinds, vehs };
  });
  const src = f => fs.readFileSync(path.join(__dirname, "..", "cockpit", "js", f), "utf8");
  const ownLists = ["boat.js", "yacht.js", "rover.js", "marsbase.js", "car.js", "heli.js", "flight.js", "rocket.js"]
    .filter(f => /for \(const \w+ of harbor\.solids\)/.test(src(f).replace(/.*blip\(.*\n/g, "")) || /for \(const \w+ of (mars|rover)\.(solids|obstacles)\)/.test(src(f)));
  const vehOk = Object.entries(reg.vehs).every(([k, v]) => v.cls && v.r > 0 && v.crawl !== undefined);
  check("solidity: ONE registry -- every solid has a kind and blocks every vehicle class, every vehicle has a class, a radius and a crawl, and no vehicle sweeps a list of its own",
    reg.bad.length === 0 && vehOk && ownLists.length === 0, JSON.stringify({ bad: reg.bad.slice(0, 5), kinds: reg.kinds, vehs: reg.vehs, ownLists }));

  // ---- 2. the matrix
  const { gen, mars } = await sweep(page);
  const { page: p2 } = await newPage(1024, 768);
  const res = await runAll(p2, gen.scenarios, mars);
  await p2.context().close();
  const tbl = table(res, gen.why);
  console.log("\nSOLIDITY MATRIX (after)\n" + tbl);
  const wrong = res.filter(r => !want(r).includes(r.out)).map(r => `${r.veh}:${r.kind}:${r.mode}=${r.out}${r.err ? " " + r.err : ""}`);
  const through = res.filter(r => r.out === "through").map(r => `${r.veh}:${r.kind}:${r.mode}`);
  check("solidity: the matrix -- every vehicle into every kind of solid it can reach, cruise = crash + reassemble, crawl = shove, and not one cell passes through",
    through.length === 0 && wrong.length === 0 && res.length > 60,
    JSON.stringify({ cells: res.length, through, wrong, na: Object.keys(gen.why).length }));
  if (process.env.SOLIDITY_OUT) fs.writeFileSync(process.env.SOLIDITY_OUT, JSON.stringify({ gen, mars, res }, null, 1));

  // ---- 3a. RAMPS ARE SURFACES: every ramp on Mars and the Moon, at three speeds
  const { page: p3 } = await newPage(1024, 768);
  const rampRes = await rampSweep(p3);
  await p3.context().close();
  console.log("RAMPS (peak height over the ground after the lip, m; air time, s)\n" +
    rampRes.map(r => "  " + r.id.padEnd(14) + r.runs.map(q => `${q.v} m/s: ${q.peak} m ${q.air} s${q.crashed ? " CRASH" : ""}`).join("   ")).join("\n"));
  const rampBad = rampRes.filter(r => !r.runs.every(q => q.climbed && !q.crashed && q.peak > r.rise * 0.9 && q.air > 0.3) ||
                                     !(r.runs[2].peak > r.runs[0].peak));
  check("solidity: a ramp is a surface the rover drives UP -- on every ramp (Mars's jumps, the toy ramps on Mars and the Moon) at three speeds it climbs the slope, leaves the lip and flies, higher the faster it came",
    rampRes.length >= 10 && rampBad.length === 0, JSON.stringify({ ramps: rampRes.length, bad: rampBad.map(r => r.id) }));

  // ---- 3b. THE BORE IS A CORRIDOR: hands-off straight through, a wall either
  // side of every tube, and a roof over it
  const { page: p4 } = await newPage(1024, 768);
  const bore = await p4.evaluate(() => {
    const L = window.__lp, st = L.state, H = L.highway, out = { tubes: [] };
    const bores = H.bores || [];
    out.bores = bores.length;
    for (const bo of bores) {
      const mid = bo.pts[Math.floor(bo.pts.length / 2)];
      const lat = (L.TUNE.highway.medianW / 2 + H.halfW) / 2;
      for (const side of [-1, 1]) {           // each tube
        const tube = { side };
        for (const steer of [-1, 1]) {        // at each of its walls
          if (L.restoreShattered) L.restoreShattered();
          L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
          const rx = -mid.fz, rz = mid.fx, c = side;   // carriageway side: right of the centreline for +1
          st.x = mid.x + rx * lat * c; st.z = mid.z + rz * lat * c; st.y = mid.y; st.exploding = false;
          // aim 30 degrees off the road's line at the wall
          const road = Math.atan2(-mid.fx * c, -mid.fz * c);
          const h = road + steer * 0.55;
          const c0 = L.flags.carCrashes || 0, w0 = L.flags.wallHits || 0;
          let left = false;
          for (let i = 0; i < 60 * 3; i++) {
            st.heading = h; st.speed = L.TUNE.car.cruise; L.update(1 / 60);
            if (st.exploding) break;
            const n = L.hwyNearest(st.x, st.z);
            if (Math.abs(n.lateral) > H.halfW + 6 || Math.abs(n.lateral) < 1) left = true;
          }
          tube[steer < 0 ? "left" : "right"] = { crash: (L.flags.carCrashes || 0) > c0, walls: (L.flags.wallHits || 0) - w0, gotOut: left };
          st.exploding = false;
        }
        // the roof: a helicopter rising in the tube
        L.api.setVehicle("helicopter"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
        st.phase = "AIRBORNE"; st.x = mid.x - mid.fz * lat * side; st.z = mid.z + mid.fx * lat * side; st.y = mid.y + 4; st.exploding = false;
        let roofY = -Infinity; const w0 = L.flags.wallHits || 0;
        for (let i = 0; i < 60 * 4; i++) { heli.vx = 0; heli.vz = 0; heli.vy = 3; heli.target = null; heli.altitude = st.y + 1; L.update(1 / 60); roofY = Math.max(roofY, st.y - mid.y); if (st.exploding) break; }
        tube.roof = { maxUp: +roofY.toFixed(1), hits: (L.flags.wallHits || 0) - w0, crown: +(L.TUNE.highway.tunnelR * 1.42).toFixed(1) };
        st.exploding = false;
        out.tubes.push(tube);
      }
    }
    return out;
  });
  await p4.context().close();
  const tubesOk = bore.tubes.length >= 2 && bore.tubes.every(t => t.left.crash && t.right.crash && !t.left.gotOut && !t.right.gotOut &&
    t.roof.hits > 0 && t.roof.maxUp < t.roof.crown);
  check("solidity: the bore is a corridor -- steered at cruise into either wall of either tube it is a bang, never out through it, and a helicopter rising in the tube meets the roof under the crown",
    tubesOk, JSON.stringify(bore));

  // ---- 3c. WHERE ROADS MAY CROSS: only at a junction or on a bridge
  const cross = await page.evaluate(() => window.__lp.roadCrossings());
  check("solidity: no traffic route crosses a runway, a taxiway, an apron or another road except at a junction or on a bridge (roadCrossings)",
    cross.length === 0, JSON.stringify(cross.slice(0, 8)));

  await page.context().close();
  return { gen, mars, res };
};
module.exports.install = install;
module.exports.runAll = runAll;
module.exports.table = table;

// BEFORE AND AFTER: generate the scenarios on this build, run them here, then
// replay the very same ones on an older build (a checkout at <old-root>).
//   node scripts/solidity_checks.js <old-root>
if (require.main === module) {
  (async () => {
    const { launch, serve } = require("./art_rig.js");
    const oldRoot = path.resolve(process.argv[2]);
    const newRoot = path.resolve(__dirname, "..");
    const browser = await launch();
    const open = async (root, port) => {
      const srv = serve(root, port);
      const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
      await ctx.addInitScript(() => {
        try { localStorage.clear(); } catch (e) {}
        let seed = 0x2F6E2B1; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
        window.__rafQueue = []; window.__simTime = 0; window.requestAnimationFrame = cb => { window.__rafQueue.push(cb); return window.__rafQueue.length; };
      });
      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${port}/cockpit/index.html`, { timeout: 120000 });
      await page.waitForFunction(() => !!window.__lp, null, { timeout: 60000 });
      await page.waitForFunction(() => !window.__lp.artReady || window.__lp.artReady(), null, { timeout: 60000 });
      await page.evaluate(() => window.__lp.api.skipScreens());
      return { page, srv, ctx };
    };
    const A = await open(newRoot, 8193);
    await A.page.evaluate(install);
    const gen = await A.page.evaluate(generate);
    const mars = await marsScenarios(A.page);
    const B = await open(newRoot, 8194);
    const after = await runAll(B.page, gen.scenarios, mars);
    const C = await open(oldRoot, 8195);
    const before = await runAll(C.page, gen.scenarios.map(s => ({ ...s, replay: true })), mars.map(s => ({ ...s, replay: true })));
    const rampsAfter = await rampSweep(B.page), rampsBefore = await rampSweep(C.page);
    const rline = rs => rs.map(r => "  " + r.id.padEnd(14) + r.runs.map(q => `${q.v}: ${q.peak} m/${q.air} s${q.climbed ? "" : " (no climb)"}`).join("  ")).join("\n");
    console.log("RAMPS BEFORE (peak over ground after the lip / air time)\n" + rline(rampsBefore) + "\nRAMPS AFTER\n" + rline(rampsAfter) + "\n");
    console.log("SOLIDITY MATRIX -- BEFORE (" + oldRoot + ")\n" + table(before, gen.why));
    console.log("\nSOLIDITY MATRIX -- AFTER\n" + table(after, gen.why));
    console.log("\ncells not reachable:\n" + Object.entries(gen.why).map(([k, v]) => "  " + k + ": " + v).join("\n"));
    const out = path.join(newRoot, "evidence", "solidity");
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, "matrix.json"), JSON.stringify({ gen, mars, before, after, rampsBefore, rampsAfter }, null, 1));
    await browser.close(); for (const X of [A, B, C]) X.srv.close();
  })();
}
