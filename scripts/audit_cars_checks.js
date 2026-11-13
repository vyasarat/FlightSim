"use strict";
// Cars, the motorway, the streets: the 2026-11 audit (AUDIT.md), one check per finding.
const FIXED = new Set(["CARS-1", "CARS-2", "CARS-3"]);
const EJ = require("./audit_eject.js");   // (v215) an eject is seen to run, not taken on its word
// ---------------------------------------------------------------------------
// Cars audit (2026-11): three transitions that leave the car in the wrong place.
//
//   CARS-1  a fresh start (picker relaunch, or the globe to London) during a police pull-over:
//           the old place's police never cross the country/sea to him, and no pull-over
//           countdown plays at his new start
//   CARS-2  on the toy track the globe is either not offered, or a pick really takes him there;
//           a pick that leaves him where he was changes nothing (lp.start, originIdx)
//   CARS-3  after an eject from a car he comes back on the road he was on, near where he ejected, facing
//           the way he was going (v215: the eject seen to run, in both of the iPad's ways up)
// ---------------------------------------------------------------------------
module.exports = async function carsAuditChecks({ newPage, check: report }) {
  // Only the findings already fixed report (FIXED grows release by release, AUDIT.md's table).
  const check = (name, ok, detail) => { const id = (name.match(/^([A-Z]+-\d+)/) || [])[1]; if (!id || FIXED.has(id)) report(name, ok, detail); };
  // ---- CARS-1: pull-over, then a fresh start ------------------------------------------------
  for (const how of ["relaunch", "london"]) {
    const { page, ctx } = await newPage(1024, 768);
    const r = await page.evaluate((how) => {
      const L = window.__lp, st = L.state;
      L.noRender = true; L.api.skipScreens();
      L.api.setVehicle("car"); L.api.spawnAt(0, 0);
      for (let i = 0; i < 30; i++) L.update(1 / 60);
      for (let i = 0; i < 60 * 6; i++) { L.api.setStick(0, 0); L.update(1 / 60); }
      const started = L.policeStart(null);
      for (let i = 0; i < 60 * 3; i++) { L.api.setStick(0, 0); L.update(1 / 60); }
      L.api.clearStick();
      let n = 0;
      while (L.police.state !== "pullover" && n < 60 * 25) { L.update(1 / 60); n++; }
      const pulled = L.police.state === "pullover";
      const offered = how === "london" ? L.ldGlobeShows() : L.pickerCanOpen();
      if (how === "london") { L.api.setVehicle("car"); L.ldGlobePick("ldn"); }
      else { L.api.setVehicle("car"); L.api.spawnAt(1, 1); }
      const me = { x: st.x, z: st.z };
      const prev = L.police.cars.map(c => ({ x: c.x, z: c.z }));
      let maxSpeed = 0, countdown = [], arrived = Infinity;
      for (let i = 0; i < 60 * 5; i++) {
        L.update(1 / 60);
        L.police.cars.forEach((c, k) => {
          if (L.police.active && c.g.visible) maxSpeed = Math.max(maxSpeed, Math.hypot(c.x - prev[k].x, c.z - prev[k].z) * 60);
          prev[k].x = c.x; prev[k].z = c.z;
        });
        const big = document.getElementById("bigNum");
        const t = big ? big.textContent.trim() : "";
        if (t && /\d/.test(t) && countdown[countdown.length - 1] !== t) countdown.push(t);
        if (L.police.active) arrived = Math.min(arrived, Math.min(...L.police.cars.map(c => Math.hypot(c.x - st.x, c.z - st.z))));
      }
      return { started, pulled, offered, newStart: { x: Math.round(me.x), z: Math.round(me.z) },
               maxPoliceSpeed: Math.round(maxSpeed), countdown, nearestPoliceAfter: Number.isFinite(arrived) ? Math.round(arrived) : null,
               active: L.police.active, state: L.police.state, frameErrors: L.frameErrors || 0 };
    }, how);
    check(`CARS-1: a ${how === "london" ? "globe start in London" : "relaunch from the picker"} during a police pull-over -- the old place's police never streak to his new start (no police car over 150 m/s) and no pull-over countdown plays there`,
      r.started && r.pulled && r.offered && !r.active && r.maxPoliceSpeed <= 150 && r.countdown.length === 0 && r.frameErrors === 0, r);
    await ctx.close();
  }

  // ---- CARS-2: the globe on the toy track ---------------------------------------------------
  {
    const { page, ctx } = await newPage(1024, 768);
    for (const city of ["ldn", "ny"]) {
      const r = await page.evaluate((city) => {
        const L = window.__lp, st = L.state;
        L.noRender = true; L.api.skipScreens();
        try { localStorage.removeItem("lp.start"); localStorage.removeItem("lp.dir"); } catch (e) {}
        L.api.setVehicle("car"); L.api.spawnAt(0, 0);
        for (let i = 0; i < 10; i++) L.update(1 / 60);
        const p = L.tkLiftPad(); st.x = p.x; st.z = p.z; st.y = L.terrainEff(p.x, p.z); st.speed = 0;
        L.api.clearStick();
        L.update(1 / 60);
        const boarded = L.trk.on;
        for (let i = 0; i < 30; i++) L.update(1 / 60);              // half a second up the lift
        const onLift = !!L.trk.lift;
        const before = { x: st.x, z: st.z, origin: st.originIdx, start: localStorage.getItem("lp.start"), dir: localStorage.getItem("lp.dir") };
        const shows = L.ldGlobeShows();
        if (shows) L.ldGlobePick(city);
        for (let i = 0; i < 120; i++) L.update(1 / 60);
        const after = { x: Math.round(st.x), z: Math.round(st.z), origin: st.originIdx, start: localStorage.getItem("lp.start"), dir: localStorage.getItem("lp.dir"), trkOn: L.trk.on };
        // where the pick should have taken him
        const there = city === "ldn" ? L.ldNear(st.x, st.z) : !L.trk.on && Math.hypot(st.x - before.x, st.z - before.z) > 500;
        const moved = !L.trk.on && there;
        const unchanged = after.origin === before.origin && after.start === before.start && after.dir === before.dir;
        // and back on the track's level for the next one
        L.api.setVehicle("car"); L.api.spawnAt(0, 0);
        return { city, boarded, onLift, shows, moved, unchanged, before: { x: Math.round(before.x), z: Math.round(before.z), origin: before.origin, start: before.start }, after, frameErrors: L.frameErrors || 0 };
      }, city);
      check(`CARS-2: on the toy track's lift the globe is either not offered or a pick of ${city} really takes him there (off the track)`,
        r.boarded && r.onLift && (!r.shows || r.moved) && r.frameErrors === 0, r);
      check(`CARS-2: on the toy track a globe pick of ${city} that leaves him where he was changes nothing -- not lp.start, lp.dir or originIdx`,
        r.boarded && (r.moved || r.unchanged), r);
    }
    await ctx.close();
  }

  // ---- CARS-3: eject from a car, back on his road, facing his way -----------------------------
  // (v215) in both of the iPad's ways up; the eject SEEN to run (audit_eject.js), and his heading
  // read after it: facing along the road he comes back on (its line, the way he is set to drive it)
  // and the way he was going before (within HDG_TOL of both)
  const HDG_TOL = 25;
  for (const [w, h, way] of [[1024, 768, "landscape"], [768, 1024, "portrait"]]) {
    const { page, ctx } = await newPage(w, h);
    await page.evaluate(EJ.install);
    const r = await page.evaluate((HDG_TOL) => {
      const L = window.__lp, st = L.state, out = {};
      L.noRender = true; L.api.skipScreens();
      const deg = (a) => Math.round(a * 180 / Math.PI);
      const diff = (a, b) => Math.abs(deg(Math.atan2(Math.sin(a - b), Math.cos(a - b))));
      const hdgOf = (fx, fz) => Math.atan2(-fx, -fz);                 // the heading whose forward is (fx, fz)
      const roadOf = () => L.stPlan.road ? L.stPlan.road : null;
      const onMotorway = () => { const n = L.hwyNearest(st.x, st.z); return !!n && Math.abs(n.lateral) < L.CAR.onRoadHalf && Math.abs(n.y - st.y) < 4; };
      // the way along the road under him that he is set to drive: a street's line by stPlan.dir, the
      // motorway's carriageway (the side of the median he is on), the rail ahead
      const roadHdg = (kind) => {
        if (kind === "track") { if (!L.trk.on || !L.trk.seg) return null; const sg = typeof L.trk.seg === "string" ? L.trk.segs[L.trk.seg] : L.trk.seg; if (!sg) return null; const q = L.tkAt(sg, L.trk.s); return hdgOf(q.tx * Math.sign(L.trk.v || 1), q.tz * Math.sign(L.trk.v || 1)); }
        if (kind === "main") { const n = L.hwyNearest(st.x, st.z); if (!n) return null; const side = n.lateral >= 0 ? 1 : -1; return hdgOf(n.fx * side, n.fz * side); }
        const r = roadOf(); if (!r) return null; const p = L.stProject(r, st.x, st.z); return hdgOf(p.fx * L.stPlan.dir, p.fz * L.stPlan.dir);
      };
      const run = (label, setup, kind) => {
        setup();
        for (let i = 0; i < 30; i++) { L.api.setStick(0, 0); L.update(1 / 60); }
        L.api.clearStick();
        const bx = st.x, bz = st.z, broad = roadOf(), bMain = onMotorway(), bHdg = st.heading, bRoadHdg = roadHdg(kind);
        const onRail = kind !== "track" || (L.trk.on && !L.trk.lift);   // (v214) the track case ejects mid-run, off the lift
        const ej = window.__ejectRun(40);
        for (let i = 0; i < 10; i++) L.update(1 / 60);
        const d = Math.hypot(st.x - bx, st.z - bz);
        // the same road: the same city street (or one meeting it at the nearest junction), or the motorway again
        const ar = roadOf();
        const sameRoad = kind === "track" ? L.trk.on : kind === "main" ? onMotorway()
          : !!ar && !!broad && (ar === broad || [broad.a, broad.b].some(nd => nd && nd.arms.some(a => a.road === ar)));
        const aRoadHdg = roadHdg(kind);
        const hdg = { before: deg(bHdg), roadBefore: bRoadHdg === null ? null : deg(bRoadHdg), after: deg(st.heading), roadAfter: aRoadHdg === null ? null : deg(aRoadHdg),
                      offRoadLine: aRoadHdg === null ? null : diff(st.heading, aRoadHdg), offHisWay: diff(st.heading, bHdg) };
        const facing = hdg.offRoadLine !== null && hdg.offRoadLine <= HDG_TOL && hdg.offHisWay <= HDG_TOL && bRoadHdg !== null && diff(bHdg, bRoadHdg) <= HDG_TOL;
        out[label] = { eject: ej, from: { x: Math.round(bx), z: Math.round(bz), road: broad ? broad.kind : bMain ? "motorway" : null },
                       to: { x: Math.round(st.x), z: Math.round(st.z), road: ar ? ar.kind : onMotorway() ? "motorway" : null }, metres: Math.round(d), sameRoad,
                       onRail, hdg, facing, near: !eject.active && d < 150 };
      };
      run("ny street (SUV)", () => {
        L.api.setVehicle("car"); L.api.spawnAt(0, 0);
        for (let i = 0; i < 10; i++) L.update(1 / 60);
        const R = L.stReassembleAt(-400, 4300, Math.atan2(400, 200), null, Infinity);
        st.x = R.x; st.z = R.z; st.y = R.y; st.heading = R.heading; st.speed = 20; L.stPlan.road = R.road; L.stPlan.dir = R.dir; L.stPlan.turn = null;
      }, "street");
      run("mid-motorway (Cybertruck)", () => {
        L.api.setVehicle("cybertruck"); L.api.spawnAt(0, 0);
        for (let i = 0; i < 60 * 40; i++) { L.api.setStick(0, 0); L.update(1 / 60); }
      }, "main");
      run("london street (Corvette)", () => {
        L.api.setVehicle("corvette"); L.ldStart();
        for (let i = 0; i < 60 * 30; i++) { L.api.setStick(0, 0); L.update(1 / 60); }
      }, "street");
      // (v214, the law-reviewer) on the giant toy track: still his, on the rail where he left it
      run("toy track (SUV)", () => {
        L.api.setVehicle("car"); L.api.spawnAt(0, 0);
        for (let i = 0; i < 10; i++) L.update(1 / 60);
        const p = L.tkLiftPad(); st.x = p.x; st.z = p.z; st.y = L.terrainEff(p.x, p.z); st.speed = 0;
        L.api.clearStick(); L.update(1 / 60);
        for (let i = 0; i < 60 * 25 && (L.trk.lift || !L.trk.on); i++) { L.api.setStick(0, 0.9); L.update(1 / 60); }   // up the lift and away
        for (let i = 0; i < 60 * 2; i++) { L.api.setStick(0, 0.9); L.update(1 / 60); }
      }, "track");
      out.frameErrors = L.frameErrors || 0;
      L.api.setVehicle("car"); L.api.spawnAt(0, 0);
      return out;
    }, HDG_TOL);
    for (const k of Object.keys(r)) {
      if (k === "frameErrors") continue;
      const o = r[k], ok = EJ.ran(o.eject) && o.onRail && o.near && o.sameRoad && o.facing && r.frameErrors === 0;
      check(`CARS-3: after an eject from a car (${k}) he comes back on the road he was on, within 150 m of where he ejected, facing the way he was going along it (within ${HDG_TOL} deg)${way === "portrait" ? " -- portrait 768x1024" : ""}`, ok, o);
    }
    await ctx.close();
  }
};
