"use strict";
// (v215) An eject that is asked for in a check must be SEEN to happen, not taken on ejectStart()'s word:
// the v214 checks would have passed with an eject that was refused or did nothing (he stays where he
// was, on his road, facing his way). `install` puts window.__ejectRun into the page; it starts the
// eject, steps the game until it ends, and returns what it saw. `ran` is the verdict: started, active
// at once, through the rescue's phases in order, for a plausible time, ended, counted once.
//
//   used by audit_cars_checks.js and audit_flight_checks.js
const PHASES = ["frame", "open", "launch", "unfold", "land", "return", "rejoin"];   // every rescue; float or transit between unfold and land

function install() {
  window.__ejectRun = (maxS) => {
    const L = window.__lp, f0 = L.flags.ejections || 0, c0 = eject.cycles;
    const started = ejectStart();
    const activeAtStart = eject.active, phases = eject.active ? [eject.phase] : [];
    let n = 0;
    while (eject.active && n < 60 * (maxS || 40)) {
      L.update(1 / 60); n++;
      if (eject.active && phases[phases.length - 1] !== eject.phase) phases.push(eject.phase);
    }
    return { started, activeAtStart, phases, secs: +(n / 60).toFixed(2), ended: !eject.active,
             cycles: eject.cycles - c0, counted: (L.flags.ejections || 0) - f0, returned: !!(eject.last && eject.last.returned) };
  };
}

function ran(e) {
  if (!e || e.started !== true || !e.activeAtStart || !e.ended || e.cycles !== 1 || e.counted !== 1 || !e.returned) return false;
  if (!(e.secs >= 4 && e.secs < 40)) return false;                 // the rescue takes seconds, never a frame
  let at = -1;
  for (const p of PHASES) { const i = e.phases.indexOf(p); if (i <= at) return false; at = i; }
  return e.phases.includes("float") || e.phases.includes("transit");
}

module.exports = { install, ran, PHASES };
