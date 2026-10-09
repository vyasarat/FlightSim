"use strict";
// ---------------------------------------------------------------------------
// RIDE THE ROCKET SLED (v144), ridden the way he rides it: the card picked,
// go pressed (the throttle, or a finger on the screen), and nothing else. Portrait,
// one full ride in EACH camera view. Every scenario counts bangs frame by frame
// (state.exploding transitions) and reads every flag as a DELTA.
//
//   a. the card: there, visible, no text; the picker has 15 cards (13 in v144; the crane's joined it in v145, the Cybertruck's in v146);
//   b. picked, he is on the sled at the start tower, the set-piece's own sled hidden,
//      and the set-piece does NOT arm off his pointing (only his go starts it);
//   c. go: the lamps and 3-2-1, then the run -- ~120 m/s, on the rail;
//   d. the wall's bricks fly, the three chutes, he stops before the rail's end,
//      comes home to the tower and the wall rebuilds;
//   e. no bang anywhere, in either view;
//   f. drag up during the run is the burst (a bigger flame, a roar), and a steer
//      moves him 0 m off the rail;
//   g. leaving -- mid-run, the way he can: the menu button, the picker, the car's
//      card -- puts the set-piece back exactly as a fresh reset, lets go of a held
//      go button, and it still arms and runs for the car as before;
//   k. no other set-piece's countdown starts while he rides, and the bed under the
//      roar is the wind, never the apron; the burst never changes the run;
//   h. no text in the DOM while he rides;
//   i. the seat is low on the nose looking down the rail at the wall; the chase has
//      the sled and the wall both in frame;
//   j. a relaunch brings the sled card back, lit.
// On v143 there is no such card or vehicle: every check FAILs, none throws.
//
// Alone: node scripts/run_module.js sledride_checks --vp=768x1024
// ---------------------------------------------------------------------------

module.exports = async function sledRideChecks({ newPage, check }) {
  const J = x => JSON.stringify(x);
  const L_WALLAT = 400;     // TUNE.rocketSled.wallAt, the wall's distance down the rail (the rings stand on its two faces)
  const { page, errors } = await newPage(768, 1024);

  // ---- a. the card, and the picker's count
  const card = await page.evaluate(() => {
    const sv = document.getElementById("screenVehicle");
    const was = sv.classList.contains("hiddenS");
    sv.classList.remove("hiddenS");
    const c = document.querySelector('.vehCard[data-v="sled"]');
    const out = { exists: !!c };
    if (c) {
      const r = c.getBoundingClientRect();
      const words = [c, ...c.querySelectorAll("*")].filter(e => ["aria-label", "title", "alt"].some(a => e.hasAttribute(a))).map(e => e.tagName);
      out.visible = !c.classList.contains("hiddenS") && r.width > 100 && r.height > 100;
      out.text = c.textContent.trim();
      out.words = words;
      out.svgText = c.querySelectorAll("text, tspan, foreignObject").length;
      out.icon = !!c.querySelector("svg path, svg rect, svg circle");
    }
    out.cards = [...sv.querySelectorAll(".vehCard")].filter(e => !e.classList.contains("hiddenS") && e.getBoundingClientRect().width > 10).length;
    if (was) sv.classList.add("hiddenS");
    return out;
  });
  check("sled ride: a card in the picker, an icon only (no text, no label words), and the picker now has 15 cards (v145: the crane's card joined it; v146: the Cybertruck's -- deliberate counts)",
    card.exists && card.visible && card.text === "" && card.words.length === 0 && card.svgText === 0 && card.icon && card.cards === 15, J(card));

  // ---- b-f, h, i. one full ride per view
  // burstAt: seconds into the run to drag up (both rides burst: the chase early, the seat
  // late, after the 2 s probe); steer: a full steer each way after the burst (chase ride)
  const ride = (chase, how, burstAt, steer) => page.evaluate(([chase, how, burstAt, steer]) => {
    const out = { bangs: 0, err: null };
    try {
      const L = window.__lp, S = L.state, sled = L.sled, T = L.TUNE.rocketSled;
      L.noRender = true;
      // every frame after go: the field of view and the punch, for the seat-against-chase comparison
      out.fovs = null; out.maxPunch = 0;
      const step = n => { for (let i = 0; i < n; i++) { const was = S.exploding; L.update(1 / 60); if (S.exploding && !was) out.bangs++;
        if (out.fovs) { out.fovs.push(+L.camera.fov.toFixed(4)); out.maxPunch = Math.max(out.maxPunch, L.feel ? L.feel.punch : 0); }
        // the run's own clock at 2 s, taken on the frame itself (inner steps included)
        if (out.probe === null && L.sled.phase === "run" && L.sled.t >= 2) out.probe = { t: L.sled.t, v: L.sled.v, d: L.sled.d }; } };
      const vis = id => { const e = document.getElementById(id); return !!e && !e.classList.contains("hidden") && getComputedStyle(e).display !== "none"; };
      const dirX = sled.dirX, dirZ = sled.dirZ;
      const lat = (x, z) => (x - T.n[0]) * dirZ - (z - T.n[1]) * dirX;     // +west of the rail's line
      const along = (x, z) => (x - T.n[0]) * dirX + (z - T.n[1]) * dirZ;
      const P = new THREE.Vector3();
      const inView = (x, y, z, m) => { L.camera.updateMatrixWorld(); P.set(x, y, z).project(L.camera); return P.z < 1 && P.z > -1 && Math.abs(P.x) < (m || 0.95) && Math.abs(P.y) < (m || 0.95); };
      const ndc = (x, y, z) => { L.camera.updateMatrixWorld(); P.set(x, y, z).project(L.camera); return [+P.x.toFixed(2), +P.y.toFixed(2), +P.z.toFixed(3)]; };
      const lamps = () => sled.lamps.map((l, i) => l.glow.material.opacity > 0.5 ? "RAG"[i] : "").join("");
      const noText = () => {
        const bad = [];
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (w.nextNode()) {
          const n = w.currentNode, p = n.parentElement && n.parentElement.tagName;
          if (p === "SCRIPT" || p === "STYLE") continue;
          const t = n.nodeValue.trim();
          if (t && !/^[0-9]+$/.test(t)) bad.push(t.slice(0, 30));
        }
        return bad;
      };
      L.sledReset();
      L.api.setThrottle(false); L.api.clearStick();
      L.api.setVehicle("sled"); L.api.spawnAt(0, 0); L.api.skipScreens(); L.api.setView(chase);
      step(30);
      const f0 = { ...L.flags };
      const d = k => (L.flags[k] || 0) - (f0[k] || 0);
      const n0 = { x: T.n[0], z: T.n[1] };

      // ---- b. on the sled at the start tower; the set-piece's own sled hidden
      out.spawn = {
        key: S.vehicleKey, kind: L.vehKind(), d: +sled.d.toFixed(2), phase: sled.phase,
        toStart: +Math.hypot(S.x - n0.x, S.z - n0.z).toFixed(2), toSled: +Math.hypot(S.x - sled.x, S.z - sled.z).toFixed(2),
        ownHidden: sled.sledG.visible === false, modelShown: !!L.vehicleModel && L.vehicleModel.visible,
        parked: L.vehParked(), solid: L.vehSolid(),
        bed: L.audio && L.audio.bedName ? L.audio.bedName() : null,
        // the target: where his nose will hit -- on the rail's line, at the wall -- while he rides
        reticles: sled.reticles.map(r => ({ lat: +lat(r.position.x, r.position.z).toFixed(2), at: +along(r.position.x, r.position.z).toFixed(1) })),
        buttons: { go: vis("throttleBtn"), picker: vis("vehBtn"), view: vis("viewBtn"), menu: vis("menuBtn"), eject: vis("ejectBtn"),
                   speed: vis("fastBtn") || vis("slowBtn") || vis("speedBtn"), horn: vis("hornBtn"), skip: vis("skipBtn") },
        clashes: L.btnSlotClashes(),
      };
      // ---- i. the camera at the start
      const w = L.sledWallWorld(), wy = T.railY + T.wallRows * T.brick[1] / 2;
      const cp = L.camera.position;
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(L.camera.quaternion);
      out.cam = {
        chase, aboveSled: +(cp.y - sled.y).toFixed(1), ahead: +(along(cp.x, cp.z) - sled.d).toFixed(1), lat: +lat(cp.x, cp.z).toFixed(1),
        lookDown: +(fwd.x * dirX + fwd.z * dirZ).toFixed(3),
        wall: ndc(w.x, wy, w.z), wallIn: inView(w.x, wy, w.z),
        sled: ndc(sled.x, sled.y + 5, sled.z), sledIn: inView(sled.x, sled.y + 5, sled.z),
      };
      // ---- b. pointing at the wall from the start tower, nothing pressed: it does NOT arm
      step(60 * 3);
      out.quiet = { countdowns: d("sledCountdowns"), phase: sled.phase };
      // ---- h. no text while he rides
      out.text = noText();

      // ---- c. go: pressed for a third of a second, then let go -- it goes through anyway
      const press = on => { if (how === "throttle") L.api.setThrottle(on); else if (on) L.api.setStick(0, 0); else L.api.clearStick(); };
      const nums = []; let lastN = "", seq = [], lastL = "";
      let maxV = 0, maxLat = 0, maxAir = 0, maxRise = 0, stopD = null, railEnd = sled.len, frames = 0, homeAt = null;
      let pressedFor = 0;
      const big = document.getElementById("bigNum");
      out.burst = null; out.steer = null; out.chutesIn = null;
      let runT = 0, chuteT = 0;
      out.probe = null; out.smashD = null;
      out.fovs = []; out.ev = { launch: null, smash: null, burst: null };
      const s0 = L.flags.sledSmashes || 0;
      for (; frames < 60 * 90; frames++) {
        if (pressedFor < 20) { press(true); pressedFor++; if (pressedFor === 20) press(false); }
        step(1);
        if (S.exploding) continue;
        const n = big.classList.contains("on") ? big.textContent.trim() : "";
        if (n && n !== lastN) nums.push(n);
        lastN = n;
        const lp = lamps();
        if (lp !== lastL) { seq.push(lp || "-"); lastL = lp; }
        maxV = Math.max(maxV, S.speed);
        maxLat = Math.max(maxLat, Math.abs(lat(S.x, S.z)), Math.hypot(S.x - sled.x, S.z - sled.z));
        maxAir = Math.max(maxAir, sled.bricks.filter(b => b.mode !== "wall").length);
        for (const b of sled.bricks) maxRise = Math.max(maxRise, b.y - b.slot.y);
        if (sled.phase === "run") runT += 1 / 60;
        if (out.ev.launch === null && sled.phase === "run") out.ev.launch = out.fovs.length - 1;
        if (out.ev.smash === null && (L.flags.sledSmashes || 0) > s0) out.ev.smash = out.fovs.length - 1;
        // ---- f. drag up during the run: the burst; then (chase ride) a full steer each way
        if (burstAt !== null && sled.phase === "run" && out.burst === null && runT > burstAt) {
          const k0 = L.sr ? L.sr.flameK : null, g0 = L.sr ? L.sr.roar : null, b0 = L.flags.srBursts || 0;
          const plain = L.srFlameEnds ? L.srFlameEnds() : null;
          out.ev.burst = out.fovs.length;           // the next frame is the first with the drag up
          L.api.setStick(0, 1); step(20);
          const bf = L.srFlameEnds ? L.srFlameEnds() : null;
          out.burst = { k0, g0, k1: L.sr ? +L.sr.flameK.toFixed(2) : null, g1: L.sr ? +L.sr.roar.toFixed(3) : null,
                        bursts: (L.flags.srBursts || 0) - b0, flame: L.vehicleModel && L.vehicleModel.userData.srFlame ? L.vehicleModel.userData.srFlame.visible : null,
                        plainReach: plain ? +plain.reach.toFixed(2) : null, plainGap: plain ? +plain.rootGap.toFixed(3) : null,
                        burstReach: bf ? +bf.reach.toFixed(2) : null, burstGap: bf ? +bf.rootGap.toFixed(3) : null };
          L.api.clearStick(); step(1);
        }
        if (steer && out.burst !== null && out.steer === null) {
          const x0 = S.x, z0 = S.z, l0 = lat(S.x, S.z);
          L.api.setStick(1, 0); step(15); const lR = lat(S.x, S.z);
          L.api.setStick(-1, 0); step(15); const lL = lat(S.x, S.z);
          L.api.clearStick();
          out.steer = { l0: +l0.toFixed(3), lR: +lR.toFixed(3), lL: +lL.toFixed(3), offRail: +Math.max(Math.abs(lR), Math.abs(lL), Math.abs(l0)).toFixed(3) };
          // a four-year-old's wobble: the drag up wandering 0.30-0.45 for 2 s, across the
          // burst's 0.35 line again and again -- one burst, one whoosh (it ends under 0.2)
          const w0 = L.flags.srBursts || 0;
          let wf = 0;
          for (; wf < 120 && sled.phase === "run"; wf++) { L.api.setStick(0, 0.375 + 0.075 * Math.sin(wf / 60 * 2 * Math.PI * 3)); step(1); }
          L.api.clearStick(); step(1);
          out.wobble = { bursts: (L.flags.srBursts || 0) - w0, secs: +(wf / 60).toFixed(2), stillRun: sled.phase === "run" };
        }
        // the run's own clock: where and how fast at 2 s, and where it smashed -- the
        // same in both rides (one with the burst, one without) or the burst is not a show
        if (out.smashD === null && (L.flags.sledSmashes || 0) > s0) out.smashD = sled.d;
        if (sled.chuteOut) chuteT += 1 / 60;
        if (chase && out.chutesIn === null && chuteT > 1.5) {
          sled.sledG.updateMatrixWorld(true);
          const V = new THREE.Vector3(), C = L.camera.position.clone();
          out.chutesIn = sled.chutes.map(c => { c.getWorldPosition(V); return inView(V.x, V.y, V.z, 1); }).filter(Boolean).length;
          // the sled's middle in frame, and the line from the camera to it clear of every canopy (a 10 m disc)
          const M = new THREE.Vector3(sled.x, sled.y + 1.9 * T.size, sled.z), CM = M.clone().sub(C), L2 = CM.lengthSq();
          const gaps = sled.chutes.map(c => { c.getWorldPosition(V); const u = Math.max(0, Math.min(1, V.clone().sub(C).dot(CM) / L2));
                                               return +V.distanceTo(C.clone().addScaledVector(CM, u)).toFixed(1); });
          // ... and no flying brick nearer than the sled inside its box on the screen (nose to tail)
          const nose = ndc(sled.x + dirX * 10 * T.size, M.y, sled.z + dirZ * 10 * T.size), tail = ndc(sled.x - dirX * 7 * T.size, M.y, sled.z - dirZ * 7 * T.size);
          const box = { x0: Math.min(nose[0], tail[0]) - 0.03, x1: Math.max(nose[0], tail[0]) + 0.03, y0: Math.min(nose[1], tail[1]) - 0.04, y1: Math.max(nose[1], tail[1]) + 0.04 };
          const dM = Math.sqrt(L2);
          let inBox = 0;
          for (const b of sled.bricks) {
            if (b.mode === "wall" || Math.hypot(b.x - C.x, b.y - C.y, b.z - C.z) > dM) continue;
            const q = ndc(b.x, b.y, b.z);
            if (q[2] < 1 && q[0] > box.x0 && q[0] < box.x1 && q[1] > box.y0 && q[1] < box.y1) inBox++;
          }
          out.chuteView = { sledIn: inView(M.x, M.y, M.z, 0.95), canopyGaps: gaps, bricksOnSled: inBox, sideK: L.sr ? +L.sr.sideK.toFixed(2) : null,
                            camLat: +lat(C.x, C.z).toFixed(1) };
        }
        if (sled.phase === "rest" && stopD === null) stopD = +sled.d.toFixed(0);
        if (d("sledHomes") > 0 && sled.phase === "armed") { homeAt = frames; break; }
      }
      out.run = {
        how, countdowns: d("sledCountdowns"), runs: d("sledRuns"), nums: nums.join(""), lamps: seq.join(","),
        maxV: +maxV.toFixed(1), maxLat: +maxLat.toFixed(3), smashes: d("sledSmashes"), airBricks: maxAir, rise: +maxRise.toFixed(1),
        chutes: d("sledChutes"), punches: d("srLaunchPunches"), smashPunches: d("srSmashPunches"), stopD, railEnd: +railEnd.toFixed(0), rebuilds: d("sledRebuilds"), homes: d("sledHomes"),
        secs: +(frames / 60).toFixed(1), homeAt,
        home: { d: +sled.d.toFixed(2), toStart: +Math.hypot(S.x - n0.x, S.z - n0.z).toFixed(2), slotErr: +L.sledSlotError().toFixed(4), wallSolid: L.sledWallSolid(), phase: sled.phase },
      };
      // ---- home, nothing pressed: it waits for his next go (no run starts by itself)
      const c1 = L.flags.sledCountdowns || 0;
      step(60 * 3);
      out.waits = { countdowns: (L.flags.sledCountdowns || 0) - c1, phase: sled.phase, go: vis("throttleBtn") };
      out.bangsTotal = out.bangs;
    } catch (e) { out.err = String(e && e.stack || e).slice(0, 300); }
    return out;
  }, [chase, how, burstAt, steer]);

  const rides = [await ride(true, "throttle", 0.6, true), await ride(false, "touch", 2.2, false)];
  for (const r of rides) {
    const view = r.cam && !r.cam.chase ? "seat" : "chase";
    const tag = `sled ride (${view}, go by ${r.run ? r.run.how : "?"})`;
    const sp = r.spawn || {}, cam = r.cam || {}, run = r.run || {}, home = run.home || {};
    // he really rode it (the sled kind), and the ride really ran the whole way home: the
    // checks about a ride ask this first, so none of them can pass for a ride that never happened
    const rode = sp.kind === "sled" && sp.key === "sled";
    const ranHome = rode && run.runs === 1 && run.smashes === 1 && run.homes === 1;
    check(`${tag}: picked, he is on the sled at the start tower (rail start), the new kind, the set-piece's own sled hidden and his drawn`,
      !r.err && sp.key === "sled" && sp.kind === "sled" && sp.d < 0.01 && sp.toStart < 1 && sp.toSled < 0.5 && sp.ownHidden && sp.modelShown && sp.phase === "armed", J({ err: r.err, ...sp }));
    check(`${tag}: the buttons -- go, the picker, the view and the menu; no speed steps, eject, horn or go-home arrow; no slot clash`,
      !r.err && sp.buttons && sp.buttons.go && sp.buttons.picker && sp.buttons.view && sp.buttons.menu && !sp.buttons.eject && !sp.buttons.speed && !sp.buttons.horn && !sp.buttons.skip && sp.clashes.length === 0, J(sp.buttons || r.err));
    check(`${tag}: the target on the wall is where his nose will hit -- both rings on the rail's line at the wall (the wall itself stands west of it)`,
      !r.err && Array.isArray(sp.reticles) && sp.reticles.length === 2 && sp.reticles.every(x => Math.abs(x.lat) < 0.01 && Math.abs(x.at - L_WALLAT) < 6), J({ reticles: sp.reticles, err: r.err }));
    check(`${tag}: pointing at the wall from the tower with nothing pressed, the set-piece does not arm -- only his go starts it`,
      !r.err && rode && r.quiet && r.quiet.countdowns === 0 && r.quiet.phase === "armed", J({ rode, ...(r.quiet || {}), err: r.err }));
    check(`${tag}: the bed under the roar is the rushing air (the wind), never the airport's apron`, !r.err && sp.bed === "wind", J({ bed: sp.bed, err: r.err }));
    check(`${tag}: no text in the page while he rides (numerals only)`, !r.err && rode && Array.isArray(r.text) && r.text.length === 0, J({ rode, text: r.text, err: r.err }));
    if (view === "seat") {
      check(`${tag}: the seat is low on the nose, looking down the rail, the wall in front of him at the start`,
        !r.err && cam.aboveSled > 3 && cam.aboveSled < 16 && cam.ahead > 5 && Math.abs(cam.lat) < 2 && cam.lookDown > 0.95 && cam.wallIn, J(cam));
    } else {
      check(`${tag}: the chase is behind and above, with the sled AND the wall both in frame at the start`,
        !r.err && cam.ahead < -20 && cam.aboveSled > 10 && cam.lookDown > 0.8 && cam.wallIn && cam.sledIn, J(cam));
    }
    check(`${tag}: go -- the start tower's lamps red, amber, then green under 3-2-1, then the run (go let go after a third of a second: it goes through anyway)`,
      !r.err && run.countdowns === 1 && run.runs === 1 && run.nums === "321" && /R,RA,G/.test(run.lamps || ""), J({ err: r.err, nums: run.nums, lamps: run.lamps, countdowns: run.countdowns, runs: run.runs }));
    check(`${tag}: he goes about 120 m/s and stays on the rail the whole ride (0 m off its line, on the sled)`,
      !r.err && run.maxV >= 110 && run.maxLat < 0.5, J({ maxV: run.maxV, maxLat: run.maxLat }));
    check(`${tag}: through the wall -- the bricks go airborne, the three chutes open, he stops before the rail's end`,
      !r.err && run.smashes === 1 && run.airBricks >= 40 && run.rise > 8 && run.chutes === 1 && run.stopD !== null && run.stopD < run.railEnd - 5, J({ smashes: run.smashes, airBricks: run.airBricks, rise: run.rise, chutes: run.chutes, stopD: run.stopD, railEnd: run.railEnd }));
    check(`${tag}: he rolls home to the start tower and the wall flies back together, every brick in its slot, solid again`,
      !r.err && run.homes === 1 && run.rebuilds === 1 && home.d < 0.01 && home.toStart < 1 && home.slotErr < 0.01 && home.wallSolid && home.phase === "armed", J({ homes: run.homes, rebuilds: run.rebuilds, secs: run.secs, ...home }));
    check(`${tag}: home, nothing pressed, it waits for his next go (the go button is back)`,
      !r.err && ranHome && r.waits && r.waits.countdowns === 0 && r.waits.phase === "armed" && r.waits.go, J({ ranHome, ...(r.waits || {}), err: r.err }));
    check(`${tag}: the launch and the smash each kick the field of view once from the seat, and never from the chase (no shake anywhere)`,
      !r.err && ranHome && run.punches === (view === "seat" ? 1 : 0) && run.smashPunches === (view === "seat" ? 1 : 0), J({ ranHome, punches: run.punches, smashPunches: run.smashPunches, err: r.err }));
    check(`${tag}: no bang anywhere in the ride`, !r.err && ranHome && r.bangs === 0, J({ ranHome, bangs: r.bangs, err: r.err }));
    {
      const bb = r.burst || {};
      check(`${tag}: drag up during the run is the burst -- a bigger flame and a roar (cosmetic: the run's speed is the set-piece's)`,
        !r.err && bb.bursts === 1 && bb.k0 !== null && bb.k0 < 1.05 && bb.k1 >= 1.4 && bb.g0 < 0.01 && bb.g1 > 0.05 && bb.flame === true, J({ err: r.err, ...bb }));
      check(`${tag}: the burst flame grows backward from the nozzles -- its root stays within 1 m of them, and its tip reaches further back than the plain run flame's`,
        !r.err && bb.burstGap !== null && bb.burstGap !== undefined && bb.burstGap < 1 && bb.plainGap < 1 && bb.burstReach > bb.plainReach + 1,
        J({ err: r.err, plainGap: bb.plainGap, burstGap: bb.burstGap, plainReach: bb.plainReach, burstReach: bb.burstReach }));
    }
    if (view === "chase") {
      check(`${tag}: a full steer either way moves him 0 m off the rail`, !r.err && !!r.steer && r.steer.offRail < 0.01, J(r.steer || r.err));
      check(`${tag}: a finger wobbling between 0.30 and 0.45 up for 2 s of the run is exactly one burst (one whoosh) -- it ends only under the release`,
        !r.err && !!r.wobble && r.wobble.bursts === 1 && r.wobble.secs >= 1.99, J(r.wobble || r.err));
      const cv = r.chuteView || {};
      check(`${tag}: chutes out, his camera has eased out to the east (the road's side, away from the bricks): all three chutes and the sled's middle in frame, the line to the sled clear of every canopy, no flying brick over the sled`,
        !r.err && r.chutesIn === 3 && cv.sledIn && Array.isArray(cv.canopyGaps) && cv.canopyGaps.every(g => g > 10) && cv.bricksOnSled === 0 && cv.camLat < -30,
        J({ err: r.err, chutesIn: r.chutesIn, ...cv }));
    }
  }

  // ---- f. the burst is a show: the chase ride dragged up (and steered) early in the
  // run, the seat ride only after 2.2 s; at 2 s into the run the sled is in the same
  // place at the same speed, and it smashed at the same spot
  {
    const [a, b] = rides, pa = a.probe, pb = b.probe;
    const same = !!(pa && pb) && Math.abs(pa.t - pb.t) < 1e-9 && Math.abs(pa.v - pb.v) < 1e-9 && Math.abs(pa.d - pb.d) < 1e-9 &&
      a.smashD !== null && b.smashD !== null && Math.abs(a.smashD - b.smashD) < 1e-9;
    check("sled ride: the burst is cosmetic -- at 2 s into the run the sled's speed and place are identical with a drag up and without, and it smashes at the same spot",
      same && !!a.burst && a.burst.bursts === 1, J({ withBurst: pa, without: pb, smashWith: a.smashD, smashWithout: b.smashD, bursts: a.burst && a.burst.bursts }));
  }

  // ---- the seat's kicks, measured on the CAMERA: the seat ride's field of view against
  // the chase ride's, frame for frame from go (the two runs are the same run, so the gap
  // is the kick alone), as a DELTA: the gap's rise over the 0.5 s after each event above
  // the gap the frame before it. A full cameraPunch (fovPunchMax 9, punchDecay 2.6,
  // fovRate 2.2) peaks at ~3.0 degrees ~0.42 s on. A burst kicks nothing (from the seat
  // the burst is its sound).
  {
    const [c, st] = rides;
    const gap = i => (st.fovs && c.fovs && st.fovs[i] !== undefined && c.fovs[i] !== undefined) ? st.fovs[i] - c.fovs[i] : null;
    const win = (i0) => { if (i0 === null || i0 === undefined || gap(i0 - 1) === null) return null; const g0 = gap(i0 - 1); let m = -1e9;
      for (let k = 0; k <= 30; k++) if (gap(i0 + k) !== null) m = Math.max(m, gap(i0 + k) - g0); return +m.toFixed(2); };
    const ev = st.ev || {}, evc = c.ev || {};
    const kicks = { launch: win(ev.launch), smash: win(ev.smash), burst: win(ev.burst), aligned: ev.launch === evc.launch && ev.smash === evc.smash,
                    chaseMaxPunch: c.maxPunch, seatMaxPunch: st.maxPunch };
    check("sled ride: from the seat the camera really widens -- over 2.5 degrees within 0.5 s of the launch and of the smash, each above the gap just before it -- a burst kicks nothing, and the chase camera never gets a kick",
      !c.err && !st.err && kicks.aligned && kicks.launch > 2.5 && kicks.smash > 2.5 && kicks.burst !== null && kicks.burst < 0.3 && kicks.chaseMaxPunch === 0 && kicks.seatMaxPunch > 0, J(kicks));
  }

  // ---- k. riding it, no other set-piece's countdown starts: the launch site's arming
  // stretched to the whole map and every direction -- nothing while he rides; and the
  // same stretch from the plane on the runway does arm it (so the stretch is real)
  const quiet = await page.evaluate(() => {
    const out = { err: null };
    const L = window.__lp, S = L.state, LS = L.TUNE.launchSite;
    const keep = { armR: LS.armR, innerR: LS.innerR, coneDeg: LS.coneDeg };
    try {
      L.api.setThrottle(false); L.api.clearStick();
      L.lsReset(); L.sledReset();
      L.api.setVehicle("sled"); L.api.spawnAt(0, 0); L.api.skipScreens();
      for (let i = 0; i < 10; i++) L.update(1 / 60);
      LS.armR = 1e6; LS.innerR = 0; LS.coneDeg = 179;
      let c0 = L.flags.lsCountdowns || 0;
      for (let i = 0; i < 120; i++) L.update(1 / 60);
      out.riding = { kind: L.vehKind(), countdowns: (L.flags.lsCountdowns || 0) - c0, phase: L.lsite.phase };
      L.api.setVehicle("prop"); L.api.placeOnRunway();
      c0 = L.flags.lsCountdowns || 0;
      for (let i = 0; i < 120; i++) L.update(1 / 60);
      out.plane = { countdowns: (L.flags.lsCountdowns || 0) - c0 };
    } catch (e) { out.err = String(e && e.stack || e).slice(0, 300); }
    finally { Object.assign(LS, keep); try { L.lsReset(); L.update(1 / 60); } catch (e) {} }
    return out;
  });
  check("sled ride: while he rides no other set-piece starts a countdown -- the launch site armed from anywhere stays quiet for him, and arms for the plane",
    !quiet.err && quiet.riding && quiet.riding.kind === "sled" && quiet.riding.countdowns === 0 && quiet.plane && quiet.plane.countdowns >= 1, J(quiet));

  // ---- g. leaving mid-run, the way he can: the menu button (the picker button is
  // gone mid-run), the car's card, a direction. The set-piece back exactly as a fresh
  // reset; the go button's hold let go when the run started; then it arms and runs
  // for the car as it always has
  const midRun = await page.evaluate(() => {
    const out = { err: null };
    try {
      const L = window.__lp, S = L.state, sled = L.sled;
      L.noRender = true;
      L.api.setThrottle(false); L.api.clearStick(); L.sledReset();
      L.api.setVehicle("sled"); L.api.spawnAt(0, 0); L.api.skipScreens();
      for (let i = 0; i < 10; i++) L.update(1 / 60);
      // the go button pressed and HELD -- never let go by the test
      L.api.setThrottle(true);
      for (let i = 0; i < 60 * 12 && !(sled.phase === "run" && sled.d > 120); i++) L.update(1 / 60);
      out.phase = sled.phase; out.d = +sled.d.toFixed(0); out.ownHidden = sled.sledG.visible === false;
      out.held = S.throttleHeld; out.pressedLook = document.getElementById("throttleBtn").classList.contains("pressed");
      out.menu = !document.getElementById("menuBtn").classList.contains("hidden");
      out.picker = !document.getElementById("vehBtn").classList.contains("hidden");
    } catch (e) { out.err = String(e && e.stack || e).slice(0, 300); }
    return out;
  });
  let tapped = null;
  try {
    await page.click("#menuBtn", { timeout: 5000 });
    await page.click('.vehCard[data-v="car"]', { timeout: 5000 });
    await page.click('[data-d="0"]', { timeout: 5000 });
    tapped = true;
  } catch (e) { tapped = String(e && e.message || e).slice(0, 160); }
  const leave = await page.evaluate(() => {
    const out = { bangs: 0, err: null };
    try {
      const L = window.__lp, S = L.state, sled = L.sled, T = L.TUNE.rocketSled;
      const step = n => { for (let i = 0; i < n; i++) { const was = S.exploding; L.update(1 / 60); if (S.exploding && !was) out.bangs++; } };
      const snap = () => ({
        phase: sled.phase, d: +sled.d.toFixed(3), v: +sled.v.toFixed(3), smashed: sled.smashed, chuteOut: sled.chuteOut, rebuilding: sled.rebuilding,
        counting: !!sled.counting, flame: sled.flame.visible, chutes: sled.chutes.map(c => c.visible).join(), walls: sled.bricks.filter(b => b.mode === "wall").length,
        slotErr: +L.sledSlotError().toFixed(4), wallSolid: L.sledWallSolid(), lamps: sled.lamps.map(l => l.glow.material.opacity).join(),
        puffs: sled.puffMesh.count, noSolid: !!sled.brickMesh.userData.noSolid,
        cap: sled.solid.cap.a.map(v => +v.toFixed(2)).concat(sled.solid.cap.b.map(v => +v.toFixed(2))).join(),
        // the target rings, metres west of the rail's line: back on the wall's middle (wallShift x brick) when he has left
        retLat: sled.reticles.map(r => +(((r.position.x - T.n[0]) * sled.dirZ - (r.position.z - T.n[1]) * sled.dirX)).toFixed(2)).join(),
        retY: sled.reticles.map(r => +r.position.y.toFixed(2)).join(),
        // each ring against the position it was built at, all three axes
        retHomeErr: Math.max(...sled.reticles.map(r => r.userData.home ? r.position.distanceTo(r.userData.home) : 1e9)),
      });
      out.retHome = T.wallShift * T.brick[0];
      // (he has tapped the menu button, the car and a direction: he is in the car)
      out.key = S.vehicleKey; out.menuOpen = L.menuOpen();
      out.heldAfter = S.throttleHeld;
      step(5);
      // The standing wall's solid is its brick mesh (rocketsled.js `ws.mesh = bm`),
      // and the set-piece draws that mesh only within fogFar x 1.45 -- a wall that is
      // not drawn is not a wall (isSolidHidden), as for every building. So compare
      // like with like: far away (at the airport, where the car is) and near.
      out.farAfter = L.sledWallSolid();
      out.total = sled.bricks.length;
      // the car brought near the start tower, behind it and facing away (so it does
      // not set the sled off): the set-piece's own sled and its wall are drawn again
      const near = () => { S.x = sled.x + 150; S.z = sled.z + 150; S.heading = Math.PI; S.speed = 0; step(2); };
      near();
      out.after = snap();
      out.after.ownShown = sled.sledG.visible === true;
      L.sledReset();
      near();
      out.fresh = snap();
      // ... and the same far-away answer from a fresh reset nobody has ridden
      L.api.spawnAt(0, 0); step(5);
      out.farFresh = L.sledWallSolid();

      // ... and the set-piece still arms and runs for the car: southbound out of the
      // tunnel, hands-off (rocketsled_checks' own run)
      L.spdReset();
      const sStart = L.hwyNearest(10, -1500).s;
      const q = L.hwySampleAt(sStart), off = L.HW.medianW / 2 + L.HW.laneW * 0.5;
      S.x = q.x - q.fz * off; S.z = q.z + q.fx * off; S.y = q.y;
      S.heading = Math.atan2(-q.fx, -q.fz); S.speed = 0;
      const f0 = { ...L.flags };
      const d = k => (L.flags[k] || 0) - (f0[k] || 0);
      let f = 0;
      for (; f < 60 * 120; f++) {
        L.api.setStick(0, 0); step(1);
        if (d("sledHomes") > 0 && sled.phase === "armed") break;
      }
      L.api.clearStick();
      out.car = { countdowns: d("sledCountdowns"), runs: d("sledRuns"), smashes: d("sledSmashes"), chutes: d("sledChutes"), rebuilds: d("sledRebuilds"),
                  homes: d("sledHomes"), crashes: d("carCrashes"), secs: Math.round(f / 60), slotErr: +L.sledSlotError().toFixed(4) };
    } catch (e) { out.err = String(e && e.stack || e).slice(0, 300); }
    return out;
  });
  {
    const a = leave.after || {}, fr = leave.fresh || {}, m = midRun || {};
    const same = !leave.err && J(Object.assign({}, a, { ownShown: undefined })) === J(fr);
    check("sled ride: mid-run the picker button is gone and the menu button is there, and the go button he pressed and held was let go when the run started",
      !m.err && m.phase === "run" && m.ownHidden && m.menu && !m.picker && m.held === false && !m.pressedLook, J(m));
    // (it must really have been mid-run when he tapped the menu -- riding, the run going,
    // the set-piece's own sled hidden -- or this would pass for a set-piece nobody rode)
    check("sled ride: leaving mid-run the way he can (the menu button, the car's card, a direction) puts the set-piece back exactly as a fresh reset -- its sled home and drawn, armed, the wall standing and solid, both rings exactly where they were built -- and no held go comes with him",
      !m.err && m.phase === "run" && m.d > 100 && m.ownHidden && tapped === true && !leave.err && leave.key === "car" && !leave.menuOpen && leave.heldAfter === false &&
      same && a.ownShown && a.phase === "armed" && a.d === 0 && a.walls === leave.total && a.wallSolid && !a.noSolid &&
      leave.farAfter === leave.farFresh && typeof a.retLat === "string" && a.retLat.split(",").every(v => Math.abs(+v - leave.retHome) < 0.01) &&
      typeof a.retHomeErr === "number" && a.retHomeErr < 1e-6,
      J({ tapped, err: leave.err, midRun: { phase: m.phase, d: m.d, ownHidden: m.ownHidden }, key: leave.key, menuOpen: leave.menuOpen, heldAfter: leave.heldAfter,
          farAfter: leave.farAfter, farFresh: leave.farFresh, retHome: leave.retHome, retHomeErr: a.retHomeErr, after: a, fresh: fr }));
    const c = leave.car || {};
    check("sled ride: and afterwards the set-piece still arms and runs for the car as before -- 3-2-1, the smash, the chutes, home, the wall rebuilt, no crash",
      !leave.err && c.countdowns === 1 && c.runs === 1 && c.smashes === 1 && c.chutes === 1 && c.rebuilds === 1 && c.homes === 1 && c.crashes === 0 && c.slotErr < 0.01, J(c));
  }
  const browser = page.context().browser(), url = page.url();
  await page.close();

  // ---- j. a relaunch: the card picked through the real picker, then the game opened
  // again -- the sled card comes back lit, and the world behind it is the sled's
  let relaunch = { err: null };
  try {
    const ctx = await browser.newContext({ viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1 });
    try {
      const stub = () => { window.__rafQueue = []; window.__simTime = 0; window.requestAnimationFrame = cb => { window.__rafQueue.push(cb); return 1; }; };
      const p1 = await ctx.newPage();
      await p1.addInitScript(stub);
      await p1.goto(url, { timeout: 120000 });
      await p1.waitForFunction(() => !!window.__lp, null, { timeout: 60000 });
      relaunch.hasCard = !!(await p1.$('.vehCard[data-v="sled"]'));
      if (relaunch.hasCard) {
        await p1.click('.vehCard[data-v="sled"]', { timeout: 10000 });
        await p1.click('[data-d="0"]', { timeout: 10000 });
        await p1.evaluate(() => { window.__lp.noRender = true; for (let i = 0; i < 10; i++) window.__lp.update(1 / 60); });
        const p2 = await ctx.newPage();
        await p2.addInitScript(stub);
        await p2.goto(url, { timeout: 120000 });
        await p2.waitForFunction(() => !!window.__lp, null, { timeout: 60000 });
        Object.assign(relaunch, await p2.evaluate(() => ({
          key: window.__lp.state.vehicleKey, kind: window.__lp.vehKind(),
          lit: [...document.querySelectorAll(".vehCard.sel")].map(c => c.dataset.v),
          pickerShown: !document.getElementById("screenVehicle").classList.contains("hiddenS"),
          saved: localStorage.getItem("lp.vehicle"),
        })));
        await p2.close();
      }
      await p1.close();
    } finally { await ctx.close(); }
  } catch (e) { relaunch.err = String(e && e.message || e).slice(0, 200); }
  check("sled ride: a relaunch brings the sled card back, lit, on the vehicle screen (the existing lp.vehicle, nothing new saved)",
    !relaunch.err && relaunch.hasCard && relaunch.key === "sled" && relaunch.kind === "sled" && J(relaunch.lit) === J(["sled"]) && relaunch.pickerShown && relaunch.saved === "sled", J(relaunch));

  check("sled ride: no browser or frame errors", errors.length === 0, J(errors.slice(0, 5)));
};
