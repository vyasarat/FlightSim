const path=require('path'),fs=require('fs');
module.exports=async({newPage,check})=>{
 const out=path.resolve(__dirname,'../evidence/connected-world');fs.mkdirSync(out,{recursive:true});
 for(const [w,h] of [[390,844],[844,390]])for(const chase of [true,false]){
 const {page,ctx,errors}=await newPage(w,h);
 await page.waitForFunction(()=>Object.values(modelState).every(s=>s!=='loading'));
 const step=s=>page.evaluate(s=>{__lp.noRender=true;for(let i=0;i<s*60;i++)update(1/60);},s);
 const shot=async name=>{await page.evaluate(()=>{applyCamera(2);renderer.render(scene,camera);});if(!process.env.LP_FAST)await page.screenshot({path:path.join(out,`${name}-${w}-${chase}.png`)});};
 await page.evaluate(chase=>{cwBuild();releaseAllInputs();applyVehicle('car');spawnForTakeoff(1,1);Object.assign(state,{viewChase:chase});el.hud.classList.toggle('chase',chase);},chase);
 // Approach the carrier ramp under the ordinary held on-screen stick.
 await page.evaluate(()=>{const r=connections.carrierRoad.spur,p=r.at(-1);Object.assign(state,{x:p.x,z:p.z+35,y:p.y,speed:0,heading:0});carBuildCabin();});
 const start=await page.evaluate(()=>connections.carrier.trips);
 const cdp=await page.context().newCDPSession(page);
 const touch=async(type,p)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:p?[{...p,id:1}]:[]});
 const blank={x:w/2,y:h*.43};
 await touch('touchStart',blank);await step(3);await touch('touchEnd');await step(.5);
 check(`connection drive onto carrier ${w} ${chase}`,await page.evaluate(n=>connections.carrier.trips>n,start),await page.evaluate(()=>JSON.stringify({x:state.x,y:state.y,z:state.z,phase:connections.carrier.phase})));
 await step(7);await shot('connection-car-carrier');
 const carried=await page.evaluate(()=>({z:state.z,shipZ:carrier.z,y:state.y,deck:carrier.deck,phase:connections.carrier.phase}));
 check(`connection carrier carries car ${w} ${chase}`,carried.phase==='ride'&&Math.abs(carried.y-carried.deck)<1&&carried.shipZ<TUNE_CARRIER_Z(),JSON.stringify(carried));
 await step(40);
 check(`connection carrier returns without taking car ${w} ${chase}`,await page.evaluate(()=>connections.carrier.phase==='returned'&&Math.abs(carrier.z-CV.at.z)<1&&carActive()));
 // A second entry after departure must announce another trip.
 await page.evaluate(()=>{state.x=carrier.x+CV.deckW;});await step(.1);
 await page.evaluate(()=>Object.assign(state,{x:carrier.x,y:carrier.deck,z:carrier.z+CW.carrier.boardZ,speed:0}));await step(.1);
 check(`connection carrier re-arms ${w} ${chase}`,await page.evaluate(n=>connections.carrier.trips>=n+2,start));
 // Cargo bay: held pointing drives in; a lost pointer must not stop the trip.
 await page.evaluate(()=>{connections.carrier.rider=false;applyVehicle('car');carrierReset();const C=CW.cargo;Object.assign(state,{x:C.x,z:C.z+25,y:terrainEff(C.x,C.z),heading:0,speed:0});carBuildCabin();});
 const cargoBefore=await page.evaluate(()=>connections.cargo.trips);
 await touch('touchStart',blank);await step(2);await touch('touchCancel');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await step(7);await shot('connection-car-cargo');
 check(`connection cargo carries through interrupted input ${w} ${chase}`,await page.evaluate(n=>connections.cargo.trips>n&&connections.cargo.height>20&&Math.abs(state.y-connections.cargo.g.position.y)<1&&!state.touching,cargoBefore),await page.evaluate(()=>JSON.stringify({x:state.x,y:state.y,z:state.z,cargo:connections.cargo.height,phase:connections.cargo.phase})));
 await step(30);check(`connection cargo returns ${w} ${chase}`,await page.evaluate(()=>connections.cargo.phase==='returned'&&connections.cargo.height===0&&carActive()));
 await page.evaluate(()=>{state.x=CW.cargo.x+CW.cargo.resetR;});await step(.1);
 await page.evaluate(()=>Object.assign(state,{x:CW.cargo.x,z:CW.cargo.z,y:connections.cargo.ground,speed:0}));await step(.1);
 check(`connection cargo re-arms ${w} ${chase}`,await page.evaluate(n=>connections.cargo.trips>=n+2,cargoBefore));
 // Helicopter lands using its existing down control, then the normal hop button.
 await page.evaluate(()=>{releaseAllInputs();applyVehicle('helicopter');carrierReset();const p=hop.fleet.find(p=>p.id==='carrier-jet');Object.assign(state,{x:p.x,y:carrier.deck+18,z:p.z+12,speed:0,phase:'AIRBORNE'});heliReset();});
 await step(.1);
 const down=await page.locator('#heliDownBtn').boundingBox();await touch('touchStart',{x:down.x+down.width/2,y:down.y+down.height/2});await step(5);await touch('touchEnd');await step(.3);await shot('connection-heli-carrier');
 check(`connection helicopter lands on carrier ${w} ${chase}`,await page.evaluate(()=>state.phase==='TAXI'&&Math.abs(state.y-carrier.deck-TUNE.gearHeight)<1));
 const selected=await page.evaluate(()=>hopTarget()?.id);if(selected==='carrier-jet')await page.locator('#hopBtn').tap({force:true});
 check(`connection helicopter to jet ${w} ${chase}`,await page.evaluate(()=>state.vehicleKey==='fighter'&&carrierCanLaunch()),selected);
 // Yacht landing uses the existing moving pad. Tender is anchored to the yacht.
 await page.evaluate(()=>{hop.active=null;applyVehicle('helicopter');carrierReset();yachtBuild();yachtDropAnchor();const p=yachtPadWorld();Object.assign(state,{x:p.x,y:p.y+15,z:p.z,speed:0,phase:'AIRBORNE'});heliReset();});await step(.1);
 const yd=await page.locator('#heliDownBtn').boundingBox();await touch('touchStart',{x:yd.x+yd.width/2,y:yd.y+yd.height/2});await step(5);await touch('touchEnd');await step(.3);await shot('connection-heli-yacht');
 const tender=await page.evaluate(()=>hopTarget()?.id);if(tender==='yacht-tender')await page.locator('#hopBtn').tap({force:true});
 check(`connection yacht helicopter to tender ${w} ${chase}`,await page.evaluate(()=>state.vehicleKey==='speedboat'),tender);
 // Road/bridge pursuit uses a real moving car and a delta in the crossing count.
 await page.evaluate(()=>{applyVehicle('car');carrierReset();Object.assign(state,{x:1380,y:hbRoadY(1380),z:CW.bridge.roadZ,heading:-Math.PI/2,speed:0});carBuildCabin();policeStop(false);policeStart();connections.lastX=state.x;connections.bridge=null;});
 const cross=await page.evaluate(()=>connections.crossings);await touch('touchStart',blank);await step(4);await touch('touchEnd');await step(4);await shot('connection-chase-bridge');
 check(`connection bridge lifts behind driver ${w} ${chase}`,await page.evaluate(n=>connections.crossings>n&&harbor.bridge.open>.3&&police.cars.every(c=>c.x<CW.bridge.west),cross),await page.evaluate(()=>JSON.stringify({x:state.x,z:state.z,cross:connections.crossings,bridge:harbor.bridge.open,cars:police.cars.map(c=>[c.x,c.z])})));
 await step(18);check(`connection drawbridge reopens road ${w} ${chase}`,await page.evaluate(()=>!connections.bridge&&harbor.bridge.open<.1));
 await page.evaluate(()=>{const p=connections.track.spur[3];Object.assign(state,{x:p.x,y:p.y,z:p.z,heading:Math.atan2(-p.fx,-p.fz),speed:0});policeStop(false);policeStart();connections.trail=[];});
 const visits=await page.evaluate(()=>connections.trackVisits);await touch('touchStart',blank);await step(5);await touch('touchEnd');await step(.5);await shot('connection-chase-track');
 check(`connection chase continues onto track ${w} ${chase}`,await page.evaluate(n=>connections.trackVisits>n&&police.active&&police.cars.some(c=>cwRoadPoint(c.x,c.z)?.road===connections.track),visits));
 // A harbor arrival faces the standing fire with the cannon boat at the dock.
 await page.evaluate(()=>{policeStop(false);hop.active=null;applyVehicle('car');carBuildCabin();const [x,z]=CW.fireCar;Object.assign(state,{x,y:terrainEff(x,z)+TUNE.gearHeight,z,heading:Math.atan2(-(fire.x-x),-(fire.z-z)),phase:'TAXI',speed:0});heliReset();fireReset();});await step(.5);await shot('connection-harbor-fire');
 const target=await page.evaluate(()=>hopTarget()?.id);if(target==='fire-car'){await page.evaluate(()=>{state.z=CW.fireBoat[1]+25;state.y=seaLevelAt(state.x,state.z)+TUNE.gearHeight;hopUpdate(0);btnUpdateAll();});}
 const fireTarget=await page.evaluate(()=>hopTarget()?.id);if(fireTarget==='fire-speedboat')await page.locator('#hopBtn').tap({force:true});await step(.1);
 check(`connection harbor offers working cannon ${w} ${chase}`,await page.evaluate(()=>boatActive()&&boatCannonCan()),fireTarget);
 const fireBefore=await page.evaluate(()=>({drops:flags.ffDrops||0,out:flags.ffPutOut||0,x:state.x,z:state.z}));
 await step(3);
 check(`connection fire tender floats at its berth ${w} ${chase}`,await page.evaluate(p=>boatOnWater()&&Math.hypot(state.x-p.x,state.z-p.z)<5,fireBefore));
 const cannon=await page.locator('#cannonBtn').boundingBox();
 if(cannon){await touch('touchStart',{x:cannon.x+cannon.width/2,y:cannon.y+cannon.height/2});await step(1);await shot('connection-harbor-cannon');await step(5);await touch('touchEnd');}
 check(`connection harbor cannon puts out standing fire ${w} ${chase}`,await page.evaluate(p=>(flags.ffPutOut||0)>p.out&&(flags.ffDrops||0)>p.drops,fireBefore));
 await step(30);check(`connection fire remains repeatable ${w} ${chase}`,await page.evaluate(()=>fire.level>0&&boatCannonCan()));
 check(`connection no errors ${w} ${chase}`,!errors.length,errors.join(';'));
 await ctx.close();
 }
};
function TUNE_CARRIER_Z(){return -8100;}
