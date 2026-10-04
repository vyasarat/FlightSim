"use strict";
// The helicopter lands anywhere solid (v139). He comes down on to the ground, a
// roof, a deck, a bridge or a pad, and it settles, every time; over water it
// hovers and never sinks; there is no ground warning; and the one thing that
// still bangs is flying into the SIDE of something at speed.
//
// The parent's report (PLAYTEST.md, 2026-10-03): "gets the ground warning near
// land and blows up most times he tries to land". Two things did it: the alarm
// sounded on every descent (it is the plane's sink-rate alarm), and the kites and
// paper-plane flocks that fly 28-50 m over the fields counted as a mid-air with a
// helicopter hovering STILL among them. And a roof was never a floor: coming down
// on one shoved him about on it for as long as he held the button.
//
// Every attempt is driven the way he does it: point at a spot, hold the down
// button while it is still travelling, keep holding. Deltas only; state reset.
module.exports = async function heliLandChecks({ newPage, check }) {
  const { page } = await newPage(768, 1024);
  const r = await page.evaluate(() => {
    const lp = window.__lp, S = lp.state, H = lp.heli, T = lp.TUNE;
    lp.noRender = true;
    lp.api.setVehicle("helicopter"); lp.api.spawnAt(0, 0);
    for (let i = 0; i < 60; i++) lp.update(1 / 60);
    let rng = 0x5eed; const rnd = () => (rng = (rng * 1103515245 + 12345) >>> 0) / 4294967296;
    // (an older build has no heliFloorAt: the ground and the sea, as it knew them)
    const floorAt = window.heliFloorAt || ((x, z) => ({ y: Math.max(lp.terrainEff(x, z), lp.seaLevelAt(x, z)), water: false, solid: null }));
    const water = (x, z) => lp.terrainEff(x, z) < lp.seaLevelAt(x, z);
    const out = { spots: [], alarmFrames: 0, bangs: 0, fails: [] };
    const step = (n, watch) => {
      for (let i = 0; i < n; i++) {
        const was = S.exploding;
        lp.update(1 / 60);
        // a descent (down held, or creeping lower than it was) never warns; level
        // flight at a real side at speed does, and the side test pins that
        if (S.alarmOn && !(watch && watch.label === "side") && (H.vertical < 0 || S.speed <= lp.TUNE.solid.crawl.heli)) out.alarmFrames++;
        if (S.alarmOn && watch && watch.label === "side" && watch.warnAt === undefined) watch.warnAt = watch.f || 0;
        if (watch) watch.f = (watch.f || 0) + 1;
        if (S.exploding && !was) { out.bangs++; if (watch) { watch.bang = true; watch.why = lastWhy; watch.bangAt = watch.f; } }
      }
    };
    let lastWhy = null;
    const origBoom = window.triggerExplosion;
    window.triggerExplosion = function (...a) {
      lastWhy = (new Error().stack || "").split("\n").slice(2, 4).map(s => s.trim().replace(/^at /, "").replace(/\(.*\/js\//, "(")).join(" < ");
      return origBoom.apply(this, a);
    };
    const start = (x, y, z, heading) => {
      lp.heliReset(); lp.carrierReset(); lp.restoreShattered(); S.exploding = false; S.alarmOn = false; lastWhy = null;
      S.x = x; S.y = y; S.z = z; S.heading = heading || 0; S.phase = "AIRBORNE"; S.speed = 0;
      S.liftoffTimer = 0; H.altitude = y; H.vy = 0;
    };
    // point at (tx, tz) from `back` metres off, hold down after `lead` seconds
    const attempt = (label, tx, tz, top, back, lead, expectTop) => {
      const a = rnd() * Math.PI * 2;
      const sx = tx + Math.cos(a) * back, sz = tz + Math.sin(a) * back;
      const g0 = Math.max(lp.terrainEff(sx, sz), lp.seaLevelAt(sx, sz));
      start(sx, Math.max(g0, top) + 40, sz, Math.atan2(-(tx - sx), -(tz - sz)));
      H.target = { x: tx, y: top, z: tz }; H.sky = false;
      const w = { label, bang: false };
      step(Math.round(lead * 60), w);
      H.vertical = -1;
      let t = 0;
      while (t < 40 && S.phase !== "TAXI" && !S.exploding) { step(1, w); t += 1 / 60; }
      H.vertical = 0;
      step(30, w);
      w.landed = S.phase === "TAXI"; w.t = +t.toFixed(1);
      w.skid = +(S.y - T.gearHeight).toFixed(2);
      if (expectTop !== undefined) w.onTop = Math.abs(w.skid - expectTop) < 0.35;
      out.spots.push(w);
      return w;
    };

    // ---- open ground: fields, hills, the airport
    for (let k = 0, n = 0; k < 400 && n < 8; k++) {
      const x = (rnd() - .5) * 5000, z = lp.AIRPORTS[1].cz + rnd() * (lp.AIRPORTS[0].cz - lp.AIRPORTS[1].cz);
      if (water(x, z)) continue;
      attempt("ground", x, z, lp.terrainEff(x, z), 120 + rnd() * 200, 0.5 + rnd() * 2); n++;
    }
    attempt("airport", 60, lp.AIRPORTS[0].cz + 300, lp.terrainEff(60, lp.AIRPORTS[0].cz + 300), 200, 1);

    // ---- roofs, pads, decks: straight down on to the top, and it stays there
    const tops = [];
    lp.forEachSolid(b => {
      if (b.car !== undefined || b.park || b.cap || b.ramp || b.o3 || lp.__lpIsHidden(b)) return;
      if (b.hw < 7 || b.hd < 7) return;
      const g = lp.terrainEff(b.x, b.z);
      if (b.y1 - Math.max(g, lp.seaLevelAt(b.x, b.z)) < 4) return;
      // nothing standing on top of it at its middle
      let over = false;
      lp.forEachSolid(o => { if (o !== b && !over && Math.abs(o.x - b.x) < o.hw + 4 && Math.abs(o.z - b.z) < o.hd + 4 && o.y1 > b.y1 + 0.5 && o.y0 < b.y1 + 12) over = true; });
      if (!over) tops.push(b);
    });
    const kinds = {};
    for (const b of tops) (kinds[b.kind || "building"] = kinds[b.kind || "building"] || []).push(b);
    const roofs = [];
    for (const k of Object.keys(kinds)) {
      const L = kinds[k];
      for (let i = 0; i < Math.min(4, L.length); i++) roofs.push(L[Math.floor((i + .5) * L.length / Math.min(4, L.length))]);
    }
    out.roofKinds = Object.keys(kinds).map(k => k + ":" + kinds[k].length);
    for (const b of roofs) {
      start(b.x, b.y1 + 30, b.z, rnd() * 6);
      const w = { label: "roof:" + (b.kind || "building"), bang: false };
      H.vertical = -1;
      let t = 0;
      while (t < 30 && S.phase !== "TAXI" && !S.exploding) { step(1, w); t += 1 / 60; }
      H.vertical = 0; step(60, w);
      w.landed = S.phase === "TAXI"; w.skid = +(S.y - T.gearHeight).toFixed(2); w.top = +b.y1.toFixed(2);
      // on it -- or, for a bridge pier, on the road deck the pier carries
      const road = Math.max(lp.stSurfaceAt(S.x, S.z) ?? -1e9, (() => { const n = lp.hwyNearest(S.x, S.z); return n && Math.abs(n.lateral) < lp.highway.halfW ? n.y : -1e9; })());
      w.onTop = w.landed && Math.hypot(S.x - b.x, S.z - b.z) < 3 && (Math.abs(w.skid - b.y1) < 0.35 || (road > b.y1 && Math.abs(w.skid - road) < 0.35));
      if (!w.onTop) { const f = floorAt(S.x, S.z, S.y); w.at = [S.x - b.x, S.z - b.z].map(v => +v.toFixed(1)); w.floor = [+f.y.toFixed(2), f.water, f.solid && f.solid.kind]; }
      out.spots.push(w);
      // ... and the same up button takes him off it again
      if (w.landed) {
        H.vertical = 1; step(90, w); H.vertical = 0; step(10, w);
        w.tookOff = S.phase === "AIRBORNE" && S.y - T.gearHeight > b.y1 + 6;
      }
    }
    // the carrier's flight deck: a deck that is not a solid, out at sea
    if (lp.carrier && lp.carrier.g) {
      start(lp.carrier.x - 10, lp.carrier.deck + 40, lp.carrier.z - 40, 0);
      const w = { label: "roof:carrier", bang: false };
      H.vertical = -1;
      let t = 0;
      while (t < 30 && S.phase !== "TAXI" && !S.exploding) { step(1, w); t += 1 / 60; }
      H.vertical = 0; step(60, w);
      w.landed = S.phase === "TAXI"; w.skid = +(S.y - T.gearHeight).toFixed(2); w.top = lp.carrier.deck;
      w.onTop = w.landed && Math.abs(w.skid - w.top) < 0.35;
      out.spots.push(w);
      if (w.landed) { H.vertical = 1; step(90, w); H.vertical = 0; step(10, w); w.tookOff = S.phase === "AIRBORNE" && S.y - T.gearHeight > w.top + 6; }
    }
    // a pointed-at roof, coming in while still travelling
    for (const b of roofs.slice(0, 6)) attempt("roof-travel:" + (b.kind || "building"), b.x, b.z, b.y1, 150, 0.4);

    // ---- the motorway where it stands over the ground: a bridge deck
    const hw = lp.highway, decks = [];
    for (let s = 200; s < hw.length - 200 && decks.length < 4; s += 37) {
      const p = lp.hwySampleAt(s);
      const under = Math.max(lp.terrainEff(p.x, p.z), lp.seaLevelAt(p.x, p.z));
      if (p.y - under > 7 && (!decks.length || s - decks[decks.length - 1].s > 2000)) decks.push({ s, x: p.x, y: p.y, z: p.z });
    }
    out.decks = decks.length;
    for (const d of decks) {
      start(d.x, d.y + 30, d.z, 0);
      const w = { label: "deck", bang: false };
      H.vertical = -1;
      let t = 0;
      while (t < 30 && S.phase !== "TAXI" && !S.exploding) { step(1, w); t += 1 / 60; }
      H.vertical = 0; step(30, w);
      w.landed = S.phase === "TAXI"; w.skid = +(S.y - T.gearHeight).toFixed(2); w.top = +d.y.toFixed(2);
      w.onTop = w.landed && Math.abs(w.skid - d.y) < 0.5;
      out.spots.push(w);
    }

    // ---- water: the sea and the lake. It hovers; it never sinks or bangs.
    const wet = [];
    for (let k = 0; k < 3000 && wet.length < 3; k++) {
      const x = (rnd() - .5) * 9000, z = lp.AIRPORTS[1].cz + rnd() * (lp.AIRPORTS[0].cz - lp.AIRPORTS[1].cz);
      if (lp.terrainEff(x, z) < lp.seaLevelAt(x, z) - 3) wet.push({ x, z });
    }
    wet.push({ x: lp.FBARGE.x + 80, z: lp.FBARGE.z + 80, lake: true });
    out.wet = wet.length;
    for (const p of wet) {
      if (!water(p.x, p.z)) continue;
      start(p.x, lp.seaLevelAt(p.x, p.z) + 40, p.z, 0);
      const w = { label: p.lake ? "lake" : "sea", bang: false };
      let lowest = Infinity;
      H.vertical = -1;
      for (let i = 0; i < 60 * 15; i++) { step(1, w); lowest = Math.min(lowest, S.y - lp.seaLevelAt(S.x, S.z)); }
      H.vertical = 0; step(30, w);
      w.hovering = S.phase === "AIRBORNE" && lowest > 1;
      w.lowest = +lowest.toFixed(2);
      out.spots.push(w);
    }

    // ---- a kite, or the paper planes, drifting into him while he hovers low
    const kites = lp.targets.filter(t => t.alive && (t.kind === "kite" || t.kind === "flock"));
    const k0 = lp.flags.targets;
    let kiteBang = 0;
    for (const t of kites.slice(0, 3)) {
      start(t.x, t.y, t.z, 0);
      const w = { label: "kite", bang: false };
      step(20, w);
      if (w.bang) kiteBang++;
    }
    out.kites = { n: Math.min(3, kites.length), bangs: kiteBang, popped: lp.flags.targets - k0 };

    // ---- a CROWNED tower (a spire, a mast, a glass cap): straight down over its
    // middle, it settles on the crown and never inside it -- the crowns are solid
    const crowned = [];
    for (const c of Object.values(lp.cities)) {
    // a city is only solid while it is loaded round him: go there first
    start(c.ax, lp.terrainEff(c.ax, c.az) + 300, c.az, 0); step(90);
    lp.forEachSolid(b => {
      if (Math.hypot(b.x - c.ax, b.z - c.az) > 1500) return;
      if (b.kind !== "building" || b.o3 || b.cap || b.car !== undefined || lp.__lpIsHidden(b) || b.hw < 4 || b.hd < 4) return;
      let on = null;
      lp.forEachSolid(o => { if (!on && o !== b && Math.abs(o.x - b.x) < 0.5 && Math.abs(o.z - b.z) < 0.5 && Math.abs(o.y0 - b.y1) < 0.5 && o.hw < b.hw) on = o; });
      if (on && crowned.filter(k => k.city === c).length < 2 && !crowned.some(k => Math.hypot(k.b.x - b.x, k.b.z - b.z) < 200)) crowned.push({ b, on, city: c });
    });
    }
    out.crowned = crowned.length;
    for (const { b, on } of crowned) {
      start(b.x + 0.3, on.y1 + 40, b.z + 0.2, 0.5); step(30);
      const w = { label: "crown", bang: false };
      H.vertical = -1;
      let t = 0;
      while (t < 40 && S.phase !== "TAXI" && !S.exploding) { step(1, w); t += 1 / 60; }
      H.vertical = 0; step(60, w);
      w.landed = S.phase === "TAXI"; w.skid = +(S.y - T.gearHeight).toFixed(2);
      // above the roof it stands on, and not inside any solid of the tower
      w.outside = !lp.solidQuery(S.x, S.y, S.z, 1.5, lp.SOLID.AIR, S.y - T.gearHeight - 0.2);
      w.ok = w.landed && w.skid >= b.y1 - 0.35 && w.outside;
      out.spots.push(w);
    }

    // ---- an airliner flying into him while he hovers is not his bang either
    {
      const ts = lp.traffic.filter(t => t.alive);
      const m0 = lp.flags.midairs;
      let planeBang = 0, n = 0;
      for (const t of ts.slice(0, 2)) {
        start(t.x, t.y, t.z, 0);
        const w = { label: "airliner", bang: false };
        step(3, w); n++;
        if (w.bang) planeBang++;
      }
      out.planes = { n, bangs: planeBang, midairs: lp.flags.midairs - m0 };
    }

    // ---- the creep a held-down descent slows to near a tall thing is let go of:
    // up and away, pointed at somewhere far, it is back to cruising
    if (roofs.length) {
      const b = roofs[0];
      start(b.x, b.y1 + 30, b.z, 0);
      H.vertical = -1; let t = 0;
      while (t < 30 && S.phase !== "TAXI") { step(1); t += 1 / 60; }
      H.vertical = 1; step(120); H.vertical = 0;
      H.target = { x: S.x + 2000, y: S.y, z: S.z }; H.sky = true;
      let top = 0; for (let i = 0; i < 60 * 6; i++) { step(1); top = Math.max(top, S.speed); }
      out.release = { top: +top.toFixed(1), block: !!H.landBlock };
    }

    // ---- what it stood on goes from under it (a roof shattered away): it lifts
    // and settles on what is there now -- never left standing on air
    {
      const b = roofs.find(r => r.mesh && r.mesh.visible !== undefined && !r.mesh.isCityProxy);
      if (b) {
        start(b.x, b.y1 + 20, b.z, 0);
        H.vertical = -1; let t = 0;
        while (t < 30 && S.phase !== "TAXI") { step(1); t += 1 / 60; }
        H.vertical = 0;
        const was = S.phase;
        b.mesh.visible = false;
        const w = { label: "gone", bang: false };
        H.vertical = -1; t = 0;
        step(5, w);
        while (t < 40 && !(S.phase === "TAXI" && S.y - T.gearHeight < b.y1 - 1) && !S.exploding) { step(1, w); t += 1 / 60; }
        H.vertical = 0;
        b.mesh.visible = true;
        out.gone = { was, landedBelow: S.phase === "TAXI" && S.y - T.gearHeight < b.y1 - 1, bang: w.bang };
      } else out.gone = null;
    }

    // ---- the one bang that stays: the SIDE of something, at speed
    // from whichever side of a ground-standing tower is open air at that height
    let tall = null, from = null;
    for (const c of tops.filter(b => b.kind === "building" && b.y0 < lp.terrainEff(b.x, b.z) + 3 && b.y1 - lp.terrainEff(b.x, b.z) > 25)) {
      const y = c.y1 - 8;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const sx = c.x + dx * (c.hw + 150), sz = c.z + dz * (c.hd + 150);
        // the town's buildings stream in around HIM: stand there first, then look
        start(sx, y, sz, 0); step(30); if (Math.hypot(S.x - sx, S.z - sz) > 1) continue;
        let clear = true;
        for (let d = 0; d <= 140 && clear; d += 4) {
          const px = sx - dx * d, pz = sz - dz * d;
          if (floorAt(px, pz, y).y > y - 15 || lp.solidQuery(px, y, pz, 8, lp.SOLID.AIR)) clear = false;
        }
        if (clear) { from = { sx, sz, dx, dz, y }; break; }
      }
      if (from) { tall = c; break; }
    }
    if (tall) {
      const y = from.y;
      start(from.sx, y, from.sz, Math.atan2(from.dx, from.dz)); step(30);
      H.target = { x: tall.x - from.dx * (tall.hw + 300), y: y, z: tall.z - from.dz * (tall.hd + 300) }; H.sky = true;
      const w = { label: "side", bang: false };
      for (let i = 0; i < 60 * 8 && !w.bang; i++) step(1, w);
      out.side = w.bang; out.sideWarn = w.warnAt !== undefined && w.bangAt - w.warnAt >= 20; out.sideInfo = { warnAt: w.warnAt, bangAt: w.bangAt, x: tall.x | 0, z: tall.z | 0, hw: tall.hw, y0: tall.y0, y1: tall.y1, why: w.why, end: [S.x | 0, S.y | 0, S.z | 0] };
      out.bangs -= w.bang ? 1 : 0;
      // ... and the same run with DOWN held from the start, at cruise: a landing,
      // so it creeps before the side -- it never meets it at speed, unwarned
      lp.restoreShattered();               // the bang just now shattered the tower away
      start(from.sx, y, from.sz, Math.atan2(from.dx, from.dz)); step(30);
      H.target = { x: tall.x - from.dx * (tall.hw + 300), y: y, z: tall.z - from.dz * (tall.hd + 300) }; H.sky = true;
      for (let i = 0; i < 60 && S.speed < 80; i++) step(1);
      const w2 = { label: "sideDown", bang: false };
      H.vertical = -1;
      let fastest = 0;
      for (let i = 0; i < 60 * 10 && !w2.bang && S.phase !== "TAXI"; i++) {
        step(1, w2);
        const near = Math.max(Math.abs(S.x - tall.x) - tall.hw, Math.abs(S.z - tall.z) - tall.hd);
        if (near < 6) fastest = Math.max(fastest, S.speed);
      }
      H.vertical = 0;
      out.sideDown = { bang: w2.bang, nearSpeed: +fastest.toFixed(1), startSpeed: 80 };
    } else out.side = null;

    lp.heliReset(); lp.carrierReset(); S.exploding = false;
    window.triggerExplosion = origBoom;
    return out;
  });
  await page.close();
  const spot = l => r.spots.filter(s => s.label.startsWith(l));
  const bad = (l, f) => spot(l).filter(f).map(s => JSON.stringify(s));
  check("heli lands: no ground warning on any descent, anywhere (down held, or hovering and creeping)", r.alarmFrames === 0, { alarmFrames: r.alarmFrames });
  check("heli lands: flying level at the side of a tower at speed, the warning comes first (at least a third of a second before the bang)", r.sideWarn === true, r.sideInfo);
  check("heli lands: a crowned tower (spire, mast, glass cap) -- it settles on the crown, never inside it (" + r.crowned + ")",
    r.crowned >= 2 && !bad("crown", s => s.bang || !s.ok).length, bad("crown", s => s.bang || !s.ok));
  check("heli lands: an airliner flying into him while he hovers -- the airliner goes, he does not", r.planes.n >= 1 && r.planes.bangs === 0, r.planes);
  check("heli lands: the creep near a tall thing is let go of -- up and pointed away, it is back to cruising", r.release && r.release.top > 40 && !r.release.block, r.release);
  check("heli lands: the roof it stood on goes -- it settles on what is below, no bang", r.gone && r.gone.was === "TAXI" && r.gone.landedBelow && !r.gone.bang, r.gone);
  check("heli lands: open ground and the airport, pointed at and coming down while travelling, settles every time (" + spot("ground").length + "+1)",
    spot("ground").length >= 6 && !bad("ground", s => s.bang || !s.landed).length && !bad("airport", s => s.bang || !s.landed).length, bad("ground", s => s.bang || !s.landed).concat(bad("airport", s => s.bang || !s.landed)));
  check("heli lands: straight down on a roof, a pad, a deck -- settles ON it, every kind (" + r.roofKinds.join(" ") + ")",
    spot("roof:").length >= 4 && !bad("roof:", s => s.bang || !s.onTop).length, bad("roof:", s => s.bang || !s.onTop));
  check("heli lands: the same up button takes him off a roof again", spot("roof:").length && spot("roof:").every(s => s.tookOff), bad("roof:", s => !s.tookOff));
  check("heli lands: pointed at a roof and coming down while travelling -- never a bang", !bad("roof-travel", s => s.bang || !s.landed).length, bad("roof-travel", s => s.bang || !s.landed));
  check("heli lands: on the motorway where it is a bridge, it settles on the deck (" + r.decks + ")", r.decks >= 1 && !bad("deck", s => s.bang || !s.onTop).length, bad("deck", s => s.bang || !s.onTop));
  check("heli lands: over the sea and the lake, holding down, it hovers -- never sinks, never bangs (" + spot("sea").length + " sea, " + spot("lake").length + " lake)",
    spot("sea").length >= 2 && spot("lake").length === 1 && !bad("sea", s => s.bang || !s.hovering).length && !bad("lake", s => s.bang || !s.hovering).length,
    bad("sea", s => s.bang || !s.hovering).concat(bad("lake", s => s.bang || !s.hovering)));
  check("heli lands: a kite or the paper planes drifting into him while he hovers is not a bang (it pops)", r.kites.n >= 1 && r.kites.bangs === 0 && r.kites.popped >= 1, r.kites);
  check("heli lands: flying into the side of a tower at speed is still the one bang", r.side === true, { side: r.side, info: r.sideInfo });
  check("heli lands: holding down at cruise straight at a tower taller than him, it creeps before the side -- no bang", r.sideDown && !r.sideDown.bang && r.sideDown.nearSpeed <= 12, r.sideDown);
  check("heli lands: zero bangs across every landing (" + r.spots.length + " attempts)", r.bangs === 0, { bangs: r.bangs, which: r.spots.filter(s => s.bang && s.label !== "side").map(s => s.label) });
};
