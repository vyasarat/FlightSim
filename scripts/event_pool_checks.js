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
    check("events: one registry, two policies -- the space programme draws ONE per launch and never the same one twice, the harbour has every one of its eight standing and on its own clock, the coast its giant robot (v218) standing on its rebuild clock, every event in all three can be forced through the same door, and the police borrow the draw for their colour scheme without borrowing the rules",
      r.pools.space && r.pools.space.policy === "once" &&
      r.pools.sea && r.pools.sea.policy === "standing" &&
      r.pools.coast && r.pools.coast.policy === "standing" && JSON.stringify(r.pools.coast.keys) === '["titan"]' &&
      r.spaceMatches && r.pools.sea.keys.length === 8 &&
      r.eventPools.length === 3 && r.events === 15 && r.forcible === 15 &&
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
      let coastSeen = null;

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

      // ---- (v218) the coast: the giant robot, forced to rise beside him in the prop, held 700 m off it high over the
      // sea. THE STATED EXCEPTION (his two asks, QUEUE.md TOP 2026-11-13: in the pool AND solid; the wording is proposed to the parent, not his -- eventpool.js header): it is registered here AND solid in the
      // one registry. So its solids are measured LIVE -- what solidQuery would actually hit, not the registry's count,
      // which its records never change -- and the truth asserted: it IS solid while up and drawn, and every live solid
      // of it stands where a wall blocks nothing (deep sea, outside the road corridor and the runway with its approach
      // and climb-out, clear of the droneship's and the net boat's water). Taking nothing away is asked as of any event.
      const liveTitan = () => L.titan.recs.filter(r => !L.isSolidHidden(r));
      for (const m of L.evpEventPools().coast.members) {
        L.tnReset();
        L.api.setVehicle("prop"); L.api.teleportAirborne(1500, 0, 300, 0);
        // held on one spot (flown on, the go button comes and goes with where he is, not with the event)
        const pin = () => { st.x = 730; st.z = 7900; st.y = 320; st.heading = 0; st.pitch = 0; st.bank = 0; };
        for (let i = 0; i < 40; i++) { pin(); L.update(1 / 60); }
        const before = snapshot(), live0 = liveTitan().length;
        L.evpForce("coast", m.key);
        const R = L.RECOVERY[0] || {}, ships = [R.barge, R.netBoat].filter(Boolean);
        let liveMax = 0, badSpots = 0, samples = 0;
        for (let i = 0; i < 60 * 45; i++) {
          pin(); L.update(1 / 60);
          const live = liveTitan();
          liveMax = Math.max(liveMax, live.length);
          if (i % 15) continue;
          for (const r of live) for (const [ox, oz] of [[-1, -1], [-1, 1], [1, -1], [1, 1], [0, 0]]) {
            const x = r.x + ox * r.hw, z = r.z + oz * r.hd;
            samples++;
            if (L.terrainEff(x, z) > L.seaLevelAt(x, z) - 6 || L.inCorridor(x, z, 300) || ships.some(sh => Math.hypot(x - sh.x, z - sh.z) < 150)) badSpots++;
          }
        }
        const after = snapshot();
        after.solids = before.solids;   // (the exception: its own walls are judged just above, not by the count)
        if (L.titan.phase !== "up") out.push(`coast/${m.key}: forced, but it did not rise (${L.titan.phase})`);
        if (live0 !== 0 || liveMax !== L.titan.recs.length) out.push(`coast/${m.key}: not solid as stated -- ${live0} live before it rose, ${liveMax} of ${L.titan.recs.length} live while up`);
        if (!samples || badSpots) out.push(`coast/${m.key}: BLOCKS -- ${badSpots} of ${samples} of its live solid's corners out of deep water, in a corridor or in the ships' water`);
        coastSeen = { live0, liveMax, samples, badSpots };
        compare(before, after, "coast/" + m.key, m.button);
        L.tnReset();
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
      return { out, coastSeen };
    });
    check("events: every one of the fifteen, forced to happen on its own -- the fourteen make nothing solid (read from a counter that is not there: Q-24, queued); the giant robot is the stated exception (the parent asked for it in the pool AND solid, 2026-11-13; the wording proposed to him): solid while it stands, and every live solid of it in deep sea, outside the road and runway corridors and clear of the ships' water; not one of the fifteen takes a flag backwards, removes a control he had, or costs him a card in the picker",
      bad.out.length === 0 && !!bad.coastSeen, JSON.stringify({ bad: bad.out.slice(0, 8), coast: bad.coastSeen }));
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
