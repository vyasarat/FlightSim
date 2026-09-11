"use strict";
// ---------------------------------------------------------------------------
// The shared state fields mean different things per vehicle. js/state.js writes
// that down; this asserts the parts a machine can check, so the document cannot
// quietly stop being true.
//
// It is deliberately about MEANING, not values -- the vehicle baseline already
// pins the numbers. What these check is that each field still means what the
// header says it means for each vehicle that has its own answer.
// ---------------------------------------------------------------------------

module.exports = async function stateSemanticsChecks({ newPage, check }) {
  const { page } = await newPage(1180, 820);
  await page.evaluate(() => { window.__lp.noRender = true; });

  const r = await page.evaluate(() => {
    const L = window.__lp, st = L.state;
    const out = {};

    // ---- state.y is the WATERLINE for a boat, and the waterline moves.
    // Inside the lock's chamber it is six metres above the sea, so a hull that
    // read TUNE.waterLevel instead of seaLevelAt would sit six metres under.
    L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
    for (let i = 0; i < 20; i++) L.update(1 / 60);
    const openSea = Math.abs(st.y - L.seaLevelAt(st.x, st.z));
    const K = L.LK, cx = (K.chamber.x[0] + K.chamber.x[1]) / 2, cz = (K.gateS + K.gateN) / 2;
    L.lock.fill = 1;
    st.x = cx; st.z = cz;
    for (let i = 0; i < 40; i++) { L.update(1 / 60); st.x = cx; st.z = cz; }
    out.boatRidesLocalWater = Math.abs(st.y - L.seaLevelAt(cx, cz)) < 1.0 && openSea < 1.0;
    out.lockIsHigher = L.seaLevelAt(cx, cz) > L.TUNE.waterLevel + 1;
    L.lock.fill = 0; L.lock.state = "idle";

    // ---- state.y is the ROAD for a car, measured from the terrain, not the sea
    L.api.setVehicle("car"); L.api.placeOnRunway();
    for (let i = 0; i < 30; i++) { L.api.setStick(0, 0); L.update(1 / 60); }
    L.api.clearStick();
    out.carAboveItsGround = st.y - L.terrainEff(st.x, st.z);

    // ---- state.y is MEANINGLESS for the rover: its truth is on a sphere
    L.api.setVehicle("rocket"); L.api.placeOnRunway();
    const b = L.BODIES.find(x => x.name === "moon");
    st.dest = "moon"; st.phase = "TAXI"; L.rk.stage = 3; L.rk.onBody = b;
    st.x = b.x; st.y = b.y + b.r + 10; st.z = b.z;
    L.roverDeploy();
    for (let i = 0; i < 30; i++) { L.api.setThrottle(true); L.update(1 / 60); }
    L.api.setThrottle(false);
    // it has driven, so its own position has moved and state.y has not kept up
    out.roverTruthIsItsOwn = Math.hypot(L.rover.x - b.x, L.rover.y - b.y, L.rover.z - b.z) > b.r;
    out.roverSpeedIsItsOwn = Math.abs(L.rover.speed) > 1 && Math.abs(st.speed - L.rover.speed) > 0.001;

    // ---- state.vp's booleans are NOT exclusive: a yacht is a boat
    out.yachtIsAlsoABoat = !!(L.TUNE.vehicles.yacht.bigBoat && L.TUNE.vehicles.yacht.boat);
    L.api.setVehicle("yacht"); L.api.spawnAt(1, 1);
    for (let i = 0; i < 10; i++) L.update(1 / 60);
    out.yachtResolvesAsYacht = L.vehKind() === "yacht";
    L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
    for (let i = 0; i < 10; i++) L.update(1 / 60);
    out.boatResolvesAsBoat = L.vehKind() === "boat";

    // ---- "parked" is the VEHICLE's question, not the phase's. A stationary
    // boat is not a taxiing aeroplane, however much its phase says TAXI.
    out.boatPhaseSaysTaxi = st.phase === "TAXI";
    out.boatParkedWhenStill = (st.speed = 0, L.vehParked());
    L.api.setVehicle("rocket"); L.api.placeOnRunway();
    st.phase = "TAXI"; L.rk.onBody = L.BODIES.find(x => x.name === "moon"); st.speed = 0;
    for (let i = 0; i < 5; i++) L.update(1 / 60);
    out.rocketOnBodyNotParked = !L.vehParked();
    return out;
  });
  await page.close();

  check("state: state.y is the WATERLINE for a boat, and it follows the local water -- six metres up inside the lock, not TUNE.waterLevel",
    r.boatRidesLocalWater && r.lockIsHigher, JSON.stringify({ rides: r.boatRidesLocalWater, higher: r.lockIsHigher }));
  check("state: state.y is the ROAD surface for the car, measured off the terrain",
    r.carAboveItsGround > 0 && r.carAboveItsGround < 8, JSON.stringify({ above: +r.carAboveItsGround.toFixed(2) }));
  check("state: the rover's truth is its OWN position and speed on a sphere -- state.y and state.speed are not it",
    r.roverTruthIsItsOwn && r.roverSpeedIsItsOwn, JSON.stringify(r));
  check("state: state.vp's booleans are not exclusive -- a yacht is also a boat, and the contract resolves it as the yacht",
    r.yachtIsAlsoABoat && r.yachtResolvesAsYacht && r.boatResolvesAsBoat, JSON.stringify(r));
  check("state: 'parked' is asked of the VEHICLE, not of a flight phase -- a stopped boat says TAXI and is parked, a rocket on a body says TAXI and is not",
    r.boatPhaseSaysTaxi && r.boatParkedWhenStill && r.rocketOnBodyNotParked, JSON.stringify(r));
};
