# Little Pilot — changelog

One paragraph per release, newest first. The service-worker cache name
(`cockpit/sw.js`) is the version: the iPad picks a release up on its next launch
from the runway menu.

Screenshots, recordings and per-release evidence are **not** in this repository.
They are generated locally by the scripts in `scripts/` and kept in the
gitignored `evidence/` folder; committing them is what took `.git` past 100 MB.

---

## v92 — a real Model Y and a real F-35

The car and the fighter are no longer built out of boxes and lofted panels: both
are imported models, decimated hard and rebuilt to fit the exact box the
hand-built bodies occupied, so the collision box, the spawn origin, the camera
anchors and the interior offsets all keep working untouched.

| | triangles | file |
|---|---|---|
| car | 346,278 → 23,997 | 11.0 MB → 0.71 MB |
| fighter | 1,240,064 → 22,000 | 89.9 MB → 0.25 MB |

`scripts/build_models.js` does the processing offline: it throws away every
original material and texture and bakes the whole model into a six-colour
palette — body, glass, tyre, trim, lamp, tail — so the imports look like they
were made for this game rather than dropped into it. The body is stealth grey at
`metalness: 0.10`; the first attempt used a realistic 0.55 and rendered the car
almost black, because a metallic material with no environment map has nothing to
reflect and loses its diffuse term. The fighter would not decimate at all until
its normals were stripped first: per-face normals gave two vertices per triangle,
so welding connected nothing and the simplifier quietly ignored the ratio.

Both models imported tail-first. That was settled by measuring the taper at each
end in the model's own frame, not by looking at renders — two rounds of looking
had already got it wrong.

The four wheels turn. The build joins primitives by material, so all four arrive
as a single mesh with the rims mixed into the body, and nothing in the file names
them. They are found by geometry instead: the tyre material's triangles fall into
four corner clusters, each cluster defines a cylinder about the axle, and every
triangle in the whole model that lies inside one — rims and brake discs included
— is moved into that wheel's group. Capture tests the whole triangle and the
cylinder is never fatter than the tyre that defined it, so the arch above the
wheel stays on the body and no hole opens up. The harness measures the tread that
passes under each wheel against the ground the car actually covers.

Loading is asynchronous and the game never waits for it: until a model arrives
the vehicle keeps its built geometry, and a missing or broken file is a cosmetic
downgrade rather than a broken game.

### Credits

The two imported models are third-party work, used under their licence and
processed as described above:

- "2026 Tesla Model Y Performance" by BloxBloger, CC BY-NC 4.0, via Sketchfab —
  https://sketchfab.com/3d-models/2026-tesla-model-y-performance-8a0bc252f9da4015a02a7bd99efd4847
- "F35 fighter Jet" by Spentza_93, CC BY-NC 4.0, via Sketchfab —
  https://sketchfab.com/3d-models/f35-fighter-jet-084369d3fddc480080cfb05364d75a46

Both are **CC BY-NC 4.0** — attribution *and* non-commercial — which is what the
`asset.extras` block inside each GLB records, not the plain CC BY they were taken
for. Little Pilot is free and carries nothing commercial, so the NC term is met;
the attribution above is the BY term. The raw downloads are not in this
repository (`models-src/` is gitignored); only the processed 1 MB of geometry is.

## v91 — the car no longer drives underground

Driving over changing ground dropped the car through the road. Three separate
causes, all fixed: the support surface snapped between the road deck and the
terrain the instant he crossed the shoulder, and those are up to 17 m apart on
an embankment, so it now blends across the shoulder and a high deck has a
guardrail that actually holds him. The nearest-point search on the road bisected
by z and then looked six samples either side, which returns a point from the
wrong stretch wherever the road curves — it is an exact search now, and the
height is interpolated along the segment instead of snapping to the nearest
sample. And the exit spurs started at ground level rather than at the height of
the carriageway they leave, putting a five-metre step at every junction. Worst
case measured across a full coast-to-coast run: 7.12 m below the road, now
0.14 m. There is a harness check for it.

## v90 — the car and the coast-to-coast highway

A stealth-grey electric SUV and a real divided highway from the New York airport
to the California airport, so he can drive between his two cities instead of
flying. Inspired-by only: the silhouette, the paint, the glass roof and the light
bar — no badge and no wordmark anywhere, the same rule the airline liveries
follow.

The road is a spline through control points chosen to pass what he already
knows: out over the harbour, past the mid-route city, along the lake shore,
across the plains, through the mountains, over the canyon, down the desert and
into the coast city. **The bridges and the tunnel are not authored.** The height
profile is graded and slope-limited the way a real road is surveyed, and
wherever the graded road ends up well above the ground it becomes a bridge on
piers, and wherever the ground ends up above the road it becomes a tunnel: 800 m
of bore through the mountain and 3.7 km of bridge, all emergent. Exits lead to
short spurs, announced by big blue boards carrying one icon and no letters, and
two of them have charging canopies. A stacked interchange at each city end is
solid, so an aeroplane can fly into one and go bang like anything else.

One finger drives it: finger down to go, drag to steer, drag up for an EV shove.
Lane-keep is pure pursuit — it aims at a point on his lane a second and a half
ahead — so holding a finger down with nothing steered drives the whole 12.5 km
in about four and a half minutes without once leaving the road. Steering
dominates the assist rather than switching it off, which is what makes holding a
steer at an exit take the exit and then follow the spur. Off-road is bumpy,
dusty and slower, and the assist walks him back to the road within six seconds
of letting go.

## v89 — the rover steered backwards

Drag right turned the rover's nose left, and had done since it was built. One
sign in `rover.js`: `turn` is applied as a negative rotation about the surface
normal, so negating the stick on top of that inverted it. The auto-return path
was always correct and is untouched. The Mars drone, the helicopter and the
aeroplane were all checked and were already right. There is now a shared
steering check that measures accumulated signed rotation for every vehicle that
can be steered — the car will inherit it.

## v87 — toy-world and fleet visual polish

The helicopter got a smooth two-tone shell, broad opaque glazing, metal
supports, rubber skids grounded on their own geometry, contrasting rotor tips
and a moving tail rotor, with main-rotor spin and blur easing between idle and
flight. Toy cargo, the magnet and the machinery lost their hard edges, and the
car cabin now meets the attachment height exactly. The mat gained a smoother
perimeter, a procedural surface, a painted landing symbol and docking marks. The
rest of the fleet — aircraft, rockets, rover, drone — was brought to the same
finish. Attachment bounds and all flight and collision tuning are unchanged.

## v85/v86 — the workshop, the musical garden, robot greetings and playful ejection

A single delivery now builds a whole robot rather than needing twelve, and it
dances; repeats change its colours and arm poses, and the crane swings its boom
aside so the payoff stays visible. Once it has finished dancing, flying near it
makes it turn and wave — hovering stays calm, and leaving and returning re-arms
the greeting. A loading ramp arrived with its own demonstration ball: drop a toy
into the big yellow cup and it slides onto the crane pad. Three oversized
pinwheels play a gentle note each when the helicopter comes near, needing no
cargo or construction first. Alongside it, every picker vehicle and both surface
vehicles got a rescue seat: tap the seat-and-arrow button and the hatch opens,
the seat springs clear, a canopy unfolds and the pilot lands safely before
returning to a fresh machine. Helicopter and drone rotors stop and fold first;
space rescues use a thruster canopy and an assisted descent, so he can never
fall for ever. No new vehicle, button, score, deadline or unlock.

## v80 — helicopter steering and magnet pickup fixes

Steering and the magnet pickup were corrected following an audit of the toy
world, and verified on the deployed revision with a live cache check.

## v79 — iOS Safari can no longer zoom the page

`user-scalable=no` has been ignored by iOS since iOS 10, so the fix is in JS
(`cockpit/js/nozoom.js`, loaded first). Safari's pinch arrives as
`gesturestart`/`gesturechange`/`gestureend` and is refused; so is any touch with
more than one finger, and any `touchend` within 300 ms of the last one, which is
what double-tap zoom actually is. All of it is `passive: false, capture: true`.
It is safe only because the game reads pointer events and nothing else. The
system accessibility magnifier sits above the browser and cannot be blocked by
any page.

## v75 — polish pass 6: camera and feel

Field of view opens with speed and punches briefly on a catapult shot or a
lift-off; the chase camera breathes; shake became a decay curve rather than a
ramp, hard-capped so a bang can never hide what he is aiming at. A solid hit
freezes the model for a couple of frames while the flight model carries on.
Landings get a nod and a settle. Speed streaks in the cockpit only.

## v74 — polish pass 5: sound

An ambient bed per environment, crossfading: quiet on the ground, wind aloft
that grows with speed and height, rotor wash in the helicopter, cabin hum in the
airliner, near-silence with a slow breath in space, dust wind on Mars, and
almost nothing on the airless Moon. Big events became stacks rather than single
samples — an explosion is bang, crackle, debris tinkle and a low rumble tail.
World events got stereo placement and distance falloff.

## v73 — polish pass 4: ambient life

Bird flocks over the coast and lake in one instanced draw call, peeling away
before he reaches them; they are not targets, not solids, and a harness check
parks the aeroplane inside a flock to prove nothing can happen to them.
Airliners at cruise with contrails, a flag on the carrier masthead and the Mars
mast, a turning radar on the rig, and dust drifting on Mars.

## v72 — polish pass 3: art consistency

The sea stopped being a flat blue plane: one quad with a scrolling normal map, a
real specular sun path, world-anchored so it does not slide with the aeroplane,
and ripple strength fading with altitude — at full strength from height the
specular turned the whole sea to white static. Coastal foam in vertex colours. A
canonical palette of 21 colours with 104 near-duplicate literals snapped onto
it. Flat shading defaulted at the material constructors. Runway edge and centre
lines.

## v71 — polish pass 2: atmosphere

A sun disc with a warm halo and a cockpit-only lens wash, per-body haze (dusty
pink on Mars, a knife edge on the airless Moon), a drifting cirrus sheet,
twinkling stars in one draw call, and additive glow on engines, fire,
explosions, the pad ring and runway edge lights. No post-processing stack: on an
iPad a full-screen bloom costs more than every glow in the game together.

## v70 — polish pass 1: lighting

One directional sun at a real angle with a hemisphere fill, and soft shadows on
the vehicle, rover, drone, landmarks, base, carrier and rig. Per-environment
moods that crossfade. The shadow box resizes to the scale he is working at,
because one box cannot resolve both an airliner and a three-metre rover, and
shadow receiving is switched on per mesh only for the terrain inside it.

## v69 — Mars: things to do

Four ringed dune ramps that throw the rover into about four seconds of Mars air,
tumbling, landing in a dust burst and righting themselves if they come down
badly. A boulder field with three stacked cairns that scatter and stand back up
when he drives away and returns. A little Ingenuity-style drone parked by the
garage: drive up, one tap, and he is flying it with exactly the same
point-to-go as the big helicopter. Touch the rover and it comes home and lands
beside it.

## v68 and earlier

The Mars base, the five set-pieces (demolition district, booster tower-catch,
firefighting helicopter, aircraft carrier), the helicopter's point-to-go
control, the space events drawn once per launch, the rocket landing envelope,
the spacewalk and station interior, the rover and its toys, and the original
flight model, route, landmarks and vehicle picker. See `git log` for the detail;
each release is a merge commit on `main` with a full message.
