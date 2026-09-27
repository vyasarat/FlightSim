"use strict";
// Survey the two city sites from the live world, for build_city.py:
//   node scripts/city/site.js   ->  scripts/city/site-ny.json, site-ca.json
//
// A 4 m grid over each district's rectangle. A cell is BLOCKED if it is water
// (or within a metre and a half of it), in an airport corridor, in the road's
// corridor, on an airport pad, on the freight line, or near any solid that is
// not part of the cluster being replaced. The cities' own buildings (their
// solids carry a city proxy) are skipped, so a built city never blocks itself.
const fs = require("fs"), path = require("path");
const { launch, openGame, serve } = require("../art_rig.js");

const SITES = {
  ny: { anchor: "skyline", x0: -980, x1: -110, z0: 3740, z1: 4470 },
  ca: { anchor: "downtown", x0: 110, x1: 1300, z0: -5520, z1: -4500 },
};
const CELL = 4;

(async () => {
  const srv = serve(path.resolve(__dirname, "..", ".."), 8187);
  const browser = await launch();
  const pg = await openGame(browser, 8187, { width: 400, height: 300 });
  for (const [name, S] of Object.entries(SITES)) {
    const out = await pg.evaluate(([S, CELL]) => {
      const L = window.__lp;
      const anchor = L.ROUTE_LANDMARKS.find(l => l.name === S.anchor);
      const own = new Set();
      anchor.g.traverse(o => own.add(o));
      const solids = [];
      L.forEachSolid(b => { if (!(b.mesh && own.has(b.mesh)) && !(b.mesh && b.mesh.isCityProxy)) solids.push(b); });
      const nx = Math.round((S.x1 - S.x0) / CELL), nz = Math.round((S.z1 - S.z0) / CELL);
      const blocked = [], height = [];
      for (let j = 0; j < nz; j++) {
        for (let i = 0; i < nx; i++) {
          const x = S.x0 + (i + 0.5) * CELL, z = S.z0 + (j + 0.5) * CELL;
          const h = L.terrainEff(x, z);
          let b = 0;
          if (h < L.seaLevelAt(x, z) + 1.5) b = 1;
          else if (L.inCorridor(x, z, 20)) b = 2;
          else if (L.hwyInCorridor && L.hwyInCorridor(x, z, 25)) b = 3;
          else if (L.flattenMask(x, z) > 0.02) b = 4;
          else if (Math.abs(x - L.TRAIN_X) < 20 && z > L.TRAIN_ZMIN - 50 && z < L.TRAIN_ZMAX + 50) b = 5;
          else {
            for (const s of solids) {
              const dx = Math.max(Math.abs(x - s.x) - s.hw, 0), dz = Math.max(Math.abs(z - s.z) - s.hd, 0);
              if (dx * dx + dz * dz < 25 * 25) { b = 6; break; }
            }
          }
          blocked.push(b); height.push(Math.round(h * 10) / 10);
        }
      }
      return { anchor: { x: anchor.x, z: anchor.z, y: anchor.g.position.y }, x0: S.x0, z0: S.z0, nx, nz, cell: CELL, blocked, height };
    }, [S, CELL]);
    fs.writeFileSync(path.join(__dirname, `site-${name}.json`), JSON.stringify(out));
    const nb = out.blocked.filter(b => b).length;
    console.log(name, `${out.nx}x${out.nz}`, `blocked ${(100 * nb / out.blocked.length).toFixed(0)}%`, "anchor", out.anchor);
  }
  await browser.close(); srv.close();
})();
