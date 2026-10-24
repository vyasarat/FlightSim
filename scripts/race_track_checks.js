"use strict";
// ---------------------------------------------------------------------------
// THE TRACKS AFTER THE FIRST (v170: Desert Dunes). Portrait, iPad. For every track
// in TUNE.race.tracks but the oval (race_checks has that one):
//
//   a. it closes, at the length its numbers say; it stands on dry ground (its
//      barriers and 15 m past them), clear of every road's corridor, both cities
//      and the other venues;
//   b. alone, finger down and straight at his own step, every car laps it in
//      about two minutes, 90 to 150 s (v173; the oval too);
//   c. WHAT IT IS MADE OF: on each surface it has, his speed settles at the
//      track's base speed times his step times that surface's `speed` -- the same
//      for every car, and the same for an opponent running at skill 1;
//   d. A DUNE IS A JUMP, THE SAME FOR EVERY CAR: at his step each car leaves the
//      deck at every dune and flies the same time (to three frames of 60 Hz); it
//      is never under the deck, never off it, and never bangs; at the top step it
//      is a jump, not a flight (under 80 m; v190: a ski jump, built to throw him further, under jump.skiFar);
//   e. A SHORTCUT IS HIS CHOICE, NEVER A TRAP AND NEVER A CHEAT: it is a fork, so the
//      turn rule -- a full steer held through its approach takes it; hands-off in the
//      middle, hands-off ON ITS EDGE (a finger left there after a pad) and a light
//      touch toward it never do; it is faster than the road's inside line by less
//      than 0.6 s, the same for every car; the opponents take it now and then;
//   f. a race with the noisy hand in every car: no bang, never stuck;
//   g. when he loses there, the podium shot fits his car and the steps (v167's
//      fit, on this track's podium); the flag races him THERE again; out of a race
//      the world's track (race.track) is the first again;
//   h. NOTHING NEW IN PLAY: a race on it makes no three.js object (each draws the
//      seeded stream) and draws nothing from Math.random;
//   k. (v171, the oval too) A STEER HELD INTO A BARRIER GLIDES: a whole lap held full
//      into either barrier, in every car, is one thump on the first touch and then a
//      quiet glide, no bang, never stuck, and never quicker than the racing line;
//      off it a second and back into it is a fresh hit, one thump more;
//   m. (v172, the oval too) HIS OWN CAR NEVER HIDES WHAT HE AIMS AT: from the chase
//      camera (where the game put it, settled), the road 60 and 80 m ahead on the longest straight, in the middle and
//      both pad lanes, is not behind his own body, in every car.
//   n. (v174, every track) SNOW AND ICE: hands-off a whole lap, a slippery bend swings every car
//      wide the same, never into a bank, and he is back on his line after it; nothing else swings;
//   o. (v174) THE TUNNEL: roofed all through, the mountain solid beside it, the road in front of
//      each portal open; the chase camera stays inside the lining, his car in sight, every car;
//   p. (v174) THE FROZEN LAKE: the crossing on the bed's middle, its deck dead level on the bed's
//      height, the bed level and dry under all the ice;
//   q. (v175) THE SPLASH: the deck down at the water over real water (the one definition), never
//      under the ground or the water; the spray -- his and the cars round him -- never between the
//      chase camera and his car, or his seat and the road 30 m ahead;
//   s. (v180) SNOW READS AS SNOW: the ground round a snow venue never green-blotched, the tunnel's mountain
//      snow in the shade from the side turned from the sun, the snowbanks closed where they change shape and
//      sloping, never stepping, down to the lake's low bank; (v183) and the LOW ground round it, under the snow
//      line, white too -- never tan or olive -- with the motorway under none of the venue's snow;
//   t. (v181) THE SPRAY READS AS SPRAY: soft puffs from the race's own pool (none from the world's lit,
//      faceted spheres, which read as boulders); on every surface that throws any, the spray shows (it is
//      not lost in the ground) but covers little of the screen and less than a fifth of his car, no puff is
//      drawn taller than RC.spray.maxPx of the screen, and the splash's reads WHITE (bright, colourless);
//   u. (v184) THE PODIUM'S FIREWORKS READ AS FIREWORKS: he wins, and over the podium they burst from the
//      race's own soft points (none of the world's lit, faceted spheres, which read as grey and teal lumps),
//      their body bright and coloured, in portrait and landscape; not one of their pixels on a button, the
//      trophy or his car; none left once the race is put away.
//   r. (v176) THE SKY ROAD: up as high as its numbers say and never under the ground; where it is
//      up, a pylon from the ground to its girder every pylonStep, the girder solid across the deck and
//      the barriers beside it -- a plane and a helicopter flown at it crash, free; its glow on the
//      barriers' tops, never over the deck; no flag pole under it; a lap hands-off with the field, every car on the deck;
//   i. (v170) A SPENT STEER AND A PITCH THAT STAYS IN THE RACE: the full steer that took
//      a shortcut, still held a whole lap, is nobody's choice of it the next time
//      round; lifted (past liftGrace) and put back full, it is his again and takes
//      it. Off a dune the seat and gauge pitch with him (more than 8 degrees) and
//      are level again a second after he lands; and leaving the race in the air,
//      in every car, he comes back to the world level and stays level (the monster
//      truck: with the ground's own pitch, mon.pitch, and nothing of the race's).
// ---------------------------------------------------------------------------
const { oneRace } = require("./race_drive.js");

module.exports = async function raceTrackChecks({ newPage, check, full }) {
  const J = o => JSON.stringify(o);
  const { page } = await newPage(820, 1180);
  await page.waitForFunction(() => window.__lp && window.__lp.race && window.__lp.race.built, null, { timeout: 120000 });
  const ids = await page.evaluate(() => window.__lp.RC.tracks.slice(1).map(t => t.id));
  // (v177) THE SAMPLE AND THE SWEEP. Three checks drive whole laps or races in every car on every
  // track (b. the lap alone, f. the noisy race, k. the barrier): on five tracks that was most of this
  // module's ten minutes. In the full harness each of them takes ONE car per track, turning through
  // the four so every car is on some track for each (b, f and k start one car apart); the whole
  // matrix, every car on every track, is `full` -- scripts/race_sweep.js, which the gate demands
  // whenever a race or track file changes (and RACE_FULL=1 with run_module.js).
  full = full || !!process.env.RACE_FULL;
  const ALL = ["car", "cybertruck", "corvette", "monster"], order = ["oval"].concat(ids);
  const carsFor = (id, off) => full ? ALL : [ALL[(order.indexOf(id) + off) % ALL.length]];
  const tag = (id, off) => full ? "" : ` (sample: the ${carsFor(id, off)[0]} here; every car on every track: race_sweep.js)`;
  check(`race tracks: there is a track after the oval (${ids.join(", ")})`, ids.length >= 1);

  // a lap of it alone, finger down at his step, in every car: (v173) about two minutes (the parent:
  // "each lap takes about 2 minutes, not 1"), 90 to 150 s -- the first includes the standing start
  const lapsAlone = (id) => page.evaluate(([id, cars]) => {
    const L = window.__lp, S = L.state, out = {};
    L.noRender = true; L.api.skipScreens();
    for (const veh of cars) {
      L.api.setVehicle(veh); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
      L.spdReset(); L.rcStartRace(id, 31);
      const R = L.race, him = R.him, laps = []; let t0 = null, last = 0;
      const field = R.racers.slice(); R.racers = [him];                 // (alone on the track; the field back before it is put away)
      for (let f = 0; f < 60 * 600 && R.phase !== "done" && R.phase !== "podium"; f++) {
        S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60);
        if (R.phase === "race" && t0 === null) t0 = R.t;
        if (him.lapsDone > last) { laps.push(+(R.t - t0).toFixed(1)); t0 = R.t; last = him.lapsDone; }
      }
      out[veh] = laps;
      R.racers = field; L.raceReset();
    }
    L.noRender = false;
    return out;
  }, [id, carsFor(id, 0)]);
  const lapCheck = async (id) => {
    const b = await lapsAlone(id), allLaps = Object.values(b).flat();
    check(`race ${id}: finger down at his own step, every car laps it in about two minutes -- ${Object.entries(b).map(([k, v]) => `${k} ${v.join("/")} s`).join(", ")}${tag(id, 0)}`,
      Object.values(b).every(v => v.length === 3) && allLaps.every(t => t >= 90 && t <= 150), J(b));
  };
  await lapCheck("oval");

  // (v173: the oval too -- it moved on to new ground)
  const siteCheck = async (id) => {
    // ---- a. closes, dry, clear
    const a = await page.evaluate((id) => {
      const L = window.__lp, RC = L.RC, V = L.race.venues[id], T = V.track, S = T.S, W = RC.width / 2 + RC.kerbW + 0.4;
      let dry = Infinity, corridor = 0, city = 0, other = Infinity;
      // (the road corridor, read without this venue's own claim: a point of it is the venue's
      // when it is within the venue's width of its own track)
      const own = (x, z) => S.some(q => Math.hypot(q.x - x, q.z - z) < 60);
      // (v175) a splash is in the water on purpose, and its shore with it: within 1.5 times
      // its easing of one, the dryness is q's to check, not this
      const shore = q => (T.splashes || []).some(w => q.s > w.a - 1.5 * RC.splash.along && q.s < w.b + 1.5 * RC.splash.along);
      for (let i = 0; i < S.length; i += 6) {
        const q = S[i];
        for (const k of [-W - 15, -W, W, W + 15]) {
          const x = q.x + q.lx * k, z = q.z + q.lz * k;
          if (!shore(q) && !q.up) dry = Math.min(dry, L.terrainEff(x, z) - L.seaLevelAt(x, z));   // (v176: a sky road's ribbon stands on pylons -- the ground it flies over is not its to keep dry)
          if (L.cityCovers && L.cityCovers(x, z, 40)) city++;
        }
        if (Math.abs(L.hwyNearest(q.x, q.z).lateral) < 150) corridor++;
      }
      for (const k in L.race.venues) if (k !== id) { const O = L.race.venues[k].track.S; for (let i = 0; i < S.length; i += 20) for (let j = 0; j < O.length; j += 20) other = Math.min(other, Math.hypot(S[i].x - O[j].x, S[i].z - O[j].z)); }
      let want = 0; for (const sc of T.def.sections) want += sc.type === "turn" ? Math.abs(sc.angle) * Math.PI / 180 * sc.radius : sc.len;
      return { len: +T.len.toFixed(1), want: +want.toFixed(1), gap: +T.gap.toFixed(3), turn: +T.turn.toFixed(4), dry: +dry.toFixed(1), corridor, city, other: Math.round(other) };
    }, id);
    check(`race ${id}: the track closes (${a.gap} m and ${a.turn} rad from its start) at the ${a.want} m its numbers say (${a.len}); dry by ${a.dry} m at its barriers and 15 m past them, ${a.corridor} samples near the motorway, ${a.city} in a city, ${a.other} m from the next venue`,
      a.gap < 0.5 && a.turn < 0.01 && Math.abs(a.len - a.want) < 1 && a.dry >= 1 && a.corridor === 0 && a.city === 0 && a.other > 300, J(a));
  };
  await siteCheck("oval");

  for (const id of ids) {
    // ---- a. closes, dry, clear
    await siteCheck(id);

    // ---- b. (v173) a lap takes about two minutes -- he asked for longer tracks -- every car, finger down
    await lapCheck(id);

    // ---- c. surfaces: the same speed on each, for every car and for them
    const c = await page.evaluate((id) => {
      const L = window.__lp, S = L.state, RC = L.RC, out = {};
      L.noRender = true; L.api.skipScreens();
      const T = L.race.venues[id].track, kinds = [...new Set(T.S.map(q => q.sf))];
      for (const veh of ["car", "cybertruck", "corvette", "monster"]) {
        out[veh] = {};
        for (const kind of kinds) {
          L.api.setVehicle(veh); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
          L.spdReset(); L.rcStartRace(id, 32);
          const R = L.race, him = R.him;
          for (let i = 0; i < 60 * 5; i++) { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60); }
          // the longest run of that surface away from dunes and pads, from its start
          let best = null, run = null;
          for (const q of T.S) { if (q.sf === kind && !q.dune) { if (!run) run = { a: q.s }; run.b = q.s; if (!best || run.b - run.a > best.b - best.a) best = run; } else run = null; }
          const base = Math.floor(him.s / T.len) * T.len + T.len, step = L.spdMul(), v0 = RC.v * step * RC.surfaces[kind].speed;
          const o = R.racers.find(r => !r.isHim);
          for (const r of R.racers) if (!r.isHim && r !== o) { r.s = base - 900; r.skill = 0; }
          him.s = base + best.a + 2; him.lat = 3; him.v = v0; him.padT = 0; him.burstT = 0;
          o.s = him.s + 14; o.lat = 9; o.v = v0; o.skill = 1; o.padT = 0; o.burstT = 0; o.aiBurst = 1e9; o.wantBurst = false; o.line = 9; o.aim = null;
          for (let i = 0; i < 60 * 2.2 && him.s < base + best.b - 10; i++) {
            S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60);
            o.padT = 0; o.burstT = 0;
          }
          out[veh][kind] = { want: +v0.toFixed(2), him: +him.v.toFixed(2), them: +o.v.toFixed(2), on: L.rcAt(him.s).sf };
          L.raceReset();
        }
      }
      L.noRender = false;
      return out;
    }, id);
    const cBad = [];
    for (const veh in c) for (const k in c[veh]) { const r = c[veh][k]; if (r.on !== k || Math.abs(r.him - r.want) > 0.3 || Math.abs(r.them - r.want) > 0.6) cBad.push(veh + ":" + k); }
    check(`race ${id}: every surface sets the same speed for every car and for them -- ${Object.entries(c.car).map(([k, r]) => `${k} ${r.want} m/s`).join(", ")} (his, in the four cars, ${Object.keys(c.car).map(k => ["car", "cybertruck", "corvette", "monster"].map(v => c[v][k].him).join("/")).join("; ")}; an opponent's ${Object.keys(c.car).map(k => c.car[k].them).join("/")})`,
      cBad.length === 0 && Object.keys(c.car).length >= 2, J({ cBad, c }));

    // ---- d. jumps: the same for every car; never under or off the deck; a jump at the top step
    const hasJumps = await page.evaluate((id) => !!window.__lp.race.venues[id].track.jumps, id);
    if (hasJumps) {
      const d = await page.evaluate((id) => {
        const L = window.__lp, S = L.state, RC = L.RC, out = {};
        L.noRender = true; L.api.skipScreens();
        for (const [veh, step] of [["car", null], ["cybertruck", null], ["corvette", null], ["monster", null], ["corvette", 4], ["car", 0]]) {
          L.api.setVehicle(veh); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
          L.spdReset(); if (step !== null) S.speedStep = step;
          L.rcStartRace(id, 33);
          const R = L.race, him = R.him, T = R.track, bangs0 = L.flags.carCrashes || 0, flights = [];
          const field = R.racers.slice(); R.racers = [him];
          let cur = null, under = 0, maxD = 0, outLat = 0, lap = 0;
          for (let f = 0; f < 60 * 300 && him.lapsDone < 1; f++) {
            S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60);
            if (him.path) continue;
            const deck = L.rcPoint(him.s, him.lat, {}).y;
            if (him.y !== undefined && him.y < deck - 0.02) under++;
            if (Math.abs(him.lat) > RC.width / 2) outLat++;
            if (him.air) { if (!cur) cur = { t: 0, s0: him.s, h: 0 }; cur.t += 1 / 60; cur.h = Math.max(cur.h, him.y - deck); }
            else if (cur) { cur.d = him.s - cur.s0; if (cur.t > 0.15) flights.push({ t: +cur.t.toFixed(2), d: Math.round(cur.d), h: +cur.h.toFixed(2) }); cur = null; }
          }
          out[veh + (step === null ? "" : "@" + step)] = { flights, under, outLat, bangs: (L.flags.carCrashes || 0) - bangs0, dunes: T.def.sections.filter(sc => sc.jump).length };
          R.racers = field; L.raceReset();
        }
        L.noRender = false;
        return out;
      }, id);
      const def = ["car", "cybertruck", "corvette", "monster"].map(k => d[k]);
      const t0 = def[0].flights.map(f => f.t);
      const same = def.every(r => r.flights.length === r.dunes && r.flights.every((f, i) => Math.abs(f.t - t0[i]) <= 0.05));   // (three frames: where in a frame it leaves the crest)
      const top = d["corvette@4"];
      const far = await page.evaluate(id => { const RC = window.__lp.RC; return RC.tracks.find(t => t.id === id).sections.filter(sc => sc.jump).map(sc => sc.jump.ski ? RC.jump.skiFar : 80); }, id);   // (each flight's own jump, in lap order)
      check(`race ${id}: every dune is a jump, the same for every car -- at his step each flies ${def[0].flights.map(f => `${f.t} s, ${f.d} m`).join(" and ")} (the four cars ${def.map(r => r.flights.map(f => f.t).join("/")).join("; ")}); never under the deck (${def.reduce((a, r) => a + r.under, 0)} frames) or off it (${def.reduce((a, r) => a + r.outLat, 0)}), no bang; at the top step ${top.flights.map(f => f.d + " m").join(" and ")} (a jump, not a flight); at the lowest it may roll over`,
        same && def.every(r => r.under === 0 && r.outLat === 0 && r.bangs === 0) && top.flights.length === top.dunes && top.flights.every((f, i) => f.d < far[i]) && top.under === 0 && top.bangs === 0 && d["car@0"].bangs === 0 && d["car@0"].under === 0, J(d));
    }

    // ---- e. a shortcut: his choice, never a trap, never a cheat
    const hasSc = await page.evaluate((id) => window.__lp.race.venues[id].track.sc.length, id);
    if (hasSc) {
      const e = await page.evaluate((id) => {
        const L = window.__lp, S = L.state, RC = L.RC, out = {};
        L.noRender = true; L.api.skipScreens();
        const range = (L.TUNE.dragRangeX * Math.min(innerWidth, innerHeight)) / (L.CAR.dragRangeX * innerWidth);
        for (const veh of ["car", "cybertruck", "corvette", "monster"]) {
          out[veh] = {};
          for (const mode of ["middle", "inside", "shortcut", "held", "lift", "edge", "light"]) {
            L.api.setVehicle(veh); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
            L.spdReset(); L.rcStartRace(id, 34);
            const R = L.race, him = R.him, sc = R.track.sc[0];
            for (let i = 0; i < 60 * 5; i++) { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60); }
            const field = R.racers.slice(); R.racers = [him];
            him.s = sc.sa - 120; him.lat = 0; him.v = RC.v * L.spdMul() * 0.86;
            let t = 0, took = false, start = null, atNose = null, liftT = 0, shoves0 = null;
            const nose = sc.sa + sc.gore;
            for (let f = 0; f < 60 * 30; f++) {
              let want = 0, bank = null;
              // a full steer to its side held to the gore; or steered to that edge early and then
              // hands-off (a finger left there after a pad); or a light touch toward it all the way
              if (mode === "shortcut" || mode === "lift") { if (him.path) bank = 0; else if (him.s >= nose - sc.hold - 10) bank = -sc.side; else want = sc.side * (RC.width / 2 - 2); }
              // (held: the same full steer, never let go -- on the shortcut and past it)
              if (mode === "held") { if (him.path || him.s >= nose - sc.hold - 10) bank = -sc.side; else want = sc.side * (RC.width / 2 - 2); }
              if (mode === "edge") { if (him.s < nose - sc.hold - 30) want = sc.side * (RC.width / 2 - 1); else bank = 0; }
              if (mode === "light") bank = him.path ? 0 : -sc.side * 0.5;
              if (mode === "inside" && !him.path) { const q = L.rcAt(him.s); if (Math.abs(q.kh) > 0.002 && him.s > nose + 2) want = Math.sign(q.kh) * 9; }
              const err = want - him.lat;
              if (bank === null) bank = mode === "middle" ? 0 : Math.abs(err) < 0.5 ? 0 : Math.max(-1, Math.min(1, -err * 0.4));
              // (the lift: 300 ms off the glass half-way through the approach, then the finger lands at
              // the middle of a new drag and takes 0.4 s to get back to full -- the car's relatch)
              let touch = true;
              if (mode === "lift" && !him.path && him.s >= nose - sc.hold / 2 && liftT < 0.7) { liftT += 1 / 60; if (liftT < 0.3) touch = false; else bank = -sc.side * Math.min(1, (liftT - 0.3) / 0.4); }
              const s0 = him.s;
              S.touching = touch; S.ctrlBank = touch ? bank / range : 0; S.ctrlPitch = 0; L.update(1 / 60);
              if (atNose === null && s0 < nose && (him.s >= nose || him.path)) atNose = +(him.path ? sc.latC + him.lat : him.lat).toFixed(1);
              if (him.path) { took = true; if (shoves0 === null) shoves0 = R.wallShoves; }
              if (start === null && him.s >= sc.sa - 50) start = R.t;
              if (him.s >= sc.sb + 50) { t = R.t - start; break; }
            }
            out[veh][mode] = { t: +t.toFixed(2), took, atNose, onWall: shoves0 === null ? null : R.wallShoves - shoves0 };
            R.racers = field; L.raceReset();
          }
        }
        // the opponents: a few races, how many of them took it
        let takes = 0, passes = 0;
        L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
        for (let k = 0; k < 3; k++) {
          L.spdReset(); L.rcStartRace(id, 40 + k);
          const R = L.race, sc = R.track.sc[0], seen = new Set();
          for (let f = 0; f < 60 * 600 && R.phase !== "done" && R.phase !== "podium"; f++) {
            S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60);
            for (const o of R.racers) if (!o.isHim && o.path && !seen.has(o.i + ":" + o.scBase)) { seen.add(o.i + ":" + o.scBase); takes++; }
          }
          passes += (R.racers.length - 1) * 3;
          L.raceReset();
        }
        out.ai = { takes, passes };
        L.noRender = false;
        return out;
      }, id);
      const { sc0, W2 } = await page.evaluate((id) => ({ sc0: (({ side, mouth }) => ({ side, mouth }))(window.__lp.race.venues[id].track.sc[0]), W2: window.__lp.RC.width / 2 }), id);
      const cars = ["car", "cybertruck", "corvette", "monster"], gain = cars.map(k => +(e[k].inside.t - e[k].shortcut.t).toFixed(2)), heldGain = cars.map(k => +(e[k].inside.t - e[k].held.t).toFixed(2));
      check(`race ${id}: the shortcut is his choice -- a full steer held to it takes it (the turn rule); a lift of 300 ms in its approach, the finger landing again and finding its drag, still does; hands-off ON its edge (at the gore, lat ${e.car.edge.atNose}) or a light touch toward it never does; it is ${gain[0]} s faster than the road's inside line (${e.car.inside.t} s against ${e.car.shortcut.t} s; the middle ${e.car.middle.t} s), the same in every car (${gain.join("/")}), never a cheat (under 0.6 s); with the finger held full the whole way he takes it, the held steer spent once he is on (no thump on its wall: ${cars.map(k => e[k].held.onWall).join("/")}), and it gains ${heldGain.join("/")} s; hands-off down the middle he never takes it; the opponents took it ${e.ai.takes} times in ${e.ai.passes} passes`,
        cars.every(k => e[k].shortcut.took && e[k].held.took && e[k].held.onWall === 0 && e[k].lift.took && !e[k].middle.took && !e[k].inside.took && !e[k].edge.took && !e[k].light.took && e[k].edge.atNose !== null && sc0.side * e[k].edge.atNose >= W2 - sc0.mouth) && gain.every(g => g > 0 && g < 0.6) && Math.max(...gain) - Math.min(...gain) < 0.05 && heldGain.every(g => g > 0 && g < 0.6) && e.ai.takes > 0 && e.ai.takes < e.ai.passes * 0.6, J(e));
    }

    // ---- i. the spent steer, and the pitch stays in the race (v174: the pitch on any track with a
    // jump; the spent steer where there is a shortcut)
    if (hasSc || hasJumps) {
      const sp = await page.evaluate(([id, hasSc]) => {
        const L = window.__lp, S = L.state, RC = L.RC, out = {};
        L.noRender = true; L.api.skipScreens();
        const range = (L.TUNE.dragRangeX * Math.min(innerWidth, innerHeight)) / (L.CAR.dragRangeX * innerWidth);
        if (hasSc) {
        L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
        L.spdReset(); L.rcStartRace(id, 34);
        const R = L.race, him = R.him, sc = R.track.sc[0], Ln = R.track.len, nose = sc.sa + sc.gore;
        for (let i = 0; i < 60 * 5; i++) { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60); }
        const field = R.racers.slice(); R.racers = [him];
        him.s = sc.sa - 120; him.lat = 0; him.v = RC.v * L.spdMul() * 0.86;
        // pass 1: steered to its edge, then full and NEVER let go -- two passes; pass 3: a 0.6 s lift
        // before its approach, the finger landing full again
        const takes = [0, 0, 0], atNose = [null, null, null]; let wasOn = false, lifted = 0;
        for (let f = 0; f < 60 * 600; f++) {
          const pass = Math.floor((him.s - (sc.sa - 120)) / Ln), rel = him.s - pass * Ln;
          if (pass > 2) break;
          let bank = -sc.side, touch = true;
          if (pass === 0 && rel < nose - sc.hold - 10) { const err = sc.side * (RC.width / 2 - 2) - him.lat; bank = Math.abs(err) < 0.5 ? 0 : Math.max(-1, Math.min(1, -err * 0.4)); }
          if (pass === 2 && rel > nose - sc.hold - 60 && lifted < 0.6) { lifted += 1 / 60; touch = false; }
          const r0 = rel;
          S.touching = touch; S.ctrlBank = touch ? bank / range : 0; S.ctrlPitch = 0; L.update(1 / 60);
          if (atNose[pass] === null && r0 < nose && (him.s - pass * Ln >= nose || him.path)) atNose[pass] = +(him.path ? sc.latC + him.lat : him.lat).toFixed(1);   // (where across he meets the gore: on its edge, or the 0 proves nothing)
          if (him.path && !wasOn) takes[pass]++;
          wasOn = !!him.path;
        }
        out.takes = takes; out.atNose = atNose; out.edge = sc.side * (RC.width / 2 - sc.mouth); out.wallsHeld = R.wallShoves;
        R.racers = field; L.raceReset();
        }
        // the pitch: off the first dune, and leaving the race in the air, in every car
        out.cars = {};
        for (const veh of ["car", "cybertruck", "corvette", "monster"]) {
          L.api.setVehicle(veh); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
          L.spdReset(); L.rcStartRace(id, 34);
          const R = L.race, him = R.him, d = R.track.S.find(q => q.dune);
          for (let i = 0; i < 60 * 5; i++) { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60); }
          const field = R.racers.slice(); R.racers = [him];
          const go = () => { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60); };
          const base = Math.floor(him.s / R.track.len) * R.track.len;
          him.s = base + d.s - 60; him.lat = 0; him.v = RC.v * L.spdMul() * 0.9;
          let maxUp = 0, maxDown = 0, landed = null, after = null;
          for (let f = 0; f < 60 * 6; f++) {
            go();
            maxUp = Math.max(maxUp, S.pitch); maxDown = Math.min(maxDown, S.pitch);
            if (maxUp > 0 && !him.air && landed === null && maxDown < 0) landed = f;
            if (landed !== null && f - landed === 60) { after = +S.pitch.toFixed(2); break; }
          }
          // again, and out of it mid-air
          him.s = base + d.s - 60 + R.track.len; him.lat = 0; him.v = RC.v * L.spdMul() * 0.9;
          let exitAt = null;
          for (let f = 0; f < 60 * 6 && exitAt === null; f++) { go(); if (him.air && Math.abs(S.pitch) > 8) exitAt = +S.pitch.toFixed(1); }
          R.racers = field;
          L.raceExit();
          const back = [+S.pitch.toFixed(2)];
          for (let i = 0; i < 60; i++) { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60); }
          back.push(+(S.pitch - (veh === "monster" ? L.mon.pitch : 0)).toFixed(2));   // (the monster pitches with the world's ground, mon.pitch: what is not that)
          out.cars[veh] = { maxUp: +maxUp.toFixed(1), maxDown: +maxDown.toFixed(1), after, exitAt, back, inRace: L.raceOn() };
          L.raceReset();
        }
        L.noRender = false;
        return out;
      }, [id, hasSc]);
      const cs = Object.values(sp.cars);
      if (!hasSc) check(`race ${id}: off a jump the seat pitches up to ${cs.map(c => c.maxUp).join("/")} and down to ${cs.map(c => c.maxDown).join("/")} degrees, ${cs.map(c => c.after).join("/")} a second after landing; left mid-air at ${cs.map(c => c.exitAt).join("/")} degrees he comes back level (${cs.map(c => c.back.join(">")).join("; ")})`,
        cs.every(c => c.maxUp > 8 && c.maxDown < -8 && c.after !== null && Math.abs(c.after) < 0.5 && c.exitAt !== null && c.back.every(b => b === 0) && !c.inRace), J(sp));
      else check(`race ${id}: a spent steer is nobody's choice -- held full a whole lap after taking the shortcut, he took it ${sp.takes[1]} times on the next pass, meeting its gore ON its edge (lat ${sp.atNose[1]}, the edge from ${sp.edge}); lifted 0.6 s and full again, ${sp.takes[2]} (first pass ${sp.takes[0]}). Off a dune the seat pitches up to ${cs.map(c => c.maxUp).join("/")} and down to ${cs.map(c => c.maxDown).join("/")} degrees, ${cs.map(c => c.after).join("/")} a second after landing; left mid-air at ${cs.map(c => c.exitAt).join("/")} degrees he comes back level (${cs.map(c => c.back.join(">")).join("; ")})`,
        sp.takes[0] === 1 && sp.takes[1] === 0 && sp.atNose[1] !== null && Math.sign(sp.edge) * sp.atNose[1] >= Math.abs(sp.edge) && sp.takes[2] === 1 && cs.every(c => c.maxUp > 8 && c.maxDown < -8 && c.after !== null && Math.abs(c.after) < 0.5 && c.exitAt !== null && c.back.every(b => b === 0) && !c.inRace), J(sp));
    }

    // ---- n. (v174) SNOW AND ICE ARE A BIT SLIPPERY, AND LANE-KEEP HOLDS: hands-off from the middle
    // a whole lap alone, in every car, at his step: on a slippery bend he swings wide (more than a
    // metre on its iciest), never more than the surface's slideMax, never into a bank (no thump,
    // no glide), and is back on his line (within 0.3 m) 150 m past every bend; the same swing in
    // every car. On a track with nothing slippery he never swings at all.
    {
      const n = await page.evaluate((id) => {
        const L = window.__lp, S = L.state, RC = L.RC, out = {};
        L.noRender = true; L.api.skipScreens();
        const T = L.race.venues[id].track, slip = T.S.some(q => (RC.surfaces[q.sf] || {}).slide);
        const lastBend = []; let lb = -1e9;
        for (const q of T.S) { if (Math.abs(q.kh) > 1e-4) lb = q.s; lastBend.push(lb); }
        for (const veh of ["car", "cybertruck", "corvette", "monster"]) {
          L.api.setVehicle(veh); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
          L.spdReset(); L.rcStartRace(id, 35);
          const R = L.race, him = R.him, field = R.racers.slice(); R.racers = [him];
          for (let i = 0; i < 60 * 5; i++) { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60); }
          const base = Math.floor(him.s / T.len) * T.len + T.len;
          him.s = base - 20; him.lat = 0; him.latV = 0; him.slip = 0;
          const w0 = R.wallShoves, g0 = R.glideT || 0;
          let maxSwing = 0, notBack = 0, worstBack = 0, maxSlip = 0;
          while (him.s < base + T.len) {
            S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60);
            const u = him.s - base; if (u < 0) continue;
            maxSwing = Math.max(maxSwing, Math.abs(him.lat)); maxSlip = Math.max(maxSlip, Math.abs(him.slip || 0));
            const i = Math.min(T.n - 1, Math.round(u / T.len * (T.n - 1)));
            if (u - lastBend[i] > 150 && Math.abs(him.lat) > 0.3) { notBack++; worstBack = Math.max(worstBack, Math.abs(him.lat)); }
          }
          out[veh] = { swing: +maxSwing.toFixed(2), slip: +maxSlip.toFixed(2), notBack, worstBack: +worstBack.toFixed(2), thumps: R.wallShoves - w0, glide: +((R.glideT || 0) - g0).toFixed(2) };
          R.racers = field; L.raceReset();
        }
        out.slippery = slip;
        out.slideMax = Math.max(0, ...Object.values(RC.surfaces).map(f => f.slideMax || 0));
        L.noRender = false;
        return out;
      }, id);
      const cars = ["car", "cybertruck", "corvette", "monster"], sw = cars.map(c => n[c].swing);
      check(`race ${id}: ${n.slippery ? "snow and ice are a bit slippery" : "nothing here is slippery"} -- hands-off from the middle a whole lap he swings out at most ${sw.join("/")} m (slip ${cars.map(c => n[c].slip).join("/")}), the same in every car; never into a bank (${cars.map(c => n[c].thumps + "/" + n[c].glide).join(", ")} thumps/s gliding); back on his line 150 m past every bend (${cars.map(c => n[c].notBack).join("/")} frames off it, worst ${cars.map(c => n[c].worstBack).join("/")} m)`,
        cars.every(c => n[c].thumps === 0 && n[c].glide === 0 && n[c].notBack === 0) && Math.max(...sw) - Math.min(...sw) < 0.05 &&
        (n.slippery ? Math.max(...sw) > 1 && Math.max(...sw) <= n.slideMax + 0.2 : Math.max(...sw) === 0), J(n));
    }

    // ---- o. (v174) THE TUNNEL: under a roof all through it (solid over the deck, open over the
    // road in front of each portal), the mountain solid beside it; and driving through it in every
    // car the chase camera stays INSIDE the lining (under the roof, between the walls) with his car
    // in sight -- never up in the rock, never on the other side of a wall
    const hasTunnel = await page.evaluate((id) => !!(window.__lp.race.venues[id].track.tunnels || []).length, id);
    if (hasTunnel) {
      const o = await page.evaluate((id) => {
        const L = window.__lp, S = L.state, RC = L.RC, out = { cars: {} };
        L.noRender = true; L.api.skipScreens();
        const T = L.race.venues[id].track, tn = T.tunnels[0], C = RC.tunnel;
        const solidAt = (x, y, z) => { let hit = null; L.forEachSolid(b => { if (!hit && L.solidTest(b, x, y, z, 0)) hit = L.solidKind(b); }); return hit; };
        // (this venue's own samples: out of a race rcPoint answers for the world's track, the oval)
        const at = (s, lat, up) => { const q = T.S[Math.round(s / T.len * (T.n - 1))]; return [q.x + q.lx * lat, q.gy + q.ly * lat + up, q.z + q.lz * lat]; };
        let roofed = 0, roofN = 0, frontOpen = 0, side = 0;
        for (let s = tn.sA + 5; s < tn.sB - 5; s += 10) { roofN++; if (solidAt(...at(s, 0, C.h + 3))) roofed++; if (solidAt(...at(s, C.half + 12, 3))) side++; }
        for (const s of [tn.sA - 15, tn.sB + 15]) for (const up of [3, C.h + 3, C.h + 15]) if (!solidAt(...at(s, 0, up))) frontOpen++;
        out.roof = roofed + "/" + roofN; out.side = side + "/" + roofN; out.frontOpen = frontOpen + "/6";
        // no pad is aimed at while the camera is down under its roof (the monster's camera sits 19 m up so
        // that its own cab never hides a pad ahead -- v172; here it cannot)
        const capA = tn.sA - C.camFrom, capB = tn.sB + RC.cam.monster.back + 10 + 80;
        out.padsUnder = (T.def.pads || []).filter(p => p.m > capA && p.m < capB).map(p => p.m);
        // the mountain as drawn against its solid, from above: where it is solid, the solid's top is never
        // above what is drawn (no invisible wall) and never far under it (nothing seen that a plane passes through)
        const T3 = window.THREE, rc = new T3.Raycaster(), V = L.race.venues[id].venue, mid = T.S[Math.round((tn.sA + tn.sB) / 2 / T.len * (T.n - 1))];
        let over = 0, under = 0, n = 0, worst = 0, worstAt = null; const bad = [];
        for (let u = -(tn.sB - tn.sA) / 2 - C.apron; u <= (tn.sB - tn.sA) / 2 + C.apron; u += 7) for (let v = -(C.half + C.foot); v <= C.half + C.foot; v += 7) {
          if (Math.abs(v) < C.half + 4) continue;                                  // (beside the lining: the roof is checked above)
          const x = mid.x + mid.tx * u + mid.lx * v, z = mid.z + mid.tz * u + mid.lz * v;
          rc.set(new T3.Vector3(x, 400, z), new T3.Vector3(0, -1, 0));
          const hit = rc.intersectObject(V, true)[0]; if (!hit) continue;
          const drawn = hit.point.y;
          let top = null; for (let y = drawn + 3; y > L.terrainEff(x, z); y -= 0.25) if (solidAt(x, y, z)) { top = y; break; }
          if (top === null) continue;
          n++; if (top > drawn + 0.3) { over++; bad.push(["inv", u, v, +(top - drawn).toFixed(1)]); } const g = drawn - top; if (g > worst) { worst = g; worstAt = [u, v]; } if (g > C.solidGap) { under++; bad.push([u, v, +g.toFixed(1)]); }
        }
        out.surface = { n, invisible: over, farUnder: under, worstGap: +worst.toFixed(1), worstAt, bad: bad.slice(0, 40) };
        // (portrait, the chase view in every car and his seat in two: the views he is really in)
        for (const [veh, chase] of [["car", true], ["cybertruck", true], ["corvette", true], ["monster", true], ["car", false], ["monster", false]]) {
          L.api.setVehicle(veh); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
          L.spdReset(); L.api.setView(chase); L.rcStartRace(id, 36);
          const R = L.race, him = R.him, field = R.racers.slice(); R.racers = [him];
          for (let i = 0; i < 60 * 5; i++) { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60); }
          const base = Math.floor(him.s / T.len) * T.len + T.len;
          L.noRender = false;                   // (the game's own camera, frame by frame)
          him.s = base + tn.sA - 120; him.lat = 0; him.v = RC.v * L.spdMul() * 0.9;
          let frames = 0, out1 = 0, hidden = 0, worst = null;
          while (him.s < base + tn.sB + 10) {
            S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60);
            const c = L.camera.position, u = him.s - base;
            if (u < tn.sA + 30 || u > tn.sB) continue;
            frames++;
            // the camera in the track's frame at its own place along
            const d = L.rcPoint(u, 0, {}), rel = [c.x - d.x, c.z - d.z], lat = rel[0] * d.lx + rel[1] * d.lz;
            const deck = L.rcPoint(u + rel[0] * d.tx + rel[1] * d.tz, 0, {}).y;
            const bad = c.y > deck + C.h - 0.3 || Math.abs(lat) > C.half - 0.3 || solidAt(c.x, c.y, c.z);
            if (bad) { out1++; if (!worst) worst = { u: Math.round(u), up: +(c.y - deck).toFixed(1), lat: +lat.toFixed(1), in: solidAt(c.x, c.y, c.z) }; }
            if (chase && window.solidSight(c.x, c.y, c.z, S.x, S.y + 1.5, S.z, 0.3, ["wall", "building", "rock"]) < 0.98) hidden++;
          }
          L.noRender = true;
          out.cars[veh + (chase ? "" : "@seat")] = { frames, outside: out1, hidden, worst };
          R.racers = field; L.raceReset();
        }
        L.api.setView(true);
        L.noRender = false;
        return out;
      }, id);
      const cs = Object.entries(o.cars);
      check(`race ${id}: the tunnel is a tunnel -- roofed ${o.roof} along it, the mountain solid beside it ${o.side}, the road in front of each portal open (${o.frontOpen}); the mountain's solid under what is drawn at ${o.surface.n} points (${o.surface.invisible} invisible, ${o.surface.farUnder} more than the allowed gap under it, worst ${o.surface.worstGap} m); no pad aimed at under its lowered camera (${o.padsUnder.join(",") || "none"}); through it the chase camera stays inside the lining with his car in sight (${cs.map(([k, v]) => `${k}: ${v.outside} of ${v.frames} frames outside, ${v.hidden} hidden`).join("; ")})`,
        o.roof.split("/")[0] === o.roof.split("/")[1] && o.side.split("/")[0] === o.side.split("/")[1] && o.frontOpen === "6/6" && o.padsUnder.length === 0 &&
        o.surface.n > 50 && o.surface.invisible === 0 && o.surface.farUnder === 0 && cs.every(([k, v]) => v.frames > 100 && v.outside === 0 && v.hidden === 0), J(o));
    }

    // ---- p. (v174) THE FROZEN LAKE: the crossing's middle is the bed's (to a metre), the deck over
    // it dead level at the bed's height plus the deck's lift, the bed level and dry under the whole
    // ice, and the ice is the crossing's surface
    const lake = await page.evaluate((id) => {
      const L = window.__lp, RC = L.RC, T = L.race.venues[id].track, B = T.def.lakeBed;
      if (!T.lakes || !T.lakes.length) return null;
      const lk = T.lakes[0], mid = T.S.reduce((m, q) => Math.abs(q.s - (lk.a + lk.b) / 2) < Math.abs(m.s - (lk.a + lk.b) / 2) ? q : m, T.S[0]);
      const on = T.S.filter(q => q.sec === lk.sec), ys = on.map(q => q.gy);
      let bedLo = Infinity, bedHi = -Infinity, wet = 0;
      const hd = B.heading * Math.PI / 180, fx = -Math.sin(hd), fz = -Math.cos(hd);
      for (let u = -B.a; u <= B.a; u += 10) for (let v = -B.b; v <= B.b; v += 10) {
        if ((u / B.a) ** 2 + (v / B.b) ** 2 > 1) continue;
        const x = B.x + fx * u - fz * v, z = B.z + fz * u + fx * v, g = L.terrainEff(x, z);
        bedLo = Math.min(bedLo, g); bedHi = Math.max(bedHi, g); if (g < L.seaLevelAt(x, z)) wet++;
      }
      return { off: +Math.hypot(mid.x - B.x, mid.z - B.z).toFixed(2), deck: [+Math.min(...ys).toFixed(3), +Math.max(...ys).toFixed(3)], want: B.y + RC.lift, bed: [+bedLo.toFixed(3), +bedHi.toFixed(3)], wet, sf: [...new Set(on.map(q => q.sf))] };
    }, id);
    if (lake) check(`race ${id}: the frozen lake -- its crossing's middle ${lake.off} m from the bed's, the deck over it level at ${lake.deck.join("-")} m (the bed's ${lake.want - 0.25} + its lift), the bed level at ${lake.bed.join("-")} m and dry (${lake.wet} wet points) under all of the ice, the crossing ${lake.sf.join("/")}`,
      lake.off < 1 && lake.deck[1] - lake.deck[0] < 0.02 && Math.abs(lake.deck[0] - lake.want) < 0.02 && lake.bed[1] - lake.bed[0] < 0.01 && lake.wet === 0 && lake.sf.join() === "ice", J(lake));

    // ---- s. (v180) SNOW READS AS SNOW, drawn as he sees it in normal play:
    //   the ground off the track, round the venue, is white with grey mottle -- never green blotches
    //   (the terrain alone drawn, looking down at it from 30 m, at points round the lap where it is all snow);
    //   the mountain over the tunnel from the side turned FROM the sun is snow in the shade, not a grey
    //   dome (its pixels -- what changes when it is hidden -- at least `light` of the snow's own brightness
    //   at the median, from a far and a near camera);
    //   and the snowbanks are closed: no hole through one where it changes shape (in from a kerb), which
    //   showed the undersides lit by the ground's green fill, and no step in one (down to the lake's low bank)
    const snowLook = await page.evaluate((id) => {
      const L = window.__lp, T3 = THREE, V = L.race.venues[id], T = V.track, S = L.state;
      if (!T.def.banks) return null;
      const out = {}, gl = L.renderer.getContext(), lumOf = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const was = { x: S.x, y: S.y, z: S.z, noRender: L.noRender };   // (put back below: one page, state carries)
      L.raceReset && L.raceReset(); L.api.setVehicle("car"); L.api.spawnAt(0, 0); L.api.skipScreens(); L.api.setView(true);
      const grab = (cam) => { L.noRender = false; L.renderer.render(L.scene, cam); const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, a = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a); L.noRender = true; return { a, w, h }; };
      const cam = new T3.PerspectiveCamera(50, 820 / 1180, 0.5, 4000);
      const isTer = o => o.isMesh && o.geometry && o.geometry.attributes.artLayerA;
      // -- the ground: terrain alone, looking down
      const B = L.RC.banks, Wd = L.RC.width / 2 + L.RC.kerbW, off = Wd + B.w + B.skirt + 25, snowAt = L.TUNE.snowFull || 66;   // (66: the snow line before v180 named it)
      const pts = [];
      for (let k = 0; k < 24 && pts.length < 8; k++) {
        const q = T.S[Math.floor(T.n * k / 24)];
        for (const sd of [-1, 1]) { const x = q.x + q.lx * sd * off, z = q.z + q.lz * sd * off; if (L.terrainEff(x, z) > snowAt + 2) pts.push([x, z]); }
      }
      const shown = new Map(); L.scene.children.forEach(o => shown.set(o, o.visible));
      let green = 0, px = 0; const gl0 = [];
      for (const [x, z] of pts) {
        S.x = x; S.z = z; S.y = L.terrainEff(x, z) + 2; L.updateScenery(x, z, true);
        L.scene.children.forEach(o => { o.visible = isTer(o) || o.isLight; });
        const gy = L.terrainEff(x, z); cam.position.set(x - 8, gy + 30, z - 8); cam.lookAt(x, gy, z); cam.updateMatrixWorld();
        const g = grab(cam);
        L.scene.children.forEach(o => { o.visible = shown.has(o) ? shown.get(o) : o.visible; });
        for (let i = 0; i < g.a.length; i += 16) { const r = g.a[i], gg = g.a[i + 1], b = g.a[i + 2]; px++; if (gg - Math.max(r, b) > 6) green++; gl0.push(lumOf(r, gg, b)); }
      }
      gl0.sort((a, b) => a - b);
      out.ground = { pts: pts.length, greenPct: +(100 * green / Math.max(1, px)).toFixed(2), lum: Math.round(gl0[Math.floor(gl0.length / 2)] || 0) };
      // -- (v183) and the LOW ground round it, under the snow line, where the mountains' snow lay over the
      // grass only part-way: tan and olive by the banks and behind the podium. Any pixel warmer than the
      // snow's own grey-blue (red or green over blue by more than `warm`) is a patch; and the motorway,
      // whose bore lids are coloured before the venue's grid exists, never under any of it
      const lowPts = [];
      for (let k = 0; k < 48 && lowPts.length < 8; k++) {
        const q = T.S[Math.floor(T.n * k / 48)];
        for (const sd of [-1, 1]) for (const ex of [0, 60]) { const x = q.x + q.lx * sd * (off + ex), z = q.z + q.lz * sd * (off + ex); if (lowPts.length < 8 && L.terrainEff(x, z) < snowAt - 4) lowPts.push([x, z]); }
      }
      const warmOf = g => { let w = 0, n = 0; for (let i = 0; i < g.a.length; i += 16) { n++; if (Math.max(g.a[i], g.a[i + 1]) - g.a[i + 2] > 14) w++; } return { w, n }; };
      let warm = 0, wn = 0, warmHi = 0, wnHi = 0;
      for (const [set, hi] of [[lowPts, false], [pts, true]]) for (const [x, z] of set) {
        S.x = x; S.z = z; S.y = L.terrainEff(x, z) + 2; L.updateScenery(x, z, true);
        L.scene.children.forEach(o => { o.visible = isTer(o) || o.isLight; });
        const gy = L.terrainEff(x, z); cam.position.set(x - 8, gy + 30, z - 8); cam.lookAt(x, gy, z); cam.updateMatrixWorld();
        const r = warmOf(grab(cam));
        L.scene.children.forEach(o => { o.visible = shown.has(o) ? shown.get(o) : o.visible; });
        if (hi) { warmHi += r.w; wnHi += r.n; } else { warm += r.w; wn += r.n; }
      }
      let hwyUnder = 0, hwyNear = 0;
      if (typeof highway !== "undefined" && typeof terSnowAt === "function") {
        const xs = T.S.map(q => q.x), zs = T.S.map(q => q.z), x0 = Math.min(...xs) - 800, x1 = Math.max(...xs) + 800, z0 = Math.min(...zs) - 800, z1 = Math.max(...zs) + 800;
        for (let s = 0; s < highway.length; s += 20) { const h = hwySampleAt(s); if (h.x < x0 || h.x > x1 || h.z < z0 || h.z > z1) continue; hwyNear++;
          for (const lat of [-45, 0, 45]) if (terSnowAt(h.x - h.fz * lat, h.z + h.fx * lat) > 0) { hwyUnder++; break; } }
      }
      // (and nothing else under the venue's snow: no other venue's line, no water -- where the foam line would
      // have been -- and every node of it that is snow takes the snow's tile, not only its colour)
      let otherUnder = 0, wetUnder = 0, tileOff = 0, tileN = 0, box = null;
      if (typeof terSnowGrids !== "undefined") {
        for (const k in L.race.venues) if (k !== id) for (const q of L.race.venues[k].track.S) if (terSnowAt(q.x, q.z) > 0) otherUnder++;
        for (const g of terSnowGrids) { if (g.id !== id) continue; box = [Math.round(g.x0), Math.round(g.x0 + g.cell * (g.nx - 1)), Math.round(g.z0), Math.round(g.z0 + g.cell * (g.nz - 1))];
          for (let iz = 0; iz < g.nz; iz++) for (let ix = 0; ix < g.nx; ix++) { const m = g.v[iz * g.nx + ix]; if (m <= 0) continue;
            const x = g.x0 + ix * g.cell, z = g.z0 + iz * g.cell, h = L.terrainEff(x, z);
            if (h < L.seaLevelAt(x, z) + 1.4) wetUnder++;
            if (m > 0.5) { tileN++; if (artTerrainLayer(h, x, z) !== ART_LAYER.asphalt) tileOff++; } } }
      }
      out.low = { pts: lowPts.length, warmPct: +(100 * warm / Math.max(1, wn)).toFixed(2), snowWarmPct: +(100 * warmHi / Math.max(1, wnHi)).toFixed(2), hwyNear, hwyUnder, otherUnder, wetUnder, tileOff, tileN, box };
      // -- the mountain, from the side turned from the sun
      let mtn = []; V.venue.traverse(o => { if (o.isMesh && o.material.vertexColors && o.material.type === "MeshPhongMaterial") mtn.push(o); });
      out.mountain = null;
      if (mtn.length) {
        const box = new T3.Box3(); mtn.forEach(m => box.expandByObject(m)); const c = box.getCenter(new T3.Vector3());
        const sd = L.sunDir.clone(); sd.y = 0; sd.normalize();
        out.mountain = [];
        for (const [dist, up] of [[260, 90], [150, 35]]) {
          const x = c.x - sd.x * dist, z = c.z - sd.z * dist;
          S.x = x; S.z = z; S.y = L.terrainEff(x, z) + 2; L.updateScenery(x, z, true); L.update(1 / 60);
          cam.position.set(x, Math.max(L.terrainEff(x, z), c.y - 20) + up, z); cam.lookAt(c.x, c.y, c.z); cam.updateMatrixWorld();
          const a = grab(cam); mtn.forEach(m => m.visible = false); const b = grab(cam); mtn.forEach(m => m.visible = true);
          const lum = [];
          for (let i = 0; i < a.a.length; i += 4) if (Math.abs(a.a[i] - b.a[i]) + Math.abs(a.a[i + 1] - b.a[i + 1]) + Math.abs(a.a[i + 2] - b.a[i + 2]) > 30) lum.push(lumOf(a.a[i], a.a[i + 1], a.a[i + 2]));
          lum.sort((p, q) => p - q);
          out.mountain.push({ dist, n: lum.length, med: Math.round(lum[Math.floor(lum.length / 2)] || 0), p25: Math.round(lum[Math.floor(lum.length / 4)] || 0) });
        }
      }
      // -- the banks closed: every edge across the track (one end's profile to the other's) in two faces
      const banks = []; let mat = null, most = 0; const per = new Map();
      V.venue.traverse(o => { if (o.isMesh && o.name === "rcBanks") banks.push(o); });
      if (!banks.length) {          // (before v180 the bank had no name: the snow-coloured lambert with the most triangles)
        V.venue.traverse(o => { if (o.isMesh && o.material.type === "MeshLambertMaterial" && o.material.color.getHex() === L.RC.surfaces.snow.col) per.set(o.material, (per.get(o.material) || 0) + o.geometry.attributes.position.count); });
        for (const [m, c] of per) if (c > most) { most = c; mat = m; }
        V.venue.traverse(o => { if (o.isMesh && o.material === mat) banks.push(o); });
      }
      const key = (x, y, z) => Math.round(x * 50) + "," + Math.round(y * 50) + "," + Math.round(z * 50), edges = new Map(), P = [];
      for (const m of banks) { const pa = m.geometry.attributes.position; m.updateMatrixWorld(true); const v = new T3.Vector3();
        for (let t = 0; t < pa.count; t += 3) { const ks = [], ps = []; for (let j = 0; j < 3; j++) { v.fromBufferAttribute(pa, t + j).applyMatrix4(m.matrixWorld); ks.push(key(v.x, v.y, v.z)); ps.push(v.clone()); }
          for (let j = 0; j < 3; j++) { const k0 = ks[j], k1 = ks[(j + 1) % 3]; if (k0 === k1) continue; const e = k0 < k1 ? k0 + "|" + k1 : k1 + "|" + k0; const r = edges.get(e); if (r) r.n++; else edges.set(e, { n: 1, a: ps[j], b: ps[(j + 1) % 3] }); } } }
      const near = (x, z) => { let best = null, bd = Infinity; for (const q of T.S) { const d = (q.x - x) ** 2 + (q.z - z) ** 2; if (d < bd) { bd = d; best = q; } } return best; };
      let across = 0; const where = [];
      for (const e of edges.values()) { if (e.n !== 1) continue;
        const dx = e.b.x - e.a.x, dz = e.b.z - e.a.z, l = Math.hypot(dx, dz); if (l < 0.05) continue;
        const q = near((e.a.x + e.b.x) / 2, (e.a.z + e.b.z) / 2);
        // (an edge lying ON the deck -- where a kerb's edge and the deck's own meet -- is the bank's foot, not a hole)
        const onDeck = p => { const lat = (p.x - q.x) * q.lx + (p.z - q.z) * q.lz; return Math.abs(p.y - (q.gy + q.ly * lat)) < 0.12; };
        if (onDeck(e.a) && onDeck(e.b)) continue;
        if (Math.abs((dx * q.tx + dz * q.tz) / l) < 0.3) { across++; if (where.length < 6) where.push(Math.round(q.s)); } }
      // (and its crest never steps: a step's face is turned from the sun somewhere -- the dark wedge at the lake)
      const bankH = window.rcBankH ? (q => window.rcBankH(T, q)) : (q => T.def.sections[q.sec].lake ? L.RC.banks.lakeH : L.RC.banks.h);
      let step = 0; for (let i = 0; i < T.n; i++) step = Math.max(step, Math.abs(bankH(T.S[(i + 1) % T.n]) - bankH(T.S[i])));
      out.banks = { meshes: banks.length, edges: edges.size, open: across, at: [...new Set(where)], step: +step.toFixed(2) };
      out.tunnel = T.def.sections.some(sc => sc.tunnel);
      // -- (v185) the snow's edge eases into the grass: in the fade (terSnowAt between none and all)
      // a corner shared by several faces has ONE colour (the jitter each face multiplies by taken out),
      // so the white steps down across no face edge -- one colour a face cut a sawtooth of triangles;
      // and no face there more than a third snow wears the grass's tile (its green on white)
      out.edge = null;
      if (typeof terSnowAt === "function" && T.def.snowGround) {
        const G = T.def.snowGround, mid = G.near + G.fade / 2, at = new Map(); let faces = 0, greenOn = 0, worstSg = 0;
        for (let k = 0; k < 12; k++) {
          const q = T.S[Math.floor(T.n * k / 12)];
          for (const sd of [-1, 1]) { const x = q.x + q.lx * sd * mid, z = q.z + q.lz * sd * mid; S.x = x; S.z = z; S.y = L.terrainEff(x, z) + 2; L.updateScenery(x, z, true);
            L.scene.traverse(o => { if (!isTer(o) || o.userData.__v185) return; o.userData.__v185 = true;
              const pa = o.geometry.attributes.position, ca = o.geometry.attributes.color, la = o.geometry.attributes.artLayerA; if (!ca || !la) return;
              const ox = o.position.x, oz = o.position.z;
              for (let f = 0; f < pa.count; f += 3) {
                let lo = 1, hi = 0, sum = 0; const m3 = [];
                for (let v = 0; v < 3; v++) { const m = terSnowAt(ox + pa.getX(f + v), oz + pa.getZ(f + v)); m3.push(m); sum += m; lo = Math.min(lo, m); hi = Math.max(hi, m); }
                if (!(hi > 0 && lo < 1)) continue;
                faces++;
                if (la.getX(f) !== ART_LAYER.asphalt && sum / 3 > 1 / 3) greenOn++;
                if (la.getX(f) !== ART_LAYER.asphalt) worstSg = Math.max(worstSg, sum / 3);
                const j = 1 + (hash2(Math.round(pa.getX(f)), Math.round(pa.getZ(f))) - 0.5) * 2 * L.TUNE.colorJitter;
                for (let v = 0; v < 3; v++) { if (!(m3[v] > 0 && m3[v] < 1)) continue;
                  const k = Math.round((ox + pa.getX(f + v)) * 10) + "," + Math.round((oz + pa.getZ(f + v)) * 10);
                  const lum = lumOf(ca.getX(f + v), ca.getY(f + v), ca.getZ(f + v)) / j;
                  const r = at.get(k); if (r) { r.lo = Math.min(r.lo, lum); r.hi = Math.max(r.hi, lum); r.n++; } else at.set(k, { lo: lum, hi: lum, n: 1 }); } } }); }
        }
        L.scene.traverse(o => { if (o.userData) delete o.userData.__v185; });
        const steps = []; for (const r of at.values()) if (r.n > 1) steps.push((r.hi - r.lo) / Math.max(1e-6, r.hi));
        steps.sort((a, b) => a - b);
        out.edge = { faces, corners: steps.length, stepMax: +(steps[steps.length - 1] || 0).toFixed(4), stepP95: +(steps[Math.floor(steps.length * 0.95)] || 0).toFixed(4), greenOn, worstSg: +worstSg.toFixed(2) };
      }
      S.x = was.x; S.y = was.y; S.z = was.z; L.updateScenery(S.x, S.z, true); L.update(1 / 60);
      L.noRender = was.noRender;
      return out;
    }, id);
    if (snowLook) check(`race ${id}: snow reads as snow -- the ground round it ${snowLook.ground.greenPct}% green pixels at ${snowLook.ground.pts} points (none, it was blotches of grass); the LOW ground round it, under the snow line, ${snowLook.low.warmPct}% tan or olive pixels at ${snowLook.low.pts} points (the snow's own ${snowLook.low.snowWarmPct}%; it was the grass under part-laid snow, v183), the motorway under none of it (${snowLook.low.hwyUnder} of ${snowLook.low.hwyNear} samples near it), nor another venue (${snowLook.low.otherUnder}) nor water (${snowLook.low.wetUnder}), and all ${snowLook.low.tileN} of its snow nodes on the snow's tile (${snowLook.low.tileOff} not); the mountain from the side turned from the sun ${snowLook.mountain ? snowLook.mountain.map(m => `median ${m.med}, a quarter under ${m.p25} at ${m.dist} m`).join("; ") : "none"} against the snow's ${snowLook.ground.lum}; the snowbanks closed (${snowLook.banks.open} open edges across the track${snowLook.banks.at.length ? " at " + snowLook.banks.at.join(", ") + " m" : ""}) and their crest never stepping (largest ${snowLook.banks.step} m from one sample to the next)${snowLook.edge ? `; and its edge eases into the grass -- over ${snowLook.edge.faces} faces of the fade, a corner's colour differs from one face to the next by at most ${(100 * snowLook.edge.stepMax).toFixed(2)}% (one colour a face: a sawtooth of triangles, v183), and ${snowLook.edge.greenOn} faces more than a third snow wear the grass's tile (the most snow under it ${snowLook.edge.worstSg})` : ""}`,
      snowLook.ground.pts >= 4 && snowLook.ground.greenPct < 0.2 && snowLook.low.pts >= 4 && snowLook.low.warmPct < 0.5 && snowLook.low.hwyUnder === 0 && snowLook.low.otherUnder === 0 && snowLook.low.wetUnder === 0 && snowLook.low.tileN > 0 && snowLook.low.tileOff === 0 && snowLook.banks.meshes > 0 && snowLook.banks.open === 0 && snowLook.banks.step < 0.25 &&
      (!snowLook.edge || snowLook.edge.faces > 200 && snowLook.edge.corners > 200 && snowLook.edge.stepMax < 0.01 && snowLook.edge.greenOn === 0) &&
      (!snowLook.tunnel || snowLook.mountain && snowLook.mountain.every(m => m.n > 2000 && m.med >= 0.75 * snowLook.ground.lum && m.p25 >= 0.62 * snowLook.ground.lum)), J(snowLook));

    // ---- q. (v175) THE SPLASH: each splash section's deck is down at the water -- over real
    // water (terrainEff under seaLevelAt, the one definition) for most of it, at the sea plus
    // `over` wherever the ground under it is lower, never under the ground (its own highest
    // under it, plus the lift) across the splash and its easing, and the deck never under the
    // water anywhere on the lap. Driving it, his own spray rises off it and never stands
    // between the chase camera and his car (CLAUDE.md: wake stays out of the shot, by SIZE).
    const sp = await page.evaluate((id) => {
      const L = window.__lp, RC = L.RC, T = L.race.venues[id].track;
      if (!T.splashes || !T.splashes.length) return null;
      const out = { secs: [], underGround: 0, underWater: 0, worstWater: Infinity };
      for (const q of T.S) {
        const sea = L.seaLevelAt(q.x, q.z);
        if (q.gy - sea < out.worstWater) out.worstWater = +(q.gy - sea).toFixed(3);
        if (q.gy < sea + 0.1) out.underWater++;
        if (T.splashes.some(w => q.s > w.a - RC.splash.along && q.s < w.b + RC.splash.along) && q.gy < q.g - 0.01) out.underGround++;
      }
      for (const w of T.splashes) {
        const on = T.S.filter(q => q.sec === w.sec);
        let wet = 0, atWater = 0, low = 0;
        for (const q of on) {
          if (L.terrainEff(q.x, q.z) < L.seaLevelAt(q.x, q.z)) wet++;
          if (q.g < w.y) { low++; if (Math.abs(q.gy - w.y) < 0.01) atWater++; }
        }
        out.secs.push({ sec: w.sec, len: Math.round(w.b - w.a), wet: +(wet / on.length).toFixed(2), low, atWater, sf: [...new Set(on.map(q => q.sf))].join("/") });
      }
      return out;
    }, id);
    if (sp) {
      const spray = await page.evaluate((id) => {
        const L = window.__lp, S = L.state, T3 = window.THREE, out = {};
        L.api.skipScreens();
        // (chase and seat, both -- from the seat, what he aims at; the field on the track, two of them just ahead of him on the
        // water and one just behind, throwing their own)
        for (const [veh, chase] of [["car", true], ["cybertruck", true], ["corvette", true], ["monster", true], ["car", false], ["monster", false]]) {
          L.api.setVehicle(veh); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
          L.spdReset(); L.rcStartRace(id, 36);
          const R = L.race, him = R.him, Tk = R.track;
          for (let i = 0; i < 60 * 5; i++) { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60); }
          const w = Tk.splashes[0];
          him.s = Math.floor(him.s / Tk.len) * Tk.len + w.a - 60; him.lat = 0; him.v = 30;
          const them = R.racers.filter(r => !r.isHim);
          [[18, 5], [30, -5], [-16, 6]].forEach(([ds, lat], k) => { const o = them[k]; o.s = him.s + ds; o.lat = lat; o.v = 30; });
          L.api.setView(chase); L.noRender = false;
          let frames = 0, hidden = 0, born = 0, onSplash = 0;
          const seg = new T3.Line3(), cp = new T3.Vector3(), tgt = new T3.Vector3();
          for (let i = 0; i < 60 * 6; i++) {
            const P = L.rcPuffs, life0 = P ? Array.from(P.life) : [];   // (v181: the race's own puffs)
            S.touching = true; S.ctrlBank = 0; L.update(1 / 60);
            if (L.rcAt(him.s).sf !== "splash") continue;
            onSplash++; if (P) for (let k = 0; k < P.n; k++) if (P.life[k] > life0[k] + 1e-6) born++;   // (a puff born this frame: its life put back up)
            // (chase: his car; from his seat, where he looks -- the road 30 m ahead on his line)
            if (chase) { const m = him.mesh || L.vehicleModel; m.updateMatrixWorld(true); tgt.setFromMatrixPosition(m.matrixWorld); tgt.y += 0.8; }
            else { const q = {}; L.rcPoint(him.s + 30, him.lat, q); tgt.set(q.x, q.y + 0.5, q.z); }
            seg.set(L.camera.position.clone(), tgt.clone());
            frames++;
            // (a puff counts where it is drawn: its half-width, at the strength the camera fade leaves it -- under
            // a tenth it is not there to see; RC.spray.fadeNear is what makes one beside the lens nothing)
            const F = L.RC.spray.fadeNear, pp = new T3.Vector3(), ss = x => Math.min(1, Math.max(0, (x - F[0]) / (F[1] - F[0])));
            let hit = false;
            if (P) for (let k = 0; k < P.n && !hit; k++) {
              if (P.life[k] <= 0) continue;
              pp.set(P.pos[k * 3], P.pos[k * 3 + 1], P.pos[k * 3 + 2]);
              const f = ss(pp.distanceTo(L.camera.position)), a = P.alpha[k] * f * f * (3 - 2 * f);
              if (a > 0.1 && seg.closestPointToPoint(pp, true, cp).distanceTo(pp) < P.size[k] / 2) hit = true;
            }
            if (hit) hidden++;
          }
          out[veh + (chase ? "" : ":seat")] = { frames, hidden, born, onSplash };
          L.raceReset();
        }
        L.api.setView(true);
        return out;
      }, id);
      check(`race ${id}: the splash -- ${sp.secs.map(w => `${w.len} m over water ${Math.round(w.wet * 100)}%, its deck at the water on ${w.atWater} of the ${w.low} samples where the ground is under it`).join("; ")}; never under the ground (${sp.underGround}) or the water (${sp.underWater}, lowest ${sp.worstWater} m over the sea); the spray rises off it (${Object.values(spray).map(v => v.born).join("/")} puffs, his and theirs) and never stands between the chase camera and his car, or his seat and the road 30 m ahead (${Object.entries(spray).map(([k, v]) => `${k} ${v.hidden} of ${v.frames} frames`).join(", ")})`,
        sp.secs.every(w => w.wet >= 0.5 && w.low > 0 && w.atWater === w.low && w.sf === "splash") && sp.underGround === 0 && sp.underWater === 0 &&
        Object.values(spray).every(v => v.frames > 100 && v.hidden === 0 && v.born > 20), J({ sp, spray }));
    }

    // ---- r. (v176) THE SKY ROAD: up in the air -- its highest over the line's deck what its
    // numbers say, never under the ground anywhere; where it is up, a pylon from the ground to the
    // girder at least every pylonStep (+ a sample), the girder solid across the deck and the
    // barriers solid beside it, so a plane and a helicopter flown at it crash (free) at three
    // places; its glow along the barriers' tops, never over the deck he aims at; and a lap
    // hands-off with the field, every car on the deck all the way (never under it, never off it)
    const sky = await page.evaluate((id) => {
      const L = window.__lp, RC = L.RC, T = L.race.venues[id].track;
      if (!T.sky) return null;
      const K = RC.sky, S = T.S, W = RC.width / 2 + RC.kerbW + 0.4, out = {};
      // (every kind standing at a point: on a slope the girder's piece and the pylon under it overlap)
      const kindsAt = (x, y, z) => { const h = []; L.forEachSolid(b => { if (L.solidTest(b, x, y, z, 0)) h.push(L.solidKind(b)); }); return h; };
      const at = (q, lat, up) => [q.x + q.lx * lat, q.gy + q.ly * lat + up, q.z + q.lz * lat];
      const want = Math.max(...T.def.sections.map(sc => sc.sky || 0));
      out.want = want; out.high = +(Math.max(...S.map(q => q.gy)) - S[0].gy).toFixed(1);
      out.under = S.filter(q => q.gy < q.g - 0.01).length;
      out.upN = S.filter(q => q.up).length;
      // the pylons: every one where it should stand is solid from the ground up to the girder
      let gapMax = 0, last = null, pyl = 0, pylBad = [];
      const ps = Math.max(1, Math.round(K.pylonStep / (S[1].s - S[0].s)));
      for (let i = 0; i < S.length; i++) {
        const q = S[i];
        if (!q.up) { last = null; continue; }
        if (i % ps === 0) {
          pyl++;
          const g = L.terrainEff(q.x, q.z), top = q.gy - K.girder - 0.3;
          if (![g + 0.5, (g + top) / 2, top].every(y => kindsAt(q.x, y, q.z).includes("pillar"))) pylBad.push(Math.round(q.s));
          if (last !== null) gapMax = Math.max(gapMax, q.s - last);
          last = q.s;
        }
      }
      out.step = K.pylonStep; out.pylons = pyl; out.pylBad = pylBad.slice(0, 10); out.pylGap = Math.round(gapMax);
      // the girder across the deck, the barriers beside it
      let girN = 0, girBad = [], wallBad = [];
      for (let i = 0; i < S.length; i += 40) {
        const q = S[i]; if (!q.up) continue;
        girN++;
        for (const lat of [-RC.width / 2 + 1, 0, RC.width / 2 - 1]) if (!kindsAt(...at(q, lat, -K.girder / 2)).includes("bridge")) girBad.push(Math.round(q.s));
        for (const sd of [-1, 1]) if (!kindsAt(...at(q, sd * W, 0.5)).includes("wall")) wallBad.push(Math.round(q.s));
      }
      out.girder = girN; out.girBad = girBad.slice(0, 10); out.wallBad = wallBad.slice(0, 10);
      // the glow: on the barriers' tops, nothing over the deck
      const pos = T.glow ? T.glow.geometry.attributes.position.array : [];
      let glowIn = 0;
      for (let k = 0; k < pos.length; k += 3) {
        let best = Infinity, bq = null;
        for (let i = 0; i < S.length; i += 4) { const d = Math.hypot(S[i].x - pos[k], S[i].z - pos[k + 2]); if (d < best) { best = d; bq = S[i]; } }
        if (Math.abs((pos[k] - bq.x) * bq.lx + (pos[k + 2] - bq.z) * bq.lz) < RC.width / 2) glowIn++;
      }
      out.glow = pos.length / 3; out.glowIn = glowIn;
      // no flag on a pole from the ground stands under the ribbon (they are for bends on the ground)
      const flags = L.race.venues[id].flags || [];
      out.flags = flags.length;
      out.flagsUnder = flags.filter(f => { let best = Infinity, bq = null; for (let i = 0; i < S.length; i += 4) { const d = Math.hypot(S[i].x - f.m.position.x, S[i].z - f.m.position.z); if (d < best) { best = d; bq = S[i]; } } return bq.up; }).length;
      // three places up in the air: the climb, the north straight, the run down
      const ups = S.filter(q => q.up && q.gy - L.terrainEff(q.x, q.z) > 20);
      out.places = [ups[Math.floor(ups.length * 0.1)], ups[Math.floor(ups.length * 0.5)], ups[Math.floor(ups.length * 0.9)]].map(q => ({ x: q.x, z: q.z, y: q.gy - K.girder / 2, lx: q.lx, lz: q.lz, s: Math.round(q.s) }));
      return out;
    }, id);
    if (sky) {
      // a plane and a helicopter, at cruise, flown across the ribbon from 150 m out at the girder's height
      const fly = await page.evaluate((places) => {
        const L = window.__lp, st = L.state, T = L.TUNE, out = [];
        for (const veh of ["prop", "helicopter"]) for (const p of places) {
          if (L.restoreShattered) L.restoreShattered();
          st.exploding = false; st.explodeTimer = 0;
          L.api.setVehicle(veh); L.api.spawnAt(0, 0);
          for (let i = 0; i < 20; i++) L.update(1 / 60);
          const x0 = p.x + p.lx * 150, z0 = p.z + p.lz * 150, h = Math.atan2(p.lx, p.lz);   // (heading toward the ribbon: forward is (-sin h, -cos h))
          const v = veh === "prop" ? (st.vp && st.vp.cruiseSpeed || 60) : T.heli.cruise * 0.7;
          const boom0 = (L.flags.exploded || 0);
          let minD = Infinity;
          for (let i = 0; i < 60 * 6; i++) {
            st.x = i === 0 ? x0 : st.x; st.z = i === 0 ? z0 : st.z;
            if (i === 0 || !st.exploding) {
              st.heading = h; st.speed = v; st.y = p.y; st.pitch = 0; st.bank = 0;
              if (veh === "prop") { st.phase = "AIRBORNE"; st.engaged = false; st.approachData = null; st.gearDown = false; }
              else { st.phase = "AIRBORNE"; const H = heli; H.altitude = p.y; H.vy = 0; H.target = null; H.vertical = 0; H.vx = -Math.sin(h) * v; H.vz = -Math.cos(h) * v; }
            }
            L.update(1 / 60);
            minD = Math.min(minD, Math.hypot(st.x - p.x, st.z - p.z));
            if ((L.flags.exploded || 0) > boom0) break;
          }
          out.push({ veh, s: p.s, crashed: (L.flags.exploded || 0) > boom0, minD: Math.round(minD) });
          st.exploding = false;
        }
        return out;
      }, sky.places);
      // a lap hands-off with the field: every car on the deck all the way
      const on = await page.evaluate((id) => {
        const L = window.__lp, S = L.state, RC = L.RC, out = {};
        L.noRender = true; L.api.skipScreens();
        for (const veh of ["car", "monster"]) {
          L.api.setVehicle(veh); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
          L.spdReset(); L.rcStartRace(id, 37);
          const R = L.race; let below = 0, worst = 0, off = 0, frames = 0;
          for (let f = 0; f < 60 * 160 && R.phase !== "podium"; f++) {
            S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60);
            if (R.phase !== "race") continue;
            frames++;
            for (const r of R.racers) {
              if (r.path) continue;
              const d = r.y - L.rcPoint(r.s, r.lat, {}).y;
              if (d < -0.05) { below++; worst = Math.min(worst, d); }
              if (Math.abs(r.lat) > RC.width / 2) off++;
            }
            if (R.him.lapsDone >= 1) break;
          }
          out[veh] = { frames, below, worst: +worst.toFixed(2), off };
          L.raceReset();
        }
        L.noRender = false;
        return out;
      }, id);
      check(`race ${id}: the sky road -- up ${sky.high} m over the line (its numbers: ${sky.want}), never under the ground (${sky.under}); ${sky.pylons} pylons, each solid from the ground to the girder (${sky.pylBad.length} not), never more than ${sky.pylGap} m apart; the girder solid across the deck at ${sky.girder} places (${sky.girBad.length} not) and the barriers beside it (${sky.wallBad.length} not); flown at it ${fly.map(f => `${f.veh} at ${f.s} m ${f.crashed ? "crashed" : "PASSED THROUGH (" + f.minD + " m)"}`).join(", ")}; ${sky.glow} glows, ${sky.glowIn} over the deck; ${sky.flags} flags on the ground, ${sky.flagsUnder} under the ribbon; a lap hands-off with the field, ${Object.entries(on).map(([k, v]) => `${k}: ${v.frames} frames, ${v.below} under the deck, ${v.off} off it`).join("; ")}`,
        sky.high >= sky.want - 0.5 && sky.under === 0 && sky.upN > 1000 && sky.pylons > 40 && sky.pylBad.length === 0 && sky.pylGap <= sky.step + 1 &&
        sky.girder > 50 && sky.girBad.length === 0 && sky.wallBad.length === 0 && fly.every(f => f.crashed) && sky.glow > 400 && sky.glowIn === 0 && sky.flags > 0 && sky.flagsUnder === 0 &&
        Object.values(on).every(v => v.frames > 60 * 90 && v.below === 0 && v.off === 0), J({ sky, fly, on }));
    }

    // ---- f. the noisy hand, a race in every car
    const f = [];
    for (const veh of carsFor(id, 1)) { const r = await oneRace(page, veh, 7100 + ALL.indexOf(veh), { track: id }); f.push(r); }
    check(`race ${id}: a race with the noisy hand in every car -- places ${f.map(r => r.veh + " " + r.place).join(", ")}; ${f.reduce((a, r) => a + r.bangs, 0)} bangs, ${f.reduce((a, r) => a + r.stuck, 0)} stuck, every one to the podium${tag(id, 1)}`,
      f.every(r => r.bangs === 0 && r.stuck === 0 && r.nan === 0 && r.podium), J(f));

    // ---- g. he lost: the shot fits his car and the steps, on this track's podium
    const g = await page.evaluate((id) => {
      const L = window.__lp, S = L.state, out = {};
      L.noRender = false; L.api.skipScreens();
      for (const veh of ["car", "monster"]) {
        L.api.setVehicle(veh); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
        L.spdReset(); L.rcStartRace(id, 35);
        const R = L.race;
        for (let i = 0; i < 60 * 12; i++) { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60); }
        R.racers.forEach((r, k) => { if (!r.isHim) r.s = R.him.s + 40 + k * 5; });
        window.rcToPodium();
        for (let i = 0; i < 60 * 12; i++) { S.touching = false; L.update(1 / 60); }
        const LS = R.loseShot;
        out[veh] = { onStep: R.podium.onStep, place: R.him.place, stopped: R.him.v < 0.5, fit: LS && { ok: LS.ok, up: LS.up, slide: LS.slide } };
        window.raceAgain();                                              // (again: this track, not the first)
        out[veh].again = R.track.def.id; out[veh].againPhase = R.phase;
        L.raceReset();
        out[veh].after = R.track.def.id;                                 // (and out of it, the world asks about the first)
      }
      return out;
    }, id);
    check(`race ${id}: when he loses there, the podium shot fits his car and the steps (${Object.entries(g).map(([k, v]) => `${k}: ${v.fit ? `up ${v.fit.up} m, slid ${v.fit.slide} m` : "no fit"}`).join("; ")}); the flag races him there again; out of a race the world's track is the first again`,
      Object.values(g).every(v => !v.onStep && v.place > 3 && v.stopped && v.fit && v.fit.ok && v.again === id && v.againPhase === "grid" && v.after === "oval"), J(g));

    // ---- h. nothing made in play, nothing drawn from the random stream, BY THE RACE: its
    // update and its camera, counted (a three.js object draws four for its id, so a new
    // one shows up too) -- the world around it keeps its own draws -- and the oval beside
    const h = await page.evaluate((id) => {
      const L = window.__lp, S = L.state, out = {};
      L.noRender = true; L.api.skipScreens();
      for (const tr of [L.RC.tracks[0].id, id]) {
        let draws = 0;
        const wrap = name => { const f = window[name]; window[name] = function () { const R0 = Math.random; Math.random = function () { draws++; return R0.apply(this, arguments); }; try { return f.apply(this, arguments); } finally { Math.random = R0; } }; return f; };
        L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
        L.spdReset(); L.rcStartRace(tr, 36);
        const u0 = wrap("rcUpdate"), c0 = wrap("raceCamera"), R = L.race;
        try {
          for (let f = 0; f < 60 * 600 && R.phase !== "done" && R.phase !== "podium"; f++) { S.touching = true; S.ctrlBank = Math.sin(f / 40) * 0.4; S.ctrlPitch = f % 600 < 200 ? 0.8 : 0; L.update(1 / 60); }
        } finally { window.rcUpdate = u0; window.raceCamera = c0; }
        out[tr] = { draws, laps: R.him.lapsDone };
        L.raceReset();
      }
      L.noRender = false;
      return out;
    }, id);
    check(`race ${id}: nothing new in play -- three laps on it, the race's own update and camera make no three.js object and draw ${h[id].draws} times from Math.random (the oval's: ${h.oval.draws})`, h[id].laps >= 3 && h[id].draws === 0 && h.oval.draws === 0, J(h));
  }

  // ---- k. (v171) THE BARRIER, ON EVERY TRACK (the oval too): one whole lap alone, in every car,
  // with the finger held full into the left barrier, then the right -- one thump, on the first
  // touch, and then a quiet glide; never a bang, never stuck. Held into the barrier is never
  // quicker than the racing line (the inside of every bend coming up, the middle on a
  // straight): the inside is shorter, and riding it is no free win. Let go of it for a second
  // and back into it, and that is a fresh hit: one more thump.
  for (const id of ["oval"].concat(ids)) {
    // (the barrier is no way to a pad: no car riding either barrier has its middle in any pad's catch)
    const pg = await page.evaluate((id) => {
      const L = window.__lp, RC = L.RC, V = L.race.venues[id], catchW = RC.padW / 2 + RC.footW * 0.3, out = [];
      // (every body on a grid: his two, and the opponents' own widths off their meshes)
      L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
      L.rcStartRace(id, 34); const wids = Array.from(new Set(L.race.racers.map(r => r.wid).concat([3.4, 5.8]))); L.raceReset();
      for (const wid of wids) for (const side of [-1, 1]) for (const pd of V.pads) out.push(+(Math.abs(side * (RC.width / 2 - wid / 2 - 0.2) - pd.lat) - catchW).toFixed(2));
      return { clear: Math.min(...out), pads: V.pads.map(p => p.lat), wids };
    }, id);
    check(`race ${id}: no pad lies under the line along either barrier, in any car on the grid (widths ${pg.wids.map(w => +w.toFixed(1)).join(", ")} m) -- the nearest catch is ${pg.clear} m off it (pads at ${pg.pads.join(", ")} m)`, pg.clear >= 0.5, J(pg));
    const k = await page.evaluate(([id, cars]) => {
      const L = window.__lp, S = L.state, RC = L.RC, out = {};
      L.noRender = true; L.api.skipScreens();
      const range = (L.TUNE.dragRangeX * Math.min(innerWidth, innerHeight)) / (L.CAR.dragRangeX * innerWidth);
      for (const veh of cars) {
        out[veh] = {};
        for (const mode of ["line", "heldL", "heldR", "again"]) {
          L.api.setVehicle(veh); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
          L.spdReset(); L.rcStartRace(id, 34);
          const R = L.race, him = R.him;
          for (let i = 0; i < 60 * 5; i++) { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60); }
          const field = R.racers.slice(); R.racers = [him];
          const ev = L.rce.cur; L.rce.cur = null;   // (v189: alone, and no track event in the way either -- race_event_checks has those)
          const Ln = R.track.len, s0 = Math.ceil(him.s / Ln) * Ln + 20;
          him.s = s0 - 200; him.lat = 0; him.v = RC.v * L.spdMul();
          const w0 = R.wallShoves, g0 = R.glideT, b0 = L.flags.carCrashes || 0, p0 = R.padHits, sc0 = L.flags.raceShortcuts || 0;
          out.wids = Array.from(new Set((out.wids || []).concat(field.map(r => r.wid))));
          let t0 = null, t = null, minV = 1e9, tAgain = null, w1 = null, pT0 = null, padsOnWall = 0;
          for (let f = 0; f < 60 * 300; f++) {
            let bank;
            if (mode === "line") {
              const q = L.rcAt(him.s + 40), side = Math.abs(q.kh) > 0.002 ? Math.sign(q.kh) : 0, err = side * RC.width * 0.3 - (him.path ? 99 : him.lat);
              bank = Math.abs(err) < 0.3 ? 0 : Math.max(-1, Math.min(1, -err * 0.4));
            } else bank = mode === "heldR" ? 1 : -1;
            // (again: on the left barrier half a lap, then a second of full right, then full left again)
            if (mode === "again" && t0 !== null) { const el = R.t - t0; if (el > 15 && el < 16) bank = 1; if (el >= 16 && w1 === null) w1 = R.wallShoves; }
            const ph0 = R.padHits;
            S.touching = true; S.ctrlBank = bank / range; S.ctrlPitch = 0; L.update(1 / 60);
            // (a pad crossed while he rides the barrier: the wall is no way to a pad. Off it -- the
            // held lap that took the shortcut is hands-off once the steer is spent -- is his line)
            if (t0 !== null && R.padHits > ph0 && him.glideHold > 0) padsOnWall++;
            if (t0 === null && him.s >= s0) { t0 = R.t; pT0 = R.padHits; }   // (pads from the timed lap: the run-up crosses the track to the barrier)
            if (t0 !== null) minV = Math.min(minV, him.v);
            if (t0 !== null && him.s >= s0 + Ln) { t = R.t - t0; break; }
          }
          out[veh][mode] = { t: t && +t.toFixed(2), thumps: R.wallShoves - w0, glide: +(R.glideT - g0).toFixed(1), minV: +minV.toFixed(1), bangs: (L.flags.carCrashes || 0) - b0, sc: (L.flags.raceShortcuts || 0) - sc0, pads: padsOnWall, padsAll: R.padHits - (pT0 === null ? p0 : pT0), stuck: R.stuck, after: w1 === null ? null : R.wallShoves - w1 };
          R.racers = field; L.rce.cur = ev; L.raceReset();
        }
      }
      L.noRender = false;
      return out;
    }, [id, carsFor(id, 2)]);
    const wids = k.wids; delete k.wids;
    const cars = Object.keys(k), held = m => cars.map(c => `${k[c][m].t} s/${k[c][m].thumps}`).join(", ");
    check(`race ${id}: held into the barrier a whole lap he glides along it -- one thump on the first touch, then quiet (left: ${held("heldL")}; right: ${held("heldR")}, lap s/thumps per car), no pad on the way (${cars.map(c => k[c].heldL.pads + k[c].heldR.pads).join("/")}), never a bang, never stuck; never quicker than the racing line (${cars.map(c => k[c].line.t).join("/")} s); off it a second and back, a fresh hit (${cars.map(c => k[c].again.after).join("/")} more)${tag(id, 2)}`,
      cars.every(c => { const K = k[c]; return ["heldL", "heldR"].every(m => K[m].t !== null && K[m].thumps === 1 && (K[m].sc > 0 ? K[m].glide > 10 : K[m].glide > K[m].t * 0.4)   /* (a held lap that took the shortcut: its steer is spent there, hands-off after -- the turn rule) */ && K[m].bangs === 0 && K[m].pads === 0 && (K[m].sc > 0 || K[m].padsAll === 0) && K[m].stuck === 0 && K[m].minV > 15 && K[m].t >= K.line.t) && K.line.t !== null && K.again.after === 1 && K.again.bangs === 0; }), J(k));
  }

  // ---- m. (v172) HIS OWN CAR NEVER HIDES WHAT HE AIMS AT: from the chase camera (the game's
  // own place for it, rcChaseCam), on each track's longest straight, the road 60 and 80 m ahead
  // -- the middle and both pad lanes -- is not behind his own body, in every car. (The monster
  // truck's cab hid every pad within 100 m.)
  for (const id of ["oval"].concat(ids)) {
    const m = await page.evaluate((id) => {
      const L = window.__lp, S = L.state, T3 = window.THREE, RC = L.RC, out = {};
      L.noRender = true; L.api.skipScreens();
      for (const veh of ["car", "cybertruck", "corvette", "monster"]) {
        L.api.setVehicle(veh); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
        L.spdReset(); L.rcStartRace(id, 34);
        const R = L.race, him = R.him, Tk = R.track;
        for (let i = 0; i < 60 * 5; i++) { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60); }
        const field = R.racers.slice(); R.racers = [him];
        let best = null, run = null;
        for (const q of Tk.S) { if (Math.abs(q.kh) < 0.0005 && !q.dune) { if (!run) run = { a: q.s }; run.b = q.s; if (!best || run.b - run.a > best.b - best.a) best = run; } else run = null; }
        him.s = Math.floor(him.s / Tk.len) * Tk.len + best.a + 5; him.lat = 0; him.v = 30;
        // (the game's own camera, settled: two seconds down the straight in the chase view)
        S.viewChase = true; L.noRender = false;
        for (let i = 0; i < 120; i++) { S.touching = true; S.ctrlBank = 0; L.update(1 / 60); }
        L.noRender = true;
        const body = him.mesh || L.vehicleModel; body.updateMatrixWorld(true);   // (his body is the vehicle model)
        const C = window.rcChaseCam(!!S.vp.monster), cam = L.camera.position.clone(), q = {}, hid = [], up = +(cam.y - S.y).toFixed(1), back = +Math.hypot(cam.x - S.x, cam.z - S.z).toFixed(1), v = +him.v.toFixed(1);
        const eye = new T3.PerspectiveCamera(); eye.position.copy(cam); eye.updateMatrixWorld(true);
        for (const ahead of [60, 80]) for (const lat of [0, 5, -5]) {
          L.rcPoint(him.s + ahead, lat, q);
          const p = new T3.Vector3(q.x, q.y + 0.1, q.z), d = p.distanceTo(cam);
          const rc = new T3.Raycaster(cam, p.clone().sub(cam).normalize(), 0, d);
          rc.camera = eye;                       // (a sprite on him -- the Corvette's flames -- is tested against a camera)
          if (rc.intersectObject(body, true).some(h => !h.object.isSprite)) hid.push(ahead + "@" + lat);
        }
        out[veh] = { hid, straight: Math.round(best.b - best.a), camUp: up, camBack: back, v, tune: [C.back, C.up] };
        R.racers = field; L.raceReset();
      }
      L.noRender = false;
      return out;
    }, id);
    check(`race ${id}: his own car never hides the road he aims at -- from the chase camera on the longest straight, 60 and 80 m ahead in the middle and both pad lanes, hidden: ${Object.entries(m).map(([k, v]) => k + " " + (v.hid.join(",") || "none")).join("; ")}`,
      Object.values(m).every(v => v.hid.length === 0 && v.straight >= 90 && Math.abs(v.camUp - v.tune[1]) < 1.5), J(m));
  }

  // ---- t. (v181) THE SPRAY READS AS SPRAY, on every track with a surface that throws it: him down
  // the middle of each such section at racing speed, the chase camera and his seat, each settled, the frame drawn with the
  // race's spray and without it. What changes is the spray: it must be there (it showed nothing on sand
  // once the puffs went unlit in the sand's own colour), small (all of it under 3% of the screen and under a
  // fifth of his car's box; the shader draws no puff taller than maxPx of the screen, reported, not judged), soft (from the
  // race's own pool of points -- the world's pool is lit, faceted spheres, which read as boulders
  // rolling after him: none of those born in a race), and over the splash white: its body (the quarter of
  // its pixels it changes most) bright and colourless.
  for (const id of ["oval"].concat(ids)) {
    const t = await page.evaluate((id) => {
      const L = window.__lp, S = L.state, T3 = window.THREE, RC = L.RC, out = { surf: {} };
      // (each surface that throws spray, at its longest section on this track, if that is 60 m or more)
      const T0 = L.race.venues[id].track, per = {}, kinds = [];
      for (const q of T0.S) { const sf = q.sf; if (!RC.surfaces[sf] || !RC.surfaces[sf].spray) continue; const c = per[q.sec] || (per[q.sec] = { sf, k: q.sec, n: 0 }); c.n++; }
      for (const c of Object.values(per)) { const L0 = c.n * L.TK.ds, o = kinds.find(x => x.sf === c.sf); if (L0 < 60) continue; if (!o) kinds.push({ ...c, len: L0 }); else if (L0 > o.len) Object.assign(o, c, { len: L0 }); }
      if (!kinds.length) return null;
      const gl = L.renderer.getContext(), lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const grab = () => { L.renderer.render(L.scene, L.camera); const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, a = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a); return { a, w, h }; };
      const world0 = L.wakePuffList.map(p => p.life);
      let worldBorn = 0; const worldAt = [];
      for (const { sf, k } of kinds) for (const chase of [true, false]) {
        L.raceReset(); L.api.setVehicle("car"); L.api.spawnAt(0, 0); L.api.skipScreens();
        for (let i = 0; i < 10; i++) L.update(1 / 60);
        L.spdReset(); L.rcStartRace(id, 36);
        const R = L.race, him = R.him, Tk = R.track;
        for (let i = 0; i < 60 * 5; i++) { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60); }
        const on = Tk.S.filter(q => q.sec === k), a0 = on[0].s;
        him.s = Math.floor(him.s / Tk.len) * Tk.len + a0 + 5; him.lat = 0; him.v = 30;
        R.racers.filter(r => !r.isHim).forEach((o, j) => { o.s = him.s + 25 + 12 * j; o.lat = j % 2 ? 4 : -4; o.v = 30; });
        L.api.setView(chase); L.noRender = false;
        for (let i = 0; i < 90; i++) {
          const l0 = L.wakePuffList.map(p => p.life);
          S.touching = true; S.ctrlBank = 0; L.update(1 / 60);
          // (one of the world's puffs born at a racer -- within 30 m of one -- is the race's; the world's own
          // events keep their own clocks and throw theirs far off: the harbour's, 4.7 km from the dunes)
          L.wakePuffList.forEach((p, j) => { if (p.life > l0[j] + 1e-6 && R.racers.some(r => Math.hypot(r.mesh.position.x - p.mesh.position.x, r.mesh.position.z - p.mesh.position.z) < 30)) { worldBorn++; if (worldAt.length < 6) worldAt.push([Math.round(p.mesh.position.x), Math.round(p.mesh.position.y), Math.round(p.mesh.position.z)]); } });
        }
        const here = L.rcAt(him.s).sf;
        // (the spray: the race's own pool if there is one, else the world's -- so the check reads on v180 too)
        const P = L.rcPuffs, sprayObjs = P ? [P.pts] : L.wakePuffList.map(p => p.mesh);
        const was = sprayObjs.map(o => o.visible);
        const on1 = grab(); sprayObjs.forEach(o => { o.visible = false; }); const off1 = grab(); sprayObjs.forEach((o, j) => { o.visible = was[j]; });
        // his car's box on the screen
        const body = him.mesh || L.vehicleModel; body.updateMatrixWorld(true);
        const bb = new T3.Box3().setFromObject(body), cs = [];
        for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) cs.push(new T3.Vector3(x, y, z).project(L.camera));
        const W = on1.w, H = on1.h, bx0 = Math.max(0, Math.floor((Math.min(...cs.map(c => c.x)) + 1) / 2 * W)), bx1 = Math.min(W - 1, Math.ceil((Math.max(...cs.map(c => c.x)) + 1) / 2 * W));
        const by0 = Math.max(0, Math.floor((Math.min(...cs.map(c => c.y)) + 1) / 2 * H)), by1 = Math.min(H - 1, Math.ceil((Math.max(...cs.map(c => c.y)) + 1) / 2 * H));
        let changed = 0, inCar = 0, carPx = 0; const PX = [];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4, d = Math.abs(on1.a[i] - off1.a[i]) + Math.abs(on1.a[i + 1] - off1.a[i + 1]) + Math.abs(on1.a[i + 2] - off1.a[i + 2]);
          const box = x >= bx0 && x <= bx1 && y >= by0 && y <= by1;
          if (box) carPx++;
          if (d < 24) continue;
          changed++; if (box) inCar++;
          const r = on1.a[i], g = on1.a[i + 1], b = on1.a[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
          PX.push([d, lum(r, g, b), mx ? (mx - mn) / mx : 0]);
        }
        // (its colour is the spray's BODY: the quarter of its pixels it changes most -- its fading edges are mostly the ground under them)
        PX.sort((a, b) => b[0] - a[0]); const core = PX.slice(0, Math.max(1, Math.ceil(PX.length / 4)));
        const L0 = core.map(p => p[1]).sort((a, b) => a - b), SAT = core.map(p => p[2]).sort((a, b) => a - b);
        // the tallest puff as drawn: its size over its depth, under the shader's clamp -- reported, not judged (the
        // clamp makes it maxPx by construction); what the check holds is what the pixels say, above
        let tallest = 0;
        if (P) { const v = new T3.Vector3(), U = P.mat.uniforms;
          for (let j = 0; j < P.n; j++) if (P.life[j] > 0 && P.size[j] > 0) { v.set(P.pos[j * 3], P.pos[j * 3 + 1], P.pos[j * 3 + 2]).applyMatrix4(L.camera.matrixWorldInverse); const d = Math.max(0.5, -v.z); if (-v.z > 0) tallest = Math.max(tallest, Math.min(U.uMax.value, P.size[j] * U.uScale.value / d) / H); } }
        else for (const p of L.wakePuffList) if (p.life > 0) { const v = p.mesh.position.clone().applyMatrix4(L.camera.matrixWorldInverse); if (-v.z > 0.5) tallest = Math.max(tallest, 2 * p.mesh.scale.x * (H / (2 * Math.tan(L.camera.fov * Math.PI / 360))) / -v.z / H); }
        out.surf[sf + (chase ? "" : ":seat")] = { sf, chase, here, pool: !!P, changedPct: +(100 * changed / (W * H)).toFixed(2), carPct: +(100 * inCar / Math.max(1, carPx)).toFixed(1),
          tallest: +tallest.toFixed(3), lum: Math.round(L0[Math.floor(L0.length / 2)] || 0), sat: +(SAT[Math.floor(SAT.length / 2)] || 0).toFixed(2) };
        L.raceReset();
        // (and out of the race, nothing of its spray is left: none alive, none drawn)
        if (P) out.leftAfter = (out.leftAfter || 0) + (P.pts.visible ? 1 : 0) + Array.from(P.life).filter(x => x > 0).length;
      }
      L.noRender = false; L.api.setView(true);
      out.worldBorn = worldBorn; out.worldAt = worldAt; out.maxPx = RC.spray.maxPx;
      return out;
    }, id);
    if (!t) continue;
    // (on the surface it says, both views: the chase view's spray shows and stays small; the seat's -- his own
    // behind him, the cars' ahead -- stays small, and none of it on his car; the splash's body white in the chase view)
    const ok = t.worldBorn === 0 && !t.leftAfter && Object.values(t.surf).every(v => v.pool && v.here === v.sf && v.changedPct <= 3 && v.carPct <= 20 && (!v.chase || v.changedPct >= 0.05)) &&
      (!t.surf.splash || (t.surf.splash.lum >= 200 && t.surf.splash.sat <= 0.2));
    check(`race ${id}: the spray reads as spray -- soft puffs from the race's own pool (${t.worldBorn} of the world's lit spheres born at a racer, ${t.leftAfter || 0} left after it); ${Object.entries(t.surf).map(([k, v]) => `${k}${v.here === v.sf ? "" : " (ON " + v.here + ")"}: ${v.changedPct}% of the screen, ${v.carPct}% of his car, the tallest puff drawn ${Math.round(v.tallest * 100)}% of the screen high` + (k === "splash" ? `, brightness ${v.lum} and colour ${v.sat} (white)` : "")).join("; ")}`, ok, J(t));
  }
  // ---- u. (v184) THE PODIUM'S FIREWORKS READ AS FIREWORKS: he wins (put a few metres short of the line on his
  // last lap, the field far behind), and for nine seconds of the podium every quarter second the frame is drawn
  // with them and without: what changes is the fireworks. They must come from the race's own pool (the world's
  // arrival show is lit, faceted spheres -- none of those born within 400 m of the podium), their body (the
  // quarter of their pixels they change most) bright and coloured, and not one of their pixels on a button,
  // the HUD drawn over the game (the race's, the route strip), the trophy or his car (the race-again buttons come up three seconds in: the later frames see them). Portrait (this
  // page) and landscape (a page of its own), two tracks each, and from his seat once; racing again or EXIT leaves none.
  const fwJudge = (tag, u) => {
    const ok = u.won && u.bursts >= 9 && u.worldBorn === 0 && u.ownPool && u.frames >= 8 && u.lum >= 200 && u.sat >= 0.45 &&
      u.onBtn === 0 && u.onHud === 0 && u.onTrophy === 0 && u.onCar === 0 && u.leftAfter === 0 && u.leftAgain === 0;
    check(`race ${tag}: the podium's fireworks read as fireworks -- ${u.bursts} bursts (${u.held || 0} held, no clear sky for them) from the race's own soft points (${u.worldBorn} of the world's lit, faceted spheres born over the podium); their body bright (${u.lum}) and coloured (${u.sat}) over ${u.frames} frames; ${u.onBtn} of their pixels on a button, ${u.onHud} on the HUD, ${u.onTrophy} on the trophy, ${u.onCar} on his car; ${u.leftAgain} left racing again, ${u.leftAfter} after EXIT`, ok, J(u));
  };
  for (const id of ["oval", ids[ids.length - 1]]) fwJudge(`${id} 820x1180`, await page.evaluate(rtcFireworksU, [id, true]));
  {
    const L2 = await newPage(1180, 820);
    try {
      await L2.page.waitForFunction(() => window.__lp && window.__lp.race && window.__lp.race.built, null, { timeout: 120000 });
      // (and the oval from his seat: the podium's shot is the podium's whichever view he had)
      for (const [id, chase] of [["oval", true], [ids[0], true], ["oval", false]]) fwJudge(`${id} 1180x820${chase ? "" : " (seat)"}`, await L2.page.evaluate(rtcFireworksU, [id, chase]));
    } finally { await L2.ctx.close(); }
  }
  // ---- v. (v186) THE BANG IS WHEN THE SKY OPENS -- ONE NUMBER: each burst's whistle goes up, and `pop` s later its
  // sparks open (race.js) and its bang sounds (audio.js fireworkSound). Two numbers once, agreeing by luck: retune one
  // and he hears the bang before or after the sky lights. He wins, and every burst's bang (the sound as scheduled) is
  // measured against its opening (the frame the sparks are born), at TUNE's pop and at a retuned one: they agree to a frame.
  {
    const v = await page.evaluate(rtcFireworksPopV, ["oval"]);
    const ok = v.runs.length === 2 && v.runs.every(r => r.won && r.pairs >= 4 && r.worst <= 1 / 60 + 1e-6) && v.restored;
    check(`race oval: a firework's bang is when its sky opens -- ${v.runs.map(r => `pop ${r.pop} s: ${r.pairs} bursts, the bang ${r.sound} s after the whistle, the sparks ${r.sky} s, worst gap ${r.worst.toFixed(3)} s`).join("; ")}`, ok, J(v));
  }
};

// (u) run in the page: he wins on that track, and the podium's fireworks are measured
// eslint-disable-next-line no-unused-vars
function rtcFireworksU([id, chase]) {
  const L = window.__lp, S = L.state, T3 = window.THREE, out = { id };
  const gl = L.renderer.getContext(), lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const grab = () => { L.renderer.render(L.scene, L.camera); const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, a = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a); return { a, w, h }; };
  L.raceReset(); L.api.setVehicle("car"); L.api.spawnAt(0, 0); L.api.skipScreens();
  for (let i = 0; i < 10; i++) L.update(1 / 60);
  L.spdReset(); L.rcStartRace(id, 36);
  const R = L.race, him = R.him, len = R.track.len;
  L.noRender = true;
  for (let i = 0; i < 60 * 8 && R.phase !== "race"; i++) { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60); }
  // him a few metres short of the line on his last lap, the field a long way behind: he wins
  him.s = 3 * len - 4; him.lapsDone = 2;
  R.racers.filter(r => !r.isHim).forEach((o, j) => { o.s = 3 * len - 300 - 20 * j; o.lapsDone = 2; });
  for (let i = 0; i < 60 * 20 && R.phase !== "podium"; i++) { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60); }
  out.won = R.phase === "podium" && !!R.podium && R.podium.won;
  if (!out.won) { L.noRender = false; return out; }
  L.api.setView(chase); L.noRender = false;
  const C = R.podiumC, world0 = () => L.wakePuffList.map(p => p.life);
  let held0 = L.flags.raceFireworksHeld || 0, worldBorn = 0, bursts0 = L.flags.raceFireworks || 0, fw0 = L.flags.fireworks || 0, ownPool = false, frames = 0;
  let onBtn = 0, onHud = 0, onTrophy = 0, onCar = 0; const PX = [];
  const cssToBuf = () => { const c = L.renderer.domElement; return gl.drawingBufferWidth / c.clientWidth; };
  const boxOnScreen = (obj, W, H) => {
    if (!obj || !obj.visible) return null;
    obj.updateMatrixWorld(true);
    const bb = new T3.Box3().setFromObject(obj); if (bb.isEmpty()) return null;
    const cs = []; for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) cs.push(new T3.Vector3(x, y, z).project(L.camera));
    return { x0: Math.floor((Math.min(...cs.map(c => c.x)) + 1) / 2 * W), x1: Math.ceil((Math.max(...cs.map(c => c.x)) + 1) / 2 * W),
             y0: Math.floor((Math.min(...cs.map(c => c.y)) + 1) / 2 * H), y1: Math.ceil((Math.max(...cs.map(c => c.y)) + 1) / 2 * H) };
  };
  for (let f = 1; f <= 60 * 9; f++) {
    const l0 = world0();
    L.update(1 / 60);
    L.wakePuffList.forEach((p, j) => { if (p.life > l0[j] + 1e-6 && Math.hypot(p.mesh.position.x - C.x, p.mesh.position.z - C.z) < 400) worldBorn++; });
    if (f % 15) continue;
    // the fireworks: the race's own pool if there is one, else the world's puffs (so it reads on v183 too)
    const P = L.rcSparks, objs = P ? [P.pts] : L.wakePuffList.map(p => p.mesh);
    if (P) ownPool = true;
    const was = objs.map(o => o.visible);
    const on1 = grab(); objs.forEach(o => { o.visible = false; }); const off1 = grab(); objs.forEach((o, j) => { o.visible = was[j]; });
    const W = on1.w, H = on1.h, k = cssToBuf();
    const toBuf = r => ({ x0: r.left * k, x1: r.right * k, y0: H - r.bottom * k, y1: H - r.top * k });
    const btns = (window.btnControlRects ? window.btnControlRects() : []).map(toBuf);
    // (the HUD drawn over the game: the race's, the route strip, every arrow and numeral -- buttons.js's list)
    const huds = ["progressStrip"].concat(typeof BTN_HUD_OVERLAY !== "undefined" ? BTN_HUD_OVERLAY : []).flatMap(id => window.btnDrawnRects(document.getElementById(id))).map(toBuf);
    const trophy = boxOnScreen(R.trophy, W, H), car = boxOnScreen(L.vehicleModel, W, H);
    const inB = (b, x, y) => b && x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
    let changed = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, d = Math.abs(on1.a[i] - off1.a[i]) + Math.abs(on1.a[i + 1] - off1.a[i + 1]) + Math.abs(on1.a[i + 2] - off1.a[i + 2]);
      if (d < 24) continue;
      changed++;
      if (btns.some(b => inB(b, x, y))) onBtn++;
      if (huds.some(b => inB(b, x, y))) onHud++;
      if (inB(trophy, x, y)) onTrophy++;
      if (inB(car, x, y)) onCar++;
      const r = on1.a[i], g = on1.a[i + 1], b = on1.a[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      PX.push([d, mx, mx ? (mx - mn) / mx : 0]);
    }
    if (changed) frames++;
  }
  // their BODY: the quarter of their pixels they change most (a glow's soft edge is mostly sky)
  PX.sort((a, b) => b[0] - a[0]); const core = PX.slice(0, Math.max(1, Math.ceil(PX.length / 4)));
  const LU = core.map(p => p[1]).sort((a, b) => a - b), SA = core.map(p => p[2]).sort((a, b) => a - b);
  out.bursts = (L.flags.raceFireworks || 0) - bursts0 + ((L.flags.fireworks || 0) - fw0); out.held = (L.flags.raceFireworksHeld || 0) - held0;
  out.worldBorn = worldBorn; out.ownPool = ownPool; out.frames = frames;
  out.lum = Math.round(LU[Math.floor(LU.length / 2)] || 0); out.sat = +(SA[Math.floor(SA.length / 2)] || 0).toFixed(2);
  out.onBtn = onBtn; out.onHud = onHud; out.onTrophy = onTrophy; out.onCar = onCar;
  // racing again straight from the podium leaves none of them behind (rcStartRace); and EXIT, none (raceReset)
  L.raceAgain();
  const PA = L.rcSparks;
  out.leftAgain = (PA ? (PA.pts.visible ? 1 : 0) + Array.from(PA.life).filter(x => x > 0).length : 0) + L.race.fwBursts.length;
  L.raceReset(); L.api.setView(true);
  const P = L.rcSparks;
  out.leftAfter = P ? (P.pts.visible ? 1 : 0) + Array.from(P.life).filter(x => x > 0).length : L.wakePuffList.filter(p => p.life > 0 && Math.hypot(p.mesh.position.x - C.x, p.mesh.position.z - C.z) < 400).length;
  return out;
}

// (v) run in the page: he wins, at a given pop, and each burst's bang (as scheduled) is set against its sparks opening
// eslint-disable-next-line no-unused-vars
function rtcFireworksPopV([id]) {
  const L = window.__lp, S = L.state, F = L.RC.podium.fw, pop0 = F.pop, out = { runs: [] };
  const nb0 = window.noiseBurst, fs0 = window.fireworkSound;
  try {
    for (const pop of [pop0, +(pop0 + 0.45).toFixed(2)]) {
      const r = { pop };
      L.raceReset(); L.api.setVehicle("car"); L.api.spawnAt(0, 0); L.api.skipScreens();
      for (let i = 0; i < 10; i++) L.update(1 / 60);
      L.spdReset(); L.rcStartRace(id, 36);
      const R = L.race, him = R.him, len = R.track.len;
      L.noRender = true;
      for (let i = 0; i < 60 * 8 && R.phase !== "race"; i++) { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60); }
      him.s = 3 * len - 4; him.lapsDone = 2;
      R.racers.filter(o => !o.isHim).forEach((o, j) => { o.s = 3 * len - 300 - 20 * j; o.lapsDone = 2; });
      for (let i = 0; i < 60 * 20 && R.phase !== "podium"; i++) { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60); }
      r.won = R.phase === "podium" && !!R.podium && R.podium.won;
      F.pop = pop;
      // the sound as it is scheduled: each call's whistle time, and the pop's delay after it (the 700 Hz burst)
      let t = 0, cur = null; const whistles = [], opens = [];
      window.fireworkSound = function (when) { cur = { at: t + (when || 0), pop: null }; whistles.push(cur); const res = fs0.apply(this, arguments); cur = null; return res; };
      window.noiseBurst = function (dur, freq, peak, when) { if (cur && freq === 700 && cur.pop === null) cur.pop = (when || 0) - (cur.at - t); return nb0.apply(this, arguments); };
      let n0 = L.flags.raceFireworks || 0;
      for (let f = 0; f < 60 * 9 && r.won; f++) {
        L.update(1 / 60); t += 1 / 60;
        const n = L.flags.raceFireworks || 0;
        for (; n0 < n; n0++) opens.push(t);
      }
      window.fireworkSound = fs0; window.noiseBurst = nb0;
      const k = Math.min(whistles.length, opens.length);
      let worst = 0, sound = 0, sky = 0;
      for (let i = 0; i < k; i++) {
        const w = whistles[i], s = w.pop === null ? Infinity : w.pop, o = opens[i] - w.at;
        worst = Math.max(worst, Math.abs(o - s)); sound = s; sky = o;
      }
      r.pairs = k; r.worst = k ? worst : Infinity; r.sound = +sound.toFixed(3); r.sky = +sky.toFixed(3);
      out.runs.push(r);
    }
  } finally {
    window.fireworkSound = fs0; window.noiseBurst = nb0; F.pop = pop0;
    L.noRender = false; L.raceReset(); L.api.setView(true);
  }
  out.restored = F.pop === pop0 && window.noiseBurst === nb0 && window.fireworkSound === fs0;
  return out;
}
