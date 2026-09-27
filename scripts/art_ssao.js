"use strict";
// SSAO and ACES, priced INTERLEAVED on the heaviest scenes -- never shipped.
//
//   node scripts/art_ssao.js [vantage,...]
//
// SSAO is three r128's own SSAOPass (examples/js, fetched into the gitignored
// evidence/art/vendor/ -- it is test-only and never reaches cockpit/). Each
// sample is five frames, each forced to completion with a 1-pixel readPixels;
// plain, SSAO and ACES take turns, six rounds, and the medians are compared.
//
// Two things make this number FLATTER SSAO than it would be in the game:
//  - the normal pass is kept from redrawing the shadow map (a naive pass
//    renders the whole shadow pass a second time);
//  - the game's logarithmic depth buffer breaks SSAOPass's depth reconstruction,
//    so what it draws is wrong. Making it right costs more, not less.
// And one that is simply lost: the composer draws into a render target with no
// MSAA, so the whole frame loses its anti-aliasing.
const fs = require("fs"), path = require("path");
const { launch, openGame, serve } = require("./art_rig.js");
const src = fs.readFileSync(path.join(__dirname, "art_renders.js"), "utf8");
const VANTAGES = eval("(" + src.slice(src.indexOf("const VANTAGES = {") + 17, src.indexOf("\n};\n", src.indexOf("const VANTAGES = {")) + 2) + ")");
const names = (process.argv[2] || "tunnel-portal,highway-car,ny-300m").split(",");
const VENDOR = path.resolve(__dirname, "..", "evidence", "art", "vendor");
const LIBS = ["EffectComposer.js", "RenderPass.js", "ShaderPass.js", "CopyShader.js", "SimplexNoise.js", "SSAOShader.js", "SSAOPass.js"];
const median = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };

(async () => {
  const srv = serve(path.resolve(__dirname, ".."), 8191);
  const b = await launch();
  const out = { when: new Date().toISOString(), renderer: "SwiftShader (software), 820x1180 @1x -- not an iPad", scenes: {} };
  for (const name of names) {
    const pg = await openGame(b, 8191, { width: 820, height: 1180 });
    await pg.evaluate(() => { globalThis.__realNow = performance.now.bind(performance); });
    for (const f of LIBS) await pg.addScriptTag({ content: fs.readFileSync(path.join(VENDOR, f), "utf8") });
    await pg.evaluate((s) => {
      const L = window.__lp; performance.now = () => window.__simTime; L.api.skipScreens();
      window.__hold = eval("(" + s + ")")() || (() => {});
      L.api.setView(true);
      for (let i = 0; i < 270; i++) { L.update(1 / 60); window.__hold(); }
      const r = L.renderer, size = r.getDrawingBufferSize(new THREE.Vector2());
      const composer = new THREE.EffectComposer(r);
      const ssao = new THREE.SSAOPass(L.scene, L.camera, size.x, size.y);
      ssao.kernelRadius = 8; ssao.minDistance = 0.002; ssao.maxDistance = 0.08;
      const over = ssao.renderOverride.bind(ssao);
      ssao.renderOverride = function () {
        const au = r.shadowMap.autoUpdate; r.shadowMap.autoUpdate = false;
        over.apply(null, arguments);
        r.shadowMap.autoUpdate = au;
      };
      composer.addPass(ssao);
      window.__ssao = { composer, ssao };
      const flush = () => L.scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
      window.__mode = (m) => {
        const want = m === "aces" ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
        if (r.toneMapping !== want) { r.toneMapping = want; flush(); }
      };
      window.__frames = (m, n) => {
        const gl = r.getContext(), px = new Uint8Array(4), ms = [];
        window.__mode(m);
        r.info.autoReset = false;
        let calls = 0, tris = 0;
        for (let i = 0; i < n; i++) {
          L.update(1 / 60); window.__hold();
          r.info.reset();
          const t0 = globalThis.__realNow();
          if (m === "ssao") composer.render(); else r.render(L.scene, L.camera);
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          ms.push(globalThis.__realNow() - t0);
          calls = r.info.render.calls; tris = r.info.render.triangles;
        }
        r.info.autoReset = true;
        return { ms, calls, tris };
      };
    }, VANTAGES[name].toString());
    const modes = ["plain", "ssao", "aces"];
    for (const m of modes) await pg.evaluate((m) => { window.__frames(m, 8); }, m);     // warm each (and compile)
    const acc = { plain: [], ssao: [], aces: [] }, last = {};
    for (let round = 0; round < 6; round++) {
      for (const m of modes) {
        const s = await pg.evaluate((m) => window.__frames(m, 5), m);
        acc[m].push(...s.ms); last[m] = s;
      }
    }
    await pg.evaluate(() => window.__mode("ssao"));
    await pg.evaluate(() => { window.__ssao.composer.render(); });
    await pg.screenshot({ path: path.resolve(__dirname, "..", "evidence", "art", `ssao-${name}.png`) });
    const r = {};
    for (const m of modes) r[m] = { frameMs: +median(acc[m]).toFixed(1), calls: last[m].calls, tris: last[m].tris };
    r.ssaoPct = +((r.ssao.frameMs - r.plain.frameMs) / r.plain.frameMs * 100).toFixed(1);
    r.acesPct = +((r.aces.frameMs - r.plain.frameMs) / r.plain.frameMs * 100).toFixed(1);
    out.scenes[name] = r;
    console.log(`${name.padEnd(14)} plain ${r.plain.frameMs} ms (${r.plain.calls} calls, ${r.plain.tris} tris) | ssao ${r.ssao.frameMs} ms (+${r.ssaoPct}%, ${r.ssao.calls} calls, ${r.ssao.tris} tris) | aces ${r.aces.frameMs} ms (${r.acesPct >= 0 ? "+" : ""}${r.acesPct}%)`);
    await pg.close();
  }
  fs.writeFileSync(path.resolve(__dirname, "..", "evidence", "art", "ssao.json"), JSON.stringify(out, null, 2));
  await b.close(); srv.close();
})().catch(e => { console.error("FAILED", e); process.exit(1); });
