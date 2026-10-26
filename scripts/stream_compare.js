"use strict";
// THE PAGE'S RANDOM STREAM, TWO BUILDS SIDE BY SIDE (v198). The harness seeds Math.random, and
// three.js draws four for every object it makes: build one object more anywhere -- or run a lazy
// builder (ltBuild, an index) over something added since load -- and every seeded check after it
// sees different traffic, spawns and events, a world away. v198 leaked twice that way (London's
// grid got lazily-built signals; a full corridor re-index moved New York's scenery), found only
// by chasing a baseline number. This counts the draws through load and through a few spawns:
//
//   node scripts/stream_compare.js <rootA> <rootB>     (a root holds cockpit/; e.g. a worktree of main)
//
// Identical counts: the change left the stream alone. Different: find the caller (PROFILE=1).
const path = require("path");
const { launch, serve } = require("./art_rig.js");

async function count(root, port) {
  const srv = serve(path.resolve(root), port), browser = await launch();
  const pg = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await pg.addInitScript(() => {
    let seed = 0x2F6E2B1; window.__draws = 0;
    Math.random = () => { window.__draws++; seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    window.__rafQueue = []; window.__simTime = 0;
    window.requestAnimationFrame = cb => { window.__rafQueue.push(cb); return window.__rafQueue.length; };
  });
  await pg.goto(`http://127.0.0.1:${port}/cockpit/index.html`);
  await pg.waitForFunction(() => window.__lp && window.__lp.state && (!window.__lp.artReady || window.__lp.artReady()), null, { timeout: 120000 });
  await pg.waitForFunction(() => typeof cities === "undefined" || Object.values(cities).every(c => c.ready || c.failed), null, { timeout: 120000 });
  const out = await pg.evaluate((profile) => {
    const L = window.__lp, o = { load: window.__draws, after: [] }, by = {};
    L.noRender = true; L.api.skipScreens();
    if (profile) { const R0 = Math.random; Math.random = function () { const k = new Error().stack.split(String.fromCharCode(10)).slice(2, 5).map(l => (l.match(/at (\S+)/) || [])[1]).join("<"); by[k] = (by[k] || 0) + 1; return R0(); }; }
    for (const [v, at] of [["prop", 0], ["car", 0], ["corvette", 1], ["helicopter", 1]]) {
      L.api.setVehicle(v); L.api.spawnAt(at, 0);
      for (let i = 0; i < 120; i++) L.update(1 / 60);
      o.after.push(v + ":" + window.__draws);
    }
    if (profile) o.by = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 12);
    return o;
  }, !!process.env.PROFILE);
  await browser.close(); srv.close();
  return out;
}

if (require.main === module) {
  (async () => {
    const [a, b] = process.argv.slice(2);
    const A = await count(a, 8211), B = await count(b, 8212);
    console.log("A", JSON.stringify(A)); console.log("B", JSON.stringify(B));
    const same = A.load === B.load && A.after.join() === B.after.join();
    console.log(same ? "SAME: the stream is untouched" : "DIFFERENT: something draws from the page's stream that did not before (PROFILE=1 names the callers)");
    process.exit(same ? 0 : 1);
  })();
}
module.exports = { count };
