// End-to-end: UI vehicle selection and touch input only. World state is read for
// assertions/projecting visible objects, never moved or used to invoke actions.
const path = require('path');
module.exports = async function heliPlayChecks({ newPage, check, shots }) {
  for (const [width, height] of [[1024,768],[768,1024],[844,390],[390,844]]) {
    const { page } = await newPage(width, height);
    await page.reload(); await page.waitForFunction(() => window.__lp);
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y, id: 1 }] : [] });
    const tap = async p => { await touch('touchStart', p); await touch('touchEnd'); };
    const center = selector => page.locator(selector).evaluate(e => { const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; });
    const step = seconds => page.evaluate(s => { window.__lp.noRender=true; for(let i=0;i<s*60;i++) { window.__lp.update(1/60); window.__playCablePeak=Math.max(window.__playCablePeak||0,toyWorld.cableLength); } renderer.render(scene,camera); }, seconds);
    const hold = async (selector, seconds) => { await touch('touchStart', await center(selector)); await step(seconds); await touch('touchEnd'); await step(.1); };
    const project = (kind) => page.evaluate(kind => {
      const o=toyWorld.objects[0], y=o.yard;
      const v=kind==='cargo' ? new THREE.Vector3(o.x,twCargoTop(o),o.z) : kind==='pad' ? new THREE.Vector3(y.pad.x,y.y+1,y.pad.z) : new THREE.Vector3(state.x+Math.sin(state.heading)*15, y.y, state.z+Math.cos(state.heading)*15);
      v.project(camera); const p={x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};
      return {...p, visible:v.z<1&&p.x>0&&p.x<innerWidth&&p.y>0&&p.y<innerHeight&&document.elementFromPoint(p.x,p.y)?.id==='gl'};
    },kind);
    const shot = async name => page.screenshot({path:path.join(shots,`heli-play-${width}x${height}-${name}.png`)});
    await tap(await center('[data-v="helicopter"]')); await tap(await center('[data-d="0"]')); await step(2);
    await hold('#heliUpBtn',4); await step(1); await shot('spawn');
    const cargoPoint=await project('cargo');
    if (!cargoPoint.visible) { check(`helicopter play ${width}x${height}: cargo visible from spawn`,false,JSON.stringify(cargoPoint)); await page.close(); continue; }
    await tap(cargoPoint); await step(5); await shot('winch'); await step(11);
    const pickup=await page.evaluate(()=>({held:toyWorld.held===toyWorld.objects[0],y:state.y,phase:state.phase,speed:state.speed,rope:toyWorld.cableLength,tip:state.y-toyWorld.cableLength-TW.playground.hookDepth,top:twCargoTop(toyWorld.objects[0]),view:state.viewChase,peakCable:window.__playCablePeak}));
    await shot('pickup');
    check(`helicopter play ${width}x${height}: spawn, climb, tap a visible block, winch pickup`,pickup.held&&pickup.peakCable>30&&pickup.phase==='AIRBORNE'&&pickup.y>60&&Math.abs(pickup.tip-pickup.top)<.01&&pickup.view,JSON.stringify(pickup));
    // A wobbly held finger must not chase the moving camera. Deliberate drag
    // still changes the destination; switching to altitude preserves that choice.
    const pad=await project('pad');
    await touch('touchStart',pad);
    const before=await page.evaluate(()=>({...heli.target}));
    for(let i=0;i<5;i++){await step(.2);await touch('touchMove',{x:pad.x+(i%2),y:pad.y});}
    const steady=await page.evaluate(t=>JSON.stringify(heli.target)===JSON.stringify(t),before);
    await touch('touchEnd');
    const y0=await page.evaluate(()=>state.y); await hold('#heliUpBtn',1); await step(.5);
    const carry=await page.evaluate(t=>({held:toyWorld.held===toyWorld.objects[0],target:JSON.stringify(heli.target)===JSON.stringify(t),y:state.y,vertical:heli.vertical,speed:state.speed}),before);
    await step(10); await shot('carry');
    const carried=await page.evaluate(()=>({x:toyWorld.objects[0].x,z:toyWorld.objects[0].z,homeX:toyWorld.objects[0].homeX,homeZ:toyWorld.objects[0].homeZ}));
    await tap(await center('#magnetBtn')); await step(.5);
    const released=await page.evaluate(()=>!toyWorld.held&&toyWorld.objects[0].lock);
    await step(9);
    const delivery=await page.evaluate(()=>({built:toyWorld.yards[0].built,home:Math.hypot(toyWorld.objects[0].x-toyWorld.objects[0].homeX,toyWorld.objects[0].z-toyWorld.objects[0].homeZ)<1,held:!!toyWorld.held}));
    check(`helicopter play ${width}x${height}: finger wobble, sequential climb, carry, release, delivery and replenishment`,steady&&carry.held&&carry.target&&carry.y>y0+8&&carry.vertical===0&&Math.hypot(carried.x-carried.homeX,carried.z-carried.homeZ)>45&&released&&delivery.built===1&&delivery.home,JSON.stringify({steady,carry,released,delivery,pad}));
    await shot('delivery');
    const workshop = await page.evaluate(()=>{
      const y=toyWorld.yards[0],v=y.buildGroup.localToWorld(new THREE.Vector3(0,31,5)).project(camera);
      const x=(v.x+1)*innerWidth/2,py=(1-v.y)*innerHeight/2;
      return {parts:y.build.filter(m=>m.visible).length,face:y.face.visible,dancing:y.danceT>0,faceVisible:v.z<1&&x>0&&x<innerWidth&&py>0&&py<innerHeight&&document.elementFromPoint(x,py)?.id==='gl',facePoint:{x,y:py}};
    });
    check(`workshop ${width}x${height}: first delivery reveals a whole dancing robot`,workshop.parts===12&&workshop.face&&workshop.dancing&&workshop.faceVisible,JSON.stringify(workshop));
    // Turn around by tapping the visible ground just behind the helicopter.
    // This is another ordinary destination tap, not an internal heading change.
    const back=await project('back');
    if(back.visible) { await tap(back); await step(5); }
    await hold('#heliDownBtn',1); await step(1);
    const again=await project('cargo');
    if(again.visible) { await tap(again); await step(16); }
    const repeat=await page.evaluate(()=>({held:!!toyWorld.held,cargo:toyWorld.objects.indexOf(toyWorld.held),phase:state.phase}));
    check(`helicopter play ${width}x${height}: return and pick up again using only sequential touches`,again.visible&&repeat.held&&repeat.phase==='AIRBORNE',JSON.stringify({back,again,repeat}));
    if(repeat.held) {
      const turn=await project('back');
      if(turn.visible) { await tap(turn); await step(5); }
      const repeatPad=await project('pad');
      if(repeatPad.visible) { await tap(repeatPad); await step(12); }
      await tap(await center('#magnetBtn')); await step(9);
      const rebuilt=await page.evaluate(()=>({built:toyWorld.yards[0].built,style:toyWorld.yards[0].style,parts:toyWorld.yards[0].build.filter(m=>m.visible).length,face:toyWorld.yards[0].face.visible,held:!!toyWorld.held}));
      check(`workshop ${width}x${height}: another delivery freely rebuilds a different robot`,repeatPad.visible&&rebuilt.built===2&&rebuilt.style===1&&rebuilt.parts===12&&rebuilt.face&&!rebuilt.held,JSON.stringify(rebuilt));
      await shot('rebuild');
    }
    await shot('drop');
    await tap(await center('#viewBtn')); await step(.3);
    const aim={x:width*.52,y:height*.3};
    await touch('touchStart',aim);
    const t0=await page.evaluate(()=>({...heli.target}));
    await touch('touchMove',{x:aim.x+30,y:aim.y});
    const t1=await page.evaluate(()=>({...heli.target}));
    await step(.4); await touch('touchMove',{x:aim.x+31,y:aim.y});
    const moved=await page.evaluate(t=>JSON.stringify(heli.target)===JSON.stringify(t),t1);
    await touch('touchCancel');
    const cancelled=await page.evaluate(()=>!state.touching&&!heliGesture.active);
    await touch('touchStart',await center('#heliUpBtn')); await step(.2); await touch('touchCancel');
    const altitudeCancelled=await page.evaluate(()=>heli.vertical===0);
    check(`helicopter play ${width}x${height}: deliberate drag works, tiny motion stays stable, interrupted touches release`,Math.hypot(t1.x-t0.x,t1.z-t0.z)>5&&moved&&cancelled&&altitudeCancelled,JSON.stringify({t0,t1,moved,cancelled,altitudeCancelled}));
    await page.close();
  }
};
