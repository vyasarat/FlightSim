"use strict";
// ---------------------------------------------------------------------------
// The speed steps on every vehicle, the car's horn, and the boat exhaust that
// looked like smoke.
//
// Behavioural, not existence checks: the control has to be reachable, the top
// step has to be measurably faster than the default on the vehicle's own model,
// the horn has to make a sound once on a tap and keep making it on a hold, and
// the stern plume has to be OUT OF SHOT rather than merely smaller. Each of
// those has a way of passing a green existence check while being wrong.
// ---------------------------------------------------------------------------

// The car must stay within a lane-ish of the centreline even at the top step.
const L_LANE = 26;   // TUNE.car.onRoadHalf

// Every vehicle the brief lists, with a way to put him in it and moving.
const VEHICLES = [
  { key: "prop",             air: true },
  { key: "fighter",          air: true },
  { key: "airlinerDelta",    air: true },
  { key: "helicopter",       heli: true },
  { key: "car" },
  { key: "speedboat" },
  { key: "yacht" },
];

module.exports = async function speedHornChecks({ newPage, check, shots }) {

  // ---- 1. the control is there, on every vehicle, and rockets are untouched --
  {
    const { page } = await newPage(1180, 820);
    const seen = await page.evaluate((VEH) => {
      const L = window.__lp, st = L.state;
      L.noRender = true; L.api.skipScreens();
      const vis = id => {
        const e = document.getElementById(id);
        const cs = getComputedStyle(e);
        return cs.display !== "none" && cs.visibility !== "hidden";
      };
      const out = {};
      const place = v => {
        L.api.setVehicle(v.key);
        if (v.air) L.api.teleportAirborne(1200, 0, 300, 0);
        else if (v.heli) { L.api.placeOnRunway(); st.phase = "AIRBORNE"; st.y += 60; }
        else if (v.key === "car") L.api.placeOnRunway();
        else L.api.spawnAt(1, 1);
        for (let i = 0; i < 20; i++) L.update(1 / 60);
      };
      for (const v of VEH) {
        place(v);
        out[v.key] = {
          pair: vis("fastBtn") && vis("slowBtn"),
          cycle: vis("speedBtn"),
          steps: (L.spdStepsFor(L.spdKey()) || []).length,
          atCruise: L.spdMul() === 1,
        };
      }
      // the rover and the Mars drone, which are modes of the rocket
      L.api.setVehicle("rocket"); L.api.placeOnRunway();
      const b = L.BODIES[0];
      st.dest = "moon"; st.phase = "TAXI"; L.rk.onBody = b; L.rk.stage = 3;
      st.x = b.x; st.y = b.y + b.r + 10; st.z = b.z;
      for (let i = 0; i < 10; i++) L.update(1 / 60);
      out.rocket = { pair: vis("fastBtn") || vis("slowBtn"), cycle: vis("speedBtn"), steps: (L.spdStepsFor(L.spdKey()) || []).length };
      L.roverDeploy();
      for (let i = 0; i < 20; i++) L.update(1 / 60);
      out.rover = { pair: vis("fastBtn") && vis("slowBtn"), cycle: vis("speedBtn"),
                    steps: (L.spdStepsFor(L.spdKey()) || []).length, atCruise: L.spdMul() === 1 };

      // ... and the Mars drone, which is a mode of the rover, which is a mode of
      // the rocket. Put him down on Mars, get out, and fly it.
      L.api.setVehicle("rocket"); L.api.placeOnRunway();
      const mb = L.BODIES.find(x => x.name === "mars");
      st.dest = "mars"; st.phase = "TAXI"; L.rk.stage = 3; L.rk.onBody = mb;
      st.x = mb.x; st.y = mb.y + mb.r + 10; st.z = mb.z;
      L.marsBuild();
      L.roverDeploy();
      for (let i = 0; i < 10; i++) L.update(1 / 60);
      L.mars.drone.x = L.rover.x; L.mars.drone.y = L.rover.y; L.mars.drone.z = L.rover.z;
      L.marsDronePress();
      for (let i = 0; i < 20; i++) L.update(1 / 60);
      out.drone = { flying: L.marsDroneActive(), pair: vis("fastBtn") && vis("slowBtn"), cycle: vis("speedBtn"),
                    steps: (L.spdStepsFor(L.spdKey()) || []).length, atCruise: L.spdMul() === 1 };
      return out;
    }, VEHICLES);

    for (const v of VEHICLES) {
      const s = seen[v.key];
      const shown = v.heli ? (s.cycle && !s.pair) : (s.pair && !s.cycle);
      check(`speed: ${v.key} shows the speed control${v.heli ? " (the single stepper -- its column has one slot)" : ""}`,
        shown && s.steps >= 4 && s.atCruise, JSON.stringify(s));
    }
    check("speed: the rover has it too, and starts at cruise",
      seen.rover.pair && !seen.rover.cycle && seen.rover.steps >= 4 && seen.rover.atCruise, JSON.stringify(seen.rover));
    check("speed: the Mars drone has it too, and starts at cruise",
      seen.drone.flying && seen.drone.pair && !seen.drone.cycle && seen.drone.steps >= 4 && seen.drone.atCruise,
      JSON.stringify(seen.drone));
    check("speed: ROCKETS ARE UNCHANGED -- no steps, no control, nothing to press",
      !seen.rocket.pair && !seen.rocket.cycle && seen.rocket.steps === 0, JSON.stringify(seen.rocket));
    await page.close();
  }

  // ---- 2. the top step is measurably faster, on each vehicle's own model ----
  {
    const { page } = await newPage(1180, 820);
    const runs = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.noRender = true; L.api.skipScreens();
      const out = {};

      // How far it actually travels in ten seconds of held finger, at the
      // default step and then at the top one. Distance covered, not the speed
      // variable: a number that goes up while the vehicle does not is exactly
      // the bug an existence check would miss.
      const travel = (setup, secs) => {
        setup();
        const x0 = st.x, z0 = st.z;
        for (let i = 0; i < 60 * secs; i++) { L.api.setStick(0, 0); L.update(1 / 60); }
        L.api.clearStick();
        return Math.hypot(st.x - x0, st.z - z0);
      };
      for (const key of ["car", "speedboat", "yacht"]) {
        const setup = () => {
          L.api.setVehicle(key);
          if (key === "car") L.api.placeOnRunway(); else L.api.spawnAt(1, 1);
          L.spdReset(key);
        };
        // The yacht accelerates at 2 m/s^2 and takes sixteen seconds to reach her
        // top step: a ten-second window measured the ramp, not the difference.
        const secs = key === "yacht" ? 45 : 10;
        const base = travel(setup, secs);
        const fast = travel(() => { setup(); const n = L.spdStepsFor(key).length; st.speedStep = n - 1; }, secs);
        out[key] = { base: Math.round(base), fast: Math.round(fast), ratio: +(fast / base).toFixed(2) };
      }

      // The helicopter: point-to-go. Same destination, timed to arrival, and the
      // arrival easing must be untouched -- so it still stops on the spot.
      const heliRun = (step) => {
        L.api.setVehicle("helicopter"); L.api.placeOnRunway();
        st.phase = "AIRBORNE"; st.y += 120; st.speed = 0;
        L.spdReset("helicopter");
        if (step !== null) st.speedStep = step;
        const tx = st.x + 2600, tz = st.z;
        L.heli.target = { x: tx, y: st.y, z: tz };
        let f = 0;
        for (; f < 60 * 120 && L.heli.target; f++) L.update(1 / 60);
        return { secs: +(f / 60).toFixed(1), miss: +Math.hypot(st.x - tx, st.z - tz).toFixed(1), arrived: !L.heli.target };
      };
      out.helicopter = { base: heliRun(null), fast: heliRun(L.spdStepsFor("helicopter").length - 1) };
      return out;
    });

    for (const key of ["car", "speedboat", "yacht"]) {
      const r = runs[key];
      check(`speed: ${key} top step is measurably faster than the default`,
        r.ratio > 1.25 && r.fast > r.base, JSON.stringify(r));
    }
    const h = runs.helicopter;
    check("speed: helicopter top step gets there faster, and still arrives on the spot (easing unchanged)",
      h.base.arrived && h.fast.arrived && h.fast.secs < h.base.secs * 0.85 && h.fast.miss < 6,
      JSON.stringify(h));
    await page.close();
  }

  // ---- 3. it persists per vehicle for the session, and resets per vehicle ---
  {
    const { page } = await newPage(1180, 820);
    const mem = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.noRender = true; L.api.skipScreens();
      L.api.setVehicle("car"); L.api.placeOnRunway();
      st.speedStep = 0;                       // put the car on its slowest
      const carSet = st.speedStep;
      L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
      const boatFresh = st.speedStep;         // the boat has not been touched: cruise
      const boatCruise = L.spdMul() === 1;
      st.speedStep = L.spdStepsFor("speedboat").length - 1;
      const boatSet = st.speedStep;
      L.api.setVehicle("car"); L.api.placeOnRunway();
      const carAgain = st.speedStep;          // ... and the car is still where he left it
      return { carSet, boatFresh, boatCruise, boatSet, carAgain };
    });
    check("speed: each vehicle remembers its own step for the session, and a vehicle he has not touched is at cruise",
      mem.carSet === 0 && mem.boatCruise && mem.carAgain === 0 && mem.boatSet > 0 && mem.boatFresh !== mem.carSet,
      JSON.stringify(mem));
    await page.close();
  }

  // ---- 4. the assists still hold at the top step ---------------------------
  {
    const { page } = await newPage(1180, 820);
    const held = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.noRender = true; L.api.skipScreens();
      // Lane keep, flat out, nothing steered: he must still be on the road.
      L.api.setVehicle("car"); L.api.placeOnRunway();
      st.speedStep = L.spdStepsFor("car").length - 1;
      let offRoad = 0, worst = 0;
      for (let i = 0; i < 60 * 60; i++) {
        L.api.setStick(0, 0);
        L.update(1 / 60);
        const r = L.carRoadTarget();
        const lat = r ? Math.abs(r.lateral) : 999;
        worst = Math.max(worst, lat);
        if (!L.car.onRoad) offRoad++;
      }
      L.api.clearStick();
      return { offRoad, worst: +worst.toFixed(1), crashes: L.flags.carCrashes || 0, step: st.speedStep };
    });
    // What the brief asks is that the ASSIST holds: hands off at the top step he
    // stays on the road. It does NOT ask him never to hit anything -- hitting
    // traffic is a bang and a free reassemble by design, and that is its own
    // check elsewhere. This one deliberately measures the road, not the crashes:
    // once the crash debounce was fixed and the car could crash in the harness
    // at all, requiring zero here would have been requiring the game to stop
    // being the game.
    check("speed: lane keep still holds the road at the TOP step, hands off, for a minute",
      held.offRoad === 0 && held.worst < L_LANE, JSON.stringify(held));
    await page.close();
  }

  // ---- 5. THE HORN --------------------------------------------------------
  {
    const { page } = await newPage(1180, 820);
    // Count what actually reaches the audio graph rather than trusting a flag.
    const horn = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.noRender = true; L.api.skipScreens();
      const vis = id => {
        const e = document.getElementById(id);
        const cs = getComputedStyle(e);
        return cs.display !== "none" && cs.visibility !== "hidden";
      };
      L.api.setVehicle("car"); L.api.placeOnRunway();
      for (let i = 0; i < 10; i++) L.update(1 / 60);
      const onCar = vis("hornBtn");

      // A tap: press, release at once, and it should still be sounding for a
      // moment afterwards and then stop on its own.
      L.carHornPress(); L.carHornRelease();
      L.update(1 / 60);
      const rightAfterTap = L.car.hornT > 0;
      for (let i = 0; i < 60 * 2; i++) L.update(1 / 60);
      const tapEnded = L.car.hornT <= 0 && !L.car.hornHeld;

      // A hold: press and keep holding, and it must still be going well past
      // the tap length.
      L.carHornPress();
      for (let i = 0; i < 60 * 2; i++) L.update(1 / 60);
      const sustaining = L.car.hornHeld;
      L.carHornRelease();
      L.update(1 / 60);
      const stoppedOnRelease = !L.car.hornHeld;

      // ... and it cannot be leaned on forever.
      L.carHornPress();
      for (let i = 0; i < 60 * (L.CAR.horn.sustainMax + 1.5); i++) L.update(1 / 60);
      const capped = !L.car.hornHeld;
      L.carHornRelease();

      // absent everywhere else
      L.api.setVehicle("prop"); L.api.teleportAirborne(1200, 0, 300, 0);
      for (let i = 0; i < 10; i++) L.update(1 / 60);
      const inAir = vis("hornBtn");
      L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
      for (let i = 0; i < 10; i++) L.update(1 / 60);
      const onBoat = vis("hornBtn");
      L.api.setVehicle("helicopter"); L.api.placeOnRunway();
      for (let i = 0; i < 10; i++) L.update(1 / 60);
      const onHeli = vis("hornBtn");
      return { onCar, rightAfterTap, tapEnded, sustaining, stoppedOnRelease, capped, inAir, onBoat, onHeli };
    });
    check("horn: a tap sounds once and stops on its own; a hold sustains and stops when he lets go",
      horn.rightAfterTap && horn.tapEnded && horn.sustaining && horn.stoppedOnRelease && horn.capped,
      JSON.stringify(horn));
    check("horn: it is on the car and nowhere else -- not in the air, not on the boat, not on the helicopter",
      horn.onCar && !horn.inAir && !horn.onBoat && !horn.onHeli, JSON.stringify(horn));

    // the replies
    const replies = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.noRender = true; L.api.skipScreens();
      L.api.setVehicle("car"); L.api.placeOnRunway();
      // Standing on the coast road beside the drawbridge, honk: the bells and
      // beacons come on, and the bridge does NOT lift -- honking must never be
      // able to strand him on the wrong side of his own road.
      const b = L.harbor.bridge;
      b.hornT = 0; b.want = 0; b.open = 0; b.state = "shut";
      st.x = L.HB.cx; st.z = L.HB.mouth.z[0] - 200;
      L.car.hornReplyCool = 0;
      const answered = L.hbBridgeHonked(st.x, st.z, L.CAR.horn.bridgeRange);
      for (let i = 0; i < 60; i++) L.update(1 / 60);
      const warned = b.hornT > 0, lifted = b.want > 0 || b.open > 0.02;
      // ... and from the far side of the map nothing answers
      b.hornT = 0;
      const farAway = L.hbBridgeHonked(0, 6000, L.CAR.horn.bridgeRange);
      return { answered, warned, lifted, farAway };
    });
    check("horn: honking at the drawbridge starts the bell-and-beacon wind-up early, and never lifts the bridge or blocks the road",
      replies.answered && replies.warned && !replies.lifted && !replies.farAway, JSON.stringify(replies));
    await page.close();
  }

  // ---- 5b. THE MENU BUTTON -- up everywhere, and it works from anywhere ----
  {
    const { page } = await newPage(1180, 820);
    const menu = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.noRender = true; L.api.skipScreens();
      const vis = () => {
        const e = document.getElementById("menuBtn");
        const cs = getComputedStyle(e);
        return cs.display !== "none" && cs.visibility !== "hidden";
      };
      const onVehicles = () => !document.getElementById("screenVehicle").classList.contains("hiddenS");
      const anyScreen = () => L.menuOpen();
      const out = { up: {}, opens: {} };

      // It has to be up in every state the game has, including the ones the old
      // picker button is forbidden in: that is the whole point of it.
      const states = {
        "plane on the runway": () => { L.api.setVehicle("prop"); L.api.placeOnRunway(); },
        "plane airborne": () => { L.api.setVehicle("prop"); L.api.teleportAirborne(1200, 0, 300, 0); },
        "car driving": () => { L.api.setVehicle("car"); L.api.placeOnRunway(); },
        "speedboat": () => { L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1); },
        "yacht": () => { L.api.setVehicle("yacht"); L.api.spawnAt(1, 1); },
        "helicopter": () => { L.api.setVehicle("helicopter"); L.api.placeOnRunway(); st.phase = "AIRBORNE"; st.y += 80; },
        "rocket on the pad": () => { L.api.setVehicle("rocket"); L.api.placeOnRunway(); },
        "driving the rover": () => {
          L.api.setVehicle("rocket"); L.api.placeOnRunway();
          const b = L.BODIES[0];
          st.dest = "moon"; st.phase = "TAXI"; L.rk.onBody = b; L.rk.stage = 3;
          st.x = b.x; st.y = b.y + b.r + 10; st.z = b.z;
          L.update(1 / 60); L.roverDeploy();
        },
        "exploding": () => {
          L.api.setVehicle("prop"); L.api.teleportAirborne(1200, 0, 300, 0);
          for (let i = 0; i < 20; i++) L.update(1 / 60);
          st.exploding = true; st.explodeTimer = 2;
        },
      };
      for (const [name, setup] of Object.entries(states)) {
        setup();
        for (let i = 0; i < 12; i++) L.update(1 / 60);
        out.up[name] = vis();
      }

      // ... and pressing it from a place the OLD picker button refuses lands him
      // on the vehicles, with the mode unwound.
      const tryFrom = (name, setup) => {
        setup();
        for (let i = 0; i < 12; i++) L.update(1 / 60);
        const oldRefuses = !L.pickerCanOpen();
        L.openPickerAnywhere();
        for (let i = 0; i < 4; i++) L.update(1 / 60);
        const ok = onVehicles();
        // put it away again for the next one
        document.getElementById("screenVehicle").classList.add("hiddenS");
        return { oldRefuses, landedOnVehicles: ok };
      };
      out.opens.airborne = tryFrom("airborne", states["plane airborne"]);
      out.opens.rover = tryFrom("rover", states["driving the rover"]);
      out.opens.exploding = tryFrom("exploding", states["exploding"]);
      out.opens.roverUnwound = !L.roverActive();

      // it hides while a screen is already up, and never sits on top of one
      L.api.setVehicle("prop"); L.api.placeOnRunway();
      L.openPickerAnywhere();
      for (let i = 0; i < 4; i++) L.update(1 / 60);
      out.hiddenBehindScreen = !vis() && anyScreen();
      return out;
    });

    const allUp = Object.values(menu.up).every(Boolean);
    check("menu: the picker button is up in every state -- flying, driving, on the Moon, mid-bang",
      allUp, JSON.stringify(menu.up));
    check("menu: it opens the picker ON THE VEHICLES from places the old button refuses, and unwinds the mode first",
      menu.opens.airborne.oldRefuses && menu.opens.airborne.landedOnVehicles &&
      menu.opens.rover.oldRefuses && menu.opens.rover.landedOnVehicles && menu.opens.roverUnwound &&
      menu.opens.exploding.landedOnVehicles,
      JSON.stringify(menu.opens));
    check("menu: it gets out of the way once a picker screen is up",
      menu.hiddenBehindScreen, JSON.stringify({ hidden: menu.hiddenBehindScreen }));
    await page.close();
  }

  // ---- 6. THE STERN PLUME -- gone at speed, and never climbing into shot ----
  {
    const { page } = await newPage(1180, 820);
    const plume = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.noRender = true; L.api.skipScreens();
      const live = () => L.wakePuffList.filter(p => p.life > 0).length;
      const settle = () => { for (const p of L.wakePuffList) p.life = 0; };

      // (a) THE GATE. Call the emitter straight, at a series of speeds, and
      // count what it actually puts into the world. Below the cut it should
      // wisp; at and above it, nothing -- "gone entirely above TUNE speed".
      const gate = (key, fn, T) => {
        L.api.setVehicle(key); L.api.spawnAt(1, 1);
        const at = (sp) => {
          settle();
          const before = live();
          st.speed = sp;
          if (L.boat) L.boat.plane = 0;
          // long enough to clear the emitter's own interval several times over
          for (let i = 0; i < 60 * 4; i++) fn(1 / 60, 0, -1);
          return live() - before;
        };
        return { idle: at(T.plumeMaxSpeed * 0.4), justUnder: at(T.plumeMaxSpeed - 0.5),
                 atCut: at(T.plumeMaxSpeed + 0.5), cruise: at(T.cruise) };
      };
      const out = {};
      out.speedboat = { gate: gate("speedboat", L.boatPlume, L.BT) };
      out.yacht = { gate: gate("yacht", L.yachtPlume, L.YT) };

      // (b) NOTHING CLIMBS INTO THE SHOT. Drive each boat properly, throttle
      // held, and watch how high above the waterline any live puff ever gets.
      // The rooster tail used to reach eleven metres and the chase camera sits
      // at eight, which is precisely why it was in the way.
      // `wakePuffs` is ONE SHARED POOL for the whole world -- the whale's blow,
      // the droneship, the jet-ski, every splash -- so only puffs near the hull
      // count, and the sea events are stood down while we measure (the rival
      // jet-ski rides alongside him by design, inside any radius that could mean
      // "his own wake").
      //
      // WHAT THIS MEASURES IS BLOCKING, NOT HEIGHT. The first version of this
      // check tested how high puffs got and passed while the view was still
      // ruined: the wake was not climbing, it was six-metre balls nine metres
      // in front of the lens, whose CENTRES projected below the frame while the
      // spheres themselves filled it. So the test is now the honest one -- take
      // the camera's sightline, and ask whether any puff's sphere actually
      // intersects it in front of the boat. That is what "in the line of sight"
      // means, and it is what a screenshot shows.
      const NEAR = 60;
      const blocking = (key, chase) => {
        L.api.setVehicle(key); L.api.spawnAt(1, 1);
        L.api.setView(chase);
        const wasBuilt = L.sea.built;
        L.sea.built = false;
        settle();
        let worst = 0, hits = 0, wet = 0, sampled = 0;
        const cam = L.camera, fwd = new THREE.Vector3(), rel = new THREE.Vector3();
        for (let i = 0; i < 60 * 25; i++) {
          L.api.setStick(0, 0);
          L.update(1 / 60);
          wet = st.y > L.TUNE.waterLevel + 1.0 ? 0 : wet + 1 / 60;
          if (wet < 2) continue;
          sampled++;
          cam.updateMatrixWorld();
          cam.getWorldDirection(fwd);
          const camToBoat = Math.hypot(cam.position.x - st.x, cam.position.z - st.z);
          for (const p of L.wakePuffList) {
            if (p.life <= 0) continue;
            const q = p.mesh.position;
            if (Math.hypot(q.x - st.x, q.z - st.z) > NEAR) continue;
            rel.subVectors(q, cam.position);
            const along = rel.dot(fwd);
            if (along <= 0 || along > camToBoat) continue;   // behind the lens, or past the boat
            // perpendicular distance from the puff centre to the sightline,
            // against the sphere's own radius (a puff grows to 2.2x its size)
            const perp = Math.sqrt(Math.max(0, rel.lengthSq() - along * along));
            const r = p.mesh.scale.x;
            if (perp < r) { hits++; worst = Math.max(worst, r - perp); }
          }
        }
        L.api.clearStick();
        L.sea.built = wasBuilt;
        return { hits, worst: +worst.toFixed(1), speed: +st.speed.toFixed(1), sampled };
      };
      out.speedboat.chase = blocking("speedboat", true);
      out.speedboat.helm = blocking("speedboat", false);
      out.yacht.chase = blocking("yacht", true);
      out.yacht.bridge = blocking("yacht", false);

      // (c) the pool is no longer saturated: the yacht used to want ~76 live
      // puffs out of 64 and starved every other splash in the harbour.
      out.pool = { size: L.wakePuffList.length, aliveUnderYacht: L.wakePuffsAlive() };
      return out;
    });

    for (const key of ["speedboat", "yacht"]) {
      const g = plume[key].gate;
      check(`exhaust: the ${key}'s stern plume is a wisp at idle and GONE above the TUNE speed`,
        g.idle > 0 && g.justUnder > 0 && g.atCut === 0 && g.cruise === 0, JSON.stringify(g));
      const p2 = plume[key];
      const inner = key === "yacht" ? p2.bridge : p2.helm;
      check(`exhaust: nothing off the ${key} crosses the camera's sightline -- in the chase view or from the ${key === "yacht" ? "bridge" : "helm"}`,
        p2.chase.hits === 0 && inner.hits === 0 && p2.chase.speed > 1 &&
        p2.chase.sampled > 600 && inner.sampled > 600,
        JSON.stringify({ chase: p2.chase, inner }));
    }
    check("exhaust: the yacht no longer floods the shared puff pool and starve the rest of the harbour's spray",
      plume.pool.aliveUnderYacht < plume.pool.size * 0.75, JSON.stringify(plume.pool));
    await page.close();
  }
};
