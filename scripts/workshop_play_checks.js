// All play-loop actions use UI touch controls. Read-only projections choose
// visible targets; the harness advances time but never relocates the player.
const path = require('path');
module.exports = async function workshopPlayChecks({newPage, check, shots, airport=0, viewports=[[1024,768],[768,1024],[844,390],[390,844]]}) {
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
      else if(kind==='exit')v=new THREE.Vector3(yard.slide.exitX,yard.y+1,yard.slide.exitZ);
      else v=new THREE.Vector3(state.x+Math.sin(state.heading)*15,yard.y,state.z+Math.cos(state.heading)*15);
      v.project(camera);const p={x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};
      return {...p,visible:v.z<1&&p.x>0&&p.x<innerWidth&&p.y>0&&p.y<document.getElementById('dash').getBoundingClientRect().top&&document.elementFromPoint(p.x,p.y)?.id==='gl'};
    },kind);
    const aim = async kind => { let p=await project(kind);if(!p.visible){const turn=await project('back');if(turn.visible){await tap(turn);await step(5);}p=await project(kind);}if(p.visible)await tap(p);return p;};
    const shot = name => page.screenshot({path:path.join(shots,`workshop-${airport?'ca-':''}${width}x${height}-${name}.png`)});
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
    const returned=await aim('cargo');await step(16);
    const again=await page.evaluate(()=>toyWorld.held===toyWorld.objects[state.originIdx ? TW.playground.objects*2-1 : 0]);
    const repeat=await aim('slide');await step(12);
    if(again)await tap(await center('#magnetBtn'));await step(16);
    const replay=await page.evaluate(()=>toyWorld.yards[state.originIdx].slide.completed);
    check(`workshop slide ${airport?'CA':'NY'} ${width}x${height}: collect the returned toy and replay`,returned.visible&&again&&repeat.visible&&replay===2,JSON.stringify({returned,again,repeat,replay}));
    await shot('slide-replay');
    const highCargo=await aim('cargo');await step(16);
    const highPickup=await page.evaluate(()=>toyWorld.held===toyWorld.objects[state.originIdx ? TW.playground.objects*2-1 : 0]);
    const highCup=await aim('slide');await step(12);
    if(highPickup)await hold('#heliUpBtn',3);
    const dropHeight=await page.evaluate(()=>state.y-toyWorld.yards[state.originIdx].y);
    if(highPickup)await tap(await center('#magnetBtn'));
    // Tap a clear patch to the side of the falling load, which remains a
    // legitimately pickable object while it falls in front of the camera.
    await shot('high-release');
    const departure=await page.evaluate(()=>{
      // Pick a visible patch beyond the temporary pickup lock. This only
      // reads the scene; the following touch is what steers the helicopter.
      for(const ny of [.15,.2,.25,.3])for(const nx of [.3,.7,.4,.6,.5]){
        const p={x:innerWidth*nx,y:innerHeight*ny};
        if(document.elementFromPoint(p.x,p.y)?.id!=='gl')continue;
        const hit=heliPick(nx*2-1,1-ny*2);
        if(hit&&Math.hypot(hit.point.x-state.x,hit.point.z-state.z)>TW.playground.leaveR*3)return{...p,visible:true};
      }
      return{visible:false};
    });
    if(departure.visible)await tap(departure);await step(2.5);
    const left=await page.evaluate(()=>({away:Math.hypot(state.x-toyWorld.dropX,state.z-toyWorld.dropZ)>TW.playground.leaveR,locked:toyWorld.objects[state.originIdx ? TW.playground.objects*2-1 : 0].lock,dropped:toyWorld.objects[state.originIdx ? TW.playground.objects*2-1 : 0].dropped}));
    await step(18);
    const highDone=await page.evaluate(()=>({slides:toyWorld.yards[state.originIdx].slide.completed,built:toyWorld.yards[state.originIdx].built,home:Math.hypot(toyWorld.objects[state.originIdx ? TW.playground.objects*2-1 : 0].x-toyWorld.objects[state.originIdx ? TW.playground.objects*2-1 : 0].homeX,toyWorld.objects[state.originIdx ? TW.playground.objects*2-1 : 0].z-toyWorld.objects[state.originIdx ? TW.playground.objects*2-1 : 0].homeZ)<1}));
    check(`workshop slide ${airport?'CA':'NY'} ${width}x${height}: climb, drop high and immediately fly away without losing the delivery`,highCargo.visible&&highPickup&&highCup.visible&&dropHeight>90&&departure.visible&&left.away&&!left.locked&&left.dropped&&highDone.slides===3&&highDone.built===3&&highDone.home,JSON.stringify({highCargo,highPickup,highCup,dropHeight,departure,left,highDone}));
    await shot('high-drop-complete');
    check(`workshop slide ${airport?'CA':'NY'} ${width}x${height}: no browser or frame errors`,errors.length===0&&await page.evaluate(()=>!window.__lp.frameErrors),JSON.stringify(errors));
    await page.close();
  }
};
