"use strict";
// ---------------------------------------------------------------------------
// THE WRECKING-BALL CRANE (v145), played the way he plays it: the card picked
// through the real picker, a real finger dragged on the glass to turn it, the go
// button pressed, and nothing else. Portrait. Every scenario counts bangs frame
// by frame (state.exploding transitions) and reads every flag as a DELTA.
//
//   a. the card: there, visible, an icon only; the picker has 14 cards; picked, he
//      is in the crane (kind 'crane') at the crane's lot;
//   b. a drag right turns it right, a drag left turns it left (the real pointer
//      path); let go, the magnet settles it on a block of towers; and the SAME drag
//      on the monster truck and the car does exactly what it did on v144;
//   c. go: 3-2-1 on the big numeral, and nothing is hit before it ends;
//   d. the ball swings by itself -- slow back, then fast -- and hits the aimed block;
//   e. that block's towers fall past 60 degrees one after another, away from the crane,
//      and no other block moves;
//   f. pieces fly (a delta over a minimum), none ever in the motorway's corridor,
//      the debris pool's cap respected;
//   g. no bang anywhere, in either view;
//   h. everything stands back up exactly, the registry as before, the pieces gone;
//      and a second go, at another block, works too;
//   i. no text in the page, aiming, counting and mid-fall;
//   j. both cameras have the aimed block in the portrait frame (820x1180 and
//      768x1024), and the chase has the ball in frame at the hit;
//   k. leaving mid-swing (the menu button, the car, a direction) and after a
//      cycle puts everything back; the car drives as ever; a relaunch brings the
//      crane card back lit.
// On v144 there is no such card or vehicle: every check FAILs, none throws.
//
// Alone: node scripts/run_module.js crane_checks --vp=768x1024
// ---------------------------------------------------------------------------

// What a real drag (pointerdown, two moves right, held 45 frames, up) did to the
// monster truck and the car on v144 (d3c78c9), measured before the crane existed.
// The crane's slew is the crane's own: on everything else the same finger must
// still do exactly this.
const V144_DRAG = {
  monster: { bank: 0.434028, pitch: 0.034265, dh: -0.499762, dx: 1.4086, dz: -4.2289 },
  car: { bank: 0.434028, pitch: 0.034265, dh: -0.382685, dx: 1.1404, dz: -4.9054 },
};

// One demolition cycle (demoRecord, at the bottom of this file) as v144 (d3c78c9) ran it,
// on a fresh page: the phases and the frames they began on, the frames each tower
// started folding, the numerals, every tower mid-fold and at the end, and the flags.
// The crane must change none of it -- not by being in the world, not by having been
// picked and left.
const DEMO_V144 = {"trig": true, "phases": "charging@0,folding@181,down@465,rising@1065,armed@1174", "folds": "182,213,244,275,306,337,368", "nums": "123", "mid": "[[0.0706,0.1187,0],[0.3713,-0.0103,0.0693],[0.8068,-0.0239,-0.0215],[1,0,0],[1,0,0],[1,0,0],[1,0,0]]", "flags": {"demolitions": 1, "folded": 7, "rebuilds": 1}, "end": "[[1,46.715,0,0,false,true],[1,26.6858,0,0,false,true],[1,23.7203,0,0,false,true],[1,25.6728,0,0,false,true],[1,26.013,0,0,false,true],[1,24.1216,0,0,false,true],[1,26.1409,0,0,false,true]]", "reticle": true, "towers": 7, "at": [300, 2760]};   // captured on /workspace/fs-smoke/lp-old145 (v144), a fresh page; the same again after other driving
const DEMO_KEYS = ["trig", "phases", "folds", "nums", "mid", "flags", "end", "reticle", "towers", "at"];

module.exports = async function craneChecks({ newPage, check }) {
  const J = x => JSON.stringify(x);
  const demoSame = r => !!DEMO_V144 && !r.err && DEMO_KEYS.every(k => J(r[k]) === J(DEMO_V144[k]));
  const demoDiff = r => DEMO_KEYS.filter(k => !DEMO_V144 || J(r[k]) !== J(DEMO_V144[k])).map(k => ({ k, now: r[k], v144: DEMO_V144 && DEMO_V144[k] }));

  // ---- the demolition set-piece, first thing on a fresh page, exactly as on v144
  {
    let r = { err: null }, p0 = null;
    try { p0 = await newPage(768, 1024); r = await p0.page.evaluate(module.exports.demoRecord); }
    catch (e) { r = { err: String(e && e.message || e).slice(0, 200) }; }
    finally { if (p0) await p0.ctx.close(); }
    check("crane: the demolition set-piece is exactly as on v144 with the plane (a fresh page: trigger, 3-2-1, the domino fold frame by frame, every tower mid-fold and stood back up, the flags)",
      demoSame(r), J({ err: r.err, diff: demoDiff(r) }));
  }

  const { page, errors } = await newPage(768, 1024);

  // ---- in-page helpers, installed once: the pointer, the go button, the text audit,
  // the projection, and one whole go-to-standing-again cycle measured frame by frame
  await page.evaluate(() => {
    const H = window.__crH = {};
    const L = window.__lp;
    H.fire = (type, x, y, id) => L.renderer.domElement.dispatchEvent(new PointerEvent(type, {
      pointerId: id || 41, pointerType: "touch", isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y }));
    H.goTap = () => {
      const b = document.getElementById("throttleBtn");
      b.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 52, pointerType: "touch", bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
      L.update(1 / 60);
      b.dispatchEvent(new PointerEvent("pointerup", { pointerId: 52, pointerType: "touch", bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    };
    H.vis = id => { const e = document.getElementById(id); return !!e && !e.classList.contains("hidden") && getComputedStyle(e).display !== "none"; };
    H.noText = () => {
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
    const P = new THREE.Vector3();
    H.ndc = (x, y, z) => { L.camera.updateMatrixWorld(); P.set(x, y, z).project(L.camera); return [+P.x.toFixed(3), +P.y.toFixed(3), +P.z.toFixed(4)]; };
    H.inFrame = (x, y, z, m) => { const q = H.ndc(x, y, z); return q[2] < 1 && q[2] > -1 && Math.abs(q[0]) < (m || 0.95) && Math.abs(q[1]) < (m || 0.95); };
    // the aimed block's towers, each its foot and its top, in the picture
    H.blockInFrame = g => {
      const ts = L.crTowers().filter(t => t.g === g);
      const pts = [];
      for (const t of ts) { pts.push(H.ndc(t.base.x, t.base.y + 2, t.base.z)); pts.push(H.ndc(t.top.x, t.top.y, t.top.z)); }
      return { n: ts.length, all: ts.length > 0 && pts.every(q => q[2] < 1 && q[2] > -1 && Math.abs(q[0]) < 0.95 && Math.abs(q[1]) < 0.95), pts };
    };
    // the crane's own meshes (its lot and the model) found in the solids registry: there must be none
    H.craneSolids = () => { const ms = new Set(); if (L.cr && L.cr.lot) L.cr.lot.traverse(o => { if (o.isMesh) ms.add(o); }); if (L.vehicleModel) L.vehicleModel.traverse(o => { if (o.isMesh) ms.add(o); });
      let n = 0; L.forEachSolid(b => { if (b.mesh && ms.has(b.mesh)) n++; }); return { n, meshes: ms.size }; };
    H.step = (n, out) => { for (let i = 0; i < n; i++) { const was = L.state.exploding; L.update(1 / 60); if (L.state.exploding && !was) out.bangs++; } };
    H.buttons = () => ({ go: H.vis("throttleBtn"), picker: H.vis("vehBtn"), view: H.vis("viewBtn"), menu: H.vis("menuBtn"), photo: H.vis("camBtn"),
      eject: H.vis("ejectBtn"), speed: H.vis("fastBtn") || H.vis("slowBtn") || H.vis("speedBtn"), horn: H.vis("hornBtn"), skip: H.vis("skipBtn"),
      wash: H.vis("washBtn"), gear: H.vis("gearBtn"), missile: H.vis("missileBtn"), other: ["catBtn", "stageBtn", "satBtn", "chuteBtn", "roverBtn", "hatchBtn", "droneBtn", "magnetBtn", "bucketBtn", "cannonBtn", "garageBtn", "lockBtn", "heliUpBtn", "heliDownBtn"].filter(H.vis) });
    // PLACEMENT (design lead, 2026-10-08): nothing of the crane's on or near an airport
    // or the motorway, or the demolition block. Why a point is bad, or null. An airport
    // is its flattened pad (runway, taxiways, apron, the rocket pad), its approach
    // corridor (inCorridor), and the runway's centreline run on 1500 m past each end,
    // 150 m either side; the motorway is clearHalf + clearMaxExtra of any carriageway,
    // spur or ramp; the demolition block is blockR + hitR + 60 m round its middle.
    H.placeBad = (x, z) => {
      const T = L.TUNE;
      if (L.flattenMask(x, z) > 0) return "airport pad";
      if (L.inCorridor(x, z, 0)) return "approach corridor or motorway";
      if (L.AIRPORTS.some(ap => Math.abs(x) < 150 && Math.abs(z - ap.cz) < T.runwayLength / 2 + 1500)) return "runway line";
      if (L.hwyCorridorDist(x, z) < T.highway.clearHalf + T.highway.clearMaxExtra) return "motorway";
      if (Math.hypot(x - L.demo.x, z - L.demo.z) < T.demolition.blockR + T.demolition.hitR + 60) return "demolition block";
      return null;
    };
    H.placeNote = (acc, what, x, z) => { const why = H.placeBad(x, z); acc.n++; if (why) { acc.nb = (acc.nb || 0) + 1; if (acc.bad.length < 8) acc.bad.push(what + ":" + why + "@" + Math.round(x) + "," + Math.round(z)); } };
    // How far the aimed row's slabs are INTO each other, and into the ground, now: each
    // slab in its row's vertical plane (along the fall, and up), its outline sampled
    // every metre and tested against its neighbour's box both ways, and against the
    // ground under it (less the built `sink`). The worst depth, metres.
    H.pen = (g) => {
      const cr = L.cr, CR = L.CR, W = CR.towerW, out = { nb: 0, nbAt: null, ground: 0, groundAt: null };
      const row = cr.towers.filter(t => t.g === g).sort((a, b) => a.i - b.i);
      const fr = t => ({ a: (t.pivot.position.x - cr.x) * t.fx + (t.pivot.position.z - cr.z) * t.fz, y: t.pivot.position.y, c: Math.cos(t.phi), s: Math.sin(t.phi), h: t.h, t });
      const edge = (F) => { const pts = []; const n = Math.ceil(F.h);
        for (let k = 0; k <= n; k++) { const v = F.h * k / n; pts.push([0, v], [W, v]); }
        for (let k = 0; k <= 12; k++) { const u = W * k / 12; pts.push([u, 0], [u, F.h]); }
        return pts.map(([u, v]) => ({ a: F.a - u * F.c + v * F.s, y: F.y + u * F.s + v * F.c })); };
      const depth = (F, q) => { const da = q.a - F.a, dy = q.y - F.y, u = -da * F.c + dy * F.s, v = da * F.s + dy * F.c;
        return Math.min(u, W - u, v, F.h - v); };
      const fs = row.map(fr);
      for (let i = 0; i < fs.length; i++) {
        const A = fs[i], B = fs[i + 1], ea = edge(A);
        if (B) for (const [P, Q] of [[ea, B], [edge(B), A]]) for (const q of P) { const d = depth(Q, q); if (d > out.nb) { out.nb = +d.toFixed(2); out.nbAt = { i, phi: [+(A.t.phi * 180 / Math.PI).toFixed(1), +(B.t.phi * 180 / Math.PI).toFixed(1)] }; } }
        for (const q of ea) { const d = L.terrainEff(cr.x + A.t.fx * q.a, cr.z + A.t.fz * q.a) - CR.sink - q.y; if (d > out.ground) { out.ground = +d.toFixed(2); out.groundAt = { i, phi: +(A.t.phi * 180 / Math.PI).toFixed(1) }; } }
      }
      return out;
    };
    // How far the ball's sphere is clear of the boom (a capsule boomW/sqrt2 round its
    // axis: the lattice's corner chords) and of the upper works (a box round the body,
    // the counterweight, the cab and the A-frame), metres, in the upper works' own frame.
    H.ballClear = () => {
      const cr = L.cr, CR = L.CR, b = L.crBall(), h = L.state.heading;
      const fx = -Math.sin(h), fz = -Math.cos(h), dx = b.x - cr.x, dz = b.z - cr.z;
      const f = dx * fx + dz * fz, s = dx * -fz + dz * fx, y = b.y - cr.y;
      const a = CR.boomDeg * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a);
      const pf = f - CR.pivotF, py = y - CR.pivotY, k = Math.max(0, Math.min(CR.boomLen, pf * ux + py * uy));
      const boom = Math.hypot(pf - k * ux, py - k * uy, s) - CR.ballR - CR.boomW * Math.SQRT1_2;
      const ex = Math.max(-11 - f, 0, f - 9), ey = Math.max(-y, 0, y - 21), es = Math.max(Math.abs(s) - 5, 0);
      return { boom, works: Math.hypot(ex, ey, es) - CR.ballR };
    };
    // One go, from the press to standing again, every frame watched.
    H.cycle = (maxSecs) => {
      const S = L.state, cr = L.cr, CR = L.CR, out = { bangs: 0, err: null };
      const f0 = { ...L.flags };
      const d = k => (L.flags[k] || 0) - (f0[k] || 0);
      const crane = L.crCrane();
      out.place = { n: 0, nb: 0, bad: [] }; out.demoStirred = false; out.apronAway = 0;
      const dm0 = L.flags.demolitions || 0;
      out.aim = L.crAimed();
      out.ballClear = { boom: 1e9, boomAt: null, works: 1e9, worksAt: null };
      out.pen = { nb: 0, nbAt: null, ground: 0, groundAt: null, frames: 0 };
      out.solid0 = L.solidCount;
      out.atAim = { block: H.blockInFrame(out.aim), view: S.viewChase ? "chase" : "seat" };
      out.textAim = H.noText();
      out.buttonsAim = H.buttons();
      H.goTap();
      const nums = []; let lastN = "";
      const phases = []; let lastP = "";
      const big = document.getElementById("bigNum");
      const speeds = { wind: [], swing: [] };
      let hitsInCount = 0, hitFrame = null, frames = 0, hitBall = null, hitBlock = null, hitTower = null, prevSpeed = 0, maxDebris = 0, debrisRoad = 0, puffRoad = 0, maxCraneDebris = 0;
      const startT = {}; const maxPhi = {};
      out.textMid = null; out.buttonsMid = null; out.midDomino = null;
      const deb = () => (L.mon && L.mon.debris ? L.mon.debris.filter(p => p.life > 0) : []);
      for (; frames < 60 * (maxSecs || 45); frames++) {
        const hitsBefore = L.flags.crHits || 0, ph0 = cr.phase;
        H.step(1, out);
        if (S.exploding) continue;
        const n = big.classList.contains("on") ? big.textContent.trim() : "";
        if (n && n !== lastN) nums.push(n);
        lastN = n;
        if (cr.phase !== lastP) { phases.push(cr.phase); lastP = cr.phase; }
        if (ph0 === "count" && (L.flags.crHits || 0) > hitsBefore) hitsInCount++;
        const b = L.crBall();
        if (cr.phase === "wind") speeds.wind.push(b.speed);
        if (cr.phase === "swing") speeds.swing.push(b.speed);
        if (hitFrame === null && (L.flags.crHits || 0) > hitsBefore) {
          hitFrame = frames; hitBall = { speed: +prevSpeed.toFixed(2), ndc: H.ndc(b.x, b.y, b.z), inFrame: H.inFrame(b.x, b.y, b.z) };
          hitBlock = H.blockInFrame(out.aim);
          const t0 = L.crTowers().find(t => t.g === out.aim && t.i === 0);
          hitTower = t0 ? { inFrame: H.inFrame(t0.top.x, (t0.top.y + t0.base.y) / 2, t0.top.z) } : null;
        }
        prevSpeed = b.speed;
        const bc = H.ballClear();
        if (bc.boom < out.ballClear.boom) { out.ballClear.boom = bc.boom; out.ballClear.boomAt = cr.phase; }
        if (bc.works < out.ballClear.works) { out.ballClear.works = bc.works; out.ballClear.worksAt = cr.phase; }
        const pn = H.pen(out.aim);
        if (pn.nb > out.pen.nb) { out.pen.nb = pn.nb; out.pen.nbAt = { ...pn.nbAt, phase: cr.phase }; }
        if (pn.ground > out.pen.ground) { out.pen.ground = pn.ground; out.pen.groundAt = { ...pn.groundAt, phase: cr.phase }; }
        out.pen.frames++;
        for (const t of L.crTowers()) {
          const k = t.g + ":" + t.i;
          maxPhi[k] = Math.max(maxPhi[k] || 0, t.phiDeg);
          if (t.startT !== null && startT[k] === undefined) startT[k] = { t: t.startT, dot: (t.fallDir.x * (t.base.x - crane.x) + t.fallDir.z * (t.base.z - crane.z)) / Math.max(1e-6, Math.hypot(t.base.x - crane.x, t.base.z - crane.z)), g: t.g, i: t.i };
        }
        const live = deb();
        maxDebris = Math.max(maxDebris, live.length);
        H.placeNote(out.place, "ball", b.x, b.z);
        // the airports' apron vehicles never come to the crane (nor are sent there): none within 400 m
        for (const a of L.airports) for (const v of a.vehicles) if (Math.hypot(v.x - crane.x, v.z - crane.z) < 400 || Math.hypot(v.tx - crane.x, v.tz - crane.z) < 400) out.apronAway++;
        for (const p of live) H.placeNote(out.place, "debris", p.x, p.z);
        if (L.demo.phase !== "armed") out.demoStirred = true;
        for (const p of live) if (L.hwyCorridorDist(p.x, p.z) < L.HW.clearHalf + 4) debrisRoad++;
        for (const p of L.wakePuffList) if (p.life > 0 && L.hwyCorridorDist(p.mesh.position.x, p.mesh.position.z) < L.HW.clearHalf + 4) puffRoad++;
        // mid-domino: the third tower of the block on its way down
        if (out.midDomino === null && L.crTowers().some(t => t.g === out.aim && t.i === 2 && t.phiDeg > 20)) {
          out.midDomino = { phase: cr.phase, block: H.blockInFrame(out.aim) };
          out.textMid = H.noText(); out.buttonsMid = H.buttons();
          out.parkedMid = L.vehParked(); out.solidMid = L.vehSolid();
        }
        if (d("crRises") > 0 && cr.phase === "armed") break;
      }
      out.frames = frames; out.secs = +(frames / 60).toFixed(1);
      out.nums = nums.join(""); out.phases = phases.join(",");
      out.hitsInCount = hitsInCount; out.hitFrame = hitFrame; out.hitBall = hitBall; out.hitBlock = hitBlock; out.hitTower = hitTower;
      const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
      out.speed = { windMean: mean(speeds.wind) === null ? null : +mean(speeds.wind).toFixed(2), windSecs: +(speeds.wind.length / 60).toFixed(2),
                    swingSecs: +(speeds.swing.length / 60).toFixed(2), atHit: hitBall ? hitBall.speed : null };
      out.flags = { goes: d("crGoes"), countdowns: d("crCountdowns"), swings: d("crSwings"), hits: d("crHits"), falls: d("crFalls"), debris: d("crDebris"), downs: d("crDowns"), rises: d("crRises") };
      const chain = Object.values(startT).filter(s => s.g === out.aim).sort((a, b) => a.i - b.i);
      out.chain = chain.map(s => ({ i: s.i, t: +s.t.toFixed(3), dot: +s.dot.toFixed(3) }));
      out.blockPhi = Object.keys(maxPhi).filter(k => +k.split(":")[0] === out.aim).sort().map(k => +maxPhi[k].toFixed(1));
      out.otherPhi = +Math.max(0, ...Object.keys(maxPhi).filter(k => +k.split(":")[0] !== out.aim).map(k => maxPhi[k])).toFixed(3);
      out.otherStarts = Object.values(startT).filter(s => s.g !== out.aim).length;
      out.maxDebris = maxDebris; out.debrisCap = L.MON.debris; out.debrisRoad = debrisRoad; out.puffRoad = puffRoad;
      out.demoTriggered = (L.flags.demolitions || 0) - dm0;
      out.after = { phase: cr.phase, homeErr: L.crHomeError(), solid: L.solidCount, debrisLive: deb().length, go: H.vis("throttleBtn"), parked: L.vehParked() };
      return out;
    };
  });

  // ---- a. the card, and the picker's count
  const card = await page.evaluate(() => {
    const sv = document.getElementById("screenVehicle");
    const was = sv.classList.contains("hiddenS");
    sv.classList.remove("hiddenS");
    const c = document.querySelector('.vehCard[data-v="crane"]');
    const out = { exists: !!c };
    if (c) {
      const r = c.getBoundingClientRect();
      out.visible = !c.classList.contains("hiddenS") && r.width > 100 && r.height > 100;
      out.text = c.textContent.trim();
      out.words = [c, ...c.querySelectorAll("*")].filter(e => ["aria-label", "title", "alt"].some(a => e.hasAttribute(a))).map(e => e.tagName);
      out.svgText = c.querySelectorAll("text, tspan, foreignObject").length;
      out.icon = !!c.querySelector("svg path, svg rect, svg circle");
    }
    out.cards = [...sv.querySelectorAll(".vehCard")].filter(e => !e.classList.contains("hiddenS") && e.getBoundingClientRect().width > 10).length;
    if (was) sv.classList.add("hiddenS");
    return out;
  });
  check("crane: a card in the picker, an icon only (no text, no label words), and the picker now has 14 cards",
    card.exists && card.visible && card.text === "" && card.words.length === 0 && card.svgText === 0 && card.icon && card.cards === 14, J(card));

  // ---- a. picked through the real picker: the menu button, the crane's card, a direction
  let picked = null;
  try {
    await page.evaluate(() => { const L = window.__lp; L.noRender = true; L.api.setThrottle(false); L.api.clearStick(); L.api.skipScreens(); for (let i = 0; i < 5; i++) L.update(1 / 60); });
    await page.click("#menuBtn", { timeout: 5000 });
    await page.click('.vehCard[data-v="crane"]', { timeout: 5000 });
    await page.click('[data-d="0"]', { timeout: 5000 });
    picked = true;
  } catch (e) { picked = String(e && e.message || e).slice(0, 160); }
  const spawn = await page.evaluate(() => {
    const out = { err: null };
    try {
      const L = window.__lp, S = L.state, H = window.__crH;
      for (let i = 0; i < 30; i++) L.update(1 / 60);
      const at = L.TUNE.crane.at;
      out.key = S.vehicleKey; out.kind = L.vehKind(); out.toLot = +Math.hypot(S.x - at[0], S.z - at[1]).toFixed(2);
      out.phase = L.cr.phase; out.parked = L.vehParked(); out.solid = L.vehSolid(); out.exploding = S.exploding;
      out.solidRow = { r: L.TUNE.solid.r.crane, crawl: L.TUNE.solid.crawl.crane };
      out.towersShown = L.crTowers().length; out.blocks = L.crGroups().length; out.perBlock = L.CR.perGroup;
      out.model = !!L.vehicleModel && L.vehicleModel.visible;
      out.buttons = H.buttons(); out.clashes = L.btnSlotClashes();
      out.chase = S.viewChase;
      // PLACEMENT: the crane's base and every tower's whole fallen footprint (its foot to
      // its height along its fall, plus a margin, its width either side), on a grid
      out.airports = L.AIRPORTS.length;
      out.place = { n: 0, nb: 0, bad: [] };
      const C = L.crCrane(), M = 15;
      for (let a = 0; a < 16; a++) for (const rr of [0, 12, 24]) H.placeNote(out.place, "crane", C.x + Math.cos(a / 8 * Math.PI) * rr, C.z + Math.sin(a / 8 * Math.PI) * rr);
      for (const t of L.crTowers()) {
        const fx = t.fallDir.x, fz = t.fallDir.z, ax = -fz, az = fx;
        for (let u = 0; u <= 6; u++) for (let v = 0; v <= 4; v++) {
          const along = -t.w - M + (t.h + t.w + 2 * M) * u / 6, across = (-t.d / 2 - M) + (t.d + 2 * M) * v / 4;
          H.placeNote(out.place, "tower" + t.g + ":" + t.i, t.base.x + fx * along + ax * across, t.base.z + fz * along + az * across);
        }
      }
    } catch (e) { out.err = String(e && e.stack || e).slice(0, 300); }
    return out;
  });
  const inCrane = !spawn.err && spawn.key === "crane" && spawn.kind === "crane";
  check("crane: picked through the picker (menu, the crane's card, a direction), he is in the crane -- kind 'crane' -- at its lot, parked, three blocks of towers standing, the crane drawn",
    picked === true && inCrane && spawn.toLot < 1 && spawn.phase === "armed" && spawn.parked === true && spawn.blocks === 3 && spawn.towersShown === 3 * spawn.perBlock && spawn.perBlock >= 4 && spawn.model,
    J({ picked, ...spawn }));
  check("crane: PLACEMENT -- the crane's base and every tower's whole fallen footprint (plus 15 m) stay off every airport (pad, approach corridor, runway line run on 1500 m), out of the motorway corridor (clearHalf + clearMaxExtra) and clear of the demolition block (blockR + hitR + 60 m)",
    inCrane && spawn.airports >= 2 && spawn.place.n > 100 && spawn.place.nb === 0 && spawn.towersShown >= 12, J({ airports: spawn.airports, place: spawn.place, err: spawn.err }));
  check("crane: the vehicle contract -- not solid (it never moves; vehSolid false), and a TUNE.solid row for the kind (radius, and a crawl that is never a bang)",
    inCrane && spawn.solid === false && typeof spawn.solidRow.r === "number" && spawn.solidRow.r > 0 && spawn.solidRow.crawl >= 99, J({ solid: spawn.solid, row: spawn.solidRow, err: spawn.err }));
  {
    const b = spawn.buttons || {};
    check("crane: aiming, the buttons are go, the picker, the view, the photo and the menu -- no speed steps, eject, horn, go-home arrow, wash, gear, missile or anything else; no slot clash",
      inCrane && b.go && b.picker && b.view && b.menu && b.photo && !b.eject && !b.speed && !b.horn && !b.skip && !b.wash && !b.gear && !b.missile && b.other.length === 0 && spawn.clashes.length === 0,
      J({ buttons: b, clashes: spawn.clashes, err: spawn.err }));
  }

  // ---- b. the slew, by a real finger on the glass
  const slew = await page.evaluate(() => {
    const out = { err: null };
    try {
      const L = window.__lp, S = L.state, H = window.__crH, cr = L.cr;
      const W = window.innerWidth, Hh = window.innerHeight, cx = W / 2, cy = Hh * 0.6;
      const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
      const nearestGap = () => Math.min(...L.crGroups().map(g => Math.abs(wrap(S.heading - g.bearing)))) / Math.PI * 180;
      out.groups = L.crGroups().map(g => +(g.bearing / Math.PI * 180).toFixed(1));
      const drag = (dx, frames) => {
        const h0 = S.heading;
        H.fire("pointerdown", cx, cy); L.update(1 / 60);
        H.fire("pointermove", cx + dx * 0.5, cy); L.update(1 / 60);
        H.fire("pointermove", cx + dx, cy + 4);
        const mid = []; for (let i = 0; i < frames; i++) { L.update(1 / 60); if (i % 10 === 9) mid.push(+((S.heading - h0) / Math.PI * 180).toFixed(2)); }
        const held = +((S.heading - h0) / Math.PI * 180).toFixed(2);
        H.fire("pointerup", cx + dx, cy + 4);
        for (let i = 0; i < 120; i++) L.update(1 / 60);
        return { held, mid, settledGap: +nearestGap().toFixed(3), aim: L.crAimed(), heading: +(S.heading / Math.PI * 180).toFixed(2), touching: S.touching };
      };
      out.start = { aim: L.crAimed(), gap: +nearestGap().toFixed(3) };
      // (a 200 px drag is ~0.62 of the stick: ~21 degrees a second; the blocks are 50 apart)
      out.right = drag(200, 90);
      out.left = drag(-200, 90);
      // a nudge too small to reach the next block: let go, and it settles back on the one it was on
      const a0 = L.crAimed();
      out.nudge = drag(40, 8); out.nudge.from = a0;
      // a drag held for ever never turns it away from the towers: it stops past the outer block
      out.far = drag(-200, 60 * 8);
      out.far.margin = L.CR.slewMarginDeg;
      // back to the middle block for what follows
      out.back = drag(200, 90);
      out.phase = cr.phase;
    } catch (e) { out.err = String(e && e.stack || e).slice(0, 300); }
    return out;
  });
  {
    const s = slew;
    // turning right is the heading going DOWN (forward is (-sin h, -cos h))
    check("crane: a real drag RIGHT on the glass turns the crane right (heading down, more the longer he holds), and let go it settles exactly on a block of towers (the magnet)",
      !s.err && inCrane && s.right && s.right.held < -10 && s.right.mid.every((v, i) => i === 0 || v <= s.right.mid[i - 1] + 1e-9) && s.right.settledGap < 0.5 && s.right.aim !== s.start.aim && !s.right.touching,
      J({ err: s.err, start: s.start, right: s.right, groups: s.groups }));
    check("crane: a real drag LEFT turns it left (heading up) on to another block; a small nudge settles back on the block it was on (wide aim: roughly there is that block)",
      !s.err && inCrane && s.left && s.left.held > 10 && s.left.settledGap < 0.5 && s.left.aim !== s.right.aim && s.nudge && s.nudge.aim === s.nudge.from && s.nudge.settledGap < 0.5,
      J({ err: s.err, left: s.left, nudge: s.nudge }));
    const g = s.groups || [], lo = Math.min(...g), hi = Math.max(...g);
    check("crane: held left for 8 s it never turns away from the towers -- it stops within the slew margin past the outer block, and let go it settles on that outer block",
      !s.err && inCrane && s.far && s.far.settledGap < 0.5 && g.length === 3 && s.far.aim === g.indexOf(hi) && s.back && s.back.aim === 1,
      J({ err: s.err, far: s.far, back: s.back, groups: g }));
  }

  // ---- b. the same drag on the monster truck and the car: exactly as on v144
  const others = await page.evaluate(() => {
    const out = { err: null };
    try {
      const L = window.__lp, S = L.state, H = window.__crH;
      const drag = (key) => {
        L.api.setThrottle(false); L.api.clearStick();
        L.api.setVehicle(key); L.api.spawnAt(0, 0); L.api.skipScreens(); L.spdReset();
        for (let i = 0; i < 10; i++) L.update(1 / 60);
        const h0 = S.heading, x0 = S.x, z0 = S.z;
        const cx = 384, cy = 600;
        H.fire("pointerdown", cx, cy); L.update(1 / 60);
        H.fire("pointermove", cx + 60, cy); L.update(1 / 60);
        H.fire("pointermove", cx + 140, cy - 10);
        const bank = S.ctrlBank, pitch = S.ctrlPitch;
        for (let i = 0; i < 45; i++) L.update(1 / 60);
        H.fire("pointerup", cx + 140, cy - 10);
        for (let i = 0; i < 15; i++) L.update(1 / 60);
        return { key, bank: +bank.toFixed(6), pitch: +pitch.toFixed(6), dh: +(S.heading - h0).toFixed(6), dx: +(S.x - x0).toFixed(4), dz: +(S.z - z0).toFixed(4), touching: S.touching };
      };
      out.monster = drag("monster"); out.car = drag("car");
    } catch (e) { out.err = String(e && e.stack || e).slice(0, 300); }
    return out;
  });
  {
    const m = others.monster || {}, c = others.car || {}, V = V144_DRAG;
    const near = (a, b, tol) => typeof a === "number" && Math.abs(a - b) <= tol;
    check("crane: the same real drag on the monster truck turns and moves it exactly as on v144, and the car exactly as on v144 too (the slew is the crane's alone)",
      !others.err && near(m.bank, V.monster.bank, 1e-6) && near(m.pitch, V.monster.pitch, 1e-6) && near(m.dh, V.monster.dh, 1e-5) && near(m.dx, V.monster.dx, 1e-3) && near(m.dz, V.monster.dz, 1e-3) &&
      near(c.bank, V.car.bank, 1e-6) && near(c.pitch, V.car.pitch, 1e-6) && near(c.dh, V.car.dh, 1e-5) && near(c.dx, V.car.dx, 1e-3) && near(c.dz, V.car.dz, 1e-3) && m.touching === false && c.touching === false,
      J({ err: others.err, monster: m, car: c, v144: V }));
  }

  // ---- c-i. one whole go in each view (the chase first: the view he starts in)
  const cycles = [];
  for (const chase of [true, false]) {
    cycles.push(await page.evaluate((chase) => {
      const L = window.__lp, H = window.__crH;
      try {
        L.noRender = true;
        L.api.setThrottle(false); L.api.clearStick();
        L.api.setVehicle("crane"); L.api.spawnAt(0, 0); L.api.skipScreens(); L.api.setView(chase);
        for (let i = 0; i < 90; i++) L.update(1 / 60);
        const r = H.cycle(45);
        r.view = chase ? "chase" : "seat";
        r.kind = L.vehKind();
        return r;
      } catch (e) { return { err: String(e && e.stack || e).slice(0, 300), view: chase ? "chase" : "seat" }; }
    }, chase));
  }
  for (const r of cycles) {
    const tag = `crane (${r.view})`, f = r.flags || {}, sp = r.speed || {}, a = r.after || {};
    const ran = !r.err && r.kind === "crane" && f.goes === 1 && f.hits === 1;
    check(`${tag}: go (the go button tapped once) -- 3-2-1 on the big numeral, then the swing; nothing is hit while it counts`,
      !r.err && r.kind === "crane" && f.goes === 1 && f.countdowns === 1 && r.nums === "321" && r.hitsInCount === 0 && /^count,wind,swing,fall/.test(r.phases || ""),
      J({ err: r.err, nums: r.nums, phases: r.phases, hitsInCount: r.hitsInCount, flags: f }));
    check(`${tag}: the ball swings by itself -- drawn back slowly (over 1.5 s), then fast -- and hits the aimed block once (its speed at the hit over 2.5x the wind-up's average)`,
      ran && f.swings === 1 && sp.windSecs >= 1.5 && sp.windMean !== null && sp.atHit > 2.5 * sp.windMean && sp.atHit > 8,
      J({ err: r.err, speed: sp, flags: f }));
    const per = (r.blockPhi || []).length;
    check(`${tag}: the aimed block falls like dominoes -- at least TUNE.crane.perGroup towers past 60 degrees, each starting strictly after the one before, each falling AWAY from the crane; no other block moves`,
      ran && per >= 4 && r.blockPhi.every(p => p > 60) && (r.chain || []).length === per && r.chain.every((c, i) => c.dot > 0.5 && (i === 0 || c.t > r.chain[i - 1].t)) && r.otherPhi < 0.01 && r.otherStarts === 0 && f.falls === per,
      J({ err: r.err, blockPhi: r.blockPhi, chain: r.chain, otherPhi: r.otherPhi, otherStarts: r.otherStarts, falls: f.falls }));
    check(`${tag}: the ball never goes through the boom or the crane's body -- every frame of the go (the wind-up, the swing, the settle, the hoist), its sphere clear of the boom (a capsule boomW/sqrt2 round its axis) and of the upper works`,
      ran && r.ballClear && r.ballClear.boom > 0 && r.ballClear.works > 0,
      J({ err: r.err, ballClear: r.ballClear && { boom: +r.ballClear.boom.toFixed(2), boomAt: r.ballClear.boomAt, works: +r.ballClear.works.toFixed(2), worksAt: r.ballClear.worksAt } }));
    check(`${tag}: every frame of the go, each tower leans ON the next one, never through it (no slab more than 0.3 m into its neighbour), and none goes into the ground`,
      ran && r.pen && r.pen.frames > 600 && r.pen.nb <= 0.3 && r.pen.ground <= 0.3, J({ err: r.err, pen: r.pen }));
    check(`${tag}: pieces fly from the hit and the falls (this go's own, over 40), none ever in the motorway's corridor, no dust there either, and never more than the debris pool's cap`,
      ran && f.debris > 40 && r.debrisRoad === 0 && r.puffRoad === 0 && r.maxDebris > 0 && r.maxDebris <= r.debrisCap,
      J({ err: r.err, debris: f.debris, debrisRoad: r.debrisRoad, puffRoad: r.puffRoad, maxDebris: r.maxDebris, cap: r.debrisCap }));
    check(`${tag}: PLACEMENT -- the ball's whole swing and every piece of debris, every frame, stay off every airport, out of the motorway corridor and clear of the demolition block, and the demolition never stirs`,
      ran && r.place && r.place.n > 100 && r.place.nb === 0 && r.demoStirred === false && r.demoTriggered === 0, J({ err: r.err, place: r.place, demoStirred: r.demoStirred, demoTriggered: r.demoTriggered }));
    check(`${tag}: nothing of the airports comes to the crane -- the fuel truck and the baggage cart are never sent to it, nor come within 400 m, any frame of the go`,
      ran && r.apronAway === 0, J({ err: r.err, apronAway: r.apronAway }));
    check(`${tag}: no bang anywhere in the go, counted every frame`, ran && r.bangs === 0, J({ ran, bangs: r.bangs, err: r.err }));
    check(`${tag}: then everything stands back up exactly -- every tower on its home transform, the solids registry as before, every piece gone -- and the go button is back`,
      ran && f.downs === 1 && f.rises === 1 && a.phase === "armed" && a.homeErr < 1e-6 && a.solid === r.solid0 && a.debrisLive === 0 && a.go && a.parked,
      J({ err: r.err, after: a, solid0: r.solid0, secs: r.secs, downs: f.downs, rises: f.rises }));
    check(`${tag}: no text in the page aiming, counting or mid-fall (numerals only)`,
      ran && Array.isArray(r.textAim) && r.textAim.length === 0 && Array.isArray(r.textMid) && r.textMid.length === 0, J({ aim: r.textAim, mid: r.textMid, err: r.err }));
    const bm = r.buttonsMid || {};
    check(`${tag}: mid-fall the go button and the picker are gone (nothing to press), the view, the photo and the menu stay; he is not parked and not solid`,
      ran && r.midDomino !== null && !bm.go && !bm.picker && bm.view && bm.menu && bm.photo && !bm.eject && !bm.speed && r.parkedMid === false && r.solidMid === false,
      J({ err: r.err, buttons: bm, parked: r.parkedMid, solid: r.solidMid }));
    check(`${tag}: the aimed block is in the portrait picture when he aims (every tower's foot and top)`,
      !r.err && r.atAim && r.atAim.block && r.atAim.block.n >= 4 && r.atAim.block.all, J({ err: r.err, atAim: r.atAim }));
    if (r.view === "chase") {
      check(`${tag}: at the hit the ball and the block are both in the picture`,
        ran && r.hitBall && r.hitBall.inFrame && r.hitBlock && r.hitBlock.all, J({ err: r.err, hitBall: r.hitBall, hitBlock: r.hitBlock && r.hitBlock.all }));
    } else {
      check(`${tag}: at the hit the tower the ball hits is in the picture from the cab`,
        ran && r.hitTower && r.hitTower.inFrame, J({ err: r.err, hitTower: r.hitTower }));
    }
  }

  // ---- h. a second go, at another block: turn right with a finger, go again
  const second = await page.evaluate(() => {
    const L = window.__lp, H = window.__crH;
    try {
      L.noRender = true;
      const a0 = L.crAimed();
      H.fire("pointerdown", 384, 600); L.update(1 / 60);
      H.fire("pointermove", 584, 604);
      for (let i = 0; i < 90; i++) L.update(1 / 60);
      H.fire("pointerup", 584, 604);
      for (let i = 0; i < 120; i++) L.update(1 / 60);
      const r = H.cycle(45);
      r.from = a0;
      return r;
    } catch (e) { return { err: String(e && e.stack || e).slice(0, 300) }; }
  });
  {
    const r = second, f = r.flags || {}, a = r.after || {};
    check("crane: a second go, after turning to another block, knocks THAT block down too, no bang, and it all stands back up exactly",
      !r.err && r.aim !== r.from && f.goes === 1 && f.hits === 1 && (r.blockPhi || []).length >= 4 && r.blockPhi.every(p => p > 60) && r.otherPhi < 0.01 && r.bangs === 0 &&
      a.phase === "armed" && a.homeErr < 1e-6 && a.debrisLive === 0,
      J({ err: r.err, from: r.from, aim: r.aim, flags: f, blockPhi: r.blockPhi, bangs: r.bangs, after: a }));
  }

  // ---- c. go during the swing does nothing: the go button is gone, Space and a finger change nothing
  const during = await page.evaluate(() => {
    const L = window.__lp, H = window.__crH, S = L.state, cr = L.cr;
    const out = { err: null, bangs: 0 };
    try {
      L.noRender = true;
      H.goTap();
      for (let i = 0; i < 60 * 8 && cr.phase !== "swing"; i++) H.step(1, out);
      out.phase = cr.phase;
      const g0 = L.flags.crGoes || 0, c0 = L.flags.crCountdowns || 0, h0 = S.heading;
      out.goShown = H.vis("throttleBtn");
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", bubbles: true }));
      H.step(5, out);
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space", bubbles: true }));
      H.fire("pointerdown", 384, 600); H.step(1, out); H.fire("pointermove", 584, 600); H.step(30, out); H.fire("pointerup", 584, 600);
      out.goes = (L.flags.crGoes || 0) - g0; out.counts = (L.flags.crCountdowns || 0) - c0; out.turned = +Math.abs(S.heading - h0).toFixed(6);
      for (let i = 0; i < 60 * 45 && !(cr.phase === "armed" && (L.flags.crRises || 0) > 0 && L.crHomeError() < 1e-6); i++) H.step(1, out);
      out.end = { phase: cr.phase, homeErr: L.crHomeError() };
    } catch (e) { out.err = String(e && e.stack || e).slice(0, 300); }
    return out;
  });
  check("crane: mid-swing the go button is gone, and Space or a drag change nothing -- no second go, no turn -- and the go finishes as ever, no bang",
    !during.err && during.phase === "swing" && during.goShown === false && during.goes === 0 && during.counts === 0 && during.turned < 1e-6 && during.bangs === 0 && during.end && during.end.phase === "armed",
    J(during));

  // ---- riding the crane, no other set-piece starts a countdown (the one numeral is his)
  const quiet = await page.evaluate(() => {
    const out = { err: null };
    const L = window.__lp, LS = L.TUNE.launchSite;
    const keep = { armR: LS.armR, innerR: LS.innerR, coneDeg: LS.coneDeg };
    try {
      L.api.setThrottle(false); L.api.clearStick(); L.lsReset();
      L.api.setVehicle("crane"); L.api.spawnAt(0, 0); L.api.skipScreens();
      for (let i = 0; i < 10; i++) L.update(1 / 60);
      LS.armR = 1e6; LS.innerR = 0; LS.coneDeg = 179;
      let c0 = L.flags.lsCountdowns || 0;
      for (let i = 0; i < 120; i++) L.update(1 / 60);
      out.crane = { kind: L.vehKind(), countdowns: (L.flags.lsCountdowns || 0) - c0 };
      L.api.setVehicle("prop"); L.api.placeOnRunway();
      c0 = L.flags.lsCountdowns || 0;
      for (let i = 0; i < 120; i++) L.update(1 / 60);
      out.plane = { countdowns: (L.flags.lsCountdowns || 0) - c0 };
    } catch (e) { out.err = String(e && e.stack || e).slice(0, 300); }
    finally { Object.assign(LS, keep); try { L.lsReset(); L.update(1 / 60); } catch (e) {} }
    return out;
  });
  check("crane: in the crane no other set-piece starts a countdown -- the launch site armed from anywhere stays quiet for him, and arms for the plane",
    !quiet.err && quiet.crane && quiet.crane.kind === "crane" && quiet.crane.countdowns === 0 && quiet.plane && quiet.plane.countdowns >= 1, J(quiet));

  // ---- k. leaving mid-swing, the way he can: the menu button, the car's card, a direction
  const midSwing = await page.evaluate(() => {
    const L = window.__lp, H = window.__crH, cr = L.cr;
    const out = { err: null };
    try {
      L.noRender = true;
      L.api.setThrottle(false); L.api.clearStick();
      L.api.setVehicle("crane"); L.api.spawnAt(0, 0); L.api.skipScreens();
      for (let i = 0; i < 30; i++) L.update(1 / 60);
      out.solid0 = L.solidCount;
      H.goTap();
      // past the hit: the first towers going over, the pieces in the air
      for (let i = 0; i < 60 * 15 && !L.crTowers().some(t => t.i === 1 && t.phiDeg > 10); i++) L.update(1 / 60);
      out.phase = cr.phase; out.falling = L.crTowers().filter(t => t.phiDeg > 1).length; out.debris = L.mon && L.mon.debris ? L.mon.debris.filter(p => p.life > 0).length : 0;
      out.menu = H.vis("menuBtn"); out.picker = H.vis("vehBtn"); out.craneSolids = H.craneSolids();
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
  const left = await page.evaluate(() => {
    const L = window.__lp, S = L.state, H = window.__crH;
    const out = { err: null, bangs: 0 };
    try {
      H.step(5, out);
      out.key = S.vehicleKey; out.menuOpen = L.menuOpen();
      out.towersHome = L.crHomeError(); out.towersShown = L.crTowers().filter(t => t.visible).length;
      out.debris = L.mon && L.mon.debris ? L.mon.debris.filter(p => p.life > 0).length : 0;
      out.phase = L.cr.phase; out.count = document.getElementById("bigNum").classList.contains("on");
      out.craneSolids = H.craneSolids();
      // the car drives as ever: a finger down, and it goes, on the road, no bang
      const x0 = S.x, z0 = S.z;
      L.api.setStick(0, 0); H.step(60 * 3, out); L.api.clearStick();
      out.carMoved = +Math.hypot(S.x - x0, S.z - z0).toFixed(1); out.carSpeed = +S.speed.toFixed(1);
    } catch (e) { out.err = String(e && e.stack || e).slice(0, 300); }
    return out;
  });
  check("crane: leaving mid-fall the way he can (the menu button, the car's card, a direction) stands every tower back up exactly and hides them, clears every piece and the numeral, puts the crane back to parked; and no crane object is ever in the solids registry (mid-fall or after)",
    !midSwing.err && midSwing.falling >= 1 && midSwing.menu && !midSwing.picker && tapped === true && !left.err && left.key === "car" && !left.menuOpen &&
    left.towersHome < 1e-6 && left.towersShown === 0 && left.debris === 0 && left.phase === "armed" && !left.count && midSwing.craneSolids && midSwing.craneSolids.meshes > 15 && midSwing.craneSolids.n === 0 && left.craneSolids && left.craneSolids.n === 0,
    J({ midSwing, tapped, left }));
  check("crane: ... and the car drives as ever afterwards (a finger down: it goes, no bang)",
    !left.err && left.key === "car" && left.carMoved > 20 && left.bangs === 0, J({ err: left.err, carMoved: left.carMoved, carSpeed: left.carSpeed, bangs: left.bangs }));

  // ---- the crane present in the world (built, picked, left) but not picked: the
  // demolition goes exactly as on v144, and the crane neither sets it off nor stirs
  const demoAfter = await page.evaluate((rec) => {
    const L = window.__lp;
    const f = { goes: L.flags.crGoes || 0, counts: L.flags.crCountdowns || 0, hits: L.flags.crHits || 0 };
    const r = (0, eval)("(" + rec + ")")();
    r.crane = { built: typeof L.crTowers === "function" ? L.crTowers().length : null, phase: L.cr ? L.cr.phase : null,
                goes: (L.flags.crGoes || 0) - f.goes, counts: (L.flags.crCountdowns || 0) - f.counts, hits: (L.flags.crHits || 0) - f.hits };
    return r;
  }, module.exports.demoRecord.toString()).catch(e => ({ err: String(e && e.message || e).slice(0, 200) }));
  check("crane: after a session in the crane (it is in the world, not picked), the demolition goes exactly as on v144 -- the same record, frame for frame",
    demoSame(demoAfter), J({ err: demoAfter.err, diff: demoDiff(demoAfter) }));
  check("crane: ... and while the demolition goes the crane, built but not picked, does nothing -- no go, no count, no hit, waiting",
    !demoAfter.err && demoAfter.crane && demoAfter.crane.built >= 12 && demoAfter.crane.phase === "armed" && demoAfter.crane.goes === 0 && demoAfter.crane.counts === 0 && demoAfter.crane.hits === 0,
    J({ err: demoAfter.err, crane: demoAfter.crane }));

  // ---- j. the cameras at the other portrait size: the aimed block in frame aiming, both views
  const tall = await (async () => {
    let r = { err: null };
    let p2 = null;
    try {
      p2 = await newPage(820, 1180);
      r = await p2.page.evaluate(() => {
        const L = window.__lp, S = L.state, out = { err: null };
        try {
          L.noRender = true;
          const P = new THREE.Vector3();
          const ndc = (x, y, z) => { L.camera.updateMatrixWorld(); P.set(x, y, z).project(L.camera); return [+P.x.toFixed(3), +P.y.toFixed(3), +P.z.toFixed(4)]; };
          L.api.setVehicle("crane"); L.api.spawnAt(0, 0); L.api.skipScreens();
          for (const chase of [true, false]) {
            L.api.setView(chase);
            for (let i = 0; i < 120; i++) L.update(1 / 60);
            const g = L.crAimed(), pts = [];
            for (const t of L.crTowers().filter(t => t.g === g)) { pts.push(ndc(t.base.x, t.base.y + 2, t.base.z)); pts.push(ndc(t.top.x, t.top.y, t.top.z)); }
            out[chase ? "chase" : "seat"] = { n: pts.length / 2, all: pts.length > 0 && pts.every(q => q[2] < 1 && q[2] > -1 && Math.abs(q[0]) < 0.95 && Math.abs(q[1]) < 0.95), pts };
          }
        } catch (e) { out.err = String(e && e.stack || e).slice(0, 300); }
        return out;
      });
    } catch (e) { r = { err: String(e && e.message || e).slice(0, 200) }; }
    finally { if (p2) await p2.ctx.close(); }
    return r;
  })();
  check("crane: at 820x1180 too, the aimed block is in the picture when he aims -- from the chase and from the cab",
    !tall.err && tall.chase && tall.chase.all && tall.chase.n >= 4 && tall.seat && tall.seat.all && tall.seat.n >= 4, J(tall));

  // ---- j. the cab at 820x1180: the ball is the star, but it never stands in front of
  // what he is looking at. Each disc projected to pixels (the ball's centre and ballR;
  // the ring's centre and its outer edge at the top of its pulse); the windscreen is
  // the picture above the dash. Aiming and through the 3-2-1, every frame, the two
  // discs apart; mid-domino (as the cycle: the third tower past 20 degrees), most of
  // the falling row's towers -- every one, 95% of its slab's points -- on the windscreen and not
  // behind the ball, and the same every frame all down; at the hit, the ball on the windscreen.
  const cab = await (async () => {
    let r = { err: null }, p3 = null;
    try {
      p3 = await newPage(820, 1180);
      r = await p3.page.evaluate(() => {
        const L = window.__lp, S = L.state, cr = L.cr, CR = L.CR, out = { err: null };
        try {
          L.noRender = true;
          const W = innerWidth, Hh = innerHeight, dashTop = document.getElementById("dash").getBoundingClientRect().top;
          const P = new THREE.Vector3(), R = new THREE.Vector3();
          const px = (x, y, z) => { P.set(x, y, z).project(L.camera); return { x: (P.x + 1) / 2 * W, y: (1 - P.y) / 2 * Hh, z: P.z }; };
          const disc = (x, y, z, rad) => {
            L.camera.updateMatrixWorld();
            const c = px(x, y, z);
            R.setFromMatrixColumn(L.camera.matrixWorld, 0).multiplyScalar(rad);
            const e = px(x + R.x, y + R.y, z + R.z);
            return { x: +c.x.toFixed(1), y: +c.y.toFixed(1), r: +Math.hypot(e.x - c.x, e.y - c.y).toFixed(1), front: c.z > -1 && c.z < 1 };
          };
          const onGlass = q => q.front && q.x > 0 && q.x < W && q.y > 0 && q.y < dashTop;
          const ballD = () => { const b = L.crBall(); return disc(b.x, b.y, b.z, b.r); };
          const ringD = () => { const p = cr.reticle.position; return disc(p.x, p.y, p.z, (CR.reticleR + 1.1) * (1 + CR.reticlePulse)); };
          const gap = (a, b) => +(Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r).toFixed(1);
          L.api.setThrottle(false); L.api.clearStick();
          L.api.setVehicle("crane"); L.api.spawnAt(0, 0); L.api.skipScreens();
          L.api.setView(false);
          out.dashTop = dashTop;
          let worst = null;
          const note = (ph) => { const b = ballD(), g = ringD(), d = gap(b, g); if (!worst || d < worst.gap) worst = { ph, gap: d, ball: b, ring: g, ringOn: onGlass(g) }; };
          for (let i = 0; i < 120; i++) { L.update(1 / 60); if (i >= 60) note("armed"); }
          const go = document.getElementById("throttleBtn");
          go.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 53, pointerType: "touch", bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
          L.update(1 / 60);
          go.dispatchEvent(new PointerEvent("pointerup", { pointerId: 53, pointerType: "touch", bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
          const f0 = L.flags.crHits || 0;
          let counted = 0;
          out.mid = null; out.hit = null; out.down = null;
          // the row as he sees it now: each tower's slab, a grid of points through it (5
          // across, 9 up, 3 deep), and how much of it is on the windscreen and NOT behind
          // the ball's disc; a tower is seen when at least 95% of it is
          const V = new THREE.Vector3();
          const rowSeen = () => {
            const b = ballD();
            const ts = cr.towers.filter(t => t.g === cr.aim).map(t => {
              t.pivot.updateMatrixWorld(true);
              let n = 0, vis = 0, hid = 0;
              for (let a = 0; a < 5; a++) for (let k = 0; k < 9; k++) for (let c = 0; c < 3; c++) {
                V.set((a / 4 - 0.5) * CR.towerD, t.h * k / 8, CR.towerW * c / 2);
                t.pivot.localToWorld(V);
                const q = disc(V.x, V.y, V.z, 0); n++;
                const behind = Math.hypot(q.x - b.x, q.y - b.y) < b.r;
                if (behind) hid++; else if (onGlass(q)) vis++;
              }
              return { i: t.i, vis: +(vis / n).toFixed(2), hid: +(hid / n).toFixed(2) };
            });
            return { ball: b, ballOn: onGlass(b), n: ts.length, seen: ts.filter(t => t.vis >= 0.95).length, ts };
          };
          for (let f = 0; f < 60 * 30 && !(out.mid && out.hit && cr.phase === "rise"); f++) {
            L.update(1 / 60);
            if (cr.phase === "count") { counted++; note("count"); }
            if (!out.hit && (L.flags.crHits || 0) > f0) { const b = ballD(); out.hit = { ball: b, on: onGlass(b) }; }
            const row = L.crTowers().filter(t => t.g === cr.aim);
            if (!out.mid && row.some(t => t.i === 2 && t.phiDeg > 20)) out.mid = rowSeen();
            // all down, every frame of it: the worst
            if (cr.phase === "down") { const d = rowSeen(); d.frames = ((out.down && out.down.frames) || 0) + 1;
              if (!out.down || d.seen < out.down.seen || (d.seen === out.down.seen && !d.ballOn)) out.down = d; else out.down.frames = d.frames;
              out.downBallOff = (out.downBallOff || 0) + (d.ballOn ? 0 : 1); }
          }
          out.counted = counted; out.worst = worst;
        } catch (e) { out.err = String(e && e.stack || e).slice(0, 300); }
        return out;
      });
    } catch (e) { r = { err: String(e && e.message || e).slice(0, 200) }; }
    finally { if (p3) await p3.ctx.close(); }
    return r;
  })();
  check("crane: from the cab at 820x1180 the ball never covers the red ring aiming or counting, the whole falling row (every tower 95% on the windscreen and not behind it) is seen mid-domino and every frame all down, the ball itself on the windscreen at the hit and all down",
    !cab.err && cab.counted > 60 && !!cab.worst && cab.worst.gap > 0 && cab.worst.ringOn &&
    !!cab.mid && cab.mid.n >= 5 && cab.mid.seen === cab.mid.n && !!cab.hit && cab.hit.on &&
    !!cab.down && cab.down.frames > 60 && cab.down.n >= 5 && cab.down.seen === cab.down.n && !cab.downBallOff, J(cab));

  const browser = page.context().browser(), url = page.url();
  await page.close();

  // ---- k. a relaunch: the card picked through the real picker, then the game opened
  // again -- the crane card comes back lit (the existing lp.vehicle, nothing new saved)
  let relaunch = { err: null };
  try {
    const ctx = await browser.newContext({ viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1 });
    try {
      const stub = () => { window.__rafQueue = []; window.__simTime = 0; window.requestAnimationFrame = cb => { window.__rafQueue.push(cb); return 1; }; };
      const p1 = await ctx.newPage();
      await p1.addInitScript(stub);
      await p1.goto(url, { timeout: 120000 });
      await p1.waitForFunction(() => !!window.__lp, null, { timeout: 60000 });
      relaunch.hasCard = !!(await p1.$('.vehCard[data-v="crane"]'));
      if (relaunch.hasCard) {
        await p1.click('.vehCard[data-v="crane"]', { timeout: 10000 });
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
  check("crane: a relaunch brings the crane card back, lit, on the vehicle screen (the existing lp.vehicle, nothing new saved)",
    !relaunch.err && relaunch.hasCard && relaunch.key === "crane" && relaunch.kind === "crane" && J(relaunch.lit) === J(["crane"]) && relaunch.pickerShown && relaunch.saved === "crane", J(relaunch));

  check("crane: no browser or frame errors", errors.length === 0, J(errors.slice(0, 5)));
};

// One demolition cycle, measured in the page the way T-SP1 drives it (headless_test.js):
// the prop over the block, demoTrigger(), then frame by frame to armed again. Every
// number is a frame count or a transform, so two runs of the same code agree exactly.
// Shared with the probe that pinned its v144 answer (DEMO_V144 above).
module.exports.demoRecord = function demoRecord() {
  const L = window.__lp, st = L.state, out = { err: null };
  try {
    L.noRender = true;
    L.demoReset();
    const t0 = L.demo.reticleTower;
    L.api.setThrottle(false); L.api.clearStick();
    L.api.setVehicle("prop");
    st.phase = "AIRBORNE"; st.exploding = false;
    st.x = L.demo.x - 600; st.z = L.demo.z + t0.lz; st.y = L.demo.base + 200;
    st.heading = Math.PI / 2; st.pitch = 0; st.speed = 60; st.bank = 0;
    const hold = () => { st.x = L.demo.x - 600; st.z = L.demo.z + t0.lz; st.y = L.demo.base + 200; st.heading = Math.PI / 2; st.phase = "AIRBORNE"; };
    for (let i = 0; i < 4; i++) { hold(); L.update(1 / 60); }
    const f0 = { ...L.flags };
    const d = k => (L.flags[k] || 0) - (f0[k] || 0);
    out.trig = L.demoTrigger();
    const phases = []; let last = L.demo.phase; phases.push(last + "@0");
    const folds = []; let prevF = 0; const nums = new Set();
    let mid = null, frame = 0;
    for (; frame < 60 * 40; frame++) {
      hold(); L.update(1 / 60);
      if (L.demo.phase !== last) { last = L.demo.phase; phases.push(last + "@" + (frame + 1)); }
      const n = d("demoTowersFolded"); if (n > prevF) { folds.push(frame + 1); prevF = n; }
      const t = document.getElementById("bigNum").textContent; if (t) nums.add(t);
      if (frame === 60 * 3 + 90) mid = L.demo.towers.map(q => [+q.mesh.scale.y.toFixed(4), +q.mesh.rotation.x.toFixed(4), +q.mesh.rotation.z.toFixed(4)]);
      if (last === "armed" && frame > 10) break;
    }
    out.phases = phases.join(","); out.folds = folds.join(","); out.nums = [...nums].sort().join("");
    out.mid = JSON.stringify(mid);
    out.flags = { demolitions: d("demolitions"), folded: d("demoTowersFolded"), rebuilds: d("demoRebuilds") };
    out.end = JSON.stringify(L.demo.towers.map(q => [+q.mesh.scale.y.toFixed(6), +q.mesh.position.y.toFixed(4), +q.mesh.rotation.x.toFixed(6), +q.mesh.rotation.z.toFixed(6), !!q.mesh.userData.noSolid, q.mesh.visible]));
    out.reticle = !!L.demo.reticle.visible;
    out.towers = L.demo.towers.length;
    out.at = [Math.round(L.demo.x), Math.round(L.demo.z)];
  } catch (e) { out.err = String(e && e.stack || e).slice(0, 300); }
  return out;
};
