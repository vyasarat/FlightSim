"use strict";
// ---------------------------------------------------------------------------
// No two visible controls may overlap -- at any viewport, on any vehicle.
//
// The harness already had a slot check, but only for `.roundBtn` and only at
// one viewport. Both gaps matter now: the speed control is a top-anchored
// ladder while the helicopter's altitude pair is bottom-anchored, so whether
// they collide depends entirely on how tall the screen is; and eject and the
// car's horn are small icons rather than roundBtns, so the old check could not
// see them at all.
//
// It tests the same thing the old one does -- elementFromPoint at each button's
// centre -- because that is what actually decides which control eats the tap.
// Corners as well as the centre: two buttons can overlap by a third and still
// each own their own middle.
// ---------------------------------------------------------------------------

module.exports = async function slotChecks({ newPage, check, viewports }) {
  for (const [w, h] of viewports) {
    const { page } = await newPage(w, h);
    const clashes = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.noRender = true; L.api.skipScreens();

      const SEL = ".roundBtn, #ejectBtn, #hornBtn, #menuBtn, #throttleBtn";
      const overlaps = () => {
        const btns = [...document.querySelectorAll(SEL)].filter(b => {
          const cs = getComputedStyle(b);
          return cs.display !== "none" && cs.visibility !== "hidden" && +cs.opacity > 0.05;
        });
        const bad = [];
        for (const b of btns) {
          const r = b.getBoundingClientRect();
          if (!r.width) continue;
          // the middle, and a point just inside each corner
          const pts = [
            [r.left + r.width / 2, r.top + r.height / 2],
            [r.left + 4, r.top + 4], [r.right - 4, r.top + 4],
            [r.left + 4, r.bottom - 4], [r.right - 4, r.bottom - 4],
          ];
          for (const [x, y] of pts) {
            if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
            const hit = document.elementFromPoint(x, y);
            const owner = hit && hit.closest(SEL);
            if (owner && owner !== b) { bad.push(b.id + " under " + owner.id); break; }
          }
        }
        return [...new Set(bad)];
      };

      const out = [];
      const at = (name, setup) => {
        setup();
        for (let i = 0; i < 14; i++) L.update(1 / 60);
        // The geometric test, PLUS the system's own answer from the same table
        // the game resolves buttons with (btnSlotClashes in js/buttons.js). The
        // declared test catches a clash the geometry cannot see -- two buttons
        // that share a slot but whose CSS has drifted apart -- and the geometry
        // catches one the table cannot, a button sitting somewhere its entry
        // does not claim. Neither subsumes the other.
        const bad = overlaps().concat(L.btnSlotClashes().map(c => "declared " + c));
        if (bad.length) out.push({ name, bad });
      };

      at("plane on the runway", () => { L.api.setVehicle("prop"); L.api.placeOnRunway(); });
      at("plane airborne", () => { L.api.setVehicle("prop"); L.api.teleportAirborne(1200, 0, 300, 0); });
      at("fighter airborne", () => { L.api.setVehicle("fighter"); L.api.teleportAirborne(1200, 0, 300, 0); });
      at("airliner airborne", () => { L.api.setVehicle("airlinerDelta"); L.api.teleportAirborne(1200, 0, 300, 0); });
      at("car on the road", () => { L.api.setVehicle("car"); L.api.placeOnRunway(); });
      at("car honking", () => {
        L.api.setVehicle("car"); L.api.placeOnRunway();
        for (let i = 0; i < 10; i++) L.update(1 / 60);
        L.carHornPress();
      });
      at("speedboat in the harbour", () => { L.carHornRelease(); L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1); });
      at("speedboat at the fire with the cannon up", () => {
        L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
        st.x = L.FF.rig.x + 120; st.z = L.FF.rig.z + 120;
      });
      at("yacht under way", () => { L.api.setVehicle("yacht"); L.api.spawnAt(1, 1); });
      at("helicopter hovering", () => {
        L.api.setVehicle("helicopter"); L.api.placeOnRunway();
        st.phase = "AIRBORNE"; st.y += 80;
      });
      at("helicopter over the fire with a full bucket", () => {
        L.api.setVehicle("helicopter");
        st.phase = "AIRBORNE"; st.x = L.FF.rig.x + 400; st.z = L.FF.rig.z + 400;
        st.y = L.TUNE.waterLevel + 20; st.speed = 0;
        for (let i = 0; i < 10; i++) L.update(1 / 60);
        L.bucketPress();
        for (let i = 0; i < 60 * (L.FF.scoopTime + 0.4); i++) { L.update(1 / 60); st.y = L.TUNE.waterLevel + 20; st.speed = 0; }
        st.x = L.FF.rig.x + 30; st.z = L.FF.rig.z + 30; st.y = L.fire.deck + 70;
      });
      at("rocket on the pad", () => { L.api.setVehicle("rocket"); L.api.placeOnRunway(); });
      at("rocket climbing", () => {
        L.api.setVehicle("rocket"); L.api.placeOnRunway();
        L.api.setThrottle(true);
        for (let i = 0; i < 60 * 25 && !L.rocketCanDrop(); i++) L.update(1 / 60);
        L.api.setThrottle(false);
      });
      at("driving the rover", () => {
        L.api.setVehicle("rocket"); L.api.placeOnRunway();
        const b = L.BODIES[0];
        st.dest = "moon"; st.phase = "TAXI"; L.rk.onBody = b; L.rk.stage = 3;
        st.x = b.x; st.y = b.y + b.r + 10; st.z = b.z;
        L.update(1 / 60); L.roverDeploy();
      });
      return out;
    });
    check(`layout ${w}x${h}: no two visible controls overlap -- speed steps, eject, the horn, the contextual button and the vehicle's own`,
      clashes.length === 0, JSON.stringify(clashes));
    await page.close();
  }
};
