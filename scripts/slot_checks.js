"use strict";
// ---------------------------------------------------------------------------
// No two visible controls may overlap -- at any viewport, on any vehicle.
//
// The harness already had a slot check, but only for `.roundBtn` and only at
// one viewport. Both gaps matter now: the speed control is a top-anchored
// ladder while the helicopter's altitude pair is bottom-anchored, so whether
// they collide depends entirely on how tall the screen is; and eject and the
// car's horn are small icons rather than roundBtns, so the old check could not
// see them at all.
//
// It tests the same thing the old one does -- elementFromPoint at each button's
// centre -- because that is what actually decides which control eats the tap.
// Corners as well as the centre: two buttons can overlap by a third and still
// each own their own middle.
// ---------------------------------------------------------------------------

module.exports = async function slotChecks({ newPage, check, viewports }) {
  for (const [w, h] of viewports) {
    const { page } = await newPage(w, h);
    const clashes = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.noRender = true; L.api.skipScreens();

      const SEL = ".roundBtn, #ejectBtn, #hornBtn, #menuBtn, #throttleBtn";
      const overlaps = () => {
        const btns = [...document.querySelectorAll(SEL)].filter(b => {
          const cs = getComputedStyle(b);
          return cs.display !== "none" && cs.visibility !== "hidden" && +cs.opacity > 0.05;
        });
        const bad = [];
        for (const b of btns) {
          const r = b.getBoundingClientRect();
          if (!r.width) continue;
          // the middle, and a point just inside each corner
          const pts = [
            [r.left + r.width / 2, r.top + r.height / 2],
            [r.left + 4, r.top + 4], [r.right - 4, r.top + 4],
            [r.left + 4, r.bottom - 4], [r.right - 4, r.bottom - 4],
          ];
          for (const [x, y] of pts) {
            if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
            const hit = document.elementFromPoint(x, y);
            const owner = hit && hit.closest(SEL);
            if (owner && owner !== b) { bad.push(b.id + " under " + owner.id); break; }
          }
        }
        return [...new Set(bad)];
      };

      const out = [];

      // The PRESSED and EXPANDED states, not just the resting ones. A control
      // that grows a halo when held, or a speed ladder that opens over the
      // throttle, is only wrong in the state he is actually in when he needs
      // the next control -- so every scene is tested held as well as at rest.
      const HELD = ["fastBtn", "slowBtn", "speedBtn", "throttleBtn", "heliUpBtn", "heliDownBtn",
                    "hornBtn", "cannonBtn", "bucketBtn", "missileBtn", "magnetBtn", "washBtn"];
      // Only the CSS-positioned indicators can be forced on: the home arrow,
      // the aim marker, the heli target and the wingman are placed by script
      // every frame they are up, so switching one on by hand shows it wherever
      // it last legitimately was. Those four are covered at rest instead, in
      // whichever scene actually raises them.
      const HUD = ["rotateArrow", "glideGuide", "alarm", "bigNum"];
      const setHeld = (on) => {
        for (const id of HELD) { const e = document.getElementById(id); if (e) e.classList.toggle("pressed", on); }
        for (const id of HUD) { const e = document.getElementById(id); if (e) e.classList.toggle("on", on); }
        const g = document.getElementById("glideGuide"); if (g && on) g.dataset.state = "up";
        const n = document.getElementById("bigNum"); if (n && on) n.textContent = "3";
      };

      const at = (name, setup) => {
        setHeld(false);
        setup();
        for (let i = 0; i < 14; i++) L.update(1 / 60);
        // The geometric test, PLUS the system's own answer from the same table
        // the game resolves buttons with (btnSlotClashes in js/buttons.js). The
        // declared test catches a clash the geometry cannot see -- two buttons
        // that share a slot but whose CSS has drifted apart -- and the geometry
        // catches one the table cannot, a button sitting somewhere its entry
        // does not claim. Neither subsumes the other.
        // Three tests, and none subsumes the others: the geometric one over the
        // controls, the DECLARED one from the button table, and obstruction --
        // a HUD indicator drawn on top of a control. The third exists because
        // the first two only ever looked at buttons, so a "pull up" arrow lying
        // across the throttle was invisible to both.
        const bad = overlaps()
          .concat(L.btnSlotClashes().map(c => "declared " + c))
          .concat(L.btnObstructions().map(c => "obstructed " + c));
        // The rest pass had to run first: `btnObstructions` learns each
        // control's resting paint reach from it, and the held bleed it cares
        // about is what a press ADDS over that.
        setHeld(true);
        for (const c of L.btnObstructions()) bad.push("held " + name + ": obstructed " + c);
        setHeld(false);
        if (bad.length) out.push({ name, bad: [...new Set(bad)] });
      };

      at("plane on the runway", () => { L.api.setVehicle("prop"); L.api.placeOnRunway(); });
      at("plane airborne", () => { L.api.setVehicle("prop"); L.api.teleportAirborne(1200, 0, 300, 0); });
      at("fighter airborne", () => { L.api.setVehicle("fighter"); L.api.teleportAirborne(1200, 0, 300, 0); });
      at("airliner airborne", () => { L.api.setVehicle("airlinerDelta"); L.api.teleportAirborne(1200, 0, 300, 0); });
      at("car on the road", () => { L.api.setVehicle("car"); L.api.placeOnRunway(); });
      at("monster truck at the arena", () => { L.api.setVehicle("monster"); L.api.spawnAt(0, 0); });
      at("booster rocket on the launch site's pad", () => { L.api.setVehicle("heavy"); L.api.spawnAt(0, 0); });
      // v144: the rocket sled he rides -- at the start tower (go, the picker), and
      // mid-run (go gone: nothing to press but the burst, which is a drag)
      at("rocket sled at the start tower", () => { L.api.setThrottle(false); L.api.setVehicle("sled"); L.api.spawnAt(0, 0); });
      at("rocket sled mid-run", () => {
        L.api.setThrottle(false); L.api.setVehicle("sled"); L.api.spawnAt(0, 0);
        L.api.setThrottle(true);
        for (let i = 0; i < 60 * 6 && L.sled.phase !== "run"; i++) L.update(1 / 60);
        L.api.setThrottle(false);
      });
      // v145: the crane -- aiming (go, the picker), and mid-domino (nothing to press:
      // the go button and the picker gone, the view, the photo and the menu as ever)
      at("crane aiming", () => { L.api.setThrottle(false); L.api.clearStick(); L.api.setVehicle("crane"); L.api.spawnAt(0, 0); });
      at("crane mid-domino", () => {
        L.api.setThrottle(false); L.api.clearStick(); L.api.setVehicle("crane"); L.api.spawnAt(0, 0);
        L.api.setThrottle(true); L.update(1 / 60); L.api.setThrottle(false);
        for (let i = 0; i < 60 * 15 && !L.crTowers().some(t => t.i === 2 && t.phiDeg > 20); i++) L.update(1 / 60);
        // never got there: the scene fails, rather than passing on the aiming buttons
        if (!L.crTowers().some(t => t.i === 2 && t.phiDeg > 20)) out.push({ name: "crane mid-domino", bad: ["the domino was never reached (phase " + L.cr.phase + ")"] });
      });
      at("monster truck driving", () => { L.api.setVehicle("monster"); L.api.spawnAt(0, 0); L.api.setStick(0, 0); for (let i = 0; i < 60; i++) L.update(1 / 60); });
      at("car honking", () => {
        L.api.setVehicle("car"); L.api.placeOnRunway();
        for (let i = 0; i < 10; i++) L.update(1 / 60);
        L.carHornPress();
      });
      at("speedboat in the harbour", () => { L.carHornRelease(); L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1); });
      at("speedboat at the fire with the cannon up", () => {
        L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
        st.x = L.FF.rig.x + 120; st.z = L.FF.rig.z + 120;
      });
      at("yacht under way", () => { L.api.setVehicle("yacht"); L.api.spawnAt(1, 1); });
      at("helicopter hovering", () => {
        L.api.setVehicle("helicopter"); L.api.placeOnRunway();
        st.phase = "AIRBORNE"; st.y += 80;
      });
      at("helicopter over the fire with a full bucket", () => {
        L.api.setVehicle("helicopter");
        L.heliReset();   // no destination carried in from an earlier scenario: its ring is not this one's

        st.phase = "AIRBORNE"; st.x = L.FF.rig.x + 400; st.z = L.FF.rig.z + 400;
        st.y = L.TUNE.waterLevel + 20; st.speed = 0;
        for (let i = 0; i < 10; i++) L.update(1 / 60);
        L.bucketPress();
        for (let i = 0; i < 60 * (L.FF.scoopTime + 0.4); i++) { L.update(1 / 60); st.y = L.TUNE.waterLevel + 20; st.speed = 0; }
        st.x = L.FF.rig.x + 30; st.z = L.FF.rig.z + 30; st.y = L.fire.deck + 70;
      });
      at("rocket on the pad", () => { L.api.setVehicle("rocket"); L.api.placeOnRunway(); });
      at("rocket climbing", () => {
        L.api.setVehicle("rocket"); L.api.placeOnRunway();
        L.api.setThrottle(true);
        for (let i = 0; i < 60 * 25 && !L.rocketCanDrop(); i++) L.update(1 / 60);
        L.api.setThrottle(false);
      });
      at("driving the rover", () => {
        L.api.setVehicle("rocket"); L.api.placeOnRunway();
        const b = L.BODIES[0];
        st.dest = "moon"; st.phase = "TAXI"; L.rk.onBody = b; L.rk.stage = 3;
        st.x = b.x; st.y = b.y + b.r + 10; st.z = b.z;
        L.update(1 / 60); L.roverDeploy();
      });
      return out;
    });
    check(`layout ${w}x${h}: no two visible controls overlap -- speed steps, eject, the horn, the contextual button and the vehicle's own`,
      clashes.length === 0, JSON.stringify(clashes));
    await page.close();
  }
  await measuredOnce({ newPage, check });
  await bangButtons({ newPage, check });
};

// ---------------------------------------------------------------------------
// (v220, Q-6) IN PIECES, THE BUTTONS ARE WHAT THE TABLE SAYS, AND THE SPEED STEP CANNOT BE NUDGED.
//
// The bang (flight.js, FRAME_TAILS.bang) returned before the frame's btnUpdateAll, so whatever was up when he
// banged stayed up in pieces -- the plane's faster and slower buttons, and a tap on one still moved his step.
// In the states he is really in: portrait; the plane, the helicopter and the rocket, each flying; a real bang
// through the one wall law (him, at cruise, inside the nearest solid that blocks his class -- the leaving
// matrix's own bang). On every frame he is still in pieces after it, every button the table owns must be shown
// exactly when its own when() says; and twice in the bang (just after it, and half a second in) a finger lands
// and lifts on each point a speed button sat on before the bang, one point a frame -- whatever is under the finger then is
// what is pressed -- and his speed step must not move: a DELTA, step before against step after. Then, put back
// together (half a second on), the speed control he had is up again as its when() says, on the step he left it.
// The rocket has no step: its one live control before the bang is the throttle, which its when() keeps up in
// pieces; twice a finger lands and lifts where it sat, and nothing of the rocket (his position, speed, the
// throttle held, every plain field of rk) may change beyond what the untapped frame before it changed.
// What this does not cover: the ground bang and the gear-up bang (flight.js, the full path), landscape, the seat.
// ---------------------------------------------------------------------------
async function bangButtons({ newPage, check }) {
  const { page } = await newPage(820, 1180);
  const rows = await page.evaluate(() => {
    const L = window.__lp, st = L.state;
    L.noRender = true; L.api.skipScreens();
    const step = (n) => { for (let i = 0; i < n; i++) L.update(1 / 60); };
    const air = () => st.phase === "AIRBORNE" || st.phase === "CLIMB_AWAY";
    const shown = id => !!el[id] && !el[id].classList.contains("hidden") && getComputedStyle(el[id]).display !== "none";
    const tapAt = ([x, y]) => {
      const t = document.elementFromPoint(x, y) || document.body;
      for (const type of ["pointerdown", "pointerup"])
        t.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 9, clientX: x, clientY: y }));
      return t.id || t.tagName;
    };
    const SETUP = {
      plane() { L.api.setVehicle("prop"); L.api.teleportAirborne(1200, 0, 320, 0); step(20); },
      heli() { L.api.setVehicle("helicopter"); L.api.spawnAt(0, 0); step(10); heli.vertical = 1; step(120); heli.vertical = 0; step(30); },
      rocket() { L.api.setVehicle("rocket"); L.api.placeOnRunway(); step(10); L.api.setThrottle(true); step(60 * 5); },
    };
    const out = [];
    for (const v of ["plane", "heli", "rocket"]) {
      SETUP[v]();
      const r = { v, air: air(), speedIds: [], pts: [], taps: [], bad: [], inPieces: 0, exploded: false, back: false };
      // the step in the middle of its range, so a nudge either way would move it (the helicopter's cycle always does)
      const steps = spdStepsFor(spdKey());
      if (steps) st.speedStep = Math.floor((steps.length - 1) / 2);
      r.stepBefore = st.speedStep;
      r.speedIds = ["fastBtn", "slowBtn", "speedBtn"].filter(shown);
      // the rocket has no step: its live control is the throttle (hold to burn), up before the bang and, by its
      // own when(), in pieces too -- a finger on it must change nothing of the rocket while he is in pieces
      // (the setup holds the throttle through the harness; let go of it first, or the tap's release is read as a change)
      if (v === "rocket") { L.api.setThrottle(false); step(1); }
      if (v === "rocket" && shown("throttleBtn")) { const b = el.throttleBtn.getBoundingClientRect(); r.rocketPt = [b.left + b.width / 2, b.top + b.height / 2]; }
      const rocketSnap = () => { const o = { x: st.x, y: st.y, z: st.z, speed: st.speed, throttleHeld: !!st.throttleHeld, exploding: !!st.exploding };
        for (const key in L.rk) { const val = L.rk[key]; if (val === null || typeof val !== "object") o["rk." + key] = val; } return o; };
      for (const id of r.speedIds) { const b = el[id].getBoundingClientRect(); r.pts.push([b.left + b.width / 2, b.top + b.height / 2]); }
      r.upBefore = Object.keys(BUTTONS).filter(id => BUTTONS[id].when && shown(id));
      // the bang: the nearest solid that blocks his class, him inside it at cruise
      const cls = vehSolidClass(), cruise = st.vp.cruiseSpeed || 40;
      let best = null, bd = Infinity;
      L.forEachSolid(b => {
        if (b.o3 || b.cap || b.ramp || b.toy || b.moving || b.car !== undefined || b.park) return;
        if (!L.solidBlocks(b, cls) || (b.mesh && b.mesh.visible === false) || L.isSolidHidden(b)) return;
        if (!(b.hw > 3 && b.hd > 3 && b.y1 - b.y0 > 6)) return;
        const d = Math.hypot(b.x - st.x, b.z - st.z);
        if (d < bd) { bd = d; best = b; }
      }, st.x, st.z, 2000);
      if (!best) { r.why = "no solid in reach"; out.push(r); continue; }
      st.x = best.x; st.z = best.z + best.hd - 1;
      st.y = Math.min(best.y1 - 2, Math.max(best.y0 + 3, st.y));
      st.heading = 0; st.speed = cruise;
      if (vehKind() === "heli") { heli.vx = 0; heli.vz = -cruise; heli.altitude = st.y; }
      const judge = (frame) => {
        for (const id in BUTTONS) {
          const b = BUTTONS[id];
          if (!b.when || !el[id]) continue;
          let want = false;
          try { want = !!b.when(); } catch (e) { want = false; }
          if (shown(id) !== want) r.bad.push({ frame, id, shown: shown(id), want });
        }
      };
      for (let n = 0; n < 60 && !st.exploding; n++) { st.speed = Math.max(st.speed, cruise); L.update(1 / 60); }
      r.exploded = !!st.exploding;
      if (st.exploding) judge(0);
      for (let k = 1; st.exploding && k < 60 * 12; k++) {
        // one finger on one point per frame, so a faster and a slower pressed together cannot cancel out
        const p = (k === 2 || k === 30) ? r.pts[0] : (k === 3 || k === 31) ? r.pts[1] : null;
        if (p) {
          const s0 = st.speedStep, hit = tapAt(p);
          L.update(1 / 60);
          r.taps.push({ k, hit, before: s0, after: st.speedStep });
        } else if (r.rocketPt && (k === 10 || k === 40)) {
          // a delta against the same frame untapped is not available, so the frame before is the control:
          // what a frame in pieces changes on its own, the tapped frame may change too; nothing more
          const a0 = rocketSnap(); L.update(1 / 60); const a1 = rocketSnap();
          const hit = tapAt(r.rocketPt); L.update(1 / 60); const a2 = rocketSnap(); k++;
          const own = new Set(Object.keys(a1).filter(q => a1[q] !== a0[q]));
          const changed = Object.keys(a2).filter(q => a2[q] !== a1[q] && !own.has(q));
          r.taps.push({ k, hit, changed: changed.map(q => q + ":" + a1[q] + "->" + a2[q]) });
          if (st.exploding) { r.inPieces++; judge(k - 1); }
        } else L.update(1 / 60);
        if (st.exploding) { r.inPieces++; judge(k); }
      }
      r.back = !st.exploding;
      step(30);
      // put back together: the speed control he had before is up again as its when() says, on the step he left it
      r.after = { step: st.speedStep, pair: ["fastBtn", "slowBtn", "speedBtn"].map(id => {
        let want = false; try { want = !!BUTTONS[id].when(); } catch (e) {}
        return { id, shown: shown(id), want };
      }) };
      r.bad = r.bad.slice(0, 8);
      out.push(r);
    }
    return out;
  });
  for (const r of rows) {
    const rocket = r.v === "rocket";
    const moved = r.taps.filter(t => rocket ? t.changed.length > 0 : t.after !== t.before);
    const ran = r.air && r.exploded && r.back && r.inPieces > 20 &&
      (rocket ? !!r.rocketPt && r.taps.length === 2 : r.pts.length > 0 && r.taps.length === 2 * r.pts.length);
    // back together: every speed button agrees with its when(), the ones up before the bang are up again, the step is where it was
    const backOk = !!r.after && r.after.pair.every(q => q.shown === q.want) &&
      r.speedIds.every(id => r.after.pair.find(q => q.id === id).shown) && r.after.step === r.stepBefore;
    const claim = rocket
      ? "every frame of a bang the buttons are what their when() says, a finger on where its throttle sat changes nothing of the rocket, and back together its buttons are as when() says"
      : "every frame of a bang the buttons are what their when() says, a finger on where the speed step sat does not move it, and back together the speed control is up again on the step he left it";
    check(`buttons in pieces (v220, Q-6): ${r.v} -- ${claim}`,
      ran && r.bad.length === 0 && moved.length === 0 && backOk,
      JSON.stringify({ why: r.why, air: r.air, exploded: r.exploded, back: r.back, inPieces: r.inPieces, speedIds: r.speedIds, upBefore: r.upBefore, taps: r.taps, stepBefore: r.stepBefore, after: r.after, bad: r.bad }));
  }
  await page.close();
}
module.exports.bangButtons = bangButtons;

// ---------------------------------------------------------------------------
// (v216) THE CONTROLS ARE MEASURED ONCE A FRAME, AND EVERY ASK GETS THE TRUTH.
//
// `btnControlRects` keeps the first measure of a frame (buttons.js, its WORKING
// RULES); a stale one would put the home arrow, the aim marker or the
// helicopter's ring on a button he has to see. So every ask, from whichever
// caller, is compared with a measure from scratch (`btnControlRectsFresh`; on a
// build without it, the one function there is), through a driven sequence in
// the states he is in: the plane away from home (the home arrow walks its ray,
// the aim marker asks), the helicopter with its ring at the edge, the car,
// portrait and landscape and a rotation between them asked before any frame,
// the picker open and shut, and a button hidden BETWEEN two asks of one frame
// (what any module writing a class mid-frame does). Then the count: from-scratch
// measures per frame, a delta over each update -- at most one, except in the
// frame the probe itself changed a button after the first ask.
// ---------------------------------------------------------------------------
async function measuredOnce({ newPage, check }) {
  const { page } = await newPage(390, 844);
  const run = (fn, arg) => page.evaluate(fn, arg);
  await run(() => {
    const L = window.__lp, st = L.state;
    L.noRender = true; L.api.skipScreens();
    const hasFresh = typeof window.btnControlRectsFresh === "function";
    const fresh = hasFresh ? window.btnControlRectsFresh : window.btnControlRects;
    const ask = window.btnControlRects;
    const key = rs => JSON.stringify(rs.map(r => [r.id, r.left, r.top, r.right, r.bottom, r.bleed]));
    const P = window.__btnProbe = { ask, fresh, hasFresh, phase: "", made: 0, asks: {}, bad: [], over: [], maxMade: 0, frameAsks: 0, stage: null, staged: 0, stageMoved: 0, frameChanges: 0, frameKey: null, remeasured: 0, shared: 0 };
    if (hasFresh) window.btnControlRectsFresh = function () { P.made++; return fresh(); };
    window.btnControlRects = function () {
      if (P.stage && P.frameAsks === 1) {
        const k0 = key(fresh());
        P.stage(); P.stage = null; P.staged++;
        if (key(fresh()) !== k0) P.stageMoved++;   // the staged change really moved a control (else it proves nothing)
      }
      if (!hasFresh) P.made++;
      const a = ask();
      P.frameAsks++;
      P.asks[P.phase] = (P.asks[P.phase] || 0) + 1;
      const f = fresh();                     // the probe's own measure: not counted
      const fk = key(f);
      if (P.frameKey !== null && fk !== P.frameKey) P.frameChanges++;   // the controls really changed since the frame's last ask
      P.frameKey = fk;
      if (key(a) !== key(f) && P.bad.length < 12) P.bad.push(P.phase + ": " + key(a).slice(0, 160) + " vs fresh " + key(f).slice(0, 160));
      return a;
    };
    // one frame, its from-scratch measures counted as a delta
    P.step = (n, phase) => {
      P.phase = phase;
      for (let i = 0; i < n; i++) {
        const m0 = P.made; P.frameAsks = 0; P.frameChanges = 0; P.frameKey = null;
        L.update(1 / 60);
        const d = P.made - m0;
        // one measure a frame, and one more each time the controls REALLY changed between two of its asks
        // (the helicopter asks before the frame's button pass and again after it; the probe's own staging)
        if (d > 1 + P.frameChanges && P.over.length < 12) P.over.push(phase + ": " + d + " measures in one frame (" + P.frameAsks + " asks, " + P.frameChanges + " changes)");
        if (P.frameChanges) P.remeasured++; else { P.maxMade = Math.max(P.maxMade, d); if (P.frameAsks >= 2) P.shared++; }
      }
    };
    // ... and an ask from outside any frame, as a touch handler or the harness makes
    P.outside = (phase) => { P.phase = phase; L.btnObstructions(); };
    // the plane on the runway, then away from home: the throttle goes, the speed pair and the missile come
    L.api.setVehicle("prop"); L.api.placeOnRunway(); P.step(20, "plane on the runway");
    L.api.teleportAirborne(6000, 900, 300, 0); P.step(60, "plane airborne, portrait");
    P.outside("plane airborne, portrait, outside a frame");
  });
  // a rotation, asked before any frame has run in it, then flown
  await page.setViewportSize({ width: 844, height: 390 });
  await run(() => { const P = window.__btnProbe; P.outside("rotated to landscape, before a frame"); P.step(60, "plane airborne, landscape"); });
  await page.setViewportSize({ width: 390, height: 844 });
  await run(() => {
    const L = window.__lp, st = L.state, P = window.__btnProbe;
    P.outside("rotated back to portrait, before a frame");
    P.step(30, "plane airborne, portrait again");
    // a control moved and one hidden between the first ask of a frame and the next -- what any module
    // writing a style or a class mid-frame does (put back after the frame; `transition: none`, or the
    // .08 s ease would still be at its start when the frame asks again, and nothing would have moved)
    const vb = document.getElementById("viewBtn"), gb = document.getElementById("missileBtn");
    for (let k = 0; k < 2; k++) { P.stage = () => { vb.style.transition = "none"; vb.style.transform = "translateX(-60px)"; }; P.step(1, "a button moved mid-frame"); vb.style.transform = ""; P.step(2, "after it"); vb.style.transition = ""; }
    P.stage = () => { gb.style.display = "none"; }; P.step(1, "a button hidden mid-frame"); gb.style.display = ""; P.step(2, "after it");
    // an ANCESTOR's class, not a button's: `body.ejecting .roundBtn` hides every round button, written
    // between two asks of one frame (taken off again after it)
    P.stage = () => { document.body.classList.add("ejecting"); }; P.step(1, "a body class mid-frame");
    document.body.classList.remove("ejecting"); P.outside("body class gone, outside a frame"); P.step(2, "after it");
    // ... and a real eject, started between two asks of a frame (the rescue writes `body.ejecting` itself),
    // flown to its end with an ask after every frame -- the frame it ends in (the class comes off) too
    P.stage = () => { P.ejStarted = ejectStart(); }; P.step(1, "an eject started mid-frame");
    P.outside("an eject started, outside a frame");
    P.ejFrames = 0;
    while (eject.active && P.ejFrames < 60 * 40) {
      P.step(1, "ejecting"); P.ejFrames++;
      P.outside(eject.active ? "ejecting, outside a frame" : "the frame the eject ended in");
    }
    P.ejEnded = !eject.active && !document.body.classList.contains("ejecting");
    P.step(20, "plane, after the eject");
    // the helicopter, its ring out by the screen's edge
    L.api.setVehicle("helicopter"); L.api.placeOnRunway(); L.heliReset();
    st.phase = "AIRBORNE"; st.y += 80;
    P.step(10, "helicopter hovering");
    for (let i = 0; i < 60; i++) { L.heli.target = { x: st.x + 2500 * Math.sin(i / 7), y: st.y, z: st.z + 2500 * Math.cos(i / 7) }; P.step(1, "helicopter, its ring at the edge"); }
    // a press mid-frame: the up button's halo is a held bleed (the next frame's own pass sets it back)
    const hu = document.getElementById("heliUpBtn");
    hu.style.transition = "none"; P.step(2, "helicopter hovering");
    for (let k = 0; k < 2; k++) { P.stage = () => { hu.classList.add("pressed"); }; P.step(1, "a press mid-frame"); P.step(1, "after it"); }
    hu.classList.add("pressed"); P.outside("held, outside a frame");
    hu.classList.remove("pressed"); P.outside("released, outside a frame"); hu.style.transition = "";
    P.step(10, "helicopter, after the press");
    // a control that breathes in CSS (the bucket's button over the water, `homePulse`), the ring asking round it
    // (open water near the fire rig, found rather than assumed)
    let wx = L.FF.rig.x, wz = L.FF.rig.z;
    find: for (let d = 150; d < 3000; d += 50) for (let k = 0; k < 24; k++) {
      const x = L.FF.rig.x + d * Math.cos(k * Math.PI / 12), z = L.FF.rig.z + d * Math.sin(k * Math.PI / 12);
      if (window.terrainEff(x, z) < L.TUNE.waterLevel - 5) { wx = x; wz = z; break find; }
    }
    L.heliReset(); st.phase = "AIRBORNE";
    const bk = document.getElementById("bucketBtn"); let up = 0;
    for (let i = 0; i < 60; i++) {
      st.x = wx; st.z = wz; st.y = L.TUNE.waterLevel + 20; st.speed = 0;
      L.heli.target = { x: st.x + 2500 * Math.sin(i / 5), y: st.y, z: st.z + 2500 * Math.cos(i / 5) };
      P.step(1, "helicopter, the bucket's button pulsing");
      if (getComputedStyle(bk).display !== "none") up++;
    }
    P.bucketUp = up;
    // the rocket climbing to its staging: the stage button breathes (`homePulse`) while the arrows ask
    L.api.setVehicle("rocket"); L.api.placeOnRunway(); L.api.setThrottle(true);
    for (let i = 0; i < 60 * 25 && !L.rocketCanDrop(); i++) P.step(1, "rocket climbing");
    const sb = document.getElementById("stageBtn"); let sbUp = 0;
    for (let i = 0; i < 30; i++) { P.step(1, "rocket, the stage button pulsing"); if (getComputedStyle(sb).display !== "none") sbUp++; }
    L.api.setThrottle(false); P.stageUp = sbUp;
    // the car, and its horn held
    L.api.setVehicle("car"); L.api.placeOnRunway(); P.step(30, "car on the road");
    L.carHornPress(); P.step(10, "car honking"); P.outside("car honking, outside a frame"); L.carHornRelease(); P.step(5, "car, horn released");
    // the picker, open and shut
    L.openPickerAnywhere(); P.outside("picker open, before a frame"); P.step(20, "picker open");
    L.api.skipScreens(); P.outside("picker shut, before a frame"); P.step(20, "picker shut");
  });
  await page.setViewportSize({ width: 844, height: 390 });
  await run(() => { const P = window.__btnProbe; P.outside("rotated, in the car"); P.step(20, "car, landscape"); });
  const r = await run(() => {
    const P = window.__btnProbe;
    window.btnControlRects = P.ask;
    if (P.hasFresh) window.btnControlRectsFresh = P.fresh;
    return { hasFresh: P.hasFresh, asks: P.asks, bad: P.bad, over: P.over, maxMade: P.maxMade, remeasured: P.remeasured, staged: P.staged, stageMoved: P.stageMoved, bucketUp: P.bucketUp, shared: P.shared, ejStarted: P.ejStarted, ejEnded: P.ejEnded, ejFrames: P.ejFrames, stageUp: P.stageUp };
  });
  const need = ["plane airborne, portrait", "plane airborne, landscape", "rotated to landscape, before a frame", "rotated back to portrait, before a frame",
                "a button moved mid-frame", "a button hidden mid-frame", "a press mid-frame", "held, outside a frame", "helicopter, its ring at the edge", "helicopter, the bucket's button pulsing", "car honking, outside a frame",
                "a body class mid-frame", "body class gone, outside a frame", "an eject started mid-frame", "an eject started, outside a frame", "ejecting, outside a frame", "the frame the eject ended in",
                "rocket, the stage button pulsing",
                "picker open, before a frame", "picker shut, before a frame", "rotated, in the car"];
  const unasked = need.filter(p => !r.asks[p]);
  check("buttons (v216): every ask for the controls' rectangles gets what a fresh measure says -- plane, helicopter, car; portrait, landscape and a rotation; the picker; a button moved, hidden and pressed mid-frame",
    r.bad.length === 0 && unasked.length === 0 && r.staged === 7 && r.stageMoved === 7 && r.bucketUp > 30 &&
    r.ejStarted === true && r.ejEnded && r.ejFrames > 60 && r.stageUp > 20,
    JSON.stringify({ bad: r.bad, unasked, staged: r.staged, stageMoved: r.stageMoved, bucketUp: r.bucketUp, eject: { started: r.ejStarted, ended: r.ejEnded, frames: r.ejFrames }, stageUp: r.stageUp, asks: r.asks }));
  check("buttons (v216): the controls are measured from scratch at most once a frame -- the home arrow, the aim marker and the helicopter's ring share one measure",
    // (and the sharing was really tested: frames where nothing changed and two or more asks shared the measure)
    r.over.length === 0 && r.maxMade === 1 && r.shared >= 200,
    JSON.stringify({ maxMade: r.maxMade, over: r.over, remeasured: r.remeasured, shared: r.shared, hasFresh: r.hasFresh }));
  await page.close();
}
module.exports.measuredOnce = measuredOnce;   // (run alone: a module that requires this one)
