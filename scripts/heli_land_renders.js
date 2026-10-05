"use strict";
// The helicopter landing (v139), rendered through the game's own loop, portrait,
// to LOOK at. Each view is `<where>-<seat|chase>@<seconds holding down>`, from 40 m
// over the spot, the down button held the whole time (a negative time: a
// pointed-at spot 160 m off, down held from the start, so it comes in travelling):
//   roof     a city tower's roof            deck    the motorway where it is a bridge
//   carrier  the carrier's flight deck      lake    the great lake (it hovers)
//   field    a field beside the kites
//   bridge   New York's bridge over the water, looking along it (bridgeX: across it)
//   roofB    the same tower as roof, from the other side of its mast
// `@upN`: come down until settled, then hold UP for N seconds -- lifting off again.
//   node scripts/heli_land_renders.js [root] [views...]    -> evidence/heliland/
const path = require("path"), fs = require("fs");
const { launch, openGame, serve } = require("./art_rig.js");

const DEFAULT = ["roof-chase@3", "roof-chase@6", "roof-chase@9", "roof-seat@9", "roof-chase@-12", "roofB-chase@9", "roof-chase@up2",
  "bridge-chase@12", "bridgeX-chase@12", "bridge-chase@up2", "deck-chase@12",
  "carrier-chase@10", "carrier-chase@up2", "lake-chase@3", "lake-chase@12", "field-chase@4"];

async function render(root, views, outDir) {
  const out = outDir || process.env.OUT || path.resolve(__dirname, "..", "evidence", "heliland");
  fs.mkdirSync(out, { recursive: true });
  const port = +(process.env.PORT || 8201), srv = serve(root, port), browser = await launch();
  const page = await openGame(browser, port, { width: 820, height: 1180 });
  await page.evaluate(() => { window.__lp.api.skipScreens(); window.__hold = () => {}; for (let i = 0; i < 3; i++) window.__paint(); });
  await page.screenshot({ timeout: 180000 });
  for (const v of [views[0], ...views]) {
    const info = await page.evaluate((v) => {
      const L = window.__lp, st = L.state, H = L.heli;
      const where = v.slice(0, v.indexOf("-")), [seat, atS] = v.slice(v.indexOf("-") + 1).split("@");
      const up = /^up/.test(atS) ? +atS.slice(2) : 0, at = up ? 30 : +atS;
      L.api.skipScreens();
      L.api.setVehicle("helicopter"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
      if (L.carrierReset) L.carrierReset();
      let x, z, top;
      let heading = 0.6;
      if (where === "roof" || where === "roofB") {
        if (where === "roofB") heading = 0.6 + Math.PI;
        // the tallest clear roof in New York's blocks
        let best = null;
        L.forEachSolid(b => {
          if (b.kind !== "building" || b.o3 || b.cap || b.car !== undefined || b.hw < 9 || b.hd < 9 || b.z < 3000) return;
          if (!best || b.y1 > best.y1) best = b;
        });
        x = best.x; z = best.z; top = best.y1;
      } else if (where === "deck") {
        for (let s = 200; s < L.highway.length; s += 37) {
          const p = L.hwySampleAt(s);
          if (p.y - Math.max(L.terrainEff(p.x, p.z), L.seaLevelAt(p.x, p.z)) > 12) { x = p.x; z = p.z; top = p.y; break; }
        }
      } else if (where === "bridge" || where === "bridgeX") {
        // the longest bridge deck over water: New York's
        let best = null;
        L.forEachSolid(b => { if (b.kind === "bridge" && b.hw > 100 && L.terrainEff(b.x, b.z) < L.seaLevelAt(b.x, b.z) && (!best || b.hw > best.hw)) best = b; });
        x = best.x + best.hw * 0.3; z = best.z; top = best.y1;
        heading = where === "bridge" ? Math.PI / 2 + 0.35 : 0.25;
      } else if (where === "carrier") { x = L.carrier.x - 10; z = L.carrier.z - 40; top = L.carrier.deck; }
      else if (where === "lake") { x = L.TUNE.fireworksBarge.x + 90; z = L.TUNE.fireworksBarge.z + 60; top = L.seaLevelAt(x, z); }
      else { const k = L.targets.find(t => t.kind === "kite"); x = k.ax + 40; z = k.az + 30; top = L.terrainEff(x, z); }
      const travel = at < 0, T = Math.abs(at);
      const sx = travel ? x + 160 : x + 0.01, sz = z;
      st.x = sx; st.z = sz; st.y = top + 40; st.phase = "AIRBORNE"; st.speed = 0; st.heading = travel ? Math.PI / 2 : heading;
      H.altitude = st.y; H.vy = 0; H.vx = H.vz = 0;
      if (travel) { H.target = { x, y: top, z }; H.sky = false; }
      L.api.setView(seat === "chase");
      for (let i = 0; i < 30; i++) L.update(1 / 60);
      H.vertical = -1;
      let alarm = 0, bang = 0;
      for (let i = 0; i < Math.round(T * 60) && !(up && st.phase === "TAXI"); i++) { L.update(1 / 60); if (st.alarmOn) alarm++; if (st.exploding) bang++; }
      window.__hold = () => { if (st.phase !== "TAXI") H.vertical = -1; };
      if (up) {
        for (let i = 0; i < 60; i++) L.update(1 / 60);
        H.vertical = 1;
        for (let i = 0; i < Math.round(up * 60); i++) L.update(1 / 60);
        window.__hold = () => { H.vertical = 1; };
      }
      return { where, phase: st.phase, skid: +(st.y - L.TUNE.gearHeight).toFixed(2), top: +(+top).toFixed(2), alarm, bang };
    }, v);
    await page.evaluate(() => { const f = document.getElementById("flash"); f.style.transition = "none"; f.classList.remove("on"); });
    await page.evaluate(() => { for (let i = 0; i < 3; i++) { window.__hold(); window.__paint(); } });
    const file = path.join(out, v.replace("@", "_") + ".png");
    await page.screenshot({ path: file, timeout: 180000 });
    await page.evaluate(() => { window.__lp.heli.vertical = 0; });
    console.log("wrote", file, JSON.stringify(info));
  }
  await browser.close(); srv.close();
}
module.exports = render;
if (require.main === module) {
  const args = process.argv.slice(2), root = args[0] && fs.existsSync(path.join(args[0], "cockpit")) ? args.shift() : path.join(__dirname, "..");
  render(path.resolve(root), args.length ? args : DEFAULT);
}
