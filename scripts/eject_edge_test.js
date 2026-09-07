// Explicit edge fixtures supplement the ordinary touch tours. Only eject/return
// actions use the UI; setup places uncommon situations reproducibly.
const {chromium}=require('playwright-core'),{serve}=require('./polish_check'),{once}=require('events'),path=require('path');
(async()=>{const server=serve(path.resolve(__dirname,'..'),0);await once(server,'listening');const browser=await chromium.launch({executablePath:process.env.CHROME_HEADLESS_SHELL,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript('window.requestAnimationFrame=()=>0');await page.goto(`http://127.0.0.1:${server.address().port}/cockpit/`);await page.waitForFunction(()=>window.__lp);
const step=s=>page.evaluate(s=>{__lp.noRender=true;for(let i=0;i<s*60;i++)__lp.update(1/60)},s);const tap=()=>page.locator('#ejectBtn').tap();let failures=0;
const check=(name,ok,detail)=>{console.log(ok?'PASS':'FAIL',name,JSON.stringify(detail));if(!ok)failures++};
for(const kind of ['water','high','chute','moon','dock','rover','drone','wash','cargo','bucket']){
await page.goto(`http://127.0.0.1:${server.address().port}/cockpit/`);await page.waitForFunction(()=>window.__lp);
await page.evaluate(kind=>{
 __lp.api.skipScreens();__lp.api.setVehicle(['water','high','wash','cargo','bucket'].includes(kind)?'helicopter':'rocket');__lp.api.placeOnRunway();__lp.noRender=true;
 if(['water','high'].includes(kind)){state.phase='AIRBORNE';let found=false;for(let x=1500;x<9000&&!found;x+=200)for(let z=-3000;z<3000;z+=200)if(terrainEff(x,z)<TUNE.waterLevel-.01&&terrainEff(x-50,z-150)<TUNE.waterLevel-.01){state.x=x;state.z=z;found=true;break;}if(!found)throw Error('water fixture missing');state.y=kind==='high'?6000:30;state.speed=40;}
 if(['moon','dock','rover','drone'].includes(kind)){const b=BODIES.find(b=>b.name===(kind==='dock'?'station':kind==='moon'?'moon':'mars'));rk.stage=3;rocketApplyStages(vehicleModel);rk.onBody=b;state.x=b.x;state.y=b.y+b.r+rocketHalfLen();state.z=b.z;state.phase='TAXI';state.pitch=90;if(['rover','drone'].includes(kind)){roverDeploy();for(let i=0;i<10;i++)__lp.update(1/60);if(kind==='drone'){mars.drone.x=rover.x;mars.drone.y=rover.y;mars.drone.z=rover.z;marsDronePress();updateMarsDrone(.1);}}}
 if(kind==='chute'){rk.onBody=null;rk.stage=3;rocketApplyStages(vehicleModel);state.y=100;state.phase='AIRBORNE';rk.vy=-10;if(!deployChute())throw Error('chute fixture unavailable');updateChuteVisual(.5);}
 updateVehicleModel(0);__lp.update(1/60);if(kind==='wash')twWashStart();
 if(kind==='cargo'){toyWorld.held=toyWorld.objects[0];toyWorld.held.lock=false;}
 if(kind==='bucket')bucket.state='full';
 updateEjectControl();
},kind);
const before=await page.evaluate(()=>({family:ejectFamily(),chute:rk.chute,beacons:rover.beacons.length,rocks:rover.rocks.length,body:rk.onBody?.name}));
await tap();const oldChute=await page.evaluate(()=>rk.chute===0&&(!chuteGroup||!chuteGroup.visible));await tap();await step(3.5);await page.evaluate(()=>renderer.render(scene,camera));await page.screenshot({path:`qa-screenshots/eject-edge-${kind}.png`});
await step(30);const out=await page.evaluate(()=>({active:eject.active,last:eject.last,held:state.throttleHeld,touch:state.touching,body:rk.onBody?.name,beacons:rover.beacons.length,rocks:rover.rocks.length,wet:eject.wet,vacuum:eject.vacuum,drone:marsDroneActive(),rover:roverActive(),cargo:!!toyWorld.held,wash:!!toyWorld.wash,bucket:bucket.state,frameErrors:__lp.frameErrors||0}));
check(kind,(kind!=='chute'||before.chute>0&&oldChute)&&out.last?.family===before.family&&!out.active&&out.last?.returned&&out.last.canopyAtImpact&&out.last.contactError<.02&&!out.held&&!out.touch&&!out.wash&&!out.cargo&&out.bucket==='empty'&&(!before.body||out.body===before.body)&&before.rocks===out.rocks&&before.beacons===out.beacons&&(!['moon','rover','drone','dock'].includes(kind)||out.vacuum)&&(!['water','high'].includes(kind)||out.wet),out);
}
// Warm all pooled geometry, then repeat with the same model; scene ownership and
// renderer memory must plateau. Pointer cancellation cannot leave thrust held.
await page.evaluate(()=>{__lp.api.setVehicle('prop');__lp.api.placeOnRunway();updateEjectControl()});await tap();await step(30);await page.evaluate(()=>renderer.render(scene,camera));
const memory=()=>page.evaluate(()=>{let n=0;const owned=new Set();scene.traverse(()=>n++);eject.pool.root.traverse(o=>{if(o.geometry)owned.add(o.geometry.uuid)});return{n,g:renderer.info.memory.geometries,t:renderer.info.memory.textures,p:renderer.info.programs.length,owned:[...owned].sort().join(',')}});const initial=await memory(),samples=[];
for(let i=0;i<12;i++){await tap();await step(4);await tap();await step(10);await page.evaluate(()=>renderer.render(scene,camera));samples.push(await memory());}
const final=samples.at(-1),stable=samples.slice(-6).every(s=>JSON.stringify(s)===JSON.stringify(final));check('12 repeat cycles stabilize',stable&&initial.owned===final.owned,{initial:{...initial,owned:undefined},samples:samples.map(s=>({...s,owned:undefined})),sameOwnedGeometry:initial.owned===final.owned});
// An interrupted altitude touch and an interrupted stray touch during rescue
// must not latch any controls. A fresh vehicle accepts its next normal input.
await page.evaluate(()=>{__lp.api.setVehicle('helicopter');__lp.api.placeOnRunway()});await step(.2);
const cdp=await page.context().newCDPSession(page),rect=await page.locator('#heliUpBtn').boundingBox();
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x+rect.width/2,y:rect.y+rect.height/2,id:1}]});await step(.5);await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
await tap();await step(4);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:200,y:300,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await page.keyboard.press('v');await tap();await step(10);
const interrupted=await page.evaluate(()=>({active:eject.active,touch:state.touching,held:state.throttleHeld,vertical:heli.vertical,key:state.vehicleKey,returned:eject.last.returned}));check('interrupted input and fast return',!interrupted.active&&!interrupted.touch&&!interrupted.held&&interrupted.vertical===0&&interrupted.key==='helicopter'&&interrupted.returned,interrupted);
for(const [width,height] of [[390,844],[844,390],[768,1024],[1024,768]]){
await page.setViewportSize({width,height});
for(const key of ['prop','helicopter','fighter','airlinerDelta','rocket','starship']){await page.evaluate(key=>{__lp.api.setVehicle(key);__lp.api.placeOnRunway()},key);await step(.2);
const layout=await page.evaluate(()=>{const e=el.ejectBtn,r=e.getBoundingClientRect(),icon=e.querySelector('svg').getBoundingClientRect(),overlap=[];for(const b of document.querySelectorAll('button')){if(b===e||!b.getClientRects().length||getComputedStyle(b).visibility==='hidden'||getComputedStyle(b).display==='none')continue;const q=b.getBoundingClientRect();if(r.left<q.right&&r.right>q.left&&r.top<q.bottom&&r.bottom>q.top)overlap.push(b.id);}return{w:r.width,h:r.height,icon:icon.width,inside:r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,overlap}});check(`compact clear target ${key} ${width}x${height}`,layout.w>=56&&layout.h>=56&&layout.icon<=32&&layout.inside&&!layout.overlap.length,layout);
}}
check('no page errors',!errors.length,errors);if(failures)process.exitCode=1;
}finally{await browser.close();await new Promise(r=>server.close(r))}})().catch(e=>{console.error(e);process.exitCode=1});
