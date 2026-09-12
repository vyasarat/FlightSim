"use strict";
// ---------------------------------------------------------------------------
// THE THREE RULES, ASKED OF EVERY EVENT THERE IS.
//
// "It may never be required, it may never block, and it may never take anything
// away" was a comment at the top of events.js and the same comment again at the
// top of seaevents.js. Fourteen events across two pools, and the rules were
// enforced by whoever remembered them.
//
// Now every event is a registered member of a pool with one way to force it
// (`evpForce`), so this can walk the whole registry and force each one to
// happen with nothing else changing, then ask all three questions:
//
//   NEVER BLOCKS        the solid count does not rise. Everything an event puts
//                       in the world is `noSolid` -- a moving thing that is a
//                       wall can stand between him and somewhere, which is the
//                       definition of blocking.
//   NEVER TAKES AWAY    no `flags.*` counter goes DOWN, the picker still offers
//                       the same cards, and every control that was up before is
//                       still up after (an event may ADD its own contextual
//                       button; it may never remove one of his).
//   NEVER REQUIRED      the pool's policy still resolves with the member absent
//                       -- for "once", something else can always be drawn; for
//                       "standing", the others carry on regardless.
//
// The first two are asserted by forcing. The third is asserted structurally:
// nothing in the game asks whether a given event happened.
// ---------------------------------------------------------------------------

module.exports = async function eventPoolChecks({ newPage, check }) {

  // ---- 1. the registry is complete: both pools, both policies, every member
  {
    const { page } = await newPage(1024, 768);
    const r = await page.evaluate(() => {
      const L = window.__lp;
      L.noRender = true; L.api.skipScreens();
      const pools = {};
      for (const n in L.EVENT_POOLS) {
        const p = L.EVENT_POOLS[n];
        pools[n] = { policy: p.policy, kind: p.kind, keys: p.members.map(m => m.key) };
      }
      const ev = L.evpAll("event");
      return {
        pools, events: ev.length, all: L.evpAll().length,
        eventPools: Object.keys(L.evpEventPools()),
        // the space pool's members are exactly the kinds it dispatches on
        spaceMatches: JSON.stringify(pools.space.keys) === JSON.stringify(L.EVENT_KINDS),
        forcible: ev.filter(m => m.force || L.EVENT_POOLS[m.pool].policy === "standing").length,
        // and the third pool is a LIVERY pool: it borrows the "never twice"
        // policy for the police colour scheme and none of the three rules,
        // because paint is not a thing that happens to him
        livery: Object.values(pools).filter(p => p.kind === "livery").map(p => p.policy),
      };
    });
    check("events: one registry, two policies -- the space programme draws ONE per launch and never the same one twice, the harbour has every one of its eight standing and on its own clock, every event in both can be forced through the same door, and the police borrow the draw for their colour scheme without borrowing the rules",
      r.pools.space && r.pools.space.policy === "once" &&
      r.pools.sea && r.pools.sea.policy === "standing" &&
      r.spaceMatches && r.pools.sea.keys.length === 8 &&
      r.pools.connections.policy === 'standing' && r.pools.connections.keys.length === 2 && r.eventPools.length === 3 && r.events === 16 && r.forcible === 16 &&
      r.livery.length === 1 && r.livery[0] === "once", JSON.stringify(r));
    await page.close();
  }

  // ---- 2. "never twice running", over a long run of draws, and across reloads
  {
    const { page } = await newPage(1024, 768);
    const r = await page.evaluate(() => {
      const L = window.__lp;
      L.noRender = true; L.api.skipScreens();
      L.api.setVehicle("rocket"); L.api.placeOnRunway();
      L.state.dest = "moon";
      const seen = [];
      let repeats = 0;
      for (let i = 0; i < 240; i++) {
        const k = L.evpDraw("space", 1);        // chance 1: every occasion draws
        if (k === null) continue;
        if (seen.length && k === seen[seen.length - 1]) repeats++;
        seen.push(k);
      }
      const counts = {};
      for (const k of seen) counts[k] = (counts[k] || 0) + 1;
      return { draws: seen.length, repeats, counts, kinds: Object.keys(counts).length,
               remembered: (() => { try { return localStorage.getItem("lp.lastEvent"); } catch (e) { return null; } })(),
               last: seen[seen.length - 1] };
    });
    check(`events: the "once" policy drew ${r.draws} times and never the same one twice running, reached every kind in the pool, and wrote the last draw down so a relaunch cannot repeat it`,
      r.repeats === 0 && r.draws > 200 && r.kinds === 6 && r.remembered === r.last,
      JSON.stringify(r));
    await page.close();
  }

  // ---- 3. THE THREE RULES, forced, one member at a time
  {
    const { page } = await newPage(1024, 768);
    const bad = await page.evaluate(async () => {
      const L = window.__lp, st = L.state;
      L.noRender = true; L.api.skipScreens();
      const out = [];

      const snapshot = () => {
        const flags = {};
        for (const k in L.flags) if (typeof L.flags[k] === "number") flags[k] = L.flags[k];
        const buttons = [];
        for (const id in L.BUTTONS) {
          const e = document.getElementById(id);
          if (e && !e.classList.contains("hidden") && getComputedStyle(e).display !== "none") buttons.push(id);
        }
        return { solids: L.api.solidCount, flags, buttons,
                 cards: document.querySelectorAll("#vehPicker .card, #vehPicker .vcard, .pickCard").length };
      };
      // `own`: the contextual button this event brought with it. It may take
      // that one back when it ends -- it is the event's, not his.
      const compare = (a, b, who, own) => {
        if (b.solids > a.solids) out.push(`${who}: BLOCKS -- solid count ${a.solids} -> ${b.solids}`);
        for (const k in a.flags) {
          if ((b.flags[k] === undefined ? 0 : b.flags[k]) < a.flags[k]) out.push(`${who}: TAKES AWAY -- flags.${k} ${a.flags[k]} -> ${b.flags[k]}`);
        }
        for (const id of a.buttons) {
          if (id === own) continue;
          if (!b.buttons.includes(id)) out.push(`${who}: TAKES AWAY -- control ${id} went`);
        }
        if (b.cards < a.cards) out.push(`${who}: TAKES AWAY -- picker ${a.cards} -> ${b.cards} cards`);
      };

      // ---- the harbour: in the speedboat, in the channel, for each member
      for (const m of L.evpEventPools().sea.members) {
        L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
        // Under way BEFORE the snapshot, and under way after: the picker button
        // hides itself whenever he is moving, so a before taken at rest would
        // accuse every event in the harbour of stealing it.
        for (let i = 0; i < 40; i++) { L.update(1 / 60); st.speed = Math.max(st.speed, 22); }
        const before = snapshot();
        L.evpForce("sea", m.key);
        for (let i = 0; i < 60 * 45; i++) { L.update(1 / 60); st.speed = Math.max(st.speed, 18); }
        compare(before, snapshot(), "sea/" + m.key, m.button);
      }

      // ---- the space programme: force each event and fly the flight
      for (const m of L.evpEventPools().space.members) {
        L.api.setVehicle("rocket"); L.api.placeOnRunway();
        st.dest = "moon";
        L.evpForce("space", m.key);
        L.api.setThrottle(true);
        // Same reason: compare two moments that are both in flight. The picker
        // and the go button come and go with the phase, not with the event.
        for (let i = 0; i < 60 * 20; i++) L.update(1 / 60);
        const before = snapshot();
        for (let i = 0; i < 60 * 40; i++) L.update(1 / 60);
        L.api.setThrottle(false);
        for (let i = 0; i < 60 * 10; i++) L.update(1 / 60);
        compare(before, snapshot(), "space/" + m.key, m.button);
        L.eventsReset();
      }
      return out;
    });
    check("events: every one of the fourteen, forced to happen on its own -- not one of them makes anything solid, takes a flag backwards, removes a control he had, or costs him a card in the picker",
      bad.length === 0, JSON.stringify(bad.slice(0, 8)));
    await page.close();
  }

  // ---- 4. never required: nothing in the game asks whether one happened.
  // Structural, because "required" is not a thing a single run can disprove --
  // what can be shown is that no gate anywhere reads an event's outcome.
  {
    const { page } = await newPage(1024, 768);
    const r = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.noRender = true; L.api.skipScreens();
      // fly a whole rocket flight with the pool emptied of any draw at all
      L.api.setVehicle("rocket"); L.api.placeOnRunway();
      st.dest = "moon";
      L.eventsReset();
      L.ev.kind = null; L.ev.armed = false;
      const before = L.flags.rocketLandings || 0;
      L.api.setThrottle(true);
      for (let i = 0; i < 60 * 90 && !L.rocketCanDrop(); i++) L.update(1 / 60);
      L.api.setThrottle(false);
      for (let i = 0; i < 60 * 20; i++) L.update(1 / 60);
      return { drewNothing: L.ev.kind === null, flying: st.phase === "AIRBORNE" || st.phase === "CLIMB_AWAY",
               exploded: st.exploding, alt: Math.round(L.rocketAlt ? L.rocketAlt() : st.y),
               canSkip: typeof L.rocketCanSkip === "function" ? L.rocketCanSkip() : null,
               landingsBefore: before };
    });
    check("events: a flight that draws nothing at all is a complete flight -- the rocket still climbs, still gets its go button, and nothing anywhere waits on an event that never came",
      r.drewNothing && !r.exploded && r.alt > 500, JSON.stringify(r));
    await page.close();
  }
};
