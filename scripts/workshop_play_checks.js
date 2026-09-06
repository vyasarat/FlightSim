// All play-loop actions use UI touch controls. Read-only projections choose
// visible targets; the harness advances time but never relocates the player.
const path = require('path');
module.exports = async function workshopPlayChecks({newPage, check, shots}) {
  for (const [width,height] of [[1024,768],[768,1024],[844,390],[390,844]]) {
    const {page} = await newPage(width,height);
    const cdp = await page.context().newCDPSession(page);
    const touch = (type,p) => cdp.send('Input.dispatchTouchEvent',{type,touchPoints:p?[{x:p.x,y:p.y,id:1}]:[]});
    const tap = async p => {await touch('touchStart',p);await touch('touchEnd');};
    const center = selector => page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
    const step = seconds => page.evaluate(s=>{window.__lp.noRender=true;for(let i=0;i<s*60;i++)window.__lp.update(1/60);renderer.render(scene,camera);},seconds);
    const hold = async (selector,seconds)=>{await touch('touchStart',await center(selector));await step(seconds);await touch('touchEnd');await step(.1);};
    const project = kind => page.evaluate(kind=>{
      const yard=toyWorld.yards[0],o=toyWorld.objects[0];
      let v;
      if(kind==='cargo')v=new THREE.Vector3(o.x,twCargoTop(o),o.z);
      else if(kind==='slide')v=new THREE.Vector3(yard.slide.x,yard.y+TW.slide.height,yard.slide.z);
      else if(kind==='exit')v=new THREE.Vector3(yard.slide.exitX,yard.y+1,yard.slide.exitZ);
      else v=new THREE.Vector3(state.x+Math.sin(state.heading)*15,yard.y,state.z+Math.cos(state.heading)*15);
      v.project(camera);const p={x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};
      return {...p,visible:v.z<1&&p.x>0&&p.x<innerWidth&&p.y>0&&p.y<document.getElementById('dash').getBoundingClientRect().top&&document.elementFromPoint(p.x,p.y)?.id==='gl'};
    },kind);
    const aim = async kind => { let p=await project(kind);if(!p.visible){const turn=await project('back');if(turn.visible){await tap(turn);await step(5);}p=await project(kind);}if(p.visible)await tap(p);return p;};
    const shot = name => page.screenshot({path:path.join(shots,`workshop-${width}x${height}-${name}.png`)});
    await tap(await center('[data-v="helicopter"]'));await tap(await center('[data-d="0"]'));await step(2);
    await hold('#heliUpBtn',4);await step(1);await shot('discovery');
    const cargo=await aim('cargo');await step(16);
    const picked=await page.evaluate(()=>toyWorld.held===toyWorld.objects[0]);
    const slide=await aim('slide');await step(12);await shot('slide-entry');
    if(picked)await tap(await center('#magnetBtn'));
    await step(4.2);await shot('slide-ride');await step(11.8);
    const done=await page.evaluate(()=>({runs:toyWorld.yards[0].slide.completed,held:!!toyWorld.held,delivering:toyWorld.objects[0].delivering,x:toyWorld.objects[0].x,z:toyWorld.objects[0].z,homeX:toyWorld.objects[0].homeX,homeZ:toyWorld.objects[0].homeZ,built:toyWorld.yards[0].built}));
    check(`workshop slide ${width}x${height}: picker, pickup, visible cup, drop, slide, crane build and cargo return`,cargo.visible&&picked&&slide.visible&&done.runs===1&&!done.held&&!done.delivering&&done.built===1&&Math.hypot(done.x-done.homeX,done.z-done.homeZ)<2,JSON.stringify({cargo,slide,done}));
    await shot('slide-exit');
    const returned=await aim('cargo');await step(16);
    const again=await page.evaluate(()=>toyWorld.held===toyWorld.objects[0]);
    const repeat=await aim('slide');await step(12);
    if(again)await tap(await center('#magnetBtn'));await step(16);
    const replay=await page.evaluate(()=>toyWorld.yards[0].slide.completed);
    check(`workshop slide ${width}x${height}: collect the returned toy and replay`,returned.visible&&again&&repeat.visible&&replay===2,JSON.stringify({returned,again,repeat,replay}));
    await shot('slide-replay');
    await page.close();
  }
};
