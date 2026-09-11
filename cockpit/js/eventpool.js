"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- THE EVENT POOLS.
//
// An EVENT is a thing that can happen near him that he never has to do. Three
// rules, and they are the whole of it:
//
//   * it may never be REQUIRED -- ignored, it simply does not happen
//   * it may never BLOCK -- nothing it puts in the world is a wall
//   * it may never TAKE ANYTHING AWAY -- no score, no card, no button
//
// Those three were a comment at the top of events.js and the same comment again
// at the top of seaevents.js, and a comment is not a check. They are registered
// facts now, and `scripts/event_pool_checks.js` forces every member of every
// pool to happen and then asserts all three of them by machine.
//
// A POOL is a set of events plus a POLICY saying when the set is consulted.
// There are exactly two policies and they are genuinely different questions:
//
//   "once"      ONE member is drawn per occasion and never the same one twice
//               running. It stages when its own moment arrives, and if that
//               moment never comes, nothing happened this flight. The draw is
//               remembered across reloads so "never twice" survives a relaunch.
//               -- the space programme, one event per rocket launch.
//
//   "standing"  EVERY member is always eligible and runs its own clock,
//               re-arming after it finishes. Several can be going at once.
//               -- the harbour, where eight things are always about to happen.
//
// WHAT THIS IS NOT. It is not a lifecycle, a base class or a scheduler. The
// events keep their own bodies and their own state exactly where they were;
// what moved here is the selection policy, the re-arm clock, and -- the reason
// it is worth having at all -- ONE WAY TO FORCE ANY EVENT IN ANY POOL. Before
// this the harness had to know that the whale hides behind `sea.whale.next`,
// the sub behind `sea.sub.next` and a space event behind `eventsForce`, so the
// three rules could only ever be spot-checked on the events someone remembered.
// ---------------------------------------------------------------------------

const EVENT_POOLS = {};

// `spec`: { name, policy, members: [{ key, state, gap?, valid?, force? }] }
//   state   the object the event keeps its own fields on (its re-arm clock
//           lives there, so nothing has to be moved)
//   gap     [min, max] seconds between runs -- "standing" only
//   valid   () => is this member allowed to be drawn right now -- "once" only
//   force   () => make this one happen now (the harness's single door in)
function evpRegister(spec) {
  EVENT_POOLS[spec.name] = spec;
  for (const m of spec.members) m.pool = spec.name;
  return spec;
}

function evpPool(name) { return EVENT_POOLS[name]; }
function evpMember(name, key) {
  const p = EVENT_POOLS[name];
  return p ? p.members.find(m => m.key === key) : null;
}
// Every member of every pool, flattened: what the audit walks.
function evpAll() {
  const out = [];
  for (const n in EVENT_POOLS) for (const m of EVENT_POOLS[n].members) out.push(m);
  return out;
}

// ---------------------------------------------------------------------------
// The "once" policy: draw one, never the same one twice running.
//
// The memory is persisted, because "never twice" has to survive him closing the
// game between launches -- which is most of the time. Anything unreadable in
// there is ignored rather than repaired: a renamed event must not be able to
// stop the draw working.
// ---------------------------------------------------------------------------
function evpLoadLast(pool) {
  try {
    const s = localStorage.getItem(pool.memory);
    if (pool.members.some(m => m.key === s)) pool.prev = s;
  } catch (err) {}
  return pool.prev || null;
}

function evpDraw(name, chance) {
  const pool = EVENT_POOLS[name];
  if (!pool) return null;
  if (chance !== undefined && rnd() >= chance) return null;
  const ok = (m) => !m.valid || m.valid();
  let able = pool.members.filter(m => m.key !== pool.prev && ok(m));
  if (!able.length) able = pool.members.filter(ok);     // only one left: allow the repeat
  if (!able.length) return null;
  const m = able[Math.min(able.length - 1, Math.floor(rnd() * able.length))];
  pool.prev = m.key;
  try { localStorage.setItem(pool.memory, m.key); } catch (err) {}
  return m.key;
}

// ---------------------------------------------------------------------------
// The "standing" policy: each member's own re-arm clock.
//
// The idiom it replaces was written five slightly different ways across the
// eight harbour events -- `next`, `cool` and `every`, two of them counting up
// and three counting down. One shape means the audit can force any of them.
// ---------------------------------------------------------------------------
function evpDue(m, dt) {
  const s = m.state;
  if (s.next === undefined) s.next = 0;
  s.next -= dt;
  return s.next <= 0;
}

function evpRearm(m, gap) {
  const g = gap || m.gap || 0;
  m.state.next = Array.isArray(g) ? lerp(g[0], g[1], Math.random()) : g;
}

// Make one happen now. The single door in, for the harness and for nothing else.
function evpForce(name, key) {
  const pool = EVENT_POOLS[name];
  const m = evpMember(name, key);
  if (!pool || !m) return false;
  if (m.force) { m.force(); return true; }
  if (pool.policy === "standing") { m.state.next = 0; return true; }
  return false;
}
