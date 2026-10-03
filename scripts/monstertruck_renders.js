"use strict";
// The monster truck, rendered through the game's own loop, portrait, to LOOK at.
// Each view is `<vantage>-<seat|chase>@<seconds after the countdown starts>`
// (a negative time is the barge armed, the countdown held off):
//   drive    REALLY driving, hands-off, southbound; time counts from the moment
//            the barge sets itself off (driveN: northbound)
//   road     parked on the southbound carriageway 500 m north of the landing, facing down the road
//   heli     the helicopter 160 m west of the junk cars, 30 m up, facing them
//   close    the helicopter 70 m west of them, 14 m up
//   plane    the prop, 860 m out, 200 m up, nose at it
// The countdown starts at 0; the truck goes at 3, leaves the lip ~9.3, lands on
// the cars ~10.2, stops ~14, drives home ~15.5-90; the cars pop back as it goes.
//   node scripts/monstertruck_renders.js [root] [views...]    -> evidence/monstertruck/
const path = require("path"), fs = require("fs");
const { launch, openGame, serve } = require("./art_rig.js");

const DEFAULT = ["road-seat@-1", "road-chase@-1", "close-chase@-1", "drive-seat@1", "drive-seat@9.2", "drive-seat@10.6", "drive-chase@10.6",
  "drive-seat@12", "driveN-seat@10.6", "heli-chase@8.8", "heli-chase@9.9", "heli-chase@11.5", "heli-chase@13", "close-chase@11", "heli-chase@60", "plane-seat@9.9"];

async function render(root, views, outDir) {
  const out = outDir || path.resolve(__dirname, "..", "evidence", "monstertruck");
  fs.mkdirSync(out, { recursive: true });
  const port = +(process.env.PORT || 8200), srv = serve(root, port), browser = await launch();
  const page = await openGame(browser, port, { width: 820, height: 1180 });
  await page.evaluate(() => { window.__lp.api.skipScreens(); window.__hold = () => {}; for (let i = 0; i < 3; i++) window.__paint(); });
  await page.screenshot({ timeout: 180000 });
  for (const v of [views[0], ...views]) {
    await page.evaluate((v) => {
      const L = window.__lp, st = L.state, T0 = L.TUNE.monsterTruck, F = L.mtruck, Lnd = L.mtLanding(), T = { x: Lnd.x, z: Lnd.z, armR: T0.armR, carView: T0.carView };
      const vantage = v.slice(0, v.indexOf("-")), seatAt = v.slice(v.indexOf("-") + 1);
      const [seat, atS] = seatAt.split("@");
      const at = +atS;
      L.api.skipScreens();
      L.mtReset(); L.fbReset(); L.sledReset(); L.lsReset(); L.TUNE.fireworksBarge.carView = -1e6; L.TUNE.launchSite.armR = 0;
      window.__armR = T0.armR; window.__carView = T0.carView;
      if (vantage === "drive" || vantage === "driveN") {
        L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
        const north = vantage === "driveN";
        const q = L.hwySampleAt(L.hwyNearest(T.x, north ? -1500 : 2200).s), off = (north ? -1 : 1) * (L.HW.medianW / 2 + L.HW.laneW * 0.5);
        st.x = q.x - q.fz * off; st.z = q.z + q.fx * off; st.y = q.y; st.speed = 0;
        st.heading = north ? Math.atan2(q.fx, q.fz) : Math.atan2(-q.fx, -q.fz);
        L.api.setView(seat === "chase");
        const c0 = L.flags.mtCountdowns || 0;
        for (let i = 0; i < 60 * 90 && (L.flags.mtCountdowns || 0) === c0; i++) { L.api.setStick(0, 0); L.update(1 / 60); }
        for (let i = 0; i < Math.round(at * 60); i++) { L.api.setStick(0, 0); L.update(1 / 60); }
        window.__hold = () => L.api.setStick(0, 0);
        return;
      }
      let hold = () => {};
      if (vantage === "plane") {
        L.api.setVehicle("prop"); L.api.placeOnRunway(); for (let i = 0; i < 5; i++) L.update(1 / 60);
        L.api.teleportAirborne(3000, 0, 250, 0);
        const x = T.x - 500, z = T.z + 700, y = 200;
        hold = () => { st.phase = "AIRBORNE"; st.x = x; st.y = y; st.z = z; st.heading = Math.atan2(-(T.x - x), -(T.z - z)); st.pitch = 4; st.bank = 0; st.speed = st.vp.cruiseSpeed; };
      } else if (vantage === "heli" || vantage === "close") {
        L.api.setVehicle("helicopter"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
        const far = vantage === "heli";
        const x = T.x - (far ? 160 : 75), z = T.z + (far ? 60 : -10), y = F.groundY + (far ? 30 : 20);
        hold = () => { st.phase = "AIRBORNE"; st.x = x; st.y = y; st.z = z; L.heli.vx = L.heli.vz = L.heli.vy = 0; L.heli.altitude = y; L.heli.target = null;
                       st.heading = Math.atan2(-(T.x - x), -(T.z - z)); };
      } else {
        L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
        const q = L.hwySampleAt(L.hwyNearest(300, T.z + 500).s), off = L.HW.medianW / 2 + L.HW.laneW * 0.5;
        const x = q.x - q.fz * off, z = q.z + q.fx * off;
        hold = () => { st.x = x; st.z = z; st.y = q.y; st.speed = 0; st.heading = Math.atan2(-q.fx, -q.fz); };
      }
      L.api.setView(seat === "chase");
      window.__hold = hold;
      T0.armR = 0; T0.carView = -1e6;          // never set off by the vantage itself: the clock below does it
      for (let i = 0; i < 150; i++) { hold(); L.update(1 / 60); }
      if (at >= 0) { L.mtForce(); for (let i = 0; i < Math.round(at * 60); i++) { hold(); L.update(1 / 60); } }
      hold();
    }, v);
    // the red-light camera's flash (lights.js) is taken down by a 110 ms wall-clock
    // timeout this rig's compressed time never reaches: in the game it is a blink,
    // here it would wash the whole frame white. Take it down as the game would have.
    await page.evaluate(() => { const f = document.getElementById("flash"); f.style.transition = "none"; f.classList.remove("on"); });
    await page.evaluate(() => { for (let i = 0; i < 3; i++) { window.__hold(); window.__paint(); } const T = window.__lp.TUNE.monsterTruck; T.armR = window.__armR; T.carView = window.__carView; });
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
