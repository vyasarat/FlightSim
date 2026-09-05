# Little Pilot — working rules

A no-reading, no-failing flying game for a 4-year-old. Read `README.md` for what the
game is; this file is the short list of rules that every change must respect and
the checklist for shipping one.

## Design rules (never break these)

- **Zero text** in the UI: icons, silhouettes and numbers only. The harness audits
  every DOM text node. `<title>` and `alt=""` are fine; nothing else may render text.
- **Nothing living gets shot, hit or destroyed**: targets, traffic, things that explode or
  shatter are vehicles, machines and objects only (birds became paper-plane squadrons for
  that reason). Living things are fine where nothing can happen to them -- an astronaut
  floating in the station, on a spacewalk, in the rover.
- **Nothing is ever taken away**: no score, no timers, no unlocks, no failure state.
  Every crash explodes and reassembles for free; every reward re-arms.
- **Pointing, not timing**: every control is "aim at it", never "press at the right
  instant". Assists (approach alignment, flare, rocket landing assist) exist so that
  *coasting in* works.
- **Drag up = nose up**, never inverted. Keyboard mirrors this (arrow-up = nose up).
- **Flight feel is tuned with the kid** (`TUNE` flight-feel block): don't retune it.
  Landing-assist strengths (`align*`, `touchdown*`, flare, rocket assist) may be
  weakened gradually as he improves.

## Where things live

- `cockpit/js/*.js` — classic scripts sharing one global scope, loaded in the order
  listed in `cockpit/index.html`. Load order matters: a top-level `const`/`let`
  used *at load time* must be declared in an earlier file (TDZ). Using it later,
  inside a function, is fine.
- `cockpit/js/tune.js` — every gameplay number (`TUNE`, `TUNE.rocketTune`, `rocketTune.starship`).
  The Mars block is `TUNE.marsBase` (the base itself plus `.jumps`, `.boulders`, `.drone`).
- `heli.js` — the helicopter's own flight model (`TUNE.heli`); it owns both the ground and the
  air for that vehicle, so the plane path in `flight.js` never runs for it. **Point-to-go, one finger**:
  he touches a place and it flies there and hovers over it; there is no stick and no throttle
  button, and nothing about that vehicle may ever need two simultaneous touches. The touch point
  reaches it as `state.touchNX/NY` (NDC); the plane and rocket ignore those entirely.
- `rocket.js` (Falcon / Starship spine), `recovery.js` (droneship, net boat, recovery ride),
  `rover.js` (surface buggy) and `events.js` (the per-launch space event) load after `flight.js`
  and before `main.js`; they call into each other only inside functions, so order among them is
  safe as long as they all precede `main.js`.
- Space events are drawn once per pad spawn and armed only by a real liftoff. An event may
  never be required, block anything, or take anything away; keep every number in `TUNE.events`.
- Buttons share a few fixed slots (`--stack-bottom` and the top-left corner). Two visible at once
  and the one later in the DOM silently eats the tap -- the harness checks this across every
  state. Decide a slot button's visibility *before* `updateRocket`'s rover / astronaut early
  returns, or whatever was up when he climbed out stays up over the button he needs.
- Set-pieces (`setpieces.js`) all run one loop: giant obvious thing -> one aim or one pulsing
  control -> visible wind-up -> huge payoff -> free reset. **No unannounced bangs**: every
  explosion or collapse gets a build first (beacons, rumble, the shared `#bigNum` countdown --
  numerals only, and only while a wind-up runs). One hero effect each, structures and machines
  only, and at most one new contextual button per feature.
- `marsbase.js` — the Mars base (`TUNE.marsBase`). Built around wherever he lands, so the lit
  pad is the rocket's own spot and driving back onto it is the way home; no new control.
  Mars only — the Moon stays as it was. It also owns the things to do out there: dune jumps
  (`.jumps`), the boulder field (`.boulders`) and the little drone (`.drone`). The jump *launch*
  runs in `updateMarsToys` (before `updateRover`, so it sets the hop the rover's own gravity
  then flies); the *tumble* runs in `marsLate` off `updateSetpiecesLate`, because `updateRover`
  rewrites the mesh orientation every frame. The drone reuses the helicopter's point-to-go
  wholesale — but on a sphere, so distances that decide "arrived" must be measured along the
  ground, never through the air, or its own hover height keeps it permanently "far away".
- The rocket's landing envelope (`landMax*`, `landPadR`/`landDeckR`/`landCatchR`) says what counts
  as a landing; everything else crashes, and a crash must stay free. Assist strengths are separate
  knobs (`assist*`) -- the assist may stand him up, never rescue a last-second dive.
- There is no weather/sky button; the sky moods stay in code (`state.sky`) for the harness.
- `scripts/headless_test.js` — the harness. `scripts/visual_baseline.json` — generated;
  never edit by hand (`UPDATE_VISUAL=1` regenerates it after an intentional look change).
- `deploy/` — the droplet deploy script and the nginx reference config.

## Adding a file under `cockpit/js/`

1. Add a `<script src="js/….js">` tag in `cockpit/index.html` in the right order.
2. Add `"./js/….js"` to `ASSETS` in `cockpit/sw.js`.
3. Bump `CACHE_NAME` in `cockpit/sw.js`.

## Ship checklist

1. Work on `cockpit-3d`. Keep `main` deployable.
2. Bump `CACHE_NAME` in `cockpit/sw.js` (and `sw.js` for the root build) whenever
   anything under `cockpit/` (or the root build) changes — `deploy.sh` refuses to
   deploy otherwise, measured against the rev currently published.
3. Run the harness and get it green (all checks; it prints the count):
   ```
   CHROME_HEADLESS_SHELL=/path/to/chrome-headless-shell \
   NODE_PATH=/path/to/node_modules \
   node scripts/headless_test.js
   ```
   It serves the repo on :8177 and refuses to start if that port is busy. Don't edit
   `cockpit/` while it runs — pages loaded later in the run would see mixed code.
4. For anything visual, render it and *look* at it (the harness hashes only eight scenes).
5. `git push origin cockpit-3d && git checkout main && git merge --no-ff cockpit-3d && git push`
6. `ssh root@138.197.80.104 'cd /root/flightsim && bash deploy/deploy.sh'`
   Rollback: `bash deploy/deploy.sh --rollback` (swaps to the previously published rev).
7. The iPad picks the new version up on its next launch from the runway menu.

## Testing habits

- Prefer behavioural checks over existence checks: the first audit found a train that
  had never rendered, a glide arrow with the wrong sign and "shelved" vehicles that
  were tappable, all under a green harness that only checked that things existed.
- Long sections reuse one page; state carries between checks. Reset what you touch,
  or give a check its own page (`newPage`) when it lands or respawns.
- The harness stubs `requestAnimationFrame` and only fires the *last* queued
  callback per pump — game code must not queue its own rAF callbacks for timing
  (use `setTimeout` or `frameCount`).
