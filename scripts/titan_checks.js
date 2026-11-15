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
//  10-18. (v219) ITS ATTACKS -- see attackChecks below: never unprovoked; announced and shown on his screen; never
//      under 5.5 s, on the thing itself; dodged by the noisy finger (real touches) and real hands-off; a hit never
//      loops; never behind the cards, in the rescue, on an approach, on the ground, in dad mode or in anything but the
//      plane and the helicopter; his missile interrupts it; flown off, it gives up; felled, it forgets; the cost.
//      Sections 4b and 7 were amended for it (the tail swipe's stated exception; the arrow behind him, engaged high,
//      off his own aircraft; and a crossing of meshR).
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
  // (v219) across meshR, both ways: its solids come on WITH its body, never before it is drawn -- flown in from 2.6 km
  // to 1.6 km and back out, every frame: a live capsule with the body not drawn is a wall he cannot see
  const across = await page.evaluate(() => {
    const L = window.__lp, H = window.__tn, tn = L.titan, st = L.state, T = H.T;
    L.tnReset(); H.asPlane(); L.tnForce("up"); tn.hold = true; H.step(2);
    let bad = 0, onF = 0, drawnF = 0, frames = 0, firstSolid = null, firstDrawn = null;
    const rx = Math.cos(tn.yaw + Math.PI / 2), rz = -Math.sin(tn.yaw + Math.PI / 2);
    const leg = (from, to, n) => {
      for (let i = 0; i <= n; i++) {
        const d = from + (to - from) * i / n;
        st.x = tn.x + Math.sin(tn.yaw) * d; st.z = tn.z + Math.cos(tn.yaw) * d; st.y = 400; st.heading = Math.atan2(Math.sin(tn.yaw) * Math.sign(to - from), Math.cos(tn.yaw) * Math.sign(to - from)); st.pitch = 0; st.bank = 0; st.speed = st.vp.cruiseSpeed; st.phase = "AIRBORNE"; st.engaged = false;
        L.update(1 / 60); frames++;
        const live = tn.recs.some(r => !L.isSolidHidden(r)), drawn = tn.g.visible;
        if (live) onF++; if (drawn) drawnF++;
        if (live && firstSolid === null) firstSolid = Math.round(Math.hypot(L.camera.position.x - tn.x, L.camera.position.z - tn.z));
        if (drawn && firstDrawn === null) firstDrawn = Math.round(Math.hypot(L.camera.position.x - tn.x, L.camera.position.z - tn.z));
        if (live && !drawn) bad++;
      }
    };
    leg(2600, 1600, 60 * 18); leg(1600, 2600, 60 * 18);
    tn.hold = false;
    return { frames, bad, onF, drawnF, firstSolid, firstDrawn, meshR: T.meshR };
  });
  check(`titan: flown across meshR (${across.meshR} m) in and out, every frame: its solids come on WITH its body (drawn from ${across.firstDrawn} m, solid from ${across.firstSolid} m), never live while it is not drawn (${across.bad})`,
    across.bad === 0 && across.onF > 60 && across.drawnF > 60 && across.onF < across.frames && across.drawnF < across.frames, across);
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
    // (v219) each capsule with whether it is LIVE in the registry: a capsule off it (the tail through an announced
    // swipe, titan.tailOff) is not a solid, and only a solid's move counts -- compared where it is live in both frames
    const caps = () => tn.recs.map(r => [r.cap.a[0], r.cap.a[1], r.cap.a[2], r.cap.b[0], r.cap.b[1], r.cap.b[2], r.cap.r, L.isSolidHidden(r) ? 0 : 1]);
    const diff = (a, b) => { let m = 0; for (let i = 0; i < a.length; i++) { if (!a[i][7] || !b[i][7]) continue; for (let k = 0; k < 7; k++) m = Math.max(m, Math.abs(a[i][k] - b[i][k])); } return m; };
    const hidMoved = (a, b) => { for (let i = 0; i < a.length; i++) { if (a[i][7] && b[i][7]) continue; for (let k = 0; k < 7; k++) if (Math.abs(a[i][k] - b[i][k]) > 1e-6) return true; } return false; };
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
      let bangs = 0, nearF = 0, worst = 0, prev = null, prevAnn = false, minGap = 1e9, offMoves = 0, offMovesAnnounced = 0;
      const s0 = L.flags.tnStaggers || 0, k0 = L.flags.tnStaggersSkipped || 0, h0 = L.flags.tnHits || 0, a0 = L.flags.tnAtkFlashes || 0, ah0 = L.flags.tnAtkHits || 0;
      for (let i = 0; i < 60 * 30; i++) {
        heli.vx = heli.vz = heli.vy = 0; heli.altitude = p.y; heli.target = null; st.x = p.x; st.z = p.z; st.y = p.y; L.api.clearStick();
        if (where === "neck" && i === 60 * 10) { st.missileCooldown = 0; st.heading = Math.atan2(-((tn.x) - p.x), -((tn.z) - p.z)); H.fire(); }   // a hit while he is there
        const was = st.exploding; L.update(1 / 60); if (!was && st.exploding) bangs++;
        minGap = Math.min(minGap, L.tnGap());
        const c = caps();
        if (tn.near) {
          nearF++;
          // (announced: a swipe on or the tail coming home -- this frame, or the frame before: its last step home lands at 0)
          const ann = tn.tailBlend > 0 || (tn.atk && tn.atk.on && tn.atk.kind === "tail");
          if (prev) { worst = Math.max(worst, diff(prev, c)); if (hidMoved(prev, c)) { offMoves++; if (ann || prevAnn) offMovesAnnounced++; } }
          prev = c; prevAnn = ann;
        } else prev = null;
      }
      return { bangs, nearF, moved: +worst.toFixed(5), minGap: Math.round(minGap), hits: (L.flags.tnHits || 0) - h0, staggers: (L.flags.tnStaggers || 0) - s0, skipped: (L.flags.tnStaggersSkipped || 0) - k0,
               flashes: (L.flags.tnAtkFlashes || 0) - a0, atkHits: (L.flags.tnAtkHits || 0) - ah0, offMoves, offMovesAnnounced };
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
  // (v219) THE STATED EXCEPTION: hovering there he is inside provokeR, so it is provoked -- beside its LEG or NECK
  // nothing can come (no tail mark there, and inside its sweep no boulder or beam): no attack, no bang, as in stage 1.
  // Beside its TAIL the tail swipe comes, ANNOUNCED: through it the tail is off the registry (not a solid), so still
  // not one LIVE capsule moves; the tail's moves are all inside the swipe; and every bang there is the swipe's own hit
  for (const w of ["tail", "leg", "neck"]) {
    const r = sweep[w];
    check(`titan: a helicopter hovering beside its ${w.toUpperCase()} (${r.minGap} m off a part's surface) for 30 s: across ${r.nearF} frames inside its sweep not one of its LIVE solid capsules moves (worst ${r.moved} m)${w === "tail" ? `; the tail moved off the registry on ${r.offMoves} frames, every one inside an announced swipe (${r.flashes} flashed), and its bangs (${r.bangs}) are the swipe's hits (${r.atkHits})` : `, no attack, no bang`}${w === "neck" ? `; a missile hit landed meanwhile skips the stagger (${r.skipped})` : ""}`,
      r.nearF > 60 * 25 && r.moved === 0 && r.offMoves === r.offMovesAnnounced &&
      (w === "tail" ? (r.flashes >= 1 && r.offMoves > 0 && r.bangs === r.atkHits) : (r.bangs === 0 && r.flashes === 0 && r.offMoves === 0)) &&
      (w !== "neck" || (r.hits === 1 && r.skipped === 1 && r.staggers === 0)), r);
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
      // behind him, mirrored -- and (v219) never up: a robot behind and below the seat's eye was put on the TOP edge
      const truth = () => { L.camera.updateMatrixWorld(); const v = new V(tn.x, tn.y + T.top * 0.55, tn.z).project(L.camera); let x = v.x, y = v.y; if (v.z > 1) { x = -x; y = -Math.abs(y); if (Math.abs(x) < 1e-3 && Math.abs(y) < 1e-3) y = -1; } return Math.atan2(x, y); };   // (dead behind: straight down)
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
        // (v219) and in the chase view never on his own aircraft: his position projected, a disc arrowPlaneR round it
        let overMe = false;
        if (L.state.viewChase) {
          L.camera.updateMatrixWorld();
          const c = new V(L.state.x, L.state.y, L.state.z).project(L.camera), mx = (c.x + 1) / 2 * innerWidth, my = (1 - c.y) / 2 * innerHeight;
          const e2 = new V().setFromMatrixColumn(L.camera.matrixWorld, 0).multiplyScalar(T.arrowPlaneR).add(new V(L.state.x, L.state.y, L.state.z)).project(L.camera);
          const r = Math.hypot((e2.x + 1) / 2 * innerWidth - mx, (1 - e2.y) / 2 * innerHeight - my);
          overMe = c.z < 1 && rc.left < mx + r && rc.right > mx - r && rc.top < my + r && rc.bottom > my - r;
        }
        const top = rc.top < innerHeight * 0.15;   // on the top edge
        out.arrow.push({ tag, how: tn.arrowHow, aboveDash, err: +err.toFixed(1), atEdge: atEdge || beside, edge: atEdge, beside, gap, at: [Math.round(rc.left), Math.round(rc.top)], overHome, overMe, top, chase: !!L.state.viewChase, homeOn: !!hs, obst, size: Math.round(rc.width), btnSize });
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
      // (v219) it dead BEHIND him -- level with him, and him high over it -- from the SEAT and from the chase view
      for (const [tag, up] of [["behind-level", 0], ["behind-high", 380], ["behind-low", -1]]) for (const chase of [false, true]) {
        L.api.setView(chase);
        const away = tn.yaw, hx = tn.x + Math.sin(away) * 700, hz = tn.z + Math.cos(away) * 700;
        const hold2 = () => { st.x = hx; st.z = hz; st.y = up < 0 ? L.seaLevelAt(hx, hz) + 25 : tn.y + T.top * 0.55 + up; st.heading = Math.atan2(-Math.sin(away), -Math.cos(away)); /* (forward is (-sin h, -cos h): on, away from it) */ st.pitch = 0; st.bank = 0; st.engaged = false; st.speed = st.vp.cruiseSpeed; st.phase = "AIRBORNE"; };
        for (let i = 0; i < 90; i++) { hold2(); L.update(1 / 60); }
        if (seen()) judge("flight-" + tag + "-" + (chase ? "chase" : "seat")); else out.arrow.push({ tag: "flight-" + tag + "-" + (chase ? "chase" : "seat"), missing: true, onScreen: L.tnOnScreen() });
      }
      L.api.setView(true);
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
      // (v219) ENGAGED BUT HIGH -- as he is put back together over it after a bang into it, facing New York: the
      // approach is engaged, he is 300 m up, and the arrow still points at it (it goes only low on the glide)
      {
        L.tnForce("up");
        let engHigh = 0, shownHigh = 0;
        for (let i = 0; i < 90; i++) {
          st.x = tn.x - 300; st.z = tn.z - 260; st.y = 300; st.heading = 0; st.pitch = 0; st.bank = 0; st.speed = st.vp.cruiseSpeed; st.phase = "AIRBORNE"; st.liftoffTimer = 0; st.maxAglSinceLiftoff = 1e9;
          L.update(1 / 60);
          if (i > 30 && st.engaged && !L.tnOnScreen()) { engHigh++; if (seen()) shownHigh++; }
        }
        out.engagedHigh = { engHigh, shownHigh };
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
    arrows.push({ vp: w + "x" + h, arrow: r.arrow, engaged: r.engaged, engagedHigh: r.engagedHigh, sameBearing: r.sameBearing, pass: r.pass, grid: r.grid, drag });
  }
  check(`titan: from the New York runway start -- portrait and landscape, seat and chase -- the robot or its arrow is on his screen every frame from its first rising frame, and the roar is fired`,
    miss.length === 4 && miss.every(o => o.frames > 400 && o.missed === 0 && o.arrow > 0 && o.roars >= 1), miss);
  const allA = arrows.flatMap(a => a.arrow.map(x => ({ vp: a.vp, ...x })));
  check(`titan: its arrow POINTS at it (worst ${Math.max(...allA.map(a => a.err || 0))} deg off), at the screen's edge (or, where the edge is a button column, beside it), button-sized, never on a control (btnObstructions), never on the home arrow, and in the chase view never on his own aircraft -- on the runway and in flight, both ways up (${allA.length} readings)`,
    allA.length === 24 && allA.every(a => !a.missing && a.err < 8 && a.atEdge && a.aboveDash && !a.overHome && !a.overMe && a.obst.length === 0 && a.size >= a.btnSize - 2) && allA.some(a => a.homeOn), allA);
  const behindA = allA.filter(a => /behind/.test(a.tag));
  check(`titan: it dead BEHIND him (level with its middle, him 380 m over it, and him low under it), from the SEAT as from the chase view, portrait and landscape: the arrow at the bottom or a side -- never the top (${behindA.length} readings)`,
    behindA.length === 12 && behindA.every(a => !a.missing && !a.top), behindA);
  check(`titan: on the SAME bearing as the home arrow (New York and it dead behind him, ${arrows.map(a => a.sameBearing.bearingGap).join("/")} deg apart) both are up and they do not overlap`,
    arrows.every(a => a.sameBearing.home && a.sameBearing.bearingGap < 3) && allA.filter(a => a.tag === "flight-samebearing").every(a => !a.missing && !a.overHome), arrows.map(a => a.sameBearing));
  check(`titan: flying past its flank, in every frame where no part of it is on his screen (${arrows.map(a => a.pass.offFrames).join("/")} frames) the arrow is on and points back at it (worst ${Math.max(...arrows.map(a => a.pass.worst))} deg)`,
    arrows.every(a => a.pass.offFrames > 60 && a.pass.arrowOff === 0 && a.pass.worst < 8), arrows.map(a => a.pass));
  check(`titan: the arrow's last resort -- every edge place and the bearing taken -- finds the clear place nearest the edge point (${arrows.map(a => a.grid.how).join("/")}), and with nowhere clear says so`,
    arrows.every(a => a.grid.how === "grid" && a.grid.ok && a.grid.none === "none"), arrows.map(a => a.grid));
  check(`titan: the arrow takes no taps (pointer-events ${arrows.map(a => a.drag.pe).join("/")}): a drag that starts on it steers him`,
    arrows.every(a => a.drag.on && a.drag.pe === "none" && a.drag.during && a.drag.during.touching && (Math.abs(a.drag.during.pitch) > 0.1 || Math.abs(a.drag.during.bank) > 0.1)), arrows.map(a => a.drag));
  check(`titan: low on an engaged approach (the glide) the arrow is gone (${arrows.map(a => a.engaged.engagedF).join("/")} engaged frames); engaged but 300 m up -- as he comes back over it facing New York -- it still points (${arrows.map(a => a.engagedHigh.shownHigh + "/" + a.engagedHigh.engHigh).join(", ")})`,
    arrows.every(a => a.engaged.engagedF > 60 && a.engaged.shownEngaged === 0 && a.engagedHigh.engHigh > 30 && a.engagedHigh.shownHigh === a.engagedHigh.engHigh), arrows.map(a => ({ low: a.engaged, high: a.engagedHigh })));

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

  await attackChecks({ newPage, check });
};

// ===========================================================================
// v219, STAGE 2: ITS THREE ATTACKS -- the boulder of scrap, the eye beam, the tail swipe
//   10. never unprovoked; provoked by a hit, and by nearness
//   11. every attack announced (eyes flash, the wind-up roar) and its mark or path ON his screen -- both seats,
//       portrait and landscape -- and flash to impact >= minLead, on the thing itself
//   12. dodgeable by the NOISY FINGER (real touch events, 60 Hz): the log; and hands-off IS hit
//   13. a hit: one bang, back where it happened, calm, no second bang in 20 s hands-off; another bang calls one off
//   14. never: behind the picker, in an eject, on an engaged approach, on the ground, in dad mode, in a boat, car or rocket
//   15. his missile knocks it out of a wind-up (each attack), with the near stagger rule
//   16. flown away mid-wind-up: it gives up, nothing thrown, nothing left
//   17. felled mid-attack: the attack dies with it; rebuilt, it has forgotten him
//   18. the frame with each attack live; a whole cycle with attacks draws nothing and adds nothing; zero text
// (the leaving matrix's rows: planeTitanAttack, heliTitanAttack, in leave_matrix_checks)
// ===========================================================================
function tnaHelpers() {
  const L = window.__lp, st = L.state, tn = L.titan, T = L.TUNE.titan, TA = T.atk;
  L.noRender = true;
  const sea = () => L.seaLevelAt(tn.x, tn.z);
  const step = (n, fn) => { for (let i = 0; i < n; i++) { if (fn) fn(i); L.update(1 / 60); } };
  // the three ways he meets it, the robot facing EAST (out of the approach's way: heading west he is never on the
  // approach to New York's north end, flight.js updateAssists)
  function setup(sc, opts) {
    opts = opts || {};
    L.tnReset();
    L.api.clearStick();
    const planeLike = sc === "plane" || sc === "planeN";
    if (planeLike) { L.api.setVehicle("prop"); L.api.teleportAirborne(1500, 0, 300, 0); step(5); }
    else { L.api.setVehicle("helicopter"); L.api.spawnAt(0, 0); step(10); heli.vertical = 1; step(60); heli.vertical = 0; }
    // it stood at the EAST end of its path, facing east: there a plane turning south off it stays more than
    // approachEngageDist from New York's north end -- nearer, a turn to the south engages the approach and calls
    // the attack off, which is not a dodge (flight.js updateAssists)
    // ("planeN": at HOME, where it rises, facing north -- him coming from the north as on his real route, the
    // approach to New York engaging as it will: `engaged` is left to the game)
    L.tnForce("up");
    if (sc !== "planeN") { tn.x = T.path[T.path.length - 1][0]; tn.z = T.path[T.path.length - 1][1]; tn.y = L.seaLevelAt(tn.x, tn.z); tn.yaw = Math.PI / 2; } else tn.yaw = 0;
    step(3);
    tn.atkPick = opts.kind || null;
    if (sc === "plane") {
      st.x = tn.x + (opts.dist || 820); st.z = tn.z + (opts.lat || 40); st.y = sea() + (opts.h || 90);
      st.heading = Math.PI / 2; st.pitch = 0; st.bank = 0; st.speed = st.vp.cruiseSpeed; st.phase = "AIRBORNE"; st.engaged = false;
    } else if (sc === "planeN") {
      st.x = tn.x + (opts.lat || 40); st.z = tn.z + (opts.dist || 820); st.y = sea() + (opts.h || 90);
      st.heading = 0; st.pitch = 0; st.bank = 0; st.speed = st.vp.cruiseSpeed; st.phase = "AIRBORNE"; st.maxAglSinceLiftoff = 1e9;
    } else {
      if (sc === "heliTail") { st.x = tn.x - 75; st.z = tn.z + 30; st.y = sea() + 30; }
      else { st.x = tn.x + (opts.dist || 420); st.z = tn.z + (opts.lat || 0); st.y = sea() + (opts.h || 70); }
      heli.altitude = st.y; heli.vx = heli.vz = heli.vy = 0; heli.target = null; heli.facing = null; heli.turn = 0;
      st.heading = Math.atan2(-(tn.x - st.x), -(tn.z - st.z)); st.phase = "AIRBORNE"; st.speed = 0;
    }
    if (opts.view !== undefined) L.api.setView(opts.view === "chase");
    // the camera settled on him where he is (the chase camera eases in after a jump), nothing attacking meanwhile
    const pose = { x: st.x, y: st.y, z: st.z, h: st.heading };
    tn.atkCalm = 1e9;
    for (let i = 0; i < (opts.settle === undefined ? 60 : opts.settle); i++) {
      st.x = pose.x; st.y = pose.y; st.z = pose.z; st.heading = pose.h;
      if (!planeLike) { heli.vx = heli.vz = heli.vy = 0; heli.altitude = pose.y; } else { st.pitch = 0; st.bank = 0; st.speed = st.vp.cruiseSpeed; }
      L.update(1 / 60);
    }
    tn.atkCalm = 0; tn.atkGap = 0;
    if (opts.provoke !== false) tn.provoked = true;   // (the harness's: provocation is section 10's to prove)
    return true;
  }
  // run until it flashes (or n frames), hands-off; returns the frame count, or -1
  function toFlash(n) { const f0 = L.flags.tnAtkFlashes || 0; for (let i = 0; i < (n || 600); i++) { L.update(1 / 60); if ((L.flags.tnAtkFlashes || 0) > f0) return i; } return -1; }
  const bangEdge = (() => { let was = false; return { reset() { was = !!st.exploding; }, tick() { const e = !was && st.exploding; was = !!st.exploding; return e; } }; })();
  // the attack's pieces on HIS screen: projected by the camera he is looking through; inside the window, above the
  // dash, and not under a control
  function onScreen() {
    const cam = L.camera; cam.updateMatrixWorld();
    const W = innerWidth, H = innerHeight, dash = document.getElementById("dash").getBoundingClientRect().top || H;
    const ctr = L.btnControlRects();
    const V = cam.position.constructor;
    const px = (x, y, z) => { const v = new V(x, y, z).project(cam); return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H, z: v.z }; };
    const clear = (p) => p.z < 1 && p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= Math.min(H, dash) && !ctr.some(c => p.x >= c.left && p.x <= c.right && p.y >= c.top && p.y <= c.bottom);
    const A = tn.atk, ring = tn.atkRing, beads = tn.atkBeads;
    const rp = ring.visible ? px(ring.position.x, ring.position.y, ring.position.z) : null;
    const pos = beads.geometry.attributes.position.array, nB = beads.visible ? beads.geometry.drawRange.count : 0;
    let beadsOk = 0;
    for (let i = 0; i < nB; i++) if (clear(px(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]))) beadsOk++;
    return { ring: !!rp && clear(rp), ringAt: rp && [Math.round(rp.x), Math.round(rp.y)], beads: nB, beadsOk, ok: (!!rp && clear(rp)) || beadsOk >= 3 };
  }
  // the eyes, flashing: their colour off their resting cyan, bigger
  const eyesFlash = () => tn.eyes.every(e => e.s.visible && e.s.scale.x > T.eyeSize * 1.3) && tn.eyes.some(e => e.s.material.color.getHex() !== T.eyeColor);
  window.__tna = { L, st, tn, T, TA, sea, step, setup, toFlash, bangEdge, onScreen, eyesFlash };
}

async function attackChecks({ newPage, check, skipNoisy }) {
  const { page, errors } = await newPage(820, 1180);
  await page.evaluate(tnaHelpers);

  // ---- 10. never unprovoked; provoked by a hit; provoked by nearness
  const prov = await page.evaluate(() => {
    const { L, st, tn, TA, step, setup } = window.__tna, out = {};
    // the prop circling 640-1020 m off it (never inside provokeR), not firing, for THREE minutes; each frame also asked:
    // were it provoked, would it start one now? (so the zero is not for want of a chance)
    setup("plane", { provoke: false, dist: 700, lat: 450 });
    const tr = [], x0 = st.x, z0 = st.z, hd0 = st.heading;
    for (let i = 0; i < 60 * 30; i++) { L.api.setStick(0.75, 0); st.y = L.seaLevelAt(tn.x, tn.z) + 90; L.update(1 / 60); if (i > 60 * 10) tr.push([st.x, st.z]); }
    let cx = 0, cz = 0; for (const [x, z] of tr) { cx += x; cz += z; } cx /= tr.length; cz /= tr.length;
    // the same circle again, from the same start pose shifted so its centre is 620 m east of it
    const sx = tn.x + 620 - cx + x0, sz = tn.z - cz + z0;
    st.x = sx; st.z = sz; st.heading = hd0; st.pitch = 0; st.bank = 0; st.speed = st.vp.cruiseSpeed;
    const f0 = L.flags.tnAtkFlashes || 0;
    let would = 0, minD = 1e9;
    for (let i = 0; i < 60 * 180; i++) {
      L.api.setStick(0.75, 0); st.y = L.seaLevelAt(tn.x, tn.z) + 90; L.update(1 / 60);
      minD = Math.min(minD, L.tnDist ? L.tnDist() : Math.hypot(st.x - tn.x, st.z - tn.z));
      if (i % 10 === 0) { tn.provoked = true; if (!L.tnAtkWhyNot()) would++; tn.provoked = false; }
      if (tn.provoked) break;
    }
    L.api.clearStick();
    out.circle = { flashes: (L.flags.tnAtkFlashes || 0) - f0, would, minD: Math.round(minD), provoked: tn.provoked };
    // the helicopter hovering 300 m off, facing it, a minute
    setup("heli", { provoke: false, dist: 300 });
    const g0 = L.flags.tnAtkFlashes || 0; let wouldH = 0;
    for (let i = 0; i < 60 * 60; i++) { heli.vx = heli.vz = 0; L.update(1 / 60); if (i % 10 === 0) { tn.provoked = true; if (!L.tnAtkWhyNot()) wouldH++; tn.provoked = false; } }
    out.hover = { flashes: (L.flags.tnAtkFlashes || 0) - g0, would: wouldH, provoked: tn.provoked };
    // provoked by a HIT: the helicopter 300 m off (outside provokeR) fires one missile by the button
    setup("heli", { provoke: false, dist: 300 });
    tn.provoked = false;
    const h0 = L.flags.tnHits || 0, a0 = L.flags.tnAtkFlashes || 0, ph0 = L.flags.tnProvoked_hit || 0;
    st.missileCooldown = 0;
    const b = document.getElementById("missileBtn");
    b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 3 })); b.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 3 }));
    let hitF = -1, flashF = -1;
    for (let i = 0; i < 60 * 12 && flashF < 0; i++) { heli.vx = heli.vz = 0; L.update(1 / 60); if (hitF < 0 && (L.flags.tnHits || 0) > h0) hitF = i; if ((L.flags.tnAtkFlashes || 0) > a0) flashF = i; }
    out.hit = { hit: hitF, flash: flashF, byHit: (L.flags.tnProvoked_hit || 0) - ph0, kind: tn.atk && tn.atk.kind };
    // provoked by NEARNESS: the helicopter 240 m off (inside provokeR), never firing
    const pn0 = L.flags.tnProvoked_near || 0;
    setup("heli", { provoke: false, dist: 240 });
    const n0 = L.flags.tnAtkFlashes || 0; let nf = -1;
    for (let i = 0; i < 60 * 8 && nf < 0; i++) { heli.vx = heli.vz = 0; L.update(1 / 60); if ((L.flags.tnAtkFlashes || 0) > n0) nf = i; }
    out.near = { flash: nf, byNear: (L.flags.tnProvoked_near || 0) - pn0, hits: 0 };
    L.tnAtkStop("check", false);
    return out;
  });
  check(`titan attacks: NEVER UNPROVOKED -- the prop circling ${prov.circle.minD} m and more off it for 3 minutes and the helicopter hovering 300 m off for a minute, never firing: no attack (${prov.circle.flashes}, ${prov.hover.flashes}), though it would have started one on ${prov.circle.would} and ${prov.hover.would} of the frames asked had it been provoked`,
    prov.circle.flashes === 0 && prov.hover.flashes === 0 && !prov.circle.provoked && !prov.hover.provoked && prov.circle.minD > 260 && prov.circle.would > 20 && prov.hover.would > 20, prov);
  check(`titan attacks: provoked by his HIT (the helicopter's missile, hit on frame ${prov.hit.hit}) it attacks (flash on frame ${prov.hit.flash}); provoked by NEARNESS alone (240 m, never firing) it attacks (frame ${prov.near.flash})`,
    prov.hit.hit >= 0 && prov.hit.flash > prov.hit.hit && prov.hit.byHit === 1 && prov.near.flash >= 0 && prov.near.byNear === 1, prov);

  // ---- 11. every attack ANNOUNCED, and where it lands ON HIS SCREEN; flash to impact on the thing itself
  const SCENES = [["plane", "boulder"], ["plane", "beam"], ["heli", "boulder"], ["heli", "beam"], ["heliTail", "tail"]];
  // (from his SEAT, hovering dead still behind it, the tail's mark is where his own eye is: it cannot be shown him,
  // so the tail does not start there -- asked separately below; every other start is judged here)
  const ann = [];
  for (const [w, h] of [[820, 1180], [1180, 820]]) {
    const { page: pg } = await newPage(w, h);
    await pg.evaluate(tnaHelpers);
    const r = await pg.evaluate((SCENES) => {
      const { L, st, tn, TA, setup, toFlash, onScreen, eyesFlash } = window.__tna, out = [];
      for (const view of ["seat", "chase"]) for (const [sc, kind] of SCENES) {
        setup(sc, { kind, view });
        if (view === "seat" && sc === "heliTail") {
          // still, from the seat: no tail (its mark is his eye) -- not for want of a mark
          const f = toFlash(60 * 4), mk = L.tnAtkWhyNot();
          out.push({ sc, kind, view, seatStill: true, flashed: f >= 0, why: tn.atkNo, gates: mk });
          continue;
        }
        const r0 = L.flags.tnAtkRoars || 0, w0 = L.flags.tnSnd_windup || 0;
        const f = toFlash(240);
        const at = { sc, kind, view, flashed: f >= 0, got: tn.atk && tn.atk.kind };
        if (f < 0) { at.why = tn.atkNo; out.push(at); continue; }
        at.roar = (L.flags.tnAtkRoars || 0) - r0; at.windup = (L.flags.tnSnd_windup || 0) - w0;
        at.flashSeen = eyesFlash(); const s0 = onScreen(); at.first = s0;
        // ... and a second on, hands-off, still flashing and still shown; and both flash colours seen
        const cols = new Set(); let stillFlash = 0;
        for (let i = 0; i < 60; i++) { if (sc !== "plane") heli.vx = heli.vz = 0; L.update(1 / 60); cols.add(tn.eyes[0].s.material.color.getHex()); if (eyesFlash()) stillFlash++; }
        at.colours = cols.size; at.stillFlash = stillFlash; at.later = onScreen();
        // hands-off on: when (from the flash) it bangs him
        let bang = -1; const b0 = L.flags.tnAtkHits || 0;
        for (let i = 61; i < 60 * 9 && bang < 0; i++) { if (sc !== "plane") heli.vx = heli.vz = 0; L.update(1 / 60); if ((L.flags.tnAtkHits || 0) > b0) bang = i; }
        at.impact = bang < 0 ? null : +((bang + 1) / 60).toFixed(2);
        out.push(at);
        for (let i = 0; i < 60 * 3 && st.exploding; i++) L.update(1 / 60);
      }
      return out;
    }, SCENES);
    await pg.context().close();
    for (const x of r) ann.push({ vp: w + "x" + h, ...x });
  }
  const seatStill = ann.filter(a => a.seatStill), annJ = ann.filter(a => !a.seatStill);
  check(`titan attacks: from his SEAT, hovering dead still behind it, the tail does not start (its mark would be his own eye, and it never starts what it cannot show him): ${seatStill.map(a => a.vp + " " + a.why).join(", ")}`,
    seatStill.length === 2 && seatStill.every(a => !a.flashed && a.why === "no tail mark" && a.gates === ""), seatStill);
  const annBad = annJ.filter(a => !a.flashed || a.got !== a.kind || a.roar !== 1 || a.windup !== 1 || !a.flashSeen || a.colours < 2 || a.stillFlash < 55 || !a.first.ok || !a.later.ok || a.impact === null || a.impact < 5.5);
  check(`titan attacks: ANNOUNCED, all three, from the plane and the helicopter, seat and chase, portrait and landscape (${annJ.length} starts): the eyes flash yellow and white, the wind-up roar plays once, and its mark or path is ON HIS SCREEN (inside the window, above the dash, under no control) at the flash and a second on; hands-off it lands ${Math.min(...annJ.map(a => a.impact || 99))}-${Math.max(...annJ.map(a => a.impact || 0))} s after the flash (never under 5.5)`,
    annJ.length === 18 && annBad.length === 0, annBad.length ? annBad : annJ.map(a => `${a.vp} ${a.view} ${a.sc}/${a.kind}: ring ${a.first.ring} beads ${a.first.beadsOk}/${a.first.beads} impact ${a.impact}`));

  // flash to impact, on the THING ITSELF: him held ON the boulder's ball, the beam's tip, the tail's capsule from the
  // flash on -- the first frame it can bang him is minLead after the flash, never sooner
  const glue = await page.evaluate((SCENES) => {
    const { L, st, tn, TA, setup, toFlash } = window.__tna, out = [];
    for (const [sc, kind] of SCENES) {
      setup(sc, { kind, view: "chase" });
      if (toFlash(240) < 0) { out.push({ sc, kind, flashed: false }); continue; }
      const b0 = L.flags.tnAtkHits || 0; let bang = -1, glued = 0, from = 99;
      for (let i = 0; i < 60 * 9 && bang < 0; i++) {
        const A = tn.atk;
        let p = null;
        if (kind === "boulder" && tn.boulder.visible) p = tn.boulder.position;
        else if (kind === "beam" && tn.atkBeam.visible) p = tn.atkGlow.position;   // the beam's tip
        else if (kind === "tail") { const c = L.tnTailRec().cap; p = { x: (c.a[0] + c.b[0]) / 2, y: (c.a[1] + c.b[1]) / 2, z: (c.a[2] + c.b[2]) / 2 }; }
        // (held on it only once it is 150 m out from its middle: pinned in its hands he would be inside its body -- a wall)
        // (and on the beam's tip only once it is up off the sea: walking the water, he would be in the sea)
        if (p && kind === "beam" && p.y < L.seaLevelAt(p.x, p.z) + 10) p = null;
        if (p && (kind === "tail" || Math.hypot(p.x - tn.x, p.z - tn.z) > 150)) { st.x = p.x; st.y = p.y; st.z = p.z; glued++; if (A.t < from) from = A.t; if (sc !== "plane") { heli.vx = heli.vz = 0; heli.altitude = p.y; } }
        L.update(1 / 60);
        if ((L.flags.tnAtkHits || 0) > b0) bang = i + 1;
      }
      out.push({ sc, kind, flashed: true, glued, from: +from.toFixed(2), firstBang: bang < 0 ? null : +(bang / 60).toFixed(3) });
      for (let i = 0; i < 60 * 3 && st.exploding; i++) L.update(1 / 60);
    }
    return out;
  }, SCENES);
  check(`titan attacks: flash to impact on the THING ITSELF -- him held on the boulder, the beam's tip, the tail's capsule from the flash: the first bang ${glue.map(g => g.kind + " " + g.firstBang + " s").join(", ")} (never under 5.5 s)`,
    glue.length === 5 && glue.every(g => g.flashed && g.glued > 30 && g.from < 5 && g.firstBang !== null && g.firstBang >= 5.5 && g.firstBang < 5.7), glue);

  // ---- 13. a HIT on him: one bang, back where it happened (and how high), and it is SATISFIED -- left hands-off there
  // for 90 s, nothing comes again: the prop (it flies on), the helicopter hovering where it was hit OUTSIDE provokeR, and
  // the helicopter hit INSIDE provokeR (the case that looped: a hover banged every 21 s for ever)
  const hitR = await page.evaluate(() => {
    const { L, st, tn, TA, setup, toFlash, bangEdge } = window.__tna, out = {};
    for (const [tag, sc, kind, dist] of [["heliOut", "heli", "boulder", 420], ["heliIn", "heli", "boulder", 200], ["plane", "plane", "beam", 820]]) {
      setup(sc, { kind, view: "chase", dist });
      toFlash(240);
      bangEdge.reset();
      let at = null, back = null, bangs = 0, f = 0, provokedAfter = null, flAfter = 0, gapMin = 1e9;
      const h0 = L.flags.tnAtkHits || 0, sea = L.seaLevelAt(tn.x, tn.z);
      for (; f < 60 * 100; f++) {
        if (sc !== "plane" && !st.exploding) { heli.vx = heli.vz = 0; }
        L.api.clearStick();
        const was = st.exploding;
        L.update(1 / 60);
        if (bangEdge.tick()) { bangs++; if (!at) at = { x: st.x, y: st.y, z: st.z, f }; }
        if (was && !st.exploding && !back) { back = { x: st.x, y: st.y, z: st.z, f, inside: L.tnInside() }; flAfter = L.flags.tnAtkFlashes || 0; provokedAfter = tn.provoked; }
        if (back) gapMin = Math.min(gapMin, Math.hypot(st.x - tn.x, st.z - tn.z));
        if (back && f - back.f >= 60 * 90) break;
      }
      out[tag] = { bangs, hits: (L.flags.tnAtkHits || 0) - h0, at: at && [Math.round(at.x), Math.round(at.y), Math.round(at.z)], back: back && [Math.round(back.x), Math.round(back.y), Math.round(back.z)],
        off: at && back ? Math.round(Math.hypot(at.x - back.x, at.z - back.z)) : null, inside: back && back.inside, watched: back ? Math.round((f - back.f) / 60) : 0,
        overSea: back ? Math.round(back.y - sea) : null, overTop: back ? Math.round(back.y - (tn.y + L.TUNE.titan.top)) : null, up: at && back ? Math.round(back.y - at.y) : null,
        provokedAfter, flashesAfter: (L.flags.tnAtkFlashes || 0) - flAfter, nearest: Math.round(gapMin), provokeR: TA.provokeR };
    }
    return out;
  });
  for (const v of ["heliOut", "heliIn", "plane"]) {
    const r = hitR[v];
    check(`titan attacks: a HIT on him (${v === "plane" ? "the prop, the beam" : "the helicopter hovering " + (v === "heliIn" ? "INSIDE" : "outside") + " provokeR, the boulder"}) is ONE bang, back together where it happened (${r.off} m off, ${r.up} m higher: ${r.overSea} m over the sea, ${r.overTop} m over its head), and it is SATISFIED (provoked: ${r.provokedAfter}) -- ${r.watched} s hands-off after: no flash (${r.flashesAfter}), no second bang`,
      r.bangs === 1 && r.hits === 1 && r.off !== null && r.off < 80 && !r.inside && r.overTop > 0 && r.provokedAfter === false && r.flashesAfter === 0 && r.watched >= 90, r);
  }
  // another bang (into the sea) with the boulder in the air: the strike is called off -- never put back together into one
  const other = await page.evaluate(() => {
    const { L, st, tn, TA, setup, toFlash } = window.__tna;
    setup("plane", { kind: "boulder", view: "chase" });
    toFlash(240);
    for (let i = 0; i < 60 * 3.2; i++) L.update(1 / 60);   // thrown
    const thrown = tn.atk.stage === "strike" && tn.boulder.visible;
    st.pitch = -70; st.y = L.seaLevelAt(st.x, st.z) + 12;   // straight into the sea
    const a0 = L.flags.tnAtkAbandon_bang || 0, h0 = L.flags.tnAtkHits || 0;
    let bangF = -1, liveAfter = 0, shownAt = null, backF = -1, calmF = 0, calmFlash = 0, f0 = 0;
    for (let i = 0; i < 60 * 30; i++) {
      L.api.clearStick();
      const was = st.exploding;
      L.update(1 / 60);
      if (bangF < 0 && st.exploding) bangF = i;
      if (bangF >= 0 && i > bangF && tn.atk.on && tn.atk.stage === "strike") liveAfter++;   // (from its first frame after the bang)
      if (bangF >= 0 && i === bangF + 40) shownAt = L.tnAtkShown();
      if (was && !st.exploding && backF < 0) { backF = i; f0 = L.flags.tnAtkFlashes || 0; }
      // back, and STILL provoked (it did not get him): held off by its calm alone
      if (backF >= 0 && i - backF < 60 * TA.calm - 1) { if (L.tnAtkWhyNot() === "calm") calmF++; }
      if (backF >= 0 && i - backF === 60 * TA.calm - 1) calmFlash = (L.flags.tnAtkFlashes || 0) - f0;
    }
    return { thrown, bangF, calledOff: (L.flags.tnAtkAbandon_bang || 0) - a0, liveAfter, shownAt, hits: (L.flags.tnAtkHits || 0) - h0, provoked: tn.provoked, calmF, calmFlash, calm: TA.calm };
  });
  check(`titan attacks: a bang of his own (into the sea) with the boulder in the air calls the strike off that frame (${other.calledOff}) -- nothing of it left live (${other.liveAfter} frames) or drawn 0.66 s on, and it never hits him; back together, still provoked, it is held by its calm alone for ${other.calm} s (${other.calmF} frames) and does not flash (${other.calmFlash})`,
    other.thrown && other.bangF >= 0 && other.calledOff === 1 && other.liveAfter === 0 && other.shownAt === false && other.hits === 0 &&
    other.provoked === true && other.calmF > 60 * (other.calm - 1) && other.calmFlash === 0, other);

  // ---- 14. NEVER: behind the picker, in an eject, on an engaged approach, on the ground, in dad mode, in a boat, car or rocket
  const never = await page.evaluate(() => {
    const { L, st, tn, TA, setup, toFlash, step } = window.__tna, out = {};
    const tap = (e) => { e.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 5 })); e.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 5 })); };
    // the picker, opened a second into a wind-up: abandoned, and 20 s behind the cards nothing flashes or hits
    setup("heli", { kind: "boulder", view: "chase" });
    toFlash(240); step(60, () => { heli.vx = heli.vz = 0; });
    const mb = document.getElementById("menuBtn"), vb = document.getElementById("vehBtn");
    tap(L.BUTTONS.menuBtn.when() ? mb : vb);
    const open = L.menuOpen(), p0 = L.flags.tnAtkAbandon_picker || 0, f0 = L.flags.tnAtkFlashes || 0, h0 = L.flags.tnAtkHits || 0;
    step(1);
    const calledOff = (L.flags.tnAtkAbandon_picker || 0) - p0;
    step(40); const shown = L.tnAtkShown();
    step(60 * 20);
    out.picker = { open, calledOff, shown, flashes: (L.flags.tnAtkFlashes || 0) - f0, hits: (L.flags.tnAtkHits || 0) - h0, why: L.tnAtkWhyNot() };
    for (const id of ["screenVehicle", "screenDir", "screenDest"]) document.getElementById(id).classList.add("hiddenS");
    // an eject a second into a wind-up: gone at once (the stand-down), nothing while he is under the canopy
    setup("plane", { kind: "beam", view: "chase" });
    toFlash(240); step(60);
    const e0 = L.flags.tnAtkFlashes || 0, eh0 = L.flags.tnAtkHits || 0;
    const started = ejectStart();
    const goneAtOnce = !L.tnAtkShown() && !(tn.atk && tn.atk.on);
    let n = 0; while (eject.active && n++ < 60 * 40) L.update(1 / 60);
    out.eject = { started, goneAtOnce, flashes: (L.flags.tnAtkFlashes || 0) - e0, hits: (L.flags.tnAtkHits || 0) - eh0, secs: +(n / 60).toFixed(1) };
    // an engaged approach to New York's north end he is LINED UP on (180 m off the runway's line, under landLat), it
    // ahead of him (stood at the west end of its path): the approach is all that holds it back
    setup("plane", { view: "seat" });
    tn.x = L.TUNE.titan.path[0][0]; tn.z = L.TUNE.titan.path[0][1]; tn.y = L.seaLevelAt(tn.x, tn.z);
    st.x = 180; st.z = 7900; st.y = 90; st.heading = 0; st.speed = st.vp.cruiseSpeed; st.phase = "AIRBORNE";
    // (a few frames first for the approach to see him -- the robot's frame runs before the flight model's in update()
    // -- then it already facing him: the approach must be ALL that holds it back)
    tn.atkCalm = 1e9; for (let i = 0; i < 10; i++) { L.api.clearStick(); L.update(1 / 60); }
    tn.atkCalm = 0; tn.yaw = Math.atan2(st.x - tn.x, st.z - tn.z);
    const l0 = L.flags.tnAtkFlashes || 0; let engagedF = 0, onlyLanding = 0;
    for (let i = 0; i < 60 * 5; i++) {
      L.api.clearStick(); L.update(1 / 60);
      if (st.engaged) { engagedF++; const was = st.engaged; st.engaged = false; const no = L.tnAtkWhyNot(); st.engaged = was; if (!no) onlyLanding++; }
    }
    out.landing = { engagedF, onlyLanding, flashes: (L.flags.tnAtkFlashes || 0) - l0, lat: Math.round(st.approachData ? st.approachData.lat : -1) };
    // ... and engaged but NOT lined up (flying at it near home from the north, 730 m off the line): not landing -- it attacks
    setup("planeN", { view: "seat" });
    const k0 = L.flags.tnAtkFlashes || 0; let engOff = 0;
    for (let i = 0; i < 60 * 5; i++) { L.api.clearStick(); L.update(1 / 60); if (st.engaged) engOff++; }
    out.offLine = { engagedF: engOff, flashes: (L.flags.tnAtkFlashes || 0) - k0, lat: Math.round(st.approachData ? st.approachData.lat : -1) };
    L.tnAtkStop("check", false);
    // on the ground: the helicopter set down on the beach south of it, ~330 m off, facing it
    setup("heli", { view: "chase" });
    let zl = 7000; while (zl > 6000 && !(L.terrainEff(tn.x, zl) > L.seaLevelAt(tn.x, zl) + 1.5)) zl -= 10;   // the first dry ground south of it
    st.x = tn.x; st.z = zl - 30; st.heading = Math.atan2(-(tn.x - st.x), -(tn.z - st.z)); heli.altitude = st.y = L.terrainEff(st.x, st.z) + 30;
    heli.vertical = -1; let landed = -1;
    for (let i = 0; i < 60 * 30 && landed < 0; i++) { L.update(1 / 60); if (st.phase === "TAXI") landed = i; }
    heli.vertical = 0;
    const g0 = L.flags.tnAtkFlashes || 0; const whys = {};
    for (let i = 0; i < 60 * 15; i++) { L.update(1 / 60); const w = L.tnAtkWhyNot(); whys[w] = (whys[w] || 0) + 1; }
    out.ground = { landed, flashes: (L.flags.tnAtkFlashes || 0) - g0, whys, d: Math.round(Math.hypot(st.x - tn.x, st.z - tn.z)) };
    // dad mode: it is hidden and does not run; nothing flashes, nothing of an attack drawn
    setup("heli", { view: "chase" });
    L.dadEnter(); const d0 = L.flags.tnAtkFlashes || 0;
    step(60 * 10);
    out.dad = { flashes: (L.flags.tnAtkFlashes || 0) - d0, shown: L.tnAtkShown() };
    L.dadExit(); for (const id of ["screenVehicle", "screenDir", "screenDest"]) document.getElementById(id).classList.add("hiddenS");
    // a boat, a car, a rocket, each held 400 m off it, provoked, 15 s
    out.others = {};
    for (const v of ["speedboat", "car", "rocket"]) {
      L.tnReset(); L.api.setVehicle(v); L.api.spawnAt(0, 0); step(10);
      L.tnForce("up"); tn.yaw = Math.PI / 2; step(2); tn.provoked = true;
      const o0 = L.flags.tnAtkFlashes || 0, ws = {};
      for (let i = 0; i < 60 * 15; i++) {
        st.x = tn.x + 400; st.z = tn.z; st.heading = Math.PI / 2;
        if (v === "rocket") { st.y = L.seaLevelAt(tn.x, tn.z) + 80; st.phase = "AIRBORNE"; } else if (v === "car") st.y = L.seaLevelAt(tn.x, tn.z);
        L.update(1 / 60); const w = L.tnAtkWhyNot(); ws[w] = (ws[w] || 0) + 1;
      }
      out.others[v] = { kind: L.vehKind(), flashes: (L.flags.tnAtkFlashes || 0) - o0, whys: ws };
    }
    return out;
  });
  check(`titan attacks: behind the PICKER -- a wind-up when the cards open is called off that frame (${never.picker.calledOff}), gone in 0.7 s, and 20 s behind them: no attack, no hit`,
    never.picker.open && never.picker.calledOff === 1 && never.picker.shown === false && never.picker.flashes === 0 && never.picker.hits === 0, never.picker);
  check(`titan attacks: an EJECT mid-wind-up -- gone that frame, and nothing for the whole rescue (${never.eject.secs} s)`,
    never.eject.started === true && never.eject.goneAtOnce && never.eject.flashes === 0 && never.eject.hits === 0 && never.eject.secs > 3, never.eject);
  check(`titan attacks: LANDING -- on an engaged approach he is lined up on (${never.landing.lat} m off the runway's line; ${never.landing.engagedF} frames, it ahead of him, the approach the only thing holding it back on ${never.landing.onlyLanding}): no attack; engaged but ${never.offLine.lat} m off the line, flying at it near home: it attacks (${never.offLine.flashes})`,
    never.landing.engagedF > 60 && never.landing.onlyLanding > 30 && never.landing.flashes === 0 && Math.abs(never.landing.lat) < 200 &&
    never.offLine.engagedF > 60 && never.offLine.flashes >= 1, { landing: never.landing, offLine: never.offLine });
  check(`titan attacks: ON THE GROUND (the helicopter set down on the beach ${never.ground.d} m off) and in DAD MODE: no attack`,
    never.ground.landed >= 0 && never.ground.flashes === 0 && (never.ground.whys["on the ground"] || 0) > 60 * 10 && never.dad.flashes === 0 && !never.dad.shown, { ground: never.ground, dad: never.dad });
  check(`titan attacks: in a BOAT, a CAR or a ROCKET 400 m off it, provoked: no attack (it attacks the plane and the helicopter only)`,
    ["speedboat", "car", "rocket"].every(v => never.others[v].flashes === 0 && (never.others[v].whys["not a plane or helicopter"] || 0) > 60 * 10), never.others);

  // ---- 15. his missile knocks it out of a wind-up -- each attack; near it, the stagger is skipped (stage 1's rule)
  const intr = await page.evaluate(() => {
    const { L, st, tn, setup, toFlash } = window.__tna, out = {};
    const fire = () => { const e = document.getElementById("missileBtn"); e.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 3 })); e.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 3 })); };
    for (const [sc, kind, dist] of [["heli", "boulder", 200], ["heli", "beam", 200], ["heliTail", "tail", 0]]) {
      setup(sc, { kind, view: "chase", dist });
      if (toFlash(240) < 0) { out[kind] = { flashed: false, why: tn.atkNo }; continue; }
      // he points at its body and fires, a fifth of a second into the wind-up
      for (let i = 0; i < 12; i++) { heli.vx = heli.vz = 0; L.update(1 / 60); }
      const r = tn.recs.find(q => q.tnPart === "body"), c = r.cap, mx = (c.a[0] + c.b[0]) / 2, my = (c.a[1] + c.b[1]) / 2, mz = (c.a[2] + c.b[2]) / 2;
      st.heading = Math.atan2(-(mx - st.x), -(mz - st.z)); st.missileCooldown = 0;
      const h0 = L.flags.tnHits || 0, a0 = L.flags.tnAtkAbandon_hit || 0, s0 = L.flags.tnAtkStrikes || 0, st0 = L.flags.tnStaggers || 0, sk0 = L.flags.tnStaggersSkipped || 0, k0 = L.flags.tnAtkHits || 0;
      fire();
      let hitAt = null, stageAtHit = null;
      for (let i = 0; i < 60 * 9; i++) {
        heli.vx = heli.vz = 0;
        const stage = tn.atk.on ? tn.atk.stage : "off", t = tn.atk.t;
        L.update(1 / 60);
        if (hitAt === null && (L.flags.tnHits || 0) > h0) { hitAt = +t.toFixed(2); stageAtHit = stage; }
      }
      out[kind] = { flashed: true, hitAt, stageAtHit, calledOff: (L.flags.tnAtkAbandon_hit || 0) - a0, strikes: (L.flags.tnAtkStrikes || 0) - s0,
        staggers: (L.flags.tnStaggers || 0) - st0, skipped: (L.flags.tnStaggersSkipped || 0) - sk0, hitHim: (L.flags.tnAtkHits || 0) - k0, near: sc === "heliTail" };
    }
    return out;
  });
  check(`titan attacks: his MISSILE knocks it out of a wind-up -- the boulder, the beam and the tail each called off (${["boulder", "beam", "tail"].map(k => intr[k].calledOff).join("/")}) at the hit (${["boulder", "beam", "tail"].map(k => intr[k].hitAt + " s").join(", ")} in), nothing thrown, swept or fired, and it staggers -- or, him inside its sweep at the tail, blinks (stage 1's rule)`,
    ["boulder", "beam", "tail"].every(k => intr[k].flashed && intr[k].stageAtHit === "wind" && intr[k].calledOff === 1 && intr[k].strikes === 0 && intr[k].hitHim === 0) &&
    intr.boulder.staggers === 1 && intr.beam.staggers === 1 && intr.tail.staggers === 0 && intr.tail.skipped === 1, intr);

  // ---- 15b. (v219 round 2) a missile into the TAIL through a swipe's wind-up (the tail off the registry): still a hit --
  // it does not fly through -- and it knocks the swipe out of it
  const tailShot = await page.evaluate(() => {
    const { L, st, tn, setup, toFlash } = window.__tna;
    setup("heliTail", { kind: "tail", view: "chase" });
    if (toFlash(240) < 0) return { flashed: false, why: tn.atkNo };
    for (let i = 0; i < 30; i++) { heli.vx = heli.vz = 0; L.update(1 / 60); }
    const off = tn.tailOff, r = L.tnTailRec(), c = r.cap;
    const mx = (c.a[0] + c.b[0]) / 2, my = (c.a[1] + c.b[1]) / 2, mz = (c.a[2] + c.b[2]) / 2;
    st.heading = Math.atan2(-(mx - st.x), -(mz - st.z)); st.missileCooldown = 0;
    const t0 = L.flags.tnTailHits || 0, h0 = L.flags.tnHits || 0, a0 = L.flags.tnAtkAbandon_hit || 0;
    const e = document.getElementById("missileBtn"); e.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 3 })); e.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 3 }));
    let through = false;
    for (let i = 0; i < 60 * 3; i++) {
      heli.vx = heli.vz = 0; L.update(1 / 60);
      for (const m of L.missilesList) if (m.alive && L.solidTest(r, m.x, m.y, m.z, 0)) through = true;
    }
    return { flashed: true, offAtShot: off, tailHits: (L.flags.tnTailHits || 0) - t0, hits: (L.flags.tnHits || 0) - h0, calledOff: (L.flags.tnAtkAbandon_hit || 0) - a0, through };
  });
  check(`titan attacks: a missile into the TAIL through a swipe's wind-up (its record off the registry: ${tailShot.offAtShot}) is still a hit (${tailShot.hits}, on the tail ${tailShot.tailHits}) -- never through it -- and knocks the swipe out of it (${tailShot.calledOff})`,
    tailShot.flashed && tailShot.offAtShot && tailShot.hits === 1 && tailShot.calledOff === 1 && !tailShot.through, tailShot);
  // ---- 15c. beside the tail as it comes home and goes back on the registry: no bang, no shove he did not make
  const tailHome = await page.evaluate(() => {
    const { L, st, tn, setup, toFlash } = window.__tna;
    setup("heliTail", { kind: "tail", view: "chase" });
    if (toFlash(240) < 0) return { flashed: false };
    // up out of its way (the dodge), and the swipe goes by
    for (let i = 0; i < 60 * 8 && (tn.atk.on || tn.tailBlend > 0.98); i++) { heli.vx = heli.vz = 0; heli.vertical = 1; L.update(1 / 60); }
    heli.vertical = 0;
    tn.atkCalm = 1e9;   // (no NEW swipe while he waits there -- held off by hand: the coming home is what is asked)
    // then down BESIDE the tail's resting place, 12 m off its capsule, held there while it comes home
    const r = L.tnTailRec(), rx = Math.cos(tn.yaw), rz = -Math.sin(tn.yaw);
    let p = null, bangs = 0, was = false, home = -1, off0 = tn.tailOff, blend0 = tn.tailBlend;
    const s0 = L.flags.solidShoves || 0;
    let heldStill = true, cap0 = null;
    for (let i = 0; i < 60 * 9; i++) {
      // (6 s beside it -- it HOLDS, he is within its sweep -- then 400 m away: it goes home and back on the registry)
      if (i === 60 * 6) p = { x: p.x + 400 * rx, y: p.y, z: p.z + 400 * rz };
      // (beside where the tail RESTS -- its middle at home, from the body's frame -- not where it is now, swung out)
      if (!p) { const B = tn.parts.body, tp = tn.parts.tail.position, A = L.TUNE.titan.tailPts, e = A[A.length - 1]; B.updateMatrixWorld();
        const m = new (L.camera.position.constructor)(tp.x + e[0] / 2, tp.y + e[1] / 2, tp.z + e[2] / 2).applyMatrix4(B.matrixWorld);
        p = { x: m.x + rx * (r.cap.r + 12), y: m.y, z: m.z + rz * (r.cap.r + 12) }; }
      st.x = p.x; st.y = p.y; st.z = p.z; heli.vx = heli.vz = heli.vy = 0; heli.altitude = p.y; st.phase = "AIRBORNE";
      L.update(1 / 60);
      if (!was && st.exploding) bangs++; was = st.exploding;
      if (home < 0 && !tn.tailOff) home = i;
      const c = r.cap, k = [c.a[0], c.a[1], c.a[2], c.b[0], c.b[1], c.b[2]].join();
      if (i > 2 && i < 60 * 6) { if (cap0 !== null && cap0 !== k) heldStill = false; cap0 = k; }
    }
    return { flashed: true, off0, blend0: +blend0.toFixed(2), home, heldStill, bangs, shoves: (L.flags.solidShoves || 0) - s0, live: !L.isSolidHidden(r) };
  });
  check(`titan attacks: him beside the tail after a swipe (off the registry: ${tailHome.off0}) -- it HOLDS while he is there (${tailHome.heldStill}), goes home and back on once he has gone (frame ${tailHome.home}), with no bang (${tailHome.bangs}) and no shove he did not make (${tailHome.shoves})`,
    tailHome.flashed && tailHome.off0 && tailHome.heldStill && tailHome.home > 60 * 6 && tailHome.bangs === 0 && tailHome.shoves === 0 && tailHome.live, tailHome);
  // ---- 15d. the cards shut in the gap after an attack: never a flash on the frame they close; the gap runs behind them
  const gapCards = await page.evaluate(() => {
    const { L, st, tn, TA, setup, toFlash } = window.__tna;
    setup("heli", { kind: "beam", view: "chase" });
    toFlash(240);
    // up out of its way; the beam ends; the gap begins
    for (let i = 0; i < 60 * 9 && tn.atk.on; i++) { heli.vx = heli.vz = 0; heli.vertical = 1; L.update(1 / 60); }
    heli.vertical = 0;
    const gap0 = tn.atkGap;
    const tap = (e) => { e.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 5 })); e.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 5 })); };
    tap(L.BUTTONS.menuBtn.when() ? document.getElementById("menuBtn") : document.getElementById("vehBtn"));
    const open = L.menuOpen();
    for (let i = 0; i < 60 * (TA.gap + 1); i++) L.update(1 / 60);
    const gapBehind = tn.atkGap;
    // (behind the cards, put back where an attack would start the moment nothing held it: hovering 420 m off, facing it)
    const sea = L.seaLevelAt(tn.x, tn.z);
    st.x = tn.x + 420; st.z = tn.z; st.y = sea + 70; heli.altitude = st.y; heli.vx = heli.vz = heli.vy = 0; heli.target = null; st.heading = Math.atan2(-(tn.x - st.x), -(tn.z - st.z));
    tn.yaw = Math.atan2(st.x - tn.x, st.z - tn.z);
    for (let i = 0; i < 30; i++) L.update(1 / 60);
    // shut the cards. (In the game every card goes through applyVehicle -- a stand-down: no flash for atk.calm. Here
    // they are shut by hand, as the harness does, him still where he was: the gap rule alone is what is asked)
    for (const id of ["screenVehicle", "screenDir", "screenDest"]) document.getElementById(id).classList.add("hiddenS");
    let closeF = -1, flashF = -1; const f0 = L.flags.tnAtkFlashes || 0;
    for (let i = 0; i < 60 * 6; i++) { L.update(1 / 60); if (closeF < 0 && !L.menuOpen()) closeF = i; if (flashF < 0 && (L.flags.tnAtkFlashes || 0) > f0) flashF = i; }
    return { open, gap0: +gap0.toFixed(2), gapBehind: +gapBehind.toFixed(2), closeF, flashF, afterCards: TA.afterCards };
  });
  check(`titan attacks: the cards shut in the gap after an attack: the gap ran on behind them (${gapCards.gap0} s -> ${gapCards.gapBehind} s), and no flash on the frame they close (closed frame ${gapCards.closeF}, first flash ${gapCards.flashF < 0 ? "none" : "frame " + gapCards.flashF})`,
    gapCards.open && gapCards.gap0 > 0 && gapCards.gapBehind === 0 && gapCards.closeF >= 0 && gapCards.flashF > gapCards.closeF + 60 * gapCards.afterCards - 2, gapCards);

  // ---- 11b. from the HELICOPTER'S SEAT the ring is never a slab round his eye: every frame of each attack's wind-up and
  // strike, the ring's share of his screen (drawn, by its opacity) -- and the dots tell him it is aimed at him
  const heliSeat = [];
  for (const [w, h] of [[820, 1180], [1180, 820]]) {
    const { page: pg } = await newPage(w, h);
    await pg.evaluate(tnaHelpers);
    const r = await pg.evaluate(() => {
      const { L, st, tn, setup, toFlash } = window.__tna, out = [];
      for (const [sc, kind] of [["heli", "boulder"], ["heli", "beam"], ["heliTail", "tail"]]) {
        // (the tail cannot START from the seat with him still -- its mark is his eye -- so it is started in the chase view
        // and the view switched, as his view button would)
        setup(sc, { kind, view: kind === "tail" ? "chase" : "seat" });
        if (toFlash(240) < 0) { out.push({ kind, flashed: false }); continue; }
        if (kind === "tail") L.api.setView(false);
        const W = innerWidth, H = innerHeight, cam = L.camera, V = cam.position.constructor;
        let worst = 0, worstOp = 0, frames = 0, dotsMin = 99, dotsF = 0, tipF = 0, bangs = 0, wasEx = false, whyOff = "", dueF = 0, shownF = 0;
        for (let i = 0; i < 60 * 8; i++) {
          heli.vx = heli.vz = 0; L.update(1 / 60); frames++;
          if (!wasEx && st.exploding) bangs++; wasEx = st.exploding;
          if (tn.atk.why && !whyOff) whyOff = tn.atk.why;
          if (!tn.atk.on || st.exploding) continue;
          cam.updateMatrixWorld();
          const ring = tn.atkRing, TA = L.TUNE.titan.atk;
          // its BAND's share of his screen (the ring's tube, round its circle), and is it SHOWN -- drawn, on his screen
          let cover = 0, shown = false;
          if (ring.visible && ring.material.opacity > 0.02) {
            const c = ring.position, d = cam.position.distanceTo(c), R = ring.scale.x;
            if (d <= R * 1.05) cover = 1;
            else { const f = H / 2 / Math.tan(cam.fov * Math.PI / 360), rp = R / d * f, tp = R * TA.ringTube / d * f; const v = c.clone().project(cam);
              cover = v.z < 1 ? Math.min(1, 2 * Math.PI * rp * 2 * tp / (W * H)) : 0;
              shown = v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && ring.material.opacity > 0.5; }
            cover *= ring.material.opacity;
          }
          const ringDue = tn.atk.stage === "wind" || (tn.atk.stage === "strike" && tn.atk.t <= L.tnAtkLead(tn.atk.kind) + TA.strikeOver - 0.05);
          if (ringDue && !tn.atk.hit) { dueF++; if (shown) shownF++; }
          if (cover > worst) { worst = cover; worstOp = +ring.material.opacity.toFixed(2); }
          // the dots on his screen (inside the window), while it winds up
          if (tn.atk.stage === "wind") {
            const pos = tn.atkBeads.geometry.attributes.position.array, n = tn.atkBeads.visible ? tn.atkBeads.geometry.drawRange.count : 0;
            let k = 0; for (let j = 0; j < n; j++) { const v = new V(pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2]).project(cam); if (v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1) k++; }
            dotsMin = Math.min(dotsMin, k); dotsF++;
            // (the tail's own path runs BESIDE him, round its pivot: from his seat what comes at him is the tail itself,
            // its tip glowing -- on his screen?)
            if (kind === "tail") { const v = tn.atkGlow.position.clone().project(cam); if (tn.atkGlow.visible && v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1) tipF++; }
          }
        }
        out.push({ kind, flashed: true, frames, worstCover: +worst.toFixed(3), worstOp, dotsMin, dotsF, tipF, bangs, whyOff, dueF, shownF, band: L.TUNE.titan.atk.ringBand });
        for (let i = 0; i < 60 * 3 && st.exploding; i++) L.update(1 / 60);
      }
      return out;
    });
    await pg.context().close();
    for (const x of r) heliSeat.push({ vp: w + "x" + h, ...x });
  }
  check(`titan attacks: from the HELICOPTER'S SEAT (hovering: it is its own mark), every frame of each attack: the striped ring IS on his screen ahead of him (slid back toward it: ${heliSeat.filter(x => x.kind !== "tail").map(x => x.shownF + "/" + x.dueF).join(", ")} frames) and its band never more than ${(Math.max(...heliSeat.map(x => x.worstCover || 0)) * 100).toFixed(1)}% of his screen (opacity counted) -- and for the boulder and the beam the dots (at least ${Math.min(...heliSeat.filter(x => x.kind !== "tail").map(x => x.dotsMin))} on his screen all through the wind-up) tell him it is aimed at him. And the TAIL -- it cannot start from the seat; started in the chase view and the view switched, it can no longer be shown him (its path beside him): it is called off (${heliSeat.filter(x => x.kind === "tail").map(x => x.whyOff || "not").join("/")}) before it is live, no bang (${heliSeat.filter(x => x.kind === "tail").map(x => x.bangs).join("/")})`,
    heliSeat.length === 6 && heliSeat.every(x => x.flashed && x.worstCover <= x.band && (x.kind === "tail" ? (x.whyOff === "unseen" && x.bangs === 0) : (x.dotsF > 100 && x.dotsMin >= 3 && x.dueF > 200 && x.shownF === x.dueF))), heliSeat);

  // ---- 15e. (round 2) the beam SWEEPS -- in the upright plane through its eyes and the mark: its tip comes on at the sea in
  // front of it, walks out over the water and up to the mark, reaching it at wind + reach; and his bang is one size
  // in both vehicles; and a weak spot's flare stays on the spot (the robot never looks see-through)
  const sweepB = await page.evaluate(() => {
    const { L, st, tn, TA, setup, toFlash } = window.__tna;
    setup("heli", { kind: "beam", view: "chase" });
    if (toFlash(240) < 0) return { flashed: false };
    const sea = L.seaLevelAt(tn.x, tn.z), pts = [];
    for (let i = 0; i < 60 * 6.8 && tn.atk.on; i++) {
      heli.vertical = tn.atk.t > 4 ? 1 : 0; heli.vx = heli.vz = 0;   // (up out of its way before it arrives)
      L.update(1 / 60);
      if (tn.atk.stage === "strike" && tn.atkBeam.visible) pts.push({ t: tn.atk.t, x: tn.atkGlow.position.x, y: tn.atkGlow.position.y, z: tn.atkGlow.position.z });
    }
    heli.vertical = 0;
    const A = tn.atk, e = { x: A.ex, z: A.ez }, mk = { x: A.mx, y: A.my, z: A.mz };
    const nx = -(mk.z - e.z), nz = mk.x - e.x, nl = Math.hypot(nx, nz);   // the upright plane's normal
    let offPlane = 0, back = 0, down = 0, prevH = -1, prevY = -1e9;
    for (const p of pts) {
      offPlane = Math.max(offPlane, Math.abs((p.x - e.x) * nx + (p.z - e.z) * nz) / nl);
      const h = Math.hypot(p.x - e.x, p.z - e.z);
      if (h < prevH - 0.5) back++; if (p.y < prevY - 0.5) down++;
      prevH = h; prevY = p.y;
    }
    const first = pts[0], atMark = pts.find(p => Math.hypot(p.x - mk.x, p.y - mk.y, p.z - mk.z) < 2);
    return { flashed: true, n: pts.length, firstOverSea: first ? +(first.y - sea).toFixed(1) : null, firstOut: first ? +(Math.hypot(first.x - e.x, first.z - e.z) / Math.hypot(mk.x - e.x, mk.z - e.z)).toFixed(2) : null,
      offPlane: +offPlane.toFixed(2), back, down, reachT: atMark ? +atMark.t.toFixed(2) : null, want: TA.beam.wind + TA.beam.reach };
  });
  check(`titan attacks: the beam SWEEPS in the upright plane through its eyes and the mark (${sweepB.offPlane} m off it at worst): on at the sea (${sweepB.firstOverSea} m over it, ${sweepB.firstOut} of the way out), its tip only ever walking out and up, at the mark at ${sweepB.reachT} s (${sweepB.want})`,
    sweepB.flashed && sweepB.n > 100 && sweepB.offPlane < 1 && sweepB.firstOverSea !== null && Math.abs(sweepB.firstOverSea) < 1.5 && sweepB.firstOut < 0.5 && sweepB.back === 0 && sweepB.down === 0 &&
    sweepB.reachT !== null && Math.abs(sweepB.reachT - sweepB.want) < 0.15, sweepB);
  const bangSize = await page.evaluate(() => {
    const { L, st, tn, setup, toFlash } = window.__tna, out = {};
    const orig = window.triggerExplosion; let last = null;
    window.triggerExplosion = function (x, y, z, k) { last = k; return orig.apply(this, arguments); };
    try {
      for (const [tag, sc, kind] of [["plane", "plane", "boulder"], ["heli", "heli", "boulder"]]) {
        setup(sc, { kind, view: "chase" }); toFlash(240); last = null;
        const h0 = L.flags.tnAtkHits || 0;
        for (let i = 0; i < 60 * 8 && (L.flags.tnAtkHits || 0) === h0; i++) { if (sc !== "plane") heli.vx = heli.vz = 0; L.update(1 / 60); }
        out[tag] = last;
        for (let i = 0; i < 60 * 3 && st.exploding; i++) L.update(1 / 60);
      }
    } finally { window.triggerExplosion = orig; }
    // a weak-spot hit: its flare's largest size against the robot's own width
    setup("heli", { kind: "boulder", view: "chase", provoke: false });
    const w = tn.weak.find(q => q.name === "core"), body = tn.recs.find(r => r.tnPart === "body");
    L.tnMissileHit(body, w.world.x, w.world.y, w.world.z, null);
    let big = 0; for (let i = 0; i < 90; i++) { heli.vx = heli.vz = 0; L.update(1 / 60); big = Math.max(big, w.s.scale.x); }
    out.flare = Math.round(big); out.tall = L.TUNE.titan.top;
    return out;
  });
  check(`titan attacks: a hit on him is ONE bang size in both vehicles (the prop ${bangSize.plane}, the helicopter ${bangSize.heli}); and a weak spot's flare stays on the spot (${bangSize.flare} m across at most -- the robot ${bangSize.tall} m tall: never a glow over all of it)`,
    bangSize.plane !== null && bangSize.plane === bangSize.heli && bangSize.flare <= bangSize.tall * 0.6, bangSize);

  // ---- 15f. (round 4) THE TAIL NEVER SWUNG INTO HIM UNANNOUNCED: through each way a swipe ends -- called off as "unseen"
  // (his seat), by the picker, by his missile, or done (dodged by moving 50 m aside, low) -- his radius never inside the
  // tail's capsule, and while he is within sweepR of it, it never moves unless a swipe is LIVE (wind-up or strike) --
  // home only once he is clear. (Its own coil is checked too: never through him.)
  const tailHold = await page.evaluate(() => {
    const { L, st, tn, TA, setup, toFlash } = window.__tna, out = {}, R = L.TUNE.solid.plane ? 3 : 3;
    const tap = (e) => { e.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 5 })); e.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 5 })); };
    const fire = () => { const r = tn.recs.find(q => q.tnPart === "body"), c = r.cap; st.heading = Math.atan2(-((c.a[0] + c.b[0]) / 2 - st.x), -((c.a[2] + c.b[2]) / 2 - st.z)); st.missileCooldown = 0; tap(document.getElementById("missileBtn")); };
    for (const how of ["unseen", "picker", "hit", "done"]) {
      setup("heliTail", { kind: "tail", view: "chase" });
      if (toFlash(240) < 0) { out[how] = { flashed: false }; continue; }
      const p0 = { x: st.x, y: st.y, z: st.z };
      const cap = () => { const c = L.tnTailRec().cap; return [c.a[0], c.a[1], c.a[2], c.b[0], c.b[1], c.b[2]]; };
      let prev = cap(), prevLive = true, minGap = 1e9, coilMin = 1e9, movedNear = 0, nearF = 0, bangs = 0, was = false, home = -1, why = "", leaveAt = -1;
      for (let i = 0; i < 60 * 16; i++) {
        const A = tn.atk, t = A.t;
        if (how === "unseen" && i === 30) L.api.setView(false);
        if (how === "picker" && i === 30) tap(L.BUTTONS.menuBtn.when() ? document.getElementById("menuBtn") : document.getElementById("vehBtn"));
        if (how === "hit" && i === 12) fire();
        if (how === "picker" && i === 60 * 8) for (const id of ["screenVehicle", "screenDir", "screenDest"]) document.getElementById(id).classList.add("hiddenS");
        // where he is: still, at the hover -- aside 50 m low for the dodge -- and, 8 s on, away (it may go home then)
        let px = p0.x, pz = p0.z;
        if (how === "done" && t > 1) { const k = Math.min(1, (t - 1) / 2); pz = p0.z + 50 * k; }
        if (i >= 60 * 9) { px = p0.x - 400; leaveAt = leaveAt < 0 ? i : leaveAt; }
        if (!L.menuOpen()) { st.x = px; st.z = pz; st.y = p0.y; heli.vx = heli.vz = heli.vy = 0; heli.altitude = p0.y; }
        L.update(1 / 60);
        if (!was && st.exploding) bangs++; was = st.exploding;
        if (!why && tn.atk.why) why = tn.atk.why;
        const c = cap(), gap = L.tnTailGap();
        const live = tn.atk.on && tn.atk.kind === "tail" && (tn.atk.stage === "wind" || tn.atk.stage === "strike");
        minGap = Math.min(minGap, gap);
        if (live && tn.atk.stage === "wind") coilMin = Math.min(coilMin, gap);
        // (a move between two frames neither of them in a live swipe)
        if (gap < L.TUNE.titan.sweepR && !live && !prevLive) { nearF++; if (c.some((v, k) => Math.abs(v - prev[k]) > 1e-6)) movedNear++; }
        if (home < 0 && !tn.tailOff && i > 60) home = i;
        prev = c; prevLive = live;
      }
      for (const id of ["screenVehicle", "screenDir", "screenDest"]) document.getElementById(id).classList.add("hiddenS");
      L.api.setView(true);
      out[how] = { flashed: true, why, minGap: +minGap.toFixed(1), coilMin: +coilMin.toFixed(1), nearF, movedNear, bangs, home, leaveAt, held: L.flags.tnTailHeld || 0 };
    }
    return out;
  });
  check(`titan attacks: the TAIL is never swung into him unannounced -- called off as unseen / by the picker / by his missile, or done and dodged aside: his radius never inside it (closest ${["unseen", "picker", "hit", "done"].map(k => tailHold[k].minGap).join("/")} m off its surface), its coil never through him (${["unseen", "picker", "hit", "done"].map(k => tailHold[k].coilMin).join("/")} m), and while he is within its sweep after the swipe it HOLDS (moved on ${["unseen", "picker", "hit", "done"].map(k => tailHold[k].movedNear + "/" + tailHold[k].nearF).join(", ")} frames), home only once he is clear`,
    ["unseen", "picker", "hit", "done"].every(k => { const r = tailHold[k]; return r.flashed && r.minGap >= 3 && r.coilMin >= 3 && r.movedNear === 0 && r.nearF > 30 && r.home > r.leaveAt && r.bangs === 0; }) &&
    tailHold.unseen.why === "unseen" && tailHold.picker.why === "picker" && tailHold.hit.why === "hit", tailHold);

  // ---- 15g. (L1) a beam knocked out of its wind-up draws NO bar -- the second beam of a page, after one that struck
  const beam2 = await page.evaluate(() => {
    const { L, st, tn, setup, toFlash } = window.__tna;
    setup("heli", { kind: "beam", view: "chase", dist: 200 });
    toFlash(240);
    for (let i = 0; i < 60 * 8 && tn.atk.on; i++) { heli.vx = heli.vz = 0; heli.vertical = tn.atk.t > 4 ? 1 : 0; L.update(1 / 60); }   // the first: it strikes (he climbs out of it)
    heli.vertical = 0;
    const firstStruck = (L.flags.tnAtkStrikes || 0);
    st.y = L.seaLevelAt(tn.x, tn.z) + 70; heli.altitude = st.y; tn.atkGap = 0; tn.atkCalm = 0; tn.provoked = true; tn.atkPick = "beam";
    if (toFlash(240) < 0) return { second: false };
    for (let i = 0; i < 12; i++) { heli.vx = heli.vz = 0; L.update(1 / 60); }
    const r = tn.recs.find(q => q.tnPart === "body"), c = r.cap; st.heading = Math.atan2(-((c.a[0] + c.b[0]) / 2 - st.x), -((c.a[2] + c.b[2]) / 2 - st.z)); st.missileCooldown = 0;
    const e = document.getElementById("missileBtn"); e.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 3 })); e.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 3 }));
    let abandonF = -1, barAfter = 0;
    for (let i = 0; i < 60 * 5; i++) { heli.vx = heli.vz = 0; L.update(1 / 60); if (abandonF < 0 && tn.atk.stage === "abandon") abandonF = i; if (abandonF >= 0 && tn.atkBeam.visible) barAfter++; }
    tn.atkPick = null;
    return { second: true, firstStruck, why: tn.atk.why, abandonF, barAfter };
  });
  check(`titan attacks: the second beam of a page, knocked out of its wind-up by his missile (${beam2.why}), draws no bar at all after (${beam2.barAfter} frames)`,
    beam2.second && beam2.firstStruck >= 1 && beam2.why === "hit" && beam2.abandonF >= 0 && beam2.barAfter === 0, beam2);

  // ---- 15h. (L2) from the CITY SIDE, over land: him flying north at it from inland. Whatever starts is over the ground --
  // the beam's tip never under it, the boulder never through it (on land a thud and junk, no splash, no steam) -- or its
  // mark is refused
  const land = await page.evaluate(() => {
    const { L, st, tn, setup, toFlash } = window.__tna, out = {};
    for (const kind of ["boulder", "beam"]) {
      setup("planeN", { kind, view: "chase", provoke: false });
      const sea0 = L.seaLevelAt(tn.x, tn.z);
      st.x = tn.x + 30; st.z = tn.z - 880; st.y = Math.max(L.terrainEff(st.x, st.z), sea0) + 90; st.heading = Math.PI; st.speed = st.vp.cruiseSpeed; st.phase = "AIRBORNE";
      tn.yaw = Math.PI; tn.provoked = true; tn.atkCalm = 0; tn.atkGap = 0;
      const f = toFlash(240);
      const o = { flashed: f >= 0, why: tn.atkNo, markOverLand: null, under: 0, steamLand: 0, splash0: L.flags.tnBoulderSplash || 0, land0: L.flags.tnBoulderLand || 0 };
      if (f >= 0) {
        const A = tn.atk; o.markOverLand = !(L.terrainEff(A.mx, A.mz) < L.seaLevelAt(A.mx, A.mz));
        const puffs0 = tn.puffs.map(p => p.life);
        for (let i = 0; i < 60 * 9 && tn.atk.on; i++) {
          if (tn.atk.t > 1) L.api.setStick(0.6, 0);   // he steers off: the strike lands where he was
          L.update(1 / 60);
          // (the ground worked out here, not asked of the game: the land, or the water's surface)
          const gnd = (x, z) => Math.max(L.terrainEff(x, z), L.seaLevelAt(x, z));
          if (tn.boulder.visible) { const p = tn.boulder.position; if (p.y < gnd(p.x, p.z) - 0.5) o.under++; }
          if (tn.atkBeam.visible) { const p = tn.atkGlow.position; if (p.y < gnd(p.x, p.z) - 0.5) o.under++; }
        }
        L.api.clearStick();
        for (const p of tn.puffs) if (p.life > 0 && !(L.terrainEff(p.x, p.z) < L.seaLevelAt(p.x, p.z)) && p.max === 1.4 && p.y < Math.max(L.terrainEff(p.x, p.z), L.seaLevelAt(p.x, p.z)) + 20) o.steamLand++;
      }
      o.splash = (L.flags.tnBoulderSplash || 0) - o.splash0; o.landed = (L.flags.tnBoulderLand || 0) - o.land0;
      // its junk on the land: resting ON the ground, not through it
      if (kind === "boulder") for (let i = 0; i < 60; i++) L.update(1 / 60);   // a second on: what fell has come down
      o.junkOnLand = tn.debris.filter(d => d.life > 0 && !(L.terrainEff(d.x, d.z) < L.seaLevelAt(d.x, d.z))).map(d => +(d.y - L.terrainEff(d.x, d.z)).toFixed(1));
      out[kind] = o;
    }
    return out;
  });
  check(`titan attacks: from the CITY SIDE over land -- the boulder (${land.boulder.flashed ? "mark over " + (land.boulder.markOverLand ? "land" : "water") + ", landed " + (land.boulder.landed ? "on land: a thud" : land.boulder.splash ? "in water: a splash" : "nowhere") : "refused: " + land.boulder.why}) and the beam (${land.beam.flashed ? "mark over " + (land.beam.markOverLand ? "land" : "water") : "refused: " + land.beam.why}) never go under the ground (${land.boulder.under + land.beam.under} frames), and no steam on land (${land.beam.steamLand || 0})`,
    ["boulder", "beam"].every(k => land[k].under === 0 && (land[k].steamLand || 0) === 0) && land.boulder.flashed && land.boulder.markOverLand && land.boulder.landed >= 1 && land.boulder.splash === 0 && land.beam.flashed &&
    land.boulder.junkOnLand.length >= 3 && land.boulder.junkOnLand.every(h => h >= 0), land);

  // ---- 15i. (L4) called off MID-WIND-UP by a real touch-down (the helicopter set down on the beach) and by a change of
  // vehicle; and dad mode entered with one under way (its pieces were up; after, none)
  const offs = await page.evaluate(() => {
    const { L, st, tn, setup, toFlash, step } = window.__tna, out = {};
    setup("heli", { kind: "boulder", view: "chase" });
    let zl = 7000; while (zl > 6000 && !(L.terrainEff(tn.x, zl) > L.seaLevelAt(tn.x, zl) + 1.5)) zl -= 10;
    st.x = tn.x; st.z = zl - 30; heli.altitude = st.y = L.terrainEff(st.x, st.z) + 20; st.heading = Math.atan2(-(tn.x - st.x), -(tn.z - st.z)); tn.yaw = Math.atan2(st.x - tn.x, st.z - tn.z);
    const f0 = toFlash(240);
    const g0 = L.flags.tnAtkAbandon_ground || 0;
    heli.vertical = -1; let landed = -1, offAt = -1;
    for (let i = 0; i < 60 * 6; i++) { heli.vx = heli.vz = 0; L.update(1 / 60); if (landed < 0 && st.phase === "TAXI") landed = i; if (offAt < 0 && (L.flags.tnAtkAbandon_ground || 0) > g0) offAt = i; }
    heli.vertical = 0;
    out.touchDown = { flashed: f0 >= 0, landed, offAt, strikes: 0, shownAfter: L.tnAtkShown() };
    // a change of vehicle mid-wind-up
    setup("heli", { kind: "beam", view: "chase" }); toFlash(240); step(30, () => { heli.vx = heli.vz = 0; });
    const wasOn = tn.atk.on && L.tnAtkShown(), s0 = L.flags.tnAtkStop_standDown || 0;
    L.api.setVehicle("prop");
    out.vehicle = { wasOn, stopped: (L.flags.tnAtkStop_standDown || 0) - s0, on: tn.atk.on, shown: L.tnAtkShown() };
    // dad mode entered with one under way
    setup("heli", { kind: "boulder", view: "chase" }); toFlash(240); step(30, () => { heli.vx = heli.vz = 0; });
    const before = L.tnAtkShown();
    L.dadEnter(); step(30);
    out.dad = { before, after: L.tnAtkShown(), on: tn.atk.on };
    L.dadExit(); for (const id of ["screenVehicle", "screenDir", "screenDest"]) document.getElementById(id).classList.add("hiddenS");
    return out;
  });
  check(`titan attacks: called off mid-wind-up by a real TOUCH-DOWN (set down on frame ${offs.touchDown.landed}, called off on ${offs.touchDown.offAt}) and by a CHANGE OF VEHICLE (stopped: ${offs.vehicle.stopped}); and DAD MODE entered with one under way: its pieces up before (${offs.dad.before}), none after (${offs.dad.after})`,
    offs.touchDown.flashed && offs.touchDown.landed >= 0 && offs.touchDown.offAt >= 0 && offs.touchDown.offAt <= offs.touchDown.landed + 1 && !offs.touchDown.shownAfter &&
    offs.vehicle.wasOn && offs.vehicle.stopped === 1 && !offs.vehicle.on && !offs.vehicle.shown && offs.dad.before && !offs.dad.after && !offs.dad.on, offs);

  // ---- 15j. (N1) a held tail never snaps: he dodges a swipe and stays within its sweep, still provoked, its calm NOT
  // forced -- 30 s: no new swipe starts, and the held tail never moves
  const noSnap = await page.evaluate(() => {
    const { L, st, tn, setup, toFlash } = window.__tna;
    setup("heliTail", { kind: "tail", view: "chase" });
    if (toFlash(240) < 0) return { flashed: false };
    const p0 = { x: st.x, y: st.y, z: st.z }, t0 = L.flags.tnAtk_tail || 0;
    const cap = () => { const c = L.tnTailRec().cap; return [c.a[0], c.a[1], c.a[2], c.b[0], c.b[1], c.b[2]]; };
    let prev = null, moved = 0, nearF = 0, maxStep = 0, bangs = 0, was = false;
    for (let i = 0; i < 60 * 36; i++) {
      // up out of its way (60 m) from 1 s, and back down to where he was from 8 s: the swipe goes under him; then he stays,
      // right where a new swipe would want him
      const ts = i / 60, up = ts < 1 ? 0 : ts < 3 ? (ts - 1) / 2 : ts < 8 ? 1 : ts < 10 ? 1 - (ts - 8) / 2 : 0;
      st.x = p0.x; st.z = p0.z; st.y = p0.y + 60 * up; heli.vx = heli.vz = heli.vy = 0; heli.altitude = st.y;
      L.update(1 / 60);
      if (!was && st.exploding) bangs++; was = st.exploding;
      const live = tn.atk.on && tn.atk.kind === "tail" && (tn.atk.stage === "wind" || tn.atk.stage === "strike"), c = cap();
      if (i > 60 * 10 && !live) { if (L.tnTailGap() < L.TUNE.titan.sweepR) nearF++; if (prev) { const d = Math.max(...c.map((v, j) => Math.abs(v - prev[j]))); maxStep = Math.max(maxStep, d); if (d > 1e-6) moved++; } }
      prev = c;
    }
    return { flashed: true, newSwipes: (L.flags.tnAtk_tail || 0) - t0, moved, nearF, maxStep: +maxStep.toFixed(6), bangs, provoked: tn.provoked, why: L.tnAtkWhyNot(), tailOff: tn.tailOff };
  });
  check(`titan attacks: a HELD tail never snaps -- he dodged a swipe (up over it) and came back down where he was, within its sweep, 26 s, still provoked (${noSnap.provoked}), its calm not forced: no new swipe (${noSnap.newSwipes}) and the held tail never moves (${noSnap.moved} of ${noSnap.nearF} frames, largest step ${noSnap.maxStep} m)`,
    noSnap.flashed && noSnap.newSwipes === 0 && noSnap.moved === 0 && noSnap.nearF > 60 * 20 && noSnap.bangs === 0 && noSnap.provoked && noSnap.tailOff, noSnap);

  // ---- 15k. (N2, N3a) a mark whose path a SOLID blocks is REFUSED -- and asking costs little: one walk of the registry a
  // path, a refused kind not asked again for refuseFor. A pillar stood between it and him (hovering 420 m off), 5 s;
  // then taken away: it attacks, and the flash frame's walks are counted too
  const blockedP = await page.evaluate(() => {
    const { L, st, tn, TA, setup } = window.__tna;
    setup("heli", { kind: null, view: "chase" });
    const sea = L.seaLevelAt(tn.x, tn.z), bx = tn.x + 250, bz = tn.z;
    const rec = solidCapsule([bx, sea - 5, bz], [bx, sea + 300, bz], 25, "rock");
    rec.mesh = { visible: true, userData: {}, parent: null };
    const f0 = L.flags.tnAtkFlashes || 0, r0 = L.flags.tnAtkRefused || 0, w0 = L.flags.tnPathWalks || 0, e0 = L.flags.tnPathTests || 0;
    let maxWalks = 0, maxTests = 0;
    for (let i = 0; i < 60 * 5; i++) {
      const a = L.flags.tnPathWalks || 0, b = L.flags.tnPathTests || 0;
      heli.vx = heli.vz = 0; L.update(1 / 60);
      maxWalks = Math.max(maxWalks, (L.flags.tnPathWalks || 0) - a); maxTests = Math.max(maxTests, (L.flags.tnPathTests || 0) - b);
    }
    const blocked = { flashes: (L.flags.tnAtkFlashes || 0) - f0, refused: (L.flags.tnAtkRefused || 0) - r0, walks: (L.flags.tnPathWalks || 0) - w0, tests: (L.flags.tnPathTests || 0) - e0, maxWalks, maxTests };
    rec.mesh.visible = false;   // taken away
    let flashWalks = -1;
    for (let i = 0; i < 60 * 3 && flashWalks < 0; i++) { const a = L.flags.tnPathWalks || 0, g = L.flags.tnAtkFlashes || 0; heli.vx = heli.vz = 0; L.update(1 / 60); if ((L.flags.tnAtkFlashes || 0) > g) flashWalks = (L.flags.tnPathWalks || 0) - a; }
    return { blocked, flashWalks, refuseFor: TA.refuseFor };
  });
  check(`titan attacks: a mark whose path a SOLID blocks is REFUSED (${blockedP.blocked.flashes} attacks in 5 s, refused ${blockedP.blocked.refused} times) -- and cheaply: ${blockedP.blocked.walks} walks of the registry in those 5 s (at most ${blockedP.blocked.maxWalks} a frame, ${blockedP.blocked.maxTests} shape tests a frame); taken away, it attacks, ${blockedP.flashWalks} walks on its flash frame`,
    blockedP.blocked.flashes === 0 && blockedP.blocked.refused >= 2 && blockedP.blocked.maxWalks <= 2 && blockedP.blocked.walks <= 2 * (5 / blockedP.refuseFor + 1) && blockedP.flashWalks >= 0 && blockedP.flashWalks <= 2, blockedP);

  // ---- 11c. (C1) from the HELICOPTER'S SEAT at every range -- 160 m to 850 m off it, boulder and beam: the striped ring
  // IS on his screen in every wind-up and strike frame (slid back, and smaller where there is no room), its band under ringBand
  const ranges = await page.evaluate(() => {
    const { L, st, tn, setup, toFlash } = window.__tna, out = [];
    for (const dist of [160, 250, 400, 600, 850]) for (const kind of ["boulder", "beam"]) {
      setup("heli", { kind, view: "seat", dist });
      if (toFlash(240) < 0) { out.push({ dist, kind, flashed: false, why: tn.atkNo }); continue; }
      const cam = L.camera, W = innerWidth, H = innerHeight, TA = L.TUNE.titan.atk;
      let due = 0, shown = 0, band = 0;
      for (let i = 0; i < 60 * 6 && !st.exploding; i++) {
        heli.vx = heli.vz = 0; L.update(1 / 60);
        if (!tn.atk.on || st.exploding || tn.atk.hit) continue;
        const ringDue = tn.atk.stage === "wind" || (tn.atk.stage === "strike" && tn.atk.t <= L.tnAtkLead(kind) + TA.strikeOver - 0.05);
        if (!ringDue) continue;
        due++;
        const ring = tn.atkRing; cam.updateMatrixWorld();
        if (ring.visible && ring.material.opacity > 0.5) {
          const c = ring.position, d = cam.position.distanceTo(c), v = c.clone().project(cam), f = H / 2 / Math.tan(cam.fov * Math.PI / 360);
          const rp = ring.scale.x / d * f, tp = ring.scale.x * TA.ringTube / d * f;
          if (v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1) shown++;
          band = Math.max(band, 2 * Math.PI * rp * 2 * tp / (W * H));
        }
      }
      out.push({ dist, kind, flashed: true, due, shown, band: +band.toFixed(3) });
      for (let i = 0; i < 60 * 3 && st.exploding; i++) L.update(1 / 60);
    }
    return out;
  });
  check(`titan attacks: from the HELICOPTER'S SEAT at every range (${ranges.map(r => r.dist + " m " + r.kind + " " + r.shown + "/" + r.due).join(", ")}): the ring is on his screen in every wind-up and strike frame, its band at most ${Math.max(...ranges.map(r => r.band || 0)) * 100}% of it`,
    ranges.length === 10 && ranges.every(r => r.flashed && r.due > 200 && r.shown === r.due && r.band <= 0.06), ranges);   // (ringBand)

  // ---- 15l. (P2) the smoke of his own bang is cleared at a flash: banged where he hovers (not by it), put back
  // together and set back on the spot, re-provoked, its calm put by by hand -- on the flash frame and through the
  // wind-up no crash-smoke puff within smokeClearR of him or the mark; a smoke 600 m off is left alone
  const smoke = await page.evaluate(() => {
    const { L, st, tn, TA, setup, toFlash } = window.__tna;
    setup("heli", { kind: "boulder", view: "chase", provoke: false });
    const spot = { x: st.x, y: st.y, z: st.z };
    // (the page's smoke from earlier checks put away first: twelve puffs and three sources are shared by all)
    smokeSources.length = 0; for (const p of smokePuffs) { p.life = 0; p.mesh.visible = false; }
    // a bang of his own (the shared path's lines: explosion, smoke, in pieces) -- and a far smoke of someone else's
    triggerExplosion(st.x, st.y, st.z, 0.8); st.exploding = true; st.explodeTimer = L.TUNE.reassembleDelay;
    safePos.x = st.x; safePos.y = st.y; safePos.z = st.z;
    const far = { x: spot.x + 600, z: spot.z + 300 };
    for (let i = 0; i < 60 * 3 && st.exploding; i++) L.update(1 / 60);
    // back on the spot, re-provoked, its calm put by: the flash
    st.heading = Math.atan2(-(tn.x - spot.x), -(tn.z - spot.z));
    tn.atkCalm = 1e9;
    for (let i = 0; i < 45; i++) { st.x = spot.x; st.y = spot.y; st.z = spot.z; heli.altitude = spot.y; heli.vx = heli.vz = heli.vy = 0; L.update(1 / 60); }   // (the camera back on him)
    startSmoke(far.x, L.seaLevelAt(far.x, far.z), far.z, 12);   // (someone else's smoke, 600 m off: it must be left alone)
    tn.atkCalm = 0; tn.atkGap = 0; tn.calm = 0; tn.provoked = true; tn.atkPick = "boulder";
    const liveNear = () => { const A = tn.atk && tn.atk.on ? tn.atk : null; let n = 0, f = 0;
      for (const p of smokePuffs) { if (p.life <= 0 || !p.mesh.visible) continue; const x = p.mesh.position.x, z = p.mesh.position.z;
        if (Math.hypot(x - st.x, z - st.z) < TA.smokeClearR || (A && Math.hypot(x - A.mx, z - A.mz) < TA.smokeClearR)) n++; else if (Math.hypot(x - far.x, z - far.z) < 60) f++; }
      return [n, f]; };
    const f0 = L.flags.tnAtkFlashes || 0; let flashF = -1, nearMax = 0, farSeen = 0, before = [0, 0];
    for (let i = 0; i < 60 * 4; i++) {
      const pre = liveNear();
      heli.vx = heli.vz = 0; L.update(1 / 60);
      if (flashF < 0 && (L.flags.tnAtkFlashes || 0) > f0) { flashF = i; before = pre; }   // (near puffs on the frame before the flash)
      if (flashF >= 0 && tn.atk.on && tn.atk.stage === "wind") { const [n, f] = liveNear(); nearMax = Math.max(nearMax, n); farSeen = Math.max(farSeen, f); }
    }
    tn.atkPick = null;
    return { nearBefore: before[0], flashF, nearMax, farSeen, cleared: L.flags.tnSmokeCleared || 0, why: tn.atkNo, whyNot: L.tnAtkWhyNot(), phase: st.phase };
  });
  check(`titan attacks: the smoke of his own bang where he hovers (${smoke.nearBefore} puffs near him before) is cleared at the flash -- none within smokeClearR of him or the mark through the wind-up (${smoke.nearMax}); a smoke 600 m off is left alone (${smoke.farSeen} of its puffs up)`,
    smoke.nearBefore > 0 && smoke.flashF >= 0 && smoke.nearMax === 0 && smoke.farSeen > 0, smoke);

  // ---- 15m. (round 6) put back together after an attack HIT, nothing of that bang is left near him -- its debris and
  // smoke boxes (explosion.js) and its crash smoke; and (15n) a tail swipe he is switched to his seat for AFTER minLead,
  // with nothing of it on his screen, is called off: no bang
  const after = await page.evaluate(() => {
    const { L, st, tn, TA, setup, toFlash } = window.__tna, out = {};
    for (const [sc, kind] of [["plane", "beam"], ["heli", "boulder"]]) {
      setup(sc, { kind, view: "chase" }); toFlash(240);
      const h0 = L.flags.tnAtkHits || 0;
      for (let i = 0; i < 60 * 8 && (L.flags.tnAtkHits || 0) === h0; i++) { if (sc !== "plane") heli.vx = heli.vz = 0; L.update(1 / 60); }
      for (let i = 0; i < 60 * 3 && st.exploding; i++) L.update(1 / 60);
      let worst = 0, frames = 0;
      for (let i = 0; i < 60 * 2; i++) {
        L.update(1 / 60); frames++;
        let n = 0;
        for (const p of parts) if (p.alive && p.life > 0 && Math.hypot(p.px - st.x, p.py - st.y, p.pz - st.z) < TA.smokeClearR) n++;
        for (const p of smokePuffs) if (p.life > 0 && p.mesh.visible && Math.hypot(p.mesh.position.x - st.x, p.mesh.position.y - st.y, p.mesh.position.z - st.z) < TA.smokeClearR) n++;
        worst = Math.max(worst, n);
      }
      out[sc] = { hit: (L.flags.tnAtkHits || 0) - h0, worst, frames };
    }
    // the tail: started in the chase view, he switches to his seat on the frame before minLead -- the sweep under way and
    // he inside it, so the next frame, the first it may touch him, is the hit. The old call-off (only while A.t < minLead)
    // had shut by then, and it hit him unseen.
    setup("heliTail", { kind: "tail", view: "chase" }); toFlash(240);
    let switched = false, bangs = 0, was = false, at = null, stage = null;
    const h1 = L.flags.tnAtkHits || 0;
    for (let i = 0; i < 60 * 8; i++) {
      if (!switched && tn.atk.on && tn.atk.t + 1 / 60 >= TA.minLead - 1e-6) { L.api.setView(false); switched = !st.exploding; at = +tn.atk.t.toFixed(3); stage = tn.atk.stage; }
      heli.vx = heli.vz = 0; L.update(1 / 60);
      if (!was && st.exploding) bangs++; was = st.exploding;
    }
    L.api.setView(true);
    out.tail = { switched, at, stage, why: tn.atk.why, bangs, hits: (L.flags.tnAtkHits || 0) - h1 };
    // and leave nothing behind: no attack, and the tail home (it holds while he is beside it)
    L.tnAtkStop("check"); st.x = tn.x + 700; st.z = tn.z;
    for (let i = 0; i < 60 * 6 && (tn.tailOff || tn.tailBlend > 0 || st.exploding); i++) { heli.vx = heli.vz = 0; L.update(1 / 60); }
    out.tailHome = !tn.tailOff && !(tn.tailBlend > 0);
    return out;
  });
  check(`titan attacks: put back together after an attack HIT -- the prop (${after.plane.hit}) and the helicopter (${after.heli.hit}) -- nothing of that bang (debris, smoke boxes, crash smoke) within smokeClearR of him (at most ${Math.max(after.plane.worst, after.heli.worst)} pieces)`,
    after.plane.hit === 1 && after.heli.hit === 1 && after.plane.worst === 0 && after.heli.worst === 0, after);
  check(`titan attacks: a tail swipe he switches to his SEAT for as minLead comes (at ${after.tail.at} s, its ${after.tail.stage}; it may first touch him the next frame), nothing of it on his screen, is called off (${after.tail.why}): no bang (${after.tail.bangs})`,
    after.tail.switched && after.tail.stage === "strike" && after.tail.why === "unseen" && after.tail.bangs === 0 && after.tail.hits === 0, after.tail);

  // ---- 16. flown away mid-wind-up: it gives up
  const away = await page.evaluate(() => {
    const { L, st, tn, TA, setup, toFlash } = window.__tna;
    setup("plane", { kind: "boulder", view: "chase", dist: 880 });
    if (toFlash(240) < 0) return { flashed: false, why: tn.atkNo };
    for (let i = 0; i < 20; i++) L.update(1 / 60);
    // (he has turned tail: flying straight away from it, at cruise -- forward is (-sin h, -cos h))
    st.heading = Math.atan2(-(st.x - tn.x), -(st.z - tn.z)); st.bank = 0;
    const a0 = L.flags.tnAtkAbandon_far || 0, s0 = L.flags.tnAtkStrikes || 0, snd0 = { ...L.flags };
    let gaveUp = -1, shownAfter = -1;
    for (let i = 0; i < 60 * 10; i++) {
      L.api.clearStick(); L.update(1 / 60);
      if (gaveUp < 0 && (L.flags.tnAtkAbandon_far || 0) > a0) gaveUp = i;
      if (gaveUp >= 0 && L.tnAtkShown()) shownAfter = i - gaveUp;
    }
    const attackSounds = ["throw", "zap", "swipe", "hum", "windup"].reduce((n, k) => n + (L.flags["tnSnd_" + k] || 0) - (snd0["tnSnd_" + k] || 0), 0);
    return { flashed: true, gaveUp, shownAfter, strikes: (L.flags.tnAtkStrikes || 0) - s0, attackSounds, fizzles: (L.flags.tnSnd_fizzle || 0) - (snd0.tnSnd_fizzle || 0),
      d: Math.round(Math.hypot(st.x - tn.x, st.z - tn.z)), tailOff: tn.tailOff, solidLive: tn.recs.filter(r => !L.isSolidHidden(r)).length, on: tn.atk.on };
  });
  check(`titan attacks: FLOWN AWAY mid-wind-up it gives up (frame ${away.gaveUp}) -- a fizzle, nothing thrown (${away.strikes}), no attack sound after, nothing of it drawn ${away.shownAfter + 1} frames on, nothing left solid but its body`,
    away.flashed && away.gaveUp >= 0 && away.strikes === 0 && away.attackSounds === 0 && away.fizzles === 1 && away.shownAfter < 40 && !away.on && !away.tailOff, away);

  // ---- 17. felled mid-attack; rebuilt, it has forgotten him
  const fell = await page.evaluate(() => {
    const { L, st, tn, setup, toFlash } = window.__tna;
    setup("heli", { kind: "boulder", view: "chase" });
    toFlash(240); for (let i = 0; i < 60; i++) { heli.vx = heli.vz = 0; L.update(1 / 60); }
    const was = tn.atk.on && tn.atk.stage === "wind" && L.tnAtkShown();
    const s0 = L.flags.tnAtkStop_fall || 0, k0 = L.flags.tnAtkStrikes || 0, h0 = L.flags.tnAtkHits || 0;
    L.tnForce("fall");
    const gone = !tn.atk.on;
    let shown = 0; for (let i = 0; i < 60 * 8; i++) { heli.vx = heli.vz = 0; L.update(1 / 60); if (L.tnAtkShown()) shown++; }
    const provokedDown = tn.provoked;
    for (let i = 0; i < 60 * 40 && tn.phase !== "down"; i++) L.update(1 / 60);
    tn.member.state.next = 0; L.tnForce();
    for (let i = 0; i < 60 * 20 && tn.phase !== "up"; i++) { heli.vx = heli.vz = 0; st.x = tn.x + 600; L.update(1 / 60); }
    return { was, stopped: (L.flags.tnAtkStop_fall || 0) - s0, gone, shown, strikes: (L.flags.tnAtkStrikes || 0) - k0, hits: (L.flags.tnAtkHits || 0) - h0, provokedDown, rebuilt: tn.phase, provokedAfter: tn.provoked };
  });
  check(`titan attacks: FELLED mid-wind-up, the attack dies with it (nothing drawn after, nothing thrown); rebuilt, it has forgotten him (provoked: ${fell.provokedAfter})`,
    fell.was && fell.stopped === 1 && fell.gone && fell.shown === 0 && fell.strikes === 0 && fell.hits === 0 && fell.rebuilt === "up" && fell.provokedAfter === false, fell);

  // ---- 18. the frame with each attack live; a whole cycle with attacks draws nothing and adds nothing; zero text
  const cost = await page.evaluate(() => {
    const { L, st, tn, setup, toFlash } = window.__tna, R = L.renderer, out = {};
    for (const [sc, kind, at] of [["plane", "boulder", 3.6], ["plane", "beam", 4.5], ["heliTail", "tail", 4.5]]) {
      setup(sc, { kind, view: "chase" });
      toFlash(240);
      for (let i = 0; i < 60 * at; i++) { if (sc !== "plane") heli.vx = heli.vz = 0; L.update(1 / 60); }
      L.noRender = false; R.render(L.scene, L.camera); const a = { calls: R.info.render.calls, tris: R.info.render.triangles };
      const objs = [tn.g, tn.platesMesh, tn.socketsMesh, tn.debrisMesh, tn.lampPts, tn.sparkPts, tn.puffPts, ...tn.eyes.map(e => e.s), ...tn.weak.map(w => w.s), tn.boulder, tn.atkRing, tn.atkBeads, tn.atkBeam, tn.atkGlow];
      const vis = objs.map(o => [o, o.visible]); for (const [o] of vis) o.visible = false;
      R.render(L.scene, L.camera); const b = { calls: R.info.render.calls, tris: R.info.render.triangles };
      const pieces = [tn.boulder, tn.atkRing, tn.atkBeads, tn.atkBeam, tn.atkGlow].map(o => o.visible);
      for (const [o, v] of vis) o.visible = v;
      L.noRender = true;
      out[kind] = { calls: a.calls - b.calls, tris: a.tris - b.tris, stage: tn.atk.stage, shown: [tn.boulder, tn.atkRing, tn.atkBeads, tn.atkBeam, tn.atkGlow].filter(o => o.visible).length };
    }
    // a whole cycle in its OWN frames (updateTitan alone), him a helicopter hovering beside it: every kind, a hit on him,
    // a give-up -- every Math.random counted (only its sounds' noise let through), the scene's children and the page
    // counted. (Before each kind the game runs whole frames, NOT counted, to put his camera there: updateTitan alone
    // never moves it, and an attack starts only where he can see it.)
    setup("heli", { view: "chase" });
    const R0 = Math.random; let all = 0, audio = 0;
    // (let through: audio.js's own -- a sound's noise, and the bang's crackle, bigBoom, as every bang in the game draws it)
    const hook = () => { Math.random = function () { all++; if (/noiseBurst|bigBoom/.test(new Error().stack)) audio++; return R0(); }; };
    let objs0 = 0, objs1 = 0, dom0 = 0, dom1 = 0, txt0 = "", txt1 = "", objsD = 0;
    // the page's text, but the altimeter's digits (the parent's v138 exception: they move with him)
    const pageText = () => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let t = ""; for (let n; (n = w.nextNode());) { if (n.parentElement && n.parentElement.closest("#altDigits, script, style")) continue; t += n.nodeValue.trim(); } return t; };
    const f0 = { ...L.flags };
    try {
      objs0 = L.scene.children.length; dom0 = document.querySelectorAll("*").length; txt0 = pageText();
      const hover = (x, y, z) => { st.x = x; st.y = y; st.z = z; st.phase = "AIRBORNE"; heli.vx = heli.vy = heli.vz = 0; heli.altitude = y; };
      const run = (n, f) => { for (let i = 0; i < n; i++) { if (f) f(); L.updateTitan(1 / 60); if (st.exploding && tn.atk && !tn.atk.on) st.exploding = false; } };
      const sea = L.seaLevelAt(tn.x, tn.z);
      for (const k of ["boulder", "beam", "tail"]) {
        const p = k === "tail" ? [tn.x - 75, sea + 30, tn.z + 30] : [tn.x + 420, sea + 70, tn.z];
        st.heading = Math.atan2(-(tn.x - p[0]), -(tn.z - p[2]));
        Math.random = R0; tn.atkCalm = 1e9;
        for (let i = 0; i < 60; i++) { hover(p[0], p[1], p[2]); L.update(1 / 60); }
        hook(); const c0 = L.scene.children.length;
        tn.atkPick = k; tn.atkGap = 0; tn.atkCalm = 0; tn.calm = 0; st.exploding = false; tn.wasEx = false; tn.provoked = true;
        run(60 * 10, () => hover(p[0], p[1], p[2]));   // he holds still: hit (and it is satisfied)
        st.exploding = false; tn.wasEx = false;
        if (k === "tail") run(60 * 3, () => hover(tn.x + 1400, sea + 70, tn.z));   // (the tail goes home only with him clear of it: a new swipe waits for it)
        tn.atkCalm = 0; tn.atkGap = 0; tn.calm = 0; tn.provoked = true;   // (its calms and its satisfaction, put by by hand: the next flash, now)
        run(10, () => hover(p[0], p[1], p[2]));        // ... the next one flashes
        run(60 * 3, () => hover(tn.x + 1400, sea + 70, tn.z));   // ... and he is gone: given up
        objsD += L.scene.children.length - c0;
      }
      Math.random = R0;
      tn.atkPick = null;
      objs1 = L.scene.children.length; dom1 = document.querySelectorAll("*").length; txt1 = pageText();
    } finally { Math.random = R0; }
    const d = k => (L.flags[k] || 0) - (f0[k] || 0);
    out.cycle = { draws: all - audio, audio, objs: objsD, objsAll: objs1 - objs0, dom: dom1 - dom0, text: txt1 === txt0, attacks: d("tnAttacks"), hits: d("tnAtkHits"), abandons: d("tnAtkAbandons"),
      kinds: ["boulder", "beam", "tail"].map(k => d("tnAtk_" + k)) };
    return out;
  });
  check(`titan attacks: the frame with each attack live -- the robot and its boulder ${cost.boulder.calls} calls / ${cost.boulder.tris} tris, its beam ${cost.beam.calls} / ${cost.beam.tris}, its tail swipe ${cost.tail.calls} / ${cost.tail.tris} (budget 26 calls, 16k triangles: the robot's 22 and a handful)`,
    ["boulder", "beam", "tail"].every(k => cost[k].calls > 5 && cost[k].calls <= 26 && cost[k].tris <= 16000 && cost[k].shown >= 2), cost);
  check(`titan attacks: a whole cycle WITH ATTACKS in its own frames (${cost.cycle.attacks} attacks, ${cost.cycle.hits} hits on him, ${cost.cycle.abandons} given up) draws nothing from the page's random stream (${cost.cycle.draws} draws besides audio.js's own: the sounds' noise and the bang's crackle), adds nothing to the scene (${cost.cycle.objs}) or the page (${cost.cycle.dom} elements, its text the same)`,
    cost.cycle.draws === 0 && cost.cycle.objs === 0 && cost.cycle.dom === 0 && cost.cycle.text && cost.cycle.kinds.every(n => n >= 2) && cost.cycle.hits >= 3 && cost.cycle.abandons >= 3, cost.cycle);

  check("titan attacks: no page errors", errors.length === 0, errors.slice(0, 4));
  await page.context().close();

  await realRoute({ newPage, check });
  if (!skipNoisy) await noisyFinger({ newPage, check });
}

// ---- 19. (v219 round 2) ON HIS REAL ROUTE: from New York's runway, by touch (synthetic pointer events on the game's
// canvas and buttons -- its own handlers), the robot standing at HOME where it rises: the prop takes off, comes round to
// it, fires as it flies at it and turns away at 350 m, again and again; the helicopter climbs, flies to it by a finger on
// it, hovers and fires now and then. Two minutes each from his first shot. Counted: flashes, strikes, hits, give-ups by
// reason, and the frames each rule held it back (is the approach to New York what keeps it quiet near home?)
async function realRoute({ newPage, check }) {
  const { page } = await newPage(820, 1180);
  const r = await page.evaluate(() => {
    const L = window.__lp, st = L.state, tn = L.titan, T = L.TUNE.titan; L.noRender = true;
    const cv = L.renderer.domElement;
    const pe = (el, type, x, y, id) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: "touch", clientX: x, clientY: y, isPrimary: true }));
    const W = innerWidth, H = innerHeight, span = Math.min(W, H);
    const tapBtn = (id) => { const e = document.getElementById(id), rc = e.getBoundingClientRect(); pe(e, "pointerdown", (rc.left + rc.right) / 2, (rc.top + rc.bottom) / 2, 9); pe(e, "pointerup", (rc.left + rc.right) / 2, (rc.top + rc.bottom) / 2, 9); };
    let down = false; const ox = W / 2, oy = H * 0.55;
    const stick = (bx, py) => { if (!down) { pe(cv, "pointerdown", ox, oy, 1); down = true; } pe(cv, "pointermove", ox + bx * span * L.TUNE.dragRangeX, oy - py * span * L.TUNE.dragRangeY, 1); };
    const lift = () => { if (down) { pe(cv, "pointerup", ox, oy, 1); down = false; } };
    const count = () => ({ flashes: L.flags.tnAtkFlashes || 0, strikes: L.flags.tnAtkStrikes || 0, through: L.flags.tnAtkStruckThrough || 0, hits: L.flags.tnAtkHits || 0, bangs: L.flags.exploded || 0,
      boulder: L.flags.tnAtk_boulder || 0, beam: L.flags.tnAtk_beam || 0, tail: L.flags.tnAtk_tail || 0, tnHits: L.flags.tnHits || 0,
      ab: Object.fromEntries(["far", "picker", "bang", "ground", "landing", "vehicle", "hit"].map(k => [k, L.flags["tnAtkAbandon_" + k] || 0])) });
    const diff = (a, b) => { const o = {}; for (const k in b) o[k] = typeof b[k] === "object" ? diff(a[k], b[k]) : b[k] - a[k]; return o; };
    const out = {};
    // ---- the prop
    L.tnReset(); L.api.setVehicle("prop"); L.api.spawnAt(0, 0);
    for (let i = 0; i < 60 * 16 && tn.phase !== "up"; i++) L.update(1 / 60);
    out.risenAt = tn.phase;
    const thr = document.getElementById("throttleBtn"), trc = thr.getBoundingClientRect();
    pe(thr, "pointerdown", (trc.left + trc.right) / 2, (trc.top + trc.bottom) / 2, 7);
    let air = -1;
    for (let i = 0; i < 60 * 40 && air < 0; i++) { if (st.speed > st.vp.cruiseSpeed * 0.7) stick(0, 0.6); L.update(1 / 60); if (st.phase === "AIRBORNE") air = i; }
    pe(thr, "pointerup", (trc.left + trc.right) / 2, (trc.top + trc.bottom) / 2, 7);
    out.tookOff = air >= 0;
    const home = { x: tn.x, z: tn.z };
    // waypoints: out to sea north of it, AT it (to 350 m, firing), out east, AT it ...
    const wps = [{ x: home.x - 200, z: home.z + 900 }, "robot", { x: home.x + 900, z: home.z + 200 }, "robot"];
    let wi = 0, provokedAt = -1, frames = 0, shots = 0, lastShot = -99;
    const why = {}, c0 = count();
    for (let i = 0; i < 60 * 240; i++) {
      const wp = wps[wi % wps.length], tx = wp === "robot" ? tn.x : wp.x, tz = wp === "robot" ? tn.z : wp.z;
      const d = Math.hypot(tx - st.x, tz - st.z);
      if (wp === "robot" ? d < 350 : d < 150) wi++;
      const want = Math.atan2(-(tx - st.x), -(tz - st.z)), err = L.wrapPi(want - st.heading);
      const agl = st.y - Math.max(L.terrainEff(st.x, st.z), L.TUNE.waterLevel);
      if (!st.exploding && !L.menuOpen()) stick(Math.max(-1, Math.min(1, -err * 2)), Math.max(-0.6, Math.min(0.6, (110 - agl) * 0.02))); else lift();
      // fire as it flies at it, pointed at it, inside missile reach
      if (wp === "robot" && d < 600 && Math.abs(err) < 0.12 && i - lastShot > 90 && !st.exploding) { st.missileCooldown = 0; tapBtn("missileBtn"); shots++; lastShot = i; }
      L.update(1 / 60);
      if (provokedAt < 0 && tn.provoked) provokedAt = i;
      if (provokedAt >= 0) { frames++; const w = tn.atk && tn.atk.on ? "attacking" : (L.tnAtkWhyNot() || tn.atkNo || "may"); why[w] = (why[w] || 0) + 1; if (frames >= 60 * 120) break; }
    }
    lift();
    out.plane = { provokedAt: +(provokedAt / 60).toFixed(1), secs: +(frames / 60).toFixed(0), shots, ...diff(c0, count()), whyFrames: why };
    // ---- the helicopter
    L.tnReset(); L.api.setVehicle("helicopter"); L.api.spawnAt(0, 0);
    for (let i = 0; i < 60 * 16 && tn.phase !== "up"; i++) L.update(1 / 60);
    const up = document.getElementById("heliUpBtn"), urc = up.getBoundingClientRect();
    pe(up, "pointerdown", (urc.left + urc.right) / 2, (urc.top + urc.bottom) / 2, 8);
    for (let i = 0; i < 60 * 4; i++) L.update(1 / 60);
    out.heliUp = [Math.round(st.y), st.phase, heli.vertical];
    pe(up, "pointerup", (urc.left + urc.right) / 2, (urc.top + urc.bottom) / 2, 8);
    const c1 = count(), why2 = {};
    let hp = -1, fr2 = 0, shots2 = 0, last2 = -99, touched = false;
    for (let i = 0; i < 60 * 240; i++) {
      const d = Math.hypot(tn.x - st.x, tn.z - st.z);
      // a finger on the robot until he is 450 m off; then off the glass: he hovers
      if (d > 450 && !st.exploding && !L.menuOpen()) {
        L.camera.updateMatrixWorld();
        const v = new (L.camera.position.constructor)(tn.x, tn.y + 40, tn.z).project(L.camera);
        const sx = Math.max(20, Math.min(W - 20, (v.x + 1) / 2 * W)), sy = Math.max(60, Math.min(H * 0.7, (1 - v.y) / 2 * H));
        const ahead = v.z < 1 && Math.abs(v.x) < 0.95;
        if (ahead) { if (!touched) { pe(cv, "pointerdown", sx, sy, 2); touched = true; } else pe(cv, "pointermove", sx, sy, 2); }
        else if (i % 60 === 0) { if (touched) pe(cv, "pointerup", W / 2, H / 2, 2); pe(cv, "pointerdown", W * 0.92, H * 0.45, 2); touched = true; }   // (it behind him: a finger at the side, again and again, turns him)
      } else if (touched) { pe(cv, "pointerup", W / 2, H / 2, 2); touched = false; }
      // it on his screen (the bend takes a missile on to it), fire now and then
      const err = L.wrapPi(Math.atan2(-(tn.x - st.x), -(tn.z - st.z)) - st.heading);
      if (d < 600 && (Math.abs(err) < 0.15 || L.tnOnScreen()) && i - last2 > 60 * 20 && !st.exploding) { st.missileCooldown = 0; tapBtn("missileBtn"); shots2++; last2 = i; }
      L.update(1 / 60);
      if (hp < 0 && tn.provoked) hp = i;
      if (hp >= 0) { fr2++; const w = tn.atk && tn.atk.on ? "attacking" : (L.tnAtkWhyNot() || tn.atkNo || "may"); why2[w] = (why2[w] || 0) + 1; if (fr2 >= 60 * 120) break; }
    }
    if (touched) pe(cv, "pointerup", W / 2, H / 2, 2);
    out.heli = { end: [Math.round(st.x), Math.round(st.y), Math.round(st.z), Math.round(Math.hypot(tn.x - st.x, tn.z - st.z)), st.phase, tn.phase], provokedAt: +(hp / 60).toFixed(1), secs: +(fr2 / 60).toFixed(0), shots: shots2, ...diff(c1, count()), whyFrames: why2 };
    return out;
  });
  console.log("INFO  titan on his real route (2 min from his first provocation each): " + JSON.stringify(r));
  check(`titan attacks: ON HIS REAL ROUTE -- from New York's runway by touch, the robot at home: the prop (${r.plane.shots} shots) met ${r.plane.flashes} attacks (${r.plane.strikes} struck, ${r.plane.through} carried through to the end -- not called off by the approach, ${r.plane.ab.landing} were -- ${r.plane.hits} hit him), the helicopter (${r.heli.shots} shots) ${r.heli.flashes} (${r.heli.strikes} struck, ${r.heli.hits} hit him); held back by the approach to New York on ${r.plane.whyFrames.landing || 0} of the prop's ${r.plane.secs * 60} frames`,
    r.tookOff && r.risenAt === "up" && r.plane.provokedAt >= 0 && r.heli.provokedAt >= 0 && r.plane.flashes > 0 && r.heli.flashes > 0 && r.plane.through >= 1, r);
}

// ---- 12. DODGEABLE BY THE NOISY FINGER. One finger on the glass, real touch events (CDP Input.dispatchTouchEvent ->
// the page's pointer handlers -> input.js), 60 Hz, a four-year-old's hand modelled on noisy_drive.js: every drag
// wobbles +-15% of its range (a tremor of a few hertz, both axes); the finger comes off for 300 ms somewhere in the
// steer and lands again where it lands; for a second it overshoots 35-45% further. It begins to steer AWAY a random
// 0-2 s after the eyes flash (left, right, or up -- the plane's drag up, the helicopter's up button), and holds it.
// The verdict is the log: hits / attempts per attack, per vehicle, per seed. And the honest converse: hands-off, hit.
function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
async function noisyFinger({ newPage, check }) {
  // two screens: portrait (the sweep, from the chase view; and one seed per attack from the SEAT) and landscape (one
  // seed per attack, chase)
  const screens = {};
  for (const [key, w, h] of [["P", 820, 1180], ["L", 1180, 820]]) {
    const { page } = await newPage(w, h);
    await page.evaluate(tnaHelpers);
    const cdp = await page.context().newCDPSession(page);
    const geo = await page.evaluate(() => { const L = window.__lp, span = Math.min(innerWidth, innerHeight); return { W: innerWidth, H: innerHeight, dx: span * L.TUNE.dragRangeX, dy: span * L.TUNE.dragRangeY }; });
    screens[key] = { page, cdp, geo };
  }
  const log = [], table = {};
  const SEEDS = [1, 2, 3, 4];
  const runs = [];
  const KINDS = [["plane", "boulder"], ["plane", "beam"], ["heli", "boulder"], ["heli", "beam"], ["heliTail", "tail"]];
  for (const [sc, kind] of KINDS)
    for (const intent of ["left", "right", "up", "none"]) for (const seed of (intent === "none" ? [0] : SEEDS)) runs.push({ sc, kind, intent, seed, scr: "P", view: "chase" });
  for (const [sc, kind] of KINDS) { runs.push({ sc, kind, intent: "left", seed: 5, scr: "P", view: "seat" }); runs.push({ sc, kind, intent: "right", seed: 6, scr: "L", view: "chase" }); }
  // PINNED: the steer begins at 2.5 and at 3.0 s, every way out, every attack -- and at home from the north
  for (const [sc, kind] of [...KINDS, ["planeN", "boulder"], ["planeN", "beam"]]) for (const intent of ["left", "right", "up"]) for (const pin of [2.5, 3.0]) runs.push({ sc, kind, intent, seed: 11 + pin * 2, scr: "P", view: "chase", pin });
  // (round 3) AT HOME, him from the north as on his real route, the approach to New York engaging as the game decides
  for (const kind of ["boulder", "beam"]) for (const intent of ["left", "right", "up", "none"]) for (const seed of (intent === "none" ? [0] : SEEDS)) runs.push({ sc: "planeN", kind, intent, seed, scr: "P", view: "chase" });
  // (reported, not asserted: a LATE steer, 3-5 s after the flash; and away-then-BACK. Being hit there is fair)
  for (const [sc, kind] of KINDS) { runs.push({ sc, kind, intent: "left", seed: 7, scr: "P", view: "chase", late: true }); runs.push({ sc, kind, intent: "right", seed: 8, scr: "P", view: "chase", late: true }); runs.push({ sc, kind, intent: "left", seed: 9, scr: "P", view: "chase", back: true }); }
  if (process.env.TN_PIN_ONLY) runs.splice(0, runs.length, ...runs.filter(R => R.pin !== undefined || R.late || (R.intent === "none" && R.scr === "P")));   // (a developer's filter)
  if (process.env.TN_HOME_ONLY) runs.splice(0, runs.length, ...runs.filter(R => R.sc === "planeN"));   // (a developer's filter: the home rows alone)
  for (const R of runs) {
    const { page, cdp, geo } = screens[R.scr];
    const touch = async (type, x, y) => {
      if (type === "touchEnd") return cdp.send("Input.dispatchTouchEvent", { type, touchPoints: [] });
      return cdp.send("Input.dispatchTouchEvent", { type, touchPoints: [{ x: Math.round(x), y: Math.round(y), id: 1, radiusX: 8, radiusY: 8, force: 1 }] });
    };
    const rand = mulberry(R.seed * 7919 + R.kind.length * 31 + R.intent.length);
    // (a LATE steer begins 3-5 s after the flash; a BACK one steers away for 2 s, then back the other way for 2 s, then lets go)
    // (the parent, 2026-11-15: a steer begun within 3 s of the flash must escape -- the steer begins uniformly 0-3 s
    // after it; PINNED attempts begin at exactly 2.5 or 3.0 s; a LATE steer, 3-5 s, is reported only)
    const delay = R.intent === "none" ? Infinity : R.pin !== undefined ? R.pin : R.late ? 3 + rand() * 2 : rand() * 3;
    const opp = { left: "right", right: "left", up: "up" };
    const liftAt = delay + 0.5 + rand() * 2.5, overAt = delay + 0.3 + rand() * 3, overAmt = 0.35 + rand() * 0.1;
    const ph = [rand() * 6.28, rand() * 6.28, rand() * 6.28, rand() * 6.28], fq = [1.6 + rand() * 1.8, 2.7 + rand() * 1.5, 1.2 + rand() * 1.4, 3.1 + rand() * 1.2];
    const ready = await page.evaluate((R) => {
      const { L, tn, setup, toFlash } = window.__tna;
      // (the tail cannot start from the seat with him still -- its mark is his eye: started in the chase view, then the
      // view switched, as his button would)
      setup(R.sc, { kind: R.kind, view: R.view === "seat" && R.kind === "tail" ? "chase" : R.view });
      const f = toFlash(240);
      if (R.view === "seat") L.api.setView(false);
      window.__nf = { w0: L.flags.wallHits || 0, h0: L.flags.tnAtkHits || 0, b0: L.flags.exploded || 0, minGap: Infinity, bangs: 0, was: false, mark: tn.atk && [tn.atk.mx, tn.atk.my, tn.atk.mz] };
      const up = document.getElementById("heliUpBtn").getBoundingClientRect();
      return { f, why: tn.atkNo, up: { x: (up.left + up.right) / 2, y: (up.top + up.bottom) / 2 } };
    }, R);
    if (ready.f < 0) { log.push({ ...R, error: "no flash: " + ready.why }); continue; }
    const heli = R.sc.startsWith("heli");
    let down = false, ox = 0, oy = 0, lifted = 0, overs = 0;
    const evs = [];
    for (let f = 0; f < 60 * 9; f++) {
      const t = f / 60;
      // the hand
      const intent = !R.back ? R.intent : t < delay + 2 ? R.intent : t < delay + 4 ? opp[R.intent] : "none";
      if (R.back && intent === "none" && t >= delay + 4) { if (down) { await touch("touchEnd"); down = false; } }
      else if (t >= delay) {
        const lifting = t >= liftAt && t < liftAt + 0.3, over = t >= overAt && t < overAt + 1 ? overAmt : 0;
        if (over && !overs) overs = 1;
        const wob = 0.15 * (0.6 * Math.sin(t * fq[0] * 6.283 + ph[0]) + 0.4 * Math.sin(t * fq[1] * 6.283 + ph[1]));
        const wobY = 0.15 * (0.6 * Math.sin(t * fq[2] * 6.283 + ph[2]) + 0.4 * Math.sin(t * fq[3] * 6.283 + ph[3]));
        const k = Math.min(1, (t - delay) / 0.15);   // reached over ~150 ms
        if (lifting) { if (down) { await touch("touchEnd"); down = false; lifted++; } }
        else {
          let x, y;
          if (heli && intent === "up") { x = ready.up.x + wob * 30; y = ready.up.y + wobY * 30; }
          else if (heli) { const s = intent === "left" ? -1 : 1; x = geo.W / 2 + s * geo.W * (0.38 + over * 0.25) * k + wob * geo.dx; y = geo.H * 0.45 + wobY * geo.dy; x = Math.max(4, Math.min(geo.W - 4, x)); }
          else {
            if (!down) { ox = geo.W * 0.5 + (rand() - 0.5) * 40; oy = geo.H * 0.55 + (rand() - 0.5) * 40; }
            const ix = intent === "left" ? -1 : intent === "right" ? 1 : 0, iy = intent === "up" ? -1 : 0;
            x = ox + (ix * (1 + over) * k + wob) * geo.dx; y = oy + (iy * (1 + over) * k + wobY) * geo.dy;
          }
          if (!down) { await touch("touchStart", heli ? x : ox, heli ? y : oy); down = true; }
          await touch("touchMove", x, y);
        }
      }
      const o = await page.evaluate(() => {
        const { L, st, tn } = window.__tna, N = window.__nf;
        L.update(1 / 60);
        if (!N.was && st.exploding) N.bangs++;
        N.was = !!st.exploding;
        if (tn.atk && tn.atk.lastGap !== undefined && tn.atk.stage === "strike") N.minGap = Math.min(N.minGap, tn.atk.lastGap);
        if (tn.atk && tn.atk.firstLive >= 0) N.struck = true;   // its own test ran: the strike was really made
        if (st.engaged) N.engF = (N.engF || 0) + 1;
        return { done: tn.atk && !tn.atk.on, t: tn.atk && tn.atk.t };
      });
    }
    if (down) await touch("touchEnd");
    const res = await page.evaluate(() => {
      const { L, st, tn } = window.__tna, N = window.__nf;
      const out = { hits: (L.flags.tnAtkHits || 0) - N.h0, bangs: N.bangs, minGap: N.minGap === Infinity ? null : +N.minGap.toFixed(1),
        fromMark: N.mark ? Math.round(Math.hypot(st.x - N.mark[0], st.y - N.mark[1], st.z - N.mark[2])) : null, why: tn.atk && tn.atk.why, struck: N.struck, engagedF: N.engF || 0, wallHits: (L.flags.wallHits || 0) - N.w0, nearRobot: Math.round(L.tnGap()) };
      L.api.clearStick(); heli.vertical = 0;
      for (let i = 0; i < 60 * 3 && st.exploding; i++) L.update(1 / 60);
      return out;
    });
    const line = { veh: R.sc === "plane" ? "plane" : R.sc === "planeN" ? "planeHome" : "heli", kind: R.kind, intent: R.intent + (R.late ? " LATE" : R.back ? " AWAY-AND-BACK" : R.pin !== undefined ? " PINNED " + R.pin + " s" : ""), seed: R.seed, screen: (R.scr === "P" ? "portrait " : "landscape ") + R.view, delay: R.intent === "none" ? null : +delay.toFixed(2), lifts: lifted, overshoot: overs, ...res };
    log.push(line);
    const key = `${line.veh}/${R.kind}/${R.intent === "none" ? "hands-off" : "steered"}`;
    if (R.pin !== undefined) { const k5 = `${line.veh}/${R.kind}/pinned`; table[k5] = table[k5] || { hits: 0, attempts: 0, bangs: 0, perSeed: {} }; table[k5].hits += res.hits; table[k5].attempts++; table[k5].bangs += res.bangs; continue; }
    if (R.late || R.back) { const k4 = `${line.veh}/${R.kind}/${R.late ? "late" : "back"}`; table[k4] = table[k4] || { hits: 0, attempts: 0, bangs: 0, perSeed: {} }; table[k4].hits += res.hits; table[k4].attempts++; table[k4].bangs += res.bangs; continue; }
    if (R.scr !== "P" || R.view !== "chase") { const k2 = `${line.veh}/${R.kind}/${R.scr === "P" ? "seat" : "landscape"}`; table[k2] = table[k2] || { hits: 0, attempts: 0, bangs: 0, perSeed: {} }; table[k2].hits += res.hits; table[k2].attempts++; table[k2].bangs += res.bangs; }
    if (R.scr !== "P" || R.view !== "chase") continue;
    if (R.sc === "planeN") { const k3 = `planeHome/${R.kind}/${R.intent === "none" ? "hands-off" : "steered"}`; table[k3] = table[k3] || { hits: 0, attempts: 0, bangs: 0, engagedF: 0, perSeed: {} }; table[k3].hits += res.hits; table[k3].attempts++; table[k3].bangs += res.bangs; table[k3].engagedF += res.engagedF; continue; }
    table[key] = table[key] || { hits: 0, attempts: 0, bangs: 0, perSeed: {} };
    table[key].hits += res.hits; table[key].attempts++; table[key].bangs += res.bangs;
    if (R.intent !== "none") { const ps = table[key].perSeed[R.seed] = table[key].perSeed[R.seed] || [0, 0]; ps[0] += res.hits; ps[1]++; }
  }
  for (const k in screens) await screens[k].page.context().close();
  console.log("INFO  titan noisy finger -- each attempt (delay: s after the flash the steer began; minGap: closest the strike's own test came, m; fromMark: where he was from its mark at the end):");
  for (const l of log) console.log("INFO    " + JSON.stringify(l));
  console.log("INFO  titan noisy finger -- hits / attempts:");
  for (const [k, v] of Object.entries(table)) console.log(`INFO    ${k.padEnd(26)} ${v.hits}/${v.attempts}  (bangs ${v.bangs})  per seed ${Object.entries(v.perSeed).map(([s, p]) => s + ":" + p[0] + "/" + p[1]).join(" ")}`);
  const steered = Object.entries(table).filter(([k]) => k.endsWith("steered") && !k.startsWith("planeHome")), handsOff = Object.entries(table).filter(([k]) => k.endsWith("hands-off") && !k.startsWith("planeHome"));
  const home = Object.entries(table).filter(([k]) => k.startsWith("planeHome") && !k.endsWith("/pinned"));
  const extra = Object.entries(table).filter(([k]) => k.endsWith("/seat") || k.endsWith("/landscape"));
  check(`titan attacks: DODGEABLE BY THE NOISY FINGER -- real touches at 60 Hz, a wobbling, lifting, overshooting finger steering away 0-2 s after the flash, every strike really made (none called off): ${steered.map(([k, v]) => k.replace("/steered", "") + " " + v.hits + "/" + v.attempts).join(", ")} hit, and one seed each from the SEAT and in LANDSCAPE ${extra.reduce((a, [, v]) => a + v.hits, 0)}/${extra.length} (and no bang of any kind)`,
    log.every(l => !l.error) && steered.length === 5 && steered.every(([, v]) => v.attempts === 12 && v.hits === 0 && v.bangs === 0) &&
    extra.length === 10 && extra.every(([, v]) => v.attempts === 1 && v.hits === 0 && v.bangs === 0) &&
    // (the tail from the SEAT: he cannot be shown it there -- it is called off, "unseen", before it is live)
    log.filter(l => !/LATE|BACK|PINNED/.test(l.intent)).every(l => (l.kind === "tail" && l.screen === "portrait seat") ? (l.why === "unseen" && l.hits === 0) : (l.struck && !l.why)), { table, notStruck: log.filter(l => !/LATE|BACK|PINNED/.test(l.intent) && (!l.struck || l.why)) });
  check(`titan attacks: AT HOME, him from the north as on his real route, the approach to New York left to the game (engaged on ${home.map(([k, v]) => k.replace("planeHome/", "") + " " + Math.round(v.engagedF / Math.max(1, v.attempts))).join(", ")} frames an attempt): the noisy finger steering away is never hit (${home.filter(([k]) => k.endsWith("steered")).map(([k, v]) => k.replace("planeHome/", "").replace("/steered", "") + " " + v.hits + "/" + v.attempts).join(", ")}), and hands-off is (${home.filter(([k]) => k.endsWith("hands-off")).map(([k, v]) => k.replace("planeHome/", "").replace("/hands-off", "") + " " + v.hits + "/" + v.attempts).join(", ")})`,
    home.length === 4 && home.every(([k, v]) => k.endsWith("steered") ? (v.attempts === 12 && v.hits === 0 && v.bangs === 0) : (v.attempts === 1 && v.hits === 1)) &&
    log.filter(l => l.veh === "planeHome").every(l => l.struck && !l.why) && home.some(([, v]) => v.engagedF > 0), home);
  const lateBack = Object.entries(table).filter(([k]) => k.endsWith("/late") || k.endsWith("/back"));
  const pinned = Object.entries(table).filter(([k]) => k.endsWith("/pinned"));
  check(`titan attacks: a steer begun as late as 2.5-3.0 s after the flash still escapes (the parent's line) -- ${pinned.map(([k, v]) => k.replace("/pinned", "") + " " + v.hits + "/" + v.attempts).join(", ")} hit, and no bang`,
    pinned.length === 7 && pinned.every(([, v]) => v.attempts === 6 && v.hits === 0 && v.bangs === 0), pinned);
  console.log("INFO  titan noisy finger -- REPORTED, not asserted: a LATE steer (3-5 s after the flash) and AWAY-AND-BACK: " + lateBack.map(([k, v]) => k + " " + v.hits + "/" + v.attempts).join(", "));
  for (const l of log.filter(l => /LATE|BACK/.test(l.intent))) if (l.bangs > l.hits) console.log("INFO    (a bang that was not the attack's: " + JSON.stringify(l) + ")");
  check(`titan attacks: ... and the attack is REAL -- flying straight on, hands-off, each of the five is hit (${handsOff.map(([k, v]) => k.replace("/hands-off", "") + " " + v.hits + "/" + v.attempts).join(", ")})`,
    handsOff.length === 5 && handsOff.every(([, v]) => v.hits === 1 && v.attempts === 1), handsOff);
}
module.exports.attackChecks = attackChecks;
module.exports.tnaHelpers = tnaHelpers;
module.exports.noisyFinger = noisyFinger;
module.exports.realRoute = realRoute;
