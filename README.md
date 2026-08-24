# Little Pilot

A no-reading, no-failing flying game for a 4-year-old. Two builds live side by side
on one droplet, both installable as home-screen PWAs:

| Build | URL | Stack | Status |
|---|---|---|---|
| **Cockpit 3D** (primary) | https://flightsim.138.197.80.104.nip.io/cockpit/ | Three.js r128 (vendored) + DOM HUD | Active development |
| 2D side-scroller | https://flightsim.138.197.80.104.nip.io/ | Canvas 2D, single file | Frozen |

Zero text anywhere in either UI — icons, silhouettes and numbers only.
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
| Runway button, top-left (airborne, off-approach) | Skip to landing: places the plane aligned on the glide slope `skipOutDistance` from the destination, gear auto-extends, ~45-60 s out |
| Crosshair, center screen (airborne) | Flight-path marker -- shows exactly where the plane is aimed, including climb/dive; doubles as the missile aiming point. Clamps to the screen edge when the aim is off-view |
| White pointer arrow at screen edge | Points along the horizontal bearing of the destination airport; hides within `homeIndicatorDistance` or whenever approach assists engage |
| Route strip, top-center | Plane glyph slides NY<->CA as he flies; dots fill in for landmarks passed |
| Plane button, top-left (on the runway, stopped) | Reopens the vehicle picker. The last vehicle + direction are remembered (`localStorage`), so a relaunch goes straight to the runway |
| **Keyboard** (desktop) | Arrows / WASD = stick (**up = nose up**), Space or Shift = throttle, G gear, V view, F or Enter missile, `+`/`-` (or `]`/`[`) speed step, L skip-to-landing. A finger on the screen always wins over the keys |

## Rewards (things that go "ding")

Nothing here can be failed or lost; every one re-arms.

- **Ring eating** -- fly through a landing ring and it turns green and plays the next note of a rising scale (`ringNotes`); land after eating three or more and the scale resolves into a chord. The rings sit exactly on the glide slope, so they *are* the landing instruction.
- **Auto-flare** -- on an engaged approach below `flareAgl` the nose levels off regardless of the stick and the plane settles at `flareSink`. He can't arrive nose-first or tail-first. The last 300 m before the threshold (the flattened pad) never explodes on terrain when lined up with gear down.
- **Touchdown** -- plane squashes, tyre puffs, the centreline rails pulse bright.
- **Gates** -- gold hoops under every suspension bridge, inside the canyon, and one riding with the locomotive. Fly through: fanfare + sparkle, the hoop turns green for `gateGreenTime`, re-arms after `gateRearm`.
- **Wingman** -- fly within `wingmanDist` of a traffic plane for `wingmanHold` seconds: the two-plane icon at the top lights up, then sparkles. Cooldown `wingmanCooldown`.
- **Cloud whoosh** when passing through a cloud; runway rumble and a rolling-tyre noise on the ground that cuts at liftoff; the chase camera lags and leans into banks.

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

Shelved behind `hidden: true` in `TUNE.vehicles` (defs intact, one flag to
re-enable -- the picker reads the flag at boot): helicopter (hover) and rocket (space access). Space content is
dormant while the rocket is shelved; every other vehicle is ceiling-capped.

Cockpit overlay accents recolor per vehicle via the `--veh` CSS variable.

## The route: New York <-> California

`TUNE.routeLength` (default 12000 units ≈ 3.5 min each way at cruise). Airports sit
at ±routeLength/2 with flattened-terrain runway rects plus a flat apron `apronWidth`
wide beside them. Each airport is a full complex on the side away from the city
(NY east, CA west): apron and taxiways with yellow centrelines, a terminal with
three jet bridges and three parked airliners at the gates, a control tower with a
blinking beacon, two arched hangars, fuel tanks, a spinning radar dish, a windsock,
and runway edge/threshold lights. Buildings and parked planes are solid. Nothing
else stands within ±700 m of a runway centre (the NY harbour/bridges/skyline and the
CA bridge were moved ~1 km out so they no longer cross the runway or the apron). Landmarks are placed at fixed
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

## Space (rocket only)

Above `spaceAltitude` (900 AGL) blended over `spaceBlendBand`: sky/fog lerp to
night, stars fade in, Earth curve below, astronaut + station props mid-route.
Other vehicles are hard-capped at `otherVehicleCeiling`. Dive back down returns
automatically.

## Crashes & collisions

- **Any impact explodes** -- terrain, water, structures, at any speed or angle: fireball, debris, camera shake, boom, plane reassembles ~2 s later (`reassembleDelay`) at safe altitude with a "boing" pop. A smoke column rises from the crash for ~8 s and a crater stays for `craterFade`. Zero penalty, repeatable forever. (The old shallow-skim bounce is gone -- he asked for realism.)
- Structures are solid AABBs (`resolveSolidWalls`): instanced town buildings, landmark towers/decks/silos/casinos/downtown, bridge decks, train cars. Wall hits shatter *both* sides -- nearby structure pieces hide into the debris cloud and restore after `shatterRestoreDelay` on their own timer, longer than the plane's reassemble, so the damage is visible (a missile-shattered building never lingers as an invisible wall). Hidden pieces are never solid. Walls and mid-airs stay live during a go-around.
- **Gear-up landings explode.** Touchdown tolerances (`touchdownLatTolMult`, `touchdownHeadingTolDeg`) still generous, but only with gear down.
- **Traffic planes**: six AI airliners cruise the route in both directions (`trafficCount`). Shoot them with missiles or fly into them -- both explode on contact; they respawn elsewhere after `trafficRespawnDelay`. Mid-air collisions cost him nothing, same as everything else.

## Tuning

Every gameplay number lives in the `TUNE` object at the top of the inline script
in `cockpit/index.html`, grouped: flight feel (do not retune -- tested with the kid),
takeoff/rotation, landing-assist strengths (weaken these gradually as he improves:
`align*`, `touchdown*`, `autoThrottleResponse`), explosions, space, route/scenery,
HUD/home indicator, audio, vehicles, rewards & feel (ring notes, flare, gates,
wingman, alarm, keyboard ramp). Changing `routeLength` stretches the whole
continent -- landmarks and zones derive from route fractions, nothing needs rebuilding.

## Testing

`scripts/headless_test.js` drives the real game in headless Chromium (SwiftShader WebGL)
(it prints the check count at the end): HUD layout in both orientations, zero-text DOM audit, takeoff
(with and without input), sloppy-approach landings, go-around, deliberate repeatable
crashes (every impact explodes, shallow skims included), all five visible vehicles plus the shelved rocket, full route both directions timed
150–290 s, rocket round-trip to space, non-rocket ceiling, solid-wall shatter,
view toggle, gear cycle (up/down icons), persistent speed stepper (set-and-stays), aim crosshair, glide-guidance arrow, chase-cam ground alignment, missile firing + shootdowns + ground impact + no-tunneling, traffic presence + mid-air collision, skip-to-landing end-to-end, strip behavior, SW/manifest reachability for both builds, and
world-integrity regressions (no flattened ribbon along the route, train moves, beacons are
live meshes, every wall face reassembles on the near side with finite coords,
missile-shattered pieces self-restore, deep water crashes), rewards (rings eaten + hands-off flare
landing, gates fire once then re-arm, wingman, crash smoke/crater, alarm on a dive and silent on
approach, keyboard takeoff and controls, remembered vehicle restored on relaunch), and a visual
regression pass: four fixed scenes are rendered and reduced to 24x14 grey hashes compared against
`scripts/visual_baseline.json` (mean pixel diff < 14/255). Re-baseline deliberately with
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

# rollback (--no-pull is essential: without it deploy.sh pulls main again):
ssh root@138.197.80.104 'cd /root/flightsim && git checkout $(cat /tmp/flightsim-previous-rev) && bash deploy/deploy.sh --no-pull'
```

`deploy.sh` always publishes `origin/main` (it checks out main and hard-resets to it),
refuses a dirty tree, and refuses to deploy if `cockpit/index.html` changed without a
`cockpit/sw.js` `CACHE_NAME` bump (same for the root build). It rsyncs an allowlist --
only `index.html`, `manifest.json`, `sw.js`, `icons/`, `cockpit/` reach the docroot.

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
