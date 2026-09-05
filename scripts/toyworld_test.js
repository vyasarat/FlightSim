// Focused runner; the same checks also run in headless_test.js.
const { chromium } = require('playwright-core');
const { serve } = require('./polish_check');
const { once } = require('events');
const path = require('path');
(async () => {
  const server = serve(path.resolve(__dirname, '..'), 8182); await once(server, 'listening');
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROME_HEADLESS_SHELL, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const results = [];
    const newPage = async (w, h) => {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      page.on('pageerror', e => { console.error(e); results.push(false); });
      page.on('console', m => { if (m.type() === 'error') { console.error(m.text()); results.push(false); } });
      await page.addInitScript('window.requestAnimationFrame=()=>0;localStorage.clear();');
      await page.goto('http://127.0.0.1:8182/cockpit/'); await page.waitForFunction(() => window.__lp);
      return { page };
    };
    await require('./toyworld_checks')({ newPage, shots: path.resolve(__dirname, '../qa-screenshots'), check: (name, ok, details) => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${details || ''}`); } });
    console.log(`${results.filter(Boolean).length}/${results.length} checks passed`); if (results.some(v => !v)) process.exitCode = 1;
  } finally { if (browser) await browser.close(); await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
