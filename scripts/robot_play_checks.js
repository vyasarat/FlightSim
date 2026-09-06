// All play-loop actions use UI touch controls. Read-only projections choose
// visible targets; the harness advances time but never relocates the player.
const path = require('path');
module.exports = async function robotPlayChecks({newPage, check, shots, airport=0, viewports=[[1024,768],[768,1024],[844,390],[390,844]]}) {
  for (const [width,height] of viewports) {
    const {page,errors=[]} = await newPage(width,height);
    // The full suite's fixture skips menus; reload to test the real picker path.
    await page.reload();await page.waitForFunction(()=>window.__lp);
    const cdp = await page.context().newCDPSession(page);
    const touch = (type,p) => cdp.send('Input.dispatchTouchEvent',{type,touchPoints:p?[{x:p.x,y:p.y,id:1}]:[]});
    const tap = async p => {await touch('touchStart',p);await touch('touchEnd');};
    const center = selector => page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
    const step = seconds => page.evaluate(s=>{window.__lp.noRender=true;for(let i=0;i<s*60;i++)window.__lp.update(1/60);renderer.render(scene,camera);},seconds);
    const hold = async (selector,seconds)=>{await touch('touchStart',await center(selector));await step(seconds);await touch('touchEnd');await step(.1);};
    const project = kind => page.evaluate(kind=>{
      const yard=toyWorld.yards[state.originIdx],o=toyWorld.objects[state.originIdx ? TW.playground.objects*2-1 : 0];
      let v;
      if(kind==='cargo')v=new THREE.Vector3(o.x,twCargoTop(o),o.z);
      else if(kind==='slide')v=new THREE.Vector3(yard.slide.x,yard.y+TW.slide.height,yard.slide.z);
      else if(kind==='robot')v=yard.buildGroup.localToWorld(new THREE.Vector3(0,31,0));
      else if(kind==='away')v=new THREE.Vector3(yard.windmills[0].x,yard.windmills[0].y+TW.garden.height,yard.windmills[0].z);
      else if(kind==='exit')v=new THREE.Vector3(yard.slide.exitX,yard.y+1,yard.slide.exitZ);
      else v=new THREE.Vector3(state.x+Math.sin(state.heading)*15,yard.y,state.z+Math.cos(state.heading)*15);
      const world={x:v.x,z:v.z};v.project(camera);const p={x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};
      return {...p,world,visible:v.z<1&&p.x>0&&p.x<innerWidth&&p.y>0&&p.y<document.getElementById('dash').getBoundingClientRect().top&&document.elementFromPoint(p.x,p.y)?.id==='gl'};
    },kind);
    const aim = async kind => {
      let p=await project(kind);
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
        if(!steer)break;await tap(steer);await step(5);p=await project(kind);
      }
      if(p.visible)await tap(p);return p;
    };
    const shot = name => page.screenshot({path:path.join(shots,`robot-${airport?'ca-':''}${width}x${height}-${name}.png`)});
    await tap(await center('[data-v="helicopter"]'));await tap(await center(`[data-d="${airport}"]`));await step(2);
    await hold('#heliUpBtn',4);await step(1);await shot('discovery');
    const cargo=await aim('cargo');await step(16);
    const picked=await page.evaluate(()=>toyWorld.held===toyWorld.objects[state.originIdx ? TW.playground.objects*2-1 : 0]);
    const slide=await aim('slide');await step(12);await shot('slide-entry');
    if(picked)await tap(await center('#magnetBtn'));
    await step(4.2);await shot('slide-ride');await step(11.8);
    const done=await page.evaluate(()=>({runs:toyWorld.yards[state.originIdx].slide.completed,held:!!toyWorld.held,delivering:toyWorld.objects[state.originIdx ? TW.playground.objects*2-1 : 0].delivering,x:toyWorld.objects[state.originIdx ? TW.playground.objects*2-1 : 0].x,z:toyWorld.objects[state.originIdx ? TW.playground.objects*2-1 : 0].z,homeX:toyWorld.objects[state.originIdx ? TW.playground.objects*2-1 : 0].homeX,homeZ:toyWorld.objects[state.originIdx ? TW.playground.objects*2-1 : 0].homeZ,built:toyWorld.yards[state.originIdx].built}));
    check(`workshop slide ${airport?'CA':'NY'} ${width}x${height}: picker, pickup, visible cup, drop, slide, crane build and cargo return`,cargo.visible&&picked&&slide.visible&&done.runs===1&&!done.held&&!done.delivering&&done.built===1&&Math.hypot(done.x-done.homeX,done.z-done.homeZ)<2,JSON.stringify({cargo,slide,done}));
    await shot('slide-exit');
    // Wait for the delivery dance, then approach the visible robot itself.
    await step(10);
    const robot=await aim('robot');
    const faceTap=await page.evaluate(()=>{const y=toyWorld.yards[state.originIdx],t=heli.target;return !!t&&Math.hypot(t.x-y.x-y.side*TW.playground.displayX,t.z-y.z-y.side*TW.playground.displayZ)<25;});
    for(let n=0;n<40;n++){await step(.2);if(await page.evaluate(()=>toyWorld.yards[state.originIdx].greetT>1))break;}
    await step(.8);await shot('hello');
    const hello=await page.evaluate(()=>{const y=toyWorld.yards[state.originIdx],p=y.buildGroup.localToWorld(new THREE.Vector3(0,31,5)).project(camera);return{x:state.x,z:state.z,target:heli.target,count:y.greetings,waving:y.greetT>0,face:y.face.visible,visible:p.z<1&&(p.x+1)*innerWidth/2>0&&(p.x+1)*innerWidth/2<innerWidth&&(1-p.y)*innerHeight/2>0&&(1-p.y)*innerHeight/2<document.getElementById('dash').getBoundingClientRect().top};});
    check(`robot ${airport?'CA':'NY'} ${width}x${height}: approach a visible robot and receive a wave`,robot.visible&&faceTap&&hello.count===1&&hello.waving&&hello.face&&hello.visible,JSON.stringify({robot,hello}));
    await step(12);
    const calm=await page.evaluate(()=>{const y=toyWorld.yards[state.originIdx];return y.greetings===1&&y.greetT===0;});
    const away=await aim('away');await step(12);
    const left=await page.evaluate(()=>!toyWorld.yards[state.originIdx].greetNear);
    const again=await aim('robot');
    for(let n=0;n<60;n++){await step(.2);if(await page.evaluate(()=>toyWorld.yards[state.originIdx].greetings===2))break;}
    await step(.8);await shot('hello-again');
    const replay=await page.evaluate(()=>({count:toyWorld.yards[state.originIdx].greetings,waving:toyWorld.yards[state.originIdx].greetT>0}));
    check(`robot ${airport?'CA':'NY'} ${width}x${height}: quiet hover, leave and return for another greeting`,calm&&away.visible&&left&&again.visible&&replay.count===2&&replay.waving,JSON.stringify({calm,away,left,again,replay}));
    await touch('touchStart',await center('#heliUpBtn'));await step(.2);await touch('touchCancel');
    const cancel=await page.evaluate(()=>heli.vertical===0&&!heliGesture.active);
    await tap(await center('#heliHoverBtn'));await hold('#heliDownBtn',20);await step(1);
    const landed=await page.evaluate(()=>state.phase==='TAXI'&&pickerCanOpen());
    if(landed){await tap(await center('#vehBtn'));await tap(await center('[data-v="prop"]'));await tap(await center(`[data-d="${airport}"]`));await step(4);}
    const exit=await page.evaluate(()=>({vehicle:state.vehicleKey,phase:state.phase,waving:toyWorld.yards[state.originIdx].greetT>0,near:toyWorld.yards[state.originIdx].greetNear,held:!!toyWorld.held}));
    check(`robot ${airport?'CA':'NY'} ${width}x${height}: interrupted touch, land and switch to plane`,cancel&&landed&&exit.vehicle==='prop'&&exit.phase==='TAXI'&&!exit.waving&&!exit.near&&!exit.held,JSON.stringify({cancel,landed,exit}));
    await shot('exit');
    check(`robot ${airport?'CA':'NY'} ${width}x${height}: no browser or frame errors`,errors.length===0&&await page.evaluate(()=>!__lp.frameErrors),JSON.stringify(errors));
    await page.close();
  }
};
