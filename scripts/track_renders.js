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
//   deck-seat   on the start deck: the exit lane's gantry ahead, to the right
//   lane        on the exit lane, going down beside the tower
//   v140 (render with PORTRAIT=1 for the iPad as he holds it):
//   signC-seat / signC-chase / signD-chase   coming up to the three-way forks: the sign
//   jumpB / jumpC / jumpD   in the air over the small, middle and big jumps
//   loopC / loopD           upside down in the two new loops
//   air2                    the new forks from a helicopter
//   node scripts/track_renders.js [root] [views...]    -> evidence/track/
const path = require("path"), fs = require("fs");
const { launch, openGame, serve } = require("./art_rig.js");

async function render(root, views) {
  const out = process.env.OUT || path.resolve(__dirname, "..", "evidence", "track");
  fs.mkdirSync(out, { recursive: true });
  const port = +(process.env.PORT || 8196), srv = serve(root, port), browser = await launch();
  const page = await openGame(browser, port, process.env.PORTRAIT ? { width: 820, height: 1180 } : { width: 1280, height: 800 });
  // the first frame painted after load comes out white (the art is still being
  // uploaded): warm up with a throwaway paint and screenshot
  await page.evaluate(() => { window.__lp.api.skipScreens(); window.__hold = () => {}; for (let i = 0; i < 3; i++) window.__paint(); });
  await page.screenshot({ timeout: 180000 });
  for (const v of views) {
    await page.evaluate((v) => {
      const L = window.__lp, st = L.state, T = L.trk;
      L.api.skipScreens();
      const S = T.order.flatMap(p => p.S);
      let cx = 0, cz = 0; for (const q of S) { cx += q.x; cz += q.z; } cx /= S.length; cz /= S.length;
      let hold = () => {};
      if (v === "air2") {
        L.api.setVehicle("helicopter"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
        const a = T.segs.main3.S[0], b = T.segs.main4.S[0], mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
        const P = [mx + 260, Math.max(a.y, b.y) + 170, mz + 200];
        hold = () => { st.phase = "AIRBORNE"; st.x = P[0]; st.y = P[1]; st.z = P[2]; heli.vx = heli.vz = heli.vy = 0; heli.altitude = P[1]; heli.target = null;
                       st.heading = Math.atan2(-(mx - P[0]), -(mz - P[2])); };
        L.api.setView(true);
      } else if (v === "air") {
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
        L.api.setView(!v.split("@")[0].endsWith("seat"));
        T.on = true; T.lift = null; T.air = null; T.bang = null; T.bounce = null;
        let seg = "main0", s = 24, vel = 12;
        const topOf = (id, n) => { const sg = T.segs[id]; let best = 0, by = -1e9, k = 0, inLoop = false;
          for (const q of sg.S) { if (q.type === "loop" && !inLoop) { inLoop = true; k++; } if (q.type !== "loop") inLoop = false; if (inLoop && k === n && q.y > by) { by = q.y; best = q.s; } } return best; };
        if (v.startsWith("loop")) { s = topOf("main0", 1) - 2; vel = 17; }
        if (v === "triple") { seg = "main4"; s = topOf("main4", 2) - 18; vel = 26; }
        if (v === "cork") { seg = "A_stunt"; s = 70; vel = 24; }
        if (v.startsWith("deck")) { seg = "deck"; s = +(v.split("@")[1] || 0); vel = 0; }
        if (v === "lane") { seg = "exit"; s = 70; vel = 12; }
        if (v.startsWith("signC") || v.startsWith("signD")) { seg = v.startsWith("signC") ? "main2" : "main3"; const sg = T.segs[seg], sign = T.signs.find(k => k.seg === seg); s = sign.s - 70; vel = 0; }
        if (v === "loopC") { seg = "C_loop"; s = topOf("C_loop", 1) - 2; vel = 17; }
        if (v === "loopD") { seg = "D_loop"; s = topOf("D_loop", 1) - 2; vel = 19; }
        if (v.startsWith("jump")) {
          // run it for real off the kicker, and hold the frame high over the gap
          const id = v === "jumpB" ? "B_stunt:0" : v === "jumpC" ? "C_jump:0" : "D_jump:0";
          T.seg = id; T.s = Math.max(0, T.segs[id].len - 40); T.v = 40;
          for (let i = 0; i < 60 * 6; i++) { st.touching = true; st.touchIsPoint = false; st.ctrlBank = 0; L.update(1 / 60); if (T.air && T.air.t > 0.4 && T.air.vy < 0.5) break; }
          st.touching = false;
          window.__hold = () => {};
          return;
        }
        if (v === "net") { seg = T.order[T.order.length - 1].id; s = T.order[T.order.length - 1].len - 1; vel = 40; }
        T.seg = seg; T.s = s; T.v = vel;
        hold = v === "net" ? () => {} : () => { T.seg = seg; T.s = s; T.v = vel; };
        if (v === "net") { for (let i = 0; i < 120; i++) { st.touching = true; L.update(1 / 60); if (T.air && T.air.t > 0.8) break; } }
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
  render(path.resolve(root), args.length ? args : ["drop-seat", "loop-chase", "loop-seat", "triple", "cork", "net", "air", "hwy", "deck-seat", "deck", "lane"]);
}
