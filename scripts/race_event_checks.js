"use strict";
// ---------------------------------------------------------------------------
// THE TRACKS' EVENTS (v189: Desert Dunes). Portrait, iPad.
//
//   a. THE FREIGHT LINE: its bed level and dry (above the sea by a margin) along its whole length, the road over
//      it on a bridge with room for the train under the deck (its height and more), nothing of the dune's sand
//      over the opening, the line clear of every other road, venue and solid but its own;
//   b. THE TRAIN PASSES UNDER HIM: a race in each car, hands-off down the middle -- every lap the train is under
//      the crest as he crosses its line; the booms are down and the lamps flash for at least 2 s before he gets
//      there; never a car closer to the train than its clearance (nothing touches it), no bang, never stuck;
//   c. THE BOULDERS: let go once a lap as he comes, they cross the road; down a boulder's lane he is spun out,
//      in the gap between two he is not (steered round, never timed); a spin, never a bang; and they hit the
//      rivals too (who do not steer round them -- he can);
//   d. A WHOLE RACE with the noisy hand and random taps: no bang, never stuck over 2 s, both events seen every
//      lap, and something happens to him every 5-10 s;
//   e. NOTHING LEFT: out of the race the train is back in a shed and the booms up, no boulder on the road.
//
// Alone: node scripts/run_module.js race_event_checks
// ---------------------------------------------------------------------------
const { oneRace } = require("./race_drive");

module.exports = async function raceEventChecks({ newPage, check }) {
  const J = x => JSON.stringify(x);
  const { page } = await newPage(820, 1180);
  await page.waitForFunction(() => window.__lp && window.__lp.race && window.__lp.race.built, null, { timeout: 60000 }).catch(() => {});

  // ---- a. the freight line
  const a = await page.evaluate(() => {
    const L = window.__lp, RC = L.RC, def = RC.tracks.find(t => t.id === "dunes"), R = def.rail, E = RC.events.train;
    const v = L.rce.venues.dunes, tr = v.train, out = { bed: [], wet: 0, minAboveSea: 99 };
    let lo = 99, hi = -99;
    for (let x = R.x0; x <= R.x1; x += 10) for (const dz of [-R.w / 2 + 0.5, 0, R.w / 2 - 0.5]) {
      const h = L.terrainEff(x, R.z + dz); lo = Math.min(lo, h); hi = Math.max(hi, h);
      out.minAboveSea = Math.min(out.minAboveSea, h - L.seaLevelAt(x, R.z + dz));
      if (h < L.seaLevelAt(x, R.z + dz)) out.wet++;
    }
    out.level = +(hi - lo).toFixed(2);
    // room under the deck over the line, across the road
    const T = v.T; let q = null;
    for (const p of T.S) if (p.sec === R.sec && (!q || Math.abs(p.z - R.z) < Math.abs(q.z - R.z))) q = p;
    out.clear = 99;
    for (const p of T.S) if (p.sec === R.sec && Math.abs(p.z - R.z) < R.gap) for (const lat of [-RC.width / 2, 0, RC.width / 2]) out.clear = Math.min(out.clear, p.gy - 1.4 - (R.y + 0.2 + E.h));
    out.clear = +out.clear.toFixed(2);
    // the line clear of other roads and venues (the motorway; another track's samples)
    let hwy = 1e9; for (let x = R.x0; x <= R.x1; x += 20) for (const p of L.highway.pts) hwy = Math.min(hwy, Math.hypot(p.x - x, p.z - R.z));
    out.hwy = Math.round(hwy);
    out.crossings = 0;
    for (const id in L.race.venues) { const TT = L.race.venues[id].track; let near = false;
      for (const p of TT.S) if (p.x > R.x0 - 5 && p.x < R.x1 + 5 && Math.abs(p.z - R.z) < R.w / 2 + RC.width / 2) { if (!(id === "dunes" && p.sec === R.sec)) near = true; }
      if (near) out.crossings++; }
    out.crossS = Math.round(tr.crossS); out.sheds = tr.sheds.length;
    return out;
  });
  check(`race events: the dunes' freight line -- its bed level (${a.level} m from end to end) and dry (${a.wet} wet points; ${a.minAboveSea.toFixed(1)} m over the sea at its lowest), ${a.clear} m spare between the train's roof and the bridge under the road, ${a.crossings} other roads or tracks across it, the motorway ${a.hwy} m away, a shed at each end`,
    a.level < 0.3 && a.wet === 0 && a.minAboveSea > 1.5 && a.clear > 0.5 && a.crossings === 0 && a.hwy > 300 && a.sheds === 2, J(a));

  // ---- b. the train passes under him, every lap, in every car
  const b = await page.evaluate(() => {
    const L = window.__lp, R = L.race, st = L.state, RC = L.RC, out = {};
    for (const veh of ["car", "cybertruck", "corvette", "monster"]) {
      L.api.setVehicle(veh); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
      L.rcStartRace("dunes", 11);
      const tr = L.rce.cur.train, E = RC.events.train, bangs0 = L.flags.carCrashes || 0;
      const o = out[veh] = { under: 0, laps: 0, warned: [], minGap: 99, stuck: 0 }, told0 = L.flags.raceTrainUnder || 0;
      let downFor = 0, crossed = new Set();
      for (let f = 0; f < 60 * 600 && R.phase !== "podium" && R.phase !== "done"; f++) {
        st.touching = true; st.ctrlBank = 0; st.ctrlPitch = 0; L.update(1 / 60);
        const him = R.him;
        downFor = tr.boomA > 0.95 ? downFor + 1 / 60 : 0;
        const d = him.s - (Math.floor(him.s / R.track.len) * R.track.len + tr.crossS);
        if (d >= 0 && d < 4 && !crossed.has(Math.floor(him.s / R.track.len))) {
          crossed.add(Math.floor(him.s / R.track.len));
          o.laps++; o.warned.push(+downFor.toFixed(1));
          if (tr.state === "run" && (tr.x - tr.crossX) * tr.dir > -5 && (tr.x - tr.dir * tr.len - tr.crossX) * tr.dir < 5) o.under++;
        }
        // nothing ever near it: every racer over the line is higher than its roof
        if (tr.state === "run") for (const r of R.racers) {
          const p = r.mesh.position, ax = Math.min(tr.x, tr.x - tr.dir * tr.len), bx = Math.max(tr.x, tr.x - tr.dir * tr.len);
          if (p.x > ax - 2 && p.x < bx + 2 && Math.abs(p.z - tr.R.z) < E.wid) o.minGap = Math.min(o.minGap, +((r.y !== undefined ? r.y : p.y) - (tr.R.y + 0.2 + E.h)).toFixed(2));
        }
      }
      o.told = (L.flags.raceTrainUnder || 0) - told0;   // (and the game knew: its own "under him", every lap)
      o.stuck = R.stuck; o.bangs = (L.flags.carCrashes || 0) - bangs0 + (st.exploding ? 1 : 0);
      L.raceReset();
    }
    st.touching = false;
    return out;
  });
  const cars = Object.keys(b);
  check(`race events: the train passes under him every lap, in every car -- under him ${cars.map(k => `${k} ${b[k].under}/${b[k].laps} (the game said ${b[k].told})`).join(", ")}; the booms down and the lamps flashing for ${cars.map(k => b[k].warned.join("/")).join("; ")} s before he got there; nearest a car came to its roof ${Math.min(...cars.map(k => b[k].minGap))} m; ${cars.map(k => b[k].bangs).join("/")} bangs, ${cars.map(k => b[k].stuck).join("/")} stuck`,
    cars.every(k => b[k].laps >= 3 && b[k].under === b[k].laps && b[k].told === b[k].laps && b[k].warned.every(w => w >= 2) && b[k].minGap > 0.5 && b[k].bangs === 0 && b[k].stuck === 0), J(b));

  // ---- c. the boulders: a boulder's lane spins him, the gap between two does not; they hit the rivals too
  const c = await page.evaluate(() => {
    const L = window.__lp, R = L.race, st = L.state, RC = L.RC, E = RC.events.boulders, out = {};
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    const run = (lat) => {
      L.rcStartRace("dunes", 13); R.phase = "race"; R.raceT0 = R.t;
      const B = L.rce.cur.boulders, him = R.him;
      for (const r of R.racers) if (!r.isHim) r.s -= 2000;
      him.s = B.ev.m - 260; him.lat = lat; him.v = RC.v * 0.86; him.latV = 0;
      const spins0 = R.itLog.spins; let crossedRoad = 0, released = 0, minLat = 99, maxLat = -99;
      for (let i = 0; i < 60 * 14; i++) {
        st.touching = true; st.ctrlBank = 0; st.ctrlPitch = 0; him.lat = lat; him.latV = 0; L.update(1 / 60);
        for (const b of B.rocks) if (b.on) { released = Math.max(released, B.rocks.filter(x => x.on).length); minLat = Math.min(minLat, b.lat); maxLat = Math.max(maxLat, b.lat); }
      }
      crossedRoad = minLat < -RC.width / 2 && maxLat > RC.width / 2;
      return { spins: R.itLog.spins - spins0, released, crossedRoad, bangs: L.flags.carCrashes || 0 };
    };
    const side = RC.tracks.find(t => t.id === "dunes").events[0].side;
    out.lane = run(side * E.lanes[1]);                                  // (the middle boulder's lane)
    out.gap = run(side * (E.lanes[0] + E.lanes[1]) / 2);                // (between the first two)
    // the rivals: a race, and the boulders' hits on them counted alone (not the items'): the boulders are a
    // thing that happens to the whole field, not to him only (they do not steer round them; he can)
    const rivalRace = () => {
      const h0 = L.flags.raceBoulderRivalHits || 0, r0 = L.flags.raceBoulders || 0;
      L.rcStartRace("dunes", 17);
      for (let f = 0; f < 60 * 600 && R.phase !== "podium" && R.phase !== "done"; f++) { st.touching = true; st.ctrlBank = 0; st.ctrlPitch = 0; L.update(1 / 60); }
      L.raceReset();
      return { hits: (L.flags.raceBoulderRivalHits || 0) - h0, released: (L.flags.raceBoulders || 0) - r0 };
    };
    out.rivals = rivalRace();
    st.touching = false;
    return out;
  });
  check(`race events: the boulders -- let go as he comes (${c.lane.released}), across the whole road (${c.lane.crossedRoad}); down a boulder's lane he spun ${c.lane.spins} time(s), in the gap between two ${c.gap.spins}; the rivals hit by boulders ${c.rivals.hits} times in a race (${c.rivals.released} releases)`,
    c.lane.released === 3 && c.lane.crossedRoad && c.lane.spins >= 1 && c.gap.spins === 0 && c.rivals.released >= 3 && c.rivals.hits >= 2, J(c));

  // ---- d. a whole race: the noisy hand and random taps, in every car
  const d = [];
  for (const veh of ["car", "cybertruck", "corvette", "monster"]) d.push(await oneRace(page, veh, 5200 + d.length, { track: "dunes", taps: true }));
  const dOk = d.every(r => r.podium && r.bangs === 0 && r.stuck === 0 && r.stuckMax <= 2 && r.things.every_ >= 4 && r.things.every_ <= 10.5 && (r.things.kinds.train || 0) >= 3 && (r.things.kinds.boulders || 0) >= 3);
  check(`race events: a whole race on the dunes with the noisy hand and random taps -- ${d.map(r => `${r.veh} came ${r.place}, the train under him ${r.things.kinds.train || 0}x, boulders ${r.things.kinds.boulders || 0}x, something every ${r.things.every_} s`).join("; ")}; ${d.reduce((s, r) => s + r.bangs, 0)} bangs, the longest stuck ${Math.max(...d.map(r => r.stuckMax))} s`, dOk, J(d));

  // ---- e. nothing left
  const e = await page.evaluate(() => {
    const L = window.__lp, R = L.race, st = L.state;
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    L.rcStartRace("dunes", 21); R.phase = "race"; R.raceT0 = R.t;
    const v = L.rce.cur, tr = v.train, B = v.boulders;
    R.him.s = tr.crossS - 200; R.him.v = 30;
    for (let i = 0; i < 60 * 4; i++) { st.touching = true; L.update(1 / 60); }
    R.him.s = B.ev.m - 120 + R.track.len; for (let i = 0; i < 60; i++) { st.touching = true; L.update(1 / 60); }
    const during = { run: tr.state, rocks: B.rocks.filter(b => b.on).length };
    L.raceExit(); for (let i = 0; i < 10; i++) { st.touching = false; L.update(1 / 60); }
    return { during, after: { train: tr.state, booms: +tr.boomA.toFixed(2), rocks: B.rocks.filter(b => b.on || b.m.visible).length, cur: !!L.rce.cur } };
  });
  check(`race events: nothing left -- during ${J(e.during)}, after EXIT the train ${e.after.train}, the booms ${e.after.booms}, ${e.after.rocks} boulders out`,
    e.during.run === "run" && e.during.rocks > 0 && e.after.train === "shed" && e.after.booms === 0 && e.after.rocks === 0 && !e.after.cur, J(e));
};
