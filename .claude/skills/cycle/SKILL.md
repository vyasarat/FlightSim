---
name: cycle
description: One full turn of the Little Pilot loop — pick one thing from what the child actually did, build it check-first, gate it, have it reviewed by fresh eyes, run the harness, and stop for the parent's yes. Use when asked to "keep building", "run the loop", "do the next release", or /cycle.
---

# /cycle — one release, evaluated before the parent sees it

One turn of the loop ships **one** thing. Every step has a judge that is not
you: the gate, the modules, two reviewers who have not seen the work, the full
harness, the parent, and finally the child. Do the steps in order; do not skip a
judge because the last one passed.

## 1. Start from evidence, not ideas

Read `PLAYTEST.md` (newest entry and the open predictions), then the top of
`CHANGELOG.md`. Choose the one thing to do, in this order of priority:

1. Something he **got stuck on, could not find, or that broke** — it outranks
   everything.
2. Something he **repeated or talked about** — make more of that.
3. Something he **ignored** — do not improve it; leave it alone.
4. Nothing new in `PLAYTEST.md`: the biggest, loudest thing that passes the
   dinner test. If in doubt whether it is exciting enough, it is not.

Say what you picked and why in two lines, and write the **prediction** into
`PLAYTEST.md` under *Predictions*: `vNNN — he will <do or say what>`. That line
is what `/retro` scores later.

**Stop and ask first** if the thing changes a control mapping or flight feel,
adds a permanent HUD element or a second button to a feature, persists, counts
or unlocks anything, reworks a shipped feature, or adds a dependency or build
step.

## 2. Check first, then build

Write the behavioural check before the feature and see it fail: the thing
*happens* and is measured, as a delta, in the states he is really in. Then build
on `cockpit-3d` until it passes. Every number in `TUNE`.

## 3. The inner loop — fast judges, until green

```
node scripts/gate.js            # a second: syntax, scope, wiring, version, changelog, hygiene
node scripts/gate.js --run      # then the modules the changed files answer to
```

The Stop hook runs the gate anyway: a turn cannot end on a failing one. Fix the
change, never the gate. If city or car code changed, `node scripts/noisy_drive.js
300 <seed>` on at least two seeds, and keep the logs.

## 4. Fresh eyes — two reviewers who did not write it

- **`law-reviewer`** on the diff. Give it nothing but "review the current change".
- Render it (the `*_renders.js` scripts and `art_rig.js`; both seats, portrait),
  **look at the frames yourself**, then give the paths and one line per frame to
  **`render-critic`**.

Fix every BLOCK and send it back. **Three rounds at most**: if either still
blocks, stop and report what it will not pass and why — do not argue it down and
do not ship around it.

## 5. The full harness, once, alone

Exactly as the ship checklist in `CLAUDE.md` says: nothing else running, no
edits to `cockpit/` while it runs, output to a file. Report the count, and that
it was one uninterrupted run. A check that passes alone and fails here is a
harness bug: find what was carried in, do not re-run until it is green.

## 6. Stop for the parent

Push `cockpit-3d`. **Do not merge to `main` and do not deploy** until the parent
has looked at the renders and said yes. The report, always in this shape:

1. What it is, in three sentences a parent can read.
2. Judgement calls and anything cut, and why.
3. Harness count; noisy-drive log if it applies; frame time before/after (and
   that it is SwiftShader, not the iPad).
4. What each reviewer blocked and what you did about it; anything they still
   note.
5. The prediction: what he will do with it.
6. What to watch him do, in three lines — this becomes the next `PLAYTEST.md`
   entry.

## 7. After the yes

Merge, deploy, changelog paragraph — the ship checklist. Then run **`/retro`**
before starting the next cycle. A cycle without a retro is how the same mistake
gets made in v+1.
