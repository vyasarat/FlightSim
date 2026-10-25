# Queue — what to build next, in order

Read this at the start of every session and after every release ships; start the top
open item. Tick an item (`[x]`, with its merge commit) when it ships. A bug found along
the way goes BELOW the tracks, unless it makes the game crash, get stuck or show text,
in which case it goes to the top.

## Releases

**Races like a kart game (the parent, 2026-10-23, after "racing is just circling the track"):**
something happens every few seconds. All original -- no Nintendo names, characters, logos or
item designs. These three come ahead of every bug except a crash, stuck or text. Checks each
release: about 50% wins per car with the new things in, 0 bangs, never stuck more than 2 s,
and the noisy finger plus random taps on the item button can play a full race; count the
"things that happen" per lap (items, events, jumps) and aim for one every 5-10 s; render
every item and event from the chase cam and the seat. Full loop, ship each when it passes.

- [x] **v187 Power-ups** (shipped 2026-10-23, merge 604c5ff; 1189/1189, sweep 69/69, win 45-56% per track with random taps) -- rows of glowing boxes across every track; he steers through one
  to grab it (aiming, not timing). One big pulsing item button shows the item's picture; tap
  to use -- the only new button (the parent's exception, in CLAUDE.md). Items: rocket boost;
  bubble shield (blocks one hit); a bouncing ball that chases the car ahead and spins it out;
  an oil slick dropped behind; GIANT MODE (his car grows huge for about 6 s, other cars
  bounce off him). Rivals get items too and use them on him. A spin-out is short (about 1 s),
  dramatic, never a bang, never stuck. Cars further back get better items, so it stays close.
- [x] **v188 A finger in a race is never eaten** (shipped 2026-10-23; 1191/1191) (found in v187, a STUCK-class bug, so it comes first): in a
  race, from the driving seat, the car's map screen is hidden (race.js) but `carScreenTap` (car.js) still
  raycasts against it -- a finger landing where it sits (the middle of a landscape iPad) toggles the hidden
  map and steers nothing. Since v164. Make the tap ask whether the screen is drawn; a check that touches
  every part of the screen in a race, both seats, portrait and landscape, and steers from each.
- Track events (the parent, 2026-10-23: one release per track, the oval's real loop LAST so it holds nothing up) --
  all machines or nature, never animals; each announced (seen coming) and dodged by steering:
- [x] **v189 Desert Dunes events** (shipped 2026-10-23, merge 953c306, 1196/1196) -- rolling boulders across the road; and the freight train: the road JUMPS a
  cutting the train runs through below (the parent's choice), its barriers dropping at the cutting's edges with
  lamps flashing as he comes -- he flies over the train, never stops for it.
- [x] **v190 Snowy Peaks events** (shipped 2026-10-24, merge c8331f7, 1201/1201) -- rolling giant snowballs, an avalanche on lap 3, a ski jump.
- [x] **v191 Beach Splash events** (shipped 2026-10-24, 1205/1205) -- waves that wash over the road, and a pirate ship firing water cannons.
- [x] **v192 Sky Glow Road events** (shipped 2026-10-24, 1209/1209) -- wind gusts and spinning boost rings.
- [x] **v193 Oval events** (shipped 2026-10-24, 1212/1212) -- a REAL vertical loop-the-loop every car drives round upside down (the road funnels into
  it and widens after), and a stunt ramp.
- [x] **v194 Big moments** (shipped 2026-10-25, 1216/1216) -- hold the drag through 3-2-1 for a rocket start; every jump does
  an automatic flip with a small boost; final lap: the music speeds up, the crowd gets
  louder, and a short cut opens that was not there before; a close finish gets a slow-motion
  photo finish.

**Earlier releases:**

0. [x] **v177 Harness back under 45 minutes** (shipped 2026-10-21, merge 70fdc37; 38.7 and 42.7 min; harness only, no deploy) — v176's full run took 1 h 48 m. Time every module, list the 5 slowest and what grew; move long sweeps into their own script that runs when a race or track file changes, keeping a small sample in the harness; list every check that moved and where it now runs; prove it with two green full runs, both under 45 min.
1. [x] **v174 Snowy Peaks** (shipped 2026-10-21, merge 43bfa0b) — a race track in the snow mountains: an icy hairpin, a tunnel through the mountain, a frozen-lake crossing, snowbank walls; snow and ice surfaces; laps about 2 minutes, 3 laps.
2. [x] **v175 Beach Splash** (shipped 2026-10-21, merge 4472501) — a race track along the beach: sand and shallow-water splash sections, a jump; laps about 2 minutes, 3 laps.
3. [x] **v176 Sky Glow Road** (shipped 2026-10-21, merge 3b9a7b9) — a glowing race track up in the sky: a road in the air with a jump; laps about 2 minutes, 3 laps.

Every track: about 50% wins per car, 0 bangs, 0 stuck, wall-hugging slower than the racing line.

## Bugs (below the tracks)

- [ ] **The harness is 65 min, not 45** (v195): the shards finish in 34 min, but the solo phase now runs rocketsled_checks (15.7 min even alone), launchsite_checks (8.9) and monstertruck_checks (4.1) after them. Find what in those three takes so long (each renders a set-piece at many viewports, in both cameras) and cut it, or sample it in the harness as v177 did for the race sweep. FOUND SO FAR (2026-10-25): it is NOT the work -- rocketsled_checks takes 44 s through run_module.js (22 checks, the slowest 8 s), and 15.7 min in the harness's solo phase with nothing else running; both browsers are the same SwiftShader (ANGLE/Vulkan, checked). So something the harness process keeps alive slows every render about 20x -- suspect the inline phase's main page still open and its queued frames (as v154), or the watchdog. Next: run HARNESS_SHARDS=1 with only rocketsled_checks, then with the main page closed first.
- [x] **Harness stall under load** (resolved 2026-10-25 in v194, merge fc7f17c: not a hang -- launchsite_checks and monstertruck_checks ran 20x slower beside three busy shards and crossed the 20-min stall line; both now run in the solo phase, 5.0 and 3.4 min) (found v194; very likely the v190 "sleep" stall too): in the full run, a shard can stop for 20 min on a check that renders -- launchsite_checks after "at 844x390, in both seats, the countdown numeral", monstertruck_checks at "the frame" (renderer.render in a loop). Both pass alone in 38 s and 134 s; the shards before them ran no race code (heli/inline; corner_cam/boat). A check that passes alone and stalls in the full run is a harness bug: find what is carried in (leaked page or GPU frames, as v154) and reset it.
- [ ] (2026-10-25, time-boxed, still open: RULED OUT by render with each switched off -- Sky Glow Road's glow, the ship's ball trails, the sun's halo and lens, the speed lines; a direct-render probe at the same place does not show it, so it is timed or random -- next suspect the ambient whale's spout/breach, seaevents/ambient) A floating white arch and a thin vertical white streak hang in the sky over the land, east of Beach Splash's lagoon, in every lagoon frame (render-critic, v191: "a stray floating glyph"; not part of v191 -- nothing of it is near them). Find what draws them (suspects: the Sky Glow Road seen from 5 km, or an ambient sea creature off its water) and make it read as what it is, or not draw it there.
- [x] **v179** (shipped 2026-10-21, merge 2ce2153; venues cut into 600 m pieces and culled past the fog by view depth; runway 513k -> 361k triangles) Perf (found in v177): a drawn world frame got dearer with every venue -- the harness's FPS smoke test went 4 -> 3 fps from v173 to v176, and a synced runway frame is 240 ms under SwiftShader (565 calls, 491k triangles). Find out whether the race venues are drawn from everywhere (merged meshes spanning kilometres are never culled); if so, cull or LOD them. A game change, for its own release; measure with polish_check (calls/tris) first.
- [x] **v178** (shipped 2026-10-21, merge 2f20edf) The Corvette's seat-view mirror flames are the brightest thing in the seat view (render-critic note, v166) — readability only.
- [x] **v180** (shipped 2026-10-21, merge 23968f5) Snowy Peaks looks (render-critic notes, v174): dark-green wedges where the lake's ice road meets the shore; the tunnel mountain reads as a grey dome from its shaded side; snow off the track carries the grass detail tile (green blotches) -- readability only.
- [x] ~~Perf: the solids registry is one flat list walked by every solidQuery~~ -- DROPPED 2026-10-21 by the parent's rule (change it only if the lookup costs >= 1 ms AND >= 5% of a frame). Measured on main b72575d, SwiftShader on the Mac, real rAF loop, held finger, 4 alternated samples a scene; frame ms is the CPU of the rAF callback (GPU work not in it): New York in the car 2 walks/frame x 389-431 us = 0.78-0.86 ms of a 3.0-3.7 ms frame (23-26%); race Snowy Peaks 1 walk (the race camera's solidSight) x 225-328 us = 0.23-0.33 ms of 2.6-3.1 ms (9-11%); race oval 1 walk x 315-358 us = 0.32-0.36 ms of 3.7-4.8 ms (7-9%). All under 1 ms, so no change. Not covered by the rule's scenes: the monster truck in a city makes 12 walks/frame, 7.7-8.4 ms of update() -- for the parent to decide. Unused WIP (an equivalence check and a solids.js reorder) is on branch solids-v181 (765bcd9).
- [x] **v181** (shipped 2026-10-22, merge a30f0ea) Race spray reads as rocks (render-critic note, v175): the wheel puffs off sand, dirt and the splash are large faceted spheres, and in the foreground of the chase view they look like boulders rather than dust or water; the splash's never reads white -- readability only. **v181 render gaps checked, PASS** (2026-10-22: a neutral render-critic on snow before/after, night snow, the closest puffs from the seat, dusk and night on dunes and beach, all rivals bunched; frames in the v181w scratchpad, evidence/r181g).
- [x] **v182** (shipped 2026-10-22, merge 98e60bc) The Corvette's mirror paints a DAYTIME sky in every sky mood (found in v178): at dusk or night the glass is a pale strip on a dark screen. Paint its sky from `state.sky`/`nightF`, and add a dusk scene to corvette_checks k (mirror no brighter than the world) -- readability only.
- [x] **v183** (shipped 2026-10-22, merge a3fcdca; the ground within 150 m of a snow venue's line is snow, easing out by 300 m) Snowy Peaks banks show tan/olive patches in places (render-critic note, v180, there before and after): the far-left bank in `surface:snow` and the snow behind the podium -- find what they are; readability only.
- [ ] (WAITING on a playtest report -- the fade-in is for if anyone notices it popping; nobody has) Snowy Peaks / Sky Glow Road skyline ghost pops at the cull depth (found in v179, accepted): past the fog's far edge a venue piece used to draw as a flat fog-coloured ghost on the skyline; it now appears at ~1.7 km view depth. If he or the parent notices a pop driving toward a venue, fade pieces in over the last 150 m instead of a hard cut -- readability only.
- [x] **v184** (shipped 2026-10-22, merge ad16ada; the race's own soft coloured bursts, placed in open sky clear of every button and HUD) The podium's fireworks are the world's faceted lit spheres (found in v181, render-critic): the bursts over the podium read as grey-yellow and teal lumps in the sky, the same look v181 took off the race's spray -- readability only. They are landmarks.js updateFireworks through wakePuff; the race's own soft puffs (rcPuff) or a glow field would fit.
- [x] **v185** (shipped 2026-10-22, merge f58e2ed) Snowy Peaks' snow edge (found in v183, render-critic and my own high view): where the venue's snow (150-300 m from the line) fades into the grass, the terrain's per-face colour makes a faceted sawtooth from 450 m up and a slightly blotchy band from the low ground south -- the height snow line elsewhere looks the same; renders the critic would still like: the edge from the north and east, the south edge in rain/snow sky -- readability only.
- [x] **v186** (shipped 2026-10-22, merge 992e34a; fireworkSound takes the pop, race.js hands it TUNE's) The firework's bang and its opening are two numbers that must agree (law-reviewer note, v184): `TUNE.race.podium.fw.pop` (0.95 s) is when the sparks open; audio.js `fireworkSound` pops 0.95 s after its whistle, written in the function. Retune one and he hears the bang before or after the sky lights. Make `fireworkSound` take the pop delay (the world's arrival show passing its own) and check they agree.
- [ ] The snow fade's outer ring is not measured (law-reviewer note, v185): check s compares a corner's colour only where the venue's snow is between none and all, so where a fade face (each corner its own colour, at the corner's height) meets a grass face just outside it (one colour a face, at its mean height) a small step may remain -- only the height changes the grass's colour there. Measure it; fix only if a picture shows it.
- [ ] v187 power-ups, render-critic notes (PASS, nothing failed): the monster truck's boost flames start behind its rear
  wheels, laid on the road rather than out of the truck; render a slick at 20 m (chase and seat) to show it grows readable;
  render a giant monster truck with a rival close by, a shield taking a hit, him driving over oil, a rival using boost,
  shield or giant. `race_renders.js` item:/itemSeat:/hold: views.
- [x] **v195** (shipped 2026-10-25, merge 3e2857f; the door tops lowered below the dash line as he sees it, race_checks l) Landscape race seat: a big flat black slab across the left of the windscreen (render-critic, v187; there on main
  too -- `VP=1180x820 race_renders.js overtakeSeat`): cabin geometry (the door or mirror) at the landscape aspect. Readability.
- [x] (no longer so, 2026-10-25: measured 40 races a car with the noisy hand and random taps -- v192 car 47%, Cybertruck 53%, Corvette 47%, Monster 53%; v194 63/55/55/55: the Corvette wins no more than the rest) Sky Glow Road favours the Corvette (found in v187, there on main): the noisy hand won 16 of 20 there in the
  Corvette against 11 in the SUV with no power-ups (v186), and 18 of 20 with them. Every car runs one speed
  model, so it is the body: find what of the Corvette's (its length, its width, the booster's release) wins
  it the sky's bends, and make it the same for every car.
- [ ] v181 spray, renders the critic would still like (not bugs, nothing failed): five rivals 15-25 m ahead of the SEAT camera (beyond the near fade); the staged near-puff row from the chase camera on sand, dirt and snow; his own spray over his car from the chase camera, unstaged; a depth check that a puff just past the bonnet is hidden by it; Desert Dunes sand at dusk/night (the beach's overwrote it); a short sequence of a puff fading as it nears the camera. `scripts/race_renders.js` has the views (bunch, closeSeat, puffAt, puffAtSeat, NIGHTF=).
