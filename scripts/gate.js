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
//   node scripts/gate.js --bash          PreToolUse hook on Bash: refuses a command that waits on the
//                                        harness with pgrep -f (check 13), before it runs
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

// A waiter that polls `pgrep -f` for the harness matches its OWN command line, which holds the
// same words, so it never ends: it stalled the loop for hours, more than once (v188, v189). The
// harness runs as a background command and its exit is the signal. (Built in pieces, so this
// file does not match itself.)
const WAIT_ON_HARNESS = new RegExp("pg" + "rep\\s+(-\\w+\\s+)*-\\w*f\\w*\\s+(-\\w+\\s+)*[\"']?[^\\s\"']*head" + "less_test");
if (flag("bash")) {
  let input = {};
  try { input = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); } catch (e) {}
  const cmd = (input.tool_input && input.tool_input.command) || "";
  if (WAIT_ON_HARNESS.test(cmd)) {
    process.stderr.write("gate 13: this command polls pgrep -f for the harness -- it matches its own command line and never ends. " +
      "Run the harness itself as a background command (its exit notifies you) and keep a 30-minute fallback wake-up.\n");
    process.exit(2);
  }
  process.exit(0);
}

const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const git = (...a) => { try { return execFileSync("git", a, { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString(); } catch (e) { return null; } };

// Which harness modules a file answers to. A file that is not here answers to
// the full harness -- which is the honest default for the plane, the rocket and
// anything shared (tune, terrain, scene, flight, main).
const MODULES = {
  "car.js": ["road_checks", "car_feel_checks", "city_checks", "cybertruck_checks", "corvette_checks", "corner_cam_checks", "london_drive_checks"],
  "corvette.js": ["corvette_checks", "slot_checks", "engine_sound_checks"],
  "highway.js": ["road_checks", "car_feel_checks"],
  "streets.js": ["city_checks", "road_checks", "solidity_checks", "corvette_checks", "london_drive_checks"],
  "city.js": ["city_checks"], "citydata.js": ["city_checks", "solidity_checks"],
  "lights.js": ["lights_police_checks", "road_checks"], "police.js": ["lights_police_checks", "cybertruck_checks", "corvette_checks"],
  "vehiclekit.js": ["road_checks", "city_checks", "london_drive_checks"],
  "solids.js": ["solidity_checks", "corner_cam_checks"], "collision.js": ["solidity_checks"],
  "track.js": ["track_checks", "race_checks"], "race.js": ["audit_race_checks", "race_checks", "london_race_checks", "race_track_checks", "race_item_checks", "frame_budget_checks", "slot_checks", "vehicle_contract_checks", "state_semantics_checks"], "raceitems.js": ["race_item_checks", "race_checks", "race_track_checks", "slot_checks"], "raceevents.js": ["race_event_checks", "race_track_checks", "race_item_checks", "solidity_checks", "frame_budget_checks"], "launchsite.js": ["launchsite_checks", "payoff_size_checks", "heavy_checks"], "heavy.js": ["heavy_checks", "launchsite_checks"], "rocketsled.js": ["rocketsled_checks", "payoff_size_checks", "sledride_checks"], "sledride.js": ["sledride_checks", "rocketsled_checks", "slot_checks", "solidity_checks"], "crane.js": ["crane_checks", "slot_checks", "solidity_checks", "vehicle_contract_checks", "state_semantics_checks"], "dadmode.js": ["audit_hud_checks", "dadmode_checks", "dadmissions_checks", "slot_checks", "vehicle_contract_checks", "state_semantics_checks"], "valley.js": ["dadmode_checks", "solidity_checks"], "dadair.js": ["dadmissions_checks"], "dad_dam.js": ["dadmissions_checks"], "fireworksbarge.js": ["fireworksbarge_checks", "payoff_size_checks"], "monstertruck.js": ["monstertruck_checks", "payoff_size_checks", "monster_checks"], "monster.js": ["monster_checks", "solidity_checks", "slot_checks", "corner_cam_checks"],
  "boat.js": ["boat_checks", "sea_checks", "london_thames_checks"], "harbor.js": ["boat_checks", "lock_checks", "sea_checks", "audit_hud_checks"],
  "lock.js": ["lock_checks"], "yacht.js": ["yacht_checks"], "seaevents.js": ["sea_checks"],
  "heli.js": ["heli_control_checks", "heli_play_checks", "heli_land_checks"],
  "buttons.js": ["slot_checks"], "speed.js": ["speed_horn_checks"],
  "engines.js": ["engine_sound_checks"], "audio.js": ["engine_sound_checks", "hardening_checks", "audit_hud_checks", "audit_race_checks", "audit_dad_checks"],
  "eventpool.js": ["event_pool_checks"], "events.js": ["event_pool_checks", "events_perf_checks"],
  "vehicles.js": ["vehicle_contract_checks", "state_semantics_checks", "solidity_checks", "cybertruck_checks", "corvette_checks"],
  "state.js": ["state_semantics_checks", "vehicle_contract_checks", "audit_hud_checks", "audit_cars_checks"], "setpieces.js": ["audit_hud_checks"],
  "vehicle.js": ["aircraft_orientation_checks", "cybertruck_checks", "corvette_checks"], "models.js": ["aircraft_orientation_checks", "cybertruck_checks", "corvette_checks"],
  "eject.js": ["eject_framing_checks", "audit_cars_checks", "audit_flight_checks"], "toyfinish.js": ["toyfinish_checks"],
  "toyworld.js": ["toyworld_checks", "audit_race_checks"], "workshop.js": ["workshop_checks", "workshop_play_checks"],
  "marsbase.js": ["robot_checks", "robot_play_checks", "audit_space_checks"], "rover.js": ["robot_play_checks", "audit_space_checks"],
  "input.js": ["hardening_checks", "slot_checks", "london_checks", "audit_flight_checks", "audit_harness_checks", "audit_london_checks", "audit_hud_checks"],
  "london.js": ["audit_london_checks", "london_checks", "london_drive_checks", "london_thames_checks", "london_race_checks", "city_checks", "slot_checks", "solidity_checks", "frame_budget_checks", "dadmissions_checks", "sea_checks"],
  // the world's shape and what stands on it: v197 moved them and only the full harness saw the
  // Doolittle carrier land in Britain (dadmissions) and a runway drawn from every venue (frame budget)
  "terrain.js": ["dadmissions_checks", "sea_checks", "frame_budget_checks", "london_checks"],
  "scene.js": ["frame_budget_checks", "london_checks"], "landmarks.js": ["frame_budget_checks", "london_checks", "toyworld_checks"],
};
const CITY_FILES = new Set(["car.js", "streets.js", "city.js", "citydata.js", "lights.js", "highway.js"]);

// ---------- the A2 readers: pure, so gate 18 can hold each to its cases ----------
// JS with its comments out and its strings kept whole (a "https://" in a string is not a comment).
function gateStripComments(src) {
  let out = "";
  for (let i = 0; i < src.length;) {
    const c = src[i], n = src[i + 1];
    if (c === "/" && n === "/") { const e = src.indexOf("\n", i); i = e < 0 ? src.length : e; continue; }
    if (c === "/" && n === "*") { const e = src.indexOf("*/", i + 2); i = e < 0 ? src.length : e + 2; continue; }
    if (c === '"' || c === "'" || c === "`") { let j = i + 1; for (; j < src.length && src[j] !== c; j++) if (src[j] === "\\") j++; out += src.slice(i, j + 1); i = j + 1; continue; }
    out += c; i++;
  }
  return out;
}
// cockpit/sw.js's ASSETS, as paths under cockpit/ ("./" is "" -- it is not "./index.html": the cache matches by URL)
function gateAssetsOf(sw) {
  const m = gateStripComments(sw).match(/ASSETS\s*=\s*\[([\s\S]*?)\]/);
  return m ? [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1].replace(/^\.\//, "")) : [];
}
// The modules scripts/headless_test.js runs: its `const MODULES = [ … ];` rows, and a module called by name
// (runModule("./x") at the start of a line). null when the list cannot be read whole: every line up to its
// first `];` must be a row, blank or a comment, or the gate would report sixty modules "run nowhere".
function gateHarnessModsOf(src) {
  const a = src.indexOf("const MODULES = ["), b = a < 0 ? -1 : src.indexOf("];", a);
  if (b < 0) return null;
  const names = new Set();
  for (const l of gateStripComments(src.slice(a + "const MODULES = [".length, b)).split("\n")) {
    if (!l.trim()) continue;
    const m = /^\s*\[\s*"\.\/([\w.-]+)"\s*,.*\]\s*,?\s*$/.exec(l);
    if (!m) return null;
    names.add(m[1]);
  }
  for (const m of src.matchAll(/^\s*(?:await\s+)?runModule\(\s*"\.\/([\w.-]+)"/gm)) names.add(m[1]);
  return names;
}
// What is wrong with a --run map: a key that is no game file, a module the harness does not run.
function gateRunMapProblems(map, isGameFile, mods, isScript) {
  const out = [];
  for (const [f, ms] of Object.entries(map)) {
    if (!isGameFile(f)) out.push(`gate.js MODULES has "${f}", which is not in cockpit/js/ -- a change to the file meant answers to the full harness only, and --run never runs its modules`);
    if (mods) for (const n of ms) if (!mods.has(n)) out.push(`gate.js MODULES maps ${f} to "${n}", which ${isScript(n) ? "the harness does not run" : `is no scripts/${n}.js`} -- --run drops it without a word, and a change to ${f} goes unchecked by it`);
  }
  return out;
}
// three.min.js's REVISION, read out of the file (r128 minified writes REVISION=e and const e="128")
function gateThreeRevisionOf(src) {
  const v = (src.match(/\bREVISION=(\w+|"\d+")/) || [])[1];
  if (!v) return undefined;
  if (/^"\d+"$/.test(v)) return v.slice(1, -1);
  return (src.match(new RegExp(`\\b(?:const|var|let)\\s+${v}\\s*=\\s*"(\\d+)"`)) || [])[1];
}
const gateSha256 = buf => require("crypto").createHash("sha256").update(buf).digest("hex");

// The harness's own list of the modules it runs. Read once: gate 15 holds it against scripts/*_check(s).js,
// gate 16 holds the map above against it, and --run follows a helper to the modules that require it.
const HARNESS_MODS_READ = gateHarnessModsOf(read("scripts/headless_test.js"));
const HARNESS_MODS = HARNESS_MODS_READ || new Set();
const modSrcs = new Map();
const modSrc = n => { if (!modSrcs.has(n)) { let s = ""; try { s = read("scripts/" + n + ".js"); } catch (e) {} modSrcs.set(n, s); } return modSrcs.get(n); };
// Every file the repo holds (tracked, or new and not ignored): what a commit would carry and the droplet
// would check out. Gates 13 and 14 read it.
const REPO_FILES = new Set();
for (const out of [git("ls-files"), git("ls-files", "--others", "--exclude-standard")])
  if (out) out.split("\n").filter(Boolean).forEach(f => REPO_FILES.add(f));

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
  const assets = gateAssetsOf(sw);   // a commented-out entry is not cached
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
  // ONE list, deploy/shipped-paths.txt, read here and by deploy.sh on the droplet (Q-11: deploy.sh
  // typed its own and left out models/, textures/, audio/ and GLTFLoader.js). A path ending in / is a directory.
  const shipPaths = read("deploy/shipped-paths.txt").split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));
  if (!shipPaths.length) fail("version", "deploy/shipped-paths.txt lists nothing -- the CACHE_NAME bump cannot be checked, here or on the droplet");
  const shipped = runtime.filter(f => shipPaths.some(p => p.endsWith("/") ? f.startsWith(p) : f === p));
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

// ---------- 6. the generated cities' crowns are solid where they are drawn ----------
// citydata.js writes each building type's solid TIERS; the crown on top (a
// spire, a mast, a glass cap) city.js reads from `crown` when the generator
// wrote one, and otherwise names it by how much taller than its top tier the
// type is, by build_city.py's rules (v139: a helicopter came down inside them).
// A height step nobody knows is a crown that would be drawn and be air.
{
  try {
    const ctx = {}; vm.createContext(ctx);
    vm.runInContext(read("cockpit/js/citydata.js").replace(/^const CITY_DATA\s*=/m, "this.CITY_DATA ="), ctx);
    const known = [0, 3, 8, 23, 30];
    for (const [key, c] of Object.entries(ctx.CITY_DATA || {})) for (const T of c.types) {
      if (T.crown) continue;
      const top = Math.max(...T.tiers.map(t => t[5])), k = T.height - top;
      if (!known.some(v => Math.abs(k - v) < 0.5)) fail("city", `${key} type ${T.name} stands ${k.toFixed(1)} m over its top tier with no \`crown\` and no known crown of that height -- it would be drawn and be air (city.js cityCrown)`);
    }
  } catch (e) { fail("city", "citydata.js would not load for the crown check: " + e.message); }
}

// ---------- 7. every vehicle in the contract has a solid radius and a crawl ----------
// vehSolidR()/vehCrawl() fall back quietly for a kind TUNE.solid does not name,
// so a new row in VEHICLE_CONTRACT without its TUNE.solid r/crawl is only found by
// solidity_checks, if anything maps to it (v144: the sled, caught by the reviewer).
{
  try {
    const kinds = [...(/^const VEHICLE_CONTRACT = \{([^]*?)^\};/m.exec(read("cockpit/js/vehicles.js")) || [, ""])[1].matchAll(/^  ([a-zA-Z]+): \{/gm)].map(m => m[1]);
    if (!kinds.length) fail("contract", "no rows found in VEHICLE_CONTRACT (vehicles.js) -- the gate's reader needs updating");
    const ctx = { Math }; vm.createContext(ctx);
    vm.runInContext(read("cockpit/js/tune.js") + ";this.TUNE = TUNE;", ctx);
    for (const k of kinds) for (const f of ["r", "crawl"])
      if (typeof (ctx.TUNE.solid[f] || {})[k] !== "number") fail("contract", `VEHICLE_CONTRACT has "${k}" but TUNE.solid.${f} has no ${k} -- give it its radius and crawl (solids.js's one law)`);
  } catch (e) { fail("contract", "tune.js or vehicles.js would not read for the TUNE.solid check: " + e.message); }
}

// ---------- 8. every check() in a harness script can fail ----------
// check(label, condition, detail) takes three: a stray comma in the condition
// pushes the rest into the detail slot, or past it, and the harness never
// enforces it (v144: sledride_checks' rings-home, found two review rounds late).
function gateCheckCalls(src) {
  const out = [], re = /(^|[^.\w$])check\s*\(/g; let m;
  while ((m = re.exec(src))) {
    if (/function\s*$/.test(src.slice(Math.max(0, m.index - 12), m.index + m[1].length))) continue;
    let depth = 0, args = [], cur = "", prev = "(";
    for (let i = m.index + m[0].length; i < src.length; i++) {
      const c = src[i], n = src[i + 1];
      if (c === "/" && n === "/") { const e = src.indexOf("\n", i); i = e < 0 ? src.length : e; continue; }
      if (c === "/" && n === "*") { i = src.indexOf("*/", i + 2) + 1; continue; }
      if (c === '"' || c === "'" || c === "`" || (c === "/" && /[(,=:[!&|?{};+\-*%<>~^]/.test(prev))) {
        let j = i + 1, cls = false;
        for (; j < src.length; j++) {
          const d = src[j];
          if (d === "\\") { j++; continue; }
          if (c === "/" && d === "[") cls = true; else if (c === "/" && d === "]") cls = false;
          else if (d === c && !cls) break;
          else if (c === "`" && d === "$" && src[j + 1] === "{") { let k = 1; j += 2; for (; j < src.length && k; j++) { if (src[j] === "{") k++; else if (src[j] === "}") k--; } j--; }
        }
        cur += src.slice(i, j + 1); i = j; prev = "a"; continue;
      }
      if ("([{".includes(c)) depth++;
      if (")]}".includes(c)) { if (depth === 0) { args.push(cur); break; } depth--; }
      if (c === "," && depth === 0) { args.push(cur); cur = ""; prev = ","; continue; }
      cur += c; if (!/\s/.test(c)) prev = c;
    }
    out.push({ line: src.slice(0, m.index + m[1].length).split("\n").length, args: args.map(a => a.trim()).filter((a, k, all) => a || k < all.length - 1) });
  }
  return out;
}
function gateCheckShape(a) {
  if (a.length > 3) return `check() has ${a.length} arguments -- everything after the third is dropped, so a condition there is never enforced`;
  if (a.length >= 2 && /^(["'`])[^]*\1$/.test(a[1])) return "check()'s condition is a string literal -- it always passes";
  // the detail's top level: strings blanked, everything inside brackets dropped
  let top = a.length === 3 ? a[2].replace(/(["'`])(?:\\.|(?!\1)[^\\])*\1/g, '""').replace(/=>/g, "") : "";
  for (let k = 0; k < 20; k++) top = top.replace(/\([^()[\]{}]*\)|\[[^()[\]{}]*\]|\{[^()[\]{}]*\}/g, "_");
  if (/^[^?]*(<|>|===|!==|&&)[^?]*$/.test(top)) return "check()'s detail argument is a condition -- a comma where an && belongs, so it is never enforced";
  return null;
}
for (const f of fs.readdirSync(path.join(ROOT, "scripts")).filter(f => f.endsWith(".js"))) {
  for (const c of gateCheckCalls(read("scripts/" + f))) { const w = gateCheckShape(c.args); if (w) fail("checks", `scripts/${f}:${c.line}: ${w}`); }
}

// ---------- 9. every harness module runs through runModule ----------
// runModule closes the pages a module leaves open. Called around it, a module's
// open page kept its queued GPU frames, the next page's boot waited 129 s behind
// them, and the full run stalled (v154, on main as well).
{
  const src = read("scripts/headless_test.js");
  src.split("\n").forEach((l, i) => { if (/require\(\s*["']\.\/\w+["']\s*\)\s*\(/.test(l)) fail("harness", `scripts/headless_test.js:${i + 1}: a module called directly -- run it through runModule, which closes the pages it leaves open`); });
}

// ---------- 10. every tone a dad file makes is named "dad..." ----------
// dadSoundsOff silences tones by that prefix on the way out; one named otherwise would drone on
// under his game (v157: the airliner's tone was missing from a hand-kept list).
for (const f of fs.readdirSync(path.join(ROOT, "cockpit", "js")).filter(f => /^dad.*\.js$/.test(f))) {
  const src = read("cockpit/js/" + f), re = /setTone\(\s*(["'`])([^"'`]*)\1/g; let m;
  while ((m = re.exec(src))) if (!m[2].startsWith("dad")) fail("dad", `cockpit/js/${f}: setTone("${m[2]}") -- a dad tone is named "dad..." so dadSoundsOff can find it`);
}

// ---------- 10b. a shader of our own writes the game's depth (v187) ----------
// The renderer's depth buffer is logarithmic: a ShaderMaterial without logdepthbuf_vertex is tested
// at the wrong depth (v187's bubble was hidden by the road under it), and logdepthbuf_vertex without
// <common> does not compile at all. A backdrop drawn behind everything (depthWrite false, and a
// BackSide dome or fog-free points) is the one exemption.
for (const f of fs.readdirSync(path.join(ROOT, "cockpit", "js")).filter(f => f.endsWith(".js"))) {
  const src = read("cockpit/js/" + f), re = /new THREE\.ShaderMaterial\(/g; let m;
  while ((m = re.exec(src))) {
    const block = src.slice(m.index, m.index + 3000), end = block.indexOf("fragmentShader");
    const vs = end > 0 ? block.slice(0, end) : block, line = src.slice(0, m.index).split("\n").length;
    const backdrop = /depthWrite:\s*false/.test(block) && /BackSide|fog:\s*false/.test(block);
    if (!/logdepthbuf_vertex/.test(vs) && !backdrop) fail("shader", `cockpit/js/${f}:${line}: a ShaderMaterial whose vertex shader has no #include <logdepthbuf_vertex> -- the game's depth is logarithmic, so it is drawn at the wrong depth (v187's bubble vanished under the road)`);
    else if (/logdepthbuf_vertex/.test(vs) && !/<common>/.test(vs)) fail("shader", `cockpit/js/${f}:${line}: logdepthbuf_vertex needs #include <common> before it, or the shader does not compile`);
  }
}

// ---------- 10a. game code never times off the wall clock (v203) ----------
// The harness runs 12 sim-seconds in a sixth of a real one: a bob or a pulse off performance.now() is
// a different picture, and a different resting height, every run. Game time is state.gameT (gameMs()).
// The frame loop, the audio retry and the zoom guard are real time by nature, and only they may ask it.
{
  const WALL_OK = new Set(["cockpit/js/main.js", "cockpit/js/audio.js", "cockpit/js/nozoom.js"]);
  for (const f of fs.readdirSync(path.join(ROOT, "cockpit", "js")).filter(f => f.endsWith(".js")).map(f => "cockpit/js/" + f)) {
    if (WALL_OK.has(f)) continue;
    const lines = fs.readFileSync(path.join(ROOT, f), "utf8").split("\n");
    lines.forEach((ln, i) => { const code = ln.replace(/\/\/.*$/, ""); if (/performance\.now\(\)/.test(code)) fail("wall-clock", `${f}:${i + 1} times off performance.now() -- game code uses gameMs() (state.gameT), the game's own clock`); });
  }
}

// ---------- 10c. the page's random stream is untouched (v201 retro) ----------
// Three leaks in four releases (v198 twice, v201): a builder made at load drew from Math.random and every
// seeded thing after it moved. When the game's files differ from the base, the change is not done until
// scripts/stream_compare.js has said SAME on exactly what is on disk (or DELIBERATE="<why>" said it means to).
if (fs.existsSync(path.join(ROOT, "scripts", "stream_compare.js"))) {
  const { streamHash } = require("./stream_compare.js");
  const readAt = f => { try { return fs.readFileSync(path.join(ROOT, f), "utf8"); } catch (e) { return null; } };
  const now = streamHash(readAt, ROOT);
  const baseFiles = (git("ls-tree", "--name-only", base, "cockpit/js/") || "").split("\n").filter(f => f.endsWith(".js"));
  const nowFiles = fs.readdirSync(path.join(ROOT, "cockpit", "js")).filter(f => f.endsWith(".js")).map(f => "cockpit/js/" + f);
  const changed = nowFiles.length !== baseFiles.length || nowFiles.concat(["cockpit/index.html"]).some(f => readAt(f) !== git("show", `${base}:${f}`));
  if (changed) {
    let r = null; try { r = JSON.parse(readAt("evidence/stream-compare.json")); } catch (e) {}
    if (!r || r.hash !== now) fail("stream", "the game's files changed and the random stream has not been compared as they stand -- run node scripts/stream_compare.js <a worktree of the base> . (SAME, or DELIBERATE=\"<why>\" if the change means to move it)");
    else if (!r.same && !r.deliberate) fail("stream", "stream_compare said DIFFERENT on this content -- evidence/stream-compare.json");
  }
}

// ---------- 11. a race or track change has been swept (v177) ----------
// The full harness runs race_track_checks as a sample, one car per track; every car on every
// track is scripts/race_sweep.js. When the race's content (its files, TUNE.race) differs from
// the base, the change is not done until the sweep has passed on exactly what is on disk.
if (fs.existsSync(path.join(ROOT, "scripts", "race_sweep.js"))) {
  const { raceHash } = require("./race_sweep.js");
  const readAt = f => { try { return fs.readFileSync(path.join(ROOT, f), "utf8"); } catch (e) { return null; } };
  // (the rule's own proof: an edit inside TUNE.race, or to any file it lists, changes the hash)
  const tune = readAt("cockpit/js/tune.js") || "";
  if (["race", "car", "solid"].some(k => raceHash(f => f === "cockpit/js/tune.js" ? tune.replace(new RegExp(`^  ${k}: \\{`, "m"), `  ${k}: { /*x*/`) : readAt(f)) === raceHash(readAt)) ||
      raceHash(f => f === "cockpit/js/race.js" ? readAt(f) + "//x" : readAt(f)) === raceHash(readAt))
    fail("race-sweep", "scripts/race_sweep.js's hash no longer sees an edit to TUNE.race/car/solid or race.js -- the sweep rule would never fire");
  const now = raceHash(readAt), was = raceHash(f => git("show", `${base}:${f}`));
  if (now !== was) {
    let r = null; try { r = JSON.parse(readAt("evidence/race-sweep.json")); } catch (e) {}
    if (!r || r.hash !== now) fail("race-sweep", `the race or a car in it changed (race.js, track.js, car.js and the bodies, solids.js, TUNE.race/car/solid/models, or its checks) and has not been swept as it stands -- run node scripts/race_sweep.js (every car on every track, about 10 min)`);
    else if (!r.ok) fail("race-sweep", `the race sweep FAILED on this content (${r.fail} failed) -- evidence/race-sweep.json`);
  }
}

// ---------- 12. the sharded harness's verdict turns red on every way a run goes wrong (v177) ----------
// a shard that threw, a module run nowhere or twice, a solo phase short of a timing part, a stale
// timing file: scripts/harness_shards.js's verdict, driven with made-up shard results
if (fs.existsSync(path.join(ROOT, "scripts", "harness_shards.js"))) {
  for (const c of require("./harness_shards.js").selftest()) if (!c.ok) fail("harness", `harness_shards.js verdict: ${c.label} -- got exit ${c.code}`);
  // (A1) and the module guard's cases, which are async: the self-test run whole, in its own process (~50 ms)
  const r = spawnSync(process.execPath, [path.join(ROOT, "scripts", "harness_shards.js"), "--selftest"], { cwd: ROOT, encoding: "utf8", timeout: 20000 });
  const bad = String(r.stdout || "").split("\n").filter(l => l.startsWith("BAD "));
  if (r.status !== 0 || bad.length) fail("harness", `node scripts/harness_shards.js --selftest exits ${r.status}${bad.length ? ": " + bad.join(" | ") : ""}${r.stderr ? " -- " + String(r.stderr).trim().split("\n")[0] : ""}`);
}

// ---------- 12b. every module runs through guardModule (A1) ----------
// A module that throws is one FAIL, `<module>: module threw`, and the run goes on -- only if the module is
// called INSIDE harness_shards.js's guardModule, in the harness's runModule and in run_module.js alike; and it
// counts as run (the verdict's "every module ran once") only because runModule's finally records it.
{
  const ht = read("scripts/headless_test.js"), rm = read("scripts/run_module.js");
  const a = ht.indexOf("async function runModule("), b = ht.indexOf("\n  async function newPage(", a);
  const body = a >= 0 && b > a ? ht.slice(a, b) : "";
  const count = (s, re) => (s.match(re) || []).length;
  if (!body) fail("harness", "scripts/headless_test.js: runModule not found (gate 12b reads it to see each module run through guardModule)");
  else {
    const calls = count(body, /require\(\s*name\s*\)/g), guarded = count(body, /guardModule\(\s*key\s*,\s*\(\)\s*=>\s*require\(\s*name\s*\)\s*\(/g);
    if (!calls || calls !== guarded) fail("harness", `scripts/headless_test.js runModule: ${calls - guarded} of ${calls} module call(s) not inside SHARDING.guardModule(key, () => require(name)(opts), check) -- a throw there ends the run instead of failing one check`);
    const fin = body.indexOf("finally {");
    if (fin < 0 || body.indexOf("modTimes.push(", fin) < 0) fail("harness", "scripts/headless_test.js runModule: modTimes.push is not in its finally -- a module that threw would count as never run");
  }
  const rcalls = count(rm, /require\(\s*name\b/g), rguarded = count(rm, /guardModule\([^;]*?,\s*\(\)\s*=>\s*require\(\s*name\b/g);
  if (!rcalls || rcalls !== rguarded) fail("harness", `scripts/run_module.js: ${rcalls - rguarded} of ${rcalls} module call(s) not inside guardModule -- a throw there would not be the harness's \`<module>: module threw\``);
}

// ---------- 13. nothing waits on the harness with pgrep -f (it matches itself: see WAIT_ON_HARNESS) ----------
{
  for (const f of REPO_FILES) {
    if (!/\.(js|sh|md|json|py|txt)$/.test(f) || /^(evidence|docs)\//.test(f)) continue;
    let src; try { src = read(f); } catch (e) { continue; }
    src.split("\n").forEach((l, i) => { if (WAIT_ON_HARNESS.test(l)) fail("harness", `${f}:${i + 1}: waits on the harness with pgrep -f, which matches its own command line and never ends -- run the harness as a background command and let its exit notify`); });
  }
}

// ---------- 14. every shipped file the game fetches is in ASSETS (A2; v215: London's city GLB) ----------
// The file side of rule 3, for what is not a script: every file the repo holds under deploy/shipped-paths.txt
// is either in cockpit/sw.js's ASSETS or named below as shipped-but-never-fetched. The cache-first worker
// serves only what it installed, so a model left out is a city with no buildings offline. (cockpit/js/*.js is
// rule 3's; ASSETS naming a file that is not there is rule 3's too.) Gitignored files never ship, so are not asked.
{
  const NEVER_FETCHED = {
    "cockpit/audio/engines/README.md": "the brief for the engine recordings; engines.js fetches only index.json and the clips it names",
  };
  const held = new Set(gateAssetsOf(read("cockpit/sw.js")).map(a => "cockpit/" + a));
  const shipPaths = read("deploy/shipped-paths.txt").split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));
  for (const f of [...REPO_FILES].sort()) {
    if (!shipPaths.some(p => p.endsWith("/") ? f.startsWith(p) : f === p) || /^cockpit\/js\/[^/]+\.js$/.test(f)) continue;
    if (!fs.existsSync(path.join(ROOT, f))) continue;   // deleted in the working tree: not shipped
    if (NEVER_FETCHED[f]) continue;
    if (!held.has(f)) fail("assets", `${f} ships but is not in ASSETS in cockpit/sw.js -- offline the iPad never has it (v215: London's city GLB, a city with no buildings); add it (and bump CACHE_NAME), or, if the game never fetches it, name it in gate 14's NEVER_FETCHED with why`);
  }
  for (const f of Object.keys(NEVER_FETCHED)) {
    if (!REPO_FILES.has(f)) fail("assets", `gate 14's NEVER_FETCHED names ${f}, which the repo does not hold -- take it out of the list`);
    else if (held.has(f)) fail("assets", `gate 14's NEVER_FETCHED names ${f}, which ASSETS caches -- it is fetched after all; take it out of the list`);
  }
}

// ---------- 15. every check module is run by the harness, and every module it runs exists (A2) ----------
// A scripts/*_check(s).js the harness does not list is checks nobody runs: green for ever, whatever the game does.
// A module the list names that is not on disk is a throw (one FAIL since A1) that says nothing about the game.
// (--run's pattern takes _check.js too, so this does.)
{
  const NOT_MODULES = {
    // stand-alone tools a person runs by hand, each with its own browser and argv -- not a harness module
    polish_check: "the polish rig (CLAUDE.md, Testing habits): node scripts/polish_check.js <tag>; its serve() is shared by the three below",
    fleet_polish_check: "polish fixtures (fixed camera and seed) rendered to docs/; run by hand, takes a tag",
    helicopter_polish_check: "the helicopter polish pass's touch tours and render costs, to docs/; run by hand",
    helicopter_cost_check: "interleaved baseline/candidate perf against LP_POLISH_ROOT; run by hand",
    live_release_check: "keeps an installed release open across a real deployment, waits for Enter; run by hand when shipping",
    eject_live_check: "the same across a deployment, for the eject rescue; run by hand when shipping",
    helicopter_live_check: "the same across a deployment, for the helicopter release; run by hand when shipping",
  };
  if (!HARNESS_MODS_READ) fail("harness", "scripts/headless_test.js: no MODULES list found -- gate 15 reads `const MODULES = [` up to its first `];`, every line a [\"./name\", {...}] row, blank or a comment; the gate's reader needs updating, or the list was broken");
  else for (const f of fs.readdirSync(path.join(ROOT, "scripts")).filter(f => /_checks?\.js$/.test(f)).sort()) {
    const n = f.slice(0, -3);
    if (!HARNESS_MODS.has(n) && !NOT_MODULES[n]) fail("harness", `scripts/${f} is run nowhere in scripts/headless_test.js (not in its MODULES, no runModule call) -- its checks never run, so it stays green whatever the game does; list it (or name it in gate 15's NOT_MODULES with why it is a helper)`);
    if (HARNESS_MODS.has(n) && NOT_MODULES[n]) fail("harness", `gate 15's NOT_MODULES names ${n}, but the harness runs it -- take it out of the list`);
  }
  for (const n of Object.keys(NOT_MODULES)) if (!fs.existsSync(path.join(ROOT, "scripts", n + ".js"))) fail("harness", `gate 15's NOT_MODULES names ${n}, which is not on disk -- take it out of the list`);
  for (const n of HARNESS_MODS) if (!fs.existsSync(path.join(ROOT, "scripts", n + ".js"))) fail("harness", `scripts/headless_test.js runs ./${n}, and there is no scripts/${n}.js -- the module throws and checks nothing (a typo, or a module renamed)`);
}

// ---------- 16. the --run map names real files and real modules (A2) ----------
// The map above is what --run trusts: a key that is no file in cockpit/js/ never matches a change, and a module
// the harness does not run was silently dropped, so a typo ran nothing and said nothing.
// (Its modules are judged only when gate 15 could read the harness's list.)
for (const p of gateRunMapProblems(MODULES, f => fs.existsSync(path.join(jsDir, f)), HARNESS_MODS_READ, n => fs.existsSync(path.join(ROOT, "scripts", n + ".js")))) fail("run-map", p);
for (const f of CITY_FILES) if (!fs.existsSync(path.join(jsDir, f))) fail("run-map", `gate.js CITY_FILES has "${f}", which is not in cockpit/js/ -- the noisy-drive reminder never fires for the file meant`);

// ---------- 17. three.js is the revision the game is built on, byte for byte (A2) ----------
// No upgrade is planned (QUEUE: "NOT doing: any three.js upgrade"); every shader include, the log depth and the
// loader are written against r128. The REVISION says which in the message; the hash catches any edit at all.
{
  const THREE_REVISION = "128";
  const PINNED = {
    "cockpit/three.min.js": "9274bbcec8d96168626c732b5d31c775aa8cfb7eaa0599bec0c175908a2c1ce2",
    "cockpit/GLTFLoader.js": "5c15967ba830918a9caea6338712c994c354bccd4edc4569bde411c3ec06a3e6",   // carries no version: the hash is all
  };
  const rev = gateThreeRevisionOf(read("cockpit/three.min.js"));
  if (rev !== THREE_REVISION) fail("three", `cockpit/three.min.js is three.js r${rev || "?"}, not r${THREE_REVISION} -- every shader, the log depth and GLTFLoader.js are written against r${THREE_REVISION}; there is no upgrade planned`);
  for (const [f, h] of Object.entries(PINNED)) {
    const now = gateSha256(fs.readFileSync(path.join(ROOT, f)));
    if (now !== h) fail("three", `${f} is not the pinned file (sha256 ${now.slice(0, 12)}…, pinned ${h.slice(0, 12)}…) -- three.js does not change by accident; restore it (git checkout ${f}), or, for a deliberate change, re-pin it in gate 17 and say so in the changelog`);
  }
}

// ---------- 18. the A2 readers turn red on the mistakes they exist for (as 11 and 12 prove theirs) ----------
// Each reader above, driven with made-up files: a reader that went blind would leave its rule green for ever.
{
  const sw = 'const ASSETS = [\n  "./",\n  // "./models/a.glb",\n  /* "./models/b.glb", */\n  "./models/c.glb", // cache: "reload"\n  "https://x.org/y.js"\n];';
  const list = (end, extra = "") => `x\n  const MODULES = [\n    ["./a_checks", { newPage, check }],   // v1: a\n    // ["./b_checks", { newPage }],\n    /* ["./c_checks", {}], */\n${extra}    ["./d_check", { newPage, check, viewports: [[1,2],[3,4]] }],\n${end}\n  expectedMods = 1;\n  await runModule("./h_checks", {});\n  // await runModule("./i_checks", {});\n`;
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const mods = gateHarnessModsOf(list("  ];")), A = gateAssetsOf(sw), S = s => [...(s || [])].sort();
  const cases = [
    ["ASSETS: a // or /* */ entry is not cached, a URL with // in it is", eq(A, ["", "models/c.glb", "https://x.org/y.js"])],
    ["ASSETS: \"./\" does not stand in for index.html", !A.includes("index.html")],
    ["harness list: rows, a _check module, a module called by name; no commented-out row or call", eq(S(mods), ["a_checks", "d_check", "h_checks"])],
    ["harness list: re-indented end still read", eq(S(gateHarnessModsOf(list("        ];"))), S(mods))],
    ["harness list: its end broken is unreadable (one message), not sixty", gateHarnessModsOf(list("  ]")) === null && gateHarnessModsOf(list("  ];", "    foo();\n")) === null],
    ["run map: a key that is no game file, and a module typo, both found", gateRunMapProblems({ "a.js": ["a_checks"], "b.js": ["a_chekcs"] }, f => f === "a.js", new Set(["a_checks"]), () => false).length === 2],
    ["run map: a clean map has nothing to say", gateRunMapProblems({ "a.js": ["a_checks"] }, () => true, new Set(["a_checks"]), () => true).length === 0],
    ["three: REVISION through its constant, and written out", gateThreeRevisionOf('"use strict";const e="128",n=1;t.REVISION=e,t.X=1') === "128" && gateThreeRevisionOf('t.REVISION="160",') === "160" && gateThreeRevisionOf("nothing") === undefined],
    ["three: one byte more is another file", gateSha256(Buffer.from("x")) !== gateSha256(Buffer.from("x "))],
  ];
  for (const [label, ok] of cases) if (!ok) fail("gate", `gate 18: ${label} -- a reader the A2 rules lean on went blind, so its rule would never fire`);
}

// ---------- which modules the change answers to ----------
const mods = new Set(); let full = false;
for (const f of changedList) {
  const m = /^cockpit\/js\/(.+\.js)$/.exec(f);
  if (m) { if (MODULES[m[1]]) MODULES[m[1]].forEach(x => mods.add(x)); else full = true; }
  const s = /^scripts\/([a-z_]+_checks?)\.js$/.exec(f);
  if (s) mods.add(s[1]);
  // a helper the modules require (audit_eject.js, race_drive.js, art_rig.js ...): one level, the modules that require it
  const h = /^scripts\/([\w.-]+)\.js$/.exec(f);
  if (h) for (const n of HARNESS_MODS) if (n !== h[1] && new RegExp(`require\\(\\s*["']\\./${h[1].replace(/[.-]/g, "\\$&")}(\\.js)?["']`).test(modSrc(n))) mods.add(n);
  if (f === "cockpit/index.html" || f === "cockpit/sw.js") mods.add("hardening_checks");
}
// only what the harness runs as a module: a hand-run tool that matches _check.js (polish_check ...) is not one
const modList = [...mods].filter(n => HARNESS_MODS_READ ? HARNESS_MODS.has(n) : fs.existsSync(path.join(ROOT, "scripts", n + ".js"))).sort();
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
