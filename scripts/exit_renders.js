"use strict";
// The city ways in, seen from the driving seat: what the gantry, its lane and
// the ramp look like from 300 m, from 150 m and at the ramp's mouth, for each of
// the four ways in (both cities, both carriageways), portrait and landscape,
// plus the chase view from 300 m.
//
//   node scripts/exit_renders.js [root]
//
// Writes evidence/exits/<city>-<way>-<vantage>-<view>-<w>x<h>.png and
// evidence/exits/visibility.json: for every seat vantage, where on the screen
// the gantry's panel and the ramp land (normalised device coordinates) and
// whether the car's own body -- its A-pillars, its roof -- stands between his
// eye and them. The glass does not count: it is what he looks through.
const fs = require("fs"), path = require("path");
const { launch, openGame, serve } = require("./art_rig.js");

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const OUT = path.resolve(__dirname, "..", "evidence", "exits");
const PORT = 8196;

// in page: put him on the approach to one way in, `back` metres short of its
// gantry (or at the ramp's mouth when back is "mouth"), and hold him there
function placeFn(args) {
  const [city, way, back] = args;
  const L = window.__lp, st = L.state;
  L.api.setVehicle("car"); L.api.spawnAt(0, 0);
  for (let i = 0; i < 5; i++) L.update(1 / 60);
  const rec = L.streets.cities[city].ramps[way], g = rec.gantry, c = g.c;
  const mouthS = rec.spur[0].hs;
  // 300 and 150 are measured to the gantry; at the mouth he has moved over to
  // the painted lane, the way the gesture takes him
  const s = back === "mouth" ? mouthS - c * 12 : g.s - c * back;
  const lane = back === "mouth" ? 1.5 : 0.5;
  const q = L.hwySampleAt(s), lat = c * (L.HW.medianW / 2 + L.HW.laneW * lane);
  const x = q.x - q.fz * lat, z = q.z + q.fx * lat, y = q.y, h = Math.atan2(-q.fx * c, -q.fz * c);
  const v = L.CAR.cruise;
  window.__target = { panel: g.panel, ramp: rec.spur[Math.min(rec.spur.length - 1, 10)] };
  return () => { L.api.clearStick(); st.x = x; st.z = z; st.y = y; st.heading = h; st.speed = v; L.car.yield = 1; };
}

// in page: where the targets land on screen, and whether the body hides them
function visibility() {
  const L = window.__lp, cam = L.camera, T = window.__target, out = {};
  cam.updateMatrixWorld();
  const body = [];
  const addOpaque = (o) => o && o.traverse(m => {
    if (!m.isMesh || !m.visible) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    if (mats.every(mt => mt.transparent && mt.opacity < 0.95)) return;
    body.push(m);
  });
  addOpaque(L.vehicleModel); addOpaque(L.car.cabin);
  const ray = new THREE.Raycaster();
  for (const k of ["panel", "ramp"]) {
    const p = new THREE.Vector3(T[k].x, (T[k].y || 0) + (k === "ramp" ? 0.5 : 0), T[k].z);
    const ndc = p.clone().project(cam);
    const dir = p.clone().sub(cam.position), dist = dir.length(); dir.normalize();
    ray.set(cam.position, dir); ray.far = dist;
    const hit = ray.intersectObjects(body, false)[0];
    out[k] = { ndc: [+ndc.x.toFixed(3), +ndc.y.toFixed(3)], onScreen: Math.abs(ndc.x) < 1 && Math.abs(ndc.y) < 1 && ndc.z < 1,
               dist: Math.round(dist), hiddenBy: hit ? (hit.object.name || hit.object.parent && hit.object.parent.name || "body") + " at " + hit.distance.toFixed(2) + " m" : null };
  }
  return out;
}

async function shot(browser, errors, spec, w, h, chase) {
  const pg = await openGame(browser, PORT, { width: w, height: h, errors });
  await pg.evaluate(([src, args, chase]) => {
    const L = window.__lp;
    performance.now = () => window.__simTime;
    L.api.skipScreens();
    window.__hold = eval("(" + src + ")")(args) || (() => {});
    for (let i = 0; i < 60 * 10; i++) { L.update(1 / 60); window.__hold(); }     // traffic fills in
    L.api.setView(chase);
    for (let i = 0; i < 90; i++) { L.update(1 / 60); window.__hold(); }
    for (let i = 0; i < 3; i++) { window.__paint(); window.__hold(); }
  }, [placeFn.toString(), spec, chase]);
  const vis = chase ? null : await pg.evaluate(visibility);
  const name = `${spec[0]}-${spec[1] === "inNear" ? "near" : "far"}-${spec[2] === "mouth" ? "mouth" : spec[2] + "m"}-${chase ? "chase" : "seat"}-${w}x${h}`;
  await pg.screenshot({ path: path.join(OUT, name + ".png") });
  await pg.close();
  return { name, vis };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = serve(ROOT, PORT);
  const browser = await launch();
  const errors = [];
  await (await openGame(browser, PORT, { width: 200, height: 200 })).close();   // the first context comes up lost
  const report = [];
  for (const city of ["ny", "ca"]) for (const way of ["inNear", "inFar"]) {
    for (const back of [300, 150, "mouth"]) {
      for (const [w, h] of [[820, 1180], [1180, 820]]) {
        const r = await shot(browser, errors, [city, way, back], w, h, false);
        report.push(r); console.log(r.name, JSON.stringify(r.vis));
      }
    }
    const r = await shot(browser, errors, [city, way, 300], 820, 1180, true);
    report.push(r); console.log(r.name);
  }
  fs.writeFileSync(path.join(OUT, "visibility.json"), JSON.stringify({ report, errors: errors.slice(0, 10) }, null, 1));
  await browser.close(); srv.close();
})();
