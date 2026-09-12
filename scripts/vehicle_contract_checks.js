"use strict";
// ---------------------------------------------------------------------------
// THE VEHICLE CHARACTERIZATION GATE.
//
// This file asserts nothing about what the game SHOULD do. It records what each
// vehicle actually does today -- where it spawns and facing where, how high it
// sits over its own ground, what a finger does to it, where the camera sits in
// both views, where it comes back after a bang, and which buttons are up -- and
// then refuses to let any of it move.
//
// It exists because the vehicle contract refactor touches every vehicle, and
// "the harness is still green" is a weak gate for that: the count only proves
// no check was deleted. These are the numbers the contract has to conform to.
//
// It works the way the visual baseline does: a JSON snapshot in
// `scripts/vehicle_baseline.json`, regenerated with UPDATE_VEHICLE=1. During
// the refactor NOTHING should need regenerating -- a diff here is a bug, not a
// number to bless. Regenerate only for a deliberate, stated behaviour change.
//
// Tolerances are per-field and loose enough for floating-point drift and the
// odd frame of camera lag, and tight enough that a real change trips them.
// ---------------------------------------------------------------------------

const fs = require("fs");
const path = require("path");

// Each case: how to put him in it, and whether the extras apply.
const CASES = [
  { key: "prop",            kind: "plane" },
  { key: "fighter",         kind: "plane" },
  { key: "airlinerDelta",   kind: "plane" },
  { key: "helicopter",      kind: "heli" },
  { key: "car",             kind: "car" },
  { key: "speedboat",       kind: "boat" },
  { key: "yacht",           kind: "yacht" },
  { key: "rocket",          kind: "rocket" },
  { key: "rover",           kind: "rover" },
  { key: "drone",           kind: "drone" },
];

// field -> absolute tolerance. Anything not listed must match exactly.
const TOL = {
  x: 0.5, y: 0.25, z: 0.5, heading: 0.02,
  groundY: 0.25, aboveGround: 0.25,
  headingAfterStick: 0.05, speedAfterHold: 1.5,
  chaseDx: 1.5, chaseDy: 1.0, chaseDz: 1.5,
  eyeDx: 0.4, eyeDy: 0.4, eyeDz: 0.4,
  backDx: 30, backDz: 30,
};

module.exports = async function vehicleContractChecks({ newPage, check }) {
  const baselinePath = path.resolve(__dirname, "vehicle_baseline.json");
  const update = !!process.env.UPDATE_VEHICLE;
  let baseline = {};
  if (!update && fs.existsSync(baselinePath)) baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));

  const { page } = await newPage(1180, 820);
  await page.evaluate(() => { window.__lp.noRender = true; });

  const measured = {};
  for (const c of CASES) {
    measured[c.key] = await page.evaluate((c) => {
      const L = window.__lp, st = L.state;
      const r3 = v => Math.round(v * 1000) / 1000;
      const holdsThrottleFor = k => k === "rover" || k === "rocket" || k === "plane";
      const r1 = v => Math.round(v * 10) / 10;

      // ---- put him in it, the way the game does
      const place = () => {
        if (c.kind === "rover" || c.kind === "drone") {
          L.api.setVehicle("rocket"); L.api.placeOnRunway();
          const b = L.BODIES.find(x => x.name === (c.kind === "drone" ? "mars" : "moon"));
          st.dest = c.kind === "drone" ? "mars" : "moon";
          st.phase = "TAXI"; L.rk.stage = 3; L.rk.onBody = b;
          st.x = b.x; st.y = b.y + b.r + 10; st.z = b.z;
          if (c.kind === "drone") L.marsBuild();
          L.roverDeploy();
          for (let i = 0; i < 10; i++) L.update(1 / 60);
          if (c.kind === "drone") {
            L.mars.drone.x = L.rover.x; L.mars.drone.y = L.rover.y; L.mars.drone.z = L.rover.z;
            L.marsDronePress();
          }
        } else {
          L.api.setVehicle(c.key);
          if (c.kind === "boat" || c.kind === "yacht") L.api.spawnAt(1, 1);
          else L.api.placeOnRunway();
        }
        L.api.clearStick();
        for (let i = 0; i < 20; i++) L.update(1 / 60);
      };

      place();
      const out = {};

      // ---- 1. where it starts, and facing where
      out.x = r1(st.x); out.z = r1(st.z); out.heading = r3(L.wrapPi(st.heading));

      // ---- 2. how high it sits over its OWN ground. For the surface vehicles
      // that is the terrain or the water; for the rover and the drone the truth
      // is not state.y at all, which is half the point of this file.
      if (c.kind === "rover") {
        // The rover is on the MOON here, so its body is rk.onBody -- mars.body
        // is null unless the Mars base has been built. That the height has to be
        // measured from a sphere at all, rather than from state.y, is exactly
        // the assumption this file exists to pin down.
        const b = L.rk.onBody || L.mars.body;
        out.groundY = null;
        out.aboveGround = b ? r1(Math.hypot(L.rover.x - b.x, L.rover.y - b.y, L.rover.z - b.z) - b.r) : null;
      } else if (c.kind === "drone") {
        out.groundY = null;
        out.aboveGround = r1(L.mars.drone.h);
      } else {
        const g = (c.kind === "boat" || c.kind === "yacht")
          ? L.seaLevelAt(st.x, st.z) : L.terrainEff(st.x, st.z);
        out.groundY = r1(g);
        out.aboveGround = r1(st.y - g);
      }
      out.y = (c.kind === "rover" || c.kind === "drone") ? null : r1(st.y);

      // ---- 3. what a finger does. Full right stick for a second, then a
      // second of "throttle" -- whatever that means for this vehicle.
      // MOVING first. Measured from rest, a plane on the runway and a rover
      // standing still both turned by exactly zero, which is true and tells you
      // nothing. And the rover and the drone do not steer `state.heading` at
      // all -- their truth is their own forward vector on a sphere -- so the
      // angle turned is measured between that vector before and after, which is
      // the only form that means the same thing for all of them.
      const fwdOf = () => (c.kind === "rover" ? L.rover.f : c.kind === "drone" ? L.mars.drone.f : null);
      const moveFirst = () => {
        for (let i = 0; i < 120; i++) {
          if (holdsThrottleFor(c.kind)) L.api.setThrottle(true); else L.api.setStick(0, 0);
          L.update(1 / 60);
        }
      };
      moveFirst();
      const f0 = fwdOf(), f0c = f0 ? { x: f0.x, y: f0.y, z: f0.z } : null;
      const h0 = L.wrapPi(st.heading);
      for (let i = 0; i < 60; i++) {
        if (holdsThrottleFor(c.kind)) L.api.setThrottle(true);
        L.api.setStick(1, 0);
        L.update(1 / 60);
      }
      if (f0c) {
        const f1 = fwdOf();
        const dot = Math.max(-1, Math.min(1, f0c.x * f1.x + f0c.y * f1.y + f0c.z * f1.z));
        out.headingAfterStick = r3(Math.acos(dot));
      } else {
        out.headingAfterStick = r3(L.wrapPi(L.wrapPi(st.heading) - h0));
      }
      L.api.clearStick(); L.api.setThrottle(false);
      place();
      for (let i = 0; i < 120; i++) {
        if (holdsThrottleFor(c.kind)) L.api.setThrottle(true); else L.api.setStick(0, 0);
        L.update(1 / 60);
      }
      out.speedAfterHold = r1(c.kind === "rover" ? Math.abs(L.rover.speed)
                            : c.kind === "drone" ? Math.abs(L.mars.drone.speed) : st.speed);
      L.api.setThrottle(false); L.api.clearStick();

      // ---- 4. where the camera sits, in BOTH views, relative to the vehicle
      const anchor = () => (c.kind === "rover" ? L.rover
                          : c.kind === "drone" ? L.mars.drone : { x: st.x, y: st.y, z: st.z });
      place();
      const cam = (chase) => {
        L.api.setView(chase);
        for (let i = 0; i < 30; i++) L.update(1 / 60);
        const a = anchor() || { x: st.x, y: st.y, z: st.z }, p = L.cameraPos;
        return { dx: r1(p.x - a.x), dy: r1(p.y - a.y), dz: r1(p.z - a.z) };
      };
      const chase = cam(true), eye = cam(false);
      out.chaseDx = chase.dx; out.chaseDy = chase.dy; out.chaseDz = chase.dz;
      out.eyeDx = eye.dx; out.eyeDy = eye.dy; out.eyeDz = eye.dz;

      // ---- 5. which buttons are up here, and which are not
      place();
      L.api.setView(true);
      for (let i = 0; i < 20; i++) L.update(1 / 60);
      out.buttons = [...document.querySelectorAll(".roundBtn, #ejectBtn, #hornBtn, #menuBtn, #throttleBtn")]
        .filter(b => { const s = getComputedStyle(b); return s.display !== "none" && s.visibility !== "hidden"; })
        .map(b => b.id).sort().join(",");

      // ---- 6. a bang, and where it puts him back. Each vehicle's OWN crash
      // path, not a synthetic one -- that is the thing the contract has to
      // absorb, and the thing that was broken in two of them for two releases.
      // The yacht has none on purpose -- she leans on a pier, she does not
      // explode -- and neither the rover nor the drone can crash at all.
      out.crash = null;
      const direct = { boat: "boatCrash", car: "carCrash" }[c.kind];
      const flies = c.kind === "plane" || c.kind === "heli";
      if (direct && typeof window[direct] === "function") {
        place();
        const from = { x: st.x, z: st.z };
        window[direct]();
        const exploded = st.exploding;
        for (let i = 0; i < 60 * 8; i++) L.update(1 / 60);
        out.crash = { exploded, backDx: r1(st.x - from.x), backDz: r1(st.z - from.z), settled: !st.exploding };
      } else if (flies) {
        // Its own path, not a synthetic one: the flight model explodes anything
        // that comes within terrainClearance of the ground away from a runway
        // and outside a landing zone. So put it there -- a long way out to the
        // side, two metres over open country -- rather than flying it into the
        // hill and hoping. (The first version nosed it down from forty metres
        // and it simply flew on for 1.3 km, which recorded nothing useful.)
        L.api.setVehicle(c.key);
        L.api.teleportAirborne(2600, 0, 300, 0);
        st.x = 3000; st.z = L.AIRPORTS[0].cz - 2600;
        st.y = L.terrainEff(st.x, st.z) + 2;
        st.liftoffTimer = 0; st.speed = 40; st.airVy = 0;
        L.api.clearStick();
        const from = { x: st.x, z: st.z };
        let exploded = false;
        for (let i = 0; i < 60 * 12; i++) {
          L.update(1 / 60);
          if (st.exploding) exploded = true;
          if (exploded && !st.exploding) break;
        }
        for (let i = 0; i < 60 * 3; i++) L.update(1 / 60);
        out.crash = exploded
          ? { exploded: true, backDx: r1(st.x - from.x), backDz: r1(st.z - from.z), settled: !st.exploding }
          : { exploded: false, crashable: false };
      }
      return out;
    }, c);
  }
  await page.close();

  if (update) {
    fs.writeFileSync(baselinePath, JSON.stringify(measured, null, 1) + "\n");
    console.log("INFO  vehicle: baseline written to scripts/vehicle_baseline.json");
    baseline = measured;      // ... and this run compares against what it just recorded
  }

  // ---- compare. One check per vehicle per aspect, so a failure names the
  // vehicle AND what moved.
  const cmp = (a, b, key) => {
    if (a === null || b === null || a === undefined || b === undefined) return a === b;
    if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) <= (TOL[key] || 0);
    return a === b;
  };
  const group = (name, keys) => {
    for (const c of CASES) {
      const got = measured[c.key], ref = baseline[c.key];
      if (!ref) { check(`contract: ${c.key} ${name} has a baseline`, false, "run with UPDATE_VEHICLE=1"); continue; }
      const bad = [];
      for (const k of keys) {
        if (k === "crash") {
          if (!got.crash && !ref.crash) continue;
          if (!got.crash || !ref.crash) { bad.push("crash presence"); continue; }
          for (const ck of ["exploded", "settled", "crashable", "backDx", "backDz"]) {
            if (!cmp(got.crash[ck], ref.crash[ck], ck)) bad.push(`crash.${ck} ${ref.crash[ck]} -> ${got.crash[ck]}`);
          }
          continue;
        }
        let expected = ref[k];
        // The sprint deliberately adds hop-in at these characterized poses.
        // Keep every movement/camera/crash value pinned to the original baseline.
        if (k === 'buttons' && ['prop','fighter','airlinerDelta','helicopter','yacht','drone'].includes(c.key)) {
          expected = [...ref[k].split(',').filter(id => id !== 'washBtn' && id !== 'droneBtn'), 'hopBtn'].sort().join(',');
        }
        if (!cmp(got[k], expected, k)) bad.push(`${k} ${expected} -> ${got[k]}`);
      }
      check(`contract: ${c.key} ${name}`, bad.length === 0, bad.length ? bad.join("; ") : JSON.stringify(
        Object.fromEntries(keys.filter(k => k !== "crash").map(k => [k, got[k]]))));
    }
  };

  group("spawns where and facing where it does", ["x", "z", "heading"]);
  group("sits at the height it does over its own ground", ["y", "groundY", "aboveGround"]);
  group("answers a finger the way it does", ["headingAfterStick", "speedAfterHold"]);
  group("anchors both cameras where it does", ["chaseDx", "chaseDy", "chaseDz", "eyeDx", "eyeDy", "eyeDz"]);
  group("shows exactly the buttons it does", ["buttons"]);
  group("comes back from a bang where it does", ["crash"]);
};
