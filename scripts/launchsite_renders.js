"use strict";
// The launch site, rendered through the game's own loop, portrait, to LOOK at.
// Each view is `<vantage>-<seat|chase>@<seconds after the countdown starts>`:
//   hwy      on the southbound motorway, 1.2 km short of the pad, facing down the road
//   mid      ... 700 m short of it
//   far      ... 2 km short of it (the whole climb fits)
//   plane    the prop, 1 km out at 250 m, nose at it
//   heli     the helicopter hovering 400 m off the landing pads
// The countdown starts at 0; ignition is at 5, liftoff 6.4, separation ~24.4,
// the boosters land ~44.4, the fresh stack rises from ~51.4. A negative time is
// the pad standing armed (the countdown is held off for the frame).
//   node scripts/launchsite_renders.js [root] [views...]    -> evidence/launchsite/
const path = require("path"), fs = require("fs");
const { launch, openGame, serve } = require("./art_rig.js");

const DEFAULT = ["hwy-seat@-1", "hwy-chase@-1", "hwy-chase@1", "hwy-seat@3", "hwy-seat@7.5", "hwy-chase@7.5", "mid-seat@10",
  "far-chase@16", "psep-seat@24.9", "psep-chase@26", "pburn-seat@40", "pburn-chase@43", "heli-chase@46", "plane-seat@-1", "plane-seat@9", "heli-chase@53"];

async function render(root, views, outDir) {
  const out = outDir || path.resolve(__dirname, "..", "evidence", "launchsite");
  fs.mkdirSync(out, { recursive: true });
  const port = +(process.env.PORT || 8197), srv = serve(root, port), browser = await launch();
  const page = await openGame(browser, port, { width: 820, height: 1180 });
  await page.evaluate(() => { window.__lp.api.skipScreens(); window.__hold = () => {}; for (let i = 0; i < 3; i++) window.__paint(); });
  await page.screenshot({ timeout: 180000 });
  // the first view painted after load comes out white: paint it twice, keep the second
  for (const v of [views[0], ...views]) {
    await page.evaluate((v) => {
      const L = window.__lp, st = L.state, T = L.TUNE.launchSite, S = L.lsite;
      const vantage = v.slice(0, v.indexOf("-")), seatAt = v.slice(v.indexOf("-") + 1);
      const [seat, atS] = seatAt.split("@");
      const at = +atS;
      L.api.skipScreens();
      L.lsReset();
      let hold = () => {};
      const lookAt = (x, z) => Math.atan2(-(T.x - x), -(T.z - z));
      if (vantage === "psep" || vantage === "pburn") {
        // the plane, level with what it is there to see: the separation ~780 m
        // up off the pad, or the landing burn low over the pads
        L.api.setVehicle("prop"); L.api.placeOnRunway(); for (let i = 0; i < 5; i++) L.update(1 / 60);
        L.api.teleportAirborne(3000, 0, 250, 0);
        const sep = vantage === "psep";
        const tx = sep ? T.x + 60 : (T.lz[0][0] + T.lz[1][0]) / 2, tz = sep ? T.z : (T.lz[0][1] + T.lz[1][1]) / 2;
        const x = tx - (sep ? 1100 : 700), z = tz + (sep ? 300 : 150);
        const y = sep ? S.padY + 700 : L.terrainEff(tx, tz) + 70;
        hold = () => { st.phase = "AIRBORNE"; st.x = x; st.y = y; st.z = z; st.heading = Math.atan2(-(tx - x), -(tz - z)); st.pitch = sep ? 2 : 4; st.bank = 0; st.speed = st.vp.cruiseSpeed; };
      } else if (vantage === "plane") {
        L.api.setVehicle("prop"); L.api.placeOnRunway(); for (let i = 0; i < 5; i++) L.update(1 / 60);
        L.api.teleportAirborne(3000, 0, 250, 0);
        const x = T.x - 500, z = T.z + 900, y = L.terrainEff(x, z) + 250;
        hold = () => { st.phase = "AIRBORNE"; st.x = x; st.y = y; st.z = z; st.heading = lookAt(x, z); st.pitch = 0; st.bank = 0; st.speed = st.vp.cruiseSpeed; };
      } else if (vantage === "heli") {
        L.api.setVehicle("helicopter"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
        // pulled back west of the road, the pad and both landing pads in front of it
        const cx = (T.x + T.lz[0][0] + T.lz[1][0]) / 3, cz = (T.z + T.lz[0][1] + T.lz[1][1]) / 3;
        const x = cx - 650, z = cz + 60, y = L.terrainEff(x, z) + 90;
        hold = () => { st.phase = "AIRBORNE"; st.x = x; st.y = y; st.z = z; L.heli.vx = L.heli.vz = L.heli.vy = 0; L.heli.altitude = y; L.heli.target = null;
                       st.heading = Math.atan2(-(cx - x), -(cz - z)); };
      } else {
        L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
        const sPad = L.hwyNearest(T.x, T.z).s;
        const back = vantage === "hwy" ? 1200 : vantage === "far" ? 2000 : 700;
        const q = L.hwySampleAt(sPad - back), off = L.HW.medianW / 2 + L.HW.laneW * 0.5;
        const x = q.x - q.fz * off, z = q.z + q.fx * off;
        hold = () => { st.x = x; st.z = z; st.y = q.y; st.speed = 0; st.heading = Math.atan2(-q.fx, -q.fz); };
      }
      L.api.setView(seat === "chase");
      window.__hold = hold;
      const armR = T.armR;
      if (at < 0) T.armR = 0;          // the armed pad, for the frame: held off
      for (let i = 0; i < 60; i++) { hold(); L.update(1 / 60); }
      if (at >= 0) {
        L.lsForce();
        for (let i = 0; i < Math.round(at * 60); i++) { hold(); L.update(1 / 60); }
      }
      hold();
      window.__armR = armR;
    }, v);
    await page.evaluate(() => { for (let i = 0; i < 3; i++) { window.__hold(); window.__paint(); } window.__lp.TUNE.launchSite.armR = window.__armR; });
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
