// Actual touch controls from the ordinary picker; deterministic time only.
const {chromium}=require('playwright-core');const {serve}=require('./polish_check');const {once}=require('events');const path=require('path');
(async()=>{
 const server=serve(path.resolve(__dirname,'..'),0);await once(server,'listening');
 const browser=await chromium.launch({executablePath:process.env.CHROME_HEADLESS_SHELL,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const results=[];
  for(const key of (process.argv.includes('--all')?['prop','helicopter','fighter','airlinerDelta','airlinerJetblue','airlinerEmirates','rocket','starship']:['prop','helicopter'])){
   const page=await browser.newPage({viewport:(process.argv.includes('--ipad')?{width:1024,height:768}:{width:390,height:844}),hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript('window.requestAnimationFrame=()=>0;');await page.goto(`http://127.0.0.1:${server.address().port}/cockpit/`);await page.waitForFunction(()=>window.__lp);
   const step=s=>page.evaluate(s=>{__lp.noRender=true;for(let i=0;i<s*60;i++)__lp.update(1/60);},s);
   const shot=async name=>{await page.evaluate(()=>renderer.render(scene,camera));return page.screenshot({path:path.resolve(__dirname,`../qa-screenshots/eject-${key}-${process.argv.includes('--ipad')?'ipad-':''}${name}.png`)});};
   const cdp=await page.context().newCDPSession(page);const touch=(type,p)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:p?[{x:p.x,y:p.y,id:1}]:[]});
   const centre=sel=>page.locator(sel).evaluate(e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
   const tap=async sel=>{await touch('touchStart',await centre(sel));await touch('touchEnd');};
   await tap(`[data-v="${key}"]`);await tap('[data-d="0"]');if(['rocket','starship'].includes(key))await tap('[data-dest="moon"]');await step(1);await shot('ready');
   await tap('#ejectBtn');await tap('#ejectBtn');await step(await page.evaluate(()=>TUNE.eject.frameTime+eject.openT*.6));await shot('opening');
   const opening=await page.evaluate(()=>({phase:eject.phase,angle:eject.family==='helicopter'?eject.pool.hatch.rotation.z-Math.PI/2:eject.pool.hatch.rotation.x,cycles:flags.ejections,empty:eject.empty}));
   for(let i=0;i<60;i++){await step(.05);if(await page.evaluate(()=>eject.phase==='launch'&&eject.t>.6))break;}
   await shot('seat');const launch=await page.evaluate(()=>({clear:eject.events.clearance,rotors:eject.events.rotorsClear,canopy:eject.pool.canopy.visible}));
   for(let i=0;i<80;i++){await step(.05);if(await page.evaluate(()=>eject.phase==='float'))break;}
   await shot('canopy');const canopy=await page.evaluate(()=>eject.events.unfolded&&eject.pool.canopy.visible);
   for(let i=0;i<100;i++){await step(.05);if(await page.evaluate(()=>eject.impact))break;}
   await shot('impact');const impact=await page.evaluate(()=>{const v=new THREE.Vector3(...eject.events.contactPoint).project(camera),x=(v.x+1)*innerWidth/2,y=(1-v.y)*innerHeight/2;return{...eject.events,visibleImpact:v.z<1&&x>8&&x<innerWidth-8&&y>8&&y<document.getElementById('dash').getBoundingClientRect().top-8,screen:{x,y}}});
   for(let i=0;i<240;i++){await step(.05);if(await page.evaluate(()=>!eject.active))break;}
   await shot('return');const end=await page.evaluate(()=>({active:eject.active,phase:state.phase,key:state.vehicleKey,last:eject.last,held:state.throttleHeld,touch:state.touching}));
   const ok=Math.abs(opening.angle)>.1&&opening.cycles===1&&!opening.empty&&launch.clear>5&&launch.rotors&&!launch.canopy&&canopy&&impact.impact&&impact.visibleImpact&&impact.emptyAtImpact&&impact.canopyAtImpact&&impact.contactError<.02&&Math.abs(impact.impactBottom-impact.impactSurface)<.01&&!end.active&&end.phase==='TAXI'&&end.key===key&&end.last.landed&&end.last.returned&&!end.held&&!end.touch&&!errors.length;
   results.push(ok);console.log(`${ok?'PASS':'FAIL'} ${key}: opening, seat clearance, canopy, actual surface impact, safe landing, return ${JSON.stringify({opening,launch,canopy,impact,end,errors})}`);await page.close();
  }
  console.log(`${results.filter(Boolean).length}/${results.length} passed`);if(results.some(v=>!v))process.exitCode=1;
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
