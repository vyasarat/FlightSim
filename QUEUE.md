# Queue — what to build next, in order

Read this at the start of every session and after every release ships; start the top
open item. Only OPEN items live here: when one ships, tick it in the commit that merges
it, and move it to the CHANGELOG's "Queue history" on the next tidy. A bug found along the
way goes at the BOTTOM (section 10), unless it makes the game crash, get stuck or show
text, in which case it goes to the top.

The order below is the parent's (2026-11-13, his decisions on REVIEW.md). Version numbers
are given when a release starts, not here. The stop rule is in CLAUDE.md ("The loop").
A **refactor** release changes no behaviour unless its step says so, and shows the standing
proof: same harness count and check names, stream SAME, vehicle baseline and visual hashes
unchanged.

**NOT doing** (the parent, 2026-11-13): file splits (REVIEW finding 23), Tracks D and E,
unifying the turn rule (all four implementations stay as they are), any three.js upgrade.

## 0. Housekeeping

- [x] **v214 (S2) Back where he was** (shipped 2026-11-13: 1333/1333, stream SAME, sweep 79/0, noisy drive seeds 11 and 23 clean, law-reviewer PASS) -- CARS-1 (a pull-over follows a relaunch), CARS-2 (the globe from the toy track), CARS-3 (a car's eject goes back to the motorway start), FLIGHT-1 (eject after London's heading switch faces the wrong way), FLIGHT-2 (eject during the landing roll). Built 2026-11-02 (da8823a); pushed 2026-11-13.

## 1. The audit, v215

- [x] **v215 (S2) London, the race, the menu, offline** (shipped 2026-11-13: 1360/1360, stream SAME, sweep 79/0, law-reviewer PASS x3) -- LONDON-2, LONDON-3, RACE-1, HUD-1, HARNESS-1; and the v214 eject checks hardened (the eject seen to run, CARS-3 reads his heading, portrait and landscape).

## 2. iPad and deploy (REVIEW findings 11, 12; Q-11)

- [x] **Deploy** (shipped 2026-11-13) -- GLBs gzipped by nginx (live config checked against the repo's before and after), `rsync --delay-updates`, one path list for deploy.sh and the gate (`deploy/shipped-paths.txt`, **Q-11**).
- [x] **Cache `btnControlRects` once per frame** (v216, shipped 2026-11-13: 1362/1362 -- the 1360 names and two new, stream SAME, law-reviewer PASS): measured once a frame (11-12 before on the plane in portrait), thrown away on a new frame, a change to a button or its ancestors, and at the end of the task.

## 3. Harness, Track A steps 1-3

- [x] **A1** (shipped 2026-11-13: 1362/1362, no `module threw` on a green run; law-reviewer BLOCK then PASS) -- a module that throws is one FAIL, `<module>: module threw`, and the run goes on (`guardModule`, harness_shards.js; runModule and run_module.js both through it). The gate runs `harness_shards.js --selftest` and checks the wiring from the files (rule 12b).
- [x] **A2** (shipped 2026-11-13; gate-only, law-reviewer PASS x2) -- gate rules 14-18: every shipped file is in `ASSETS` (comments read out, `./` is not `index.html`); every `*_check(s).js` is run by the harness or named in `NOT_MODULES`; a typo in the `--run` map fails; three.js r128 and `GLTFLoader.js` pinned by hash; self-cases on the readers. `--run` follows a changed helper to the modules that require it.
- [x] **A3** (shipped 2026-11-13; gate-only, law-reviewer BLOCK then PASS) -- `gate.js --run` selects modules for `tune.js` by TUNE block (the readers of each block COMPUTED from cockpit/js, 45 aliases followed; `--tune-readers` prints them; rule 19: every block has a row), and for `flight.js`, `rocket.js`, `hud.js` (all three PARTIAL, said so). `TUNE.palette`, `TUNE.vehicles` and the loose numbers stay full-harness-only.

## 4. Track B: leaving and sound (one per release, in this order)

- [ ] **B1** The mode x exit matrix check FIRST: every mode he can be in x picker, eject, relaunch, bang, race start, globe -- afterwards no tone above zero, no numeral, no stray button, no hidden model. Modelled on solidity_checks.js. Cells that fail today are recorded as known, not fixed here.
- [ ] **B2** One `audioFrame(dt)` out of `update()`'s three audio tails (flight.js:377, :480-481, :766-775), no behaviour change; then call it from the picker hold -- fixes **Q-3** (stall warble, dive whistle and the tyre/hull/roar tones hold their last gain behind the picker).
- [ ] **B3** `frameWorld` / `framePicture` / `frameControls` extracted verbatim; each early-return variant restated as a named subset, no behaviour change. Then, separately: `btnUpdateAll` in the bang variant -- fixes **Q-6** (buttons not recomputed during a plane, heli or rocket bang; the speed step can still be nudged).
- [ ] **B4** One ordered `LEAVE` table from the three reset lists (state.js:126-176, :189-259, input.js:480-507), verbatim and in today's order (`eventsSpawn` draws from the stream); then each exit calls the table, one row per release.
- [ ] **B5** Tone ownership: `setTone` stamps the frame; an opted-in tone not written this frame is swept to zero at the end of `update()`. One tone per release.
- [ ] **B6** Numeral ownership: `countdownTo(left, from, owner)`, only the owner clears; then `spCountStep`, one set-piece per release, the barge first -- fixes **Q-7** (a demolition count can start on top of a pointing set-piece's count: `demoTrigger` never asks `spCountBusy`, setpieces.js:174). crane_checks' frame-for-frame demolition is the canary.

## 5. Track C steps 1-3: the race

- [ ] **C1** The paired-seed race pin FIRST, in race_sweep.js: seeded races per car per track, results stored; a refactor flips zero; a wide hard band on the win rate; terrain.js, london.js, streets.js and `TUNE.track.ds` in the sweep's hash.
- [ ] **C2** `rcAt(s, out)` with caller-owned scratch (race.js:1000, :1575, :1623) -- fixes **Q-1** (London's rivals read the inside line from curvature up to ~130 m ahead) and **Q-2** (Snowy Peaks' tunnel skirt: `g0` and `g1` are one object). A behaviour change: RE-MEASURE London's balance and re-pin.
- [ ] **C3** Wait for the rival models before the grid -- fixes **Q-10** (rivals stay grey sedans all session if the first race starts before their GLBs land, race.js:1226-1252).

## 6. For him (one release each, every kid rule applies)

- [ ] **Toy track: another loop.**
- [ ] **Toy track: a bigger jump.**
- [ ] **Toy track: a corkscrew.**
- [ ] **Toy track: a second fork.**
- [ ] **One loud hidden discovery on the Moon** -- found not shown, and LOUD when found (v209's quiet rover was "kind of a boring feature").

## 7. Small bug batch

- [ ] **Q-4** Big Ben's bong never releases its 12 audio nodes a stroke (london.js:883-896, no `sfxOneShot`).
- [ ] **Q-5** In a race a spent turn is dropped by a short lift: no relatch allowance (race.js:1517-1521 against car.js:899-903).
- [ ] **Q-8** Wall-clock `setTimeout` in game code: car.js:1319, car.js:1337, lights.js:501, input.js:554.
- [ ] **Q-12** The view/gear debounce is 18 frames, not seconds: 0.6 s at 30 Hz (input.js:204-227).
- [ ] **Q-13** Rocket-start rivals are picked by roster index, not grid slot (race.js:1487).
- [ ] **Q-14** The oval's last-lap shortcut boom stays open after a race (race.js:629, :1885). Cosmetic.

## 8. Harness, Track A steps 4-5, and the picture baseline

- [ ] **A4** Inline `T-...` sections of headless_test.js into modules, one per commit, still called in place. Proof: the sorted PASS/FAIL name list byte-identical under `HARNESS_SHARDS=1`.
- [ ] **A5** One shared page rig, adopted one consumer at a time (run_module.js first).
- [ ] **More scenes in the visual baseline**: London, a boat, the HUD, a race. A deliberate, stated regeneration.

## 9. LAST: the rest of the audit (he rarely uses the boats)

- [ ] **(audit, S2) The harbour** -- BOATS-1 (the drawbridge stays up), BOATS-2 (the lock never opens to the harbour again), BOATS-3 (the yacht's dead cannon button), BOATS-4 (garage and lock buttons in one slot).
- [ ] **(audit, S3) Water and the lock** -- BOATS-5 (the container in the hull), BOATS-6 (the lock's numeral follows him), BOATS-7 (the garage door), FLIGHT-6 (eject over the lock's water).
- [ ] **(audit, S3) Touch and the HUD** -- HUD-5 (horn over the picker), HUD-6 (double tap picks a direction), HUD-7 (engine roars through a crash), HUD-9 (rotate mid-drag), FLIGHT-7 (the route strip on the London crossing), FLIGHT-8 (the heli's resting palm).
- [ ] **(audit, S3) Leftovers and cost** -- RACE-2 (his car floating mid-race), RACE-4 (giant on the podium), DAD-2 (dad mode's GPU leak), DAD-3 (stall warble in dad mode), LONDON-5 (the frozen whale), LIFECYCLE-1 (every switch re-uploads the prototype), LIFECYCLE-2 (audio while hidden).
- [ ] **Q-9** The yacht has no way back if she is ever aground (no stuck timer; the speedboat's is boat.js:245-262).

## 10. Parked, and bugs found along the way

- [ ] (WAITING on a playtest report -- the fade-in is for if anyone notices it popping; nobody has) Snowy Peaks / Sky Glow Road skyline ghost pops at the cull depth (found in v179, accepted): past the fog's far edge a venue piece used to draw as a flat fog-coloured ghost on the skyline; it now appears at ~1.7 km view depth. If he or the parent notices a pop driving toward a venue, fade pieces in over the last 150 m instead of a hard cut -- readability only.
- [ ] (renders the critic would still like; not bugs, nothing failed) v187 power-ups: a slick at 20 m (chase and seat); a giant monster truck with a rival close by, a shield taking a hit, him driving over oil, a rival using boost, shield or giant -- `race_renders.js` item:/itemSeat:/hold: views. v181 spray: five rivals 15-25 m ahead of the seat camera; the staged near-puff row from the chase camera on sand, dirt and snow; his own spray from the chase camera, unstaged; a puff just past the bonnet hidden by it; Desert Dunes sand at dusk/night; a puff fading as it nears the camera -- `race_renders.js` bunch, closeSeat, puffAt, puffAtSeat, NIGHTF=.
- [ ] (v215, the law-reviewer, not blocking) Tower Bridge at the edge: a helicopter bobbing across the edge of "on the leaves" (15 m up, or 15 m/s) while a leaf is under `wallAt` flips rise/fall with no wait and restarts `ldTbHydraulics` each time (london.js `ldTbUpdate`); `rewarn` guards only down -> warn. A hold-off there, and a check that counts reversals.
- [ ] (v215, the law-reviewer, check gaps) audit_london_checks: the rising-leaf case never asserts he stands on the leaf (`onDeck`); the abandoned warning asserts no `tbOpens` delta of 0; only the rocket card is shown to still get the direction screen in London (yacht, monster truck); no check drives a car over the leaves and then lets the ship ask (the car now adds `deckOver.rewarn` to her wait). audit_harness_checks HARNESS-1 sees only whole-literal asset paths. `scripts/audit_eject.js` is not in gate.js's `--run` map.
- [ ] (v216, found by the builder) `updateHeliControls()` runs twice every frame (flight.js:389 before `btnUpdateAll`, and from `updateHud`, main.js:115): the ring is placed twice, the first time against last frame's buttons. A refactor: once, after the button pass.
- [ ] (v216, found by the builder) `btnHeldBleed` learns a button's resting glow whenever `pressed` is absent -- during the 0.08 s transition after a release it reads the pressed glow and can store too high a rest (buttons.js:273-280).
- [ ] (v216, found by the builder) slot_checks' "helicopter over the fire with a full bucket" scene sits at `FF.rig + 400`, which is not water: `bucketCanScoop()` is false and its `bucketPress` probably does nothing. Find water as the v216 section does.
- [ ] (v216, the law-reviewer, check gaps) the v216 rectangle probe drives one camera view only (never `viewBtn`/`camBtn`), not `rcFwSpot` (race.js:2000, the podium fireworks) nor dad mode's buttons; no check goes red with the `<head>` observer or the `frameCount` key removed (buttons.js:337, :343).
- [ ] (A1, the law-reviewer, for A5's rig) the real `runModule` has never been driven through a throw by a check (the self-test's loop is its own copy; gate 12b is a text match), nor the relaunch of a browser the throw took with it (headless_test.js:210-215). And `browser.process().kill("SIGKILL")` (headless_test.js:205, :213) may be a silent no-op: playwright-core's Browser may have no `process()` -- find out, since the solo phase relies on :205 (v177).
- [ ] (A2, the law-reviewer) the three live checks in gate 15's `NOT_MODULES` are dead, not hand-run: each demands an old cache name and throws on anything else (live_release_check.js:27 v85, eject_live_check.js:27 v86, helicopter_live_check.js:27 v87). Delete them or make them take the current name. And helicopter_polish_check.js:40 carries a check of its own ("ejection WxH returns", portrait too) that no harness module is known to cover -- see whether eject_framing_checks does.
- [ ] (A2, the law-reviewer, gate gaps) gate.js:118 counts a `runModule("./x")` inside `/* */` or under an `if`; `--modules` no longer lists a new, unlisted `*_checks.js` (plain gate and `--run` do fail on it); the helper-follow and rules 14/15's own loops have no case in rule 18.
- [ ] (A3, the law-reviewer, latent holes in gate.js's `gateTuneReaders`, none live today) a spread is not counted as a read (`...TUNE.car.speedSteps`, corvette.js, saved by the same line's other read); an alias made on a continuation line, by plain assignment or as a default parameter is neither alias nor read; a parameter default's identifiers shadow the global alias; a shadowing file's `X.key` is tested against the working tree's keys only (a renamed key drops the file that still reads the old one); a block handed on by a function (`vehSolidR()`) is invisible. A rule-18 case each. Also no case for `TUNE_NOISY` or for `--modules`' stderr notes.
- [ ] (A3, the builder) setpieces.js maps only to `audit_hud_checks` in gate.js's MODULES, though v213's real harness failure after a setpieces.js change was `crane_checks` (the demolition replay). And the selections are honest but big (`TUNE.car` 27 modules; a heli change over-selects london.js's 11 through a local `H.accel`).
