# Queue — what to build next, in order

Read this at the start of every session and after every release ships; start the top
open item. Tick an item (`[x]`, with its merge commit) when it ships. A bug found along
the way goes BELOW the tracks, unless it makes the game crash, get stuck or show text,
in which case it goes to the top.

## Releases

1. [x] **v174 Snowy Peaks** (shipped 2026-10-21, merge 43bfa0b) — a race track in the snow mountains: an icy hairpin, a tunnel through the mountain, a frozen-lake crossing, snowbank walls; snow and ice surfaces; laps about 2 minutes, 3 laps.
2. [ ] **v175 Beach Splash** — a race track along the beach: sand and shallow-water splash sections, a jump; laps about 2 minutes, 3 laps.
3. [ ] **v176 Sky Glow Road** — a glowing race track up in the sky: a road in the air with a jump; laps about 2 minutes, 3 laps.

Every track: about 50% wins per car, 0 bangs, 0 stuck, wall-hugging slower than the racing line.

## Bugs (below the tracks)

- [ ] The Corvette's seat-view mirror flames are the brightest thing in the seat view (render-critic note, v166) — readability only.
- [ ] Snowy Peaks looks (render-critic notes, v174): dark-green wedges where the lake's ice road meets the shore; the tunnel mountain reads as a grey dome from its shaded side; snow off the track carries the grass detail tile (green blotches) -- readability only.
- [ ] Perf: the solids registry is one flat list walked by every solidQuery. The three race venues add about 2,300 boxes (Snowy Peaks 1,324 of them: barriers and the tunnel mountain), and on a headless timing solidQuery went from 309 to 381 µs a call against main. A coarse spatial index would make the venues free. Measure on the iPad first (polish_check).
- [ ] Race spray reads as rocks (render-critic note, v175): the wheel puffs off sand, dirt and the splash are large faceted spheres, and in the foreground of the chase view they look like boulders rather than dust or water; the splash's never reads white -- readability only.
