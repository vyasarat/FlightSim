# Review — 2026-11-12 (main 50d1bbb, v213)

What a senior engineer seeing this codebase fresh would change. Read-only: nothing in
`cockpit/` or `scripts/` was touched, no harness or browser was run. This is not the bug
audit (AUDIT.md) and repeats none of its items; the few real bugs found on the way are in
section 7 and in QUEUE.md below the audit items.

**How it was made.** Eight parallel auditors, one per area, each required to cite file:line
for code it read. I then re-read the code behind the top 15 findings myself (section 8 says
which, and what I corrected). Anything not re-read is marked *(auditor)*; anything nobody
could measure without a device or a browser is marked **UNVERIFIED**. No timing on an iPad
was taken by anyone: every performance item is a reading of code, not a measurement.

---

## 1. Summary for the parent

The code is in better shape than its size suggests. The vehicle contract, the button table,
the solids registry, the event pools, the gate and the seeded-stream discipline are real
structure and should be left alone. What is missing is the same kind of structure for three
things: **leaving** whatever he is in, the **frame** itself, and **sound**. And the loop's
fifth judge — the boy — has almost stopped voting.

The five things most worth doing:

1. **Watch him play and write one line down — before building more.**
   PLAYTEST.md has three entries of what he actually did; 27 releases (v187–v213) have
   shipped since the last one. Of 65 predictions, none is scored a hit and 59 are still
   open. Meanwhile the queue's next releases fix eight harbour and lock bugs, and nothing
   on record says he has ever taken a boat out. *What you would notice:* the work goes to
   what he plays (the toy track is "the biggest hit" and has had one release since) rather
   than to what the tooling finds. Cost: a minute after a session.

2. **Give "leaving" one owner, and the frame one tail.**
   When he opens the picker, ejects, relaunches or crashes, three hand-kept lists decide
   what is reset (`state.js:126`, `state.js:189`, `input.js:480`), and the frame loop has
   five hand-assembled variants that each skip different steps. Every time something new
   is added, one list or one variant forgets it. *What he notices:* a sound that drones
   on under the picker, a countdown numeral that follows him, a button that stays up
   during a bang. That is the family behind roughly 17 of the audit's 43 findings, and
   v213's own fix broke another set-piece's count the same day. The audit is fixing these
   one at a time; this stops the next ones.

3. **Pin the race balance, so it cannot drift without anyone knowing.**
   "About 50% wins" is produced by twelve hand-tuned constants written to 3–4 decimals,
   where a 0.3–0.9% change in rival pace moves the win rate about 25 points. It is
   measured by hand, 20–40 races per car (too few to tell 40% from 65%), and no check
   asserts it. A change to a car's width, a track's ground or a frame step can shift it
   silently. *What he notices:* a release after which he always loses, or always wins.
   Also worth one look over his shoulder: every recorded win rate assumes a hand that
   drags up half the time; if he never drags up in a race, he is well behind.

4. **Make the harness cheaper to trust.**
   A quarter of its checks live inline in one 6,195-line file and can only run in the full
   40-minute run; the "run only what changed" map does not cover `tune.js` or `flight.js`,
   which nearly every commit touches; a check module that throws aborts the whole run with
   no count; and the picture baseline has not moved since v123 — London arrived without
   it noticing. *What you notice:* fewer "the full harness's find" surprises forty minutes
   in, and a faster turn per release.

5. **Three cheap things for the iPad itself.**
   (a) In flight the HUD re-measures all 42 buttons, with style lookups on every child,
   at least twice a frame, to keep two markers off them. (b) Every release makes the iPad
   re-download about 10 MB, and the 3D models are sent uncompressed although they shrink
   by more than half. (c) The deploy copies files in place, so an iPad updating during a
   deploy can cache half of each build. *What he notices:* possibly smoother flying
   (unmeasured — measure first), faster updates, and no once-in-a-while broken build.

One process point that is yours alone to decide: CLAUDE.md says "never stop while QUEUE.md
has items unless a stop rule applies", and no stop rule is written anywhere. In practice
40% of the release merges for v160–v213 landed between midnight and 7 am under blanket
approvals written in QUEUE.md. That may be exactly what you want; it should be written
down as what you want.

---

## 2. Findings, ranked by payoff against risk

Size: S = under a day, M = a few releases, L = a track of its own. ✔ = I re-read the code.

| # | Finding | Evidence | Payoff | Risk | Size |
|---|---|---|---|---|---|
| 1 | **The playtest loop is not running.** 3 entries, 27 releases since the last, 0 of 65 predictions scored a hit, "what works" still empty. 68% of queue items originate from agents (reviewer, harness, audit), 25% from the child. | ✔ `PLAYTEST.md:10-14`, `:100-110`; counts *(auditor)* | high | low | S |
| 2 | **No single "leave whatever he is in".** Three partial reset lists plus per-mode exits; `heliReset` is on all three, `raceReset` on two, `trackReset` on one, `policeStop` on none. 31 `*Reset/*Leave/*StandDown` functions. | ✔ `state.js:126-176`, `state.js:189-259`, `input.js:480-507` | high | med | M |
| 3 | **The frame has five hand-assembled variants.** `update()` is 418 lines with early returns for eject, bang and the picker hold; each runs a different subset of the tail, and each past fix pasted one more call into one branch. The bang branch never calls `btnUpdateAll`. | ✔ `flight.js:377`, `:405-460`, `:466-486`, `:779` | high | med | M |
| 4 | **A continuous tone has no owner and no guaranteed stop.** `setTone` is a keyed dictionary that keeps its last gain; 29 files call it; every stop is hand-written in the file that started it. | ✔ `audio.js:298-316`; 29 files by grep | high | low→med | S check, M registry |
| 5 | **The race balance is open-loop and asserted nowhere.** | ✔ `scripts/race_sweep.js:13-14`; constants `tune.js:2484-2716` *(auditor)* | high | low | M |
| 6 | **`rcAt()` returns one shared mutable object.** Has bitten at least three times; two live bugs in section 7. | ✔ `race.js:255-271`, `:1575-1586`, `:1000` | high | low | S |
| 7 | **The inline harness blocks can become modules.** 234 `check(` sites inline in 51 `T-…` sections; 50 of 51 already open their own page. They cannot run alone or be mapped by `gate.js --run`. | ✔ count; isolation *(auditor)* | high | low | M |
| 8 | **`gate.js --run` does not map the files that change most.** `tune.js`, `flight.js`, `rocket.js`, `hud.js` have no module; 160 of the last 200 game commits touch `tune.js`. | ✔ `gate.js:56-84`; commit counts *(auditor)* | high | low | S |
| 9 | **A module that throws costs the whole run.** `runModule` is try/finally with no catch → "HARNESS ERROR", exit 2, no count. CLAUDE.md already says a throw is a bug; the harness should say which. | ✔ `headless_test.js:198-206`, `:6177` | high (the day it happens) | low | S |
| 10 | **"One loop" for set-pieces is a convention.** The shared code is ~25 lines plus a registry five pieces join; each piece hand-writes busy/aim/count/reset. Demolition never asks `spCountBusy`. One numeral, 12 `countdownTo` and 34 `countdownClear` call sites. | ✔ `setpieces.js:20-60`, `:174`; greps | high | low→med | M |
| 11 | **HUD overlap tests re-measure layout several times a frame.** `btnRectBlocked` → `btnControlRects` → `getComputedStyle` on every button and descendant; the home arrow repeats it per 8 px step; the helicopter up to 8 times. Cost in ms **UNVERIFIED**. | ✔ `buttons.js:248-316`, `main.js:100-104`, `heli.js:182` | med–high | low | S |
| 12 | **Deploy and update weight.** Models not gzipped (`gzip_types` has no GLB type; 6.3 MB of GLB); `deploy.sh`'s cache-bump guard omits `models/ textures/ audio/ GLTFLoader.js`, which the gate covers; rsync in place is not atomic. Whether the live server matches the reference config is **UNVERIFIED**. | ✔ `deploy/nginx-flightsim.conf:53`, `deploy/deploy.sh:77`, `gate.js:148` | med | low | S |
| 13 | **The "one steering rule" is four implementations that have drifted.** City/motorway accept a full steer that starts anywhere in the approach; the toy track fork and race shortcut need it held from the approach's first frame; the race's spent-turn release has no relatch allowance. Which is the rule is the parent's call. | ✔ `car.js:888-911`, `track.js:905-911`, `race.js:1517-1521`, `:1703-1720` | high | med | M |
| 14 | **Mars's events are outside the event pool and its three-rule audit.** `evpRegister` has three callers (space, sea, police). v209 cost 9 files/+699, v210 9 files/+937, most of it inline harness and one-off render scripts. | ✔ `events.js:53`, `seaevents.js:60`, `police.js:43`, `marsbase.js:1733-1740` | med–high | low | S+M |
| 15 | **The visual baseline pins almost nothing.** 8 scenes of 96×54 luma thumbnails, last regenerated at v123; 90 releases, London included, never moved it. | ✔ `git log -- scripts/visual_baseline.json`; threshold maths *(auditor)* | med | low | S–M |
| 16 | **CLAUDE.md is over its own budget** (314 lines, 4,246 words; the gate warns above 300 and has for weeks). ~12 rules restate what a gate or module already enforces. Its numbers have drifted ("60 numbers across 10 vehicles" is 162 across 11 *(auditor)*); the file map omits 24 of 74 files *(auditor)*. No stale identifiers were found. | ✔ size, `gate.js:172` | med–high | med | M |
| 17 | **QUEUE.md is stale by construction.** v213 is unticked on `main` though merged; the tick lives in v214 (`da8823a`), which sits on local `cockpit-3d`, unpushed (origin is at `a9ba3cd`). The file is 5,238 words, longer than CLAUDE.md, mostly ticked history. | ✔ `QUEUE.md:17`, `git log cockpit-3d` | med | low | S |
| 18 | **Modes are hand-rolled flags.** The toy track and car wash are not contract rows; `raceBtnShows`, `ldGlobeShows` and `updateEjectControl` each list a different subset of the other modes. `menuOpen()` appears 61 times. | ✔ count; lists *(auditor)* `race.js:2628`, `london.js:1584`, `eject.js:29` | high | low–med | S–M |
| 19 | **The phase is still asked first.** ~80–120 `state.phase` comparisons (81 lines by my grep, 118 sites by the auditor's) against 16 calls to `vehParked/vehSolid/vehIsCar`. | ✔ grep | med–high | low | M |
| 20 | **Three ways to boot a harness page** (`headless_test.js`, `run_module.js`, `art_rig.js`), differing in flags and timeouts — the documented cause of "4 s alone, 904 s in the harness". | *(auditor)* | high | low–med | M |
| 21 | **Three representations of a road**, and a city ramp held twice (as a street "exit" and a motorway exit). Polyline projection is typed 9 times. | *(auditor)* `highway.js:904`, `streets.js:1484-1490`, `track.js:1210` | high | low (first steps) | M |
| 22 | **Every noise one-shot fills a fresh buffer from `Math.random`.** The rocket-landing celebration is ~345,600 draws and 1.4 MB in one frame (arithmetic). Fixing it moves the page stream once in audio-running checks — a deliberate, stated change. | ✔ `audio.js:92-113`; arithmetic *(auditor)* | med–high | med | M |
| 23 | **`streets.js` (2,849 lines), `race.js` (2,650), `marsbase.js` (1,743), `dadmode.js` (2,244) split cleanly** as pure moves, under one ordering rule each. In `streets.js` only two top-level statements have side effects. | ✔ `streets.js:1971`, `:2723`; seams *(auditor)* | med | low | M each |
| 24 | **Rival bodies depend on GLB arrival** and the grey stand-in is cached for the session; the win-rate tool does not wait for models. | *(auditor)* `race.js:1226-1252`, `race_drive.js:165` | med | low | S |
| 25 | **No audio buses.** 16 direct `connect(masterGain)` sites; ducking is two multipliers; tones and one-shots are never ducked. | *(auditor)* | med | low | S–M |
| 26 | **Six parallel road-traffic simulators**; two fleets (signal cross traffic, harbour road) are still plain boxes. Do not merge the simulators; share the two rules and the look. | *(auditor)* | med | low | S–M |
| 27 | **Most set-pieces tick wherever he is.** The barge walks a 4,200-entry spark pool every frame. Cost **UNVERIFIED**. | ✔ `setpieces.js:1042-1055`; pool *(auditor)* | med | low | S each |
| 28 | **Adding things costs many files.** A car: 25–27 files. A dad mission: 11–14. A button: six edits in four files, 28 separate `.hidden` CSS rules. Picker count `16` is hard-coded in three check files. | *(auditor)* commits 835ee7d, b316bee, ad410b4 | med | low | S each |
| 29 | **The "own random stream" wrapper exists six times.** | *(auditor)* `vehiclekit.js:54`, `landmarks.js:565`, `race.js:366`, `london.js:45`, `dadmode.js:352`, `city.js:293` | low–med | low | S |
| 30 | **README.md is ~100 versions stale** (last touched 2026-09-12; says 19 scripts, 7 vehicles, "no failure state"). | *(auditor)* | med | low | S |
| 31 | **The solo phase is ~9 of 44 minutes** guarding SwiftShader millisecond bounds CLAUDE.md itself calls "only a bound". Needs the parent's call. | *(auditor)*, from QUEUE.md:102 | med–high | med | M |
| 32 | **Load-time random stream is not deterministic** (38618 vs 38620 draws on one build; `stream_compare` tolerates it, the harness does not). The link to the 11 recorded "passes alone, fails in the full run" incidents is a hypothesis. | ✔ `stream_compare.js:11-13`; link **UNVERIFIED** | high if true | med | M |

---

## 3. Refactor plan, in order

Each step is one release-sized change. "Proof" is what must be identical before and after.
The standing proof for every step: **gate green, `stream_compare` SAME, vehicle baseline
unchanged, visual hashes unchanged, harness count equal to the count before** (1321 today)
with the same check names. Steps name only what they need beyond that.

**Track A — the harness first, because everything else leans on it**

1. `runModule` catches a throw and records `<module>: module threw` as a FAIL.
   Proof: count unchanged on a green run; add one case to the shard self-test.
2. Gate additions (file-only, a second): every shipped non-JS asset is in `ASSETS`; every
   `*_checks.js` is wired into the harness; a typo in the `--run` map fails; pin the
   three.js revision. Proof: gate passes on `main`; each rule fails on a seeded mistake.
3. Map `tune.js` by TUNE block in `gate.js --run` (as `race_sweep.js:30-37` already does
   for the race), and map `flight.js`/`rocket.js`/`hud.js`. Proof: for the last 20
   commits, the mapped set includes the module that actually failed in v212 and v213.
4. Move inline `T-…` sections into modules, one per commit, still called in place.
   Proof: sorted PASS/FAIL name list byte-identical under `HARNESS_SHARDS=1`. Start with
   T-SP8/T-SP9 (Mars) so step C3 has a `mars_checks.js` to lean on.
5. One shared page rig, adopted one consumer at a time (`run_module.js` first).
   Proof: each module's result alone equals its result in the full run.

**Track B — leaving, the frame, and sound (the bug class)**

1. Write the check first: a **mode × exit matrix** (every mode he can be in × picker,
   eject, relaunch, bang, race start, globe) asserting no tone above zero, no numeral, no
   stray button and no hidden model afterwards — modelled on `solidity_checks.js`.
   It will fail on today's open audit items; record those cells as known, fix nothing yet.
2. Extract the three audio tails in `update()` into one `audioFrame(dt)` with no behaviour
   change. Proof: standard, plus `engine_sound_checks`. Then call it from the picker-hold
   branch too — a *deliberate* change that fixes bug Q-3 below; the matrix cell turns green.
3. Extract `frameWorld` / `framePicture` / `frameControls` from the normal tail, verbatim;
   then restate each early-return variant as a named subset. First pass: no behaviour
   change. Second pass (separate release): add `btnUpdateAll` to the bang variant (bug Q-6).
4. Move the three reset lists into one ordered `LEAVE` table, verbatim and in today's
   order (the order matters: `eventsSpawn` draws from the seeded stream). Proof: standard.
   Then, one row per release, make each exit call the table instead of its own list.
5. Tone ownership: `setTone` stamps the frame; opted-in tones not written this frame are
   swept to zero at the end of `update()`. Opt in one tone per release.
6. Numeral ownership: `countdownTo(left, from, owner)`; only the owner may clear. Then a
   `spCountStep` helper, one set-piece per release, the barge first. Proof: `crane_checks`
   (its frame-for-frame demolition is the canary), plus each piece's own module.

**Track C — the race**

1. `rcAt(s, out)` with caller-owned scratch at `race.js:1000`, `:1575`, `:1623`. This is
   *not* a pure refactor: it fixes bugs Q-1 and Q-2 and will move London's balance, so it
   goes after step 2.
2. A paired-seed race pin in `race_sweep.js`: N seeded races per car per track, results
   stored; a refactor must flip zero results; a wide hard band on the win rate; add
   `terrain.js`, `london.js`, `streets.js` and `TUNE.track.ds` to the sweep's hash.
3. Wait for rival GLBs before the grid (as the yacht already does at `models.js:558`).
4. Split `race.js` at its nine seams as pure moves, every builder loaded before the
   `rcBuild()` call. Proof: standard plus `race_sweep` and the step-2 pin, zero flips.

**Track D — driving**

1. A shared `carStickBank()` for the four verbatim copies (`car.js:869`, `monster.js:367`,
   `race.js:1418`, `track.js:704`). Proof: standard plus `feel_compare.js` and noisy-drive
   logs on three seeds, identical.
2. `hwyAddExit()` constructor for the three ad-hoc exit literals; a small polyline kit.
   Neither creates three.js objects, so the stream cannot move.
3. Split `streets.js` by cut-and-paste: the traffic file (with `stDummy`, which draws a
   uuid) must load in the same relative order, and `stBuild()` must be the last statement
   of the last file.
4. *Only after the parent decides which approach semantics is the rule:* one hold state
   machine shared by city, exit, fork and shortcut. This changes feel at forks or
   shortcuts by design; it is a behaviour release, not a refactor.

**Track E — space and sea**

1. Register a "mars" standing pool so the cargo ship, drone, sleepy rover and stars go
   through `eventpool.js` and its checks. Proof: `event_pool_checks` gains rows; Mars
   behaviour identical (T-SP blocks).
2. Split `marsbase.js` into base / drone / pal / stars as pure moves.
3. Read-only rocket accessors (`rocketMode()`, `rocketOnSurface()`); migrate readers a few
   at a time. `rk.onBody` is read in 16 files outside `rocket.js` *(auditor)*.

**Do last, or not at all:** a `vehMode()` resolver and a phase-reader ratchet in the gate
(finding 18–19) — valuable, but only once Track B has made exits uniform.

---

## 4. Improvements that are not refactors

**Performance (measure first — nothing here was timed on the iPad)**
- Cache `btnControlRects()` once per frame, then per button-state change (finding 11).
- A per-owner draw-call breakdown in `frame_budget_checks`' measure mode, so a merge can
  be aimed. Recorded today: 574 calls / 361k tris on the runway, 814 / 770k beside the
  oval (`CHANGELOG.md:549-558`).
- `engUpdate` schedules 10–16 AudioParam automations a frame, changed or not; skip under
  an epsilon *(auditor)*.
- Early-out for set-pieces far from him (finding 27).
- **Do not upgrade three.js.** It is r128 (2021). Without a build step the ceiling is
  r147; Lambert goes per-fragment at r144, which the flat look relies on; uuid generation
  feeds the seeded stream; and there are shader patches at `art.js:269`,
  `vehiclekit.js:525`, `toyfinish.js:166` *(auditor)*. The cost is far above the gain.

**Loading and updates**
- Add `model/gltf-binary` to nginx `gzip_types`: 6.6 MB → 3.0 MB *(auditor's gzip test)*.
- `rsync --delay-updates`, and give `deploy.sh` the gate's path list.
- A boot profile on the real iPad before any deferral: 76 script tags build every venue
  at load and all 11 GLBs are fetched whatever he picked. Deferral is stream-sensitive.
- CLAUDE.md's ship step 2 says to bump the root `sw.js`; neither the gate nor deploy
  requires it for a cockpit change *(auditor)*. Fix the sentence.

**The harness**
- Raise the visual baseline from 8 thumbnails to something that would have seen London:
  more scenes (a boat, the HUD, the harbour, each city), a tighter threshold.
- 65 of 97 `.every()` checks have no length guard and pass on an empty list *(auditor)*;
  three checks assert a literal `true`.
- `noisy_drive` paces five real minutes over a frame-keyed sim; prove equivalence unpaced
  and the harness gets minutes back.
- Reseed `Math.random` at the end of page boot, after assets arrive (finding 32), as its
  own harness-only release.
- The render-critic's prompt allows numerals only on a wind-up counter and does not know
  the altimeter exception *(auditor, not re-read)*.

**The playtest loop**
- One line per sitting, any channel: date, minutes, what he chose, what he said.
- One binary, falsifiable prediction per visible release; 13 of today's are of the form
  "nothing he notices". Have the gate check a prediction exists.
- `/cycle` asks for an entry when the newest is more than five releases old, and caps
  self-found polish releases between entries.
- Move the two real parent quotes from `QUEUE.md:26,30` into PLAYTEST.md so `/retro` can
  score them.
- Before v216–v217 (eight harbour and lock fixes): does he ever take a boat out?
- Write the stop rule. Suggested: items marked `[go]` may ship unattended; everything
  else stops at a pushed branch and a report.
- Trim QUEUE.md to open items; move ticked history to the CHANGELOG.

**Ideas for him — only from what is on record**
- *More toy track.* It is the one thing recorded as "the biggest hit"; it is data, built
  to be lengthened by adding sections.
- *Something to find on the Moon.* Mars has five discoveries; the Moon has none, and the
  drone on Mars was "super cool, we didn't even know it was there".
- *Hidden things that are loud when found.* The quiet sleepy rover was "kind of a boring
  feature"; the star shower with its fireworks was the correction.
- *Let him operate what he can only watch* — the fireworks barge and the freight train
  have no vehicle form.
- *No more race content until one sitting with v187+ is observed.* About 30 race releases
  followed "racing is just circling the track"; nothing records how the result plays.

---

## 5. Healthy — leave alone

- **The vehicle contract** (`vehicles.js`) and **the button table** (`buttons.js`): 42
  button ids in the HTML, 42 rows, exact parity; buttons are immune to the leave-state
  bug class *because* they are recomputed from scratch.
- **The solids registry** and its every-vehicle × every-kind matrix check.
- **`eventpool.js`**: small, policy-driven, machine-checked. Extend it, do not change it.
- **Global-scope discipline**: 2,428 top-level names, no duplicates, gate-enforced.
- **The seeded-stream discipline** and `stream_compare`; private streams for race, London,
  dad mode. Nothing in the driving or race per-frame paths allocates a `THREE` object.
- **`tune.js`**: 8 dead keys of about 5,050 *(auditor)*. It is long because it is complete.
- **Dad mode's isolation**: builds nothing at load (0 stream draws), ticks one comparison
  outside itself, registers no solids, never writes `TUNE`. Lazy-loading it is not worth it.
- **No sampled audio**: everything is synthesised; there is no asset weight to cut.
- **`boat.js` and `yacht.js` as separate files**: 19% shared lines. Do not merge.
- **`terrainEff`**: 0.4–0.7 µs a call *(auditor, node on a Mac)*. Not a cost.
- **The gate as Stop hook** (1.7 s), the "fails on main, passes after" proof standard,
  the noisy-finger drive, `deploy.sh`'s rollback, `vehicle_baseline.json`.
- **The machine judges earn their cost**: law-reviewer forced a change in at least 15 of
  47 recorded passes, render-critic in 13 of 41, and the one release shipped over a
  standing BLOCK (v164) needed three releases to fix exactly what was blocked *(auditor)*.
- **`index.html`**: no inline JS; long because of CSS and 96 SVG icons.

---

## 6. Things that are the parent's call, not engineering

- Which approach semantics is "the turn rule" at a toy-track fork and a race shortcut
  (finding 13).
- Whether the cross traffic at a motorway signal should be solid: today he drives through
  it when he runs a red (`lights.js:324`, `harbor.js:715` are `noSolid`) *(auditor)* —
  possibly by design, since a held finger must never bang.
- Whether the harness's millisecond bounds under SwiftShader are worth nine minutes a run.
- Unattended night merges under blanket approval.
- The game URL has no auth and no `noindex`; the deploy is `ssh root@<ip>` *(auditor)*.

---

## 7. Real bugs AUDIT.md lacks

All traced in code, none reproduced in a running game. Added to QUEUE.md below the audit
items, with the same ids.

| id | bug | evidence | confidence |
|---|---|---|---|
| Q-1 | **London's rivals pick the inside line from curvature up to ~130 m ahead.** `rcAI` keeps `q = rcAt(r.s)`; `rcSpeedTo` → `rcBendCap` overwrites the shared object; `q.kh` is read afterwards. London's `aiMul` was tuned with this in place — a fix needs a re-measure. | ✔ `race.js:1575`, `:1550`, `:1543`, `:1586` | high on code; effect unmeasured |
| Q-2 | **Snowy Peaks' tunnel skirt has a degenerate triangle per quad**: `g0` and `g1` are the same object. | ✔ `race.js:1000` | high on code; visibility unchecked |
| Q-3 | **Stall warble / dive whistle (and tyre, hull, roar tones) hold their last gain behind the picker.** v212's hold returns before `updateRewards` → `updateFlightTones`. | ✔ `flight.js:357-364`, `:466-486`, `:417`, `:740` | medium–high |
| Q-4 | **Big Ben's bong leaks 12 audio nodes a stroke**: its oscillators and gains never go through `sfxOneShot`, which exists because nodes are otherwise never released. | ✔ `london.js:883-896`, `audio.js:58-70` | medium |
| Q-5 | **In a race a spent turn is dropped by a short lift**: no relatch allowance, unlike the car. A shove into the shortcut wall, never a bang. | ✔ `race.js:1517-1521` vs `car.js:899-903` | medium |
| Q-6 | **Buttons are not recomputed during a plane, helicopter or rocket bang**; the speed step can still be nudged *(the nudge not re-read)*. | ✔ `flight.js:405-460` has no `btnUpdateAll` | medium |
| Q-7 | **A demolition count can start on top of a pointing set-piece's count**: `demoTrigger` never asks `spCountBusy`; both then drive the one numeral each frame. | ✔ `setpieces.js:174-180`, `:48`; reachability *(auditor)* | medium |
| Q-8 | **Wall-clock timers in game code** not on the audit's list: car-horn answers and the red-light flash. | ✔ `car.js:1319`, `:1337`, `lights.js:501`; `input.js:554` *(auditor)* | high, low impact |
| Q-9 | **The yacht has prevention but no way back if ever aground** — no stuck timer, unlike the speedboat. | ✔ no timer in `yacht.js`; `boat.js:245-262` *(auditor)* | low–medium |
| Q-10 | **Rivals stay grey sedans all session** if the first race starts before their GLBs land. | *(auditor)* `race.js:1226-1252` | medium |
| Q-11 | **`deploy.sh`'s cache-bump guard is narrower than the gate's**: an asset-only change deploys without a bump and the cache-first worker never refetches. | ✔ `deploy/deploy.sh:77` vs `gate.js:148` | high, unlikely to bite |
| Q-12 | **View/gear debounce is 18 frames, not seconds** — 0.6 s at 30 Hz (iOS Low Power Mode), dropping a deliberate second tap. | *(auditor)* `input.js:204-227` | device-dependent |
| Q-13 | **Rocket-start rivals are picked by roster index, not grid slot.** | *(auditor)* `race.js:1487` vs `:1329` | small |
| Q-14 | **The oval's last-lap shortcut boom stays open after a race.** Cosmetic. | *(auditor)* `race.js:629`, `:1885` | cosmetic |

Tooling-only (not queued as game bugs): `run_module.js:60` never passes `airport`, so
three "(airport)" variants cannot run alone; `race_drive.js:126` divides by 3 laps on
London's 2; the Stop hook fails open if the gate itself crashes (exit 1, only 2 blocks)
— all *(auditor)*.

---

## 8. What I verified myself, and what I corrected

Re-read in the code: findings 2, 3, 4, 5 (the sweep's own statement), 6, 8, 9, 10, 11, 12,
13, 14, 15 (regeneration history only), 16–17 (sizes, the stop rule, the stranded v214),
and 23 (the two side-effecting statements in `streets.js`); bugs Q-1 to Q-9 and Q-11.
three.js is r128 (`cockpit/three.min.js`, © 2010-2021).

Corrections to auditors' claims:
- "`updateYacht` has no water test" is too strong: it has a depth probe that turns her
  away (`yacht.js:296`). What is missing is a *recovery*, which is Q-9.
- `state.phase` comparisons: 118 by the auditor's regex, 81 lines by mine. Use "about 100".
- "No timing data exists": the harness does collect per-module times (`modTimes`,
  `headless_test.js:205`) and prints "where the time went"; it is just not kept in the repo.
- The cost-of-adding figures, commit classifications, win-rate arithmetic and every
  byte/millisecond estimate are the auditors', spot-checked for plausibility only.

Not verified by anyone: any frame time, boot time or memory figure on the iPad; whether
the live nginx matches `deploy/nginx-flightsim.conf`; whether he drags up in a race.
