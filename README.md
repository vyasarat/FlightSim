# Little Pilot

A no-reading, no-failing flying game for a 4-year-old. Two builds live side by side
on one droplet, both installable as home-screen PWAs:

| Build | URL | Stack | Status |
|---|---|---|---|
| **Cockpit 3D** (primary) | https://flightsim.138.197.80.104.nip.io/cockpit/ | Three.js r128 (vendored) + DOM HUD | Active development |
| 2D side-scroller | https://flightsim.138.197.80.104.nip.io/ | Canvas 2D, single file | Frozen |

Zero text anywhere in either UI — icons, silhouettes and numbers only.
No living things anywhere — no people, animals or birds; vehicles, machines and objects only
(the statue is a statue; the astronaut belongs to the shelved rocket content).
Zero network calls after load; service workers cache everything.

The player-spec lives outside the repo. Design rules that govern everything:
nothing is ever taken away, no score, no unlocks, no timers, every control is a
pointing skill not a timing skill, drag-up = nose-up.

## Repo layout

```
cockpit/
  index.html        markup + CSS shell (~700 lines); loads js/ in order
  js/               the game, classic scripts sharing one global scope, in load order:
    tune.js         every gameplay number (TUNE)
    terrain.js      noise, terrain shaping, flatten mask, runway rects
    scene.js        renderer, sky, water, terrain chunk streaming
    landing.js      ring corridor, centreline rails, ring eating
    scenery.js      clouds, trees, town buildings, landmark cells, traffic models
    traffic.js      AI airliners + missiles
    landmarks.js    solids registry, route landmarks, gates, smoke/craters, train
    audio.js        WebAudio synth (engine, rolling, one-shots)
    hud.js          DOM refs, dials, route strip, 2D fx canvas
    explosion.js    debris/fireball pools
    vehicle.js      vehicle models, chase/cockpit camera
    collision.js    shatter/restore, wall resolution
    state.js        state object, vehicle apply, spawn
    input.js        touch, buttons, keyboard, persistence, lifecycle, SW
    flight.js       ground roll, approach assists, flare, alarm, update()
    main.js         HUD update, test surface (window.__lp), frame loop
  three.min.js      vendored r128 UMD build -- no CDN, offline-first
  manifest.json     display:fullscreen, orientation:landscape
  sw.js             cache-first service worker (bump CACHE_NAME on deploys)
  icons/            180 / 192 / 512 px app icons
index.html          frozen 2D build (same PWA shell pattern)
manifest.json       2D manifest
sw.js               2D service worker
icons/              shared icon source set
scripts/
  make_icons.py     regenerates icons/ from code (PIL)
  headless_test.js  playwright harness (prints its check count) -- run before every ship
deploy/
  deploy.sh         run ON the droplet: git pull + rsync to web root
  nginx-flightsim.conf  reference copy of the live nginx site config
qa-screenshots/      harness-generated screen captures (gitignored)
```

## Controls (what he actually touches)

| Input | Effect |
|---|---|
| Drag anywhere, hold | Relative virtual stick from touch-down point. Left/right banks, up/down pitches. **Drag up = nose up**, never inverted |
| Release | Auto-level to horizon at a gentler rate than active control |
| Round button, bottom-right | Hold to throttle (takeoff roll). Engine sound tracks speed |
| Yellow flashing arrow | Appears once rotation speed is reached (latched -- releasing throttle to free his finger doesn't lose it). Drag up past threshold to lift off |
| Circle-arrow button, top-right | Toggle cockpit view <-> third-person chase cam. Chase keeps the dials visible; only the window frame hides |
| Gear button, bottom-left (planes only) | Retract / extend landing gear (retracting is ignored while the wheels are on the ground) -- distinct up (grey wheel + red slash) and down (white wheel + ground line) icons, whirr/clunk sounds, animated struts in chase view. **Landing with gear up explodes** |
| Double-down-chevron button, bottom-right (airborne) | Tap: step the set speed DOWN one notch. Speed stays where he sets it -- no snap-back |
| Double-up-chevron button, above it (airborne) | Tap: step the set speed UP one notch. Four steps total (`TUNE.speedSteps`); approach floor still prevents crawling on final |
| Missile button, bottom-left above gear (airborne) | Fire a wing missile -- explodes on impact with terrain, structures, or traffic planes (cooldown `missileCooldown`). Sub-stepped collision detection means no tunneling; at end of range it self-destructs with a visible pop |
| Runway button, top-left (airborne, off-approach) | Skip to landing: places the plane aligned on the glide slope `skipOutDistance` from the destination, gear auto-extends, speed step set to 1 for the approach, ~45-60 s out |
| Crosshair, center screen (airborne) | Flight-path marker -- shows exactly where the plane is aimed, including climb/dive; doubles as the missile aiming point. Clamps to the screen edge when the aim is off-view |
| White pointer arrow at screen edge | Points along the horizontal bearing of the destination airport; hides within `homeIndicatorDistance` or whenever approach assists engage |

Layout is token-driven (`--btn`, `--thr`, `--stack-bottom`, `--dash-h` … in `cockpit/index.html`). Viewports under 520 px tall (phones in landscape) get a compact tier: smaller buttons, dash and dials, so nothing overlaps; the harness checks 844x390.
| Route strip, top-center | Plane glyph slides NY<->CA as he flies; dots fill in for landmarks passed |
| Plane button, top-left (on the runway, stopped) | Reopens the vehicle picker. The last vehicle + direction are remembered (`localStorage`), so a relaunch goes straight to the runway |
| Sky button, right column under the view button | Cycles **sun → rain → snow → night**. Rain: grey sky, falling drops, rain hiss. Snow: pale sky, drifting flakes, whitened ground. Night: dark sky and stars, every tall building's windows light up, the blimps glow, the locomotive's headlight comes on, runway and tower lights stand out. Remembered across launches |
| Camera button, left column under the runway/plane button | Takes a photo: white flash, shutter click, and the shot appears in a polaroid frame for a few seconds (long-press it to save on iOS). `P` on a keyboard |
| **Keyboard** (desktop) | Arrows / WASD = stick (**up = nose up**), Space or Shift = throttle, G gear, V view, F or Enter missile, `+`/`-` (or `]`/`[`) speed step, L skip-to-landing, P photo. A finger on the screen always wins over the keys |

## Rewards (things that go "ding")

Nothing here can be failed or lost; every one re-arms.

- **Ring eating** -- fly through a landing ring and it turns green and plays the next note of a rising scale (`ringNotes`); land after eating three or more and the scale resolves into a chord. The rings sit exactly on the glide slope, so they *are* the landing instruction.
- **Auto-flare** -- on an engaged approach below `flareAgl` the nose levels off regardless of the stick and the plane settles at `flareSink`. He can't arrive nose-first or tail-first. The approach stays engaged all the way over the runway, so crossing the threshold high still flares down to a landing. The last 300 m before the threshold (the flattened pad) never explodes on terrain when lined up with gear down. Approach geometry is measured against the *nearest* airport, so turning back onto the runway he just left lands (or belly-explodes) like any other; after landing he respawns on that runway.
- **Touchdown** -- plane squashes, tyre puffs, the centreline rails pulse bright.
- **Gates** -- gold hoops under every suspension bridge, inside the canyon, and one riding with the locomotive. Fly through: fanfare + sparkle, the hoop turns green for `gateGreenTime`, re-arms after `gateRearm`.
- **Wingman** -- fly within `wingmanDist` of a traffic plane for `wingmanHold` seconds: the two-plane icon at the top lights up, then sparkles. Cooldown `wingmanCooldown`.
- **Cloud whoosh** when passing through a cloud; runway rumble and a rolling-tyre noise on the ground that cuts at liftoff; the chase camera lags and leans into banks.
- **Sparkle spots** -- twenty gold gems tucked around the world (the statue's torch, the casino ball, the highest peak, inside the canyon, the control towers, low over the harbour ...). Fly through one and it bursts, chimes and stays lit with a light beam for good; the more he explores, the more lit the world gets. Remembered across launches; once all twenty are found they quietly reset.
- **Arrival show** -- rolling to a stop after a landing sets off fireworks over the terminal, the runway lights chase, the beacons flash in rhythm, and the fuel truck and baggage cart drive out to the plane. They wait beside it on the runway and drive home when the takeoff roll starts.
- **The world answers back** -- buzz an airport (low over the apron) and the tower beacon strobes, the windsock whips and the hangar doors slide open; fly under a bridge and it bounces; pass the locomotive and it toots; pass the control tower and its cab lights flash; fly over a boat and it sounds its horn; brush a balloon and it squeaks and wobbles; get close to the UFO and it zips away; a low pass over water leaves a spray wake, over the desert a dust trail; the casino lights go wild when you're near.
- **Sounds** -- every target has its own voice (balloon pop, kite flutter, disc gong, boat splash, blimp deep pop, UFO sci-fi, paper-plane rustle, train-car clang); a stall wobble tone when slow and nose-high, a rising whistle in a fast dive; each landmark passed on the route strip plays the next note of a scale.

## Imminent-crash alarm

When the plane will hit terrain, water or a structure within `crashWarnTime` at its
current velocity, the screen edges strobe red, a warning triangle flashes and an
alarm beeps. It is silent whenever he is lined up on the runway with gear down
(that's a landing, not a crash). With the gear **up** it is the opposite: lined up and
below `gearWarnAgl` the alarm runs all the way down final, and touchdown explodes.

## Vehicles (all unlocked, tap to fly)

Defined in `TUNE.vehicles` + `TUNE.vehicleColors`. After picking a vehicle he
chooses direction: New York skyline icon (start NY, fly south) or palm-and-coast
icon (start CA, fly north).

| Vehicle | Cruise | Turn rate | Pitch limit | Notes |
|---|---|---|---|---|
| Prop plane | 60 | 18°/s | ±30° | Baseline feel; has gear |
| Airliner ×3 | 54 | 9°/s | ±25° | Big, heavy, slow-turning; liveries inspired-by Delta / JetBlue / Emirates (color only, no trade dress); have gear |
| Fighter jet | 95 | 22°/s | ±38° | Fastest, tightest; has gear |
| Rocket | -- | 38°/s tilt | vertical launch | Its own flight model (see below); no gear, no missiles |

Shelved behind `hidden: true` in `TUNE.vehicles` (defs intact, one flag to
re-enable -- the picker reads the flag at boot): the helicopter (hover). Every
non-rocket vehicle is ceiling-capped.

Cockpit overlay accents recolor per vehicle via the `--veh` CSS variable.

## The route: New York <-> California

`TUNE.routeLength` (default 12000 units ≈ 3.5 min each way at cruise). Airports sit
at ±routeLength/2 with flattened-terrain runway rects plus a flat apron `apronWidth`
wide beside them. Each airport is a full complex on the side away from the city
(NY east, CA west): apron and taxiways with yellow centrelines, a terminal with
three jet bridges and three parked airliners at the gates, a control tower with a
blinking beacon, two arched hangars, fuel tanks, a spinning radar dish, a windsock,
and runway edge/threshold lights. Buildings and parked planes are solid. Nothing
solid crosses the runway centreline (|x| < 65) for 2.2 km beyond either runway end, and
nothing else stands within the runway span (the NY harbour/bridges/skyline, the CA bridge
and the hillside letters were all moved out; the harness checks the centreline). Landmarks are placed at fixed
fractions of the route and are **solid**:

- NYC skyline cluster + spire, green statue on an island, two suspension bridges (flyable-under)
- Farmland belt around the great lake
- Mid-route city with a tall dark tower
- Plains with grain silos and a moving freight train (chaseable, solid cars)
- Snow-capped mountain range
- Red canyon carved below the waterline (river fills it; wide enough to fly inside)
- Desert with casino towers
- California: red suspension bridge, hillside blocks, downtown cluster, palm trees, coastal ocean

Landing guidance: the ring corridor plus two glowing centerline rails on the ground,
and a HUD glide arrow during engaged approaches -- amber up/down when off the ideal
glide path (`glideSlope`), pulsing green ring when on it. Rings are placed on the
same slope the arrow measures, so the two never disagree.

Landing at the far airport plays confetti + cheer, then immediately spawns him on
that runway facing home. Missing the approach triggers a silent automatic go-around.
All of it crashable -- see below.

## The rocket and space (`js/rocket.js`, `TUNE.rocketTune`)

Loosely a Falcon 9: white booster with a black interstage, nine engines, four grid
fins and four landing legs; a second stage with one vacuum engine; the capsule
inside a two-half fairing. It stands upright on the runway (the pad).

- **Launch**: hold the throttle `igniteTime` seconds (engine spools, rumble) and it
  lifts off. Keep holding to burn; release to coast. The stick tilts it: drag **up**
  = back toward vertical, drag **down** = pitch over toward the horizon, left/right
  yaws. Thrust acts along the body; Earth's gravity fades to nothing above
  `gravityFade`; drag only in the atmosphere. Speed caps at `maxSpeed`.
- **Staging** is manual: the orange stage button (missile slot) appears only above
  each stage's altitude in `stageAlt` -- booster first, then the fairing halves,
  then the second stage -- and `F`/Enter does the same. Dropped stages tumble away;
  the **booster flips upright, burns to slow down and lands on its legs**
  (`flags.boosterLandings`). Fuel per stage in `fuel`; the capsule's thrusters
  never run out. Landing anywhere gives the whole stack back.
- **Space**: above `spaceAltitude` (blended over `spaceBlendBand`) the dome goes to
  stars, the Earth's curve sits below, a satellite and a station drift mid-route.
  The **Moon** and **Mars** hang above the atmosphere (`rocketTune.moon/mars`:
  position, radius, gravity) with craters and, on Mars, a polar cap; each pulls
  gently when you're near. A **landing assist** takes over within `assistRange` radii (and within `assistEarthAgl` of the
  ground at home): unless he is burning away, the rocket brakes to `assistDescent` and stands
  itself upright, so simply coasting in always ends in a landing. Touch down and you **land** --
  fireworks, the stack is restored, the sky stays black -- then launch again from its
  surface (it's the new pad). Only ramming a surface under full power faster than `landSpeed` still explodes (and
  reassembles above it), like everything else.
- **Landing button**: the runway button works for the rocket too. In space it jumps to a
  slow descent 350 m above the nearest planet; lower down, 200 m above the home pad --
  the assist does the rest. It hides once the assist already has him.
- **Coming home**: descend into the atmosphere and the same assist feathers it down
  to a Falcon-style landing on land or water; only a powered ram is a crash. Both views work: the cockpit looks along the body axis (straight up at the
  stars on the pad), the chase camera sits behind and below.
- Other vehicles are hard-capped at `otherVehicleCeiling`.

## Crashes & collisions

- **Any impact explodes** -- terrain, water, structures, at any speed or angle: fireball, debris, camera shake, boom, plane reassembles ~2 s later (`reassembleDelay`) at safe altitude with a "boing" pop. A smoke column rises from the crash for ~8 s and a crater stays for `craterFade`. Zero penalty, repeatable forever. (The old shallow-skim bounce is gone -- he asked for realism.)
- Structures are solid AABBs (`resolveSolidWalls`): instanced town buildings, landmark towers/decks/silos/casinos/downtown, bridge decks, train cars. Wall hits shatter *both* sides -- nearby structure pieces hide into the debris cloud and restore after `shatterRestoreDelay` on their own timer, longer than the plane's reassemble, so the damage is visible (a missile-shattered building never lingers as an invisible wall). Hidden pieces are never solid. Walls and mid-airs stay live during a go-around.
- **Gear-up landings explode.** Touchdown tolerances (`touchdownLatTolMult`, `touchdownHeadingTolDeg`) still generous, but only with gear down.
- **Traffic planes**: six AI airliners cruise the route in both directions (`trafficCount`). Shoot them with missiles or fly into them -- both explode on contact; they respawn elsewhere after `trafficRespawnDelay`. Mid-air collisions cost him nothing, same as everything else.
- **Targets**: eight hot-air balloons drifting along the route, two blimps cruising it end to end, a UFO zig-zagging over the desert (its ring of lights alternates green/red), five boats circling the great lake, four squadrons of paper planes gliding low over the farmland and plains, five kites bobbing on strings, and eight bullseye discs on poles. A missile pops them (balloons, the UFO and discs add a sparkle burst; paper planes and kites a soft puff); they come back 6-10 s later. Flying into one is a mid-air like the traffic planes. The freight train's cars are shootable too -- a hit car leaves the train until it loops round.

## Tuning

Every gameplay number lives in the `TUNE` object in `cockpit/js/tune.js`, grouped: flight feel (do not retune -- tested with the kid),
takeoff/rotation, landing-assist strengths (weaken these gradually as he improves:
`align*`, `touchdown*`, `autoThrottleResponse`), explosions, space, route/scenery,
HUD/home indicator, audio, vehicles, rewards & feel (ring notes, flare, gates,
wingman, alarm, keyboard ramp). Changing `routeLength` stretches the whole
continent -- landmarks and zones derive from route fractions, nothing needs rebuilding.

## Testing

`scripts/headless_test.js` drives the real game in headless Chromium (SwiftShader WebGL)
(it prints the check count at the end): HUD layout in both orientations, zero-text DOM audit, takeoff
(with and without input), sloppy-approach landings, go-around, deliberate repeatable
crashes (every impact explodes, shallow skims included), the prop and the shelved rocket flown (the other vehicles are asserted by stats), full route both directions timed
150–290 s, rocket round-trip to space, non-rocket ceiling, solid-wall shatter,
view toggle, gear cycle (up/down icons), persistent speed stepper (set-and-stays), aim crosshair, glide-guidance arrow, chase-cam ground alignment, missile firing + shootdowns + ground impact + no-tunneling, traffic presence + mid-air collision, skip-to-landing end-to-end, strip behavior, SW/manifest reachability for both builds, and
world-integrity regressions (no flattened ribbon along the route, train moves, beacons are
live meshes, every wall face reassembles on the near side with finite coords,
missile-shattered pieces self-restore, deep water crashes), rewards (rings eaten + flare
landing with a gentle nose-down, a high hands-off threshold crossing that still lands, rings re-arming on a
go-around, gates in legal air, boats on water, origin-runway landings both gear states, gates fire once then re-arm, wingman, crash smoke/crater, alarm on a dive and silent on
approach, keyboard takeoff and controls, remembered vehicle restored on relaunch), and a visual
regression pass: four fixed scenes are rendered and reduced to 24x14 grey hashes compared against
`scripts/visual_baseline.json` (96x54 grey, mean pixel diff < 6/255). Re-baseline deliberately with
`UPDATE_VISUAL=1` after an intentional look change. FPS under software GL is printed as advisory only.
The harness refuses to run if something else is already serving port 8177.

```
npm i playwright-core        # once, any node_modules location
CHROME_HEADLESS_SHELL=/path/to/chrome-headless-shell \
NODE_PATH=/path/to/node_modules \
node scripts/headless_test.js
```

Serve is handled internally via python3 http.server on port 8177.
Screenshots land in `qa-screenshots/` (gitignored).

## Deploy

Hosting matches the other apps on this droplet: nginx static site + Let's Encrypt
via certbot, hostname `flightsim.138.197.80.104.nip.io`, docroot `/var/www/flightsim`,
checkout `/root/flightsim`, GitHub auth via account SSH key.

```
# ship (from anywhere):
git push origin cockpit-3d && git checkout main && git merge --no-ff cockpit-3d && git push
ssh root@138.197.80.104 'cd /root/flightsim && bash deploy/deploy.sh'

# rollback to the previously published rev:
ssh root@138.197.80.104 'cd /root/flightsim && bash deploy/deploy.sh --rollback'
```

`deploy.sh` publishes `origin/main` (checks out main, hard-resets to it), refuses a
dirty tree in every mode, and refuses to deploy if `cockpit/` changed *since the rev
currently published* without a `cockpit/sw.js` `CACHE_NAME` line change (same for the
root build) -- re-running after a refusal cannot slip the commit through. It records the
published and previous revs under `/var/lib/flightsim/` (survives reboots) and rsyncs an
allowlist -- only `index.html`, `manifest.json`, `sw.js`, `icons/`, `cockpit/` reach the
docroot. `--rollback` republishes the previous rev; `--no-pull` publishes the checkout as-is.

Branch flow: develop on `cockpit-3d`, merge to `main` to deploy; branch kept on origin.
Bump `CACHE_NAME` in the relevant `sw.js` whenever shipping asset/code changes so his
iPad's service worker refreshes (deploy.sh refuses to ship `cockpit/index.html`, `cockpit/js/`
or `three.min.js` changes without one). Adding a file under `cockpit/js/` means adding it to
both the `<script>` list and `cockpit/sw.js` ASSETS. The page reloads itself when a new worker takes over
while sitting on the menu, so the first launch after a deploy already runs the new code.

First-time provisioning on a fresh droplet: clone repo, copy
`deploy/nginx-flightsim.conf` into `/etc/nginx/sites-available/flightsim`, create
`/etc/nginx/snippets/flightsim-headers.conf` from the comment at the top of that file
(the security headers live there because nginx `add_header` is not inherited into
location blocks), symlink into `sites-enabled`, reload nginx,
`certbot --nginx -d flightsim.138.197.80.104.nip.io`.

## iPad install

1. Open the build URL in Safari (each build is its own PWA scope).
2. Share → Add to Home Screen.
3. Settings → Accessibility → Guided Access to lock him in.
