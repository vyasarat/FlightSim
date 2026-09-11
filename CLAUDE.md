# Little Pilot — working rules

A no-reading, no-failing flying game for a 4-year-old. `README.md` says what it is;
`CHANGELOG.md` says what shipped. This is the rules, the map and the ship checklist.
Per-feature detail lives in a **WORKING RULES** comment atop the file it concerns —
read that file before changing it.

## Design rules (never break these)

- **Zero text** in the UI — icons, silhouettes and numerals only, harness-audited;
  numerals are for the wind-up counter, not for state.
- **Nothing living gets shot, hit or destroyed.** Anything that explodes or shatters
  is a machine — that is why the target flocks are paper planes. Living things are
  fine where nothing can happen to them (the astronaut; the birds, gulls and whale,
  which carry `noSolid`/`noShatter`). Make one hittable and it becomes a machine.
- **Nothing is ever taken away**: no score, timers, unlocks or failure. A crash
  explodes and reassembles free, *where it happened*; every reward re-arms.
- **Pointing, not timing**: every control is "aim at it". Assists exist so *coasting
  in* works.
- **Drag up = nose up**, never inverted. On surface vehicles it is that vehicle's
  burst — except the yacht, where it is the horn.
- **The picker always opens on the vehicles**, never the rocket's destination screen
  (the way back sits underneath it). A relaunch restores vehicle, direction and
  destination; the menu button reaches the picker from anywhere.
- **Flight feel is tuned with the kid**: don't retune it; assists may weaken slowly.
- **Readability beats realism.** Nothing darker or muddier; if an effect hides
  something he needs to see, it goes — that has overruled a brief three times.

## The vehicle contract

`vehicles.js` says, for whatever he is in: how it updates, where its cameras sit,
whether it is **parked**, and where it comes back from a bang. `vehKind()` resolves
the MODE, not the picker card (the rocket is also rover, astronaut and drone), in
the one safe order — modes first, `bigBoat` before `boat`. **Add a vehicle by
adding a row.**

Ask the vehicle, not the flight model: `vehParked()` is the honest form of the
`phase === "TAXI" && speed === 0` guess. `state.js`'s header says what each shared
field means per vehicle (`state.y` is a waterline for a boat, meaningless for the
rover); `state_semantics_checks.js` enforces what it can.

`scripts/vehicle_baseline.json` pins 60 numbers across 10 vehicles (spawn, ground
height, controls, both cameras, buttons, crash-return); regenerate **only** for a
deliberate, stated behaviour change.

## Architecture (these bite)

- Classic scripts in **one global scope**, `index.html` order. A top-level
  `const`/`let` used *at load time* must come from an earlier file (inside a function
  is fine), and a later `function foo` **silently replaces** an earlier one. Prefix
  anything new; the harness checks for duplicate top-level names.
- **Every button is declared once in `buttons.js`** — its slot and its `when()` —
  and one pass a frame computes all of them from scratch, so nothing another vehicle
  did survives and no vehicle puts away buttons it never heard of. Two in one slot
  means the later in the DOM eats the tap: `btnSlotClashes()` says so from the table.
- Set-pieces run one loop: giant obvious thing → one aim or pulsing control →
  visible wind-up → huge payoff → free reset. **No unannounced bangs** — every
  explosion gets a build. One hero effect each, machines only, one new button.
- Space events are drawn once per pad spawn, armed by a real liftoff. **Sea events
  obey the same three rules** — never required, never blocking, never takes anything
  away — and rivals are rubber-banded, so there is no winner to be.
- **Water is `terrainEff(x,z) < seaLevelAt(x,z)`, and nothing else.** One
  definition that takes a position: `seaLevelAt` (`terrain.js`) returns
  `TUNE.waterLevel` except over the lock, where `lockLevelAt` is the only override.
  Anything that floats asks it. **Do not add a third answer** — generalise this one.
- The harbour is shaped in `terrain.js`, **in order**: dredge the basin, lay the
  spit, cut the mouth back through it. Then the lock: raise the rim, cut its two
  floors to *different* depths (dock above the global sea, chamber below, since it
  holds both). Move a `TUNE.harbor`/`TUNE.lock` number and ground and structures
  move together.
- **A contextual button needs a RADIUS**, not just "parked and still" — true of a
  boat in the lock, which is how the car wash offered itself two kilometres away.
- **A boat can never be stuck.** A beached hull widens its water search *and* times
  out — the search alone deadlocks against a quay. In the lock, idling re-opens it.
- **The harbour is the third place he can lose a session in**; its event pool grows
  the way the space pool did. The fishing boat is rejected — don't bring it back.
- **The speed steps are one control he learns once** (`speed.js`): same pair, same
  top-right slot, every vehicle but the rocket — the helicopter has four slots a side
  and three spent, so it gets a single stepper. `TUNE.<vehicle>.speedSteps` scales
  the speed the model AIMS for and its cap, never the `speed / cruise` ratios that
  drive sound, wake and FOV.
- **Wake stays out of the shot, and SIZE is what does it** — a puff grows to 2.2x,
  so 2.9 is a six-metre ball before a camera 22 m astern. Test whether its sphere
  crosses the sightline, not how high it climbs.
- The rocket's envelope (`landMax*`, `land*R`) says what counts as a landing;
  everything else crashes, free. Assists may stand him up, never rescue a dive.
- **No post-processing stack, ever.** Glows are additive billboards on one shared
  texture; on an iPad a full-screen bloom costs more than all of them. No weather
  button either — the sky moods stay in code (`state.sky`).

## The map

| file | what it owns |
|---|---|
| `nozoom.js` | loads **first**; stops iOS Safari zooming |
| `tune.js` | every gameplay number |
| `terrain.js` `scene.js` `sky.js` | world and sea, lighting and shadows, sun/haze/stars, `mergeBoxes` |
| `flight.js` `heli.js` | the plane model **and the frame loop** / the helicopter, ground *and* air |
| `vehicles.js` `buttons.js` `speed.js` | the vehicle contract / every button's slot and `when()` / speed steps |
| `rocket.js` `recovery.js` `rover.js` `events.js` | rocket spine, droneship, buggy, per-launch event |
| `setpieces.js` `marsbase.js` | demolition, tower-catch, fire rig, carrier / Mars and its toys |
| `toyworld.js` `workshop.js` `toyfinish.js` | airport magnet yards, ramp, toy/fleet finish |
| `highway.js` `car.js` | the coast-to-coast road and its traffic / the SUV and lane-keep |
| `harbor.js` `lock.js` | the Californian port / the lock and its impounded dock |
| `boat.js` `yacht.js` `seaevents.js` | the speedboat and cannon / the yacht / eight things at sea |
| `eject.js` `ambient.js` `audio.js` `vehicle.js` `main.js` | rescue / birds / the mix / models and camera feel / rAF loop and `window.__lp` |

`TUNE.palette` is the canonical ~21 colours; everything snaps to one unless it is an
airliner livery or signal lamp. Flat shading is defaulted once atop `scene.js`.
`mergeBoxes` merges static boxes per material — three.js batches nothing itself.

**Adding a file under `cockpit/js/`**: script tag in `index.html` (right order),
`"./js/….js"` in `ASSETS` in `sw.js`, bump `CACHE_NAME`.

## Testing habits

- **Behaviour over existence, and deltas not totals** — a check reading
  `flags.boatCrashes` outright stayed green for two releases while the boat sailed
  through the container ship, on a 1 an earlier check had left behind.
- One page is reused and state carries: reset what you touch, or take a `newPage` —
  sparingly, the server is single-threaded and a third live page timed a run out.
- It stubs rAF (only the *last* queued callback fires) and runs 12 sim-seconds in a
  sixth of a real one, so **game code must never time off `performance.now()`** — use
  a `dt` countdown. That bug hid two vehicles' crashes entirely.
- **Never A/B perf in blocks** — alternate samples, and report more than one run:
  a median can read +5% and reverse on the next.
- Evidence is **never committed** — gitignored `evidence/`.

- `scripts/polish_check.js <tag>` times the heaviest scenes under **SwiftShader, not
  an iPad**: it over-prices fill rate and under-prices draw calls, so read
  `calls`/`tris` as the hardware proxy and `cpuMs` only as a bound.

## Ship checklist

1. Work on `cockpit-3d`, keep `main` deployable, **fetch first** — the published
   version may be ahead of you.
2. Bump `CACHE_NAME` in `cockpit/sw.js` **and** root `sw.js` for any `cockpit/`
   change — `deploy.sh` refuses otherwise. Match `/v\d+/`, don't guess the number,
   and check afterwards: a `sed` for a version that isn't there is a silent no-op.
3. Harness green: `CHROME_HEADLESS_SHELL=… NODE_PATH=… node scripts/headless_test.js`
   (~15 min, prints the count; :8177, refuses if busy). **Don't edit `cockpit/` while
   it runs.** Node buffers piped stdout — redirect to a file and poll. `UPDATE_VISUAL`
   / `UPDATE_VEHICLE` regenerate baselines; never hand-edit them.
4. For anything visual, render it and **look at it** — the eight hashed scenes cover
   no boat, no HUD and no harbour.
5. Push `cockpit-3d`, merge `--no-ff` into `main`, push.
6. `ssh root@138.197.80.104 'cd /root/flightsim && bash deploy/deploy.sh'`
   (rollback: `deploy.sh --rollback`). Add a `CHANGELOG.md` paragraph. The iPad
   picks it up on its next launch.
