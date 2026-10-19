"use strict";
// ---------------------------------------------------------------------------
// THE RACE (v164). Portrait, iPad and phone.
//
//   a. the track is data and it closes: track 1's sections end where they start,
//      facing the way they started, at the length its numbers say; it stands on
//      dry, open ground, clear of every road and both cities, and is in the world
//      from the start (grandstands solid as buildings are);
//   b. the way in: the chequered flag is up in every car he can drive and in
//      nothing else; tapped (a real touch, hit-tested), it opens the track picker
//      -- one big card and the way back, no text -- and the picker of vehicles is
//      untouched; the card puts him on the grid in the SAME car;
//   c. the field: five opponents, each a different car from the game and none of
//      them his, machines only; the start: three lamps come on red one a second
//      with the numerals 3-2-1, then green, and nobody moves before it;
//   d. a race, finger down and straight: three laps (the lights fill), a real
//      finishing order (every place 1..6 once, in the order they crossed), the
//      podium in that order, again and back up -- and no bang, no stuck;
//   e. FAIR FOR EVERY CAR: alone on the track, the same finger takes the SUV, the
//      Cybertruck, the Corvette (booster held) and the monster truck (burst held)
//      round in the same time -- the car is how it looks, not how fast it goes;
//  e2. THE SAME RULES WHATEVER HE DRIVES: a lifting finger, a light pull, the pad's
//      catch and the field (skill by grid slot) the same in all four (v164 review);
//   f. a shove, never a bang: driven into a car, and held hard into the barrier,
//      he is shoved, keeps going, never explodes, never stops;
//   g. a pad he aims at: hit, he is pushed past his speed;
//   h. the buttons: no two in a slot and nothing over them, at every phase;
//      zero text on the screen at the grid, mid-race and at the podium;
//   i. the ways out: EXIT puts him back where he was, in the same car, driving
//      the world (the flag back up); the menu from a race opens on the VEHICLES
//      and the race is gone; again is a fresh grid;
//   j. a noisy race per car (race_drive.js's hand): finished, no bang, no stuck.
//
// Alone: node scripts/run_module.js race_checks
// ---------------------------------------------------------------------------
const { oneRace } = require("./race_drive");

module.exports = async function raceChecks({ newPage, check }) {
  const J = x => JSON.stringify(x);
  // a real tap, through the browser's touch input (hit-tested, as his finger is)
  const tapper = async (page) => {
    const cdp = await page.context().newCDPSession(page);
    return async (x, y) => {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };
  };
  for (const [w, h] of [[820, 1180], [390, 844]]) {
    const tag = `${w}x${h}`;
    const { page } = await newPage(w, h);
    const tap = await tapper(page);
    await page.waitForFunction(() => window.__lp && window.__lp.race && window.__lp.race.built, null, { timeout: 60000 }).catch(() => {});

    if (w === 820) {
    // ---- e4 (first, on a fresh page: what the earlier tests leave behind on the Corvette
    // hid the fault). his car on the deck: the lowest point of the body he can SEE, in every car
    // (a box of everything took in the Corvette's hidden SUV body and floated it)
    // (the bodies loaded first: the fallback has no hidden parts, so it never floated)
    await page.waitForFunction(() => { const s = window.__lp.modelState; return s && ["car", "cybertruck", "corvette"].every(k => s[k] && s[k] !== "loading"); }, null, { timeout: 120000 }).catch(() => {});
    const e4 = await page.evaluate(() => {
      const L = window.__lp, R = L.race, st = L.state, T = window.THREE, out = {};
      for (const v of ["car", "cybertruck", "corvette", "monster"]) {
        L.api.setVehicle(v); L.api.spawnAt(0, 0); L.api.skipScreens(); L.api.setView(true); for (let i = 0; i < 20; i++) L.update(1 / 60);
        L.rcStartRace("oval");
        for (let i = 0; i < 30; i++) { st.touching = true; st.ctrlBank = 0; st.ctrlPitch = 0; L.update(1 / 60); }
        const m = L.vehicleModel, b = new T.Box3(), g = new T.Box3(), q = {};
        m.updateMatrixWorld(true);
        m.traverse(o => {
          if (!o.isMesh || !o.geometry) return;
          for (let p = o; p && p !== m; p = p.parent) if (!p.visible) return;
          if (o.material && (o.material.visible === false || o.material.blending === T.AdditiveBlending)) return;
          o.geometry.boundingBox || o.geometry.computeBoundingBox();
          b.union(g.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
        });
        L.rcPoint(R.him.s, R.him.lat, q);
        out[v] = +(b.min.y - q.y).toFixed(2);
        // (the Corvette's tail pipes: dark, in a row they read as characters on a plate)
        if (v === "corvette") { out.pipes = []; m.traverse(o => { if (o.isMesh && o.material && o.material.name === "pipe") out.pipes.push(o.material.color.getHex()); }); }
        L.raceReset();
      }
      L.api.setVehicle("car"); L.api.spawnAt(0, 0); L.api.skipScreens();
      out.models = JSON.stringify(L.modelState && { car: L.modelState.car, corvette: L.modelState.corvette });
      return out;
    });
    check(`race ${tag}: his car stands on the deck in every car -- the lowest point of the body he sees, over the deck under it ${J(e4)} m`,
      [e4.car, e4.cybertruck, e4.corvette, e4.monster].every(d => Math.abs(d) < 0.25));
    check(`race ${tag}: the Corvette's tail pipes are the palette's slate, not bright steel in a row like characters on a plate ${J(e4.pipes)}`,
      e4.pipes && e4.pipes.length > 0 && e4.pipes.every(c => c === 0x3c4350));

    }
    // ---- a. the track
    if (w === 820) {
      const a = await page.evaluate(() => {
        const L = window.__lp, R = L.race, T = R.track;
        if (!T) return { none: true };
        let wet = 0, nearRoad = Infinity, inCity = 0;
        for (let i = 0; i < T.n; i += 5) {
          const q = T.S[i];
          for (const lat of [-L.RC.width / 2, 0, L.RC.width / 2]) {
            const x = q.x + q.lx * lat, z = q.z + q.lz * lat;
            if (L.terrainEff(x, z) < L.seaLevelAt(x, z)) wet++;
            const n = L.hwyNearest(x, z); nearRoad = Math.min(nearRoad, Math.abs(n.lateral));
            for (const k of Object.keys(L.streets.cities)) { const b = L.streets.cities[k].data.bounds; if (x > b[0] - 100 && x < b[2] + 100 && z > b[1] - 100 && z < b[3] + 100) inCity++; }
          }
        }
        let stands = 0;
        L.forEachSolid(b => { if (L.solidKind(b) === "building" && R.standsG && b.mesh && b.mesh.parent === R.standsG) stands++; });
        const def = L.RC.tracks[0];
        return { len: +T.len.toFixed(1), gap: +T.gap.toFixed(3), turn: +T.turn.toFixed(4), sections: def.sections.map(s => s.type), wet, nearRoad: Math.round(nearRoad), inCity, stands,
                 venue: !!(R.venue && R.venue.parent), gantry: !!(R.gantry && R.gantry.parent), podium: !!(R.podiumG && R.podiumG.parent) };
      });
      check(`race ${tag}: track 1 is typed sections laid end to end, and it closes -- it ends ${a.gap} m from where it starts, turned ${a.turn} rad, ${a.len} m round (its numbers say 1728) ${J(a)}`,
        !a.none && a.gap < 0.5 && a.turn < 0.01 && Math.abs(a.len - 1728.2) < 3);
      check(`race ${tag}: it stands in the world from the start -- deck, gantry, podium and grandstands (${a.stands} solid as buildings), on dry ground, ${a.nearRoad} m from the motorway at its nearest, outside both cities ${J(a)}`,
        a.venue && a.gantry && a.podium && a.stands >= 4 && a.wet === 0 && a.nearRoad > 120 && a.inCity === 0);
    }

    // ---- b. the flag: up in every car he drives, and in nothing else
    const b = await page.evaluate(() => {
      const L = window.__lp, st = L.state, out = {};
      L.noRender = true; L.api.skipScreens();
      for (const v of ["car", "cybertruck", "corvette", "monster", "prop", "helicopter", "speedboat", "rocket", "sled", "crane", "fighter"]) {
        L.api.setVehicle(v); L.api.spawnAt(0, 0); L.api.skipScreens();
        for (let i = 0; i < 20; i++) L.update(1 / 60);
        out[v] = !document.getElementById("raceBtn").classList.contains("hidden");
      }
      L.api.setVehicle("car"); L.api.spawnAt(0, 0); L.api.skipScreens();
      for (let i = 0; i < 30; i++) L.update(1 / 60);
      return out;
    });
    check(`race ${tag}: the chequered flag is up in every car he can drive and in nothing else ${J(b)}`,
      b.car && b.cybertruck && b.corvette && b.monster && !b.prop && !b.helicopter && !b.speedboat && !b.rocket && !b.sled && !b.crane && !b.fighter);

    // a real touch on the flag: it opens the track picker
    const fr = await page.evaluate(() => { const r = document.getElementById("raceBtn").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await tap(fr.x, fr.y);
    const pk = await page.evaluate(() => {
      const L = window.__lp, s = document.getElementById("screenRace");
      const cards = [...s.querySelectorAll(".card")].filter(c => getComputedStyle(c).display !== "none");
      const text = s.innerText.trim();
      const r = cards[0] && cards[0].getBoundingClientRect();
      return { open: !s.classList.contains("hiddenS"), menu: L.menuOpen ? L.menuOpen() : null, cards: cards.map(c => c.dataset.track), text,
               vehiclesHidden: document.getElementById("screenVehicle").classList.contains("hiddenS"), card: r && { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width } };
    });
    check(`race ${tag}: tapped, the flag opens the track picker -- one big track card and the way back, no text -- and the vehicles' picker stays shut ${J(pk)}`,
      pk.open && pk.cards.length === 2 && pk.cards[0] === "oval" && pk.cards[1] === "back" && pk.text === "" && pk.vehiclesHidden && pk.card.w >= 200);
    await tap(pk.card.x, pk.card.y);

    // ---- c. the grid, the field, the lamps
    const c = await page.evaluate(() => {
      const L = window.__lp, R = L.race, st = L.state, out = { on: L.raceOn(), kind: L.vehKind(), key: st.vehicleKey, phase: R.phase, keys: R.racers.map(r => r.key) };
      const moved = () => R.racers.some(r => Math.abs(r.v) > 0.01);
      const reds = [], nums = new Set();
      let movedEarly = false;
      for (let i = 0; i < 60 * 6 && R.phase === "grid"; i++) {
        st.touching = true; st.ctrlBank = 0; st.ctrlPitch = 0.8;
        L.update(1 / 60);
        const lit = R.lights.filter(m => m.material.color.getHex() === L.TUNE.palette.red).length;
        if (reds[reds.length - 1] !== lit) reds.push(lit);
        const t = document.getElementById("bigNum").textContent; if (t) nums.add(t);
        if (R.phase === "grid" && moved()) movedEarly = true;
      }
      out.reds = reds; out.nums = [...nums]; out.movedEarly = movedEarly; out.go = R.phase;
      out.green = R.lights.every(m => m.material.color.getHex() === L.TUNE.palette.green);
      for (let i = 0; i < 60; i++) { st.touching = true; st.ctrlBank = 0; st.ctrlPitch = 0; L.update(1 / 60); }
      out.rolling = R.racers.filter(r => r.v > 3).length;
      return out;
    });
    const opp = c.keys.slice(1);
    check(`race ${tag}: the card puts him on the grid in the same car, with five to race him, each a different car from the game and none of them his ${J(c)}`,
      c.on && c.kind === "race" && c.key === "car" && c.keys[0] === "car" && opp.length === 5 && new Set(opp).size === 5 && !opp.includes("car"));
    check(`race ${tag}: the start -- the gantry's three lamps come on red one at a time with 3-2-1, then all green, and nobody moves before it ${J({ reds: c.reds, nums: c.nums, movedEarly: c.movedEarly, green: c.green, rolling: c.rolling })}`,
      J(c.reds) === J([0, 1, 2, 3, 0]) && J(c.nums.slice().sort()) === J(["1", "2", "3"]) && !c.movedEarly && c.go === "race" && c.green && c.rolling === 6);

    // ---- h. buttons and text, mid-race
    const mid = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      for (let i = 0; i < 60 * 8; i++) { st.touching = true; st.ctrlBank = 0; st.ctrlPitch = 0; L.update(1 / 60); }
      const bad = [];
      const walk = (n) => {
        if (n.nodeType === 3) { const t = n.textContent.trim(); if (t && !/^[0-9]+$/.test(t)) bad.push(t.slice(0, 24)); return; }
        if (n.nodeType !== 1 || n.tagName === "TITLE" || n.tagName === "SCRIPT" || n.tagName === "STYLE") return;
        if (getComputedStyle(n).display === "none") return;
        for (const c of n.childNodes) walk(c);
      };
      walk(document.body);
      const vis = id => !document.getElementById(id).classList.contains("hidden");
      return { text: bad, clashes: L.btnSlotClashes(), obstructed: L.btnObstructions(), exit: vis("raceExitBtn"), flag: vis("raceBtn"), horn: vis("hornBtn"),
               hud: !document.getElementById("raceHud").classList.contains("hidden"), lights: document.querySelectorAll("#raceHud .raceLaps i").length,
               strip: document.querySelectorAll("#raceHud .racePos b").length, himRinged: document.querySelectorAll("#raceHud .racePos b.him").length };
    });
    check(`race ${tag}: mid-race -- three lap lights and the six cars in order at the top (his ringed), EXIT up, no flag, no horn; no two buttons in a slot, nothing over one, no text ${J(mid)}`,
      mid.hud && mid.lights === 3 && mid.strip === 6 && mid.himRinged === 1 && mid.exit && !mid.flag && !mid.horn && mid.text.length === 0 && mid.clashes.length === 0 && mid.obstructed.length === 0);

    // ---- d. the rest of it, finger down and straight
    const d = await page.evaluate(() => {
      const L = window.__lp, R = L.race, st = L.state, bangs0 = L.flags.carCrashes || 0;
      let exploded = 0, laps = [], lastLaps = 0;
      for (let i = 0; i < 60 * 400 && R.phase !== "podium"; i++) {
        st.touching = true; st.ctrlBank = 0; st.ctrlPitch = 0; L.update(1 / 60);
        if (st.exploding) exploded++;
        const lit = document.querySelectorAll("#raceHud .raceLaps i.done").length;
        if (lit !== lastLaps) { laps.push(lit); lastLaps = lit; }
      }
      const order = R.order.map(r => r.key + ":" + r.place);
      const places = R.order.map(r => r.place);
      const times = R.order.map(r => r.finishT);
      const inOrder = times.every((t, i) => i === 0 || t >= times[i - 1] - 1e-6);
      for (let i = 0; i < 60 * 4; i++) { st.touching = false; L.update(1 / 60); }
      const P = R.podium;
      const vis = id => !document.getElementById(id).classList.contains("hidden");
      return { phase: R.phase, laps, order, places, inOrder, top: P && P.top.map(r => r.key), him: R.him.place, won: P && P.won,
               trophy: R.trophy.visible, again: vis("raceAgainBtn"), back: vis("raceBackBtn"), exit: vis("raceExitBtn"),
               clashes: L.btnSlotClashes(), obstructed: L.btnObstructions(), bangs: (L.flags.carCrashes || 0) - bangs0, exploded, stuck: R.stuck };
    });
    check(`race ${tag}: finger down and straight -- three laps (the lights fill ${J(d.laps)}), a real finishing order (${d.order.join(" ")}), and the podium in it: ${J(d.top)}; he came ${d.him}; again and back up, EXIT gone; no bang, never stuck ${J(d)}`,
      d.phase === "podium" && J(d.laps) === J([1, 2, 3]) && J(d.places) === J([1, 2, 3, 4, 5, 6]) && d.inOrder && d.top && d.top.length === 3 &&
      d.top.join() === d.order.slice(0, 3).map(s => s.split(":")[0]).join() && d.again && d.back && !d.exit && d.trophy === !!d.won &&
      d.clashes.length === 0 && d.obstructed.length === 0 && d.bangs === 0 && d.exploded === 0 && d.stuck === 0);

    // ---- i. again: a fresh grid; then EXIT: back where he was
    const i = await page.evaluate(() => {
      const L = window.__lp, R = L.race, st = L.state;
      L.raceAgain();
      const again = { phase: R.phase, racers: R.racers.length, laps: R.him.lapsDone, trophy: R.trophy.visible };
      const sv = Object.assign({}, R.saved);
      L.raceExit();
      for (let i = 0; i < 30; i++) { st.touching = false; L.update(1 / 60); }
      const out = { again, on: L.raceOn(), kind: L.vehKind(), key: st.vehicleKey, d: Math.round(Math.hypot(st.x - sv.x, st.z - sv.z)), flag: !document.getElementById("raceBtn").classList.contains("hidden"),
                    hud: document.getElementById("raceHud").classList.contains("hidden"), opponents: L.scene.children.filter(o => o.userData && o.userData.rcRacer).length };
      // and the car drives on, in the world
      for (let i = 0; i < 60 * 3; i++) { st.touching = true; st.ctrlBank = 0; st.ctrlPitch = 0; L.update(1 / 60); }
      out.drives = +st.speed.toFixed(1); out.bang = st.exploding;
      // the menu from inside a race opens on the vehicles, and the race is gone
      L.rcStartRace("oval");
      for (let i = 0; i < 10; i++) L.update(1 / 60);
      document.getElementById("menuBtn").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      out.menu = { vehicles: !document.getElementById("screenVehicle").classList.contains("hiddenS"), race: L.raceOn(), raceScreen: !document.getElementById("screenRace").classList.contains("hiddenS") };
      L.api.skipScreens(); L.api.setVehicle("car"); L.api.spawnAt(0, 0); L.api.skipScreens();
      return out;
    });
    check(`race ${tag}: again is a fresh grid; EXIT puts him back where he was (${i.d} m off), in the same car, driving the world, the flag back up; the menu from a race opens on the vehicles and the race is gone ${J(i)}`,
      i.again.phase === "grid" && i.again.racers === 6 && i.again.laps === 0 && !i.again.trophy && !i.on && i.kind === "car" && i.key === "car" && i.d < 2 && i.flag && i.hud &&
      i.drives > 5 && !i.bang && i.menu.vehicles && !i.menu.race && !i.menu.raceScreen);

    if (w !== 820) continue;   // the rest is about the race, not the screen

    // ---- e. fair for every car: alone on the track, the same finger, the same time
    const e = await page.evaluate(() => {
      const L = window.__lp, R = L.race, st = L.state, out = {};
      for (const [v, pull] of [["car", 0], ["car", 0.8], ["cybertruck", 0.8], ["corvette", 0.8], ["monster", 0.8]]) {
        L.api.setVehicle(v); L.api.spawnAt(0, 0); L.api.skipScreens(); for (let i = 0; i < 10; i++) L.update(1 / 60);
        L.rcStartRace("oval");
        // alone: the others taken off the track before the lamps
        for (const r of R.racers) if (!r.isHim) L.scene.remove(r.mesh);
        R.racers = [R.him];
        let t = 0;
        for (let i = 0; i < 60 * 300 && !R.him.done; i++) { st.touching = true; st.ctrlBank = 0; st.ctrlPitch = R.phase === "race" ? pull : 0; L.update(1 / 60); }
        out[v + (pull ? "+up" : "")] = +R.him.finishT.toFixed(2);
        L.raceReset();
      }
      L.api.setVehicle("car"); L.api.spawnAt(0, 0); L.api.skipScreens();
      return out;
    });
    const up = [e["car+up"], e["cybertruck+up"], e["corvette+up"], e["monster+up"]];
    check(`race ${tag}: fair for every car -- alone on the track with the same finger, drag up held, the SUV, the Cybertruck, the Corvette (its booster) and the monster truck go round in the same time; drag up is worth the same to all of them ${J(e)}`,
      up.every(t => t > 60) && Math.max(...up) - Math.min(...up) < 0.6 && e.car > e["car+up"] + 2);

    // ---- e2. the same rules, whatever he drives: a lifting finger's bursts, a light pull,
    // the pad's catch, and the field (each opponent's skill goes with its grid slot)
    const e2 = await page.evaluate(() => {
      const L = window.__lp, R = L.race, st = L.state, out = { lift: {}, light: {}, pad: {}, field: {} };
      const alone = () => { for (const r of R.racers) if (!r.isHim) L.scene.remove(r.mesh); R.racers = [R.him]; };
      const lap = (v, pitchAt) => {
        L.api.setVehicle(v); L.api.spawnAt(0, 0); L.api.skipScreens(); for (let i = 0; i < 10; i++) L.update(1 / 60);
        L.rcStartRace("oval"); alone();
        let t = 0;
        for (let i = 0; i < 60 * 300 && !R.him.done; i++) { st.touching = true; st.ctrlBank = 0; st.ctrlPitch = R.phase === "race" ? pitchAt(t) : 0; if (R.phase === "race") t += 1 / 60; L.update(1 / 60); }
        const T = +R.him.finishT.toFixed(2); L.raceReset(); return T;
      };
      for (const v of ["car", "cybertruck", "corvette", "monster"]) {
        // a pull of a quarter second every three, the finger off between
        out.lift[v] = lap(v, t => (t % 3) < 0.25 ? 0.8 : 0);
        // a light pull, held: under the burst for every car
        out.light[v] = lap(v, () => 0.3);
        // the field: skill and line by grid slot, front to back
        L.api.setVehicle(v); L.api.spawnAt(0, 0); L.api.skipScreens(); for (let i = 0; i < 10; i++) L.update(1 / 60);
        L.rcStartRace("oval");
        out.field[v] = R.racers.filter(r => !r.isHim).sort((a, b) => b.s - a.s).map(r => +r.skill.toFixed(4) + "/" + r.line.toFixed(2)).join(" ");
        L.raceReset();
      }
      out.none = lap("car", () => 0);
      // the pad's catch: how far off its middle each car still takes it
      for (const v of ["car", "monster"]) {
        let far = 0;
        for (let d = 0; d <= 8; d += 0.25) {
          L.api.setVehicle(v); L.api.spawnAt(0, 0); L.api.skipScreens(); for (let i = 0; i < 5; i++) L.update(1 / 60);
          L.rcStartRace("oval"); alone();
          for (let i = 0; i < 60 * 6 && R.phase !== "race"; i++) { st.touching = true; st.ctrlBank = 0; st.ctrlPitch = 0; L.update(1 / 60); }
          const pd = R.pads[0], him = R.him, p0 = R.padHits;
          him.s = pd.s - 40; him.lat = pd.lat - Math.sign(pd.lat) * d; him.latV = 0; him.v = L.RC.v * L.spdMul();   // (off it toward the middle: toward the barrier the edge would clamp him back on)
          for (let i = 0; i < 60 * 2; i++) { st.touching = true; st.ctrlBank = 0; st.ctrlPitch = 0; L.update(1 / 60); }
          if (R.padHits > p0) far = d;
          L.raceReset();
        }
        out.pad[v] = far;
      }
      L.api.setVehicle("car"); L.api.spawnAt(0, 0); L.api.skipScreens();
      return out;
    });
    const lifts = Object.values(e2.lift), lights = Object.values(e2.light), fields = Object.values(e2.field);
    check(`race ${tag}: the same rules whatever he drives -- a lifting finger's bursts go round in the same time in all four (${J(e2.lift)}, under ${e2.none} with none), a light held pull bursts in none of them (${J(e2.light)}), the pad catches the SUV and the monster truck as far off its middle (${J(e2.pad)} m), and the field he meets has the same skill and line in each grid slot whatever he drives ${J(e2.field)}`,
      Math.max(...lifts) - Math.min(...lifts) < 0.6 && Math.min(...lifts) < e2.none - 1 && lights.every(t => Math.abs(t - e2.none) < 0.3) &&
      e2.pad.car > 0 && e2.pad.car === e2.pad.monster && fields.every(f => f === fields[0]));

    // ---- e3. the podium in the giant: it fits its step, its own size again for the
    // next race (and measured at it), and EXIT leaves no confetti behind
    const e3 = await page.evaluate(() => {
      const L = window.__lp, R = L.race, st = L.state, out = {};
      L.api.setVehicle("monster"); L.api.spawnAt(0, 0); L.api.skipScreens(); for (let i = 0; i < 10; i++) L.update(1 / 60);
      const m = () => L.vehicleModel || window.vehicleModel;
      out.s0 = +m().scale.x.toFixed(3);
      L.rcStartRace("oval"); out.lift0 = +R.himLift.toFixed(2);
      for (const r of R.racers) if (!r.isHim) r.skill = 0.5;
      for (let i = 0; i < 60 * 400 && R.phase !== "podium"; i++) { st.touching = true; st.ctrlBank = 0; st.ctrlPitch = 0; L.update(1 / 60); }
      // (and the winner's hop lands: on its step most frames, never far off it)
      let on = 0, n = 0, top = 0;
      for (let i = 0; i < 60 * 4; i++) { st.touching = false; L.update(1 / 60);
        const w = R.racers.find(r => r.onStep === 0); if (!w || !w.podPose) continue;
        const up = w.podPose.y - R.podiumSpots[0].y; n++; if (up < 0.01) on++; top = Math.max(top, up); }
      out.onFrac = n ? +(on / n).toFixed(2) : 0; out.hopTop = +top.toFixed(2);
      // (the trophy stands on its plinth -- its lowest point on the cap -- and over the giant, not in it)
      { const T = window.THREE, b = new T.Box3().setFromObject(R.trophy), sb = new T.Box3().setFromObject(R.trophyStand), mb = new T.Box3();
        m().traverse(o => { if (!o.isMesh) return; for (let p = o; p; p = p.parent) if (!p.visible) return; mb.union(new T.Box3().setFromObject(o)); });
        out.cupOnStand = +(b.min.y - sb.max.y).toFixed(2); out.cupOverCar = +(b.min.y - mb.max.y).toFixed(2); out.cupShown = R.trophy.visible && R.trophyStand.visible; }
      out.place = R.him.place; out.onStep = +m().scale.x.toFixed(3);
      L.raceAgain(); for (let i = 0; i < 5; i++) L.update(1 / 60);
      out.again = +m().scale.x.toFixed(3); out.lift1 = +R.himLift.toFixed(2);
      for (let i = 0; i < 60 * 400 && R.phase !== "podium"; i++) { st.touching = true; st.ctrlBank = 0; st.ctrlPitch = 0; L.update(1 / 60); }
      for (let i = 0; i < 60 * 1; i++) { st.touching = false; L.update(1 / 60); }
      L.raceExit(); for (let i = 0; i < 3; i++) L.update(1 / 60);
      out.exit = +m().scale.x.toFixed(3); out.confetti = typeof confetti !== "undefined" ? confetti.length : -1;
      L.api.setVehicle("car"); L.api.spawnAt(0, 0); L.api.skipScreens();
      return out;
    });
    check(`race ${tag}: the podium in the monster truck -- it fits its step (scale ${e3.onStep} of ${e3.s0}), is its own size again for the next race and measured at it (lift ${e3.lift1} against ${e3.lift0}) and after EXIT, which leaves no confetti behind ${J(e3)}`,
      e3.place === 1 && e3.onStep < e3.s0 * 0.9 && e3.again === e3.s0 && e3.exit === e3.s0 && e3.lift1 === e3.lift0 && e3.confetti === 0);
    check(`race ${tag}: the trophy stands on its plinth on the board (its foot ${e3.cupOnStand} m off the cap) and clear over the monster truck (${e3.cupOverCar} m)`, e3.cupShown && Math.abs(e3.cupOnStand) < 0.1 && e3.cupOverCar > 0.5);
    // ---- e5 (v167). the podium he did not make: the shot holds his own car whole -- in
    // every car, the monster truck most of all, portrait and landscape -- inside the
    // screen, under no button (the two at the end included) and off the steps
    const e5 = [];
    for (const [vw, vh] of [[820, 1180], [1180, 820]]) {
      await page.setViewportSize({ width: vw, height: vh });
      for (const veh of ["car", "cybertruck", "corvette", "monster"]) {
        e5.push(await page.evaluate(([veh, vw]) => {
          const L = window.__lp, R = L.race, st = L.state, T = window.THREE, cam = L.camera, out = { veh, vw };
          L.api.setVehicle(veh); L.api.spawnAt(0, 0); L.api.skipScreens(); for (let i = 0; i < 10; i++) L.update(1 / 60);
          L.rcStartRace("oval");
          for (let i = 0; i < 60 * 12; i++) { st.touching = true; st.ctrlBank = 0; st.ctrlPitch = 0; L.update(1 / 60); }
          // last: the rest ahead of him by a lap, and so to the podium
          R.racers.forEach((r, k) => { if (!r.isHim) r.s = R.him.s + 40 + k * 5; });
          window.rcToPodium();
          for (let i = 0; i < 60 * 12; i++) { st.touching = false; L.update(1 / 60); }
          cam.updateMatrixWorld(); cam.updateProjectionMatrix();
          const m = L.vehicleModel, b = new T.Box3();
          m.updateMatrixWorld(true);
          m.traverse(o => { if (!o.isMesh || !o.geometry) return; for (let p = o; p && p !== m; p = p.parent) if (!p.visible) return;
            if (o.userData.cvFx || o.material && (o.material.visible === false || o.material.blending === T.AdditiveBlending)) return;
            o.geometry.boundingBox || o.geometry.computeBoundingBox(); b.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); });
          const rect = (pts) => { const r = [9, -9, 9, -9]; for (const p of pts) { const v = p.clone().project(cam); r[0] = Math.min(r[0], v.x); r[1] = Math.max(r[1], v.x); r[2] = Math.min(r[2], v.y); r[3] = Math.max(r[3], v.y); } return r; };
          const corners = (bx) => { const a = []; for (const x of [bx.min.x, bx.max.x]) for (const y of [bx.min.y, bx.max.y]) for (const z of [bx.min.z, bx.max.z]) a.push(new T.Vector3(x, y, z)); return a; };
          const car = rect(corners(b));
          // the steps and the cars standing on them (5 m), not the board behind
          const g = R.podiumG, PD = L.TUNE.race.podium, W = PD.w * 1.5, sp = [];
          for (const x of [-W, W]) for (const y of [0, 5]) for (const z of [-PD.d / 2, PD.d / 2]) sp.push(new T.Vector3(x, y, z).applyMatrix4(g.matrixWorld));
          const steps = rect(sp);
          const H = window.innerHeight, Wd = window.innerWidth, hits = [];
          for (const e of document.querySelectorAll("button")) {
            const q = e.getBoundingClientRect(); if (q.width < 1 || q.height < 1 || getComputedStyle(e).visibility === "hidden") continue;
            const k = [2 * q.left / Wd - 1, 2 * q.right / Wd - 1, 1 - 2 * q.bottom / H, 1 - 2 * q.top / H];
            if (car[1] > k[0] && car[0] < k[1] && car[3] > k[2] && car[2] < k[3]) hits.push(e.id);
          }
          out.place = R.him.place; out.onStep = !!R.podium.onStep; out.v = +R.him.v.toFixed(2); out.fitted = !!R.loseShot;
          if (R.loseShot) out.fit = { ok: R.loseShot.ok, up: R.loseShot.up, slide: R.loseShot.slide, car: R.loseShot.rects.car.map(n => +n.toFixed(2)), win: R.loseShot.rects.win.map(n => +n.toFixed(2)) };
          out.car = car.map(n => +n.toFixed(2)); out.steps = steps.map(n => +n.toFixed(2)); out.under = hits;
          out.inside = car[0] > -1 && car[1] < 1 && car[2] > -1 && car[3] < 1;
          out.offSteps = car[1] <= steps[0] || car[0] >= steps[1] || car[3] <= steps[2] || car[2] >= steps[3];
          out.ends = ["raceAgainBtn", "raceBackBtn"].every(id => { const e = document.getElementById(id); return e && !e.classList.contains("hidden"); });
          L.raceExit(); for (let i = 0; i < 3; i++) L.update(1 / 60);
          L.api.setVehicle("car"); L.api.spawnAt(0, 0); L.api.skipScreens();
          return out;
        }, [veh, vw]));
      }
    }
    await page.setViewportSize({ width: w, height: h });
    check(`race ${tag}: when he loses, the podium shot holds his own car whole -- every car, portrait and landscape, inside the screen, under no button (the two at the end showing) and clear of the steps ${J(e5.map(r => ({ veh: r.veh, vw: r.vw, place: r.place, car: r.car, under: r.under })))}`,
      e5.length === 8 && e5.every(r => !r.onStep && r.place > 3 && r.v < 0.5 && r.fitted && r.fit && r.fit.ok && r.inside && r.under.length === 0 && r.offSteps && r.ends), J(e5));
    check(`race ${tag}: the winner's hop lands on its step -- on it ${e3.onFrac} of the frames, never more than ${e3.hopTop} m up`, e3.onFrac >= 0.6 && e3.hopTop > 0 && e3.hopTop <= 0.6);

    // ---- f, g. a shove, the barrier, a pad
    const f = await page.evaluate(() => {
      const L = window.__lp, R = L.race, st = L.state, RC = L.RC, out = {};
      const go = (n, bank, pitch) => { for (let i = 0; i < n; i++) { st.touching = true; st.ctrlBank = bank; st.ctrlPitch = pitch || 0; L.update(1 / 60); if (st.exploding) out.exploded = (out.exploded || 0) + 1; } };
      L.rcStartRace("oval");
      go(60 * 5, 0);
      const him = R.him, o = R.racers[1];
      // a car straight in front of him, slower: he drives into it
      o.s = him.s + 9; o.lat = him.lat; o.v = 10; o.latV = 0; o.skill = 0.3; him.v = 36;
      const sh0 = R.shoves;
      go(60 * 2, 0);
      out.shoves = R.shoves - sh0; out.himV = +him.v.toFixed(1); out.oV = +o.v.toFixed(1);
      // hard right into the barrier for ten seconds
      const range = (L.TUNE.dragRangeX * Math.min(innerWidth, innerHeight)) / (L.CAR.dragRangeX * innerWidth);
      const w0 = R.wallShoves;
      let minV = 1e9;
      for (let i = 0; i < 60 * 10; i++) { go(1, 1 / range); minV = Math.min(minV, him.v); }
      out.walls = R.wallShoves - w0; out.lat = +him.lat.toFixed(2); out.edge = +(-(RC.width / 2 - him.wid / 2 - 0.2)).toFixed(2); out.minV = +minV.toFixed(1);
      // a pad he aims at
      const pd = R.pads[0], L0 = R.track.len;
      him.s = Math.floor(him.s / L0) * L0 + pd.s - 80 + (him.s % L0 > pd.s - 80 ? L0 : 0); him.lat = pd.lat; him.latV = 0;
      for (const r of R.racers) if (!r.isHim) r.s = him.s - 300;
      const p0 = R.padHits; let maxV = 0;
      for (let i = 0; i < 60 * 4; i++) { go(1, 0); maxV = Math.max(maxV, him.v); }
      out.pads = R.padHits - p0; out.maxV = +maxV.toFixed(1); out.base = RC.v * L.spdMul();
      out.stuck = R.stuck;
      L.raceReset();
      L.api.setVehicle("car"); L.api.spawnAt(0, 0); L.api.skipScreens();
      return out;
    });
    check(`race ${tag}: a shove, never a bang -- driven into a slower car he is shoved (${f.shoves}) and rolls on behind it; held hard into the barrier for ten seconds he runs along it (${f.walls} shoves, at ${f.lat} m, its edge ${f.edge}) and never stops; never an explosion ${J(f)}`,
      f.shoves > 0 && f.himV > 5 && f.walls > 0 && Math.abs(f.lat - f.edge) < 0.3 && f.minV > 15 && !f.exploded && f.stuck === 0);
    check(`race ${tag}: a pad he aims at pushes him past his speed (${f.maxV} m/s against ${f.base}) ${J(f)}`, f.pads === 1 && f.maxV > f.base * 1.15);

    // ---- j. a noisy race in every car
    const noisy = {};
    for (const v of ["car", "cybertruck", "corvette", "monster"]) noisy[v] = await oneRace(page, v, 77, {});
    const nz = Object.values(noisy);
    check(`race ${tag}: a noisy finger in every car finishes on the podium screen, no bang, never stuck ${J(Object.fromEntries(Object.entries(noisy).map(([k, r]) => [k, { place: r.place, gap: r.gap, bangs: r.bangs, stuck: r.stuck, shoves: r.shoves, pads: r.pads }])))}`,
      nz.every(r => r.podium && r.bangs === 0 && r.stuck === 0 && r.nan === 0));
    await page.evaluate(() => { const L = window.__lp; L.raceReset(); L.api.setVehicle("car"); L.api.spawnAt(0, 0); L.api.skipScreens(); });
  }
};
