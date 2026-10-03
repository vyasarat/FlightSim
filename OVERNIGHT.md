# Overnight — building out the world

Branch `overnight-world`, from `cockpit-3d` with `origin/claude/self-improvement-loop`
merged in. Nothing pushed, nothing merged into `main` or `cockpit-3d`, no deploy, no ssh.

All four builds use the loop he already knows from the demolition block. There
is a giant obvious thing with a pulsing red target ring. He points at it (car,
plane or helicopter), big numerals count down in the sky, there is a huge
payoff, and it puts itself back for next time. There is nothing to press,
nothing to miss and nothing taken away. No control, flight feel or stick
meaning changed. No new button, no permanent HUD, nothing persists or counts,
and no dependency was added.

## What was built

### v133 — a rocket launch beside the motorway (`b8f42bf`)
A rocket as tall as a skyscraper stands on a pad right beside the motorway on
the plains. When he points at it, big numbers count 5-4-3-2-1 and it blasts
off in a cloud of smoke, and its two side boosters fly home and land upright on
their own pads with a double sonic boom. A fresh rocket then rises out of the
pad, ready to go again.
Renders: `evidence/launchsite/`

### v134 — a rocket sled and a wall of giant toy bricks (`77a773e`)
In the desert just past the mountain tunnel, a red rocket sled waits on a rail
beside the road, under a tower of traffic-light lamps. When he points at the
brick wall down the rail, the lamps go red, amber, green with 3-2-1. The sled
rockets off at 120 m/s and smashes straight through a house-sized wall of
coloured toy bricks, pops three parachutes and stops. When it rolls home, every
brick flies back into the wall.
Renders: `evidence/rocketsled/`

### v135 — a fireworks barge on the great lake (`0f69d06`)
A red barge stacked with coloured firework tubes floats on the lake next to the
motorway. When he points at it, after 3-2-1 it fires a ten-second show that
builds from single shells to a finale of thirty at once: coloured bursts,
rings and gold willows, each with a boom. It then rests and is ready to go
again.
Renders: `evidence/fireworks/`

### v136 — a monster truck that squashes junk cars (`20113e9`)
On a dirt loop beside the motorway, a giant blue monster truck with wheels as
tall as a house waits behind a ramp, with six old junk cars parked beyond it.
When he points at it, after 3-2-1 the truck roars off, flies off the ramp, lands
on the cars and squashes all six flat. It drives round the loop home, and the
cars pop back up one by one. The truck has dark windows and nobody inside; the
cars are empty wrecks.
Renders: `evidence/monstertruck/`

Each has its own check module (`scripts/<name>_checks.js`: 21, 22, 14 and 12
checks), wired into the gate and the full harness, and a render script
(`scripts/<name>_renders.js`). Every check drives the car **hands-off** past it
and asserts zero bangs, touches and off-road time. Each also asserts that
nothing it throws (cloud, bricks, stars, dust) reaches the road, that the
payoff lands in his **portrait** windscreen at every speed step, that pointing
away does nothing, and that it is solid where it stands.

Two shared pieces came out of it:
- **One countdown at a time.** The four share the existing big numeral through a
  small registry in `setpieces.js` (`spCountRegister` / `spCountBusy`). None
  starts while another is counting, and each stands down for a police pull-over
  or the picker. The sled's check found a same-frame race here, where two
  countdowns could start on the same frame, and it is closed both ways.
- **The car arms by his speed.** In the car, each one starts when its payoff will
  land a fixed distance ahead at the speed he has set. That puts it in the
  windscreen at every speed step, both ways.

### v137 — no bang at the merge, and the new set-pieces leave the traffic alone (`f1e576c`)
A fix, nothing new to see. Leaving the giant toy track by its exit lane could
end in a bang just as the road back joined the motorway. A traffic car was
driving level with him in the lane he was joining, and the traffic only made
room for cars ahead of or behind him. Now a car level with him moves over or
drops back. The four new set-pieces are also built so they no longer move
where the traffic is.
Renders: none (no visible change).

## Full harness on the final state

**757/757**, one uninterrupted run on `f1e576c`, nothing else running
(`node scripts/headless_test.js`, about 40 minutes).

Along the way:
- v134 state (snapshot run): **730/730**.
- v136 state: **755/756**, twice. The toy track's exit-lane check touched a
  traffic car at the merge; the second run's diagnostics named it. That led
  to v137.
- About the v137 fix, honestly: the touch was seen twice in the full run and
  twice alone, then not again with nothing in the game changed. Where the
  traffic stands at that moment is not fixed by the seed alone (my guess is
  model-load timing, which I did not prove). So the new check places the traffic
  instead. It proves the move-over half of the rule (it fails with the rule
  off). It does not separately prove the drop-back half, because on that road
  a level car clears him anyway as he slows.
- Noisy-finger drive (the city habit, since `highway.js` changed), seeds 3 and
  11: 5/5 turns meant and made, 0 unintended, 0 missed, 0 bangs, 0 touches,
  0 off-road, way in, way out and merged on both.

## What the reviewers still object to

Every release ended with PASS from both `law-reviewer` and `render-critic`
(v133: 2 rounds each; v134: law 2, render 3; v135: 1 each; v136: 2 each;
v137: law 3, no render). None blocks. Their standing notes, not fixed:

- **From the car, the payoffs are small.** The pad, rail, barge and truck stand
  110–190 m off the road, so from the driving seat each show is a few dozen
  pixels at the edge of the windscreen. The helicopter and plane views are
  where they are big. Bringing them closer would put debris and cloud into the
  road's corridor, which the checks forbid.
- **The target rings are small from the car** (about 30–50 px at 500–900 m), and
  in places an existing yellow gate ring nearer the road competes for the eye.
- **The rocket sled's three parachutes** stack edge-on from some side views:
  two domes and a red hoop rather than three equal chutes.
- **The monster truck has no shadow** under it in the air, so its height over the
  cars is ambiguous at a glance.
- **`launchsite_checks` holds the monster truck off** during its hands-off drive,
  so its numerals are the pad's. No check drives the real sequence with both
  live: the truck's show, then the pad's.
- **v137's drop-back branch is unproven** (see above), and no check notices if
  the set-pieces' `vkQuiet(0, …)` wraps stop protecting the traffic's random
  stream; only a full run would show it, as it did tonight.
- **Existing, not this work:** the speedometer numerals on the dash are numerals
  that show state, outside the "numerals only on a wind-up counter" rule. Both
  critics flagged them every round. They predate tonight and are left for you
  to rule on.

## Notes for the parent

- The two reviewer agents arrived with the self-improvement-loop merge,
  mid-session, so Claude Code had not registered them as agent types. Each
  review was run as a fresh general-purpose agent told to read and follow its
  `.claude/agents/*.md` file exactly: same instructions, same read-only rules,
  fresh context.
- The "white-out" frames a reviewer caught in the monster truck renders were the
  existing red-light camera flash (`lights.js`). The hands-off drive runs a red
  at a junction, and the flash is taken down by a 110 ms wall-clock timeout
  that the render rig's compressed time never reaches. In the game it is a
  blink. The render takes it down; the game is unchanged.
- PLAYTEST.md has a prediction row for each release, ready for `/retro`.
- Before merging, worth a look on the iPad: the four shows from the **driving
  seat**. That's where the reviewers found them smallest.
- None of these has been seen on an iPad. All frame-cost numbers are SwiftShader
  draw-call counts: 21/31 (standing/through the show) for the launch site,
  18/25 for the sled, 10/21 for the barge, and about 33 for the truck.
