#!/usr/bin/env node
// Local-only development server. Uses the same traversal-safe server as QA.
const path = require('path');
const { serve } = require('./polish_check');
const port = Number(process.env.PORT || 8190);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('PORT must be between 1024 and 65535');
const server = serve(path.resolve(__dirname, '..'), port);
server.on('listening', () => console.log(`Little Pilot development: http://127.0.0.1:${port}/cockpit/`));
server.on('error', e => { console.error(e.message); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
