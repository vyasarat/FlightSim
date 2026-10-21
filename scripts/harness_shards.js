"use strict";
// THE HARNESS, SHARDED (v177). The full run had grown to 108 minutes, and no one module
// did it: the time is spread over sixty of them. After the dearest checks were cut (the race
// sample, the police frames), one run was still about 95, so the run is split -- and every
// check still runs on every full run; nothing moved out but the race sweep (race_sweep.js):
//
//   - `node scripts/headless_test.js` (no HARNESS_SHARD) is the ORCHESTRATOR. It starts
//     HARNESS_SHARDS copies of itself (default 4), each with its own static server on its own
//     port (8177, 8178, ...), its own browser and its own log (evidence/harness-shard-<k>.txt).
//   - Shard 0 runs the inline checks first, in their order, exactly as before (one page
//     reused, state carried). Every shard then takes the next module nobody has claimed,
//     dearest first by COST (a lock file per module: each runs exactly once, on whichever
//     shard is free -- so a cost the table has wrong costs balance, not correctness).
//   - THE SOLO PHASE. A check that judges milliseconds (not draw calls, which a frame counts
//     exactly) means nothing on a machine three other shards are using. When every shard has
//     finished, one more process runs those checks ALONE, as the whole harness used to:
//       boat_checks       harbour perf (withMs < 220)           -- its timing part, perf: "only"
//       sea_checks        busiest harbour (withMs < 240)        -- its timing part
//       yacht_checks      drawbridge (withMs < 220)             -- its timing part
//       dadmode_checks    a valley chunk under 3x a plains one  -- its timing part
//       events_perf_checks  frame time in the meteor shower (from T-EV) -- the whole module
//     In the shards those four modules run with perf: "skip", everything else they check.
//     (The FPS smoke test is advisory, never judged. noisy_drive keeps to the real clock but
//     its hand is keyed to the frame it drives, so load slows it without changing what it does.)
//   - At the end it prints every log in order, where the time went, and the one count,
//     `N/M checks passed`, exactly as before.
//
// HARNESS_SHARDS=1 is the old serial run, on :8177, in one process, everything in its order.
// A module's page is a fresh context with its own seeded Math.random, so which shard runs it
// changes nothing it sees.
const fs = require("fs"), path = require("path"), http = require("http"), { spawn } = require("child_process");

// minutes each module took in a serial run (v177's own clock, its pages' closing included);
// only the ORDER they are claimed in, dearest first, comes from it
const COST = {
  "corner_cam_checks": 7.5, "sea_checks": 5.7, "noisy_drive": 5.0, "city_checks": 4.9,
  "race_track_checks": 4.8, "monstertruck_checks": 4.5, "track_checks": 4.4, "yacht_checks": 4.2,
  "boat_checks": 4.7, "road_checks": 3.2, "launchsite_checks": 3.2, "rocketsled_checks": 2.9,
  "race_checks": 2.9, "fireworksbarge_checks": 2.7, "workshop_play_checks": 2.4, "robot_play_checks": 2.2,
  "garden_play_checks": 2.1, "lights_police_checks": 2.0, "heli_play_checks": 1.9, "toyworld_checks": 1.9,
  "cleanup_checks": 1.7, "payoff_size_checks": 1.5, "dadmissions_checks": 1.4, "engine_sound_checks": 1.4,
  "car_feel_checks": 1.4, "event_pool_checks": 1.3, "corvette_checks": 1.3,
};
const DEFAULT = 1.0;
const SOLO = ["events_perf_checks"];                                   // the whole module, alone
const PERF_PARTS = ["boat_checks", "sea_checks", "yacht_checks", "dadmode_checks"];   // their timing part, alone
const BASE_PORT = 8177;

// [name, opts] pairs, dearest first (ties keep the harness's order)
function order(list) {
  const cost = ([n]) => COST[n.replace("./", "")] || DEFAULT;
  return list.map((m, i) => [m, i]).sort((a, b) => cost(b[0]) - cost(a[0]) || a[1] - b[1]).map(x => x[0]);
}

// a module is run by the first shard to create its lock file (HARNESS_CLAIMS, set by the orchestrator)
function claim(key) {
  const dir = process.env.HARNESS_CLAIMS;
  if (!dir) return true;
  try { fs.closeSync(fs.openSync(path.join(dir, key.replace(/[^\w]+/g, "_")), "wx")); return true; }
  catch (e) { return false; }
}

function portBusy(port) {
  return new Promise(resolve => {
    const req = http.get(`http://127.0.0.1:${port}/cockpit/index.html`, res => { res.resume(); resolve(true); });
    req.on("error", () => resolve(false));
  });
}

async function orchestrate(file, shards) {
  if (!process.env.CHROME_HEADLESS_SHELL) { console.error("Set CHROME_HEADLESS_SHELL to a chrome-headless-shell binary"); process.exit(1); }
  const ROOT = path.resolve(__dirname, ".."), EV = path.join(ROOT, "evidence");
  fs.mkdirSync(EV, { recursive: true });
  for (let k = 0; k <= shards; k++) if (await portBusy(BASE_PORT + k)) {
    console.error(`Port ${BASE_PORT + k} is already serving something; stop it first.`);
    process.exit(2);
  }
  const T0 = Date.now(), kids = [], logs = [], ends = new Array(shards).fill(null);
  const claims = path.join(EV, "harness-claims");
  fs.rmSync(claims, { recursive: true, force: true }); fs.mkdirSync(claims, { recursive: true });
  console.log(`INFO  harness in ${shards} shards (ports ${BASE_PORT}-${BASE_PORT + shards - 1}; logs in evidence/harness-shard-<k>.txt), then the solo phase on ${BASE_PORT + shards}`);
  for (let k = 0; k < shards; k++) {
    const log = path.join(EV, `harness-shard-${k}.txt`), fd = fs.openSync(log, "w");
    logs.push(log);
    const kid = spawn(process.execPath, [file], { env: { ...process.env, HARNESS_SHARD: String(k), HARNESS_SHARDS: String(shards), HARNESS_CLAIMS: claims }, stdio: ["ignore", fd, fd] });
    kid.on("exit", code => { ends[k] = { code: code === null ? 2 : code, s: (Date.now() - T0) / 1000 }; });
    kids.push(kid);
  }
  const killAll = () => { for (const c of kids) try { c.kill("SIGKILL"); } catch (e) {} };
  process.on("SIGINT", () => { killAll(); process.exit(130); });
  process.on("SIGTERM", () => { killAll(); process.exit(143); });
  const count = txt => { let p = 0, f = 0; for (const l of txt.split("\n")) { if (l.startsWith("PASS  ")) p++; else if (l.startsWith("FAIL  ")) f++; } return { p, f }; };
  const read = f => { try { return fs.readFileSync(f, "utf8"); } catch (e) { return ""; } };
  let lastNote = Date.now();
  while (ends.some(e => !e)) {
    await new Promise(r => setTimeout(r, 2000));
    if (Date.now() - lastNote < 120000) continue;
    lastNote = Date.now();
    const parts = logs.map((f, k) => { const c = count(read(f)); return `${k}:${c.p + c.f}${c.f ? `(${c.f} FAIL)` : ""}${ends[k] ? " done" : ""}`; });
    console.log(`INFO  ${((Date.now() - T0) / 60000).toFixed(0)} min: checks per shard ${parts.join("  ")}`);
  }
  // THE SOLO PHASE: the timing checks, alone on the machine now
  {
    const k = shards, log = path.join(EV, `harness-shard-solo.txt`), fd = fs.openSync(log, "w");
    logs.push(log); ends.push(null);
    console.log(`INFO  ${((Date.now() - T0) / 60000).toFixed(0)} min: every shard done; the solo phase (${SOLO.concat(PERF_PARTS.map(m => m + "'s timing part")).join(", ")}) alone`);
    const kid = spawn(process.execPath, [file], { env: { ...process.env, HARNESS_SHARD: String(k), HARNESS_SHARDS: String(shards) }, stdio: ["ignore", fd, fd] });
    kids.push(kid);
    await new Promise(r => kid.on("exit", code => { ends[k] = { code: code === null ? 2 : code, s: (Date.now() - T0) / 1000 }; r(); }));
  }
  // every shard's log, in shard order, without its own count and clock
  let pass = 0, fail = 0, stalled = [], errored = [];
  for (let k = 0; k <= shards; k++) {
    const txt = read(logs[k]), c = count(txt);
    pass += c.p; fail += c.f;
    if (/HARNESS STALLED/.test(txt)) stalled.push(k);
    else if (ends[k].code !== 0 && ends[k].code !== 1) errored.push(k);
    console.log(`\n===== ${k === shards ? "solo phase" : "shard " + k} (ended at ${(ends[k].s / 60).toFixed(1)} min, exit ${ends[k].code}) =====`);
    console.log(txt.split("\n").filter(l => !/^\d+\/\d+ checks passed/.test(l) && !l.startsWith("TIME  ")).join("\n").trimEnd());
  }
  // where the time went, all shards together
  const mods = [], checks = [];
  for (let k = 0; k <= shards; k++) {
    try { const j = JSON.parse(read(path.join(EV, `harness-times-${k}.json`))); mods.push(...j.modules.map(m => ({ ...m, shard: k }))); checks.push(...j.checks.map(c => ({ ...c, shard: k }))); } catch (e) {}
  }
  const total = (Date.now() - T0) / 1000;
  console.log(`\nTIME  ${(total / 60).toFixed(1)} min wall in ${shards} shards: ${ends.map((e, k) => `${k === shards ? "solo" : k}: ${(e.s / 60).toFixed(1)}`).join(", ")} min (when each ended)`);
  for (const m of mods.slice().sort((a, b) => b.s - a.s).slice(0, 15)) console.log(`TIME  ${(m.s / 60).toFixed(1).padStart(5)} min  ${m.mod} (${m.shard === shards ? "solo" : "shard " + m.shard}${m.checks > 1 ? `, ${m.checks} checks` : ""})`);
  try { fs.writeFileSync(path.join(EV, "harness-times.json"), JSON.stringify({ total, shards: ends, modules: mods, checks }, null, 1)); } catch (e) {}
  for (const k of stalled) console.error(`HARNESS STALLED in shard ${k} (its log: evidence/harness-shard-${k}.txt)`);
  for (const k of errored) console.error(`HARNESS ERROR in shard ${k} (exit ${ends[k].code}; its log: evidence/harness-shard-${k}.txt)`);
  const incomplete = stalled.length || errored.length;
  console.log(`\n${pass}/${pass + fail} checks passed${incomplete ? " (INCOMPLETE -- a shard did not finish)" : ""}`);
  process.exit(fail ? 1 : incomplete ? (stalled.length ? 3 : 2) : 0);
}

module.exports = { COST, DEFAULT, SOLO, PERF_PARTS, BASE_PORT, order, claim, orchestrate };
