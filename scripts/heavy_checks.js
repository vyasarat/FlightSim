"use strict";
// THE BOOSTER ROCKET (v142), flown the way he flies it: the throttle held, the
// stick left alone. The part he likes is the side boosters coming home, so the
// checks are mostly about that: they separate by themselves, the camera keeps
// BOTH of them in the picture all the way down, they land upright on the launch
// site's two pads, and then the flight goes on as the rocket's does.
module.exports = async function heavyChecks({ newPage, check }) {
  const { page, errors } = await newPage(768, 1024);
  const r = await page.evaluate(() => {
    const L = window.__lp, S = L.state, rk = L.rk, HV = L.TUNE.heavy, LS = L.TUNE.launchSite;
    L.noRender = true;
    const out = { bangs: 0 };
    const step = n => { for (let i = 0; i < n; i++) { const was = S.exploding; L.update(1 / 60); if (S.exploding && !was) out.bangs++; } };
    const card = document.querySelector('.vehCard[data-v="heavy"]');
    out.card = !!card && !card.classList.contains("hiddenS");

    // ---- on the launch site's pad, the site's own stack stepped aside
    L.api.setVehicle("heavy"); L.api.spawnAt(0, 0); L.api.skipScreens();
    step(60);
    out.pad = { kind: L.vehKind(), toPad: +Math.hypot(S.x - LS.x, S.z - LS.z).toFixed(1), stackHidden: !L.lsite.stack.visible,
                phase: L.lsite.phase, sides: L.vehicleModel.userData.rocket.sides.every(s => s.visible), onPad: S.phase === "TAXI" };

    // ---- the throttle held, nothing else: up, and the sides let go by themselves
    L.api.setThrottle(true);
    const s0 = L.flags.heavySeparations || 0;
    let t = 0;
    for (; t < 90 && (L.flags.heavySeparations || 0) === s0; t += 1 / 60) step(1);
    out.sep = { secs: +t.toFixed(1), alt: +L.rocketTiltDeg ? +(S.y - Math.max(L.terrainEff(S.x, S.z), 0)).toFixed(0) : 0, n: L.heavy.boosters.length,
                watching: L.heavyWatching(), sidesAttached: L.vehicleModel.userData.rocket.sides.some(s => s.visible) };

    // ---- the watch: both boosters in the picture, every frame, until they are down
    const proj = new THREE.Vector3(), booms0 = L.flags.heavyBooms || 0;
    let frames = 0, both = 0, landed0 = L.flags.heavyBoosterLandings || 0;
    const rocketAt = { x: S.x, y: S.y, z: S.z };
    let held = true;
    while (L.heavyWatching() && frames < 60 * 40) {
      step(1); frames++;
      const moved = Math.hypot(S.x - rocketAt.x, S.y - rocketAt.y, S.z - rocketAt.z);
      if (moved > 0.5 && held && L.heavyWatching()) { held = false; out.moved = { frame: frames, by: +moved.toFixed(2), dy: +(S.y - rocketAt.y).toFixed(2), ph: S.phase }; }
      L.camera.updateMatrixWorld();
      let ok = true;
      for (const b of L.heavy.boosters) {
        proj.copy(b.g.position).project(L.camera);
        if (!(proj.z < 1 && Math.abs(proj.x) < 0.95 && Math.abs(proj.y) < 0.95)) ok = false;
      }
      if (ok) both++;
    }
    const lzs = L.lsite.lzs;
    out.watch = { secs: +(frames / 60).toFixed(1), bothInView: +(both / Math.max(1, frames)).toFixed(2), held, moved: out.moved,
                  landings: (L.flags.heavyBoosterLandings || 0) - landed0,
                  boosters: L.heavy.boosters.map((b, i) => ({ onPad: +Math.hypot(b.x - lzs[i].x, b.z - lzs[i].z).toFixed(1), tilt: +L.heavyBoosterTilt(b).toFixed(1), landed: b.landed })),
                  booms: (L.flags.heavyBooms || 0) - booms0 };

    // ---- and back to him: the camera on the rocket again, the flight going on
    step(90);
    const camToRocket = Math.hypot(L.camera.position.x - S.x, L.camera.position.y - S.y, L.camera.position.z - S.z);
    const y0 = S.y;
    step(60 * 4);
    out.after = { camToRocket: +camToRocket.toFixed(0), climbed: +(S.y - y0).toFixed(0), stage: rk.stage, canDrop: L.rocketCanDrop() };
    // the rest is the rocket's: the core, the fairing, the second stage
    const drops = [];
    for (let k = 0; k < 3; k++) {
      for (let i = 0; i < 60 * 30 && !L.rocketCanDrop(); i++) step(1);
      drops.push(L.dropStage());
      step(30);
    }
    out.rest = { drops, stage: rk.stage, coreHome: L.fallingStages.some(f => f.kind === "booster") };

    // ---- and home: a hop off the launch site's pad, the throttle let go -- the
    // landing assist brings it back down on that pad, as on the rocket's own
    L.api.setThrottle(false);
    L.api.setVehicle("heavy"); L.api.spawnAt(0, 0); step(30);
    L.api.setThrottle(true); step(60 * 4); L.api.setThrottle(false);
    for (let i = 0; i < 60 * 90 && S.phase !== "TAXI" && !S.exploding; i++) step(1);
    out.home = { landed: S.phase === "TAXI" && !S.exploding, zone: rk.lastArrival && rk.lastArrival.zone, toPad: +Math.hypot(S.x - LS.x, S.z - LS.z).toFixed(1), sep: L.heavy.boosters.length };

    // ---- a new stack: the side boosters on again, the old ones gone
    L.rocketRestock && L.rocketRestock();
    step(5);
    out.restock = { sides: L.vehicleModel.userData.rocket.sides.every(s => s.visible), flying: L.heavy.boosters.length };

    // ---- a tap during the watch hands the rocket back at once; and the go button is not up while it watches
    L.api.setVehicle("heavy"); L.api.spawnAt(0, 0); step(30);
    L.api.setThrottle(true);
    { const s1 = L.flags.heavySeparations || 0; for (let i = 0; i < 60 * 60 && (L.flags.heavySeparations || 0) === s1; i++) step(1); }
    step(30);
    const skipDuring = L.rocketCanSkip(), wasWatching = L.heavyWatching();
    L.api.setStick(0, 0); step(2); L.api.clearStick(); step(2);
    const y1 = S.y; step(60);
    out.tap = { wasWatching, skipDuring, after: L.heavyWatching(), climbed: +(S.y - y1).toFixed(0) };
    // ---- leaving for a car mid-flight: the boosters do not outlive it
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); step(5);
    out.leaveCar = { boosters: L.heavy.boosters.length };
    L.api.setThrottle(false);
    // ---- leaving it: the launch site's own rocket is back on its pad, armed
    L.api.setVehicle("rocket"); L.api.spawnAt(0, 0); step(30);
    out.leave = { stack: L.lsite.stack.visible, phase: L.lsite.phase };
    return out;
  });
  await page.close();
  const J = x => JSON.stringify(x);
  check("heavy: a card in the picker; picked, it stands on the launch site's pad by the motorway, the site's own stack stepped aside and not counting", r.card && r.pad.kind === "rocket" && r.pad.toPad < 3 && r.pad.stackHidden && r.pad.phase === "armed" && r.pad.sides && r.pad.onPad, J({ card: r.card, ...r.pad }));
  check("heavy: the throttle held and nothing else -- it climbs and the two side boosters let go by themselves", r.sep.n === 2 && !r.sep.sidesAttached && r.sep.watching && r.sep.secs < 60, J(r.sep));
  check("heavy: the camera gives him the boosters -- both in the picture nearly all the way home, while the rocket holds for him", r.watch.bothInView >= 0.85 && r.watch.held && r.watch.secs > 8, J(r.watch));
  check("heavy: both boosters land upright on the launch site's two pads, legs out, with a boom on the way down", r.watch.landings === 2 && r.watch.boosters.every(b => b.landed && b.onPad < 8 && b.tilt < 5) && r.watch.booms >= 2, J(r.watch));
  check("heavy: then the camera is back on him and the flight goes on", r.after.camToRocket < 120 && r.after.climbed > 20 && r.after.stage === 0, J(r.after));
  check("heavy: and the rest is the rocket's -- the core (flown home too), the fairing, the second stage", r.rest.drops.every(d => d) && r.rest.stage === 3 && r.rest.coreHome, J(r.rest));
  check("heavy: a hop off the pad and the throttle let go -- it comes back down and lands on the launch site's pad", r.home.landed && r.home.zone === "pad" && r.home.toPad < 20, J(r.home));
  check("heavy: a new stack has its side boosters on again", r.restock.sides && r.restock.flying === 0, J(r.restock));
  check("heavy: a tap on the screen during the watch hands him the rocket at once; the go button is not up while it watches", r.tap.wasWatching && !r.tap.skipDuring && !r.tap.after && r.tap.climbed > 5, J(r.tap));
  check("heavy: leaving for a car mid-flight, the flying boosters go with it", r.leaveCar.boosters === 0, J(r.leaveCar));
  check("heavy: leaving it, the launch site's own rocket is back on its pad, armed", r.leave.stack && r.leave.phase === "armed", J(r.leave));
  check("heavy: no bang anywhere in the flight", r.bangs === 0, J({ bangs: r.bangs }));
  check("heavy: no browser or frame errors", errors.length === 0, J(errors.slice(0, 5)));
};
