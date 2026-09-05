// Real touchscreen events: each action ends before the next begins.
const path = require('path');
module.exports = async function heliControlChecks({ newPage, check, shots }) {
  for (const [width, height] of [[844, 390], [390, 844], [1024, 768], [768, 1024]]) {
    const { page } = await newPage(width, height);
    const cdp = await page.context().newCDPSession(page);
    const step = seconds => page.evaluate(s => { for (let i = 0; i < s * 60; i++) window.__lp.update(1 / 60); }, seconds);
    const touch = (type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y, id: 1 }] : [] });
    const at = async id => page.locator('#' + id).evaluate(e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    const tap = async p => { await touch('touchStart', p); await step(1 / 60); await touch('touchEnd'); await step(1 / 60); };
    const hold = async (id, seconds) => { await touch('touchStart', await at(id)); await step(seconds); await touch('touchEnd'); await step(1 / 60); };
    const snapshot = () => page.evaluate(() => {
      const L = window.__lp, s = L.state;
      return { x: s.x, y: s.y, z: s.z, speed: s.speed, phase: s.phase, target: L.heli.target, vertical: L.heli.vertical, touching: s.touching, exploding: s.exploding };
    });
    await page.evaluate(() => {
      const L = window.__lp; L.noRender = true; L.api.skipScreens(); L.api.setVehicle('helicopter'); L.api.placeOnRunway();
    });
    await step(1);
    const layout = await page.evaluate(() => {
      const ids = ['heliUpBtn', 'heliDownBtn', 'heliHoverBtn'];
      return ids.every(id => {
        const e = document.getElementById(id), r = e.getBoundingClientRect();
        return r.width >= 48 && r.height >= 48 && r.top >= 0 && r.bottom <= innerHeight && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2).closest('button') === e;
      }) && getComputedStyle(document.getElementById('throttleBtn')).display === 'none';
    });
    await hold('heliUpBtn', 2);
    const lifted = await snapshot(); await step(2); const hovering = await snapshot();
    check(`helicopter ${width}x${height}: large reachable controls; up lifts off and release holds altitude without throttle`, layout && lifted.phase === 'AIRBORNE' && lifted.y > 15 && Math.abs(hovering.y - lifted.y) < .1 && hovering.speed === 0, JSON.stringify({ lifted, hovering }));
    // A sky tap remains a fixed horizontal destination even after release and camera motion.
    await tap({ x: width * .58, y: height * .38 });
    await step(2);
    const travelling = await snapshot();
    await touch('touchStart', await at('heliUpBtn')); await step(1.5);
    const climbing = await snapshot();
    const pressed = await page.locator('#heliUpBtn').evaluate(e => e.classList.contains('pressed'));
    await touch('touchEnd'); await step(1); const released = await snapshot();
    check(`helicopter ${width}x${height}: steer, release, then climb with the same finger while horizontal travel continues`,
      travelling.target && climbing.target && JSON.stringify(travelling.target) === JSON.stringify(climbing.target) && climbing.y > travelling.y + 8 && climbing.speed > 20 && !climbing.touching && climbing.vertical === 1 && pressed && released.vertical === 0 && Math.abs(released.y - climbing.y) < .1,
      JSON.stringify({ travelling, climbing, released }));
    await hold('heliDownBtn', 1); const down = await snapshot(); await step(1); const held = await snapshot();
    check(`helicopter ${width}x${height}: down changes only altitude; release holds the new height`, down.y < released.y - 3 && held.target && held.speed > 20 && Math.abs(held.y - down.y) < .1, JSON.stringify({ down, held }));
    await tap(await at('heliHoverBtn')); await step(2); const stopped = await snapshot();
    check(`helicopter ${width}x${height}: hover stops horizontal travel and holds height`, !stopped.target && stopped.speed === 0 && Math.abs(stopped.y - held.y) < .1, JSON.stringify(stopped));
    // A complete tap between simulation frames still selects a destination.
    await touch('touchStart', { x: width * .55, y: height * .36 }); await touch('touchEnd');
    const quick = await snapshot();
    await touch('touchStart', await at('heliUpBtn')); await step(.2);
    const palm = await page.evaluate(() => {
      document.getElementById('heliUpBtn').dispatchEvent(new PointerEvent('pointerup', { pointerId: 999 }));
      return window.__lp.heli.vertical === 1;
    });
    await touch('touchEnd'); await tap(await at('heliHoverBtn')); await step(1);
    check(`helicopter ${width}x${height}: quick taps persist; another pointer cannot release altitude`, !!quick.target && palm);
    // A lost pointer/app switch cannot leave a climbing command or travel running.
    await touch('touchStart', await at('heliUpBtn')); await step(.2); await touch('touchCancel'); await step(.2);
    const cancelled = await snapshot();
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    check(`helicopter ${width}x${height}: pointer cancellation releases altitude`, cancelled.vertical === 0, JSON.stringify(cancelled));
    // Return to a flat runway to verify a deliberate descent and no auto re-launch.
    await page.evaluate(() => {
      const L = window.__lp; L.api.placeOnRunway(); L.state.phase = 'AIRBORNE'; L.state.y += 28; L.heliReset();
    });
    await step(.1); await hold('heliDownBtn', 8); await step(1); const landed = await snapshot();
    check(`helicopter ${width}x${height}: holding down lands softly and stays parked`, landed.phase === 'TAXI' && !landed.exploding && landed.speed === 0 && !landed.target, JSON.stringify(landed));
    // Independent world setup at scoop water; actual down and bucket touch controls.
    await page.evaluate(() => {
      const L = window.__lp, st = L.state, F = L.FF;
      L.api.placeOnRunway(); L.heliReset(); L.bucket.state = 'empty';
      let sea;
      for (let d = 180; d <= 500 && !sea; d += 40) for (let a = 0; a < 12 && !sea; a++) {
        const x = F.rig.x + Math.cos(a / 12 * Math.PI * 2) * d, z = F.rig.z + Math.sin(a / 12 * Math.PI * 2) * d;
        if (L.terrainEff(x, z) < L.TUNE.waterLevel - 2) sea = { x, z };
      }
      st.x = sea.x; st.z = sea.z; st.y = L.TUNE.waterLevel + 45; st.phase = 'AIRBORNE';
    });
    await step(.1); await hold('heliDownBtn', 9);
    const scoopVisible = await page.locator('#bucketBtn').isVisible();
    await tap(await at('bucketBtn')); await step(5);
    const filled = await page.evaluate(() => window.__lp.bucket.state === 'full' && window.__lp.state.phase === 'AIRBORNE');
    await page.evaluate(() => {
      const L = window.__lp; heliHover(); L.state.x = L.FF.rig.x + 30; L.state.z = L.FF.rig.z + 30; L.state.y = L.fire.deck + 60; L.heli.altitude = L.state.y;
    });
    await step(1);
    const beforeDrop = await page.evaluate(() => window.__lp.flags.ffDrops || 0);
    await tap(await at('bucketBtn')); await step(.1);
    const dropped = await page.evaluate(n => (window.__lp.flags.ffDrops || 0) > n, beforeDrop);
    check(`helicopter ${width}x${height}: descend to the water hover floor, scoop and drop by single taps`, scoopVisible && filled && dropped, JSON.stringify({ scoopVisible, filled, dropped }));
    // Capture the actual controls and a visible destination in both camera styles.
    await page.evaluate(chase => {
      const L = window.__lp; L.api.placeOnRunway(); L.state.phase = 'AIRBORNE'; L.state.y += 100; L.heliReset(); L.api.setView(chase);
    }, width > height);
    await step(2); await tap({ x: width * .56, y: height * .36 }); await step(1);
    await touch('touchStart', await at('heliUpBtn')); await step(.4);
    await page.evaluate(() => { const L = window.__lp; L.renderer.render(L.scene, L.camera); });
    await page.screenshot({ path: path.join(shots, `heli-controls-${width}x${height}.png`) });
    await touch('touchEnd');
    const switched = await page.evaluate(() => {
      const L = window.__lp, out = [];
      for (const v of ['prop', 'starship', 'helicopter']) {
        L.api.setVehicle(v); L.api.placeOnRunway(); L.update(1 / 60);
        out.push(!L.heli.target && L.heli.vertical === 0 && (v === 'helicopter' || getComputedStyle(document.getElementById('heliUpBtn')).display === 'none'));
      }
      return out.every(Boolean);
    });
    check(`helicopter ${width}x${height}: switching vehicles clears destination and altitude input`, switched);
    await page.close();
  }
  // Quantitative arrival and turnaround checks in an unobstructed area.
  const { page } = await newPage(1024, 768);
  const motion = await page.evaluate(() => {
    const L = window.__lp, st = L.state;
    L.noRender = true; L.api.skipScreens(); L.api.setVehicle('helicopter'); L.api.placeOnRunway(); st.phase = 'AIRBORNE'; st.y = 450; L.heliReset();
    const x = st.x, z = st.z, targetZ = z - 600;
    L.heli.target = { x, y: st.y, z: targetZ };
    let maxSpeed = 0, minZ = st.z;
    for (let i = 0; i < 60 * 20; i++) { L.update(1 / 60); maxSpeed = Math.max(maxSpeed, st.speed); minZ = Math.min(minZ, st.z); }
    const arrival = !L.heli.target && st.speed === 0 && Math.abs(st.z - targetZ) < 6 && minZ >= targetZ - 1;
    L.heli.target = { x: st.x, y: st.y, z: st.z + 500 };
    const h0 = st.heading;
    for (let i = 0; i < 60 * 4; i++) L.update(1 / 60);
    const turned = Math.abs(wrapPi(st.heading - h0)) > Math.PI * .85 && st.speed > 40;
    return { arrival, turned, maxSpeed, y: st.y, speed: st.speed, error: Math.abs(minZ - targetZ) };
  });
  check('helicopter: faster cruise, 180-degree turn, braking without overshoot, level altitude', motion.arrival && motion.turned && motion.maxSpeed > 60 && Math.abs(motion.y - 450) < .1, JSON.stringify(motion));
  const safety = await page.evaluate(() => {
    const L = window.__lp, st = L.state, out = {};
    const air = (x, y, z) => {
      L.api.placeOnRunway(); st.phase = 'AIRBORNE'; st.x = x; st.y = y; st.z = z; L.heliReset();
      for (let i = 0; i < 90; i++) L.update(1 / 60);
    };
    // Keep the original shallow-ray regression: sea beyond the coast, not the grazed field.
    const z = L.AIRPORTS[1].cz - 500;
    air(0, L.terrainEff(0, z) + 12, z);
    camera.updateMatrixWorld();
    const target = new THREE.Vector3(0, L.TUNE.waterLevel, L.AIRPORTS[1].cz - 1700).project(camera);
    const hit = heliPick(target.x, target.y);
    out.coast = !!hit && L.terrainEff(hit.point.x, hit.point.z) < L.TUNE.waterLevel;
    // An actual approach to the fire brakes inside drop range, and a new target leaves it.
    air(L.fire.x, L.fire.deck + 90, L.fire.z + 800);
    L.bucket.state = 'full'; L.heli.target = { x: L.fire.x, y: L.fire.deck, z: L.fire.z };
    for (let i = 0; i < 60 * 20; i++) L.update(1 / 60);
    out.fireArrival = st.speed === 0 && Math.hypot(st.x - L.fire.x, st.z - L.fire.z) < L.FF.dropR && !el.bucketBtn.classList.contains('hidden');
    L.heli.target = { x: st.x, y: st.y, z: st.z + 600 };
    for (let i = 0; i < 60 * 5; i++) L.update(1 / 60);
    out.leaveFire = st.speed > 40;
    st.exploding = true; L.heli.vertical = 1; updateHeliControls();
    out.crashClears = !L.heli.target && L.heli.vertical === 0 && L.heli.altitude === null;
    st.exploding = false; L.heli.target = { x: 1, y: 2, z: 3 }; L.heli.vertical = -1;
    skipToLanding();
    out.skipClears = !L.heli.target && L.heli.vertical === 0 && L.heli.altitude === null;
    return out;
  });
  check('helicopter: coastal picking, fire approach and departure, crash and landing-skip input resets', Object.values(safety).every(Boolean), JSON.stringify(safety));
  // Travel the missing leg of the bucket loop. Teleporting directly to scoop
  // water or the rig misses a destination cancelled at the shoreline boundary.
  const cdp = await page.context().newCDPSession(page);
  for (const [bucketState, x, z] of [['empty', -900, -6650], ['empty', -330, -6520], ['full', -330, -6520]]) {
    const aim = await page.evaluate(({ bucketState, x, z }) => {
      const L = window.__lp, s = L.state;
      L.api.placeOnRunway(); L.update(1 / 60); releaseAllInputs(); L.heliReset(); L.api.setView(false);
      s.x = x; s.z = z; s.y = Math.max(L.terrainEff(x, z), L.TUNE.waterLevel) + 26;
      s.phase = 'AIRBORNE'; s.pitch = s.bank = 0; s.heading = Math.atan2(-(L.fire.x - x), -(L.fire.z - z));
      L.heli.altitude = s.y; L.bucket.state = bucketState;
      for (let i = 0; i < 90; i++) L.update(1 / 60);
      renderer.render(scene, camera); camera.updateMatrixWorld();
      const p = new THREE.Vector3(L.fire.x, L.fire.deck + 8, L.fire.z).project(camera);
      return { x: (p.x + 1) * innerWidth / 2, y: (1 - p.y) * innerHeight / 2 };
    }, { bucketState, x, z });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...aim, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    // Cross the old scoop-stop boundary low, then use the same finger to lift
    // over the platform's solid deck and cabin, without choosing a new heading.
    await page.evaluate(() => { for (let i = 0; i < 120; i++) window.__lp.update(1 / 60); });
    const up = await page.locator('#heliUpBtn').boundingBox();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: up.x + up.width / 2, y: up.y + up.height / 2, id: 1 }] });
    await page.evaluate(() => { for (let i = 0; i < 180; i++) window.__lp.update(1 / 60); });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const route = await page.evaluate(() => {
      const L = window.__lp, s = L.state, target = L.heli.target && { ...L.heli.target };
      const selectedRig = target && Math.hypot(target.x - L.fire.x, target.z - L.fire.z) < 60;
      const explosions = L.flags.exploded || 0;
      let stoppedShort = false;
      for (let i = 0; i < 60 * 30; i++) {
        L.update(1 / 60);
        if (!L.heli.target && Math.hypot(s.x - L.fire.x, s.z - L.fire.z) > 60) stoppedShort = true;
      }
      const distance = Math.hypot(s.x - L.fire.x, s.z - L.fire.z);
      return { selectedRig, stoppedShort, distance, target, speed: s.speed, phase: s.phase, exploding: s.exploding,
        targetError: target && Math.hypot(s.x - target.x, s.z - target.z), bucket: L.bucket.state,
        noCollision: (L.flags.exploded || 0) === explosions,
        bucketVisible: !el.bucketBtn.classList.contains('hidden') };
    });
    check(`helicopter: real tap reaches the rig from ${x === -900 ? 'low scoop water' : 'shore'} with ${bucketState} bucket`,
      route.selectedRig && !route.stoppedShort && route.distance < 60 && route.targetError < 6 && route.speed === 0 && route.phase === 'AIRBORNE' && !route.exploding && route.noCollision && (bucketState === 'empty' || route.bucketVisible),
      JSON.stringify(route));
  }
  await page.evaluate(() => {
    const L = window.__lp; L.api.setView(true); updateVehicleModel(1 / 60);
    camera.up.set(0, 1, 0); camera.position.set(L.fire.x + 100, L.fire.deck + 90, L.fire.z + 130);
    camera.lookAt(L.fire.x, L.fire.deck + 10, L.fire.z); renderer.render(scene, camera);
  });
  await page.screenshot({ path: path.join(shots, 'heli-shore-arrival.png') });
  await page.close();
};
