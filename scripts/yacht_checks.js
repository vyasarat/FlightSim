// ---------------------------------------------------------------------------
// Stage 2 of BOATS: the yacht.
//
// Behavioural throughout. "The helicopter can land on the pad" is not asserted
// by the pad existing, or even by the helicopter reaching it -- it is asserted
// by driving the ship away afterwards and checking the helicopter went with her.
// ---------------------------------------------------------------------------
const path = require("path");

module.exports = async function yachtChecks({ newPage, check, shots }) {
  const { page } = await newPage(1180, 820);
  await page.evaluate(() => { window.__lp.noRender = true; });

  // ---- she gets out of the marina under one finger -------------------------
  const out = await page.evaluate(() => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("yacht"); L.api.spawnAt(1, 1);
    const start = { x: Math.round(st.x), z: Math.round(st.z) };
    let peak = 0, throughMouth = false;
    for (let i = 0; i < 60 * 75; i++) {
      L.api.setStick(0, 0); L.update(1 / 60);
      peak = Math.max(peak, st.speed);
      if (!throughMouth && st.z < L.HB.mouth.z[0]) throughMouth = true;
    }
    L.api.clearStick();
    return { start, throughMouth, peak: +peak.toFixed(1), x: Math.round(st.x), z: Math.round(st.z),
             water: L.terrainEff(st.x, st.z) < L.TUNE.waterLevel, exploded: st.exploding };
  });
  check("yacht: one finger takes her out of the marina, down the harbour and through the mouth without piling her up on anything",
    out.throughMouth && out.peak > 12 && out.water && !out.exploded, JSON.stringify(out));

  // ---- she cannot beach ----------------------------------------------------
  const shoal = await page.evaluate(() => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("yacht"); L.api.spawnAt(1, 1);
    // pointed straight at the shore, full ahead, hands off the wheel
    st.x = L.HB.cx; st.z = -6420; st.heading = Math.PI; st.speed = L.YT.cruise;
    let aground = 0, minDepth = 99;
    for (let i = 0; i < 60 * 40; i++) {
      L.api.setStick(0, 0); L.update(1 / 60);
      const d = L.TUNE.waterLevel - L.terrainEff(st.x, st.z);
      minDepth = Math.min(minDepth, d);
      if (d < 0) aground++;
    }
    L.api.clearStick();
    return { aground, minDepth: +minDepth.toFixed(1), x: Math.round(st.x), z: Math.round(st.z) };
  });
  check("yacht: NEVER STUCK -- driven flat out straight at the beach with no steering she turns herself away and never goes aground",
    shoal.aground === 0, JSON.stringify(shoal));

  // ---- the drawbridge ------------------------------------------------------
  const bridge = await page.evaluate(() => {
    const L = window.__lp, st = L.state, b = L.harbor.bridge;
    L.api.setVehicle("yacht"); L.api.spawnAt(1, 1);
    b.want = 0; b.open = 0; b.state = "shut"; L.yacht.bridgeArmed = false;
    // start well north of it, pointed at the gap
    st.x = L.HB.cx; st.z = -6300; st.heading = 0; st.speed = L.YT.cruise;
    const shutAtStart = b.open < 0.02;
    let warned = false, maxOpen = 0, openWhenUnder = null, queued = 0;
    for (let i = 0; i < 60 * 90; i++) {
      L.api.setStick(0, 0); L.update(1 / 60);
      if (b.state === "warn") warned = true;
      maxOpen = Math.max(maxOpen, b.open);
      if (openWhenUnder === null && Math.abs(st.z - (-6745)) < 25) openWhenUnder = b.open;
      // is anything actually sitting still on the road while it is up?
      if (b.open > 0.5 && L.harbor.traffic) {
        for (const c of L.harbor.traffic.cars) if (Math.abs(c.x - 1150) < 160 || Math.abs(c.x - 1450) < 160) queued++;
      }
      if (st.z < -7400) break;
    }
    L.api.clearStick();
    // and it comes back down behind him, on its own
    for (let i = 0; i < 60 * 30; i++) L.update(1 / 60);
    return { shutAtStart, warned, maxOpen: +maxOpen.toFixed(2),
             openWhenUnder: openWhenUnder === null ? null : +openWhenUnder.toFixed(2),
             shutAfter: +b.open.toFixed(2), queued, lifts: L.flags.bridgeLifts || 0 };
  });
  check("yacht: the drawbridge winds up with bells and beacons, lifts before she gets there, holds the traffic on the road, and lowers itself behind her",
    bridge.shutAtStart && bridge.warned && bridge.maxOpen > 0.9 && bridge.openWhenUnder > 0.85 &&
    bridge.shutAfter < 0.05 && bridge.queued > 0, JSON.stringify(bridge));

  // ---- the speedboat fits under it without it opening ----------------------
  const under = await page.evaluate(() => {
    const L = window.__lp, st = L.state, b = L.harbor.bridge;
    b.want = 0; b.open = 0; b.state = "shut"; L.yacht.bridgeArmed = false;
    L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
    st.x = L.HB.cx; st.z = -6300; st.heading = 0; st.speed = L.BT.cruise;
    let maxOpen = 0, through = false;
    for (let i = 0; i < 60 * 40; i++) {
      L.api.setStick(0, 0); L.update(1 / 60);
      maxOpen = Math.max(maxOpen, b.open);
      if (st.z < -7000) { through = true; break; }
    }
    L.api.clearStick();
    return { through, maxOpen: +maxOpen.toFixed(2), crashes: L.flags.boatCrashes || 0 };
  });
  check("yacht: the speedboat fits under the drawbridge without it opening at all -- the lift belongs to the ship",
    under.through && under.maxOpen < 0.02, JSON.stringify(under));

  // ---- a moving helipad ----------------------------------------------------
  const pad = await page.evaluate(() => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("yacht"); L.api.spawnAt(1, 1);
    L.yacht.aboard = false;
    L.yacht.x = L.HB.cx; L.yacht.z = -6300; L.yacht.heading = 0;
    L.yachtPlace();
    const p0 = L.yachtPadWorld();
    // fly the helicopter over the pad and let it down
    L.api.setVehicle("helicopter");
    st.phase = "AIRBORNE"; st.x = p0.x; st.z = p0.z; st.y = p0.y + 40; st.speed = 0;
    L.heli.target = { x: p0.x, y: p0.y, z: p0.z };
    L.heli.altitude = p0.y + L.TUNE.gearHeight;
    L.heli.vy = 0; L.heli.vx = 0; L.heli.vz = 0;
    for (let i = 0; i < 60 * 25; i++) L.update(1 / 60);
    const landed = { phase: st.phase, y: +st.y.toFixed(2), want: +(p0.y + L.TUNE.gearHeight).toFixed(2),
                     on: L.yacht.heliOn, dx: +(st.x - p0.x).toFixed(1) };
    // now DRIVE HER AWAY and see whether he goes too
    const before = { x: st.x, z: st.z };
    for (let i = 0; i < 60 * 20; i++) {
      L.yacht.x += 8 / 60; L.yacht.z -= 12 / 60;
      L.yachtPlace();
      L.update(1 / 60);
    }
    const p1 = L.yachtPadWorld();
    return { landed, moved: Math.hypot(st.x - before.x, st.z - before.z),
             stillOnPad: Math.hypot(st.x - p1.x, st.z - p1.z) < L.YT.pad.r,
             yPhase: st.phase, still: L.yacht.heliOn };
  });
  check("yacht: the helicopter puts down on the stern pad and STAYS WITH THE SHIP -- she is driven a couple of hundred metres and he is still on the pad",
    pad.landed.phase === "TAXI" && Math.abs(pad.landed.y - pad.landed.want) < 1.2 && pad.landed.on &&
    pad.moved > 100 && pad.stillOnPad, JSON.stringify(pad));

  // ---- point-to-go: touching the ship means the pad -------------------------
  const aim = await page.evaluate(() => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("yacht"); L.api.spawnAt(1, 1);
    L.yacht.aboard = false; L.yacht.x = L.HB.cx; L.yacht.z = -6300; L.yacht.heading = 0;
    L.yachtPlace();
    L.api.setVehicle("helicopter");
    // stand off her bow, high, looking at her
    // standing off her stern, looking AT her: heading 0 is forward along -z, and
    // she is at the more negative z of the two
    st.phase = "AIRBORNE"; st.x = L.yacht.x; st.z = L.yacht.z + 320; st.y = 90;
    st.heading = 0; st.speed = 0;
    L.api.setView(true);
    // pin him while the chase camera settles: with nothing to chase, the
    // helicopter drifts and the shot is then of wherever it drifted to
    for (let i = 0; i < 40; i++) {
      L.update(1 / 60);
      st.x = L.yacht.x; st.z = L.yacht.z + 320; st.y = 90; st.heading = 0; st.speed = 0;
      L.heli.vx = L.heli.vy = L.heli.vz = 0; L.heli.altitude = 90;
    }
    L.update(1 / 60);
    // project the middle of the SHIP (not the pad) and touch it
    L.camera.updateMatrixWorld();
    const v = new THREE.Vector3(L.yacht.x, L.TUNE.waterLevel + 6, L.yacht.z).project(L.camera);
    // setStick, not setTouch: updateHelicopter only re-aims from the stick path
    // (`!state.touchIsPoint`), because a real finger aims through input.js's
    // setTouchPoint instead. The two mean the same thing on screen.
    L.api.setStick(v.x, v.y);
    L.update(1 / 60);
    L.api.clearStick();
    const p = L.yachtPadWorld();
    const t = L.heli.target;
    return { onScreen: v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1, ndc: [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(3)],
             follows: !!L.heli.followPad,
             toPad: t ? +Math.hypot(t.x - p.x, t.z - p.z).toFixed(1) : null,
             toMiddle: t ? +Math.hypot(t.x - L.yacht.x, t.z - L.yacht.z).toFixed(1) : null,
             at: [Math.round(st.x), Math.round(st.z), Math.round(st.y), +st.heading.toFixed(2)],
             cam: [Math.round(L.cameraPos.x), Math.round(L.cameraPos.y), Math.round(L.cameraPos.z)] };
  });
  check("yacht: touching the ship anywhere in the helicopter's point-to-go aims at the PAD, not at the piece of hull he happened to touch, and the aim then follows her",
    aim.onScreen && aim.follows && aim.toPad !== null && aim.toPad < 1, JSON.stringify(aim));

  // ---- the tender garage ---------------------------------------------------
  const garage = await page.evaluate(() => {
    const L = window.__lp, st = L.state;
    const btn = document.getElementById("garageBtn");
    L.api.setVehicle("yacht"); L.api.spawnAt(1, 1);
    L.yacht.aboard = false; L.yacht.tender = false;
    L.yacht.x = L.HB.cx; L.yacht.z = -6300; L.yacht.heading = 0;
    L.yachtPlace();
    // in the speedboat, far away: no button
    L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
    st.x = 1500; st.z = -6200; L.update(1 / 60);
    const far = !btn.classList.contains("hidden");
    // alongside her transom: the button appears
    const m = { x: L.yacht.x, z: L.yacht.z + L.YT.garage.z + L.YT.garage.reach + 20 };
    st.x = m.x; st.z = m.z; st.speed = 0; L.update(1 / 60);
    const near = !btn.classList.contains("hidden");
    const modeIn = btn.dataset.mode;
    L.yachtGaragePress();
    L.update(1 / 60);
    const aboard = { vehicle: st.vehicleKey, tender: L.yacht.tender, mode: btn.dataset.mode,
                     up: !btn.classList.contains("hidden") };
    // she carries it: drive her, and the boat is still inside
    for (let i = 0; i < 60 * 12; i++) { L.api.setStick(0, 0); L.update(1 / 60); }
    L.api.clearStick();
    const carried = { tender: L.yacht.tender, z: Math.round(st.z), vehicle: st.vehicleKey };
    // and the same button lets it out again
    L.yachtGaragePress();
    L.update(1 / 60);
    const launched = { vehicle: st.vehicleKey, tender: L.yacht.tender,
                       water: L.terrainEff(st.x, st.z) < L.TUNE.waterLevel,
                       fromShip: +Math.hypot(st.x - L.yacht.x, st.z - L.yacht.z).toFixed(0) };
    return { far, near, modeIn, aboard, carried, launched };
  });
  check("yacht: the tender garage -- no button out in the harbour, a button alongside her transom, the speedboat goes in and she carries it, and the same button launches it back out onto the water",
    !garage.far && garage.near && garage.aboard.vehicle === "yacht" && garage.aboard.tender &&
    garage.aboard.mode === "out" && garage.carried.tender && garage.carried.z < -6400 &&
    garage.launched.vehicle === "speedboat" && !garage.launched.tender && garage.launched.water,
    JSON.stringify(garage));

  // ---- the horn, and the harbour answering it ------------------------------
  const horn = await page.evaluate(() => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("yacht"); L.api.spawnAt(1, 1);
    st.x = L.HB.ferry.route[0][0]; st.z = L.HB.ferry.route[0][1] - 60;
    L.flags.yachtHorns = 0; L.flags.yachtReplies = 0;
    // drag UP is the horn, not a burst
    const before = st.speed;
    L.api.setStick(0, 1);
    for (let i = 0; i < 30; i++) L.update(1 / 60);
    const honked = L.flags.yachtHorns || 0;
    for (let i = 0; i < 60 * 2; i++) L.update(1 / 60);
    L.api.clearStick();
    return { honked, replies: L.flags.yachtReplies || 0, before };
  });
  check("yacht: drag up is the HORN, not a burst, and the ferry and the tug answer it",
    horn.honked >= 1 && horn.replies >= 1, JSON.stringify(horn));

  // ---- the anchor ----------------------------------------------------------
  const anchor = await page.evaluate(() => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("yacht"); L.api.spawnAt(1, 1);
    st.x = L.HB.cx; st.z = -6300; st.speed = 0;
    L.api.clearStick();
    let dropAt = null;
    for (let i = 0; i < 60 * 6; i++) { L.update(1 / 60); if (dropAt === null && L.yacht.anchorDown) dropAt = +(i / 60).toFixed(1); }
    const held = { down: L.yacht.anchorDown };
    // holding the anchor means holding the ship: a finger down does not move her
    L.api.setStick(0, 0);
    for (let i = 0; i < 30; i++) L.update(1 / 60);
    const up = L.yacht.anchorDown;
    for (let i = 0; i < 60 * 6; i++) L.update(1 / 60);
    const moving = st.speed;
    L.api.clearStick();
    return { dropAt, held, up, moving: +moving.toFixed(1) };
  });
  check("yacht: finger off for three seconds at rest and the anchor goes down with a chain roar; a finger on hauls it up again and she gets under way. Pure ritual -- nothing is unlocked and nothing is required",
    anchor.dropAt !== null && anchor.dropAt >= 2.8 && anchor.dropAt < 4.2 && anchor.held.down &&
    !anchor.up && anchor.moving > 4, JSON.stringify(anchor));

  // ---- both views ----------------------------------------------------------
  const views = await page.evaluate(() => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("yacht"); L.api.spawnAt(1, 1);
    st.speed = 10;
    L.api.setView(true); L.update(1 / 60);
    const chase = { model: !!(L.vehicleModel && L.vehicleModel.visible), bridge: !!(L.yacht.bridgeG && L.yacht.bridgeG.visible) };
    L.api.setView(false); L.update(1 / 60);
    const w0 = L.yacht.bridgeWheel ? L.yacht.bridgeWheel.rotation.z : null;
    L.api.setStick(1, 0);
    for (let i = 0; i < 60; i++) { L.update(1 / 60); st.speed = 10; }
    L.api.clearStick();
    const w1 = L.yacht.bridgeWheel ? L.yacht.bridgeWheel.rotation.z : null;
    const inside = { model: !!(L.vehicleModel && L.vehicleModel.visible), bridge: !!(L.yacht.bridgeG && L.yacht.bridgeG.visible) };
    const radarTurned = L.yacht.bridgeRadar && L.yacht.bridgeRadar.a > 0.2;
    L.api.setVehicle("prop");
    const stowed = !(L.yacht.bridgeG && L.yacht.bridgeG.visible);
    const backInWorld = !!(L.yacht.g && L.yacht.g.visible);
    return { chase, inside, turned: Math.abs(w1 - w0), radarTurned, stowed, backInWorld };
  });
  check("yacht: two views -- chase shows the ship, the wheelhouse shows the wheel turning and the radar sweeping and no hull, and she goes back into the world as an object the moment he steps off her",
    views.chase.model && !views.chase.bridge && !views.inside.model && views.inside.bridge &&
    views.turned > 0.1 && views.radarTurned && views.stowed && views.backInWorld, JSON.stringify(views));

  // ---- zero text, wheelhouse and radar in frame ----------------------------
  const text = await page.evaluate(() => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("yacht"); L.api.spawnAt(1, 1);
    st.x = L.HB.cx; st.z = -6400; st.speed = 8;
    L.api.setView(false);
    for (let i = 0; i < 60; i++) L.update(1 / 60);
    const bad = [];
    const walk = (n) => {
      if (n.nodeType === 3) { const t = n.textContent.trim(); if (t && !/^[0-9]+$/.test(t)) bad.push(t.slice(0, 24)); return; }
      if (n.nodeType !== 1 || n.tagName === "TITLE" || n.tagName === "SCRIPT" || n.tagName === "STYLE") return;
      if (getComputedStyle(n).display === "none") return;
      for (const c of n.childNodes) walk(c);
    };
    walk(document.body);
    return { bad: bad.slice(0, 5) };
  });
  check("yacht: zero text from the wheelhouse, with the radar sweeping -- it is a picture of where things are, never a readout",
    text.bad.length === 0, JSON.stringify(text));

  // ---- slots ---------------------------------------------------------------
  const slots = await page.evaluate(() => {
    const L = window.__lp, st = L.state;
    const overlaps = () => {
      const btns = [...document.querySelectorAll(".roundBtn")].filter(b => {
        const cs = getComputedStyle(b);
        return cs.display !== "none" && cs.visibility !== "hidden" && +cs.opacity > 0.05;
      });
      const bad = [];
      for (const b of btns) {
        const r = b.getBoundingClientRect();
        if (!r.width) continue;
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        const owner = hit && hit.closest(".roundBtn");
        if (owner && owner !== b) bad.push(b.id + " under " + owner.id);
      }
      return bad;
    };
    const out = [];
    const at = (name, setup) => {
      setup();
      for (let i = 0; i < 12; i++) L.update(1 / 60);
      const bad = overlaps();
      if (bad.length) out.push({ name, bad });
    };
    at("yacht at her berth", () => { L.api.setVehicle("yacht"); L.api.spawnAt(1, 1); L.yacht.tender = false; });
    at("yacht with the tender aboard", () => { L.api.setVehicle("yacht"); L.api.spawnAt(1, 1); L.yacht.tender = true; });
    at("speedboat alongside her transom", () => {
      L.api.setVehicle("yacht"); L.api.spawnAt(1, 1);
      L.yacht.aboard = false; L.yacht.tender = false;
      L.yacht.x = L.HB.cx; L.yacht.z = -6300; L.yacht.heading = 0; L.yachtPlace();
      L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
      st.x = L.yacht.x; st.z = L.yacht.z + L.YT.garage.z + L.YT.garage.reach + 20;
    });
    at("helicopter on her pad", () => {
      L.api.setVehicle("yacht"); L.api.spawnAt(1, 1);
      L.yacht.aboard = false; L.yacht.x = L.HB.cx; L.yacht.z = -6300; L.yachtPlace();
      const p = L.yachtPadWorld();
      L.api.setVehicle("helicopter");
      st.phase = "AIRBORNE"; st.x = p.x; st.z = p.z; st.y = p.y + L.TUNE.gearHeight; st.speed = 0;
    });
    return out;
  });
  check("yacht: no two visible buttons ever land in the same slot around her -- at the berth, with the tender aboard, alongside in the speedboat, and with the helicopter on her pad",
    slots.length === 0, JSON.stringify(slots));

  await page.screenshot({ path: path.join(shots, "yacht-harbour.png") });
  await page.close();

  // ---- frame time at the drawbridge, with the traffic queued ---------------
  {
    const { page } = await newPage(1180, 820);
    const perf = await page.evaluate(() => {
      const L = window.__lp, st = L.state, b = L.harbor.bridge;
      L.api.setVehicle("yacht"); L.api.spawnAt(1, 1);
      const place = () => {
        st.x = L.HB.cx; st.z = -6560; st.heading = 0; st.speed = L.YT.cruise; st.y = L.TUNE.waterLevel;
        b.want = 1; b.open = 1; b.state = "open";
      };
      const sample = (on) => {
        L.harbor.g.visible = on;
        place();
        for (let i = 0; i < 30; i++) { L.update(1 / 60); place(); L.harbor.g.visible = on; }
        const t0 = performance.now();
        for (let i = 0; i < 50; i++) { L.update(1 / 60); place(); L.harbor.g.visible = on; L.renderer.render(L.scene, L.camera); }
        return { ms: (performance.now() - t0) / 50, calls: L.renderer.info.render.calls };
      };
      const a = [], c = [];
      for (let i = 0; i < 5; i++) { a.push(sample(true)); c.push(sample(false)); }
      const med = (v, k) => v.map(s => s[k]).sort((x, y) => x - y)[Math.floor(v.length / 2)];
      L.harbor.g.visible = true;
      return { withMs: +med(a, "ms").toFixed(2), withoutMs: +med(c, "ms").toFixed(2),
               calls: med(a, "calls"), callsWithout: med(c, "calls") };
    });
    const added = perf.calls - perf.callsWithout;
    check("yacht: the drawbridge open with the traffic queued on it stays inside the draw-call budget (SwiftShader: calls are the hardware proxy, cpuMs only a bound)",
      added < 90 && perf.withMs < 220, JSON.stringify({ ...perf, added }));
    console.log(`INFO  drawbridge perf: ${perf.withMs} ms with the port vs ${perf.withoutMs} ms without, +${added} draw calls (swiftshader, interleaved)`);
    await page.close();
  }
};
