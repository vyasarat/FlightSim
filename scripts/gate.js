"use strict";
// The fast gate: everything about a change that can be judged WITHOUT a browser,
// in about a second. It is the inner step of the loop (see "The loop" in
// CLAUDE.md) -- the full harness is still what ships a release; this is what
// stops a turn from ending on something the harness would only find 40 minutes
// later, or deploy.sh would only refuse on the droplet.
//
//   node scripts/gate.js                 judge the working tree against origin/main
//   node scripts/gate.js --base=<ref>    ... against another ref
//   node scripts/gate.js --modules       only print the harness modules the change touches
//   node scripts/gate.js --run           gate, then run those modules (needs
//                                        CHROME_HEADLESS_SHELL and NODE_PATH, as the harness does)
//   node scripts/gate.js --hook          Stop-hook mode: silent when clean or when nothing
//                                        under cockpit/ or scripts/ changed; exit 2 with the
//                                        failures on stderr otherwise, which sends the agent
//                                        back to work. Never loops: honours stop_hook_active.
//
// A new lesson that a FILE can prove belongs here as a check (see /retro). A
// lesson that needs the game running belongs in a harness module.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFileSync, spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const flag = n => args.includes("--" + n);
const opt = n => (args.find(a => a.startsWith("--" + n + "=")) || "").slice(n.length + 3);
const HOOK = flag("hook");

const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const git = (...a) => { try { return execFileSync("git", a, { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString(); } catch (e) { return null; } };

// Which harness modules a file answers to. A file that is not here answers to
// the full harness -- which is the honest default for the plane, the rocket and
// anything shared (tune, terrain, scene, flight, main).
const MODULES = {
  "car.js": ["road_checks", "car_feel_checks", "city_checks"],
  "highway.js": ["road_checks", "car_feel_checks"],
  "streets.js": ["city_checks", "road_checks", "solidity_checks"],
  "city.js": ["city_checks"], "citydata.js": ["city_checks", "solidity_checks"],
  "lights.js": ["lights_police_checks", "road_checks"], "police.js": ["lights_police_checks"],
  "vehiclekit.js": ["road_checks", "city_checks"],
  "solids.js": ["solidity_checks"], "collision.js": ["solidity_checks"],
  "track.js": ["track_checks"], "launchsite.js": ["launchsite_checks"], "rocketsled.js": ["rocketsled_checks"], "fireworksbarge.js": ["fireworksbarge_checks"],
  "boat.js": ["boat_checks", "sea_checks"], "harbor.js": ["boat_checks", "lock_checks", "sea_checks"],
  "lock.js": ["lock_checks"], "yacht.js": ["yacht_checks"], "seaevents.js": ["sea_checks"],
  "heli.js": ["heli_control_checks", "heli_play_checks"],
  "buttons.js": ["slot_checks"], "speed.js": ["speed_horn_checks"],
  "engines.js": ["engine_sound_checks"], "audio.js": ["engine_sound_checks", "hardening_checks"],
  "eventpool.js": ["event_pool_checks"], "events.js": ["event_pool_checks"],
  "vehicles.js": ["vehicle_contract_checks", "state_semantics_checks"],
  "state.js": ["state_semantics_checks", "vehicle_contract_checks"],
  "vehicle.js": ["aircraft_orientation_checks"], "models.js": ["aircraft_orientation_checks"],
  "eject.js": ["eject_framing_checks"], "toyfinish.js": ["toyfinish_checks"],
  "toyworld.js": ["toyworld_checks"], "workshop.js": ["workshop_checks", "workshop_play_checks"],
  "marsbase.js": ["robot_checks", "robot_play_checks"], "rover.js": ["robot_play_checks"],
  "input.js": ["hardening_checks", "slot_checks"],
};
const CITY_FILES = new Set(["car.js", "streets.js", "city.js", "citydata.js", "lights.js", "highway.js"]);

// ---------- what changed ----------
const base = opt("base") || ["origin/main", "main"].find(r => git("rev-parse", "--verify", "-q", r) !== null) || "HEAD";
const changed = new Set();
for (const out of [git("diff", "--name-only", base), git("ls-files", "--others", "--exclude-standard")])
  if (out) out.split("\n").filter(Boolean).forEach(f => changed.add(f));
const changedList = [...changed].sort();
const runtime = changedList.filter(f => /^cockpit\//.test(f));         // what the iPad loads
const touchesGame = changedList.some(f => /^(cockpit|scripts)\//.test(f) || f === "sw.js" || f === "index.html");

if (HOOK) {
  let input = {};
  try { input = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); } catch (e) {}
  if (input.stop_hook_active || !touchesGame) process.exit(0);
}

const fails = [], warns = [];
const fail = (rule, detail) => fails.push({ rule, detail });
const warn = (rule, detail) => warns.push({ rule, detail });

// ---------- 1. every script parses ----------
const jsDir = path.join(ROOT, "cockpit", "js");
const jsFiles = fs.readdirSync(jsDir).filter(n => n.endsWith(".js")).sort();
const parse = rel => { try { new vm.Script(read(rel), { filename: rel }); } catch (e) { fail("syntax", `${rel}: ${e.message}`); } };
jsFiles.forEach(f => parse("cockpit/js/" + f));
["cockpit/sw.js", "sw.js"].forEach(parse);
fs.readdirSync(path.join(ROOT, "scripts")).filter(n => n.endsWith(".js")).forEach(f => parse("scripts/" + f));

// ---------- 2. one global scope, one owner per name ----------
// Same test as the harness's T-SCOPE: classic scripts share a scope, so a later
// `function foo` silently replaces an earlier one.
{
  const decl = /^(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/, owner = new Map();
  for (const f of jsFiles) for (const line of read("cockpit/js/" + f).split("\n")) {
    const m = decl.exec(line);
    if (!m) continue;
    const prev = owner.get(m[1]);
    if (prev && prev !== f) fail("scope", `${m[1]} is declared at top level in ${prev} and ${f} -- the later file silently wins; prefix the new one`);
    else owner.set(m[1], f);
  }
}

// ---------- 3. a file is wired three ways: on disk, in index.html, in sw.js ----------
{
  const html = read("cockpit/index.html"), sw = read("cockpit/sw.js");
  const tags = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(m => m[1]);
  const m = sw.match(/ASSETS\s*=\s*\[([\s\S]*?)\]/);
  const assets = m ? [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1].replace(/^\.\//, "")) : [];
  const held = new Set(assets);
  for (const f of jsFiles) {
    if (!tags.includes("js/" + f)) fail("wiring", `cockpit/js/${f} has no <script> tag in cockpit/index.html -- it never loads`);
    if (!held.has("js/" + f)) fail("wiring", `cockpit/js/${f} is not in ASSETS in cockpit/sw.js -- the game breaks offline`);
  }
  for (const t of tags) if (!/^https?:/.test(t) && !fs.existsSync(path.join(ROOT, "cockpit", t))) fail("wiring", `index.html loads ${t}, which is not on disk`);
  for (const a of assets) if (a && !/^https?:/.test(a) && !fs.existsSync(path.join(ROOT, "cockpit", a))) fail("wiring", `sw.js caches ${a}, which is not on disk -- the install fails and nothing is cached`);
}

// ---------- 4. the version: bumped, never reused, and written up ----------
// deploy.sh refuses these on the droplet; this refuses them before the 40-minute run.
const cacheName = src => ((src || "").match(/const CACHE_NAME = "([^"]*)"/) || [])[1];
{
  const now = cacheName(read("cockpit/sw.js")), was = cacheName(git("show", base + ":cockpit/sw.js"));
  const shipped = runtime.filter(f => /^cockpit\/(index\.html|js\/|three\.min\.js|manifest\.json|icons\/|models\/|textures\/|audio\/|GLTFLoader\.js)/.test(f));
  if (shipped.length && was && now === was)
    fail("version", `cockpit/ changed (${shipped.slice(0, 4).join(", ")}${shipped.length > 4 ? ", …" : ""}) but CACHE_NAME is still "${now}" -- bump it, or the iPad keeps the old build`);
  if (was && now !== was) {
    const v = (now.match(/v(\d+)$/) || [])[1], vWas = (was.match(/v(\d+)$/) || [])[1];
    if (v && vWas && +v <= +vWas) fail("version", `CACHE_NAME went from ${was} to ${now} -- a version is never reused or walked back`);
    if (v && !new RegExp(`^## v${v}\\b`, "m").test(read("CHANGELOG.md")))
      fail("changelog", `CACHE_NAME is v${v} but CHANGELOG.md has no "## v${v}" paragraph -- one paragraph per release, in a parent's words`);
  }
  const rootChanged = changedList.some(f => f === "index.html" || f === "manifest.json" || /^icons\//.test(f));
  if (rootChanged && cacheName(read("sw.js")) === cacheName(git("show", base + ":sw.js")))
    fail("version", "the root build changed but root sw.js CACHE_NAME was not bumped");
}

// ---------- 5. nothing that does not belong in history ----------
{
  const okDirs = /^(cockpit\/(icons|models|textures|audio)|icons)\//;
  for (const f of changedList) {
    if (/^(evidence|docs|qa-screenshots|models-src)\//.test(f)) fail("hygiene", `${f} is evidence or source material -- gitignored, never committed`);
    else if (/\.(mp4|webm|gif|mov|png|jpe?g|blend)$/i.test(f) && !okDirs.test(f)) fail("hygiene", `${f} is a binary outside the game's own asset folders -- that is what took .git to 115 MB`);
  }
  for (const b of ["scripts/vehicle_baseline.json", "scripts/visual_baseline.json"])
    if (changed.has(b)) warn("baseline", `${b} changed -- regenerate only for a deliberate behaviour change, and say which in the changelog`);
  const lines = read("CLAUDE.md").split("\n").length;
  if (lines > 300) warn("rules", `CLAUDE.md is ${lines} lines -- /retro should turn rules into checks and cut them, not add more`);
}

// ---------- which modules the change answers to ----------
const mods = new Set(); let full = false;
for (const f of changedList) {
  const m = /^cockpit\/js\/(.+\.js)$/.exec(f);
  if (m) { if (MODULES[m[1]]) MODULES[m[1]].forEach(x => mods.add(x)); else full = true; }
  const s = /^scripts\/([a-z_]+_checks?)\.js$/.exec(f);
  if (s) mods.add(s[1]);
  if (f === "cockpit/index.html" || f === "cockpit/sw.js") mods.add("hardening_checks");
}
const modList = [...mods].filter(n => fs.existsSync(path.join(ROOT, "scripts", n + ".js"))).sort();
const noisy = changedList.some(f => CITY_FILES.has(path.basename(f)) && /^cockpit\/js\//.test(f));

if (flag("modules")) { console.log(modList.join("\n")); process.exit(0); }

// ---------- report ----------
const out = [];
for (const f of fails) out.push(`FAIL ${f.rule}: ${f.detail}`);
for (const w of warns) out.push(`WARN ${w.rule}: ${w.detail}`);
const next = [];
if (modList.length) next.push(`modules this change answers to: ${modList.map(n => `node scripts/run_module.js ${n}`).join(" ; ")}`);
if (noisy) next.push("city or car code changed: node scripts/noisy_drive.js 300 <seed> on more than one seed, and report the log");
if (full) next.push("shared code changed (no module owns it): only the full harness says anything about it");

if (HOOK) {
  if (!fails.length) process.exit(0);
  process.stderr.write(`scripts/gate.js: ${fails.length} thing(s) wrong with this change. Fix them before stopping; do not edit the gate to pass.\n${out.join("\n")}\n`);
  process.exit(2);
}
console.log(`gate: ${changedList.length} file(s) changed against ${base}`);
if (out.length) console.log(out.join("\n"));
console.log(fails.length ? `\n${fails.length} failed` : `\ngate passed${warns.length ? `, ${warns.length} warning(s)` : ""}`);
if (next.length) console.log("\nnext:\n- " + next.join("\n- "));

if (flag("run") && !fails.length && modList.length) {
  if (!process.env.CHROME_HEADLESS_SHELL) { console.error("\n--run needs CHROME_HEADLESS_SHELL and NODE_PATH, as the harness does"); process.exit(1); }
  let bad = 0;
  for (const n of modList) {
    console.log(`\n=== ${n} ===`);
    const r = spawnSync(process.execPath, [path.join(__dirname, "run_module.js"), n], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 });
    const lines = (r.stdout || "").trim().split("\n");
    console.log(lines.filter(l => l.startsWith("FAIL")).concat(lines.slice(-1)).join("\n"));
    if (r.status) bad++;
  }
  process.exit(bad ? 1 : 0);
}
process.exit(fails.length ? 1 : 0);
