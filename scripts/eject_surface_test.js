// Planet entry uses ordinary picker/throttle/stage/arrival/rover touch controls.
const {chromium}=require('playwright-core'),{serve}=require('./polish_check'),{once}=require('events'),path=require('path');
(async()=>{const server=serve(path.resolve(__dirname,'..'),0);await once(server,'listening');const browser=await chromium.launch({executablePath:process.env.CHROME_HEADLESS_SHELL,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
const page=await browser.newPage({viewport:{width:1024,height:768},hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript('window.requestAnimationFrame=()=>0');await page.goto(`http://127.0.0.1:${server.address().port}/cockpit/`);await page.waitForFunction(()=>window.__lp);
const step=s=>page.evaluate(s=>{__lp.noRender=true;for(let i=0;i<s*60;i++)__lp.update(1/60);},s);
const cdp=await page.context().newCDPSession(page);const touch=(type,p)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:p?[{...p,id:1}]:[]});const centre=sel=>page.locator(sel).evaluate(e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}});const tap=async sel=>{await page.waitForTimeout(350);await touch('touchStart',await centre(sel));await touch('touchEnd')};
await tap('[data-v="rocket"]');await tap('[data-d="0"]');await tap('[data-dest="mars"]');await step(1);
await touch('touchStart',await centre('#throttleBtn'));
for(let i=0;i<100;i++){await step(2);if(await page.evaluate(()=>state.y>TUNE.spaceAltitude+TUNE.spaceBlendBand+50))break;if(await page.evaluate(()=>rocketCanDrop())){await touch('touchEnd');await tap('#stageBtn');await touch('touchStart',await centre('#throttleBtn'));}}
await touch('touchEnd');await step(.1);console.log('FLIGHT',await page.evaluate(()=>({y:state.y,phase:state.phase,skip:rocketCanSkip(),dest:state.dest})));await tap('#skipBtn');
for(let i=0;i<100;i++){await step(2);if(await page.evaluate(()=>!!rk.onBody))break;}
console.log('ARRIVAL',await page.evaluate(()=>({body:rk.onBody?.name,phase:state.phase,rover:roverCan()})));
await page.evaluate(()=>renderer.render(scene,camera));await page.screenshot({path:'qa-screenshots/eject-mars-arrival.png'});
async function cycle(name){await tap('#ejectBtn');let impact;for(let i=0;i<400;i++){await step(.05);if(await page.evaluate(()=>eject.phase==='float')&&!impact){await page.evaluate(()=>renderer.render(scene,camera));await page.screenshot({path:`qa-screenshots/eject-${name}-float.png`});impact=true;}if(await page.evaluate(()=>!eject.active))break;}const result=await page.evaluate(()=>({last:eject.last,body:rk.onBody?.name,rover:roverActive(),drone:marsDroneActive(),active:eject.active}));console.log(name,JSON.stringify(result));if(result.last?.family!==(name==='mars-rover'?'rover':name==='mars-drone'?'drone':'rocket'))throw Error(name+' wrong family');if(!result.last?.returned||result.active||!result.last.canopyAtImpact||result.last.contactError>.02)throw Error(name+' failed');}
await cycle('mars-rocket');await step(1);await tap('#roverBtn');await step(1);await cycle('mars-rover');await step(1);
// Turn in place, release, then drive straight: no simultaneous touches.
for(let leg=0;leg<12&&!await page.evaluate(()=>marsDroneCan());leg++){
 const aim=await page.evaluate(()=>{const d=new THREE.Vector3(mars.drone.x-rover.x,mars.drone.y-rover.y,mars.drone.z-rover.z),distance=d.length();d.addScaledVector(rover.n,-d.dot(rover.n)).normalize();return{angle:Math.atan2(rover.f.clone().cross(d).dot(rover.n),rover.f.dot(d)),distance};});
 await touch('touchStart',{x:512,y:320});await touch('touchMove',{x:512+Math.sign(aim.angle)*250,y:320});await step(Math.abs(aim.angle)/(.45*1.9));await touch('touchEnd');await step(.1);
 await touch('touchStart',await centre('#throttleBtn'));await step(Math.min(3,Math.max(.2,(aim.distance-8)/14)));await touch('touchEnd');await step(1);
}
await step(.2);if(!await page.evaluate(()=>marsDroneCan()))throw Error('Did not drive to drone');
await tap('#droneBtn');await step(1);if(!await page.evaluate(()=>marsDroneActive()))throw Error('Drone entry failed');await cycle('mars-drone');
console.log('DRONE',await page.evaluate(()=>({can:marsDroneCan(),pos:mars.drone&&{x:mars.drone.x,y:mars.drone.y,z:mars.drone.z},rover:{x:rover.x,y:rover.y,z:rover.z}})));
console.log('ERRORS',errors);if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();await new Promise(r=>server.close(r))}})().catch(e=>{console.error(e);process.exitCode=1});
