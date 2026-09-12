# Connected-world review

Branch: `cockpit-3d`. **Not deployed.** Read-only inspection found deployed revision
`767ddb7d03b6e767e86da1bf1c8dd205ae2b7eb7` (v114); its source tree matched the
starting branch revision `218a520`.

Local playable preview: <http://127.0.0.1:8180/cockpit/>. To restart it from the
repository root: `python3 -m http.server 8180`.

## Checkpoints

- `0f365be`: contextual hop-in, persistent parked vehicles, Mars rover/drone;
  168 focused behavioral checks before the next milestone.
- `8fb10bb`: carrier/cargo carriage, helicopter transfers, pursuit routes,
  drawbridge and fire dock; 72 focused checks plus all 168 hop checks.
- Milestone 3: two portrait outings through normal on-screen touch controls,
  interrupted inputs, a midway switch and return to the same parked car.
  The touch driver reads position to aim and advances the simulation at 60 Hz;
  it does not teleport or write movement state.

## Review route

Pick the prop plane and the palm/coast direction. The nearby car appears in
the contextual hop button. Follow the road to the harbor and hop into the
speedboat; return to the parked car and then the original aircraft. The existing
slow speed step makes the dock approach easy. The picker remains available.

Other repeatable connections: land the helicopter on the carrier or yacht and
hop into the jet/tender; drive onto the carrier or through the cargo Starship
bay; lead the police across the drawbridge and onto the track; drive to the
fire-facing pier and use the speedboat cannon.

## Evidence and verification

Final gate: **897/897 passed**, up from 621 (+276): 180 hop checks,
80 connection checks and 16 outing checks. The hop/connection matrix covers
390×844 and 844×390 in chase and cockpit views. Both portrait touch outings
completed, including interrupted inputs, a midway switch and replay.

All generated evidence is local and gitignored under `evidence/connected-world/`:

- `full-harness.log`: aggregate behavioral and visual-baseline regressions.
- `gallery.html`: local render index (111 hop, connection and outing images).
- `offline-results.json`: cached reload and touch hop to car, all models ready,
  no page/frame errors. The worker was registered explicitly on local HTTP.
- `eject-surface.log`: on-screen Mars rocket, rover and drone ejection round
  trips preserve surface progress and return safely. Its touch driver now uses
  the existing rover steering sign.
- `hop-*.png`: each hop-in, portrait/landscape, chase/cockpit views, plus Mars
  base inspection views.
- `connection-*.png`: every connection in both orientations and views;
  `overview` files are supplementary inspection cameras.
- `outing-*.png`, `outing-trace.json`: the two actual touch-controlled outings.
- `performance-paired.json`: two complete interleaved A/B runs against the
  deployed source, across airport, harbor/police, carrier and cargo scenes.
  SwiftShader software rendering, **not an iPad measurement**. Frame time
  includes blocking pixel readback; draw calls/triangles include shadow passes.

Run `node scripts/headless_test.js` with `CHROME_HEADLESS_SHELL` pointing to
Chromium and `NODE_PATH` providing `playwright-core`. Focused runners are
`node scripts/connected_test.js`, `--connections`, and `--outing`.
Run `node scripts/connected_perf_pair.js` with the same environment and
`LP_POLISH_ROOT` pointing to a clean checkout of `767ddb7`. Do not run browser
workloads alongside the performance comparison.

The heaviest measured scene by triangles was the harbor with an active police
chase, landscape 844×390, chase view. Both runs alternated A/B order every
frame, with four warmups and twelve measured pairs per case (32 cases total).

| Run | Median frame ms, deployed → branch | Median update + submit ms | Draw calls | Triangles |
|---|---|---|---|---|
| 1 | 109.1 → 142.3 | 2.4 → 2.6 | 246 → 274 | 239,371 → 318,426 |
| 2 | 104.6 → 141.9 | 2.2 → 2.4 | 246 → 274 | 239,371 → 318,426 |

This is a measured rendering increase, not a performance-neutral change.
Parked-model culling was reduced from 1,800 to 500 world units after the first
comparison; nearby hop targets retain their existing models. The software
frame figures include blocking readback and do not establish iPad frame rate.
The raw result includes every orientation/view and p95 samples.

Legacy assertions now recognize the eight added road records and the intentional
hop-button context. The tunnel fixture resets a top speed inherited from its
earlier crossing to existing cruise. No check was removed and no numeric
vehicle baseline was regenerated.

## Preservation

`flight.js`, `heli.js`, `car.js`, `boat.js`, every pre-existing TUNE value and
the 60-number `scripts/vehicle_baseline.json` are unchanged. Yacht movement and
camera equations are unchanged; its surface query also recognizes the carrier.
Existing activities remain independent. New behavior is in `hop.js` and
`connections.js`, with button, lifecycle and police-route integration.
The dormant Mars rover preview is aligned with its local ground normal.
The drone's keyboard action asks its existing eligibility predicate so hiding
the duplicate nearby button does not remove F/Enter entry or return.
Both service-worker caches are bumped. No binaries or generated evidence are
committed; `CLAUDE.md` remains below 150 lines.
