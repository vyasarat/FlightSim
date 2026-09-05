// Temporary fixtures, raw HTTP paths (clients must not normalize away attacks).
const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { once } = require('events');
const { serve } = require('./polish_check');
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-server-'));
  let server;
  try {
    const root = path.join(tmp, 'root');
    fs.mkdirSync(root);
    fs.mkdirSync(path.join(tmp, 'root-sibling'));
    fs.writeFileSync(path.join(root, 'index.html'), 'home');
    fs.writeFileSync(path.join(root, 'space name.txt'), 'inside');
    fs.writeFileSync(path.join(tmp, 'audit-probe.txt'), 'outside');
    fs.writeFileSync(path.join(tmp, 'root-sibling', 'secret'), 'outside');
    fs.symlinkSync(tmp, path.join(root, 'escape'));
    fs.symlinkSync(path.join(tmp, 'audit-probe.txt'), path.join(root, 'file-link'));
    fs.symlinkSync(path.join(root, 'index.html'), path.join(root, 'safe-link'));
    server = serve(root, 0);
    await once(server, 'listening');
    assert.equal(server.address().address, '127.0.0.1');
    const get = url => new Promise((resolve, reject) => {
      http.get({ host: '127.0.0.1', port: server.address().port, path: url }, res => {
        let body = ''; res.on('data', c => body += c);
        res.on('end', () => resolve([res.statusCode, body]));
      }).on('error', reject);
    });
    for (const url of ['/..%2faudit-probe.txt', '/%2e%2e/audit-probe.txt', '/../audit-probe.txt', '/../root-sibling/secret', '/escape/audit-probe.txt', '/file-link']) {
      assert.deepEqual(await get(url), [403, ''], url);
    }
    for (const url of ['/%', '/%FF', '/%00', '/..%5caudit-probe.txt']) assert.deepEqual(await get(url), [400, ''], url);
    assert.deepEqual(await get('/missing'), [404, '']);
    assert.deepEqual(await get('/'), [200, 'home']);
    assert.deepEqual(await get('/safe-link'), [200, 'home']);
    assert.deepEqual(await get('/space%20name.txt?x=1'), [200, 'inside']);
    console.log('PASS polish server: containment, symlinks, malformed paths, loopback, normal files');
  } finally {
    if (server) await new Promise(r => server.close(r));
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
