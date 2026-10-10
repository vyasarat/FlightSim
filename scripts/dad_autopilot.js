"use strict";
// ---------------------------------------------------------------------------
// A pilot for dad mode's checks and renders (v147). It flies the sortie the way a
// finger would -- through L.api.setStick(bank, pitch) and the dad buttons' own
// functions, nothing else -- so the jet's own flight model, G limit, laser and
// bombs are what get tested. Installed in the page as window.__dadPilot.
//
//   P.step(dt)   one frame of stick for the current phase, then L.update(dt)
//   P.phase      "valley" -> "popup" -> "dive" -> "pull" -> "out"
//   P.opts       { agl, bombs: how many to drop in the dive, aimOffset: metres off the vent }
//
// The valley: chase a point on the centreline `look` metres ahead at `agl` over the
// floor. The attack: from `popAt` metres out, climb until the vent sits `diveDeg`
// below the nose's horizon, then point the nose at the vent and hold it there,
// drop at `dropAt` slant range, hold until `pullAgl`, then a full pull, climbing
// away from the bowl with flares whenever a missile chasing him is close.
// ---------------------------------------------------------------------------
module.exports = function installDadPilot() {
  const L = window.__lp, S = L.state, T = L.TUNE, V = T.valley;
  const J = T.dad.jet;
  const P = window.__dadPilot = {
    phase: "valley", t: 0, log: [], dropped: 0, lastDropT: -9,
    opts: { agl: 16, look: 360, popAt: 1900, popH: 560, rollIn: 35, dropAt: 950, dropErr: 0.6, pullH: 230, hold: 1.0, bombs: 2, aimOffset: 0, flares: true, gap: 0.35 },
  };
  const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  // stick for a wanted pitch RATE (deg/s): the inverse of the jet's expo
  const pitchStick = q => Math.sign(q) * Math.pow(Math.min(1, Math.abs(q) / J.pitchRateDeg), 1 / J.pitchExpo);
  const aim = (tx, ty, tz, kh, kp) => {
    const dx = tx - S.x, dy = ty - S.y, dz = tz - S.z, dh = Math.hypot(dx, dz);
    const wantH = Math.atan2(-dx, -dz), wantP = Math.atan2(dy, dh) / (Math.PI / 180);
    const eh = wrap(wantH - S.heading);
    // bank toward the heading error (heading -= w: a positive error wants a LEFT bank)
    const bank = Math.max(-1, Math.min(1, -eh * kh));
    const q = Math.max(-J.pitchRateDeg, Math.min(J.pitchRateDeg, (wantP - S.pitch) * kp));
    return { bank, pitch: pitchStick(q), eh, ep: wantP - S.pitch, dh, slant: Math.hypot(dx, dy, dz) };
  };
  P.vent = () => { const v = L.vl.vent; return { x: v.x + P.opts.aimOffset, y: v.y, z: v.z }; };
  P.step = (dt) => {
    const m = L.dad.m;
    P.t += dt;
    if (!m || m.over) { L.api.clearStick(); L.update(dt); return; }
    const vent = P.vent();
    const dVent = Math.hypot(S.x - vent.x, S.z - vent.z);
    let st = { bank: 0, pitch: 0 };
    if (P.phase === "valley") {
      // a point on the centreline ahead, at the wanted height over the floor
      const ax = S.x - P.opts.look, az = L.vlCenterZ(ax);
      const ay = Math.max(L.terrainEff(ax, az), L.terrainEff(S.x, S.z)) + P.opts.agl;
      st = aim(ax, ay, az, 4.5, 2.2);
      // never under the floor's own height ahead
      const agl = L.dadAgl();
      if (agl < 8) st.pitch = pitchStick(14);
      if (dVent < P.opts.popAt) P.phase = "popup";
    } else if (P.phase === "popup") {
      // climb at the bowl, heading for the vent, to `popH` over it; then level until
      // the vent is `rollIn` degrees below, and roll in
      // up the valley's own line until clear of its walls, then at the vent
      const ax = S.x - P.opts.look, az = L.vlCenterZ(ax);
      const a = L.dadAgl() < 220 && dVent > 900 ? aim(ax, S.y, az, 4.5, 2.0) : aim(vent.x, vent.y, vent.z, 3.0, 2.0);
      const dep = Math.atan2(S.y - vent.y, Math.hypot(S.x - vent.x, S.z - vent.z)) / (Math.PI / 180);
      const high = S.y >= Math.min(vent.y + P.opts.popH, J.ceiling - 40);
      const wantP = high ? 0 : 35;
      if (high && !P.highAt) P.highAt = +P.t.toFixed(1);
      st = { bank: a.bank, pitch: pitchStick(Math.max(-J.pitchRateDeg, Math.min(J.pitchRateDeg, (wantP - S.pitch) * 2.0))) };
      if (dep >= P.opts.rollIn) P.phase = "dive";
    } else if (P.phase === "dive") {
      // the nose on the vent, held there; the bombs at dropAt
      const a = aim(vent.x, vent.y, vent.z, 5.0, 3.0);
      st = a;
      const err = m.spotErr === undefined ? 99 : m.spotErr;
      // v153: as many of his own as it still takes -- one once pair 1 has the hatch open
      const mine = L.dad.world.bombs.filter(b => !b.by).length, need = Math.max(0, (m.hatch ? 1 : 2) - mine), done = m.plant || need === 0;
      if (a.slant < P.opts.dropAt && need > 0 && P.dropped < P.opts.bombs && err < P.opts.dropErr && P.t - P.lastDropT > P.opts.gap && L.dadBombCan()) {
        if (L.dadDropBomb()) { P.dropped++; P.lastDropT = P.t; P.log.push({ drop: P.dropped, slant: +a.slant.toFixed(0), err: +err.toFixed(2), t: +P.t.toFixed(2), pitch: +S.pitch.toFixed(1) }); }
      }
      // pull at `pullH` over the vent (the rim under him is no guide), or the ground close anyway
      if (S.y - vent.y < P.opts.pullH || L.dadAgl() < 70 || (P.dropped > 0 && done && P.t - P.lastDropT > P.opts.hold)) P.phase = "pull";
    } else if (P.phase === "pull") {
      // a hard pull, wings level: as hard as the jet will give (9.5 G)
      st = { bank: 0, pitch: 1 };
      if (S.pitch > 55) P.phase = "out";
    } else if (P.phase === "out") {
      // climbing hard out of the bowl, then round and back east over the valley
      // straight on over the far rim and away west, climbing to the ceiling
      if (L.dadAgl() < 420) st = { bank: 0, pitch: pitchStick((55 - S.pitch) * 2) };
      else { const a = aim(S.x - 4000, J.ceiling - 20, S.z, 1.4, 1.5); st = a; }
    }
    // flares: any missile chasing him within reach
    if (P.opts.flares && L.dad.world.sams.some(s => s.alive && s.target === "jet" && Math.hypot(s.x - S.x, s.y - S.y, s.z - S.z) < 1100)) L.dadFlare();
    L.api.setStick(st.bank, st.pitch);
    L.update(dt);
  };
  // run until the sortie ends or `secs` pass; returns a summary
  P.fly = (secs) => {
    const n = Math.round(secs * 60);
    for (let i = 0; i < n; i++) { P.step(1 / 60); if (L.dad.m && L.dad.m.over && L.dad.m.overT > 0.2) break; }
    const m = L.dad.m;
    return { phase: P.phase, t: +P.t.toFixed(1), over: m.over, result: m.result, why: m.why, health: m.health, hits: m.hits, plant: m.plant,
             bombsUsed: m.bombsUsed, flaresUsed: m.flaresUsed, sams: m.samsLaunched, decoys: m.decoys, clock: +m.clock.toFixed(1), log: P.log,
             x: Math.round(S.x), y: Math.round(S.y), agl: +L.dadAgl().toFixed(1), last: m.lastBomb };
  };
  return P;
};
