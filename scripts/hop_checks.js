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
   const stable=await page.evaluate(()=>{const x=state.x,y=state.y,z=state.z,key=state.vehicleKey;for(let i=0;i<30;i++)update(1/60);return{key:state.vehicleKey===key,drift:Math.hypot(state.x-x,state.y-y,state.z-z),crashed:state.exploding};});
   check(`hop ${id} playable after switching ${w} ${chase}`,stable.key&&stable.drift<6&&!stable.crashed,JSON.stringify(stable));
   // Move just beside the departed vehicle; the real tap must return to it.
   await page.evaluate(s=>{state.x=s.x;state.y=s.y;state.z=s.z;state.speed=0;hopUpdate(0);btnUpdateAll();},setup);
   await page.locator('#hopBtn').tap({force:true});
   check(`hop ${id} returns ${w} ${chase}`,await page.evaluate(()=>state.vehicleKey==='prop'));
  }
  await page.evaluate(chase=>{
    hop.active=null;applyVehicle('rocket');spawnForTakeoff(0,0);
    const b=BODIES.find(b=>b.name==='mars');rk.onBody=b;rk.stage=3;
    Object.assign(state,{phase:'TAXI',x:b.x,y:b.y+b.r+10,z:b.z,viewChase:chase,pitch:90,spaceF:1});
    marsBuild();for(let i=0;i<120;i++)update(1/60);hopUpdate(0);btnUpdateAll();updateChunks(state.x,state.z,true);updateScenery(state.x,state.z,true);
    updateHarbor(0);
    skyDome.position.set(state.x,state.y,state.z);waterMesh.position.set(state.x,TUNE.waterLevel,state.z);
    applyCamera(1);updateSunRig();updateAtmosphere(0);updateVehicleModel(0);renderer.render(scene,camera);
  },chase);
  if(!process.env.LP_FAST) await page.screenshot({path:path.join(shots,`hop-mars-rover-${w}-${chase}.png`)});
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
