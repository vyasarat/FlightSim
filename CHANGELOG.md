# Little Pilot — changelog

One paragraph per release, newest first. The service-worker cache name
(`cockpit/sw.js`) is the version: the iPad picks a release up on its next launch
from the runway menu.

Screenshots, recordings and per-release evidence are **not** in this repository.
They are generated locally by the scripts in `scripts/` and kept in the
gitignored `evidence/` folder; committing them is what took `.git` past 100 MB.

---

## v142 — the booster rocket, to fly

**From the playtest:** he wants to FLY the new rocket, and he likes the side
boosters landing. It is a new card beside the rocket: the launch site's rocket,
an orange core with two white side boosters. He launches it from the launch
site's pad beside the motorway; the site's own stack steps aside while he is
in it, and comes back when he leaves. Holding the throttle is all it takes:
about 8 seconds up, the two side boosters let go by themselves. **The camera
gives him that part.** It swings off the rocket and watches the pair from
along the line of the two landing pads, so in portrait both boosters stay in
the picture all the way down. They flip engines-first, boom, and land upright
on their pads, legs out. His rocket waits in the sky meanwhile (it shows in
the distance), and 2.5 seconds after they are down the camera swings back to
him. From there the flight is the rocket's: the core (flown home too), the
fairing, the second stage, space, the Moon, Mars and the station. Coming home
he lands on the launch site's pad. Each new stack has its side boosters again.
A tap on the screen during the watch hands the rocket back at once, and the go button stays away while it watches. New check module `heavy_checks` (13 checks). Also, found by the full run: the helicopter's target ring could sit over the missile button in portrait (aimed down at the fire rig). It now steps in toward the middle of the screen until it is clear of every button.

## v141 — the monster truck, to drive

**From the playtest:** he wants to DRIVE the monster truck. It is a new card in
the picker: the blue monster truck, about three times the SUV, with wheels
taller than a man. It starts at the monster-truck arena, nose at the ramp. It
drives anywhere (roads, fields, cities, up hills) and steers freely like the
rover, with no lane keep. Finger down drives, a drag steers, a drag up is a
burst and a drag down backs up, so it is never stuck. The speed pair works.
**It never bangs.** A small building, a town house, a parked car or a junk
car it drives into is crushed, with flying pieces and dust. Motorway and city
traffic it meets is knocked spinning away. A tower or anything else too big
to crush simply stops it. A knocked car flies up and off to one side, so he
can see it go. Everything it crushed pops back once he has driven off, and
all of it at once when he changes vehicle. Water stops it at the shore; a jump
that comes down in the lake puts him back on the last dry ground. **Big
jumps:** it drives up the arena's ramp and flies off the lip, about 24 m over
it at the middle step, and landing on something small crushes that too.
Roads: it drives on a road only where it is level with it, so it goes under
a city flyover, never up on to it. It climbs the motorway's embankment from
the field beside it. In a city street the chase camera comes in over the cab
rather than sit inside the building behind. The set-piece's own giant truck
is unchanged, except that it does not start its show while he is in his own
monster truck inside the arena; from further off he can still set it off.
New check module `monster_checks` (25 checks); it is in the slot check too.

## v140 — the toy track: speed steps, two three-way forks, three jumps

**From the playtest:** the giant toy track was "the biggest hit". **Speed
steps:** the speed pair was already on screen there, but the boosters set the
pace, so a step hardly changed anything. Now a step sets how fast his finger
pushes, and above the middle step the boosters throw him faster too. A lap
takes 105 s on the slowest step and 62 s on the fastest. **Two new forks,
three ways each:** hands-off goes straight on; a full steer held left takes a
loop; held right takes a jump. Fork C has a loop by the lamp and a
middle-sized jump; fork D has a tall loop and the big jump. The branches come
back on the line exactly. A big blue sign over the track before every fork
that goes somewhere shows the ride each way: an orange loop, a ramp-and-car,
or a spring for the corkscrew. **Jumps:** with the old gap jump there are
three, of different sizes (26, 36 and 52 m), each under an amber ring. Each
has a booster before it. Too slow and he falls, goes bang and comes back at
that booster, as at the old gap. Each kicker (and the ski-jump) brakes him to
what its landing can catch, so every speed step lands every jump. **Off a
jump the camera swings out** to his right, low, so he sees himself flying
against the sky with the gap under him; from straight behind, a car in the air
looked like a car on the track. **Toy cars:** a toy car he catches up with now
outruns him, as the motorway's traffic does, and one he catches anyway (where
a branch rejoins) is nudged on ahead. Rear-ending one is no longer a bang;
with the faster steps and the longer course he was rear-ending them every lap.
`track_checks`: 27 checks (9 new). At every step, hands-off, held right and
held left, the whole run goes through with no bang; each sign shows each ride
on its own side.

## v139 — the helicopter lands anywhere solid

**From the playtest:** "gets the ground warning near land and blows up most
times he tries to land." Two things did it. The alarm was the plane's
sink-rate alarm, so it went off on every single descent. And the kites and
paper-plane flocks that fly 28–50 m over the fields counted as a mid-air even
with the helicopter hovering still among them, which is exactly the height he
comes down through. Now the helicopter has no ground warning. It still warns, as before, when it is
flying level at the side of something at speed, the one bang left. A kite or flock
that drifts into it while it hovers or creeps pops, and the helicopter stays.
Coming down on to the ground, a roof, a pad, a ship's deck, the carrier's
flight deck, the motorway where it is a bridge, or a city flyover, it settles
on top and stays there. Before, a roof was a wall it got shoved about on, and
a bridge deck was air it sank through. Over the sea, the lake or the lock it
hovers and never sinks. Holding down while it is still travelling, it holds
over whatever stands ahead and slows to a creep for anything too tall to come
down on, so a descent meets a roof, never a side. Up takes it off again. The
one bang left is flying level into the side of something at speed. The
carrier's arrester wire no longer catches the helicopter, which used to pin it
to the deck. The cities' tower crowns (spires, masts, glass caps) are now solid
where they are drawn: before, a helicopter coming down on a crowned tower
settled inside one, and a plane flew through them. The generator writes them
from now on, and the gate fails any crown it cannot name. Point-to-go is
unchanged.
New check module `heli_land_checks` (16 checks, about 50 landing attempts). It
fails 11 of 15 on v138.

## v138 — the merge bang's real cause, and payoffs you can see from the driving seat

**The toy track's merge bang, found and fixed.** Swept over 60 traffic layouts,
the live game (v132) banged at the merge in 4 of 60, and v137's "move over"
rule only made that 3. The real cause: the track's road back is the one way
onto the motorway that doesn't say which carriageway it joins, and the car
read that as the wrong one. So the traffic in the lane he was joining never
knew he was coming. It now asks the motorway where the road back actually
ends. 0 of 60 bang. v137's extra rule is taken out again; with the right side
it isn't needed. The toy track's check now runs the four layouts that banged.
This bug is in the live game.

**Bigger payoffs.** From the driving seat the four set-pieces were specks. They
stay where they are, so nothing reaches the road, and are now big enough to
cover at least a quarter of the windscreen's height at the payoff, both ways.
That is measured only on open glass, never behind a pillar, the dash, the map
screen or a button. The sled's brick wall is now 75 m wide and 48 m tall, its
bricks thrown higher and only away from the road. The fireworks burst faster
and bigger. The launch already met the target.

**A real monster truck.** It is 63 m long and 55 m tall, against junk cars the
size of buses. It leaves a 30 m ramp on a 48 m high arc, and in the car it waits
until the landing will be in his open windscreen, on either side.
`scripts/payoff_size_checks.js` measures all four; `scripts/merge_sweep.js`
runs the merge over many traffic layouts on any build.

## v137 — no bang at the merge, and the new set-pieces leave the traffic alone

No new features; a fix found by the full harness. Leaving the toy track by its
exit lane, hands-off, could end in a bang just as the road back joined the
motorway: a traffic car was driving level with him in the lane he was joining.
The traffic made room for a car ahead of him or behind him, but not one
alongside. Now, while he merges, a car level with him in that lane moves over,
or if it can't, drops back and lets him in; a car ahead of him still pulls
away, as before. The touch was seen twice in the full harness and twice alone,
then not again with nothing changed, so it depends on where the traffic happens
to be at that moment. The new check places the traffic instead of waiting for
it to be there. three.js uses up random numbers
for every object it makes, and building them moved the traffic. They are now
built on their own random numbers (`vkQuiet`, as the traffic's own models
are), so the traffic is laid out as it was before. The toy track's exit check
now says what any bang was.

## v136 — a monster truck that squashes junk cars

A loop of dirt track on the plains, just west of the motorway north of the
launch pad. On it a giant blue monster truck waits, wheels as tall as a house,
with a ramp ahead of it and six rusty junk cars parked nose to tail beyond the
ramp. A red target ring floats over the ramp. Point at it in any vehicle and
after 3-2-1 the truck revs and roars off. It hits the ramp, flies, lands on the
junk cars with a boom and squashes all six flat with a crunch each. Then it
brakes, drives round the loop home, and the cars pop back up one by one. The
truck has dark windows and nobody in it; the cars are empty wrecks. In the car
it waits until the landing will be in his windscreen, about 620 m ahead, at
every speed and both ways. The truck, the ramp and the cars are solid, and a
squashed car is only as tall as it is squashed.
`scripts/monstertruck_checks.js` (12 checks), `scripts/monstertruck_renders.js`.

## v135 — a fireworks barge on the great lake

A red barge stacked with racks of coloured mortar tubes, strung with bulbs,
floats on the great lake just west of the motorway, with a red target ring
turning over it. Point at it in any vehicle and after 3-2-1 every rack goes:
single shells first, then bigger and bigger volleys, then a finale of thirty at
once. Red, gold, green, blue and pink peonies, rings, and gold willows, each
with a flash and a boom. Then it rests and is ready again. In the car it waits
until the first bursts will land in his windscreen, and the shells lean away
from the road; no star ever comes over it. The countdowns of the launch pad,
the rocket sled and the barge now share one numeral through a small registry
in `setpieces.js`. None of them starts while another is counting. Each stands
down for a police pull-over or the picker.
`scripts/fireworksbarge_checks.js` (14 checks) drives it hands-off both ways
and flies the plane and the helicopter at it.
`scripts/fireworksbarge_renders.js` renders it.

## v134 — a rocket sled and a wall of giant toy bricks

In the desert, just south of the mountain tunnel, a straight rail runs beside
the motorway on its west side. A big red rocket sled waits at the north end of
it, under a tower with three lamps. Further down the rail stands a wall of giant
toy bricks, taller than a house. Point at the wall in any vehicle and it goes.
The lamps go red, then amber, under 3-2-1 in the sky numerals, then green. The
sled blasts off at 120 m/s, smashes straight through the wall with a bang, pops
three parachutes (red, white and yellow) and stops before the end of the rail.
Then it rolls home, and as it passes back through the gap every brick flies
back into its place. In the car it waits until the smash will land about half a
kilometre ahead of him, inside the windscreen, whichever way he is going and at
any speed. The bricks always fly away from the road. The sled has no driver.
Nothing in the mountain tunnel sets it off, where he could not see it.
`scripts/rocketsled_checks.js` (22 checks) drives it hands-off both ways at
every speed step and flies the plane into it. `scripts/rocketsled_renders.js`
renders it, including real hands-off drives.

## v133 — a rocket launch beside the motorway

A rocket as tall as a skyscraper now stands on a pad beside the motorway on
the plains, with its red tower behind it, nearly straight ahead from the
driving seat. Point at it from within about a kilometre and a half (the car
coming down the road, the plane, the helicopter) and it goes. Big numerals
count 5-4-3-2-1 up in the sky, clear of the rocket, while the arms swing away.
The engines light, a cloud rolls out of the flame trench, drifting away from
the road, and it climbs, leaning east. Its two white side boosters let go
with a puff. They flip, fly home with a double sonic boom and land upright on
their own two pads across the railway. Then a fresh rocket rises out of the pad,
ready to go again. Nothing to press and nothing to miss. The rocket is solid
wherever it is, on the pad, climbing or landed, so flying into it is a free
bang like any other. A helicopter hovering over a landing pad is pushed aside,
never banged. The countdown steps aside for a police pull-over or the picker.
`scripts/launchsite_checks.js` (21 checks) drives it hands-off from the car and
flies the plane and the helicopter at it. `scripts/launchsite_renders.js`
renders it from both seats.

## v132 — cleanup: a way out as gentle as the ways in, and a harness with no flake

No features. New York's way out from the city had a 24% plunge. Between two
things it had to clear, the height solver let the deck dip in a V at whatever
grade the second crossing forced, and its last crossing left it 60 m to come
down to the kerb. Now a deck between two nearby crossings spans them without
dipping, and the way out runs further before it merges. Every way in and out of
both cities is under 9%, and the city check now holds the ways out to that too
(it had covered only the ways in, at 12%). The submarine check, which passed
alone and failed in the full run, was reading state carried in from earlier on
its shared page. The submarine picks its spot from the random stream and waits
20 s each time it lands on a shallow one, so where the stream had got to set
whether it first dived at 38 s or 158 s. The check now reseeds the stream and
resets the sea events before it starts. The ship checklist now says that a
check whose expected value was edited is re-run before ship, and that a check
which passes alone and fails in the full run is a harness bug.

## v131 — a way off the toy track, ramps that clear each other, a harness that finishes

The toy track's way off is now a visible exit lane, not a drag down on the
start deck. It peels right off the deck under a blue gantry carrying the
motorway's icon, and is taken like every exit: a full steer held through the
deck. Hands-off, a light steer or a held left stays on the track. The lane
runs down beside the tower on to a road back that merges into the carriageway
that brought him. The merge comes before the track's own exit mouth, so the
two roads never cross. It meets the carriageway at its edge, running with the
traffic. Laid first from the motorway's centreline, it had brought him across
his own carriageway and the median on to the other one, the wrong way. The
deck's fork now reads his hold through the lift and the net's throw too, since
those are how he arrives on the deck. The noisy finger, deciding part-way round
a lap to leave, is off at the next deck. The cities' ramps now clear each other,
not only the motorway: wherever two decks overlap, the flyover stands
`ramp.clear` over the other, measured against every segment both ways round.
Where the near and far ways in converge on their merge they now meet level.
They used to meet in plan a hundred metres before they met in height, the far
deck hanging half over the near one four metres up (in both cities, in every
release since v126). The merge now stands at the far ramp's height there, the
near ramp climbs to it, and the link takes the drop to the city. The crossing
check measured city ramps at a motorway spur's width; it now uses their own.
The harness's static server is supervised. A dead or silent server is
restarted and the page boot retried, a run with no check for twenty minutes
stops itself, and whatever ends a run kills what it started. v130's own full
run passed 683 of 683 under it, uninterrupted.

## v130 — the giant toy track

An orange toy-car track at enormous scale in the desert between the canyon and
the coast, off its own motorway exit (the board's icon is an orange loop). The
exit is on the New York-bound side: a full steer at its mouth, like any exit.
Its road ends at a lift up the back of the launch tower, and the car is the
toy: rail-locked in a car-width walled channel, orange with blue connectors.
The run: the steep launch drop, a banked turn, a loop, then a fork. Hands-off
or a held left is an easy S; a full steer held right is a double corkscrew.
Then a booster (spinning rollers, a whir, a kick), and a second fork: the safe
span, or the gap jump under an amber ring. Then over a giant sofa, up a spiral
round a giant lamp, a second booster, a triple loop, and a ski-jump into a
giant padded net that throws him back up to the tower. Then again. The props
(the sofa, a bookshelf he drives through, the lamp) are never solid. Finger
down is go; finger off coasts, and on a climb he rolls back to the bottom and
is never stuck. He falls off in two places only: short at the gap, or out of
a loop he came into too slowly (a loop can push him round, never pull). Then
he tumbles, goes bang, and comes back at the drop or booster that feeds it, so
he has the speed to go again. A short booster before the first loop is the
one addition to the brief's list: stopped before it, the motor alone could
never reach loop speed, and he would roll back and forth under it for ever.
Three toy cars run the course the safe way; rear-ending one bangs both, and
they never run into him. The camera goes upside down with him in both views.
The chase camera rides the track itself behind him, because a straight line
back from the top of a loop leaves the loop. From the seat, it is the car's
own seat. The track is data (`TUNE.track`): a graph of segments made of typed
sections, each laid in the frame the last one ended in, with exact end
tangents, so a stunt branch rejoins the safe one to the millimetre. To leave,
drag down on the start deck.

## v129 — one solids registry, and every vehicle asks it

A solid used to be solid only for the vehicle it had been built for. The boat
swept the harbour's own list and never saw the lock's walls. The rover and the
Mars drone had no list at all and drove through the whole base. The motorway's
bore had a lining you could see and nothing you could hit, and its bridge
piers, the quay's containers and the launch mount's legs were drawn but not
there. Now everything solid registers once, in `solids.js`, with a kind and
the vehicle classes it blocks (every one, unless it says otherwise). Every
vehicle asks that one registry with its own radius, and one law applies to
all of them. Above its crawl speed a solid is a bang and a free reassembly
where it happened; at or under it, a shove. The yacht, the rover and the drone
can now go bang too; the rover and the drone come back backed off the thing
they hit. The Mars base is solid but never breakable. The rover's ramps are
now surfaces it drives up, and the lip's slope is the launch. On every ramp,
at three speeds, it flies higher the faster it came (5–7 m at 8 m/s, 11–15 m
at 14, 20–29 m at 21). The bore is a corridor: rock between and outside the
tubes from floor to lid, and a roof over each from its own arch. A new
check, `solidity_checks.js`, drives every vehicle into every kind of solid it
can reach, at cruise and at crawl, and prints the matrix. It replays the same
scenarios on the old build for a before. Before, 39 of 96 cells went
through (the rover and the drone through everything on Mars, the car through
the bore and its portals, the helicopter through portals and containers, the
hulls through ships and bridge piers); after, none. Nothing checked where roads crossed things, and three did. The
motorway's New York end ran 488 m along the airport's taxiway and over its
apron, and its California end ran along that apron's edge. The harbour road
crossed the Californian runway itself at grade. Both motorway ends now pass
outside the terminal side, and the harbour road goes round the runway's north
end. `roadCrossings()` finds any route over a runway, taxiway, apron or
another road that isn't at a junction or on a bridge, and the harness asks for
none. The cities' ramps were placed by metres from the New York end, so moving
that end slid every ramp along the road, California's too. They are now
anchored to their city's junction. Found on the way: inside the car's crash
debounce a wall at speed did nothing, and he drove through it; the
helicopter's shove could only ever push up, so a roof let it through; a
ground vehicle under a low overhang was pushed down into the ground and crept
through; and the boat's search for water led into a walled-off lock chamber.

## v128 — a turn done stays done, and the motorway has one measure

A full steer that has taken a corner, an exit or a city ramp now holds him on
the road it took him to for as long as the finger stays where it is. The hold
reads as hands-off, lane-keep drives, and it is not a choice of the next
junction. It is his again only once he lifts (longer than the 0.4 s a
four-year-old's finger comes off the glass by accident) or brings the stick
back near the middle, and the next turn is a fresh full steer. In v127 a
finger still held after an exit steered him off the spur into the field. The
motorway now has a single distance measure. Everything that asks where along
it something is (traffic, the lights, the exits, the car) reads the same
metres, instead of two that drifted 14 m apart by California. Lane-keep on a
city's ramps now follows the curve as on a street corner, with the corner's
shorter aim; at the top speed step the motorway's law had swung him off a
ramp's far edge. The noisy drive found two more, both older than this
release. A finger that came off the glass for a moment, just short of a
corner, landed at the middle of a new drag. It read as centred, the turn was
dropped on touch-down, and by the time the drag was back the junction was too
close to choose. His full steer then went through raw at 33 m/s, into traffic
on the next street. A re-touch after a brief lift now has a second to find its
drag again, for a turn being held and for one already done. And a turn held
late (forty metres out at cruise) could not shed its speed at the corner brake
and ran wide into the far kerb's parked cars. It now brakes as hard as the
corner needs, up to 140 m/s², speed-only as before. The noisy drive's hand
now keeps holding for 1 to 3.5 s after half its turns, as a child does. It
lets go in time when turns remain and the next junction leads out of the city.
A touch of a parked car now dumps its frames, like a bang. The city checks
gained the kept hold (way in and street corner) and a lift just short of a
corner; with the re-touch fix switched off, the lift check misses every turn
and hits a wall once.

## v127 — a turn is something he does, and a noisy finger drives it first

The city was being tested by a steady robot hand, and a four-year-old's hand is
not steady: a wobble read as a turn, a drift read as a choice, and the indicator
latch remembered a hold he had long forgotten. Now there is one rule everywhere
he drives. Hands-off or a light touch goes straight through every junction.
Only a FULL steer (70% of the drag range), held through the approach while he is
on his street's line, is a turn; nothing latches, nothing is remembered between
junctions, and letting go is straight on (a lift under 0.4 s is not a let-go).
The same rule takes a motorway exit and a city ramp, and the corner assist only
sheds speed for a turn he has chosen, never chooses one. The city was compared
with the motorway under the same stick inputs (`scripts/feel_compare.js`), and
every difference that was not the corner assist came out: the city's own
pursuit law on straight streets, its shorter 12 m aim, and its lighter
held-turn threshold. A full-lock blip at 20 m/s now turns him 16.5° in the city
and 17.1° on the motorway. The pedestrians are gone from both cities. The
noisy drive found these, all now fixed. On the bridge's curving ramp, lane-keep
aimed at a fixed point 150 m up the curve. Going up he drove the chord and off
the kerb; coming down he crossed the centre line beside the oncoming queue. It
now aims along his own lane, with pursuit and the corner's shorter aim on
curves. A turn let go of just before a T went nowhere. The ends of the
motorway were a wall; they are now turnarounds. A full right held before the
gantry's approach steered him into the lane beside him. Pulled back on to
the motorway from the fields, a car in the lane he was joining hit him, for
three reasons. Traffic took him, on a bank beside the road, for a car on a
flyover. Traffic measures the road by sample index and he was measured by
distance, which drift 14 m apart by California, so a car alongside him read
as well behind. And nothing kept its distance behind him. Traffic now reads
him in its own measure and ignores him only on another road, and a car closer
than 25 m behind him drops back. 120 pull-backs at the California end, 0 bangs;
it was about 1 in 30. The two measures still disagree for everything else that
samples the road; that is left for its own release. The new harness check drives
five real minutes of touch events at 60 Hz, portrait, from the driving seat.
The finger wobbles ±15%, lifts for 300 ms and overshoots for a second, and the
drive runs from New York's way in, through five held turns, to the way out. It
fails on any unintended turn, missed turn, bang, touch or trip off the road.

## v126 — the ways into the cities, and traffic that looks like cars

He couldn't see how to get into a city and drove across the fields instead, so
the city exits are now found from the motorway. Traffic keeps right, so every
city has a way in on each carriageway, on its right: a lit gantry across the
whole road carrying the skyline, with two arrows pointing down into the lane,
the exit lane painted blue with arrows leaning off it, and the ramp visibly
peeling away from the kerb. From the side the city is on, the ramp runs to it
on the ground. From the other side it peels right, climbs, and sweeps left over
the motorway, clear of a lorry, joining the first ramp on the line of the
street it becomes. The way out also sweeps over the motorway and merges from
the right into the carriageway that heads for the other city. The v125 spurs
started on the centreline, so taking one crossed the oncoming carriageway, and
leaving New York put him briefly on the wrong side of the median. Holding right
anywhere on the painted approach is his choice of that ramp and stands like an
indicator: lane-keep moves him over (once the lane beside him is clear) and
takes the ramp, and his held finger reads as hands-off meanwhile. It ends when
the ramp is his, when its mouth is behind him, or when he steers left.
Hands-off he drives past. A speed-only ramp assist holds him under what each
bend allows, and in practice binds only at the top speed step. Both are stated
in CLAUDE.md as carve-outs. The gantry and ramp are on screen and clear of the
pillars from 300 m and 150 m out in the driving seat; that is harness-checked,
and so is taking each way in, with a long hold and with a tap, at every step
checked. Sixteen interchange pillars that stood in the lanes (not solid, driven
through) are gone. Off the road, the pull-back now aims at the nearest road in
front of him: in the fields facing a city he is taken on to a city street, not
back to the motorway behind him. A crash comes back where it happened, on the
road he was on: a street, the boulevard, the bridge deck, a ramp or the
carriageway. Off every road it comes back at the spot itself, a few metres off
the wall. v125 knew only "nearest grid street, else the motorway", which put a
crash on the boulevard 800 m away. The traffic is six low-poly vehicles (sedan,
hatchback, taxi with its roof sign, van, bus with its row of windows, box
lorry) with wheels that turn and lamps that glow, and the police car keeps its
livery on the new sedan. There is one instanced draw call per shape, collision
boxes are unchanged, and the new builders leave the seeded random stream as
v125's builders left it. City
traffic keeps its promises more strictly: a car only counts as "ahead of him"
if it is ahead on the ground, and speed it only had to outrun him goes as fast
as it came.

## v125 — drivable cities

Both block cities are places to drive. Every street the generator laid is a
road now, read off the layout rather than authored (`streets.js`): two lanes,
the centre line, kerbs, a zebra across every arm of every junction, and signals
at every third avenue by every third street. Two new exits off the motorway
each side carry a skyline on the board. The way in arrives through the middle
of the city, and hands-off he drives straight through, is taken round where
the road ends and leaves by the other exit, crash-free at every speed step
checked, with the city's traffic running. Holding left or right as he
approaches a junction turns him on to that street. That needs the one new
assist, a stated carve-out in CLAUDE.md: at cruise the car turns on a 77 m
circle and a street is 14 m wide, so the corner assist sheds speed on the
approach and hands it back after, only near a junction, and only for a street
that is there. Point at a building halfway along a block and nothing saves him;
he comes back on that street, facing along it. The city is alive: cars, taxis,
buses and vans both ways, queuing at the reds; parked cars on the wide streets;
people on the pavements who step back to the wall if he mounts one. Traffic
keeps the motorway's promises (nothing behind drives into him, nothing ahead is
a wall, nothing crosses in front), with a net under all three measured on the
ground. Run a red and the chase follows him down the streets he drives. New
York has steam out of the manholes, a hot-dog cart and a subway grate. It also
has a ramp up on to the harbour bridge and a drive along its deck to a
turnaround over the water; the bridge's towers stepped outboard to make the
deck a road. And it has an open square with a fountain he can drive straight
through. California has a 1.1 km boulevard from downtown to the coast road,
which is how the car reaches the boats. Two old bugs went in passing: the car's
guardrail clamp pulled a car anywhere below the motorway's height on to it
(850 m in one frame from the square), and every signal lamp in the world was
drawn every frame, asleep or not. Busiest New York junction with a chase,
SwiftShader (not an iPad): +21 draw calls and +50k triangles over v124 at the
same spot, frame +10–12%.

## v124 — a held finger never bangs, at any speed step, either way

Two holes in the promise that a finger held from coast to coast never ends in
a bang. At the top speed steps he was the faster car, and slower traffic in
his own lane was simply rear-ended: the follow rule only ever protected him
from traffic faster than he was. Traffic ahead of him in his lane now YIELDS:
from 160 m it moves into the other lane if that lane is clear, and whether or
not it can, it speeds up so that by 45 m behind it he is the slower one. He is
never slowed; fast is his. And at the slowest step, with no hand on the stick,
every exit captured the car (too slow to be past a spur's mouth before it
bit), ran it to the spur's end, turned it round and sent it back into the
traffic. Hands-off on the main line, a spur now never competes; the exit
gesture is unchanged, because once he has steered, the old rule holds until
he is back on the main line. The crossing check now drives the country ten
times, every speed step in both directions, and counts every traffic touch,
crash and wall as a delta: all ten arrive, all zero.

## v123 — textures, round two: real sizes, grain you can see from the car, and traffic that is not a box

v122's tiles repeated at the size of the thing they were on, and the palette
tint flattened them. Now every atlas slot says its real size once
(`ART_LAYER_INFO` in `art.js`: asphalt 8 m, a facade four 3 m bays by four
3.5 m floors, a container side 12 m) and a second, detail atlas lays material
grain over it close up: brick courses at 2 m, aggregate at 2 m, corrugation at
1 m, deck grit at 1 m, grass blades and sand grain at 2 m. Each slot carries a
contrast gain, so a dark palette road still shows its grain. The motorway paints
its own lanes from the texture (edge lines and a 3 m dash every 12 m), which
replaced one 9 m dash every 160 m, the reason no lane was ever visible from the
car. Open ground reads its tile twice at two scales, so the repeat never shows
as a grid from the air. The "grey cube" beside the road was traffic: every lorry
was a bare white 4.2 x 4.4 x 15 m box and every car a bare box too. They are
modelled now (cab, windscreen, container trailer and wheels; glasshouse, wheels
and eight palette colours), in the same envelopes and still one draw call each.
The ship's hull plates are sized to read from the harbour, and the city streets
are re-baked at the same real sizes.

## v122 — the art sprint: textures, two block cities, and two lighting passes priced and left out

Everything had a colour and nothing had a surface. One 2048² atlas of sixteen
seamless tiles (glass, brick and concrete facades, asphalt with and without
paint, concrete, grass, scrub, sand, Mars and lunar regolith, corrugated steel,
container panels, a roof, a steel deck, and the sea's normal map), authored
procedurally by `scripts/make_atlas.py`, sliced at load into one texture array
and box-mapped in the shader (`art.js`). Each tile is divided by its own mean
and multiplied onto the material's palette colour, so it adds detail and never
changes a colour; glass reflects the sky, is the only thing on a building that
glints, and lights up at night. Painted: towns, landmarks, airports, runways, the
highway and its tunnel, the harbour and its containers, the carrier, the rig,
the demolition towers, Mars, the Moon and the terrain. Never painted: anything
he acts on. The New York skyline and the California downtown are block cities
now — generated in Blender (`scripts/city/`) as street grids with setback towers,
cornices, water tanks and rooftop plant, 433 and 307 buildings, instanced by type,
a per-building LOD at 650 m and one merged mesh beyond 1 km; the layout ships as
JS so their solids and sparkle spots register at load, and a building is not
solid until its mesh has arrived. Daytime fog now runs 950–1560 m (was 700–1450),
still inside the terrain's edge, so a city a kilometre off reads. SSAO was priced
and not shipped (+71–105% of the frame on the heaviest scenes under SwiftShader,
nearly twice the draw calls, and blind under the log depth buffer); ACES costs
nothing but bleaches a palette authored in display space, so it is a switch left
off. Two harness checks were made honest along the way: the fireboat's pool check
now asks who emits, not how full the pool is at one instant, and the bore drive
resets the speed step an earlier check left raised. That last one found a real
gap, not fixed here: hands-off at a raised speed step, the car can rear-end
slower traffic in its own lane.

## v119/v120 — the connected-world sprint reverted, then six bugs found by sweeping rather than by looking

**v119 reverts the connected-world merge** (`b13587f`): no hop-in, no parked
fleet, no toy-track oval. The tree is byte-identical to v114 apart from the cache
name, which goes *forward* — the sprint shipped as v118, so reverting the name
too would have left every iPad holding the newer cached build for ever.

**v120 is six bug fixes, and the interesting part is how they were found.** Two of
the three reported bugs did not reproduce; the sweep written to look for them
found different, real ones.

- **Interchange ramp pillars stood on the New York runway.** The interchanges sit
  at a fraction along the road, and the road *starts beside the runway*, so 4.5%
  along it was still inside the runway's own length: concrete columns up to
  fifteen metres tall on the centreline, with a ramp deck two and a half metres
  over it. Moved to 0.16/0.78, which clears the runways *and* the ring corridor
  beyond each end — a 150 m ramp loop reaches the centreline from a long way off,
  and the approach is as much his road as the runway is.
- **Interchange ramps came down to road level on the carriageway.** Their loops
  are centred on the road, so the ends laid a 14 m concrete strip and a 1.2 m
  guardrail straight across a lane. They stay up on their pillars now.
- **The cross street's stop line, and the masts that go with it, were painted
  inside the motorway's outer lane.** `stopLine` was one number for all four
  approaches, but each has to stop clear of a *different* road: the cross street
  waits `highway.halfW` back, the motorway waits clear of the cross street.
- **Signal heads hung at 1.9 m over the carriageway** — below the roof of a 2.6 m
  car. The halo is what makes a lamp read at distance, not the box around it, so
  the head shrank and the mast grew. And the mast's height is measured from the
  road *under the head* now, not from the middle of the junction: on a slope
  those are metres apart, and a head that cleared everything at the centre hung
  at chest height twenty metres up the hill.
- **A junction was sited seventy metres before a tunnel portal**, putting a
  signal head across the approach to it. Junctions keep clear of a bore mouth now,
  the same way they keep clear of an interchange.
- **The tunnel lid self-shadowed into a black slab** beside the portal. The ground
  in this game does not receive shadows — `scene.js` switches that on per frame
  for the handful of chunks near him — and the lid is ground.

**Three invariants that were never stated, and so were never true on purpose**,
are now checks (`scripts/cleanup_checks.js`):

- *Exactly one of him.* Every path that spawns a vehicle — picker, respawn, three
  kinds of crash, eject, rover, spacewalk, carrier launch — leaves exactly one
  player vehicle, twenty times each. The player's model is tagged so this is a
  question rather than an argument. **The reported duplicate did not reproduce on
  any path.**
- *Nothing standing on a surface he uses.* Asked by geometry over all 1174 meshes
  in the world — per instance, and per triangle for merged meshes whose union box
  says nothing about where their pieces are — against both runways and the whole
  carriageway. A list of exclusions is a list someone has to remember to add to;
  a sweep is not. This is what found the pillars and the stop lines.
- *The helicopter can never be stuck.* Fifty point-to-go runs from random coastal
  and inland spots all arrive (worst 8.4 s), so **the old "stuck over land" report
  did not reproduce either** — which is exactly when to put a floor under it, and
  there was none. A target it is getting nowhere with is now let go after 14 s,
  the same rule the boat has.

624 checks.

---

## v114 — signals on the motorway, steering that answers, a chase you cannot crash out of, and a horn that is not a bus

**Six signalled crossroads on the main line**, on top of the six on the spurs.
Sited by the same measurement rule — never wet, never steep — plus three things
a motorway has that a spur has not: it must be a *ground* stretch (a signalled
crossroads on a viaduct is not a thing, and one inside a bore is less of one),
well clear of an interchange, and not on top of a junction already there. The
motorway keeps the long green and the cross street gets a short one, so he
sails through most of them and meets a red now and then.

**Both roads stop.** The cross street queues at its red, and so does the
motorway's own traffic — with one exception written into the code: a car that
would become a stationary wall in front of *him* clears the junction instead of
stopping. A finger held from New York to California has always been a crossing
without a single bang, and a queue on the carriageway would have ended that at
every junction. It is the same bend this codebase already puts in traffic to
keep him safe. Measured after: 269 s, zero off-road frames, zero crashes, 16
reds approached, 3 run, 29 traffic cars held at a line.

**The steering.** Diagnosed before touching anything, and it was not the
steering. Raw response was already 33 ms to visible yaw and a lane change in
under a second. What was wrong is that **the lane-keep outvoted him**: below the
old `override` threshold his command was *blended* with the assist, so at 30% of
stick he asked for 10°/s and the car turned the other way, and at 50% he lost
three quarters of it. The assist is never blended with him now — it yields on a
timer, out within 0.15 s of a steer, held out for half a second after he lets
go, then back over 0.45 s. His command always gets through whole.

Also: a small deadzone with the range rescaled past it; **full lock in 26% of
the screen width instead of 42%** (the car has its own drag range now, because
the aeroplanes' is tuned with him and is not to be touched); and the low-speed
turn rate *raised* rather than halved — a car turns tighter slowly, which is
what a junction and an exit need.

One thing I tried and took back out: a faster steering actuator. It measured
17 ms to visible yaw instead of 33 — one frame against two, nothing he can feel
— and it made the hands-off lane-keep overshoot enough to be captured by the
lake spur and driven into the lake. Both numbers beat the target; only one of
them keeps a coast-to-coast crossing clean.

**Crashing is not a way out of a chase.** It was, because the explosion branch
of the frame returns before `updateHighway` — so the police froze mid-bang and
the chase quietly ended. The lights and the police run in that branch now: the
sirens stay on while he is in pieces, and the moment he is back on the road they
re-form behind him and pick it straight up, with the chase clock never reset.
The give-up timer is a never-stuck backstop rather than a mechanic now, at 180
seconds — outrunning them is the win.

**The horn** was three wrong things at once: two sawtooth voices (every
harmonic, including a fat low one), a fundamental at 294 Hz, and `setTone`'s
80 ms smoothing giving it a swell and a long fade. It is 400 and 500 Hz
triangles with a whisper of square for the bite, a high-pass at 330 under them
so there is no low fundamental left at all, and an envelope of eight
milliseconds up and fifty down. A tap is 0.4 s. Held, it stays high and clean.

Frame time at a highway junction with a chase in frame: 2.04 ms against 1.90 ms
without it, and eight *fewer* draw calls — inside the noise (SwiftShader).

---

## v113 — traffic lights, and the chase you get for ignoring one

**Six junctions, on the surface roads and none on the open motorway.** The spurs
are the roads the car can actually leave the highway onto — the two airports, the
demolition site, the plains city, the desert and the harbour coast road — and
each one gets a crossroads: four three-lamp heads on masts, painted stop lines on
every approach, and a cross street with its own traffic. The seventh spur, the
one to the lake, gets nothing: it runs over water for its whole length, and the
placement is measured rather than assumed, so it declines rather than putting a
junction in a lake.

**A junction is a crossroads, not a light on a stick.** He stops at a red and a
stream of cars crosses in front of him — that is what a traffic light *is* to a
four-year-old, and it is the reason to wait made visible. The cross traffic
obeys its own signal and queues behind the line.

**Amber blinks before red.** Every set-piece in this game gets a wind-up and no
bang is ever unannounced; a junction is the same rule at junction scale, so a red
is never the first he knows of it.

**Lane-keep does not brake for a red, and that is deliberate.** Stopping is the
one decision out here that is his: finger off and he coasts to the line, finger
held and he goes through. Making the assist stop for him would turn the only
choice on the road into scenery.

**Running one is not a mistake.** It is a camera flash, a chirp, and then two
police cars out of a side road behind him with lights and sirens. They are
rubber-banded like the rival rocket and the rival jet-ski — their speed comes
from the gap, not from a throttle — so they are always about to catch him and
never quite do. **Three ways out, and he needs to be told none of them**: go
fast (their speed is capped below his top speed step, so holding it opens the
gap and they peel off with a last whoop), wait (after `maxChase` they give up
anyway), or crash (free, like every crash here).

**Being caught is a scene, not a penalty.** They angle in front and behind, the
lights strobe, a short blip, an officer waves from his window, the shared
countdown numerals run 3-2-1, and then they peel away and he drives off with the
engine still running. Ten seconds. No score, no message, and no delay he cannot
simply drive out of — he can pull away mid-scene and it ends.

**Nobody is ever hurt.** The officer is drawn in his seat and never leaves it, is
never a target, and nothing can happen to him — the astronaut's rule, not the
paper planes'. The *cars* crash, explode and reassemble like every other machine.

**The siren is ducked**, warm rather than harsh, and the engine and the ambient
bed stand down under it rather than it being the loudest thing on the mix — the
rule the engines already follow, applied to the one sound with an excuse to break
it. And the cop cars are never the same colour twice running, which is the space
programme's own never-twice draw (`eventpool.js`) borrowed for a livery. That
made a distinction worth having: a pool now declares whether it holds *events* —
which the three rules are about — or paint, which they are not.

610 checks.

---

## v112 — the harbour had the wrong ambience, and a CSS tier that had never applied

**A boat in the harbour was listening to an airport.** `currentBedName` asked
the vehicle about the car, the helicopter and the airliners, and then fell
through to `state.phase === "TAXI"` — which every surface vehicle writes on
every one of its frames as a way of saying "not flying". So a speedboat or a
yacht two thousand metres out to sea got the apron rumble, for the whole
session. The phase is the last question asked now, and only the aeroplane ever
reaches it. There is a `sea` bed: a wash with a slow swell in it.

That is the third time this particular lie has bitten — the car wash offering
itself to a boat in the lock, the car's solid test that never ran, and now this
— so the rule is written down: **ask the vehicle, and ask the phase last.**

Also gone: a `@media (max-height: 360px)` block that had never applied to
anything. The `max-height: 520px` block matches every screen it did and comes
after it, so it won every property. Left a note rather than a silence, because
the reason not to restore it is worth knowing: 48 px controls would fail the
harness's 56 px minimum, which is exactly why the surviving tier's own comment
stops at 58.

593 checks.

---

## v111 — the engine is two loops now, and the recordings are a drop-in

Every engine in the game was **one sawtooth oscillator**, shared by every
vehicle that was not the rocket, with the car, the speedboat and the yacht each
running a second oscillator of their own beside it. It is **two loops per
vehicle now — an idle loop and a high loop, crossfaded by how hard he is working
it** — and that is the model whether the loops are recordings or not.

The CC0 clips are not here yet. That is the point of building it this way: the
crossfade curve, the pitch travel, the per-view filtering, the idle wobble, the
doppler bend and the gain staging are the parts that take tuning against the
kid, and none of them depends on where the loops came from. So the graph is
real today, driven by loops `js/engines.js` synthesises to exactly the shape a
recording has to be — a harmonic stack with breath and a slow wander, rendered
so that every partial gets a whole number of cycles in the buffer and the loop
point is seamless by construction. A clip arriving replaces one buffer and
changes nothing else.

Seven voices: `prop`, `jet`, `airliner` (both airliners share it), `heli`,
`car`, `boat`, `yacht`. The rocket is not among them and never joins the
crossfade — a Merlin is not a throttle curve, and it keeps its own synthesised
bass.

**The engines are quieter.** `TUNE.audio.engines.master` is well under what the
old oscillator ran at, because an engine is the floor the events happen over,
not a thing competing with them — the horn, the ships' horns, the bells and the
fireworks all have to come through it without him having to turn it up. In the
cockpit the voice is muffled and quieter still, and the wind and tyre bed comes
*up* to fill the room, which is what being inside a cabin actually sounds like.
In chase it is open and full. A held idle wanders rather than droning, because
a drone is the thing he stops hearing and then only hears when it goes.

**How a recording arrives**: two seamless files in `cockpit/audio/engines/` —
`<key>-idle.m4a` and `<key>-high.m4a` — and the key added to
`audio/engines/index.json`. A manifest rather than a probe on purpose: asking
for a clip that is not there to find out whether it is there costs a console
404 for every voice on every launch. `cockpit/audio/engines/README.md` says what
the clips have to be.

The six new checks assert the *model*, not the sound, so they are the same
assertions when the loops are real: the crossfade actually crosses, the pitch
travels and stays modest, the cockpit is the same voice filtered rather than a
second one, the idle never sits still, and the rocket is not in the system.
They read the model's decisions rather than the live AudioParams — every
parameter is a `setTargetAtTime` ramp on the audio clock, and the harness runs
twelve seconds of game in a sixth of a real one, so the live values there are
always mid-ramp and say nothing.

Gone with it: `engineFreqIdle`, `engineFreqMax`, `engineGainIdle`,
`engineGainMax`, `engineFilterFreq`, `engineLfoRate`, `car.whineHz`,
`speedboat.engineHz`, `yacht.engineHz`, and the three per-vehicle engine tones.

---

## v110 — one event mechanism, two policies, and the three rules checked by machine

"It may never be required, it may never block, and it may never take anything
away" was a comment at the top of `events.js`, and the same comment again at the
top of `seaevents.js`. Fourteen events across two pools, and the rules were
enforced by whoever remembered them.

They are a **registry** now. Every event is a member of a pool, every pool
declares its **policy**, and there are exactly two policies because there are
exactly two questions:

- **"once"** — one member is drawn per occasion and never the same one twice
  running, the draw remembered across reloads so a relaunch cannot repeat it. It
  stages when its own moment arrives, and if that moment never comes, nothing
  happened this flight. *The space programme, one event per rocket launch.*
- **"standing"** — every member is always eligible and runs its own clock,
  re-arming after it finishes, so several can be going at once. *The harbour,
  where eight things are always about to happen.*

The events keep their own bodies exactly where they were. What moved is the
selection policy, the re-arm clock — which had been written five slightly
different ways across the eight harbour events, some counting up and some down
— and the thing that makes it worth having at all: **one way to force any event
in any pool.** Before this the harness had to know that the whale hides behind
`sea.whale.next`, the submarine behind `sea.sub.next` and a space event behind
`eventsForce`, so the three rules could only ever be spot-checked on whichever
events someone had remembered.

So now `scripts/event_pool_checks.js` walks the whole registry, forces each of
the fourteen to happen on its own, and asserts all three: the solid count never
rises (nothing an event puts in the world is a wall he can be shut behind), no
`flags.*` counter ever goes backwards, no control he had goes away, and the
picker still offers the same cards. An event *may* bring its own contextual
button and take it back — the meteor shower's cannon does — so the registry
records which button belongs to which event, and the audit can tell that apart
from taking one of his.

Also asserted: 240 consecutive draws with no repeat, every kind reached, the
last draw written down; and a rocket flight that draws nothing at all is still a
complete flight.

587 checks.

---

## v109 — the road bugs: nothing stands in it, everything in it is solid, and the tunnel exists

Three bugs, and the second one is the reason for the other two.

**Nothing the car drove at was solid, and never had been.** `resolveSolidWalls`
opened with `if (state.phase !== "AIRBORNE" && state.phase !== "CLIMB_AWAY")
return;` — and `updateCar` writes `state.phase = "TAXI"` at the top of every one
of its frames as a way of saying "not flying". So the car's call to it returned
on the first line, every frame, for the whole life of the coast road. That is
why buildings could be driven through, and it is why the harness check that
asserted "a hands-off crossing registers zero wall hits" had been passing: zero
was the only number that function could produce. It asks `vehSolid()` now — the
vehicle's own question, on the contract, like `vehParked()` before it — and a
wall at speed is a bang and a free reassemble, a wall at a crawl a shove.

**Buildings stood in the carriageway** because nothing ever kept them out.
`inCorridor` in `scenery.js`, the one test that holds streamed scenery away from
places vehicles go, knew about the two airports and nothing else. The road now
claims its own ground as it is built — the carriageway, every exit spur, every
interchange ramp and the harbour coast road — and `TUNE.highway.clearHalf` keeps
everything streamed off it. A crossing from New York to California passes about
thirteen hundred streamed solids and not one of them is in the road.

**The mountain tunnel did not exist.** The surveyor classified 800 m of route as
a bore and the builder laid a concrete lining along it, and nothing ever took the
mountain out of the way — so the road dived into solid rock with a buried pipe in
it. A heightfield cannot have a hole punched through it, so the mountain is now
cut down to the road along the bore (`hwyBoreCut`, which `terrainEff` calls, so
the ground, the scenery placement and the spawns all agree) and the cut is lidded
with the material that was removed, sampled from the uncut hillside and coloured
by the terrain's own rule. From outside it is the same mountain. It is twin
bores, one per carriageway: a single tube wide enough for a divided highway is
52 m across with its crown 37 m over the road — taller than the hill it is
supposed to be inside, which is why the first cut of it came out of the hillside
like a dropped pipe. Two 12 m bores fit. Each end has a headwall with two arches,
a centre pier and four lamps, and the lining is lit, with a receding line of
crown lamps that tells him there is a way through long before the far end is
visible. The chase camera ducks under the roof on the way in.

**And the freight train ran down the motorway.** Not a crossing — the line was
laid along x = 340 and so is the highway, and the track was inside the
carriageway for fourteen hundred metres of its two-kilometre span. Nothing had
ever noticed, because nothing could hit it. The day the car became solid a
hands-off crossing hit the 3:15 freight five times. The line has moved, by
measurement rather than by eye: a hundred metres clear of the carriageway at its
nearest, a hundred and ninety clear of every exit spur, and — unlike the old
alignment, which forded a lake — dry the whole way.

**Also**: the drawbridge towers were one solid box from the sea bed to the top of
the counterweight house, sealing the opening the road drives through, so the only
way across by land became a wall the moment the car was solid. They are a pier
below the deck and a pair of legs either side of the carriageway above it now,
which is what they look like. The boat still cannot pass.

Frame time in the bore is *lower* than on the open road beside it (356 draw calls
against 426). 583 checks, twelve of them new.

---

## v108 — the layout check that had never seen a tall screen

**The slot check ran three viewports, all of them landscape.** That is the
answer to why the button system did not catch a clash on a portrait iPad: it
was never asked. It runs six now, three of them portrait, every vehicle at rest
*and* with its controls held.

Adding that found a bug older than the button system. **The home arrow lay
across the camera button at 768×1024**, and would have on any tall screen. The
arrow rides a ring around the middle of the display, and on a tall screen that
ring passes straight through the top-left pair. Its bearing is the entire
message and its distance from the middle carries nothing, so it now walks
inwards along its own bearing until it is clear of every control rather than
taking itself away. It was also built as a 0 × 0 anchor with the arrow hanging
off it, so `translate(-50%,-50%)` moved nothing and the rotation swung the arrow
about its corner instead of turning it in place — which is why the first attempt
to clear it cleared a rectangle eleven pixels from where the arrow actually was.
The anchor shrink-wraps the arrow now.

**Two things the matrix was measuring wrongly.** `#alarm` is `inset: 0` — a
transparent full-screen box holding an edge vignette and a triangle — so
measuring its own rectangle said the alarm covers every button on the screen.
True, and no use. It descends to what actually paints now, and never counts a
full-bleed transparent container as coverage. And **the pressed states are in
the matrix**, but not by absolute paint reach: every `.roundBtn` carries a
resting drop shadow with more reach than the gap between slots, so that answer
is "every stacked pair overlaps, and always has", which is equally true and
equally useless. What it measures is what a press *adds* over its own resting
state — the helicopter pair's cyan halo, the horn's yellow glow.

571 checks.

---

## v107 — the airliners were pointing the wrong way, and the reticle sat on a button

**Both new airliners were misoriented, and for two different reasons.** The A350
was nose-first into the chase camera; the 777 was sideways across the runway.

The 90° error is the interesting one. `modelPrepare` decided which way round a
model was with `size.x > size.z` — "the long axis is the fuselage". On an
airliner that is a coin flip: a 777 is 63.7 m long with a 60.9 m span, an A350
66.8 m with 64.8 m. Centimetres decided it, and it put one of them across the
runway. The rig's taper test was no better — it called the 777's nose end 0.76 m
wide, which is a nose-cone tip rather than a twenty-metre tailplane, because that
file is 38 separate nodes and the sample found the wrong one.

So the axis is **measured** now, from three facts true of every aeroplane: the
highest part of the model is the fin and it is at the back; wings sweep back, so
the tips sit behind the root; the engines hang below the wing ahead of the fin.
All three must agree or the code falls back rather than picking one — a wrong
answer here points an aeroplane backwards down a runway.

**And they were more than twice the size of the bodies they replaced.** `length`
was set to the real aeroplane's, but these are drop-in bodies and the hand-built
airliner is 31.5 m long in this world. At 66.8 m the chase camera, which sits 30 ×
the vehicle's size behind, ended up inside its own tail. Matched to the box it
replaces, the vertical offset lands within 0.1 m of the built body's.

**Ten new orientation checks** that cannot lie the way the taper test did, because
they do not ask about the file — they ask about the aeroplane standing in the
world. Fin behind the centroid along the runway heading in both views; after
three seconds of throttle the nose leads along the direction it is actually
*travelling*; and for a wide-body, span across the heading exceeds span along it,
which is the 90° error the bounding box could not see. Applied to the prop and
the fighter too, as the regression the imports earned.

**The reticle was sitting on a button.** The slot-clash detector only ever looked
at buttons, so a HUD indicator drawn on top of a control was invisible to it —
which is exactly what was happening: on the helicopter the aim marker landed on
the speed stepper, a reticle over a control, at every viewport tested. Detection
now has three independent halves — geometric overlap between controls, the
declared slot table, and **obstruction**, a HUD element over a control — and none
subsumes the others. The marker itself now takes itself away while it would cover
a control and returns the moment it would not, because readability beats the
effect.

---

## v106 — a real A350 and a real 777, with their liveries, and one fewer plane

**Two imported airliner bodies**, replacing the hand-built ones for
`airlinerDelta` and `airlinerEmirates`. The prop and the fighter are untouched.
These are drop-in bodies and nothing else moved: the collision box, the spawn
origin, `gearHeight` and the interior camera anchor all come from
`TUNE.vehicles`, and the vehicle baseline confirms all sixty recorded numbers
across ten vehicles are unchanged.

**The liveries are the whole point and they are kept.** Everything the model
pipeline had done until now bakes materials to a six-colour palette and throws
every texture away, because a Model Y and an F-35 are shapes he recognises. An
airliner is not: a grey A350 and a grey 777 are the same aeroplane to a
four-year-old, and he recognises them by the *tail*. So these take a different
path — materials and textures kept, the node hierarchy kept (no `flatten`, no
`join`, so the landing gear stays its own node), normals and tangents stripped
but UVs kept, and the textures resized and re-encoded instead. The A350 went from
10 MB to 0.72 MB and the 777 from 0.6 MB to 0.25 MB, with "DELTA" still legible
down the fuselage and the Emirates wordmark still gold.

**The gear retracts now**, on these two only. An imported body never got handed a
gear group, so the fighter's wheels have always stayed down — that is its
existing behaviour and it stays. A model whose tuning entry asks
(`gearFromWheels`) gets its wheel groups gathered and handed to the same
retract the built bodies use.

**And the rig's taper test lied once.** It decides which end of a raw file is the
nose by measuring which end is blunt, and it reported the 777's nose end as 0.76 m
wide — a nose-cone tip, not a twenty-metre tailplane, because that file is 38
separate nodes and the sample found the wrong one. With the yaw it recommended,
the 777 flew backwards, nose pointing the opposite way to the A350 parked beside
it. The renders settled it: both need the half turn. Look at the picture, not the
number.

**`airlinerJetblue` is gone** — its card, its tuning entries and livery colours,
its audio keys, its harness references. The picker is a clean five-by-two grid
with nothing off-screen at either viewport. A saved choice of the retired
aeroplane falls back to the Delta rather than dropping him on the picker.

---

## v105 — the refactor: one vehicle contract, one button system

No behaviour change anywhere in this one. It is the cleanup the last few releases
earned, gated by a new characterization harness that records what every vehicle
actually does and refuses to let any of it move.

**A vehicle contract** (`vehicles.js`). One table says, for whatever he is in: how
it updates, where its cameras sit, whether it is parked, and where it comes back
from a bang. Those four questions used to be four `if (state.vp.boat) … else if
(state.vp.car) …` chains spread over three files *in three different orders*.
A mode is a vehicle here — the rocket is also the rover, the astronaut and the
Mars drone — and the resolution order is the one safe one, with the yacht asked
about before the boat because a yacht *is* a boat.

**One contextual-button system** (`buttons.js`). Every button declares its slot
and its `when()`; one pass a frame computes all of them from scratch. Visibility
used to be decided at forty-six sites in twelve files, and sixteen of those were
pure suppression — calls whose only job was to put away a button some *other*
vehicle had left up. That is a chase, not a rule, and its misses are this game's
bug history. The slot-collision check is now part of the system rather than
bolted onto the harness.

**The picker finally asks an honest question.** It and the car wash both tested
`phase === "TAXI" && speed === 0` — an aeroplane's idea of parked, which a
stationary *boat* satisfies exactly. That is how the wash came to offer itself to
a boat sitting in the harbour lock. Both ask the vehicle now.

**Written state semantics.** `state.js`'s header says what each shared field means
per vehicle — `state.y` is a waterline for a boat and meaningless for the rover —
and a harness check enforces what it can. `mergeBoxes` moved out of `car.js`, so
nothing has to load after a car to build a harbour. Dead code and four orphan
tuning keys gone. CLAUDE.md is back under 150 lines with the contract in it.

Deliberately **not** done: removing the `phase = "TAXI"` assignments themselves.
That field is read at sixty-six sites across twenty-four files and several key
real behaviour off it, so migrating them is a change of its own rather than a
detail of this one.

---

## v104 — the car comes back where it crashed

Crash the car and it did not come back where it crashed. It came back wherever
the last **aeroplane** crashed.

Every vehicle's reassembly begins by teleporting to one shared "safe spot", and
only the aeroplane ever writes it. The boat has always kept its own crash
position, which is why it comes back exactly where it hit. The car never did, so
it inherited the plane's — and then snapped to the road nearest *that*. Fly
first, then drive, then hit something, and he reappeared kilometres down the
coast road at the other end of the flight he had taken earlier. Measured: a
crash at z=3453 put him back at z=−3999 one time and z=+5088 the next, entirely
according to a leftover number. He now comes back within a metre of where he hit,
still pointing the way he was going.

It was found by the new vehicle characterization gate — sixty checks that record
what each of the ten vehicles actually does (spawn, ground height, control
response, both camera anchors, buttons, and where a bang puts it back) and then
refuse to let any of it move. It exists for the refactor that follows, but it
earned its keep before that started: this is exactly the duplication it was
built to watch, showing up as a bug in one of the four hand-written copies of
crash-and-reassemble.

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
- "Delta Airlines Airbus A350-900" by Dave Love (sketchfab.com/Tyler_Dave),
  CC BY 4.0, via Sketchfab —
  https://sketchfab.com/3d-models/delta-airlines-airbus-a350-900-b108d460122f4113960e000fc6f2ad44
- "Emirates Boeing 777-200" by OUTPISTON (sketchfab.com/outpiston),
  CC BY-NC-SA 4.0, via Sketchfab —
  https://sketchfab.com/3d-models/emirates-boeing-777-200-2ec71115e5d94f48ba5ac1933d54ec8d

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

## v121 — what goes wrong over time, and under abuse

The first sweep checked the world standing still. This one ran it for thirty
simulated minutes at a stretch, twice, and then did to it what a device does to a
page: backgrounded it for ten minutes mid-flight, turned it sideways with a button
held down, put a second finger on it, took a finger off the edge of the screen,
filled its saved settings with rubbish, exhausted its storage quota, and installed
it fresh and over three older versions with the network switched off afterwards.

Three things were wrong. Every finished one-shot sound stayed wired to the master
gain for ever — thirty minutes of play left three and a half thousand of them
hanging there, and a real-time settle released not one. A touch cancelled by the
system, which is what iOS sends when a finger slides off the edge of the screen or
a banner steals it, left the stick pegged where it was; the rover and the
spacewalking astronaut read it without asking whether a finger was down, so they
turned on the spot for ever. And the vehicle picker — the first thing he ever
touches — was the one control that did not start the audio, so the sound waited
for the second screen.

Seven new checks guard them. The graph now comes back to ninety-five standing
voices six seconds after he puts it down, and is still ninety-five twelve seconds
later.
