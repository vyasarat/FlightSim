"use strict";
// Each point-at set-piece's payoff, from the DRIVING SEAT at cruise, portrait,
// on a real hands-off drive -- shot at the moment the payoff is biggest in the
// windscreen (the same measure as payoff_size_checks). Run on two roots to get
// a before and an after:
//   node scripts/payoff_renders.js <root> <outDir> [port]
// Two passes per shot: the first finds the frame (no painting), the second
// replays the same drive and paints that frame.
const path = require("path"), fs = require("fs");
const { launch, openGame, serve } = require("./art_rig.js");
const WIN_TOP = 149, WIN_BOT = 674;

async function render(root, outDir, port) {
  fs.mkdirSync(outDir, { recursive: true });
  const srv = serve(root, port), browser = await launch();
  const page = await openGame(browser, port, { width: 820, height: 1180 });
  await page.evaluate(() => { window.__lp.api.skipScreens(); for (let i = 0; i < 3; i++) window.__paint(); });
  await page.screenshot({ timeout: 180000 });
  const shots = [];
  for (const k of (process.env.ONLY || "ls,sled,fb,mt").split(",")) for (const north of [false, true]) {
    // pass 1 finds the frame; pass 2 paints it
    let target = null, salt = 0;
    for (let pass = 1; pass <= 2; pass++) {
      const r = await page.evaluate(([k, north, pass, target, WIN_TOP, WIN_BOT, salt]) => {
        const L = window.__lp, st = L.state;
        L.api.skipScreens();
        const T = L.TUNE;
        const held = window.__held || (window.__held = { ls: T.launchSite.armR, sled: T.rocketSled.carView, fb: T.fireworksBarge.carView, mt: T.monsterTruck.carView, mtB: T.monsterTruck.landBearing, mtBR: T.monsterTruck.landBearingR });
        L.lsReset(); L.sledReset(); L.fbReset(); L.mtReset(); if (L.policeStop) L.policeStop(); L.setBigNum(null); L.spdReset();
        T.launchSite.armR = k === "ls" ? held.ls : 0;
        T.rocketSled.carView = k === "sled" ? held.sled : -1e6;
        T.fireworksBarge.carView = k === "fb" ? held.fb : -1e6;
        T.monsterTruck.carView = k === "mt" ? held.mt : -1e6;
        if (held.mtB !== undefined) { T.monsterTruck.landBearing = k === "mt" ? held.mtB : 999; T.monsterTruck.landBearingR = k === "mt" ? held.mtBR : 999; }
        // the same layout of traffic on both passes
        let seed = 0x1234567 + (k.length * 7 + (north ? 1 : 0)) + salt * 101;
        const R = Math.random;
        Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
        L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
        for (const t of L.highway.traffic) { t.alive = false; t.respawn = 0; }
        L.api.setView(false);
        const a = k === "ls" ? T.launchSite : k === "sled" ? L.sledWallWorld() : k === "fb" ? T.fireworksBarge : L.mtLanding();
        const q = L.hwySampleAt(L.hwyNearest(a.x, north ? a.z - 2600 : a.z + 2600).s), off = (north ? -1 : 1) * (L.HW.medianW / 2 + L.HW.laneW * 0.5);
        st.x = q.x - q.fz * off; st.z = q.z + q.fx * off; st.y = q.y; st.speed = 0;
        st.heading = north ? Math.atan2(q.fx, q.fz) : Math.atan2(-q.fx, -q.fz);
        const live = () => k === "ls" ? (L.lsite.phase === "ignite" || (L.lsite.phase === "climb" && L.lsite.tt < 12))
          : k === "sled" ? (L.sled.smashed && !L.sled.rebuilding && L.sled.phase !== "home" && L.sled.phase !== "rest")
          : k === "fb" ? L.fbarge.phase === "show" : ["air", "crush"].includes(L.mtruck.phase);
        const V = L.camera.position.constructor, v = new V();
        // the same open-glass measure as payoff_size_checks: on-screen box, rows
        // where at least half of it is not under a button, a pillar, the brow or the cabin
        const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
        const frames = ["pillarL", "pillarR", "brow"].map(id => document.getElementById(id)).filter(e => e && getComputedStyle(e).display !== "none").map(e => e.getBoundingClientRect());
        const glassAt = (px, py) => {
          if (py < WIN_TOP || py > WIN_BOT || px < 0 || px > innerWidth) return false;
          const e = document.elementFromPoint(px, py); if (e && e.id !== "gl") return false;
          for (const r of frames) if (px >= r.left && px <= r.right && py >= r.top && py <= r.bottom) return false;
          if (L.car.cabin && L.car.cabin.visible) { ndc.set(px / innerWidth * 2 - 1, -(py / innerHeight * 2 - 1)); ray.setFromCamera(ndc, L.camera); if (ray.intersectObject(L.car.cabin, true).length) return false; }
          return true;
        };
        const span = (pts) => { L.scene.updateMatrixWorld(); L.camera.updateMatrixWorld();
          let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, n = 0;
          for (const p of pts) { v.set(p[0], p[1], p[2]).project(L.camera); if (v.z >= 1) continue;
            const px = (v.x + 1) / 2 * innerWidth, py = (1 - v.y) / 2 * innerHeight;
            x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); n++; }
          if (!n || y1 - y0 < 1) return 0;
          let open = 0;
          for (let r = 0; r < 24; r++) { const py = y0 + (y1 - y0) * (r + 0.5) / 24; let o = 0;
            for (let c = 0; c < 8; c++) if (glassAt(x0 + (x1 - x0) * (c + 0.5) / 8, py)) o++; if (o >= 4) open++; }
          return (y1 - y0) * open / 24; };
        const corners = (o) => { o.updateMatrixWorld(true); const out = [];
          o.traverse(m => { if (!m.geometry || !m.visible) return; if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox;
            for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) { const w = new V(x, y, z).applyMatrix4(m.matrixWorld); out.push([w.x, w.y, w.z]); } });
          return out; };
        const pts = () => {
          if (k === "ls") { const S = L.lsite, o = corners(S.stack);
            for (const q of L.lsPuffsLive()) if (q.y < S.padY + 60) o.push([q.x, q.y + q.r, q.z], [q.x, q.y - q.r, q.z]); return [o]; }
          if (k === "sled") { const o = []; for (const b of L.sled.bricks) o.push([b.x, b.y + 3, b.z], [b.x, b.y - 3, b.z]);
            for (const q of L.sledPuffsLive()) o.push([q.x, q.y + q.r, q.z], [q.x, q.y - q.r, q.z]); return [o]; }
          if (k === "fb") { const by = {}; for (const q of L.fbSparksLive()) (by[q.burst || 0] = by[q.burst || 0] || []).push([q.x, q.y, q.z]); return Object.values(by); }
          return [corners(L.mtruck.truck)];
        };
        let best = 0, bestF = -1, f = 0, wasLive = false;
        try {
          for (; f < 60 * 160; f++) {
            L.api.setStick(0, 0); if (L.police && L.police.active) L.policeStop(); L.update(1 / 60);   // a red light on the way is not this measure's business
            if (pass === 2 && f === target) break;
            if (live()) { wasLive = true; const s = Math.max(0, ...pts().map(span)); if (s > best) { best = s; bestF = f; } }
            else if (wasLive) break;
          }
        } finally { Math.random = R; }
        // the red-light camera's flash is taken down by a wall-clock timeout this rig never reaches
        const fl = document.getElementById("flash"); fl.style.transition = "none"; fl.classList.remove("on");
        return { bestF, best: Math.round(best), phase: k === "mt" ? L.mtruck.phase : null, dbg: k === "sled" ? { ph: L.sled.phase, cd: L.flags.sledCountdowns || 0, sm: L.flags.sledSmashes || 0, z: Math.round(st.z), pol: L.police && L.police.state, f } : null };
      }, [k, north, pass, target, WIN_TOP, WIN_BOT, salt]);
      // the drive can be stood down (a red light, the police): another traffic layout
      if (pass === 1 && r.bestF < 0 && salt < 4) { console.log("retry", k, north, JSON.stringify(r)); salt++; pass = 0; continue; }
      if (pass === 1) target = r.bestF; else {
        await page.evaluate(() => { for (let i = 0; i < 2; i++) window.__paint(); });
        const file = path.join(outDir, `${k}-seat-${north ? "N" : "S"}.png`);
        await page.screenshot({ path: file, timeout: 180000 });
        shots.push({ file, k, north });
        console.log("wrote", file, JSON.stringify(r));
      }
    }
  }
  await browser.close(); srv.close();
  return shots;
}
module.exports = render;
if (require.main === module) {
  const a = process.argv.slice(2);
  render(path.resolve(a[0] || path.join(__dirname, "..")), path.resolve(a[1] || path.join(__dirname, "..", "evidence", "payoff", "after")), +(a[2] || 8201));
}
