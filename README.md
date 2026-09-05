# Little Pilot

A no-reading, no-failing flying (and now space-flying) game for a 4-year-old.
Two builds live side by side on one droplet, both installable as home-screen PWAs:

| Build | URL | Stack | Status |
|---|---|---|---|
| **Cockpit 3D** (primary) | https://flightsim.138.197.80.104.nip.io/cockpit/ | Three.js r128 (vendored) + DOM HUD, 19 plain scripts | Active development |
| 2D side-scroller | https://flightsim.138.197.80.104.nip.io/ | Canvas 2D, single file | Frozen |

The player-spec lives outside the repo. `CLAUDE.md` holds the working rules and
the ship checklist; this file describes the game.

## Design rules

- **Zero text** in either UI: icons, silhouettes and numbers only (the harness audits every DOM text node).
- **Nothing living is ever a target**: everything that can be shot, hit, exploded or shattered
  is a vehicle, machine or object (that is why birds are paper-plane squadrons). People are
  fine where nothing can happen to them: the astronaut in the station and on spacewalks.
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
| Gear button, bottom-left (planes) | Retract / extend the landing gear. Retracting is ignored while the wheels carry the plane. Distinct up/down icons, whirr/clunk, animated struts in chase view. **Landing with the gear up explodes** |
| Missile button, bottom-left above gear (planes, airborne; the rocket, during a meteor shower -- on a rocket it drops to the empty gear row, clear of the shared slot) | Fire a wing missile: explodes on terrain, structures, traffic planes and targets; sub-stepped so nothing tunnels; self-destructs with a pop at the end of its range (`missileLife` × `missileSpeed`; `missileCooldown` is the refire gap) |
| Stage button (rocket, same slot, orange, pulsing) | Drops the next stage. Only appears above each stage's altitude (see The rocket) |
| Satellite button (rocket, same slot, cyan) | As the capsule in space: pops the satellite out ahead of the nose; it unfolds its panels and drifts off blinking. One per stack |
| Parachute button (rocket, same slot, red) | As the capsule low in the air: the drogue, then the mains. Each only below its `chuteAlt`; they pop by themselves below `chuteAutoAlt`, so nothing needs pressing |
| Double-down / double-up chevrons, bottom-right (planes, airborne) | Step the set speed down / up one notch. Speed stays where he sets it -- no snap-back. Four steps (`TUNE.speedSteps`) |
| Destination cards (rocket, after the direction card) | Moon / Mars / Station: where the landing button aims in space. Always all three |
| Hatch button (rocket, same slot, cyan; docked at the station) | Floats the astronaut into the station; tap again and he flies himself back to the seat |
| Rover button (rocket, same slot, yellow; on the Moon / Mars) | Rolls the rover out; tap again and it drives itself back in. Throttle drives, stick steers |
| Drone button (rocket, gear row, gold; driven up to the Mars helicopter) | Flies the little Mars helicopter with the same **point-to-go** as the big one. In the air the icon flips to the rover: it is always the way back down |
| Runway button, top-left (airborne, off-approach) | **Landing button.** Planes: skip to final, aligned on the glide slope `skipOutDistance` out, gear down, speed step 1, 20-80 s to touchdown depending on the plane. Rocket, in space: **the go button** -- jump to a slow descent `skipOut` (220 m) above the chosen destination (its icon is on the button); once he is heading home, the runway icon: **deorbit** as the capsule (plasma and parachutes down to a new spot around home), or a thruster descent to the pad for a full stack. Lower down: 200 m above the home pad; the landing assist does the rest |
| Camera button, left column | Photo: white flash, shutter click, the shot appears in a polaroid frame for a few seconds |
| Plane button, top-left (parked at home, stopped) | Reopens the vehicle picker. It shares the top-left slot with the go button, so it stays away while he is docked, on a spacewalk or out in the rover -- there, that corner means "take me back" |
| Crosshair, centre (airborne) | Flight-path marker: where the plane is really aimed; doubles as the missile aiming point; clamps to the screen edge when off-view |
| White arrow at the screen edge | Bearing to the destination airport; hides within `homeIndicatorDistance` and when approach assists engage. In space (rocket) it points at the chosen destination, or at the pad once he is heading home, and hides while the target is in view |
| Route strip, top centre | Plane glyph slides NY <-> CA; dots fill in for landmarks passed (each one plays the next note of a scale) |
| Small amber arrow / green ring under the strip | Glide-slope cue on an engaged approach: down = too high, up = too low, green ring = on the slope |
| Two-plane icon under the strip | Wingman: dim while a traffic plane is near, bright when formation has been held |
| **Keyboard** | Arrows / WASD = stick (**up = nose up**), Space or Shift = throttle, G gear, V view, F or Enter = missile (rocket: drop stage / deploy satellite / parachute / rover out-and-back / drone out-and-back / hatch in-and-out, whichever is up), `+`/`-` or `]`/`[` speed step, L landing / go button, P photo, B or Esc = the vehicle picker (parked at home). A finger on the screen always wins over the keys |

Layout is token-driven (`--btn`, `--thr`, `--stack-bottom`, `--dash-h`, … in
`cockpit/index.html`). Viewports under 520 px tall (phones in landscape) get a
compact tier so nothing overlaps; the harness checks 844x390 for both a plane and
the rocket with its stage button up.

## Vehicles

Defined in `TUNE.vehicles` + `TUNE.vehicleColors`; the cockpit accent recolours per
vehicle via the `--veh` CSS variable. Nothing is shelved at the moment; the `hidden: true`
mechanism (the picker reads the flag at boot) is still there for anything that needs it.

| Vehicle | Cruise | Turn rate | Pitch limit | Notes |
|---|---|---|---|---|
| Prop plane | 60 | 18°/s | ±30° | Baseline feel; has gear |
| Airliner ×3 | 54 | 9°/s | ±25° | Big, heavy, slow-turning; liveries inspired-by Delta / JetBlue / Emirates (colour only); have gear |
| Fighter jet | 95 | 22°/s | ±38° | Fastest, tightest; has gear |
| Helicopter | 64 | 70°/s | n/a | **Point-to-go** (`js/heli.js`, `TUNE.heli`): touch a place and it flies there. The firefighter -- it carries the water bucket |
| Rocket | see `rocketTune` | 38°/s tilt | vertical launch | Its own flight model (The rocket below); no gear, no missiles. The `vehicles.rocket` entry only feeds the picker and dials |
| Starship | `rocketTune.starship` | 38°/s tilt (turnRateDeg 7 vs the rocket's 8) | vertical launch | Same flight model, one drop; the booster is caught by the tower's arms; the Ship lands on its engines |

Every non-rocket vehicle is ceiling-capped at `otherVehicleCeiling`.

## The helicopter -- tap to travel, then adjust height (`js/heli.js`, `TUNE.heli`)

Tap a place in the main view to fly toward it at the current altitude. The cyan
marker shows the destination (an edge arrow points toward it when off screen).
The destination stays fixed while the camera moves and after the finger lifts;
a new tap or drag changes it. A sky tap sets a horizontal destination in that
direction, without climbing.

The large **up/down arrows** on the right change altitude while held. Release to
hold the new height. Horizontal travel continues, so the same finger can steer,
lift, then adjust height. The **pause-in-a-circle** button stops travel in a hover.
Up lifts off from the ground; holding down lands gently. Over water it stops at a
safe hover floor so the bucket remains available. There is no throttle to hold.

Cruise is 64 units/s; acceleration, turning and braking are tuned together. It
slows near its destination and arrives in a hover. Approaching the fire keeps
the selected destination across the shoreline, all the way to the rig. Lower it
over scoop water with down, then tap the bucket to scoop; lift above the platform
with up, then tap to drop. Both bucket actions are single taps.

The Mars drone keeps its existing point-to-go controls and flight tuning.

## Airport toy world (`js/toyworld.js`, `TUNE.toyWorld`)

Each airport has three optional, reusable toys. The helicopter faces the colorful
construction yard when it spawns; planes and rockets keep their existing headings
and flight tuning.

- **Magnet yard:** hover near a loose block, toy car or container. A yellow ring
  previews the pickup; hovering close attaches it automatically. The red magnet
  hangs steadily underneath. Tap the magnet/down icon to drop. Move away before
  picking up again. Cargo can stack and jostle other cargo. Drop on the blue crane
  pad and the crane lifts it into a colorful toy robot, then returns a fresh piece
  to the yard. Forgotten cargo returns after a while. A full firefighting bucket
  stays a bucket; the two tools never operate together.
- **Plane wash:** the bubble/aircraft icon while parked guides the vehicle through
  the brushes, foam and clean sheen, then returns control. A helicopter can also
  land at the entrance. Large vehicles use an open spray area; rockets are washed
  on their pad. Physical entry exits beyond the brushes and waits for the next
  choice. The camera button also honks to nearby service trucks; they answer and
  briefly wiggle. Landing welcomes reuse the airport's carts and fuel trucks,
  staying clear of the runway and leaving as soon as takeoff starts.
- **Color clouds:** fly through a colored cloud to paint a trail, or through a
  rainbow for a multicolored one. Ordinary flying draws loops. Old strokes fade
  over 36 seconds; one fixed 1,200-point buffer bounds the trail cost. Clouds can
  be revisited as often as desired.

There are no activity scores, menus, deadlines or unlocks. Cargo, bubbles and
construction pieces are fixed pools; repeated details are instanced. The focused
runner is `scripts/toyworld_test.js` (same browser environment as the full harness);
its checks also run in `scripts/headless_test.js`. It writes `toyworld-magnet.png`,
`toyworld-wash.png` and `toyworld-rainbow.png` to `qa-screenshots/`.

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

There is no weather button any more (it made no sense to a four-year-old). The four looks are
still in the code (`SKY_MOODS`, `state.sky` 0-3), blend in over ~3 s, and the harness renders
the night one; the game itself always plays in the sunny mood:

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
fairing. It stands on the **launch complex** on the far side of the runway from the terminal
(`rocketTune.pad`, SLC-40 style): a concrete pad with a flame trench and deflector, the launch
mount it stands on (a solid top, so it can land back on it), the strongback beside it that
swings away at ignition, four lightning towers, a water tower and the integration hangar at the
base of the pad. The trucks wait by the pad; the deluge steams out of the trench through
ignition and liftoff. The landing button (lower down) aims for the pad; the deorbit comes down somewhere new.

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
  home, unless he is burning away the rocket brakes to `assistDescent` (a resting finger doesn't
  stop that) and stands itself upright -- but only as fast as `assistUprightRateDeg`, and only as
  far as it could gently manage in the time he has left. Coasting in from a long way out it turns
  him the whole way round, so arriving at the Moon nose-first still ends in a landing; on short
  final there is only room to tidy a lean. It never flips a rocket upright at the last second,
  and it stops helping the moment he steers.
- **The landing envelope**: a landing only counts if he arrives the way a rocket should -- nose
  within `landMaxTiltDeg` of vertical (engines down), coming down slower than `landMaxVspeed`,
  not sliding sideways faster than `landMaxHspeed`, and over somewhere a rocket lands: the pad
  (`landPadR`), a droneship deck (`landDeckR`), the catch tower (`landCatchR`), or anywhere on
  the Moon or Mars. Anything else -- nose-first, on its side, too fast, or out in a field --
  **crashes**: the full fireball, debris, a shockwave ring racing out across the ground and a
  boom, with the camera stepping outside for it in either view. It costs nothing, so crashing on
  purpose is its own thing to do. Under the parachutes there is no envelope: the canopies are the
  capsule's landing assist and it arrives wherever the wind took it. Docking keeps its magnet.
- **After a crash**: the pieces fly back together and, at home, the pad has a fresh stack standing
  on it a couple of seconds later (it asks where it is going, like any refit). Away from Earth he
  reassembles right there above the surface instead, so he can just try the landing again. Nothing
  is lost either way: satellites left in the sky stay up, sparkle spots stay lit.
- **On a planet**: fireworks, the sky stays black, the surface is "down" for the camera. You stay
  whatever you arrived as -- a capsule lands as a capsule and lifts off again on its thrusters.
  Rooftops at home are landable too.
- **Landing button** (runway button): in space, a slow descent 350 m above the nearest planet;
  after a planet visit, or lower down, 200 m above the home pad. Hides once the assist has him.
- **The satellite**: as the capsule in space (above `satAlt`, or with the space blend in) the
  satellite button appears once per stack. It pops out ahead of the nose with a hiss and a
  three-note beep, unfolds two blue panels over a couple of seconds and drifts off blinking
  (the last three stay in the sky). With it out, the landing button means *home*.
- **Coming home, Dragon style** (the capsule's own landing; the stack and booster still land
  Falcon-style on the thruster assist): the capsule in the air has blunt-body drag
  (`capsuleDrag`). Fast and below `reentryAlt` it trims heat-shield first and **glows** -- a
  plasma sheath on the model, an orange vignette over the window, a buffeting roar and shake.
  Below `chuteAlt[0]` the parachute button offers the **drogue** (auto below `chuteAutoAlt[0]`),
  below `chuteAlt[1]` the three red-and-white **mains** (auto again), descent eases to
  `chuteSink`, the stick drifts it `chuteDrift` m/s, the canopies sway and are visible overhead
  from the window. Touchdown on land or water: confetti, cheer, fireworks, splash if wet, the
  canopies collapse. It sits there as the capsule for `refitDelay` s, then the pad rolls out a
  new full stack with a chime (any Earth landing refits this way now, never instantly). The
  deorbit (landing button as the capsule in space) puts it at `gravityFade` + 500 m, falling,
  above a **new spot each time** -- a field or the sea 500-1200 m from home, never the runway
  or the pad -- so the whole show plays with nothing to press, and the refit still brings
  the new stack to the pad.
- **Launch flourishes**: through the ignite hold the pad's edge lights strobe faster and
  faster (his countdown, without a digit); at T-0 a white flash, a deep thump and a shockwave
  ring racing out across the pad. The booster makes a double **sonic boom** on its way back
  down. In the night mood (harness only, now that there is no sky button) the plume is a light: it
  paints the pad, the towers and the trucks orange. Through reentry the cockpit view leans over toward the horizon so the
  Earth's curve rolls under the glow.
- **Where things come down** (`js/recovery.js`): a **droneship** waits offshore of each
  airport -- a barge with a painted deck. A booster dropped while the stack was tilting toward
  the sea flies to it with its grid fins, hovers across, and lands on the deck with a horn;
  a straight-up launch's booster comes back beside the pad. The **fairing halves** pop small
  yellow chutes and drift to a **net boat**, which catches them with a splash. After the
  capsule's parachute landing the **recovery ship** (at sea) or a **flatbed truck** (on land)
  arrives, its crane swings out, lifts the capsule aboard and carries it toward the pad --
  that ride *is* the refit; a new stack is on the pad when it ends. Nothing teleports.
- **Destination**: a rocket on the pad always asks where it is going -- **Moon, Mars, Station**
  cards (after the direction card, on every launch from a restored session, and after every
  refit; `lp.dest` remembers the last one). It sets what the landing button aims at in space and
  where the big arrow points up there (it hides while the target is in view; on the way home it
  points at the pad). The flying is the same. All three are always there.
- **The station** is somewhere to go: it hangs above the gravity band with a glowing docking
  port on top. Coast at it and the port's magnet (`assistR` on the station's entry in `BODIES`, 140 m) noses the capsule in with a clang
  and a chime -- no speed to judge, no way to bounce off. Docked, the windows light and the solar
  arrays unfold (and stay out). Hold the throttle to undock: the capsule turns and backs away,
  and the landing button then means home.
- **Inside the station** (`js/station.js`): docked, the slot shows a hatch. Tap it and he floats
  through as **the astronaut** into a three-module interior -- handrails, lockers with glowing
  rings, blinking panels, a treadmill, sleeping bags, and the **Cupola** at the end with the
  Earth rolling past its windows. Zero g with the usual controls: hold the throttle to push off
  along where he is looking, drag to look / steer (drag up = look up), and he coasts until he
  bonks softly off the padded walls. Things to do, all pointing: nudge the four floating objects
  back into their lockers (a chime each, a fanfare for all four, then they float out again after
  `gateRearm`), fly into a yellow switch to light a module, drink the floating water blob. Tap the
  button again and he flies himself back to the hatch and into the seat; the capsule waits
  docked the whole time. Both views: the chase camera behind him, or his own eyes.
- **The spacewalk**: inside, the slot button becomes a spacesuit -- tap it (or float into the red
  **airlock** ring in module three) and he is outside the real station in his suit and
  gold-visored helmet (inside he is in a polo shirt), on a glowing **tether**
  (`EVA.tether`, 60 m) that reels him gently back if he drifts past it, jets puffing when he
  pushes, the station's core bumping him softly. Three jobs, all pointing: fly into the glowing
  orange **battery** on the truss and a fresh one slides in (the windows light), bump the
  **stuck solar array** and it unfolds, and catch the drifting **wrench** (it always drifts back
  toward him) -- it clips to his belt. Outside, the slot button reels him straight back to the
  airlock and inside (it steers his speed at it, so it can never circle or get stuck). The
  top-left **go button** shows the capsule the whole time he is out of the seat: from inside or
  outside it takes him all the way back to the seat (and the vehicle picker keeps out of that slot
  while he is out there, so it can never eat the tap). The reel-in routes *around* the station
  core rather than straight through it -- the airlock is on the core's side, so from behind the
  station a straight pull only pressed him against the wall -- and past `EVA.returnMaxTime`
  nothing keeps him out at all. He is never stuck. Both views again.
- **The stack**: the satellite button releases the big satellite and then five flat Starlink-style
  ones, one every 0.9 s with their own beep, fanning out in a line of blinking lights.
- **Mission photos**: the camera in the rocket frames the shot as a round mission patch.
- **The rover** (`js/rover.js`): landed on the Moon or Mars, the slot button shows a buggy.
  Tap it and a yellow rover rolls out of the capsule; like everything else, **hold the throttle
  to go** and **drag left / right to steer** (drag down backs up slowly) on the curved ground,
  hopping over bumps in the body's own gravity with a thump. Eight **glowing rocks** lie around
  the landing site: roll over one and it chimes a note, sparkles, and leaves a **blinking beacon**
  with a flag where it was. Tap the
  button again and the rover drives itself back and climbs in -- nothing to line up -- and the
  rocket is ready to launch. Rocks and beacons come back fresh with the refit. Both views work
  (a seat on the rover, or the chase camera behind it).
- **Starship**: a second rocket card (silver). Same pad, same buttons, one drop: the Super Heavy
  booster above `starship.stageAlt`, leaving the **Ship** (black tiles, four flaps). Launched
  straight up, the booster flies back to the **catch tower** beside the pad and the two arms close
  on it with a clang -- it hangs there until the next launch; tilted seaward it goes to the
  droneship like the Falcon booster. The Ship deploys satellites, docks, carries the rover, glows
  on reentry, and lands on its engines on the assist (no parachutes); it refits like the Falcon.
- **Rover toys** (the driving is the game): three **ramps** on the crater rims -- drive over one
  fast and it is a big low-g jump with a whoop; a patch of **soft sand** where the wheels spin and
  dust flies until he wiggles the stick left-right (or it pops him out by itself after a few
  seconds -- nothing is ever stuck); three **boulders** to shove, which roll off and thud into
  one of two craters with confetti; and the camera button **honks** while driving. Plus the
  glowing rocks and their beacons. At the station, **three glowing rings** hang stacked above
  the port: the go button drops him at the top of the line, fly down through all three (a note
  each) and the docking clang becomes a fanfare with fireworks.
- **Pace**: the go button drops him `skipOut` (220 m) out at 30 m/s; the deorbit starts at
  `deorbitAlt`; drogue and mains open at `chuteAutoAlt` and sink at `chuteSink`; the recovery
  ride is ~8 s and the refit `refitDelay`. A Moon landing from the button is ~10 s, a docking
  ~12 s, the whole way home under a minute.
- **The go button** (top-left, in space) shows **where it will take him**: the Moon, Mars or the
  Station icon in cyan while that is the destination, the runway once he is heading home (after
  a landing on a body or a docking). Deploying the satellite does not change the route.
- Both views work: the cockpit looks along the body axis, the chase camera sits beside and
  above and never enters a planet. **The rocket starts in the chase view** (the view button
  still toggles).

## Set-pieces (`js/setpieces.js`, `TUNE.demolition` / `TUNE.towerCatch`)

Big staged moments out in the world. Every one runs the same loop: **a giant obvious thing ->
one aim or one pulsing control -> a visible wind-up -> a huge payoff -> a free reset that comes
round on its own**. Nothing here can be failed; a miss just means turning round and going again,
with no message and no sound of disapproval. Only structures and machines are ever wrecked.

Every bang is **announced**. A four-year-old is thrilled by a boom he saw coming and frightened
by one he did not, so nothing detonates without a build-up first: beacons hurrying, a rumble
climbing, and a **big numeral** counting down. Numbers are allowed in this game; words are not.
The numeral (`#bigNum`) is shared by every set-piece and is on screen *only* while a wind-up is
running -- the HUD gains nothing permanent.

- **Demolition district** (planes, mid-route at `x` / `f` on dry ground, well clear of both
  approach corridors). A fenced block of condemned towers -- hoarding, hazard beacons, boarded
  windows -- with a big pulsing reticle on the tallest one. Put a missile anywhere in the block
  (`hitR` is generous: he is four) and it winds up for `charge` seconds -- beacons hurrying, dust
  lifting, 3-2-1 -- then the towers fold one at a time in a domino chain, `foldDelay` apart, each
  with its own dust burst and thud. The fold is choreographed, not physics, and a folding tower
  stops being a wall the moment it starts going (`noSolid`), so nothing invisible is ever solid.
  `rebuild` seconds later the whole block stands itself back up and the reticle pulses again.
  The crash alarm is silenced inside `alarmMuteRadius`: flying straight at those towers is the
  point of the place, and the numerals are its only lead-in.
- **Firefighting helicopter** (`TUNE.firefight`). A derelict rig burns on open water off the
  California coast -- **nobody aboard, ever** -- under a smoke column you can see from the shore.
  The helicopter is back off the shelf for it, with a flight model of its own. It is about half a
  minute out from the California coast -- close enough that you can see the airport from the fire.
  Fly low over open water and one button pulses:
  **SCOOP** (the bucket lowers on its line and fills, with a slosh). Over the fire the same button
  becomes **DROP** (the icon swaps) -- a sheet of water, steam, a hiss, and the flames visibly
  shrink. Three of them put it out. It relights itself `relight` seconds later, announced by a
  glow first, so the flames never simply reappear. Whooshes and hisses; never a siren.
- **Aircraft carrier** (`TUNE.carrier`). A grey slab of a ship off the same coast, with parked
  jets, a helicopter spot aft, and a **deck crew who wave and to whom nothing can ever happen** --
  never solid, never a target, never removed. Come in low along the angled deck and the hook takes
  a wire: a violent stop, a cheer, and the crew spot him on the catapult with its light green.
  One button then pulses: it counts **3-2-1** and throws him off the bow. Miss and nothing at all
  happens -- he flies over the deck and comes round again. The other jets launch themselves off
  the second catapult, each with its own countdown light. The deck is deliberately not a solid
  and the crash alarm is quiet nearby: a near miss must never be an explosion.
- **Mars base** (`TUNE.marsBase`). Landing on Mars used to be a patch of red ground with eight
  glowing rocks on it. Now it is somewhere: glass domes, antenna masts, a rover garage, a row of
  Starships already standing there, red dunes, and tiny astronauts to whom nothing can ever
  happen. It is built around **wherever he comes down**, with the lit pad drawn as a ring on the
  ground about the rocket itself -- so he always lands in the middle of the base, and the whole
  thing needs no new control at all. Shortly after he starts driving, a light appears on the
  horizon and big numerals count down a **cargo Starship**, which comes down under power beside
  the base -- engine glow, dust wash, legs deploying, a thump -- and stays for the visit. To go
  home he simply **drives back onto the lit pad**: the rover parks itself, the pad counts him
  down, and his rocket lifts off (the pad keeps his throttle in for `boost` seconds, or Mars just
  pulls him straight back down). The Moon is left exactly as it was.

  And out there, three things to *do* -- all Mars-only, all of them free to redo for ever:

  - **Dune jumps** (`TUNE.marsBase.jumps`). Four sculpted ramps out on the dunes past the base,
    each marked by a big amber ring standing over its lip, tipped back along the slope -- the
    pad's own language, so they read as "come through here" from a long way off. Drive up one
    with any speed on and it throws the rover into the air, tumbling, for about four seconds of
    Mars hang time; where he points the nose is the whole skill. It comes down in a burst of
    rust dust, and if it came down well off level it rolls right over -- and picks itself up in
    about a second. Nothing is lost, nothing is scored, and the next ramp is right there.
  - **The boulder field** (`TUNE.marsBase.boulders`). Loose rock scattered in among the domes,
    plus three stacked cairns. Shove one and it rolls off along the ground, knocks the next one
    on, and brings a cairn down in a heap. Hot Wheels physics: cheap, satisfying, and the whole
    field stands itself back up the moment he drives away and comes back.
  - **The Mars helicopter** (`TUNE.marsBase.drone`). A little Ingenuity-style drone parked beside
    the garage. Drive up to it and one gold button comes up; tap it and he is flying it -- with
    exactly the **point-to-go** control the big helicopter has, so there is nothing at all to
    relearn. Touch a dome, the cargo Starship, a dune ridge, and it turns and goes there and
    hovers over it. **Touch the rover** and it comes home, settles beside it, and he is driving
    again. The button is the same way down from anywhere, so he can never be stuck up there.
    No missiles, no job, no way to fail. The rover simply waits where he left it.
- **Booster tower-catch** (Starship). The tower and its arms already existed; this is the theatre
  around them. As the booster comes down the arms swing **wide**, the catch zone lights up, its
  engines burn under it and big numerals count 5-4-3-2-1 off its closing rate. Inside `catchR`
  the arms shut with a heavy clunk, the engines cut, and it hangs there swaying while the tower
  lights sweep and the boats sound off. Outside `catchR` it goes bang instead -- a machine, and
  free -- and the tower re-arms for the next launch. A caught booster hangs there as a trophy
  until the next T-0, when the arms let go of it and it is taken away, so two boosters can
  never be on the tower at once.

## Space events -- every launch, one big thing happens (`js/events.js`, `TUNE.events`)

Every rocket launch the game secretly draws **one** of six events -- never the same one
twice in a row (`lp.lastEvent`) -- and stages it in its phase of flight. They are huge,
loud and self-announcing: there is nothing on the HUD that points at one, and nothing to
press to start it. An event is never required, never blocks and can never be lost --
ignored, it simply does not happen this flight. Only machines and rocks are ever burst.

Only a real liftoff arms the draw, and picking the destination redraws against it (so a
Mars or station flight never gets the Moon's impacts). Everything an event puts in the
world goes away when the pad rolls out the next stack.

| Event | When | What happens |
|---|---|---|
| **Race to orbit** | ascent | Seconds after liftoff a second rocket lights up beside him -- full plume, its own rumble, its own visible staging -- and climbs alongside the whole way. It is rubber-banded to his own camera, so the two of them go up side by side however he flies; there is nothing to win. High up it stops burning and parks in a nearby orbit, glinting |
| **Meteor shower** | orbit | Glowing rocks stream past on shallow, slow trajectories with sparkle trails and whooshes. The rocket has no missiles -- except here, where the plane's unused missile slot comes up so they can be shot. A missile fired at a rock bends onto it (`lock*`), so aiming the nose at one is enough: no leading, no timing. Each one bursts into glittering tumbling chunks with a note. Flying into one bursts it too, and a rock can never hurt him |
| **Comet flyby** | orbit | One enormous comet, its tail stretching across the sky, crosses his orbit. Flying through the tail is a full-screen sparkle rush and coats the rocket in glitter that rides along until recovery. Nothing to shoot: the size is the event |
| **Meteor impacts** | Moon surface | While he is out in the rover, meteors streak in and **thump** down nearby -- dust plume, screen rumble -- each leaving a glowing crater for the rest of the visit. Driving into a glowing crater bursts it. Moon only; a Mars flight draws from the other five |
| **Shooting-star escort** | reentry | Through the plasma phase a spread of meteors reenters alongside, burning up around the capsule and going out by themselves. His fireball is one of many |
| **Fireworks welcome** | recovery | On splashdown or landing the recovery ship fires a full barrage over the site, reflections on the water included. Pure payoff, nothing to press. The whole show fits inside `refitDelay`, so an upright landing at home gets all of it too |

Every number is under `TUNE.events` (counts, sizes, speeds, distances, volumes), plus
`eventChance` -- how often a launch draws an event at all.

## Photo

The camera button (or `P`): white flash, shutter click, and the pure 3D frame (no HUD)
appears in a polaroid frame for three seconds. It captures the frame just drawn, so it
costs nothing until pressed.

## Persistence (`localStorage`)

`lp.vehicle`, `lp.dir` (relaunch goes straight to the runway), `lp.dest` (moon / mars / station; a stale `lp.sky` is removed),
`lp.spots` (which sparkle spots are lit; reset when all are found or the count changes),
`lp.lastEvent` (the space event the last launch drew, so the next is never the same; a corrupt value is ignored).

## Tuning

Every gameplay number lives in `TUNE` (`cockpit/js/tune.js`); the rocket's in
`TUNE.rocketTune`. The flight-feel numbers were tuned with the kid -- don't retune them.
Landing-assist strengths (`align*`, `touchdown*`, `flare*`, the rocket's `assist*`) may be
weakened gradually as he improves. `routeLength` scales the whole continent.

## Repo layout

```
CLAUDE.md             working rules + ship checklist
cockpit/
  index.html          markup + CSS shell (~900 lines); loads js/ in order
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
    heli.js           the helicopter: point-to-go (touch a place, it flies there and hovers)
    rocket.js         rocket flight model, staging, Moon / Mars, landing assist, satellite, reentry + parachutes
    recovery.js       droneship, net boat, recovery ship / truck and the ride that refits the pad
    rover.js          the Moon / Mars rover: drive on the sphere, rocks, beacons, drive-back
    station.js        the station interior and the astronaut in zero g
    events.js         space events: the per-launch draw and all six of them
    setpieces.js      set-pieces: the demolition block, the tower-catch theatre,
                      the burning rig and its bucket, the aircraft carrier
    marsbase.js       the Mars base, its cargo Starship, the pad that flies him home,
                      and the things to do out there: dune jumps, the boulder field, the drone
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
~45 s on an M-series Mac, and prints its check count (159 today, one of them the whole station visit). It refuses to start if
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
keys) · persistence across launches · the rocket (launch complex + strongback + deluge, altitude-gated drops, booster landing,
Moon landing + relaunch + staging afterwards, Mars coast-in and powered ram, landing button,
Earth landing + delayed refit, fuel-out and apron trucks, satellite deploy, deorbit, reentry glow + overlay, drogue/mains gating and auto-pop, soft chute landing) · recovery (droneship landing, pad-side landing, fairing catch, ride + refit) · claimed feel effects (cloud whoosh, missile
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
