"use strict";
// ---------------------------------------------------------------------------
// THE POWER-UPS (v187). "Racing is just circling the track" -- something happens every few
// seconds now. Portrait, iPad (and a phone for the button).
//
//   a. THE BOXES: every track has its rows of glowing boxes across the road, spread round the
//      lap, none on a jump, a shortcut's approach, a pad or the grid;
//   b. AIMED, NOT TIMED: alone, he drives through a box's lane and holds an item -- the one big
//      item button comes up showing its picture; through the gap between two boxes he gets
//      nothing; a REAL tap on the button (while another finger holds the stick, which keeps
//      steering) uses it and the button goes; no two buttons in a slot, nothing over it, no
//      control under it, no text, in portrait and landscape and on a phone;
//   c. EACH ITEM DOES WHAT IT SAYS, the same for every car: the rocket boost puts him past his
//      speed; the bubble shield takes one hit and goes; the bouncing ball finds the car ahead
//      and spins it out; the oil slick spins out the car that drives into it; GIANT MODE makes
//      him huge for about 6 s and a car he meets bounces off him while he keeps his speed;
//   d. A SPIN-OUT IS SHORT AND NEVER A BANG: about a second, dramatic (a whole turn of the
//      body), no bang, never stuck, never off the road, his line kept, his speed back;
//  e2. ONE FOOTPRINT: every car, the monster truck too, takes a box over the same width across the road;
//   e. IT STAYS CLOSE: further back gets better items -- never a giant at the front, the boost,
//      giant and ball from the back far more often;
//   f. THE NOISY HAND AND RANDOM TAPS PLAY A WHOLE RACE on every track: finished, no bang, never
//      stuck more than 2 s; the rivals used items, some on him; and something HAPPENS to him
//      (a box, an item, a hit, a pad, a jump, a shortcut) every 5-10 s on average;
//   g. NOTHING LEFT BEHIND: out of a race (EXIT, again) no ball, slick, bubble or giant remains,
//      and the button is down.
//   h. (v190) A BOX ROUND THE CAMERA is not drawn: from inside one the screen was a yellow slab.
//   i. (v196) A BOOST BURNS OUT OF THE BODY: the monster truck's flames are born at least 0.3 of its height up.
//
// Alone: node scripts/run_module.js race_item_checks
// ---------------------------------------------------------------------------
const { oneRace } = require("./race_drive");

module.exports = async function raceItemChecks({ newPage, check }) {
  const J = x => JSON.stringify(x);
  const { page } = await newPage(820, 1180);
  await page.waitForFunction(() => window.__lp && window.__lp.race && window.__lp.race.built, null, { timeout: 60000 }).catch(() => {});
  const tracks = await page.evaluate(() => window.__lp.RC.tracks.map(t => t.id));

  // ---- a. the boxes
  const a = await page.evaluate((tracks) => {
    const L = window.__lp, R = L.race, RC = L.RC, I = RC.items, out = {};
    for (const id of tracks) {
      L.rcStartRace(id, 1); L.update(1 / 60);
      const T = R.track, rows = R.it.rows, len = T.len;
      const ss = rows.map(r => r.s).sort((x, y) => x - y);
      let gapMax = 0;
      for (let k = 0; k < ss.length; k++) gapMax = Math.max(gapMax, ((ss[(k + 1) % ss.length] - ss[k]) % len + len) % len || len);
      const bad = [];
      for (const r of rows) {
        const q = L.rcAt(r.s);
        if (q.dune) bad.push(Math.round(r.s) + ":dune");
        if (r.s < I.clearGrid || r.s > len - I.clearGrid) bad.push(Math.round(r.s) + ":grid");
        for (const p of R.pads) if (Math.abs(((p.s - r.s) % len + len * 1.5) % len - len / 2) < I.clearPad) bad.push(Math.round(r.s) + ":pad");
        for (const sc of T.sc || []) { const d = ((sc.sa + sc.gore - r.s) % len + len) % len; if (d < sc.hold + I.clearSc || d > len - I.clearSc) bad.push(Math.round(r.s) + ":shortcut"); }
        if (r.boxes.length !== I.lats.length) bad.push(Math.round(r.s) + ":boxes " + r.boxes.length);
      }
      const shown = R.it.boxMesh && R.it.boxMesh.count;
      out[id] = { rows: rows.length, len: Math.round(len), gapMax: Math.round(gapMax), bad, shown };
    }
    L.raceReset();
    return out;
  }, tracks);
  check(`race items: every track has its rows of boxes, spread round the lap and clear of jumps, shortcuts, pads and the grid -- ${Object.entries(a).map(([k, v]) => `${k} ${v.rows} rows, the longest gap ${v.gapMax} m of ${v.len}${v.bad.length ? " BAD " + v.bad.join(",") : ""}`).join("; ")}`,
    Object.values(a).every(v => v.rows >= 5 && v.gapMax <= 1.6 * v.len / v.rows && !v.bad.length && v.shown >= v.rows * 3), J(a));

  // ---- b. aimed, not timed: a box's lane and the gap between two; the button, by real touch
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts });
  const bRun = async (w, h) => {
    await page.setViewportSize({ width: w, height: h });
    const pre = await page.evaluate(() => {
      const L = window.__lp, R = L.race, st = L.state;
      if (st.vehicleKey !== "car") { L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60); }
      L.rcStartRace("oval", 3);
      for (const r of R.racers) if (!r.isHim) { r.s -= 2000; }       // (alone: the field a long way back)
      const him = R.him, row = R.it.rows[0], gapLat = (L.RC.items.lats[0] + L.RC.items.lats[1]) / 2;
      // through the gap first
      R.phase = "race"; R.raceT0 = R.t;
      him.s = row.s - 60; him.lat = gapLat; him.v = L.RC.v;
      for (let i = 0; i < 60 * 3; i++) { st.touching = true; st.ctrlBank = 0; st.ctrlPitch = 0; him.lat = gapLat; L.update(1 / 60); }
      const gap = { item: him.item, past: him.s > row.s };
      // then a box's lane, at the next row
      const row2 = R.it.rows[1], lane = row2.boxes[1].lat;
      him.s = row2.s - 60; him.lat = lane; him.latV = 0; him.v = L.RC.v;
      for (let i = 0; i < 60 * 3; i++) { st.touching = true; st.ctrlBank = 0; st.ctrlPitch = 0; L.update(1 / 60); }
      for (let i = 0; i < 60 * 1.5; i++) { st.touching = false; L.update(1 / 60); }    // (the shuffle settles)
      // (and a tap while the pictures shuffle is never lost: kept, and used as they settle)
      const keep = { item: him.item, used0: R.it.used };
      L.rcItGive(him, "boost"); him.itemShuf = L.RC.items.shuffle; L.raceItemUse();
      keep.during = R.it.used - keep.used0;
      for (let i = 0; i < 60; i++) { st.touching = true; L.update(1 / 60); }
      keep.after = R.it.used - keep.used0; keep.boost = him.itBoostT > 0 || keep.after > 0;
      L.rcItGive(him, keep.item); R.it.used = keep.used0;
      for (let i = 0; i < 2; i++) { st.touching = false; L.update(1 / 60); }   // (the button drawn for what he holds again)
      const b = document.getElementById("raceItemBtn"), rc = b.getBoundingClientRect(), cs = getComputedStyle(b);
      const shows = cs.display !== "none" && !b.classList.contains("hidden");
      const pic = b.dataset.item, item = him.item;
      // nothing under it: no visible control overlaps it
      const under = [];
      for (const o of document.querySelectorAll("button, .roundBtn")) {
        if (o === b || o.classList.contains("hidden") || getComputedStyle(o).display === "none" || getComputedStyle(o).visibility === "hidden") continue;
        const r2 = o.getBoundingClientRect();
        if (r2.width && r2.left < rc.right && r2.right > rc.left && r2.top < rc.bottom && r2.bottom > rc.top) under.push(o.id);
      }
      const text = [...document.querySelectorAll("#raceItemBtn, #raceHud")].map(e => e.innerText.trim()).join("");
      const at = document.elementFromPoint(innerWidth * 0.45, innerHeight * 0.4);
      const stickAt = at ? (at.id || at.tagName + "." + at.className) : null;
      return { keep, stickAt, gap, got: { item, pic, shows, size: Math.round(rc.width), pulse: cs.animationName, x: rc.left + rc.width / 2, y: rc.top + rc.height / 2 },
               clashes: L.btnSlotClashes(), obstructed: L.btnObstructions(), under, text, w: innerWidth, h: innerHeight };
    });
    // a finger holding the stick (drag left), then a second finger taps the item button
    const sx = pre.w * 0.45, sy = pre.h * 0.4;   // (off the hidden dashboard screen: in a race its tap still eats a finger -- queued, v188)
    await touch("touchStart", [{ x: sx, y: sy, id: 1 }]);
    await touch("touchMove", [{ x: sx - pre.w * 0.2, y: sy, id: 1 }]);
    const before = await page.evaluate(() => { const L = window.__lp; const t0 = L.state.touching; for (let i = 0; i < 30; i++) L.update(1 / 60); return { t0, lat: L.race.him.lat, bank: L.state.ctrlBank }; });
    await touch("touchStart", [{ x: sx - pre.w * 0.2, y: sy, id: 1 }, { x: pre.got.x, y: pre.got.y, id: 2 }]);
    const after = await page.evaluate(() => {
      const L = window.__lp, R = L.race;
      for (let i = 0; i < 30; i++) L.update(1 / 60);     // (both fingers down: the stick still his)
      const b = document.getElementById("raceItemBtn");
      return { lat: R.him.lat, bank: L.state.ctrlBank, touching: L.state.touching, item: R.him.item, used: R.it.used, hidden: b.classList.contains("hidden") || getComputedStyle(b).display === "none" };
    });
    await touch("touchEnd", []);
    await page.evaluate(() => { const L = window.__lp; for (let i = 0; i < 3; i++) L.update(1 / 60); L.state.touching = false; L.raceReset(); });
    return { pre, before, after };
  };
  for (const [w, h] of [[820, 1180], [1180, 820], [390, 844]]) {
    const b = await bRun(w, h);
    const ok = b.pre.gap.past && !b.pre.gap.item && b.pre.got.item && b.pre.got.pic === b.pre.got.item && b.pre.got.shows && b.pre.got.size >= 80 &&
      b.pre.got.pulse && b.pre.got.pulse !== "none" && !b.pre.clashes.length && !b.pre.obstructed.length && !b.pre.under.length && b.pre.text === "" &&
      b.pre.keep.during === 0 && b.pre.keep.after === 1 &&
      b.after.used >= 1 && !b.after.item && b.after.hidden && b.after.touching && b.after.lat > b.before.lat;
    check(`race items ${w}x${h}: aimed, not timed -- through the gap between two boxes he got ${b.pre.gap.item || "nothing"}; through a box ${b.pre.got.item} (the button shows ${b.pre.got.pic}, ${b.pre.got.size} px, pulsing); a real tap, with another finger on the stick, used it (the button went, the stick kept steering: ${b.before.lat.toFixed(1)} -> ${b.after.lat.toFixed(1)} m); no clash, nothing over it or under it (${b.pre.under.join(",") || "none"}), no text; a tap while the pictures shuffle was kept and used as they settled (${b.pre.keep.during} then ${b.pre.keep.after})`, ok, J(b));
  }

  // ---- c + d. each item does what it says, in every car; a spin-out is short and never a bang
  const cd = await page.evaluate(() => {
    const L = window.__lp, R = L.race, RC = L.RC, I = RC.items, st = L.state, out = {};
    const run = (n, fn) => { for (let i = 0; i < n; i++) { if (fn) fn(i); L.update(1 / 60); } };
    const hold = () => { st.touching = true; st.ctrlBank = 0; st.ctrlPitch = 0; };
    for (const veh of ["car", "cybertruck", "corvette", "monster"]) {
      L.api.setVehicle(veh); L.api.spawnAt(0, 0); run(10);
      const o = out[veh] = {};
      const fresh = () => {
        L.rcStartRace("oval", 5);
        R.phase = "race"; R.raceT0 = R.t;
        for (const r of R.racers) { r.s = -3000 - r.i * 50; r.lat = 0; r.v = 0; }
        const him = R.him; him.s = 300; him.lat = 0; him.v = RC.v * L.spdMul(); him.latV = 0;
        R.it.rows.forEach(rw => { rw.off = true; });       // (no box in the way of the test)
        return him;
      };
      const bangs0 = L.flags.carCrashes || 0;
      // boost
      let him = fresh(); run(60, hold);
      const v0 = him.v; L.rcItGive(him, "boost"); L.raceItemUse(); let vMax = 0; run(90, () => { hold(); vMax = Math.max(vMax, him.v); });
      o.boost = +(vMax / v0).toFixed(2);
      // ball: a car 70 m ahead in his lane spins out
      him = fresh(); const tgt = R.racers[1]; tgt.s = him.s + 70; tgt.lat = 0; tgt.v = him.v;
      run(30, () => { hold(); tgt.v = him.v; });
      L.rcItGive(him, "ball"); L.raceItemUse();
      let spun = 0, spinT = 0, tMin = 99, vMinT = 1e9, tgtV0 = tgt.v, latMax = 0;
      run(60 * 6, (i) => { hold(); if (tgt.spinT > 0) { spinT += 1 / 60; if (!spun) spun = i / 60; vMinT = Math.min(vMinT, tgt.v); latMax = Math.max(latMax, Math.abs(tgt.lat)); } });
      o.ball = { hitAfter: +spun.toFixed(2), spin: +spinT.toFixed(2), minV: +(vMinT / tgtV0).toFixed(2), back: +(tgt.v / tgtV0).toFixed(2), lat: +latMax.toFixed(1), balls: R.it.balls.filter(b => b.on).length };
      // shield: a ball at him takes the bubble, the next spins him
      him = fresh(); L.rcItGive(him, "shield"); L.raceItemUse(); run(10, hold);
      const thrower = R.racers[2]; thrower.s = him.s - 60; thrower.lat = 0; thrower.v = him.v;
      L.rcItGive(thrower, "ball"); L.rcItUse(thrower);
      let s1 = 0; run(60 * 4, () => { hold(); thrower.v = him.v * 0.9; if (him.spinT > 0) s1++; });
      o.shield = { spunWithBubble: s1, bubbleLeft: him.shieldT > 0 };
      L.rcItGive(thrower, "ball"); thrower.s = him.s - 60; L.rcItUse(thrower);
      let s2 = 0, sp = 0, vMin = 1e9, v2 = him.v, lat0 = him.lat, latD = 0, yaw = 0, ywPrev = null, stuckT = 0, stuckMax = 0;
      run(60 * 5, () => { hold(); thrower.v = him.v * 0.9;
        if (him.spinT > 0) { s2++; vMin = Math.min(vMin, him.v); latD = Math.max(latD, Math.abs(him.lat - lat0)); const y = him.spinA || 0; if (ywPrev !== null) yaw += Math.abs(y - ywPrev); ywPrev = y; }
        if (him.v < RC.stuckV) { stuckT += 1 / 60; stuckMax = Math.max(stuckMax, stuckT); } else stuckT = 0; });
      o.spin = { secs: +(s2 / 60).toFixed(2), turns: +(yaw / (2 * Math.PI)).toFixed(2), minV: +(vMin / v2).toFixed(2), back: +(him.v / v2).toFixed(2), latMoved: +latD.toFixed(1), stuck: +stuckMax.toFixed(2), onRoad: Math.abs(him.lat) <= RC.width / 2 };
      // oil: dropped by a car ahead in his lane, he spins in it (and steering round it, he does not)
      him = fresh(); const dropper = R.racers[3]; dropper.s = him.s + 40; dropper.lat = 0; dropper.v = him.v;
      L.rcItGive(dropper, "oil"); L.rcItUse(dropper);
      let so = 0; run(60 * 3, () => { hold(); dropper.v = him.v * 1.3; if (him.spinT > 0) so++; });
      him = fresh(); const dropper2 = R.racers[3]; dropper2.s = him.s + 40; dropper2.lat = 0; dropper2.v = him.v;
      L.rcItGive(dropper2, "oil"); L.rcItUse(dropper2);
      let so2 = 0; run(60 * 3, () => { hold(); dropper2.v = him.v * 1.3; him.lat = 8; if (him.spinT > 0) so2++; });
      o.oil = { inIt: +(so / 60).toFixed(2), round: so2 };
      // giant: huge for about 6 s; a car he meets bounces off, his speed kept
      him = fresh(); run(30, hold);
      const sc0 = (him.mesh && him.mesh.scale.x) || 1;
      L.rcItGive(him, "giant"); L.raceItemUse();
      let big = 0, kMax = 0, hit = R.racers[4], vBefore = 0, vAfter = 0, latHit0 = 0, bounced = 0;
      run(60 * 8, (i) => {
        hold();
        if (i === 60) { hit.s = him.s + 15; hit.lat = him.lat + 1; hit.v = him.v * 0.6; latHit0 = hit.lat; vBefore = him.v; }
        if (i > 60 && i < 150) { if (Math.abs(hit.lat - latHit0) > bounced) bounced = Math.abs(hit.lat - latHit0); }
        if (i === 150) vAfter = him.v;
        const k = him.giantK || 1; kMax = Math.max(kMax, k); if (k > 1.5) big += 1 / 60;
      });
      o.giant = { secs: +big.toFixed(2), k: +kMax.toFixed(2), after: +(him.giantK || 1).toFixed(2), scaleAfter: +(((him.mesh && him.mesh.scale.x) || 1) / sc0).toFixed(2), bounced: +bounced.toFixed(1), keep: +(vAfter / vBefore).toFixed(2) };
      o.bangs = (L.flags.carCrashes || 0) - bangs0 + (st.exploding ? 1 : 0);
      L.raceReset();
    }
    st.touching = false;
    return out;
  });
  const cars = Object.keys(cd);
  const cOk = cars.every(k => {
    const o = cd[k];
    return o.boost >= 1.25 && o.ball.hitAfter > 0 && o.ball.spin >= 0.7 && o.ball.minV < 0.8 && o.ball.back >= 0.9 && o.shield.spunWithBubble === 0 && !o.shield.bubbleLeft &&
      o.oil.inIt > 0.5 && o.oil.round === 0 && o.giant.secs >= 5 && o.giant.secs <= 7.5 && o.giant.after === 1 && o.giant.scaleAfter === 1 && o.giant.bounced >= 2 && o.giant.keep >= 0.95 && o.bangs === 0;
  });
  check(`race items: each does what it says, in every car -- the boost ${cars.map(k => "x" + cd[k].boost).join("/")}; the ball spun the car ahead after ${cars.map(k => cd[k].ball.hitAfter).join("/")} s (its speed down to ${cars.map(k => cd[k].ball.minV).join("/")}, back to ${cars.map(k => cd[k].ball.back).join("/")}); the bubble took a ball (spun ${cars.map(k => cd[k].shield.spunWithBubble).join("/")} frames) and went; into the oil he spun ${cars.map(k => cd[k].oil.inIt).join("/")} s, round it ${cars.map(k => cd[k].oil.round).join("/")}; GIANT ${cars.map(k => cd[k].giant.secs).join("/")} s at x${cars.map(k => cd[k].giant.k).join("/")}, a car he met bounced ${cars.map(k => cd[k].giant.bounced).join("/")} m and he kept ${cars.map(k => cd[k].giant.keep).join("/")} of his speed; ${cars.map(k => cd[k].bangs).join("/")} bangs`, cOk, J(cd));
  const dOk = cars.every(k => { const s = cd[k].spin; return s.secs >= 0.8 && s.secs <= 1.3 && s.turns >= 0.9 && s.minV >= 0.3 && s.minV < 0.8 && s.back >= 0.9 && s.latMoved <= 1.5 && s.stuck === 0 && s.onRoad; });
  check(`race items: a spin-out is short and never a bang -- ${cars.map(k => `${k} ${cd[k].spin.secs} s, ${cd[k].spin.turns} turns, speed down to ${cd[k].spin.minV} and back to ${cd[k].spin.back}, ${cd[k].spin.latMoved} m across, stuck ${cd[k].spin.stuck} s`).join("; ")}`, dOk, J(cars.map(k => cd[k].spin)));

  // ---- e2. (v187 retro) ONE FOOTPRINT: every car takes a box over the same width across the road -- by its own
  // width the monster truck took more boxes and won 80% on Snowy Peaks (35% without items)
  const e2 = await page.evaluate(() => {
    const L = window.__lp, R = L.race, st = L.state, I = L.RC.items, out = {};
    const edge = (I.box + L.RC.footW) / 2;
    for (const veh of ["car", "cybertruck", "corvette", "monster"]) {
      L.api.setVehicle(veh); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
      const got = [];
      for (const off of [edge - 0.3, edge + 0.3]) {
        L.rcStartRace("oval", 3); R.phase = "race"; R.raceT0 = R.t;
        for (const r of R.racers) if (!r.isHim) r.s -= 2000;
        const him = R.him, row = R.it.rows[0];
        him.s = row.s - 30; him.lat = row.boxes[1].lat + off; him.v = L.RC.v;
        for (let i = 0; i < 60 * 1.5; i++) { st.touching = true; st.ctrlBank = 0; st.ctrlPitch = 0; him.latV = 0; him.lat = row.boxes[1].lat + off; L.update(1 / 60); }
        got.push(!!him.item);
      }
      out[veh] = got;
    }
    st.touching = false; L.raceReset();
    return out;
  });
  check(`race items: one footprint -- every car takes a box 0.3 m inside the catch and misses it 0.3 m outside (${Object.entries(e2).map(([k, v]) => `${k} ${v[0] ? "took" : "MISSED"}/${v[1] ? "TOOK" : "missed"}`).join(", ")})`,
    Object.values(e2).every(v => v[0] && !v[1]), J(e2));

  // ---- e. it stays close: further back, better items
  const e = await page.evaluate(() => {
    const L = window.__lp, n = 4000, out = {};
    for (const [tag, f] of [["first", 0], ["middle", 0.5], ["last", 1]]) {
      const c = {}; for (let i = 0; i < n; i++) { const k = L.rcItDraw(f); c[k] = (c[k] || 0) + 1; }
      for (const k in c) c[k] = +(c[k] / n).toFixed(2);
      out[tag] = c;
    }
    return out;
  });
  const strong = t => (e[t].boost || 0) + (e[t].giant || 0) + (e[t].ball || 0);
  check(`race items: further back gets better items -- first ${J(e.first)}, middle ${J(e.middle)}, last ${J(e.last)} (boost, giant and ball: ${strong("first").toFixed(2)} -> ${strong("last").toFixed(2)})`,
    !e.first.giant && strong("last") >= 0.8 && strong("first") <= 0.35 && (e.last.giant || 0) >= 0.15, J(e));

  // ---- f. the noisy hand, with random taps on the item button, a whole race on every track
  const f = [];
  const vehs = ["car", "cybertruck", "corvette", "monster", "car"];
  for (let k = 0; k < tracks.length; k++) f.push(await oneRace(page, vehs[k % vehs.length], 4100 + k, { track: tracks[k], taps: true }));
  const fOk = f.every(r => r.podium && r.bangs === 0 && r.stuck === 0 && r.stuckMax <= 2 && r.items.used > 0 && r.items.rivalsUsed > 0 && r.things.every_ >= 4 && r.things.every_ <= 10.5) &&
    f.reduce((a, r) => a + r.items.hitHim, 0) > 0;
  check(`race items: the noisy hand with random taps on the button plays a whole race on every track -- ${f.map(r => `${r.track} (${r.veh}) came ${r.place}, ${r.items.got} boxes, used ${r.items.used}, rivals used ${r.items.rivalsUsed} (${r.items.hitHim} on him), something every ${r.things.every_} s`).join("; ")}; ${f.reduce((a, r) => a + r.bangs, 0)} bangs, the longest stuck ${Math.max(...f.map(r => r.stuckMax))} s`, fOk, J(f));

  // ---- g. nothing left behind
  const g = await page.evaluate(() => {
    const L = window.__lp, R = L.race, st = L.state;
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    const scale0 = +L.vehicleModel.scale.x.toFixed(2);           // (his body's own size, before any race)
    L.rcStartRace("oval", 9); R.phase = "race"; R.raceT0 = R.t;
    const him = R.him;
    for (const [r, k] of [[him, "giant"], [R.racers[1], "shield"], [R.racers[2], "oil"], [R.racers[3], "ball"]]) { L.rcItGive(r, k); r.isHim ? L.raceItemUse() : L.rcItUse(r); }
    L.rcItGive(him, "boost");
    for (let i = 0; i < 20; i++) { st.touching = true; L.update(1 / 60); }
    const live = () => ({ balls: R.it.balls.filter(b => b.on).length, oils: R.it.oils.filter(o => o.on).length, bubbles: R.it.bubbles.filter(b => b.visible).length,
      giant: +(L.vehicleModel ? L.vehicleModel.scale.x : 1).toFixed(2), btn: !document.getElementById("raceItemBtn").classList.contains("hidden") });
    const during = live();
    L.raceAgain(); for (let i = 0; i < 5; i++) L.update(1 / 60);
    const again = Object.assign(live(), { item: R.him.item });
    L.raceExit(); for (let i = 0; i < 5; i++) { st.touching = false; L.update(1 / 60); }
    const exit = live();
    return { during, again, exit, scale0 };
  });
  const clean = x => x.balls === 0 && x.oils === 0 && x.bubbles === 0 && !x.btn;
  check(`race items: nothing left behind -- during ${J(g.during)}; raced again ${J(g.again)}; after EXIT ${J(g.exit)}`,
    g.during.balls + g.during.oils + g.during.bubbles >= 2 && clean(g.again) && !g.again.item && clean(g.exit) && g.again.giant === g.scale0 && g.exit.giant === g.scale0 && g.during.giant > g.scale0 * 1.5, J(g));

  // ---- i. (v196) a rocket boost burns out of the BODY: the monster truck's flames are born at least 0.3 of its drawn
  // height over the road (at a fixed 0.7 m they came from its wheel hubs, laid along the road behind it)
  const fl = await page.evaluate(() => {
    const L = window.__lp, R = L.race, st = L.state, P0 = () => L.rcPuffs;
    L.api.setVehicle("monster"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    L.api.setView(true); L.rcStartRace("oval", 33); R.phase = "race"; R.raceT0 = R.t;
    for (let i = 0; i < 60; i++) { st.touching = true; L.update(1 / 60); }
    const him = R.him;
    const box = new window.THREE.Box3().setFromObject(him.mesh), H = box.max.y - box.min.y;
    L.rcItGive(him, "boost"); L.raceItemUse();
    const hs = [];
    for (let f = 0; f < 40; f++) {
      const P = P0(), life0 = P ? Array.from(P.life) : [];
      st.touching = true; L.update(1 / 60);
      if (!P) continue;
      for (let k = 0; k < P.n; k++) if (P.life[k] > life0[k] + 1e-6 && P.col[k * 3] > 0.99 && P.col[k * 3 + 2] < 0.2) {   // (born this frame, flame-coloured)
        const q = L.rcAt(him.s); hs.push(P.pos[k * 3 + 1] - q.gy);
      }
    }
    st.touching = false; L.raceReset(); L.api.setVehicle("car"); L.api.spawnAt(0, 0);
    return { H: +H.toFixed(2), n: hs.length, minH: hs.length ? +Math.min(...hs).toFixed(2) : null };
  });
  check(`race items: a boost burns out of the body -- the monster truck's flames born ${fl.minH} m over the road at the least (it stands ${fl.H} m; ${fl.n} flames)`,
    fl.n >= 4 && fl.minH >= fl.H * 0.3, J(fl));

  const h = await page.evaluate(() => {
    const L = window.__lp, R = L.race, st = L.state;
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    L.rcStartRace("snow", 31); R.phase = "race"; R.raceT0 = R.t;
    for (let i = 0; i < 5; i++) { st.touching = true; L.update(1 / 60); }
    const row = R.it.rows.find(r => !r.off), b = row.boxes[1], p = {};
    for (const x of row.boxes) x.down = 0;
    const draw = () => { window.rcItDrawFrame(); return R.it.boxMesh.count; };
    L.camera.position.set(0, 1e5, 0); const far = draw();
    L.rcPoint(row.s, b.lat, p); L.camera.position.set(p.x, p.y + L.RC.items.boxUp, p.z); const inside = draw();
    L.raceReset(); st.touching = false;
    return { far, inside };
  });
  check(`race items: a box with the camera inside it is not drawn -- ${h.far} drawn with the camera far off, ${h.inside} with it inside one (the rest still drawn)`,
    h.far > 1 && h.inside === h.far - 1, J(h));
};
