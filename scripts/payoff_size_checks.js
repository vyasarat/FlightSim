"use strict";
// ---------------------------------------------------------------------------
// HOW BIG THE PAYOFF IS FROM THE DRIVING SEAT (v138).
//
// The four point-at set-pieces stand well off the road so nothing they throw
// can reach it -- and from the seat, at first, that made each payoff a speck.
// The target: at the payoff, from the DRIVING SEAT, at cruise, on the portrait
// iPad, each one covers at least a QUARTER of the windscreen's height.
//
// The windscreen at 820x1180 runs from y = 149 (the roof) to y = 674 (the
// dash), measured off the seat renders: 525 px, so a quarter is 131 px.
//
// Hands-off at the default speed step, southbound and northbound, the others
// held off. Through each payoff window, every frame, the payoff's own points
// (the rocket and its cloud; the bricks; one burst's stars; the truck's own
// box) are projected through the live camera, and only the part of that on
// OPEN GLASS counts: not under a HUD button, not behind the car's own pillars,
// dash or map screen (a ray against the cabin). The tallest such span is the
// number. Each is reported, not just passed.
// ---------------------------------------------------------------------------
const WIN_TOP = 149, WIN_BOT = 674, QUARTER = (WIN_BOT - WIN_TOP) / 4;

module.exports = async function payoffSizeChecks({ newPage, check }) {
  const { page } = await newPage(820, 1180);
  const res = await page.evaluate(([WIN_TOP, WIN_BOT]) => {
    const L = window.__lp, st = L.state;
    L.noRender = true; L.api.skipScreens();
    const held = { ls: L.TUNE.launchSite.armR, lsCar: L.TUNE.launchSite.carView, sled: L.TUNE.rocketSled.carView, fb: L.TUNE.fireworksBarge.carView, mt: L.TUNE.monsterTruck.carView, mtB: L.TUNE.monsterTruck.landBearing, mtBR: L.TUNE.monsterTruck.landBearingR };
    const holdAllBut = (me) => {
      L.lsReset(); L.sledReset(); L.fbReset(); L.mtReset(); if (L.policeStop) L.policeStop(); L.setBigNum(null); L.spdReset();
      L.TUNE.launchSite.armR = me === "ls" ? held.ls : 0;
      if (held.lsCar !== undefined) L.TUNE.launchSite.carView = me === "ls" ? held.lsCar : -1e6;
      L.TUNE.rocketSled.carView = me === "sled" ? held.sled : -1e6;
      L.TUNE.fireworksBarge.carView = me === "fb" ? held.fb : -1e6;
      L.TUNE.monsterTruck.carView = me === "mt" ? held.mt : -1e6;
      L.TUNE.monsterTruck.landBearing = me === "mt" ? held.mtB : 999; L.TUNE.monsterTruck.landBearingR = me === "mt" ? held.mtBR : 999;
    };
    const V = L.camera.position.constructor;
    const v = new V();
    // What he can SEE of the payoff: its on-screen box, then a grid of samples
    // inside it, each counted only if it is open glass -- inside the
    // windscreen band, not under a HUD button (DOM hit-test), and not behind
    // the car's own cabin (a ray against the pillars, the dash and the map
    // screen, which are 3-D). The number is the height of the rows where at
    // least half of the payoff is on open glass.
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    const glassAt = (px, py) => {
      if (py < WIN_TOP || py > WIN_BOT || px < 0 || px > innerWidth) return false;
      const e = document.elementFromPoint(px, py);
      if (e && e.id !== "gl") return false;
      // the windscreen pillars and the brow are DOM (pointer-events: none, so
      // the hit-test above does not see them): their boxes
      for (const r of frameRects()) if (px >= r.left && px <= r.right && py >= r.top && py <= r.bottom) return false;
      // the cabin -- dash, wheel, map screen -- is 3-D: a ray against it
      if (L.car && L.car.cabin && L.car.cabin.visible) {
        ndc.set(px / innerWidth * 2 - 1, -(py / innerHeight * 2 - 1));
        ray.setFromCamera(ndc, L.camera);
        if (ray.intersectObject(L.car.cabin, true).length) return false;
      }
      return true;
    };
    const frameRects = () => ["pillarL", "pillarR", "brow"].map(id => document.getElementById(id)).filter(e => e && getComputedStyle(e).display !== "none")
      .map(e => e.getBoundingClientRect());
    const span = (pts) => {
      L.scene.updateMatrixWorld(); L.camera.updateMatrixWorld();
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, n = 0;
      for (const p of pts) {
        v.set(p[0], p[1], p[2]).project(L.camera);
        if (v.z >= 1) continue;
        const px = (v.x + 1) / 2 * innerWidth, py = (1 - v.y) / 2 * innerHeight;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); n++;
      }
      if (!n || y1 - y0 < 1) return 0;
      const rows = 24, cols = 8;
      let open = 0;
      for (let r = 0; r < rows; r++) {
        const py = y0 + (y1 - y0) * (r + 0.5) / rows;
        // a row counts only if at least half of the payoff across it is on open glass
        let o = 0;
        for (let c = 0; c < cols; c++) if (glassAt(x0 + (x1 - x0) * (c + 0.5) / cols, py)) o++;
        if (o >= cols / 2) open++;
      }
      return (y1 - y0) * open / rows;
    };
    // a mesh's world box corners
    const corners = (o) => {
      o.updateMatrixWorld(true);
      const out = [];
      o.traverse(m => { if (!m.geometry || !m.visible) return; if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox;
        for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) { const w = new V(x, y, z).applyMatrix4(m.matrixWorld); out.push([w.x, w.y, w.z]); } });
      return out;
    };
    const P = {
      // the rocket itself, base to nose, and the cloud out of its trench -- not
      // the thin smoke trail it leaves up the sky
      ls: { at: () => L.TUNE.launchSite, live: () => (L.lsite.phase === "ignite") || (L.lsite.phase === "climb" && L.lsite.tt < 12),
            pts: () => { const S = L.lsite, out = corners(S.stack);
                         for (const q of L.lsPuffsLive()) if (q.y < S.padY + 60) out.push([q.x, q.y + q.r, q.z], [q.x, q.y - q.r, q.z]); return out; } },
      sled: { at: () => L.sledWallWorld(), live: () => L.sled.smashed && !L.sled.rebuilding && L.sled.phase !== "home" && L.sled.phase !== "rest",
              pts: () => { const out = []; for (const b of L.sled.bricks) out.push([b.x, b.y + 3, b.z], [b.x, b.y - 3, b.z]);
                           for (const q of L.sledPuffsLive()) out.push([q.x, q.y + q.r, q.z], [q.x, q.y - q.r, q.z]); return out; } },
      // one burst at a time -- the biggest -- not every star in the sky at once
      fb: { at: () => L.TUNE.fireworksBarge, live: () => L.fbarge.phase === "show", multi: true,
            pts: () => { const by = {}; for (const q of L.fbSparksLive()) if (q.burst) (by[q.burst] = by[q.burst] || []).push([q.x, q.y, q.z]); return Object.values(by); } },
      mt: { at: () => L.mtLanding(), live: () => ["air", "crush"].includes(L.mtruck.phase),
            pts: () => corners(L.mtruck.truck) },
    };
    const out = {};
    // the measure's own sanity: the pillars, the dash and a button are not glass; the middle of the windscreen is
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60); L.api.setView(false); L.update(1 / 60);
    L.scene.updateMatrixWorld(); L.camera.updateMatrixWorld();
    out.selfTest = { frames: frameRects().map(r => [Math.round(r.left), Math.round(r.right)]), cabinVisible: !!(L.car.cabin && L.car.cabin.visible), pillarL: glassAt(30, 420), pillarR: glassAt(800, 470), dash: glassAt(410, 700), button: glassAt(752, 300), map: glassAt(650, 640), middle: glassAt(410, 300) };
    try {
      for (const k of ["ls", "sled", "fb", "mt"]) for (const north of [false, true]) {
        holdAllBut(k);
        L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
        L.api.setView(false);                                  // the driving seat
        L.update(1 / 60);
        const a = P[k].at();
        const z0 = north ? a.z - 2600 : a.z + 2600;
        const q = L.hwySampleAt(L.hwyNearest(a.x, z0).s), off = (north ? -1 : 1) * (L.HW.medianW / 2 + L.HW.laneW * 0.5);
        st.x = q.x - q.fz * off; st.z = q.z + q.fx * off; st.y = q.y; st.speed = 0;
        st.heading = north ? Math.atan2(q.fx, q.fz) : Math.atan2(-q.fx, -q.fz);
        let best = 0, seen = 0, f = 0, wasLive = false, bestD = null, bestF = -1, bestPh = null;
        for (; f < 60 * 160; f++) {
          L.api.setStick(0, 0); if (L.police && L.police.active) L.policeStop(); L.update(1 / 60);   // a red light on the way is not this measure's business
          if (P[k].live()) {
            wasLive = true; seen++;
            const s = P[k].multi ? Math.max(0, ...P[k].pts().map(span)) : span(P[k].pts());
            if (s > best) { best = s; bestD = Math.round(Math.hypot(a.x - st.x, a.z - st.z)); bestF = f; bestPh = k === "mt" ? L.mtruck.phase : null; }
          } else if (wasLive) break;
        }
        out[k + (north ? "N" : "S")] = { px: Math.round(best), frac: Math.round(best / (WIN_BOT - WIN_TOP) * 100) / 100, frames: seen, d: bestD, v: Math.round(st.speed), atF: bestF, phase: bestPh };
      }
    } finally {
      L.TUNE.launchSite.armR = held.ls; if (held.lsCar !== undefined) L.TUNE.launchSite.carView = held.lsCar;
      L.TUNE.rocketSled.carView = held.sled; L.TUNE.fireworksBarge.carView = held.fb; L.TUNE.monsterTruck.carView = held.mt; L.TUNE.monsterTruck.landBearing = held.mtB; L.TUNE.monsterTruck.landBearingR = held.mtBR;
      L.lsReset(); L.sledReset(); L.fbReset(); L.mtReset(); L.spdReset();
    }
    return out;
  }, [WIN_TOP, WIN_BOT]);
  check(`payoff size: the measure itself -- the pillars, the dash, the map screen and a button are not open glass; the middle of the windscreen is`,
    !res.selfTest.pillarL && !res.selfTest.pillarR && !res.selfTest.dash && !res.selfTest.button && !res.selfTest.map && res.selfTest.middle, res.selfTest);
  const names = { ls: "the rocket launch", sled: "the rocket sled's smash", fb: "the fireworks", mt: "the monster truck's jump" };
  for (const k of ["ls", "sled", "fb", "mt"]) {
    const S = res[k + "S"], N = res[k + "N"];
    check(`payoff size: ${names[k]}, from the driving seat at cruise, portrait, covers at least a quarter of the windscreen's height both ways (${S.px} px / ${N.px} px of ${Math.round(QUARTER)})`,
      S.frames > 0 && N.frames > 0 && S.px >= QUARTER && N.px >= QUARTER, { S, N });
  }
};
