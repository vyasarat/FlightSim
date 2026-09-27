"use strict";
// The art rig: one headless page on a chosen build, portrait, with the rAF stub
// the harness uses, and a paint() that draws exactly one frame on demand.
// Shared by art_renders.js (the before/after vantages) and art_map.js.
// Evidence goes to the gitignored evidence/ folder.
const path = require("path");
const { serve } = require("./polish_check.js");

async function launch() {
  const { chromium } = require("playwright-core");
  return chromium.launch({
    executablePath: process.env.CHROME_HEADLESS_SHELL,
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
           "--disable-dev-shm-usage", "--js-flags=--max-old-space-size=1024"],
  });
}

// root: a directory holding cockpit/ (the repo, or a snapshot of an older build)
async function openGame(browser, port, { width = 820, height = 1180, errors = [] } = {}) {
  const pg = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await pg.addInitScript(() => {
    try { localStorage.clear(); } catch (e) {}
    let seed = 0x2F6E2B1;
    Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    window.__rafQueue = []; window.__simTime = 0;
    window.requestAnimationFrame = cb => { window.__rafQueue.push(cb); return window.__rafQueue.length; };
  });
  pg.on("pageerror", e => errors.push(String(e.message)));
  pg.on("console", m => { if (m.type() === "error" && !/flatShading/.test(m.text())) errors.push(m.text().slice(0, 300)); });
  await pg.goto(`http://127.0.0.1:${port}/cockpit/index.html`, { timeout: 120000 });
  await pg.waitForFunction(() => window.__lp && window.__lp.state, null, { timeout: 120000 });
  // the art build loads its atlas asynchronously; an older build has none to wait for
  await pg.waitForFunction(() => !window.__lp.artReady || window.__lp.artReady(), null, { timeout: 60000 });
  await pg.evaluate(() => {
    const L = window.__lp;
    L.noRender = true;
    L.ROUTE_SCALE_V = (typeof ROUTE_SCALE === "function" ? ROUTE_SCALE() : 1) || 1;
    window.__paint = () => {
      L.noRender = false;
      const q = window.__rafQueue; window.__rafQueue = [];
      window.__simTime += 1000 / 60;
      if (q.length) q[q.length - 1](window.__simTime);
      L.noRender = true;
    };
  });
  return pg;
}

module.exports = { launch, openGame, serve };
