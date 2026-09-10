"use strict";
// WORKING RULES
// Things to do at sea. EIGHT of them now, and every one obeys the same three
// rules the space events obey: it may never be REQUIRED, it may never BLOCK
// anything, and it may never TAKE ANYTHING AWAY.
//
//   * a rival jet-ski that races him to the rig and back and never wins
//   * the carrier's wake wall, which rocks whatever he is in
//   * a whale, breaching a long way off, that nothing can ever happen to
//   * a cruise ship arriving, escorted in by the harbour's own tug
//   * a gantry crane that will put a container on the yacht's foredeck if she
//     honks for one, and take it off again if she honks twice
//   * a seaplane that lands on the water beside him and takes off again
//   * a submarine that boils, surfaces, runs and dives
//   * a fireboat that throws three arcs of water over the harbour
//
// THE POOL IS MEANT TO KEEP GROWING. The harbour is the third place he can lose
// a whole session in, after the toy world and the space programme, and it gets
// the same treatment they did: more things happening, none of them announced on
// the HUD, none of them his responsibility. The one rejected direction is the
// fishing boat -- it does not come back.
//
// THE NEW THREE ARE ALL MACHINES AND ALL `noSolid`. They move, so they could
// otherwise wander into his path and become a wall between him and somewhere --
// which is "blocking", and forbidden. The ferry and the road traffic are
// scenery on the same terms.
//
// NOTHING LIVING IS HITTABLE. The whale is the only creature out here and it
// follows the astronaut's rule, not the paper planes': it is not a target, not
// solid, not shatterable, and he is flown and sailed straight through it. Make
// it hittable and it has to become a machine.
//
// NO WINNER, ANYWHERE. The jet-ski is rubber-banded like the rival rocket: it
// stays alongside whatever he does, so the race is a thing to be in rather than
// a thing to win, and there is nothing to lose by being slow.

const SE = TUNE.seaEvents;

const sea = {
  built: false,
  ski: { g: null, x: 0, z: 0, heading: 0, speed: 0, state: "away", t: 0, leg: 0, cool: 0, wakeT: 0 },
  whale: { g: null, t: 0, next: 6, x: 0, z: 0, heading: 0, up: 0 },
  cruise: { g: null, x: 0, z: 0, heading: 0, state: "away", t: 0, next: SE.cruise.first, s: 0, lights: null },
  crane: { box: null, state: "idle", t: 0, crane: null },
  wake: { t: 0, cool: 0 },
  plane: { g: null, state: "away", t: 0, next: SE.plane.first, x: 0, y: 0, z: 0, heading: 0, speed: 0, sprayT: 0, prop: null },
  sub: { g: null, state: "away", t: 0, next: SE.sub.first, x: 0, z: 0, depth: 0, heading: 0, puffT: 0 },
  fboat: { g: null, state: "away", t: 0, next: SE.fire.first, monitors: [], arcT: 0, jets: null, dummy: null },
  clock: 0,
};

// ---------------------------------------------------------------------------
function seaBuild() {
  if (sea.built) return;
  const C = TUNE.palette;

  // ---- the jet-ski. A machine, and nothing rides it: there is no one on it to
  // come off it, which is the simplest possible way to keep the rule.
  const ski = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 3.4), mattMat(C.warning));
  hull.position.y = 0.6; ski.add(hull);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.8, 6), mattMat(C.warning));
  nose.rotation.x = -Math.PI / 2; nose.position.set(0, 0.7, -2.2); ski.add(nose);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.45, 1.8), mattMat(C.ink));
  seat.position.set(0, 1.2, 0.3); ski.add(seat);
  const bars = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.14, 0.14), mattMat(C.ink));
  bars.position.set(0, 1.5, -1.0); ski.add(bars);
  const flash = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.3, 2.4), mattMat(C.red));
  flash.position.set(0, 0.5, 0.1); ski.add(flash);
  castsShadow(ski);
  ski.visible = false;
  scene.add(ski);
  sea.ski.g = ski;

  // ---- the whale. Scenery under the astronaut's rule: nothing can happen to it.
  const wh = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 9), mattMat(C.night));
  body.scale.set(SE.whale.beam, SE.whale.beam * 0.85, SE.whale.len);
  wh.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 7), mattMat(C.steel));
  belly.scale.set(SE.whale.beam * 0.72, SE.whale.beam * 0.42, SE.whale.len * 0.78);
  belly.position.y = -SE.whale.beam * 0.5; wh.add(belly);
  const fluke = new THREE.Mesh(new THREE.BoxGeometry(SE.whale.beam * 3.2, 0.5, SE.whale.beam * 1.1), mattMat(C.night));
  fluke.position.set(0, 0, SE.whale.len * 0.95); wh.add(fluke);
  for (const sx of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(SE.whale.beam * 1.5, 0.4, SE.whale.beam * 0.8), mattMat(C.night));
    fin.position.set(sx * SE.whale.beam * 1.1, -SE.whale.beam * 0.3, -SE.whale.len * 0.1);
    fin.rotation.z = sx * 0.4;
    wh.add(fin);
  }
  wh.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.userData.noSolid = true; o.userData.noShatter = true; } });
  wh.userData.noSolid = true;
  wh.userData.noShatter = true;
  wh.visible = false;
  scene.add(wh);
  sea.whale.g = wh;

  // ---- the cruise ship. Machines and structures only, as always.
  const cs = new THREE.Group();
  const CS = SE.cruise;
  const chull = new THREE.Mesh(new THREE.BoxGeometry(CS.beam, 20, CS.len), mattMat(C.white));
  chull.position.y = TUNE.waterLevel + 6; cs.add(chull);
  const cboot = new THREE.Mesh(new THREE.BoxGeometry(CS.beam + 0.6, 6, CS.len + 0.6), mattMat(C.blue));
  cboot.position.y = TUNE.waterLevel - 2; cs.add(cboot);
  const cbow = new THREE.Mesh(new THREE.CylinderGeometry(0.3, CS.beam / 2, 22, 6), mattMat(C.white));
  cbow.rotation.x = -Math.PI / 2; cbow.position.set(0, TUNE.waterLevel + 6, -CS.len / 2 - 10); cs.add(cbow);
  // decks, each a shade narrower than the one below it
  const lit = [];
  for (let d = 0; d < CS.decks; d++) {
    const w = CS.beam * (1 - d * 0.06), l = CS.len * (1 - d * 0.10);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(w, 5.4, l), mattMat(C.white));
    deck.position.set(0, TUNE.waterLevel + 17 + d * 6, -CS.len * 0.02 * d);
    cs.add(deck);
    const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 1.6, l * 0.98), mattMat(C.night));
    band.position.set(0, TUNE.waterLevel + 18 + d * 6, -CS.len * 0.02 * d);
    cs.add(band);
    // a row of lit windows down each side of each deck, not down its middle
    for (let i = 0; i < 9; i++) {
      const lz = ((i / 8) - 0.5) * l * 0.92 - CS.len * 0.02 * d;
      for (const sx of [-1, 1]) lit.push(new THREE.Vector3(sx * w / 2, TUNE.waterLevel + 18 + d * 6, lz));
    }
  }
  for (const sx of [-1, 1]) {
    const funnel = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 5.2, 13, 10), mattMat(C.red));
    funnel.position.set(sx * 7, TUNE.waterLevel + 17 + CS.decks * 6 + 5, CS.len * 0.16);
    cs.add(funnel);
  }
  // Her lights come up with the night the way the runway's do. There is no sky
  // button and there is not going to be one, so this is the whole of "night at
  // the harbour": everything that should be lit reads state.nightF and lights.
  const glow = glowField(lit, 0xfff0c4, CS.lightSize, 0);
  cs.add(glow);
  sea.cruise.lights = glow;
  castsShadow(cs);
  cs.visible = false;
  scene.add(cs);
  sea.cruise.g = cs;

  // ---- the seaplane. Floats, a high wing, and a spinner that turns.
  const SP = SE.plane;
  const pl = new THREE.Group();
  const pbody = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.7, SP.len, 8), mattMat(C.white));
  pbody.rotation.x = Math.PI / 2; pl.add(pbody);
  const pwing = new THREE.Mesh(new THREE.BoxGeometry(SP.span, 0.45, 3.0), mattMat(C.white));
  pwing.position.y = 1.7; pl.add(pwing);
  const pfin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.2, 2.2), mattMat(C.red));
  pfin.position.set(0, 2.2, SP.len * 0.42); pl.add(pfin);
  const ptail = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.35, 1.6), mattMat(C.white));
  ptail.position.set(0, 0.9, SP.len * 0.42); pl.add(ptail);
  for (const sx of [-1, 1]) {
    const flt = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, SP.len * 0.72), mattMat(C.blue));
    flt.position.set(sx * 2.6, -SP.floatDrop, 0.4); pl.add(flt);
    for (const dz of [-0.28, 0.3]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.3, SP.floatDrop, 0.3), mattMat(C.steel));
      strut.position.set(sx * 2.6, -SP.floatDrop / 2, SP.len * dz); pl.add(strut);
    }
  }
  const spinner = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.3, 0.3), mattMat(C.steel));
  spinner.position.set(0, 0.4, -SP.len * 0.5); pl.add(spinner);
  sea.plane.prop = spinner;
  seaScenery(pl);
  pl.visible = false; scene.add(pl); sea.plane.g = pl;

  // ---- the submarine. A hull, a sail and a rudder: a machine, nothing aboard.
  const SU = SE.sub;
  const sb = new THREE.Group();
  const shull = new THREE.Mesh(new THREE.CylinderGeometry(SU.beam / 2, SU.beam / 2, SU.len, 12), mattMat(C.night));
  shull.rotation.x = Math.PI / 2; sb.add(shull);
  for (const sz of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.ConeGeometry(SU.beam / 2, SU.len * 0.14, 12), mattMat(C.night));
    cap.rotation.x = sz * Math.PI / 2; cap.position.z = sz * (SU.len / 2 + SU.len * 0.07); sb.add(cap);
  }
  const sail = new THREE.Mesh(new THREE.BoxGeometry(SU.beam * 0.5, SU.sailH, SU.sailL), mattMat(C.night));
  sail.position.set(0, SU.beam / 2 + SU.sailH / 2 - 1, -SU.len * 0.1); sb.add(sail);
  const plane2 = new THREE.Mesh(new THREE.BoxGeometry(SU.beam * 2.1, 0.5, 3.2), mattMat(C.night));
  plane2.position.set(0, SU.beam / 2 + SU.sailH * 0.55, -SU.len * 0.1); sb.add(plane2);
  const rudder = new THREE.Mesh(new THREE.BoxGeometry(0.6, SU.beam * 1.5, 4.0), mattMat(C.night));
  rudder.position.set(0, 0, SU.len * 0.46); sb.add(rudder);
  seaScenery(sb);
  sb.visible = false; scene.add(sb); sea.sub.g = sb;

  // ---- the fireboat, moored, with three monitors that elevate.
  const FB = SE.fire;
  const fb = new THREE.Group();
  const fhull = new THREE.Mesh(new THREE.BoxGeometry(FB.beam, 4.2, FB.len), mattMat(C.red));
  fhull.position.y = TUNE.waterLevel + 1.0; fb.add(fhull);
  const fdeck = new THREE.Mesh(new THREE.BoxGeometry(FB.beam + 0.6, 0.5, FB.len), mattMat(C.white));
  fdeck.position.y = TUNE.waterLevel + 3.1; fb.add(fdeck);
  const fhouse = new THREE.Mesh(new THREE.BoxGeometry(FB.beam * 0.7, 4.0, FB.len * 0.3), mattMat(C.white));
  fhouse.position.set(0, TUNE.waterLevel + 5.3, FB.len * 0.2); fb.add(fhouse);
  for (let i = 0; i < FB.monitors; i++) {
    const m = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 2.4, 8), mattMat(C.steel));
    post.position.y = 1.2; m.add(post);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 3.0, 8), mattMat(C.warning));
    barrel.position.set(0, 2.6, 0); barrel.rotation.x = -Math.PI / 2; m.add(barrel);
    m.position.set(0, TUNE.waterLevel + 3.3, lerp(-FB.len * 0.34, FB.len * 0.04, FB.monitors === 1 ? 0.5 : i / (FB.monitors - 1)));
    fb.add(m);
    sea.fboat.monitors.push({ g: m, barrel, side: i === 1 ? 0 : (i === 0 ? -1 : 1) });
  }
  // Her water: one instanced mesh of droplets, drawn once, owing nothing to the
  // shared puff pool. MeshBasic because water thrown into California sunshine is
  // the brightest thing in the shot -- Lambert-shaded droplets at two hundred
  // metres came out grey and read as smoke, which is the exact complaint the
  // speedboat's wake earned.
  sea.fboat.jets = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 6, 4),
    new THREE.MeshBasicMaterial({ color: 0xf2f4f7, transparent: true, opacity: 0.85 }),
    FB.monitors * FB.drops);
  sea.fboat.jets.frustumCulled = false;
  sea.fboat.jets.visible = false;
  fb.add(sea.fboat.jets);
  sea.fboat.dummy = new THREE.Object3D();
  seaScenery(fb);
  fb.visible = false; scene.add(fb); sea.fboat.g = fb;

  sea.built = true;
}

// Scenery that MOVES is never a wall. The ferry and the road traffic are marked
// the same way: these three wander about the harbour, and a moving solid is a
// thing that can end up between him and where he is going, which is the
// "never blocks anything" rule broken by accident.
function seaScenery(g) {
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.userData.noSolid = true; } });
  g.userData.noSolid = true;
}

// ---------------------------------------------------------------------------
function updateSeaEvents(dt) {
  if (!sea.built) return;
  const d = Math.hypot(state.x - HB.cx, state.z - (-6800));
  if (d > SE.range) { seaHideAll(); return; }
  sea.clock += dt;
  seaSki(dt);
  seaWhale(dt);
  seaCruise(dt);
  seaCarrierWake(dt);
  seaCraneDrop(dt);
  seaPlane(dt);
  seaSub(dt);
  seaFireboat(dt);
  seaNight();
}
function seaHideAll() {
  if (sea.ski.g) sea.ski.g.visible = false;
  if (sea.whale.g) sea.whale.g.visible = false;
  if (sea.plane.g) sea.plane.g.visible = false;
  if (sea.sub.g) sea.sub.g.visible = false;
  if (sea.fboat.g) sea.fboat.g.visible = false;
  // The seaplane's engine is driven once a frame by seaPlane(), and this is the
  // one path that stops calling it. Without this the engine note would follow
  // him out of the harbour and sit under everything for the rest of the
  // session -- the same leak the car's whine and the yacht's diesel had.
  if (typeof setTone === "function") setTone("seaPlane", "sawtooth", SE.plane.engineHz[0], 0);
  if (sea.cruise.g && sea.cruise.state === "away") sea.cruise.g.visible = false;
}

// ---------------------------------------------------------------------------
// The race.
//
// Rubber-banded, exactly like the rival rocket: its speed is set from how far
// ahead or behind it is, not from a throttle of its own. So it is always
// alongside, whatever he does, and there is no way to lose it and no way to
// beat it. There is no finish line and nothing is counted.
// ---------------------------------------------------------------------------
function seaChannelNear(x, z) {
  let best = 1e9;
  const P = HB.buoys.path;
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i];
    const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1;
    const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / l2, 0, 1);
    best = Math.min(best, Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t)));
  }
  return best;
}
function seaSki(dt) {
  const S = sea.ski, C = SE.ski;
  if (S.cool > 0) S.cool -= dt;
  const eligible = typeof boatActive === "function" && boatActive() && !state.exploding &&
    state.speed > C.minSpeed && seaChannelNear(state.x, state.z) < C.channelR;

  if (S.state === "away") {
    S.g.visible = false;
    if (eligible && S.cool <= 0) {
      // it comes past him from behind, which is how a challenge announces itself
      const fx = -Math.sin(state.heading), fz = -Math.cos(state.heading);
      const rx = -fz, rz = fx;
      S.x = state.x - fx * C.startBehind + rx * C.side;
      S.z = state.z - fz * C.startBehind + rz * C.side;
      S.heading = state.heading;
      S.speed = state.speed * 1.15;
      S.state = "race";
      S.t = 0;
      S.g.visible = true;
      synthBlip("sawtooth", 420, 700, 0.5, 0.05, 0);
      flags.skiRaces = (flags.skiRaces || 0) + 1;
    }
    return;
  }

  // ---- racing
  S.t += dt;
  if (!eligible || S.t > C.maxTime) {
    S.state = "away";
    S.cool = C.cooldown;
    S.g.visible = false;
    return;
  }
  // stay alongside: aim at a point beside him, `side` metres off his beam
  const fx = -Math.sin(state.heading), fz = -Math.cos(state.heading);
  const rx = -fz, rz = fx;
  const lead = Math.sin(sea.clock * C.weave) * C.leadSwing;      // it noses ahead and drops back
  const tx = state.x + fx * lead + rx * C.side;
  const tz = state.z + fz * lead + rz * C.side;
  const want = Math.atan2(-(tx - S.x), -(tz - S.z));
  S.heading += wrapPi(want - S.heading) * Math.min(1, C.turn * dt);
  // THE RUBBER BAND. Its speed comes from the gap, never from a throttle, so it
  // cannot get away from him and he cannot get away from it.
  const gap = Math.hypot(tx - S.x, tz - S.z);
  const wantSpeed = clamp(state.speed + (gap - 6) * C.band, 0, BT.cruise * BT.burst * 1.1);
  S.speed += clamp(wantSpeed - S.speed, -C.accel * dt, C.accel * dt);
  S.x += -Math.sin(S.heading) * S.speed * dt;
  S.z += -Math.cos(S.heading) * S.speed * dt;
  S.g.position.set(S.x, TUNE.waterLevel + Math.sin(sea.clock * 3.1) * 0.35, S.z);
  S.g.rotation.set(0.10, S.heading, Math.sin(sea.clock * 2.2) * 0.10);
  S.wakeT -= dt;
  if (S.wakeT <= 0 && S.speed > 6) {
    S.wakeT = 0.08;
    wakePuff(S.x + Math.sin(S.heading) * 3, TUNE.waterLevel + 0.5, S.z + Math.cos(S.heading) * 3,
      0xf2f4f7, 1.4, 6, 0.8);
  }
}

// ---------------------------------------------------------------------------
// The whale. A long way off, on its own timetable, and nothing can reach it.
// ---------------------------------------------------------------------------
function seaWhale(dt) {
  const W = sea.whale, C = SE.whale;
  if (W.up > 0) {
    W.up -= dt;
    const k = 1 - W.up / C.riseTime;                 // 0..1 through the breach
    const arc = Math.sin(k * Math.PI);
    W.g.visible = true;
    W.g.position.set(W.x, TUNE.waterLevel - C.len * 0.9 + arc * C.height, W.z);
    W.g.rotation.set(-Math.PI * 0.5 + (k - 0.5) * C.roll, W.heading, Math.sin(k * Math.PI) * 0.3);
    if (W.up <= 0) {
      W.g.visible = false;
      splashAt(W.x, TUNE.waterLevel, W.z, 3.2);
      for (let i = 0; i < 14; i++) {
        wakePuff(W.x + (rnd() - 0.5) * 26, TUNE.waterLevel + 1, W.z + (rnd() - 0.5) * 26, 0xf2f4f7, 3.2, 8, 1.6);
      }
      noiseBurst(0.7, 420, 0.10, 0);
      synthBlip("sine", 90, 55, 1.6, 0.05, 0.1);
      flags.whaleBreaches = (flags.whaleBreaches || 0) + 1;
    }
    return;
  }
  W.next -= dt;
  if (W.next > 0) return;
  W.next = lerp(C.every[0], C.every[1], Math.random());
  // a safe distance off his beam, and only where the water is deep
  const a = state.heading + (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 3 + Math.random() * Math.PI / 3);
  const d = lerp(C.dist[0], C.dist[1], Math.random());
  const wx = state.x - Math.sin(a) * d, wz = state.z - Math.cos(a) * d;
  if (terrainEff(wx, wz) > TUNE.waterLevel - C.minDepth) {
    // Not in the shallows. A rejected spot used to cost a FULL interval -- the
    // whale silently skipped its turn, so close inshore it could go minutes
    // without surfacing while looking as though it simply was not there. Try
    // again shortly instead: the next roll picks a different bearing.
    W.next = C.retry;
    return;
  }
  W.x = wx; W.z = wz;
  W.heading = Math.random() * Math.PI * 2;
  W.up = C.riseTime;
  // the blow, before it comes up: the announcement
  for (let i = 0; i < 5; i++) {
    wakePuff(wx + (rnd() - 0.5) * 5, TUNE.waterLevel + 3 + i * 2, wz + (rnd() - 0.5) * 5, 0xf2f4f7, 2.0, 7, 1.4);
  }
  noiseBurst(0.5, 900, 0.07, 0);
}

// ---------------------------------------------------------------------------
// The cruise ship: horn from far out, in past the breakwater with the tug on her
// quarter, alongside the terminal, and one more blast. Then she goes again, so
// there is always another one coming.
// ---------------------------------------------------------------------------
function seaCruise(dt) {
  const S = sea.cruise, C = SE.cruise;
  const path = C.path;
  if (S.state === "away") {
    S.next -= dt;
    if (S.next > 0) return;
    S.state = "calling";
    S.t = C.callTime;
    S.s = 0;
    // the wind-up: a horn from over the horizon, twice, before anything appears
    hbHorn(path[0][0], TUNE.waterLevel + 20, path[0][1], C.hornHz, 3.2);
    setTimeout(() => hbHorn(path[0][0], TUNE.waterLevel + 20, path[0][1], C.hornHz, 3.2), 2600);
    flags.cruiseCalls = (flags.cruiseCalls || 0) + 1;
    return;
  }
  if (S.state === "calling") {
    S.t -= dt;
    if (S.t > 0) return;
    S.state = "inbound";
    S.s = 0;
    S.g.visible = true;
    return;
  }
  if (S.state === "inbound" || S.state === "leaving") {
    const dir = S.state === "inbound" ? 1 : -1;
    S.s += C.speed * dt * dir;
    let total = 0;
    for (let i = 1; i < path.length; i++) total += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    if (S.state === "inbound" && S.s >= total) {
      S.s = total; S.state = "alongside"; S.t = C.stayTime;
      hbHorn(S.x, TUNE.waterLevel + 20, S.z, C.hornHz, 3.6);
      thunk();
      flags.cruiseArrivals = (flags.cruiseArrivals || 0) + 1;
    }
    if (S.state === "leaving" && S.s <= 0) {
      S.state = "away"; S.next = lerp(C.gap[0], C.gap[1], Math.random());
      S.g.visible = false;
      return;
    }
  } else if (S.state === "alongside") {
    S.t -= dt;
    if (S.t <= 0) { S.state = "leaving"; hbHorn(S.x, TUNE.waterLevel + 20, S.z, C.hornHz, 2.4); }
  }
  // where she is along her path
  let s = Math.max(0, S.s);
  let px = path[0][0], pz = path[0][1], hx = 0, hz = -1;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (s <= l) {
      const t = s / l;
      px = lerp(a[0], b[0], t); pz = lerp(a[1], b[1], t);
      hx = (b[0] - a[0]) / l; hz = (b[1] - a[1]) / l;
      break;
    }
    s -= l;
    px = b[0]; pz = b[1];
    hx = (b[0] - a[0]) / l; hz = (b[1] - a[1]) / l;
  }
  S.x = px; S.z = pz;
  S.heading = Math.atan2(-hx, -hz);
  S.g.position.set(S.x, Math.sin(sea.clock * 0.6) * 0.2, S.z);
  S.g.rotation.y = S.heading;
  S.g.visible = true;
  // the tug rides on her quarter while she comes in
  if (harbor.tug && (S.state === "inbound" || S.state === "leaving")) {
    const bx = S.x + hx * (C.len * 0.55) + -hz * 22;
    const bz = S.z + hz * (C.len * 0.55) + hx * 22;
    harbor.tug.g.position.set(bx, Math.sin(sea.clock * 0.9) * HB.tug.bob, bz);
    harbor.tug.g.rotation.y = S.heading;
    harbor.tug.escorting = true;
  } else if (harbor.tug && harbor.tug.escorting) {
    harbor.tug.escorting = false;
    harbor.tug.g.position.set(HB.tug.x, 0, HB.tug.z);
    harbor.tug.g.rotation.y = 0;
  }
}

// ---------------------------------------------------------------------------
// The carrier's wake: a wall of white water that rolls past and rocks him.
// ---------------------------------------------------------------------------
function seaCarrierWake(dt) {
  const W = sea.wake, C = SE.carrierWake;
  if (typeof carrier === "undefined" || !carrier.g) return;
  if (W.cool > 0) { W.cool -= dt; return; }
  const d = Math.hypot(state.x - carrier.x, state.z - carrier.z);
  if (d > C.radius) return;
  if (!(typeof boatActive === "function" && boatActive()) && !(typeof yachtActive === "function" && yachtActive())) return;
  W.cool = C.every;
  // the wall itself: a line of foam sweeping across him
  const a = Math.atan2(state.x - carrier.x, state.z - carrier.z);
  for (let i = 0; i < C.puffs; i++) {
    const t = (i / (C.puffs - 1) - 0.5) * C.width;
    wakePuff(state.x + Math.cos(a) * t - Math.sin(a) * C.stand,
      TUNE.waterLevel + 1.4, state.z - Math.sin(a) * t - Math.cos(a) * C.stand,
      0xf2f4f7, 3.4, 3, 2.6);
  }
  // and it rocks whatever he is in
  state.bank += (Math.random() < 0.5 ? -1 : 1) * C.roll;
  cameraNod(0.7);
  rumble = Math.max(rumble, 0.25);
  noiseBurst(1.1, 240, 0.12, 0);
  flags.carrierWakes = (flags.carrierWakes || 0) + 1;
}

// ---------------------------------------------------------------------------
// The gantry crane will load the yacht. Honk under it and a container comes
// down onto her foredeck with a thump; honk again and it goes back. Vehicle
// inside a vehicle, for the price of a box.
// ---------------------------------------------------------------------------
function seaCraneNear() {
  if (typeof yachtActive !== "function" || !yachtActive()) return null;
  // Measured from where the BOOM reaches, not from the quay the crane stands on.
  // A crane's legs are on the quay and its hook is out over the water thirty
  // metres away; asking from the quay meant a ship parked correctly under the
  // hook was out of range, and a ship in range was parked on the quay.
  let best = null;
  for (const c of harbor.cranes) {
    const d = Math.hypot(state.x - c.cx, state.z - c.z1);
    if (d < SE.crane.radius && (!best || d < best.d)) best = { c, d };
  }
  return best;
}
function seaCraneHonked() {
  const near = seaCraneNear();
  if (!near) return false;
  const K = sea.crane;
  if (K.state === "idle") {
    K.state = "lowering"; K.t = 0; K.crane = near.c;
    if (!K.box) {
      K.box = new THREE.Mesh(new THREE.BoxGeometry(HB.terminal.containerL, HB.terminal.containerH, HB.terminal.containerW),
        mattMat(TUNE.palette.green));
      K.box.castShadow = true;
      scene.add(K.box);
    }
    K.box.visible = true;
    flags.craneLoads = (flags.craneLoads || 0) + 1;
    return true;
  }
  if (K.state === "aboard") { K.state = "lifting"; K.t = 0; flags.craneUnloads = (flags.craneUnloads || 0) + 1; return true; }
  return false;
}
function seaCraneDrop(dt) {
  const K = sea.crane, C = SE.crane;
  if (K.state === "idle") { if (K.box) K.box.visible = false; return; }
  const deck = yachtLocal(0, C.deckZ);
  const deckY = TUNE.waterLevel + yacht.bob + C.deckY;
  const top = (K.crane ? K.crane.top : HB.terminal.craneH) - 2;
  if (K.state === "aboard") {
    K.box.position.set(deck.x, deckY, deck.z);
    K.box.rotation.y = yacht.heading;
    return;
  }
  K.t += dt;
  const k = clamp(K.t / C.time, 0, 1);
  const from = K.state === "lowering" ? top : deckY;
  const to = K.state === "lowering" ? deckY : top;
  K.box.position.set(deck.x, lerp(from, to, k), deck.z);
  K.box.rotation.y = yacht.heading;
  if (k >= 1) {
    if (K.state === "lowering") { K.state = "aboard"; thunk(); noiseBurst(0.4, 120, 0.16, 0); }
    else { K.state = "idle"; K.box.visible = false; chirp(); }
  }
}

// ---------------------------------------------------------------------------
// Night. There is no weather button and there is not going to be one -- the sky
// moods live in code -- so this is simply everything out here reading nightF and
// lighting up when it is used.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// THE SEAPLANE.
//
// In over the breakwater, down onto the water in a sheet of spray, a taxi, a
// turn, and away again. The spray on touchdown is its one hero effect. It is
// announced by its own engine from a long way out -- nothing arrives in this
// game without announcing itself -- and it uses the buoyed channel, because
// that is where the water is deep and where he already looks.
// ---------------------------------------------------------------------------
function seaPlane(dt) {
  const P = sea.plane, C = SE.plane;
  if (P.state === "away") {
    P.next -= dt;
    if (P.next > 0) return;
    P.state = "inbound"; P.t = 0;
    P.x = C.x; P.z = C.touchZ - C.runIn; P.y = TUNE.waterLevel + C.cruiseY;
    P.heading = 0;                       // heading 0 is -z... it flies +z, toward the harbour
    P.speed = C.speed;
    P.g.visible = true;
    return;
  }
  const gy = TUNE.waterLevel;
  if (P.state === "inbound") {
    P.t += dt;
    P.z += C.speed * dt;
    // ease down from cruise to the water over the run in
    const k = clamp((P.z - (C.touchZ - C.runIn)) / C.runIn, 0, 1);
    P.y = gy + lerp(C.cruiseY, 0.6, smoothstep(0, 1, k));
    if (P.z >= C.touchZ) { P.state = "taxi"; P.t = C.taxiTime; P.y = gy + 0.6; seaPlaneSplash(true); }
  } else if (P.state === "taxi") {
    P.t -= dt;
    P.speed += (C.taxiSpeed - P.speed) * Math.min(1, 1.2 * dt);
    P.z += P.speed * dt;
    P.y = gy + 0.6 + Math.sin(sea.clock * 2.4) * 0.12;
    seaPlaneSpray(dt, 0.35);
    if (P.t <= 0) { P.state = "turn"; P.t = C.turnTime; }
  } else if (P.state === "turn") {
    P.t -= dt;
    P.heading += (Math.PI / C.turnTime) * dt;      // swing round to face back out
    P.speed = C.taxiSpeed * 0.5;
    P.x += -Math.sin(P.heading) * P.speed * dt;
    P.z += -Math.cos(P.heading) * P.speed * dt;
    P.y = gy + 0.6;
    seaPlaneSpray(dt, 0.2);
    if (P.t <= 0) { P.state = "takeoff"; P.t = 0; P.heading = Math.PI; }
  } else if (P.state === "takeoff") {
    P.t += dt;
    P.speed += (C.speed - P.speed) * Math.min(1, 0.55 * dt);
    P.x += -Math.sin(P.heading) * P.speed * dt;
    P.z += -Math.cos(P.heading) * P.speed * dt;
    // it stays on the step throwing spray until it has the speed to fly
    if (P.speed < C.speed * 0.72) { P.y = gy + 0.6; seaPlaneSpray(dt, 1); }
    else P.y += C.climb * dt;
    if (P.y > gy + C.cruiseY || Math.abs(P.z - C.touchZ) > C.runOut) {
      P.state = "away"; P.next = lerp(C.gap[0], C.gap[1], Math.random());
      P.g.visible = false;
    }
  }
  P.g.position.set(P.x, P.y, P.z);
  P.g.rotation.set(P.state === "inbound" ? -0.06 : (P.state === "takeoff" && P.y > gy + 1 ? 0.14 : 0), P.heading, 0);
  if (P.prop) P.prop.rotation.z += dt * 34;
  // its voice, and it carries: the engine is how he knows to look up
  const near = clamp(1 - Math.hypot(state.x - P.x, state.z - P.z) / 1600, 0, 1);
  setTone("seaPlane", "sawtooth", lerp(C.engineHz[0], C.engineHz[1], P.speed / C.speed), near * 0.05);
}

// The touchdown sheet: the one big effect this event gets.
function seaPlaneSplash(big) {
  const P = sea.plane;
  splashAt(P.x, TUNE.waterLevel, P.z, big ? 2.4 : 1.2);
  for (let i = 0; i < 10; i++) {
    wakePuff(P.x + (rnd() - 0.5) * 16, TUNE.waterLevel + 0.6, P.z + (rnd() - 0.5) * 26,
      0xf2f4f7, 1.8, 2.2, 1.1);
  }
  noiseBurst(0.6, 420, 0.09, 0);
}
function seaPlaneSpray(dt, k) {
  const P = sea.plane, C = SE.plane;
  P.sprayT -= dt;
  if (P.sprayT > 0) return;
  P.sprayT = C.sprayEvery;
  for (let i = 0; i < C.sprayPuffs; i++) {
    const s = i % 2 ? 1 : -1;
    wakePuff(P.x + s * 2.6 + (rnd() - 0.5) * 2, TUNE.waterLevel + 0.4, P.z + 2 + (rnd() - 0.5) * 4,
      0xf2f4f7, 0.9 + k, 1.4, 0.7);
  }
}

// ---------------------------------------------------------------------------
// THE SUBMARINE.
//
// A boil of water first -- the wind-up, so nothing this big simply appears --
// then the hull comes up out of it with the sea sheeting off, a klaxon, a run
// on the surface, and it goes down again. The rise is the hero effect.
// ---------------------------------------------------------------------------
function seaSub(dt) {
  const S = sea.sub, C = SE.sub;
  if (S.state === "away") {
    S.next -= dt;
    if (S.next > 0) return;
    S.x = C.x; S.z = lerp(C.z[0], C.z[1], Math.random());
    if (terrainEff(S.x, S.z) > TUNE.waterLevel - 12) { S.next = 20; return; }   // not in the shallows
    S.heading = Math.PI / 2;
    S.depth = C.deep;
    S.state = "boil"; S.t = C.boilTime;
    S.g.visible = true;
    return;
  }
  if (S.state === "boil") {
    S.t -= dt;
    S.puffT -= dt;
    if (S.puffT <= 0) {
      S.puffT = 0.16;
      for (let i = 0; i < C.boilPuffs; i++) {
        wakePuff(S.x + (rnd() - 0.5) * C.len * 0.7, TUNE.waterLevel + 0.4, S.z + (rnd() - 0.5) * 18,
          0xf2f4f7, 1.2, 1.6, 0.9);
      }
      noiseBurst(0.3, 260, 0.05, 0);
    }
    if (S.t <= 0) { S.state = "rising"; S.t = C.riseTime; seaSubKlaxon(); }
  } else if (S.state === "rising") {
    S.t -= dt;
    const k = clamp(1 - S.t / C.riseTime, 0, 1);
    S.depth = lerp(C.deep, 0, smoothstep(0, 1, k));
    S.puffT -= dt;
    if (S.puffT <= 0) {                       // the sea sheeting off her casing
      S.puffT = 0.10;
      for (let i = 0; i < C.sheetPuffs; i++) {
        const t = (i / C.sheetPuffs - 0.5) * C.len;
        wakePuff(S.x + (rnd() - 0.5) * C.beam * 2, TUNE.waterLevel + 1.2 + k * 3, S.z + t,
          0xf2f4f7, 1.4, 2.6, 1.0);
      }
    }
    if (S.t <= 0) { S.state = "running"; S.t = C.runTime; }
  } else if (S.state === "running") {
    S.t -= dt;
    S.x += -Math.sin(S.heading) * C.speed * dt;
    S.z += -Math.cos(S.heading) * C.speed * dt;
    S.puffT -= dt;
    if (S.puffT <= 0) {
      S.puffT = 0.14;
      wakePuff(S.x + Math.sin(S.heading) * C.len * 0.5, TUNE.waterLevel + 0.5, S.z + Math.cos(S.heading) * C.len * 0.5,
        0xf2f4f7, 1.6, 1.2, 1.1);
    }
    if (S.t <= 0) { S.state = "diving"; S.t = C.diveTime; seaSubKlaxon(); }
  } else if (S.state === "diving") {
    S.t -= dt;
    const k = clamp(1 - S.t / C.diveTime, 0, 1);
    S.depth = lerp(0, C.deep, smoothstep(0, 1, k));
    S.x += -Math.sin(S.heading) * C.speed * 0.6 * dt;
    S.z += -Math.cos(S.heading) * C.speed * 0.6 * dt;
    if (S.t <= 0) {
      S.state = "away"; S.next = lerp(C.gap[0], C.gap[1], Math.random());
      S.g.visible = false;
      flags.subDives = (flags.subDives || 0) + 1;
    }
  }
  S.g.position.set(S.x, TUNE.waterLevel + C.beam * 0.25 - S.depth, S.z);
  S.g.rotation.set(0, S.heading, Math.sin(sea.clock * 0.9) * 0.02);
}
function seaSubKlaxon() {
  const C = SE.sub;
  synthBlip("square", C.klaxonHz, C.klaxonHz * 0.92, C.klaxonDur, 0.055, 0);
  synthBlip("square", C.klaxonHz, C.klaxonHz * 0.92, C.klaxonDur, 0.045, C.klaxonDur + 0.25);
}

// ---------------------------------------------------------------------------
// THE FIREBOAT.
//
// Moored off the terminal, and every so often it puts on a display: a horn, the
// monitors come up, and three arcs of water go over the harbour. It is the
// water cannon's language -- which he already knows from the speedboat -- done
// by something else and much bigger. Pure spectacle: there is nothing to aim,
// nothing to press, and nothing to miss.
// ---------------------------------------------------------------------------
function seaFireboat(dt) {
  const F = sea.fboat, C = SE.fire;
  if (!F.g) return;
  F.g.position.set(C.x, 0, C.z);
  F.g.rotation.y = 0.35;
  if (F.state === "away") {
    F.g.visible = true;                      // she is moored there whether she is playing or not
    if (F.jets) F.jets.visible = false;
    F.next -= dt;
    if (F.next <= 0) { F.state = "windup"; F.t = C.windUp; hbHorn(C.x, TUNE.waterLevel + 8, C.z, C.hornHz, C.hornDur); }
    for (const m of F.monitors) m.g.rotation.x += (0 - m.g.rotation.x) * Math.min(1, 2 * dt);
    return;
  }
  if (F.state === "windup") {
    F.t -= dt;
    if (F.jets) F.jets.visible = false;      // nothing comes out until the wind-up is done
    // the monitors elevate: the visible wind-up before any water moves
    const k = clamp(1 - F.t / C.windUp, 0, 1);
    for (const m of F.monitors) m.g.rotation.x = -k * 0.75;
    if (F.t <= 0) { F.state = "show"; F.t = C.showTime; }
    return;
  }
  // ---- the show
  F.t -= dt;
  for (const m of F.monitors) m.g.rotation.x = -0.75;
  // Three parabolas of droplets, scrolling along themselves so they read as
  // moving jets rather than a dotted line hanging in the air. Local to the boat,
  // so the whole rig moves with her.
  F.arcT += dt;
  F.jets.visible = true;
  const sway = Math.sin(sea.clock * 0.8) * 0.5;
  let n = 0;
  for (const m of F.monitors) {
    const a = 0.35 + m.side * 0.7 + sway;
    for (let i = 0; i < C.drops; i++) {
      const t = ((i / C.drops) + F.arcT * C.scroll) % 1;
      const r = t * C.reach;
      // The jet leaves the monitor at deck height and LANDS on the water: the
      // base slides from the barrel down to the sea across the throw, with the
      // parabola on top of it. Without the slide the far end hung six metres up.
      const base = lerp(TUNE.waterLevel + 5.9, TUNE.waterLevel, t);
      F.dummy.position.set(Math.sin(a) * r, base + Math.sin(t * Math.PI) * C.arcH, Math.cos(a) * r);
      // fattening as it goes, and breaking up at the far end
      F.dummy.scale.setScalar(C.dropSize * (0.55 + t * 0.9));
      F.dummy.updateMatrix();
      F.jets.setMatrixAt(n++, F.dummy.matrix);
    }
  }
  F.jets.instanceMatrix.needsUpdate = true;
  if (F.t <= 0) {
    F.state = "away"; F.next = lerp(C.gap[0], C.gap[1], Math.random());
    F.jets.visible = false;
    flags.fireboatShows = (flags.fireboatShows || 0) + 1;
  }
}

function seaNight() {
  const n = state.nightF || 0;
  if (sea.cruise.lights) sea.cruise.lights.material.opacity = 0.15 + 0.75 * n;
  if (harbor.lighthouse) {
    harbor.lighthouse.beam.material.opacity =
      HB.lighthouse.beamOpacity * (1 + n * 1.4) * (0.5 + 0.5 * Math.abs(Math.cos(harbor.lighthouse.spin.rotation.y)));
  }
}

seaBuild();
