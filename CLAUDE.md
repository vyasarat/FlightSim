# Little Pilot — working rules

A no-reading, no-failing flying game for a 4-year-old. `README.md` says what the
game is; `CHANGELOG.md` says what shipped when. This file is the rules every
change must respect, the map, and the checklist for shipping one.

Per-feature implementation detail lives in a **WORKING RULES** comment at the top
of the file it concerns. Read that file before changing it.

## Design rules (never break these)

- **Zero text** in the UI: icons, silhouettes and numbers only. The harness audits
  every DOM text node. `<title>` and `alt=""` are fine; nothing else may render text.
- **Nothing living gets shot, hit or destroyed.** Targets, traffic and anything that
  explodes or shatters are vehicles, machines and objects only — the *target* flocks
  are paper planes for exactly this reason. Living things are fine where nothing can
  happen to them: the astronaut in the station, on a spacewalk or in the rover, and
  the ambient birds in `ambient.js`, which are not targets, not solids, carry
  `noSolid`/`noShatter`, and are flown straight through in a harness check. Make
  anything living hittable and it has to become a paper plane too.
- **Nothing is ever taken away**: no score, no timers, no unlocks, no failure state.
  Every crash explodes and reassembles for free; every reward re-arms.
- **Pointing, not timing**: every control is "aim at it", never "press at the right
  instant". Assists (approach alignment, flare, rocket landing assist) exist so that
  *coasting in* works.
- **Drag up = nose up**, never inverted. Keyboard mirrors this (arrow-up = nose up).
- **Flight feel is tuned with the kid** (`TUNE` flight-feel block): don't retune it.
  Landing-assist strengths (`align*`, `touchdown*`, flare, rocket assist) may be
  weakened gradually as he improves.
- **Readability beats realism.** Nothing gets darker or muddier; silhouettes stay
  bold and the horizon stays clear. If an effect hides something he needs to see,
  it goes — that has already overruled a brief twice.

## Architecture (these bite)

- `cockpit/js/*.js` are classic scripts sharing **one global scope**, loaded in the
  order listed in `cockpit/index.html`. Two consequences, both of which have cost a
  day: a top-level `const`/`let` used *at load time* must be declared in an earlier
  file (using it later, inside a function, is fine); and a later `function foo`
  **silently replaces** an earlier one of the same name. The harness checks that no
  top-level name is declared in two files. Prefix anything new.
- Buttons share a few fixed slots (`--stack-bottom`, the top-left corner). Two
  visible at once and the one later in the DOM silently eats the tap — the harness
  checks this across every state. Decide a slot button's visibility *before*
  `updateRocket`'s rover / astronaut early returns, or whatever was up when he
  climbed out stays up over the button he needs.
- Set-pieces (`setpieces.js`) all run one loop: giant obvious thing → one aim or one
  pulsing control → visible wind-up → huge payoff → free reset. **No unannounced
  bangs**: every explosion or collapse gets a build first (beacons, rumble, the
  shared `#bigNum` countdown — numerals only, and only while a wind-up runs). One
  hero effect each, structures and machines only, at most one new contextual button.
- Space events are drawn once per pad spawn and armed only by a real liftoff. An
  event may never be required, block anything, or take anything away.
- The rocket's landing envelope (`landMax*`, `landPadR`/`landDeckR`/`landCatchR`)
  says what counts as a landing; everything else crashes, and a crash stays free.
  Assist strengths are separate knobs (`assist*`) — the assist may stand him up,
  never rescue a last-second dive.
- **No post-processing stack, and there is not going to be one.** Every glow is an
  additive billboard on one shared texture (`glowSprite`, or `glowField` for many at
  one draw call). On an iPad a full-screen bloom costs more than all of them together.
- There is no weather/sky button; the sky moods stay in code (`state.sky`).

## The map

| file | what it owns |
|---|---|
| `nozoom.js` | loads **first**; stops iOS Safari zooming (pinch, multi-touch, double-tap) |
| `tune.js` | every gameplay number: `TUNE`, `.rocketTune`, `.marsBase`, `.heli`, `.toyWorld`, `.eject`, `.light`, `.sky`, `.water`, `.audio`, `.camera`, `.ambient`, `.palette` |
| `terrain.js` `scene.js` | the world, the sea, lighting and the shadow rig |
| `sky.js` | sun, halo, haze, cirrus, stars, the shared glow helpers |
| `flight.js` | the plane flight model and the frame loop |
| `heli.js` | the helicopter's own model — it owns ground *and* air for that vehicle |
| `rocket.js` `recovery.js` `rover.js` `events.js` | rocket spine, droneship/net boat, surface buggy, per-launch event |
| `setpieces.js` `marsbase.js` | demolition, tower-catch, fire rig, carrier / the Mars base and its toys |
| `toyworld.js` `workshop.js` `toyfinish.js` | airport magnet yards, ramp and pinwheels, toy/fleet finish |
| `eject.js` | one-tap rescue |
| `ambient.js` | birds, high airliners, flags — things that move on their own |
| `audio.js` | the mix, the ambient beds, layered events |
| `vehicle.js` | vehicle models, the cameras and camera feel |
| `main.js` | the rAF loop and the `window.__lp` test surface |

`TUNE.palette` is the canonical ~21 colours; every colour snaps to one unless it is
an airliner livery or a signal lamp. Flat shading is applied once, at the top of
`scene.js`, by defaulting `flatShading: true` on the two lit material constructors —
don't chase it per literal.

## Adding a file under `cockpit/js/`

1. Add a `<script src="js/….js">` tag in `cockpit/index.html` in the right order.
2. Add `"./js/….js"` to `ASSETS` in `cockpit/sw.js`.
3. Bump `CACHE_NAME` in `cockpit/sw.js`.

## Testing habits

- **Behavioural checks over existence checks.** The first audit found a train that
  had never rendered, a glide arrow with the wrong sign and "shelved" vehicles that
  were still tappable — all under a green harness that only checked things existed.
- Long sections reuse one page and state carries between checks. Reset what you
  touch, or give a check its own page (`newPage`) when it lands or respawns.
- The harness stubs `requestAnimationFrame` and fires only the *last* queued
  callback per pump — game code must not queue its own rAF callbacks for timing
  (use `setTimeout` or `frameCount`).
- **Never A/B a performance change in blocks.** Sampling A three times then B three
  times lets machine drift land on one side; it once priced a layer at +19% that
  interleaved sampling showed to be free. Alternate the samples.
- Evidence, screenshots and recordings are **never committed** — they go in the
  gitignored `evidence/`. `scripts/*_check.js` write there.

## Perf

`scripts/polish_check.js <tag>` renders four vantage points in both camera views and
times the heaviest scenes with interleaved A/Bs. It runs under **SwiftShader, a
software rasteriser — not an iPad**. It over-prices fill rate by a wide margin and
under-prices draw calls, so read `calls`/`tris` as the hardware proxy and `cpuMs`
only as a bound.

## Ship checklist

1. Work on `cockpit-3d`. Keep `main` deployable. **Fetch first** — other work ships
   to this repo too, and the published version may be ahead of you.
2. Bump `CACHE_NAME` in `cockpit/sw.js` (and root `sw.js`) whenever anything under
   `cockpit/` changes — `deploy.sh` refuses otherwise, measured against the rev
   currently published. Match `/v\d+/`, don't guess the current number, and check
   the file afterwards: a `sed` for a version that isn't there is a silent no-op.
3. Harness green (it prints the count):
   ```
   CHROME_HEADLESS_SHELL=/path/to/chrome-headless-shell \
   NODE_PATH=/path/to/node_modules \
   node scripts/headless_test.js
   ```
   It serves the repo on :8177 and refuses to start if that port is busy. Don't edit
   `cockpit/` while it runs — pages loaded later would see mixed code.
   `UPDATE_VISUAL=1` regenerates `scripts/visual_baseline.json` after an intentional
   look change; never edit that file by hand.
4. For anything visual, render it and *look* at it — the harness hashes eight scenes.
5. `git push origin cockpit-3d && git checkout main && git merge --no-ff cockpit-3d && git push`
6. `ssh root@138.197.80.104 'cd /root/flightsim && bash deploy/deploy.sh'`
   Rollback: `bash deploy/deploy.sh --rollback`.
7. Add a paragraph to `CHANGELOG.md`.
8. The iPad picks it up on its next launch from the runway menu.
