const path=require('path');
module.exports=async function gardenPlayChecks({newPage,check,shots,airport=0,viewports=[[1024,768],[768,1024],[844,390],[390,844]]}) {
  for(const [width,height] of viewports){
    const {page,errors=[]}=await newPage(width,height);
    await page.reload();await page.waitForFunction(()=>window.__lp);
    const cdp=await page.context().newCDPSession(page);
    const touch=(type,p)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:p?[{x:p.x,y:p.y,id:1}]:[]});
    const tap=async p=>{await touch('touchStart',p);await touch('touchEnd');};
    const center=sel=>page.locator(sel).evaluate(e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
    const step=s=>page.evaluate(s=>{__lp.noRender=true;for(let i=0;i<s*60;i++)__lp.update(1/60);renderer.render(scene,camera);},s);
    const project=i=>page.evaluate(i=>{const y=toyWorld.yards[state.originIdx],w=y.windmills[i];const v=w?new THREE.Vector3(w.x,w.y+TW.garden.height,w.z):new THREE.Vector3(state.x+Math.sin(state.heading)*15,y.y,state.z+Math.cos(state.heading)*15);v.project(camera);const p={x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};return{...p,visible:v.z<1&&p.x>0&&p.x<innerWidth&&p.y>0&&p.y<document.getElementById('dash').getBoundingClientRect().top&&document.elementFromPoint(p.x,p.y)?.id==='gl'};},i);
    const aim=async i=>{let p=await project(i);if(!p.visible){const back=await project(-1);if(back.visible){await tap(back);await step(5);}p=await project(i);}if(p.visible)await tap(p);return p;};
    const shot=name=>page.screenshot({path:path.join(shots,`garden-${airport?'ca-':''}${width}x${height}-${name}.png`)});
    await tap(await center('[data-v="helicopter"]'));await tap(await center(`[data-d="${airport}"]`));await step(2);
    await touch('touchStart',await center('#heliUpBtn'));await step(4);await touch('touchEnd');await step(1);await shot('discovery');
    const visits=[];
    for(let i=0;i<3;i++){
      const p=await aim(i);
      for(let n=0;n<24;n++){await step(.25);if(await page.evaluate(i=>toyWorld.yards[state.originIdx].windmills[i].plays>0,i))break;}
      await shot(`note-${i}`);await step(5);
      visits.push({p,...await page.evaluate(i=>{const w=toyWorld.yards[state.originIdx].windmills[i];return{plays:w.plays,spin:w.speed,near:Math.hypot(state.x-w.x,state.z-w.z)<TW.garden.reach};},i)});
    }
    check(`wind garden ${airport?'CA':'NY'} ${width}x${height}: discover, fly to three visible pinwheels and make them spin`,visits.every(v=>v.p.visible&&v.plays>=1&&v.spin>TW_SPIN_MIN&&v.near),JSON.stringify(visits));
    const before=await page.evaluate(()=>toyWorld.yards[state.originIdx].windmills.map(w=>w.plays));await step(8);
    const quiet=await page.evaluate(b=>toyWorld.yards[state.originIdx].windmills.every((w,i)=>w.plays===b[i]),before);
    const back=await aim(0);await step(10);
    const replay=await page.evaluate(()=>toyWorld.yards[state.originIdx].windmills[0].plays);
    check(`wind garden ${airport?'CA':'NY'} ${width}x${height}: hovering stays quiet, leaving and returning plays again`,quiet&&back.visible&&replay>=2,JSON.stringify({quiet,back,replay}));await shot('replay');
    // Cancel a held direction and an altitude touch, then land and leave via picker.
    await touch('touchStart',{x:width*.5,y:height*.35});await touch('touchCancel');
    await touch('touchStart',await center('#heliUpBtn'));await step(.2);await touch('touchCancel');
    const cancel=await page.evaluate(()=>!state.touching&&!heliGesture.active&&heli.vertical===0);
    await tap(await center('#heliHoverBtn'));
    await touch('touchStart',await center('#heliDownBtn'));await step(20);await touch('touchEnd');await step(1);
    const landed=await page.evaluate(()=>state.phase==='TAXI'&&pickerCanOpen());
    if(landed){await tap(await center('#vehBtn'));await tap(await center('[data-v="prop"]'));await tap(await center(`[data-d="${airport}"]`));await step(2);}
    const exit=await page.evaluate(()=>({vehicle:state.vehicleKey,phase:state.phase,active:toyWorld.yards[state.originIdx].windmills.some(w=>w.inside),held:!!toyWorld.held}));
    check(`wind garden ${airport?'CA':'NY'} ${width}x${height}: interrupted touches, landing and switching back to a plane`,cancel&&landed&&exit.vehicle==='prop'&&exit.phase==='TAXI'&&!exit.active&&!exit.held,JSON.stringify({cancel,landed,exit}));await shot('exit');
    check(`wind garden ${airport?'CA':'NY'} ${width}x${height}: no browser or frame errors`,errors.length===0&&await page.evaluate(()=>!window.__lp.frameErrors),JSON.stringify(errors));
    await page.close();
  }
};
const TW_SPIN_MIN=2;
