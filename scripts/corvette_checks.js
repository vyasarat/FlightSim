"use strict";
// ---------------------------------------------------------------------------
// THE CORVETTE (v159): a third body on the car, and its rocket booster. Portrait.
//
//   a. it DRIVES AS THE CAR: the Cybertruck's twin run (cybertruck_checks.twinRun)
//      on two fresh pages, the SUV and the Corvette, the booster never touched --
//      the same path to the millimetre, the same bang and rebuild;
//   b. the card: beside the Cybertruck's, an icon only; picked through the real
//      picker he is in it, and to the road it is a car;
//   c. the contract: a row with every slot the car's has, and `booster` -- on the
//      Corvette only; the car's steps, voice and bed; its eject family; the file
//      carries its licence and author;
//   d. the model: imported, under 30k triangles, four wheels, palette materials
//      only, no texture; it sits on the road; the seat's eye is where the SUV's
//      is in its cabin, lower off the road; the chase frames it;
//   e. the booster is FASTER: at the top step, then held -- well above the top
//      step's speed, at the bottom step too, and let go it falls back to the step;
//      the SUV's drag-up is still its timed burst, and lights nothing of this;
//   f. the flames: from the chase view, four of them, lit, in the frame, out of
//      the tail and longer the faster he goes, a glow on the road behind; from the
//      seat the rear-view mirror is in the frame and shows them; out in a bang;
//   g. FAST IS STILL SAFE, motorway: a held finger with the booster held crosses
//      the country both ways at the bottom and top steps -- zero traffic touches,
//      crashes or walls, never on the oncoming carriageway, burning all the way
//      and still burning at the end (nothing runs out);
//   h. FAST IS STILL SAFE, cities: booster held, hands-off from each city's ways
//      in, he loops through the streets and out -- no bang, no touch -- the booster
//      adding no speed in a city, and the corner assist shedding speed for every corner; a full right held with the
//      booster burning takes the corner at the corner's speed, not the booster's;
//   i. off the road it bangs as every car does: pointed at a building mid-block,
//      booster burning, one bang, and back free on that street where it happened;
//   j. leaving it: nothing of it follows him into the next vehicle.
// On v158 there is no such vehicle: every check FAILs, none throws.
//
// Alone: node scripts/run_module.js corvette_checks
// ---------------------------------------------------------------------------
const { twinRun, lookAt } = require("./cybertruck_checks");

module.exports = async function corvetteChecks({ newPage, check }) {
  const J = x => JSON.stringify(x);

  // ---- a. the twin run, each vehicle on a page of its own (same seed, same world)
  const runs = {};
  for (const key of ["car", "corvette"]) {
    let p = null;
    try {
      p = await newPage(820, 1180);
      runs[key] = await p.page.evaluate(twinRun, key);
    } catch (e) { runs[key] = { err: String(e && e.message || e).slice(0, 200) }; }
    finally { if (p) await p.ctx.close(); }
  }
  {
    const a = runs.car, b = runs.corvette;
    const crashOk = r => r.crash && r.crash.bangs === 1 && J(r.crash.hit) === J(["building:crash"]) && r.crash.at && !r.crash.exploding && r.crash.backDist < 40 && r.crash.backOn === r.crash.street;
    const ok = a && b && !a.err && !b.err && b.kind === "corvette" && a.kind === "car" && a.path.length > 40 &&
      J(a.path) === J(b.path) && a.bangs === 1 && b.bangs === 1 && a.turned.ok && b.turned.ok && crashOk(a) && crashOk(b) && J(a.crash) === J(b.crash);
    let firstDiff = null;
    if (a && b && a.path && b.path) for (let i = 0; i < Math.max(a.path.length, b.path.length); i++) if (J(a.path[i]) !== J(b.path[i])) { firstDiff = { i, car: a.path[i], corvette: b.path[i] }; break; }
    check("corvette: drives AS the car -- with the booster never touched, the same inputs on two fresh pages (motorway lane-keep, a speed step, a lane change, a release, New York hands-off, a full right held through a junction, pointed mid-block at a building) give the same path to the millimetre, the same one bang and the same free rebuild on that street",
      ok, J({ car: a && { err: a.err, kind: a.kind, n: a.path && a.path.length, bangs: a.bangs, turned: a.turned, crash: a.crash },
              corvette: b && { err: b.err, kind: b.kind, n: b.path && b.path.length, bangs: b.bangs, turned: b.turned, crash: b.crash }, firstDiff }));
  }

  const { page, ctx, errors } = await newPage(820, 1180);
  try {
    // ---- b. the card, through the real picker
    const card = await page.evaluate(() => {
      const sv = document.getElementById("screenVehicle");
      const was = sv.classList.contains("hiddenS");
      sv.classList.remove("hiddenS");
      const c = document.querySelector('.vehCard[data-v="corvette"]');
      const out = { exists: !!c };
      if (c) {
        const r = c.getBoundingClientRect();
        out.visible = !c.classList.contains("hiddenS") && r.width > 100 && r.height > 100;
        out.text = c.textContent.trim();
        out.words = [c, ...c.querySelectorAll("*")].filter(e => ["aria-label", "title", "alt"].some(a => e.hasAttribute(a))).map(e => e.tagName);
        out.svgText = c.querySelectorAll("text, tspan, foreignObject").length;
        out.icon = !!c.querySelector("svg path, svg rect, svg circle");
        const prev = c.previousElementSibling;
        out.afterCyber = !!prev && prev.dataset.v === "cybertruck";
      }
      out.cards = sv.querySelectorAll(".vehCard:not(.hiddenS)").length;
      if (was) sv.classList.add("hiddenS");
      return out;
    });
    let tapped = null;
    try {
      await page.evaluate(() => { const L = window.__lp; L.api.setThrottle(false); L.api.clearStick(); L.api.skipScreens(); for (let i = 0; i < 5; i++) L.update(1 / 60); });
      await page.click("#menuBtn", { timeout: 5000 });
      await page.click('.vehCard[data-v="corvette"]', { timeout: 5000 });
      await page.click('[data-d="0"]', { timeout: 5000 });
      tapped = true;
    } catch (e) { tapped = String(e && e.message || e).slice(0, 160); }
    const picked = await page.evaluate(() => {
      const L = window.__lp, S = L.state;
      for (let i = 0; i < 30; i++) { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60); }
      return { key: S.vehicleKey, kind: L.vehKind(), isCar: L.vehIsCar(), booster: L.vehBooster(), vpCar: !!S.vp.car, police: L.policeCan(), sp: +S.speed.toFixed(1) };
    });
    check("corvette: a card beside the Cybertruck's, an icon only (no text, no label words), sixteen cards now; picked through the real picker he is in it, and to the road it is a car (vehIsCar, the police may start)",
      card.exists && card.visible && card.afterCyber && card.text === "" && card.words.length === 0 && card.svgText === 0 && card.icon && card.cards === 16 &&
      tapped === true && picked.key === "corvette" && picked.kind === "corvette" && picked.isCar && picked.booster && picked.vpCar && picked.police && picked.sp > 0,
      J({ card, tapped, picked }));

    // ---- c. the contract row, the steps and voices, the eject family, the licence
    const rows = await page.evaluate(async () => {
      const L = window.__lp, C = L.VEHICLE_CONTRACT, T = L.TUNE;
      let licence = null;
      try {
        const b = await (await fetch(T.models.corvette.file)).arrayBuffer();
        const n = new DataView(b).getUint32(12, true);
        const a = JSON.parse(new TextDecoder().decode(new Uint8Array(b, 20, n))).asset || {};
        licence = a.extras ? { author: a.extras.author, license: a.extras.license } : null;
      } catch (e) { licence = String(e); }
      const carSlots = Object.keys(C.car).sort(), cvSlots = Object.keys(C.corvette || {}).sort();
      const boosters = Object.keys(C).filter(k => C[k].booster);
      const fam = T.eject.families.corvette;
      return {
        carSlots, cvSlots, boosters, carLike: !!(C.corvette && C.corvette.carLike), solidClass: C.corvette && C.corvette.solidClass === C.car.solidClass,
        solidR: T.solid.r.corvette === T.solid.r.car, crawl: T.solid.crawl.corvette === T.solid.crawl.car,
        steps: L.spdStepsFor("corvette") === T.car.speedSteps, eng: engKeyFor(), bed: currentBedName(),
        family: ejectFamily(), fam: fam ? { roof: fam.roof, seat: fam.seat } : null, licence,
      };
    });
    check("corvette: a row of its own in the vehicle contract with every slot the car's has (carLike) and `booster` -- the only row with it; the car's solid class, radius and crawl, speed steps, engine voice and sound bed",
      rows.cvSlots.length > 0 && rows.carSlots.every(k => rows.cvSlots.includes(k)) && J(rows.boosters) === J(["corvette"]) && rows.carLike && rows.solidClass && rows.solidR && rows.crawl &&
      rows.steps && rows.eng === "car" && rows.bed === "car", J(rows));

    // ---- d. the model, how it sits, the two views, eject
    await page.waitForFunction(() => window.__lp.modelState.corvette === "ready" && window.__lp.modelState.car === "ready", null, { timeout: 60000 }).catch(() => {});
    const look = await page.evaluate(lookAt, ["car", "corvette"]);
    const car = look.car || {}, cv = look.corvette || {};
    check("corvette: the imported body (under 30k triangles), four wheels found, only palette materials (its tail pipes among them) and no texture on any -- no badge, no word can ride in on one; the file carries its CC BY-NC-SA licence and author",
      !look.err && rows.licence && /^CC-BY-NC-SA-4\.0/.test(rows.licence.license || "") && /Ddiaz/.test(rows.licence.author || "") && cv.imported === "corvette" && cv.tris > 1000 && cv.tris < 30000 && cv.wheels === 4 && cv.textures === 0 &&
      cv.mats.length > 0 && cv.mats.includes("pipe") && cv.mats.every(m => ["body", "tint", "trim", "lamp", "tail", "tyre", "rim", "pipe"].includes(m)), J({ err: look.err, cv, licence: rows.licence }));
    const sits = g => Array.isArray(g) && g.length === 4 && g.every(d => Math.abs(d) <= 0.05);
    check("corvette: sits on the road -- each wheel's lowest point within 5 cm of the motorway under it, stopped and driving, as the SUV's are",
      !look.err && sits(cv.restGap) && sits(cv.driveGap), J({ cv: [cv.restGap, cv.driveGap], car: [car.restGap, car.driveGap] }));
    check("corvette: the driving seat -- body hidden, the cabin up, his eye in the cabin exactly where it is in the SUV (within 2 cm), and LOWER off the road (a low car); while its body is still loading, the SUV stand-in's seat exactly",
      !look.err && cv.seat && car.seat && !cv.seat.bodyShown && cv.seat.cabin && Math.abs(cv.seat.eyeInCabin - car.seat.eyeInCabin) <= 0.02 && cv.seat.eyeOverRoad < car.seat.eyeOverRoad &&
      cv.seat.standIn !== null && cv.seat.standIn === car.seat.standIn, J({ cv: cv.seat, car: car.seat }));
    check("corvette: the chase view -- body shown, the camera behind and above, the car in the portrait frame and a good size",
      !look.err && cv.chase && cv.chase.bodyShown && cv.chase.behind < -5 && cv.chase.above > 1 && cv.chase.inFrame && cv.chase.hFrac > 0.06, J(cv.chase));
    check("corvette: eject -- its own family, and its roof clears the measured body from the model's origin",
      rows.family === "corvette" && rows.fam && typeof cv.topOverOrigin === "number" && rows.fam.roof - cv.topOverOrigin > 0.05 && rows.fam.roof - cv.topOverOrigin < 0.4,
      J({ fam: rows.fam, topOverOrigin: cv.topOverOrigin }));

    // ---- e. faster
    const fast = await page.evaluate(() => {
      const L = window.__lp, S = L.state, out = {};
      L.api.setView(true);
      const drive = (n, pitch) => { for (let i = 0; i < n; i++) { S.touching = true; S.touchIsPoint = false; S.ctrlBank = 0; S.ctrlPitch = pitch; L.update(1 / 60); } };
      L.api.setVehicle("corvette"); L.api.spawnAt(0, 0); L.api.clearStick(); for (let i = 0; i < 30; i++) L.update(1 / 60);
      const n = L.spdStepsFor(L.spdKey()).length;
      S.speedStep = n - 1; drive(60 * 10, 0); out.top = +S.speed.toFixed(1);
      const b0 = L.flags.cvBoosts || 0;
      drive(60 * 6, 0.8); out.boostTop = +S.speed.toFixed(1); out.burning = L.cv.on; out.lit = (L.flags.cvBoosts || 0) - b0;
      out.fov = +L.camera.fov.toFixed(1);
      drive(60 * 8, 0); out.after = +S.speed.toFixed(1); out.out = !L.cv.on;
      S.speedStep = 0; drive(60 * 8, 0); out.low = +S.speed.toFixed(1);
      drive(60 * 6, 0.8); out.boostLow = +S.speed.toFixed(1);
      // a wobbling finger is one burn: dipping to 0.3 and back is still burning, one light
      const b1 = L.flags.cvBoosts || 0;
      for (let i = 0; i < 60 * 3; i++) { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0.55 + 0.25 * Math.sin(i * 0.4); L.update(1 / 60); }
      out.wobbleLights = (L.flags.cvBoosts || 0) - b1;
      out.target = +L.cvSpeed().toFixed(1); out.topStep = +(L.CAR.cruise * Math.max(...L.CAR.speedSteps)).toFixed(1);
      // the SUV: its drag-up is its timed burst, as ever, and lights nothing of the Corvette's
      L.api.setVehicle("car"); L.api.spawnAt(0, 0); L.api.clearStick(); for (let i = 0; i < 30; i++) L.update(1 / 60);
      drive(60 * 4, 0);
      const s0 = L.flags.carBoosts || 0, c0 = L.flags.cvBoosts || 0;
      drive(60, 0.8);
      out.suvBurst = (L.flags.carBoosts || 0) - s0; out.suvLit = (L.flags.cvBoosts || 0) - c0; out.suvFx = !!(L.cv.fx && L.cv.fx.visible);
      L.api.clearStick(); L.spdReset();
      return out;
    });
    check(`corvette: the booster is a clear jump -- held, ${fast.boostTop} m/s at the top step (${fast.top} without it) and ${fast.boostLow} at the bottom (${fast.low}): well above the top step's ${fast.topStep}, one light, the view wider; let go, back to the step; a wobbling drag is one burn; the SUV's drag-up is still its own timed burst`,
      fast.boostTop >= fast.topStep * 1.4 && Math.abs(fast.boostTop - fast.target) < 2 && fast.boostLow >= fast.topStep * 1.4 && fast.burning && fast.lit === 1 &&
      fast.fov > 80 && fast.out && fast.after < fast.top + 3 && fast.low < fast.top && fast.wobbleLights === 0 &&
      fast.suvBurst === 1 && fast.suvLit === 0 && !fast.suvFx, J(fast));

    // ---- f. the flames: chase and seat
    const fl = await page.evaluate(() => {
      const L = window.__lp, S = L.state, out = {};
      const drive = (n, pitch) => { for (let i = 0; i < n; i++) { S.touching = true; S.touchIsPoint = false; S.ctrlBank = 0; S.ctrlPitch = pitch; L.update(1 / 60); } };
      L.api.setVehicle("corvette"); L.api.spawnAt(0, 0); L.api.setView(true); L.api.clearStick(); for (let i = 0; i < 30; i++) L.update(1 / 60);
      drive(60 * 2, 0);
      const cam = L.camera, v = new THREE.Vector3();
      const tailLen = () => { const t = L.cv.flames[0].userData.parts[0]; t.updateWorldMatrix(true, false); const a = new THREE.Vector3().setFromMatrixPosition(t.matrixWorld); const e = new THREE.Vector3(0, 0, L.TUNE.corvette.flame.tail[1]).applyMatrix4(t.matrixWorld); return +a.distanceTo(e).toFixed(2); };
      drive(20, 0.8); out.lenSlow = tailLen(); out.vSlow = +S.speed.toFixed(1);
      drive(60 * 4, 0.8); out.lenFast = tailLen(); out.vFast = +S.speed.toFixed(1);
      cam.updateMatrixWorld(); cam.updateProjectionMatrix();
      out.chase = { fx: L.cv.fx.visible, parent: L.cv.fx.parent === L.vehicleModel, model: L.vehicleModel.visible, flames: [] };
      const fwd = new THREE.Vector3(-Math.sin(S.heading), 0, -Math.cos(S.heading));
      for (const set of L.cv.flames) {
        set.updateWorldMatrix(true, true);
        v.setFromMatrixPosition(set.matrixWorld);
        const behind = +(-(v.x - S.x) * fwd.x - (v.z - S.z) * fwd.z).toFixed(2);
        const p = v.clone().project(cam);
        out.chase.flames.push({ inFrame: Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && p.z < 1, behind, overRoad: +(v.y - S.y).toFixed(2), vis: set.visible });
      }
      out.chase.road = L.cv.road.visible && L.cv.road.material.opacity > 0.3;
      L.cv.road.updateWorldMatrix(true, false); v.setFromMatrixPosition(L.cv.road.matrixWorld);
      out.chase.roadOver = +(v.y - S.y).toFixed(2);
      out.chase.sparks = L.cv.sparks.visible;
      // the seat: the mirror, in the frame, painted with them
      L.api.setView(false); drive(10, 0.8);
      const m = L.cv.mirror;
      cam.updateMatrixWorld(); cam.updateProjectionMatrix();
      const orange = () => { const d = L.cv.mirrorArt.cx.getImageData(0, 0, 128, 32).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 90 && d[i + 1] < 230 && d[i + 2] < 120) n++; return n; };
      out.seat = { cabin: !!(L.car.cabin && L.car.cabin.visible), mirror: !!m && m.visible };
      if (m) {
        m.updateWorldMatrix(true, false); v.setFromMatrixPosition(m.matrixWorld);
        const p = v.clone().project(cam);
        out.seat.inFrame = Math.abs(p.x) < 0.95 && Math.abs(p.y) < 0.95 && p.z < 1;
        out.seat.ndc = [+p.x.toFixed(2), +p.y.toFixed(2)];
        out.seat.facing = +new THREE.Vector3(0, 0, 1).applyQuaternion(m.getWorldQuaternion(new THREE.Quaternion())).dot(cam.position.clone().sub(v).normalize()).toFixed(2);
        out.seat.flamePx = orange();
        drive(60 * 3, 0); L.update(1 / 60);
        out.seat.flamePxOff = orange();
      }
      // out in a bang
      drive(30, 0.8);
      S.exploding = true; S.explodeTimer = 1; L.update(1 / 60); L.update(1 / 60);
      out.bang = { fx: L.cv.fx.visible, on: L.cv.on };
      S.explodeTimer = 0; for (let i = 0; i < 40; i++) L.update(1 / 60);
      L.api.setView(true); L.api.clearStick();
      return out;
    });
    const fc = fl.chase || {};
    check(`corvette: the flames from the chase view -- four, lit, out of the tail and in the frame, a glow on the road behind, sparks; the tail ${fl.lenSlow} m at ${fl.vSlow} m/s and ${fl.lenFast} m at ${fl.vFast}: longer the faster he goes`,
      fc.fx && fc.parent && fc.model && fc.flames.length === 4 && fc.flames.every(f => f.inFrame && f.vis && f.behind > 3 && f.overRoad > 0.1 && f.overRoad < 1.5) &&
      fc.road && Math.abs(fc.roadOver) < 0.3 && fc.sparks && fl.lenFast > fl.lenSlow * 1.5, J(fl));
    check("corvette: the flames from the driving seat -- the rear-view mirror is on the screen, facing him, and shows them while the booster burns (and not once it is out); a bang puts them out",
      fl.seat && fl.seat.cabin && fl.seat.mirror && fl.seat.inFrame && fl.seat.facing > 0.5 && fl.seat.flamePx > 60 && fl.seat.flamePxOff < 5 &&
      fl.bang && !fl.bang.fx && !fl.bang.on, J({ seat: fl.seat, bang: fl.bang }));

    // ---- g. the motorway, booster held, both ways, the bottom and top steps
    const cross = await page.evaluate(() => {
      const L = window.__lp, st = L.state, out = [];
      L.noRender = true; L.api.setVehicle("corvette");
      const n = L.spdStepsFor(L.spdKey()).length;
      for (const origin of [0, 1]) for (const step of [0, n - 1]) {
        L.api.spawnAt(origin, origin); for (let i = 0; i < 30; i++) L.update(1 / 60);
        st.speedStep = step;
        const h0 = L.flags.hwyTrafficHit || 0, c0 = L.flags.carCrashes || 0, w0 = L.flags.wallHits || 0;
        const endZ = origin === 0 ? L.AIRPORTS[1].cz + 900 : L.AIRPORTS[0].cz - 900;
        let f = 0, burn = 0, wrong = 0, vmax = 0, lastS = null, fast = 0;
        while (f < 60 * 60 * 6 && (origin === 0 ? st.z > endZ : st.z < endZ)) {
          L.api.setStick(0, 0.8); L.update(1 / 60); f++;
          if (L.cv.on) burn++;
          vmax = Math.max(vmax, st.speed); if (st.speed > L.cvSpeed() - 8) fast++;
          // on the main line, his lateral's side is the side of the carriageway he travels on
          const me = L.hwyNearest(st.x, st.z), rd = L.car.road;
          if (lastS !== null && rd && !rd.spur && !L.car.onStreet && Math.abs(me.lateral) > 2 && Math.abs(me.lateral) < L.highway.halfW) {
            const ds = me.s - lastS;
            if (Math.abs(ds) > 0.5 && Math.sign(ds) !== Math.sign(me.lateral)) wrong++;
          }
          lastS = me.s;
          if (st.exploding) { st.explodeTimer = 0; for (let i = 0; i < 40; i++) L.update(1 / 60); }
        }
        out.push({ dir: origin === 0 ? "NY>CA" : "CA>NY", step, arrived: origin === 0 ? st.z <= endZ : st.z >= endZ, secs: Math.round(f / 60),
          burnPct: Math.round(100 * burn / Math.max(1, f)), fastPct: Math.round(100 * fast / Math.max(1, f)), burningAtEnd: L.cv.on, vmax: Math.round(vmax), wrongSide: wrong,
          touches: (L.flags.hwyTrafficHit || 0) - h0, crashes: (L.flags.carCrashes || 0) - c0, walls: (L.flags.wallHits || 0) - w0 });
      }
      L.api.clearStick(); L.spdReset(); L.noRender = false;
      return out;
    });
    const badX = cross.filter(r => !r.arrived || r.touches || r.crashes || r.walls || r.wrongSide || r.burnPct < 95 || r.fastPct < 85 || !r.burningAtEnd || r.vmax < 120);
    check(`corvette: fast is still safe on the motorway -- a held finger with the booster held crosses the country both ways at the bottom and top steps (${cross.map(r => `${r.dir} step ${r.step} ${r.secs}s, ${r.fastPct}% of it at the booster's speed`).join(", ")}), burning all the way and still burning at the end, with zero traffic touches, crashes or walls, and never on the oncoming carriageway`,
      cross.length === 4 && badX.length === 0, J(badX.length ? badX : cross));

    // ---- g2. the END of the motorway, booster held: at 128 m/s the end-turn (HW.endTurn)
    // must still slow him and turn him round on to the other carriageway, at both ends
    const ends = await page.evaluate(() => {
      const L = window.__lp, st = L.state, out = [];
      L.noRender = true; L.api.setVehicle("corvette");
      for (const end of [0, 1]) {
        L.api.spawnAt(0, 0); for (let i = 0; i < 20; i++) L.update(1 / 60);
        L.spdReset();
        // on the motorway 2.5 km short of this end, in the lane of the carriageway that runs to it, at the booster's speed
        const dir = end === 0 ? -1 : 1, s0 = end === 0 ? 2500 : L.highway.length - 2500;
        const q = L.hwySampleAt(s0), lat = dir * (L.HW.medianW / 2 + L.HW.laneW * 0.5);
        st.x = q.x - q.fz * lat; st.z = q.z + q.fx * lat; st.y = q.y; st.heading = Math.atan2(-q.fx * dir, -q.fz * dir); st.speed = L.cvSpeed();
        L.car.yield = 1; L.car.steer = 0; L.car.rejoin = null; L.stPlan.road = null; L.updateScenery(st.x, st.z, true);
        const h0 = L.flags.hwyTrafficHit || 0, c0 = L.flags.carCrashes || 0, w0 = L.flags.wallHits || 0;
        let f = 0, vEnd = Infinity, offF = 0, minEnd = Infinity, back = false, fastAgain = false, turnedAt = null;
        for (; f < 60 * 60; f++) {
          L.api.setStick(0, 0.8); L.update(1 / 60);
          if (st.exploding) { st.explodeTimer = 0; for (let i = 0; i < 40; i++) L.update(1 / 60); }
          const n = L.hwyNearest(st.x, st.z), toEnd = dir > 0 ? L.highway.length - n.s : n.s;
          if (toEnd < minEnd) { minEnd = toEnd; vEnd = st.speed; }
          if (L.car.offRoad > 0.5) offF++;
          const along = -Math.sin(st.heading) * n.fx - Math.cos(st.heading) * n.fz;   // + is the way of rising s
          if (!back && Math.sign(along) === -dir && Math.abs(along) > 0.9 && toEnd > 200) { back = true; turnedAt = f; }
          if (back && st.speed > L.cvSpeed() - 8) { fastAgain = true; break; }
        }
        out.push({ end: end === 0 ? "s=0" : "far", secs: Math.round(f / 60), minEnd: Math.round(minEnd), vAtEnd: +vEnd.toFixed(1), back, fastAgain, offFrames: offF,
          touches: (L.flags.hwyTrafficHit || 0) - h0, crashes: (L.flags.carCrashes || 0) - c0, walls: (L.flags.wallHits || 0) - w0 });
      }
      L.api.clearStick(); L.noRender = false;
      return out;
    });
    const badE = ends.filter(r => !r.back || !r.fastAgain || r.touches || r.crashes || r.walls || r.offFrames > 0 || r.vAtEnd > 20);
    check(`corvette: the motorway's end, booster held at 128 m/s -- at both ends the end-turn slows him (${ends.map(r => `${r.vAtEnd} m/s ${r.minEnd} m from the end`).join(", ")}), turns him round on to the other carriageway and the booster takes him back up to speed; never off the road, never a bang`,
      ends.length === 2 && badE.length === 0, J(ends));

    // ---- h. the cities, booster held
    const city = await page.evaluate(() => {
      const L = window.__lp, st = L.state, out = { loops: [] };
      L.noRender = true;
      const fl = () => ({ c: L.flags.carCrashes || 0, w: L.flags.wallHits || 0, t: L.flags.cityTrafficHit || 0, h: L.flags.hwyTrafficHit || 0 });
      const stepV = L.CAR.cruise * L.spdStepsFor("corvette")[2];
      const frame = (steer, pitch) => {
        L.api.setStick(steer || 0, pitch);
        L.update(1 / 60);
        if (st.exploding) { st.explodeTimer = 0; L.api.setStick(0, 0); for (let i = 0; i < 40; i++) L.update(1 / 60); }
      };
      for (const k of ["ny", "ca"]) for (const way of ["CityIn", "CityInFar"]) {
        L.api.setVehicle("corvette"); L.api.spawnAt(0, 0); for (let i = 0; i < 20; i++) L.update(1 / 60);
        L.spdReset(); st.speedStep = 2; if (L.policeStop) L.policeStop(false);
        const ex = L.highway.exits.find(e => e.to === k + way);
        const sp = ex.spur, p = sp[Math.floor(sp.length * 0.35)];
        st.x = p.x; st.z = p.z; st.heading = Math.atan2(-p.fx, -p.fz); st.speed = L.CAR.cruise * 0.8;
        st.y = p.y; L.car.yield = 1; L.stPlan.road = null;
        const f0 = fl();
        let f = 0, home = false, burn = 0, streetMax = 0, cornerOver = 0, corners = 0, wasCorner = false, cornerMax = 0, nodeMax = 0, nodes = 0, wasNear = false, fast = 0, onGrid = 0;
        const grid = new Set();
        while (f < 60 * 260) {
          frame(0, 0.8); f++;
          if (L.cv.on) burn++;
          const r = L.stPlan.road, rd = L.car.road;
          if (L.car.onStreet && r && r.kind === "grid") {
            grid.add(r.id); streetMax = Math.max(streetMax, st.speed); onGrid++;
            if (st.speed > stepV + 1) fast++;
            // v160: the boost is shed for every junction -- at each, he is the car at his step
            const near = rd && rd.toNode < 3;
            if (near) { nodeMax = Math.max(nodeMax, st.speed); if (!wasNear) nodes++; }
            wasNear = !!near;
            // a corner the assist is easing him through: never over its cap by more than braking can shed
            const capped = rd && rd.cap !== undefined && rd.cap < 60;
            if (capped && rd.corner) { cornerMax = Math.max(cornerMax, st.speed); if (!wasCorner) corners++; }
            if (capped && rd.corner && st.speed > rd.cap + 3) cornerOver++;
            wasCorner = !!(capped && rd.corner);
          }
          const n = L.hwyNearest(st.x, st.z);
          if (grid.size > 6 && !L.car.onStreet && n && Math.abs(n.lateral) < L.highway.halfW) { home = true; break; }
        }
        const b = fl();
        out.loops.push({ city: k, way, home, secs: Math.round(f / 60), streets: grid.size, burnPct: Math.round(100 * burn / Math.max(1, f)),
          streetMax: Math.round(streetMax), corners, cornerMax: Math.round(cornerMax), cornerOver,
          nodes, nodeMax: +nodeMax.toFixed(1), fastPct: Math.round(100 * fast / Math.max(1, onGrid)),
          crashes: b.c - f0.c, walls: b.w - f0.w, cityTouches: b.t - f0.t, hwyTouches: b.h - f0.h });
      }
      // a full right held through a New York junction, booster burning all the way
      {
        L.api.setVehicle("corvette"); L.api.spawnAt(0, 0); for (let i = 0; i < 20; i++) L.update(1 / 60);
        L.spdReset();
        const C = L.streets.cities.ny;
        const hero = L.ROUTE_LANDMARKS.find(l => l.name === "skyline");
        const nd = C.nodes.filter(q => q.signal).sort((a, b) => Math.hypot(a.x - hero.x, a.z - hero.z) - Math.hypot(b.x - hero.x, b.z - hero.z))[0];
        const arm = nd.arms.find(a => Math.abs(a.dz) > 0.9), r = arm.road, dir = arm.atStart ? -1 : 1, q = {};
        L.stPointAt(r, dir > 0 ? r.len - 160 : 160, dir, r.lo, q);
        st.x = q.x; st.z = q.z; st.y = L.stSurfaceAt(q.x, q.z); st.heading = Math.atan2(-q.fx, -q.fz); st.speed = 0;
        L.car.yield = 1; L.car.steer = 0; L.stPlan.road = r; L.stPlan.dir = dir; L.stPlan.turn = null;
        if (L.stTraffic && L.stTraffic.list) L.stTraffic.list.forEach(v => { v.alive = false; v.respawn = 1e9; });
        const f0 = fl(), h0 = st.heading, street0 = r.id;
        let vMax = 0, vAtNode = null, dNode = 1e9, burn = 0, f = 0;
        const full = 1 * L.CAR.dragRangeX * innerWidth / (L.TUNE.dragRangeX * Math.min(innerWidth, innerHeight));
        for (; f < 60 * 9; f++) {
          frame(full, 0.8); if (L.cv.on) burn++;
          vMax = Math.max(vMax, st.speed);
          const d = Math.hypot(st.x - nd.x, st.z - nd.z);
          if (d < dNode) { dNode = d; vAtNode = +st.speed.toFixed(1); }   // his speed where he passes closest to the junction's middle
        }
        for (let i = 0; i < 60 * 3; i++) frame(0, 0.8);
        const dh = Math.atan2(Math.sin(st.heading - h0), Math.cos(st.heading - h0)), b = fl();
        out.turn = { vMax: Math.round(vMax), vAtNode, dNode: +dNode.toFixed(1), right: dh < -1.0, dh: +dh.toFixed(2), newStreet: L.car.onStreet && L.stPlan.road && L.stPlan.road.id !== street0,
                     burnPct: Math.round(100 * burn / f), crashes: b.c - f0.c, walls: b.w - f0.w, touches: b.t - f0.t };
      }
      L.api.clearStick(); L.spdReset(); L.noRender = false;
      out.boost = +L.cvSpeed().toFixed(1); out.stepV = +(L.CAR.cruise * L.spdStepsFor("corvette")[2]).toFixed(1);
      return out;
    });
    const badL = city.loops.filter(r => !r.home || r.crashes || r.walls || r.cityTouches || r.hwyTouches || r.burnPct < 90 || r.cornerOver > 6 || !r.corners || r.cornerMax > city.boost * 0.5 ||
                                       r.streetMax < city.stepV * 1.25 || r.fastPct < 15 || !r.nodes || r.nodeMax > city.stepV + 1);
    check(`corvette: fast is still safe in the cities -- booster held, hands-off from each city's ways in he loops through the streets and back out (${city.loops.map(r => `${r.city}${r.way === "CityInFar" ? " far" : ""} ${r.secs}s ${r.streets} streets, up to ${r.streetMax} m/s, over his step ${r.fastPct}% of the time, ${r.nodes} junctions at most ${r.nodeMax}, ${r.corners} corners at most ${r.cornerMax}`).join("; ")}) with no crash, no wall and no touch of any traffic -- burning all the way, a real boost along the streets (over 1.25 times his step's ${city.stepV} m/s) shed for every junction (never over his step's speed at one), the corner assist shedding speed for every corner as for the car`,
      city.loops.length === 4 && badL.length === 0, J(badL.length ? badL : city.loops));
    const t = city.turn || {};
    check(`corvette: a full right held through a New York junction with the booster burning turns him on to the cross street -- ${t.vAtNode} m/s at the junction against the booster's ${city.boost} -- no bang`,
      t.right && t.newStreet && t.vAtNode !== null && t.vAtNode < city.boost * 0.4 && t.burnPct > 90 && !t.crashes && !t.walls && !t.touches, J(t));

    // ---- h2. (v160) a way in held with the booster burning: at his own step's speed, as the car
    const wayIn = await page.evaluate(() => {
      const L = window.__lp, st = L.state, out = [];
      L.noRender = true;
      const full = 1 * L.CAR.dragRangeX * innerWidth / (L.TUNE.dragRangeX * Math.min(innerWidth, innerHeight));
      for (const k of [0, 2, 4]) {
        L.api.setVehicle("corvette"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
        L.spdReset(); st.speedStep = k; if (L.policeStop) L.policeStop(false);
        const g = L.streets.cities.ny.ramps.inFar.gantry, c = g.c, s0 = g.s - c * 800;
        const q = L.hwySampleAt(s0), lat = c * (L.HW.medianW / 2 + L.HW.laneW * 0.5);
        st.x = q.x - q.fz * lat; st.z = q.z + q.fx * lat; st.y = q.y; st.heading = Math.atan2(-q.fx * c, -q.fz * c);
        st.speed = L.CAR.cruise; st.exploding = false;
        L.car.yield = 1; L.car.steer = 0; L.car.onSpurRoad = false; L.car.spurRec = null; L.stPlan.road = null; L.stPlan.turn = null;
        for (const t of L.highway.traffic) if (t.alive && Math.abs(t.s - s0) < 300) { t.alive = false; t.respawn = 3; }
        const c0 = (L.flags.carCrashes || 0) + (L.flags.wallHits || 0) + (L.flags.hwyTrafficHit || 0);
        const stepV = L.CAR.cruise * L.spdStepsFor("corvette")[k];
        let vBefore = 0, vSpur = null, spurMax = 0, off = 0, city = false, f = 0, burn = 0;
        for (; f < 60 * 40 && !city; f++) {
          const along = (L.hwyNearest(st.x, st.z).s - g.s) * c, holding = along > -260 && vSpur === null || (vSpur !== null && !L.car.onStreet);
          L.api.setStick(holding ? full : 0, 0.8); L.update(1 / 60);
          if (L.cv.on) burn++;
          if (!holding) vBefore = Math.max(vBefore, st.speed);
          if (L.car.spurRec && vSpur === null) vSpur = +st.speed.toFixed(1);
          if (vSpur !== null && !L.car.onStreet) spurMax = Math.max(spurMax, st.speed);
          if (L.car.offRoad > 0.6) off++;
          city = !!L.car.onStreet;
        }
        out.push({ step: k, stepV: +stepV.toFixed(1), vBefore: Math.round(vBefore), vSpur, spurMax: +spurMax.toFixed(1), city, off, secs: Math.round(f / 60),
                   burnPct: Math.round(100 * burn / f), bangs: (L.flags.carCrashes || 0) + (L.flags.wallHits || 0) + (L.flags.hwyTrafficHit || 0) - c0 });
      }
      L.api.clearStick(); L.spdReset(); L.noRender = false;
      return out;
    });
    const badW = wayIn.filter(r => !r.city || r.off || r.bangs || r.vSpur === null || r.vSpur > r.stepV + 1 || r.spurMax > r.stepV + 1 || r.vBefore < 120 || r.burnPct < 90);
    check(`corvette: a way in held with the booster burning -- from 128 m/s on the motorway a full right held for New York's far way in brings him on to its ramp at his own step's speed, as the car (${wayIn.map(r => `step ${r.step}: ${r.vBefore} m/s, then ${r.vSpur} on the ramp against ${r.stepV}`).join("; ")}), into the city, never off the road, no bang`,
      wayIn.length === 3 && badW.length === 0, J(wayIn));

    // ---- i. off the road: a building, mid-block, booster burning
    const crash = await page.evaluate(() => {
      const L = window.__lp, S = L.state, out = {};
      L.noRender = true;
      L.api.setVehicle("corvette"); L.api.spawnAt(0, 0); for (let i = 0; i < 20; i++) L.update(1 / 60);
      const C = L.streets.cities.ny, q2 = {};
      const rr = C.roads.filter(x => x.kind === "grid" && x.len > 80).sort((a1, b1) => a1.id - b1.id)[0];
      L.stPointAt(rr, rr.len / 2, 1, rr.lo, q2);
      let tb = null, td = 1e9;
      L.forEachSolid(o => { if (o.mesh && o.mesh.isCityProxy) { const d = Math.hypot(o.x - q2.x, o.z - q2.z); if (d < td) { td = d; tb = o; } } });
      S.x = q2.x; S.z = q2.z; S.y = L.stSurfaceAt(q2.x, q2.z); S.heading = Math.atan2(-(tb.x - q2.x), -(tb.z - q2.z)); S.speed = L.CAR.cruise;
      L.car.rejoin = null; L.car.rejoinT = 0; L.car.rejoinPts = null;
      L.api.clearStick(); for (let i = 0; i < 3; i++) L.update(1 / 60);
      const c0 = L.flags.carCrashes || 0, hits0 = { ...(L.flags.solidHits || {}) };
      let at = null, burnAtHit = null, was = false;
      for (let i = 0; i < 60 * 6 && !at; i++) { was = L.cv.on; L.api.setStick(0, 0.8); L.update(1 / 60); if (S.exploding) { at = [S.x, S.z]; burnAtHit = was; } }
      L.update(1 / 60);   // a frame in pieces
      out.fxInBang = L.cv.fx.visible && L.vehicleModel.visible; out.roarInBang = L.cv.k > 0 && L.cv.on;
      for (let i = 0; i < 60 * 8 && S.exploding; i++) { L.api.clearStick(); L.update(1 / 60); }
      for (let i = 0; i < 60; i++) { L.api.clearStick(); L.update(1 / 60); }
      out.bangs = (L.flags.carCrashes || 0) - c0;
      out.hit = Object.entries(L.flags.solidHits || {}).filter(([k, v]) => v > (hits0[k] || 0)).map(([k]) => k);
      out.backDist = at ? +Math.hypot(S.x - at[0], S.z - at[1]).toFixed(1) : null;
      out.backOn = L.car.onStreet && L.stPlan.road ? L.stPlan.road.id : null; out.street = rr.id;
      out.burnAtHit = burnAtHit; out.exploding = !!S.exploding;
      L.noRender = false;
      return out;
    });
    check("corvette: off the road it bangs as every car does -- pointed at a building mid-block with the booster burning, one bang (the building's), the flames out in it, and back free on that street, where it happened",
      crash.bangs === 1 && J(crash.hit) === J(["corvette:building:crash"]) && crash.burnAtHit === true && !crash.fxInBang && !crash.roarInBang && !crash.exploding && crash.backDist !== null && crash.backDist < 40 && crash.backOn === crash.street, J(crash));

    // ---- j. leaving it
    const leave = await page.evaluate(() => {
      const L = window.__lp, S = L.state;
      L.api.setVehicle("corvette"); L.api.spawnAt(0, 0); L.api.setView(true); for (let i = 0; i < 20; i++) L.update(1 / 60);
      for (let i = 0; i < 60 * 3; i++) { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0.8; L.update(1 / 60); }
      const was = { on: L.cv.on, fx: L.cv.fx.visible };
      L.api.setVehicle("cybertruck"); L.api.spawnAt(0, 0); L.api.clearStick();
      for (let i = 0; i < 60 * 2; i++) { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60); }
      const r = { was, on: L.cv.on, k: L.cv.k, fx: L.cv.fx.visible, sparks: L.cv.sparks.visible, mirror: !!(L.cv.mirror && L.cv.mirror.visible), camK: L.cvCamK(), fov: L.cvFov(), booster: L.vehBooster() };
      L.api.clearStick();
      return r;
    });
    check("corvette: leaving it mid-burn, nothing of it follows him -- in the next car no flames, no sparks, no mirror picture, no camera pull-back, no wider view, no booster",
      leave.was.on && leave.was.fx && !leave.on && leave.k === 0 && !leave.fx && !leave.sparks && !leave.mirror && leave.camK === 0 && leave.fov === 0 && !leave.booster, J(leave));

    check("corvette: no browser or frame errors", errors.length === 0, J(errors.slice(0, 5)));
  } finally { await ctx.close(); }
};
