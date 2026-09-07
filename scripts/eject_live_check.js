// Keep an installed release open across a deployment, then verify the actual
// service-worker update and an offline touch interaction. Run manually when
// shipping; press Enter only after the server publishes the tested revision.
const {chromium}=require('playwright-core');
const {once}=require('events');
const path=require('path');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_HEADLESS_SHELL,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const context=await browser.newContext({viewport:{width:1024,height:768},hasTouch:true});
    await context.addInitScript('window.requestAnimationFrame=()=>0;');
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const url=process.env.LP_PLAY_URL||'https://flightsim.138.197.80.104.nip.io/cockpit/';
    await page.goto(url);await page.waitForFunction(()=>window.__lp);await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.reload();await page.waitForFunction(()=>window.__lp);
    const step=s=>page.evaluate(s=>{__lp.noRender=true;for(let i=0;i<s*60;i++)__lp.update(1/60);renderer.render(scene,camera);},s);
    await page.locator('[data-v="helicopter"]').tap();await page.locator('[data-d="0"]').tap();await step(1);
    console.log('BEFORE',JSON.stringify(await page.evaluate(async()=>({caches:await caches.keys(),workshop:typeof twUpdateRobotGreeting,phase:state.phase,controller:!!navigator.serviceWorker.controller}))));
    if(!process.argv.includes('--current')){
      console.log('READY: installed release is parked. Press Enter after deployment (use a terminal/TTY).');
      await once(process.stdin,'data');
      await page.evaluate(()=>{navigator.serviceWorker.getRegistration().then(r=>r.update());});
    }
    await page.waitForFunction(()=>typeof ejectStart==='function',{},{timeout:120000,polling:100});
    await page.waitForFunction(()=>window.__lp);
    const upgraded=await page.evaluate(async()=>({caches:await caches.keys(),vehicle:state.vehicleKey,phase:state.phase,yards:toyWorld.yards.length,greeting:TW.greeting.duration}));
    if(upgraded.phase!=='TAXI'||upgraded.vehicle!=='helicopter'||!upgraded.caches.includes('little-pilot-cockpit-v86-eject')||upgraded.caches.some(k=>k.startsWith('little-pilot-cockpit-')&&k!=='little-pilot-cockpit-v86-eject'))throw Error(JSON.stringify(upgraded));
    console.log('UPGRADED',JSON.stringify(upgraded));
    await context.setOffline(true);await page.reload();await page.waitForFunction(()=>window.__lp);await step(1);
    const cdp=await context.newCDPSession(page);
    const touch=(type,p)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:p?[{x:p.x,y:p.y,id:1}]:[]});
    const center=selector=>page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
    await touch('touchStart',await center('#heliUpBtn'));await step(4);await touch('touchEnd');await step(1);
    const p=await page.evaluate(()=>{const w=toyWorld.yards[0].windmills[0],v=new THREE.Vector3(w.x,w.y+TW.garden.height,w.z).project(camera);return{x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};});
    if(!await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.id==='gl',p))throw Error('Pinwheel not visibly tappable');
    await touch('touchStart',p);await touch('touchEnd');await step(10);
    await page.screenshot({path:path.resolve(__dirname,'../qa-screenshots/live-v86-offline-pinwheel.png')});
    const final=await page.evaluate(async()=>({notes:toyWorld.yards[0].windmills[0].plays,spin:toyWorld.yards[0].windmills[0].speed,frameErrors:__lp.frameErrors||0,caches:await caches.keys()}));
    console.log('OFFLINE TOUCH',JSON.stringify({errors,...final}));
    if(errors.length||final.frameErrors||final.notes<1||final.spin<2)throw Error('Live offline play failed');
    await page.locator('#ejectBtn').tap();await step(3.5);
    await page.screenshot({path:path.resolve(__dirname,'../qa-screenshots/live-v86-offline-eject.png')});
    await step(22);const rescue=await page.evaluate(()=>({last:eject.last,active:eject.active,phase:state.phase,key:state.vehicleKey,frameErrors:__lp.frameErrors||0}));
    console.log('OFFLINE RESCUE',JSON.stringify(rescue));
    if(rescue.active||!rescue.last?.returned||!rescue.last.canopyAtImpact||rescue.last.contactError>.02||rescue.phase!=='TAXI'||rescue.key!=='helicopter'||rescue.frameErrors)throw Error('Live offline rescue failed');
    console.log(process.argv.includes('--current')?'PASS live release loads, preserves the selected vehicle and plays the workshop and eject rescue offline':'PASS installed release updates at runway, preserves vehicle and plays workshop and eject rescue offline');
  }finally{await browser.close();process.stdin.pause();}
})().catch(e=>{console.error(e);process.exitCode=1;});
