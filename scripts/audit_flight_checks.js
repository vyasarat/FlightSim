"use strict";
// The 2026-11 audit's flight findings (AUDIT.md): one check per finding, each failed on v210 and
// passes once fixed. Added release by release: v212 FLIGHT-4.
// Harness module contract: module.exports = async ({ newPage, check }) => { ... }
module.exports = async function ({ newPage, check }) {
  // ---- page A: the picker over a flying plane (FLIGHT-4) -- first, on a fresh page, so the
  // paper-plane flock over New York is still standing
  {
    const { ctx, page, errors } = await newPage(1024, 768);
    const r = await page.evaluate(() => {
      const L = window.__lp, st = L.state, T = L.TUNE, F = L.flags, out = {};
      const fly = (x, z, y, hdg) => {
        st.phase = "AIRBORNE"; st.x = x; st.z = z; st.y = y; st.speed = 60; st.pitch = 0; st.bank = 0; st.heading = hdg;
        st.liftoffTimer = 0; st.maxAglSinceLiftoff = 1e9; st.approachLatch = false; st.airVy = null; st.alarmOn = false;
      };
      const watch = (secs) => {
        let bangs = 0, alarmFrames = 0; const t0 = F.targets, a0 = F.alarms;
        const p0 = { x: st.x, y: st.y, z: st.z, phase: st.phase };
        const boom = window.triggerExplosion; window.triggerExplosion = function (...a) { bangs++; return boom.apply(this, a); };
        let beeps = 0; const ab = window.alarmBeep; window.alarmBeep = function (...a) { beeps++; return ab.apply(this, a); };
        try { for (let i = 0; i < 60 * secs; i++) { L.update(1 / 60); if (st.alarmOn) alarmFrames++; if (st.exploding) bangs = Math.max(bangs, 1); } }
        finally { window.triggerExplosion = boom; window.alarmBeep = ab; }
        return { menu: L.menuOpen(), bangs, alarmFrames, beeps, targetsPopped: F.targets - t0, alarms: F.alarms - a0,
                 airborne: p0.phase === "AIRBORNE", moved: +Math.hypot(st.x - p0.x, st.y - p0.y, st.z - p0.z).toFixed(1) };
      };
      // 1: low over New York's country, a paper-plane flock in his path
      L.api.setVehicle("prop"); L.api.spawnAt(0, 0); L.api.clearStick();
      fly(0, 3000, L.terrainEff(0, 3000) + 40, 0); L.update(1 / 60);
      L.openPickerAnywhere();
      out.ny = watch(30);
      document.getElementById("screenVehicle").classList.add("hiddenS");
      // 2: straight at Big Ben
      const [bx, bz] = T.london.at.bigBen;
      L.api.spawnAt(2, 0); L.api.clearStick();
      fly(bx, bz - 500, L.terrainEff(bx, bz) + 50, Math.PI); L.update(1 / 60);
      L.openPickerAnywhere();
      out.bigBen = watch(12);
      document.getElementById("screenVehicle").classList.add("hiddenS");
      L.api.spawnAt(0, 0);
      return out;
    });
    const ok = (o) => o.menu && o.airborne && o.moved < 1 && o.bangs === 0 && o.alarmFrames === 0 && o.beeps === 0 && o.targetsPopped === 0;
    check("FLIGHT-4: with the picker open over a flying plane, nothing happens to him -- it holds where it was: no bang, no crash-warning beeps, no target popped",
      ok(r.ny) && ok(r.bigBen), r);
    check("FLIGHT-4: (page) no page errors", errors.length === 0, errors.slice(0, 3));
    await ctx.close();
  }

};
