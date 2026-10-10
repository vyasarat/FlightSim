"use strict";
// ---------------------------------------------------------------------------
// THE CYBERTRUCK (v146): a second body on the car, not a second car. Portrait.
//
//   a. the card: there, beside the car's, an icon only; picked through the real
//      picker (menu, card, direction), he is in it -- kind 'cybertruck', a car to
//      every question the road asks (vehIsCar, vp.car, the police may start);
//   b. the contract: a row of its own with every slot the car's row has;
//   c. it DRIVES AS THE CAR: the same inputs from the same spot on two fresh pages
//      -- motorway lane-keep, a speed step, a lane change, a release, then New
//      York's streets hands-off and a full right held through a junction on to
//      another street, then pointed mid-block at a building at cruise -- give
//      the car and
//      the Cybertruck the same path to the millimetre, the same one bang at the
//      same spot, and the same free rebuild where it happened;
//   d. the speed steps, the engine voice and the sound bed are the car's;
//   e. the model: the imported body, under 10k triangles, four wheels found, only
//      palette materials and NO texture anywhere (no lettering can ride in on one),
//      and the file carries its CC BY licence and author;
//   f. it sits on the road: each wheel's lowest point within 5 cm of the motorway
//      under it, stopped and driving, as the SUV's are;
//   g. the driving seat: body hidden, cabin up, and his eye sits in the cabin
//      exactly where it sits in the SUV's; the chase view: body shown, camera
//      behind and above, the truck in the portrait frame;
//   h. eject: a family of its own whose roof clears the measured body.
// On v145 there is no such card or vehicle: every check FAILs, none throws.
//
// Alone: node scripts/run_module.js cybertruck_checks
// ---------------------------------------------------------------------------

module.exports = async function cybertruckChecks({ newPage, check }) {
  const J = x => JSON.stringify(x);

  // ---- c. the twin run, each vehicle on a page of its own (same seed, same world)
  const runs = {};
  for (const key of ["car", "cybertruck"]) {
    let p = null;
    try {
      p = await newPage(820, 1180);
      runs[key] = await p.page.evaluate(module.exports.twinRun, key);
    } catch (e) { runs[key] = { err: String(e && e.message || e).slice(0, 200) }; }
    finally { if (p) await p.ctx.close(); }
  }
  {
    const a = runs.car, b = runs.cybertruck;
    const crashOk = r => r.crash && r.crash.bangs === 1 && J(r.crash.hit) === J(["building:crash"]) && r.crash.at && !r.crash.exploding && r.crash.backDist < 40 && r.crash.backOn === r.crash.street;
    const ok = a && b && !a.err && !b.err && b.kind === "cybertruck" && a.kind === "car" && a.path.length > 40 &&
      J(a.path) === J(b.path) && a.bangs === 1 && b.bangs === 1 && a.turned.ok && b.turned.ok &&
      crashOk(a) && crashOk(b) && J(a.crash) === J(b.crash);
    let firstDiff = null;
    if (a && b && a.path && b.path) for (let i = 0; i < Math.max(a.path.length, b.path.length); i++) if (J(a.path[i]) !== J(b.path[i])) { firstDiff = { i, car: a.path[i], cyber: b.path[i] }; break; }
    check("cybertruck: drives AS the car -- the same inputs on two fresh pages (motorway lane-keep, a speed step, a lane change, a release, New York hands-off, a full right held through a junction on to another street, then pointed mid-block at a building at cruise) give the same path to the millimetre; the only bang is the building's, at the same spot, and both come back free on that street, where it happened",
      ok, J({ car: a && { err: a.err, kind: a.kind, n: a.path && a.path.length, bangs: a.bangs, turned: a.turned, crash: a.crash },
              cyber: b && { err: b.err, kind: b.kind, n: b.path && b.path.length, bangs: b.bangs, turned: b.turned, crash: b.crash }, firstDiff }));
  }

  const { page, ctx } = await newPage(820, 1180);
  try {
    // ---- a. the card, through the real picker
    const card = await page.evaluate(() => {
      const sv = document.getElementById("screenVehicle");
      const was = sv.classList.contains("hiddenS");
      sv.classList.remove("hiddenS");
      const c = document.querySelector('.vehCard[data-v="cybertruck"]');
      const out = { exists: !!c };
      if (c) {
        const r = c.getBoundingClientRect();
        out.visible = !c.classList.contains("hiddenS") && r.width > 100 && r.height > 100;
        out.text = c.textContent.trim();
        out.words = [c, ...c.querySelectorAll("*")].filter(e => ["aria-label", "title", "alt"].some(a => e.hasAttribute(a))).map(e => e.tagName);
        out.svgText = c.querySelectorAll("text, tspan, foreignObject").length;
        out.icon = !!c.querySelector("svg path, svg rect, svg circle");
        const prev = c.previousElementSibling;
        out.afterCar = !!prev && prev.dataset.v === "car";
      }
      if (was) sv.classList.add("hiddenS");
      return out;
    });
    let tapped = null;
    try {
      await page.evaluate(() => { const L = window.__lp; L.api.setThrottle(false); L.api.clearStick(); L.api.skipScreens(); for (let i = 0; i < 5; i++) L.update(1 / 60); });
      await page.click("#menuBtn", { timeout: 5000 });
      await page.click('.vehCard[data-v="cybertruck"]', { timeout: 5000 });
      await page.click('[data-d="0"]', { timeout: 5000 });
      tapped = true;
    } catch (e) { tapped = String(e && e.message || e).slice(0, 160); }
    const picked = await page.evaluate(() => {
      const L = window.__lp, S = L.state;
      for (let i = 0; i < 30; i++) { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60); }
      return { key: S.vehicleKey, kind: L.vehKind(), isCar: L.vehIsCar(), vpCar: !!S.vp.car, police: L.policeCan(), sp: +S.speed.toFixed(1) };
    });
    check("cybertruck: a card beside the car's, an icon only (no text, no label words); picked through the real picker he is in it, and to the road it is a car (vehIsCar, the police may start)",
      card.exists && card.visible && card.afterCar && card.text === "" && card.words.length === 0 && card.svgText === 0 && card.icon &&
      tapped === true && picked.key === "cybertruck" && picked.kind === "cybertruck" && picked.isCar && picked.vpCar && picked.police && picked.sp > 0,
      J({ card, tapped, picked }));

    // ---- b, d, h: the contract row, the steps and voices, the eject family
    const rows = await page.evaluate(async () => {
      const L = window.__lp, C = L.VEHICLE_CONTRACT, T = L.TUNE;
      // the licence travels inside the file the game loads (asset.extras)
      let licence = null;
      try {
        const b = await (await fetch(T.models.cybertruck.file)).arrayBuffer();
        const n = new DataView(b).getUint32(12, true);
        const a = JSON.parse(new TextDecoder().decode(new Uint8Array(b, 20, n))).asset || {};
        licence = a.extras ? { author: a.extras.author, license: a.extras.license } : null;
      } catch (e) { licence = String(e); }
      const carSlots = Object.keys(C.car).sort(), ctSlots = Object.keys(C.cybertruck || {}).sort();
      const fam = T.eject.families.cybertruck;
      return {
        carSlots, ctSlots, carLike: !!(C.cybertruck && C.cybertruck.carLike), solidClass: C.cybertruck && C.cybertruck.solidClass === C.car.solidClass,
        solidR: T.solid.r.cybertruck === T.solid.r.car, crawl: T.solid.crawl.cybertruck === T.solid.crawl.car,
        steps: L.spdStepsFor("cybertruck") === T.car.speedSteps, eng: engKeyFor(), bed: currentBedName(),
        family: ejectFamily(), fam: fam ? { roof: fam.roof, seat: fam.seat } : null, licence,
      };
    });
    check("cybertruck: a row of its own in the vehicle contract with every slot the car's has (carLike), the car's solid class, radius and crawl; the car's speed steps, engine voice and sound bed",
      rows.ctSlots.length > 0 && rows.carSlots.every(k => rows.ctSlots.includes(k)) && rows.carLike && rows.solidClass && rows.solidR && rows.crawl &&
      rows.steps && rows.eng === "car" && rows.bed === "car", J(rows));

    // ---- e, f, g: the model, how it sits, the two views
    await page.waitForFunction(() => window.__lp.modelState.cybertruck === "ready" && window.__lp.modelState.car === "ready", null, { timeout: 60000 }).catch(() => {});
    const look = await page.evaluate(module.exports.lookAt);
    const car = look.car || {}, ct = look.cybertruck || {};
    check("cybertruck: the imported body (under 10k triangles), four wheels found, only palette materials and no texture on any of them; the file carries its CC BY licence and author",
      !look.err && rows.licence && /^CC-BY-4\.0/.test(rows.licence.license || "") && /Lexyc16/.test(rows.licence.author || "") && ct.imported === "cybertruck" && ct.tris > 1000 && ct.tris < 10000 && ct.wheels === 4 && ct.textures === 0 &&
      ct.mats.length > 0 && ct.mats.every(m => ["body", "tint", "trim", "lamp", "tail", "tyre", "rim"].includes(m)), J({ err: look.err, ct, licence: rows.licence }));
    const sits = g => Array.isArray(g) && g.length === 4 && g.every(d => Math.abs(d) <= 0.05);
    check("cybertruck: sits on the road -- each wheel's lowest point within 5 cm of the motorway under it, stopped and driving, as the SUV's are",
      !look.err && sits(ct.restGap) && sits(ct.driveGap) && sits(car.restGap) && sits(car.driveGap), J({ ct: [ct.restGap, ct.driveGap], car: [car.restGap, car.driveGap] }));
    check("cybertruck: the driving seat -- body hidden, the cabin up, and his eye in the cabin exactly where it is in the SUV (within 2 cm), higher off the road; and while its body is still loading, the SUV stand-in's seat exactly",
      !look.err && ct.seat && car.seat && !ct.seat.bodyShown && ct.seat.cabin && Math.abs(ct.seat.eyeInCabin - car.seat.eyeInCabin) <= 0.02 && ct.seat.eyeOverRoad > car.seat.eyeOverRoad &&
      ct.seat.standIn !== null && ct.seat.standIn === car.seat.standIn,
      J({ ct: ct.seat, car: car.seat }));
    check("cybertruck: the chase view -- body shown, the camera behind and above, the truck in the portrait frame and a good size",
      !look.err && ct.chase && ct.chase.bodyShown && ct.chase.behind < -5 && ct.chase.above > 1 && ct.chase.inFrame && ct.chase.hFrac > 0.08,
      J(ct.chase));
    check("cybertruck: eject -- its own family, and its roof clears the measured body from the model's origin",
      rows.family === "cybertruck" && rows.fam && typeof ct.topOverOrigin === "number" && rows.fam.roof - ct.topOverOrigin > 0.05 && rows.fam.roof - ct.topOverOrigin < 0.4,
      J({ fam: rows.fam, topOverOrigin: ct.topOverOrigin }));
  } finally { await ctx.close(); }
};

// Runs in the page. One vehicle, one fixed script of inputs; the path it drives.
module.exports.twinRun = function (key) {
  const L = window.__lp, S = L.state;
  let bangs = 0, was = false;
  const path = [];
  let f = 0;
  const step = (n, steer, touching) => {
    for (let i = 0; i < n; i++) {
      S.touching = touching !== false; S.touchIsPoint = false; S.ctrlBank = steer || 0; S.ctrlPitch = 0;
      L.update(1 / 60);
      if (S.exploding && !was) bangs++;
      was = !!S.exploding;
      if ((f++ % 30) === 0) path.push([+S.x.toFixed(3), +S.z.toFixed(3), +S.y.toFixed(3), +S.speed.toFixed(3), +S.heading.toFixed(4)]);
    }
  };
  L.api.setVehicle(key); L.api.spawnAt(0, 0); L.api.clearStick();
  for (let i = 0; i < 30; i++) L.update(1 / 60);
  // the motorway: hands-on lane-keep, a step faster, a light lane change, a release
  step(60 * 8, 0);
  L.spdNudge(1);
  step(60 * 6, 0);
  step(90, 0.5);
  step(60 * 5, 0);
  step(60 * 3, 0, false);
  // New York: a signalled junction's stop line, hands-off, then a full right held through the next
  const C = L.streets.cities.ny;
  const hero = L.ROUTE_LANDMARKS.find(l => l.name === "skyline");
  const n = C.nodes.filter(q => q.signal).sort((a, b) => Math.hypot(a.x - hero.x, a.z - hero.z) - Math.hypot(b.x - hero.x, b.z - hero.z))[0];
  const arm = n.arms.find(a => Math.abs(a.dz) > 0.9), r = arm.road, dir = arm.atStart ? -1 : 1, q = {};
  L.stPointAt(r, dir > 0 ? r.len - 60 : 60, dir, r.lo, q);
  S.x = q.x; S.z = q.z; S.y = L.stSurfaceAt(q.x, q.z); S.heading = Math.atan2(-q.fx, -q.fz); S.speed = 0;
  L.spdReset(); L.api.clearStick();
  // deterministic from here (v153): the two pages are fresh, and what the city's traffic drew
  // while each one loaded is a race between them -- so the city's cars are taken off and the
  // stream is set, the same on both, for the streets and the bang. (It passed alone every time
  // and failed one full run in a few, 0.5 m apart in New York.)
  const Rnd = Math.random; let seed = 29; Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  try {
  if (L.stTraffic && L.stTraffic.list) L.stTraffic.list.forEach(v => { v.alive = false; v.respawn = 1e9; });
  for (let i = 0; i < 10; i++) L.update(1 / 60);
  step(60 * 6, 0);
  const h0 = S.heading, street0 = L.car.onStreet && L.stPlan.road ? L.stPlan.road.id : null;
  step(60 * 5, 1);
  step(60 * 6, 0);
  // a RIGHT turn (a drag right turns the heading down), off one street and on to another
  const dh = Math.atan2(Math.sin(S.heading - h0), Math.cos(S.heading - h0));
  const street1 = L.car.onStreet && L.stPlan.road ? L.stPlan.road.id : null;
  const turned = { onStreet: street0 !== null, right: dh < -1.0, newStreet: street1 !== null && street1 !== street0, dh: +dh.toFixed(3), street0, street1 };
  turned.ok = turned.onStreet && turned.right && turned.newStreet;

  // ---- the bang: mid-block on a New York street, pointed at the building beside
  // it at cruise, the finger held -- "point at a building halfway along a block
  // and nothing saves him". The same contact, the same free rebuild, back on that
  // street where it happened.
  const crash = { bangs: 0 };
  {
    // a mid-block point, and the city building nearest it, asked of the registry
    const q2 = {};
    const rr = C.roads.filter(x => x.kind === "grid" && x.len > 80).sort((a1, b1) => a1.id - b1.id)[0];
    L.stPointAt(rr, rr.len / 2, 1, rr.lo, q2);
    let tb = null, td = 1e9;
    L.forEachSolid(o => { if (o.mesh && o.mesh.isCityProxy) { const d = Math.hypot(o.x - q2.x, o.z - q2.z); if (d < td) { td = d; tb = o; } } });
    if (!tb) return { kind: L.vehKind(), path, bangs, turned, crash: { none: true } };
    // pointed at it from the street, at cruise, the finger held and centred
    S.x = q2.x; S.z = q2.z; S.y = L.stSurfaceAt(q2.x, q2.z); S.heading = Math.atan2(-(tb.x - q2.x), -(tb.z - q2.z)); S.speed = L.CAR.cruise;
    L.api.clearStick(); for (let i = 0; i < 3; i++) L.update(1 / 60);
    crash.street = rr.id;
    const bangs0 = bangs, hits0 = { ...(L.flags.solidHits || {}) };
    let at = null;
    for (let i = 0; i < 60 * 6 && !at; i++) { step(1, 0); if (S.exploding) at = [+S.x.toFixed(3), +S.z.toFixed(3)]; }
    for (let i = 0; i < 60 * 8 && S.exploding; i++) step(1, 0, false);
    step(60, 0, false);
    crash.bangs = bangs - bangs0; crash.at = at; crash.back = [+S.x.toFixed(3), +S.z.toFixed(3), +S.y.toFixed(3)];
    crash.backDist = at ? +Math.hypot(S.x - at[0], S.z - at[1]).toFixed(2) : null; crash.exploding = !!S.exploding;
    crash.backOn = L.car.onStreet && L.stPlan.road ? L.stPlan.road.id : null;
    crash.hit = Object.entries(L.flags.solidHits || {}).filter(([k, v]) => v > (hits0[k] || 0)).map(([k]) => k.split(":").slice(1).join(":"));   // "<vehicle>:<kind>:crash", the vehicle dropped so the two compare
  }
  return { kind: L.vehKind(), path, bangs, turned, crash };
  } finally { Math.random = Rnd; }
};

// Runs in the page. For the SUV and the Cybertruck: the body, how it sits, both views.
module.exports.lookAt = function () {
  const L = window.__lp, S = L.state, T = L.TUNE;
  const out = {};
  // Vertex by vertex. Box3.setFromObject's `precise` flag is ignored by this
  // three.js build: it boxes each mesh's own box, so a wheel turned half a radian
  // reads a third of its radius under the road it is standing on.
  const span = (o) => {
    o.updateWorldMatrix(true, true);
    let min = 1e9, max = -1e9, sx = 0, sz = 0, n = 0;
    const v = new THREE.Vector3();
    o.traverse(c => {
      if (!c.isMesh || !c.geometry || !c.geometry.attributes.position) return;
      const p = c.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(c.matrixWorld); min = Math.min(min, v.y); max = Math.max(max, v.y); sx += v.x; sz += v.z; n++; }
    });
    return { min, max, x: sx / n, z: sz / n };
  };
  const lowest = () => span(L.vehicleModel);
  // Each wheel's lowest vertex against the motorway's surface under THAT wheel.
  // Not against state.y: the body pitches with the grade about its centre, so on
  // a 2% slope the ends of an 11 m truck stand 0.1 m either side of it.
  const wheelGaps = () => {
    const m = L.vehicleModel; m.updateWorldMatrix(true, true);
    const gaps = [];
    m.traverse(w => {
      if (!/^wheel_/.test(w.name)) return;
      const b = span(w);
      gaps.push(+(b.min - L.hwyNearest(b.x, b.z).y).toFixed(3));
    });
    return gaps;
  };
  try {
    for (const key of ["car", "cybertruck"]) {
      const o = out[key] = {};
      L.api.setVehicle(key); L.api.spawnAt(0, 0); L.api.clearStick();
      L.api.setView(true);
      for (let i = 0; i < 60 * 3; i++) { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60); }
      o.driveGap = wheelGaps();
      L.api.clearStick();
      for (let i = 0; i < 60 * 4; i++) { S.touching = false; L.update(1 / 60); S.speed = Math.max(0, S.speed - 1); }
      S.speed = 0; for (let i = 0; i < 20; i++) L.update(1 / 60);
      const lo = lowest();
      o.restGap = wheelGaps();
      // the model's origin is gearHeight - wheelDrop under its lowest point (models.js)
      o.topOverOrigin = +(lo.max - S.y + (T.gearHeight - 0.6)).toFixed(3);
      const m = L.vehicleModel;
      o.imported = m.userData.imported || null;
      let tris = 0, wheels = 0, textures = 0; const mats = new Set();
      m.traverse(c => {
        if (/^wheel_/.test(c.name)) wheels++;
        if (!c.isMesh) return;
        const g = c.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
        for (const mt of (Array.isArray(c.material) ? c.material : [c.material])) {
          mats.add(mt.name);
          for (const k of ["map", "normalMap", "emissiveMap", "roughnessMap", "metalnessMap", "aoMap", "alphaMap", "bumpMap"]) if (mt[k]) textures++;
        }
      });
      Object.assign(o, { tris: Math.round(tris), wheels, textures, mats: [...mats] });
      // the chase view
      L.update(1 / 60);
      const cam = L.camera, fx = -Math.sin(S.heading), fz = -Math.cos(S.heading);
      cam.updateMatrixWorld(); cam.updateProjectionMatrix();
      const box = span(m), c = new THREE.Vector3(box.x, (box.min + box.max) / 2, box.z);
      const top = new THREE.Vector3(c.x, box.max, c.z).project(cam), bot = new THREE.Vector3(c.x, box.min, c.z).project(cam), mid = c.clone().project(cam);
      o.chase = { bodyShown: m.visible, behind: +((cam.position.x - S.x) * fx + (cam.position.z - S.z) * fz).toFixed(2), above: +(cam.position.y - S.y).toFixed(2),
        inFrame: Math.abs(mid.x) < 0.9 && Math.abs(mid.y) < 0.9 && mid.z < 1, hFrac: +((top.y - bot.y) / 2).toFixed(3) };
      // the driving seat
      L.api.setView(false);
      for (let i = 0; i < 5; i++) L.update(1 / 60);
      const cab = L.car.cabin;
      o.seat = { bodyShown: m.visible, cabin: !!(cab && cab.visible), eyeInCabin: cab ? +(cam.position.y - cab.position.y).toFixed(3) : null, eyeOverRoad: +(cam.position.y - S.y).toFixed(3) };
      // before its own body arrives he sits in the SUV's built stand-in: no cabin lift
      { const ud = m.userData, imp = ud.imported, h = ud.height; ud.imported = undefined; ud.height = undefined;
        L.update(1 / 60); o.seat.standIn = cab ? +(cam.position.y - cab.position.y).toFixed(3) : null; ud.imported = imp; ud.height = h; }
      L.api.setView(true);
    }
  } catch (e) { out.err = String(e && e.stack || e).slice(0, 300); }
  return out;
};
