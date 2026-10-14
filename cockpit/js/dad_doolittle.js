"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- DAD MODE, MISSION 3: THE DOOLITTLE RAID (v155). 18 April 1942.
//
// Dad mode only (dadmode.js's promises hold: built on entry, gone on exit, nothing saved,
// no Math.random -- everything that makes a three.js object is made in the build, inside
// dadQuiet, the four bombs included).
//
// THE CARRIER is dad mode's own, far out at sea north of his coast (the sea is the game's;
// his carrier, to the south, is not this one): a straight deck with its island on the
// starboard edge, steaming south into the wind, the other fifteen bombers packed aft as
// they were. His bomber stands on the port take-off line, `run` metres (467 ft) from the
// bow. The flagman winds his flag; at the drop it is full power and she rolls. Airspeed on
// the deck is the wind over it plus the roll. He may lift her once she flies; at the bow
// she is off whatever he does.
//
// OFF THE BOW she sinks: under 1.3x her stall (full flaps lower it) the wing does not hold
// her and she settles at up to `sink` m/s, less the faster she goes; under the stall she drops
// (`stallDrop` m/s more for every m/s she is short of it). Ease the nose up and
// the speed builds and she climbs away; pull hard and the speed goes, she stalls and the
// nose drops into the sea; push and the sea has her. The deck is `deckY` over the water.
//
// THE RAID: low over the sea to his coast, where targets are built for the sortie (two dock
// blocks, two factory blocks -- machines and buildings only) along its edge; up to about
// 1,500 ft over them; the sight's green ring shows where a bomb let go now comes down. Four
// bombs; two targets hit and `outWest` metres on west of them is a success. Flak bursts
// round him over the coast. Bomb from too low and his own blast catches him. The distances
// are compressed (the carrier is `farOut` metres off, not 650 nautical miles), and the
// briefing says so.
// ---------------------------------------------------------------------------

// TWIN-ENGINE MEDIUM BOMBER in the B-25B's shape: 16 m long, 20.6 m span, two radials on
// the wing, twin rectangular fins at the tips of the tailplane, a glazed nose. Olive over
// grey from the palette, no insignia. `parked` builds it without its propeller discs.
function dadBuildB25(parked, mats) {
  const M = mats || dadMatsFor({ top: TUNE.palette.grassHigh, under: TUNE.palette.grey, glass: TUNE.palette.night, metal: TUNE.palette.slate, ink: TUNE.palette.ink });
  const g = new THREE.Group(), props = [];
  dadCyl(g, 0.85, 0.8, 11, M.top, 0, 0, 0.3, 10);                  // the fuselage
  dadCyl(g, 0.8, 0.4, 3.6, M.top, 0, 0.1, 7.5, 10);                 // to the tail
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.82, 12, 8), M.glass); nose.scale.set(1, 1, 1.6); nose.position.set(0, 0, -5.6); g.add(nose);
  const cab = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.glass); cab.scale.set(1.1, 0.8, 1.8); cab.position.set(0, 0.7, -3.2); g.add(cab);
  // the wing (its gull shown flat): centre section and the outer panels, the engines on it
  dadBox(g, 5.4, 0.42, 3.4, M.top, 0, 0.35, -0.6);
  dadWing(g, 2.6, 10.3, 3.4, 1.6, 0.7, 0.32, M.top, 0.35, -0.6);
  dadWing(g, -2.6, -10.3, 3.4, 1.6, 0.7, 0.32, M.top, 0.35, -0.6);
  for (const sx of [-3.2, 3.2]) {
    dadCyl(g, 0.72, 0.55, 4.6, M.under, sx, 0.1, -1.2, 12);
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 8), M.metal); sp.rotation.x = -Math.PI / 2; sp.position.set(sx, 0.1, -3.85); g.add(sp);
    if (!parked) dadProp(g, props, 1.9, M.ink, sx, 0.1, -3.6);
  }
  // the tailplane, and the twin fins at its tips
  dadBox(g, 6.8, 0.2, 1.7, M.top, 0, 0.6, 8.6);
  for (const sx of [-3.3, 3.3]) dadBox(g, 0.18, 2.4, 1.6, M.top, sx, 1.4, 8.8);
  // the tricycle gear, down for the deck
  const gear = new THREE.Group();
  for (const [x, z] of [[0, -4.2], [-3.2, -0.6], [3.2, -0.6]]) {
    dadBox(gear, 0.14, 1.4, 0.14, M.metal, x, -1.2, z);
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 10), M.ink); w.rotation.z = Math.PI / 2; w.position.set(x, -1.9, z); gear.add(w);
  }
  g.add(gear);
  g.userData.props = props; g.userData.gear = gear;
  return g;
}
// Many still shapes as one mesh per material: each group's meshes baked into its own
// frame (the groups are not in the scene; their matrices are their own), one draw call per
// material for the fifteen bombers on the deck, not four hundred.
function dadDlBake(groups, parent) {
  const by = new Map();
  for (const G of groups) {
    G.updateMatrixWorld(true);
    G.traverse(o => {
      if (!o.isMesh) return;
      const geo = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
      geo.applyMatrix4(o.matrixWorld);
      if (!by.has(o.material)) by.set(o.material, []);
      by.get(o.material).push(geo);
    });
  }
  for (const [mat, geos] of by) {
    const pos = [], nor = [];
    for (const g of geos) {
      const P = g.attributes.position, N = g.attributes.normal;
      for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); }
      g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    parent.add(new THREE.Mesh(out, mat));
  }
}
// the carrier: hull, straight deck, the island on the starboard edge, the take-off line,
// the fifteen others packed aft, and the flagman by the bow with his flag
function dadBuildCarrier(W) {
  const C = TUNE.dad.doolittle.carrier;
  const M = dadMatsFor({ hull: TUNE.palette.slate, deck: TUNE.palette.grassHigh, island: TUNE.palette.grey, ink: TUNE.palette.ink, white: TUNE.palette.white });
  const g = new THREE.Group();
  const hullH = C.deckY + 6;
  dadBox(g, C.beam * 0.86, hullH, C.len * 0.96, M.hull, 0, -hullH / 2 - 0.6, 4);
  // the bow: a wedge from the hull's front to a stem under the deck's forward edge
  const bw = C.beam * 0.43, shape = new THREE.Shape([new THREE.Vector2(-bw, 0), new THREE.Vector2(bw, 0), new THREE.Vector2(0, -26)]);
  const bowGeo = new THREE.ExtrudeGeometry(shape, { depth: hullH, bevelEnabled: false }).rotateX(Math.PI / 2);
  const bow = new THREE.Mesh(bowGeo, M.hull); bow.position.set(0, -0.6, -C.len * 0.48 + 4); g.add(bow);
  dadBox(g, C.beam, 1.2, C.len, M.deck, 0, -0.6, 0);
  // the centre line, and the take-off line his nose wheel runs on
  dadBox(g, 0.5, 0.05, C.len * 0.95, M.white, 0, 0.03, 0);
  dadBox(g, 0.4, 0.05, C.run + 10, M.white, C.line, 0.04, -C.len / 2 + (C.run + 10) / 2);
  // the island, standing on the starboard edge: his right wingtip passes it by a few feet
  const isl = new THREE.Group();
  dadBox(isl, 7, 10, 30, M.island, 0, 5, 0);
  dadBox(isl, 5, 6, 12, M.island, -0.5, 13, -3);
  dadBox(isl, 3.4, 4, 3.4, M.ink, -0.5, 18, 5);                     // the funnel cap
  dadBox(isl, 0.8, 12, 0.8, M.ink, -0.5, 22, -5);                   // the mast
  isl.position.set(C.beam / 2 + 1, 0, -C.len * 0.06); g.add(isl);
  // the rest of the squadron, packed aft in a staggered pair of rows (only the first is his)
  const startZ = C.len / 2 - C.startBack, parked = [];
  const PM = dadMatsFor({ top: TUNE.palette.grassHigh, under: TUNE.palette.grey, glass: TUNE.palette.night, metal: TUNE.palette.slate, ink: TUNE.palette.ink });
  for (let i = 0; i < C.parked; i++) {
    const b = dadBuildB25(true, PM);
    b.userData.gear.visible = true;
    b.position.set((i % 2 ? 1 : -1) * 4.5, 2.0, startZ + 20 + i * 6);
    b.rotation.y = (i % 2 ? -1 : 1) * 0.12;
    parked.push(b);
  }
  const fleet = new THREE.Group(); dadDlBake(parked, fleet); g.add(fleet);
  // the flagman, out to port ahead of him (a crewman, safe on deck), and his flag
  const fm = new THREE.Group();
  dadBox(fm, 0.6, 1.8, 0.45, M.white, 0, 0.9, 0);                    // in the deck crew's white
  const flag = new THREE.Group(); flag.position.set(0.4, 1.7, 0);
  dadBox(flag, 0.08, 1.8, 0.08, M.ink, 0, 0.9, 0);
  dadBox(flag, 1.5, 1.0, 0.06, M.ink, 0.75, 1.4, 0);
  fm.add(flag); fm.position.set(-C.beam / 2 + 2.5, 0, startZ - 30);
  g.add(fm);
  dadAdd(g);
  W.carrier = { g, flag, x: 0, z: 0, y: 0 };
  return W.carrier;
}
// where his coast is at x: the first land coming south from the open sea
function dadDlCoastZ(x) {
  const D = TUNE.dad.doolittle;
  for (let z = D.coastScan[0]; z >= D.coastScan[1]; z -= 4) if (terrainEff(x, z) >= seaLevelAt(x, z)) return z;
  return D.coastScan[1];
}
// the targets on his coast: docks on its edge (a long warehouse, the quay and its cranes),
// factories inland (saw-tooth sheds and a chimney); each turns to rubble and burns when hit
function dadBuildTargets(W) {
  const T = TUNE.dad.doolittle;
  const M = dadMatsFor({ shed: TUNE.palette.concrete, roof: TUNE.palette.rust, dark: TUNE.palette.slate, crane: TUNE.palette.warning, brick: TUNE.palette.rust, ruin: TUNE.palette.ink });
  W.targets = [];
  let coast = 0;
  for (const t of T.targets) {
    const cz = dadDlCoastZ(t.x); coast += cz;
    const z = cz - t.inland;
    let y = -1e9;
    for (const dx of [-60, 0, 60]) for (const dz of [-30, 0, 30]) y = Math.max(y, terrainEff(t.x + dx, z + dz));
    y = Math.max(y, TUNE.waterLevel + 1);
    const g = new THREE.Group();
    g.position.set(t.x, y, z);
    const whole = new THREE.Group(); g.add(whole);
    if (t.kind === "docks") {
      dadBox(whole, 120, 9, 36, M.shed, 0, 0, -4);                       // stands down into the ground on a slope
      dadBox(whole, 122, 1.2, 38, M.roof, 0, 5, -4);
      dadBox(whole, 140, 3, 16, M.dark, 0, -1, 24);                      // the quay
      for (const cx of [-45, 0, 45]) {
        const c = new THREE.Group(); c.position.set(cx, 0, 26);
        for (const lx of [-3, 3]) dadBox(c, 0.8, 22, 0.8, M.crane, lx, 11, 0);
        dadBox(c, 9, 1.2, 1.2, M.crane, 0, 22, 0);
        dadBox(c, 1, 1, 26, M.crane, 0, 23.2, 8);
        whole.add(c);
      }
    } else {
      for (let k = 0; k < 4; k++) {
        dadBox(whole, 26, 12, 60, M.shed, -42 + k * 28, 2, 0);
        for (let r = 0; r < 5; r++) { const s = dadBox(whole, 25, 3, 5, M.roof, -42 + k * 28, 9, -24 + r * 12); s.rotation.x = 0.5; }
      }
      dadCyl(whole, 2.2, 2.6, 34, M.brick, 52, 17, 18, 10).rotation.x = 0;
    }
    const ruin = new THREE.Group();
    for (let k = 0; k < 14; k++) dadBox(ruin, dadR(6, 16), dadR(1, 4), dadR(6, 16), M.ruin, dadR(-55, 55), dadR(0, 2), dadR(-20, 20)).rotation.y = dadR(0, 3);
    ruin.visible = false; g.add(ruin);
    dadAdd(g);
    W.targets.push({ g, whole, ruin, kind: t.kind, x: t.x, y, z, hx: t.hx, hz: t.hz, hit: false, burnT: 0 });
  }
  W.coastZ = coast / T.targets.length;
}
function dadDlBuild(W) {
  dadBuildCarrier(W);
  dadBuildTargets(W);
  const body = dadBuildB25(false); dadAdd(body); W.body = body;
  // the four bombs, made now (a geometry made in flight would draw his random stream)
  const geo = new THREE.CylinderGeometry(0.28, 0.28, 1.6, 8).rotateX(Math.PI / 2);
  W.bombPool = [];
  for (let i = 0; i < TUNE.dad.doolittle.bombs; i++) { const mesh = new THREE.Mesh(geo, W.mats.steel); mesh.visible = false; dadAdd(mesh); W.bombPool.push(mesh); }
  W.bombsLive = [];
  // the sight's ring: where a bomb let go now would come down
  const pip = new THREE.Mesh(new THREE.RingGeometry(10, 15, 32), new THREE.MeshBasicMaterial({ color: 0x7dff9a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthTest: false, fog: false }));
  pip.rotation.x = -Math.PI / 2; pip.renderOrder = 10; pip.visible = false; dadAdd(pip); W.pip = pip;
}

// where the carrier steams from: `farOut` off his coast, as near `carrier.x` as puts none of
// his world's landmarks (a mast or a bridge, seeded over every cell, the open sea included)
// within `clearR` of the deck. scenery.js's own hash, read the way placeLandmark reads it --
// as if every cell had one, so nothing it might place is missed; nothing is made.
function dadDlLandmarkNear(x, z, r) {
  const G = TUNE.landmarkGrid, cx0 = Math.round(x / G), cz0 = Math.round(z / G);
  for (let cx = cx0 - 2; cx <= cx0 + 2; cx++) for (let cz = cz0 - 2; cz <= cz0 + 2; cz++) {
    const lx = cx * G + (hashSalt(cx, cz, 92) - 0.5) * G * 0.5, lz = cz * G + (hashSalt(cx, cz, 93) - 0.5) * G * 0.5;
    if (Math.hypot(lx - x, lz - z) < r) return true;
  }
  return false;
}
function dadDlSite(W) {
  const D = TUNE.dad.doolittle;
  for (const dz of [0, 400, -400, 800, -800, 1200]) for (const dx of [0, 300, -300, 600, -600, 900, -900, 1200, -1200]) {
    const x = D.carrier.x + dx, z = W.coastZ + D.farOut + dz;
    if (!dadDlLandmarkNear(x, z, D.clearR)) return { x, z };
  }
  return { x: D.carrier.x, z: W.coastZ + D.farOut };
}
function dadDlStart() {
  const D = TUNE.dad.doolittle, W = dad.world, C = W.carrier;
  dadSeedNow = dad.seed + 3;
  dad.m = { t: 0, over: false, result: null, why: "", overT: 0, card: false, shake: 0, msg: "", msgT: 0, health: 100,
    phase: "deck", count: D.flagCount, deckS: 0, deckV: 0, bombs: D.bombs, bombsUsed: 0, hits: 0, flak: 0, flakHits: 0,
    thrust: 0, propRpm: 4, flaps: true, offBow: null, sinkMin: null, auto: false, q: 0, load: 1, ownBlast: 0, drops: [] };
  for (const t of W.targets) { t.hit = false; t.burnT = 0; t.ruin.visible = false; t.whole.visible = true; }
  for (const b of W.bombPool) b.visible = false;
  W.bombsLive.length = 0;
  W.pip.visible = false;
  for (const P of [W.smoke, W.fire, W.tracer]) P.life.fill(0);
  // the carrier far out north, steaming south toward his coast
  const at = W.site || (W.site = dadDlSite(W));
  C.x = at.x; C.z = at.z; C.y = TUNE.waterLevel + D.carrier.deckY;
  C.g.position.set(C.x, C.y, C.z);
  dadDlOnDeck(0);
  state.heading = 0; state.pitch = 0; state.bank = 0; state.speed = D.carrier.speed + D.wind;
  state.phase = "AIRBORNE"; state.airVy = null; state.exploding = false; state.explodeTimer = 0;
  state.viewChase = true; el.hud.classList.add("chase");
  state.touching = false; state.ctrlBank = 0; state.ctrlPitch = 0;
  dad.cam = null;
  const card = document.getElementById("dadCard"); if (card) card.remove();
  W.body.userData.gear.visible = true;
}
// on the deck, `s` metres from the start toward the bow
function dadDlOnDeck(s) {
  const D = TUNE.dad.doolittle, C = dad.world.carrier;
  state.x = C.x + D.carrier.line;
  state.z = C.z + D.carrier.len / 2 - D.carrier.startBack - s;
  state.y = C.y + D.gearH;
}
// her stall now: full flaps lower it
function dadDlStall() { const A = TUNE.dad.air.b25; return A.vStall * (dad.m && dad.m.flaps ? TUNE.dad.doolittle.flapK : 1); }
function dadDlFly(dt) {
  const m = dad.m, A = TUNE.dad.air.b25, D = TUNE.dad.doolittle, C = dad.world.carrier;
  if (!m) return;
  state.phase = "AIRBORNE"; state.airVy = null; rumble = 0;
  if (typeof setEngine === "function") setEngine(0);
  // the ship steams on whatever he does
  C.z -= D.carrier.speed * dt; C.g.position.z = C.z;
  if (state.exploding) return;
  if (m.phase === "deck") {
    // the flagman winds up; at the drop of the flag, full power and the brakes off
    if (m.count > 0) { m.count -= dt; m.propRpm = 12; dadDlOnDeck(0); state.speed = D.carrier.speed + D.wind; return; }
    m.propRpm = 45;
    m.thrust = A.thrust * D.deckBoost;
    m.deckV += (m.thrust - dadAirK(A) * state.speed * state.speed) * dt;
    m.deckS += m.deckV * dt;
    state.speed = m.deckV + D.carrier.speed + D.wind;     // the airspeed: the wind over the deck and the roll
    dadDlOnDeck(m.deckS);
    // he may lift her once she flies; at the bow she is off whatever he does
    const pull = state.touching && state.ctrlPitch > 0.2 && !m.over;
    if (m.deckS >= D.carrier.run || (pull && state.speed > dadDlStall() * 1.05)) {
      m.phase = "air"; m.offBow = { t: m.t, speed: state.speed, y: state.y, pulled: pull };
      state.pitch = pull ? 3 : 0;
      dadSay(m.deckS >= D.carrier.run ? "OFF THE BOW" : "SHE'S FLYING", 1.5);
    }
    return;
  }
  // full flaps until she has height and the speed to fly clean, then up (and the gear with them)
  if (m.flaps && state.y - TUNE.waterLevel > D.flapsUp && state.speed > A.vStall * D.flapsUpV) { m.flaps = false; dadSay("FLAPS UP", 1.2); dad.world.body.userData.gear.visible = false; }
  const P = m.flaps ? Object.assign({}, A, { vStall: dadDlStall(), ld: A.ld * 0.7 }) : A;
  m.thrust = m.over ? A.thrust * 0.8 : A.thrust;
  if (m.over) m.stick = { bank: 0, pitch: clamp((5 - state.pitch) * 0.1, -0.5, 0.5) };
  dadAirFly(dt, P, m);
  // the wing does not quite hold her this slow: she settles, less the faster she goes; under
  // the stall it lets go and she drops
  const vs = P.vStall, sinkK = clamp((1.3 * vs - state.speed) / (0.3 * vs), 0, 1);
  m.sinkNow = sinkK * D.sink + Math.max(0, vs - state.speed) * D.stallDrop;
  state.y -= m.sinkNow * dt;
  m.propRpm = 45;
  if (m.over) return;
  if (m.t - m.offBow.t < 10) m.sinkMin = Math.min(m.sinkMin === null ? 1e9 : m.sinkMin, state.y - TUNE.waterLevel);
  const agl = state.y - Math.max(terrainEff(state.x, state.z), TUNE.waterLevel);
  if (agl < A.touchAgl) { dadDlCrash(); return; }
  // the carrier's hull and island, the targets' buildings, and anything solid of his
  const cx = state.x - C.x, cz = state.z - C.z;
  if (Math.abs(cx) < D.carrier.beam / 2 && Math.abs(cz) < D.carrier.len / 2 && state.y < C.y + 1) { dadDlCrash(); return; }
  for (const t of dad.world.targets) if (!t.hit && Math.abs(state.x - t.x) < t.hx && Math.abs(state.z - t.z) < t.hz && state.y < t.y + 24) { dadDlCrash(); return; }
  if (solidQuery(state.x, state.y, state.z, TUNE.solid.r.dad, SOLID.AIR, undefined, null, false)) dadDlCrash();
}
function dadDlCrash() {
  dadBlast(state.x, Math.max(state.y, TUNE.waterLevel + 1), state.z, 2.2, true);
  for (let i = 0; i < 30; i++) dadEmit(dad.world.smoke, state.x, TUNE.waterLevel + 1, state.z, dadR(-15, 15), dadR(8, 30), dadR(-15, 15), dadR(2, 4), 6, dadR(20, 40), 0.9, 0xf2f4f7, 0.8, -3);
  dadEnd("fail", "crashed", true);
}
// the sight: where a bomb let go now comes down (its fall integrated in the same steps the bomb takes)
function dadDlImpact() {
  const f = dadFwd(dadTmpF), dt = 1 / 30;
  let x = state.x, y = state.y - 1.5, z = state.z, vx = f.x * state.speed, vy = f.y * state.speed, vz = f.z * state.speed;
  for (let i = 0; i < 900; i++) {
    vy -= 9.81 * dt; x += vx * dt; y += vy * dt; z += vz * dt;
    const gy = Math.max(terrainEff(x, z), TUNE.waterLevel);
    if (y < gy) return { x, y: gy, z, t: (i + 1) * dt };
  }
  return null;
}
function dadDlCan() { const m = dad.m; return dadFlying() && m.phase === "air" && m.bombs > 0 && dad.world.pip.visible; }
function dadDlDrop() {
  const m = dad.m, W = dad.world;
  if (!dadDlCan()) return false;
  const mesh = W.bombPool[m.bombsUsed];
  m.bombs--; m.bombsUsed++;
  const f = dadFwd(dadTmpF);
  mesh.visible = true;
  W.bombsLive.push({ mesh, x: state.x, y: state.y - 1.5, z: state.z, vx: f.x * state.speed, vy: f.y * state.speed, vz: f.z * state.speed, ft: (state.y - Math.max(terrainEff(state.x, state.z), TUNE.waterLevel)) * 3.281 });
  dadNoise(0.25, 500, 0.1);
  dadSay("BOMB AWAY", 1.2);
  return true;
}
function dadDlBombs(dt) {
  const m = dad.m, W = dad.world, D = TUNE.dad.doolittle;
  for (let i = W.bombsLive.length - 1; i >= 0; i--) {
    const b = W.bombsLive[i];
    // the same steps the sight integrates
    let left = dt;
    while (left > 1e-6) { const h = Math.min(1 / 30, left); left -= h; b.vy -= 9.81 * h; b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h; }
    b.mesh.position.set(b.x, b.y, b.z); b.mesh.lookAt(b.x + b.vx, b.y + b.vy, b.z + b.vz);
    const gy = Math.max(terrainEff(b.x, b.z), TUNE.waterLevel);
    if (b.y > gy) continue;
    b.mesh.visible = false; W.bombsLive.splice(i, 1);
    const tgt = W.targets.find(t => !t.hit && Math.abs(b.x - t.x) < t.hx && Math.abs(b.z - t.z) < t.hz);
    dadBlast(b.x, gy, b.z, tgt ? 2.6 : 1.2, true);
    dadBoom(tgt ? 2 : 1, Math.hypot(b.x - state.x, b.z - state.z));
    m.drops.push({ ft: Math.round(b.ft), hit: tgt ? tgt.kind : null });
    if (tgt) {
      tgt.hit = true; tgt.burnT = 90; m.hits++;
      tgt.whole.visible = false; tgt.ruin.visible = true;
      dadSay((tgt.kind === "docks" ? "DOCKS" : "FACTORY") + " HIT  (" + m.hits + " OF " + D.need + ")", 2.5);
    } else dadSay("MISSED", 1.5);
    // too low, and his own bomb's blast catches him
    const B = D.ownBlast, d = Math.hypot(b.x - state.x, gy - state.y, b.z - state.z);
    if (!m.over && !state.exploding && d < B.r) {
      m.ownBlast++; m.health = Math.max(0, m.health - B.damage); m.shake = Math.max(m.shake, 0.9);
      dadSay("TOO LOW -- CAUGHT IN YOUR OWN BLAST", 2.5);
      if (m.health <= 0) { dadBlast(state.x, state.y, state.z, 2, false); dadEnd("fail", "caught in his own blast", true); }
    }
  }
}
// flak over the coast: black bursts round him, closer the lower and slower he is
function dadDlFlak(dt) {
  const m = dad.m, D = TUNE.dad.doolittle, F = D.flak;
  const near = dad.world.targets.some(t => Math.hypot(t.x - state.x, t.z - state.z) < F.range);
  m.flakOn = near && !m.over && !state.exploding && m.phase === "air";
  if (!m.flakOn) return;
  m.flakT = (m.flakT || 0) - dt;
  if (m.flakT > 0) return;
  m.flakT = F.every * dadR(0.6, 1.4);
  // to one side of his line or above it: never on the sightline down to the ring
  const f = dadFwd(dadTmpF), lead = dadR(0.2, 1.0), sp = F.spread, hl = Math.hypot(f.x, f.z) || 1, side = (dadRand() < 0.5 ? -1 : 1) * dadR(20, sp);
  const bx = state.x + f.x * state.speed * lead - f.z / hl * side, by = state.y + dadR(-0.2, 0.6) * sp, bz = state.z + f.z * state.speed * lead + f.x / hl * side;
  dadFlakBurst(bx, by, bz);
  m.flak++;
  const miss = Math.hypot(bx - state.x, by - state.y, bz - state.z);
  if (miss < F.hit) {
    m.flakHits++; m.health = Math.max(0, m.health - F.damage); m.shake = Math.max(m.shake, 0.6); dadNoise(0.12, 3200, 0.25); dadSay("HIT", 1);
    if (m.health <= 0) { dadBlast(state.x, state.y, state.z, 2, false); dadEnd("fail", "shot down", true); }
  } else if (miss < F.near) m.shake = Math.max(m.shake, 0.3);
  dadNoise(0.3, 220, 0.14 * clamp(1 - miss / 500, 0.1, 1));
}
// how far on west he still has to go: the line is `outWest` past the westmost target
function dadDlOutX() { const W = dad.world; return Math.min(...W.targets.map(t => t.x)) - TUNE.dad.doolittle.outWest; }
function dadDlStep(dt) {
  const m = dad.m, W = dad.world, D = TUNE.dad.doolittle;
  if (!m || !W) return;
  dadMisTick(dt);
  dadDlBombs(dt);
  dadDlFlak(dt);
  // the flag: wound round and round, then down
  const fl = W.carrier.flag;
  fl.rotation.z = m.phase === "deck" && m.count > 0 ? m.t * 9 : -1.4;
  // the hit targets burn
  for (const t of W.targets) if (t.hit && t.burnT > 0) {
    t.burnT -= dt;
    for (let k = 0; k < 2; k++) dadEmit(W.smoke, t.x + dadR(-40, 40), t.y + 5, t.z + dadR(-15, 15), dadR(-2, 2), dadR(10, 20), dadR(-2, 2), dadR(6, 11), 14, dadR(60, 110), 0.85, 0x1f2328, 0.15, 1.5);
    for (let k = 0; k < 2; k++) dadEmit(W.fire, t.x + dadR(-35, 35), t.y + 3, t.z + dadR(-12, 12), 0, dadR(4, 10), 0, 0.8, 9, 18, 1, k ? 0xff8a2a : 0xffb43a, 0.5, 2);
  }
  // the sight's ring, while he is over the coast with bombs
  const near = W.targets.some(t => Math.hypot(t.x - state.x, t.z - state.z) < D.sightR);
  const ip = m.phase === "air" && near && m.bombs > 0 && !m.over && !state.exploding ? dadDlImpact() : null;
  W.pip.visible = !!ip;
  m.pip = ip;
  if (ip) { W.pip.position.set(ip.x, ip.y + 0.6, ip.z); W.pip.scale.setScalar(clamp(Math.hypot(ip.x - state.x, ip.z - state.z) / 400, 1, 3.5)); }
  if (!m.over) {
    if (m.hits >= D.need && state.x < dadDlOutX()) dadEnd("success", "targets hit, on west", false);
    else if (m.bombs <= 0 && W.bombsLive.length === 0 && m.hits < D.need) dadEnd("fail", m.hits ? "one target hit of two: four bombs gone" : "targets missed: four bombs gone", false);
  }
  dadStepParticles(W.smoke, dt); dadStepParticles(W.fire, dt); dadStepStreaks(W.tracer, dt);
  if (typeof setTone === "function") {
    const full = !state.exploding && (m.phase === "air" || m.count <= 0);
    setTone("dadProp", "sawtooth", 62 + state.speed * 0.2, m.over && state.exploding ? 0 : full ? 0.024 : 0.012);
    setTone("dadProp2", "square", 31 + state.speed * 0.1, m.over && state.exploding ? 0 : full ? 0.012 : 0.005);
  }
  dadDlHud();
}

// ---- the HUD: speed (and the flaps), height against what the leg wants, targets and bombs,
// one line of what to do now, the target marked
function dadDlHudBuild() {
  const hud = dadEl("div", { id: "dadHud", class: "dadMisHud" });
  dad.dom.push(hud);
  const mk = (cls, parent, txt) => { const e = dadEl("div", { class: cls }, parent || hud); if (txt) e.textContent = txt; return e; };
  const h = dad.hud = { msg: mk("dadMsg"), warn: mk("dadWarn") };
  const panel = mk("dadDamPanel");
  h.cells = {};
  for (const [k, lab] of [["mph", "SPEED"], ["ft", "HEIGHT"], ["hits", "TARGETS"]]) { const c = mk("dadDamCell", panel); mk("dadDamLab", c, lab); h.cells[k] = { c, v: mk("dadDamVal", c), w: mk("dadDamWin", c) }; }
  h.lamps = mk("dadDamLamps");
  h.bombs = mk("dadDamBombs");
  h.health = mk("dadHealth"); h.healthBar = mk("bar", h.health);
  h.mark = dadMarkMake(hud);
}
function dadDlHud() {
  const h = dad.hud, m = dad.m, W = dad.world, D = TUNE.dad.doolittle, wl = TUNE.waterLevel;
  if (!h) return;
  const agl = m.phase === "deck" ? (state.y - wl) : state.y - Math.max(terrainEff(state.x, state.z), wl);
  const ft = agl * 3.281;
  const put = (k, v, w, ok, bad) => { const c = h.cells[k]; c.v.textContent = v; c.w.textContent = w; c.c.classList.toggle("ok", !!ok); c.c.classList.toggle("lo", !!bad); };
  const vs = dadDlStall();
  put("mph", Math.round(state.speed * 2.237) + " MPH", (m.flaps ? "FLAPS DOWN · STALL " : "STALL ") + Math.round(vs * 2.237), state.speed > vs * 1.3, m.phase === "air" && state.speed < vs * 1.1);
  const overT = W.targets.some(t => Math.hypot(t.x - state.x, t.z - state.z) < D.sightR) && m.hits < D.need && m.bombs > 0;
  put("ft", Math.round(ft) + " FT", m.phase === "deck" ? "ON DECK" : overT ? "BOMB 1,200-1,800" : m.hits >= D.need ? "ON WEST" : "WAVE-TOP", overT ? ft > 1200 && ft < 1800 : ft < 300, overT && ft < 500);
  put("hits", m.hits + " OF " + D.need, "BOMBS " + m.bombs, m.hits >= D.need);
  let line = "";
  if (m.over) line = "";
  else if (m.phase === "deck") line = m.count > 0 ? "THE FLAGMAN IS WINDING UP -- " + Math.ceil(m.count) : "FULL POWER -- SHE LIFTS AT THE BOW";
  else if (m.t - m.offBow.t < 7 && m.flaps) line = m.sinkNow > 0.5 ? "SINKING -- EASE THE NOSE UP, GENTLY" : "CLIMB AWAY -- DON'T PULL HARD";
  else if (m.flaps) line = "BUILD SPEED -- FLAPS UP AT 150 FT AND " + Math.round(TUNE.dad.air.b25.vStall * D.flapsUpV * 2.237 / 5) * 5 + " MPH";
  else if (m.hits >= D.need) line = "ON WEST: " + (Math.max(0, state.x - dadDlOutX()) / 1000).toFixed(1) + " KM TO GO";
  else if (W.pip.visible) line = ft < 500 ? "TOO LOW TO BOMB -- CLIMB" : "PUT THE GREEN RING ON A TARGET -- DROP";
  else if (state.z > W.coastZ + 2500) line = "LOW OVER THE SEA TO THE COAST";
  else line = "CLIMB TO 1,500 FT FOR THE TARGETS";
  h.lamps.textContent = line;
  h.lamps.className = "dadDamLamps" + (/SINKING|TOO LOW/.test(line) ? "" : "");
  h.bombs.textContent = W.pip.visible && m.bombs ? "BOMB BAY OPEN  ·  " + m.bombs + (dadDlOnTarget() ? "   ▶ DROP" : "") : "";
  h.bombs.style.display = h.bombs.textContent ? "block" : "none";
  h.bombs.classList.toggle("go", dadDlOnTarget());
  h.healthBar.style.width = m.health + "%";
  h.msg.textContent = m.msgT > 0 ? m.msg : "";
  const warns = []; if (m.flakOn) warns.push("FLAK");
  if (m.phase === "air" && state.speed < vs * 1.05 && !m.over) warns.push("STALL");
  h.warn.textContent = warns.join("   "); h.warn.classList.toggle("on", warns.length > 0);
  // the marker: the nearest target standing, or the way west once two are down
  let tg = null, best = Infinity;
  if (m.hits < D.need) for (const t of W.targets) { if (t.hit) continue; const d = Math.hypot(t.x - state.x, t.z - state.z); if (d < best) { best = d; tg = t; } }
  if (m.phase !== "air" || m.over) h.mark.update(null);
  else if (tg) h.mark.update({ x: tg.x, y: tg.y + 30, z: tg.z }, Math.hypot(tg.x - state.x, tg.y - state.y, tg.z - state.z));
  else h.mark.update({ x: dadDlOutX(), y: state.y, z: state.z }, Math.max(0, state.x - dadDlOutX()), "WEST");
}
// the ring is on a standing target
function dadDlOnTarget() {
  const m = dad.m, ip = m && m.pip;
  return !!ip && dad.world.targets.some(t => !t.hit && Math.abs(ip.x - t.x) < t.hx && Math.abs(ip.z - t.z) < t.hz);
}

dadMissionDef({
  id: "doolittle", title: "Doolittle Raid", kicker: "18 APRIL 1942  ·  TWIN-ENGINE MEDIUM BOMBER",
  history: "Sixteen B-25B Mitchells of the US Army Air Forces, led by Lt Col James Doolittle, took off from the carrier USS Hornet, " +
    "a ship never meant to launch them. A Japanese picket boat sighted the task force about 650 nautical miles out, so they launched at once, " +
    "ten hours early and 170 miles farther than planned; Doolittle's had 467 ft of deck. They crossed the sea at wave-top height and bombed " +
    "from about 1,500 ft, four 500 lb bombs each, at targets in Tokyo, Yokohama, Yokosuka, Nagoya, Kobe and Osaka, then flew on west. Fifteen " +
    "were lost in China, crash-landed, ditched or abandoned by their crews, and the sixteenth landed near Vladivostok and was impounded. Of the 80 men, " +
    "69 escaped capture or death; three were killed bailing out or ditching, and eight were captured, of whom three were executed and one died in captivity.",
  how: [
    "On the deck: the flagman winds his flag. At the drop it is full power and she rolls; at the bow she flies.",
    "Off the bow she sinks toward the sea: ease the nose up gently. Pull hard and she stalls in; push and the sea has her.",
    "Low over the sea to the coast (the carrier is much closer than the real 650 miles). Flaps come up at 150 ft once she has 120 mph: lower the nose to build it.",
    "Over the targets climb to about 1,500 ft. The green ring is where a bomb lands: put it on a target and drop. Too low, and your own blast catches you.",
    "Four bombs, two targets to hit, flak over the coast; then on west, 3 km past the targets.",
  ],
  buttons: { bomb: true },
  build: dadDlBuild, start: dadDlStart, fly: dadDlFly, step: dadDlStep,
  // on the deck the chase rides high, over the squadron packed behind him
  camera: dt => dadAirCamera(dt, dad.m && dad.m.phase === "deck" ? { back: 30, up: 22, look: 120, eye: [0, 0.25, -6.6] } : { back: 38, up: 9, look: 90, eye: [0, 0.25, -6.6] }),   // the seat: the bombardier's, in the glazed nose
  pose: () => dadAirPose(dad.world.body),
  hud: dadDlHudBuild,
  bombCan: dadDlCan, drop: dadDlDrop,
  cardRows: () => {
    const m = dad.m;
    const rows = [["Time", dadFmtClock(m.endT || m.t)], ["Targets hit", m.hits + " of " + TUNE.dad.doolittle.need + " needed (" + dad.world.targets.length + " there)"],
      ["Bombs used", m.bombsUsed + " of " + TUNE.dad.doolittle.bombs],
      ["Lowest off the bow", m.sinkMin === null ? "--" : Math.round(m.sinkMin * 3.281) + " ft over the sea"], ["Aircraft damage", Math.round(100 - m.health) + "%"]];
    m.drops.forEach((d, i) => rows.push(["Bomb " + (i + 1), (d.hit ? (d.hit === "docks" ? "docks hit" : "factory hit") : "missed") + ", from " + d.ft + " ft"]));
    return rows;
  },
});
