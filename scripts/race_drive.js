"use strict";
// THE NOISY RACE (v164): a four-year-old's hand in a race, many races over.
//
// The parent's target: with the noisy-finger hand he wins about half his races
// and is rarely more than a few seconds off; never a bang, never stuck. This
// drives whole races -- grid, three laps, podium -- through the game's own
// update, with the hand of noisy_drive.js written into the shared stick each
// frame (in game time, not the wall clock, so a hundred races take minutes, not
// hours: the touch path itself is noisy_drive's, and race_checks drives a race
// through real touch events):
//   - every drag wobbles by up to +-15% of the drag range (a tremor of a few
//     hertz, on both axes);
//   - every 12-30 s the finger comes off the glass for 300 ms;
//   - every 8-20 s it overshoots for a second, 35-45% of the range past where
//     it meant to be;
//   - what it MEANS: hold the finger down; aim at a boost pad it sees coming
//     (most of the time); steer round a car right in front of it; otherwise
//     drift where it is. Drag up (the burst) in moods of a few seconds, about
//     half the time.
// Per race: his place, his gap to the winner (or his margin over second),
// bangs, stuck moments, shoves, pads. Per car: the win rate and the worst gap.
//
//   node scripts/race_drive.js [races=20] [cars=car,cybertruck,corvette,monster] [seed=1] [root]
//   RACE_STRENGTH=1.1 ...   the opponents' strength (TUNE.race.ai.strength) for this run
//   RACE_TRACK=dunes ...    which track (v170; the first, the oval, if unset)
//   RACE_HAND=hug ...       (v171) the wall-hugger: the same lifts, tremor, overshoots and
//                           bursts, but what it MEANS is a full steer into the inside of the bend
//                           coming (the last one's on a straight), the whole race -- riding the
//                           inside barrier must never be a free win
// or, from the harness: require("./race_drive").races(page, { veh, races, seed }).
const fs = require("fs"), path = require("path");

// One race, in the page. `seed` is the hand's own stream, never the game's.
async function oneRace(page, veh, seed, opts) {
  return page.evaluate(([veh, seed, opts]) => {
    const L = window.__lp, st = L.state, RC = L.RC;
    L.noRender = true;
    let a = seed >>> 0;
    const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    if (opts.strength) RC.ai.strength = opts.strength;
    if (st.vehicleKey !== veh || !L.raceOn()) { L.api.skipScreens(); L.api.setVehicle(veh); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60); }
    if (opts.step !== undefined) st.speedStep = opts.step;
    L.rcStartRace(opts.track || "oval", seed);   // the race's own stream, seeded with the hand's: one seed, one race
    const R = L.race, him = R.him;
    const range = (L.TUNE.dragRangeX * Math.min(innerWidth, innerHeight)) / (L.CAR.dragRangeX * innerWidth);
    const bangs0 = L.flags.carCrashes || 0, sc0 = L.flags.raceShortcuts || 0, j0 = L.flags.raceJumps || 0;
    let scFor = null, scGo = false;
    let nextLift = 12 + rnd() * 18, liftLeft = 0, nextOver = 8 + rnd() * 12, overLeft = 0, overDir = 1, overAmt = 0;
    let mood = 0, moodLeft = 2 + rnd() * 4, aimPad = null, aimGo = false, passSide = 0, t = 0, exploded = 0, nan = 0;
    let wob1 = rnd() * 6.28, wob2 = rnd() * 6.28, hugSide = 1;
    const log = [];
    for (let f = 0; f < 60 * 60 * 6 && R.phase !== "podium"; f++) {
      const dt = 1 / 60; t += dt;
      // the lifts and the overshoots
      nextLift -= dt; nextOver -= dt;
      if (nextLift <= 0) { liftLeft = 0.3; nextLift = 12 + rnd() * 18; log.push(["lift", +t.toFixed(1)]); }
      if (nextOver <= 0) { overLeft = 1; overDir = rnd() < 0.5 ? -1 : 1; overAmt = 0.35 + rnd() * 0.1; nextOver = 8 + rnd() * 12; log.push(["over", +t.toFixed(1)]); }
      moodLeft -= dt; if (moodLeft <= 0) { mood = rnd() < 0.5 ? 1 : 0; moodLeft = 3 + rnd() * 5; }
      // what it means: a pad it sees, a car in the way, or where it is
      let want = him.lat;
      let pad = null;
      for (const p of R.pads) { const d = ((p.s - him.s) % R.track.len + R.track.len) % R.track.len; if (d > 5 && d < 90) pad = p; }
      if (pad !== aimPad) { aimPad = pad; aimGo = !!pad && rnd() < 0.75; }
      // (v170) a shortcut ahead: it goes for its edge about half the time it comes to one
      // (its draw only where a track has one, so the oval's hand is the one it was)
      let sc = null;
      for (const c of (R.track.sc || [])) { const d = ((c.sa + c.gore - him.s) % R.track.len + R.track.len) % R.track.len; if (d > 0 && d < 90 && !him.path) sc = c; }
      if (sc && sc !== scFor) { scFor = sc; scGo = rnd() < 0.5; }
      if (him.path) want = 0;
      else if (sc && scGo) want = sc.side * (L.RC.width / 2 - sc.mouth / 2);
      else if (pad && aimGo) want = pad.lat;
      else {
        for (const o of R.racers) {
          if (o === him || o.path !== him.path) continue;
          let ds = (o.s - him.s) % R.track.len; if (ds > R.track.len / 2) ds -= R.track.len; if (ds < -R.track.len / 2) ds += R.track.len;
          if (ds > 0 && ds < 25 && Math.abs(o.lat - him.lat) < 4.5) { if (!passSide) passSide = o.lat > 0 ? -1 : 1; want = o.lat + passSide * 6; }
        }
        if (want === him.lat) passSide = 0;
      }
      // the drag that would put him there: drag right moves him right (-left)
      let bank = Math.abs(want - him.lat) < 0.8 ? 0 : Math.max(-1, Math.min(1, -(want - him.lat) * 0.22));
      if (opts.hand === "hug") { const q = L.rcAt(him.s + 40); if (Math.abs(q.kh) > 0.002) hugSide = Math.sign(q.kh); bank = -hugSide; }
      else if (sc && scGo && !him.path && ((sc.sa + sc.gore - him.s) % R.track.len + R.track.len) % R.track.len < sc.hold + 8) bank = -sc.side;   // (going for a shortcut: the full steer, held through its approach -- the turn rule)
      wob1 += dt * (2 + rnd() * 3); wob2 += dt * (2 + rnd() * 3);
      bank += Math.sin(wob1) * 0.15;
      let pitch = (mood && R.phase === "race" ? 0.8 : 0) + Math.sin(wob2) * 0.15;
      if (overLeft > 0) { overLeft -= dt; bank += overDir * overAmt; }
      const touching = liftLeft <= 0;
      if (liftLeft > 0) liftLeft -= dt;
      st.touching = touching; st.touchIsPoint = false;
      st.ctrlBank = touching ? bank / range : 0; st.ctrlPitch = touching ? pitch : 0;
      L.update(dt);
      if (st.exploding) exploded++;
      if (!isFinite(him.s) || !isFinite(him.lat) || !isFinite(st.x)) nan++;
    }
    const order = R.order.map(r => ({ key: r.key, him: r.isHim, t: +r.finishT.toFixed(2) }));
    const win = order[0], me = order.find(o => o.him);
    const out = {
      veh, seed, place: him.place, field: R.racers.length,
      gap: +(me.t - (him.place === 1 ? order[1].t : win.t)).toFixed(2),   // + seconds behind the winner; - his margin over second
      time: me.t, bangs: (L.flags.carCrashes || 0) - bangs0 + (exploded ? 1 : 0), stuck: R.stuck, nan,
      shoves: R.shoves, walls: R.wallShoves, pads: R.padHits, podium: R.phase === "podium", order: order.map(o => o.key + ":" + o.t),
    };
    if (R.track.sc && R.track.sc.length || R.track.jumps) { out.shortcuts = (L.flags.raceShortcuts || 0) - sc0; out.jumps = (L.flags.raceJumps || 0) - j0; }
    st.touching = false; st.ctrlBank = 0; st.ctrlPitch = 0;
    return out;
  }, [veh, seed, opts || {}]);
}

async function races(page, { veh, races: n, seed, strength, step, track, hand }) {
  const out = [];
  for (let k = 0; k < n; k++) out.push(await oneRace(page, veh, (seed || 1) * 1000 + k, { strength, step, track, hand }));
  return out;
}

function summary(list) {
  const wins = list.filter(r => r.place === 1).length;
  const losses = list.filter(r => r.place !== 1);
  return {
    races: list.length, wins, winRate: +(wins / list.length).toFixed(2),
    worstGap: losses.length ? Math.max(...losses.map(r => r.gap)) : 0,
    medianGap: losses.length ? losses.map(r => r.gap).sort((a, b) => a - b)[Math.floor(losses.length / 2)] : 0,
    places: list.map(r => r.place).join(""), bangs: list.reduce((a, r) => a + r.bangs, 0), stuck: list.reduce((a, r) => a + r.stuck, 0),
    nan: list.reduce((a, r) => a + r.nan, 0), noPodium: list.filter(r => !r.podium).length,
  };
}
module.exports = { oneRace, races, summary };

if (require.main === module) {
  const { launch, openGame, serve } = require("./art_rig.js");
  (async () => {
    const args = process.argv.slice(2);
    const root = args[3] && fs.existsSync(path.join(args[3], "cockpit")) ? path.resolve(args[3]) : path.join(__dirname, "..");
    const n = +(args[0] || 20), cars = (args[1] || "car,cybertruck,corvette,monster").split(","), seed = +(args[2] || 1);
    const port = +(process.env.PORT || 8231), srv = serve(root, port), browser = await launch();
    const page = await openGame(browser, port, { width: 820, height: 1180 });
    await page.waitForFunction(() => window.__lp && window.__lp.race && window.__lp.race.built, null, { timeout: 120000 });
    const all = {};
    for (const veh of cars) {
      const list = [];
      for (let k = 0; k < n; k++) {
        const r = await oneRace(page, veh, seed * 1000 + k, { strength: process.env.RACE_STRENGTH ? +process.env.RACE_STRENGTH : undefined,
                                                             step: process.env.RACE_STEP !== undefined ? +process.env.RACE_STEP : undefined, track: process.env.RACE_TRACK, hand: process.env.RACE_HAND });
        list.push(r);
        console.log(JSON.stringify(r));
      }
      all[veh] = summary(list);
      console.log("SUMMARY " + veh + " " + JSON.stringify(all[veh]));
    }
    console.log("ALL " + JSON.stringify(all));
    await browser.close(); srv.close();
  })().catch(e => { console.error(e); process.exit(1); });
}
