# Little Pilot

A no-reading, no-failing flying (and now space-flying) game for a 4-year-old.
Two builds live side by side on one droplet, both installable as home-screen PWAs:

| Build | URL | Stack | Status |
|---|---|---|---|
| **Cockpit 3D** (primary) | https://flightsim.138.197.80.104.nip.io/cockpit/ | Three.js r128 (vendored) + DOM HUD, 17 plain scripts | Active development |
| 2D side-scroller | https://flightsim.138.197.80.104.nip.io/ | Canvas 2D, single file | Frozen |

The player-spec lives outside the repo. `CLAUDE.md` holds the working rules and
the ship checklist; this file describes the game.

## Design rules

- **Zero text** in either UI: icons, silhouettes and numbers only (the harness audits every DOM text node).
- **No living things**: no people, animals or birds. Vehicles, machines and objects only.
- **Nothing is ever taken away**: no score, no timers, no unlocks, no failure state. Every crash explodes and reassembles for free; every reward re-arms.
- **Pointing, not timing**: every control is "aim at it". Assists exist so that coasting in works.
- **Drag up = nose up**, never inverted (the keyboard mirrors this).
- **Offline after load**: zero network calls; service workers cache everything.

## Quick start

- **iPad**: open the build URL in Safari → Share → Add to Home Screen. Settings →
  Accessibility → Guided Access locks him in. Each build is its own PWA scope.
- **Desktop**: same URL; the keyboard row in Controls works, and the mouse is the stick.
- On first launch he picks a vehicle, then a direction (New York skyline icon = start NY,
  fly south; palm-and-coast icon = start CA, fly north). The choice is remembered, so
  later launches go straight to the runway; the plane button on the runway reopens the picker.

## Controls

| Input | Effect |
|---|---|
| Drag anywhere, hold | Relative virtual stick from the touch-down point. Left/right banks, up/down pitches. **Drag up = nose up.** One finger owns the stick; a second finger or a palm is ignored |
| Release | Auto-level to the horizon at a gentler rate than active control |
| Round arrow button, bottom-right | Hold to throttle (takeoff roll; for the rocket, hold to burn). One pointer owns it; a palm tap won't release it |
| Yellow flashing arrow | Rotation speed reached (latched -- releasing the throttle to free his finger doesn't lose it). Drag up past the threshold to lift off |
| Circle-arrow button, top-right | Toggle cockpit view <-> third-person chase cam. Chase keeps the dials; only the window frame hides |
| Sky button, right column | Cycles **sun → rain → snow → night** (see Sky moods). Remembered across launches |
| Gear button, bottom-left (planes) | Retract / extend the landing gear. Retracting is ignored while the wheels carry the plane. Distinct up/down icons, whirr/clunk, animated struts in chase view. **Landing with the gear up explodes** |
| Missile button, bottom-left above gear (planes, airborne) | Fire a wing missile: explodes on terrain, structures, traffic planes and targets; sub-stepped so nothing tunnels; self-destructs with a pop at the end of its range (`missileCooldown`) |
| Stage button (rocket, same slot, orange, pulsing) | Drops the next stage. Only appears above each stage's altitude (see The rocket) |
| Double-down / double-up chevrons, bottom-right (planes, airborne) | Step the set speed down / up one notch. Speed stays where he sets it -- no snap-back. Four steps (`TUNE.speedSteps`) |
| Runway button, top-left (airborne, off-approach) | **Landing button.** Planes: skip to final, aligned on the glide slope `skipOutDistance` out, gear down, speed step 1, ~45 s to touchdown. Rocket: jump to a slow descent 350 m above the nearest planet, or 200 m above the home pad; the landing assist does the rest |
| Camera button, left column | Photo: white flash, shutter click, the shot appears in a polaroid frame for a few seconds |
| Plane button, top-left (on the runway, stopped) | Reopens the vehicle picker |
| Crosshair, centre (airborne) | Flight-path marker: where the plane is really aimed; doubles as the missile aiming point; clamps to the screen edge when off-view |
| White arrow at the screen edge | Bearing to the destination airport; hides within `homeIndicatorDistance`, when approach assists engage, and in space |
| Route strip, top centre | Plane glyph slides NY <-> CA; dots fill in for landmarks passed (each one plays the next note of a scale) |
| Small amber arrow / green ring under the strip | Glide-slope cue on an engaged approach: down = too high, up = too low, green ring = on the slope |
| Two-plane icon under the strip | Wingman: dim while a traffic plane is near, bright when formation has been held |
| **Keyboard** | Arrows / WASD = stick (**up = nose up**), Space or Shift = throttle, G gear, V view, F or Enter = missile (rocket: drop stage), `+`/`-` or `]`/`[` speed step, L landing button, P photo. A finger on the screen always wins over the keys |

Layout is token-driven (`--btn`, `--thr`, `--stack-bottom`, `--dash-h`, … in
`cockpit/index.html`). Viewports under 520 px tall (phones in landscape) get a
compact tier so nothing overlaps; the harness checks 844x390 for both a plane and
the rocket with its stage button up.

## Vehicles

Defined in `TUNE.vehicles` + `TUNE.vehicleColors`; the cockpit accent recolours per
vehicle via the `--veh` CSS variable. Shelved behind `hidden: true` (the picker reads
the flag at boot): the helicopter.

| Vehicle | Cruise | Turn rate | Pitch limit | Notes |
|---|---|---|---|---|
| Prop plane | 60 | 18°/s | ±30° | Baseline feel; has gear |
| Airliner ×3 | 54 | 9°/s | ±25° | Big, heavy, slow-turning; liveries inspired-by Delta / JetBlue / Emirates (colour only); have gear |
| Fighter jet | 95 | 22°/s | ±38° | Fastest, tightest; has gear |
| Rocket | see `rocketTune` | 38°/s tilt | vertical launch | Its own flight model (The rocket below); no gear, no missiles. The `vehicles.rocket` entry only feeds the picker and dials |

Every non-rocket vehicle is ceiling-capped at `otherVehicleCeiling`.

## The world: New York <-> California

`TUNE.routeLength` (default 12000 units; 3-4 min each way in the prop, ~2 in the
fighter). Airports sit at ±routeLength/2 on flattened runway rects with a flat apron
`apronWidth` wide beside them. Each airport is a complex on the side away from its
city (NY east, CA west): apron and taxiways with yellow centrelines, a terminal with
three jet bridges and three parked airliners, a control tower with a blinking beacon,
two arched hangars, fuel tanks, a spinning radar dish, a windsock, runway edge and
threshold lights, and a fuel truck and baggage cart. Buildings and parked planes are
solid. Nothing solid crosses the runway centreline (|x| < 65) through the ring
corridor beyond either end, and nothing else stands within the runway span (checked).

Landmarks are placed at fixed route fractions and are **solid**, in route order from NY:

- NYC skyline cluster + spire, the green statue on its island, two suspension bridges (flyable-under) over the harbour
- Farmland belt around the great lake (the lake is a ring around an island), grain silos east of it
- Mid-route city with a tall dark tower
- Plains with grain silos and a moving freight train (chaseable, solid, shootable cars)
- Snow-capped mountain range
- Red canyon carved below the waterline (river fills it; wide enough to fly inside)
- Desert with casino towers
- California: red suspension bridge, the hillside letters, downtown cluster, palm trees, coastal ocean

Streamed between them: clouds, trees, towns, towers and small bridges, all kept out
of the landing corridors. Changing `routeLength` stretches the whole continent.

## Landing (planes)

- **Guidance**: the ring corridor on the glide slope (`glideSlope`), two glowing centreline
  rails, and the small glide cue under the route strip. Rings and cue measure the same slope.
- **Assists** on an engaged approach (`align*`, `touchdown*`): heading and lateral
  alignment; below `flareAgl` the **auto-flare** levels the nose regardless of the stick and
  settles at `flareSink` -- he can't arrive nose-first or tail-first. Crossing the threshold
  high is fine: the approach stays engaged over the runway and it descends from `flareStartAgl`.
- **Touchdown** is measured at the wheels (`gearHeight + touchdownClearance`) anywhere on the
  runway or the 300 m flattened pad before it, within `touchdownLatTolMult` × the runway
  half-width and `touchdownHeadingTolDeg`; that pad never explodes on terrain when lined up
  with the gear down. Squash, tyre puffs, the rails pulse, and after three eaten rings a chord.
- **Turning back** onto the runway he just left works: approach geometry is measured against
  the nearest airport (after a real climb-out of `climbOutAgl`), and he respawns on the runway
  he landed on.
- **Go-around**: too far along or off to the side and low, and the plane climbs away for
  `climbAwayTime` (lifted clear of the ground first), then it's a normal flight again; the
  rings re-arm.
- **Arrival show**: rolling to a stop sets off fireworks over the terminal, the edge lights
  chase, the beacons flash in rhythm, and the fuel truck and baggage cart pull up beside the
  plane (they drive home when the takeoff roll starts). After 6 s he respawns on that runway
  facing the other way.

## Rewards -- things that go "ding"

Nothing here can be failed or lost; every one re-arms.

- **Ring eating**: fly through a landing ring and it turns green and plays the next note of
  `ringNotes`; land after three or more and the scale resolves into a chord.
- **Gates**: gold hoops under every suspension bridge (in legal air), inside the canyon, and
  one riding with the locomotive. Fanfare + sparkle; green for `gateGreenTime`, re-arm after `gateRearm`.
- **Wingman**: stay within `wingmanDist` of a traffic plane for `wingmanHold` s; cooldown `wingmanCooldown`.
- **Sparkle spots**: twenty gold gems in clear air around the world (the statue's torch, above
  the casino ball, the highest peak, inside the canyon, low over the harbour, above both control
  towers, …). Fly through one: it bursts, chimes, and stays lit with a light beam. Remembered
  across launches; once all twenty are found they quietly reset.
- **The world answers back**: buzz an apron and the tower beacon strobes, the windsock whips and
  the hangar doors slide open; fly under a bridge and it bounces; pass the locomotive and it
  toots; pass a control tower and its cab lights flash; overfly a boat and it sounds its horn;
  brush a balloon and it squeaks and wobbles; get close to the UFO and it zips away; a low pass
  over water leaves a spray wake, over the desert a dust trail; the casino lights cycle colours
  when you're near.
- **Sounds**: every target has its own voice (balloon pop, kite flutter, disc gong, boat splash,
  blimp deep pop, UFO sci-fi, paper-plane rustle, train-car clang); a stall wobble when slow and
  nose-high; a rising whistle in a fast dive; cloud whoosh; runway rumble and a rolling-tyre
  noise that cuts at liftoff; a scale note per landmark passed. The rocket has its own roar.

## Things to shoot

| Target | Count | Where | On a hit |
|---|---|---|---|
| Traffic airliners | 6 | cruising the route both ways, never lingering in a landing corridor | explode; respawn after `trafficRespawnDelay` |
| Hot-air balloons | 8 | drifting along the route | pop + sparkle |
| Blimps | 2 | end to end at ~210 m, lit at night | deep pop |
| UFO | 1 | zig-zagging over the desert, lights alternating green/red | sci-fi zap + sparkle |
| Boats | 5 | circling the great lake's water ring | splash |
| Paper-plane squadrons | 4 | wheeling low over farmland and plains | soft puff |
| Kites | 5 | bobbing on strings beside the route | flutter |
| Bullseye discs | 8 | on poles, facing the route | gong + sparkle |
| Freight train cars | 22 | the plains railway | clang; the car leaves the train until it loops round |

Targets come back 6-10 s later somewhere else; none starts underground, inside a
building, dry, or in a corridor (checked). Flying into one is a mid-air, like the traffic.

## Sky moods

The sky button cycles four looks, each blending in over ~3 s and remembered across launches:

- **Sun** -- the default.
- **Rain** -- grey sky, soft falling drops, a rain hiss.
- **Snow** -- pale sky, drifting flakes, whitened ground.
- **Night** -- dark dome and stars, lit windows on every tall landmark, glowing blimps, the
  locomotive's headlight; runway, tower and beacon lights stand out.

Precipitation stops in space. `SKY_MOODS` in `scene.js` holds the palettes.

## Crashes, collisions and the alarm

- **Any impact explodes** -- terrain, water, structures, targets, at any speed or angle: fireball,
  debris, boom, camera shake that fades with distance, and the plane reassembles ~2 s later
  (`reassembleDelay`) at a safe height with a "boing". A smoke column rises for ~8 s and a
  crater stays for `craterFade`. Zero penalty, repeatable forever.
- **Solids** are AABBs (`resolveSolidWalls`): town buildings, landmark towers, decks, silos,
  casinos, downtown, the airport complexes, bridge decks, train cars. Wall hits shatter nearby
  pieces into the debris cloud; they restore after `shatterRestoreDelay` on their own timer and
  are never solid while hidden. Walls and mid-airs stay live during a go-around.
- **Gear-up landings explode**; the touchdown tolerances are generous, but only with the gear down.
- **Imminent-crash alarm**: when terrain, water or a structure will be hit within `crashWarnTime`
  at the current velocity, the screen edges strobe red, a warning triangle flashes and an alarm
  beeps. Silent when lined up on the runway with the gear down, and during an assisted rocket
  landing. With the gear **up**, lined up, descending and below `gearWarnAgl`, it runs all the
  way down final -- and touchdown explodes.

## The rocket and space (`js/rocket.js`, `TUNE.rocketTune`)

Loosely a Falcon 9: white booster with a black interstage, nine engines, four grid fins and
four landing legs; a second stage with a single vacuum engine; the capsule inside a two-half
fairing. It stands upright on the runway -- the pad -- with the trucks beside it.

- **Launch**: hold the throttle `igniteTime` s (the engine spools with a rumble) and it lifts
  off with a roar; the trucks drive home. Keep holding to burn, release to coast. The stick
  tilts it: drag **up** = back toward vertical, drag **down** = pitch over toward the horizon,
  left/right yaws (steering follows the local "up", so it isn't inverted on a planet's underside).
  Thrust acts along the body; Earth's gravity fades to nothing above `gravityFade`; drag only
  in the atmosphere; speed caps at `maxSpeed`.
- **Staging** is manual: the stage button (or F/Enter) appears only above each altitude in
  `stageAlt` -- booster, then the fairing halves, then the second stage -- leaving the capsule
  on its thrusters. Fuel per stage in `fuel`; the capsule never runs out. Dropped stages tumble
  away; the **booster does a boostback burn, flips upright, brakes and lands on its legs**.
- **Space**: above `spaceAltitude` the dome goes to stars, the Earth's curve stays far below, a
  satellite and a station drift mid-route. The **Moon** and **Mars** hang above the atmosphere
  (`rocketTune.moon/mars`), cratered and self-lit (Mars has a polar cap), each with a gentle pull.
- **Landing assist**: within `assistRange` radii of a body, or `assistEarthAgl` of the ground at
  home, unless he is burning away the rocket brakes to `assistDescent` and stands itself upright
  (a resting finger doesn't stop that), so coasting in always ends in a landing. Only ramming a
  surface under power faster than `landSpeed` explodes -- and it reassembles beside whatever it hit.
- **On a planet**: fireworks, the sky stays black, the surface is "down" for the camera. You stay
  whatever you arrived as -- a capsule lands as a capsule and lifts off again on its thrusters.
  Rooftops at home are landable too.
- **Landing button** (runway button): in space, a slow descent 350 m above the nearest planet;
  after a planet visit, or lower down, 200 m above the home pad. Hides once the assist has him.
- **Coming home**: descend into the atmosphere and the assist feathers it down to a Falcon-style
  landing on land or water; the pad rolls out a new full stack. Both views work: the cockpit looks
  along the body axis, the chase camera sits beside and above and never enters a planet.

## Photo

The camera button (or `P`): white flash, shutter click, and the pure 3D frame (no HUD)
appears in a polaroid frame for three seconds. It captures the frame just drawn, so it
costs nothing until pressed.

## Persistence (`localStorage`)

`lp.vehicle`, `lp.dir` (relaunch goes straight to the runway), `lp.sky` (validated to 0-3),
`lp.spots` (which sparkle spots are lit; reset when all are found or the count changes).

## Tuning

Every gameplay number lives in `TUNE` (`cockpit/js/tune.js`); the rocket's in
`TUNE.rocketTune`. The flight-feel numbers were tuned with the kid -- don't retune them.
Landing-assist strengths (`align*`, `touchdown*`, `flare*`, the rocket's `assist*`) may be
weakened gradually as he improves. `routeLength` scales the whole continent.

## Repo layout

```
CLAUDE.md             working rules + ship checklist
cockpit/
  index.html          markup + CSS shell (~800 lines); loads js/ in order
  js/                 the game: classic scripts sharing one global scope, in load order
    tune.js           every gameplay number (TUNE, rocketTune)
    terrain.js        noise, terrain shaping, flatten mask, runway rects
    scene.js          renderer, sky + moods, water, precipitation, terrain chunk streaming
    landing.js        ring corridor, centreline rails, ring eating
    scenery.js        clouds, trees, towns, streamed towers/bridges, traffic models
    traffic.js        AI airliners + missiles
    landmarks.js      solids registry, route landmarks, gates, airports, targets, spots, effects pools, train
    audio.js          WebAudio synth: engines, rolling, tones, rain, one-shots
    hud.js            DOM refs, dials, route strip, 2D fx canvas
    explosion.js      debris / fireball pools
    vehicle.js        vehicle models, chase / cockpit cameras
    collision.js      shatter / restore, wall resolution
    state.js          state object, vehicle apply, spawn
    input.js          touch, buttons, keyboard, photo, persistence, lifecycle, SW
    flight.js         plane flight model, assists, alarm, sky, rewards, update()
    rocket.js         rocket flight model, staging, Moon / Mars, landing assist
    main.js           HUD update, test surface (window.__lp), frame loop
  three.min.js        vendored r128 UMD build -- no CDN, offline-first
  manifest.json       display:fullscreen, orientation:landscape
  sw.js               cache-first service worker (bump CACHE_NAME on every cockpit change)
  icons/              generated 180 / 192 / 512 px icons (duplicated per PWA scope)
index.html            frozen 2D build (same PWA shell pattern), with manifest.json, sw.js, icons/
scripts/
  make_icons.py       regenerates both icons/ sets (PIL)
  headless_test.js    playwright harness -- run before every ship
  visual_baseline.json  generated visual hashes (UPDATE_VISUAL=1); never hand-edit
deploy/
  deploy.sh           run ON the droplet: pull, guard, rsync allowlist, rollback
  nginx-flightsim.conf  reference copy of the live nginx site config
  flightsim-headers.conf  security headers snippet the config includes
qa-screenshots/       harness captures (gitignored)
```

## Testing

`scripts/headless_test.js` drives the real game in headless Chromium (SwiftShader WebGL),
~45 s on an M-series Mac, and prints its check count (146 today). It refuses to start if
something else is on port 8177, and it serves the repo live -- don't edit `cockpit/` while it runs.

```
npm i playwright-core        # once, any node_modules location
CHROME_HEADLESS_SHELL=/path/to/chrome-headless-shell \
NODE_PATH=/path/to/node_modules \
node scripts/headless_test.js
```

What it covers, by section: phone-landscape layout (plane and rocket) · HUD layout in both
orientations · takeoff safety and real-pointer takeoff · vehicles (picker, rocket launch, stats)
· solid structures and shatter · ceiling for non-rocket vehicles · landings (sloppy, go-around,
gear-up) · crashes (every impact, repeatable) · full route both directions · route strip ·
throttle steps and glide cue · missiles, traffic, shootdowns, no tunnelling · skip-to-landing ·
zero-text audit · FPS (advisory) · world integrity (no flattened ribbon, runways flat, train,
beacons, wall faces, shatter restore, deep water, corridors clear, centreline clear) · rewards
(rings + flare landing, rings re-arm, gates, wingman, crash aftermath, alarm, keyboard, short and
high landings, origin-runway landings, targets and their placement, train cars, sparkle spots,
arrival show + apron trucks, tower fly-by, hangar doors, bridge bounce, sky cycle, photo, gear
rule, overrun, bridge gates in legal air, boats on water, traffic corridor slip, blur releases
keys) · persistence across launches · the rocket (pad, altitude-gated drops, booster landing,
Moon landing + relaunch + staging afterwards, Mars coast-in and powered ram, landing button,
Earth landing + refit, fuel-out and apron trucks) · claimed feel effects (cloud whoosh, missile
self-destruct pop, boat-horn hello, spray wake) · visual regression · service worker and manifests
for both builds. `Math.random` is seeded under test, so runs are repeatable; heavy sections run on
fresh pages so state cannot leak between them.

The visual pass renders eight fixed scenes (runway cockpit, canyon chase, approach rings, NY
skyline, night skyline, rocket pad, capsule in space, CA airport chase) to 96x54 grey hashes and
compares them with `scripts/visual_baseline.json` (`{meta, hashes}`; mean diff < 6/255; a frame
without contrast fails; a missing baseline fails). Re-baseline deliberately with `UPDATE_VISUAL=1` after an intentional look
change. Audio and feel are not covered: render and look, listen on the iPad.

## Deploy

Hosting: nginx static site + Let's Encrypt via certbot on the droplet, hostname
`flightsim.138.197.80.104.nip.io`, docroot `/var/www/flightsim`, checkout `/root/flightsim`.

```
# ship (from anywhere):
git push origin cockpit-3d && git checkout main && git merge --no-ff cockpit-3d && git push
ssh root@138.197.80.104 'cd /root/flightsim && bash deploy/deploy.sh'

# roll back one published rev (repeatable: each call goes one further back):
ssh root@138.197.80.104 'cd /root/flightsim && bash deploy/deploy.sh --rollback'
```

`deploy.sh` publishes `origin/main` (checks out main, hard-resets to it), refuses a dirty
tree, and refuses to deploy if `cockpit/` (or the root build) changed *since the rev
currently published* without a `CACHE_NAME` line change in the matching `sw.js`. If the
published rev is unknown to the checkout it stops and says so. It keeps the published rev
and a history under `/var/lib/flightsim/` and rsyncs an allowlist (`index.html`,
`manifest.json`, `sw.js`, `icons/`, `cockpit/`, minus editor and OS droppings). `--no-pull`
publishes the checkout as-is. The script runs as a function so replacing the file mid-run is safe.

Branch flow: develop on `cockpit-3d`, merge to `main` to deploy. Adding a file under
`cockpit/js/` means adding it to both the `<script>` list and `cockpit/sw.js` ASSETS. The
page reloads itself when a new worker takes over while sitting on the runway menu, so the
first launch after a deploy already runs the new code.

First-time provisioning on a fresh droplet: clone the repo, copy
`deploy/nginx-flightsim.conf` to `/etc/nginx/sites-available/flightsim` and
`deploy/flightsim-headers.conf` to `/etc/nginx/snippets/flightsim-headers.conf` (the
security headers live in the snippet because nginx `add_header` is not inherited into
location blocks), symlink into `sites-enabled`, `nginx -t`, reload, then
`certbot --nginx -d flightsim.138.197.80.104.nip.io`.
