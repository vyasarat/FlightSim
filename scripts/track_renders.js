"use strict";
// The giant toy track, rendered through the game's own loop (the art rig's
// method: a vehicle is posed and held, and the frame is painted), to LOOK at:
//   drop-seat   from the driving seat, going over the lip of the launch drop
//   loop-chase  upside down at the top of the first loop, from behind
//   loop-seat   ... and from the seat
//   triple      into the triple loop
//   cork        in the double corkscrew
//   net         off the ski-jump, into the net
//   air         the whole tangle from a helicopter
//   hwy         from the motorway, as he drives past
//   node scripts/track_renders.js [root] [views...]    -> evidence/track/
const path = require("path"), fs = require("fs");
const { launch, openGame, serve } = require("./art_rig.js");

async function render(root, views) {
  const out = path.resolve(__dirname, "..", "evidence", "track");
  fs.mkdirSync(out, { recursive: true });
  const port = +(process.env.PORT || 8196), srv = serve(root, port), browser = await launch();
  const page = await openGame(browser, port, { width: 1280, height: 800 });
  for (const v of views) {
    await page.evaluate((v) => {
      const L = window.__lp, st = L.state, T = L.trk;
      L.api.skipScreens();
      const S = T.order.flatMap(p => p.S);
      let cx = 0, cz = 0; for (const q of S) { cx += q.x; cz += q.z; } cx /= S.length; cz /= S.length;
      let hold = () => {};
      if (v === "air") {
        L.api.setVehicle("helicopter"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
        const P = [cx + 300, T.g0 + 220, cz + 260];
        hold = () => { st.phase = "AIRBORNE"; st.x = P[0]; st.y = P[1]; st.z = P[2]; heli.vx = heli.vz = heli.vy = 0; heli.altitude = P[1]; heli.target = null;
                       st.heading = Math.atan2(-(cx - P[0]), -(cz - P[2])); };
        L.api.setView(true);
      } else if (v === "hwy") {
        L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
        const n = L.hwyNearest(cx, cz), q = L.hwySampleAt(n.s - 350), lat = -(L.HW.medianW / 2 + L.HW.laneW * 0.5);
        const x = q.x - q.fz * lat, z = q.z + q.fx * lat;
        hold = () => { st.x = x; st.z = z; st.y = q.y; st.speed = 0; st.heading = Math.atan2(-(cx - x), -(cz - z)); };
        L.api.setView(true);
      } else {
        L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
        L.api.setView(!v.endsWith("seat"));
        T.on = true; T.lift = null; T.air = null; T.bang = null; T.bounce = null;
        let seg = "main0", s = 24, vel = 12;
        const topOf = (id, n) => { const sg = T.segs[id]; let best = 0, by = -1e9, k = 0, inLoop = false;
          for (const q of sg.S) { if (q.type === "loop" && !inLoop) { inLoop = true; k++; } if (q.type !== "loop") inLoop = false; if (inLoop && k === n && q.y > by) { by = q.y; best = q.s; } } return best; };
        if (v.startsWith("loop")) { s = topOf("main0", 1) - 2; vel = 17; }
        if (v === "triple") { seg = "main2"; s = topOf("main2", 2) - 18; vel = 26; }
        if (v === "cork") { seg = "A_stunt"; s = 70; vel = 24; }
        if (v === "net") { seg = T.order[T.order.length - 1].id; s = T.order[T.order.length - 1].len - 1; vel = 40; }
        T.seg = seg; T.s = s; T.v = vel;
        hold = v === "net" ? () => {} : () => { T.seg = seg; T.s = s; T.v = vel; };
        if (v === "net") { for (let i = 0; i < 70; i++) { st.touching = true; L.update(1 / 60); } }
      }
      window.__hold = hold;
      for (let i = 0; i < 90; i++) { hold(); L.update(1 / 60); }
      hold();
    }, v);
    await page.evaluate(() => { for (let i = 0; i < 3; i++) { window.__hold(); window.__paint(); } });
    await page.screenshot({ path: path.join(out, v + ".png"), timeout: 180000 });
    console.log("wrote", path.join(out, v + ".png"));
  }
  await browser.close(); srv.close();
}
module.exports = render;
if (require.main === module) {
  const args = process.argv.slice(2), root = args[0] && fs.existsSync(path.join(args[0], "cockpit")) ? args.shift() : path.join(__dirname, "..");
  render(path.resolve(root), args.length ? args : ["drop-seat", "loop-chase", "loop-seat", "triple", "cork", "net", "air", "hwy"]);
}
