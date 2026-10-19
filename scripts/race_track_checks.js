"use strict";
// ---------------------------------------------------------------------------
// THE TRACKS AFTER THE FIRST (v170: Desert Dunes). Portrait, iPad. For every track
// in TUNE.race.tracks but the oval (race_checks has that one):
//
//   a. it closes, at the length its numbers say; it stands on dry ground (its
//      barriers and 15 m past them), clear of every road's corridor, both cities
//      and the other venues;
//   b. alone, finger down and straight at his own step, every car laps it in
//      under a minute;
//   c. WHAT IT IS MADE OF: on each surface it has, his speed settles at the
//      track's base speed times his step times that surface's `speed` -- the same
//      for every car, and the same for an opponent running at skill 1;
//   d. A DUNE IS A JUMP, THE SAME FOR EVERY CAR: at his step each car leaves the
//      deck at every dune and flies the same time (to three frames of 60 Hz); it
//      is never under the deck, never off it, and never bangs; at the top step it
//      is a jump, not a flight (under 80 m);
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
//      off it a second and back into it is a fresh hit, one thump more.
//   i. (v170) A SPENT STEER AND A PITCH THAT STAYS IN THE RACE: the full steer that took
//      a shortcut, still held a whole lap, is nobody's choice of it the next time
//      round; lifted (past liftGrace) and put back full, it is his again and takes
//      it. Off a dune the seat and gauge pitch with him (more than 8 degrees) and
//      are level again a second after he lands; and leaving the race in the air,
//      in every car, he comes back to the world level and stays level (the monster
//      truck: with the ground's own pitch, mon.pitch, and nothing of the race's).
// ---------------------------------------------------------------------------
const { oneRace } = require("./race_drive.js");

module.exports = async function raceTrackChecks({ newPage, check }) {
  const J = o => JSON.stringify(o);
  const { page } = await newPage(820, 1180);
  await page.waitForFunction(() => window.__lp && window.__lp.race && window.__lp.race.built, null, { timeout: 120000 });
  const ids = await page.evaluate(() => window.__lp.RC.tracks.slice(1).map(t => t.id));
  check(`race tracks: there is a track after the oval (${ids.join(", ")})`, ids.length >= 1);

  for (const id of ids) {
    // ---- a. closes, dry, clear
    const a = await page.evaluate((id) => {
      const L = window.__lp, RC = L.RC, V = L.race.venues[id], T = V.track, S = T.S, W = RC.width / 2 + RC.kerbW + 0.4;
      let dry = Infinity, corridor = 0, city = 0, other = Infinity;
      // (the road corridor, read without this venue's own claim: a point of it is the venue's
      // when it is within the venue's width of its own track)
      const own = (x, z) => S.some(q => Math.hypot(q.x - x, q.z - z) < 60);
      for (let i = 0; i < S.length; i += 6) {
        const q = S[i];
        for (const k of [-W - 15, -W, W, W + 15]) {
          const x = q.x + q.lx * k, z = q.z + q.lz * k;
          dry = Math.min(dry, L.terrainEff(x, z) - L.seaLevelAt(x, z));
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

    // ---- b. laps under a minute, every car, finger down
    const b = await page.evaluate((id) => {
      const L = window.__lp, S = L.state, out = {};
      L.noRender = true; L.api.skipScreens();
      for (const veh of ["car", "cybertruck", "corvette", "monster"]) {
        L.api.setVehicle(veh); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
        L.spdReset(); L.rcStartRace(id, 31);
        const R = L.race, him = R.him, laps = []; let t0 = null, last = 0;
        const field = R.racers.slice(); R.racers = [him];                 // (alone on the track; the field back before it is put away)
        for (let f = 0; f < 60 * 240 && R.phase !== "done" && R.phase !== "podium"; f++) {
          S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60);
          if (R.phase === "race" && t0 === null) t0 = R.t;
          if (him.lapsDone > last) { laps.push(+(R.t - t0).toFixed(1)); t0 = R.t; last = him.lapsDone; }
        }
        out[veh] = laps;
        R.racers = field; L.raceReset();
      }
      L.noRender = false;
      return out;
    }, id);
    const allLaps = Object.values(b).flat();
    check(`race ${id}: finger down at his own step, every car laps it in under a minute -- ${Object.entries(b).map(([k, v]) => `${k} ${v.join("/")} s`).join(", ")}`,
      Object.values(b).every(v => v.length === 3) && allLaps.every(t => t < 60), J(b));

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
          for (let f = 0; f < 60 * 120 && him.lapsDone < 1; f++) {
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
      check(`race ${id}: every dune is a jump, the same for every car -- at his step each flies ${def[0].flights.map(f => `${f.t} s, ${f.d} m`).join(" and ")} (the four cars ${def.map(r => r.flights.map(f => f.t).join("/")).join("; ")}); never under the deck (${def.reduce((a, r) => a + r.under, 0)} frames) or off it (${def.reduce((a, r) => a + r.outLat, 0)}), no bang; at the top step ${top.flights.map(f => f.d + " m").join(" and ")} (a jump, not a flight); at the lowest it may roll over`,
        same && def.every(r => r.under === 0 && r.outLat === 0 && r.bangs === 0) && top.flights.length === top.dunes && top.flights.every(f => f.d < 80) && top.under === 0 && top.bangs === 0 && d["car@0"].bangs === 0 && d["car@0"].under === 0, J(d));
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
          for (let f = 0; f < 60 * 200 && R.phase !== "done" && R.phase !== "podium"; f++) {
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

    // ---- i. the spent steer, and the pitch stays in the race
    if (hasSc) {
      const sp = await page.evaluate((id) => {
        const L = window.__lp, S = L.state, RC = L.RC, out = {};
        L.noRender = true; L.api.skipScreens();
        const range = (L.TUNE.dragRangeX * Math.min(innerWidth, innerHeight)) / (L.CAR.dragRangeX * innerWidth);
        L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
        L.spdReset(); L.rcStartRace(id, 34);
        const R = L.race, him = R.him, sc = R.track.sc[0], Ln = R.track.len, nose = sc.sa + sc.gore;
        for (let i = 0; i < 60 * 5; i++) { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60); }
        const field = R.racers.slice(); R.racers = [him];
        him.s = sc.sa - 120; him.lat = 0; him.v = RC.v * L.spdMul() * 0.86;
        // pass 1: steered to its edge, then full and NEVER let go -- two passes; pass 3: a 0.6 s lift
        // before its approach, the finger landing full again
        const takes = [0, 0, 0], atNose = [null, null, null]; let wasOn = false, lifted = 0;
        for (let f = 0; f < 60 * 240; f++) {
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
      }, id);
      const cs = Object.values(sp.cars);
      check(`race ${id}: a spent steer is nobody's choice -- held full a whole lap after taking the shortcut, he took it ${sp.takes[1]} times on the next pass, meeting its gore ON its edge (lat ${sp.atNose[1]}, the edge from ${sp.edge}); lifted 0.6 s and full again, ${sp.takes[2]} (first pass ${sp.takes[0]}). Off a dune the seat pitches up to ${cs.map(c => c.maxUp).join("/")} and down to ${cs.map(c => c.maxDown).join("/")} degrees, ${cs.map(c => c.after).join("/")} a second after landing; left mid-air at ${cs.map(c => c.exitAt).join("/")} degrees he comes back level (${cs.map(c => c.back.join(">")).join("; ")})`,
        sp.takes[0] === 1 && sp.takes[1] === 0 && sp.atNose[1] !== null && Math.sign(sp.edge) * sp.atNose[1] >= Math.abs(sp.edge) && sp.takes[2] === 1 && cs.every(c => c.maxUp > 8 && c.maxDown < -8 && c.after !== null && Math.abs(c.after) < 0.5 && c.exitAt !== null && c.back.every(b => b === 0) && !c.inRace), J(sp));
    }

    // ---- f. the noisy hand, a race in every car
    const f = [];
    for (const veh of ["car", "cybertruck", "corvette", "monster"]) { const r = await oneRace(page, veh, 7100 + f.length, { track: id }); f.push(r); }
    check(`race ${id}: a race with the noisy hand in every car -- places ${f.map(r => r.veh + " " + r.place).join(", ")}; ${f.reduce((a, r) => a + r.bangs, 0)} bangs, ${f.reduce((a, r) => a + r.stuck, 0)} stuck, every one to the podium`,
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
          for (let f = 0; f < 60 * 200 && R.phase !== "done" && R.phase !== "podium"; f++) { S.touching = true; S.ctrlBank = Math.sin(f / 40) * 0.4; S.ctrlPitch = f % 600 < 200 ? 0.8 : 0; L.update(1 / 60); }
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
    const k = await page.evaluate((id) => {
      const L = window.__lp, S = L.state, RC = L.RC, out = {};
      L.noRender = true; L.api.skipScreens();
      const range = (L.TUNE.dragRangeX * Math.min(innerWidth, innerHeight)) / (L.CAR.dragRangeX * innerWidth);
      for (const veh of ["car", "cybertruck", "corvette", "monster"]) {
        out[veh] = {};
        for (const mode of ["line", "heldL", "heldR", "again"]) {
          L.api.setVehicle(veh); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
          L.spdReset(); L.rcStartRace(id, 34);
          const R = L.race, him = R.him;
          for (let i = 0; i < 60 * 5; i++) { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60); }
          const field = R.racers.slice(); R.racers = [him];
          const Ln = R.track.len, s0 = Math.ceil(him.s / Ln) * Ln + 20;
          him.s = s0 - 200; him.lat = 0; him.v = RC.v * L.spdMul();
          const w0 = R.wallShoves, g0 = R.glideT, b0 = L.flags.carCrashes || 0, p0 = R.padHits;
          out.wids = Array.from(new Set((out.wids || []).concat(field.map(r => r.wid))));
          let t0 = null, t = null, minV = 1e9, tAgain = null, w1 = null, pT0 = null;
          for (let f = 0; f < 60 * 150; f++) {
            let bank;
            if (mode === "line") {
              const q = L.rcAt(him.s + 40), side = Math.abs(q.kh) > 0.002 ? Math.sign(q.kh) : 0, err = side * RC.width * 0.3 - (him.path ? 99 : him.lat);
              bank = Math.abs(err) < 0.3 ? 0 : Math.max(-1, Math.min(1, -err * 0.4));
            } else bank = mode === "heldR" ? 1 : -1;
            // (again: on the left barrier half a lap, then a second of full right, then full left again)
            if (mode === "again" && t0 !== null) { const el = R.t - t0; if (el > 15 && el < 16) bank = 1; if (el >= 16 && w1 === null) w1 = R.wallShoves; }
            S.touching = true; S.ctrlBank = bank / range; S.ctrlPitch = 0; L.update(1 / 60);
            if (t0 === null && him.s >= s0) { t0 = R.t; pT0 = R.padHits; }   // (pads from the timed lap: the run-up crosses the track to the barrier)
            if (t0 !== null) minV = Math.min(minV, him.v);
            if (t0 !== null && him.s >= s0 + Ln) { t = R.t - t0; break; }
          }
          out[veh][mode] = { t: t && +t.toFixed(2), thumps: R.wallShoves - w0, glide: +(R.glideT - g0).toFixed(1), minV: +minV.toFixed(1), bangs: (L.flags.carCrashes || 0) - b0, pads: R.padHits - (pT0 === null ? p0 : pT0), stuck: R.stuck, after: w1 === null ? null : R.wallShoves - w1 };
          R.racers = field; L.raceReset();
        }
      }
      L.noRender = false;
      return out;
    }, id);
    const wids = k.wids; delete k.wids;
    const cars = Object.keys(k), held = m => cars.map(c => `${k[c][m].t} s/${k[c][m].thumps}`).join(", ");
    check(`race ${id}: held into the barrier a whole lap he glides along it -- one thump on the first touch, then quiet (left: ${held("heldL")}; right: ${held("heldR")}, lap s/thumps per car), no pad on the way (${cars.map(c => k[c].heldL.pads + k[c].heldR.pads).join("/")}), never a bang, never stuck; never quicker than the racing line (${cars.map(c => k[c].line.t).join("/")} s); off it a second and back, a fresh hit (${cars.map(c => k[c].again.after).join("/")} more)`,
      cars.every(c => { const K = k[c]; return ["heldL", "heldR"].every(m => K[m].t !== null && K[m].thumps === 1 && K[m].glide > K[m].t * 0.4 && K[m].bangs === 0 && K[m].pads === 0 && K[m].stuck === 0 && K[m].minV > 15 && K[m].t >= K.line.t) && K.line.t !== null && K.again.after === 1 && K.again.bangs === 0; }), J(k));
  }
};
