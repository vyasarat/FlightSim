"use strict";
// The traffic kit's evidence (vehiclekit.js): renders to LOOK at, and the frame
// cost of the busiest New York junction with its traffic, before and after.
//
//   node scripts/traffic_renders.js <beforeRoot> <afterRoot> [only]
//
// Each root is a directory holding a cockpit/ (a snapshot of the release before
// the kit, and this repo). Writes evidence/traffic/*.png from BOTH builds where
// the vantage exists in both (<name>-before.png / <name>.png), and
// evidence/traffic/perf.json. `only`: a comma list of vantages, or "perf".
//
//   lineup-front / lineup-rear   the six shapes and the police car, side by side
//   ny-red-seat(-land)           the driving seat, stopped at a red in New York,
//                                traffic queued beside him and crossing in front
//   hwy-lorry-seat / -chase      the motorway at cruise, a lorry ahead in his lane
//
// City traffic in the red-light render is PLACED for the picture (which slots,
// where) -- the traffic logic still drives them; nothing is placed in the perf.
//
// THE NUMBERS are SwiftShader's -- a software rasteriser at 820x1180 @1x, not an
// iPad. `calls` and `tris` transfer; `ms` is a whole forced frame and over-prices
// fill. The builds are timed INTERLEAVED, sample by sample, never in blocks, and
// more than one run is reported.
const fs = require("fs"), path = require("path");
const { launch, openGame, serve } = require("./art_rig.js");

const [rootA, rootB] = process.argv.slice(2, 4).map(p => path.resolve(p));
const only = (process.argv[4] || "").split(",").filter(Boolean);
const want = (n) => !only.length || only.includes(n);
const OUT = path.resolve(__dirname, "..", "evidence", "traffic");
const PORT_A = 8194, PORT_B = 8193;

// ---- page-side helpers, installed once per page ------------------------------
function installHelpers() {
  const L = window.__lp;
  // the surface under a point: the first thing a ray from above hits
  window.__surfaceY = (x, z, skip) => {
    const rc = new THREE.Raycaster(new THREE.Vector3(x, 3000, z), new THREE.Vector3(0, -1, 0));
    const meshes = [];
    L.scene.traverseVisible(o => { if (o.isMesh && !o.isInstancedMesh && !(skip && skip(o))) meshes.push(o); });
    const hits = rc.intersectObjects(meshes, false);
    return hits.length ? hits[0].point.y : L.terrainEff(x, z);
  };
  // draw one frame from a camera we place, not the game's
  window.__shoot = (pos, look, fov) => {
    const cam = L.camera, f0 = cam.fov;
    cam.position.set(pos[0], pos[1], pos[2]);
    cam.lookAt(look[0], look[1], look[2]);
    if (fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld(true);
    L.renderer.render(L.scene, cam);
    if (fov) { cam.fov = f0; cam.updateProjectionMatrix(); }
  };
}

// ---- the vantages -------------------------------------------------------------
// Each returns a `hold` run after every update, and may set window.__cam for a
// placed camera (otherwise the game's own camera, seat or chase, is used).
const VANTAGES = {
  // THE KIT, side by side on the New York runway: sedan, hatchback, taxi, van,
  // bus, lorry, police car. Front three-quarters and rear three-quarters.
  "lineup-front": () => lineup("front"),
  "lineup-rear": () => lineup("rear"),
  "lineup-cars": () => lineup("cars"),
  "police-r": () => lineup("police-r"),
  "police-l": () => lineup("police-l"),

  // THE DRIVING SEAT AT A RED: the wide-street signal nearest the hero tower,
  // him in the outer lane at the stop line, a taxi stopped beside him with a
  // car and a bus queued behind it, the oncoming queue facing him across the
  // junction, and cross traffic going through in front.
  "ny-red-seat": () => nyRed(),
  // THE MOTORWAY AT CRUISE with a lorry ahead of him in his lane.
  "hwy-lorry-seat": () => hwyLorry(false),
  "hwy-lorry-chase": () => hwyLorry(true),
};

function lineup(view) {
  const L = window.__lp, st = L.state, ap = L.AIRPORTS[0];
  L.api.setVehicle("car"); L.api.spawnAt(0, 0);
  const z0 = ap.cz - 300, x0 = 0;
  // him out of the way, behind the camera, so the shadows are drawn here
  const gy = window.__surfaceY(x0, z0);
  const g = new THREE.Group(); L.scene.add(g);
  const row = [["sedan", 1.2, 0xe0483e], ["hatch", 1.2, 0x2b4fb0], ["taxi", 1.2, 0xd4a72c], ["police"],
               ["van", 1.8, 0x36c46a], ["bus", 1.9, 0x2b4fb0], ["lorry", 2.3, 0xe0483e]];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), yAxis = new THREE.Vector3(0, 1, 0);
  // along -x, so from the front camera they read left to right as listed
  let x = x0 + 14;
  const place = (w) => { x -= w / 2; const at = x; x -= w / 2 + 2.6; return at; };
  const turn = -0.55;
  window.__lineup = [];
  for (const [name, lift, tint] of row) {
    if (/^police/.test(view) && name !== "police") { place(name === "lorry" ? 4.2 : 3.4); continue; }
    if (name === "police") {
      const pc = plBuildCar();
      plPaintCar(pc);
      pc.position.set(place(2.5), gy, z0); pc.rotation.y = turn;
      pc.userData.lamps[1].visible = false;
      g.add(pc);
      continue;
    }
    const m = vkMesh(name, lift, 1);
    q.setFromAxisAngle(yAxis, turn);
    m4.compose(new THREE.Vector3(place(name === "lorry" ? 4.2 : 3.4), gy + lift, z0), q, new THREE.Vector3(1, 1, 1));
    m.setMatrixAt(0, m4); m.setColorAt(0, new THREE.Color(tint));
    m.geometry.attributes.vkSpin.array[0] = 0.3;
    vkCommit(m, 1);
    g.add(m); window.__lineup.push(m);
  }
  const V = {
    front: { pos: [x0 - 8, gy + 9, z0 - 44], look: [x0 - 8, gy + 1.2, z0], fov: 45 },
    rear: { pos: [x0 - 2, gy + 8, z0 + 44], look: [x0 - 8, gy + 1.2, z0], fov: 45 },
    cars: { pos: [x0 + 1, gy + 3.2, z0 - 17], look: [x0 + 1, gy + 1.0, z0], fov: 50 },
    // the police car alone, from either side (the others are not placed)
    "police-r": { pos: [x0 - 5.25 + 7.6, gy + 2.4, z0 + 1.5], look: [x0 - 5.25, gy + 0.8, z0], fov: 45 },
    "police-l": { pos: [x0 - 5.25 - 7.6, gy + 2.4, z0 - 6.5], look: [x0 - 5.25, gy + 0.8, z0], fov: 45 },
  }[view];
  window.__cam = V;
  return () => { L.api.clearStick(); st.x = x0; st.z = z0 + (view === "rear" ? 70 : -70); st.y = gy; st.speed = 0; };
}
// paint one police car in the first livery, whatever the build calls it
function plPaintCar(pc) {
  const sc = Object.values(PL.schemes)[0], u = pc.userData;
  u.body.material = mattMat(sc.body); u.panel.material = mattMat(sc.panel);
  u.lamps[0].material = new THREE.MeshBasicMaterial({ color: sc.bar[0], fog: false });
  u.lamps[1].material = new THREE.MeshBasicMaterial({ color: sc.bar[1], fog: false });
}

function hwyLorry(chase) {
  const L = window.__lp, st = L.state, H = L.highway;
  L.api.setVehicle("car"); L.api.spawnAt(0, 0);
  for (let i = 0; i < 5; i++) L.update(1 / 60);
  const dir = 1, lane = 1, spd = L.TUNE.car.cruise;
  // an open stretch: no signal within the ~700 m he covers, or he runs a red --
  // the camera flash whites out the shot and a chase starts
  const js = L.lights.junctions.filter(j => j.onHighway).map(j => L.hwyNearest(j.x, j.z).s);
  let f = 0.30;
  while (f < 0.8 && js.some(s => s > H.length * f - 100 && s < H.length * f + 800)) f += 0.005;
  window.__hs = H.length * f;
  const at = (s, lat) => { const q = L.hwySampleAt(s); return { x: q.x - q.fz * lat, z: q.z + q.fx * lat, y: q.y, fx: q.fx, fz: q.fz }; };
  const lat = dir * (L.HW.medianW / 2 + L.HW.laneW * (lane + 0.5));
  // the lorry: the first truck slot, held ahead of him in his lane, at his speed.
  // (Left alone it would YIELD -- move over and outrun him -- which is the rule.)
  const tr = H.traffic.find(t => t.truck);
  return () => {
    L.api.clearStick();
    window.__hs += spd / 60 * dir;
    const q = at(window.__hs, lat);
    st.x = q.x; st.z = q.z; st.y = q.y; st.heading = Math.atan2(-q.fx * dir, -q.fz * dir); st.speed = spd;
    tr.alive = true; tr.spin = 0; tr.dir = dir; tr.lane = lane; tr.laneF = lane;
    tr.s = window.__hs + (chase ? 42 : 26) * dir; tr.speed = spd;
  };
}

function nyRed() {
  const L = window.__lp, st = L.state, C = L.streets.cities.ny, wide = L.TUNE.city.wideHalf;
  L.api.setVehicle("car"); L.api.spawnAt(0, 0);
  for (let i = 0; i < 5; i++) L.update(1 / 60);
  const hero = L.ROUTE_LANDMARKS.find(l => l.name === "skyline");
  const isWide = a => Math.abs(a.dz) > 0.9 && a.road.halfW >= wide;
  const n = C.nodes.filter(q => q.signal && q.arms.filter(isWide).length >= 2 && q.arms.some(a => Math.abs(a.dz) < 0.1))
    .sort((a, b) => Math.hypot(a.x - hero.x, a.z - hero.z) - Math.hypot(b.x - hero.x, b.z - hero.z))[0];
  const arm = n.arms.find(isWide), opp = n.arms.find(a => isWide(a) && a !== arm && Math.sign(a.dz) !== Math.sign(arm.dz));
  const cross = n.arms.filter(a => Math.abs(a.dz) < 0.1);
  const toward = a => (a.atStart ? -1 : 1);                 // the direction along a.road that arrives at n
  const lineS = (a, back) => (toward(a) > 0 ? a.road.len - back : back);
  const r = arm.road, dir = toward(arm);
  const me = {}; L.stPointAt(r, lineS(arm, 19), dir, 5.6, me);
  const h = Math.atan2(-me.fx, -me.fz), y = L.stSurfaceAt(me.x, me.z);
  // his light red (and so the oncoming one), the cross street's green
  const j = n.signal;
  for (const ph of [0, 3]) { j.phase = ph; if (L.stSignalAspect(n, r) === "red") break; }
  const phase = j.phase;
  // Staging: these slots are PINNED where they are put -- the traffic logic
  // drives everything else as usual.
  const T = L.stTraffic.list, used = new Set(), pins = [];
  const pick = (type) => { const v = T.find(o => o.type === type && !used.has(o)); if (v) used.add(v); return v; };
  const pin = (v, a, s, d, lat) => {
    if (!v) return;
    const p = {}; L.stPointAt(a.road, s, d, lat, p);
    v.__pin = { x: p.x, z: p.z, hx: p.fx, hz: p.fz, y: L.terrainMeshY(p.x, p.z) + L.CITY.groundLift + ST_TYPES[v.type].y };
    v.wx = p.x; v.wz = p.z;                                  // so it is never re-placed for being far
    v.alive = true; v.city = "ny"; v.road = a.road; v.dir = d; v.s = s; v.spin = 0; v.respawn = 0; v.path = null; v.next = null;
    pins.push(v);
  };
  pin(pick(1), arm, lineS(arm, 16.5), dir, 1.9);            // a taxi beside him, its nose ahead of his
  pin(pick(0), arm, lineS(arm, 26.5), dir, 1.9);            // a car behind it
  pin(pick(0), arm, lineS(arm, 30), dir, 5.6);              // and one behind him
  if (opp) {                                                 // the oncoming queue, facing him
    pin(pick(2), opp, lineS(opp, 24), toward(opp), 1.9);     // a bus
    pin(pick(0), opp, lineS(opp, 19), toward(opp), 5.6);
    pin(pick(1), opp, lineS(opp, 32), toward(opp), 5.6);
  }
  // going through in front: a taxi one way, a van the other
  if (cross[0]) pin(pick(1), cross[0], lineS(cross[0], -2), toward(cross[0]), 3.75);
  if (cross[1]) pin(pick(3), cross[1], lineS(cross[1], 12), toward(cross[1]), 3.75);
  const drive = stDriveVehicle;
  window.stDriveVehicle = function (v, dt, him) {
    if (!v.__pin) return drive(v, dt, him);
    const P = v.__pin; v.wx = P.x; v.wz = P.z; v.wy = P.y; v.hx = P.hx; v.hz = P.hz; v.sp = 0; v.alive = true; v.spin = 0;
  };
  return () => {
    L.api.clearStick(); st.x = me.x; st.z = me.z; st.y = y; st.heading = h; st.speed = 0;
    j.phase = phase; j.t = 99;
  };
}

// ---- the perf vantage: the same place on both builds -----------------------------
function perfVantage() {
  const L = window.__lp, st = L.state;
  L.api.setVehicle("car"); L.api.spawnAt(0, 0);
  const x = window.__perfAt.x, z = window.__perfAt.z, h = window.__perfAt.h;
  st.x = x; st.z = z; st.heading = h; st.speed = 0;
  st.y = L.stSurfaceAt(x, z);
  return () => { L.api.clearStick(); st.x = x; st.z = z; st.heading = h; st.speed = 0; };
}

async function setup(pg, src, frames) {
  await pg.evaluate(([src, frames, helpers]) => {
    const L = window.__lp;
    performance.now = () => window.__simTime;
    L.api.skipScreens();
    eval("(" + helpers + ")")();
    window.__cam = null;
    window.__hold = eval("(" + src + ")")() || (() => {});
    for (let i = 0; i < frames; i++) { L.update(1 / 60); window.__hold(); }
  }, [src, frames, installHelpers.toString()]);
}

async function settle(pg, chase) {
  await pg.evaluate((c) => {
    const L = window.__lp;
    L.api.setView(c);
    for (let i = 0; i < 90; i++) { L.update(1 / 60); window.__hold(); }
    for (let i = 0; i < 3; i++) { window.__paint(); window.__hold(); }
    if (window.__cam) window.__shoot(window.__cam.pos, window.__cam.look, window.__cam.fov);
  }, chase);
}

async function sample(pg, n) {
  return pg.evaluate((n) => {
    const L = window.__lp, r = L.renderer, gl = r.getContext(), px = new Uint8Array(4);
    r.info.autoReset = false;
    const ms = [];
    let calls = 0, tris = 0;
    for (let i = 0; i < n; i++) {
      r.info.reset();
      const t1 = globalThis.__realNow();
      window.__paint(); window.__hold();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      ms.push(globalThis.__realNow() - t1);
      calls = r.info.render.calls; tris = r.info.render.triangles;
    }
    r.info.autoReset = true;
    return { ms, calls, tris };
  }, n);
}

const median = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };

// source of the page-side functions a vantage calls
const PAGE_LIBS = [lineup, plPaintCar, hwyLorry, nyRed].map(f => f.toString()).join("\n");

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srvA = serve(rootA, PORT_A), srvB = serve(rootB, PORT_B);
  const browser = await launch();
  const errors = [];
  await (await openGame(browser, PORT_B, { width: 200, height: 200 })).close();

  const shots = [];
  for (const name of Object.keys(VANTAGES)) {
    if (!want(name)) continue;
    const views = /^(lineup|police)/.test(name) ? [[1180, 820, ""]]
      : /seat$/.test(name) ? [[820, 1180, ""], [1180, 820, "-land"]] : [[820, 1180, ""]];
    for (const [w, h, tag] of views) {
      for (const [port, sfx] of [[PORT_B, ""], [PORT_A, "-before"]]) {
        if (/^(lineup|police)/.test(name) && sfx) continue;                 // the old build has no kit
        const pg = await openGame(browser, port, { width: w, height: h, errors });
        await pg.evaluate((libs) => { globalThis.__realNow = performance.now.bind(performance); (0, eval)(libs); }, PAGE_LIBS);
        await setup(pg, VANTAGES[name].toString(), /^(lineup|police)/.test(name) ? 30 : 60 * 10);
        // a still of the kit has no HUD over it; every other shot is what he sees
        if (/^(lineup|police)/.test(name)) await pg.addStyleTag({ content: "body *{visibility:hidden!important} canvas{visibility:visible!important}" });
        await settle(pg, /chase$/.test(name));
        const file = path.join(OUT, `${name}${tag}${sfx}.png`);
        await pg.screenshot({ path: file });
        shots.push(file);
        await pg.close();
        console.log("wrote", path.relative(process.cwd(), file));
      }
    }
  }

  if (want("perf")) {
    // the busiest New York junction, as city_renders.js times it
    const probe = await openGame(browser, PORT_B, { width: 400, height: 300 });
    const at = await probe.evaluate(() => {
      const L = window.__lp, C = L.streets.cities.ny;
      L.noRender = true; L.api.skipScreens();
      for (let i = 0; i < 5; i++) L.update(1 / 60);
      const hero = L.ROUTE_LANDMARKS.find(l => l.name === "skyline");
      const n = C.nodes.filter(q => q.signal).sort((a, b) => Math.hypot(a.x - hero.x, a.z - hero.z) - Math.hypot(b.x - hero.x, b.z - hero.z))[0];
      const arm = n.arms.find(a => Math.abs(a.dz) > 0.9), r = arm.road, dir = arm.atStart ? -1 : 1, q = {};
      L.stPointAt(r, dir > 0 ? r.len - 22 : 22, dir, r.lo, q);
      return { x: q.x, z: q.z, h: Math.atan2(-q.fx, -q.fz), node: [n.x, n.z] };
    });
    await probe.close();
    const perf = { when: new Date().toISOString(), viewport: "820x1180 @1x", renderer: "SwiftShader (software), not an iPad",
                   at, runs: [] };
    for (let run = 0; run < 2; run++) {
      const pages = [];
      for (const port of [PORT_A, PORT_B]) {
        const pg = await openGame(browser, port, { width: 820, height: 1180, errors });
        await pg.evaluate((a) => { globalThis.__realNow = performance.now.bind(performance); window.__perfAt = a; }, at);
        await setup(pg, perfVantage.toString(), 60 * 12);
        pages.push(pg);
      }
      const res = {};
      for (const chase of [false, true]) {
        for (const pg of pages) await settle(pg, chase);
        for (const pg of pages) await sample(pg, 6);
        const acc = [[], []], last = [null, null];
        for (let round = 0; round < 8; round++) {
          for (const [i, pg] of pages.entries()) { const s = await sample(pg, 5); acc[i].push(...s.ms); last[i] = s; }
        }
        const live = await Promise.all(pages.map(pg => pg.evaluate(() => window.__lp.stTraffic.list.filter(v => v.alive).length)));
        res[chase ? "chase" : "seat"] = {
          before: { ms: +median(acc[0]).toFixed(2), calls: last[0].calls, tris: last[0].tris, traffic: live[0] },
          after: { ms: +median(acc[1]).toFixed(2), calls: last[1].calls, tris: last[1].tris, traffic: live[1] } };
      }
      perf.runs.push(res);
      for (const pg of pages) await pg.close();
      console.log("run", run, JSON.stringify(res));
    }
    perf.errors = errors.slice(0, 10);
    fs.writeFileSync(path.join(OUT, "perf.json"), JSON.stringify(perf, null, 1));
  }
  if (errors.length) console.log("page errors:", errors.slice(0, 10));
  await browser.close(); srvA.close(); srvB.close();
})();
