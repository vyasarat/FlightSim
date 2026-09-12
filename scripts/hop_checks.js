// Behavioural checks: actual contextual taps, departure and return, no timers.
const path=require('path'),fs=require('fs');
module.exports=async({newPage,check})=>{
 const shots=path.resolve(__dirname,'../evidence/connected-world');fs.mkdirSync(shots,{recursive:true});
 for(const [w,h] of [[390,844],[844,390]])for(const chase of [true,false]){
  const {page,ctx,errors}=await newPage(w,h);
  await page.waitForFunction(()=>Object.values(modelState).every(s=>s!=='loading'));
  const ids=['airport-car-0','airport-heli-0','airport-car-1','airport-heli-1','harbor-boat','harbor-car','carrier-jet','carrier-heli','yacht-tender'];
  for(const id of ids){
   const setup=await page.evaluate(({id,chase})=>{
    for(const p of hop.fleet) { if(p.g)scene.remove(p.g);if(p.ring)scene.remove(p.ring); }
    hop.fleet=[];hop.built=false;hop.active=null;hopBuild();applyVehicle('prop');yachtBuild();hopUpdate(0);
    const p=hop.fleet.find(p=>p.id===id);hopModel(p);
    Object.assign(state,{x:p.x,y:p.y+TUNE.gearHeight,z:p.z+TUNE.hop.radius/4,heading:0,speed:0,phase:'TAXI',exploding:false,viewChase:chase});
    el.hud.classList.toggle('chase',chase);__lp.api.skipScreens();hopUpdate(0);btnUpdateAll();updateChunks(state.x,state.z,true);updateScenery(state.x,state.z,true);
    updateHarbor(0);
    skyDome.position.set(state.x,state.y,state.z);waterMesh.position.set(state.x,TUNE.waterLevel,state.z);
    applyCamera(1);updateSunRig();updateAtmosphere(0);updateVehicleModel(0);renderer.render(scene,camera);
    return{target:hopTarget()?.id,before:hop.switches,x:state.x,y:state.y,z:state.z};
   },{id,chase});
   check(`hop ${id} offered ${w} ${chase}`,setup.target===id,setup.target);
   if(setup.target!==id)continue;
   if(!process.env.LP_FAST) await page.screenshot({path:path.join(shots,`hop-${id}-${w}-${chase?'chase':'cockpit'}.png`)});
   await page.locator('#hopBtn').tap({force:true});
   // Avoid serializing meshes (Object3D has large, cyclic userData in some models).
   const result=await page.evaluate(s=>{const left=hop.fleet.find(p=>p.id==='left-'+s.before);return{switched:hop.switches===s.before+1,left:!!left&&left.x===s.x&&left.y===s.y&&left.z===s.z&&left.g.visible,held:state.throttleHeld||state.touching,clashes:btnSlotClashes()};},setup);
   check(`hop ${id} switches and leaves vehicle ${w} ${chase}`,result.switched&&result.left&&!result.held&&!result.clashes.length,JSON.stringify(result));
   const stable=await page.evaluate(chase=>{state.viewChase=chase;el.hud.classList.toggle('chase',chase);const x=state.x,y=state.y,z=state.z,key=state.vehicleKey;for(let i=0;i<30;i++)update(1/60);return{key:state.vehicleKey===key,drift:Math.hypot(state.x-x,state.y-y,state.z-z),crashed:state.exploding};},chase);
   check(`hop ${id} playable after switching ${w} ${chase}`,stable.key&&stable.drift<6&&!stable.crashed,JSON.stringify(stable));
   // Move just beside the departed vehicle; the real tap must return to it.
   await page.evaluate(s=>{state.x=s.x;state.y=s.y;state.z=s.z;state.speed=0;hopUpdate(0);btnUpdateAll();},setup);
   await page.locator('#hopBtn').tap({force:true});
   check(`hop ${id} returns ${w} ${chase}`,await page.evaluate(()=>state.vehicleKey==='prop'));
  }
  await page.evaluate(chase=>{
    hop.active=null;applyVehicle('rocket');spawnForTakeoff(0,0);
    const b=BODIES.find(b=>b.name==='mars'),n=new THREE.Vector3(.62,.5,.6).normalize();rk.onBody=b;rk.stage=3;
    Object.assign(state,{phase:'TAXI',x:b.x+n.x*(b.r+10),y:b.y+n.y*(b.r+10),z:b.z+n.z*(b.r+10),viewChase:chase,pitch:90,spaceF:1});
    marsClear();hopUpdate(1/60);for(let i=0;i<120;i++)update(1/60);hopUpdate(0);btnUpdateAll();updateChunks(state.x,state.z,true);updateScenery(state.x,state.z,true);
    updateHarbor(0);
    skyDome.position.set(state.x,state.y,state.z);waterMesh.position.set(state.x,TUNE.waterLevel,state.z);
    applyCamera(1);updateSunRig();updateAtmosphere(0);updateVehicleModel(0);renderer.render(scene,camera);
  },chase);
  check(`hop Mars landing boundary builds its base ${w} ${chase}`,await page.evaluate(()=>!!mars.g&&mars.body===rk.onBody));
  check(`hop parked Mars rover stands on its wheels ${w} ${chase}`,await page.evaluate(()=>{const n=rover.mesh.position.clone().sub(new THREE.Vector3(mars.body.x,mars.body.y,mars.body.z)).normalize();return new THREE.Vector3(0,1,0).applyQuaternion(rover.mesh.quaternion).dot(n)>.999;}));
  if(!process.env.LP_FAST) await page.screenshot({path:path.join(shots,`hop-mars-rover-${w}-${chase}.png`)});
  if(!process.env.LP_FAST){
    await page.evaluate(()=>{const n=mars.n,t=new THREE.Vector3().crossVectors(n,new THREE.Vector3(1,0,0)).normalize();camera.up.copy(n);camera.position.set(mars.x+n.x*70+t.x*110,mars.y+n.y*70+t.y*110,mars.z+n.z*70+t.z*110);camera.lookAt(mars.x,mars.y,mars.z);renderer.render(scene,camera);});
    await page.screenshot({path:path.join(shots,`hop-mars-base-overview-${w}-${chase}.png`)});
    await page.evaluate(()=>applyCamera(2));
  }
  await page.locator('#hopBtn').tap({force:true});
  check(`hop Mars deploy ${w} ${chase}`,await page.evaluate(()=>rover.active));
  await page.evaluate(()=>{rover.x+=5;hopUpdate(0);btnUpdateAll();});
  const pose=await page.evaluate(()=>({x:rover.x,y:rover.y,z:rover.z}));
  await page.locator('#hopBtn').tap({force:true});
  check(`hop Mars leaves rover in place ${w} ${chase}`,await page.evaluate(p=>!rover.active&&rover.x===p.x&&rover.y===p.y&&rover.z===p.z,pose));
  await page.evaluate(()=>{hopUpdate(0);btnUpdateAll();});
  await page.locator('#hopBtn').tap({force:true});
  check(`hop Mars returns to parked rover ${w} ${chase}`,await page.evaluate(p=>rover.active&&rover.x===p.x&&rover.z===p.z,pose));
  await page.evaluate(()=>{mars.drone.x=rover.x;mars.drone.y=rover.y;mars.drone.z=rover.z;hopUpdate(0);btnUpdateAll();});
  check(`hop Mars has one nearby drone entry ${w} ${chase}`,await page.evaluate(()=>!el.hopBtn.classList.contains('hidden')&&el.droneBtn.classList.contains('hidden')));
  if(!process.env.LP_FAST) await page.screenshot({path:path.join(shots,`hop-mars-drone-${w}-${chase}.png`)});
  await page.locator('#hopBtn').tap({force:true});
  check(`hop Mars drone ${w} ${chase}`,await page.evaluate(()=>marsDroneActive()));
  await page.evaluate(()=>{hopUpdate(0);btnUpdateAll();});
  await page.locator('#hopBtn').tap({force:true});
  check(`hop Mars drone return ${w} ${chase}`,await page.evaluate(()=>!marsDroneActive()&&roverActive()));
  check(`hop no frame errors ${w} ${chase}`,!errors.length,errors.join(';'));
  await ctx.close();
 }
};
