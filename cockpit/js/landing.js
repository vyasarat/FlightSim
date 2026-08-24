"use strict";
const rings = [];
const ringsGroup = new THREE.Group();
scene.add(ringsGroup);
{
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x36e0ff,
    transparent: true,
    opacity: 0.85,
    fog: false
  });
  ringsGroup.userData.matBase = ringMat;
  ringsGroup.userData.matEaten = new THREE.MeshBasicMaterial({ color: 0x3fdc6a, transparent: true, opacity: 0.95, fog: false });
  const ringGeo = new THREE.TorusGeometry(TUNE.ringRadius, 2.4, 8, 26);
  for (let i = 0; i < TUNE.ringCount; i++) {
    const s = i / (TUNE.ringCount - 1);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.userData.eaten = false;
    // Rings sit exactly on the glide slope so they agree with the HUD glide arrow.
    const dist = TUNE.ringStartDistance * (1 - s);
    ring.position.set(0, 3 + dist * TUNE.glideSlope, dist);
    ringsGroup.add(ring);
    rings.push(ring);
  }
}

const guideGroup = new THREE.Group();
{
  const lineMat = new THREE.MeshBasicMaterial({
    color: 0x36e0ff, transparent: true, opacity: 0.55, fog: false
  });
  const len = TUNE.ringStartDistance + 420;
  const lineGeo = new THREE.BoxGeometry(1.4, 0.4, len);
  for (const sx of [-(TUNE.runwayWidth / 2 + 5), TUNE.runwayWidth / 2 + 5]) {
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.position.set(sx, 0.5, TUNE.runwayLength / 2 + len / 2 - 60);
    guideGroup.add(line);
  }
}
scene.add(guideGroup);

function placeRings() {
  const ap = AIRPORTS[state.destIdx];
  // Anchor at the threshold he arrives at: the +z end when flying south
  // (dirIdx 0), the -z end when flying north. (Was always +z, so northbound
  // rings ran the length of the runway and ended at the far end.)
  const sgn = state.dirIdx === 0 ? 1 : -1;
  ringsGroup.position.set(0, ap.elev, ap.cz + sgn * (TUNE.runwayLength / 2));
  ringsGroup.rotation.y = state.dirIdx === 0 ? 0 : Math.PI;
  guideGroup.position.set(0, ap.elev, ap.cz);
  guideGroup.rotation.y = state.dirIdx === 0 ? 0 : Math.PI;
  for (const r of rings) { r.userData.eaten = false; r.material = ringsGroup.userData.matBase; }
  state.ringsEatenThisApproach = 0;
}

// "Eat" the rings: fly through one and it turns green and plays the next note
// of a rising scale that resolves into a chord at touchdown. The rings are the
// whole landing instruction -- no reading, just things to fly through.
function updateRings(dt) {
  if (state.phase !== "AIRBORNE" || state.exploding) return;
  const gx = ringsGroup.position.x, gy = ringsGroup.position.y, gz = ringsGroup.position.z;
  const sgn = state.dirIdx === 0 ? 1 : -1;
  const r = TUNE.ringRadius * 1.15;
  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];
    if (ring.userData.eaten) continue;
    const wx = gx, wy = gy + ring.position.y, wz = gz + sgn * ring.position.z;
    const dx = state.x - wx, dy = state.y - wy, dz = state.z - wz;
    if (Math.abs(dz) > 8 || dx * dx + dy * dy > r * r) continue;
    ring.userData.eaten = true;
    ring.material = ringsGroup.userData.matEaten;
    state.ringsEatenThisApproach++;
    flags.ringsEaten++;
    ringNote(state.ringsEatenThisApproach - 1);
  }
}
