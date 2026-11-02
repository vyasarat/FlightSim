# Audit — 2026-11-01 (main 15b239d, v210)

Ten read-only auditors, one area each (flight, cars, race, London, space, boats, dad mode,
buttons/HUD/audio, the harness and cross-cutting traps, lifecycle/long session). Most findings
were run in the game by a probe; "traced" means read in the code only. Severity:
**S1** crash, stuck, text, a bang he didn't cause, lost session · **S2** wrong behaviour ·
**S3** cosmetic or performance · **S4** code smell (listed, never fixed).

Every S1-S3 gets a check that fails on main before it is fixed (`scripts/audit_*_checks.js`);
one that cannot be made to fail is marked UNCONFIRMED and left alone. The fix order is in QUEUE.md.

## What came back clean
- No visible text anywhere (a live text-node walk after every dad mission and a race).
- One owner per global name (all 75 files parsed with acorn); `performance.now` only in
  main/audio/nozoom; no `Date.now`; rAF queued only by main.js; no collision list outside solids.js.
- A 60 s rAF gap: the 1/30 s dt clamp holds in ten states, nothing bangs or teleports;
  visibilitychange releases the finger; resize keeps the camera aspect; WebGL context loss and
  restore throw nothing and come back pixel-identical.
- A 16 sim-minute session cycling all 16 cards, three places, three rocket destinations, a race,
  the toy track and the harbour: geometries, textures, programs, scene objects, solids, pools,
  listeners, tones and heap all flat.
- Every car, every track: start, items, EXIT, finish, AGAIN, 36 races in a row. Every car from NY,
  California and London, held finger 120 s: 0 bangs, 0 touches, 0 off-road.
- Every aircraft starts parked at all three airports and takes off clean; crashes reassemble.
- Dad mode: state, camera, fog, DOM, buttons and the random stream identical before and after each
  of the six missions.

## S1 — crash, stuck, a bang he didn't cause, lost session

| id | where | what happens to him | evidence |
|---|---|---|---|
| SPACE-1 | marsbase.js:406-416, rover.js:72 | Rover rolled out during the Mars pad's 3-2-1 drives off at 14 m/s with no finger, and nothing stops it. Anything in the way is a bang he didn't cause; the only way out launches him. | probe |
| SPACE-2 | marsbase.js:300-312, 406-416 | Picker opened during the Mars pad count: the forced throttle leaks, and the next rocket lifts off the Earth pad by itself. | probe |
| FLIGHT-4 | flight.js update / input.js:466 | The plane flies on, hands-off, behind the vehicle picker: crash-warning beeps, then a bang while he is choosing a card. Targets get popped under it too. | probe |
| HARNESS-2 | input.js:622-626 | After a deploy, the service worker reloads the page whenever `phase==="TAXI" && speed===0` and the menu is CLOSED (its comment says the opposite): a car at a red, an idle boat, the race grid or podium. Lost session. | traced |

## S2 — wrong behaviour

| id | where | what happens to him | evidence |
|---|---|---|---|
| AUDIO-1 (DAD-1, RACE-3, HUD-8) | audio.js:289-299 `setTone` | A silence asked for while the AudioContext isn't running is dropped. After a lock or call: leaving dad mode leaves its engine droning in his game; leaving a race leaves the crowd and surface drone on. | probe |
| HUD-2 | rocket.js:583, 1234; state.js:139 | Leaving mid-re-entry: the orange glow and the roar stay on in every vehicle until his next rocket. | probe |
| HUD-3 | setpieces.js:213-218, 281 | Leaving while the towers fall: a 34 Hz rumble at 5x the engine follows him everywhere; mid-count, the "2" stays on his new start. | probe |
| HUD-4 | harbor.js:801-803 | Any jump away from the harbour: the crane's 62 Hz hum carries on everywhere. | probe |
| FLIGHT-3 | flight.js:374 | The engine plays at full cruise through the whole 13 s eject rescue. | probe |
| CARS-1 | police.js:340-362; state.js:186 | A pull-over survives a relaunch or the globe: the police cars streak 11 km (or across the sea) in 2 s to his new start, then the 3-2-1 plays. | probe |
| CARS-2 | london.js:1584-1612; state.js:185 | On the toy track the globe is offered; picking a city does nothing visible (he snaps back on the track) but saves London as his start. | probe |
| CARS-3 | eject.js:216 | Ejecting from a car brings him back at the start of the motorway or London's airport road, 1-2 km from where he was. | probe |
| FLIGHT-1 | london.js:1627; eject.js:216 | After the London heading switch, an eject brings him back on the runway facing the wrong way, destination behind him. | probe |
| FLIGHT-2 | eject.js:207-216 | Ejecting during the landing roll or celebration sends him back to the airport he left. | probe |
| LONDON-2 | london.js:1302, 1350, 1467 | A helicopter parked on Tower Bridge hangs in mid-air when it opens; the tall ship sails through it. | probe |
| LONDON-3 | input.js:301-333 | A relaunch "restores" London, but carrying on goes through the direction screen, which only offers New York or California. | traced |
| SPACE-3 | marsbase.js:351, 406 | The cargo ship's countdown and the pad's fight over the numeral: the tick becomes a buzz (357 blips in 3 s). | probe |
| RACE-1 | race.js:2628; flight.js:471 | A race started from inside the car wash sits frozen for about 8 s, HUD up, his car not on screen; EXIT later puts him back inside the wash. | probe |
| HUD-1 | index.html:683, 996 | A double tap on the menu button opens dad's code pad (9 of 9); mashing it locks the parent out for 60 s. | probe |
| BOATS-1 | yacht.js:459-482 | Leave the yacht near the drawbridge and it stays up for the session; the coast road queues forever, the car drives over the gap. | probe |
| BOATS-2 | lock.js:280-290, 331-343 | After one trip up (or an abandoned cycle) the lock never opens to the harbour again; the hull passes the shut gate and jumps 6 m in a frame. | probe |
| BOATS-3 | boat.js:430 | The yacht at the burning rig gets the speedboat's cannon button: dead, and covering her garage button. | probe |
| BOATS-4 | buttons.js:84-85 | In the lock chamber the yacht's garage button and the lock button share a slot; the lock wins. | probe |
| HARNESS-1 | cockpit/sw.js ASSETS | London's city GLB isn't cached: offline, London has no buildings. | probe |

## S3 — cosmetic or performance

| id | where | what happens | evidence |
|---|---|---|---|
| SPACE-4 | marsbase.js:336-345, 1702 | Rover parked by the button during a star shower: the pad stays dim for good, stars hang frozen. | probe |
| BOATS-5 | seaevents.js:569 | A container on the yacht's deck sits inside the hull once the lock lifts her. | probe |
| BOATS-6 | lock.js:294-299 | The lock's countdown numeral follows him into the next vehicle; the empty lock then fills alone. | probe |
| BOATS-7 | yacht.js:516, 533 | Launching the tender never opens the garage door; its timers are wall-clock setTimeouts. | traced |
| FLIGHT-6 | eject.js:76, 194, 253 | Eject over the lock's upper water: the heli bangs on the floor under the water, pilot lands 3 m under, no raft (water from TUNE.waterLevel). | probe |
| FLIGHT-7 | hud.js:64-83 | On the London crossing the route strip lights the American landmark dots over open sea and plays 7 notes. | probe |
| FLIGHT-8 | input.js:66-69 | Helicopter: a resting palm handed the stick becomes a new destination. | traced |
| HUD-5 | buttons.js:50 | The horn button is live over the picker, track picker and globe. | probe |
| HUD-6 | input.js:312, 324, 336 | A double tap on a vehicle card also picks a direction he never saw. | probe |
| HUD-7 | flight.js:402-460 | In a plane crash the engine keeps roaring at its pre-crash level through the bang. | probe |
| HUD-9 | input.js:41-47 | Turning the iPad mid-drag can peg the stick. | suspicion |
| RACE-2 | race.js:2319 | His car's GLB arriving mid-race leaves it floating 2.6 m over the track. | probe |
| RACE-4 | race.js:1424, 2278 | A giant who loses stays giant through the podium parade. | probe |
| DAD-2 | dadmode.js:304 | Each dad-mode entry leaves 15-260 geometries and its materials on the GPU. | probe |
| DAD-3 | flight.js:356-362 | Inside dad mode: his stall warble plays through the Apollo descent and the Hudson glide. | probe |
| LONDON-5 | london.js:1641-1646 | The whale freezes mid-breach if the camera leaves the crossing. | traced |
| LIFECYCLE-1 | vehicle.js:28-36 | Every vehicle switch disposes the cached prototype's buffers and shaders: a 33-63 ms first frame (SwiftShader). | probe |
| LIFECYCLE-2 | input.js:598-606 | The page hidden, audio is never suspended: the engine drones where the browser doesn't cut it. | probe |

## Found during the fixes

| id | where | what | status |
|---|---|---|---|
| GLOW-1 (S3, found v213) | index.html:434 `#reentryGlow` z-index 7 under the canvas (z-index 9) | The orange screen-edge glow of re-entry has never been visible: the opaque WebGL canvas covers it. HUD-2's "glow stays on" was invisible; its roar was real (fixed v213). | Left for the parent: turning it on adds an effect he has never seen (readability), not a fix. |

## S4 — code smells (listed only, not fixed)
- Third water definition (`terrainEff < TUNE.waterLevel`): rocket.js:804, recovery.js:105-126, events.js:620, setpieces.js:599 (eject.js is FLIGHT-6).
- marsbase.js:300-304: the Mars boost's expiry releases whatever vehicle's throttle (covered by SPACE-2's fix).
- seaevents.js:432 cruise ship's second horn on a wall-clock setTimeout.
- gate.js:100 Stop hook exits 0 on `stop_hook_active` before checking; gate's one-owner regex sees one name per line and not `async function`/`class`; the stream rule ignores GLBs and lazy builders; gate 10a matches only the literal `performance.now()`; headless_test.js:1174 mid-air check accepts any explosion.
- eject.js:111/207 restores `state.gameT` from the snapshot (the clock rewinds ~12 s; harmless today).
- race.js:1931/2242 podium confetti draws Math.random.
- A car's/boat's bang lasts one frame (car.js:703); the checks fake a 2 s bang (lights_police_checks.js:300). A design question for the parent, not a fix.
- police.js:79-88 eight materials per chase never disposed.
- Audio buffers draw Math.random (engines.js:60/82/93), so the stream depends on unlock; performance.now in audio.js's resume retry.
- audio.js:299 setTone can't silence a tone whose last gain was < 0.002 (inaudible).
- london.js:868 splashAt draws terrain's rnd(); london.js:956 swaps Math.random across an async GLTF parse; Big Ben's minute hand snaps on a London start.
- A photo taken while the WebGL context is lost would be blank.

## Proof and fixes
(filled in as each release ships: the check, FAILS on main / passes after, the release)

| release | findings | check module | before / after |
|---|---|---|---|
| v211 (b232cac) | SPACE-1, 2, 3, 4 (+ the boost-then-plane case the law-reviewer found: a plane picked in the Mars boost rolled 288 m) | scripts/audit_space_checks.js | 0/6 on v210, 6/6 |
| v212 (3fa76bf) | FLIGHT-4, HARNESS-2 | scripts/audit_flight_checks.js, scripts/audit_harness_checks.js | 1/2 and 0/2 on v211 (the passes are page-error guards), 2/2 and 2/2 |
| v213 | AUDIO-1 (DAD-1, RACE-3, HUD-8), HUD-2 (the roar; its glow was never visible, GLOW-1), HUD-3, HUD-4, FLIGHT-3 | audit_hud/race/dad/flight_checks.js | 0/5, 0/1, 0/1, FLIGHT-3 0/1 on v212; all pass |

UNCONFIRMED, not fixed: HUD-9 (turning the iPad mid-drag): the check fails only if iOS keeps the touch
alive through an autorotation, which nobody has shown; if it sends pointercancel, releaseDrag already handles it.
