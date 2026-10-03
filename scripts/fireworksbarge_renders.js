"use strict";
// The fireworks barge, rendered through the game's own loop, portrait, to LOOK at.
// Each view is `<vantage>-<seat|chase>@<seconds after the countdown starts>`
// (a negative time is the barge armed, the countdown held off):
//   drive    REALLY driving, hands-off, southbound; time counts from the moment
//            the barge sets itself off (driveN: northbound)
//   road     parked on the southbound carriageway 900 m north of it, facing down the road
//   heli     the helicopter 380 m east-south-east of it over the motorway, facing it
//   close    the helicopter 120 m off the barge, 25 m up
//   plane    the prop, 900 m out, 220 m up, nose at it
// The countdown starts at 0; the first shell at 3, its burst ~5.4; the finale's
// shells go up at 11.2-12.4 and burst ~13.5-15.
//   node scripts/fireworksbarge_renders.js [root] [views...]    -> evidence/fireworks/
const path = require("path"), fs = require("fs");
const { launch, openGame, serve } = require("./art_rig.js");

const DEFAULT = ["road-seat@-1", "road-chase@-1", "close-chase@-1", "drive-seat@1", "drive-seat@5.6", "drive-seat@9",
  "drive-chase@9", "drive-seat@14", "drive-chase@14.4", "driveN-seat@14", "heli-chase@8", "heli-chase@14.2", "plane-seat@14", "close-chase@3.3"];

async function render(root, views, outDir) {
  const out = outDir || path.resolve(__dirname, "..", "evidence", "fireworks");
  fs.mkdirSync(out, { recursive: true });
  const port = +(process.env.PORT || 8199), srv = serve(root, port), browser = await launch();
  const page = await openGame(browser, port, { width: 820, height: 1180 });
  await page.evaluate(() => { window.__lp.api.skipScreens(); window.__hold = () => {}; for (let i = 0; i < 3; i++) window.__paint(); });
  await page.screenshot({ timeout: 180000 });
  for (const v of [views[0], ...views]) {
    await page.evaluate((v) => {
      const L = window.__lp, st = L.state, T = L.TUNE.fireworksBarge, F = L.fbarge;
      const vantage = v.slice(0, v.indexOf("-")), seatAt = v.slice(v.indexOf("-") + 1);
      const [seat, atS] = seatAt.split("@");
      const at = +atS;
      L.api.skipScreens();
      L.fbReset(); if (L.sledReset) L.sledReset(); if (L.lsReset) L.lsReset();
      window.__armR = T.armR; window.__carView = T.carView;
      if (vantage === "drive" || vantage === "driveN") {
        L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
        const north = vantage === "driveN";
        const q = L.hwySampleAt(L.hwyNearest(T.x, north ? T.z - 2400 : T.z + 2400).s), off = (north ? -1 : 1) * (L.HW.medianW / 2 + L.HW.laneW * 0.5);
        st.x = q.x - q.fz * off; st.z = q.z + q.fx * off; st.y = q.y; st.speed = 0;
        st.heading = north ? Math.atan2(q.fx, q.fz) : Math.atan2(-q.fx, -q.fz);
        L.api.setView(seat === "chase");
        const c0 = L.flags.fbCountdowns || 0;
        for (let i = 0; i < 60 * 90 && (L.flags.fbCountdowns || 0) === c0; i++) { L.api.setStick(0, 0); L.update(1 / 60); }
        for (let i = 0; i < Math.round(at * 60); i++) { L.api.setStick(0, 0); L.update(1 / 60); }
        window.__hold = () => L.api.setStick(0, 0);
        return;
      }
      let hold = () => {};
      if (vantage === "plane") {
        L.api.setVehicle("prop"); L.api.placeOnRunway(); for (let i = 0; i < 5; i++) L.update(1 / 60);
        L.api.teleportAirborne(3000, 0, 250, 0);
        const x = T.x + 500, z = T.z + 780, y = 220;
        hold = () => { st.phase = "AIRBORNE"; st.x = x; st.y = y; st.z = z; st.heading = Math.atan2(-(T.x - x), -(T.z - z)); st.pitch = 4; st.bank = 0; st.speed = st.vp.cruiseSpeed; };
      } else if (vantage === "heli" || vantage === "close") {
        L.api.setVehicle("helicopter"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
        const far = vantage === "heli";
        const x = T.x + (far ? 520 : 100), z = T.z - (far ? 200 : 60), y = far ? 40 : 25;
        hold = () => { st.phase = "AIRBORNE"; st.x = x; st.y = y; st.z = z; L.heli.vx = L.heli.vz = L.heli.vy = 0; L.heli.altitude = y; L.heli.target = null;
                       st.heading = Math.atan2(-(T.x - x), -(T.z - z)); };
      } else {
        L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
        const q = L.hwySampleAt(L.hwyNearest(T.x, T.z + 900).s), off = L.HW.medianW / 2 + L.HW.laneW * 0.5;
        const x = q.x - q.fz * off, z = q.z + q.fx * off;
        hold = () => { st.x = x; st.z = z; st.y = q.y; st.speed = 0; st.heading = Math.atan2(-q.fx, -q.fz); };
      }
      L.api.setView(seat === "chase");
      window.__hold = hold;
      T.armR = 0; T.carView = -1e6;          // never set off by the vantage itself: the clock below does it
      for (let i = 0; i < 150; i++) { hold(); L.update(1 / 60); }
      if (at >= 0) { L.fbForce(); for (let i = 0; i < Math.round(at * 60); i++) { hold(); L.update(1 / 60); } }
      hold();
    }, v);
    await page.evaluate(() => { for (let i = 0; i < 3; i++) { window.__hold(); window.__paint(); } const T = window.__lp.TUNE.fireworksBarge; T.armR = window.__armR; T.carView = window.__carView; });
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
