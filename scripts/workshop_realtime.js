// A real-clock UI playthrough. No __lp.update(), API actions, state writes,
// teleports, camera overrides, or requestAnimationFrame replacement.
// Optional LP_PLAY_URL tests a running local server; otherwise this serves one.
const {chromium}=require('playwright-core');
const {serve}=require('./polish_check');
const {once}=require('events');
const path=require('path'),fs=require('fs');
const polishOut=process.env.LP_POLISH_OUT&&path.resolve(process.env.LP_POLISH_OUT);
if(polishOut)fs.mkdirSync(polishOut,{recursive:true});
(async()=>{
  const server=process.env.LP_PLAY_URL?null:serve(path.resolve(__dirname,'..'),0);
  if(server)await once(server,'listening');
  const browser=await chromium.launch({executablePath:process.env.CHROME_HEADLESS_SHELL,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const videoEpoch=Date.now();
    const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,recordVideo:{dir:polishOut?path.join(polishOut,'video'):path.resolve(__dirname,'../qa-screenshots/workshop-video'),size:{width:844,height:390}}});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.env.LP_PLAY_URL||`http://127.0.0.1:${server.address().port}/cockpit/`);await page.waitForFunction(()=>window.__lp);
    const cdp=await context.newCDPSession(page);
    const touch=(type,p)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:p?[{x:p.x,y:p.y,id:1}]:[]});
    const tap=async p=>{await touch('touchStart',p);await touch('touchEnd');};
    const center=async selector=>{await page.locator(selector).waitFor({state:'visible'});return page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});};
    const wait=async(fn,arg)=>{try{return await page.waitForFunction(fn,arg,{timeout:180000,polling:250});}catch(e){await page.screenshot({path:path.resolve(__dirname,'../qa-screenshots/realtime-failed.png')});console.log('Failure state',await page.evaluate(()=>({x:state.x,y:state.y,z:state.z,phase:state.phase,vehicle:state.vehicleKey,vertical:heli.vertical,menu:menuOpen(),pointer:heliAltitudePointer,frameErrors:window.__lp.frameErrors})));throw e;}};
    let selected=0;
    const point=kind=>page.evaluate(({kind,selected})=>{
      const o=toyWorld.objects[selected],y=o.yard;
      let v=kind==='slide'?new THREE.Vector3(y.slide.x,y.y+TW.slide.height,y.slide.z):kind.startsWith('wind')?new THREE.Vector3(y.windmills[+kind.slice(4)].x,y.windmills[+kind.slice(4)].y+TW.garden.height,y.windmills[+kind.slice(4)].z):kind==='cargo'?new THREE.Vector3(o.x,twCargoTop(o),o.z):kind==='pad'?new THREE.Vector3(y.pad.x,y.y+1,y.pad.z):new THREE.Vector3(state.x+Math.sin(state.heading)*15,y.y,state.z+Math.cos(state.heading)*15);
      v.project(camera);const p={x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};
      return {...p,visible:v.z<1&&p.x>0&&p.x<innerWidth&&p.y>0&&p.y<document.getElementById('dash').getBoundingClientRect().top&&document.elementFromPoint(p.x,p.y)?.id==='gl'};
    },{kind,selected});
    const aim=async kind=>{let p=await point(kind);if(!p.visible&&kind!=='back'){const back=await point('back');if(back.visible){await tap(back);await wait(()=>!heli.target&&state.speed<1);}p=await point(kind);}if(!p.visible)throw Error(`Not visibly tappable: ${kind} ${JSON.stringify(p)}`);await tap(p);};
    const shot=async name=>{console.log('SHOT',name,((Date.now()-videoEpoch)/1000).toFixed(2));return page.screenshot({path:polishOut?path.join(polishOut,`realtime-${name}.png`):path.resolve(__dirname,`../qa-screenshots/realtime-${name}.png`)});};
    await page.locator('[data-v="helicopter"]').tap();await page.locator('[data-d="0"]').tap();
    await touch('touchStart',await center('#heliUpBtn'));await wait(()=>state.y>68);await touch('touchEnd');
    console.log('Real time: lifted from runway');await shot('discovery');
    await wait(()=>Math.abs(heli.vy)<.5);
    await aim('cargo');await wait(()=>!!toyWorld.held);selected=await page.evaluate(()=>toyWorld.objects.indexOf(toyWorld.held));
    await wait(()=>!heli.target&&state.speed<1);await shot('pickup');
    console.log('Real time: picked up cargo');
    await aim('pad');await wait(()=>!heli.target&&state.speed<1);
    await page.locator('#magnetBtn').tap();await wait(()=>toyWorld.yards[0].built===1);await shot('robot');
    console.log('Real time: delivered, complete robot visible');
    await aim('back');await wait(()=>!heli.target&&state.speed<1);
    await aim('cargo');await wait(()=>!!toyWorld.held);
    await wait(()=>!heli.target&&state.speed<1);
    await aim('back');await wait(()=>!heli.target&&state.speed<1);
    await aim('slide');await wait(()=>!heli.target&&state.speed<1);
    await page.locator('#magnetBtn').tap();await wait(()=>!!toyWorld.yards[0].slide.run);await shot('ramp');
    await wait(()=>toyWorld.yards[0].built===2&&toyWorld.yards[0].slide.completed===1);await shot('replay');
    console.log('Real time: ramp ride, crane build and second cargo return complete');
    // Re-enter from the ordinary picker/runway before the independent music loop.
    await touch('touchStart',await center('#heliDownBtn'));await wait(()=>state.phase==='TAXI');await touch('touchEnd');
    await page.locator('#vehBtn').tap();await page.locator('[data-v="helicopter"]').tap();await page.locator('[data-d="0"]').tap();
    await touch('touchStart',await center('#heliUpBtn'));await wait(()=>state.y>68);await touch('touchEnd');await wait(()=>Math.abs(heli.vy)<.5);
    for(const i of [0,1,2,0]){
      const before=await page.evaluate(i=>toyWorld.yards[0].windmills[i].plays,i);await aim('wind'+i);
      await wait(({i,before})=>toyWorld.yards[0].windmills[i].plays>before,{i,before});await shot('wind-'+i);await wait(()=>!heli.target&&state.speed<1);
      console.log('Real time: pinwheel '+i+' played');
    }
    if(polishOut){
      await page.locator('#ejectBtn').tap();await wait(()=>eject.canopyOpen);await shot('eject-canopy');
      await wait(()=>eject.impact);await shot('eject-impact');await wait(()=>!eject.active);
      const rescue=await page.evaluate(()=>eject.last);console.log('Real time rescue',JSON.stringify(rescue));
      if(!rescue.returned||!rescue.canopyAtImpact)throw Error('Incomplete rescue');
    }
    // Land with the existing down control, then switch from the vehicle picker.
    await touch('touchStart',await center('#heliDownBtn'));await wait(()=>state.phase==='TAXI');await touch('touchEnd');
    await page.locator('#vehBtn').tap();await page.locator('[data-v="prop"]').tap();
    await page.locator('[data-d="0"]').tap();await wait(()=>state.vehicleKey==='prop'&&state.phase==='TAXI');await shot('home');
    console.log(JSON.stringify({errors,final:await page.evaluate(()=>({phase:state.phase,held:!!toyWorld.held,frameErrors:window.__lp.frameErrors||0,built:toyWorld.yards[0].built}))}));
    if(errors.length)throw Error(errors.join('\n'));
    await context.close();
    const video=await page.video().path();console.log(`Video: ${video}`);
  }finally{await browser.close();if(server)await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
