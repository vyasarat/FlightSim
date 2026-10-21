"use strict";
// THE RACE SWEEP (v177): race_track_checks with every car on every track.
//
// The full harness runs race_track_checks as a SAMPLE -- the lap alone (b), the noisy
// race (f) and the barrier lap (k) in one car per track, turning through the four
// cars. Here they run in all four, on every track, the way they ran in the harness
// before v177. The gate demands it: when a change touches a race or track file (the
// files in RACE_FILES, or TUNE.race), it fails until this has passed on exactly that
// content, and the pass is recorded in evidence/race-sweep.json.
//
//   node scripts/race_sweep.js        (needs CHROME_HEADLESS_SHELL and NODE_PATH, as the harness does)
//
// The win-rate runs (160 races a track, race_drive.js) were never in the harness and
// are not here: they are run by hand for a new track, and the CHANGELOG says what they gave.
const fs = require("fs"), path = require("path"), crypto = require("crypto"), { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const RACE_FILES = ["cockpit/js/race.js", "cockpit/js/track.js", "scripts/race_track_checks.js", "scripts/race_drive.js", "scripts/race_sweep.js"];

// TUNE.race, as text: from `  race: {` to the next key at its depth
function tuneRace(src) {
  const lines = (src || "").split("\n"), a = lines.findIndex(l => /^  race: \{/.test(l));
  if (a < 0) return "";
  let b = a + 1;
  while (b < lines.length && !/^  [A-Za-z_$][\w$]*: /.test(lines[b]) && !/^\};?\s*$/.test(lines[b])) b++;
  return lines.slice(a, b).join("\n");
}

// what the sweep is a receipt for: those files and TUNE.race, as they are on disk
function raceHash(read) {
  const h = crypto.createHash("sha256");
  for (const f of RACE_FILES) h.update(f + "\0" + (read(f) || "") + "\0");
  h.update("TUNE.race\0" + tuneRace(read("cockpit/js/tune.js")));
  return h.digest("hex").slice(0, 16);
}

module.exports = { RACE_FILES, tuneRace, raceHash };

if (require.main === module) {
  const read = f => { try { return fs.readFileSync(path.join(ROOT, f), "utf8"); } catch (e) { return null; } };
  if (!process.env.CHROME_HEADLESS_SHELL) { console.error("race_sweep needs CHROME_HEADLESS_SHELL and NODE_PATH, as the harness does"); process.exit(1); }
  const hash = raceHash(read), t0 = Date.now();
  console.log(`race sweep: race_track_checks, every car on every track (content ${hash})`);
  const r = spawnSync(process.execPath, [path.join(__dirname, "run_module.js"), "race_track_checks"],
    { cwd: ROOT, env: { ...process.env, RACE_FULL: "1" }, encoding: "utf8", maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "inherit"] });
  const out = r.stdout || "";
  process.stdout.write(out);
  const pass = (out.match(/^PASS /gm) || []).length, fail = (out.match(/^FAIL /gm) || []).length;
  const ok = r.status === 0 && fail === 0 && pass > 0 && raceHash(read) === hash;   // (nothing edited while it ran)
  const receipt = { hash, ok, pass, fail, minutes: +((Date.now() - t0) / 60000).toFixed(1), at: new Date().toISOString() };
  fs.mkdirSync(path.join(ROOT, "evidence"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "evidence", "race-sweep.json"), JSON.stringify(receipt, null, 1));
  console.log(`\nrace sweep: ${ok ? "PASSED" : "FAILED"} -- ${pass} passed, ${fail} failed, ${receipt.minutes} min; receipt in evidence/race-sweep.json`);
  process.exit(ok ? 0 : 1);
}
