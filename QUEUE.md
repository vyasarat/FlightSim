# Queue — what to build next, in order

Read this at the start of every session and after every release ships; start the top
open item. Tick an item (`[x]`, with its merge commit) when it ships. A bug found along
the way goes BELOW the tracks, unless it makes the game crash, get stuck or show text,
in which case it goes to the top.

## Releases

0. [ ] **v177 Harness back under 45 minutes** (the parent's, ahead of everything) — v176's full run took 1 h 48 m. Time every module, list the 5 slowest and what grew; move long sweeps into their own script that runs when a race or track file changes, keeping a small sample in the harness; list every check that moved and where it now runs; prove it with two green full runs, both under 45 min.
1. [x] **v174 Snowy Peaks** (shipped 2026-10-21, merge 43bfa0b) — a race track in the snow mountains: an icy hairpin, a tunnel through the mountain, a frozen-lake crossing, snowbank walls; snow and ice surfaces; laps about 2 minutes, 3 laps.
2. [x] **v175 Beach Splash** (shipped 2026-10-21, merge 4472501) — a race track along the beach: sand and shallow-water splash sections, a jump; laps about 2 minutes, 3 laps.
3. [x] **v176 Sky Glow Road** (shipped 2026-10-21, merge 3b9a7b9) — a glowing race track up in the sky: a road in the air with a jump; laps about 2 minutes, 3 laps.

Every track: about 50% wins per car, 0 bangs, 0 stuck, wall-hugging slower than the racing line.

## Bugs (below the tracks)

- [ ] Perf (found in v177): a drawn world frame got dearer with every venue -- the harness's FPS smoke test went 4 -> 3 fps from v173 to v176, and a synced runway frame is 240 ms under SwiftShader (565 calls, 491k triangles). Find out whether the race venues are drawn from everywhere (merged meshes spanning kilometres are never culled); if so, cull or LOD them. A game change, for its own release; measure with polish_check (calls/tris) first.
- [ ] **v178** (branch mirror-v177, paused for v177) The Corvette's seat-view mirror flames are the brightest thing in the seat view (render-critic note, v166) — readability only.
- [ ] Snowy Peaks looks (render-critic notes, v174): dark-green wedges where the lake's ice road meets the shore; the tunnel mountain reads as a grey dome from its shaded side; snow off the track carries the grass detail tile (green blotches) -- readability only.
- [ ] Perf: the solids registry is one flat list walked by every solidQuery. The three race venues add about 2,300 boxes (Snowy Peaks 1,324 of them: barriers and the tunnel mountain), and on a headless timing solidQuery went from 309 to 381 µs a call against main. A coarse spatial index would make the venues free. Measure on the iPad first (polish_check).
- [ ] Race spray reads as rocks (render-critic note, v175): the wheel puffs off sand, dirt and the splash are large faceted spheres, and in the foreground of the chase view they look like boulders rather than dust or water; the splash's never reads white -- readability only.
