# Overnight 2: what he asked for

Branch `overnight-2`, from `cockpit-3d` (`c178fe7`). Local only: nothing pushed,
nothing merged, no deploy. The previous night's report is in git history
(`git show cockpit-3d:OVERNIGHT.md`).

## The brief (the parent's, 2026-10-03, verbatim in substance)

Playtest on v138, from his dad (now in PLAYTEST.md): he loved the new
set-pieces, and the giant toy track was the biggest hit. He wants to FLY the
new rocket (he likes the side boosters landing) and to DRIVE the monster
truck. In the helicopter he gets the ground warning near land, and it blows up
most times he tries to land.

Build four things, in this order, one release each. The parent approved the
control changes these need ahead of time:

1. **The helicopter lands anywhere solid.** Coming down on to ground, a
   rooftop, a deck, a bridge or a pad, it settles gently, every time. No ground
   warning for the helicopter. It only bangs flying into the SIDE of something
   at speed. Over water it hovers; it never sinks or bangs. Taking off again is
   the same up button. Point-to-go does not change.
2. **The toy track:** the speed steps work on it (the same pair, in the same
   slot). Jumps: several, of different sizes; too slow means he falls and comes
   back at the booster before it. More forks: left/right choices he can see
   coming from far off, each branch a different ride (one with a jump, one with
   a loop). The branches rejoin, and hands-off still goes straight.
3. **The monster truck as a vehicle** in the picker. He drives it anywhere, on
   or off road, steering freely like the rover. It never bangs: whatever it
   drives into gets crushed or knocked flying, and everything pops back after
   he has gone. Machines and structures only. Big jumps off the existing ramp.
   Keep the set-piece truck as it is.
4. **The booster rocket as a vehicle** in the rocket picker: the v133 rocket with
   its two side boosters, launched from that pad. The boosters peel off and he
   SEES them fly home and land. Then the flight carries on like the other
   rockets.

If one of the four cannot be done well tonight, the brief says to write that
here and move on rather than ship a weak version.


## What was built: all four, one release each

| release | commit | new check module | its checks |
|---|---|---|---|
| v139 the helicopter lands anywhere solid | `9b4abfd` | `heli_land_checks` | 16 (fails 11/15 on v138) |
| v140 the toy track: speed steps, forks, jumps | `a8aa20c` | `track_checks` grew | 27 (9 new) |
| v141 the monster truck to drive | `4f68770` | `monster_checks` | 25 |
| v142 the booster rocket to fly | `3e777c0` | `heavy_checks` | 13 |

Each release passed the gate, ran its touched modules green, and had both
reviewers (`law-reviewer`, `render-critic`). Renders are in `evidence/`
(`heliland/`, `track/v140/`, `monster/`, `heavy/`).

### v139 — the helicopter lands anywhere solid
**What did it.** The "ground warning" was the plane's sink-rate alarm. It went
off on every descent. The bangs were mostly the kites and paper-plane flocks
that fly 28-50 m over the fields: they counted as a mid-air even with the
helicopter hovering still. And a roof was never a floor. Coming down on one,
it got shoved about for as long as he held the button, and it sank straight
through bridge decks.

**What it does now.**
- No ground warning. It still warns before its one bang, flying level into the
  side of something at speed.
- A kite, flock or airliner that drifts into it while it hovers pops. The
  helicopter is not hurt.
- It settles on top of whatever it comes down on: ground, roofs, pads, ship
  decks, the carrier's flight deck, motorway bridges, city flyovers. The up
  button takes it off again.
- Over the sea, the lake or the lock it hovers and never sinks.
- Holding down while still travelling, it holds above whatever is ahead and
  creeps near anything too tall to come down on.

**Also changed.**
- The carrier's arrester wire no longer catches the helicopter. It used to
  pin it to the deck so the up button could not take it off.
- City tower crowns (spires, masts, glass caps) are now solid where they are
  drawn. A helicopter used to settle inside them, and planes flew through them.
  The city generator now writes these crowns, and the gate fails any crown it
  cannot name.

Point-to-go is unchanged. Noisy-finger city drive (city code changed), seeds 3
and 11: 5/5 turns meant and made each, 0 unintended, 0 missed, 0 bangs,
0 touches, 0 off-road (`evidence/noisy/`).

### v140 — the toy track
- **Speed steps.** The speed pair was already on screen, but the boosters set
  the pace, so a step hardly changed anything. Now a step sets how hard his
  finger pushes, and above the middle step the boosters throw him faster too.
  A lap takes 105 s on the slowest step and 62 s on the fastest.
- **Forks C and D.** Each is three ways: hands-off goes straight on, a full
  steer held left takes a loop, held right takes a jump. All branches rejoin
  exactly.
- **Signs.** A big blue sign over the track before every fork shows the ride
  each way: an orange loop, a ramp-and-car, or a spring for the corkscrew.
- **Jumps.** There are now three, of 26, 36 and 52 m, each under an amber ring
  with a booster before it. Too slow and he falls and comes back at that
  booster. Each kicker and the ski-jump brake him to what the landing can
  catch, so every speed step lands every jump.
- **Jump camera.** Off a jump the chase camera swings out to his right, so he
  sees himself fly.
- **Toy cars.** The faster steps had him rear-ending the toy cars every lap. A
  toy car now outruns him, or is nudged ahead where a branch rejoins.

### v141 — the monster truck
- **The vehicle.** A new card in the picker: the blue truck, about three times
  the SUV. It starts at the arena, nose at the ramp. It drives anywhere and
  steers freely like the rover.
- **It never bangs.** Buildings, town houses, parked cars and junk cars are
  crushed into flying pieces. Traffic is thrown spinning off to the side.
  Anything too big (a tower, a pier, a ship) simply stops it.
- **Nothing is lost.** Everything crushed pops back once he has driven off, and
  all at once when he changes vehicle.
- **Water.** The shore stops it. A jump that lands in the lake puts it back on
  the last dry ground.
- **Jumps.** Off the arena's ramp it flies about 24 m over the lip.
- **Roads.** It drives on a road only where it is level with it: under a city
  flyover or a motorway bridge, it stays on the ground.
- **The set-piece.** The giant set-piece truck is unchanged, except that it does
  not start its show while he is in the arena in his own truck.

### v142 — the booster rocket
- **The vehicle.** A card beside the rocket: the launch site's rocket, an
  orange core with two white side boosters. It launches from the launch site's
  pad by the motorway. The site's own stack steps aside, and is back when he
  leaves.
- **The boosters.** Holding the throttle is enough: about 8 seconds up, the two
  boosters let go by themselves.
- **The camera gives him that part.** It leaves the rocket and watches the pair
  from along the line of the two landing pads, so in portrait both stay in the
  picture. They flip, boom and land upright on their pads. While it watches,
  his rocket, the space race-rocket and the gate rings are hidden, so the
  boosters are the only rockets in the sky. 2.5 s after they land the camera
  swings back to him, and a tap on the screen brings it back at once.
- **The rest of the flight** is the rocket's, landing at home on the launch
  site's pad.

## Full harness

**826/826** on `08ba2ac` (the final state). It was one uninterrupted run with
nothing else running. On the way there:
- **Run 1 stalled at 295 checks.** It hung booting `heli_play_checks`'s portrait
  page after a reload that had no timeout of its own; the module passes alone
  in 85 s. The reload and its wait now time out at 2 minutes, so a slow boot
  fails loudly instead of stalling the run. The same run also found the two
  vehicle-count checks still expecting 10 cards; they now expect 12. I
  re-checked that edit on its own before the next run.
- **Run 2: 823/826.** The 3 failures were one layout case in all three portrait
  viewports: the helicopter's target ring over the missile button, while
  aiming at the fire rig. It fails the same way standalone on v138, so the
  overlap is old; v138's own full run must have passed only because of state
  carried over from earlier checks. Fixed in the game: the ring now steps in
  toward the middle of the screen until it is clear of every button. The slot
  check passes in all six viewports.
- **Run 3: 826/826.**

## Judgement calls the parent should look at
- **The booster rocket is rocket-sized, not set-piece-sized.** The launch
  site's tower was built for a 125 m stack. His rocket is the game's usual
  rocket (about 18 m) with side boosters, so it looks small beside the tower.
  Making it the set-piece's size would change every rocket envelope (landing,
  camera, staging), and the brief said the rest of the flight works like the
  other rockets. From the seat on the pad the view is tower and arms (the
  render critic's note).
- **During the booster watch (about 18 s) his controls do nothing** except a tap,
  which ends the watch. The rocket waits in the sky with its engine lit. The
  law reviewer flagged this; I kept it because the brief was "make sure the
  camera gives it to him".
- **The monster truck crushes city buildings up to 22 m tall.** Taller ones stop
  it. Everything comes back.
- **Monster truck dust is gone.** A dust puff from the driving seat was a
  translucent wall across the windscreen, so only the flying pieces remain.
- **Toy-track rear-ending is no longer a bang** (toy cars outrun him). This
  follows "a held finger never bangs" at the faster steps.
- **The carrier's arrester wire no longer takes the helicopter.**

## Reviewers
Law reviewer: PASS on all four. Render critic: PASS on v139, v140 and v142;
**a standing BLOCK on v141** after its three rounds (reported, not argued
down). Rounds (law / render):
- v139: 2 / 2.
- v140: 2 / 2.
- v141: 3 / 3. The render critic's third round blocked three frames for
  missing their moment: crush-chase and house-chase with no pieces in the
  air, and traffic-seat with the knocked car out of shot. In the game the
  pieces and the car do fly (the frames were taken a beat early or late, and
  `monster_checks` measures the thrown car in the air). I re-shot all three
  after that round, and they have not been re-judged: **look at
  `evidence/monster/` before merging v141.** Its standing note: the
  city traffic's own knock puff (in `streets.js`, not this work) ghosts a car
  in `tower-chase`.
- v142: 1 (PASS, notes fixed) / 3.

Standing notes not fixed:
- The monster's seat view against a tower shows only a wall.
- The heavy's seat on the pad shows the tower and arms.
- The jump frames for the toy track show height weakly with no ground shadow.

## v143 — the monster truck, after the parent's notes on v141

Commits `db21b83` and `ed30384`. Renders: `evidence/monster143/`.
- **Crushing is instant on contact.** It needed 1.5 m/s before; stopped
  against a house, he only pushed at it. Now the first touch goes through.
  The check (it fails on v142): parked touching a house, the first push
  takes it within 6 frames, with at least 15 pieces thrown by that crush.
- **No countdown reads as a wind-up.** The 5-4-3-2-1 over the crush frames
  was the launch site's: the arena's ramp points straight at it. In the
  monster truck, no set-piece starts a countdown while he is inside the
  arena, or for 4 seconds after a crush. Out on the road he can still point
  at one and set it off (checked both ways). My first version silenced every
  set-piece in the truck; the law reviewer blocked that as more than the
  brief asked.
- **The crush reads in one frame.** The whole thing crushed vanishes. That
  includes every tier of a city building, which used to leave its upper
  parts standing. In its place a cloud of 24 to 70 blocks fills its shape,
  bursts outward and tumbles down. No dust, nothing starts near the cab, and
  its pieces go when it pops back. A knocked car is thrown up and ahead,
  over the bonnet, where he sees it from the seat.
- **The driving seat.** The eye is 11.5 m up, behind a blue bonnet with yellow
  racing stripes and a steel scoop, with the tops of both front wheels in the
  bottom corners and a wider lens. The cab is not drawn from inside it.
  Traffic sits small below (checked: a car 40 m ahead is under 6% of the
  picture's height).

Reviewers: law-reviewer PASS (round 2, after the set-piece block above).
render-critic PASS on a fresh set of frames (round 2, after a block on the
seat view of the traffic knock; the car now flies over the bonnet).
Standing notes: the tyre tops from the seat are plain black slabs with no
hub or tread, and are only weakly wheels; no frame shows a car right
alongside to prove the bonnet clears its roof.

Full harness: **829/829** on `ed30384`, one uninterrupted run with nothing
else running. The run before it was 828/829: the new instant-crush check
saw a small town house burst into 14 live pieces against a threshold of 15.
The cause was real. The minimum burst was 12, trimmed by the clearance
around the cab, and the check read a live total that drifts across a long
run. Now the smallest burst is 24 pieces, and the check counts this crush's
own pieces.

## Notes for the parent
- Branch `overnight-2`, local only: nothing pushed, merged or deployed.
- PLAYTEST.md has today's entry and the open predictions scored against it
  (only three had any evidence). It also has one prediction row for each of
  v139-v142.
- Worth trying on the iPad first: the helicopter coming down on a skyscraper's
  roof, the toy track's new signs and jumps at the fast step, and the booster
  rocket's watch in portrait.
- All frame costs are SwiftShader proxies, not the iPad.
