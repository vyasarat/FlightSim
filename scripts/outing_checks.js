// An outing through on-screen touch controls. No game-state writes, teleports,
// test API movement or direct action calls. Reads guide the test driver's finger.
const fs=require('fs'),path=require('path');
module.exports=async({newPage,check})=>{
 const {page,ctx,errors}=await newPage(390,844),out=path.resolve(__dirname,'../evidence/connected-world');
 const cdp=await page.context().newCDPSession(page),trace=[];
 const touch=(type,p)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:p?[{...p,id:1}]:[]});
 const tap=async sel=>{const r=await page.locator(sel).boundingBox();if(!r)throw Error('Missing control '+sel);await touch('touchStart',{x:r.x+r.width/2,y:r.y+r.height/2});await touch('touchEnd');};
 const step=s=>page.evaluate(s=>{for(let i=0;i<Math.round(s*60);i++)__lp.update(1/60);},s);
 const status=()=>page.evaluate(()=>({x:state.x,y:state.y,z:state.z,heading:state.heading,speed:state.speed,key:state.vehicleKey,phase:state.phase,exploding:state.exploding,target:hopTarget()?.id,held:state.touching||state.throttleHeld,frameErrors:__lp.frameErrors||0}));
 const shot=async name=>{await page.evaluate(()=>renderer.render(scene,camera));await page.screenshot({path:path.join(out,`outing-${name}.png`)});};
 const report=async name=>{const s=await status();trace.push({name,...s});console.log('OUTING',name,JSON.stringify(s));return s;};
 const anchor={x:195,y:360};let down=false;
 const release=async cancel=>{if(down)await touch(cancel?'touchCancel':'touchEnd');down=false;};
 const drive=async(x,z,radius=18,limit=180)=>{
  if(!down){await touch('touchStart',anchor);down=true;}
  for(let i=0;i<limit;i++){
   const s=await status(),dist=Math.hypot(x-s.x,z-s.z);if(dist<radius)return;
   if(s.exploding){await release();await step(5);await touch('touchStart',anchor);down=true;}
   const want=Math.atan2(-(x-s.x),-(z-s.z));let err=want-s.heading;while(err>Math.PI)err-=2*Math.PI;while(err< -Math.PI)err+=2*Math.PI;
   const bank=Math.max(-1,Math.min(1,-err*2));
   const range=await page.evaluate(()=>TUNE.dragRangeX);
   await touch('touchMove',{x:anchor.x+bank*390*range,y:anchor.y});await step(.25);
  }
  throw Error(`Could not drive to ${x},${z}: ${JSON.stringify(await status())}`);
 };
 const stop=async()=>{await release();await step(3);};
 try{
 await step(.1);if(await page.locator('#screenVehicle').evaluate(e=>e.classList.contains('hiddenS')))await tap('#menuBtn');
 await tap('[data-v="prop"]');await tap('[data-d="1"]');await step(1);await report('airport-start');await shot('airport-start');
 for(let lap=1;lap<=2;lap++){
  await tap('#hopBtn');await step(1);check(`outing ${lap}: airport to car through hop button`,(await status()).key==='car');await tap('#slowBtn');await tap('#slowBtn');const carActor=await page.evaluate(()=>hop.active.id);
  // Point onto the airport connector, then the harbor spur.
  await drive(24,-6740,24);await report('airport-road-'+lap);
  if(lap===1){await release(true);await step(3);check('outing interrupted drag releases and stops',!(await status()).held&&(await status()).speed<1);}
  await drive(430,-6600,32);await drive(700,-6745,25);await drive(1000,-6745,25);await drive(1300,-6745,25);await drive(1540,-6745,30);await drive(1610,-6715,25);await drive(1680,-6685,18);await stop();await report('harbor-arrival-'+lap);await shot('harbor-arrival-'+lap);
  // If coasting carried him past the dock, aim back at its landing.
  for(let i=0;i<3&&(await status()).target!=='harbor-boat';i++){await drive(1680,-6685,18);await stop();}
  check(`outing ${lap}: harbor offers the boat`,(await status()).target==='harbor-boat');await tap('#hopBtn');await step(1);
  check(`outing ${lap}: car to speedboat`,(await status()).key==='speedboat');await tap('#slowBtn');await tap('#slowBtn');await shot('speedboat-'+lap);
  // Switch back midway through the outing, then return to the same boat.
  if(lap===1){await tap('#hopBtn');await step(.3);check('outing midway switch returns to the parked car',(await status()).key==='car');await tap('#hopBtn');await step(.3);check('outing midway switch resumes the speedboat',(await status()).key==='speedboat');}
  await drive(1500,-6510,30);await drive(1500,-6400,30);await release(true);await step(3);check(`outing ${lap}: interrupted boat input releases`,!(await status()).held);
  await drive(1500,-6510,30);await drive(1660,-6635,18);await stop();await report('boat-return-'+lap);await shot('boat-return-'+lap);
  for(let i=0;i<3&&!(await status()).target?.includes('car');i++){await drive(1660,-6635,12);await stop();}
  await tap('#hopBtn');await step(1);check(`outing ${lap}: returns to the same parked car`,await page.evaluate(id=>state.vehicleKey==='car'&&hop.active.id===id,carActor));
  await drive(1780,-6685,35);await drive(1840,-6715,30);await drive(1860,-6760,30);await drive(1820,-6800,30);await drive(1740,-6795,30);await drive(1680,-6745,30);await drive(1600,-6745,30);await drive(1300,-6745,25);await drive(1000,-6745,25);await drive(700,-6745,25);await drive(430,-6600,32);await drive(24,-6740,25);await drive(24,-6618,15);await stop();await report('airport-return-'+lap);await shot('airport-return-'+lap);
  for(let i=0;i<3&&!(await status()).target?.startsWith('left-');i++){await drive(0,-6650,15);await stop();}
  await tap('#hopBtn');await step(1);check(`outing ${lap}: returns to the original aircraft`,(await status()).key==='prop');await shot('complete-'+lap);
 }
 check('outing has no runtime errors',!errors.length&&!(await status()).frameErrors,errors.join(';'));
 }finally{await release();fs.writeFileSync(path.join(out,'outing-trace.json'),JSON.stringify(trace,null,2));await ctx.close();}
};
