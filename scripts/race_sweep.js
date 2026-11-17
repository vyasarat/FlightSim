"use strict";
// THE RACE SWEEP (v177): race_track_checks with every car on every track -- and (C1) THE RACE PIN.
//
// The full harness runs race_track_checks as a SAMPLE -- the lap alone (b), the noisy
// race (f) and the barrier lap (k) in one car per track, turning through the four
// cars. Here they run in all four, on every track, the way they ran in the harness
// before v177. The gate demands it: when a change touches a race or track file, or a car's (the
// files in RACE_FILES, or the TUNE_BLOCKS and TUNE_KEYS), it fails until this has passed on exactly that
// content, and the pass is recorded in evidence/race-sweep.json.
//
// (C1) THE PIN: whole seeded races, every car on every track, PIN.seeds seeds, two hands --
// race_drive.js's noisy finger with the other hand tapping the item button (the hand the win
// rates were always measured with), and its weak one (long lifts, late and soft steering) --
// each race's finishing place, his time and the whole order stored in scripts/race_pin.json and
// compared on every sweep. The seeds are PAIRED: the same seeds for every car, track and hand.
// Anything that moves -- a place, the order, a time to the hundredth -- is a FAIL naming the
// race and before -> after: a refactor flips zero. A behaviour change (C2) re-pins, on purpose:
//   UPDATE_RACE_PIN=1 node scripts/race_sweep.js      (never hand-edit race_pin.json)
// (Q-37 a) and a record run judges nothing: its receipt says `recorded` and the gate refuses it ("recorded, not yet
// reproduced") until a plain compare run -- the full sweep -- has raced the new pin again, 0 flipped and 0 drifted.
// (Q-37 c) Every run also races DET.n pinned races again on fresh pages in another order: they must finish exactly
// as they did (a race is a function of its seed and its hand, standing, not only measured once).
// and THE BAND, on the pinned noisy-hand races: on every track, and over all of them, he wins
// sometimes and loses sometimes (the parent's v164 exception: a real order, he can come last --
// and a four-year-old must also be able to win). BAND is a test bound, not a TUNE number.
// A race is a function of its seed and its hand: each runs from a fresh start (raceReset,
// spdReset, his car set again) on a page whose rivals' bodies have all landed (Q-10: a race
// started before their GLBs is raced by grey sedans of another size), and the same race in a
// fresh page, a used page, or after other races finishes to the hundredth the same (C1 measured).
//
//   node scripts/race_sweep.js [root]   (needs CHROME_HEADLESS_SHELL and NODE_PATH, as the harness does)
//     root: a directory holding cockpit/ (a mutant copy); judged against THIS repo's pin, no receipt
//   RACE_PIN_ONLY=1   the pin and the band only, not race_track_checks (no receipt)
//   RACE_PIN_PAGES=4  pages raced side by side in the one browser (each race is its own: same result)
//
// The win-rate runs (160 races a track, race_drive.js) are not here: they are run by hand for
// a new track, and the CHANGELOG says what they gave. The pin is the standing measure.
const fs = require("fs"), path = require("path"), crypto = require("crypto"), { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const PIN_REL = "scripts/race_pin.json";
// the race itself, and what drives each car in it -- its bodies and widths, its speed steps, the
// contract that says what he is in (law-reviewer, v177: a car change reached the sweep's checks
// b and k in every car, and only the sample would have seen it); (C1) the ground the venues are
// laid on and London's street circuit stands in (terrain.js, london.js, streets.js), and the pin
const RACE_FILES = ["cockpit/js/race.js", "cockpit/js/raceitems.js", "cockpit/js/raceevents.js", "cockpit/js/track.js", "cockpit/js/car.js", "cockpit/js/vehicles.js",
  "cockpit/js/vehicle.js", "cockpit/js/speed.js", "cockpit/js/corvette.js", "cockpit/js/monster.js", "cockpit/js/solids.js",
  "cockpit/js/terrain.js", "cockpit/js/london.js", "cockpit/js/streets.js",
  "scripts/race_track_checks.js", "scripts/race_drive.js", "scripts/race_sweep.js", PIN_REL];

// and the TUNE blocks behind them: the race, each car's tuning, the solids' radii and crawls (the
// barrier lap runs on them), and the models (each body's size)
const TUNE_BLOCKS = ["race", "car", "corvette", "monster", "solid", "models"];
// (C1) and single keys of other blocks: the track's sample spacing, which race.js samples every track at (TK.ds)
const TUNE_KEYS = [["track", "ds"]];

// one TUNE block, as text: from `  <key>: {` to the next key at its depth
function tuneBlock(src, key) {
  const lines = (src || "").split("\n"), a = lines.findIndex(l => l.startsWith(`  ${key}: {`));
  if (a < 0) return "";
  let b = a + 1;
  while (b < lines.length && !/^  [A-Za-z_$][\w$]*: /.test(lines[b]) && !/^\};?\s*$/.test(lines[b])) b++;
  return lines.slice(a, b).join("\n");
}
// one key of a block, as text: its line at the block's first depth (`    <key>: ...`)
function tuneKey(src, block, key) {
  const m = new RegExp(`^    ${key}:.*$`, "m").exec(tuneBlock(src, block));
  return m ? m[0] : "";
}

// what the sweep is a receipt for: those files and those TUNE blocks and keys, as they are on disk
function raceHash(read) {
  const h = crypto.createHash("sha256");
  for (const f of RACE_FILES) h.update(f + "\0" + (read(f) || "") + "\0");
  const tune = read("cockpit/js/tune.js");
  for (const k of TUNE_BLOCKS) h.update(`TUNE.${k}\0` + tuneBlock(tune, k) + "\0");
  for (const [b, k] of TUNE_KEYS) h.update(`TUNE.${b}.${k}\0` + tuneKey(tune, b, k) + "\0");
  return h.digest("hex").slice(0, 16);
}

// ---------- the pin ----------
const PIN = { cars: ["car", "cybertruck", "corvette", "monster"], hands: ["noisy", "weak"], seeds: [5101, 5102, 5103, 5104, 5105, 5106] };
// THE BAND (C1, measured first: see QUEUE C1 and the CHANGELOG): over the noisy hand's pinned races, his
// win rate on each track, and over every track, must lie inside it -- he wins sometimes, he loses
// sometimes. Wide on purpose: it catches a field he can never beat (or never lose to), not a few races.
// A track outside it TODAY is a KNOWN entry here, by name, with its own bound and why -- never a silent bend.
const BAND = { track: [0.15, 0.85], car: [0.15, 0.85], all: [0.3, 0.8] };
const BAND_KNOWN = {};
const raceKey = (track, veh, hand, seed) => `${track}/${veh}/${hand}/${seed}`;
// (Q-37 c) the determinism sample: DET.n of the pinned races, one a track (the first DET.n tracks), the cars, hands
// and seeds turned through, `k` its place in the pin's own job order (the sample runs in the reverse of it)
const DET = { n: 6, pages: 2 };
function detSample(tracks) {
  const per = PIN.cars.length * PIN.hands.length * PIN.seeds.length, list = [];
  for (let i = 0; i < Math.min(DET.n, tracks.length); i++) {
    const c = i % PIN.cars.length, h = i % PIN.hands.length, d = (i * 5 + 2) % PIN.seeds.length;
    list.push({ track: tracks[i], veh: PIN.cars[c], hand: PIN.hands[h], seed: PIN.seeds[d], k: i * per + (c * PIN.hands.length + h) * PIN.seeds.length + d });
  }
  return list;
}

// the pinned races, raced on `pages` pages of one browser on `root`
async function racePin(root, pages, log) {
  const { launch, openGame, serve } = require("./art_rig.js");
  const { oneRace } = require("./race_drive.js");
  const port = +(process.env.PORT || 8233), srv = serve(root, port), browser = await launch();
  const checks = [];
  try {
    const open = async () => {
      const errors = [], page = await openGame(browser, port, { width: 820, height: 1180, errors });
      await page.waitForFunction(() => window.__lp && window.__lp.race && window.__lp.race.built, null, { timeout: 120000 });
      // (Q-10) every body still on its way lands (or fails) before the first grid: a race on sedans is another race
      await page.waitForFunction(() => Object.values(modelState).every(s => s !== "loading"), null, { timeout: 120000 });
      const m = await page.evaluate(() => ({ state: Object.assign({}, modelState), tracks: window.__lp.RC.tracks.map(t => t.id), roster: window.__lp.RC.roster }));
      return { page, errors, m };
    };
    const ps = [];
    for (let i = 0; i < pages; i++) ps.push(await open());
    const tracks = ps[0].m.tracks, want = ps[0].m.roster.filter(k => k in ps[0].m.state);
    const bodies = ps.map(p => want.filter(k => p.m.state[k] !== "ready"));
    checks.push([`race pin: every rival's body landed before the first grid on all ${pages} pages (${want.join(", ")} ready)`, bodies.every(b => !b.length), JSON.stringify(bodies)]);
    const jobs = [];
    for (const track of tracks) for (const veh of PIN.cars) for (const hand of PIN.hands) for (const seed of PIN.seeds) jobs.push({ track, veh, hand, seed });
    const out = {};
    await Promise.all(ps.map(async (p, j) => {
      for (let k = j; k < jobs.length; k += pages) {
        const { track, veh, hand, seed } = jobs[k];
        // a fresh start for every race: nothing carried from the one before (the podium, his step, his car)
        await p.page.evaluate(() => { const L = window.__lp; L.raceReset(); L.spdReset(); });
        const r = await oneRace(p.page, veh, seed, { track, taps: true, hand: hand === "weak" ? "weak" : undefined });
        out[raceKey(track, veh, hand, seed)] = r;
        log(`${raceKey(track, veh, hand, seed)} place ${r.place} time ${r.time} bangs ${r.bangs} stuck ${r.stuck}`);
      }
    }));
    // (Q-37 c) DETERMINISM, standing: a few of those races again, on FRESH pages (none of the pin's), in the
    // reverse of the order the pin ran them, each first or after another sample race instead of after its
    // page's run -- every one must finish exactly as it did (place, time, the whole order)
    const td = Date.now(), sample = detSample(tracks).sort((a, b) => b.k - a.k), dp = [];
    for (let i = 0; i < DET.pages; i++) dp.push(await open());
    const again = {};
    await Promise.all(dp.map(async (p, j) => {
      for (let k = j; k < sample.length; k += dp.length) {
        const { track, veh, hand, seed } = sample[k];
        await p.page.evaluate(() => { const L = window.__lp; L.raceReset(); L.spdReset(); });
        again[raceKey(track, veh, hand, seed)] = await oneRace(p.page, veh, seed, { track, taps: true, hand: hand === "weak" ? "weak" : undefined });
      }
    }));
    const detMin = +((Date.now() - td) / 60000).toFixed(2);
    const moved = sample.map(j => raceKey(j.track, j.veh, j.hand, j.seed)).filter(k => JSON.stringify(pinOf(again[k])) !== JSON.stringify(pinOf(out[k])));
    checks.push([`race pin: determinism -- ${sample.length} pinned races (${sample.map(j => raceKey(j.track, j.veh, j.hand, j.seed)).join(", ")}) raced again on ${dp.length} fresh pages in another order finish exactly as they did (${detMin} min)`,
      moved.length === 0, JSON.stringify(moved.map(k => [k, pinOf(out[k]), pinOf(again[k])]))]);
    const errs = ps.concat(dp).flatMap(p => p.errors);
    checks.push([`race pin: no page error in ${jobs.length + sample.length} races`, errs.length === 0, JSON.stringify(errs.slice(0, 5))]);
    return { tracks, out, checks, jobs, detMin };
  } finally { await browser.close(); srv.close(); }
}

// what a race is pinned by: his place, his time, the whole order with every time
const pinOf = r => ({ place: r.place, time: r.time, order: r.order });

function judgePin(pin, races) {
  const lines = [], keys = Object.keys(races);
  let flips = 0, drifts = 0;
  const was = (pin && pin.races) || {};
  for (const k of keys) {
    const a = was[k], b = pinOf(races[k]);
    if (!a) { lines.push([`race pin: ${k} is not in the pin (the grid of races changed: UPDATE_RACE_PIN=1)`, false]); flips++; continue; }
    if (a.place !== b.place) { flips++; lines.push([`race pin: ${k} FLIPPED -- his place ${a.place} -> ${b.place}, his time ${a.time} -> ${b.time} s; order ${a.order.join(" ")} -> ${b.order.join(" ")}`, false]); }
    else if (a.order.map(o => o.split(":")[0]).join() !== b.order.map(o => o.split(":")[0]).join()) { flips++; lines.push([`race pin: ${k} FLIPPED -- the rivals' order ${a.order.join(" ")} -> ${b.order.join(" ")} (his place ${a.place})`, false]); }
    else if (a.time !== b.time || a.order.join() !== b.order.join()) { drifts++; lines.push([`race pin: ${k} DRIFTED -- same order, times moved: his ${a.time} -> ${b.time} s; ${a.order.join(" ")} -> ${b.order.join(" ")}`, false]); }
  }
  for (const k of Object.keys(was)) if (!(k in races)) { flips++; lines.push([`race pin: ${k} is pinned and was not raced (the grid of races changed: UPDATE_RACE_PIN=1)`, false]); }
  lines.push([`race pin: ${keys.length} seeded races against ${PIN_REL} -- ${flips} flipped, ${drifts} drifted (a refactor flips and drifts zero)`, flips === 0 && drifts === 0]);
  return { lines, flips, drifts };
}

// his win and last-place rates, per track and car, per hand
function rates(races, tracks) {
  const R = {};
  for (const hand of PIN.hands) {
    R[hand] = {};
    for (const t of tracks.concat(["all"])) {
      const row = { n: 0, wins: 0, last: 0, cars: {} };
      for (const veh of PIN.cars) {
        const c = { n: 0, wins: 0, last: 0 };
        for (const seed of PIN.seeds) for (const tr of (t === "all" ? tracks : [t])) {
          const r = races[raceKey(tr, veh, hand, seed)]; if (!r) continue;
          c.n++; if (r.place === 1) c.wins++; if (r.place === r.field) c.last++;
        }
        row.cars[veh] = c; row.n += c.n; row.wins += c.wins; row.last += c.last;
      }
      row.win = +(row.wins / Math.max(1, row.n)).toFixed(2); row.lastRate = +(row.last / Math.max(1, row.n)).toFixed(2);
      R[hand][t] = row;
    }
  }
  return R;
}

function judgeBand(rt, tracks) {
  const lines = [], N = rt.noisy;
  const fmt = row => PIN.cars.map(v => `${v} ${row.cars[v].wins}/${row.cars[v].n}`).join(", ");
  for (const t of tracks.concat(["all"])) {
    const row = N[t], kn = BAND_KNOWN[t], [lo, hi] = kn ? kn.band : t === "all" ? BAND.all : BAND.track;
    lines.push([`race band ${t}: the noisy hand wins ${row.wins}/${row.n} (${row.win}; ${fmt(row)}) inside ${lo}-${hi}${row.win < lo ? " -- he can (almost) never win" : row.win > hi ? " -- he can (almost) never lose" : ""}; last ${row.last}/${row.n}; the weak hand wins ${rt.weak[t].wins}/${rt.weak[t].n}, last ${rt.weak[t].last}${kn ? ` (KNOWN: ${kn.why})` : ""}`,
      row.win >= lo && row.win <= hi]);
  }
  // and in every car, over every track (a car's six races a track are too few to judge alone: printed, not judged)
  for (const v of PIN.cars) { const c = N.all.cars[v], w = c.wins / Math.max(1, c.n), [lo, hi] = BAND.car;
    lines.push([`race band ${v}: the noisy hand wins ${c.wins}/${c.n} (${w.toFixed(2)}) over every track, inside ${lo}-${hi}`, w >= lo && w <= hi]); }
  // he can come last (v164) -- held by the WEAK hand only (Q-37 b): the noisy hand's last places are printed, not judged.
  // Whether the noisy hand should ever come last is the parent's question (Q-36), not this check's
  lines.push([`race band: the weak hand comes last somewhere -- ${rt.weak.all.last} of ${rt.weak.all.n} pinned weak-hand races (the noisy hand: last ${rt.noisy.all.last} of ${rt.noisy.all.n}, printed, not judged -- Q-36, the parent's question)`, rt.weak.all.last > 0]);
  return lines;
}

// (Q-37 a) what the gate makes of a receipt: null when it stands for `hash` (the content on disk), else why not. A RECORD
// run (UPDATE_RACE_PIN=1) never judged anything -- it wrote the pin it raced -- so its receipt says `recorded` and stands
// for nothing: only a compare run after it that reproduced that pin, 0 flipped and 0 drifted, is a pass
function receiptVerdict(r, hash) {
  if (!r || r.hash !== hash) return "stale";
  if (r.recorded || (r.pin && r.pin.recorded)) return "recorded";
  if (!r.ok) return "failed";
  if (!r.pin || r.pin.flips !== 0 || r.pin.drifts !== 0) return "unreproduced";
  return null;
}
module.exports = { RACE_FILES, TUNE_BLOCKS, TUNE_KEYS, tuneBlock, tuneKey, raceHash, PIN, BAND, BAND_KNOWN, DET, detSample, judgePin, rates, receiptVerdict };

if (require.main === module) {
  (async () => {
    const root = process.argv[2] ? path.resolve(process.argv[2]) : ROOT, isRepo = fs.realpathSync(root) === fs.realpathSync(ROOT);
    if (!fs.existsSync(path.join(root, "cockpit", "index.html"))) { console.error(`race_sweep: ${root} holds no cockpit/`); process.exit(1); }
    // (the game's files from the root raced; the scripts and the pin are always this repo's)
    const read = f => { try { return fs.readFileSync(f.startsWith("cockpit/") ? path.join(root, f) : path.join(ROOT, f), "utf8"); } catch (e) { return null; } };
    const readNoPin = f => f === PIN_REL ? "" : read(f);
    if (!process.env.CHROME_HEADLESS_SHELL) { console.error("race_sweep needs CHROME_HEADLESS_SHELL and NODE_PATH, as the harness does"); process.exit(1); }
    const update = !!process.env.UPDATE_RACE_PIN, pinOnly = !!process.env.RACE_PIN_ONLY, pages = Math.max(1, +(process.env.RACE_PIN_PAGES || 4));
    if (update && !isRepo) { console.error("race_sweep: UPDATE_RACE_PIN records the pin of this repo's cockpit/ only"); process.exit(1); }
    const hash0 = raceHash(readNoPin), t0 = Date.now();
    console.log(`race sweep: ${pinOnly ? "" : "race_track_checks, every car on every track; then "}the race pin (${root === ROOT ? "this repo" : root}; content ${raceHash(read)})`);
    const results = [];
    const check = (label, ok, detail) => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail !== undefined && !ok ? "  " + detail : ""}`); };

    // ---- the pin and the band
    const tp = Date.now(), logLines = [];
    const P = await racePin(root, pages, l => { logLines.push(l); if (process.env.RACE_PIN_LOG) console.log("  " + l); });
    for (const c of P.checks) check(...c);
    const races = P.out, keys = Object.keys(races).sort();
    const health = keys.filter(k => { const r = races[k]; return r.bangs || r.stuck || r.nan || !r.podium; });
    check(`race pin: every pinned race to the podium, no bang, never stuck, no NaN (${keys.length} races)`, health.length === 0, JSON.stringify(health.map(k => [k, races[k].bangs, races[k].stuck, races[k].nan, races[k].podium])));
    const pinPath = path.join(ROOT, PIN_REL);
    const rt = rates(races, P.tracks);
    let flips = 0, drifts = 0;
    if (update) {
      const sorted = {}; for (const k of keys) sorted[k] = pinOf(races[k]);
      const doc = { note: "THE RACE PIN (C1): written by UPDATE_RACE_PIN=1 node scripts/race_sweep.js -- never edit by hand. Key track/car/hand/seed; his place, his time, the whole order.",
        pin: PIN, races: sorted, rates: Object.fromEntries(PIN.hands.map(h => [h, Object.fromEntries(Object.entries(rt[h]).map(([t, r]) => [t, { win: r.win, wins: r.wins, last: r.last, n: r.n, cars: Object.fromEntries(Object.entries(r.cars).map(([v, c]) => [v, `${c.wins}/${c.n} won, ${c.last} last`])) }]))])) };
      fs.writeFileSync(pinPath, JSON.stringify(doc, null, 1) + "\n");
      console.log(`race pin: RECORDED ${keys.length} races in ${PIN_REL}`);
    } else {
      let pin = null; try { pin = JSON.parse(fs.readFileSync(pinPath, "utf8")); } catch (e) {}
      if (!pin) check(`race pin: ${PIN_REL} exists (record it: UPDATE_RACE_PIN=1 node scripts/race_sweep.js)`, false);
      else { const j = judgePin(pin, races); flips = j.flips; drifts = j.drifts; for (const l of j.lines) check(...l); }
    }
    for (const l of judgeBand(rt, P.tracks)) check(...l);
    for (const h of PIN.hands) console.log(`  rates ${h}: ` + P.tracks.concat(["all"]).map(t => `${t} ${rt[h][t].wins}/${rt[h][t].n} won, ${rt[h][t].last} last [${PIN.cars.map(v => rt[h][t].cars[v].wins).join("/")}]`).join("; "));
    const pinMin = +((Date.now() - tp) / 60000).toFixed(1);
    console.log(`race pin: ${keys.length} races on ${pages} pages, ${pinMin} min`);
    fs.mkdirSync(path.join(ROOT, "evidence"), { recursive: true });
    fs.writeFileSync(path.join(ROOT, "evidence", isRepo ? "race-pin-last.txt" : "race-pin-mutant.txt"), logLines.sort().join("\n") + "\n");

    // ---- the checks, every car on every track
    let mod = { pass: 0, fail: 0, status: 0 };
    if (!pinOnly) {
      const r = spawnSync(process.execPath, [path.join(__dirname, "run_module.js"), "race_track_checks", root],
        { cwd: ROOT, env: { ...process.env, RACE_FULL: "1" }, encoding: "utf8", maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "inherit"] });
      const out = r.stdout || "";
      process.stdout.write(out);
      mod = { pass: (out.match(/^PASS /gm) || []).length, fail: (out.match(/^FAIL /gm) || []).length, status: r.status };
    }
    const pass = mod.pass + results.filter(x => x).length, fail = mod.fail + results.filter(x => !x).length;
    const same = raceHash(readNoPin) === hash0;                     // (nothing edited while it ran)
    const ok = mod.status === 0 && fail === 0 && pass > 0 && same;
    const minutes = +((Date.now() - t0) / 60000).toFixed(1);
    // (Q-37 a) a RECORD run always writes its receipt, pin-only or not -- `recorded`, never ok: it judged nothing, and it
    // replaces whatever receipt stood before it. Only a full compare run of this repo writes an ok one.
    const writeReceipt = isRepo && (update || !pinOnly);
    if (writeReceipt) {
      const receipt = { hash: raceHash(read), ok: ok && !update, recorded: update, pass, fail, minutes, at: new Date().toISOString(),
        pin: { races: keys.length, flips, drifts, recorded: update, minutes: pinMin, detMin: P.detMin, win: Object.fromEntries(P.tracks.concat(["all"]).map(t => [t, rt.noisy[t].win])) } };
      fs.writeFileSync(path.join(ROOT, "evidence", "race-sweep.json"), JSON.stringify(receipt, null, 1));
    }
    console.log(`\nrace sweep: ${update ? "RECORDED (not a pass: a compare run must reproduce it)" : ok ? "PASSED" : "FAILED"} -- ${pass} passed, ${fail} failed, ${minutes} min${writeReceipt ? `; ${update ? "a recorded" : "the"} receipt in evidence/race-sweep.json` : " (no receipt: " + (pinOnly ? "the pin only" : "not this repo's cockpit/") + ")"}${same ? "" : "; the race's files changed while it ran"}`);
    process.exit(ok ? 0 : 1);
  })().catch(e => { console.error(e); process.exit(1); });
}
