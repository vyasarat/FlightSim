"use strict";
// ---------------------------------------------------------------------------
// v200: THE LONDON RACE TRACK, a street circuit on London's own streets. (race_sweep.js races every
// car round it; this is what is London's own.)
//
//   the track     it closes on the grid, two laps of 6.3 km, a street wide; over both bridges its deck
//                 is on their carriageways, never down at the water; across its whole width nothing
//                 solid and standing is in its way -- not a building, not a landmark
//   race day      out of a race its deck, kerbs, barriers, flags, gantry, stands and podium are not there and its barriers are
//                 no wall: he drives London's streets as before. On a London race they are out and solid,
//                 Tower Bridge stays down (the ship waits; his boat cannot open it), and no city traffic
//                 runs; after it, all of it goes again and the bridge and the traffic come back
//   the bends     every racer, him included, is held to the speed each street corner allows
// ---------------------------------------------------------------------------
module.exports = async function londonRaceChecks({ newPage, check }) {
  const { page } = await newPage(820, 1180);
  // London's city traffic runs once its blocks have arrived (as a building is solid only once it has)
  await page.waitForFunction(() => cities.ldn && (cities.ldn.ready || cities.ldn.failed), null, { timeout: 120000 });
  const o = await page.evaluate(() => {
    const L = window.__lp, st = L.state, R = L.race, v = R.venues.london, out = {};
    L.noRender = true; L.api.skipScreens();
    const T = v.track, S = T.S, W = T.width / 2 + L.TUNE.race.kerbW;
    // ---- the track
    const deckOver = [];
    for (const k of ["westminsterBridge", "towerBridge"]) {
      const lm = L.ldn.landmarks[k], top = L.TUNE.waterLevel + 9.3;
      let n = 0, low = 0;
      for (const q of S) if (L.terrainEff(q.x, q.z) < L.seaLevelAt(q.x, q.z) && Math.hypot(q.x - lm.x, q.z - lm.z) < 140) { n++; if (q.gy < top) low++; }
      deckOver.push({ k, overWater: n, belowCarriageway: low });
    }
    const hits = [];
    for (let i = 0; i < T.n; i += 3) {
      const q = S[i];
      for (const a of [-W, -W / 2, 0, W / 2, W]) {
        const x = q.x + q.lx * a, z = q.z + q.lz * a, y = q.gy + 1;
        L.forEachSolid(b => {
          if (b.mesh === v.dayMark || L.isSolidHidden(b)) return;          // its own barriers; and what is not there
          if (b.kind === "wall" && b.hw < 8 && !b.ld) return;              // (a race barrier's piece, any track's)
          const hit = b.o3 ? L.solidTest(b, x, y, z, 0.3) : (Math.abs(x - b.x) < b.hw && Math.abs(z - b.z) < b.hd && y > b.y0 && y < b.y1);
          if (hit && hits.length < 8) hits.push({ s: Math.round(q.s), x: Math.round(x), z: Math.round(z), what: b.ld || (b.mesh && b.mesh.isCityProxy ? "city" : b.kind) });
        }, x, z, 6);
      }
    }
    out.track = { len: Math.round(T.len), gap: +T.gap.toFixed(2), turn: +T.turn.toFixed(3), laps: T.laps, width: T.width, deckOver, hits };
    // ---- race day: a barrier point beside the Mall, out of a race and in one
    const q0 = S[Math.round(30 / (T.len / T.n))], bx = q0.x + q0.lx * (W + 0.4), bz = q0.z + q0.lz * (W + 0.4), by = q0.gy + 0.5;
    const wallAt = () => !!L.solidQuery(bx, by, bz, 0.5, L.SOLID.CAR);
    // ... and the gantry's leg and a stand, on the Mall's edge and in the park beside it
    const lp = new THREE.Vector3(); v.gantry.children[0].getWorldPosition(lp);
    const st0 = v.stands[0], sy = L.terrainEff(st0.x, st0.z) + 2;
    const gear = () => ({ gantry: v.gantry.visible, stands: v.standsG.visible, podium: v.podiumG.visible, legSolid: !!L.solidQuery(lp.x, lp.y + 2, lp.z, 0.5, L.SOLID.CAR), standSolid: !!L.solidQuery(st0.x, sy, st0.z, 0.5, L.SOLID.CAR) });
    out.before = { shown: v.venue.visible, flags: v.flagsG.visible, wall: wallAt() };
    // the ship coming, his boat-less world, traffic running in London
    L.api.setVehicle("car"); L.ldStart();
    for (let f = 0; f < 60 * 20; f++) { L.api.setStick(0, 0); L.update(1 / 60); }
    out.before.traffic = L.stTraffic.list.filter(t => t.alive).length;
    out.before.gear = gear();
    const S2 = L.ldn.tship, TB = L.ldn.tb;
    L.rcStartRace("london", 4);
    S2.state = "in"; S2.dir = 1; S2.z = TB.z - 300; S2.v = 12;          // she asks while the race is run
    let maxOpen = 0, traffic = 0, frames = 0, shipTo = Infinity;
    const H = L.TUNE.london.river.ship;
    const hold = () => { st.touching = true; st.touchIsPoint = false; st.ctrlBank = 0; st.ctrlPitch = 0; };   // his finger down: he races too
    for (let f = 0; f < 60 * 40; f++) { hold(); L.update(1 / 60); maxOpen = Math.max(maxOpen, TB.open); traffic = Math.max(traffic, L.stTraffic.list.filter(t => t.alive).length); frames++;
      shipTo = Math.min(shipTo, (TB.z - (S2.z + S2.dir * H.len / 2)) * S2.dir); }
    out.during = { on: L.raceOn(), shown: v.venue.visible, flags: v.flagsG.visible, wall: wallAt(), tbMaxOpen: maxOpen, shipTo: Math.round(shipTo), traffic, gear: gear() };
    // the bends: each racer's speed, to the flag, through the tight City corners, against what the bend allows
    const A = T.def.bendA, worst = [];
    for (let f = 0; f < 60 * 400 && R.phase === "race"; f++) {
      hold(); L.update(1 / 60);
      for (const r of R.racers) { const kh = Math.abs(L.rcAt(r.s).kh); if (kh > 0.05) worst.push(r.v / Math.sqrt(A / kh)); }
    }
    out.bends = { samples: worst.length, worstOver: worst.length ? +Math.max(...worst).toFixed(2) : null };
    st.touching = false;
    L.raceExit();
    for (let f = 0; f < 60 * 20; f++) L.update(1 / 60);
    out.after = { on: L.raceOn(), shown: v.venue.visible, flags: v.flagsG.visible, wall: wallAt(), traffic: L.stTraffic.list.filter(t => t.alive).length, gear: gear() };
    // she waited below it the whole race: after it, the bridge opens for her
    let openAfter = 0;
    for (let f = 0; f < 60 * 90 && openAfter < 0.9; f++) { L.update(1 / 60); openAfter = Math.max(openAfter, TB.open); }
    out.after.tbOpens = +openAfter.toFixed(2);
    // a race started with her between the towers: she is put through, never left under the deck he races over
    for (let f = 0; f < 60 * 120 && TB.state !== "down"; f++) L.update(1 / 60);
    S2.state = "in"; S2.dir = 1; S2.z = TB.z; S2.v = 4;
    L.rcStartRace("london", 4);
    for (let f = 0; f < 30; f++) { hold(); L.update(1 / 60); }
    out.between = { clear: +(Math.abs(S2.z - TB.z) - H.len / 2).toFixed(1), open: TB.open };
    st.touching = false; L.raceExit();
    for (let f = 0; f < 60; f++) L.update(1 / 60);
    return out;
  });
  const t = o.track;
  const anyGearN = (g) => g.gantry || g.stands || g.podium || g.legSolid || g.standSolid, allGearN = (g) => g.gantry && g.stands && g.podium && g.legSolid && g.standSolid;
  check(`london race: the street circuit closes on the grid (${t.len} m a lap, ${t.laps} laps, ${t.width} m wide); over Westminster and Tower Bridges its deck is on their carriageways, never down at the water; and nothing solid and standing is anywhere across it -- not a building, not a landmark`,
    t.gap < 1 && t.turn < 0.01 && t.laps === 2 && t.width === 13 && t.deckOver.every(d => d.overWater > 20 && d.belowCarriageway === 0) && t.hits.length === 0, JSON.stringify(t));
  check("london race: out of a race its deck, kerbs, barriers, flags, gantry, stands and podium are not there and none of them is a wall; on race day they are out and solid; after it, gone again",
    !o.before.shown && !o.before.flags && !o.before.wall && !anyGearN(o.before.gear) && o.during.on && o.during.shown && o.during.flags && o.during.wall && allGearN(o.during.gear) &&
    !o.after.on && !o.after.shown && !o.after.flags && !o.after.wall && !anyGearN(o.after.gear),
    JSON.stringify({ before: o.before, during: o.during, after: o.after }));
  check(`london race: on race day Tower Bridge stays down though the ship comes up to it (her bow ${o.during.shipTo} m short), and no city traffic runs; after it the traffic comes back and the bridge opens for her (${o.after.tbOpens}); a race started with her between the towers puts her through (${o.between.clear} m clear) and the leaves stay down`,
    o.during.tbMaxOpen === 0 && o.during.shipTo < 120 && o.during.traffic === 0 && o.before.traffic > 5 && o.after.traffic > 5 && o.after.tbOpens > 0.8 && o.between.clear >= 15 && o.between.open === 0,
    JSON.stringify({ before: o.before.traffic, during: o.during, after: o.after, between: o.between }));
  check(`london race: every racer, him included, is held to the speed each street corner allows (${o.bends.samples} samples in the tight corners, worst ${o.bends.worstOver} of the bend's speed)`,
    o.bends.samples > 100 && o.bends.worstOver < 1.15, JSON.stringify(o.bends));
  await page.close();
};
