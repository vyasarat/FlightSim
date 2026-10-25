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
// (v194) launchsite_checks and monstertruck_checks render frame after frame: 38 s and 2 min alone, 12-17 and 9 min
// beside three busy shards -- in v194's runs past the 20-minute stall line between two checks. Alone, at the end.
const SOLO = ["events_perf_checks", "launchsite_checks", "monstertruck_checks"];   // the whole module, alone
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
  for (const f of fs.readdirSync(EV)) if (/^harness-(times-\d+\.json|shard-.*\.txt)$/.test(f)) fs.rmSync(path.join(EV, f), { force: true });   // nothing from an earlier run
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
  const texts = logs.map(read), jsons = [];
  for (let k = 0; k <= shards; k++) { try { jsons[k] = JSON.parse(read(path.join(EV, `harness-times-${k}.json`))); } catch (e) { jsons[k] = null; } }
  for (let k = 0; k <= shards; k++) {
    console.log(`\n===== ${k === shards ? "solo phase" : "shard " + k} (ended at ${(ends[k].s / 60).toFixed(1)} min, exit ${ends[k].code}) =====`);
    console.log(texts[k].split("\n").filter(l => !/^\d+\/\d+ checks passed/.test(l) && !l.startsWith("TIME  ")).join("\n").trimEnd());
  }
  // where the time went, all shards together
  const mods = [], checks = [];
  jsons.forEach((j, k) => { if (j) { mods.push(...j.modules.map(m => ({ ...m, shard: k }))); checks.push(...j.checks.map(c => ({ ...c, shard: k }))); } });
  const total = (Date.now() - T0) / 1000;
  console.log(`\nTIME  ${(total / 60).toFixed(1)} min wall in ${shards} shards: ${ends.map((e, k) => `${k === shards ? "solo" : k}: ${(e.s / 60).toFixed(1)}`).join(", ")} min (when each ended)`);
  for (const m of mods.slice().sort((a, b) => b.s - a.s).slice(0, 15)) console.log(`TIME  ${(m.s / 60).toFixed(1).padStart(5)} min  ${m.mod} (${m.shard === shards ? "solo" : "shard " + m.shard}${m.checks > 1 ? `, ${m.checks} checks` : ""})`);
  try { fs.writeFileSync(path.join(EV, "harness-times.json"), JSON.stringify({ total, shards: ends, modules: mods, checks }, null, 1)); } catch (e) {}
  const v = verdict({ texts, jsons, codes: ends.map(e => e.code), shards });
  for (const p of v.problems) console.error(p);
  console.log(`\n${v.pass}/${v.pass + v.fail} checks passed${v.problems.length ? " (INCOMPLETE -- " + v.problems.length + " problem(s) above)" : ""}`);
  process.exit(v.code);
}

// THE VERDICT, as a function of what the processes left behind (their logs, their timing files,
// their exit codes), so a test can drive it. Green only if no check failed AND the run was whole:
// a shard that died -- an uncaught throw exits 1, the same code as a FAIL -- leaves the module it
// had claimed run nowhere (law-reviewer, v177). So every process must reach its own count and
// write a finished timing file, every module the harness lists must have run exactly once across
// the shards, and the solo phase must have run exactly its timing parts.
function verdict({ texts, jsons, codes, shards }) {
  const count = txt => { let p = 0, f = 0; for (const l of (txt || "").split("\n")) { if (l.startsWith("PASS  ")) p++; else if (l.startsWith("FAIL  ")) f++; } return { p, f }; };
  const name = k => k === shards ? "the solo phase" : "shard " + k;
  let pass = 0, fail = 0, stalled = false;
  const problems = [];
  for (let k = 0; k <= shards; k++) {
    const c = count(texts[k]); pass += c.p; fail += c.f;
    if (/HARNESS STALLED/.test(texts[k] || "")) { stalled = true; problems.push(`HARNESS STALLED in ${name(k)}`); }
    else if (codes[k] !== 0 && codes[k] !== 1) problems.push(`HARNESS ERROR in ${name(k)} (exit ${codes[k]})`);
    if (!/^\d+\/\d+ checks passed\s*$/m.test(texts[k] || "") || !(jsons[k] && jsons[k].finished)) problems.push(`HARNESS INCOMPLETE: ${name(k)} never reached its own count`);
  }
  const expected = (jsons.find(j => j && j.expected) || {}).expected || [];
  if (!expected.length) problems.push("HARNESS INCOMPLETE: no shard listed the modules");
  const ranN = {};
  for (let k = 0; k < shards; k++) for (const m of (jsons[k] && jsons[k].modules) || []) ranN[m.mod] = (ranN[m.mod] || 0) + 1;
  for (const m of expected) if (!SOLO.includes(m) && ranN[m] !== 1) problems.push(`HARNESS INCOMPLETE: ${m} ran ${ranN[m] || 0} times, not once`);
  const solo = ((jsons[shards] && jsons[shards].modules) || []).map(m => m.mod).sort();
  const wantSolo = SOLO.concat(PERF_PARTS.map(m => m + " (timing part)")).sort();
  if (JSON.stringify(solo) !== JSON.stringify(wantSolo)) problems.push(`HARNESS INCOMPLETE: the solo phase ran [${solo.join(", ")}], not [${wantSolo.join(", ")}]`);
  return { pass, fail, problems, code: fail ? 1 : problems.length ? (stalled ? 3 : 2) : 0 };
}

// The verdict's own proof, without a browser: made-up shard results, each the way a run can go
// wrong, through the same function (`node scripts/harness_shards.js --selftest`; the gate runs it).
function selftest() {
  const shards = 2, mods = ["a_checks", "b_checks", "c_checks", "events_perf_checks"];
  const done = (k, ms) => ({ finished: true, expected: mods, modules: ms.map(mod => ({ mod, s: 1 })) });
  const soloMods = SOLO.concat(PERF_PARTS.map(m => m + " (timing part)"));
  const good = () => ({
    texts: ["PASS  x\n1/1 checks passed\n", "PASS  y\nPASS  z\n2/2 checks passed\n", "PASS  t\n1/1 checks passed\n"],
    jsons: [done(0, ["a_checks", "c_checks"]), done(1, ["b_checks"]), done(2, soloMods)],
    codes: [0, 0, 0], shards });
  const cases = [];
  const run = (label, mutate, want) => { const r = good(); mutate(r); const v = verdict(r); cases.push({ label, ok: want === "green" ? v.code === 0 : v.code !== 0, code: v.code, problems: v.problems }); };
  run("a whole, clean run is green", () => {}, "green");
  run("a FAIL line is red", r => { r.texts[1] = "FAIL  y\nPASS  z\n1/2 checks passed\n"; r.codes[1] = 1; }, "red");
  run("a shard that threw (exit 1, no FAIL, no count) is red", r => { r.texts[1] = "PASS  y\n"; r.codes[1] = 1; r.jsons[1] = null; }, "red");
  run("a stale timing file from an earlier run does not make a dead shard whole", r => { r.texts[1] = "PASS  y\n"; r.codes[1] = 1; r.jsons[1] = { ...r.jsons[1], finished: false }; }, "red");
  run("a module nobody ran is red", r => { r.jsons[1] = done(1, []); }, "red");
  run("a module run twice is red", r => { r.jsons[1] = done(1, ["b_checks", "a_checks"]); }, "red");
  run("a solo phase missing a timing part is red", r => { r.jsons[2] = done(2, soloMods.slice(1)); }, "red");
  run("a stalled shard is red", r => { r.texts[0] += "HARNESS STALLED: no check for 20 minutes\n"; }, "red");
  return cases;
}

if (require.main === module && process.argv.includes("--selftest")) {
  const cases = selftest();
  for (const c of cases) console.log(`${c.ok ? "ok  " : "BAD "} ${c.label} (exit ${c.code})`);
  process.exit(cases.every(c => c.ok) ? 0 : 1);
}

module.exports = { COST, DEFAULT, SOLO, PERF_PARTS, BASE_PORT, order, claim, orchestrate, verdict, selftest };
