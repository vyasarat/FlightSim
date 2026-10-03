---
name: retro
description: Turn what went wrong in the last Little Pilot release into something that stops it happening again — a check first, a rule second — and score the last predictions against what the child actually did. Use after every release, when the parent corrects something, when a new PLAYTEST.md entry lands, or /retro.
---

# /retro — a lesson becomes a check, not a sentence

The loop only improves if a miss changes what the next cycle is **unable** to
do. A sentence in `CLAUDE.md` is the weakest way to do that; a check is the
strongest. This repo already has 687 checks and a rules file twice its budget:
the job here is to move lessons from the second into the first.

## 1. Collect the misses

From this release only:

- every gate failure, module failure and harness failure met on the way;
- every BLOCK from `law-reviewer` and `render-critic`;
- everything the **parent** corrected, rejected or had to ask for twice;
- everything in `PLAYTEST.md` since the last retro: where he was stuck, what he
  ignored, what broke in his hands.

Write each as one line: *what happened — who caught it — how late*. "The parent
caught it" and "the child caught it" are the expensive ones; they are the misses
every earlier judge let through.

## 2. For each miss, the cheapest judge that could have caught it

Ask in this order and stop at the first yes:

1. **Can a file prove it?** (a name declared twice, a file not wired, a version
   not bumped, a binary staged) → a check in `scripts/gate.js`. It runs every
   turn.
2. **Can the running game prove it?** (he passes through a wall, a button eats
   another's tap, a held finger bangs) → a behavioural check in the module that
   owns the file, as a delta, with its state reset. Add the file → module line
   to `MODULES` in `gate.js` if it is missing.
3. **Can a picture prove it?** (hidden, unreadable, text, broken geometry) → a
   line in `.claude/agents/render-critic.md`, and a vantage added to the render
   script so the frame exists next time.
4. **Is it a judgement no machine makes?** (not exciting enough, wrong kind of
   feature, a control that fights him) → a line in
   `.claude/agents/law-reviewer.md` if a reviewer could have said it, otherwise
   one sentence in `CLAUDE.md`, in the section it belongs to, saying what it
   cost.
5. **A one-off.** Write nothing. Most misses are not lessons.

Prove a new check works: make it fail on the bug, then pass on the fix.

## 3. Pay for what you add

`CLAUDE.md` is read in full at the start of every session, so every line costs
attention on every task. For each rule you add, find one to cut:

- a rule a check now enforces shrinks to one line naming the check;
- per-feature detail moves to the **WORKING RULES** comment atop its file;
- a rule about a feature that no longer exists goes.

The file must not be longer after a retro than before it.

## 4. Score the predictions

In `PLAYTEST.md`, each release carries a prediction (`he will …`). For every one
that now has a playtest entry after it, mark it **hit**, **miss** or **never
found it**, with the line of evidence. Do not mark anything from a harness
result — only from what he did.

Then read the last ten marks together. Three misses of one kind is a pattern,
and a pattern changes what `/cycle` picks: write it under *What works / what
does not* at the top of `PLAYTEST.md`, in his terms ("ignores anything he has to
wait for"), and say so in the report. Never infer a pattern from fewer than
three.

## 5. Report

Five lines at most: the misses, where each one went (gate / module / critic /
rule / nothing), what was cut from `CLAUDE.md`, the prediction score, and any
pattern. Commit the checks and rule changes as their own commit, separate from
any feature.
