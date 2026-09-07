// Normal clock, ordinary altitude buttons, no state writes or simulation steps.
const {chromium}=require('playwright-core'),{serve}=require('./polish_check'),{once}=require('events'),path=require('path'),fs=require('fs');
(async()=>{
 const out=path.resolve(__dirname,'../docs/helicopter-polish/rescue-gameplay');fs.mkdirSync(out,{recursive:true});
 const server=serve(path.resolve(__dirname,'..'),0);await once(server,'listening');
 const browser=await chromium.launch({executablePath:process.env.CHROME_HEADLESS_SHELL,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
 const epoch=Date.now(),context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,recordVideo:{dir:path.join(out,'video'),size:{width:844,height:390}}});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/cockpit/`);await page.waitForFunction(()=>window.__lp);
 const cdp=await context.newCDPSession(page),touch=(type,p)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:p?[{...p,id:1}]:[]});
 const centre=async sel=>{await page.locator(sel).waitFor({state:'visible'});return page.locator(sel).evaluate(e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});};
 const wait=fn=>page.waitForFunction(fn,null,{polling:100,timeout:180000});
 const shot=async name=>{console.log('SHOT',name,((Date.now()-epoch)/1000).toFixed(2));await page.screenshot({path:path.join(out,name+'.png')});};
 await page.locator('[data-v="helicopter"]').tap();await page.locator('[data-d="0"]').tap();
 await touch('touchStart',await centre('#heliUpBtn'));await wait(()=>state.y>68);await touch('touchEnd');await wait(()=>Math.abs(heli.vy)<.5);console.log('LIFTED');
 await touch('touchStart',await centre('#heliDownBtn'));await wait(()=>state.y<62);await touch('touchEnd');await wait(()=>Math.abs(heli.vy)<.5);
 await page.locator('#ejectBtn').tap();await wait(()=>eject.canopyOpen);await shot('canopy');
 await wait(()=>eject.impact);await shot('impact');await wait(()=>!eject.active);await shot('return');
 const result=await page.evaluate(()=>({last:eject.last,phase:state.phase,errors:__lp.frameErrors||0}));
 console.log('RESCUE',JSON.stringify({errors,...result}));if(errors.length||result.errors||!result.last.returned||!result.last.canopyAtImpact)throw Error('Rescue failed');
 await context.close();console.log('Video:',await page.video().path());
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
