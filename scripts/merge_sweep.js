"use strict";
// THE TOY TRACK'S MERGE, swept over many traffic layouts.
//
// v137's bang -- a traffic car level with him as the track's road back joins the
// motorway -- showed in some runs and not others, because where the traffic
// stands at that moment is not fixed by the seed alone. So instead of one run,
// this takes the exit lane hands-off (a full steer held through the start deck,
// then nothing) N times, each time with the traffic laid out afresh from a
// different random seed, and counts the touches and bangs at the merge.
//
// It uses only what every build since v131 exports (the track's own helpers are
// installed here, as track_checks does), so the same sweep runs on the live
// build (v132, cockpit-3d) and on this branch:
//   node scripts/merge_sweep.js [root] [runs=40] [port]
const path = require("path"), fs = require("fs");
const { launch, openGame, serve } = require("./art_rig.js");

async function sweep(root, runs, port) {
  const srv = serve(root, port), browser = await launch();
  const page = await openGame(browser, port, { width: 1024, height: 768 });
  const out = await page.evaluate((runs) => {
    const L = window.__lp, st = L.state, T = L.trk;
    L.noRender = true;
    const range = () => (L.TUNE.dragRangeX * Math.min(innerWidth, innerHeight)) / (L.TUNE.car.dragRangeX * innerWidth);
    const finger = (down, steer) => {
      if (!down) { L.api.clearStick(); return; }
      st.touching = true; st.touchIsPoint = false; st.ctrlPitch = 0; st.ctrlBank = (steer || 0) / range();
    };
    const board = () => {
      L.api.skipScreens();
      L.api.setVehicle("car"); L.api.spawnAt(0, 0);
      for (let i = 0; i < 10; i++) L.update(1 / 60);
      const p = L.tkLiftPad();
      st.x = p.x; st.z = p.z; st.y = L.terrainEff(p.x, p.z); st.speed = 0; st.exploding = false;
      L.api.clearStick();
      for (let i = 0; i < 60 * 6 && (!T.on || T.lift); i++) L.update(1 / 60);
    };
    const res = [];
    for (let r = 0; r < runs; r++) {
      board();
      T.seg = "deck"; T.s = 0; T.v = 0; T.air = null; T.bang = null; T.bounce = null; T.lift = null; T.on = true;
      // a fresh traffic layout: a new seed, every car respawned from it around him
      let seed = (0x9E3779B1 * (r + 1)) >>> 0;
      Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      for (const t of L.highway.traffic) { t.alive = false; t.respawn = 0; }
      const c0 = L.flags.carCrashes || 0, h0 = L.flags.hwyTrafficHit || 0, l0 = L.flags.trackLeaves || 0;
      let left = false, merged = false, f = 0, bangAt = null;
      for (; f < 60 * 60 && !merged; f++) {
        finger(true, T.on && T.seg === "deck" ? 1 : 0);
        L.update(1 / 60);
        if (!T.on && (L.flags.trackLeaves || 0) > l0) left = true;
        if (bangAt === null && (L.flags.carCrashes || 0) > c0) bangAt = { t: +(f / 60).toFixed(1), z: Math.round(st.z), traffic: (L.flags.hwyTrafficHit || 0) - h0 };
        const n = L.hwyNearest(st.x, st.z);
        if (left && Math.abs(n.lateral) < L.highway.halfW - 2 && Math.sign(n.lateral) === T.exit.side) merged = true;
      }
      // and on, hands-off, for five seconds after joining
      for (let i = 0; i < 60 * 5; i++) {
        finger(false); L.update(1 / 60);
        if (bangAt === null && (L.flags.carCrashes || 0) > c0) bangAt = { t: +((f + i) / 60).toFixed(1), z: Math.round(st.z), traffic: (L.flags.hwyTrafficHit || 0) - h0, after: true };
      }
      res.push({ r, left, merged, bangs: (L.flags.carCrashes || 0) - c0, touches: (L.flags.hwyTrafficHit || 0) - h0, bangAt });
    }
    return res;
  }, runs);
  await browser.close(); srv.close();
  return out;
}
module.exports = sweep;
if (require.main === module) {
  const args = process.argv.slice(2);
  const root = path.resolve(args[0] || path.join(__dirname, ".."));
  const runs = +(args[1] || 40), port = +(args[2] || 8195);
  sweep(root, runs, port).then(res => {
    const bad = res.filter(x => x.bangs || x.touches);
    for (const x of bad) console.log("BANG", JSON.stringify(x));
    const noMerge = res.filter(x => !x.merged).length;
    console.log(`SUMMARY root=${root} runs=${res.length} merged=${res.length - noMerge} withBangOrTouch=${bad.length} totalBangs=${res.reduce((a, x) => a + x.bangs, 0)} totalTouches=${res.reduce((a, x) => a + x.touches, 0)}`);
  });
}
