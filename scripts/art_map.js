"use strict";
// Top-down survey of a stretch of the world: ground height, water, the airport
// and highway corridors, and every solid. Used to site the two cities.
//   node scripts/art_map.js <x0> <z0> <x1> <z1> <name> [metresPerPixel]
const fs = require("fs"), path = require("path");
const { launch, openGame, serve } = require("./art_rig.js");
const [x0, z0, x1, z1] = process.argv.slice(2, 6).map(Number);
const NAME = process.argv[6] || "map";
const MPP = Number(process.argv[7] || 5);
(async () => {
  const srv = serve(path.resolve(__dirname, ".."), 8183);
  const browser = await launch();
  const pg = await openGame(browser, 8183, { width: 400, height: 300 });
  const url = await pg.evaluate(([x0, z0, x1, z1, mpp]) => {
    const L = window.__lp;
    L.api.skipScreens(); L.api.setVehicle("prop"); L.api.placeOnRunway();
    for (let i = 0; i < 30; i++) L.update(1 / 60);
    const W = Math.round((x1 - x0) / mpp), H = Math.round((z1 - z0) / mpp);
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const cx = c.getContext("2d"); const img = cx.createImageData(W, H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const x = x0 + i * mpp, z = z1 - j * mpp;       // north (+z) up
      const h = L.terrainEff(x, z), sea = L.seaLevelAt(x, z);
      let r, g, b;
      if (h < sea) { r = 40; g = 90; b = 190; }
      else { const t = Math.max(0, Math.min(1, (h - sea) / 60)); r = 90 + t * 150; g = 150 + t * 90; b = 70 + t * 150; }
      if (L.flattenMask(x, z) > 0.02) { r = 170; g = 170; b = 170; }
      if (L.hwyInCorridor && L.hwyInCorridor(x, z, 0)) { r = 240; g = 150; b = 40; }
      else if (L.inCorridor(x, z, 0)) { r = 230; g = 60; b = 60; }
      const k = (j * W + i) * 4; img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 255;
    }
    cx.putImageData(img, 0, 0);
    cx.strokeStyle = "#000"; cx.lineWidth = 1;
    L.forEachSolid(s => {
      if (s.x + s.hw < x0 || s.x - s.hw > x1 || s.z + s.hd < z0 || s.z - s.hd > z1) return;
      cx.strokeRect((s.x - s.hw - x0) / mpp, (z1 - s.z - s.hd) / mpp, 2 * s.hw / mpp, 2 * s.hd / mpp);
    });
    cx.fillStyle = "#fff"; cx.font = "10px sans-serif";
    for (const R of L.ROUTE_LANDMARKS) {
      if (R.x < x0 || R.x > x1 || R.z < z0 || R.z > z1) continue;
      cx.fillText(R.name, (R.x - x0) / mpp, (z1 - R.z) / mpp);
    }
    // grid every 500 m
    cx.strokeStyle = "rgba(255,255,255,0.35)";
    for (let x = Math.ceil(x0 / 500) * 500; x <= x1; x += 500) { cx.beginPath(); cx.moveTo((x - x0) / mpp, 0); cx.lineTo((x - x0) / mpp, H); cx.stroke(); cx.fillText(String(x), (x - x0) / mpp + 2, 10); }
    for (let z = Math.ceil(z0 / 500) * 500; z <= z1; z += 500) { cx.beginPath(); cx.moveTo(0, (z1 - z) / mpp); cx.lineTo(W, (z1 - z) / mpp); cx.stroke(); cx.fillText(String(z), 2, (z1 - z) / mpp - 2); }
    return c.toDataURL("image/png");
  }, [x0, z0, x1, z1, MPP]);
  const out = path.resolve(__dirname, "..", "evidence", "art", NAME + ".png");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(url.split(",")[1], "base64"));
  console.log("wrote", out);
  await browser.close(); srv.close();
})();
