# Little Pilot — working rules

A no-reading, no-failing flying game for a 4-year-old. `README.md` says what it is;
`CHANGELOG.md` says what shipped. This is the rules, the map and the ship checklist.
Per-feature detail lives in a **WORKING RULES** comment atop the file it concerns.

## Design rules (never break these)

- **Zero text** in the UI — icons, silhouettes and numerals only, harness-audited; the
  numerals are for the wind-up counter, not for state.
- **Nothing living gets shot, hit or destroyed.** Anything that explodes or shatters is a
  machine — that is why the target flocks are paper planes, and why the police officer
  never leaves his car. Living things are fine where nothing can happen to them (the
  astronaut; the birds, gulls and whale, which carry `noSolid`/`noShatter`).
- **Nothing is ever taken away**: no score, timers, unlocks or failure. A crash explodes
  and reassembles free, *where it happened*; every reward re-arms.
- **Pointing, not timing**: every control is "aim at it"; assists exist so *coasting in*
  works. **Drag up = nose up**, never inverted; on a surface vehicle it is that vehicle's
  burst, except the yacht, where it is the horn.
- **The picker always opens on the vehicles**, never the rocket's destination screen (the
  way back sits underneath it). A relaunch restores vehicle, direction and destination.
- **Flight feel is tuned with the kid**: don't retune it; assists may weaken slowly.
- **Readability beats realism** — an effect that hides something he needs to see goes.

## The vehicle contract

`vehicles.js` says, for whatever he is in: how it updates, where its cameras sit, whether
it is **parked** or **solid**, and where it comes back from a bang. `vehKind()` resolves
the MODE, not the picker card (the rocket is also rover, astronaut and drone), in the one
safe order — modes first, `bigBoat` before `boat`. **Add a vehicle by adding a row.**

**Ask the vehicle, and ask the phase LAST.** Every surface vehicle writes
`phase = "TAXI"` each frame to mean "not flying", and reading that instead has now
cost three bugs: a car wash offering itself to a boat in the lock, a car whose solid
test never once ran, and a harbour that played apron rumble. `vehParked()` and
`vehSolid()` are the honest forms. `state.js`'s header says what each shared field
means per vehicle; `state_semantics_checks.js` enforces what it can.

`scripts/vehicle_baseline.json` pins 60 numbers across 10 vehicles (spawn, ground height,
controls, both cameras, buttons, crash-return); regenerate **only** for a deliberate,
stated behaviour change.

## Architecture (these bite)

- Classic scripts in **one global scope**, `index.html` order. A top-level `const`/`let`
  used *at load time* must come from an earlier file (inside a function is fine), and a
  later `function foo` **silently replaces** an earlier one. Prefix anything new.
- **Every button is declared once in `buttons.js`** — slot and `when()` — computed from
  scratch each frame, so nothing another vehicle did survives. Two in a slot means the
  later in the DOM eats the tap: `btnSlotClashes()` says so from the table,
  `btnObstructions()` catches a HUD arrow across one.
- Set-pieces run one loop: giant obvious thing → one aim or pulsing control → visible
  wind-up → huge payoff → free reset. **No unannounced bangs.** One hero effect and at
  most one new button each, machines only.
- **Events are pools with a policy** (`eventpool.js`): space draws one per launch and
  never twice running, the harbour keeps all eight standing on their own clocks. Three
  rules, machine-checked: never required, never blocking, never takes anything away. A
  pool says whether it holds events or paint — the police liveries borrow the draw only.
- **Signals are on the SURFACE roads, never the motorway** (`lights.js`): a crossroads
  per spur, cross traffic that queues, amber blinking before red, sited by measuring the
  ground. **Lane-keep never brakes for one** — stopping is the one choice out there that
  is his, and running one starts the chase (`police.js`): rubber-banded, ducked under
  everything, ending three ways he is never told about, and taking nothing. The officer
  never leaves his seat; only the CARS ever crash.
- **Water is `terrainEff(x,z) < seaLevelAt(x,z)`, and nothing else.** One definition that
  takes a position: `seaLevelAt` (`terrain.js`) returns `TUNE.waterLevel` except over the
  lock, where `lockLevelAt` is the only override. **Do not add a third answer.**
- The harbour is shaped in `terrain.js`, **in order**: dredge the basin, lay the spit,
  cut the mouth back through it. Then the lock: raise the rim, cut its two floors to
  *different* depths. Move a `TUNE.harbor`/`TUNE.lock` number and ground and structures
  move together.
- **The road owns a corridor, and in it everything is solid.** `TUNE.highway.clearHalf`
  keeps streamed scenery off the carriageway, spurs and ramps — each claims its own ground
  (`hwyClaimCorridor`) — and the railway is held to it too. `resolveSolidWalls` asks
  `vehSolid()`, **never a flight phase**.
- **A bore is a hole in the GROUND, not a pipe laid on it.** `hwyBoreCut` (from
  `terrainEff`) cuts the mountain to the road; `hwyBuildBore` lids the cut with what was
  removed. It stays silent until the surveyor has classified the route — cut first and
  nothing is ever low enough to be a tunnel. Twin bores: one tube wide enough for a
  divided road stands taller than the hill.
- **A contextual button needs a RADIUS**, not just "parked and still". **A boat can never
  be stuck**: a beached hull widens its water search *and* times out — the search alone
  deadlocks against a quay; in the lock, idling re-opens it. The harbour is the third
  place he can lose a session in, so its event pool grows as the space pool did.
- **The speed steps are one control he learns once** (`speed.js`): same pair, same
  top-right slot, every vehicle but the rocket — the helicopter has four slots a side and
  three spent, so it gets one cycling stepper. `TUNE.<vehicle>.speedSteps` scales what the
  model AIMS for and its cap, never the `speed / cruise` ratios behind sound and wake.
- **Wake stays out of the shot, and SIZE is what does it**: test whether its sphere
  crosses the sightline, not how high it climbs.
- The rocket's envelope (`landMax*`, `land*R`) says what counts as a landing; everything
  else crashes, free. Assists may stand him up, never rescue a dive. **Engines are two
  loops crossfaded** (`engines.js`) and sit UNDER the events — the rocket keeps its bass.
- **No post-processing stack, ever.** Glows are additive billboards on one shared
  texture; on an iPad a full-screen bloom costs more than all of them. No weather button
  either — the sky moods stay in code (`state.sky`).

## The map

| file | what it owns |
|---|---|
| `nozoom.js` | loads **first**; stops iOS Safari zooming |
| `tune.js` | every gameplay number |
| `terrain.js` `scene.js` `sky.js` | world and sea, lighting and shadows, sun/haze/stars, `mergeBoxes` |
| `flight.js` `heli.js` | the plane model **and the frame loop** / the helicopter, ground *and* air |
| `vehicles.js` `buttons.js` `speed.js` `eventpool.js` `engines.js` | the vehicle contract / every button's slot and `when()` / speed steps / event pools and policies / the two-loop engine voice |
| `rocket.js` `recovery.js` `rover.js` `events.js` | rocket spine, droneship, buggy, per-launch event |
| `setpieces.js` `marsbase.js` `toyworld.js` `workshop.js` `toyfinish.js` | demolition, tower-catch, fire rig, carrier, Mars and its toys / the airport magnet yards, ramp and toy-fleet finish |
| `highway.js` `car.js` `lights.js` `police.js` | the coast-to-coast road and its traffic / the SUV and lane-keep / the junctions / the chase |
| `harbor.js` `lock.js` `boat.js` `yacht.js` `seaevents.js` | the Californian port and its lock / the speedboat and cannon, the yacht, eight things at sea |
| `eject.js` `ambient.js` `audio.js` `vehicle.js` `main.js` | rescue / birds / the mix / models and camera feel / rAF loop and `window.__lp` |

`TUNE.palette` is the canonical ~21 colours; everything snaps to one unless it is an
airliner livery or signal lamp. Flat shading is defaulted once atop `scene.js`, and
`mergeBoxes` merges static boxes per material — three.js batches nothing itself.
**Adding a file under `cockpit/js/`**: script tag in `index.html` (right order),
`"./js/….js"` in `ASSETS` in `sw.js`, bump `CACHE_NAME`.

## Testing habits

- **Behaviour over existence, and deltas not totals** — a check reading
  `flags.boatCrashes` outright stayed green for two releases while the boat sailed through
  the container ship, on a 1 an earlier check left behind. And check the states he is
  really in: the slot check ran three viewports, all landscape.
- One page is reused and state carries: reset what you touch, or take a `newPage` —
  sparingly; the server is single-threaded and a third live page timed a run out.
- It stubs rAF (only the *last* queued callback fires) and runs 12 sim-seconds in a sixth
  of a real one, so **game code must never time off `performance.now()`**.
- **Never A/B perf in blocks** — alternate samples, and report more than one run.
- Evidence is **never committed** — gitignored `evidence/`.

- `scripts/polish_check.js <tag>` times the heaviest scenes under **SwiftShader, not an
  iPad**: read `calls`/`tris` as the hardware proxy, `cpuMs` only as a bound.

## Ship checklist

1. Work on `cockpit-3d`, keep `main` deployable, **fetch first**.
2. Bump `CACHE_NAME` in `cockpit/sw.js` **and** root `sw.js` for any `cockpit/` change —
   `deploy.sh` refuses otherwise. Check afterwards: a `sed` for a version that is not
   there is a silent no-op.
3. Harness green: `CHROME_HEADLESS_SHELL=… NODE_PATH=… node scripts/headless_test.js`
   (~15 min, prints the count; :8177, refuses if busy). **Don't edit `cockpit/` while it
   runs.** Node buffers piped stdout — redirect to a file and poll. `UPDATE_VISUAL` /
   `UPDATE_VEHICLE` regenerate the baselines; never hand-edit them.
4. For anything visual, render it and **look at it** — the hashed scenes cover no boat,
   no HUD and no harbour.
5. Push `cockpit-3d`, merge `--no-ff` into `main`, push.
6. `ssh root@138.197.80.104 'cd /root/flightsim && bash deploy/deploy.sh'` (rollback:
   `deploy.sh --rollback`). Add a `CHANGELOG.md` paragraph. The iPad picks it up next
   launch.
