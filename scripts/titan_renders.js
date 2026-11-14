"use strict";
// The giant robot (v218), rendered through the game's own loop, to LOOK at. Each view is
// `<vantage>-<seat|chase>@<moment>`, portrait 820x1180 unless it ends in `~L` (landscape 1180x820).
// Vantages (the robot held facing NORTH, out to sea, so New York's approach rings at x = 0 stay out of the
// background of the close views):
//   runway    his New York start as he sits there, facing south, the robot behind him: what the arrow says
//   turned    on the runway at his start, in the HELICOPTER (it turns on the spot) turned to face it
//   climb     the prop just off the runway's north end, 70 m up, nose at it (~800 m)
//   near      the prop 380 m off its front, at its chest's height, nose at it
//   core      the prop 180 m off its chest, at the core's height
//   close     the prop 100 m off its front quarter
//   pass      the prop flying along its flank 60 m off, nose past it
//   side      the prop 420 m off its flank
//   wade      the helicopter low (20 m) 160 m off its legs: the waterline
//   heli      the helicopter 300 m off, 70 m up, nose at it
//   arrowL / arrowR   the prop in flight with it 90 deg to his left / right, out of sight (the arrow at a column)
//   arrowT    the prop low (10 m) and close (85 m) in front of it, level: its middle above his screen, the arrow at the top edge
//   high      the prop 450 m up flying away from it: behind and below him
//   passN     the prop just past its flank, northbound (no approach): the arrow pointing back at it
//   behind    the prop 220 m off its front, flying away: it close behind him
//   hover     the helicopter 9 m up at his runway start, turned to face it
//   turnout   the prop just after take-off, 130 m up north of the runway, banking round toward it
//   into      the prop let go 300 m off at its chest: moment bang (the bang) or back (put back together)
//   heliSplash  the helicopter 420 m off, 90 m up, for the splash and the fireworks
//   bldg      the crash alarm at one of New York's buildings (no robot near), for comparison
//   night     as near, in the night sky mood (state.sky 3, in code; he has no button for it)
// Moments: up, announce (the sea boiling, 1.8 s in, nothing of it out yet), rise (head and shoulders out),
// hit (a quarter second after a plain hit), weak (the same at the chest core), half (half its plates shot
// off by real hits), topple (mid-fall, 2.4 s in, after half its plates were shot off), splash (0.4 s after
// it lands), fire (3 s after), sunk (after the pieces have gone under), reset (back whole, lamps lit).
//   node scripts/titan_renders.js [root] [outDir=...] [views...]
const path = require("path"), fs = require("fs");
const { launch, openGame, serve } = require("./art_rig.js");

const DEFAULT = ["runway-chase@rise", "runway-seat@up", "runway-chase@up~L", "turned-chase@up", "turned-seat@up",
  "climb-chase@up", "climb-seat@up", "near-chase@announce", "near-chase@rise", "near-seat@rise", "near-chase@up", "core-chase@up",
  "near-chase@hit", "near-chase@weak", "near-seat@weak~L", "near-chase@half", "near-seat@half", "side-chase@half~L",
  "near-chase@topple", "near-seat@topple", "near-chase@splash", "near-seat@splash~L", "near-chase@fire", "near-chase@sunk", "near-chase@reset",
  "close-chase@up", "close-seat@up", "pass-chase@up", "pass-seat@up", "wade-chase@up", "heli-chase@up~L", "heli-seat@hit",
  "arrowL-chase@up~L", "arrowR-chase@up~L", "night-chase@up"];

async function render(root, views, outDir) {
  const out = outDir || path.resolve(__dirname, "..", "evidence", "titan");
  fs.mkdirSync(out, { recursive: true });
  const port = +(process.env.PORT || 8197), srv = serve(root, port), browser = await launch();
  const pages = {};
  for (const v of views) {
    const land = v.endsWith("~L"), key = land ? "L" : "P";
    if (!pages[key]) {
      pages[key] = await openGame(browser, port, land ? { width: 1180, height: 820 } : { width: 820, height: 1180 });
      await pages[key].evaluate(() => { window.__lp.api.skipScreens(); window.__hold = () => {}; for (let i = 0; i < 3; i++) window.__paint(); });
    }
    const page = pages[key];
    const info = await page.evaluate((v) => {
      const L = window.__lp, st = L.state, tn = L.titan, T = L.TUNE.titan;
      const [vs, moment] = v.replace("~L", "").split("@");
      const [vantage, seat] = vs.split("-");
      L.api.skipScreens();
      st.sky = vantage === "night" ? 3 : 0; st.nightF = vantage === "night" ? 1 : 0;
      const step = (n, h) => { for (let i = 0; i < n; i++) { if (h) h(); L.update(1 / 60); } };
      const sea = () => L.seaLevelAt(tn.x, tn.z);
      // where its parts stand when it is UP (worked from its home and its standing heights, so a vantage is
      // the same whether it is up yet or not)
      const chestY = () => sea() - T.wadeDepth + 72, coreY = () => sea() - T.wadeDepth + 72;
      L.tnReset();
      const heliV = vantage === "turned" || vantage === "hover" || vantage === "wade" || vantage === "heli" || vantage === "heliSplash";
      L.api.setVehicle(heliV ? "helicopter" : "prop");
      L.api.spawnAt(0, 0); step(5);
      const facing = 0;   // north: out to sea
      if (moment !== "rise" && moment !== "announce") L.tnForce("up");   // (rising: it comes up out of the sea on the clock below)
      tn.yaw = facing;
      tn.hold = true;
      step(2);
      // the vantage: a point and where he points
      const fx = Math.sin(facing), fz = Math.cos(facing), rx = Math.cos(facing), rz = -Math.sin(facing);
      const at = (fwd, right, y) => ({ x: tn.x + fx * fwd + rx * right, z: tn.z + fz * fwd + rz * right, y });
      let hold = () => {};
      const look = (p, tgt, pitchK) => { st.x = p.x; st.y = p.y; st.z = p.z; st.heading = Math.atan2(-(tgt.x - p.x), -(tgt.z - p.z)); st.pitch = Math.atan2(tgt.y - p.y, Math.hypot(tgt.x - p.x, tgt.z - p.z)) * 180 / Math.PI * (pitchK === undefined ? 0.6 : pitchK); st.bank = 0; };
      const mid = () => ({ x: tn.x, y: chestY(), z: tn.z });
      if (vantage === "runway") hold = () => { st.speed = 0; };
      else if (vantage === "bldg") {
        // the crash alarm at one of New York's buildings, no robot near: the prop 100 m off a tall one, nose at it
        L.tnReset(); L.tnHide();
        let b = null; L.forEachSolid(q => { if (!b && L.solidKind(q) === "building" && q.x > -900 && q.x < -100 && q.z > 3800 && q.z < 4450 && q.y1 > 90 && !q.o3 && !q.cap) b = q; });
        L.api.teleportAirborne(1500, 0, 300, 0); step(2);
        const p = { x: b.x, z: b.z + b.hd + 100, y: (b.y0 + b.y1) / 2 };
        hold = () => { st.phase = "AIRBORNE"; st.x = p.x; st.y = p.y; st.z = p.z; st.heading = 0; st.pitch = 0; st.bank = 0; st.speed = st.vp.cruiseSpeed; st.engaged = false; };
      }
      else if (vantage === "turned") {
        hold = () => { st.x = 0; st.z = 6650; st.y = L.AIRPORTS[0].elev + 1; st.heading = Math.atan2(-(tn.x - st.x), -(tn.z - st.z)); heli.vx = heli.vz = heli.vy = 0; st.speed = 0; };
      } else {
        if (!heliV) { L.api.teleportAirborne(1500, 0, 300, 0); step(2); }
        else { heli.vertical = 1; step(90); heli.vertical = 0; }
        let p, tgt = mid(), k = 0.6, along = null;
        if (vantage === "climb") { p = { x: 60, z: 6780, y: 70 }; k = 0.3; }
        else if (vantage === "near" || vantage === "night") p = at(380, 60, chestY() + 10);
        else if (vantage === "core") { p = at(180, 15, coreY()); tgt = { x: tn.x, y: coreY(), z: tn.z }; k = 0.9; }
        else if (vantage === "close") p = at(100, 70, chestY() + 20);
        else if (vantage === "pass") { p = at(40, 60 + 22, chestY()); along = { x: p.x - fx * 300, y: p.y, z: p.z - fz * 300 }; }
        else if (vantage === "side") p = at(30, 420, chestY());
        else if (vantage === "wade") { p = at(160, 40, sea() + 20); tgt = { x: tn.x, y: sea() + 10, z: tn.z }; k = 0.8; }
        else if (vantage === "heli") p = at(300, 120, 70);
        else if (vantage === "passN") { p = at(150, 0, chestY()); p.x = tn.x + rx * 90 + 0; p.z = tn.z + 150; along = { x: p.x, y: p.y, z: p.z + 1000 }; }
        else if (vantage === "behind") { p = at(220, 20, chestY()); along = { x: p.x + fx * 1000, y: p.y, z: p.z + fz * 1000 }; }
        else if (vantage === "arrowT") { p = at(85, 0, sea() + 10); tgt = { x: tn.x, y: sea() + 10, z: tn.z }; k = 0; }   // low and close in front, level: its middle is above the top of his screen, the arrow at the TOP edge
        else if (vantage === "high") { p = at(300, 0, 450); along = { x: p.x + fx * 1000, y: p.y, z: p.z + fz * 1000 }; }   // high and flying away: it behind and below him
        else if (vantage === "hover") { p = { x: 0, z: 6650, y: L.AIRPORTS[0].elev + 9 }; k = 0.2; }
        else if (vantage === "turnout") { p = { x: 150, z: 6950, y: 130 }; along = { x: p.x + 600, y: p.y, z: p.z + 300 }; }
        else if (vantage === "into") { p = at(300, 0, chestY()); }
        else if (vantage === "heliSplash") p = at(420, 150, 90);
        else if (vantage === "arrowL" || vantage === "arrowR") { p = at(-200, 0, 260); const s = vantage === "arrowL" ? 1 : -1; along = { x: p.x + rx * 1000 * s, y: p.y, z: p.z + rz * 1000 * s }; }
        hold = () => {
          st.phase = "AIRBORNE"; look(p, along || tgt, along ? 0 : k);
          if (heliV) { heli.vx = heli.vz = heli.vy = 0; heli.altitude = p.y; heli.target = null; st.speed = 0; }
          else { st.speed = st.vp.cruiseSpeed; st.engaged = false; st.gearDown = false; }
        };
      }
      L.api.setView(seat === "chase");
      step(150, hold);
      // the moment
      const fireAt = (p) => {
        hold(); const sh = st.heading, sp = st.pitch;
        st.heading = Math.atan2(-(p.x - st.x), -(p.z - st.z)); st.pitch = Math.atan2(p.y - st.y, Math.hypot(p.x - st.x, p.z - st.z)) * 180 / Math.PI;
        st.missileCooldown = 0; L.fireMissile(); st.heading = sh; st.pitch = sp;
        const h0 = L.flags.tnHits || 0;
        for (let i = 0; i < 60 * 5 && (L.flags.tnHits || 0) === h0 && L.missilesList.some(m => m.alive); i++) { hold(); L.update(1 / 60); }
        tn.stagger = 0;
      };
      const shootTo = (left) => { for (let k = 0; k < 40 && tn.points > left; k++) { fireAt({ x: tn.x + (k % 3 - 1) * 12, y: chestY() - 10 + (k % 4) * 8, z: tn.z }); step(20, hold); } };
      if (moment === "announce") { L.tnForce(); for (let i = 0; i < 60 * 1.8; i++) { hold(); L.update(1 / 60); } }
      if (moment === "rise") { if (tn.phase === "sea") L.tnForce(); const up = T.announce + (T.riseTime - T.announce) * 0.7; for (let i = 0; i < 60 * 20 && !(tn.phase === "rising" && tn.t > up); i++) { hold(); L.update(1 / 60); } }
      if (vantage === "turnout") { const h0 = hold; hold = () => { h0(); st.bank = 25; }; }
      if (moment === "bang" || moment === "back") {
        // flying INTO it: let go at 300 m, straight at its chest; the bang, or him put back together a second later
        tn.hold = false; let banged = false, back = false, n = 0;
        while (n++ < 60 * 20) { L.api.clearStick(); const was = st.exploding; L.update(1 / 60); if (!was && st.exploding) banged = n; if (banged && was && !st.exploding) { back = n; break; } if (moment === "bang" && banged && n - banged > 18) break; }
        if (moment === "back") step(60);
        hold = () => {};
      }
      // a PLAIN hit: at a thigh, well off every weak spot (at its chest the bend takes the missile to the core)
      if (moment === "hit") { const c = tn.recs.find(r => r.tnPart === "legR").cap; fireAt({ x: c.a[0], y: c.a[1] - 8, z: c.a[2] }); step(8, hold); }
      if (moment === "weak") { const w = tn.weak.find(q => q.name === "core").world; fireAt({ x: w.x, y: w.y, z: w.z }); step(8, hold); }
      if (moment === "half") { shootTo(15); step(40, hold); }
      if (moment === "topple") { shootTo(15); tn.hold = false; L.tnForce("fall"); for (let i = 0; i < 60 * 2.4; i++) { hold(); L.update(1 / 60); } }
      if (moment === "splash" || moment === "fire" || moment === "sunk") {
        shootTo(15); tn.hold = false; L.tnForce("fall");
        const want = moment === "splash" ? () => tn.splashed && tn.fallT >= T.fallTime + 0.4 : moment === "fire" ? () => tn.splashed && tn.fallT >= T.fallTime + 3 : () => tn.phase === "down" && tn.t > (T.sink / T.sinkRate) + 3;
        for (let i = 0; i < 60 * 40 && !want(); i++) { hold(); L.update(1 / 60); }
      }
      if (moment === "reset") {
        L.tnForce("up"); tn.yaw = facing; shootTo(10); tn.hold = false; L.tnForce("fall");
        for (let i = 0; i < 60 * 40 && tn.phase !== "down"; i++) { hold(); L.update(1 / 60); }
        tn.member.state.next = 0; L.tnForce();
        for (let i = 0; i < 60 * 30 && tn.phase !== "up"; i++) { hold(); L.update(1 / 60); }
        tn.yaw = facing; tn.hold = true; step(30, hold);
      }
      window.__hold = hold;
      let spotNear = null;
      try { for (const s of (L.spots || [])) { const d = Math.hypot(s.mesh.position.x - st.x, s.mesh.position.z - st.z); if (!spotNear || d < spotNear) spotNear = Math.round(d); } } catch (e) {}
      return { phase: tn.phase, points: tn.points, lit: L.tnLampsLit(), arrow: tn.arrowOn, pos: [Math.round(st.x), Math.round(st.y), Math.round(st.z)], sparks: tn.spN, puffs: tn.puffN, debris: tn.debrisMesh.count, spotNear, rings: L.ringsGroupVisible() };
    }, v);
    await page.evaluate(() => { for (let i = 0; i < 2; i++) { window.__hold(); window.__paint(); } });
    const file = path.join(out, v.replace("@", "_").replace("~L", "_L") + ".png");
    await page.screenshot({ path: file, timeout: 180000 });
    console.log("wrote", file, JSON.stringify(info));
  }
  await browser.close(); srv.close();
}
module.exports = render;
if (require.main === module) {
  const args = process.argv.slice(2), root = args[0] && fs.existsSync(path.join(args[0], "cockpit")) ? args.shift() : path.join(__dirname, "..");
  const od = args.find(a => a.startsWith("outDir=")); const outDir = od ? od.slice(7) : null;
  const views = args.filter(a => !a.startsWith("outDir="));
  render(path.resolve(root), views.length ? views : DEFAULT, outDir);
}
