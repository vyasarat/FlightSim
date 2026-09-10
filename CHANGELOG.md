# Little Pilot — changelog

One paragraph per release, newest first. The service-worker cache name
(`cockpit/sw.js`) is the version: the iPad picks a release up on its next launch
from the runway menu.

Screenshots, recordings and per-release evidence are **not** in this repository.
They are generated locally by the scripts in `scripts/` and kept in the
gitignored `evidence/` folder; committing them is what took `.git` past 100 MB.

---

## v103 — three more things at sea

The harbour is the third place he can lose a whole session in, after the toy
world and the space programme, and five things to find out there was not enough.
The pool goes to eight. All three of the new ones obey the same rules the first
five do — never required, never blocking, never takes anything away — and none
of them is announced on the HUD.

**A seaplane** comes in over the breakwater, puts down on the water in a sheet of
spray, taxis, turns, and opens up and goes again. The touchdown is its one hero
effect, and its engine is audible from a long way out, so it is never something
that simply appears.

**A submarine** boils the water first — the wind-up, because nothing this big
arrives in this game without announcing itself — then comes up out of it with the
sea sheeting off her casing and a klaxon, runs on the surface for a while, and
goes down again.

**A fireboat** lies moored off the terminal and every so often puts on a display:
a horn, the monitors elevate, and three arcs of water go over the harbour. It is
the water cannon's language, which he already knows from the speedboat, done by
something else and much bigger. There is nothing to aim, nothing to press and
nothing to miss.

**And the harness caught a bug that had been shipped twice.** Chasing an
order-dependent failure turned up something worse underneath it: the speedboat
was sailing clean through the container ship at forty knots without a bang. The
crash debounce read `performance.now() - lastCrash < 900` against a `lastCrash`
that starts at zero — so for the first nine hundred milliseconds of the page's
life the number it compared was *the age of the page*, and neither the boat nor
the car could crash into anything at all. Under the harness, which runs twelve
simulated seconds in about a sixth of a real one, they could never crash. The
check that existed to catch precisely this stayed green because it read the
crash counter outright and saw a bang left behind by an earlier check on the
same page. Both debounces are countdowns the frame drives now, which is what
CLAUDE.md's rule about not timing game code off real time is for, and the check
reads deltas.

One consequence worth knowing: with the car able to crash in the harness at last,
holding a finger down at the car's TOP speed step turns out to hit traffic about
once a minute. That is by design — hitting traffic is a bang and a free
reassemble, and has its own check — but it is the honest price of the fastest
step, and worth a look on the iPad before deciding whether traffic should move
along for him.

All three are **machines and all three are `noSolid`**, like the ferry and the
road traffic. They move, so a solid one could wander into his path and become a
wall between him and somewhere — which is "blocking", and forbidden by accident
rather than by design.

Two things the renders caught. The fireboat's first version drew its arcs from
the **shared puff pool** at three hundred and eighty a second — into a pool of
sixty-four. It would have starved every splash in the harbour and strobed its own
arcs; it has its own instanced mesh now, one draw call, owing nothing to anybody.
And those arcs came out **grey**: Lambert-shaded droplets at two hundred metres
read as smoke, which is the exact complaint the speedboat's wake earned. Water
thrown into California sunshine is the brightest thing in the shot, so they are
unlit white now. The seaplane grew from fourteen metres to twenty for the same
reason — at fourteen it was a speck against the breakwater, and everything else
out there can be seen from the far side of the harbour.

---

## v102 — a lock, and a dock six metres above the harbour

**A lock with one water level is not a lock, it is a gate.** This game has one
sea plane, so rather than assert a difference that is not there, the far side of
this one is a new place: an impounded dock cut into the headland north of the
harbour and held six metres up, whose only way in or out by water is the
chamber. The lift is then honestly earned — and being six metres up is its own
payoff, because from in there he can see out over the spit to the sea.

**The second water level does not break the rule; it generalises it.** CLAUDE.md
says water is `terrainEff < waterLevel` and nothing else, and the reason is that
water defined in two places drifts apart from the ground under it. So there is
still exactly one answer to "how high is the water here" — `seaLevelAt` in
terrain.js — it just takes a position now, and `lockLevelAt` is the only thing
that ever gives it a different one. Everything that floats asks it. The open sea,
the rockets and the ambient beds keep using the constant, because for them it is
the same number everywhere.

**The ground does the rest, and the order matters** the way it does for the
harbour. The rim is raised first, then the two floors are cut back through it to
*different* depths: the dock's floor is left standing **above** the global sea,
so the world's own water plane never appears in it and the only thing filling it
is the dock's own surface — if the lock never ran, it would simply be a dry
basin. The chamber's floor goes **below** the global sea, because it has to hold
water at both heights. Ring the dock at three hundred metres and there is not
one point below sea level that is not the chamber.

**The loop is every other set-piece's loop.** A giant obvious thing (a fifty-metre
gap in a wall, with red beacons), one contextual button that exists only when he
is actually in the chamber, a visible wind-up (bells, beacons and the shared
countdown numerals), a huge payoff — the water and his whole boat rise together,
and a new place opens — and a free reset. The gates open themselves as he comes
up to them, so he never has to aim at a shut one.

**Never stuck, and never the way anywhere.** Sitting in the chamber doing nothing
re-opens the gate he came in by, so there is no way to be shut in; the harbour
mouth under the drawbridge is still wide open and still the way to sea; and
nothing about the lock can be scored, required or lost. The chamber is fifty
metres wide and a hundred and forty long — five of the yacht's beams and nearly
three of her lengths — which is absurd for a real lock and exactly right for a
four-year-old lining a ship up on a gap. Both boats lock through.

**And a contextual button that had no business being there.** Building this
found the car wash offering itself to a boat sitting in the harbour lock two
kilometres away: its only conditions were "parked and still", which a boat in a
chamber satisfies exactly, and pressing it would have dragged the boat back to
the airport. Every other contextual button in the game is gated on a radius, and
now so is that one.

---

## v101 — a way back to the menu from anywhere, and four bugs that needed a long session to find

**The menu button.** A small icon in the dash corner, the mirror of eject, and
the one control that is up in every state the game has: flying, driving, on the
Moon, out on a spacewalk, mid-bang. The picker already had a button, but it
shares the top-left slot with the go button and so was only allowed to appear
where the go button could not — parked, still, at home. This one has its own
slot, so that restriction does not apply to it, and it works from everywhere.

It is allowed to be that blunt because nothing is ever taken away: every route
out of the picker ends in a fresh spawn, and a relaunch restores the vehicle,
the direction and the destination he had. It unwinds the mode first rather than
trusting `applyVehicle` to do it — that only resets the rover and the astronaut
when the vehicle he picks *next* is not a rocket, so picking the rocket again
while on a spacewalk would have carried the spacewalk into the launch. And it
always opens on the vehicles.

**Four bugs from the audit**, none of which show up in a short sitting.

*Tones followed him between vehicles.* Every sustained tone is driven once a
frame by the one vehicle that owns it, so switching vehicle simply stops the
updates and leaves the oscillator running at whatever gain it had. The boat's
three were being silenced by hand; the car's whine and tyre roar and the yacht's
diesel and hull were not, so they followed him into the next vehicle and sat
under everything for the rest of the session. All of them are silenced on every
switch now, which cannot rot the way a hand-written list of three did.

*The rover's throttle button was an accident.* `updateRocket` set it below the
rover and astronaut early returns, so the only reason either had a throttle at
all was that the capsule happened to leave one up on the previous frame — one
changed path away from a rover he cannot drive.

*`wakePuff` always sacrificed the same puff.* With the pool full it fell back to
index 0 every time, so that one puff was overwritten several times a frame and
strobed out of existence mid-fade while the other sixty-three lived normally.

*Satellites and carrier jets leaked GPU memory.* Both build fresh geometry per
instance and were culled with `scene.remove` alone, which frees the JavaScript
object and leaves the vertex buffers on the card. Both dispose now — and only
what they actually own: the jets' materials come from `lam()`, which caches by
colour and hands the same material to half the world.

*And some per-frame rubbish.* The rover's boulder roll, the astronaut's
orientation and the ejection seat's rotor fold were each building fresh vectors
every frame — the kind of thing that turns into a visible hitch on an iPad much
later, when the collector finally comes for it.

---

## v100 — one speed control on everything, a horn for the car, and the smoke is gone

**The smoke off the speedboat.** There was never an exhaust: what looked like
one was the boat's *rooster tail*, a white ball a few metres astern that climbed
nine metres a second and grew to five metres across. The chase camera sits
twenty-two metres astern and eight metres up, looking forward — so it went up
through the middle of the shot and stayed there, reading as an engine on fire
rather than as water, and hiding the thing he was steering. It is gone. So is
the climb on the side wake, which was rising seven metres a second at full plane
for the same reason and with the same result; spray now hugs the water, which is
what spray does. What replaces the plume is deliberately almost nothing — one
faint wisp at the transom while he is idling, below both sightlines, and nothing
at all above `TUNE.boat.plumeMaxSpeed`, which is the speed at which he is
actually looking where he is going. The yacht gets the same wisp on the same
terms. She also stopped flooding the shared puff pool: four puffs every tenth of
a second living two seconds wanted seventy-odd of the sixty-four that exist, so
she was recycling her own mid-fade and starving every other splash in the
harbour — the whale, the jet-ski, the droneship.

Looking at it is what finished the job. A puff grows to 2.2x its size, so the
boat's wake was six-metre balls thrown nine metres in front of a lens that sits
twenty-two metres back: their *centres* projected below the frame, which is why
a check on how high they climbed went green while the screenshot showed the boat
hidden behind a white wall. The yacht was worse — her bow wave comes off
twenty-six metres *ahead* of centre and the wheelhouse camera sits six metres
abaft it, so twenty ten-metre balls stood dead ahead and turned the whole bridge
view into fog. Both wakes are now half the size and thrown much wider, off the
shoulders and quarters where they still say "this is fast" and "this is fifty
metres of ship" without standing in front of either. The harness check was
rewritten to match: it takes the camera's sightline and asks whether any puff's
sphere actually intersects it in front of the hull, which is what a screenshot
shows and what the old height test could not see.

**Speed steps on everything but the rocket.** The pair of buttons the plane has
always had now means the same thing on the car, the speedboat, the yacht, the
helicopter, the rover, the Mars drone, the airliners, the prop and the fighter.
Each vehicle has its own range in `TUNE.<vehicle>.speedSteps` — multipliers on
its own cruise, so a step reads as "much faster than usual" rather than a number
he cannot read — and the top step is a genuine one, because at their defaults
these things plodded. The step multiplies the speed the model is *aiming* for
and the cap, and never the `speed / cruise` ratios underneath, so at the top step
the boat sounds pegged and throws its biggest wake instead of looking identical
to cruise. Point-to-go vehicles keep their easing exactly: only the cruise half
of `Math.min(cruise, distance × approach)` is scaled, so the helicopter and the
drone still slow into the spot he touched. Lane keep still holds the road at the
top step — `lookAhead` is a time, so the aim point slides further ahead as he
speeds up. A fresh vehicle starts at cruise; each one then remembers its own step
for the session and forgets it on reload.

The control had to move to do this. It used to live in the bottom-right ladder,
which the helicopter's altitude pair and the rover's inherited throttle already
own — leaving it there would have given it a different position on three
vehicles, which is the one thing a control he learns once must not do. It is now
top-right, under the view button, on every vehicle. The helicopter is the
exception the screen forces: a side of the screen holds four button slots and it
already spends three on view, up and down, and its altitude buttons are the
biggest controls in the game on purpose. There, and only there, it is a single
button that steps up and wraps, with chevrons saying which step he is on.

**A horn for the car.** The car's drag-up is already the launch burst, so the
horn takes the contextual control it has never had — a small icon beside eject
rather than a round slot button, because the round slots are for things that
only exist somewhere and a horn is a thing he can always do. Tap plays the
two-tone once; holding sustains it. It is answered: traffic honks back some of
the time, the yacht and the cruise ship answer from the harbour spur where he is
close enough to hear them across the water, and honking near the drawbridge
brings its bells and beacons on early. None of those blocks anything or is ever
required — honking can never *open* the bridge, because a bridge that opens when
he honks is one he can strand himself behind on his own road.

---

## v99 — five things to do at sea, and none of them can be lost

**BOATS, stage 3.** The water out past the harbour mouth has things in it now,
and every one of them obeys the rules the space events obey: never required,
never blocking, never takes anything away.

A **rival jet-ski** comes past him from astern in the buoy channel and races. It
is rubber-banded exactly like the rival rocket — its speed comes from the gap
between them and never from a throttle of its own — so it noses ahead, drops
back, and is still alongside whether he is flat out or barely moving. There is
no finish line, no winner, and no counter anywhere that could go up or down.

A **whale** breaches a few hundred metres off, on its own timetable, announced by
its blow. It is the only living thing out there and it follows the astronaut's
rule rather than the paper planes': not a target, not solid, not shatterable, in
no solid list at all. He drives straight through one and it is simply there.

The **carrier's wake** rolls past as a wall of white water when he gets close
under her, and rocks whatever he is in — with the carrier's own jets going off
her second catapult overhead while it happens.

A **cruise ship** announces herself with a horn from over the horizon before
anything is visible at all, comes in through the breakwater gap with the harbour
tug on her quarter, berths in the inner harbour, blasts her horn again, and goes
away — so there is always another one coming. The yacht's horn answers hers.

And the **gantry cranes will load the yacht**: honk under one and a container
comes down onto her foredeck with a thump, she carries it wherever she goes, and
honking again lifts it off. A vehicle inside a vehicle again, for the price of a
box. Out in the harbour a honk is only a honk.

**Night.** There is no weather button and there is not going to be one — the sky
moods live in code — so this is everything out here reading `state.nightF`: the
lighthouse beam brightens, the drawbridge beacons show, and the cruise ship's
five hundred windows come up.

**Two things it got wrong first.** The crane was asked about from the quay its
legs stand on rather than from where its boom reaches, so a ship parked correctly
under the hook was out of range and a ship in range was parked on the quay. And
the cruise ship berthed on the container quay, which put her bow through the ship
already tied up there.

Harness 449/449, 10 of them new — including one that drives the boat straight
through a breaching whale and asserts that nothing happens.

## v98 — a fifty-metre yacht, and a drawbridge that lifts for her

**BOATS, stage 2.** The yacht is in the harbour, on her own wall on the west
side, and everything about her is weight: slow away, slow to turn, a long time
to stop, and a bow wave you can see from the shore. Drag up is not a burst — a
ship this size has none to give — it is the **horn**, deep and long, and the
ferry, the tug and anything else afloat within earshot answer it. Finger off for
three seconds at rest and the anchor goes down with a chain roar and a splash;
a finger back on hauls it up. Nothing is unlocked by any of it.

**Her one boat-only thing is that she is a place.** There is a helipad on her
stern in the same amber-ring language every landing place in this game uses, and
the helicopter can put down on it *while she is under way* — touching her
anywhere in point-to-go aims at the pad rather than at the piece of hull he
touched, the aim then follows her, and once he is down she carries him. And
there is a garage in her transom: alongside her in the speedboat one button
appears, the door swings down into a ramp, the boat goes in and he finds himself
driving the ship with his boat aboard. The same button lets it out again.

**The drawbridge is hers.** Bells and red beacons wind up while she is still four
hundred metres off, the two leaves lift, the traffic on the coast road stops and
queues, she sails under the raised road, and the spans come down behind her on
their own with a thump. The speedboat fits under without it opening at all — the
lift belongs to the ship.

**Three things the build got wrong first.** Her berth was in the marina, and
fifty-two metres does not fit in a marina: laid alongside the big pier she
overlapped both it and the main walkway and spent her maiden voyage being shoved
gently back and forth between them. She now has her own wall, which is what real
ports do and for exactly this reason. Her shallow-water avoidance — the thing
that means she cannot beach — worked perfectly and turned her away from the only
way out, so she sailed up and down the basin for ever politely refusing the gap
she was aimed at; it now stands down when she is lined up on the mouth, because
a channel is shallow water on both sides on purpose. And the helicopter's aim
raycast was tested against stale world matrices, so it hit wherever she had last
been *drawn* — the same trap the car's centre-screen tap documents.

Her wheelhouse has a wheel that turns and a radar that sweeps: rings, a sweep and
contacts, which is a picture of where things are and never a readout. Zero text
anywhere, as always.

Harness 13 new checks, all behavioural: the pad is not proved by the helicopter
reaching it but by driving her three hundred metres afterwards and finding him
still on it.

## v97 — a harbour on the Pacific, and a speedboat to take out of it

**BOATS, stage 1.** There is a port at the California end now, and a speedboat
in it. The harbour is a real one rather than a backdrop: a dredged basin behind a
barrier spit, with a container terminal whose two gantry cranes move boxes on and
off a ship for ever, a marina of a dozen moored boats, a fuel dock, a ferry on a
loop, a tug idling, an armoured breakwater with a lighthouse whose beam sweeps
day and night, a floating ski jump in the outer harbour, and a buoyed channel out
past the burning rig toward the carrier. The coast road crosses the harbour mouth
on a drawbridge, and the car can drive out there and over it.

The speedboat is the car's controls on water and nothing new to learn: finger
down goes, left and right steer, drag up is a burst that lifts the bow and throws
a rooster tail. It planes, it banks *into* its turns rather than out of them like
the car, it slams over the ramp and slaps down in a burst of spray, and it
explodes for free against the breakwater, the ferry or the container ship and
reassembles on the water facing out. **Its one boat-only thing is the water
cannon**: within a couple of hundred metres of the burning rig one button appears
in the helicopter bucket's slot, and holding it throws an arc of water over the
platform. It is pointing, not timing — aim the bow at the fire and hold; aim it
away and nothing happens however long he holds. Three sheets put the fire out,
which is exactly what three bucket drops do, because both call the same code.

**Where it is, and why it is not where the brief said.** The brief asked for the
harbour "at the existing harbour depression". That depression is at the *New
York* end, under the suspension bridges, and everything this harbour is for is
Californian — the rig the cannon fights, the carrier the channel runs past. So it
is built at the California end, east of the airport (its flatten mask reaches
x = ±550 and would have pulled the dredging back up to runway height), and the
New York depression is untouched.

**Three bugs found by building it.** A beached hull searched one ring at 22 m for
water and, driven a hundred metres up the shingle, found nothing but sand and sat
there for ever — the rings now widen until they find water, and a hull that is
somehow nowhere near any goes home to its berth by itself. A boat crash
reassembled at `safePos`, which only the aeroplane wall solver ever writes, so it
came back in the middle of the continent; it now remembers where it blew up. And
an imported hull's lowest point is its *propellers*, not its keel, so sitting
"the bottom" on the waterline left the whole boat standing clear of the sea on
its drives.

**The picker opened on the wrong screen.** Reported: "when the game loads it goes
to the rocket selection stuff". A saved rocket made the relaunch skip the vehicle
screen and open straight on the destination cards — two planets and a space
station — with the way back to the vehicles sitting underneath them. Whatever he
had been flying last, the first thing he saw was a question about space. A
relaunch still restores the vehicle, the direction and the destination, and the
card he used last is lit, but it always opens on the vehicles now.

Both hulls are third-party models put through the same pipeline as the car and
the jet, with one difference: neither file *names* anything, so they are baked to
the palette by **colour** instead. The speedboat carries its colours in
forty-three base colour factors; the yacht is one material with a 4096-square
texture doing all the work, so that texture is sampled once per triangle at the
UV centroid and the mesh is split into one primitive per palette bucket. The
speedboat's only two textures were a wordmark decal down each flank, and this
game renders no words: they are gone.

## v96 — the jet climbed with its nose pointing at the ground

Reported as "when you drag the finger down the plane descends with the nose up,
and vice versa", on the fighter. It was real, it was mine, and it shipped in v92.

`buildVehicleModel` sets `rotation.order = "YXZ"` on the body it builds, on its
last line. The early return added for imported models jumped straight over that,
so the car and the fighter kept three.js's default XYZ — which applies pitch
about the **world** x axis rather than the aeroplane's own. Flying north the jet
looked right; at ninety degrees it stayed flat however hard he pulled; flying
south it was exactly inverted, climbing with its nose pointed at the ground. The
flight model was never wrong for a moment. Only the body being drawn was.

Every check the game had flew at heading zero, which is the single heading where
this looks correct — the same shape of hole as the rover that steered backwards
under a green harness. The new check measures the **drawn** body at eight
headings: where the nose really is in the world against where the tail really is,
climbing and diving, for the prop, the jet and an airliner. The car is checked
the same way on its roll, since it shares the three angles and had the same bug.

## v95 — an ejection seat in the car, a lit engine on the jet, and a cartoon on the screen

**The car ejects.** It always had the button; pressing it did nothing, because
`ejectStart` looks the vehicle up in `TUNE.eject.families` and there was no `car`
entry, so it returned false and said nothing. There is one now, and the seat
fires up through the roof panel on a rocket like a fighter's, floats down under
the canopy and puts him back in the driver's seat. The `roof` clearance is large
(5.9) because it is measured from the model's origin, and the car's model sits a
whole `gearHeight` below its reference point — the same offset that once buried
the whole car in the road.

Ejecting also had to put the cabin away by hand: the frame loop hands straight to
`updateEjection`, so `carCamera` never runs again and the dashboard would have
stayed standing in the road underneath the rescue.

**The fighter's engine burns.** The nozzle is found by geometry, like the car's
wheels: the rearmost point on the model's own centreline. That window has to be
tight — at first it was wide enough to admit the horizontal stabilators, which
reach 1.6 m further aft than the exhaust does, and the burner came out glowing on
the tailplane root. Nothing on the true centreline goes past the nozzle, which is
what makes the test mean anything. The harness now checks *where* the plume is,
not just that there is one.

The flame is layered and the outer cones are **not** additive. Additive blending
can only ever add light, and against this game's bright sky an orange plume came
out as a white smear — the sky is already near the top of the range and there is
nowhere left to go. Normally-blended translucent cones can be warmer than what is
behind them; the hot core, the shock diamonds and the nozzle glow stay additive,
because those really are light. One cone was not enough either: however well
coloured, it read as a hard-edged orange spike stuck to the back of the jet.
Three nested cones of falling opacity hide each other's silhouettes. It opens up
on the throttle and eases off it, and never goes fully out in the air — a jet
with a cold black hole where its engine is looks broken rather than parked.

**The centre screen is a television.** A play triangle sits in the corner of the
map; tapping the screen plays a little cartoon — a paper plane flying a figure of
eight through clouds — and tapping it again puts the map back. A figure of eight
because it closes on itself, so the loop has no seam.

The button is a plain play triangle, not a YouTube badge. A wordmark or logo
would break the rule the whole game is built on, and a triangle in a rounded box
is a thing a four-year-old already knows how to press without reading anything.

Two things worth recording. The tap is raycast against that one plane and nothing
else, so every other touch in the windscreen is still the stick and driving is
untouched — the harness checks both halves of that separation. And every frame of
the cartoon is a pure function of time: the trail is worked out backwards along
the path rather than accumulated frame by frame, and the clouds wrap a whole
number of times per loop. An accumulated trail made the picture depend on how
often it happened to be drawn, which is both a frame-rate bug and a visible seam.

Frame time, SwiftShader, ABBA-alternated: the cartoon costs +0.092 ms (+6.5%)
against the map in the view where it plays. The first version redrew half again
as often with a longer trail and cost +12.1%, which was more than a 128-pixel
canvas has any business costing.

Harness: 413/413.

## v94 — the car has an inside

The imported body is an exterior model, so from the driver's seat he was sitting
in an empty shell with the map floating in mid-air where a dashboard should have
been. Now there is a dashboard, a screen standing on it, a steering wheel that
turns, door cards, an armrest, a console, a mirror and the empty seat beside
him.

The wheel is the one moving thing in there, and it is feedback rather than a
control: he steers by dragging, and the wheel shows him what his finger just
did. It turns 2.4 times as far as the road wheels, the way a real one does. The
harness checks it turns the way the car is turning, both ways round — a wheel
that turned the wrong way would be teaching him something false, which is worse
than not having one at all.

Three things were built and then cut, all for the same reason — he has to see
the road:

- **The A-pillars.** A free-standing post cannot line up with the imported
  body's own glass, so instead of framing the windscreen it read as a slab
  hanging in the middle of it. Taking them out gave the road back a quarter of
  the width.
- **The raised cowl** at the windscreen base. From a driver's eye you looked
  straight under its lip: a black notch across the middle of the car exactly
  where the road should be. One flat shelf to the glass has no underside to see.
- **The chrome vent strip.** At this size it came out as a hard white line
  straight across the frame and looked like a fault.

The first version was also built to realistic proportions and came out as a
letterbox: the wheel sat above his sightline instead of under it, and the dash
was dark enough to read as a hole in the middle of the car rather than a
surface. The shelf is now the lightest thing in the cabin, because it is the one
surface that has to read as solid — the screen stands on it.

Everything static is merged into four meshes rather than left as eighteen boxes;
three.js batches nothing on its own, and this rig under-prices draw calls
compared with the iPad. The whole cabin is seven meshes and five extra draw
calls, and it costs 0.088 ms — +5.7%, SwiftShader, ABBA-alternated, in the view
where it is actually drawn. It is never drawn anywhere else.

Also fixes a bug that predates the cabin: nothing put the centre screen away
when he climbed out of the car, so switching from the driver's seat to a plane
left it standing in the world. Leaving the car now clears the whole interior.

## v93 — the car was dented, and it was the normals

He said the F-35 looked incredible and the Tesla looked like it had been in a
crash, and he was right: the car's doors and rear quarter came back creased and
dented, and the whole body rendered a shade darker than its own source.

The cause was not the triangle budget. Normals were being kept from the original
mesh while the simplifier moved the surface between the vertices it spared, so
the body was lit as a shape that was no longer there. Rendering the untouched
346k source proved the source was clean, and pushing the budget to 82k with a
0.0003 error bound left the creases exactly where they were — which is what
ruled the budget out. Rebuilding the normals after decimation removed them
completely. The two models needed opposite handling for the same reason: a car
body is one big smooth reflection and shows every millimetre of that, while the
fighter is faceted by design and hides it, so the same settings flattered one
and wrecked the other.

The normals are rebuilt in the game at load (`TUNE.models.car.smooth`) rather
than in the build, because this toolchain's normals pass writes flat ones and
unwelds the mesh to do it, which tripled the file. The geometry ships welded at
0.77 vertices per triangle, so three.js computes genuinely smooth normals from
it. The car went to 60,080 triangles and 1.42 MB along the way; that was raised
while chasing the wrong cause, and it stayed because it is crisper on the light
bar and the door shut lines and costs nothing measurable.

The A/B rig had a bias worth recording. Interleaving is not enough on its own:
it drifts downward for a whole run as it warms up, and A was always the first of
each pair, so it ate the slower half of every drift step. That measured 24k
triangles as *more* expensive than 60k — impossible, and the only reason it was
caught. Sampling now alternates which side leads (ABBA, not ABAB).

Frame time, SwiftShader, ABBA-alternated: the imported car measured 1.61 ms at
24k triangles and 1.58 ms at 60k. A 2.5x increase in triangles produced no
measurable change; run-to-run drift is larger than the effect. Draw calls are
unchanged either way — the whole car is one call.

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
- "Speedboat n°2" by Jonathan Geoffroy, CC BY-NC 4.0, via Sketchfab —
  https://sketchfab.com/3d-models/speedboat-n2-66da3d79c45c41719c19fb80d0009bef
- "Yacht" by Sergei, CC BY 4.0, via Sketchfab —
  https://sketchfab.com/3d-models/yacht-0dd451f295d049cea20c17d3ffa87ee3

Three of the four are **CC BY-NC 4.0** — attribution *and* non-commercial — which is what the
`asset.extras` block inside each GLB records, not the plain CC BY they were taken
for. Little Pilot is free and carries nothing commercial, so the NC term is met;
the attribution above is the BY term; the yacht is plain CC BY. Each licence is
recorded in the `asset.extras` block inside the GLB the game actually loads, and
`scripts/build_boats.js` carries it across from the source deliberately. The raw
downloads are not in this repository (`models-src/` is gitignored); only the
processed 1.5 MB of geometry is.

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
