// ---------------------------------------------------------------------------
// The model inspection rig.
//
//   node scripts/model_rig.js <vehicleKey> [outPrefix]
//
// Renders three-quarter front, side, rear, front and top views of one vehicle
// and writes them to qa-screenshots/models/.
//
// THIS EXISTS BECAUSE THE FIRST ATTEMPT AT IT LIED THREE SEPARATE WAYS, and
// each guard below is one of them:
//
//   1. The camera-feel system resets camera.fov to TUNE.fov (72) inside the
//      frame callback, so a posed 30-degree shot came out at 72 and the subject
//      rendered a sixth of the size it should have. updateFeel is neutered.
//   2. applyCamera puts the camera straight back behind the vehicle. Neutered.
//   3. The drawing buffer is not preserved, so renderer.render() was gone by the
//      time the screenshot composited. The page is loaded with ?rig=1.
//
// And it reports the subject's projected pixel box with every shot, so a frame
// that missed is obvious from the log instead of being argued about from the
// picture.
// ---------------------------------------------------------------------------
const { chromium } = require("playwright-core");
const http = require("http"), fs = require("fs"), path = require("path");

const ROOT = path.resolve(__dirname, "..");
const KEY = process.argv[2] || "car";
const PREFIX = process.argv[3] || KEY;
const OUT = path.join(ROOT, "qa-screenshots", "models");
const PORT = 9100 + Math.floor(Math.random() * 400);
const W = 1000, H = 680;
const MIME = { ".js": "application/javascript", ".html": "text/html", ".json": "application/json",
               ".png": "image/png", ".glb": "model/gltf-binary", ".gltf": "model/gltf+json" };

const VIEWS = [
  ["threequarter", 218, 14],
  ["side",         270, 4],
  ["rear",         32,  14],
  ["front",        180, 8],
  ["top",          210, 62],
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split("?")[0]);
    if (p.endsWith("/")) p += "index.html";
    fs.readFile(path.join(ROOT, p), (e, d) => {
      if (e) { r.writeHead(404); r.end(); return; }
      r.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "text/plain" });
      r.end(d);
    });
  }).listen(PORT);

  const browser = await chromium.launch({
    executablePath: process.env.CHROME_HEADLESS_SHELL,
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--disable-dev-shm-usage"],
  });
  const pg = await browser.newPage({ viewport: { width: W, height: H } });
  await pg.addInitScript(`window.__rafQueue=[];window.__simTime=0;window.requestAnimationFrame=cb=>{__rafQueue.push(cb);return 1;};`);
  const errs = [];
  pg.on("pageerror", (e) => errs.push(e.message));
  await pg.goto(`http://127.0.0.1:${PORT}/cockpit/index.html?rig=1`, { timeout: 120000 });
  await pg.waitForFunction(() => window.__lp && window.__lp.state, null, { timeout: 120000 });

  // the model arrives asynchronously; wait for it rather than shooting the
  // fallback geometry and calling it the imported body
  await pg.waitForFunction((k) => {
    const s = window.__lp && window.__lp.modelState;
    return s && (s[k] === "ready" || s[k] === "failed");
  }, KEY, { timeout: 120000 }).catch(() => {});
  const setup = await pg.evaluate((key) => {
    const L = window.__lp, st = L.state;
    L.noRender = true;
    L.api.skipScreens();
    L.api.setVehicle(key);
    L.api.placeOnRunway();
    L.api.setView(true);
    for (let i = 0; i < 90; i++) { L.api.setStick(0, 0); L.update(1 / 60); }
    L.api.clearStick();
    st.speed = 0;
    for (let i = 0; i < 30; i++) L.update(1 / 60);
    // a clean plate
    for (const id of ["hud", "dash", "brow", "progressStrip"]) {
      const e = document.getElementById(id); if (e) e.style.display = "none";
    }
    document.querySelectorAll(".roundBtn").forEach(b => (b.style.display = "none"));
    // guards 1 and 2
    window.applyCamera = function () {};
    window.updateFeel = function () {};
    return { preserved: !!L.renderer.getContext().getContextAttributes().preserveDrawingBuffer,
             hasModel: !!L.vehicleModel,
             modelState: L.modelState ? L.modelState[key] : "n/a",
             imported: !!(L.vehicleModel && L.vehicleModel.userData.imported) };
  }, KEY);
  console.log(`rig: preserveDrawingBuffer=${setup.preserved}  model=${setup.hasModel}  glb=${setup.modelState}  imported=${setup.imported}`);

  // Which end is the nose, measured on the model AS IT SHIPS -- in its own local
  // frame, after preparation. Squinting at a render to decide this wasted two
  // rounds; a vehicle tapers toward its nose and is blunt at its tail.
  const orient = await pg.evaluate(() => {
    const L = window.__lp, m = L.vehicleModel;
    if (!m) return null;
    m.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(m.matrixWorld).invert();
    const v = new THREE.Vector3();
    const pts = [];
    m.traverse((o) => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 11) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
        pts.push([v.x, v.y, v.z]);
      }
    });
    if (!pts.length) return null;
    let minz = Infinity, maxz = -Infinity;
    for (const p of pts) { if (p[2] < minz) minz = p[2]; if (p[2] > maxz) maxz = p[2]; }
    const len = maxz - minz;
    const band = (lo, hi) => {
      const sel = pts.filter(p => p[2] >= minz + len * lo && p[2] <= minz + len * hi);
      if (!sel.length) return { w: 0, h: 0 };
      let xa = Infinity, xb = -Infinity, ya = Infinity, yb = -Infinity;
      for (const p of sel) { xa = Math.min(xa, p[0]); xb = Math.max(xb, p[0]); ya = Math.min(ya, p[1]); yb = Math.max(yb, p[1]); }
      return { w: +(xb - xa).toFixed(2), h: +(yb - ya).toFixed(2) };
    };
    const neg = band(0.0, 0.16), pos = band(0.84, 1.0);
    return { neg, pos, noseAtNegZ: (neg.w + neg.h) < (pos.w + pos.h), samples: pts.length };
  });
  if (orient) {
    console.log(`  orientation: -Z end ${JSON.stringify(orient.neg)}  +Z end ${JSON.stringify(orient.pos)}`);
    console.log(`  nose at -Z (what this game wants): ${orient.noseAtNegZ ? "YES" : "NO -- flip TUNE.models." + KEY + ".yaw"}`);
  }
  if (!setup.preserved) console.log("  WARNING: buffer not preserved -- captures may be blank");

  for (const [name, az, el] of VIEWS) {
    const info = await pg.evaluate(([az, el, w, h]) => {
      const L = window.__lp;
      const m = L.vehicleModel;
      if (!m) return { missing: true };
      m.updateWorldMatrix(true, true);
      const bb = new THREE.Box3().setFromObject(m);
      const c = bb.getCenter(new THREE.Vector3());
      const size = bb.getSize(new THREE.Vector3());
      const fov = 30;
      const dist = Math.max(size.x, size.y, size.z) * 0.5 / Math.tan(fov * Math.PI / 360) * 1.45;
      const a = az * Math.PI / 180 + L.state.heading, e = el * Math.PI / 180;
      const place = () => {
        L.camera.position.set(c.x + Math.sin(a) * Math.cos(e) * dist,
                              c.y + Math.sin(e) * dist,
                              c.z + Math.cos(a) * Math.cos(e) * dist);
        L.camera.up.set(0, 1, 0);
        L.camera.lookAt(c);
        L.camera.fov = fov;
        L.camera.updateProjectionMatrix();
      };
      L.noRender = false;
      for (let i = 0; i < 3; i++) {
        place();
        const q = window.__rafQueue; window.__rafQueue = [];
        window.__simTime += 16.7;
        if (q.length) q[q.length - 1](window.__simTime);
      }
      place();
      L.noRender = true;
      // where the subject actually landed, in pixels
      let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
      for (const sx of [bb.min.x, bb.max.x]) for (const sy of [bb.min.y, bb.max.y]) for (const sz of [bb.min.z, bb.max.z]) {
        const v = new THREE.Vector3(sx, sy, sz).project(L.camera);
        minx = Math.min(minx, (v.x * 0.5 + 0.5) * w); maxx = Math.max(maxx, (v.x * 0.5 + 0.5) * w);
        miny = Math.min(miny, (0.5 - v.y * 0.5) * h); maxy = Math.max(maxy, (0.5 - v.y * 0.5) * h);
      }
      return {
        size: [+size.x.toFixed(2), +size.y.toFixed(2), +size.z.toFixed(2)],
        px: [Math.round(minx), Math.round(miny), Math.round(maxx - minx), Math.round(maxy - miny)],
        fov: +L.camera.fov.toFixed(0),
        fillPct: +(((maxx - minx) * (maxy - miny)) / (w * h) * 100).toFixed(1),
      };
    }, [az, el, W, H]);
    if (info.missing) { console.log(`  ${name}: NO MODEL`); continue; }
    await pg.screenshot({ path: path.join(OUT, `${PREFIX}-${name}.png`) });
    // ...and a version cropped to the box we just measured. Cropping afterwards
    // from remembered numbers went wrong three times; clipping at capture time
    // cannot drift from the render it came from.
    {
      const m = 26;
      const x = Math.max(0, Math.round(info.px[0] - m));
      const y = Math.max(0, Math.round(info.px[1] - m));
      const w = Math.min(W - x, Math.round(info.px[2] + m * 2));
      const h = Math.min(H - y, Math.round(info.px[3] + m * 2));
      if (w > 8 && h > 8) {
        await pg.screenshot({ path: path.join(OUT, `${PREFIX}-${name}-crop.png`), clip: { x, y, width: w, height: h } });
      }
    }
    console.log(`  ${name.padEnd(13)} px ${JSON.stringify(info.px)}  fills ${info.fillPct}%  fov ${info.fov}  size ${JSON.stringify(info.size)}`);
  }
  if (errs.length) console.log("PAGE ERRORS:", errs.slice(0, 3));
  await browser.close();
  srv.close();
})();
