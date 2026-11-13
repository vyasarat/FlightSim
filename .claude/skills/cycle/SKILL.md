---
name: cycle
description: One full turn of the Little Pilot loop — pick one thing from what the child actually did, build it check-first, gate it, have it reviewed by fresh eyes, run the harness, and ship or stop by the stop rule in CLAUDE.md. Use when asked to "keep building", "run the loop", "do the next release", or /cycle.
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

## 2. Check first, then build — by a subagent

The main session supervises (`CLAUDE.md`, "The loop"): it writes the brief and does not
write game code. Hand the build to ONE subagent (the Agent tool, general-purpose), with a
brief that stands on its own: what he will see, the QUEUE item and its file:line evidence,
the rules from `CLAUDE.md` that bite here, which files it may touch, the check to write
FIRST and see fail (the thing *happens* and is measured, as a delta, in the states he is
really in), every number in `TUNE`, work on `cockpit-3d`, bump `CACHE_NAME`, write the
CHANGELOG paragraph and the PLAYTEST prediction, do not commit to `main`, do not deploy.
Ask it to report: the diff summary, the check failing before and passing after, anything
it cut or was unsure of.

## 3. The inner loop — fast judges, run by the subagent until green

```
node scripts/gate.js            # a second: syntax, scope, wiring, version, changelog, hygiene
node scripts/gate.js --run      # then the modules the changed files answer to
```

The Stop hook runs the gate anyway: a turn cannot end on a failing one. Fix the
change, never the gate. If city or car code changed, `node scripts/noisy_drive.js
300 <seed>` on at least two seeds, and keep the logs. The subagent runs these, and the
race sweep and stream compare the gate asks for; only ONE thing that launches a browser
runs at a time.

**The main session then reads the diff itself** before any reviewer does: it is the
supervisor's review, not the subagent's summary, that decides the next step. If the work
is wrong, send it back with what is wrong (the same subagent, by message). **Two failed
attempts** and the main session writes the code itself.

## 4. Fresh eyes — two reviewers who did not write it (called by the main session)

- **`law-reviewer`** on the diff. Give it nothing but "review the current change".
- Render it (the `*_renders.js` scripts and `art_rig.js`; both seats, portrait),
  **look at the frames yourself**, then give the paths and one line per frame to
  **`render-critic`**.

Fix every BLOCK and send it back. **Three rounds at most**: if either still
blocks, stop and report what it will not pass and why — do not argue it down and
do not ship around it.

## 5. The full harness, once, alone

A subagent may start and watch the run; the main session reads the count and the FAIL lines
itself and makes the ship-or-stop decision (step 6). Merging and deploying are the main session's.

Exactly as the ship checklist in `CLAUDE.md` says: nothing else running, no
edits to `cockpit/` while it runs, output to a file. Report the count, and that
it was one uninterrupted run. A check that passes alone and fails here is a
harness bug: find what was carried in, do not re-run until it is green.

## 6. Ship, or stop (the stop rule in `CLAUDE.md`, "The loop")

Push `cockpit-3d`. When the full loop has passed you may merge and deploy unattended
(step 7). **Stop and report instead** if the harness fails (unless it already fails on
`main` and the next release fixes it), a reviewer blocks three times, the change would
alter how a vehicle feels, or a refactor step cannot show the standing proof. Either way
the report, always in this shape:

1. What it is, in three sentences a parent can read.
2. Judgement calls and anything cut, and why.
3. Harness count; noisy-drive log if it applies; frame time before/after (and
   that it is SwiftShader, not the iPad).
4. What each reviewer blocked and what you did about it; anything they still
   note.
5. The prediction: what he will do with it.
6. What to watch him do, in three lines — this becomes the next `PLAYTEST.md`
   entry.

## 7. Ship

Merge, deploy, changelog paragraph — the ship checklist. Then run **`/retro`**
before starting the next cycle. A cycle without a retro is how the same mistake
gets made in v+1.
