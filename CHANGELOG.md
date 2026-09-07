# Little Pilot — changelog

One paragraph per release, newest first. The service-worker cache name
(`cockpit/sw.js`) is the version: the iPad picks a release up on its next launch
from the runway menu.

Screenshots, recordings and per-release evidence are **not** in this repository.
They are generated locally by the scripts in `scripts/` and kept in the
gitignored `evidence/` folder; committing them is what took `.git` past 100 MB.

---

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
