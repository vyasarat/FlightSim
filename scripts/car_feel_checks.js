"use strict";
// ---------------------------------------------------------------------------
// HOW THE CAR FEELS IN THE HAND, IN NUMBERS.
//
// "Hard to control, unresponsive" turned out not to be the steering at all:
// raw response was already 33 ms to visible yaw and a lane change in under a
// second. What was wrong was that the LANE-KEEP OUTVOTED HIM. At 30% of stick
// he asked for 10 degrees a second and the car turned the other way; at 50% he
// lost three quarters of it. Below `override` the assist simply won.
//
// So the numbers below are the contract now: his command always gets through,
// the assist yields the moment he steers, and the drag it takes to reach full
// lock is a quarter of the screen rather than nearly half of it.
//
// The horn is here for the same reason -- it is a thing he holds in his hand.
// ---------------------------------------------------------------------------

module.exports = async function carFeelChecks({ newPage, check, viewports }) {
  for (const [w, h] of viewports) {
    const tag = `${w}x${h}`;
    const { page } = await newPage(w, h);

    const r = await page.evaluate(([W, H]) => {
      const L = window.__lp, st = L.state;
      L.noRender = true; L.api.skipScreens();
      const out = {};

      // ---- how far his thumb travels for full lock, as a share of the screen
      out.dragPctOfWidth = +((L.CAR.dragRangeX * W) / W * 100).toFixed(1);
      out.dragPx = Math.round(L.CAR.dragRangeX * W);

      // put him on a straight stretch of the main line, in lane, at a speed
      const onRoad = (speed) => {
        L.api.setVehicle("car"); L.api.placeOnRunway();
        for (let i = 0; i < 40; i++) { L.api.setStick(0, 0.9); L.update(1 / 60); }
        const q = L.hwySampleAt(L.highway.length * 0.30);
        const rx = -q.fz, rz = q.fx, off = L.HW.medianW / 2 + L.HW.laneW * 0.5;
        st.x = q.x + rx * off; st.z = q.z + rz * off; st.y = q.y;
        st.heading = Math.atan2(-q.fx, -q.fz); st.speed = speed;
        L.car.steer = 0; L.car.yield = 1; st.exploding = false;
        for (let i = 0; i < 30; i++) { L.api.setStick(0, 0.9); L.update(1 / 60); st.speed = speed; }
      };

      // ---- 1. time from a steer input to visible yaw
      onRoad(L.CAR.cruise);
      let t = 0, hit = null;
      for (let i = 0; i < 120; i++) {
        const h0 = st.heading;
        L.api.setStick(1, 0.9); L.update(1 / 60); st.speed = L.CAR.cruise;
        t += 1 / 60;
        const yr = Math.abs(L.wrapPi(st.heading - h0)) * 60 / Math.PI * 180;
        if (hit === null && yr >= 3) hit = t;
      }
      out.toVisibleYawMs = hit === null ? null : Math.round(hit * 1000);

      // ---- 2. yaw rate at full lock, at cruise and at a crawl. A car turns
      // TIGHTER slowly -- the old curve halved it, which is backwards for the
      // two places he needs it: junctions and exits.
      for (const [k, sp] of [["cruise", L.CAR.cruise], ["slow", 8]]) {
        onRoad(sp);
        for (let i = 0; i < 180; i++) { L.api.setStick(1, 0.9); L.update(1 / 60); st.speed = sp; }
        let sum = 0;
        for (let i = 0; i < 30; i++) {
          const h0 = st.heading; L.api.setStick(1, 0.9); L.update(1 / 60); st.speed = sp;
          sum += Math.abs(L.wrapPi(st.heading - h0)) * 60 / Math.PI * 180;
        }
        out["yaw_" + k] = +(sum / 30).toFixed(1);
      }

      // ---- 3. a real lane change: steer across, let go, settled in the new lane
      onRoad(L.CAR.cruise);
      {
        const l0 = L.hwyNearest(st.x, st.z).lateral;
        let tt = 0, settled = null, released = false;
        for (let i = 0; i < 60 * 10; i++) {
          const moved = Math.abs(L.hwyNearest(st.x, st.z).lateral - l0);
          if (!released && moved >= L.HW.laneW * 0.55) released = true;
          L.api.setStick(released ? 0 : 1, 0.9); L.update(1 / 60); st.speed = L.CAR.cruise; tt += 1 / 60;
          if (released) {
            const m2 = Math.abs(L.hwyNearest(st.x, st.z).lateral - l0);
            if (m2 >= L.HW.laneW * 0.85 && Math.abs(L.car.steer) < 1.5) { settled = tt; break; }
          }
        }
        out.laneChangeSec = settled === null ? null : +settled.toFixed(2);
      }

      // ---- 4. HIS COMMAND GETS THROUGH. At every stick position the car does
      // what he asked, to within the smoothing -- never less, and never the
      // other way. This is the number that was wrong.
      const pull = [];
      for (const bank of [0.2, 0.35, 0.5, 0.75, 1.0]) {
        onRoad(L.CAR.cruise);
        for (let i = 0; i < 90; i++) { L.api.setStick(bank, 0.9); L.update(1 / 60); st.speed = L.CAR.cruise; }
        const scaled = Math.min(1, bank * (L.TUNE.dragRangeX * Math.min(W, H)) / (L.CAR.dragRangeX * W));
        const want = Math.max(0, (scaled - L.CAR.deadzone) / (1 - L.CAR.deadzone)) * L.CAR.steerRate;
        pull.push({ bank, want: +want.toFixed(1), got: +L.car.steer.toFixed(1),
                    yieldLeft: +L.car.yield.toFixed(3) });
      }
      out.commandThrough = pull;

      // ---- 5. and the assist comes BACK when he lets go, or he could not be
      // walked home from an off-road wander
      // held out for `holdOff`, then back over `fadeBack`
      L.api.setStick(0, 0.9);
      const back = [];
      for (let i = 0; i < 120; i++) {
        L.update(1 / 60); st.speed = L.CAR.cruise;
        if (i === 15) out.yieldAt250ms = +L.car.yield.toFixed(2);
        back.push(+L.car.yield.toFixed(2));
      }
      out.yieldAfterRelease = +L.car.yield.toFixed(2);
      out.restoredInSec = +((back.findIndex(v => v > 0.99) + 1) / 60).toFixed(2);
      L.api.clearStick();
      return out;
    }, [w, h]);

    check(`car ${tag}: the steering answers him -- ${out_ms(r)} to visible yaw, ${r.yaw_cruise}°/s at full lock and ${r.yaw_slow}°/s at a crawl (tighter slowly, which is what a junction needs), and a lane change in ${r.laneChangeSec} s`,
      r.toVisibleYawMs !== null && r.toVisibleYawMs <= 100 &&
      r.yaw_slow > r.yaw_cruise * 1.15 &&
      r.laneChangeSec !== null && r.laneChangeSec < 2.2, JSON.stringify(r));

    const worst = r.commandThrough.reduce((m, p) => Math.min(m, p.want <= 0.5 ? 1 : p.got / p.want), 1);
    check(`car ${tag}: and the road never pulls against him -- at every stick position the car does what he asked (worst case ${Math.round(worst * 100)}% of it), the assist is fully out while he steers, still out a quarter of a second after he lets go, and all the way back ${r.restoredInSec} s later`,
      worst > 0.92 && r.commandThrough.every(p => p.got >= -0.01) &&
      r.commandThrough[r.commandThrough.length - 1].yieldLeft < 0.01 &&
      r.yieldAt250ms < 0.05 && r.yieldAfterRelease > 0.99 && r.restoredInSec < 1.3,
      JSON.stringify({ through: r.commandThrough, at250ms: r.yieldAt250ms, restoredIn: r.restoredInSec }));

    check(`car ${tag}: full lock is ${r.dragPx} px of drag, a quarter of the screen width -- it used to be 42% of it in portrait, which is most of the way across a phone`,
      r.dragPctOfWidth < 32, JSON.stringify(r));

    await page.close();
  }

  // ---- the horn. A compact EV, not a bus.
  {
    const { page } = await newPage(1024, 768);
    const live = await page.evaluate(async () => {
      const L = window.__lp;
      L.noRender = true; L.api.skipScreens();
      try { await L.audio.unlock(); return L.audio.ctxState() === "running"; } catch (e) { return false; }
    }).catch(() => false);
    const r = await page.evaluate((live) => {
      const L = window.__lp, st = L.state;
      L.api.setVehicle("car"); L.api.placeOnRunway();
      for (let i = 0; i < 30; i++) L.update(1 / 60);
      const H = L.TUNE.car.horn;
      const out = { live, hz: H.hz, tap: H.tap, attack: H.attack, release: H.release,
                    highpass: H.highpass, voices: live ? L.carHornVoices() : null };
      // a tap is short: press once, and it is over inside `tap`
      L.carHornPress(); L.carHornRelease();
      let onFor = 0;
      for (let i = 0; i < 60 * 3; i++) {
        L.update(1 / 60);
        if (L.car.hornT > 0) onFor += 1 / 60;
      }
      out.tapLasted = +onFor.toFixed(2);
      // and holding it sustains rather than retriggering
      L.carHornPress();
      for (let i = 0; i < 60 * 2; i++) L.update(1 / 60);
      out.heldStillOn = L.car.hornHeld;
      L.carHornRelease();
      for (let i = 0; i < 30; i++) L.update(1 / 60);
      out.releasedOff = !L.car.hornHeld && L.car.hornT <= 0;
      return out;
    }, live);
    const lowest = r.voices ? Math.min(...r.voices.hz) : Math.min(...r.hz);
    check(`car horn: a compact EV and not a bus -- every voice in it is above 350 Hz (lowest ${lowest}), there is a high-pass under them so there is no low fundamental at all, a tap lasts ${r.tapLasted} s, and holding it sustains without retriggering`,
      lowest > 350 && r.highpass >= 300 && r.tap <= 0.5 && r.tapLasted <= 0.5 &&
      r.attack <= 0.02 && r.release <= 0.08 && r.heldStillOn && r.releasedOff &&
      (!r.voices || r.voices.types.every(t => t !== "sawtooth")), JSON.stringify(r));
    await page.close();
  }
};

function out_ms(r) { return r.toVisibleYawMs === null ? "never" : r.toVisibleYawMs + " ms"; }
