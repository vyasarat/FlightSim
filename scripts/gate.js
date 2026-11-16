"use strict";
// The fast gate: everything about a change that can be judged WITHOUT a browser,
// in about a second. It is the inner step of the loop (see "The loop" in
// CLAUDE.md) -- the full harness is still what ships a release; this is what
// stops a turn from ending on something the harness would only find 40 minutes
// later, or deploy.sh would only refuse on the droplet.
//
//   node scripts/gate.js                 judge the working tree against origin/main
//   node scripts/gate.js --base=<ref>    ... against another ref
//   node scripts/gate.js --modules       only print the harness modules the change touches (stdout, one a line);
//                                        what they do NOT cover goes to stderr as "note: ..." lines
//   node scripts/gate.js --tune-readers  print the TUNE aliases and which game files read each TUNE_MODULES row
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
// the full harness -- the honest default for anything shared (main, sky, scenery ...).
// tune.js is not here: it answers by TUNE block (TUNE_MODULES, below). A row in
// PARTIAL is knowingly a subset, and --run says the full harness is still the judge.
const MODULES = {
  "car.js": ["road_checks", "car_feel_checks", "city_checks", "cybertruck_checks", "corvette_checks", "corner_cam_checks", "london_drive_checks", "leave_matrix_checks"],
  "corvette.js": ["corvette_checks", "slot_checks", "engine_sound_checks"],
  "highway.js": ["road_checks", "car_feel_checks"],
  "streets.js": ["city_checks", "road_checks", "solidity_checks", "corvette_checks", "london_drive_checks"],
  "city.js": ["city_checks"], "citydata.js": ["city_checks", "solidity_checks"],
  "lights.js": ["lights_police_checks", "road_checks"], "police.js": ["lights_police_checks", "cybertruck_checks", "corvette_checks"],
  "vehiclekit.js": ["road_checks", "city_checks", "london_drive_checks"],
  "solids.js": ["solidity_checks", "corner_cam_checks"], "collision.js": ["solidity_checks"],
  "track.js": ["track_checks", "race_checks"], "race.js": ["audit_race_checks", "race_checks", "london_race_checks", "race_track_checks", "race_item_checks", "frame_budget_checks", "slot_checks", "vehicle_contract_checks", "state_semantics_checks", "leave_matrix_checks"], "raceitems.js": ["race_item_checks", "race_checks", "race_track_checks", "slot_checks"], "raceevents.js": ["race_event_checks", "race_track_checks", "race_item_checks", "solidity_checks", "frame_budget_checks"], "launchsite.js": ["launchsite_checks", "payoff_size_checks", "heavy_checks"], "heavy.js": ["heavy_checks", "launchsite_checks"], "rocketsled.js": ["rocketsled_checks", "payoff_size_checks", "sledride_checks"], "sledride.js": ["sledride_checks", "rocketsled_checks", "slot_checks", "solidity_checks"], "crane.js": ["crane_checks", "slot_checks", "solidity_checks", "vehicle_contract_checks", "state_semantics_checks"], "dadmode.js": ["audit_hud_checks", "dadmode_checks", "dadmissions_checks", "slot_checks", "vehicle_contract_checks", "state_semantics_checks"], "valley.js": ["dadmode_checks", "solidity_checks"], "dadair.js": ["dadmissions_checks"], "dad_dam.js": ["dadmissions_checks"], "fireworksbarge.js": ["fireworksbarge_checks", "payoff_size_checks"], "titan.js": ["titan_checks", "leave_matrix_checks", "event_pool_checks", "solidity_checks", "frame_budget_checks"], "monstertruck.js": ["monstertruck_checks", "payoff_size_checks", "monster_checks"], "monster.js": ["monster_checks", "solidity_checks", "slot_checks", "corner_cam_checks"],
  "boat.js": ["boat_checks", "sea_checks", "london_thames_checks"], "harbor.js": ["boat_checks", "lock_checks", "sea_checks", "audit_hud_checks"],
  "lock.js": ["lock_checks"], "yacht.js": ["yacht_checks"], "seaevents.js": ["sea_checks"],
  "heli.js": ["heli_control_checks", "heli_play_checks", "heli_land_checks"],
  "buttons.js": ["slot_checks", "leave_matrix_checks"], "speed.js": ["speed_horn_checks"],
  "engines.js": ["engine_sound_checks", "leave_matrix_checks"], "audio.js": ["engine_sound_checks", "hardening_checks", "audit_hud_checks", "audit_race_checks", "audit_dad_checks", "leave_matrix_checks"],
  "eventpool.js": ["event_pool_checks"], "events.js": ["event_pool_checks", "events_perf_checks"],
  "vehicles.js": ["vehicle_contract_checks", "state_semantics_checks", "solidity_checks", "cybertruck_checks", "corvette_checks", "leave_matrix_checks"],
  "state.js": ["state_semantics_checks", "vehicle_contract_checks", "audit_hud_checks", "audit_cars_checks", "leave_matrix_checks"], "setpieces.js": ["audit_hud_checks"],
  "vehicle.js": ["aircraft_orientation_checks", "cybertruck_checks", "corvette_checks"], "models.js": ["aircraft_orientation_checks", "cybertruck_checks", "corvette_checks"],
  "eject.js": ["eject_framing_checks", "audit_cars_checks", "audit_flight_checks", "leave_matrix_checks"], "toyfinish.js": ["toyfinish_checks"],
  "toyworld.js": ["toyworld_checks", "audit_race_checks"], "workshop.js": ["workshop_checks", "workshop_play_checks"],
  "marsbase.js": ["robot_checks", "robot_play_checks", "audit_space_checks"], "rover.js": ["robot_play_checks", "audit_space_checks"],
  "input.js": ["hardening_checks", "slot_checks", "london_checks", "audit_flight_checks", "audit_harness_checks", "audit_london_checks", "audit_hud_checks"],
  "london.js": ["audit_london_checks", "london_checks", "london_drive_checks", "london_thames_checks", "london_race_checks", "city_checks", "slot_checks", "solidity_checks", "frame_budget_checks", "dadmissions_checks", "sea_checks"],
  // the world's shape and what stands on it: v197 moved them and only the full harness saw the
  // Doolittle carrier land in Britain (dadmissions) and a runway drawn from every venue (frame budget)
  "terrain.js": ["dadmissions_checks", "sea_checks", "frame_budget_checks", "london_checks"],
  "scene.js": ["frame_budget_checks", "london_checks"], "landmarks.js": ["frame_budget_checks", "london_checks", "toyworld_checks"],
  // (A3) the plane model and the frame loop: the modules that put him in a plane and fly, land, eject, bang
  // and leave it (audit_flight, eject_framing, aircraft_orientation, cleanup), pin each vehicle's numbers
  // (vehicle_contract), and run every mode through update() -- its buttons, solids, engines, events, sounds
  // and its early returns (the picker, a resize, a stale save: hardening)
  "flight.js": ["audit_flight_checks", "eject_framing_checks", "aircraft_orientation_checks", "cleanup_checks", "vehicle_contract_checks",
    "state_semantics_checks", "slot_checks", "solidity_checks", "engine_sound_checks", "event_pool_checks", "audit_hud_checks", "hardening_checks", "leave_matrix_checks"],
  // the rocket: the modules that set it (or the Starship) and fly it -- drops, the go button, skipping to land,
  // re-entry's overlay and rumble, Mars's pad -- and the booster he flies from the launch site
  "rocket.js": ["heavy_checks", "launchsite_checks", "audit_space_checks", "event_pool_checks", "events_perf_checks", "audit_hud_checks",
    "cleanup_checks", "solidity_checks", "engine_sound_checks", "slot_checks", "speed_horn_checks", "vehicle_contract_checks", "state_semantics_checks"],
  // the HUD's elements, its dials, the progress strip and the confetti: the modules that read them
  // (slot_checks and hardening measure every element; audit_flight reads the strip's dots; race_checks the confetti)
  "hud.js": ["slot_checks", "audit_hud_checks", "hardening_checks", "audit_flight_checks", "race_checks"],
};
// (A3) Files whose map above is knowingly a subset: --run runs it, and still says the full harness is the
// only complete judge for them -- a partial map must not read as "covered".
const PARTIAL = {
  "flight.js": "flight.js is the plane AND the frame loop every mode runs through; the plane's take-off, landing rings, the go-around and the rocket's recovery are inline T- sections of headless_test.js (v212's own find, the fairing never reaching the net boat, was one)",
  "rocket.js": "the rocket's ascent, its three drops, the droneship and net-boat recovery and the tower catch are inline T- sections of headless_test.js",
  "hud.js": "headless_test.js checks the HUD inline, where no module runs it: the three dials fully on-screen in every viewport, \"view: chase active, frame hidden, dials kept\", the zero-text audit and the #bigNum numerals",
};

// (A3) A file whose BARE uses of the TUNE aliases only hand them on, so are no read of a whole block (its X.key
// and TUNE.a reads still count). Without this, main.js would read every block and every row would be "partial".
const TUNE_EXPORT_ONLY = {
  "main.js": "window.__lp = { ..., HW, CAR, LD, ... } hands the aliases to the harness by name; main.js reads none of them through it",
};

// (A3) What a change in tune.js answers to, by the TUNE block it changed (read by gateTuneChanges below).
// WHO READS a block is not typed here: gateTuneReaders computes it on every run from cockpit/js -- `TUNE.a` or
// `TUNE.a.b` in the text, or any use of an alias of one (`const HW = TUNE.highway`, `const LDR = LD.river`, at
// top level, read from every file, or local, read in its own file) -- and each reader's MODULES row gives the
// modules. A reader with no MODULES row, or one in PARTIAL, keeps "only the full harness is complete" in --run's
// text, naming the file. Typed here is only what the code cannot show:
//   add      modules that name the block themselves (or replay it: crane_checks and the demolition)
//   partial  why the block's modules are a subset even so (the picture is the inline visual hashes ...)
//   full     the block is the full harness's alone, and why
// "*" is every top-level key that is not a block (the loose scalars). A "block.key" row takes that sub-block
// on its own (its readers: those of the sub-block and of the whole block); the rest of the block is the block's.
// Gate 19 holds every block in tune.js to a row here, so a new block is never silently unmapped.
const PICTURE = "the picture it changes is judged by the visual hashes, which are inline in headless_test.js";
const TUNE_MODULES = {
  "*": { full: "the loose numbers outside any block (fov, cruiseSpeed, the terrain, fog, runway, rings, HUD dials, waterLevel, ~150 keys) are read by flight.js, scene.js, terrain.js, scenery.js, main.js, landing.js and more -- waterLevel alone by 43 files" },
  light: { partial: PICTURE },
  camera: { add: ["vehicle_contract_checks"], partial: PICTURE },
  audio: {},
  lights: {},
  police: {},
  ambient: { partial: "T-BIRDS (the birds, gulls and whale) is inline in headless_test.js" },
  models: { add: ["vehicle_contract_checks", "solidity_checks"] },
  burner: {},
  highway: { add: ["solidity_checks"] },
  city: {},
  car: { add: ["speed_horn_checks", "engine_sound_checks", "solidity_checks", "vehicle_contract_checks", "car_feel_checks", "monster_checks", "track_checks"] },
  corvette: { add: ["corvette_checks"] },
  palette: { full: "the ~21 colours are read by 39 files, every builder in the game -- their modules are 48, the whole harness by another name; and what it changes is the picture, judged by the inline visual hashes" },
  water: { partial: PICTURE },
  sky: { partial: PICTURE },
  rocketTune: {},
  events: {},
  toyWorld: {},
  heli: { add: ["vehicle_contract_checks", "cleanup_checks", "fireworksbarge_checks", "monstertruck_checks"] },
  track: {},
  solid: { add: ["crane_checks", "dadmissions_checks", "heli_land_checks", "solidity_checks"] },
  rover: { add: ["solidity_checks", "vehicle_contract_checks"] },
  demolition: { add: ["crane_checks"] },   // crane_checks replays v144's demolition frame for frame (v213's find)
  launchSite: { add: ["crane_checks", "heavy_checks", "monster_checks", "monstertruck_checks", "payoff_size_checks", "rocketsled_checks", "sledride_checks"] },
  rocketSled: { add: ["payoff_size_checks"] },
  fireworksBarge: { add: ["monster_checks", "monstertruck_checks"] },
  titan: { add: ["leave_matrix_checks", "event_pool_checks", "solidity_checks", "frame_budget_checks"] },
  heavy: {},
  sledRide: {},
  crane: {},
  monster: { add: ["corner_cam_checks"] },
  monsterTruck: { add: ["launchsite_checks"] },
  lock: {},
  boat: { add: ["vehicle_contract_checks"] },
  yacht: { add: ["vehicle_contract_checks"] },
  seaEvents: {},
  harbor: {},
  firefight: { add: ["heli_control_checks"], partial: "the fire rig's set-piece is an inline T-SP section of headless_test.js" },
  carrier: { partial: "the carrier's set-piece is an inline T-SP section of headless_test.js" },
  marsBase: { add: ["vehicle_contract_checks"] },
  towerCatch: {},
  eject: {},
  valley: { add: ["dadmode_checks"] },
  dad: { add: ["audit_dad_checks", "dadmissions_checks", "dadmode_checks"] },
  vehicles: { full: "each vehicle's profile is state.vp (state.js sets it to TUNE.vehicles[key]), and 36 files read state.vp -- the rocket, size, cruiseSpeed and gear flags steer nearly every mode" },
  airport: { add: ["solidity_checks"] },
  race: { add: ["london_race_checks", "race_checks", "race_track_checks"] },
  "race.tracks": { add: ["race_checks", "race_track_checks"] },
  london: { add: ["london_drive_checks", "london_race_checks"] },
  "london.river": { add: ["london_thames_checks", "audit_london_checks", "london_race_checks"] },
  "london.drive": { add: ["london_drive_checks"] },
  vehicleColors: { partial: PICTURE },
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

// ---------- the A3 readers: which TUNE block a tune.js change moved, and what that answers to ----------
// (Not race_sweep.js's tuneBlock: that one hashes a block's TEXT, comments and all, because the sweep is a receipt
// for exactly what is on disk. Here the question is which VALUES moved, so a comment is nothing and a value moved
// is its block, however it is laid out.)
const gateIsBlock = v => !!v && typeof v === "object" && !Array.isArray(v);
// a value, written out so that two values are the same exactly when this is (insertion order kept, -0 and NaN kept)
function gateTuneSer(v) {
  if (typeof v === "number") return Object.is(v, -0) ? "-0" : String(v);
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "function") return "fn:" + v.toString();
  if (Array.isArray(v)) return "[" + v.map(gateTuneSer).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).map(k => JSON.stringify(k) + ":" + gateTuneSer(v[k])).join(",") + "}";
  return String(v);
}
// tune.js read: its TUNE object (evaluated, as gate 7 does), and everything outside it (comments and space out)
function gateTuneRead(src) {
  if (typeof src !== "string") return { err: "no tune.js" };
  let tune;
  try { const ctx = { Math }; vm.createContext(ctx); vm.runInContext(src + "\n;this.__TUNE = TUNE;", ctx); tune = ctx.__TUNE; }
  catch (e) { return { err: String(e.message).split("\n")[0] }; }
  if (!gateIsBlock(tune)) return { err: "TUNE is not an object" };
  const s = gateStripComments(src), m = /\bconst\s+TUNE\s*=\s*\{/.exec(s);
  if (!m) return { err: "no `const TUNE = {` in it" };
  let d = 0, i = m.index + m[0].length - 1;
  for (; i < s.length; i++) {
    const c = s[i];
    if (c === '"' || c === "'" || c === "`") { let j = i + 1; for (; j < s.length && s[j] !== c; j++) if (s[j] === "\\") j++; i = j; continue; }
    if (c === "{") d++; else if (c === "}" && --d === 0) break;
  }
  if (i >= s.length) return { err: "TUNE's closing brace not found" };
  return { tune, rest: (s.slice(0, m.index) + s.slice(i + 1)).replace(/\s+/g, "") };
}
// What moved between two tune.js's: [{ path, top, block }] -- path "heli", or "london.river" for a block in `split`
// (a block whose sub-blocks have rows of their own); block false for a loose top-level number. `why` when the gate
// cannot attribute the change: either side unreadable, or a change outside the TUNE object.
function gateTuneChanges(wasSrc, nowSrc, split) {
  const A = gateTuneRead(wasSrc), B = gateTuneRead(nowSrc);
  if (A.err || B.err) return { paths: [], why: B.err ? `tune.js would not read (${B.err})` : `the base's tune.js would not read (${A.err})` };
  const paths = [];
  for (const k of new Set([...Object.keys(A.tune), ...Object.keys(B.tune)])) {
    const a = A.tune[k], b = B.tune[k];
    if (gateTuneSer(a) === gateTuneSer(b)) continue;
    const block = gateIsBlock(a) || gateIsBlock(b);
    if (split.has(k) && gateIsBlock(a) && gateIsBlock(b)) {
      for (const s of new Set([...Object.keys(a), ...Object.keys(b)])) if (gateTuneSer(a[s]) !== gateTuneSer(b[s])) paths.push({ path: k + "." + s, top: k, block: true });
    } else paths.push({ path: k, top: k, block });
  }
  return { paths, why: A.rest !== B.rest ? "tune.js changed outside the TUNE object" : null };
}
// Who reads which TUNE block, computed from the game's sources ({ file: source }): per file the paths it reads
// ("a", or "a.b" where the reader can tell), and the aliases found. A path is read when the text says TUNE.a(.b),
// or when an alias is used: `X = TUNE.a(.b...)` or `X = <alias>(.b...)` declares one -- at column 0 it is global
// (classic scripts share one scope, so every file sees it), indented it is local to its file. A use is the bare
// name (not after a dot, not the left of an `=`), and `X.b` reads the sub-block b of a block alias. The bare
// `TUNE.a` that only declares an alias is not itself a read of all of a (its uses say what is read).
// Shadowing: a file that declares a name locally reads it as BOTH its own binding and the global alias of that
// name -- the reader cannot see scopes, and over-attributing runs a module too many, never one too few.
function gateBlankStrings(src) {
  let out = "";
  for (let i = 0; i < src.length;) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1; for (; j < src.length && src[j] !== c; j++) if (src[j] === "\\") j++;
      out += c === "`" ? src.slice(i, j + 1) : c + " ".repeat(Math.max(0, Math.min(j, src.length) - i - 1)) + (j < src.length ? c : "");
      i = j + 1; continue;
    }
    out += c; i++;
  }
  return out;
}
function gateTuneReaders(srcs, keysOf, bare = new Set()) {
  const ID = "[A-Za-z_$][\\w$]*";
  const declRe = new RegExp(`(\\b(?:const|let|var)\\s+|,\\s*)(${ID})\\s*=(?!=)\\s*(${ID})((?:\\s*\\.\\s*${ID})*)\\s*(?=[,;)]|$)`, "gm");
  const files = Object.keys(srcs).sort(), code = {}, decls = [], owns = {};
  for (const f of files) {
    // comments out, and the inside of '...' and "..." strings blanked ("H" is no read of H); a template literal
    // is kept whole, since its ${...} is code (and a quote in its text starts no string)
    code[f] = gateBlankStrings(gateStripComments(srcs[f]));
    // the names this file declares for itself below the top level (a const/let/var in a function, a parameter):
    // where a global alias's name is one of them, the name may be either, so the global counts only as X.key where
    // key IS a key of its block (`H.cruise` is the helicopter's, `H.hz` the horn's), never by a bare use
    const own = owns[f] = new Set();
    for (const line of code[f].split("\n")) if (!/^(?:const|let|var)\s/.test(line) && /\b(?:const|let|var)\s/.test(line))
      for (const m of line.matchAll(new RegExp(`\\b(?:const|let|var)\\s+(${ID})|,\\s*(${ID})\\s*=(?!=)`, "g"))) own.add(m[1] || m[2]);
    for (const m of code[f].matchAll(new RegExp(`function\\s*[\\w$]*\\s*\\(([^)]*)\\)|\\(([^()]*)\\)\\s*=>|(${ID})\\s*=>`, "g")))
      for (const n of (m[1] || m[2] || m[3] || "").split(/[^\w$]+/)) if (n) own.add(n);
    for (const line of code[f].split("\n")) {
      const top = /^(?:const|let|var)\s/.test(line);
      if (!/\b(?:const|let|var)\s/.test(line)) continue;   // declarations only, not every assignment
      declRe.lastIndex = 0; let m;
      while ((m = declRe.exec(line))) decls.push({ file: f, top, name: m[2], root: m[3], segs: m[4].split(".").map(x => x.trim()).filter(Boolean) });
    }
  }
  const global = new Map(), local = {};   // name -> Set(path)
  const add = (map, n, p) => { if (!map.has(n)) map.set(n, new Set()); const had = map.get(n).has(p); map.get(n).add(p); return !had; };
  const deeper = (p, segs) => p.split(".").concat(segs).slice(0, 2).join(".");
  // the global alias `name` as read in file f by `name.seg` (seg undefined: a bare use), or nothing where f's own name hides it
  const viaGlobal = (f, name, seg) => [...(global.get(name) || [])].filter(p => {
    if (!owns[f].has(name)) return true;
    if (!keysOf) return true;                      // no keys to tell them apart: over, never under
    const ks = keysOf(p); return seg !== undefined && !!ks && ks.has(seg);
  });
  for (let pass = 0, grew = true; grew && pass < 8; pass++) {
    grew = false;
    for (const d of decls) {
      const paths = d.root === "TUNE" ? (d.segs.length ? [d.segs.slice(0, 2).join(".")] : [])
        : [...((local[d.file] || new Map()).get(d.root) || []), ...viaGlobal(d.file, d.root, d.segs[0])].map(p => deeper(p, d.segs));
      for (const p of paths) {
        if (d.top) grew = add(global, d.name, p) || grew;
        else grew = add(local[d.file] || (local[d.file] = new Map()), d.name, p) || grew;
      }
    }
  }
  const reads = {};
  for (const f of files) {
    const r = new Set(), c = code[f];
    for (const m of c.matchAll(new RegExp(`(?<![\\w$.])TUNE\\s*\\.\\s*(${ID})(?:\\s*\\.\\s*(${ID}))?(?![\\w$])`, "g"))) {
      if (!m[2] && new RegExp(`${ID}\\s*=\\s*$`).test(c.slice(Math.max(0, m.index - 80), m.index)) && /^\s*[;,)]/.test(c.slice(m.index + m[0].length))) continue;   // `X = TUNE.a;`: an alias, its uses count
      r.add(m[2] ? m[1] + "." + m[2] : m[1]);
    }
    const loc = local[f] || new Map(), names = new Set([...global.keys(), ...loc.keys()]);
    if (names.size) {
      const re = new RegExp(`(?<![\\w$.])(${[...names].map(n => n.replace(/\$/g, "\\$")).join("|")})(?![\\w$])(\\s*\\.\\s*(${ID}))?`, "g");
      for (const m of c.matchAll(re)) {
        if (!m[2] && /^\s*=(?!=)/.test(c.slice(m.index + m[0].length))) continue;   // its own declaration, or a write to it
        if (!m[2] && bare.has(f)) continue;                                          // a file that only hands the aliases on
        for (const p of [...(loc.get(m[1]) || []), ...viaGlobal(f, m[1], m[3])]) r.add(m[3] ? deeper(p, [m[3]]) : p);
      }
    }
    if (r.size) reads[f] = r;
  }
  return { reads, aliases: { global, local } };
}
// The files that read a row: "a.b" -- those reading a.b or the whole of a; a split block "a" -- those reading a whole
// or a sub-block with no row of its own; any other block -- those reading anything of it.
function gateTuneRowReaders(key, map, reads) {
  const [top, sub] = key.split("."), split = Object.keys(map).some(k => k.startsWith(top + "."));
  return Object.keys(reads).filter(f => [...reads[f]].some(p => {
    const [t, s] = p.split(".");
    if (t !== top) return false;
    if (sub !== undefined) return s === undefined || s === sub;
    return !split || s === undefined || !map[p];
  })).sort();
}
// The modules those changes answer to, and what --run must still say: one note per row (a row's paths together).
// A path with no row, a `full` row, a `partial` row, or a reader that is PARTIAL or has no MODULES row, each keep the
// full harness named -- and the files that make it so.
function gateTuneSelect(ch, map, readersOf, modsOf, partialOf) {
  const mods = new Set(), rows = new Map();
  for (const p of ch.paths) {
    const key = !p.block ? "*" : map[p.path] ? p.path : p.top;
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push("TUNE." + p.path);
  }
  const notes = [];
  if (ch.why) notes.push(`${ch.why} -- the gate cannot say which block moved, so only the full harness says anything about it`);
  for (const [key, names] of rows) {
    const e = map[key], who = names.length > 4 ? names.slice(0, 4).join(", ") + ` and ${names.length - 4} more` : names.join(", ");
    if (!e) { notes.push(`${who}: no row in gate.js TUNE_MODULES -- only the full harness says anything about it`); continue; }
    if (e.full) { notes.push(`${who}: only the full harness -- ${e.full}`); continue; }
    const part = [], files = readersOf(key), none = files.filter(f => !modsOf(f)), half = files.filter(f => modsOf(f) && partialOf(f));
    for (const f of files) (modsOf(f) || []).forEach(m => mods.add(m));
    (e.add || []).forEach(m => mods.add(m));
    if (e.partial) part.push(e.partial);
    if (none.length) part.push(`read by ${none.join(", ")}, which no module owns`);
    if (half.length) part.push(`read by ${half.join(", ")}, whose modules are partial`);
    if (!files.length && !(e.add || []).length) part.push("the gate found no file that reads it");
    if (part.length) notes.push(`${who}: the modules are partial (${part.join("; ")}) -- only the full harness is complete for it`);
  }
  return { mods: [...mods].sort(), notes };
}
// What is wrong with TUNE_MODULES against tune.js as it stands: a block with no row (a NEW block would be silently
// unmapped), a row for a block that is gone, a full row that also names modules, a module the harness does not run.
function gateTuneMapProblems(map, tune, mods) {
  const out = [];
  if (!map["*"]) out.push(`gate.js TUNE_MODULES has no "*" row -- a loose number outside any block would answer to nothing`);
  for (const [k, v] of Object.entries(tune || {})) if (gateIsBlock(v) && !map[k]) out.push(`TUNE.${k} is a block with no row in gate.js TUNE_MODULES -- --run would say only "no row" for it; give it a row ({} takes its readers' modules; add, partial or { full: "why" } as the evidence says)`);
  for (const [k, e] of Object.entries(map)) {
    if (k === "*") { if (!e.full) out.push(`gate.js TUNE_MODULES["*"] must be { full: "why" } -- the loose numbers have no block to compute readers for`); continue; }
    const [top, sub] = k.split(".");
    if (!gateIsBlock((tune || {})[top]) || (sub !== undefined && !(sub in tune[top]))) { out.push(`gate.js TUNE_MODULES has "${k}", which is no block in tune.js -- a stale row; take it out`); continue; }
    if (e.full && (e.add || e.partial)) out.push(`gate.js TUNE_MODULES["${k}"] is { full } and names modules too -- one or the other`);
    for (const x of Object.keys(e)) if (!["add", "partial", "full"].includes(x)) out.push(`gate.js TUNE_MODULES["${k}"] has "${x}" -- a row is add, partial or full (its readers are computed)`);
    if (mods) for (const n of e.add || []) if (!mods.has(n)) out.push(`gate.js TUNE_MODULES["${k}"] adds "${n}", which the harness does not run -- --run drops it without a word`);
  }
  return out;
}
const TUNE_SPLIT = new Set(Object.keys(TUNE_MODULES).filter(k => k.includes(".")).map(k => k.split(".")[0]));

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
      ["race.js", "terrain.js", "london.js", "streets.js"].some(n => raceHash(f => f === `cockpit/js/${n}` ? readAt(f) + "//x" : readAt(f)) === raceHash(readAt)) ||
      raceHash(f => f === "cockpit/js/tune.js" ? tune.replace(/^(  track: \{[\s\S]*?\n    ds: )/m, "$1-") : readAt(f)) === raceHash(readAt))   // (C1: the ground, London, the streets, TUNE.track.ds)
    fail("race-sweep", "scripts/race_sweep.js's hash no longer sees an edit to TUNE.race/car/solid, TUNE.track.ds, or race.js, terrain.js, london.js, streets.js -- the sweep rule would never fire");
  const now = raceHash(readAt), was = raceHash(f => git("show", `${base}:${f}`));
  if (now !== was) {
    let r = null; try { r = JSON.parse(readAt("evidence/race-sweep.json")); } catch (e) {}
    if (!r || r.hash !== now) fail("race-sweep", `the race or a car in it changed (race.js, track.js, car.js and the bodies, solids.js, the ground under it -- terrain.js, london.js, streets.js --, TUNE.race/car/solid/models or TUNE.track.ds, its checks or its pin) and has not been swept as it stands -- run node scripts/race_sweep.js (every car on every track and the race pin, about 30 min)`);
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
  // (A3) the tune.js readers, on a made-up tune.js and made-up game files: what moved, who reads it (through
  // aliases too), what it answers to, and when the gate must say "full harness"
  const T0 = '"use strict";\n// TUNE\nconst TUNE = {\n  fov: 72,\n  heli: { cruise: 90, deep: { a: [1, 2] } },   // an unbalanced { in a comment\n' +
    '  london: { seaFrom: 1, river: { gateOut: 18 }, drive: { step: 2 } },\n  palette: { white: 0xf2f4f7 },\n  part: { a: 1 },\n  s: "a } brace in a string",\n};\nconst DEG = Math.PI / 180;\n';
  const SRC = {
    "heli.js": "const H = TUNE.heli;\nfunction f() { return H.cruise; }\n",
    "other.js": "function g() { return H.deep; }\n",                                         // heli.js's alias, read elsewhere
    "london.js": "const LD = TUNE.london;\nconst LDR = LD.river;\nfunction r() { return LDR.gateOut + LD.seaFrom; }\n",
    "thames.js": "function t() { return LDR.gateOut; }\n",                                   // a sub-block's alias, read elsewhere
    "quiet.js": "// H.cruise and TUNE.heli in a comment\n/* LDR.gateOut */\nfunction q() { return 'H'; }\n",
    "shadow.js": "function s() { const H = TUNE.car.horn; return H.f; }\n",                  // a local H over the global one
    "flight.js": "function u() { return TUNE.part.a; }\n",
    "nomod.js": "function n() { return TUNE.heli.cruise; }\n",
    "whole.js": "function w() { return Object.keys(TUNE.london); }\n",                    // the whole block: every row of it
  };
  const R = gateTuneReaders(SRC), RS = f => [...(R.reads[f] || [])].sort();
  const SRC2 = { "heli.js": SRC["heli.js"], "horn.js": "function h(H) { return H.hz + H.cruise; }\nfunction k() { return H; }\n",
    "lp.js": "window.__lp = { H, x: H.cruise };\n", "cam.js": "function c() { return H.hz; }\n" };
  const R2 = gateTuneReaders(SRC2, p => p === "heli" ? new Set(["cruise", "deep"]) : undefined, new Set(["lp.js"])), RS2 = f => [...(R2.reads[f] || [])].sort();
  const SPLIT = new Set(["london"]), P = (a, b) => gateTuneChanges(a, b, SPLIT).paths.map(p => p.path).sort();
  const MAP = { "*": { full: "loose" }, heli: { add: ["speed_horn_checks"] }, london: {}, "london.river": { add: ["london_thames_checks"] }, palette: { full: "everywhere" }, part: {} };
  const modsOf = f => ({ "heli.js": ["heli_play_checks"], "other.js": ["other_checks"], "london.js": ["london_checks"], "thames.js": ["thames_checks"], "quiet.js": ["quiet_checks"],
    "shadow.js": ["shadow_checks"], "flight.js": ["audit_flight_checks"] })[f], partialOf = f => f === "flight.js" ? "the loop" : undefined;
  const RO = k => gateTuneRowReaders(k, MAP, R.reads);
  const TS = (a, b) => gateTuneSelect(gateTuneChanges(a, b, SPLIT), MAP, RO, modsOf, partialOf);
  const heli = T0.replace("a: [1, 2]", "a: [1, 3]"), river = T0.replace("gateOut: 18", "gateOut: 19"), both = heli.replace("0xf2f4f7", "0xf2f4f8");
  const sel = TS(T0, heli), selR = TS(T0, river), noRow = TS(T0, T0.replace("  fov: 72,\n", "  fov: 72,\n  fresh: { a: 1 },\n"));
  const selP = TS(T0, T0.replace("part: { a: 1 }", "part: { a: 2 }")), selF = TS(T0, both), selS = TS(T0, T0.replace("fov: 72", "fov: 73"));
  const bad = TS(T0, T0.replace("cruise: 90,", "cruise: ,")), out = TS(T0, T0.replace("/ 180", "/ 181"));
  const quiet = TS(T0, T0.replace("  heli: {", "  // more words\n\n  heli:   {").replace("// TUNE\n", "// TUNE, every number\n\n"));
  const tune0 = gateTuneRead(T0).tune || {}, HM = new Set(["speed_horn_checks", "london_thames_checks"]);
  cases.push(
    ["tune readers: an alias read in another file is a read of its block", eq(RS("other.js"), ["heli.deep"]) && eq(RO("heli"), ["heli.js", "nomod.js", "other.js", "shadow.js"])],
    ["tune readers: an alias of a sub-block, and one made from an alias, read the sub-block -- in any file", eq(RS("thames.js"), ["london.river"]) && eq(RS("london.js"), ["london.river", "london.seaFrom"]) &&
      eq(RO("london.river"), ["london.js", "thames.js", "whole.js"]) && eq(RO("london"), ["london.js", "whole.js"])],
    ["tune readers: a use in a comment is no read", !R.reads["quiet.js"]],
    ["tune readers: an alias's own declaration is not a read of its whole block", eq(RS("heli.js"), ["heli.cruise"])],
    ["tune readers: a local alias over a global name reads as both (over, never under)", eq(RS("shadow.js"), ["car.horn", "heli.f"])],
    ["tune readers: where a file declares the name itself, the global alias is read only by its block's own keys", eq(RS2("horn.js"), ["heli.cruise"]) && eq(RS2("cam.js"), ["heli.hz"])],
    ["tune readers: a file that only hands the aliases on reads none by a bare use, but still by X.key", eq(RS2("lp.js"), ["heli.cruise"])],
    ["tune: a value moved deep inside a block is its block, and takes every reader's modules", eq(P(T0, heli), ["heli"]) &&
      eq(sel.mods, ["heli_play_checks", "other_checks", "shadow_checks", "speed_horn_checks"]) && sel.notes.length === 1 && /read by nomod\.js, which no module owns/.test(sel.notes[0])],
    ["tune: a sub-block with its own row is that row; the rest of its block is the block's", eq(P(T0, river), ["london.river"]) && eq(selR.mods, ["london_checks", "london_thames_checks", "thames_checks"]) &&
      eq(TS(T0, T0.replace("step: 2", "step: 3")).mods, ["london_checks"])],
    ["tune: two blocks moved are both", eq(P(T0, both), ["heli", "palette"]) && selF.mods.includes("heli_play_checks") && selF.notes.some(n => /TUNE\.palette: only the full harness/.test(n))],
    ["tune: a comment, a blank line or spacing moves nothing, and says nothing", eq(P(T0, T0.replace("  heli: {", "  // more words\n\n  heli:   {")), []) && !quiet.mods.length && !quiet.notes.length],
    ["tune: an unreadable tune.js is the full harness, never silence", !bad.mods.length && bad.notes.length === 1 && /would not read/.test(bad.notes[0])],
    ["tune: a change outside TUNE is the full harness", !out.mods.length && out.notes.some(n => /outside the TUNE object/.test(n))],
    ["tune: a loose number is the \"*\" row", eq(P(T0, T0.replace("fov: 72", "fov: 73")), ["fov"]) && selS.notes.some(n => /TUNE\.fov: only the full harness -- loose/.test(n))],
    ["tune: a block with no row is the full harness, never silence", !noRow.mods.length && noRow.notes.some(n => /TUNE\.fresh: no row/.test(n))],
    ["tune: a block read by a partial file says the full harness is the complete judge", eq(selP.mods, ["audit_flight_checks"]) && selP.notes.some(n => /flight\.js, whose modules are partial.*only the full harness is complete/.test(n))],
    ["tune map: a new block with no row, a stale row, a module typo and a typed key are found; a clean map is not",
      gateTuneMapProblems(MAP, Object.assign({}, tune0, { fresh: {} }), HM).length === 1 &&
      gateTuneMapProblems(Object.assign({}, MAP, { gone: { add: ["speed_horn_checks"] } }), tune0, HM).length === 1 &&
      gateTuneMapProblems(Object.assign({}, MAP, { heli: { add: ["speed_horn_chekcs"] } }), tune0, HM).length === 1 &&
      gateTuneMapProblems(Object.assign({}, MAP, { heli: { from: ["heli.js"] } }), tune0, HM).length === 1 &&
      gateTuneMapProblems(MAP, tune0, HM).length === 0],
  );
  for (const [label, ok] of cases) if (!ok) fail("gate", `gate 18: ${label} -- a reader the A2/A3 rules lean on went blind, so its rule would never fire`);
}

// ---------- 19. every TUNE block answers to something, or says it is the full harness's (A3) ----------
// --run selects by TUNE block (TUNE_MODULES): a block with no row would select nothing and say so only in --run's
// text, so a NEW block must get a row (its modules, or { full: "why" }) before the change is done.
const TUNE_NOW = gateTuneRead(read("cockpit/js/tune.js"));
if (TUNE_NOW.err) fail("tune-map", `cockpit/js/tune.js would not read for the --run map (${TUNE_NOW.err}) -- gate 19 cannot hold TUNE_MODULES to it`);
else for (const p of gateTuneMapProblems(TUNE_MODULES, TUNE_NOW.tune, HARNESS_MODS_READ)) fail("tune-map", p);
// who reads each block: computed from every game file but tune.js (gateTuneReaders), so no row can go stale
const tuneKeysOf = p => { let v = TUNE_NOW.tune; for (const k of p.split(".")) v = gateIsBlock(v) ? v[k] : undefined; return gateIsBlock(v) ? new Set(Object.keys(v)) : undefined; };
// (computed only when asked -- a tune.js change, or --tune-readers: reading every game file this way is ~0.13 s)
let TUNE_READ_MEMO = null;
const tuneRead = () => TUNE_READ_MEMO || (TUNE_READ_MEMO = gateTuneReaders(Object.fromEntries(jsFiles.filter(f => f !== "tune.js").map(f => [f, read("cockpit/js/" + f)])),
  TUNE_NOW.err ? undefined : tuneKeysOf, new Set(Object.keys(TUNE_EXPORT_ONLY))));
for (const f of Object.keys(TUNE_EXPORT_ONLY)) if (!jsFiles.includes(f)) fail("tune-map", `gate.js TUNE_EXPORT_ONLY names ${f}, which is not in cockpit/js/ -- take it out`);
const tuneReadersOf = key => gateTuneRowReaders(key, TUNE_MODULES, tuneRead().reads);
if (flag("tune-readers")) {
  // the computed table, for a person to spot-check: alias -> path -> where declared; then row -> readers
  const where = new Map();
  for (const [n, ps] of tuneRead().aliases.global) where.set(n, [...ps].join(" | "));
  console.log("global aliases (name -> TUNE path; where the name appears is raw text -- the rows below apply the shadowing rule):");
  for (const n of [...where.keys()].sort()) {
    const users = Object.keys(tuneRead().reads).filter(f => new RegExp(`(?<![\\w$.])${n.replace(/\$/g, "\\$")}(?![\\w$])`).test(gateStripComments(read("cockpit/js/" + f))));
    console.log(`  ${n} -> TUNE.${where.get(n)}   name appears in: ${users.join(", ")}`);
  }
  console.log("rows (TUNE_MODULES key -> files that read it):");
  for (const k of Object.keys(TUNE_MODULES)) if (k !== "*") console.log(`  ${k}${TUNE_MODULES[k].full ? " (full)" : ""}: ${tuneReadersOf(k).join(", ")}`);
  process.exit(0);
}
for (const f of Object.keys(PARTIAL)) if (!MODULES[f]) fail("tune-map", `gate.js PARTIAL names ${f}, which has no MODULES row -- a file with no row is already "only the full harness"; take it out`);

// ---------- 20. the LEAVE table holds together (B4, v222) ----------
// state.js's LEAVE (the rows), LEAVE_AT (which place runs which rows, in which step) and the grid in its
// WORKING RULES header are three writings of one table. A name in LEAVE_AT that is not a row throws only when
// that place runs; a row no place runs is dead; a grid that disagrees misleads the next step of B4. By reading
// the file: every LEAVE_AT name is a key of LEAVE, every key is run somewhere, no place runs a row twice, and
// the grid has exactly the rows of LEAVE, each column naming the step that place runs it in, or "-".
{
  const src = read("cockpit/js/state.js");
  try {
    const leaveBody = (/^const LEAVE = \{([^]*?)^\};/m.exec(src) || [, ""])[1];
    const rows = [...leaveBody.matchAll(/^  ([A-Za-z_$][\w$]*):/gm)].map(m => m[1]);
    const atSrc = (/^const LEAVE_AT = \{[^]*?^\};/m.exec(src) || [""])[0];
    if (!rows.length || !atSrc) throw new Error("no `const LEAVE = {` or `const LEAVE_AT = {` (each closed by a `};` line) found");
    const ctx = {}; vm.createContext(ctx);
    vm.runInContext(atSrc + ";this.LEAVE_AT = LEAVE_AT;", ctx);
    const AT = ctx.LEAVE_AT, places = Object.keys(AT), stepOf = {}, used = new Set();
    for (const p of places) {
      stepOf[p] = {};
      for (const [step, names] of Object.entries(AT[p])) for (const n of names) {
        if (!rows.includes(n)) fail("leave-table", `state.js LEAVE_AT.${p}.${step} names "${n}", which is not a row of LEAVE -- it throws when that place runs`);
        if (stepOf[p][n]) fail("leave-table", `state.js LEAVE_AT.${p} runs "${n}" twice (${stepOf[p][n]} and ${step})`);
        stepOf[p][n] = stepOf[p][n] || step; used.add(n);
      }
    }
    for (const r of rows) if (!used.has(r)) fail("leave-table", `state.js LEAVE row "${r}" is run by no place in LEAVE_AT -- a dead row; run it somewhere or take it out`);
    // the grid: the "row  <place> <place> ...  what goes" line, then one comment line per row, to the first blank one
    const lines = src.split("\n"), h = lines.findIndex(l => /^\/\/\s+row\s+\S+\s+\S+\s+\S+\s+what goes\s*$/.test(l));
    if (h < 0) throw new Error("no grid header (`//   row  vehicle  start  picker  what goes`) in the WORKING RULES comment");
    const cols = lines[h].replace(/^\/\/\s+/, "").split(/\s+/).slice(1, -2);
    if (cols.join() !== places.join()) fail("leave-table", `the grid's columns (${cols.join(", ")}) are not LEAVE_AT's places in its order (${places.join(", ")})`);
    const grid = {};
    for (let i = h + 1; i < lines.length && !/^\/\/\s*$/.test(lines[i]); i++) {
      const t = lines[i].replace(/^\/\/\s+/, "").split(/\s+/);
      if (grid[t[0]]) fail("leave-table", `the grid has row "${t[0]}" twice`);
      grid[t[0]] = t.slice(1, 1 + cols.length);
    }
    for (const r of rows) if (!grid[r]) fail("leave-table", `LEAVE row "${r}" has no line in the grid in state.js's WORKING RULES header`);
    for (const r of Object.keys(grid)) {
      if (!rows.includes(r)) { fail("leave-table", `the grid has a line "${r}", which is not a row of LEAVE`); continue; }
      cols.forEach((p, k) => {
        const want = (AT[p] && stepOf[p][r]) || "-";
        if (grid[r][k] !== want) fail("leave-table", `the grid says row "${r}" is "${grid[r][k]}" at ${p}; LEAVE_AT says "${want}"`);
      });
    }
  } catch (e) { fail("leave-table", "state.js's LEAVE table would not read for gate 20: " + e.message); }
}

// ---------- which modules the change answers to ----------
const mods = new Set(), fullFiles = [], partNotes = [], TUNE_NOISY = new Set(["city", "car", "highway", "lights"]);
let tuneNoisy = false;
for (const f of changedList) {
  const m = /^cockpit\/js\/(.+\.js)$/.exec(f);
  if (m && m[1] === "tune.js") {
    // by TUNE block (A3): the base's tune.js is read only here, when it changed
    const ch = gateTuneChanges(git("show", `${base}:${f}`), fs.existsSync(path.join(ROOT, f)) ? read(f) : null, TUNE_SPLIT);
    const sel = gateTuneSelect(ch, TUNE_MODULES, tuneReadersOf, x => MODULES[x], x => PARTIAL[x]);
    sel.mods.forEach(x => mods.add(x));
    // the city's and the motorway's numbers ARE how the drive feels: the noisy finger is due as for their files
    if (ch.paths.some(p => TUNE_NOISY.has(p.top))) tuneNoisy = true;
    partNotes.push(...sel.notes);
    if (!sel.mods.length && !sel.notes.length) partNotes.push("tune.js changed in its comments or layout only: no TUNE value moved, nothing to run for it");
  } else if (m) {
    if (MODULES[m[1]]) MODULES[m[1]].forEach(x => mods.add(x)); else fullFiles.push(m[1]);
    if (PARTIAL[m[1]]) partNotes.push(`${m[1]}: the modules above are partial (${PARTIAL[m[1]]}) -- only the full harness is complete for it`);
  }
  const s = /^scripts\/([a-z_]+_checks?)\.js$/.exec(f);
  if (s) mods.add(s[1]);
  // a helper the modules require (audit_eject.js, race_drive.js, art_rig.js ...): one level, the modules that require it
  const h = /^scripts\/([\w.-]+)\.js$/.exec(f);
  if (h) for (const n of HARNESS_MODS) if (n !== h[1] && new RegExp(`require\\(\\s*["']\\./${h[1].replace(/[.-]/g, "\\$&")}(\\.js)?["']`).test(modSrc(n))) mods.add(n);
  if (f === "cockpit/index.html" || f === "cockpit/sw.js") mods.add("hardening_checks");
}
// only what the harness runs as a module: a hand-run tool that matches _check.js (polish_check ...) is not one
const modList = [...mods].filter(n => HARNESS_MODS_READ ? HARNESS_MODS.has(n) : fs.existsSync(path.join(ROOT, "scripts", n + ".js"))).sort();
const noisy = tuneNoisy || changedList.some(f => CITY_FILES.has(path.basename(f)) && /^cockpit\/js\//.test(f));

// --modules: the bare list on stdout (one module a line, as before), and on stderr what the list does NOT cover --
// files no module owns, partial maps, TUNE blocks that are the full harness's -- so it never reads as covered
if (flag("modules")) {
  console.log(modList.join("\n"));
  const left = (fullFiles.length ? [`shared code changed (no module owns it: ${fullFiles.join(", ")}): only the full harness says anything about it`] : []).concat(partNotes);
  if (left.length) process.stderr.write(left.map(n => "note: " + n).join("\n") + "\n");
  process.exit(0);
}

// ---------- report ----------
const out = [];
for (const f of fails) out.push(`FAIL ${f.rule}: ${f.detail}`);
for (const w of warns) out.push(`WARN ${w.rule}: ${w.detail}`);
const next = [];
if (modList.length) next.push(`modules this change answers to: ${modList.map(n => `node scripts/run_module.js ${n}`).join(" ; ")}`);
if (noisy) next.push("city or car code changed: node scripts/noisy_drive.js 300 <seed> on more than one seed, and report the log");
if (fullFiles.length) next.push(`shared code changed (no module owns it: ${fullFiles.join(", ")}): only the full harness says anything about it`);
for (const n of partNotes) next.push(n);

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
