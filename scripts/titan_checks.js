"use strict";
// ---------------------------------------------------------------------------
// THE GIANT ROBOT (v218, stage 1), watched the way he will meet it.
//
//   1. WHERE: it rises off New York and wades, and the whole path -- every part of it, at every
//      way it can face -- is sea, outside the corridors (inCorridor(.., 300): the approach and the
//      motorway), clear of the droneship and the net boat and kilometres from the city; a real
//      five-minute wade stays on the path and turns at both ends.
//   2. HITS, from the PLANE and from the HELICOPTER, by the real missile button: plates go and
//      lamps go out, it staggers; a weak spot takes three; a missile fired 60 degrees away does
//      nothing. (The helicopter's missiles fly nose-down: the bend is what brings them on.)
//   3. IT FALLS AND REBUILDS: shot down by the button, it falls at the last plate -- nothing of it
//      solid from the first frame of the fall, flown straight through with no bang -- one splash,
//      the fireworks, one horn; after the rebuild time it rises again whole, and falls again.
//   4. SOLID, NEVER A LOOP: the plane and the helicopter flown into it at cruise are one bang
//      each, back where it happened (near, and outside it), and hands-off for 20 s after, no more.
//   5. NEVER REQUIRED, NEVER BLOCKING: fly away and it stops watching and wades; a session that
//      never comes near sees nothing of it (no rise, nothing solid, not one draw from the page's
//      random stream); with it up, take-off, landing and the picker at New York work as ever;
//      dad mode hides it; a fresh start and an eject stand it down.
//   7. HE CANNOT MISS IT from the New York runway start: portrait and landscape, seat and chase,
//      the robot or its edge arrow is on his screen every frame from the moment it starts to rise,
//      and the roar is fired.
//   8. THE FRAME: what it adds, up and mid-fall, against the same view without it.
//   9. ZERO TEXT: the arrow is an icon, not a button, and no digit.
// (6, the leaving matrix, is its rows in leave_matrix_checks; the pool's counts in event_pool_checks;
// the solid kind's column in solidity_checks.) Renders: scripts/titan_renders.js.
// ---------------------------------------------------------------------------

// in the page: the helpers every part uses
function tnHelpers() {
  const L = window.__lp, st = L.state;
  L.noRender = true;
  const step = (n, fn) => { for (let i = 0; i < n; i++) { if (fn) fn(i); L.update(1 / 60); } };
  const fire = () => { const e = document.getElementById("missileBtn"); e.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 3 })); e.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 3 })); };
  const T = L.TUNE.titan;
  const center = () => ({ x: L.titan.x, y: L.titan.y, z: L.titan.z });
  // the world point of a weak spot or a part's middle
  const weak = (name) => { const w = L.titan.weak.find(q => q.name === name); return { x: w.world.x, y: w.world.y, z: w.world.z }; };
  const bodyMid = () => { const r = L.titan.recs.find(q => q.tnPart === "body"); return { x: (r.cap.a[0] + r.cap.b[0]) / 2, y: (r.cap.a[1] + r.cap.b[1]) / 2, z: (r.cap.a[2] + r.cap.b[2]) / 2 }; };
  // him, airborne in the prop (or the helicopter), `dist` m from a point along a bearing off the robot's front, pointed at it
  function placeAt(veh, p, dist, offDeg, aimOffDeg) {
    const yaw = L.titan.yaw + (offDeg || 0) * Math.PI / 180;
    const x = p.x + Math.sin(yaw) * dist, z = p.z + Math.cos(yaw) * dist;
    const h = Math.atan2(-(p.x - x), -(p.z - z)) + (aimOffDeg || 0) * Math.PI / 180;   // heading: forward is (-sin h, -cos h)
    if (veh === "heli") {
      st.x = x; st.z = z; st.y = p.y; st.heading = h; st.phase = "AIRBORNE";
      heli.altitude = p.y; heli.vy = 0; heli.target = null; heli.vertical = 0;
      const v = L.TUNE.heli.cruise * 0.8; heli.vx = -Math.sin(h) * v; heli.vz = -Math.cos(h) * v; st.speed = v;
    } else {
      st.x = x; st.z = z; st.y = p.y; st.heading = h; st.pitch = 0; st.bank = 0; st.phase = "AIRBORNE";
      st.speed = st.vp.cruiseSpeed; st.engaged = false; st.approachData = null; st.liftoffTimer = 0; st.gearDown = false;
    }
    st.exploding = false;
  }
  function asPlane() { L.api.setVehicle("prop"); L.api.teleportAirborne(1500, 0, 300, 0); step(5); }
  function asHeli() {
    L.api.setVehicle("helicopter"); L.api.spawnAt(0, 0); step(10);
    heli.vertical = 1; step(90); heli.vertical = 0; step(10);
  }
  function snap() { return { gone: L.tnPlatesGone(), lit: L.tnLampsLit(), points: L.titan.points, hits: L.flags.tnHits || 0, weak: L.flags.tnWeakHits || 0, stag: L.flags.tnStaggers || 0 }; }
  // fire one missile by the button, run until it is spent; what changed
  function shot(veh, p, dist, offDeg, aimOffDeg) {
    placeAt(veh, p, dist, offDeg, aimOffDeg);
    st.missileCooldown = 0;
    L.api.clearStick();
    const a = snap(), m0 = L.flags.missiles || 0;
    fire();
    const fired = (L.flags.missiles || 0) - m0;
    let bent = false, staggered = false, bangs = 0;
    for (let i = 0; i < 60 * 5 && L.missilesList.some(m => m.alive); i++) {
      if (veh === "heli") { st.y = p.y; heli.altitude = p.y; }
      const was = st.exploding;
      L.update(1 / 60);
      if (!was && st.exploding) bangs++;                  // HIS bangs (flags.exploded counts the missile's blast too)
      if (L.missilesList.some(m => m.alive && m.tnBent)) bent = true;
      if (L.titan.stagger > 0) staggered = true;
    }
    const b = snap();
    return { fired, bent, staggered, gone: b.gone - a.gone, lit: b.lit - a.lit, points: b.points - a.points, hits: b.hits - a.hits, weak: b.weak - a.weak, stag: b.stag - a.stag, bangs };
  }
  window.__tn = { step, fire, T, center, weak, bodyMid, placeAt, asPlane, asHeli, snap, shot };
}

module.exports = async function titanChecks({ newPage, check }) {
  const { page, errors } = await newPage(1024, 768);
  await page.evaluate(tnHelpers);

  // ---- 1. where it stands and wades
  const geo = await page.evaluate(() => {
    const L = window.__lp, H = window.__tn, T = H.T, tn = L.titan;
    L.api.setVehicle("prop"); L.api.spawnAt(0, 0); H.step(5);
    L.tnForce("up");
    const out = { samples: 0, corridor: 0, city: 0, shallow: 0, dry: 0, nearShips: 0, minShipGap: 1e9, legsWet: 0, legs: 0 };
    const R = L.RECOVERY[0] || {};
    const ships = [R.barge, R.netBoat].filter(Boolean).map(s => ({ x: s.x, z: s.z }));
    out.ships = ships.map(s => [Math.round(s.x), Math.round(s.z)]);
    const seg = T.path;
    const saved = { x: tn.x, z: tn.z, yaw: tn.yaw };
    for (let i = 0; i < seg.length - 1; i++) {
      const a = seg[i], b = seg[i + 1], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 10);
      for (let k = 0; k <= n; k++) {
        const x = a[0] + (b[0] - a[0]) * k / n, z = a[1] + (b[1] - a[1]) * k / n;
        if (L.terrainEff(x, z) > L.seaLevelAt(x, z) - 6) out.shallow++;
        for (let yd = 0; yd < 360; yd += 15) {
          tn.x = x; tn.z = z; tn.yaw = yd * Math.PI / 180; tn.hold = true;
          L.updateTitan(0);
          for (const r of tn.recs) {
            const c = r.cap;
            for (let s = 0; s <= 4; s++) {
              const px = c.a[0] + (c.b[0] - c.a[0]) * s / 4, pz = c.a[2] + (c.b[2] - c.a[2]) * s / 4;
              for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const qx = px + ox * c.r, qz = pz + oz * c.r;
                out.samples++;
                if (L.inCorridor(qx, qz, 300)) out.corridor++;
                if (L.cityCovers(qx, qz, 2500)) out.city++;
                for (const sh of ships) { const g = Math.hypot(qx - sh.x, qz - sh.z); out.minShipGap = Math.min(out.minShipGap, g); if (g < 150) out.nearShips++; }
              }
            }
            if (r.tnPart === "legL" || r.tnPart === "legR") { out.legs++; const lo = c.a[1] < c.b[1] ? c.a : c.b; if (L.terrainEff(lo[0], lo[2]) < L.seaLevelAt(lo[0], lo[2]) - 2) out.legsWet++; }
          }
        }
      }
    }
    out.minShipGap = Math.round(out.minShipGap);
    tn.x = saved.x; tn.z = saved.z; tn.yaw = saved.yaw; tn.hold = false;
    // a real wade: five minutes, him far off (it wades only when he is not near enough to face)
    L.api.setVehicle("car"); L.api.spawnAt(1, 0); H.step(5);
    L.tnForce("up");
    let minX = 1e9, maxX = -1e9, off = 0, turns = 0, lastDir = 0, stomps0 = L.flags.tnStomps || 0;
    for (let f = 0; f < 60 * 300; f++) {
      const x0 = tn.x;
      L.update(1 / 60);
      minX = Math.min(minX, tn.x); maxX = Math.max(maxX, tn.x);
      const dir = Math.sign(tn.x - x0);
      if (dir && lastDir && dir !== lastDir) turns++;
      if (dir) lastDir = dir;
      if (f % 30 === 0) for (const r of tn.recs) if (L.inCorridor(r.x, r.z, 300 - r.hw) || L.terrainEff(tn.x, tn.z) > L.seaLevelAt(tn.x, tn.z) - 6) off++;
    }
    out.wade = { minX: Math.round(minX), maxX: Math.round(maxX), turns, off, stomps: (L.flags.tnStomps || 0) - stomps0, phase: tn.phase };
    return out;
  });
  check(`titan: its whole path, every part at every way it faces (${geo.samples} samples), is sea >= 6 m deep, outside the approach and road corridors (inCorridor +300 m), ${geo.minShipGap} m from the droneship and the net boat, and >= 2.5 km from the city; its legs stand in the water`,
    geo.samples > 5000 && geo.shallow === 0 && geo.corridor === 0 && geo.city === 0 && geo.nearShips === 0 && geo.ships.length === 2 && geo.legsWet === geo.legs, geo);
  check(`titan: a real five-minute wade stays on its path (x ${geo.wade.minX}..${geo.wade.maxX}), turns at the ends (${geo.wade.turns}), stomps (${geo.wade.stomps}), never off the water or into a corridor`,
    geo.wade.off === 0 && geo.wade.turns >= 1 && geo.wade.minX >= 495 && geo.wade.maxX <= 985 && geo.wade.maxX - geo.wade.minX > 200 && geo.wade.stomps > 50 && geo.wade.phase === "up", geo.wade);

  // ---- 1b. it RISES off New York when he is there (and is solid only once up)
  const rise = await page.evaluate(() => {
    const L = window.__lp, H = window.__tn, tn = L.titan;
    L.tnReset(); L.api.setVehicle("prop"); L.api.spawnAt(0, 0);
    const r0 = L.flags.tnRises || 0;
    const seen = [];
    let solidRising = 0;
    for (let f = 0; f < 60 * 14; f++) { L.update(1 / 60); if (seen[seen.length - 1] !== tn.phase) seen.push(tn.phase); if (tn.phase === "rising" && tn.recs.some(r => !L.isSolidHidden(r))) solidRising++; }
    return { phases: seen, rises: (L.flags.tnRises || 0) - r0, solidRising, solidUp: tn.recs.every(r => !L.isSolidHidden(r)), drawn: tn.g.visible };
  });
  check(`titan: at New York's runway it rises out of the sea (${rise.phases.join(" -> ")}), nothing of it solid while it rises, all of it solid once up`,
    rise.rises === 1 && rise.phases[0] === "rising" && rise.phases.includes("up") && rise.solidRising === 0 && rise.solidUp && rise.drawn, rise);

  // ---- 2. hits, from the plane and the helicopter, by the button
  const hits = await page.evaluate(() => {
    const L = window.__lp, H = window.__tn, tn = L.titan, out = {};
    for (const veh of ["plane", "heli"]) {
      L.tnReset(); veh === "plane" ? H.asPlane() : H.asHeli();
      L.tnForce("up"); tn.hold = true; H.step(2);
      // the body, from 420 m off its side (no weak spot faces that way)
      out[veh + "Body"] = H.shot(veh, H.bodyMid(), 420, 90);
      tn.stagger = 0; H.step(80);
      // the chest core, from in front
      out[veh + "Core"] = H.shot(veh, H.weak("core"), 400, 0);
      tn.stagger = 0; H.step(80);
      // fired 60 degrees away from it, from in front
      out[veh + "Away"] = H.shot(veh, H.bodyMid(), 420, 0, 60);
      tn.hold = false;
    }
    return out;
  });
  for (const veh of ["plane", "heli"]) {
    const b = hits[veh + "Body"], c = hits[veh + "Core"], a = hits[veh + "Away"];
    check(`titan: from the ${veh === "plane" ? "PLANE" : "HELICOPTER"}, a missile fired by the button at its body hits -- one plate off (${b.gone}), lamps out (${-b.lit}), it staggers -- and no bang for him`,
      b.fired === 1 && b.hits === 1 && b.gone === 1 && b.points === -1 && b.lit < 0 && b.stag === 1 && b.staggered && b.bangs === 0, b);
    check(`titan: from the ${veh === "plane" ? "PLANE" : "HELICOPTER"}, at the glowing chest core it takes THREE plates (${c.gone})`,
      c.fired === 1 && c.hits === 1 && c.weak === 1 && c.gone === 3 && c.points === -3 && c.lit < 0 && c.bangs === 0, c);
    check(`titan: from the ${veh === "plane" ? "PLANE" : "HELICOPTER"}, a missile fired 60 degrees away from it does nothing to it`,
      a.fired === 1 && a.hits === 0 && a.gone === 0 && !a.bent && a.bangs === 0, a);
  }
  check(`titan: the helicopter's missiles fly nose-down (its pitch at cruise) and the bend brings them on to it`,
    hits.heliBody.bent && hits.heliCore.bent, { body: hits.heliBody.bent, core: hits.heliCore.bent });
  // the key on its back and the gem on its head are weak spots too
  const back = await page.evaluate(() => {
    const L = window.__lp, H = window.__tn, tn = L.titan;
    L.tnReset(); H.asPlane(); L.tnForce("up"); tn.hold = true; H.step(2);
    const key = H.shot("plane", H.weak("key"), 400, 180);
    tn.stagger = 0; H.step(80);
    const crest2 = H.shot("plane", H.weak("crest"), 400, 30);
    tn.hold = false;
    return { key, crest2 };
  });
  check(`titan: the wind-up key on its back and the gem on its head are weak spots: three plates each (${back.key.gone}, ${back.crest2.gone})`,
    back.key.weak === 1 && back.key.gone === 3 && back.crest2.weak === 1 && back.crest2.gone === 3, back);

  // ---- 3. it falls, and rebuilds, and falls again
  const fall = await page.evaluate(() => {
    const L = window.__lp, H = window.__tn, tn = L.titan, st = L.state, T = H.T;
    const f0 = { ...L.flags };
    const d = k => (L.flags[k] || 0) - (f0[k] || 0);
    const out = { rounds: [] };
    L.tnReset(); H.asPlane(); L.tnForce("up"); H.step(2);
    const headY0 = Math.round(Math.max(...tn.recs.filter(q => q.tnPart === "head").map(q => q.y1)) - tn.y);
    for (let round = 0; round < 2; round++) {
      let shots = 0;
      while (tn.phase === "up" && shots < 60) { H.shot("plane", shots % 2 ? H.weak("core") : H.bodyMid(), 400, shots % 2 ? 0 : 90); shots++; }
      const r = { shots, phase: tn.phase, solidInFall: 0, fallFrames: 0, flyBangs: 0, headY0 };
      // straight through where it stands, at its chest's height, while it falls
      // (aimed at where it STOOD, at chest height -- its parts are already on their way over)
      const at = { x: tn.x, z: tn.z }, c = { x: tn.x, y: tn.y - T.wadeDepth + 60, z: tn.z };
      H.placeAt("plane", c, 200, 0);
      const b0 = L.flags.exploded || 0;
      let cross = 1e9;
      for (let f = 0; f < 60 * 20 && tn.phase === "fall"; f++) {
        L.update(1 / 60); r.fallFrames++;
        if (tn.recs.some(q => !L.isSolidHidden(q))) r.solidInFall++;
        if (f < 60 * 6) cross = Math.min(cross, Math.hypot(st.x - at.x, st.z - at.z));   // (his own track: through where it stood)
      }
      r.crossed = Math.round(cross);
      r.flyBangs = (L.flags.exploded || 0) - b0;
      r.after = tn.phase; r.gone = L.tnPlatesGone();
      // he waits on the runway; its clock runs
      L.api.setVehicle("prop"); L.api.spawnAt(0, 0);
      let wait = 0;
      while (tn.phase !== "up" && wait < 60 * (T.rebuild + 30)) { L.update(1 / 60); wait++; }
      r.waited = Math.round(wait / 60);
      r.back = tn.phase; r.goneBack = L.tnPlatesGone(); r.pointsBack = tn.points; r.litBack = L.tnLampsLit();
      // ... and standing as it stood: both feet in the sea, its head at its height (the fall's pose all gone)
      r.feetWet = tn.recs.filter(q => q.tnPart === "legL" || q.tnPart === "legR").every(q => Math.min(q.cap.a[1], q.cap.b[1]) < tn.y);
      r.headY = Math.round(Math.max(...tn.recs.filter(q => q.tnPart === "head").map(q => q.y1)) - tn.y);
      out.rounds.push(r);
      H.asPlane(); H.step(2);
    }
    out.falls = d("tnFalls"); out.splashes = d("tnSplashes"); out.horns = d("tnHorns"); out.fireworks = d("tnFireworks"); out.rebuilds = d("tnRebuilds");
    out.max = L.tnPointsMax(); out.lamps = tn.lamps.length; out.rebuild = T.rebuild;
    return out;
  });
  const [r1, r2] = fall.rounds;
  check(`titan: shot down by the button (${r1.shots} shots) it falls at the last plate; nothing of it solid on any frame of the fall (${r1.fallFrames} frames), flown straight through where it stood (${r1.crossed} m from its middle): no bang`,
    r1.phase === "fall" && r1.crossed < 25 && r2.crossed < 25 && r1.solidInFall === 0 && r1.fallFrames > 100 && r1.flyBangs === 0 && r1.gone === fall.max, r1);
  check(`titan: the payoff, each once a fall -- a splash (${fall.splashes}), the fireworks (${fall.fireworks}), the victory horn (${fall.horns})`,
    fall.falls === 2 && fall.splashes === 2 && fall.horns === 2 && fall.fireworks >= 16, fall);
  check(`titan: after the rebuild time (${r1.waited} s) it rises again whole -- every plate and lamp back, standing as it stood (feet in the sea, head at its height) -- and can be felled again (${r2.shots} shots)`,
    r1.back === "up" && r1.feetWet && r2.feetWet && Math.abs(r1.headY - r1.headY0) < 10 && Math.abs(r2.headY - r1.headY0) < 10 && r1.goneBack === 0 && r1.pointsBack === fall.max && r1.litBack === fall.lamps && r1.waited >= fall.rebuild - 20 && r2.phase === "fall" && r2.back === "up" && fall.rebuilds === 2, { r1, r2 });

  // ---- 4. solid: one bang, back where it happened and outside it, never a loop
  const solid = await page.evaluate(() => {
    const L = window.__lp, H = window.__tn, tn = L.titan, st = L.state, out = {};
    for (const veh of ["plane", "heli"]) {
      L.tnReset(); veh === "plane" ? H.asPlane() : H.asHeli(); L.tnForce("up"); H.step(2);
      const c = H.bodyMid();
      H.placeAt(veh, c, 260, 20);
      L.api.clearStick();
      const b0 = L.flags.exploded || 0;
      let at = null, back = null, inside = false, frames = 0;
      for (let f = 0; f < 60 * 30; f++) {
        if (veh === "heli" && !st.exploding && !at) { const v = L.TUNE.heli.cruise * 0.8; heli.vx = -Math.sin(st.heading) * v; heli.vz = -Math.cos(st.heading) * v; heli.altitude = c.y; }
        const was = st.exploding;
        L.update(1 / 60); frames++;
        if (!was && st.exploding && !at) at = { x: st.x, y: st.y, z: st.z };
        if (was && !st.exploding && !back) { back = { x: st.x, y: st.y, z: st.z }; inside = L.tnInside(); }
        if (back && back.f === undefined) back.f = f;
        if (back && f - back.f > 60 * 20) break;
      }
      out[veh] = { bangs: (L.flags.exploded || 0) - b0, at: at && [Math.round(at.x), Math.round(at.y), Math.round(at.z)], back: back && [Math.round(back.x), Math.round(back.y), Math.round(back.z)],
        dist: at && back ? Math.round(Math.hypot(at.x - back.x, at.z - back.z)) : null, inside, overTop: back ? Math.round(back.y - (tn.y + H.T.top)) : null, phase: tn.phase };
    }
    return out;
  });
  for (const veh of ["plane", "heli"]) {
    const s = solid[veh];
    check(`titan: the ${veh === "plane" ? "plane" : "helicopter"} flown into it at cruise is ONE bang, back together where it happened (${s.dist} m off), outside it and over its head (${s.overTop} m), and 20 s hands-off after: no second bang`,
      s.bangs === 1 && !!s.back && s.dist < 80 && !s.inside && s.overTop > 0, s);
  }

  // ---- 5. never required, never blocking
  const away = await page.evaluate(() => {
    const L = window.__lp, H = window.__tn, tn = L.titan, st = L.state;
    L.tnReset(); H.asPlane(); L.tnForce("up"); H.step(2);
    H.placeAt("plane", H.bodyMid(), 500, 0); H.step(30);
    const near = { watching: tn.watching, facing: tn.facing };
    // fly away, out past where it watches
    const c = H.center(); st.x = c.x - 2400; st.z = c.z - 600; st.y = 300; st.heading = Math.atan2(-(st.x - c.x), -(st.z - c.z)); st.pitch = 0;   // (forward is (-sin h, -cos h): away from it)
    H.step(60 * 4);
    const x0 = tn.x; H.step(60 * 20);
    return { near, far: { watching: tn.watching, facing: tn.facing, waded: Math.round(Math.abs(tn.x - x0)) } };
  });
  check(`titan: near him in the plane it watches and turns to face him; flown away it stops and goes back to wading (${away.far.waded} m in 20 s) -- he can always just fly off`,
    away.near.watching && away.near.facing && !away.far.watching && !away.far.facing && away.far.waded > 20, away);
  {
    const { page: p2 } = await newPage(1024, 768);
    const never = await p2.evaluate(() => {
      const L = window.__lp, st = L.state, tn = L.titan;
      L.noRender = true;
      L.api.setVehicle("prop"); L.api.spawnAt(1, 0);
      let draws = 0; const R = Math.random; Math.random = function () { draws++; return R(); };
      const s0 = tn.region.list.length, f0 = { ...L.flags };
      for (let i = 0; i < 60 * 60; i++) L.update(1 / 60);
      Math.random = R;
      return { phase: tn.phase, rises: (L.flags.tnRises || 0) - (f0.tnRises || 0), solid: tn.recs.filter(r => !L.isSolidHidden(r)).length, drawn: tn.g.visible, arrow: tn.arrowOn,
               solidCount: tn.region.list.length - s0, drawsAll: draws };
    });
    // the same minute beside it, wading, with the page's random stream counted: only the robot's frame against a frame without it
    const beside = await p2.evaluate(() => {
      const L = window.__lp, tn = L.titan;
      L.api.setVehicle("prop"); L.api.spawnAt(0, 0); L.tnForce("up");
      for (let i = 0; i < 30; i++) L.update(1 / 60);
      let draws = 0; const R = Math.random; Math.random = function () { draws++; return R(); };
      for (let i = 0; i < 600; i++) L.updateTitan(1 / 60);
      Math.random = R;
      return { draws, phase: tn.phase };
    });
    await p2.context().close();
    check(`titan: a session that never comes near New York sees nothing of it -- no rise, nothing solid or drawn, no arrow, its records in the registry neither more nor fewer`,
      never.phase === "sea" && never.rises === 0 && never.solid === 0 && !never.drawn && !never.arrow && never.solidCount === 0, never);
    check(`titan: 600 of its frames up and wading draw nothing from the page's random stream (${beside.draws} draws)`, beside.draws === 0 && beside.phase === "up", beside);
  }
  const ny = await page.evaluate(() => {
    const L = window.__lp, H = window.__tn, tn = L.titan, st = L.state, out = {};
    L.tnReset(); L.api.setVehicle("prop"); L.api.spawnAt(0, 0); H.step(60 * 12);
    out.upAtStart = tn.phase;
    const b0 = L.flags.exploded || 0;
    // take-off: the throttle held, a pull up once rolling fast
    L.api.setThrottle(true);
    for (let i = 0; i < 60 * 40 && st.phase !== "AIRBORNE" && st.phase !== "CLIMB_AWAY"; i++) { if (st.speed > st.vp.cruiseSpeed * 0.7) L.api.setStick(0, 0.6); L.update(1 / 60); }
    out.tookOff = st.phase === "AIRBORNE" || st.phase === "CLIMB_AWAY";
    H.step(60 * 6); L.api.clearStick(); L.api.setThrottle(false);
    out.takeoffBangs = (L.flags.exploded || 0) - b0;
    // a landing at New York, hands-off on the approach from the sea (past it)
    const t0 = L.flags.touchdown || 0, b1 = L.flags.exploded || 0;
    // (headless_test T5's sloppy approach: off the line, a little nose-down, the assists bring him in)
    L.api.teleportAirborne(500, 100, 60, 20); L.api.setStick(0, -0.16);
    for (let i = 0; i < 60 * 120 && (L.flags.touchdown || 0) === t0; i++) L.update(1 / 60);
    out.robotAtLanding = tn.phase; out.solidAtLanding = tn.recs.filter(r => !L.isSolidHidden(r)).length;
    L.api.clearStick();
    out.landed = (L.flags.touchdown || 0) - t0; out.landBangs = (L.flags.exploded || 0) - b1; out.phaseNow = st.phase;
    // the picker, parked: its button opens the cards and a card starts him
    for (let i = 0; i < 60 * 30 && !L.vehParked(); i++) L.update(1 / 60);
    L.api.spawnAt(0, 0); H.step(30);
    const mb = document.getElementById("menuBtn"), vb = document.getElementById("vehBtn");
    const btn = mb && L.BUTTONS.menuBtn.when() ? mb : vb;
    btn.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 5 }));
    out.pickerOpen = L.menuOpen();
    const card = document.querySelector('.vehCard[data-v="helicopter"]');
    card.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 5 })); card.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 5 }));
    if (!document.getElementById("screenDir").classList.contains("hiddenS")) document.querySelector('.dirCard[data-d="0"]').dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 5 }));
    H.step(30);
    out.picked = st.vehicleKey; out.pickerShut = !L.menuOpen(); out.robot = tn.phase;
    return out;
  });
  check(`titan: with it up at New York, take-off works (no bang), a hands-off approach lands (${ny.landed}) with it up and solid (${ny.robotAtLanding}), and the picker opens and starts him in what he picks`,
    ny.upAtStart === "up" && ny.robotAtLanding === "up" && ny.solidAtLanding > 0 && ny.tookOff && ny.takeoffBangs === 0 && ny.landed === 1 && ny.landBangs === 0 && ny.pickerOpen && ny.picked === "helicopter" && ny.pickerShut, ny);
  const sides = await page.evaluate(() => {
    const L = window.__lp, H = window.__tn, tn = L.titan, out = {};
    L.tnReset(); H.asPlane(); L.tnForce("up"); H.step(2);
    H.placeAt("plane", H.bodyMid(), 600, 0); H.step(5);
    // dad mode: hidden, not solid, no arrow -- and back after
    L.dadEnter(); H.step(60);
    out.dad = { drawn: tn.g.visible, solid: tn.recs.filter(r => !L.isSolidHidden(r)).length, eyes: tn.eyes.some(e => e.s.visible), lamps: tn.lampPts.visible, arrow: document.getElementById("titanArrow").classList.contains("on") };
    L.dadExit(); for (const id of ["screenVehicle", "screenDir", "screenDest"]) document.getElementById(id).classList.add("hiddenS");
    H.asPlane(); H.placeAt("plane", H.bodyMid(), 600, 0); H.step(120);   // (the chase camera eases in after a jump this long)
    out.after = { drawn: tn.g.visible, solid: tn.recs.filter(r => !L.isSolidHidden(r)).length };
    // each hook, on its own: a fresh start, a change of vehicle, an eject -- WHICH fired, and what it did (it stops
    // watching him and keeps still for its grace), read on the spot
    const hook = (name, fire) => {
      H.asPlane(); H.placeAt("plane", H.bodyMid(), 600, 0); tn.calm = 0; H.step(5);
      const was = { watching: tn.watching }, f0 = L.flags["tnStandDown_" + name] || 0;
      const ret = fire();
      return { was, ret, which: tn.lastStandDown, calm: +tn.calm.toFixed(2), watching: tn.watching, counted: (L.flags["tnStandDown_" + name] || 0) - f0 };
    };
    out.start = hook("start", () => L.api.spawnAt(0, 0));
    out.vehicle = hook("vehicle", () => L.api.setVehicle("helicopter"));
    out.eject = hook("eject", () => ejectStart());
    let n = 0; while (eject.active && n++ < 60 * 40) L.update(1 / 60);
    return out;
  });
  check(`titan: in dad mode nothing of it is drawn, solid or pointed at; out of dad mode it is back; a fresh start, a change of vehicle and an eject each stand it down by their own hook (it stops watching and keeps still)`,
    !sides.dad.drawn && sides.dad.solid === 0 && !sides.dad.eyes && !sides.dad.lamps && !sides.dad.arrow && sides.after.drawn && sides.after.solid > 0 &&
    ["start", "vehicle", "eject"].every(k => sides[k].was.watching && sides[k].which === k && sides[k].counted === 1 && sides[k].calm > 0 && !sides[k].watching) && sides.eject.ret === true, sides);

  // ---- 4b. it never moves a solid INTO him: inside its sweep NOTHING that carries a solid moves -- every
  // record's capsule (a, b, r) compared frame to frame across every near frame, hovering beside its tail, a leg
  // and its neck for 30 s each; a hit landed while he is there is a stagger skipped (lamps blink instead)
  const sweep = await page.evaluate(() => {
    const L = window.__lp, H = window.__tn, tn = L.titan, st = L.state, T = H.T, out = {};
    const caps = () => tn.recs.map(r => [r.cap.a[0], r.cap.a[1], r.cap.a[2], r.cap.b[0], r.cap.b[1], r.cap.b[2], r.cap.r]);
    const diff = (a, b) => { let m = 0; for (let i = 0; i < a.length; i++) for (let k = 0; k < 7; k++) m = Math.max(m, Math.abs(a[i][k] - b[i][k])); return m; };
    const hover = (where) => {
      L.tnReset(); H.asHeli(); L.tnForce("up"); H.step(2);
      tn.mclock = 5.3;   // (mid-swish: a tail at rest at clock 0 would hide a swish)
      H.step(1);
      const rx = Math.cos(tn.yaw), rz = -Math.sin(tn.yaw);
      let p;
      if (where === "tail") { const c = tn.recs.find(r => r.tnPart === "tail").cap; p = { x: c.b[0] + rx * (c.r + 20), y: Math.max(c.b[1], L.seaLevelAt(tn.x, tn.z) + 8), z: c.b[2] + rz * (c.r + 20) }; }
      else if (where === "leg") { const c = tn.recs.find(r => r.tnPart === "legR").cap; p = { x: (c.a[0] + c.b[0]) / 2 - rx * (c.r + 20), y: L.seaLevelAt(tn.x, tn.z) + 20, z: (c.a[2] + c.b[2]) / 2 - rz * (c.r + 20) }; }
      else { const c = tn.recs.find(r => r.tnPart === "head").cap; p = { x: (c.a[0] + c.b[0]) / 2 + rx * (c.r + 25), y: (c.a[1] + c.b[1]) / 2, z: (c.a[2] + c.b[2]) / 2 + rz * (c.r + 25) }; }
      st.x = p.x; st.z = p.z; st.y = p.y; st.phase = "AIRBORNE";
      st.heading = Math.atan2(-((tn.x) - p.x), -((tn.z) - p.z));
      let bangs = 0, nearF = 0, worst = 0, prev = null, minGap = 1e9;
      const s0 = L.flags.tnStaggers || 0, k0 = L.flags.tnStaggersSkipped || 0, h0 = L.flags.tnHits || 0;
      for (let i = 0; i < 60 * 30; i++) {
        heli.vx = heli.vz = heli.vy = 0; heli.altitude = p.y; heli.target = null; st.x = p.x; st.z = p.z; st.y = p.y; L.api.clearStick();
        if (where === "neck" && i === 60 * 10) { st.missileCooldown = 0; st.heading = Math.atan2(-((tn.x) - p.x), -((tn.z) - p.z)); H.fire(); }   // a hit while he is there
        const was = st.exploding; L.update(1 / 60); if (!was && st.exploding) bangs++;
        minGap = Math.min(minGap, L.tnGap());
        const c = caps();
        if (tn.near) { nearF++; if (prev) worst = Math.max(worst, diff(prev, c)); prev = c; } else prev = null;
      }
      return { bangs, nearF, moved: +worst.toFixed(5), minGap: Math.round(minGap), hits: (L.flags.tnHits || 0) - h0, staggers: (L.flags.tnStaggers || 0) - s0, skipped: (L.flags.tnStaggersSkipped || 0) - k0 };
    };
    out.tail = hover("tail"); out.leg = hover("leg"); out.neck = hover("neck");
    // ... and coming near it MID-STRIDE as it wades: the legs hold where they are -- no snap to standing on the
    // first near frame (a step moves a leg a fraction of a metre a frame; a snap moves it metres)
    {
      L.tnReset(); H.asHeli(); L.tnForce("up");
      st.x = tn.x + 3000; st.z = tn.z; st.y = 200; for (let i = 0; i < 60 * 4; i++) { heli.vx = heli.vz = heli.vy = 0; heli.altitude = 200; st.x = tn.x + 3000; L.update(1 / 60); }
      const walk0 = tn.walk;
      const lc = tn.recs.find(r => r.tnPart === "legR").cap, rx = Math.cos(tn.yaw), rz = -Math.sin(tn.yaw);
      const p = { x: (lc.a[0] + lc.b[0]) / 2 - rx * (lc.r + 20), y: L.seaLevelAt(tn.x, tn.z) + 20, z: (lc.a[2] + lc.b[2]) / 2 - rz * (lc.r + 20) };
      let prev = caps(), worst = 0, nearF = 0;
      for (let i = 0; i < 60 * 5; i++) {
        heli.vx = heli.vz = heli.vy = 0; heli.altitude = p.y; heli.target = null; st.x = p.x; st.z = p.z; st.y = p.y;
        L.update(1 / 60); const c = caps(); worst = Math.max(worst, diff(prev, c)); prev = c; if (tn.near) nearF++;
      }
      out.stride = { walk0: +walk0.toFixed(2), nearF, worstStep: +worst.toFixed(3) };
    }
    // the plane circling tight past its flank for 30 s: its circle measured out at sea, then laid to pass ~10 m off it
    L.tnReset(); H.asPlane();
    const fly = (x, z, y, n, cb) => { st.x = x; st.z = z; st.y = y; st.heading = 0; st.pitch = 0; st.bank = 0; st.speed = st.vp.cruiseSpeed; st.phase = "AIRBORNE"; st.exploding = false;
      for (let i = 0; i < n; i++) { L.api.setStick(1, 0); st.y = y; L.update(1 / 60); if (cb) cb(i); } };
    const tr = [];
    fly(730, 8800, 80, 60 * 30, () => { tr.push([st.x, st.z]); });
    const tail = tr.slice(60 * 10); let sx = 0, sz = 0; for (const [x, z] of tail) { sx += x; sz += z; }
    const cx = sx / tail.length, cz = sz / tail.length; let rmax = 0; for (const [x, z] of tail) rmax = Math.max(rmax, Math.hypot(x - cx, z - cz));
    L.tnForce("up"); H.step(2);
    const body = H.bodyMid(), br = tn.recs.find(r => r.tnPart === "body").cap.r, rx = Math.cos(tn.yaw), rz = -Math.sin(tn.yaw);
    const ox = body.x + rx * (br + 10 + rmax) - cx, oz = body.z + rz * (br + 10 + rmax) - cz;
    let bangs = 0, nearF = 0, minGap = 1e9, worst = 0, prev = null;
    fly(730 + ox, 8800 + oz, body.y, 60 * 30, () => {
      minGap = Math.min(minGap, L.tnGap());
      const c = caps();
      if (tn.near) { nearF++; if (prev) worst = Math.max(worst, diff(prev, c)); prev = c; } else prev = null;
    });
    // (bangs counted by his own exploding edges over the same run, replayed)
    L.tnForce("up"); H.step(2);
    let wasEx = false;
    fly(730 + ox, 8800 + oz, body.y, 60 * 30, () => { if (st.exploding && !wasEx) bangs++; wasEx = st.exploding; });
    out.plane = { circleR: Math.round(rmax), minGap: Math.round(minGap), nearF, moved: +worst.toFixed(5), bangs };
    return out;
  });
  for (const w of ["tail", "leg", "neck"]) {
    const r = sweep[w];
    check(`titan: a helicopter hovering beside its ${w.toUpperCase()} (${r.minGap} m off a part's surface) for 30 s: across ${r.nearF} frames inside its sweep not one of its solid capsules moves (worst ${r.moved} m), no bang${w === "neck" ? `; a missile hit landed meanwhile skips the stagger (${r.skipped})` : ""}`,
      r.bangs === 0 && r.nearF > 60 * 25 && r.moved === 0 && (w !== "neck" || (r.hits === 1 && r.skipped === 1 && r.staggers === 0)), r);
  }
  check(`titan: come near it MID-STRIDE (walking ${sweep.stride.walk0}), its legs hold where they are -- no snap to standing (the largest move of any capsule in a frame ${sweep.stride.worstStep} m)`,
    sweep.stride.walk0 > 0.5 && sweep.stride.nearF > 60 * 4 && sweep.stride.worstStep < 1, sweep.stride);
  check(`titan: a plane circling tight past its flank for 30 s (circle ${sweep.plane.circleR} m) comes within ${sweep.plane.minGap} m of a part (inside its ${70} m sweep) -- no capsule moves while he is near (${sweep.plane.moved} m), and no bang (${sweep.plane.bangs})`,
    sweep.plane.minGap < 70 && sweep.plane.nearF > 30 && sweep.plane.moved === 0 && sweep.plane.bangs === 0, sweep.plane);

  // ---- 4c. a bang into the sea beside it comes back where it happened (as the same bang far from it does)
  const seaBang = await page.evaluate(() => {
    const L = window.__lp, H = window.__tn, tn = L.titan, st = L.state, out = {};
    L.tnReset(); H.asPlane(); L.tnForce("up"); H.step(2);
    const dive = (x, z) => {
      st.x = x; st.z = z; st.y = L.seaLevelAt(x, z) + 25; st.heading = 0; st.pitch = -25; st.bank = 0; st.speed = st.vp.cruiseSpeed; st.phase = "AIRBORNE"; st.exploding = false;
      st.engaged = false; st.approachData = null; L.api.clearStick();
      let at = null, back = null, bangs = 0;
      for (let i = 0; i < 60 * 25 && !(back && i > (back.i + 60 * 10)); i++) {
        const was = st.exploding; L.update(1 / 60);
        if (!was && st.exploding) { bangs++; if (!at) at = { x: st.x, y: st.y, z: st.z }; }
        if (was && !st.exploding && !back) back = { x: st.x, y: st.y, z: st.z, i };
      }
      return { bangs, off: at && back ? [Math.round(back.x - at.x), Math.round(back.y - at.y), Math.round(back.z - at.z)] : null };
    };
    const rx = Math.cos(tn.yaw), rz = -Math.sin(tn.yaw);
    out.near = dive(tn.x + rx * 120, tn.z + rz * 120);
    out.far = dive(1600, 7600);
    return out;
  });
  const sbd = seaBang.near.off && seaBang.far.off ? Math.hypot(seaBang.near.off[0] - seaBang.far.off[0], seaBang.near.off[1] - seaBang.far.off[1], seaBang.near.off[2] - seaBang.far.off[2]) : 1e9;
  check(`titan: a bang into the sea 120 m beside it is one bang and comes back where it happened -- the same offset as the same bang in open sea (${Math.round(sbd)} m apart)`,
    seaBang.near.bangs === 1 && seaBang.far.bangs === 1 && sbd < 5, seaBang);

  // ---- 2b. hits from a MOVING aircraft, the robot free (turning to face him), plane and helicopter; and the rise
  const moving = await page.evaluate(() => {
    const L = window.__lp, H = window.__tn, tn = L.titan, st = L.state, out = {};
    for (const veh of ["plane", "heli"]) {
      L.tnReset(); veh === "plane" ? H.asPlane() : H.asHeli(); L.tnForce("up"); tn.hold = false; H.step(2);
      const b = H.bodyMid(); H.placeAt(veh, b, 800, 40);
      const h0 = L.flags.tnHits || 0, g0 = L.tnPlatesGone(), yaw0 = tn.yaw;
      let fired = false;
      for (let i = 0; i < 60 * 15 && (L.flags.tnHits || 0) === h0; i++) {
        if (veh === "heli") { const v = L.TUNE.heli.cruise * 0.8; heli.vx = -Math.sin(st.heading) * v; heli.vz = -Math.cos(st.heading) * v; heli.altitude = b.y; }
        if (!fired && Math.hypot(st.x - b.x, st.z - b.z) < 500) { st.missileCooldown = 0; H.fire(); fired = true; }
        L.update(1 / 60);
      }
      out[veh] = { fired, hits: (L.flags.tnHits || 0) - h0, gone: L.tnPlatesGone() - g0, turned: Math.round(Math.abs(L.wrapPi(tn.yaw - yaw0)) * 57.3) };
    }
    // the rise: a missile at what he can see of it is never let through -- it glances off (and takes nothing)
    L.tnReset(); H.asPlane(); H.step(2);
    const sea = L.seaLevelAt(tn.x, tn.z);
    L.tnForce();
    const up = L.TUNE.titan.announce + (L.TUNE.titan.riseTime - L.TUNE.titan.announce) * 0.62;   // its head and shoulders out
    for (let i = 0; i < 60 * 20 && !(tn.phase === "rising" && tn.t > up); i++) { H.placeAt("plane", { x: tn.x, y: sea + 50, z: tn.z }, 450, 0); L.update(1 / 60); }
    const s0 = L.flags.tnShrugs || 0, h0 = L.flags.tnHits || 0, p0 = tn.points;
    H.placeAt("plane", { x: tn.x, y: sea + 50, z: tn.z }, 260, 0); st.missileCooldown = 0; H.fire();
    // through: a live missile INSIDE one of its parts (above the water) -- what glancing off must prevent
    const inside = (m) => m.y > sea && tn.recs.some(r => L.solidTest(r, m.x, m.y, m.z, 0));
    let through = false;
    for (let i = 0; i < 60 * 4 && L.missilesList.some(m => m.alive); i++) {
      L.update(1 / 60);
      for (const m of L.missilesList) if (m.alive && inside(m)) through = true;
    }
    out.rise = { phase: tn.phase, shrugs: (L.flags.tnShrugs || 0) - s0, hits: (L.flags.tnHits || 0) - h0, points: tn.points - p0, through };
    // ... and falling: the same, at what is still above the water a second into its fall
    L.tnReset(); H.asPlane(); L.tnForce("up"); H.step(2);
    H.placeAt("plane", { x: tn.x, y: sea + 50, z: tn.z }, 260, 0);
    L.tnForce("fall"); for (let i = 0; i < 12; i++) { H.placeAt("plane", { x: tn.x, y: sea + 50, z: tn.z }, 160, 0); L.update(1 / 60); }
    const f0 = L.flags.tnShrugs || 0, fh0 = L.flags.tnHits || 0;
    // at a shin just over the water, which stays put as it rolls over its feet
    const lc = tn.recs.find(r => r.tnPart === "legR").cap, lk = (sea + 6 - lc.a[1]) / (lc.b[1] - lc.a[1]);
    const aimP = { x: lc.a[0] + (lc.b[0] - lc.a[0]) * lk, y: sea + 6, z: lc.a[2] + (lc.b[2] - lc.a[2]) * lk };
    st.heading = Math.atan2(-(aimP.x - st.x), -(aimP.z - st.z)); st.pitch = Math.atan2(aimP.y - st.y, Math.hypot(aimP.x - st.x, aimP.z - st.z)) * 180 / Math.PI;
    st.missileCooldown = 0; H.fire();
    let fthrough = false;
    for (let i = 0; i < 60 * 4 && L.missilesList.some(m => m.alive); i++) { L.update(1 / 60); for (const m of L.missilesList) if (m.alive && inside(m)) fthrough = true; }
    out.fall = { phase: tn.phase, shrugs: (L.flags.tnShrugs || 0) - f0, hits: (L.flags.tnHits || 0) - fh0, through: fthrough };
    return out;
  });
  check(`titan: hit from a MOVING plane (${moving.plane.hits}) and a moving helicopter (${moving.heli.hits}), fired by the button on the way in, with it free and turning to face him`,
    ["plane", "heli"].every(v => moving[v].fired && moving[v].hits === 1 && moving[v].gone >= 1), moving);
  check(`titan: rising, a missile at what he can see of it glances off with sparks and a clank (${moving.rise.shrugs}) -- never through it, and nothing taken while it rises`,
    moving.rise.phase === "rising" && moving.rise.shrugs === 1 && moving.rise.hits === 0 && moving.rise.points === 0 && !moving.rise.through, moving.rise);
  check(`titan: falling, the same -- a missile at it glances off (${moving.fall.shrugs}), never through`,
    moving.fall.phase === "fall" && moving.fall.shrugs === 1 && moving.fall.hits === 0 && !moving.fall.through, moving.fall);

  // ---- 5b. a whole cycle -- rise, roar, hits, fall, splash, fireworks, horn, sink, rebuild -- in ITS OWN frames
  // (updateTitan and tnMissileHit called alone): EVERY Math.random call on the page counted. three.js draws one for
  // each object it makes (generateUUID), so a mesh, geometry or material made after load is counted here; the only
  // draws let through are audio.js's noiseBurst's (a sound's noise, as every sound's), counted apart
  const cycle = await page.evaluate(() => {
    const L = window.__lp, H = window.__tn, tn = L.titan, f0 = { ...L.flags };
    // (his vehicle and its start set up first, outside the count: building his plane makes three.js objects)
    L.api.setVehicle("prop"); L.api.spawnAt(0, 0); L.tnReset();
    const R = Math.random; let all = 0, audio = 0;
    Math.random = function () { all++; if (/noiseBurst/.test(new Error().stack)) audio++; return R(); };
    let objs0 = 0, objs1 = 0;
    try {
      objs0 = L.scene.children.length;
      const run = (n, until) => { for (let i = 0; i < n && !until(); i++) L.updateTitan(1 / 60); };
      L.tnForce(); run(60 * 14, () => tn.phase === "up");
      const body = tn.recs.find(r => r.tnPart === "body"), c = body.cap, core = tn.weak.find(w => w.name === "core").world;
      L.tnMissileHit(body, (c.a[0] + c.b[0]) / 2, (c.a[1] + c.b[1]) / 2 + c.r * 0.9, (c.a[2] + c.b[2]) / 2, null);
      run(60, () => false);
      L.tnMissileHit(body, core.x, core.y, core.z, null);
      run(60, () => false);
      L.tnForce("fall"); run(60 * 40, () => tn.phase === "down" && tn.t > 20);
      tn.member.state.next = 0; L.tnForce(); run(60 * 14, () => tn.phase === "up");
      objs1 = L.scene.children.length;
    } finally { Math.random = R; }
    const d = k => (L.flags[k] || 0) - (f0[k] || 0);
    return { draws: all - audio, audio, objs: objs1 - objs0, rises: d("tnRises"), roars: d("tnRoars"), hits: d("tnHits"), weak: d("tnWeakHits"), splashes: d("tnSplashes"), fireworks: d("tnFireworks"), horns: d("tnHorns"), falls: d("tnFalls"), phase: tn.phase };
  });
  check(`titan: its own frames over a whole cycle -- rise, roar, a hit, a weak-spot hit, fall, splash, fireworks, horn, sink, rebuild -- draw nothing from the page's random stream (${cycle.draws} draws besides its sounds' noise; a three.js object made after load would draw 4) and add nothing to the scene`,
    cycle.draws === 0 && cycle.objs === 0 && cycle.rises === 2 && cycle.roars >= 2 && cycle.hits === 2 && cycle.weak === 1 && cycle.splashes === 1 && cycle.fireworks >= 8 && cycle.horns === 1 && cycle.falls === 1 && cycle.phase === "up", cycle);

  // ---- 7. he cannot miss it from the New York runway start -- and the arrow tells the truth
  const miss = [], arrows = [];
  for (const [w, h] of [[820, 1180], [1180, 820]]) {
    const { page: pg } = await newPage(w, h);
    const r = await pg.evaluate(() => {
      const L = window.__lp, tn = L.titan, st = L.state, T = L.TUNE.titan, out = { start: [], arrow: [] };
      L.noRender = true;
      const arrow = document.getElementById("titanArrow");
      const seen = () => { if (!arrow.classList.contains("on")) return false; const rc = arrow.getBoundingClientRect(); return rc.width > 10 && rc.left >= 0 && rc.top >= 0 && rc.right <= innerWidth && rc.bottom <= innerHeight && getComputedStyle(arrow).display !== "none"; };
      // where it IS, worked out here (not read from the game): its middle, projected; behind him, mirrored
      const V = L.camera.position.constructor;
      const truth = () => { L.camera.updateMatrixWorld(); const v = new V(tn.x, tn.y + T.top * 0.55, tn.z).project(L.camera); let x = v.x, y = v.y; if (v.z > 1) { x = -x; y = -y; } return Math.atan2(x, y); };
      const pointing = () => { const m = /rotate\(([-\d.e]+)deg\)/.exec(arrow.querySelector(".tnPoint").style.transform); return m ? +m[1] * Math.PI / 180 : NaN; };
      const btnSize = document.getElementById("missileBtn").offsetWidth || document.getElementById("menuBtn").offsetWidth;
      const judge = (tag) => {
        const rc = arrow.getBoundingClientRect(), m = 40;
        const dashTop = document.getElementById("dash").getBoundingClientRect().top;
        // at the edge: of the screen, or -- at the bottom -- of the screen above the dash (it never sits on the dials)
        const atEdge = rc.left < m || rc.top < m || innerWidth - rc.right < m || Math.min(innerHeight, dashTop) - rc.bottom < m;
        // ... or, where that edge is a column of buttons, right beside the column (never under it)
        const gapTo = (c) => Math.max(c.left - rc.right, rc.left - c.right, c.top - rc.bottom, rc.top - c.bottom, 0);
        const gaps = L.btnControlRects().map(c => gapTo(c)), gap = Math.round(Math.min(...gaps));
        const beside = gap < 64;   // (its turned pointer's box and a margin keep it this far off)
        const home = document.getElementById("homeArrow"), hs = home.classList.contains("on") ? (home.querySelector("svg") || home).getBoundingClientRect() : null;
        const overHome = !!hs && rc.left < hs.right && rc.right > hs.left && rc.top < hs.bottom && rc.bottom > hs.top;
        const err = Math.abs(L.wrapPi(pointing() - truth())) * 180 / Math.PI;
        const obst = L.btnObstructions().filter(o => /titanArrow/.test(o));
        const dash = document.getElementById("dash").getBoundingClientRect();
        const aboveDash = rc.bottom <= dash.top + 1;
        out.arrow.push({ tag, how: tn.arrowHow, aboveDash, err: +err.toFixed(1), atEdge: atEdge || beside, edge: atEdge, beside, gap, at: [Math.round(rc.left), Math.round(rc.top)], overHome, homeOn: !!hs, obst, size: Math.round(rc.width), btnSize });
      };
      for (const chase of [false, true]) {
        L.tnReset(); L.api.setVehicle("prop"); L.api.spawnAt(0, 0); L.api.setView(chase);
        const r0 = L.flags.tnRoars || 0;
        let frames = 0, missed = 0, onScreen = 0, arrowF = 0;
        for (let f = 0; f < 60 * 16; f++) {
          L.update(1 / 60);
          if (tn.phase === "sea") continue;
          frames++;
          const o = L.tnOnScreen(), a = seen();
          if (o) onScreen++; if (a) arrowF++;
          if (!o && !a) missed++;
        }
        out.start.push({ chase, frames, missed, onScreen, arrow: arrowF, roars: (L.flags.tnRoars || 0) - r0, phase: tn.phase });
        if (seen()) judge("runway-" + (chase ? "chase" : "seat"));
      }
      // in flight: out over the sea heading north, New York (his way home) AND the robot behind him; and side-on
      L.api.setVehicle("prop"); L.api.teleportAirborne(1500, 0, 300, 0); L.tnForce("up");
      const hold = (x, z, hd) => { st.x = x; st.z = z; st.y = 300; st.heading = hd; st.pitch = 0; st.bank = 0; st.destIdx = 0; st.engaged = false; st.speed = st.vp.cruiseSpeed; st.phase = "AIRBORNE"; };
      for (const [tag, x, z, hd] of [["north", 300, 9800, Math.PI], ["side", 3000, 7200, 0], ["away", 900, 4600, 0]]) {
        for (let i = 0; i < 90; i++) { hold(x, z, hd); L.update(1 / 60); }
        if (seen()) judge("flight-" + tag); else out.arrow.push({ tag: "flight-" + tag, missing: true, onScreen: L.tnOnScreen() });
      }
      // the SAME bearing as the home arrow: New York and the robot dead behind him on one line
      {
        const nx = 0, nz = 6000, dx = tn.x - nx, dz = tn.z - nz, dl = Math.hypot(dx, dz), ux = dx / dl, uz = dz / dl;
        const px = tn.x + ux * 1500, pz = tn.z + uz * 1500, hd = Math.atan2(-ux, -uz);   // flying straight away from both (forward is (-sin, -cos))
        for (let i = 0; i < 90; i++) { hold(px, pz, hd); L.update(1 / 60); }
        if (seen()) judge("flight-samebearing"); else out.arrow.push({ tag: "flight-samebearing", missing: true });
        out.sameBearing = { home: document.getElementById("homeArrow").classList.contains("on"), bearingGap: +(Math.abs(L.wrapPi(Math.atan2(-(nx - px), -(nz - pz)) - Math.atan2(-(tn.x - px), -(tn.z - pz)))) * 57.3).toFixed(1) };
      }
      // flying past its flank, northbound (no approach): in every frame where NO part of it is on his screen,
      // the arrow is on and points back at it
      {
        L.tnForce("up");
        const rx = Math.cos(tn.yaw), rz = -Math.sin(tn.yaw);
        let x = tn.x + rx * 90, z = tn.z - 600, frames = 0, offFrames = 0, arrowOff = 0, worst = 0;
        const parts = () => { const pts = []; for (const r of tn.recs) for (const k of [0, 0.5, 1]) pts.push([r.cap.a[0] + (r.cap.b[0] - r.cap.a[0]) * k, r.cap.a[1] + (r.cap.b[1] - r.cap.a[1]) * k, r.cap.a[2] + (r.cap.b[2] - r.cap.a[2]) * k]); return pts; };
        for (let i = 0; i < 60 * 20; i++) {
          st.x = x; st.z = z; st.y = tn.y + 60; st.heading = Math.PI; st.pitch = 0; st.bank = 0; st.destIdx = 0; st.speed = st.vp.cruiseSpeed; st.phase = "AIRBORNE";
          L.update(1 / 60); z += st.vp.cruiseSpeed / 60; frames++;
          L.camera.updateMatrixWorld();
          const any = parts().some(p => { const v = new V(p[0], p[1], p[2]).project(L.camera); return v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1; });
          if (any) continue;
          offFrames++;
          if (!seen() || st.engaged) { arrowOff++; continue; }
          worst = Math.max(worst, Math.abs(L.wrapPi(pointing() - truth())) * 57.3);
        }
        out.pass = { frames, offFrames, arrowOff, worst: +worst.toFixed(1) };
      }
      // the last resort: every edge place and the whole bearing taken -- the clear place nearest the edge point
      {
        const W = innerWidth, Hh = innerHeight, w = 100;
        const g = L.tnArrowPlace(0.7, W, Hh, w, (x, y) => !(Math.abs(x - W * 0.3) < 20 && Math.abs(y - Hh * 0.7) < 20));
        const none = L.tnArrowPlace(0.7, W, Hh, w, () => true);
        out.grid = { how: g.how, x: Math.round(g.x), y: Math.round(g.y), ok: Math.abs(g.x - W * 0.3) < 20 && Math.abs(g.y - Hh * 0.7) < 20, none: none.how };
      }
      // an engaged approach: the arrow goes
      L.api.teleportAirborne(500, 100, 60, 20); L.api.setStick(0, -0.16);
      let engagedF = 0, shownEngaged = 0;
      for (let i = 0; i < 60 * 40; i++) { L.update(1 / 60); if (st.engaged) { engagedF++; if (seen()) shownEngaged++; } }
      L.api.clearStick();
      out.engaged = { engagedF, shownEngaged };
      return out;
    });
    // a drag that STARTS on the arrow steers him: it takes no taps (pointer-events: none), the touch falls through
    const drag = await pg.evaluate(() => {
      const L = window.__lp, st = L.state, tn = L.titan;
      L.noRender = false;
      L.tnReset(); L.api.setVehicle("prop"); L.api.teleportAirborne(1500, 0, 300, 0); L.tnForce("up");
      for (let i = 0; i < 60; i++) { st.x = 900; st.z = 4600; st.y = 300; st.heading = 0; st.pitch = 0; st.bank = 0; st.engaged = false; L.api.clearStick(); L.update(1 / 60); }
      const a = document.getElementById("titanArrow"), rc = a.getBoundingClientRect();
      return { on: a.classList.contains("on"), x: rc.left + rc.width / 2, y: rc.top + rc.height / 2, pe: getComputedStyle(a).pointerEvents, under: (document.elementFromPoint(rc.left + rc.width / 2, rc.top + rc.height / 2) || {}).id || "" };
    });
    if (drag.on) {
      await pg.mouse.move(drag.x, drag.y); await pg.mouse.down();
      await pg.mouse.move(drag.x + 10, drag.y - 120, { steps: 6 });
      drag.during = await pg.evaluate(() => { const st = window.__lp.state; window.__lp.update(1 / 60); return { touching: st.touching, bank: +st.ctrlBank.toFixed(2), pitch: +st.ctrlPitch.toFixed(2) }; });
      await pg.mouse.up();
    }
    await pg.context().close();
    for (const o of r.start) miss.push({ vp: w + "x" + h, ...o });
    arrows.push({ vp: w + "x" + h, arrow: r.arrow, engaged: r.engaged, sameBearing: r.sameBearing, pass: r.pass, grid: r.grid, drag });
  }
  check(`titan: from the New York runway start -- portrait and landscape, seat and chase -- the robot or its arrow is on his screen every frame from its first rising frame, and the roar is fired`,
    miss.length === 4 && miss.every(o => o.frames > 400 && o.missed === 0 && o.arrow > 0 && o.roars >= 1), miss);
  const allA = arrows.flatMap(a => a.arrow.map(x => ({ vp: a.vp, ...x })));
  check(`titan: its arrow POINTS at it (worst ${Math.max(...allA.map(a => a.err || 0))} deg off), at the screen's edge (or, where the edge is a button column, beside it), button-sized, never on a control (btnObstructions) and never on the home arrow -- on the runway and in flight, both ways up (${allA.length} readings)`,
    allA.length === 12 && allA.every(a => !a.missing && a.err < 8 && a.atEdge && a.aboveDash && !a.overHome && a.obst.length === 0 && a.size >= a.btnSize - 2) && allA.some(a => a.homeOn), allA);
  check(`titan: on the SAME bearing as the home arrow (New York and it dead behind him, ${arrows.map(a => a.sameBearing.bearingGap).join("/")} deg apart) both are up and they do not overlap`,
    arrows.every(a => a.sameBearing.home && a.sameBearing.bearingGap < 3) && allA.filter(a => a.tag === "flight-samebearing").every(a => !a.missing && !a.overHome), arrows.map(a => a.sameBearing));
  check(`titan: flying past its flank, in every frame where no part of it is on his screen (${arrows.map(a => a.pass.offFrames).join("/")} frames) the arrow is on and points back at it (worst ${Math.max(...arrows.map(a => a.pass.worst))} deg)`,
    arrows.every(a => a.pass.offFrames > 60 && a.pass.arrowOff === 0 && a.pass.worst < 8), arrows.map(a => a.pass));
  check(`titan: the arrow's last resort -- every edge place and the bearing taken -- finds the clear place nearest the edge point (${arrows.map(a => a.grid.how).join("/")}), and with nowhere clear says so`,
    arrows.every(a => a.grid.how === "grid" && a.grid.ok && a.grid.none === "none"), arrows.map(a => a.grid));
  check(`titan: the arrow takes no taps (pointer-events ${arrows.map(a => a.drag.pe).join("/")}): a drag that starts on it steers him`,
    arrows.every(a => a.drag.on && a.drag.pe === "none" && a.drag.during && a.drag.during.touching && (Math.abs(a.drag.during.pitch) > 0.1 || Math.abs(a.drag.during.bank) > 0.1)), arrows.map(a => a.drag));
  check(`titan: on an engaged approach the arrow is gone (${arrows.map(a => a.engaged.engagedF).join("/")} engaged frames)`,
    arrows.every(a => a.engaged.engagedF > 60 && a.engaged.shownEngaged === 0), arrows.map(a => a.engaged));

  // ---- 8. the frame
  const frame = await page.evaluate(() => {
    const L = window.__lp, H = window.__tn, tn = L.titan, R = L.renderer;
    L.tnReset(); H.asPlane(); L.tnForce("up"); tn.hold = true; H.step(5);
    // (held at one spot off it, the chase camera settled there: it eases in after a jump)
    const spot = (() => { const c = H.bodyMid(), y = tn.yaw + 25 * Math.PI / 180; return { x: c.x + Math.sin(y) * 520, z: c.z + Math.cos(y) * 520, y: c.y, h: Math.atan2(Math.sin(y), Math.cos(y)) }; })();
    const hold = () => { const st = L.state; st.x = spot.x; st.z = spot.z; st.y = spot.y; st.heading = spot.h; st.pitch = 0; st.bank = 0; st.speed = st.vp.cruiseSpeed; };
    const look = (n) => { L.api.setView(true); for (let i = 0; i < (n || 1); i++) { hold(); L.update(1 / 60); } };
    look(150);
    const measure = () => {
      hold(); L.update(1 / 60);
      R.render(L.scene, L.camera); const a = { calls: R.info.render.calls, tris: R.info.render.triangles };
      const vis = [tn.g, tn.platesMesh, tn.socketsMesh, tn.debrisMesh, tn.lampPts, tn.sparkPts, tn.puffPts, ...tn.eyes.map(e => e.s), ...tn.weak.map(w => w.s)].map(o => [o, o.visible]);
      for (const [o] of vis) o.visible = false;
      R.render(L.scene, L.camera); const b = { calls: R.info.render.calls, tris: R.info.render.triangles };
      for (const [o, v] of vis) o.visible = v;
      return { calls: a.calls - b.calls, tris: a.tris - b.tris, total: a.calls };
    };
    const up = measure();
    // mid-fall, with the splash and the fireworks going
    tn.hold = false; L.tnForce("fall");
    for (let i = 0; i < 60 * 30 && !(tn.phase === "fall" && tn.splashed && tn.fires >= 3); i++) look(1);
    const falling = measure();
    falling.debris = tn.debrisMesh.count; falling.sparks = tn.spN; falling.puffs = tn.puffN;
    const shadows = []; tn.g.traverse(o => { if (o.isMesh && o.castShadow) shadows.push(o.uuid); });
    return { up, falling, shadows: shadows.length, tris: (() => { let n = 0; tn.g.traverse(o => { if (o.isMesh) n += o.geometry.attributes.position.count / 3; }); return n; })() };
  });
  check(`titan: the frame -- up it adds ${frame.up.calls} draw calls and ${frame.up.tris} triangles, mid-fall ${frame.falling.calls} and ${frame.falling.tris} (budget 22 calls, 15k triangles); it casts no shadow`,
    frame.up.calls > 5 && frame.up.calls <= 22 && frame.up.tris <= 15000 && frame.falling.calls <= 22 && frame.falling.tris <= 15000 && frame.shadows === 0, frame);

  // ---- 9. zero text
  const text = await page.evaluate(() => {
    const a = document.getElementById("titanArrow");
    return { text: a.textContent.trim(), tag: a.tagName, button: !!a.closest("button"), declared: !!window.__lp.BUTTONS.titanArrow, overlay: true };
  });
  check(`titan: its arrow is an icon -- no text, no digit, not a button`, text.text === "" && text.tag === "DIV" && !text.button && !text.declared, text);

  check("titan: no page errors", errors.length === 0, errors.slice(0, 4));
  await page.context().close();
};
