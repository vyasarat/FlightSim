const path = require('path');
module.exports = async function toyworldChecks({ newPage, check, shots }) {
  const { page } = await newPage(1180, 760);
  const out = await page.evaluate(() => {
    const L = window.__lp, st = L.state, world = L.toyWorld, P = L.TW.playground, o = {};
    L.noRender = true; L.api.skipScreens(); L.api.setVehicle('helicopter'); L.api.placeOnRunway(); L.update(1 / 60);
    const step = s => { for (let i = 0; i < s * 60; i++) L.update(1 / 60); };
    const air = (x, y, z) => { L.heliReset(); st.phase = 'AIRBORNE'; st.x = x; st.y = y; st.z = z; st.speed = 0; L.heli.altitude = y; };
    const cargo = world.objects[0], yard = cargo.yard;
    air(cargo.x, yard.y + 35, cargo.z); step(.2);
    o.preview = world.candidate === cargo && world.highlight.visible && !world.held;
    step(.6); o.pickup = world.held === cargo && !el.magnetBtn.classList.contains('hidden') && el.bucketBtn.classList.contains('hidden');
    const pos = { x: st.x, y: st.y, z: st.z };
    st.x += 40; st.y += 15; L.heli.altitude = st.y; step(.2);
    o.carry = cargo.x === st.x && Math.abs(cargo.y - (st.y - P.cable - 3 - cargo.h / 2)) < .01 && st.x === pos.x + 40;
    // Physical drop onto another block, with no repick until the helicopter leaves.
    const base = world.objects[3]; st.x = base.x; st.z = base.z; st.y = yard.y + 40; L.heli.altitude = st.y; step(.05);
    L.twRelease(); step(3);
    o.release = !world.held && world.dropLock && cargo.lock;
    o.stack = Math.abs(cargo.y - (base.y + base.h / 2 + cargo.h / 2)) < 1;
    st.x += P.leaveR + 60; step(.2); st.x = cargo.x; st.z = cargo.z; st.y = yard.y + 40; L.heli.altitude = st.y; step(1);
    o.repickup = world.held === cargo;
    st.x = yard.pad.x; st.z = yard.pad.z; st.y = yard.y + 36; L.heli.altitude = st.y; step(.1); L.twRelease(); step(1.6);
    o.deliveryStarted = !!yard.delivery;
    step(P.deliveryTime + 1);
    o.delivered = yard.built === 1 && yard.build[0].visible && !yard.delivery;
    o.replenished = !cargo.delivering && Math.abs(cargo.x - cargo.homeX) < .1 && cargo.g.visible;
    // A full bucket remains a bucket even inside the yard. It never grabs toys.
    L.bucket.state = 'full'; air(cargo.homeX, yard.y + 34, cargo.homeZ); step(1);
    o.fullBucket = !world.held && !world.magnet.visible && L.bucket.g.visible;
    L.bucket.state = 'empty'; world.dropLock = false; step(1);
    o.magnetAgain = world.held === cargo;
    // Carrying across water cannot also scoop a bucket.
    st.x = L.fire.x + 180; st.z = L.fire.z; st.y = L.TUNE.waterLevel + 20; L.heli.altitude = st.y; step(.1);
    o.noDualMode = !!world.held && !L.bucketCanScoop() && el.bucketBtn.classList.contains('hidden');
    L.api.setVehicle('prop'); L.api.placeOnRunway(); step(.1);
    o.switchRelease = !world.held && !world.magnet.visible;
    // The same pool returns forgotten cargo instead of growing without bound.
    cargo.x = cargo.homeX + P.radius * 3; cargo.z = cargo.homeZ; cargo.away = P.recycleAfter; step(.1);
    o.recycle = Math.abs(cargo.x - cargo.homeX) < .1;
    return o;
  });
  check('toy world: magnet preview, pickup, stable carry, release lock, stacking, delivery and replenishment', out.preview && out.pickup && out.carry && out.release && out.stack && out.repickup && out.deliveryStarted && out.delivered && out.replenished, JSON.stringify(out));
  check('toy world: bucket/magnet exclusion, switching vehicles and recycling abandoned cargo', out.fullBucket && out.magnetAgain && out.noDualMode && out.switchRelease && out.recycle, JSON.stringify(out));
  const wash = await page.evaluate(() => {
    const L = window.__lp, st = L.state, out = [];
    L.api.skipScreens();
    const step = s => { for (let i = 0; i < s * 60; i++) L.update(1 / 60); };
    for (const vehicle of ['prop', 'fighter', 'airlinerEmirates', 'helicopter', 'rocket', 'starship']) {
      L.api.setVehicle(vehicle); L.api.placeOnRunway(); step(.1); L.toyWorld.washCooldown = 0;
      const start = { x: st.x, y: st.y, z: st.z }; const can = L.twWashStart();
      const open = L.toyWorld.wash && L.toyWorld.wash.open;
      step(3); const foam = L.toyWorld.bubbles.visible && !st.exploding;
      step(6); const finish = !L.toyWorld.wash && st.phase === 'TAXI' && !st.exploding && Math.hypot(st.x - start.x, st.z - start.z) < 1;
      step(L.TW.wash.repeatDelay); const repeat = L.twWashStart(); step(9);
      out.push({ vehicle, can, open, foam, finish, repeat });
    }
    L.api.setVehicle('helicopter'); L.api.placeOnRunway(); step(.1); L.toyWorld.washCooldown = 0;
    const w = L.toyWorld.washes[0]; st.x = w.x; st.z = w.z; st.y = w.y + L.TUNE.gearHeight; st.phase = 'TAXI'; L.heliReset(); step(.1);
    const entry = !!L.toyWorld.wash;
    step(9); const exitClear = Math.hypot(st.x - w.x, st.z - w.z) > L.TW.wash.entryR;
    step(5); const waitsForChild = !L.toyWorld.wash;
    L.toyWorld.washCooldown = 0; L.twWashStart();
    L.api.setVehicle('prop'); L.api.placeOnRunway(); step(.1);
    return { out, entry, exitClear, waitsForChild, interruption: !L.toyWorld.wash && !L.toyWorld.bubbles.visible };
  });
  check('toy world: wash guides every vehicle, uses open alternatives, finishes, repeats and releases on vehicle switch', wash.out.every(v => v.can && v.foam && v.finish && v.repeat && (!['rocket', 'starship'].includes(v.vehicle) || v.open)) && wash.entry && wash.exitClear && wash.waitsForChild && wash.interruption, JSON.stringify(wash));
  const clearance = await page.evaluate(() => {
    const L = window.__lp;
    L.api.setVehicle('prop'); L.api.placeOnRunway(); L.update(1 / 60);
    // Exercise the size guard independently of today's vehicle catalogue.
    const scale = vehicleModel.scale.clone(); vehicleModel.scale.multiplyScalar(20); vehicleModel.updateMatrixWorld(true);
    L.toyWorld.washCooldown = 0;
    const oversized = L.twWashStart() && L.toyWorld.wash.open;
    vehicleModel.scale.copy(scale); twWashRestore(L.toyWorld.wash); L.toyWorld.wash = null;
    scene.updateMatrixWorld(true);
    const bounds = [...L.toyWorld.washes, ...L.toyWorld.yards].map(s => {
      const box = new THREE.Box3().setFromObject(s.g);
      return { min: box.min.x, max: box.max.x };
    });
    return { oversized, bounds, clear: bounds.every(b => b.min > TUNE.runwayWidth / 2 || b.max < -TUNE.runwayWidth / 2) };
  });
  check('toy world: oversized aircraft use open spray and both airports keep structures off the runway', clearance.oversized && clearance.clear, JSON.stringify(clearance));
  const knock = await page.evaluate(() => {
    const L = window.__lp, [a, b] = L.toyWorld.objects;
    twObjectHome(a); twObjectHome(b);
    a.x = b.x + 3; a.z = b.z; a.y = b.y; a.vy = -12;
    const x = b.x; twUpdateCargo(1 / 60);
    const reacts = b.tilt > .1 && Math.abs(b.vx) > 0;
    for (let i = 0; i < 600; i++) twUpdateCargo(1 / 60);
    const settles = Number.isFinite(b.y) && Math.abs(b.vx) < 1 && b.tilt < .1 && Math.abs(b.x - x) > .1;
    const end = { vx: b.vx, tilt: b.tilt, moved: b.x - x };
    twObjectHome(a); twObjectHome(b);
    return { reacts, settles, end };
  });
  check('toy world: loose cargo can knock toys over and settle safely', knock.reacts && knock.settles, JSON.stringify(knock));
  const welcome = await page.evaluate(() => {
    const L = window.__lp, st = L.state, a = L.airports[0];
    L.api.setVehicle('prop'); L.api.placeOnRunway(); L.update(1 / 60);
    st.phase = 'LANDED'; st.speed = 0; L.flags.touchdown++; L.update(1 / 60);
    const began = a.twWelcome > 0;
    for (let i = 0; i < 90; i++) L.update(1 / 60);
    const sides = a.vehicles.every(v => Math.abs(v.x) >= L.TW.welcome.clearance - 1);
    L.toyWorld.soundT = 0; L.twHorn(); const before = L.flags.truckReplies || 0;
    for (let i = 0; i < 50; i++) L.update(1 / 60);
    const reply = (L.flags.truckReplies || 0) > before;
    st.throttleHeld = true; L.update(1 / 60);
    const clear = a.twWelcome === 0 && a.vehicles.every(v => v.tx === v.homeX && Math.abs(v.x) >= L.TW.welcome.clearance);
    st.throttleHeld = false;
    return { began, sides, reply, clear };
  });
  check('toy world: landing starts the welcome, horn gets a reply, trucks stay clear and leave for takeoff', Object.values(welcome).every(Boolean), JSON.stringify(welcome));
  const trails = await page.evaluate(() => {
    const L = window.__lp, st = L.state, world = L.toyWorld;
    L.api.setVehicle('helicopter'); L.api.placeOnRunway(); L.update(1 / 60);
    const through = c => { st.phase = 'AIRBORNE'; st.x = c.x; st.y = c.y; st.z = c.z; st.speed = 20; twUpdateTrails(.1); };
    through(world.clouds[0]); const red = world.trailColor === 0 && !world.rainbow;
    through(world.clouds[1]); const yellow = world.trailColor === 1;
    through(world.clouds[3]); const rainbow = world.rainbow;
    const attrs = world.trail.geometry.attributes, n = attrs.position.count;
    for (let i = 0; i < L.TW.trails.capacity * 3; i++) { world.clock += .06; st.x += 2; twUpdateTrails(.06); }
    const bounded = attrs.position.count === n && world.trailHead < n && world.trailCount > n * 2;
    const colors = new Set(); for (let i = 0; i < n; i++) colors.add([attrs.color.getX(i), attrs.color.getY(i), attrs.color.getZ(i)].join(','));
    st.x += 200; twUpdateTrails(.1); through(world.clouds[0]); const reuse = !world.rainbow && world.trailColor === 0;
    world.clock += L.TW.trails.life + 1;
    const faded = [...attrs.born.array].every(t => world.clock - t > L.TW.trails.life);
    return { red, yellow, rainbow, bounded, multi: colors.size === L.TW.colors.length, reuse, faded, count: n };
  });
  check('toy world: reusable color/rainbow clouds, multicolored trails, fixed capacity and gradual expiry', trails.red && trails.yellow && trails.rainbow && trails.bounded && trails.multi && trails.reuse && trails.faded, JSON.stringify(trails));
  // Render every pooled activity over repeated cycles. Sample GPU memory after warm-up.
  const memory = await page.evaluate(() => {
    const L = window.__lp, world = L.toyWorld;
    L.api.setVehicle('helicopter'); L.api.placeOnRunway(); L.update(1 / 60);
    const samples = [];
    world.root.traverse(m => { m.frustumCulled = false; m.visible = true; });
    const draw = () => renderer.render(scene, camera);
    for (let k = 0; k < 5; k++) {
      for (const w of world.washes) {
        world.washCooldown = 0; twWashStart(w);
        for (let i = 0; i < (L.TW.wash.duration + .2) * 20; i++) {
          twWashGuide(.05); twUpdateWash(.05);
          if (i % 40 === 0) draw();
        }
      }
      for (const o of world.objects) { twObjectHome(o); o.yard.build.forEach(m => { m.visible = true; }); o.yard.face.visible = true; }
      draw(); samples.push({ ...renderer.info.memory, programs: renderer.info.programs.length, children: world.root.children.length });
    }
    return samples;
  });
  check('toy world: repeated activity cycles keep GPU resources and scene objects bounded', memory.slice(1).every(s => JSON.stringify(s) === JSON.stringify(memory[1])), JSON.stringify(memory));
  // Render the actual activities with deliberate, readable camera positions.
  for (const kind of ['magnet', 'wash', 'rainbow']) {
    await page.evaluate(kind => {
      const L = window.__lp, st = L.state, world = L.toyWorld;
      L.api.setVehicle(kind === 'wash' ? 'prop' : 'helicopter'); L.api.placeOnRunway(); L.api.skipScreens(); L.update(1 / 60);
      L.api.setView(true);
      if (kind === 'magnet') {
        const o = world.objects[1], y = o.yard;
        st.phase = 'AIRBORNE'; st.x = o.homeX; st.y = y.y + 35; st.z = o.homeZ; L.heliReset(); L.heli.altitude = st.y;
        world.dropLock = false; L.bucket.state = 'empty';
        for (let i = 0; i < 120; i++) L.update(1 / 60);
        camera.up.set(0, 1, 0); camera.position.set(y.x - 70, y.y + 67, y.z + 112); camera.lookAt(y.x, y.y + 15, y.z);
      } else if (kind === 'wash') {
        world.washCooldown = 0; L.twWashStart(); for (let i = 0; i < 180; i++) L.update(1 / 60);
        const w = world.washes[0]; camera.up.set(0, 1, 0); camera.position.set(w.x + 40, w.y + 26, w.z + 72); camera.lookAt(w.x, w.y + 10, w.z);
      } else {
        world.wash = null; world.rainbow = true; world.trailColor = 3;
        const c = world.clouds[3];
        st.phase = 'AIRBORNE'; st.speed = 35;
        for (let i = 0; i < 1100; i++) {
          const a = i / 1100 * Math.PI * 5;
          st.x = c.x + Math.cos(a) * 95; st.z = c.z + Math.sin(a) * 100; st.y = c.y + 40 + Math.sin(a * 2) * 32;
          world.clock += .06; twUpdateTrails(.06);
        }
        L.heli.altitude = st.y; L.heli.speed = 35; L.update(1 / 60); updateVehicleModel(.1); camera.up.set(0, 1, 0); camera.position.set(c.x + 260, c.y + 190, c.z + 340); camera.lookAt(c.x, c.y + 40, c.z);
      }
      camera.updateMatrixWorld(); renderer.render(scene, camera); updateHud();
    }, kind);
    const perf = await page.evaluate(() => {
      const draw = visible => { toyWorld.root.visible = visible; for (let i = 0; i < 4; i++) renderer.render(scene, camera);
        const t = performance.now(); for (let i = 0; i < 25; i++) renderer.render(scene, camera);
        return { ms: (performance.now() - t) / 25, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }; };
      const off = draw(false), on = draw(true); return { off, on, addedCalls: on.calls - off.calls };
    });
    check(`toy world: ${kind} render stays within the draw-call budget`, perf.addedCalls <= 150, JSON.stringify(perf));
    if (kind === 'rainbow') {
      const rendered = await page.evaluate(() => {
        const gl = renderer.getContext(), a = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4), b = new Uint8Array(a.length);
        renderer.render(scene, camera); gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, a);
        toyWorld.trail.visible = false; renderer.render(scene, camera); gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, b);
        toyWorld.trail.visible = true; renderer.render(scene, camera);
        let changed = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]) > 5) changed++;
        const attr = toyWorld.trail.geometry.attributes;
        return { changed, count: toyWorld.trailCount, time: toyWorld.clock, latest: Math.max(...attr.born.array), phase: state.phase, speed: state.speed };
      });
      check('toy world: rainbow trail actually draws visible pixels', rendered.changed > 100, JSON.stringify(rendered));
    }
    await page.screenshot({ path: path.join(shots, `toyworld-${kind}.png`) });
  }
  await page.close();
  // Contextual controls, including real touch cancellation, at phone and iPad sizes.
  for (const [w, h] of [[844, 390], [390, 844], [1024, 768], [768, 1024]]) {
    const { page } = await newPage(w, h);
    const layout = await page.evaluate(() => {
      const L = window.__lp, st = L.state, world = L.toyWorld, out = [];
      L.noRender = true; L.api.skipScreens();
      const inspect = label => {
        const buttons = [...document.querySelectorAll('.roundBtn, #throttleBtn')].filter(b => getComputedStyle(b).display !== 'none' && !b.classList.contains('hidden'));
        const bad = buttons.filter(b => { const r = b.getBoundingClientRect(); return r.width < 48 || r.height < 48 || r.top < 0 || r.bottom > innerHeight || document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2).closest('button') !== b; }).map(b => b.id);
        out.push({ label, bad });
      };
      L.api.setVehicle('prop'); L.api.placeOnRunway(); L.update(1 / 60); inspect('parked wash');
      L.api.setVehicle('helicopter'); L.api.placeOnRunway();
      for (let i = 0; i < 90; i++) L.update(1 / 60);
      camera.updateMatrixWorld(); const yard = world.yards[0];
      const invitation = new THREE.Vector3(yard.x, yard.y + 25, yard.z).project(camera);
      out.push({ label: 'playground visible from spawn', bad: invitation.z < 1 && Math.abs(invitation.x) < .8 && Math.abs(invitation.y) < .8 ? [] : ['offscreen'] });
      const o = world.objects[0]; st.phase = 'AIRBORNE'; st.x = o.x; st.y = o.yard.y + 35; st.z = o.z; L.heliReset(); L.heli.altitude = st.y;
      for (let i = 0; i < 90; i++) L.update(1 / 60); inspect('magnet + altitude');
      return out;
    });
    const cdp = await page.context().newCDPSession(page);
    const btn = await page.locator('#heliUpBtn').boundingBox();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: btn.x + btn.width / 2, y: btn.y + btn.height / 2, id: 1 }] });
    await page.evaluate(() => { for (let i = 0; i < 60; i++) window.__lp.update(1 / 60); });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    const compatible = await page.evaluate(() => window.__lp.heli.vertical === 0 && !!window.__lp.toyWorld.held);
    await page.locator('#magnetBtn').dispatchEvent('pointerdown', { pointerId: 3 });
    const released = await page.evaluate(() => !window.__lp.toyWorld.held);
    check(`toy world ${w}x${h}: controls are reachable, altitude touch preserves carry, cancellation holds, one tap releases`, layout.every(s => s.bad.length === 0) && compatible && released, JSON.stringify({ layout, compatible, released }));
    await page.close();
  }
};
