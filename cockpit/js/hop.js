"use strict";
// WORKING RULES — parked vehicles are places, not rewards. One radius and one
// contextual button. Departed vehicles remain at their exact departure pose.
// No spawn/reset calls on a hop: those reset independent activities. Mars uses
// its existing modes. No control model or tuning is owned by this file.
const hop = { built: false, fleet: [], active: null, clock: 0, switches: 0, target: null };
function hopAdd(id, key, x, y, z, heading, anchor) {
  const p = { id, key, x, y, z, heading, anchor, g: null, ring: null, saved: null };
  hop.fleet.push(p); return p;
}
function hopBuild() {
  if (hop.built || !highway.built || !harbor.built) return;
  hop.built = true;
  if (!hop.dock) hop.dock=hopRoad('hop-dock',TUNE.hop.dock.map(([x,z],i)=>({x,z,y:i?Math.max(terrainEff(x,z),seaLevelAt(x,z))+HW.clearance:hbRoadY(x)})));

  AIRPORTS.forEach((ap, i) => {
    const sign = i ? -1 : 1, z = ap.cz + sign * (TUNE.runwayLength / 2 - TUNE.hop.runwayInset);
    hopAdd('airport-car-' + i, 'car', TUNE.hop.airportCar[0], ap.elev, z + sign * TUNE.hop.airportCar[1], i ? Math.PI : 0);
    hopAdd('airport-heli-' + i, 'helicopter', TUNE.hop.airportHeli[0], ap.elev + TUNE.gearHeight, z + sign * TUNE.hop.airportHeli[1], i ? Math.PI : 0);
  });
  const c = TUNE.hop.harborCar, b = TUNE.hop.harborBoat;
  hopAdd('harbor-car', 'car', c[0], terrainEff(c[0], c[1]), c[1], Math.PI / 2);
  hopAdd('harbor-boat', 'speedboat', b[0], seaLevelAt(b[0], b[1]), b[1], Math.PI / 2);
  for (const [id, key, off] of [['carrier-jet','fighter',TUNE.hop.carrierJet], ['carrier-heli','helicopter',TUNE.hop.carrierHeli]]) {
    hopAdd(id, key, carrier.x + off[0], carrier.deck + TUNE.gearHeight, carrier.z + off[1], Math.PI, 'carrier');
  }
  hopAdd('yacht-tender', 'speedboat', 0, 0, 0, 0, 'yacht-tender');
}
function hopModel(p) {
  if (p.g) return;
  let g = modelInstance(p.key);
  if (!g && p.key === 'car') g = buildCarModel();
  if (!g && p.key === 'speedboat') g = buildBoatModel();
  if (!g) {
    // Reuse the procedural visual builder without replacing the active model.
    const activeModel = vehicleModel;
    vehicleModel = null;
    try { buildVehicleModel(p.key); g = vehicleModel; }
    finally { vehicleModel = activeModel; }
  }
  p.g = g; g.userData.noSolid = true; g.userData.noShatter = true;
  scene.add(g);
  p.ring = new THREE.Mesh(new THREE.RingGeometry(TUNE.hop.ringR, TUNE.hop.ringR + TUNE.hop.ringWidth, TUNE.hop.ringSegments), new THREE.MeshBasicMaterial({color:TUNE.palette.cyan, side:THREE.DoubleSide}));
  p.ring.rotation.x = -Math.PI / 2; scene.add(p.ring);
}
function hopTarget() {
  if (!hop.built || menuOpen() || state.exploding || eject.active || btnWash()) return null;
  if (marsIsHome()) {
    if (marsDroneActive()) return Math.hypot(mars.drone.x-rover.x,mars.drone.y-rover.y,mars.drone.z-rover.z)<TUNE.hop.radius ? { id:'mars-rover', mode:'drone' } : null;
    if (marsDroneCan()) return { id:'mars-drone', mode:'drone' };
    if (roverActive() && Math.hypot(rover.x-state.x,rover.y-state.y,rover.z-state.z)<TUNE.hop.radius) return { id:'mars-rocket', mode:'return' };
    if (roverCan() && (!hop.marsRoverUsed || Math.hypot(rover.x-state.x,rover.y-state.y,rover.z-state.z)<TUNE.hop.radius)) return { id:'mars-rover', mode:'rover' };
    return null;
  }
  if (Math.abs(state.speed) > TUNE.hop.speed || !['plane','heli','car','boat','yacht','rocket'].includes(vehKind())) return null;
  let best = null, dist = TUNE.hop.radius;
  for (const p of hop.fleet) {
    if (p === hop.active || p.key === state.vehicleKey || !p.g || Math.abs(state.y - p.y) > TUNE.hop.height) continue;
    const d = Math.hypot(state.x-p.x,state.z-p.z);
    if (d < dist) { best = p; dist = d; }
  }
  return best;
}
function hopSave(p) {
  p.key = state.vehicleKey; p.x = state.x; p.y = state.y; p.z = state.z; p.heading = state.heading;
  p.rocket = state.vp.rocket ? {stage:rk.stage,fuel:rk.fuel.slice(),onBody:rk.onBody,groundHere:rk.groundHere} : null;
  p.saved = { pitch:state.pitch, bank:state.bank, gearDown:state.gearDown, originIdx:state.originIdx, destIdx:state.destIdx, dirIdx:state.dirIdx };
  p.anchor = hopCarrierSurface(state.x,state.z) && Math.abs(state.y-carrier.deck)<TUNE.hop.height ? 'carrier' : null;
  if (typeof cwCargoContains === 'function' && connections.built && cwCargoContains(state.x,state.z) && Math.abs(state.y-connections.cargo.g.position.y)<CW.cargo.boardHeight) p.anchor='cargo';
  if (yachtPadUnder(state.x,state.z) && !yachtPadUnder(state.x,state.z).carrier) { p.anchor='yacht-pad'; const dx=state.x-yacht.x,dz=state.z-yacht.z,c=Math.cos(yacht.heading),s=Math.sin(yacht.heading);p.offset={x:c*dx-s*dz,z:s*dx+c*dz,y:state.y-seaLevelAt(state.x,state.z)-yacht.bob,heading:state.heading-yacht.heading}; }
}
function hopPress() {
  const p = hopTarget(); if (!p) return false;
  releaseAllInputs();
  if (p.mode) {
    if (p.mode === 'drone') { if (marsDroneActive()) marsDroneLand(); else marsDronePress(); }
    else if (p.mode === 'rover') {
      if (hop.marsRoverUsed) { rover.active=true;rover.returning=false;rover.speed=0; }
      else { roverDeploy();hop.marsRoverUsed=true; }
    } else { rover.active=false;rover.returning=false;rover.speed=0; }

    hop.switches++; return true;
  }
  let left = hop.active;
  if (!left) left = hopAdd('left-' + hop.switches, state.vehicleKey, state.x,state.y,state.z,state.heading);
  hopSave(left); hopModel(left);
  carrierReset();
  hop.switching=true;
  try { applyVehicle(p.key); } finally { hop.switching=false; }
  if (p.saved) Object.assign(state,p.saved);
  Object.assign(state,{x:p.x,y:p.y,z:p.z,heading:p.heading,speed:0,pitch:0,bank:0,airVy:null,phase:'TAXI',engaged:false,approachLatch:false,celebrated:false,celebrateTimer:0,gearDown:true});
  if (p.rocket) { Object.assign(rk,p.rocket);state.pitch=p.saved.pitch;rocketApplyStages(); }
  if (state.vp.car) { carBuildCabin(); car.steer=0; car.boost=0; car.assistOff=0; }
  if (state.vp.boat) { boatBuildHelm(); boat.steer=0; boat.burst=0; boat.beach=0; boat.air=0; }
  if (p.anchor === 'carrier' && vehKind() === 'plane') { carrier.state='parked';state.phase='AIRBORNE'; }
  hop.active=p; hop.switches++;
  try { localStorage.setItem('lp.vehicle',p.key); } catch (_) {}
  chirp(); hopUpdate(0); btnUpdateAll(); return true;
}
function hopUpdate(dt) {
  hopBuild(); hop.clock += dt;
  if (hop.marsBase !== mars.g) { hop.marsBase=mars.g;hop.marsRoverUsed=false; }
  if (marsIsHome() && !roverActive() && !marsDroneActive() && roverCan()) {
    if (!rover.mesh) buildRover();
    if (!hop.marsRoverUsed) {
      const p=surfacePoint(mars.body,mars.n,TUNE.hop.marsRoverOffset,state.heading+Math.PI/2);
      rover.mesh.position.set(p.x,p.y,p.z);rover.mesh.up.copy(p.dir);
    }
    rover.mesh.visible=true;
  }
  for (const p of hop.fleet) {
    if (p === hop.active) { if(p.g)p.g.visible=false; if(p.ring)p.ring.visible=false; continue; }
    if (p.anchor === 'yacht-tender' && yacht.built) {
      const a=yachtLocal(...TUNE.hop.yachtTender); p.x=a.x;p.z=a.z;p.y=seaLevelAt(a.x,a.z);p.heading=yacht.heading;
    }
    if (p.anchor === 'yacht-pad' && yacht.built) {
      const a=yachtLocal(p.offset.x,p.offset.z);p.x=a.x;p.z=a.z;p.y=seaLevelAt(a.x,a.z)+yacht.bob+p.offset.y;p.heading=yacht.heading+p.offset.heading;
    }
    const near = Math.hypot(state.x-p.x,state.z-p.z)<TUNE.hop.drawDistance;
    if (near) hopModel(p);
    if (!p.g) continue;
    p.g.visible=near;
    const vp=TUNE.vehicles[p.key];
    const drop=vp.heli ? p.g.userData.groundOffset*(vp.size||1) : vp.hasGear ? TUNE.hop.visualWheelDrop*(vp.size||1) : TUNE.hop.visualHullDrop;
    p.g.position.set(p.x,vp.rocket?p.y:p.y-TUNE.gearHeight+drop,p.z);
    p.g.rotation.set(p.saved?p.saved.pitch*DEG:0,p.heading,0,'YXZ');
    p.ring.visible=false;
  }
  const p=hopTarget(); hop.target=p;
  if (p && p.ring) {
    p.ring.visible=true;p.ring.position.set(p.x,p.y+TUNE.hop.ringLift,p.z);
    p.ring.scale.setScalar(1+Math.sin(hop.clock*TUNE.hop.pulseRate)*TUNE.hop.pulseSize);
  }
}
el.hopBtn.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();unlockAudio();hopPress();});

function hopBeforeVehicleSwitch() {
  if (hop.switching || !hop.active) return;
  hopSave(hop.active); hop.active=null;
}

function hopCarrierSurface(x,z) {
  if (!carrier.g || Math.abs(x-carrier.x)>CV.deckW/2 || Math.abs(z-carrier.z)>CV.deckL/2) return null;
  return { x:carrier.x,z:carrier.z,y:carrier.deck,carrier:true };
}

// World roads reuse the existing strip, lane guidance and scenery corridor.
function hopRoad(id,pts) {
  let run=0;
  pts.forEach((p,i)=>{const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];
    const l=Math.hypot(b.x-a.x,b.z-a.z)||1;p.fx=(b.x-a.x)/l;p.fz=(b.z-a.z)/l;
    if(i)run+=Math.hypot(p.x-pts[i-1].x,p.z-pts[i-1].z);p.s=run;});
  const first=pts[0],rec={to:id,s:0,side:1,icon:'wave',x:first.x,z:first.z,y:first.y,bx:first.x,bz:first.z,spur:pts};
  highway.exits.push(rec);hwyClaimCorridor(pts);hwyIndexCorridor();
  rec.mesh=hwyStrip(pts,-HW.spurW,HW.spurW,0,mattMat(TUNE.runwaySurfaceColor));scene.add(rec.mesh);return rec;
}
