"use strict";
// ---------------------------------------------------------------------------
// THE TRACKS' EVENTS (v189: Desert Dunes; v190: Snowy Peaks; v191: Beach Splash; v192: Sky Glow Road). Portrait, iPad.
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
// (v190: Snowy Peaks)
//   f. THE SNOWBALLS: the boulders' rule -- down a snowball's lane a spin, in the gap none -- and they grow;
//   g. THE AVALANCHE: on his last lap only, its drift whole before he gets there; every car in it slowed (his and
//      a rival's), none stopped; gone after the race;
//   h. THE SKI JUMP: half as long again in the air, and half as high, as a dune's jump, and landed, no bang;
//   i. A WHOLE RACE on the snow with the noisy hand and random taps, every car: no bang, never stuck over 2 s,
//      snowballs every lap, the avalanche once, the jump every lap, something every 5-10 s.
//
// (v191: Beach Splash)
//   j. THE WAVES: all of them up over the road as he comes, every lap; down the sea's lane he is in the water and
//      slowed (never stopped), down the inland lane never -- no wave reaches it;
//   k. THE SHIP: shots while he is on the water, each marked by its ring at least 1.5 s before it lands; holding his
//      lane he spins, steering off the rings never; the rivals are hit too;
//   l. A WHOLE RACE on the beach with the noisy hand and random taps, every car: no bang, never stuck over 2 s,
//      waves and shots every lap, something every 5-10 s;
//   m. NOTHING LEFT: out of the race no shot in the air, no ring, no wave.
//
// (v192: Sky Glow Road)
//   n. THE BOOST RINGS: aiming at each he goes through every one and is boosted; kept off them, none;
//   o. THE GUSTS: the streaks come at least 1 s before the push; hands-off from the downwind side it carries him on to
//      the barrier, which holds him (never past it), a rival pushed too, no bang; his finger steering into it holds his line within 2 m;
//   p. A WHOLE RACE on the sky road with the noisy hand and random taps, every car: no bang, never stuck over 2 s,
//      the gusts every lap, rings taken, something every 5-10 s;
//   q. NOTHING LEFT: out of the race no streak, no gust blowing, no push.
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

  // ---- f. the snowballs: the boulders' rule on the snow, and they grow
  const f = await page.evaluate(() => {
    const L = window.__lp, R = L.race, st = L.state, RC = L.RC, E = RC.events.snowballs;
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    const run = (lat) => {
      L.rcStartRace("snow", 13); R.phase = "race"; R.raceT0 = R.t;
      const B = L.rce.cur.boulders, him = R.him;
      for (const r of R.racers) if (!r.isHim) r.s -= 2000;
      him.s = B.ev.m - 260; him.lat = lat; him.v = RC.v * 0.86; him.latV = 0;
      const spins0 = R.itLog.spins; let released = 0, rMin = 99, rMax = 0;
      for (let i = 0; i < 60 * 14; i++) {
        st.touching = true; st.ctrlBank = 0; st.ctrlPitch = 0; him.lat = lat; him.latV = 0; L.update(1 / 60);
        const on = B.rocks.filter(x => x.on); released = Math.max(released, on.length);
        for (const b of on) { rMin = Math.min(rMin, b.rr); rMax = Math.max(rMax, b.rr); }
      }
      return { spins: R.itLog.spins - spins0, released, rMin: +rMin.toFixed(2), rMax: +rMax.toFixed(2), kind: B.ev.kind };
    };
    const side = RC.tracks.find(t => t.id === "snow").events[0].side;
    const out = { lane: run(side * E.lanes[1]), gap: run(side * (E.lanes[0] + E.lanes[1]) / 2) };
    L.raceReset(); st.touching = false;
    return out;
  });
  check(`race events: the snowballs -- ${f.lane.released} let go as he comes, growing from ${f.lane.rMin} m to ${f.lane.rMax} m; down a snowball's lane he spun ${f.lane.spins} time(s), in the gap between two ${f.gap.spins}`,
    f.lane.kind === "snowballs" && f.lane.released === 3 && f.lane.rMax >= f.lane.rMin * 1.6 && f.lane.spins >= 1 && f.gap.spins === 0, J(f));

  // ---- g. the avalanche: once, on his last lap, whole before he gets there, slows every car in it, stops none
  const g = await page.evaluate(() => {
    const L = window.__lp, R = L.race, st = L.state, RC = L.RC, A = RC.events.avalanche;
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    L.rcStartRace("snow", 19); R.phase = "race"; R.raceT0 = R.t;
    const av = L.rce.cur.av, him = R.him, len = R.track.len, m = av.ev.m;
    // laps 1 and 2 past it: nothing; then the last lap
    const out = { early: [], vMin: 99, vIn: 0, stuck: 0, rival: null };
    for (let lap = 0; lap < RC.laps; lap++) {
      him.s = lap * len + m - 400; him.lat = 0; him.v = RC.v; him.latV = 0;
      const a0 = L.flags.raceAvalanche || 0;
      let wholeAt = null, still = 0;
      for (let i = 0; i < 60 * 16; i++) {
        st.touching = true; st.ctrlBank = 0; st.ctrlPitch = 0; L.update(1 / 60);
        const d = L.rcGap(him.s, m);
        if (wholeAt === null && av.grow >= 1) wholeAt = -d;                 // (how far before it he was)
        if (Math.abs(d) < A.len / 2 && !him.air) { out.vMin = Math.min(out.vMin, him.v); out.vIn = Math.max(out.vIn, L.rceDrag(him) < 1 ? 1 : 0); }
        still = him.v < 2 ? still + 1 / 60 : 0; out.stuck = Math.max(out.stuck, still);
        if (d > 60) break;
      }
      out.early.push({ lap, fired: (L.flags.raceAvalanche || 0) - a0, wholeAt: wholeAt === null ? null : Math.round(wholeAt) });
      // a rival in the drift is slowed as he is
      // a rival driven through the drift by its own model, against one on open road (the same speed going in)
      if (lap === RC.laps - 1) {
        const [r, c] = R.racers.filter(x => !x.isHim);
        r.s = him.s - L.rcGap(him.s, m) - A.len / 2 - 5; c.s = r.s + 300; r.lat = c.lat = 0;
        for (const x of [r, c]) { x.v = RC.v; x.air = false; x.path = null; x.spinT = 0; }
        let vr = 99, vc = 99;
        for (let i = 0; i < 50; i++) { st.touching = true; L.update(1 / 60); vr = Math.min(vr, r.v); vc = Math.min(vc, c.v); }
        out.rival = +(vr / vc).toFixed(2);
      }
    }
    out.vMin = +out.vMin.toFixed(1); out.stuck = +out.stuck.toFixed(2); out.bangs = L.flags.carCrashes || 0;
    L.raceReset(); st.touching = false;
    out.after = { drift: av.drift.visible, state: av.state };
    return out;
  });
  const gLast = g.early[g.early.length - 1];
  check(`race events: the avalanche -- fired on laps ${J(g.early.map(e => e.fired))} (his last only), its drift whole ${gLast.wholeAt} m before he got there; through it he kept ${g.vMin} m/s at the least (never stopped: still ${g.stuck} s), a rival driven through it kept ${g.rival} of the speed of one on open road; after the race ${J(g.after)}`,
    g.early.slice(0, -1).every(e => e.fired === 0) && gLast.fired === 1 && gLast.wholeAt >= 20 && g.vIn === 1 && g.vMin > 15 && g.stuck === 0 && g.rival < 0.92 && !g.after.drift && g.after.state === "wait", J(g));

  // ---- h. the ski jump throws higher and longer than a dune does, and he lands it
  const h = await page.evaluate(() => {
    const L = window.__lp, R = L.race, st = L.state, RC = L.RC;
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    const fly = (id, k) => {
      L.rcStartRace(id, 23); R.phase = "race"; R.raceT0 = R.t;
      const him = R.him, T = R.track; let from = null; for (const q of T.S) if (q.sec === k) { from = q.s; break; }
      for (const r of R.racers) if (!r.isHim) r.s -= 2000;
      him.s = from - 120; him.lat = 0; him.v = RC.v; him.latV = 0; him.y = undefined;
      let air = 0, peak = 0, landed = 0; const l0 = L.flags.raceLandings || 0;
      for (let i = 0; i < 60 * 10; i++) {
        st.touching = true; st.ctrlBank = 0; st.ctrlPitch = 0; L.update(1 / 60);
        if (him.air) { air = Math.max(air, him.airT); peak = Math.max(peak, him.y - L.rcPoint(him.s, him.lat, {}).y); }
      }
      landed = (L.flags.raceLandings || 0) - l0;
      return { air: +air.toFixed(2), peak: +peak.toFixed(1), landed };
    };
    const ski = RC.tracks.find(t => t.id === "snow").sections.findIndex(s => s.jump && s.jump.ski);
    const dune = RC.tracks.find(t => t.id === "dunes").sections.findIndex(s => s.jump);
    const b0 = L.flags.carCrashes || 0;
    const out = { ski: fly("snow", ski), dune: fly("dunes", dune) };
    out.bangs = (L.flags.carCrashes || 0) - b0;
    L.raceReset(); st.touching = false;
    return out;
  });
  check(`race events: the ski jump -- ${h.ski.air} s in the air and ${h.ski.peak} m over the snow at the top (a dune: ${h.dune.air} s, ${h.dune.peak} m), landed ${h.ski.landed}x, ${h.bangs} bangs`,
    h.ski.air >= h.dune.air * 1.5 && h.ski.peak >= h.dune.peak * 1.5 && h.ski.landed >= 1 && h.bangs === 0, J(h));

  // ---- i. a whole race on the snow: the noisy hand and random taps, in every car
  const i_ = [];
  for (const veh of ["car", "cybertruck", "corvette", "monster"]) i_.push(await oneRace(page, veh, 6200 + i_.length, { track: "snow", taps: true }));
  const iOk = i_.every(r => r.podium && r.bangs === 0 && r.stuck === 0 && r.stuckMax <= 2 && r.things.every_ >= 4 && r.things.every_ <= 10.5 && (r.things.kinds.snowballs || 0) >= 3 && (r.things.kinds.avalanche || 0) === 1 && (r.things.kinds.jump || 0) >= 3);
  check(`race events: a whole race on the snow with the noisy hand and random taps -- ${i_.map(r => `${r.veh} came ${r.place}, snowballs ${r.things.kinds.snowballs || 0}x, the avalanche ${r.things.kinds.avalanche || 0}x, jumps ${r.things.kinds.jump || 0}x, something every ${r.things.every_} s`).join("; ")}; ${i_.reduce((s, r) => s + r.bangs, 0)} bangs, the longest stuck ${Math.max(...i_.map(r => r.stuckMax))} s`, iOk, J(i_));

  // ---- j. the waves: up over the road as he comes, never the inland lane; slowed in one, never stopped
  const jw = await page.evaluate(() => {
    const L = window.__lp, R = L.race, st = L.state, RC = L.RC, E = RC.events.waves;
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    const run = lat => {
      L.rcStartRace("beach", 41); R.phase = "race"; R.raceT0 = R.t;
      const B = L.rce.cur.waves, him = R.him, side = B.ev.side;
      for (const r of R.racers) if (!r.isHim) r.s -= 2000;
      him.s = B.ev.m - 300; him.lat = lat; him.v = RC.v; him.latV = 0;
      const w0 = L.flags.raceWaves || 0; let wet = 0, vMin = 99, vLow = 99, edgeMax = -99, still = 0, stuck = 0;
      for (let i = 0; i < 60 * 24; i++) {
        st.touching = true; st.ctrlBank = 0; st.ctrlPitch = 0; him.lat = lat; him.latV = 0; L.update(1 / 60);
        if (L.rceDrag(him) < 1) { wet++; vMin = Math.min(vMin, him.v); }
        for (const w of B.waves) if (w.t >= 0) edgeMax = Math.max(edgeMax, -L.rceWaveEdge(w, 0) * side);   // (how far inland an edge came, as drawn: its middle, bowed)
        vLow = Math.min(vLow, him.v);
        still = him.v < 2 ? still + 1 / 60 : 0; stuck = Math.max(stuck, still);
        if (L.rcGap(him.s, B.waves[B.waves.length - 1].m) > 60) break;
      }
      return { up: (L.flags.raceWaves || 0) - w0, wet: +(wet / 60).toFixed(1), vMin: +vMin.toFixed(1), vLow: +vLow.toFixed(1), edgeIn: +edgeMax.toFixed(1), stuck: +stuck.toFixed(2) };
    };
    const side = RC.tracks.find(t => t.id === "beach").events[0].side, W = RC.width / 2;
    const out = { sea: run(side * 9), land: run(-side * 9), inland: -side * 9, W, n: E.n };
    L.raceReset(); st.touching = false;
    return out;
  });
  check(`race events: the waves -- ${jw.sea.up} of ${jw.n} up over the road as he came; down the sea's lane he was in the water ${jw.sea.wet} s, slowed to ${jw.sea.vMin} m/s at the least (dry, down the inland lane, never under ${jw.land.vLow}; still ${jw.sea.stuck} s); down the inland lane ${jw.land.wet} s in water; an edge came at most ${jw.sea.edgeIn} m past the middle toward the land (the inland lane is ${Math.abs(jw.inland)} m)`,
    jw.sea.up === jw.n && jw.land.up === jw.n && jw.sea.wet > 0.5 && jw.sea.vMin > 15 && jw.sea.vMin < jw.land.vLow * 0.95 && jw.sea.stuck === 0 && jw.land.wet === 0 && jw.sea.edgeIn < Math.abs(jw.inland) - 2, J(jw));

  // ---- k. the ship: every shot marked before it lands; under one he spins, off the ring he does not; rivals too
  const k = await page.evaluate(() => {
    const L = window.__lp, R = L.race, st = L.state, RC = L.RC, S = RC.events.ship;
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    const run = dodge => {
      L.rcStartRace("beach", 43); R.phase = "race"; R.raceT0 = R.t;
      const Sh = L.rce.cur.ship, him = R.him;
      for (const r of R.racers) if (!r.isHim) r.s -= 2000;
      him.s = Sh.ev.from - 200; him.lat = 0; him.v = RC.v * 0.9; him.latV = 0;
      const sp0 = R.itLog.spins, f0 = L.flags.raceShots || 0; let warned = 99, lat = 0, frame = 0;
      const range = (L.TUNE.dragRangeX * Math.min(innerWidth, innerHeight)) / (L.CAR.dragRangeX * innerWidth);
      const seen = new Map(), was = new Map(); let landed = 0, unseen = 0;   // (ring -> the frame it first showed)
      for (let i = 0; i < 60 * 30; i++, frame++) {
        // dodging, with a finger: off any ring that would land on his lane, toward the nearest lane clear of all of them
        let bank = 0;
        if (dodge) {
          const rings = Sh.shots.filter(s => s.on);
          const hits = l => rings.some(s => Math.abs(l - s.lat) < S.r + 2.2);
          if (hits(lat)) lat = [0, 8, -8, 4, -4].find(l => !hits(l)) ?? lat;
          bank = Math.max(-1, Math.min(1, -(lat - him.lat) * 0.4)) / range;
        }
        st.touching = true; st.ctrlBank = bank; st.ctrlPitch = 0; if (!dodge) { him.lat = 0; him.latV = 0; } L.update(1 / 60);
        for (const s of Sh.shots) {
          if (s.on && s.ring.visible && !seen.has(s.ring)) seen.set(s.ring, frame);
          if (!s.on && was.get(s)) {                                       // (landed this frame: how long had its ring been up?)
            landed++;
            if (seen.has(s.ring)) { warned = Math.min(warned, (frame - seen.get(s.ring)) / 60); seen.delete(s.ring); } else unseen++;
          }
          was.set(s, s.on);
        }
        if (L.rcGap(him.s, Sh.ev.to) > 80) break;
      }
      return { shots: (L.flags.raceShots || 0) - f0, spins: R.itLog.spins - sp0, warned: +warned.toFixed(2), landed, unseen };
    };
    const rivals = () => {
      const h0 = L.flags.raceShotRivalHits || 0;
      L.rcStartRace("beach", 47);
      for (let f = 0; f < 60 * 600 && R.phase !== "podium" && R.phase !== "done"; f++) { st.touching = true; st.ctrlBank = 0; st.ctrlPitch = 0; L.update(1 / 60); }
      L.raceReset();
      return (L.flags.raceShotRivalHits || 0) - h0;
    };
    const out = { held: run(false), dodged: run(true), rivalHits: rivals(), bangs: L.flags.carCrashes || 0 };
    st.touching = false;
    return out;
  });
  check(`race events: the water-cannon ship -- ${k.held.shots} shots as he crossed the water, each ring up at least ${k.held.warned} s before its ball landed (measured); holding the middle lane he spun ${k.held.spins} time(s), steering off the rings with a finger ${k.dodged.spins}; the rivals spun by it ${k.rivalHits} times in a race`,
    k.held.shots >= 4 && k.held.landed >= 4 && k.held.unseen === 0 && k.dodged.unseen === 0 && k.held.warned >= 1.5 && k.dodged.warned >= 1.5 && k.held.spins >= 1 && k.dodged.spins === 0 && k.dodged.shots >= 4 && k.rivalHits >= 1, J(k));

  // ---- l. a whole race on the beach: the noisy hand and random taps, in every car
  const l = [];
  for (const veh of ["car", "cybertruck", "corvette", "monster"]) l.push(await oneRace(page, veh, 7200 + l.length, { track: "beach", taps: true }));
  const lOk = l.every(r => r.podium && r.bangs === 0 && r.stuck === 0 && r.stuckMax <= 2 && r.things.every_ >= 4 && r.things.every_ <= 10.5 && (r.things.kinds.wave || 0) >= 6 && (r.things.kinds.cannon || 0) >= 6);
  check(`race events: a whole race on the beach with the noisy hand and random taps -- ${l.map(r => `${r.veh} came ${r.place}, waves ${r.things.kinds.wave || 0}x, the ship's shots ${r.things.kinds.cannon || 0}x, something every ${r.things.every_} s`).join("; ")}; ${l.reduce((s, r) => s + r.bangs, 0)} bangs, the longest stuck ${Math.max(...l.map(r => r.stuckMax))} s`, lOk, J(l));

  // ---- m. nothing left on the beach
  const mb = await page.evaluate(() => {
    const L = window.__lp, R = L.race, st = L.state;
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    L.rcStartRace("beach", 51); R.phase = "race"; R.raceT0 = R.t;
    const v = L.rce.cur;
    R.him.s = v.ship.ev.from + 20; R.him.v = 30;
    for (let i = 0; i < 60; i++) { st.touching = true; L.update(1 / 60); }
    const shots = v.ship.shots.filter(s => s.on).length;               // (in the air now: one lands 1.9 s after it fires)
    R.him.s = v.waves.ev.m - 60 + R.track.len; for (let i = 0; i < 60 * 2; i++) { st.touching = true; L.update(1 / 60); }
    const during = { shots, waves: v.waves.waves.filter(w => w.t >= 0).length };
    L.raceExit(); for (let i = 0; i < 10; i++) { st.touching = false; L.update(1 / 60); }
    return { during, after: { shots: v.ship.shots.filter(s => s.on || s.ball.visible || s.ring.visible).length, waves: v.waves.waves.filter(w => w.t >= 0 || w.sheet.visible).length } };
  });
  check(`race events: nothing left on the beach -- during ${J(mb.during)}, after EXIT ${J(mb.after)}`,
    mb.during.shots > 0 && mb.during.waves > 0 && mb.after.shots === 0 && mb.after.waves === 0, J(mb));

  // ---- n. the boost rings: through one, a boost; past them all in a lane they are not in, none
  const n = await page.evaluate(() => {
    const L = window.__lp, R = L.race, st = L.state, RC = L.RC;
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    const run = aim => {
      L.rcStartRace("sky", 61); R.phase = "race"; R.raceT0 = R.t;
      const B = L.rce.cur.rings, him = R.him;
      for (const r of R.racers) if (!r.isHim) r.s -= 2000;
      const first = B.rings[0].m, last = B.rings[B.rings.length - 1].m;
      him.s = first - 200; him.lat = 0; him.v = RC.v; him.latV = 0;
      const f0 = L.flags.raceRings || 0; let boosted = 0;
      const range = (L.TUNE.dragRangeX * Math.min(innerWidth, innerHeight)) / (L.CAR.dragRangeX * innerWidth);
      for (let i = 0; i < 60 * 90; i++) {
        // aiming, with a finger: at the next ring, where it is now (it sways); not aiming: the far side of the road from it
        const next = B.rings.find(q => L.rcGap(q.m, him.s) > 0) || B.rings[0];
        const lat = aim ? next.lat : (next.lat > 0 ? -11 : 11);
        st.touching = true; st.ctrlBank = Math.max(-1, Math.min(1, -(lat - him.lat) * 0.4)) / range; st.ctrlPitch = 0; L.update(1 / 60);
        if (him.padT > 0) boosted++;
        if (L.rcGap(him.s, last) > 40) break;
      }
      return { through: (L.flags.raceRings || 0) - f0, boostedS: +(boosted / 60).toFixed(1), n: B.rings.length };
    };
    const out = { aim: run(true), away: run(false) };
    L.raceReset(); st.touching = false;
    return out;
  });
  check(`race events: the boost rings -- steering at each with a finger (they sway) he went through ${n.aim.through} of ${n.aim.n} (boosted ${n.aim.boostedS} s); keeping off them ${n.away.through}`,
    n.aim.through === n.aim.n && n.aim.boostedS > 3 && n.away.through === 0, J(n));

  // ---- o. the gusts: announced before they push; hands-off they push him across (the barrier holds, no bang);
  //         his finger steering into one holds his line; a rival is pushed too
  const o = await page.evaluate(() => {
    const L = window.__lp, R = L.race, st = L.state, RC = L.RC, Wd = RC.events.wind;
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    const range = (L.TUNE.dragRangeX * Math.min(innerWidth, innerHeight)) / (L.CAR.dragRangeX * innerWidth);
    const run = hold => {
      L.rcStartRace("sky", 63); R.phase = "race"; R.raceT0 = R.t;
      const B = L.rce.cur.wind, z = B.zones[0], him = R.him, rival = R.racers.find(r => !r.isHim);
      for (const r of R.racers) if (!r.isHim && r !== rival) r.s -= 2000;
      const lat0 = hold ? 0 : z.dir * 6;                                 // (hands-off from the downwind side: it carries him to the barrier)
      him.s = z.a - 260; him.lat = lat0; him.v = RC.v * 0.9; him.latV = 0;
      rival.s = him.s + 40; rival.lat = 0; rival.v = him.v;
      const b0 = L.flags.carCrashes || 0, g0 = L.flags.raceGusts || 0;
      let firstPush = null, firstStreak = null, drift = 0, rivalDrift = 0, frame = 0, edgeMax = 0, atBarrier = 0;
      const lim = RC.width / 2 - him.wid / 2 - 0.2;
      for (let i = 0; i < 60 * 20; i++, frame++) {
        const bank = hold ? Math.max(-1, Math.min(1, -(0 - him.lat) * 0.4)) / range : 0;   // (his finger, back to the middle)
        if (!hold && L.rceWind(him) === 0 && firstPush === null) { him.lat = lat0; him.latV = 0; }   // (hands-off: where it was set, until the gust)
        st.touching = true; st.ctrlBank = bank; st.ctrlPitch = 0; L.update(1 / 60);
        if (firstStreak === null && B.mesh.count > 0) firstStreak = frame;
        if (firstPush === null && L.rceWind(him) !== 0) firstPush = frame;
        drift = Math.max(drift, Math.abs(him.lat - lat0)); rivalDrift = Math.max(rivalDrift, Math.abs(rival.lat)); edgeMax = Math.max(edgeMax, Math.abs(him.lat));
        if (Math.abs(him.lat) >= lim - 0.05) atBarrier += 1 / 60;
        if (L.rcGap(him.s, z.b) > 30) break;
      }
      return { gusts: (L.flags.raceGusts || 0) - g0, warnS: firstPush === null || firstStreak === null ? null : +((firstPush - firstStreak) / 60).toFixed(2),
               drift: +drift.toFixed(1), rivalDrift: +rivalDrift.toFixed(1), edgeMax: +edgeMax.toFixed(2), lim: +lim.toFixed(2), atBarrier: +atBarrier.toFixed(1), bangs: (L.flags.carCrashes || 0) - b0 };
    };
    const out = { free: run(false), held: run(true), edge: RC.width / 2 };
    L.raceReset(); st.touching = false;
    return out;
  });
  check(`race events: the gusts -- streaks ${o.free.warnS} s before the push; hands-off from the downwind side it carried him ${o.free.drift} m, on to the barrier for ${o.free.atBarrier} s and never past it (at most ${o.free.edgeMax} of ${o.free.lim} m), and a rival ${o.free.rivalDrift} m; his finger steering into it held him within ${o.held.drift} m of his line; ${o.free.bangs + o.held.bangs} bangs`,
    o.free.gusts >= 1 && o.free.warnS >= 1 && o.free.drift > 3 && o.free.atBarrier > 0.5 && o.free.edgeMax <= o.free.lim + 0.01 && o.free.rivalDrift > 3 && o.held.drift < 2 && o.free.bangs === 0 && o.held.bangs === 0, J(o));

  // ---- p. a whole race on the sky road: the noisy hand and random taps, in every car
  const p_ = [];
  for (const veh of ["car", "cybertruck", "corvette", "monster"]) p_.push(await oneRace(page, veh, 8200 + p_.length, { track: "sky", taps: true }));
  const pOk = p_.every(r => r.podium && r.bangs === 0 && r.stuck === 0 && r.stuckMax <= 2 && r.things.every_ >= 4 && r.things.every_ <= 10.5 && (r.things.kinds.gust || 0) >= 5) && p_.reduce((a, r) => a + (r.things.kinds.ring || 0), 0) >= 4;
  check(`race events: a whole race on the sky road with the noisy hand and random taps -- ${p_.map(r => `${r.veh} came ${r.place}, gusts ${r.things.kinds.gust || 0}x, rings ${r.things.kinds.ring || 0}x, something every ${r.things.every_} s`).join("; ")}; ${p_.reduce((s, r) => s + r.bangs, 0)} bangs, the longest stuck ${Math.max(...p_.map(r => r.stuckMax))} s`, pOk, J(p_));

  // ---- q. nothing left on the sky road
  const q = await page.evaluate(() => {
    const L = window.__lp, R = L.race, st = L.state;
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    L.rcStartRace("sky", 65); R.phase = "race"; R.raceT0 = R.t;
    const v = L.rce.cur, z = v.wind.zones[0];
    R.him.s = z.a - 60; R.him.v = 30;
    for (let i = 0; i < 60 * 3; i++) { st.touching = true; L.update(1 / 60); }
    const during = { streaks: v.wind.mesh.count, blowing: v.wind.zones.filter(z => z.t >= 0).length };
    L.raceExit(); for (let i = 0; i < 10; i++) { st.touching = false; L.update(1 / 60); }
    return { during, after: { streaks: v.wind.mesh.count, blowing: v.wind.zones.filter(z => z.t >= 0).length, push: L.rceWind(R.him) } };
  });
  check(`race events: nothing left on the sky road -- during ${J(q.during)}, after EXIT ${J(q.after)}`,
    q.during.streaks > 0 && q.during.blowing > 0 && q.after.streaks === 0 && q.after.blowing === 0 && q.after.push === 0, J(q));
};
