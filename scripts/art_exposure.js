"use strict";
// ACES exposure sweep: the same vantage with the tone map off and at several
// exposures, side by side.  node scripts/art_exposure.js <vantage,...> <exp,...>
const fs = require("fs"), path = require("path");
const { launch, openGame, serve } = require("./art_rig.js");
const src = fs.readFileSync(path.join(__dirname, "art_renders.js"), "utf8");
const VANTAGES = eval("(" + src.slice(src.indexOf("const VANTAGES = {") + 17, src.indexOf("\n};\n", src.indexOf("const VANTAGES = {")) + 2) + ")");
const names = (process.argv[2] || "ny-300m").split(",");
const exps = (process.argv[3] || "0,1,1.2,1.4").split(",").map(Number);
const OUT = path.resolve(__dirname, "..", "evidence", "art", "exposure");
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = serve(path.resolve(__dirname, ".."), 8190);
  const b = await launch();
  for (const name of names) {
    const pg = await openGame(b, 8190, { width: 820, height: 1180 });
    await pg.evaluate((s) => {
      const L = window.__lp; performance.now = () => window.__simTime; L.api.skipScreens();
      window.__hold = eval("(" + s + ")")() || (() => {});
      L.api.setView(true);
      for (let i = 0; i < 270; i++) { L.update(1 / 60); window.__hold(); }
    }, VANTAGES[name].toString());
    for (const e of exps) {
      await pg.evaluate((e) => {
        const L = window.__lp, r = L.renderer;
        r.toneMapping = e > 0 ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
        r.toneMappingExposure = e || 1;
        L.scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
        for (let i = 0; i < 3; i++) { window.__paint(); window.__hold(); }
      }, e);
      await pg.screenshot({ path: path.join(OUT, `${name}-${e}.png`) });
    }
    await pg.close();
  }
  await b.close(); srv.close();
})();
