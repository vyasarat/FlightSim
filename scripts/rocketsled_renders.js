"use strict";
// The rocket sled, rendered through the game's own loop, portrait, to LOOK at.
// Each view is `<vantage>-<seat|chase>@<seconds after the countdown starts>`
// (a negative time is the sled standing armed, the countdown held off):
//   south    southbound, just out of the mountain tunnel, facing down the road
//   mid      southbound, level with the start tower
//   wallS    southbound, 300 m short of the wall
//   north    northbound, 500 m south of the wall, facing up the road at it
//   drive    REALLY driving, hands-off, southbound out of the tunnel: the time
//            counts from the moment the sled sets itself off (driveN: northbound)
//   heli     the helicopter 260 m west of the wall, 50 m up, facing it
//   plane    the prop, 900 m out, 200 m up, nose at the sled
// The countdown starts at 0; the run at 3; the smash ~7.6; the chutes ~8;
// it stops ~11; rolls home from ~13; the wall rebuilds from ~18.
//   node scripts/rocketsled_renders.js [root] [views...]    -> evidence/rocketsled/
const path = require("path"), fs = require("fs");
const { launch, openGame, serve } = require("./art_rig.js");

const DEFAULT = ["south-seat@-1", "south-chase@-1", "drive-seat@1", "drive-seat@3.4", "drive-chase@4.5", "drive-seat@5.5", "drive-seat@7.8", "drive-chase@8.2",
  "driveN-seat@7.8", "driveN-chase@9.5", "heliS-chase@-1", "heliS-chase@0.5", "heliS-chase@1.5", "heliS-chase@3.2", "heli-chase@7.8",
  "heliC-chase@10.5", "heliN-chase@-1", "heliN-chase@21", "heliN-chase@26", "plane-seat@-1", "plane-seat@5"];

async function render(root, views, outDir) {
  const out = outDir || path.resolve(__dirname, "..", "evidence", "rocketsled");
  fs.mkdirSync(out, { recursive: true });
  const port = +(process.env.PORT || 8198), srv = serve(root, port), browser = await launch();
  const page = await openGame(browser, port, { width: 820, height: 1180 });
  await page.evaluate(() => { window.__lp.api.skipScreens(); window.__hold = () => {}; for (let i = 0; i < 3; i++) window.__paint(); });
  await page.screenshot({ timeout: 180000 });
  // the first view painted after load comes out white: paint it twice, keep the second
  for (const v of [views[0], ...views]) {
    await page.evaluate((v) => {
      const L = window.__lp, st = L.state, T = L.TUNE.rocketSled, S = L.sled;
      const vantage = v.slice(0, v.indexOf("-")), seatAt = v.slice(v.indexOf("-") + 1);
      const [seat, atS] = seatAt.split("@");
      const at = +atS;
      L.api.skipScreens();
      L.sledReset(); if (L.lsReset) L.lsReset();
      const w = L.sledWallWorld();
      let hold = () => {};
      if (vantage === "drive" || vantage === "driveN") {
        // really driving, hands-off: out of the tunnel southbound (or up from the
        // casinos northbound), and the sled sets itself off when he points at it.
        // `at` counts from that moment.
        L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
        const north = vantage === "driveN";
        const q = L.hwySampleAt(L.hwyNearest(150, north ? T.s[1] - 900 : -1500).s), off = (north ? -1 : 1) * (L.HW.medianW / 2 + L.HW.laneW * 0.5);
        st.x = q.x - q.fz * off; st.z = q.z + q.fx * off; st.y = q.y; st.speed = 0;
        st.heading = north ? Math.atan2(q.fx, q.fz) : Math.atan2(-q.fx, -q.fz);
        L.api.setView(seat === "chase");
        const c0 = L.flags.sledCountdowns || 0;
        for (let i = 0; i < 60 * 90 && (L.flags.sledCountdowns || 0) === c0; i++) { L.api.setStick(0, 0); L.update(1 / 60); }
        for (let i = 0; i < Math.round(at * 60); i++) { L.api.setStick(0, 0); L.update(1 / 60); }
        window.__hold = () => L.api.setStick(0, 0);
        window.__armR = T.armR;
        return;
      }
      if (vantage === "plane") {
        L.api.setVehicle("prop"); L.api.placeOnRunway(); for (let i = 0; i < 5; i++) L.update(1 / 60);
        L.api.teleportAirborne(3000, 0, 250, 0);
        const x = S.x + 450, z = S.z + 780, y = L.terrainEff(x, z) + 200;
        hold = () => { st.phase = "AIRBORNE"; st.x = x; st.y = y; st.z = z; st.heading = Math.atan2(-(w.x - x), -(w.z - z)); st.pitch = -3; st.bank = 0; st.speed = st.vp.cruiseSpeed; };
      } else if (vantage === "heliS" || vantage === "heliN" || vantage === "heliC") {
        // heliS: close on the sled at the start, from the west; heliN: 300 m north
        // of the wall, facing its north face; heliC: beside where the sled stops
        L.api.setVehicle("helicopter"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
        const at0 = (d) => ({ x: T.n[0] + S.dirX * d, z: T.n[1] + S.dirZ * d });
        let x, z, y, tx, tz;
        if (vantage === "heliS") { const p = at0(10); tx = p.x; tz = p.z; x = p.x - 115; z = p.z - 50; y = T.railY + 22; }
        else if (vantage === "heliN") { tx = w.x; tz = w.z; x = w.x + 30; z = w.z - S.dirZ * 300; y = T.railY + 36; }
        else { const p = at0(500); tx = p.x; tz = p.z; x = p.x - 150; z = p.z + 30; y = T.railY + 30; }
        hold = () => { st.phase = "AIRBORNE"; st.x = x; st.y = y; st.z = z; L.heli.vx = L.heli.vz = L.heli.vy = 0; L.heli.altitude = y; L.heli.target = null;
                       st.heading = Math.atan2(-(tx - x), -(tz - z)); };
      } else if (vantage === "heli") {
        L.api.setVehicle("helicopter"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
        const x = w.x - 260, z = w.z + 60, y = L.terrainEff(x, z) + 50;
        hold = () => { st.phase = "AIRBORNE"; st.x = x; st.y = y; st.z = z; L.heli.vx = L.heli.vz = L.heli.vy = 0; L.heli.altitude = y; L.heli.target = null;
                       st.heading = Math.atan2(-(w.x - x), -(w.z - 60 - z)); };
      } else {
        L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
        const north = vantage === "north";
        const z = vantage === "south" ? -1960 : vantage === "mid" ? S.z - 60 : vantage === "wallS" ? w.z + 300 : w.z - 500;
        const q = L.hwySampleAt(L.hwyNearest(150, z).s), off = (north ? -1 : 1) * (L.HW.medianW / 2 + L.HW.laneW * 0.5);
        const x = q.x - q.fz * off, zz = q.z + q.fx * off;
        hold = () => { st.x = x; st.z = zz; st.y = q.y; st.speed = 0; st.heading = north ? Math.atan2(q.fx, q.fz) : Math.atan2(-q.fx, -q.fz); };
      }
      L.api.setView(seat === "chase");
      window.__hold = hold;
      const armR = T.armR;
      T.armR = 0;                      // never set off by the vantage itself: the clock below does it
      for (let i = 0; i < 150; i++) { hold(); L.update(1 / 60); }    // long enough for the helicopter's camera to settle
      if (at >= 0) {
        L.sledForce();
        for (let i = 0; i < Math.round(at * 60); i++) { hold(); L.update(1 / 60); }
      }
      hold();
      window.__armR = armR;
    }, v);
    await page.evaluate(() => { for (let i = 0; i < 3; i++) { window.__hold(); window.__paint(); } window.__lp.TUNE.rocketSled.armR = window.__armR; });
    const file = path.join(out, v.replace("@", "_") + ".png");
    await page.screenshot({ path: file, timeout: 180000 });
    console.log("wrote", file);
  }
  await browser.close(); srv.close();
}
module.exports = render;
if (require.main === module) {
  const args = process.argv.slice(2), root = args[0] && fs.existsSync(path.join(args[0], "cockpit")) ? args.shift() : path.join(__dirname, "..");
  render(path.resolve(root), args.length ? args : DEFAULT);
}
