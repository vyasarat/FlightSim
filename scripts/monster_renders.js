"use strict";
// The monster truck he drives (v141), through the game's own loop, portrait:
//   picker       the vehicle screen, with its card
//   start-<v>    picked: at the arena, the ramp ahead           (v = chase | seat)
//   ramp-<v>     driving up the ramp                            jump-<v> high over the lip
//   crush-<v>    into a small city building: the moment it goes   tower-chase  stopped by a tower
//   house-chase  through a town house                           traffic-chase  a motorway car knocked flying
//   shore-chase  stopped at the great lake's shore              popped-chase  the building back, from across the street
//   node scripts/monster_renders.js [root] [views...]    -> evidence/monster/ (OUT= to change)
const path = require("path"), fs = require("fs");
const { launch, openGame, serve } = require("./art_rig.js");

const DEFAULT = ["picker", "start-chase", "start-seat", "ramp-chase", "jump-chase", "jump-seat", "before-seat", "crush-chase", "crush-seat",
  "popped-seat", "tower-chase", "tower-seat", "house-chase", "house-seat", "traffic-chase", "traffic-seat", "shore-chase"];

async function render(root, views) {
  const out = process.env.OUT || path.resolve(__dirname, "..", "evidence", "monster");
  fs.mkdirSync(out, { recursive: true });
  const port = +(process.env.PORT || 8202), srv = serve(root, port), browser = await launch();
  const page = await openGame(browser, port, { width: 820, height: 1180 });
  await page.evaluate(() => { window.__lp.api.skipScreens(); window.__hold = () => {}; for (let i = 0; i < 3; i++) window.__paint(); });
  await page.screenshot({ timeout: 180000 });
  for (const v of [views[0], ...views]) {
    const info = await page.evaluate((v) => {
      const L = window.__lp, S = L.state, M = L.mon, MON = L.TUNE.monster;
      const [what, seat] = v.split("-");
      L.TUNE.monsterTruck.armR = 0;
      const range = (L.TUNE.dragRangeX * Math.min(innerWidth, innerHeight)) / (L.TUNE.car.dragRangeX * innerWidth);
      const drive = (n, steer, pitch) => { for (let i = 0; i < n; i++) { S.touching = true; S.touchIsPoint = false; S.ctrlBank = (steer || 0) / range; S.ctrlPitch = pitch || 0; L.update(1 / 60); } };
      const put = (x, z, tx, tz) => { S.x = x; S.z = z; S.speed = 0; M.air = false; M.vy = 0; S.y = L.monGround(x, z, L.terrainEff(x, z)).y; M.groundPrev = S.y; S.heading = Math.atan2(-(tx - x), -(tz - z)); L.updateScenery(x, z, false); L.monSnapCamera(); L.api.clearStick(); for (let i = 0; i < 20; i++) L.update(1 / 60); };
      const near = (cx, cz, R, f) => { let best = null, bd = 1e9; L.forEachSolid(b => { const d = Math.hypot(b.x - cx, b.z - cz); if (d < R && d < bd && f(b)) { bd = d; best = b; } }); return best; };
      window.__hold = () => {};
      if (what === "picker") {
        L.api.clearStick();
        document.getElementById("screenVehicle").classList.remove("hiddenS");
        return { what };
      }
      document.getElementById("screenVehicle").classList.add("hiddenS");
      L.api.setVehicle("monster"); L.api.spawnAt(0, 0); L.api.skipScreens();
      L.api.setView(seat !== "seat");
      L.api.clearStick(); for (let i = 0; i < 30; i++) L.update(1 / 60);
      let note = {};
      if (what === "ramp") { for (let i = 0; i < 600 && !M.onRamp; i++) drive(1); drive(25); }
      else if (what === "jump") { let top = -1e9; for (let i = 0; i < 900; i++) { drive(1); if (M.air && M.vy < 0.5) break; } note.over = +(S.y - L.mtruck.ramp.y1).toFixed(1); }
      else if (what === "crush" || what === "popped" || what === "before") {
        const ny = L.cities.ny; put(ny.ax + 300, ny.az + 300, ny.ax, ny.az); for (let i = 0; i < 60; i++) L.update(1 / 60);
        // the same building for "before", "crush" and "popped": chosen once
        if (!window.__crushB) {
          const b0 = near(ny.ax, ny.az, 1500, b => b.mesh && b.mesh.isCityProxy && !L.__lpIsHidden(b) && L.monCanCrush(b) && b.hw > 6 &&
            [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !L.solidCol(b.x + dx * (b.hw + 14), b.z + dz * (b.hd + 14), b.y0 + 3, b.y0 + 9, 5.5, L.SOLID.CAR, o => o === b)));
          const d0 = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dz]) => !L.solidCol(b0.x + dx * (b0.hw + 14), b0.z + dz * (b0.hd + 14), b0.y0 + 3, b0.y0 + 9, 5.5, L.SOLID.CAR, o => o === b0));
          window.__crushB = { b: b0, d: d0 };
        }
        const b = window.__crushB.b, d = window.__crushB.d;
        const vx = b.x + d[0] * (b.hw + 30), vz = b.z + d[1] * (b.hd + 30);
        put(vx, vz, b.x, b.z);
        if (what === "before") { note.hidden = L.__lpIsHidden(b); return { what, ...note }; }
        const c0 = L.flags.monCrushes || 0;
        for (let i = 0; i < 400 && (L.flags.monCrushes || 0) === c0; i++) drive(1);
        drive(what === "crush" ? (seat === "seat" ? 22 : 5) : 60 * 2);
        if (what === "popped") {
          // away (out of its popR), long enough, and back to the very spot the
          // "before" frame was taken from, facing it
          put(b.x + d[0] * (b.hw + 260), b.z + d[1] * (b.hd + 260), b.x, b.z);
          for (let i = 0; i < 60 * (MON.popAfter + 1); i++) L.update(1 / 60);
          note.back = !L.__lpIsHidden(b);
          put(vx, vz, b.x, b.z);
        }
      } else if (what === "tower") {
        const ny = L.cities.ny; put(ny.ax + 300, ny.az + 300, ny.ax, ny.az);
        const b = near(ny.ax, ny.az, 2500, b => b.mesh && b.mesh.isCityProxy && !L.__lpIsHidden(b) && !L.monCanCrush(b) && b.y0 < L.terrainEff(b.x, b.z) + 6 &&
          [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !L.solidCol(b.x + dx * (b.hw + 14), b.z + dz * (b.hd + 14), b.y0 + 3, b.y0 + 9, 5.5, L.SOLID.CAR, o => o === b)));
        if (!b) return { what, skipped: true };
        const d = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dz]) => !L.solidCol(b.x + dx * (b.hw + 14), b.z + dz * (b.hd + 14), b.y0 + 3, b.y0 + 9, 5.5, L.SOLID.CAR, o => o === b));
        put(b.x + d[0] * (b.hw + 16), b.z + d[1] * (b.hd + 16), b.x, b.z);
        drive(120);
      } else if (what === "house") {
        put(600, -1500, 600, -2000); L.updateScenery(S.x, S.z, true); for (let i = 0; i < 30; i++) L.update(1 / 60);
        let b = near(S.x, S.z, 3000, b => b.idx !== undefined && L.monCanCrush(b));
        const bx = b.x, bz = b.z;
        put(bx + b.hw + 35, bz, bx, bz);
        b = near(bx, bz, 1, o => o.idx !== undefined) || b;
        const c0 = L.flags.monCrushes || 0;
        for (let i = 0; i < 400 && (L.flags.monCrushes || 0) === c0; i++) drive(1);
        drive(seat === "seat" ? 22 : 4);
      } else if (what === "traffic") {
        const atGrade = s => { const q = L.hwySampleAt(s); return Math.abs(q.y - L.terrainEff(q.x, q.z)) < 1.5; };
        // a flat stretch well away from the arena: go there, and let the traffic come round him
        let s0 = 0;
        for (let s = 1500; s < L.highway.length - 1500; s += 50) { const q = L.hwySampleAt(s); if (Math.abs(q.z - 650) > 2500 && [-300, -150, 0, 150, 300].every(o => atGrade(s + o))) { s0 = s; break; } }
        { const q = L.hwySampleAt(s0); put(q.x - q.fz * 60, q.z + q.fx * 60, q.x, q.z); for (let i = 0; i < 180; i++) L.update(1 / 60); }
        const t = L.highway.traffic.filter(t => t.alive && t.wx !== undefined)
          .sort((a, b) => Math.abs(a.s - s0) - Math.abs(b.s - s0))[0];
        if (!t) return { what, skipped: "no traffic" };
        const q = L.hwySampleAt(t.s + t.dir * 90), n = L.hwyNearest(t.wx, t.wz), x = q.x - q.fz * n.lateral, z = q.z + q.fx * n.lateral;
        put(x, z, t.wx, t.wz); S.y = Math.max(S.y, q.y);
        const k0 = L.flags.monKnocks || 0;
        for (let i = 0; i < 480 && (L.flags.monKnocks || 0) === k0; i++) { if (t.alive) S.heading = Math.atan2(-(t.wx - S.x), -(t.wz - S.z)); drive(1); }
        // a beat after the knock: the car is spinning away, still in shot
        L.api.clearStick(); for (let i = 0; i < (seat === "seat" ? 6 : 24); i++) L.update(1 / 60);
      } else if (what === "shore") {
        const F = L.TUNE.fireworksBarge; let sx = F.x + 400, sz = F.z;
        for (let d = 0; d < 1500 && L.terrainEff(sx, sz) < L.seaLevelAt(sx, sz) + 1; d += 20) sx += 20;
        put(sx + 60, sz, F.x, F.z); drive(60 * 6);
      }
      return { what, ...note, crushes: L.flags.monCrushes || 0, y: +S.y.toFixed(1), sp: +S.speed.toFixed(1), air: M.air };
    }, v);
    await page.evaluate(() => { const f = document.getElementById("flash"); f.style.transition = "none"; f.classList.remove("on"); });
    await page.evaluate(() => { for (let i = 0; i < 3; i++) { window.__hold(); window.__paint(); } });
    const file = path.join(out, v + ".png");
    await page.screenshot({ path: file, timeout: 180000 });
    console.log("wrote", file, JSON.stringify(info));
  }
  await browser.close(); srv.close();
}
module.exports = render;
if (require.main === module) {
  const args = process.argv.slice(2), root = args[0] && fs.existsSync(path.join(args[0], "cockpit")) ? args.shift() : path.join(__dirname, "..");
  render(path.resolve(root), args.length ? args : DEFAULT);
}
