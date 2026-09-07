// A real-clock UI playthrough. No __lp.update(), API actions, state writes,
// teleports, camera overrides, or requestAnimationFrame replacement.
// Optional LP_PLAY_URL tests a running local server; otherwise this serves one.
const {chromium}=require('playwright-core');
const {serve}=require('./polish_check');
const {once}=require('events');
const path=require('path');
(async()=>{
  const server=process.env.LP_PLAY_URL?null:serve(path.resolve(__dirname,'..'),0);
  if(server)await once(server,'listening');
  const browser=await chromium.launch({executablePath:process.env.CHROME_HEADLESS_SHELL,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,recordVideo:{dir:path.resolve(__dirname,'../qa-screenshots/robot-video'),size:{width:844,height:390}}});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.env.LP_PLAY_URL||`http://127.0.0.1:${server.address().port}/cockpit/`);await page.waitForFunction(()=>window.__lp);
    const cdp=await context.newCDPSession(page);
    const touch=(type,p)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:p?[{x:p.x,y:p.y,id:1}]:[]});
    const tap=async p=>{await touch('touchStart',p);await touch('touchEnd');};
    const center=async selector=>{await page.locator(selector).waitFor({state:'visible'});return page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});};
    const wait=async(fn,arg)=>{try{return await page.waitForFunction(fn,arg,{timeout:180000,polling:250});}catch(e){await page.screenshot({path:path.resolve(__dirname,'../qa-screenshots/realtime-failed.png')});console.log('Failure state',await page.evaluate(()=>({x:state.x,y:state.y,z:state.z,phase:state.phase,vehicle:state.vehicleKey,vertical:heli.vertical,menu:menuOpen(),pointer:heliAltitudePointer,target:heli.target,greetings:toyWorld.yards[0].greetings,frameErrors:window.__lp.frameErrors})));throw e;}};
    let selected=0;
    const point=kind=>page.evaluate(({kind,selected})=>{
      const o=toyWorld.objects[selected],y=o.yard;
      let v=kind==='robot'?y.buildGroup.localToWorld(new THREE.Vector3(0,31,0)):kind==='slide'?new THREE.Vector3(y.slide.x,y.y+TW.slide.height,y.slide.z):kind.startsWith('wind')?new THREE.Vector3(y.windmills[+kind.slice(4)].x,y.windmills[+kind.slice(4)].y+TW.garden.height,y.windmills[+kind.slice(4)].z):kind==='cargo'?new THREE.Vector3(o.x,twCargoTop(o),o.z):kind==='pad'?new THREE.Vector3(y.pad.x,y.y+1,y.pad.z):new THREE.Vector3(state.x+Math.sin(state.heading)*15,y.y,state.z+Math.cos(state.heading)*15);
      if(kind==='robot'){
        const head=v.clone().project(camera),px=(head.x+1)*innerWidth/2,py=(1-head.y)*innerHeight/2;
        if(head.z>=1||px<=0||px>=innerWidth||py<=0||py>=document.getElementById('dash').getBoundingClientRect().top||document.elementFromPoint(px,py)?.id!=='gl')v=y.buildGroup.localToWorld(new THREE.Vector3(0,2,0));
      }
      const world={x:v.x,z:v.z};v.project(camera);const p={x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};
      return {...p,world,visible:v.z<1&&p.x>0&&p.x<innerWidth&&p.y>0&&p.y<document.getElementById('dash').getBoundingClientRect().top&&document.elementFromPoint(p.x,p.y)?.id==='gl'};
    },{kind,selected});
    const aim = async kind => {
      await page.waitForTimeout(800);
      let p=await point(kind);
      // Turn through nearby visible ground taps when a target is off to the
      // side. Each tap is a normal destination; scene queries only plan it.
      for(let turn=0;turn<8&&!p.visible;turn++){
        const steer=await page.evaluate(goal=>{
          let best=null,score=-Infinity;
          const dx=goal.x-state.x,dz=goal.z-state.z,n=Math.hypot(dx,dz)||1;
          for(const ny of [.4,.5,.6,.65,.7])for(const nx of [.15,.3,.5,.7,.85]){
            const x=innerWidth*nx,y=innerHeight*ny;
            if(y>=document.getElementById('dash').getBoundingClientRect().top||document.elementFromPoint(x,y)?.id!=='gl')continue;
            const hit=heliPick(nx*2-1,1-ny*2);if(!hit)continue;
            const hx=hit.point.x-state.x,hz=hit.point.z-state.z,d=Math.hypot(hx,hz);
            if(d<12||d>75)continue;
            const value=(hx*dx+hz*dz)/(d*n)-d*.001;
            if(value>score){score=value;best={x,y};}
          }
          return best;
        },p.world);
        if(!steer)break;await tap(steer);await wait(()=>!heli.target&&state.speed<1);await page.waitForTimeout(800);p=await point(kind);
      }
      if(!p.visible)throw Error(`Target outside visible controls: ${kind} ${JSON.stringify(p)}`);
      console.log('Touch target',kind,JSON.stringify(p));await tap(p);return p;
    };
    const shot=name=>page.screenshot({path:path.resolve(__dirname,`../qa-screenshots/robot-realtime-${name}.png`)});
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
    await wait(()=>toyWorld.yards[0].danceT===0);
    await aim('robot');await wait(()=>toyWorld.yards[0].greetings===1);await shot('hello');
    await wait(()=>!heli.target&&state.speed<1);await wait(()=>toyWorld.yards[0].greetT===0);
    console.log('Real time: approached robot, received a wave, quiet hover');
    await aim('wind0');await wait(()=>!heli.target&&state.speed<1);await wait(()=>!toyWorld.yards[0].greetNear);
    await shot('away');await aim('robot');await wait(()=>toyWorld.yards[0].greetings===2);await shot('hello-again');
    await wait(()=>!heli.target&&state.speed<1);console.log('Real time: left, returned and received another wave');
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
