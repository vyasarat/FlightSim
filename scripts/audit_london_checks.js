"use strict";
// London.
// The 2026-11 audit (AUDIT.md): one check per finding, each failed on the release before its fix.
const FIXED = new Set(["LONDON-2", "LONDON-3"]);
// ---------------------------------------------------------------------------
// London audit (v215): two things London left wrong, each a check that fails until fixed.
//
//   LONDON-2  a helicopter parked on Tower Bridge: the bridge never opens under it (it hung in mid-air
//             over the raised leaf, and the tall ship sailed through it); once he lifts off and goes,
//             it opens for her as ever -- she is held, never for good
//   LONDON-3  a relaunch that restored London: carrying on (a tap on the lit vehicle card) keeps him in
//             London -- it went through the direction screen, which offers only New York and
//             California; a vehicle that cannot start in London still gets the direction screen
// Alone: node scripts/run_module.js audit_london_checks
// ---------------------------------------------------------------------------
module.exports = async function londonAuditChecks({ newPage, check: report }) {
  // Only the findings already fixed report (FIXED grows release by release, AUDIT.md's table). Anything
  // not named by a finding id (a page-error guard) always reports.
  const check = (name, ok, detail) => { const id = (name.match(/^([A-Z]+-\d+)/) || [])[1]; if (!id || FIXED.has(id)) report(name, ok, detail); };

  // ---- LONDON-2: a helicopter parked on Tower Bridge -------------------------------------------
  // He is set down where the ship's line crosses the bridge (the river's middle at it), so her hull
  // would pass through him if she went. Four cases, one page (portrait): parked there as she comes;
  // set down on a leaf while it is rising; over the leaves while the bells ring; and the things that
  // are NOT on the leaves -- a helicopter under the bridge, a plane passing low over it -- which must
  // not hold it.
  {
    const { ctx, page, errors } = await newPage(768, 1024);
    await page.evaluate(() => {
      const L = window.__lp, st = L.state, T = L.ldn.tb, S = L.ldn.tship, H = L.LD.river.ship, O = L.LD.river.open, P = window.__l2 = {};
      L.noRender = true; L.api.skipScreens();
      P.deck = () => L.ldDeckY();
      P.line = () => L.ldRiverMid(T.z).x;                       // where her hull passes under the bridge
      P.step = (n, f) => { for (let i = 0; i < n; i++) { L.update(1 / 60); if (f) f(); } };
      P.booms = 0; const tb = window.triggerExplosion; window.triggerExplosion = function (...a) { P.booms++; return tb.apply(this, a); };
      P.reset = () => {
        L.api.setVehicle("helicopter"); L.ldStart(); P.step(5);
        T.state = "down"; T.open = 0; T.gate = 0; T.t = 0; T.clearFor = 1e9; L.ldTbUpdate(0);   // (nothing of his on it for a long while)
        S.state = "away"; S.t = 1e6; S.z = H.from; S.v = 0; L.ldTallShipPose && L.ldTallShipPose();
      };
      P.shipAsks = () => { S.state = "in"; S.dir = 1; S.honked = false; S.v = H.speed; S.z = T.z - H.len / 2 - 150; };
      P.bowTo = () => Math.round((T.z - (S.z + H.len / 2)) * 10) / 10;   // her bow short of the bridge's middle (+), past it (-)
      // straight down on to the bridge where her line crosses it
      P.setDown = () => {
        L.heliReset(); st.exploding = false;
        st.phase = "AIRBORNE"; st.x = P.line(); st.z = T.z; st.y = P.deck() + 25; st.speed = 0; st.heading = 0; st.liftoffTimer = 0;
        L.heli.altitude = st.y; L.heli.vy = 0; L.heli.target = null; L.heli.vertical = -1;
        let t = 0; while (t < 40 && st.phase !== "TAXI" && !st.exploding) { P.step(1); t += 1 / 60; }
        L.heli.vertical = 0; P.step(30);
        return { phase: st.phase, onDeck: +(st.y - L.TUNE.gearHeight - P.deck()).toFixed(2), x: Math.round(st.x), line: Math.round(P.line()) };
      };
      P.hover = (x, y, z) => { L.heliReset(); st.exploding = false; st.phase = "AIRBORNE"; st.x = x; st.y = y; st.z = z; st.speed = 0; L.heli.altitude = y; L.heli.vy = 0; L.heli.target = null; L.heli.vertical = 0; };
      P.leave = () => { L.heli.vertical = 1; P.step(60 * 3); L.heli.vertical = 0; P.hover(T.x - 600, P.deck() + 120, T.z - 600); };
      // watch while he is there: is he hanging over a leaf no longer flat, is her hull where he is
      P.watch = (secs) => {
        const w = { maxOpen: 0, hangFrames: 0, throughHim: 0, minBowTo: Infinity, rises: 0, states: [] };
        P.step(Math.round(60 * secs), () => {
          w.maxOpen = Math.max(w.maxOpen, T.open);
          if (w.states[w.states.length - 1] !== T.state) { w.states.push(T.state); if (T.state === "rise") w.rises++; }
          if (st.phase === "TAXI" && T.open >= O.wallAt * 0.5 && Math.abs(st.x - T.x) < T.half && Math.abs(st.z - T.z) < 20) w.hangFrames++;
          if (Math.abs(st.z - S.z) < H.len / 2 && Math.abs(st.x - S.x) < H.beam / 2 + 6) w.throughHim++;
          if (S.state === "in") w.minBowTo = Math.min(w.minBowTo, P.bowTo());
        });
        w.maxOpen = +w.maxOpen.toFixed(2); w.states = w.states.join(">");
        return w;
      };
      P.goes = () => {   // after he has gone: it opens for her and she goes through
        const o0 = L.flags.tbOpens || 0; P.leave();
        let through = false, t = 3; while (t < 120 && !through) { P.step(1); t += 1 / 60; through = S.z - H.len / 2 > T.z + 20; }
        return { opens: (L.flags.tbOpens || 0) - o0, through, secs: +t.toFixed(1) };
      };
    });

    // 1. parked where her line crosses, as she comes up the river
    const r = await page.evaluate(() => {
      const P = window.__l2, b0 = P.booms, out = {};
      P.reset(); out.parked = P.setDown();
      P.shipAsks(); out.whileParked = P.watch(60);
      out.afterHeGoes = P.goes(); out.booms = P.booms - b0;
      return out;
    });
    check("LONDON-2: a helicopter parked on Tower Bridge where the tall ship's line crosses it -- the bridge does not open under it (never hangs him over a raised leaf), she is held short of the bridge and never sails through him; once he flies off it opens for her and she goes through",
      r.parked.phase === "TAXI" && Math.abs(r.parked.onDeck) < 1 && r.whileParked.maxOpen === 0 && r.whileParked.hangFrames === 0 &&
      r.whileParked.throughHim === 0 && r.whileParked.minBowTo > 0 && r.booms === 0 && r.afterHeGoes.opens >= 1 && r.afterHeGoes.through, r);

    // 2. set down on a leaf while it is rising (still low enough to stand on): it goes back down under
    // him, never hangs him, and does not rise again while he stays; when he goes, it opens
    const a = await page.evaluate(() => {
      const L = window.__lp, T = L.ldn.tb, O = L.LD.river.open, P = window.__l2, b0 = P.booms, out = {};
      P.reset(); out.parked = P.setDown();
      P.shipAsks();
      T.state = "rise"; T.gate = 1; T.open = O.wallAt * 0.5; L.ldTbUpdate(0);   // the leaves already on their way up under him
      out.startOpen = +T.open.toFixed(2);
      out.whileThere = P.watch(30);
      out.endOpen = +T.open.toFixed(2); out.endState = T.state;
      out.afterHeGoes = P.goes(); out.booms = P.booms - b0;
      return out;
    });
    check("LONDON-2: set down on a leaf while it is rising -- it goes back down under him and never hangs him; it does not rise again while he stays; when he goes, it opens for her",
      a.parked.phase === "TAXI" && a.whileThere.hangFrames === 0 && a.whileThere.rises === 0 && a.whileThere.maxOpen <= a.startOpen &&
      a.endOpen === 0 && a.whileThere.throughHim === 0 && a.whileThere.minBowTo > 0 && a.booms === 0 && a.afterHeGoes.opens >= 1 && a.afterHeGoes.through, a);

    // 3. over the leaves (a hover just over them) while the bells ring: it never rises
    const b = await page.evaluate(() => {
      const L = window.__lp, T = L.ldn.tb, O = L.LD.river.open, P = window.__l2, b0 = P.booms, out = {};
      P.reset(); P.shipAsks(); P.step(1);
      out.warned = T.state;                                         // the bells: nothing of his anywhere near
      P.hover(P.line(), P.deck() + 6, T.z);
      out.whileThere = P.watch(20);
      out.afterHeGoes = P.goes(); out.booms = P.booms - b0;
      return out;
    });
    check("LONDON-2: over the leaves (hovering just over them) while the bells ring -- the bridge never rises under him; when he goes, it opens for her",
      b.warned === "warn" && b.whileThere.maxOpen === 0 && b.whileThere.rises === 0 && b.whileThere.hangFrames === 0 && b.booms === 0 && b.afterHeGoes.opens >= 1 && b.afterHeGoes.through, b);

    // 4. what is NOT on the leaves does not hold it: a helicopter hovering under the bridge, and a plane
    // passing low over it, during the warning -- one warning, and up it goes
    const c = await page.evaluate(() => {
      const L = window.__lp, st = L.state, T = L.ldn.tb, P = window.__l2, b0 = P.booms, out = {};
      const sea = L.seaLevelAt(P.line(), T.z), deck = P.deck();
      out.room = +(deck - sea).toFixed(1);
      const run = (place) => {
        P.reset(); P.shipAsks(); P.step(1);
        const w0 = L.flags.tbWarnings || 0, o0 = L.flags.tbOpens || 0, warned = T.state;
        place();
        let rose = false, t = 0; while (t < 12 && !rose) { P.step(1); t += 1 / 60; rose = T.state === "rise" || T.state === "up"; }
        const res = { warned, rose, secs: +t.toFixed(1), warnings: (L.flags.tbWarnings || 0) - w0 + 1, opens: (L.flags.tbOpens || 0) - o0 };
        P.hover(T.x - 600, deck + 120, T.z - 600);
        S_away();
        return res;
      };
      const S_away = () => { const S = L.ldn.tship; S.state = "away"; S.t = 1e6; S.z = L.LD.river.ship.from; S.v = 0; };
      out.underIt = run(() => P.hover(P.line(), sea + Math.max(2, (deck - sea) * 0.4), T.z));
      out.planeOver = run(() => {
        L.api.setVehicle("prop"); st.phase = "AIRBORNE"; st.x = P.line(); st.z = T.z - 60; st.y = deck + 8; st.speed = 60; st.pitch = 0; st.bank = 0;
        st.heading = Math.PI; st.liftoffTimer = 0; st.maxAglSinceLiftoff = 1e9; st.approachLatch = false; st.airVy = null;
      });
      out.booms = P.booms - b0;
      L.api.setVehicle("prop"); L.api.spawnAt(0, 0);
      return out;
    });
    const quick = (o) => o.warned === "warn" && o.rose && o.warnings === 1 && o.opens === 1;
    check("LONDON-2: what is not on the leaves does not hold the bridge -- a helicopter hovering under it, a plane passing low over it: one warning, then it rises",
      c.room > 4 && quick(c.underIt) && quick(c.planeOver), c);

    // 5. (v215) at the very edge of "on the leaves" -- a hover dithering across `above`, and one dithering
    // across `passing` -- for 20 s while the ship asks: the bells and gates do not restart over and over
    const e = await page.evaluate(() => {
      const L = window.__lp, st = L.state, T = L.ldn.tb, K = L.LD.river.deckOver, P = window.__l2, out = {};
      const run = (dither) => {
        P.reset(); P.shipAsks();
        P.hover(P.line(), P.deck() + K.above - 1, T.z);
        const w0 = L.flags.tbWarnings || 0, at = [];
        let flips = 0, was = null, seen = w0, f = 0;
        P.step(60 * 20, () => {
          f++; dither(f);
          const c = ldTbDeckClear(); if (was !== null && c !== was) flips++; was = c;
          const w = L.flags.tbWarnings || 0; if (w > seen) { at.push(+(f / 60).toFixed(2)); seen = w; }
        });
        const gaps = at.slice(1).map((t, i) => +(t - at[i]).toFixed(2));
        return { flips, warnings: (L.flags.tbWarnings || 0) - w0, at, minGap: gaps.length ? Math.min(...gaps) : null };
      };
      // across the top of the band: a metre either side of `above`, every 20 frames
      out.height = run((f) => { const y = P.deck() + K.above + ((f / 20 | 0) % 2 ? 1 : -1); st.y = y; L.heli.altitude = y; st.x = P.line(); st.z = T.z; });
      // across `passing`: his speed a little either side of it, every 20 frames, low over the leaves
      out.speed = run((f) => { st.speed = K.passing + ((f / 20 | 0) % 2 ? 1 : -1); st.x = P.line(); st.z = T.z; const y = P.deck() + 6; st.y = y; L.heli.altitude = y; });
      out.rewarn = K.rewarn;
      P.hover(T.x - 600, P.deck() + 120, T.z - 600);
      return out;
    });
    const steady = (o) => o.flips >= 10 && o.warnings <= 2 && (o.minGap === null || o.minGap >= (e.rewarn || 0));
    check("LONDON-2: dithering at the edge of the leaves (across its height, and across its passing speed) for 20 s while the ship asks, the bells and gates do not restart over and over (at most 2 warnings, none within the re-warn wait)",
      !!e.rewarn && steady(e.height) && steady(e.speed), e);

    check("London audit (bridge page): no page errors", errors.length === 0, errors.slice(0, 3));
    await page.evaluate(() => { const L = window.__lp, T = L.ldn.tb, S = L.ldn.tship; S.state = "away"; S.t = 1e6; S.z = L.LD.river.ship.from; S.v = 0; T.state = "down"; T.open = 0; T.gate = 0; L.ldTbUpdate(0); L.api.setVehicle("prop"); L.api.spawnAt(0, 0); });
    await ctx.close();
  }
  // ---- LONDON-3: a relaunch that restored London, carried on -----------------------------------
  // by touch, on whatever is under his finger, in both of the iPad's ways up
  for (const [w, h, way] of [[1024, 768, "landscape"], [768, 1024, "portrait"]]) {
    const { ctx, page, errors } = await newPage(w, h);
    const r = await page.evaluate(() => {
      const L = window.__lp, st = L.state, out = {};
      L.noRender = true;
      const vis = (id) => !document.getElementById(id).classList.contains("hiddenS");
      const tap = (elm) => {
        const b = elm.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2;
        const t = document.elementFromPoint(x, y);
        const o = { pointerId: 51, clientX: x, clientY: y, bubbles: true, cancelable: true, pointerType: "touch", isPrimary: true };
        if (t) { t.dispatchEvent(new PointerEvent("pointerdown", o)); t.dispatchEvent(new PointerEvent("pointerup", o)); }
        for (let i = 0; i < 6; i++) L.update(1 / 60);
        return t && t.closest(".card") ? (t.closest(".card").dataset.v || t.closest(".card").dataset.d || t.closest(".card").dataset.dest || "card") : (t ? t.id || t.tagName : null);
      };
      // carry on: the lit vehicle card, then whatever screen comes up, its first card (all he could do there)
      const carryOn = (v) => {
        const taps = [tap(document.querySelector(`.vehCard[data-v="${v}"]`))];
        for (const s of ["screenDir", "screenDest"]) if (vis(s)) taps.push(tap(document.querySelector(`#${s} .card`)));
        return taps;
      };
      const ap = L.AIRPORTS[2];
      for (const v of ["prop", "car", "helicopter", "speedboat"]) {
        localStorage.setItem("lp.vehicle", v); localStorage.setItem("lp.dir", "0"); localStorage.setItem("lp.start", "ldn");
        L.lpRestoreChoice();
        for (let i = 0; i < 6; i++) L.update(1 / 60);
        const restored = { origin: st.originIdx, picker: vis("screenVehicle"), lit: !!document.querySelector(`.vehCard.sel[data-v="${v}"]`) };
        const taps = carryOn(v);
        out[v] = { restored, taps, origin: st.originIdx, inLondon: L.ldNear(st.x, st.z) && Math.abs(st.z - ap.cz) < 3000, start: localStorage.getItem("lp.start"),
                   screens: ["screenVehicle", "screenDir", "screenDest"].filter(vis), vehicle: st.vehicleKey,
                   onWater: v === "speedboat" ? L.boatOnWater() : undefined };
      }
      // (v215) mid-session, not a relaunch: in London in the plane, the menu button, then the car's card
      localStorage.clear();
      L.api.setVehicle("prop"); L.ldStart(); for (let i = 0; i < 30; i++) L.update(1 / 60);
      const startedIn = st.originIdx;
      const menuTap = tap(document.getElementById("menuBtn"));
      const picker = vis("screenVehicle");
      const taps = carryOn("car");
      out.midSession = { startedIn, menuTap, picker, taps, origin: st.originIdx, inLondon: L.ldNear(st.x, st.z) && Math.abs(st.z - ap.cz) < 3000,
                         screens: ["screenVehicle", "screenDir", "screenDest"].filter(vis), vehicle: st.vehicleKey };
      // (v215) started in London but not IN London now -- out over the sea, or landed in New York with his
      // start still London (it moves only after the celebration): a card gets the direction screen, as
      // before v215, and never puts him back in London
      out.away = {};
      for (const where of ["sea", "newYork"]) {
        L.api.skipScreens(); L.api.setVehicle("prop"); L.ldStart(); for (let i = 0; i < 5; i++) L.update(1 / 60);
        if (where === "sea") { st.phase = "AIRBORNE"; st.x = 0; st.z = 9000; st.y = 200; st.speed = 60; st.pitch = 0; st.bank = 0; st.heading = Math.PI; st.liftoffTimer = 0; st.maxAglSinceLiftoff = 1e9; st.approachLatch = false; st.airVy = null; }
        else { const A0 = L.AIRPORTS[0]; st.phase = "TAXI"; st.x = 0; st.z = A0.cz; st.y = A0.elev + L.TUNE.gearHeight; st.speed = 0; st.heading = 0; }
        L.update(1 / 60);
        const before = { origin: st.originIdx, x: Math.round(st.x), z: Math.round(st.z) };
        const menuTap = tap(document.getElementById("menuBtn"));
        const t = tap(document.querySelector('.vehCard[data-v="prop"]'));
        out.away[where] = { before, menuTap, tapped: t, dirScreen: vis("screenDir"), origin: st.originIdx, inLondon: L.ldNear(st.x, st.z),
                            movedM: Math.round(Math.hypot(st.x - before.x, st.z - before.z)) };
        L.api.skipScreens();
      }
      // a vehicle that cannot start in London, picked there: the direction screen as ever (America)
      localStorage.setItem("lp.vehicle", "prop"); localStorage.setItem("lp.dir", "0"); localStorage.setItem("lp.start", "ldn");
      L.lpRestoreChoice(); for (let i = 0; i < 6; i++) L.update(1 / 60);
      const rt = tap(document.querySelector('.vehCard[data-v="rocket"]'));
      out.rocket = { tapped: rt, dirScreen: vis("screenDir") };
      if (vis("screenDir")) tap(document.querySelector("#screenDir .card"));
      out.rocket.origin = st.originIdx;
      L.api.skipScreens(); localStorage.clear();
      L.api.setVehicle("prop"); L.api.spawnAt(0, 0);
      return out;
    });
    const kept = (o) => o.restored.origin === 2 && o.restored.picker && o.restored.lit && o.origin === 2 && o.inLondon && o.start === "ldn" && o.screens.length === 0;
    const m = r.midSession;
    check(`LONDON-3: a relaunch that restored London, carried on by a tap on the lit vehicle card, keeps him in London -- the plane, a car, the helicopter and the speedboat (on the water); mid-session, the menu then a card keeps him there too; a rocket gets the direction screen${way === "portrait" ? " -- portrait 768x1024" : ""}`,
      kept(r.prop) && kept(r.car) && kept(r.helicopter) && kept(r.speedboat) && r.speedboat.onWater === true &&
      m.startedIn === 2 && m.picker && m.origin === 2 && m.inLondon && m.vehicle === "car" && m.screens.length === 0 &&
      r.rocket.dirScreen && r.rocket.origin !== 2, r);
    const away = (o) => o.before.origin === 2 && o.dirScreen && !o.inLondon && o.movedM < 50;
    check(`LONDON-3: started in London but no longer there -- out over the sea, or landed in New York -- a card from the menu gets the direction screen and never puts him back in London${way === "portrait" ? " -- portrait 768x1024" : ""}`,
      away(r.away.sea) && away(r.away.newYork), r.away);
    check(`London audit (relaunch page, ${way}): no page errors`, errors.length === 0, errors.slice(0, 3));
    await ctx.close();
  }
};
