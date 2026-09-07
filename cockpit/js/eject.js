"use strict";
// A rescue owns the camera and one empty model until the pilot is safely back.
// No collision/damage API is used for the abandoned vehicle's impact.
const eject = { active:false, phase:'idle', t:0, total:0, fast:false, cycles:0, pool:null, last:null };
const ejUp = new THREE.Vector3(0,1,0), ejBox = new THREE.Box3(), ejSize = new THREE.Vector3(), ejCameraAim = new THREE.PerspectiveCamera();
function ejectFamily() {
  if (marsDroneActive()) return 'drone';
  if (roverActive()) return 'rover';
  if (state.vehicleKey.startsWith('airliner')) return 'airliner';
  return state.vehicleKey;
}
function updateEjectControl() {
  // Surface/station adapters are the next milestone; Earth aircraft are a
  // complete first slice while their shared machinery is exercised.
  const supported = !state.vp.rocket && !roverActive() && !marsDroneActive();
  el.ejectBtn.classList.toggle('hidden', !eject.active && (!supported || menuOpen() || state.exploding));
  el.ejectBtn.dataset.mode = eject.active && ['float','land','return'].includes(eject.phase) ? 'return' : 'eject';
  el.ejectBtn.setAttribute('aria-label', el.ejectBtn.dataset.mode === 'return' ? 'Return to vehicle' : 'Eject');
}
function ejectBuildPool() {
  if (eject.pool) return eject.pool;
  const root = new THREE.Group(), seat = new THREE.Group(), hatch = new THREE.Group();
  scene.add(root);root.add(seat,hatch);root.visible=false;
  const yellow = new THREE.MeshLambertMaterial({color:0xffd23e}), dark = new THREE.MeshLambertMaterial({color:0x273447});
  const blue = new THREE.MeshLambertMaterial({color:0xbfeaff,transparent:true,opacity:.85});
  const geo = new THREE.BoxGeometry(1,1,1);
  const part=(parent,mat,x,y,z,sx,sy,sz)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;};
  part(seat,yellow,0,.15,0,1.4,.3,1.4);part(seat,dark,0,1,-.6,1.4,1.8,.2);
  for(const x of [-.75,.75])part(seat,yellow,x,.7,0,.18,.18,1.2);
  const pilot=buildAstronaut(true);pilot.visible=true;pilot.position.set(0,1.35,.1);pilot.scale.setScalar(1.25);seat.add(pilot);
  // Reuse the astronaut, bending its legs into a seated pose.
  for(const m of [...pilot.children]){
    if(m.position.y<-.5&&m.geometry?.type==='CylinderGeometry'){
      const shin=m.clone();shin.position.set(m.position.x,-.86,.72);shin.scale.y=.6;shin.rotation.x=0;pilot.add(shin);
      m.position.y=-.5;m.position.z=.35;m.rotation.x=-Math.PI/2;
    }else if(m.position.y<-1){m.position.z=.72;m.rotation.x=0;}
  }
  const canopy=buildCanopy(3.6,0xe0483e);canopy.position.y=7;seat.add(canopy);
  const lines=new THREE.Group();seat.add(lines);
  const pts=[];for(let i=0;i<8;i++){const a=i*Math.PI/4;pts.push(new THREE.Vector3(0,1,0),new THREE.Vector3(Math.cos(a)*3.5,7,Math.sin(a)*3.5));}
  lines.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xf2f4f7})));
  const flame=new THREE.Mesh(new THREE.ConeGeometry(.45,1.7,8),new THREE.MeshBasicMaterial({color:0x5ff1ff}));flame.rotation.z=Math.PI;flame.position.y=-.7;seat.add(flame);
  const raft=new THREE.Mesh(new THREE.TorusGeometry(1.5,.35,8,24),yellow);raft.rotation.x=Math.PI/2;raft.position.y=-.2;seat.add(raft);
  const lid=part(hatch,blue,0,.15,0,2,.35,2.5);
  const bubble=new THREE.Mesh(new THREE.SphereGeometry(1,12,8,0,Math.PI*2,0,Math.PI/2),blue);bubble.scale.set(1,1,1.3);hatch.add(bubble);
  const rim=part(hatch,yellow,0,0,0,2.2,.16,2.7);
  const splash=new THREE.Group();root.add(splash);
  const waterMat=new THREE.MeshBasicMaterial({color:0x5ff1ff,transparent:true,opacity:1});
  const drops=[];for(let i=0;i<10;i++){const m=new THREE.Mesh(new THREE.SphereGeometry(.7,6,4),waterMat);splash.add(m);drops.push(m);}
  eject.pool={root,seat,pilot,canopy,lines,flame,raft,hatch,lid,bubble,rim,yellow,splash,drops,waterMat};
  return eject.pool;
}
function ejectSurface(x,z) { return Math.max(terrainEff(x,z),TUNE.waterLevel); }
function ejectStart() {
  if (eject.active || menuOpen() || state.exploding) return false;
  const family=ejectFamily(),cfg=TUNE.eject.families[family];if(!cfg||state.vp.rocket)return false;
  const snapshot={...state},speed=state.speed;
  releaseAllInputs();twRelease();
  if(toyWorld.wash){twWashRestore(toyWorld.wash);toyWorld.wash=null;toyWorld.washCooldown=1;}
  if(bucket.g)bucket.g.visible=false;bucket.state='empty';bucket.anim=0;
  cancelRecovery();
  state.viewChase=true;el.hud.classList.add('chase');updateVehicleModel(0);vehicleModel.visible=true;vehicleModel.updateMatrixWorld(true);
  const pool=ejectBuildPool();pool.root.visible=true;pool.seat.visible=false;pool.hatch.visible=true;pool.splash.visible=false;
  pool.canopy.visible=false;pool.lines.visible=false;pool.flame.visible=false;pool.raft.visible=false;
  pool.seat.scale.setScalar(TUNE.eject.seatScale);pool.seat.rotation.set(0,state.heading+Math.PI,0);pool.pilot.position.y=1.35;
  pool.bubble.visible=['canopy','pop'].includes(cfg.hatch);pool.lid.visible=!pool.bubble.visible;
  pool.yellow.color.setHex(cfg.color);pool.hatch.scale.setScalar(state.vp.size||1);
  const forward=new THREE.Vector3(-Math.sin(state.heading),0,-Math.cos(state.heading));
  const side=new THREE.Vector3(forward.z,0,-forward.x);
  const model=vehicleModel,pos=model.position.clone();
  const anchor=pos.clone().addScaledVector(forward,cfg.front*(state.vp.size||1));anchor.y+=cfg.roof*(state.vp.size||1);
  const rotor=model.userData.rotor;
  const rotorSave=rotor?{position:rotor.position.clone(),rotation:rotor.rotation.clone(),scale:rotor.scale.clone()}:null;
  const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
  Object.assign(eject,{active:true,phase:'frame',t:0,total:0,fast:false,family,cfg,snapshot,model,anchor,forward,side,
    original:{position:pos,rotation:model.rotation.clone(),scale:model.scale.clone()},rotorSave,
    velocity:forward.clone().multiplyScalar(Math.min(TUNE.eject.emptySpeed,Math.max(5,speed))),vy:0,
    empty:false,emptyT:0,impact:false,impactWet:false,impactT:0,landed:false,canopyOpen:false,openT:TUNE.eject.open*cfg.opening,
    launchLift:Math.max(TUNE.eject.lift,size.y+10),bodyExtent:Math.max(size.x,size.z),
    events:{family,opened:false,rotorsClear:!rotor,clearance:0,unfolded:false,impact:false,landed:false,returned:false}});
  state.phase='EJECT';state.speed=0;state.exploding=false;state.throttleHeld=false;
  document.body.classList.add('ejecting');el.reentryGlow.style.opacity=0;el.rotateArrow.classList.remove('on');
  setEngine(0);if(typeof rocketNodes!=='undefined'&&rocketNodes)setRocketEngine(0,0);setRolling(0);shakeAmp=0;rumble=0;
  ejectPoseHatch(0);
  flags.ejections=(flags.ejections||0)+1;updateEjectControl();return true;
}
function ejectPoseHatch(f) {
  const E=TUNE.eject,p=eject.pool;
  p.hatch.position.copy(eject.anchor);
  if(eject.family==='helicopter'){
    p.hatch.position.addScaledVector(eject.side,1.6+Math.sin(f*E.hatchAngle)*.7);
    p.hatch.rotation.set(0,eject.snapshot.heading,Math.PI/2+f*E.hatchAngle);
  }else{
    p.hatch.rotation.set(-f*E.hatchAngle,eject.snapshot.heading,0);
    if(eject.cfg.hatch==='pop')p.hatch.position.y+=f*E.canopyPop;
  }
}
function ejectPhase(phase) { eject.phase=phase;eject.t=0;updateEjectControl(); }
function ejectEmptyStep(dt) {
  if(!eject.empty||eject.impact)return;
  const E=TUNE.eject,m=eject.model;eject.emptyT+=dt;
  m.position.addScaledVector(eject.velocity,dt);eject.vy-=eject.gravity*dt;m.position.y+=eject.vy*dt;
  m.rotation.z=eject.original.rotation.z+Math.sin(eject.emptyT*1.6)*E.emptyRoll;
  m.rotation.x=eject.original.rotation.x+Math.min(E.emptyPitch,eject.emptyT*E.emptyPitchRate);
  m.updateMatrixWorld(true);ejBox.setFromObject(m);
  const floor=ejectSurface(m.position.x,m.position.z);
  if(ejBox.min.y<=floor){
    m.position.y+=floor-ejBox.min.y;m.updateMatrixWorld(true);ejBox.setFromObject(m);
    eject.impact=true;eject.impactT=0;eject.events.impact=true;eject.events.impactBottom=ejBox.min.y;eject.events.impactSurface=floor;
    eject.events.emptyAtImpact=eject.empty;eject.events.canopyAtImpact=eject.canopyOpen;eject.events.pilotClearAtImpact=eject.pool.seat.position.distanceTo(m.position);
    const wet=terrainEff(m.position.x,m.position.z)<TUNE.waterLevel;
    eject.impactWet=wet;
    if(wet){eject.pool.splash.visible=true;eject.pool.splash.position.set(m.position.x,floor,m.position.z);synthBlip('sine',180,80,.3,.12,0);}
    else triggerExplosion(m.position.x,floor,m.position.z,.45,true);
    m.visible=false;
  }
}
function ejectRestore() {
  const p=eject.pool;
  if(eject.rotorSave){const r=eject.model.userData.rotor,s=eject.rotorSave;r.position.copy(s.position);r.rotation.copy(s.rotation);r.scale.copy(s.scale);}
  eject.model.scale.copy(eject.original.scale);eject.model.rotation.copy(eject.original.rotation);
  Object.assign(state,eject.snapshot);releaseAllInputs();spawnForTakeoff();
  el.hud.classList.toggle('chase',state.viewChase);updateVehicleModel(0);state.popTimer=.45;
  p.root.visible=false;el.ejectVeil.style.opacity=0;document.body.classList.remove('ejecting');
  eject.events.returned=true;eject.last={...eject.events};eject.cycles++;eject.active=false;eject.phase='idle';
  updateEjectControl();
}
function updateEjection(realDt) {
  const E=TUNE.eject,p=eject.pool,dt=realDt*(eject.fast?E.fastRate:1);
  eject.t+=dt;eject.total+=dt;
  if(eject.phase==='frame'){
    if(eject.t>=E.frameTime)ejectPhase('open');
  }else if(eject.phase==='open'){
    const f=clamp(eject.t/eject.openT,0,1);
    // The hatch pivots visibly before any seat launch. The rotor is stopped,
    // folded and slid behind the cabin; the seat never crosses spinning blades.
    ejectPoseHatch(f);
    if(eject.rotorSave){const r=eject.model.userData.rotor;r.position.copy(eject.rotorSave.position);r.position.z+=f*E.rotorSlide;r.position.y+=f*E.rotorLift;r.scale.set(1-f*E.rotorFold,1,1-f*E.rotorFold);}
    if(f===1){eject.events.opened=true;eject.events.rotorsClear=true;p.seat.position.copy(eject.anchor);p.seat.visible=true;ejectPhase('launch');whoosh();}
  }else if(eject.phase==='launch'){
    const f=clamp(eject.t/E.launch,0,1),rise=1-Math.pow(1-f,2);
    p.seat.position.copy(eject.anchor).addScaledVector(ejUp,eject.launchLift*rise).addScaledVector(eject.side,E.seatSide*rise);
    p.seat.scale.setScalar(E.seatScale*(.5+.5*rise));p.flame.visible=eject.cfg.seat==='rocket';
    eject.events.clearance=Math.max(eject.events.clearance,p.seat.position.y-eject.anchor.y);
    if(!eject.empty&&rise>E.clearFraction){
      eject.empty=true;eject.vy=E.emptyLift;
      // Parked models can sit a fraction below the rendered runway. Give the
      // empty toy a gentle hop before the fall, rather than an instant impact.
      eject.model.updateMatrixWorld(true);ejBox.setFromObject(eject.model);
      const support=ejectSurface(eject.model.position.x,eject.model.position.z);
      eject.model.position.y+=Math.max(0,support+.15-ejBox.min.y);
      const agl=Math.max(0,eject.model.position.y-ejectSurface(eject.model.position.x,eject.model.position.z));
      eject.gravity=Math.max(E.fallGravity,2*(agl+eject.vy*E.fallTime)/(E.fallTime*E.fallTime));
    }
    if(f===1){eject.apex=p.seat.position.clone();eject.land=p.seat.position.clone().addScaledVector(eject.side,E.landingDrift);eject.land.y=ejectSurface(eject.land.x,eject.land.z)+1.2; eject.wet=terrainEff(eject.land.x,eject.land.z)<TUNE.waterLevel;p.canopy.visible=true;p.lines.visible=true;ejectPhase('unfold');}
  }else if(eject.phase==='unfold'){
    const f=clamp(eject.t/E.unfold,0,1);p.canopy.scale.set(f,Math.max(.1,f),f);p.lines.scale.set(f,1,f);p.flame.visible=false;
    if(f===1){eject.canopyOpen=true;eject.events.unfolded=true;ejectPhase('float');}
  }else if(eject.phase==='float'){
    const f=clamp(eject.t/E.descent,0,1),smooth=f*f*(3-2*f);
    p.seat.position.lerpVectors(eject.apex,eject.land,smooth);p.raft.visible=eject.wet;
    p.seat.rotation.z=Math.sin(eject.t*1.8)*E.sway;
    if(f===1&&eject.impact){eject.landed=true;eject.events.landed=true;ejectPhase('land');chirp();confettiBurst();}
  }else if(eject.phase==='land'){
    p.pilot.position.y=1.35+Math.sin(Math.min(1,eject.t/E.celebrate)*Math.PI)*E.celebrationHop;
    if(eject.t>=E.celebrate)ejectPhase('return');
  }else if(eject.phase==='return'){
    el.ejectVeil.style.opacity=clamp(eject.t/E.returnTime,0,1);
    if(eject.t>=E.returnTime){ejectRestore();return;}
  }
  ejectEmptyStep(dt);
  if(!['frame','open'].includes(eject.phase)){
    p.hatch.visible=!eject.impact;
    ejectPoseHatch(1);p.hatch.position.add(eject.model.position).sub(eject.original.position);
    if(eject.cfg.hatch==='pop')p.hatch.position.y-=Math.min(E.canopyPop,eject.emptyT*2);
  }
  if(eject.impact){eject.impactT+=dt;const f=eject.impactT;
    p.splash.visible=eject.impactWet&&f<1.3;
    p.drops.forEach((m,i)=>{const a=i*Math.PI/5;m.position.set(Math.cos(a)*f*9,Math.max(0,Math.sin(f*Math.PI/1.3)*(4+i%3)),Math.sin(a)*f*9);});
    p.waterMat.opacity=Math.max(0,1-f/1.3);
  }
  // Normal flight physics and control handlers do not own the abandoned model.
  // The camera eases to an oblique view of the safe pilot and the falling toy.
  const focus=p.seat.visible?p.seat.position:eject.anchor;
  const centre=focus.clone().addScaledVector(ejUp,p.seat.visible?5:0);
  if(!eject.impact&&p.seat.visible)centre.lerp(eject.model.position,.2);
  const separation=eject.impact?0:focus.distanceTo(eject.model.position);
  const distance=clamp(E.cameraMin+eject.bodyExtent*.65+separation*.3,E.cameraMin,E.cameraMax);
  const desired=centre.clone().addScaledVector(eject.forward,-distance*.8).addScaledVector(eject.side,distance*.55).addScaledVector(ejUp,distance*.55);
  camera.position.lerp(desired,1-Math.exp(-E.cameraRate*realDt));camera.up.copy(ejUp);ejCameraAim.position.copy(camera.position);ejCameraAim.up.copy(ejUp);ejCameraAim.lookAt(centre);camera.quaternion.slerp(ejCameraAim.quaternion,1-Math.exp(-E.cameraRate*realDt));
  p.seat.rotation.y=Math.atan2(camera.position.x-p.seat.position.x,camera.position.z-p.seat.position.z);
  updateChunks(focus.x,focus.z);skyDome.position.copy(focus);waterMesh.position.set(focus.x,TUNE.waterLevel,focus.z);
  updateToyWorld(dt);updateExplosion(dt,safePos,false);updateFx(realDt);updateSky(realDt);updateSunRig();updateAtmosphere(realDt);
}
el.ejectBtn.addEventListener('pointerdown',event=>{
  event.preventDefault();event.stopPropagation();unlockAudio();
  if(eject.active){if(el.ejectBtn.dataset.mode==='return')eject.fast=true;return;}
  ejectStart();
});
document.addEventListener('pointerdown',event=>{if(eject.active&&!el.ejectBtn.contains(event.target)){event.preventDefault();event.stopImmediatePropagation();}},true);
document.addEventListener('keydown',event=>{if(eject.active){event.preventDefault();event.stopImmediatePropagation();}},true);
