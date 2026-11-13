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

- [ ] **v214 (S2) Back where he was** -- finish its loop and ship it. CARS-1 (a pull-over follows a relaunch), CARS-2 (the globe from the toy track), CARS-3 (a car's eject goes back to the motorway start), FLIGHT-1 (eject after London's heading switch faces the wrong way), FLIGHT-2 (eject during the landing roll). Built 2026-11-02 (da8823a); pushed 2026-11-13.

## 1. The audit, v215

- [ ] **v215 (S2) London, the race, the menu, offline** -- LONDON-2 (a heli parked on Tower Bridge), LONDON-3 (a relaunch keeps London), RACE-1 (a race from the car wash), HUD-1 (a double tap on the menu opens dad's pad), HARNESS-1 (London's city offline).

## 2. iPad and deploy (REVIEW findings 11, 12; Q-11)

- [ ] **Deploy** -- gzip GLBs in nginx (`model/gltf-binary` in `gzip_types`); `rsync --delay-updates`; deploy.sh's cache-bump guard uses the gate's path list (**Q-11**: it omits models/, textures/, audio/, GLTFLoader.js -- deploy/deploy.sh:77 against gate.js:148). Check the LIVE nginx matches `deploy/nginx-flightsim.conf`.
- [ ] **Cache `btnControlRects` once per frame** (buttons.js:282-303; main.js:100-104, heli.js:182, race.js:2000). Refactor: same rectangles, same answers.

## 3. Harness, Track A steps 1-3

- [ ] **A1** A module that throws is a FAIL (`<module>: module threw`), not an abort (headless_test.js:198-206, :6177). A case in the shard self-test.
- [ ] **A2** Gate additions: every shipped non-JS asset is in `ASSETS`; every `*_checks.js` is wired into the harness; a typo in the `--run` map fails; the three.js revision is pinned.
- [ ] **A3** `gate.js --run` maps `tune.js` (by TUNE block, as race_sweep.js:30-37 does), `flight.js`, `rocket.js`, `hud.js`.

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
